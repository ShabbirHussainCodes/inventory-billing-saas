"""
BillingMars — Custom Roles + Permission Editor (Phase C)

Lets a business Owner (or Founder, via the existing Owner-role-permission-
set parity in has_permission()) create roles beyond the 5 fixed system
roles (Owner, Manager, Sales Staff, Accountant, Viewer), with a hand-
picked set of permissions from the full catalog.

Everything here is gated on the 'role.manage_custom' permission, NOT the
broader 'team.manage' — these were deliberately seeded as separate
permissions from Phase A (see teams/migrations/0002_seed_roles_and_
permissions.py and 0005_business_settings_perms_and_role_matrix.py's
"Deliberately excluded: team.manage, role.manage_custom" comment on
Manager). Today only Owner has role.manage_custom — Manager can invite/
suspend/remove staff (team.manage) but cannot define what NEW roles
exist. This mirrors real SaaS practice: day-to-day people-management is
more common than role-design, so they're split.

Founder parity note: this needed ZERO new Stage-C-style code. Founder-
in-Edit-Mode's has_permission() branch already checks the codename
against the tenant's Owner role's actual permission set (see
teams/permissions.py) — since Owner has role.manage_custom, Founder
automatically gets it too, for free, by the existing mechanism. Custom
role creation isn't an "Owner-membership-touching" action in the Stage
C/D sense (it doesn't suspend/remove/demote anyone), so it doesn't need
the reason+notes friction those actions require.

Plan gate: custom roles are an Enterprise-only feature (Tenant.access_type,
see tenants/plan_limits.py's PLAN_FEATURES['custom_roles']) — checked only
at CREATE time. A tenant that downgrades keeps whatever custom roles it
already has (no retroactive breakage), it just can't create new ones
until it upgrades again.
"""
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Role, Permission, RolePermission, Membership, ActivityLog
from .permissions import has_permission
from superadmin.utils import get_active_tenant
from tenants.plan_limits import has_feature

PLAN_GATE_MESSAGE = 'Custom roles require an Enterprise plan. Ask the Founder to upgrade this business.'


def _serialize_role(role, codenames=None):
    if codenames is None:
        codenames = list(role.role_permissions.values_list('permission__codename', flat=True))
    return {
        'id': str(role.id),
        'name': role.name,
        'description': role.description,
        'is_system_role': role.is_system_role,
        'permission_codenames': codenames,
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def permission_catalog(request):
    """
    Full permission catalog, for building the checkbox editor. Grouped
    by category client-side is easy enough from this flat list — kept
    flat here to match how Permission itself is queried/ordered
    (Meta.ordering = ['category', 'codename']).
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'role.manage_custom'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    permissions = Permission.objects.all()
    return Response([{
        'codename': p.codename,
        'category': p.category,
        'label': p.label,
        'description': p.description,
    } for p in permissions])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_custom_role(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'role.manage_custom'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    if not has_feature(tenant, 'custom_roles'):
        return Response({'plan_limit': True, 'error': PLAN_GATE_MESSAGE, 'resource': 'custom_roles'}, status=403)

    name = (request.data.get('name') or '').strip()
    description = (request.data.get('description') or '').strip()
    codenames = request.data.get('permission_codenames') or []

    if not name:
        return Response({'error': 'name is required.'}, status=400)
    if not isinstance(codenames, list) or not codenames:
        return Response({'error': 'permission_codenames must be a non-empty list.'}, status=400)

    # Case-insensitive collision check against BOTH system roles and this
    # tenant's other custom roles — the DB constraint only catches exact
    # matches within the same scope, this gives a friendlier error and
    # also blocks e.g. a custom role literally named "owner".
    from django.db.models import Q
    if Role.objects.filter(Q(tenant__isnull=True) | Q(tenant=tenant), name__iexact=name).exists():
        return Response({'error': f'A role named "{name}" already exists.'}, status=400)

    valid_permissions = list(Permission.objects.filter(codename__in=codenames))
    if len(valid_permissions) != len(set(codenames)):
        found = {p.codename for p in valid_permissions}
        invalid = set(codenames) - found
        return Response({'error': f'Unknown permission codename(s): {", ".join(sorted(invalid))}.'}, status=400)

    try:
        with transaction.atomic():
            role = Role.objects.create(
                tenant=tenant, name=name, description=description, is_system_role=False,
            )
            RolePermission.objects.bulk_create([
                RolePermission(role=role, permission=p) for p in valid_permissions
            ])
    except IntegrityError:
        return Response({'error': f'A role named "{name}" already exists.'}, status=400)

    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='role_created',
        target_type='role', target_name=role.name,
        details={'permission_codenames': codenames},
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'role_created', tenant=tenant,
                   target_type='role', target_name=role.name,
                   details={'permission_codenames': codenames})

    return Response(_serialize_role(role, codenames), status=201)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_custom_role(request, role_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'role.manage_custom'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    role = Role.objects.filter(pk=role_id, tenant=tenant, is_system_role=False).first()
    if not role:
        return Response({'error': 'Custom role not found.'}, status=404)

    from django.db.models import Q
    changes = {}

    if 'name' in request.data:
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'name cannot be blank.'}, status=400)
        if Role.objects.filter(Q(tenant__isnull=True) | Q(tenant=tenant), name__iexact=name).exclude(pk=role.pk).exists():
            return Response({'error': f'A role named "{name}" already exists.'}, status=400)
        if name != role.name:
            changes['name'] = {'from': role.name, 'to': name}
        role.name = name

    if 'description' in request.data:
        role.description = (request.data.get('description') or '').strip()

    new_codenames = None
    if 'permission_codenames' in request.data:
        new_codenames = request.data.get('permission_codenames') or []
        if not isinstance(new_codenames, list) or not new_codenames:
            return Response({'error': 'permission_codenames must be a non-empty list.'}, status=400)
        valid_permissions = list(Permission.objects.filter(codename__in=new_codenames))
        if len(valid_permissions) != len(set(new_codenames)):
            found = {p.codename for p in valid_permissions}
            invalid = set(new_codenames) - found
            return Response({'error': f'Unknown permission codename(s): {", ".join(sorted(invalid))}.'}, status=400)
        changes['permission_codenames'] = True

    try:
        with transaction.atomic():
            role.save()
            if new_codenames is not None:
                RolePermission.objects.filter(role=role).delete()
                RolePermission.objects.bulk_create([
                    RolePermission(role=role, permission=p) for p in valid_permissions
                ])
    except IntegrityError:
        return Response({'error': f'A role named "{role.name}" already exists.'}, status=400)

    if changes:
        ActivityLog.objects.create(
            actor=request.user, tenant=tenant, action='role_updated',
            target_type='role', target_name=role.name, details=changes,
        )
        if request.user.role == 'super_admin':
            from superadmin.audit import log_action
            log_action(request, 'role_updated', tenant=tenant,
                       target_type='role', target_name=role.name, details=changes)

    return Response(_serialize_role(role))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_custom_role(request, role_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'role.manage_custom'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    role = Role.objects.filter(pk=role_id, tenant=tenant, is_system_role=False).first()
    if not role:
        return Response({'error': 'Custom role not found.'}, status=404)

    in_use_count = Membership.objects.filter(tenant=tenant, role=role).exclude(status='removed').count()
    if in_use_count > 0:
        return Response({
            'error': f'{in_use_count} member(s) still have this role — reassign them to a '
                     f'different role first, then delete it.'
        }, status=400)

    role_name = role.name
    role.delete()

    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='role_deleted',
        target_type='role', target_name=role_name, details={},
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'role_deleted', tenant=tenant, target_type='role', target_name=role_name, details={})

    return Response({'message': 'Role deleted.'})
