from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .serializers import TenantSettingsSerializer


@api_view(['GET', 'PUT'])
@permission_classes([IsAuthenticated])
def business_settings(request):
    """
    Business owner apne business contact details dekh/edit kar sakta hai.
    Yeh details invoice header pe dikhte hain (company name, GST, phone, etc).
    """
    from superadmin.utils import get_active_tenant
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        serializer = TenantSettingsSerializer(tenant)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = TenantSettingsSerializer(tenant, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)