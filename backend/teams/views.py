from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.db.models import Q
from django.utils import timezone
import secrets

from .models import Role, Membership, ActivityLog, ViewAsSession
from .permissions import has_permission
from .throttles import AcceptInviteThrottle
from superadmin.utils import get_active_tenant

# Invite link validity — 7 din, ek reasonable default (industry-common
# range 3-14 din). Plan mein explicitly decide nahi hua tha, isliye yeh
# ek judgment call hai — badalna ho toh sirf yeh constant change karo.
INVITE_EXPIRY_DAYS = 7


def _founder_ownership_fields(request):
    """
    Phase B.6 Stage C — Founder can now perform Owner-membership-touching
    actions (invite a new Owner, promote someone to Owner, suspend/
    reactivate/remove an existing Owner, transfer Primary Owner) as
    ROUTINE support — Stage B's hard block is gone. In exchange, every
    such action must carry two mandatory, plain-text fields, which get
    stored in the action's log entry (both the business's own
    ActivityLog and the Founder's own AuditLog — never silent):

    - reason: why this is being done (e.g. "Customer called, asked to
      make Priya the new Primary Owner after Rahul stepped down.")
    - identity_verification_notes: how the Founder confirmed this
      request genuinely came from someone with the authority to ask for
      it (e.g. "Confirmed via the phone number on file + email match.")

    This function ONLY applies when the actor is Founder — normal Owner
    actions on other Owners are a completely separate (Stage D) concern
    and are never routed through here.

    Returns (reason, notes) on success, or a Response object (400) that
    the caller should return immediately if either field is missing.
    """
    reason = (request.data.get('reason') or '').strip()
    notes = (request.data.get('identity_verification_notes') or '').strip()
    if not reason or not notes:
        return Response(
            {'error': 'Owner-related actions performed as Founder require both '
                      '"reason" and "identity_verification_notes".'},
            status=400
        )
    return (reason, notes)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invite_member(request):
    """
    Owner (ya jisके paas team.manage hai) staff ko email + role se invite
    karta hai. Koi email nahi bheja jaata (Render Free tier pe koi email
    infra nahi hai) — backend ek invite_token generate karta hai, Owner
    khud copy-link ke through staff ko share karta hai (WhatsApp/email/
    kuch bhi). Yeh explicit decision thi — real email sending abhi scope
    se bahar hai.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    email = (request.data.get('email') or '').strip().lower()
    role_id = request.data.get('role_id')

    if not email:
        return Response({'error': 'Email is required.'}, status=400)
    if not role_id:
        return Response({'error': 'role_id is required.'}, status=400)

    # Role — system role (tenant=None) ya isi tenant ka custom role
    # (custom roles Phase C mein aayenge, query already future-proof hai)
    role = Role.objects.filter(pk=role_id).filter(
        Q(tenant__isnull=True) | Q(tenant=tenant)
    ).first()
    if not role:
        return Response({'error': 'Invalid role.'}, status=400)

    ownership_reason = ownership_notes = ''
    if role.name == 'Owner' and request.user.role == 'super_admin':
        result = _founder_ownership_fields(request)
        if isinstance(result, Response):
            return result
        ownership_reason, ownership_notes = result

    # Founder (super_admin) ko kabhi invite nahi kiya ja sakta — Membership
    # model ka save() guard bhi yeh enforce karta hai, par yahan upfront
    # check karne se clear error milta hai (accept-invite ke waqt confusing
    # failure ke bajaye)
    from users.models import CustomUser
    existing_user = CustomUser.objects.filter(email__iexact=email).first()
    if existing_user and existing_user.role == 'super_admin':
        return Response({'error': 'This email cannot be invited.'}, status=400)

    # Is tenant mein pehle se koi Membership hai is email ki?
    existing_membership = (
        Membership.objects
        .filter(tenant=tenant, invite_email__iexact=email)
        .exclude(status='removed')
        .first()
    )

    if existing_membership:
        if existing_membership.status == 'active':
            return Response({'error': 'This person is already a team member.'}, status=400)
        if existing_membership.status == 'suspended':
            return Response({
                'error': 'This person is suspended, not removed. Reactivate them instead of re-inviting.'
            }, status=400)
        # status == 'invited' — resend: naya token, updated_at bump hoga
        # (auto_now=True) jo expiry window fresh kar deta hai
        existing_membership.role = role
        existing_membership.invite_token = secrets.token_urlsafe(32)
        existing_membership.invited_by = request.user
        existing_membership.save()
        membership = existing_membership
    else:
        membership = Membership.objects.create(
            tenant=tenant,
            role=role,
            status='invited',
            invite_email=email,
            invite_token=secrets.token_urlsafe(32),
            invited_by=request.user,
        )

    invite_details = {'role': role.name}
    if ownership_reason:
        invite_details.update({
            'reason': ownership_reason,
            'identity_verification_notes': ownership_notes,
            'founder_ownership_action': True,
        })

    ActivityLog.objects.create(
        actor=request.user,
        tenant=tenant,
        action='member_invited',
        target_type='membership',
        target_name=email,
        details=invite_details,
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'member_invited', tenant=tenant,
                   target_type='membership', target_name=email, details=invite_details)

    return Response({
        'message': 'Invite created.',
        'invite_token': membership.invite_token,
        'email': membership.invite_email,
        'role': role.name,
        'expires_in_days': INVITE_EXPIRY_DAYS,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def invite_detail(request, token):
    """
    Public — accept-invite page load hone par yeh call hoti hai taaki
    frontend decide kar sake: "set a password" form dikhana hai (naya
    account) ya "log in to accept" form (email pehle se registered hai).
    """
    from users.models import CustomUser

    membership = Membership.objects.select_related('tenant', 'role').filter(
        invite_token=token, status='invited'
    ).first()

    if not membership:
        return Response({'valid': False, 'error': 'Invalid or already-used invite link.'})

    expiry_cutoff = timezone.now() - timezone.timedelta(days=INVITE_EXPIRY_DAYS)
    if membership.updated_at < expiry_cutoff:
        return Response({'valid': False, 'error': 'This invite link has expired. Ask the business owner to resend it.'})

    account_exists = CustomUser.objects.filter(email__iexact=membership.invite_email).exists()

    return Response({
        'valid': True,
        'business_name': membership.tenant.name,
        'role_name': membership.role.name,
        'email': membership.invite_email,
        'account_exists': account_exists,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([AcceptInviteThrottle])
def accept_invite(request, token):
    """
    Public. Do cases:
    - Email already ek CustomUser account hai (multi-tenant staff scenario)
      -> password verify karo (authenticate()) taaki koi arbitrary email
         claim na kar sake, phir Membership link karo.
    - Naya email hai -> first_name/last_name/password se naya account
      banao, phir Membership link karo.
    Dono cases mein: turant JWT tokens milte hain (login jaisa), taaki
    accept ke baad seedha app mein pahunch jaaye.
    """
    from users.models import CustomUser
    from users.views import get_tokens_for_user

    membership = Membership.objects.select_related('tenant', 'role').filter(
        invite_token=token, status='invited'
    ).first()

    if not membership:
        return Response({'error': 'Invalid or already-used invite link.'}, status=status.HTTP_400_BAD_REQUEST)

    expiry_cutoff = timezone.now() - timezone.timedelta(days=INVITE_EXPIRY_DAYS)
    if membership.updated_at < expiry_cutoff:
        return Response({'error': 'This invite link has expired. Ask the business owner to resend it.'}, status=status.HTTP_400_BAD_REQUEST)

    password = request.data.get('password')
    if not password:
        return Response({'error': 'Password is required.'}, status=400)

    existing_user = CustomUser.objects.filter(email__iexact=membership.invite_email).first()

    if existing_user:
        user = authenticate(request, email=existing_user.email, password=password)
        if user is None:
            return Response({
                'error': 'Incorrect password for this existing account.'
            }, status=status.HTTP_401_UNAUTHORIZED)
    else:
        first_name = (request.data.get('first_name') or '').strip()
        last_name = (request.data.get('last_name') or '').strip()
        if not first_name or not last_name:
            return Response({'error': 'First name and last name are required.'}, status=400)
        if len(password) < 8:
            return Response({'error': 'Password must be at least 8 characters long.'}, status=400)

        user = CustomUser.objects.create_user(
            email=membership.invite_email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role='staff',
        )

    membership.user = user
    membership.status = 'active'
    membership.joined_at = timezone.now()
    membership.save()

    ActivityLog.objects.create(
        actor=user,
        tenant=membership.tenant,
        action='member_joined',
        target_type='membership',
        target_name=user.email,
        details={'role': membership.role.name},
    )

    tokens = get_tokens_for_user(user, tenant_id=membership.tenant.id)
    return Response({
        'message': 'Invite accepted. Welcome to the team.',
        'tokens': tokens,
        'user': {
            'email': user.email,
            'first_name': user.first_name,
            'role': user.role,
        }
    }, status=status.HTTP_200_OK)


# ─── ACTIVITY LOG ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def activity_log_list(request):
    """
    Team activity feed — team.view_activity gated (Owner + Manager per
    the finalized matrix; Sales Staff/Accountant/Viewer excluded).
    Pagination pattern copied from inventory.stock_movement_list for
    consistency across the codebase.
    Query params: action, days, page, page_size
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.view_activity'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    logs = ActivityLog.objects.filter(tenant=tenant).select_related(
        'actor', 'viewed_as_membership', 'viewed_as_membership__user', 'viewed_as_membership__role'
    )

    action_filter = request.query_params.get('action')
    if action_filter:
        logs = logs.filter(action=action_filter)

    days = request.query_params.get('days')
    if days:
        try:
            since = timezone.now() - timezone.timedelta(days=int(days))
            logs = logs.filter(created_at__gte=since)
        except ValueError:
            pass

    logs = logs.order_by('-created_at')

    total_count = logs.count()
    page = max(1, int(request.query_params.get('page', 1)))
    page_size = min(100, max(10, int(request.query_params.get('page_size', 50))))
    start = (page - 1) * page_size
    end = start + page_size
    logs_page = logs[start:end]

    def _viewed_as_payload(log):
        # Phase B.5 — agar yeh action "View As Member" mode mein perform
        # hua tha, real actor ke saath-saath yeh bhi batao ki woh kis
        # member ki tarah dekh raha tha. Real actor (log.actor) KABHI
        # overwrite nahi hota — yeh sirf additional context hai.
        vam = log.viewed_as_membership
        if not vam:
            return None
        return {
            'membership_id': str(vam.id),
            'name': (vam.user.first_name if vam.user else vam.invite_email) or vam.invite_email,
            'role_name': vam.role.name,
        }

    data = [{
        'id': str(log.id),
        'actor_email': log.actor.email,
        'actor_name': log.actor.first_name or log.actor.email,
        'action': log.action,
        'action_label': log.get_action_display(),
        'target_type': log.target_type,
        'target_name': log.target_name,
        'details': log.details,
        'viewed_as': _viewed_as_payload(log),
        'created_at': log.created_at.isoformat(),
    } for log in logs_page]

    return Response({
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': max(1, (total_count + page_size - 1) // page_size),
        'results': data,
    })


# ─── ROLE LISTING ──────────────────────────────────────────
# Gap found while building member management: invite_member (above)
# requires a role_id, but nothing exposed the list of valid roles for
# the frontend to populate a dropdown from. Needed by both the invite
# form and the change-role action below.

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def role_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    roles = Role.objects.filter(Q(tenant__isnull=True) | Q(tenant=tenant)).order_by('name')
    return Response([{
        'id': str(r.id),
        'name': r.name,
        'description': r.description,
        'is_system_role': r.is_system_role,
    } for r in roles])


# ─── MEMBER MANAGEMENT ─────────────────────────────────────

def _serialize_membership(m):
    return {
        'id': str(m.id),
        'email': m.user.email if m.user else m.invite_email,
        'first_name': m.user.first_name if m.user else '',
        'last_name': m.user.last_name if m.user else '',
        'role_id': str(m.role_id),
        'role_name': m.role.name,
        'status': m.status,
        'is_primary_owner': m.is_primary_owner,
        'invited_by': m.invited_by.email if m.invited_by else None,
        'joined_at': m.joined_at.isoformat() if m.joined_at else None,
        'created_at': m.created_at.isoformat(),
    }


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def member_list(request):
    """
    Read access is deliberately broader than write here: anyone with
    team.manage OR team.view_activity can see the roster (Manager can
    already see staff names/roles indirectly through the Activity Log,
    so hiding the plain member list from them would restrict nothing
    real while breaking the Team page for them). All mutations below
    stay strictly team.manage-only.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not (has_permission(request, 'team.manage') or has_permission(request, 'team.view_activity')):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    qs = Membership.objects.filter(tenant=tenant).select_related('user', 'role', 'invited_by')
    if request.query_params.get('include_removed') != 'true':
        qs = qs.exclude(status='removed')

    return Response([_serialize_membership(m) for m in qs])


def _get_target_membership(tenant, membership_id):
    return Membership.objects.select_related('user', 'role', 'tenant').filter(
        pk=membership_id, tenant=tenant
    ).first()


def _active_owner_count(tenant, exclude_pk=None):
    qs = Membership.objects.filter(tenant=tenant, role__name='Owner', status='active')
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)
    return qs.count()


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def suspend_member(request, membership_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    target = _get_target_membership(tenant, membership_id)
    if not target:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    if target.user_id == request.user.id:
        return Response({'error': 'You cannot suspend yourself.'}, status=400)
    if target.status != 'active':
        return Response({'error': f'Cannot suspend a member with status "{target.status}".'}, status=400)
    suspend_reason = suspend_notes = ''
    if target.role.name == 'Owner':
        if request.user.role == 'super_admin':
            result = _founder_ownership_fields(request)
            if isinstance(result, Response):
                return result
            suspend_reason, suspend_notes = result
        if _active_owner_count(tenant, exclude_pk=target.pk) == 0:
            return Response({'error': 'Cannot suspend the last active Owner of this business.'}, status=400)

    target.status = 'suspended'
    target.save()

    target_name = target.user.email if target.user else target.invite_email
    suspend_details = {}
    if suspend_reason:
        suspend_details = {'reason': suspend_reason, 'identity_verification_notes': suspend_notes, 'founder_ownership_action': True}
    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='member_suspended',
        target_type='membership', target_name=target_name, details=suspend_details,
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'member_suspended', tenant=tenant,
                   target_type='membership', target_name=target_name, details=suspend_details)
    return Response(_serialize_membership(target))


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def reactivate_member(request, membership_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    target = _get_target_membership(tenant, membership_id)
    if not target:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    if target.status != 'suspended':
        return Response({'error': f'Cannot reactivate a member with status "{target.status}".'}, status=400)
    reactivate_reason = reactivate_notes = ''
    if target.role.name == 'Owner' and request.user.role == 'super_admin':
        result = _founder_ownership_fields(request)
        if isinstance(result, Response):
            return result
        reactivate_reason, reactivate_notes = result

    target.status = 'active'
    target.save()

    target_name = target.user.email if target.user else target.invite_email
    reactivate_details = {}
    if reactivate_reason:
        reactivate_details = {'reason': reactivate_reason, 'identity_verification_notes': reactivate_notes, 'founder_ownership_action': True}
    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='member_reactivated',
        target_type='membership', target_name=target_name, details=reactivate_details,
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'member_reactivated', tenant=tenant,
                   target_type='membership', target_name=target_name, details=reactivate_details)
    return Response(_serialize_membership(target))


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def remove_member(request, membership_id):
    """Soft delete — status='removed', record kept (matches Membership's
    own status choice comment: 'Staff ko team se hata diya gaya (soft —
    record rehta hai)')."""
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    target = _get_target_membership(tenant, membership_id)
    if not target:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    if target.user_id == request.user.id:
        return Response({'error': 'You cannot remove yourself.'}, status=400)
    if target.status == 'removed':
        return Response({'error': 'This member has already been removed.'}, status=400)
    remove_reason = remove_notes = ''
    if target.role.name == 'Owner':
        if request.user.role == 'super_admin':
            result = _founder_ownership_fields(request)
            if isinstance(result, Response):
                return result
            remove_reason, remove_notes = result
        if target.status == 'active' and _active_owner_count(tenant, exclude_pk=target.pk) == 0:
            return Response({'error': 'Cannot remove the last active Owner of this business.'}, status=400)

    target_name = target.user.email if target.user else target.invite_email
    target.status = 'removed'
    target.save()

    remove_details = {}
    if remove_reason:
        remove_details = {'reason': remove_reason, 'identity_verification_notes': remove_notes, 'founder_ownership_action': True}
    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='member_removed',
        target_type='membership', target_name=target_name, details=remove_details,
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'member_removed', tenant=tenant,
                   target_type='membership', target_name=target_name, details=remove_details)
    return Response({'message': 'Member removed.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def change_member_role(request, membership_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    if not has_permission(request, 'team.manage'):
        return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)

    target = _get_target_membership(tenant, membership_id)
    if not target:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    if target.user_id == request.user.id:
        return Response({'error': 'You cannot change your own role.'}, status=400)
    if target.status == 'removed':
        return Response({'error': 'Cannot change the role of a removed member.'}, status=400)

    role_id = request.data.get('role_id')
    if not role_id:
        return Response({'error': 'role_id is required.'}, status=400)
    new_role = Role.objects.filter(pk=role_id).filter(
        Q(tenant__isnull=True) | Q(tenant=tenant)
    ).first()
    if not new_role:
        return Response({'error': 'Invalid role.'}, status=400)

    role_reason = role_notes = ''
    if target.role.name == 'Owner' or new_role.name == 'Owner':
        if request.user.role == 'super_admin':
            result = _founder_ownership_fields(request)
            if isinstance(result, Response):
                return result
            role_reason, role_notes = result

    if (target.role.name == 'Owner' and new_role.name != 'Owner'
            and target.status == 'active'
            and _active_owner_count(tenant, exclude_pk=target.pk) == 0):
        return Response({'error': 'Cannot change the role of the last active Owner of this business.'}, status=400)

    old_role_name = target.role.name
    target.role = new_role
    target.save()

    target_name = target.user.email if target.user else target.invite_email
    role_change_details = {'from': old_role_name, 'to': new_role.name}
    if role_reason:
        role_change_details.update({
            'reason': role_reason,
            'identity_verification_notes': role_notes,
            'founder_ownership_action': True,
        })
    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='role_changed',
        target_type='membership', target_name=target_name,
        details=role_change_details,
    )
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'role_changed', tenant=tenant,
                   target_type='membership', target_name=target_name,
                   details=role_change_details)
    return Response(_serialize_membership(target))


# ─── PRIMARY OWNER (Phase B.6 Stage 1) ──────────────────────
#
# Every tenant has exactly one Primary Owner at all times (DB partial
# unique index enforces "at most one"; registration + the backfill
# migration + this endpoint's atomic flip jointly guarantee "never zero").
# This is a VOLUNTARY, in-business handoff — the current Primary Owner
# choosing to pass the role to another Owner they already trust. It is
# deliberately separate from the Founder's future "Break Glass" override
# (Stage 3), which exists for when this normal path isn't available
# (Primary Owner lost access, disputes, fraud, etc.).

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def make_primary_owner(request, membership_id):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    # Founder branch (Stage C) — Founder never has a Membership row
    # (hard-guarded in Membership.save()), so the normal "you must be the
    # current Primary Owner" check below structurally can never pass for
    # them. This is deliberately a SEPARATE, explicit branch rather than
    # relaxing that check — Founder isn't "acting as" the Primary Owner
    # here, they're using platform authority to perform a handoff on the
    # business's behalf, which is exactly why it requires reason +
    # identity_verification_notes even though it's still routine support
    # (not a Platform Case — this is a normal transfer, just Founder-assisted).
    if request.user.role == 'super_admin':
        result = _founder_ownership_fields(request)
        if isinstance(result, Response):
            return result
        primary_reason, primary_notes = result

        current_primary = Membership.objects.filter(
            tenant=tenant, status='active', is_primary_owner=True
        ).first()
        if not current_primary:
            return Response({'error': 'This business has no active Primary Owner to transfer from.'}, status=400)

        target = _get_target_membership(tenant, membership_id)
        if not target:
            return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
        if target.pk == current_primary.pk:
            return Response({'error': 'This member is already the Primary Owner.'}, status=400)
        if target.role.name != 'Owner' or target.status != 'active':
            return Response(
                {'error': 'Primary Owner can only be transferred to another active Owner. '
                          'Change their role to Owner first if needed.'},
                status=400
            )

        from django.db import transaction
        with transaction.atomic():
            current_primary.is_primary_owner = False
            current_primary.save(update_fields=['is_primary_owner'])
            target.is_primary_owner = True
            target.save(update_fields=['is_primary_owner'])

        from_name = current_primary.user.first_name if current_primary.user else current_primary.invite_email
        to_name = target.user.first_name if target.user else target.invite_email
        primary_details = {
            'from': from_name, 'to': to_name,
            'reason': primary_reason,
            'identity_verification_notes': primary_notes,
            'founder_ownership_action': True,
        }
        ActivityLog.objects.create(
            actor=request.user, tenant=tenant, action='primary_owner_transferred',
            target_type='membership', target_name=to_name, details=primary_details,
        )
        from superadmin.audit import log_action
        log_action(request, 'primary_owner_transferred', tenant=tenant,
                   target_type='membership', target_name=to_name, details=primary_details)

        return Response(_serialize_membership(target))

    current_primary = Membership.objects.filter(
        user=request.user, tenant=tenant, status='active', is_primary_owner=True
    ).first()
    if not current_primary:
        return Response(
            {'error': 'Only the current Primary Owner can transfer this role.'},
            status=status.HTTP_403_FORBIDDEN
        )

    target = _get_target_membership(tenant, membership_id)
    if not target:
        return Response({'error': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
    if target.pk == current_primary.pk:
        return Response({'error': 'You are already the Primary Owner.'}, status=400)
    if target.role.name != 'Owner' or target.status != 'active':
        return Response(
            {'error': 'Primary Owner can only be transferred to another active Owner. '
                      'Change their role to Owner first if needed.'},
            status=400
        )

    from django.db import transaction
    with transaction.atomic():
        # Order matters: old primary OFF first, then new primary ON — this
        # way the tenant briefly has ZERO primaries (allowed) but NEVER two
        # at once (blocked by the DB constraint), regardless of how the DB
        # checks the constraint internally.
        current_primary.is_primary_owner = False
        current_primary.save(update_fields=['is_primary_owner'])
        target.is_primary_owner = True
        target.save(update_fields=['is_primary_owner'])

    from_name = request.user.first_name or request.user.email
    to_name = target.user.first_name if target.user else target.invite_email
    ActivityLog.objects.create(
        actor=request.user, tenant=tenant, action='primary_owner_transferred',
        target_type='membership', target_name=to_name,
        details={'from': from_name, 'to': to_name},
    )

    return Response(_serialize_membership(target))


# ─── VIEW AS MEMBER (Phase B.5) ─────────────────────────────
#
# Owner (or a Founder already inside an active SupportSession for this
# tenant) can see the app exactly as a specific staff member would,
# without logging in as them. Deliberately mirrors superadmin.views'
# enter_workspace / exit_workspace / switch_mode / get_active_session
# quartet — same "close old session before starting new one" pattern,
# same view/edit toggle convention.
#
# Guardrails enforced here (not just in has_permission()):
# - ONLY Owner or Founder may start a session — Manager and every other
#   role are blocked even if they somehow had team.manage.
# - Always starts in 'view' mode — Edit Simulation requires an explicit
#   separate call to switch_view_as_mode(), never passed at start time.
# - Can't target yourself, a non-active membership, or a membership
#   outside your resolved tenant.

def _target_tenant_for_view_as(request):
    """
    Resolve which tenant the initiator is allowed to start a View-As
    session in, and confirm they're actually allowed to start one at all.
    Returns (tenant, error_response_or_None).
    """
    user = request.user

    if user.role == 'super_admin':
        from superadmin.models import SupportSession
        session = SupportSession.objects.filter(founder=user, is_active=True).select_related('tenant').first()
        if not session:
            return None, Response(
                {'error': 'You must be inside an active Support Session to use View As Member.'},
                status=400
            )
        return session.tenant, None

    tenant = get_active_tenant(request)
    if not tenant:
        return None, Response({'error': 'No active business context.'}, status=400)

    is_owner = Membership.objects.filter(
        user=user, tenant=tenant, status='active', role__name='Owner'
    ).exists()
    if not is_owner:
        return None, Response(
            {'error': 'Only the business Owner (or the Founder in Support Mode) can use View As Member.'},
            status=status.HTTP_403_FORBIDDEN
        )
    return tenant, None


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_view_as(request, membership_id):
    tenant, error = _target_tenant_for_view_as(request)
    if error:
        return error

    target = Membership.objects.select_related('user', 'role').filter(
        pk=membership_id, tenant=tenant, status='active'
    ).first()
    if not target:
        return Response({'error': 'Member not found or not active.'}, status=status.HTTP_404_NOT_FOUND)
    if target.user_id == request.user.id:
        return Response({'error': 'You cannot View As yourself.'}, status=400)

    # Pehle se active session (agar hai) supersede karo — ek waqt mein
    # sirf ek View-As session per initiator, SupportSession jaisa hi rule.
    ViewAsSession.objects.filter(initiator=request.user, is_active=True).update(
        is_active=False, ended_at=timezone.now(), end_reason='superseded'
    )

    session = ViewAsSession.objects.create(
        initiator=request.user,
        tenant=tenant,
        target_membership=target,
        target_role_at_start=target.role,
        mode='view',   # hamesha View Only se shuru — Edit Simulation alag, explicit call
    )

    target_name = target.user.first_name if target.user else target.invite_email
    log_details = {'role': target.role.name}
    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'view_as_started', tenant=tenant,
                   target_type='membership', target_name=target_name, details=log_details)
    else:
        from .activity import log_team_activity
        log_team_activity(request, 'view_as_started', tenant=tenant,
                          target_type='membership', target_name=target_name, details=log_details,
                          viewed_as_membership=target)

    return Response({
        'session_id': str(session.id),
        'target_membership_id': str(target.id),
        'target_name': target_name,
        'target_role': target.role.name,
        'mode': session.mode,
        'started_at': session.started_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def end_view_as(request):
    session = ViewAsSession.objects.filter(
        initiator=request.user, is_active=True
    ).select_related('tenant', 'target_membership', 'target_membership__user', 'target_membership__role').first()

    if not session:
        return Response({'error': 'No active View As session.'}, status=status.HTTP_404_NOT_FOUND)

    target = session.target_membership
    tenant = session.tenant
    target_name = target.user.first_name if target.user else target.invite_email

    session.is_active = False
    session.ended_at = timezone.now()
    session.end_reason = 'manual'
    session.save(update_fields=['is_active', 'ended_at', 'end_reason'])

    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'view_as_ended', tenant=tenant,
                   target_type='membership', target_name=target_name)
    else:
        from .activity import log_team_activity
        log_team_activity(request, 'view_as_ended', tenant=tenant,
                          target_type='membership', target_name=target_name,
                          viewed_as_membership=target)

    return Response({'message': 'View As Member session ended.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_view_as_mode(request):
    mode = request.data.get('mode')
    if mode not in ('view', 'edit'):
        return Response({'error': "Mode must be 'view' or 'edit'."}, status=400)

    session = ViewAsSession.objects.filter(
        initiator=request.user, is_active=True
    ).select_related('tenant', 'target_membership', 'target_membership__user', 'target_membership__role').first()

    if not session:
        return Response({'error': 'No active View As session.'}, status=status.HTTP_404_NOT_FOUND)

    old_mode = session.mode
    session.mode = mode
    session.save(update_fields=['mode'])

    target = session.target_membership
    target_name = target.user.first_name if target.user else target.invite_email
    details = {'from': old_mode, 'to': mode}

    if request.user.role == 'super_admin':
        from superadmin.audit import log_action
        log_action(request, 'view_as_mode_switched', tenant=session.tenant,
                   target_type='membership', target_name=target_name, details=details)
    else:
        from .activity import log_team_activity
        log_team_activity(request, 'view_as_mode_switched', tenant=session.tenant,
                          target_type='membership', target_name=target_name, details=details,
                          viewed_as_membership=target)

    return Response({
        'session_id': str(session.id),
        'mode': session.mode,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_as_status(request):
    """
    Frontend har page load pe yeh check karta hai — banner dikhana hai
    ya nahi. Reuses the exact same fresh-validity check has_permission()
    uses internally, so the status shown here can NEVER drift from what
    permissions are actually being enforced on the very next real request.
    """
    from .permissions import _get_active_view_as_session
    session = _get_active_view_as_session(request.user)

    if not session:
        return Response({'session': None})

    target = session.target_membership
    return Response({
        'session': {
            'session_id': str(session.id),
            'tenant_id': str(session.tenant_id),
            'target_membership_id': str(target.id),
            'target_name': target.user.first_name if target.user else target.invite_email,
            'target_role': target.role.name,
            'mode': session.mode,
            'started_at': session.started_at.isoformat(),
        }
    })
