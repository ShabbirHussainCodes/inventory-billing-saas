"""
BillingMars — Platform Case framework (Phase B.6 Stage E)

See superadmin.models.PlatformCase for the full design rationale. Short
version: this is for EXCEPTIONAL / adversarial situations (fraud, legal
requests, ownership disputes, account recovery, emergency intervention),
kept deliberately separate from Stage C's routine Founder-assisted
actions (teams/views.py's _founder_ownership_fields path). A case can sit
open while things get sorted out off-platform; the actual system action
only happens when the case is closed.

Two case types implemented so far:
- forced_ownership_transfer: reuses the same atomic Primary Owner swap
  as teams.views.make_primary_owner, but through this case-tracked path
  for disputed/adversarial handoffs rather than routine ones.
- account_recovery: wraps the pre-existing (and previously totally
  unaudited) reset_user_password endpoint — same underlying action
  (make_password + save), now with a mandatory reason, identity
  verification, and a full case record instead of nothing at all.

Every endpoint here is Founder-only (is_super_admin), same gate as the
rest of the superadmin app.
"""
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from tenants.models import Tenant
from users.models import CustomUser
from teams.models import Membership, ActivityLog
from superadmin.models import PlatformCase
from superadmin.views import is_super_admin
from superadmin.audit import log_action

# Which AuditLog action a given case_type's execution should be logged
# as, both in the business's own ActivityLog (no case reference — looks
# like any other normal action) and the Founder's AuditLog (WITH a
# platform_case_id reference). Case types without an entry here fall
# back to the generic 'platform_case_closed' action.
CASE_TYPE_EXECUTION_ACTION = {
    'forced_ownership_transfer': 'primary_owner_transferred',
    'account_recovery': 'password_reset',
}


def _serialize_case(case):
    return {
        'id': str(case.id),
        'case_type': case.case_type,
        'case_type_label': case.get_case_type_display(),
        'status': case.status,
        'tenant_id': str(case.tenant_id),
        'tenant_name': case.tenant.name,
        'target_user_email': case.target_user.email if case.target_user else None,
        'target_membership_id': str(case.target_membership_id) if case.target_membership_id else None,
        'target_membership_name': (
            (case.target_membership.user.email if case.target_membership.user else case.target_membership.invite_email)
            if case.target_membership else None
        ),
        'reason': case.reason,
        'identity_verification_notes': case.identity_verification_notes,
        'details': case.details,
        'created_by_email': case.created_by.email,
        'created_at': case.created_at.isoformat(),
        'resolution_notes': case.resolution_notes,
        'resolution_details': case.resolution_details,
        'executed_by_email': case.executed_by.email if case.executed_by else None,
        'closed_at': case.closed_at.isoformat() if case.closed_at else None,
    }


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_platform_case(request):
    """
    Open a new Platform Case. Does NOT execute any action — that only
    happens at close_platform_case(). Just documents that an exceptional
    situation has started, with mandatory reason + identity verification,
    right at the moment the Founder becomes aware of it.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    case_type = request.data.get('case_type')
    valid_types = dict(PlatformCase.CASE_TYPE_CHOICES)
    if case_type not in valid_types:
        return Response({'error': f'Invalid case_type. Must be one of: {", ".join(valid_types)}.'}, status=400)

    tenant_id = request.data.get('tenant_id')
    tenant = Tenant.objects.filter(pk=tenant_id).first() if tenant_id else None
    if not tenant:
        return Response({'error': 'Valid tenant_id is required.'}, status=400)

    reason = (request.data.get('reason') or '').strip()
    notes = (request.data.get('identity_verification_notes') or '').strip()
    if not reason or not notes:
        return Response({'error': 'reason and identity_verification_notes are required.'}, status=400)

    target_user = None
    target_membership = None

    if case_type == 'forced_ownership_transfer':
        membership_id = request.data.get('target_membership_id')
        if not membership_id:
            return Response({'error': 'target_membership_id is required for forced_ownership_transfer.'}, status=400)
        target_membership = Membership.objects.filter(
            pk=membership_id, tenant=tenant, role__name='Owner', status='active'
        ).select_related('user', 'role').first()
        if not target_membership:
            return Response({'error': 'target_membership_id must be an active Owner in this business.'}, status=400)

    elif case_type == 'account_recovery':
        user_id = request.data.get('target_user_id')
        if not user_id:
            return Response({'error': 'target_user_id is required for account_recovery.'}, status=400)
        target_user = CustomUser.objects.filter(pk=user_id).first()
        if not target_user:
            return Response({'error': 'target_user_id not found.'}, status=400)
        has_membership = Membership.objects.filter(user=target_user, tenant=tenant, status='active').exists()
        if not has_membership:
            return Response({'error': 'This user has no active membership in this business.'}, status=400)

    case = PlatformCase.objects.create(
        case_type=case_type,
        tenant=tenant,
        target_user=target_user,
        target_membership=target_membership,
        reason=reason,
        identity_verification_notes=notes,
        details=request.data.get('details') or {},
        created_by=request.user,
    )

    log_action(
        request, 'platform_case_opened', tenant=tenant,
        target_type='platform_case', target_name=str(case.id),
        details={
            'case_type': case_type,
            'reason': reason,
            'identity_verification_notes': notes,
            'target_user_email': target_user.email if target_user else None,
            'target_membership_id': str(target_membership.id) if target_membership else None,
        },
    )

    return Response(_serialize_case(case), status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_members_for_case(request, tenant_id):
    """
    Lightweight member list for the case-creation UI to pick a target
    from — NOT the same as teams.views.member_list (which requires an
    active SupportSession + team.manage permission check). This mirrors
    the existing "old superadmin endpoints" pattern (tenant_products,
    tenant_customers, etc.) — direct read access to a tenant's data for
    the Founder Panel, no workspace session needed. Read-only, no
    mutation, so no reason/notes required just to view this list.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    tenant = Tenant.objects.filter(pk=tenant_id).first()
    if not tenant:
        return Response({'error': 'Tenant not found.'}, status=404)

    members = Membership.objects.filter(tenant=tenant, status='active').select_related('user', 'role')
    return Response([{
        'membership_id': str(m.id),
        'user_id': str(m.user_id) if m.user_id else None,
        'email': m.user.email if m.user else m.invite_email,
        'name': (m.user.first_name if m.user else '') or '',
        'role_name': m.role.name,
        'is_primary_owner': m.is_primary_owner,
    } for m in members])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_platform_cases(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    cases = PlatformCase.objects.select_related(
        'tenant', 'target_user', 'target_membership', 'target_membership__user',
        'created_by', 'executed_by',
    )

    status_filter = request.query_params.get('status')
    if status_filter:
        cases = cases.filter(status=status_filter)

    case_type_filter = request.query_params.get('case_type')
    if case_type_filter:
        cases = cases.filter(case_type=case_type_filter)

    tenant_id = request.query_params.get('tenant_id')
    if tenant_id:
        cases = cases.filter(tenant_id=tenant_id)

    return Response([_serialize_case(c) for c in cases])


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_case_detail(request, case_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    case = PlatformCase.objects.select_related(
        'tenant', 'target_user', 'target_membership', 'target_membership__user',
        'created_by', 'executed_by',
    ).filter(pk=case_id).first()
    if not case:
        return Response({'error': 'Case not found.'}, status=404)

    return Response(_serialize_case(case))


def _execute_forced_ownership_transfer(case):
    """
    Returns (ok, error_response_or_None, activity_details, audit_details).
    Same atomic off-then-on swap as teams.views.make_primary_owner's
    Founder branch — deliberately not calling that view directly, since
    this path has its own case-scoped validation and needs to build its
    own log entries with the platform_case_id reference.
    """
    target = Membership.objects.filter(
        pk=case.target_membership_id, tenant=case.tenant, status='active', role__name='Owner'
    ).select_related('user').first()
    if not target:
        return False, Response(
            {'error': 'The target membership is no longer an active Owner — cannot execute this case.'}, status=400
        ), None, None

    current_primary = Membership.objects.filter(
        tenant=case.tenant, status='active', is_primary_owner=True
    ).select_related('user').first()
    if not current_primary:
        return False, Response({'error': 'This business has no active Primary Owner.'}, status=400), None, None

    if target.pk == current_primary.pk:
        return False, Response({'error': 'This member is already the Primary Owner.'}, status=400), None, None

    with transaction.atomic():
        current_primary.is_primary_owner = False
        current_primary.save(update_fields=['is_primary_owner'])
        target.is_primary_owner = True
        target.save(update_fields=['is_primary_owner'])

    from_name = current_primary.user.first_name if current_primary.user else current_primary.invite_email
    to_name = target.user.first_name if target.user else target.invite_email

    activity_details = {'from': from_name, 'to': to_name}
    audit_details = {'from': from_name, 'to': to_name, 'platform_case_id': str(case.id)}
    return True, None, activity_details, audit_details


def _execute_account_recovery(request, case):
    new_password = request.data.get('new_password')
    if not new_password:
        return False, Response({'error': 'new_password is required to execute this case.'}, status=400), None, None
    if len(new_password) < 8:
        return False, Response({'error': 'new_password must be at least 8 characters long.'}, status=400), None, None

    target_user = case.target_user
    if not target_user:
        return False, Response({'error': 'This case has no target_user.'}, status=400), None, None

    target_user.password = make_password(new_password)
    target_user.save(update_fields=['password'])

    activity_details = {}
    audit_details = {'platform_case_id': str(case.id)}
    return True, None, activity_details, audit_details


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def close_platform_case(request, case_id):
    """
    Resolve a case: execute the actual system action, then close it.
    Only allowed while status='open'. This is the ONLY place a Platform
    Case's action is ever executed — opening a case never does anything
    by itself.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    case = PlatformCase.objects.select_related('tenant', 'target_user', 'target_membership').filter(pk=case_id).first()
    if not case:
        return Response({'error': 'Case not found.'}, status=404)
    if case.status != 'open':
        return Response({'error': f'Case is already {case.status}.'}, status=400)

    resolution_notes = (request.data.get('resolution_notes') or '').strip()
    if not resolution_notes:
        return Response({'error': 'resolution_notes is required to close a case.'}, status=400)

    if case.case_type == 'forced_ownership_transfer':
        ok, err, activity_details, audit_details = _execute_forced_ownership_transfer(case)
    elif case.case_type == 'account_recovery':
        ok, err, activity_details, audit_details = _execute_account_recovery(request, case)
    else:
        return Response({'error': f'Unknown case_type "{case.case_type}" — cannot execute.'}, status=400)

    if not ok:
        return err

    action = CASE_TYPE_EXECUTION_ACTION.get(case.case_type, 'platform_case_closed')
    target_name = (
        (case.target_membership.user.email if case.target_membership.user else case.target_membership.invite_email)
        if case.target_membership else (case.target_user.email if case.target_user else '')
    )

    # Business-visible — looks exactly like a normal action, no case
    # reference, per the locked "fully invisible to the business" design.
    ActivityLog.objects.create(
        actor=request.user, tenant=case.tenant, action=action,
        target_type='membership' if case.target_membership else 'user',
        target_name=target_name, details=activity_details,
    )
    # Founder-only — carries the platform_case_id so this can always be
    # traced back to the full case record.
    audit_details_full = dict(audit_details)
    audit_details_full['resolution_notes'] = resolution_notes
    log_action(
        request, action, tenant=case.tenant,
        target_type='membership' if case.target_membership else 'user',
        target_name=target_name, details=audit_details_full,
    )

    case.status = 'closed'
    case.resolution_notes = resolution_notes
    case.resolution_details = request.data.get('resolution_details') or {}
    case.executed_by = request.user
    case.closed_at = timezone.now()
    case.save(update_fields=['status', 'resolution_notes', 'resolution_details', 'executed_by', 'closed_at'])

    return Response(_serialize_case(case))
