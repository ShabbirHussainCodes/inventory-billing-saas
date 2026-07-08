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

    NOTE: Phase B se pehle yeh view koi permission check nahi karta tha —
    koi bhi active Membership wala staff (chahe koi bhi role ho) ise
    dekh/edit kar sakta tha. Ab team.manage_settings/view_settings se
    gated hai. Founder (super_admin) is check se hamesha bypass hota hai
    — has_permission() ka apna logic already Founder ko is_edit_mode()
    se decide karta hai, role/permission catalog unhe apply nahi hota.
    """
    from superadmin.utils import get_active_tenant
    from teams.permissions import has_permission
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        if not has_permission(request, 'tenant.view_settings'):
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = TenantSettingsSerializer(tenant)
        return Response(serializer.data)

    elif request.method == 'PUT':
        if not has_permission(request, 'tenant.manage_settings'):
            return Response({'error': 'Access denied.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = TenantSettingsSerializer(tenant, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([])  # Public — Telegram khud call karta hai, koi login nahi hota
def telegram_webhook(request):
    """
    Telegram se aane wale saare updates yahan aate hain.
    Jab koi user bot ko /start ya koi bhi message bhejta hai, Telegram
    yeh URL call karta hai. Hum reply mein unka Chat ID bhej dete hain —
    isse client ko kabhi bot token dekhna/dena nahi padta.
    """
    from django.conf import settings
    from .telegram import send_telegram_message

    data = request.data
    message = data.get('message', {})
    chat = message.get('chat', {})
    chat_id = chat.get('id')
    text = message.get('text', '')

    if not chat_id:
        # Koi valid message nahi tha — Telegram ko 200 hi bhejo,
        # warna woh baar baar retry karega
        return Response({'ok': True})

    if text.strip().lower() == '/start':
        reply = (
            "👋 <b>Welcome to BillingMars Reports!</b>\n\n"
            f"Your Telegram Chat ID is:\n<code>{chat_id}</code>\n\n"
            "Copy this and paste it in:\n"
            "BillingMars → Settings → Telegram Chat ID\n\n"
            "Once saved, tap 'Close Day' on your Dashboard anytime "
            "to get your daily collection report right here."
        )
        send_telegram_message(chat_id, reply)

    # Koi aur message ho toh abhi kuch nahi karte — future mein
    # yahan aur commands add ho sakte hain
    return Response({'ok': True})