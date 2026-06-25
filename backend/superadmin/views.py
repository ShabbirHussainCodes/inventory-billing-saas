from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from tenants.models import Tenant
from users.models import CustomUser


def is_super_admin(user):
    return user.is_authenticated and user.role == 'super_admin'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_stats(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    total_tenants = Tenant.objects.count()
    active_tenants = Tenant.objects.filter(is_active=True).count()
    total_users = CustomUser.objects.exclude(role='super_admin').count()
    paid_tenants = Tenant.objects.filter(access_type='paid').count()
    free_tenants = Tenant.objects.filter(access_type='free_tier').count()
    admin_grant = Tenant.objects.filter(access_type='admin_grant').count()

    return Response({
        'total_tenants': total_tenants,
        'active_tenants': active_tenants,
        'inactive_tenants': total_tenants - active_tenants,
        'total_users': total_users,
        'paid_tenants': paid_tenants,
        'free_tenants': free_tenants,
        'admin_grant_tenants': admin_grant,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_list(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    tenants = Tenant.objects.all().order_by('-created_at')
    data = []
    for tenant in tenants:
        users_count = CustomUser.objects.filter(tenant=tenant).count()
        data.append({
            'id': str(tenant.id),
            'name': tenant.name,
            'country': tenant.country,
            'currency': tenant.currency,
            'tax_label': tenant.tax_label,
            'access_type': tenant.access_type,
            'is_active': tenant.is_active,
            'users_count': users_count,
            'created_at': tenant.created_at,
        })

    return Response(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def toggle_tenant(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
        tenant.is_active = not tenant.is_active
        tenant.save()
        return Response({
            'message': f"Tenant {'activated' if tenant.is_active else 'deactivated'} successfully.",
            'is_active': tenant.is_active
        })
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def grant_access(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
        tenant.access_type = 'admin_grant'
        tenant.is_active = True
        tenant.save()
        return Response({'message': 'Free access granted successfully.'})
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_list(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    users = CustomUser.objects.exclude(role='super_admin').order_by('-created_at')
    data = []
    for user in users:
        data.append({
            'id': str(user.id),
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'tenant_name': user.tenant.name if user.tenant else '—',
            'is_active': user.is_active,
            'created_at': user.created_at,
        })

    return Response(data)


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def toggle_user(request, user_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        user = CustomUser.objects.get(id=user_id)
        user.is_active = not user.is_active
        user.save()
        return Response({
            'message': f"User {'activated' if user.is_active else 'deactivated'} successfully.",
            'is_active': user.is_active
        })
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)