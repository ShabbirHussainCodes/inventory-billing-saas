from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from teams.throttles import SelectBusinessThrottle
from .serializers import (
    UserRegistrationSerializer,
    UserLoginSerializer,
    UserProfileSerializer
)


def get_tokens_for_user(user, tenant_id=None):
    # User ke liye JWT tokens generate karo
    # tenant_id — multi-tenant staff ke liye "kaunse business mein kaam
    # kar rahe hain" ki claim. Sirf disambiguation ke liye hai (jab user
    # ki 2+ active Memberships hon) — koi permission/role isme cache
    # nahi hoti, get_active_tenant() har request pe fresh Membership
    # check karta hai, is claim ko sirf tab consult karta hai jab
    # multiple active memberships ho.
    refresh = RefreshToken.for_user(user)
    if tenant_id:
        refresh['tenant_id'] = str(tenant_id)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    # Bot protection — Turnstile token verify karo user create karne se pehle
    from .turnstile import verify_turnstile_token
    turnstile_token = request.data.get('turnstile_token')
    remote_ip = request.META.get('REMOTE_ADDR')
    is_valid, error_msg = verify_turnstile_token(turnstile_token, remote_ip)
    if not is_valid:
        return Response({'error': error_msg}, status=status.HTTP_400_BAD_REQUEST)

    serializer = UserRegistrationSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        tokens = get_tokens_for_user(user)

        # Founder alert — new signup. Deliberately fire-and-forget: if
        # Telegram fails for any reason, registration must still succeed.
        # send_telegram_message already returns (success, error) instead
        # of raising, so no try/except needed to keep this safe.
        from django.conf import settings
        if settings.FOUNDER_TELEGRAM_CHAT_ID:
            from tenants.telegram import send_telegram_message
            tenant_name = user.tenant.name if user.tenant else 'Unknown business'
            send_telegram_message(
                settings.FOUNDER_TELEGRAM_CHAT_ID,
                f"🎉 <b>New Signup</b>\n\nBusiness: {tenant_name}\nEmail: {user.email}"
            )

        return Response({
            'message': 'Account created successfully.',
            'tokens': tokens,
            'user': {
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
            }
        }, status=status.HTTP_201_CREATED)
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    from teams.models import PendingLoginToken, Membership
    PendingLoginToken.cleanup_expired()   # lazy cleanup — no Celery/cron on Render Free

    serializer = UserLoginSerializer(data=request.data)
    if serializer.is_valid():
        email = serializer.validated_data['email']
        password = serializer.validated_data['password']
        user = authenticate(request, email=email, password=password)
        if user is not None:
            tenant_id_claim = None

            if user.role != 'super_admin':
                # Membership hi ab source of truth hai (CustomUser.tenant/role
                # deprecated legacy fields hain — Step 3 se)
                memberships = (
                    Membership.objects
                    .filter(user=user, status='active')
                    .select_related('tenant')
                )
                count = memberships.count()

                if count == 0:
                    return Response({
                        'error': 'No active business found for this account.'
                    }, status=status.HTTP_403_FORBIDDEN)

                if count == 1:
                    membership = memberships.first()
                    if not membership.tenant.is_active:
                        return Response({
                            'error': 'Your account has been suspended. Please contact support.'
                        }, status=status.HTTP_403_FORBIDDEN)
                    tenant_id_claim = membership.tenant.id

                else:
                    # Multi-tenant staff — turant JWT nahi, pehle business
                    # choose karwana hai. Koi active/is_active tenant check
                    # yahan jaanbujh kar nahi kiya — select_business_view
                    # khud har chosen tenant ke liye yeh check karta hai.
                    import secrets
                    token_str = secrets.token_urlsafe(32)
                    PendingLoginToken.objects.create(user=user, token=token_str)
                    return Response({
                        'temporary_token': token_str,
                        'businesses': [
                            {'id': str(m.tenant.id), 'name': m.tenant.name}
                            for m in memberships
                        ],
                    }, status=status.HTTP_200_OK)

            tokens = get_tokens_for_user(user, tenant_id=tenant_id_claim)
            return Response({
                'message': 'Login successful.',
                'tokens': tokens,
                'user': {
                    'email': user.email,
                    'first_name': user.first_name,
                    'role': user.role,
                }
            }, status=status.HTTP_200_OK)
        return Response({
            'error': 'Invalid email or password.'
        }, status=status.HTTP_401_UNAUTHORIZED)
    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )


@api_view(['POST'])
@permission_classes([AllowAny])
@throttle_classes([SelectBusinessThrottle])
def select_business_view(request):
    """
    Step 2 of the multi-tenant login flow. Sirf tab call hoti hai jab
    login_view ne temporary_token + businesses list return ki thi
    (matlab user ki 2+ active Memberships hain).
    """
    from teams.models import PendingLoginToken, Membership
    PendingLoginToken.cleanup_expired()

    temporary_token = request.data.get('temporary_token')
    tenant_id = request.data.get('tenant_id')

    if not temporary_token or not tenant_id:
        return Response({
            'error': 'temporary_token and tenant_id are required.'
        }, status=status.HTTP_400_BAD_REQUEST)

    try:
        pending = PendingLoginToken.objects.select_related('user').get(
            token=temporary_token, used=False
        )
    except PendingLoginToken.DoesNotExist:
        return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_401_UNAUTHORIZED)

    if pending.is_expired():
        pending.delete()
        return Response({'error': 'Invalid or expired token.'}, status=status.HTTP_401_UNAUTHORIZED)

    membership = (
        Membership.objects
        .filter(user=pending.user, tenant_id=tenant_id, status='active')
        .select_related('tenant')
        .first()
    )
    if not membership:
        return Response({'error': 'Invalid business selection.'}, status=status.HTTP_403_FORBIDDEN)

    if not membership.tenant.is_active:
        return Response({
            'error': 'Your account has been suspended. Please contact support.'
        }, status=status.HTTP_403_FORBIDDEN)

    # Single-use — dobara isi token se call karne pe reject hoga
    pending.used = True
    pending.save()

    tokens = get_tokens_for_user(pending.user, tenant_id=membership.tenant.id)
    return Response({
        'message': 'Login successful.',
        'tokens': tokens,
        'user': {
            'email': pending.user.email,
            'first_name': pending.user.first_name,
            'role': pending.user.role,
        }
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        refresh_token = request.data.get('refresh')
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)
    except Exception:
        return Response({
            'message': 'Logged out successfully.'
        }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    serializer = UserProfileSerializer(request.user)
    return Response(serializer.data, status=status.HTTP_200_OK)