from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import authenticate
from django.db.models import Q
from django.utils import timezone
import secrets

from .models import Role, Membership, ActivityLog
from .permissions import has_permission
from .throttles import AcceptInviteThrottle
from superadmin.utils import get_active_tenant

# Invite link validity — 7 din, ek reasonable default (industry-common
# range 3-14 din). Plan mein explicitly decide nahi hua tha, isliye yeh
# ek judgment call hai — badalna ho toh sirf yeh constant change karo.
INVITE_EXPIRY_DAYS = 7


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

    ActivityLog.objects.create(
        actor=request.user,
        tenant=tenant,
        action='member_invited',
        target_type='membership',
        target_name=email,
        details={'role': role.name},
    )

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
