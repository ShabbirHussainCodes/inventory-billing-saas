from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from tenants.models import Tenant
from users.models import CustomUser


def is_super_admin(user):
    return user.is_authenticated and user.role == 'super_admin'


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_stats(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    now = timezone.now()

    # Single-pass aggregation — koi N+1 nahi
    total_tenants = Tenant.objects.count()
    active_tenants = Tenant.objects.filter(is_active=True).count()
    total_users = CustomUser.objects.exclude(role='super_admin').count()
    paid_tenants = Tenant.objects.filter(access_type='paid').count()
    free_tenants = Tenant.objects.filter(access_type='free_tier').count()
    admin_grant = Tenant.objects.filter(access_type='admin_grant').count()
    new_this_month = Tenant.objects.filter(
        created_at__year=now.year,
        created_at__month=now.month
    ).count()

    return Response({
        'total_tenants': total_tenants,
        'active_tenants': active_tenants,
        'suspended_tenants': total_tenants - active_tenants,
        'total_users': total_users,
        'paid_tenants': paid_tenants,
        'free_tenants': free_tenants,
        'admin_grant_tenants': admin_grant,
        'new_this_month': new_this_month,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_list(request):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    from decimal import Decimal
    from django.db.models import Count, Max, Sum, Subquery, OuterRef
    from django.db.models.functions import Coalesce
    from billing.models import Invoice

    # Owner email — pehle business_owner ka email (Subquery)
    owner_email_subq = CustomUser.objects.filter(
        tenant=OuterRef('pk'), role='business_owner'
    ).values('email')[:1]

    # Single annotated query — N+1 nahi
    tenants = Tenant.objects.annotate(
        invoice_count=Count('invoices', distinct=True),
        last_active=Max('invoices__created_at'),
        revenue=Coalesce(Sum('invoices__total_amount'), Decimal('0.00')),
        owner_email=Subquery(owner_email_subq),
    ).order_by('-created_at')

    # Users count per tenant — ek alag aggregation query (2 queries total)
    user_counts = dict(
        CustomUser.objects
        .values('tenant_id')
        .annotate(cnt=Count('id'))
        .values_list('tenant_id', 'cnt')
    )

    data = []
    for t in tenants:
        data.append({
            'id': str(t.id),
            'name': t.name,
            'owner_email': t.owner_email or '—',
            'country': t.country or '—',
            'currency': t.currency or 'INR',
            'access_type': t.access_type,
            'is_active': t.is_active,
            'users_count': user_counts.get(t.id, 0),
            'invoice_count': t.invoice_count,
            'last_active': t.last_active.isoformat() if t.last_active else None,
            'revenue': float(t.revenue),
            'created_at': t.created_at.isoformat(),
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


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_products(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    from inventory.models import Product
    products = Product.objects.filter(tenant=tenant, is_active=True)
    data = []
    for p in products:
        data.append({
            'id': str(p.id),
            'name': p.name,
            'sku': p.sku,
            'cost_price': str(p.cost_price),
            'selling_price': str(p.selling_price),
            'stock_quantity': p.stock_quantity,
            'profit_margin': p.profit_margin,
            'is_low_stock': p.is_low_stock,
        })
    return Response({'tenant': tenant.name, 'products': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_invoices(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    from billing.models import Invoice
    invoices = Invoice.objects.filter(tenant=tenant).order_by('-created_at')
    data = []
    for inv in invoices:
        data.append({
            'id': str(inv.id),
            'invoice_number': inv.invoice_number,
            'customer_name': inv.customer.name,
            'total_amount': str(inv.total_amount),
            'total_profit': str(inv.total_profit),
            'currency': inv.currency,
            'status': inv.status,
            'invoice_date': str(inv.invoice_date),
        })
    return Response({'tenant': tenant.name, 'invoices': data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_customers(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    from billing.models import Customer
    customers = Customer.objects.filter(tenant=tenant, is_active=True)
    data = []
    for c in customers:
        data.append({
            'id': str(c.id),
            'name': c.name,
            'email': c.email or '—',
            'phone': c.phone or '—',
            'country': c.country or '—',
        })
    return Response({'tenant': tenant.name, 'customers': data})


from django.contrib.auth.hashers import make_password
from rest_framework import status


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_tenant_product(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)
    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    from inventory.models import Product
    data = request.data
    product = Product.objects.create(
        tenant=tenant,
        name=data.get('name'),
        sku=data.get('sku'),
        cost_price=data.get('cost_price'),
        selling_price=data.get('selling_price'),
        stock_quantity=data.get('stock_quantity', 0),
        reorder_point=data.get('reorder_point', 10),
        tax_rate=data.get('tax_rate', 0),
    )
    return Response({
        'message': 'Product added successfully.',
        'id': str(product.id),
        'name': product.name,
    }, status=201)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_tenant_product(request, tenant_id, product_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    from inventory.models import Product
    try:
        product = Product.objects.get(id=product_id, tenant__id=tenant_id)
    except Product.DoesNotExist:
        return Response({'error': 'Product not found.'}, status=404)

    if request.method == 'DELETE':
        product.is_active = False
        product.save()
        return Response({'message': 'Product deleted successfully.'})

    elif request.method == 'PUT':
        data = request.data
        product.name = data.get('name', product.name)
        product.sku = data.get('sku', product.sku)
        product.cost_price = data.get('cost_price', product.cost_price)
        product.selling_price = data.get('selling_price', product.selling_price)
        product.stock_quantity = data.get('stock_quantity', product.stock_quantity)
        product.tax_rate = data.get('tax_rate', product.tax_rate)
        product.save()
        return Response({'message': 'Product updated successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_user_password(request, user_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        user = CustomUser.objects.get(id=user_id)
    except CustomUser.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)

    new_password = request.data.get('new_password')
    if not new_password:
        return Response({'error': 'New password required.'}, status=400)

    user.password = make_password(new_password)
    user.save()
    return Response({'message': f'Password reset successfully for {user.email}.'})


@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def upgrade_tenant(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    tenant.access_type = 'paid'
    tenant.is_active = True
    tenant.save()
    return Response({'message': f'{tenant.name} upgraded to paid successfully.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_reports(request, tenant_id):
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    from billing.models import Invoice
    from inventory.models import Product

    invoices = Invoice.objects.filter(tenant=tenant)
    total_revenue = sum(inv.total_amount for inv in invoices)
    total_profit = sum(inv.total_profit for inv in invoices)
    total_invoices = invoices.count()
    paid_invoices = invoices.filter(status='paid').count()

    products = Product.objects.filter(tenant=tenant, is_active=True)
    low_stock = [p.name for p in products if p.is_low_stock]
    total_products = products.count()

    return Response({
        'tenant': tenant.name,
        'currency': tenant.currency,
        'total_revenue': float(total_revenue),
        'total_profit': float(total_profit),
        'total_invoices': total_invoices,
        'paid_invoices': paid_invoices,
        'total_products': total_products,
        'low_stock_products': low_stock,
        'low_stock_count': len(low_stock),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    """
    Overview dashboard ka operational data —
    Needs Attention panel, Signup Trend (7 days), Activity Feed.
    Koi naya model nahi, sab existing timestamps se derive kiya.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    import datetime
    from django.db.models import Count, Q, Subquery, OuterRef
    from django.db.models.functions import TruncDate
    from billing.models import Invoice

    now = timezone.now()
    today = now.date()
    threshold_30d = now - datetime.timedelta(days=30)
    seven_days_ago = today - datetime.timedelta(days=6)

    # ── Needs Attention ──────────────────────────────────────────────────────

    # Per-tenant ki last invoice date (subquery — N+1 nahi)
    latest_invoice_subq = (
        Invoice.objects.filter(tenant=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )

    # Dormant: active, 30d+ purane, koi invoice activity nahi 30d mein
    dormant_count = (
        Tenant.objects.filter(is_active=True, created_at__lt=threshold_30d)
        .annotate(last_invoice_date=Subquery(latest_invoice_subq))
        .filter(
            Q(last_invoice_date__isnull=True) |
            Q(last_invoice_date__lt=threshold_30d)
        )
        .count()
    )

    # Upsell: free tier + active + real usage (3+ invoices) — single aggregation
    upsell_count = (
        Invoice.objects
        .filter(tenant__access_type='free_tier', tenant__is_active=True)
        .values('tenant')
        .annotate(cnt=Count('id'))
        .filter(cnt__gte=3)
        .count()
    )

    # Suspended: abhi inactive hain
    suspended_count = Tenant.objects.filter(is_active=False).count()

    # ── Signup Trend (last 7 days — single DB query) ─────────────────────────

    signups_qs = (
        Tenant.objects
        .filter(created_at__date__gte=seven_days_ago)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    signups_map = {item['day']: item['count'] for item in signups_qs}

    trend = []
    for i in range(7):
        day = seven_days_ago + datetime.timedelta(days=i)
        trend.append({
            'date': day.strftime('%d %b'),
            'count': signups_map.get(day, 0),
        })

    # ── Activity Feed (derived from existing timestamps) ──────────────────────

    activities = []

    for t in Tenant.objects.order_by('-created_at')[:5]:
        activities.append({
            'type': 'business_registered',
            'description': f'{t.name} registered',
            'timestamp': t.created_at.isoformat(),
        })

    for u in (
        CustomUser.objects
        .exclude(role='super_admin')
        .select_related('tenant')
        .order_by('-created_at')[:5]
    ):
        tenant_name = u.tenant.name if u.tenant else '—'
        activities.append({
            'type': 'user_joined',
            'description': f'New user joined · {tenant_name}',
            'timestamp': u.created_at.isoformat(),
        })

    for inv in (
        Invoice.objects
        .select_related('tenant')
        .order_by('-created_at')[:5]
    ):
        activities.append({
            'type': 'invoice_created',
            'description': f'Invoice created · {inv.tenant.name}',
            'timestamp': inv.created_at.isoformat(),
        })

    activities.sort(key=lambda x: x['timestamp'], reverse=True)

    return Response({
        'needs_attention': {
            'dormant': dormant_count,
            'upsell': upsell_count,
            'suspended': suspended_count,
        },
        'signup_trend': trend,
        'activity_feed': activities[:8],
    })