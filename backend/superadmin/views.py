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

    # Plan pricing — Razorpay aane tak yahan se MRR calculate hoga
    # Jab Razorpay aayega, actual payment records se calculate karenge
    PLAN_PRICES = {
        'pro':        499,
        'enterprise': 999,
        'free':       0,
        'admin_grant': 0,   # Granted = no charge abhi
    }

    # Single-pass aggregation — koi N+1 nahi
    total_tenants   = Tenant.objects.count()
    active_tenants  = Tenant.objects.filter(is_active=True).count()
    total_users     = CustomUser.objects.exclude(role='super_admin').count()
    new_this_month  = Tenant.objects.filter(
        created_at__year=now.year,
        created_at__month=now.month
    ).count()

    # Plan-wise counts (naye names)
    plan_counts = {
        'free':        Tenant.objects.filter(access_type='free').count(),
        'pro':         Tenant.objects.filter(access_type='pro').count(),
        'enterprise':  Tenant.objects.filter(access_type='enterprise').count(),
        'admin_grant': Tenant.objects.filter(access_type='admin_grant').count(),
    }

    # Estimated MRR — Pro × ₹499 + Enterprise × ₹999
    # "Estimated" kyunki abhi Razorpay nahi hai — actual payments track nahi ho rahe
    estimated_mrr = (
        plan_counts['pro'] * PLAN_PRICES['pro'] +
        plan_counts['enterprise'] * PLAN_PRICES['enterprise']
    )

    # Platform revenue = is mahine tak ka total estimated revenue
    # (cumulative, MRR nahi — yeh sabhi paid months ka total hoga)
    # Abhi sirf current month ka estimate hai (Razorpay aane tak)
    platform_revenue = estimated_mrr  # Will be replaced with actual payment records

    return Response({
        'total_tenants':      total_tenants,
        'active_tenants':     active_tenants,
        'suspended_tenants':  total_tenants - active_tenants,
        'total_users':        total_users,
        'new_this_month':     new_this_month,

        # Plan breakdown
        'plan_counts':        plan_counts,

        # Legacy fields (backward compatible — frontend pe purana code na toote)
        'paid_tenants':       plan_counts['pro'] + plan_counts['enterprise'],
        'free_tenants':       plan_counts['free'],
        'admin_grant_tenants': plan_counts['admin_grant'],

        # MRR + Revenue
        'estimated_mrr':      estimated_mrr,
        'platform_revenue':   platform_revenue,
        'mrr_breakdown': {
            'pro_count':        plan_counts['pro'],
            'pro_price':        PLAN_PRICES['pro'],
            'enterprise_count': plan_counts['enterprise'],
            'enterprise_price': PLAN_PRICES['enterprise'],
        },
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

    # Owner email — Membership se (role='business_owner' hardcode ab
    # deprecated hai, Membership table hi source of truth hai) (Subquery)
    from teams.models import Membership
    owner_email_subq = Membership.objects.filter(
        tenant=OuterRef('pk'), role__name='Owner', status='active'
    ).values('user__email')[:1]

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

    # Pagination — page aur page_size query params se
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size
    total_count = tenants.count()
    tenants_page = tenants[start:end]

    data = []
    for t in tenants_page:
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

    return Response({
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': (total_count + page_size - 1) // page_size,
        'results': data,
    })


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

    users = CustomUser.objects.exclude(role='super_admin').select_related('tenant').order_by('-created_at')
    page = int(request.query_params.get('page', 1))
    page_size = int(request.query_params.get('page_size', 20))
    start = (page - 1) * page_size
    end = start + page_size
    total_count = users.count()
    users_page = users[start:end]

    data = []
    for user in users_page:
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

    return Response({
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': (total_count + page_size - 1) // page_size,
        'results': data,
    })


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
    invoices = Invoice.objects.filter(tenant=tenant).select_related('customer').order_by('-created_at')
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

    # Plan choose karo — free/pro/enterprise/admin_grant
    new_plan = request.data.get('plan', 'pro')
    valid_plans = ['free', 'pro', 'enterprise', 'admin_grant']
    if new_plan not in valid_plans:
        return Response({'error': f'Invalid plan. Choose from: {", ".join(valid_plans)}'}, status=400)

    tenant.access_type = new_plan
    tenant.is_active = True
    tenant.save()

    plan_labels = {'free': 'Free', 'pro': 'Pro', 'enterprise': 'Enterprise', 'admin_grant': 'Admin Granted'}
    return Response({
        'message': f'{tenant.name} plan updated to {plan_labels[new_plan]} successfully.',
        'access_type': new_plan,
    })


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
    from django.db.models import Sum, Count, F, Q
    from django.db.models.functions import Coalesce
    from decimal import Decimal

    # DB-level aggregation — koi Python loop nahi
    invoice_agg = Invoice.objects.filter(tenant=tenant).aggregate(
        total_revenue=Coalesce(Sum('total_amount'), Decimal('0.00')),
        total_profit=Coalesce(Sum('total_profit'), Decimal('0.00')),
        total_invoices=Count('id'),
        paid_invoices=Count('id', filter=Q(status='paid')),
    )

    products = Product.objects.filter(tenant=tenant, is_active=True)
    total_products = products.count()

    # DB-level low stock filter — F() expression use karo
    low_stock = list(
        products.filter(stock_quantity__lte=F('reorder_point'))
        .values_list('name', flat=True)
    )

    return Response({
        'tenant': tenant.name,
        'currency': tenant.currency,
        'total_revenue': float(invoice_agg['total_revenue']),
        'total_profit': float(invoice_agg['total_profit']),
        'total_invoices': invoice_agg['total_invoices'],
        'paid_invoices': invoice_agg['paid_invoices'],
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


# ── Phase 2 — Founder Support Mode APIs ──────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enter_workspace(request, tenant_id):
    """
    Founder kisi business ke workspace mein ghusta hai.
    - Pehle se active session band karo (ek waqt mein sirf ek session)
    - Naya SupportSession record banao
    - Mode: 'view' (default, safe)
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Business not found.'}, status=404)

    from superadmin.models import SupportSession

    # Pehle se active sessions band karo
    SupportSession.objects.filter(
        founder=request.user, is_active=True
    ).update(is_active=False, ended_at=timezone.now())

    # Naya session banao
    mode = request.data.get('mode', 'view')
    if mode not in ['view', 'edit']:
        mode = 'view'

    session = SupportSession.objects.create(
        founder=request.user,
        tenant=tenant,
        mode=mode
    )

    from superadmin.audit import log_action
    log_action(request, 'workspace_entered', tenant=tenant,
               target_type='session', target_name=tenant.name,
               details={'mode': mode})

    return Response({
        'session_id': str(session.id),
        'tenant_id': str(tenant.id),
        'tenant_name': tenant.name,
        'mode': session.mode,
        'started_at': session.started_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def exit_workspace(request):
    """Founder workspace se bahar nikalta hai — session band karo."""
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    from superadmin.models import SupportSession

    session = SupportSession.objects.filter(
        founder=request.user, is_active=True
    ).select_related('tenant').first()

    tenant_ref = session.tenant if session else None

    SupportSession.objects.filter(
        founder=request.user, is_active=True
    ).update(is_active=False, ended_at=timezone.now())

    if tenant_ref:
        from superadmin.audit import log_action
        log_action(request, 'workspace_exited', tenant=tenant_ref,
                   target_type='session', target_name=tenant_ref.name)

    return Response({'message': 'Workspace exited successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def switch_mode(request):
    """View ↔ Edit mode switch karo current active session mein."""
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    mode = request.data.get('mode')
    if mode not in ['view', 'edit']:
        return Response({'error': "Mode must be 'view' or 'edit'."}, status=400)

    from superadmin.models import SupportSession

    session = SupportSession.objects.filter(
        founder=request.user, is_active=True
    ).first()

    if not session:
        return Response({'error': 'No active support session.'}, status=404)

    old_mode = session.mode
    session.mode = mode
    session.save(update_fields=['mode'])

    from superadmin.audit import log_action
    log_action(request, 'mode_switched', tenant=session.tenant,
               target_type='session', target_name=session.tenant.name,
               details={'from': old_mode, 'to': mode})

    return Response({
        'session_id': str(session.id),
        'tenant_id': str(session.tenant_id),
        'mode': session.mode,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_active_session(request):
    """Frontend check kare ki founder abhi kisi workspace mein hai ya nahi."""
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    from superadmin.models import SupportSession

    session = (
        SupportSession.objects
        .filter(founder=request.user, is_active=True)
        .select_related('tenant')
        .first()
    )

    if not session:
        return Response({'session': None})

    return Response({
        'session': {
            'session_id': str(session.id),
            'tenant_id': str(session.tenant.id),
            'tenant_name': session.tenant.name,
            'mode': session.mode,
            'started_at': session.started_at.isoformat(),
        }
    })


# ── Audit Log API ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def audit_logs(request):
    """
    Founder ke liye audit logs — pagination + date range filter ke saath.

    Query params:
        tenant_id  → specific business ke logs
        days       → 1 (today), 7, 30 — date range filter
        page       → page number (default 1)
        page_size  → entries per page (default 50)
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    import datetime
    from superadmin.models import AuditLog

    logs = AuditLog.objects.select_related('actor', 'tenant').order_by('-created_at')

    # Filter 1: tenant_id
    tenant_id = request.query_params.get('tenant_id')
    if tenant_id:
        logs = logs.filter(tenant_id=tenant_id)

    # Filter 2: date range
    days = request.query_params.get('days')
    if days:
        try:
            days_int = int(days)
            since = timezone.now() - datetime.timedelta(days=days_int)
            logs = logs.filter(created_at__gte=since)
        except ValueError:
            pass

    # Pagination
    total_count = logs.count()
    page = max(1, int(request.query_params.get('page', 1)))
    page_size = min(100, max(10, int(request.query_params.get('page_size', 50))))
    start = (page - 1) * page_size
    end = start + page_size
    logs_page = logs[start:end]

    ACTION_LABELS = {
        'workspace_entered':      'Entered workspace',
        'workspace_exited':       'Exited workspace',
        'mode_switched':          'Switched mode',
        'product_created':        'Product added',
        'product_updated':        'Product updated',
        'product_deleted':        'Product deleted',
        'customer_created':       'Customer added',
        'customer_updated':       'Customer updated',
        'customer_deleted':       'Customer deleted',
        'invoice_status_changed': 'Invoice status changed',
    }

    data = []
    for log in logs_page:
        data.append({
            'id': str(log.id),
            'actor_email': log.actor.email,
            'tenant_name': log.tenant.name,
            'tenant_id': str(log.tenant.id),
            'action': log.action,
            'action_label': ACTION_LABELS.get(log.action, log.action),
            'target_type': log.target_type,
            'target_name': log.target_name,
            'details': log.details,
            'is_support_action': log.is_support_action,
            'created_at': log.created_at.isoformat(),
        })

    return Response({
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': max(1, (total_count + page_size - 1) // page_size),
        'results': data,
    })


# ── Phase 3 — Platform Analytics ─────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def platform_analytics(request):
    """
    Founder ke liye platform-wide analytics.
    Sab DB-level aggregation — koi N+1 nahi.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    import datetime
    from django.db.models import Count, Q, Subquery, OuterRef
    from django.db.models.functions import TruncDate
    from billing.models import Invoice

    now = timezone.now()
    today = now.date()
    thirty_days_ago = today - datetime.timedelta(days=29)
    threshold_30d = now - datetime.timedelta(days=30)

    # ── 1. Signup trend — last 30 days (single query) ────────────────────────

    signups_qs = (
        Tenant.objects
        .filter(created_at__date__gte=thirty_days_ago)
        .annotate(day=TruncDate('created_at'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    signups_map = {item['day']: item['count'] for item in signups_qs}

    signup_trend = []
    for i in range(30):
        day = thirty_days_ago + datetime.timedelta(days=i)
        signup_trend.append({
            'date': day.strftime('%d %b'),
            'count': signups_map.get(day, 0),
        })

    # ── 2. Geographic distribution — top 8 countries ─────────────────────────

    geo_qs = (
        Tenant.objects
        .values('country')
        .annotate(count=Count('id'))
        .order_by('-count')[:8]
    )
    geographic = [
        {'country': g['country'] or 'Unknown', 'count': g['count']}
        for g in geo_qs
    ]

    # ── 3. Plan distribution ──────────────────────────────────────────────────

    plan_distribution = {
        'free_tier':   Tenant.objects.filter(access_type='free_tier').count(),
        'paid':        Tenant.objects.filter(access_type='paid').count(),
        'admin_grant': Tenant.objects.filter(access_type='admin_grant').count(),
    }

    # ── 4. Business health breakdown ──────────────────────────────────────────

    total_tenants  = Tenant.objects.count()
    active_tenants = Tenant.objects.filter(is_active=True).count()
    suspended      = total_tenants - active_tenants

    # Dormant: active + older 30d + no invoice in 30d
    latest_invoice_subq = (
        Invoice.objects
        .filter(tenant=OuterRef('pk'))
        .order_by('-created_at')
        .values('created_at')[:1]
    )
    dormant = (
        Tenant.objects
        .filter(is_active=True, created_at__lt=threshold_30d)
        .annotate(last_invoice_date=Subquery(latest_invoice_subq))
        .filter(
            Q(last_invoice_date__isnull=True) |
            Q(last_invoice_date__lt=threshold_30d)
        )
        .count()
    )
    healthy = active_tenants - dormant

    health_breakdown = {
        'healthy':   max(healthy, 0),
        'dormant':   dormant,
        'suspended': suspended,
    }

    # ── 5. Top 5 businesses by invoice activity ───────────────────────────────

    top_businesses_qs = (
        Tenant.objects
        .annotate(invoice_count=Count('invoices'))
        .filter(invoice_count__gt=0)
        .order_by('-invoice_count')[:5]
        .values('name', 'invoice_count', 'access_type', 'country')
    )
    top_businesses = list(top_businesses_qs)

    return Response({
        'signup_trend':     signup_trend,
        'geographic':       geographic,
        'plan_distribution': plan_distribution,
        'health_breakdown': health_breakdown,
        'top_businesses':   top_businesses,
        'total_tenants':    total_tenants,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def permanent_delete_tenant(request, tenant_id):
    """
    Tenant ko PERMANENTLY delete karo — poora data cascade delete hoga
    (products, invoices, customers, users, sab). Irreversible hai.

    Safety: business ka exact naam confirm karna zaroori hai request mein,
    warna 400 error. Yeh accidental delete se bachata hai.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    try:
        tenant = Tenant.objects.get(id=tenant_id)
    except Tenant.DoesNotExist:
        return Response({'error': 'Tenant not found.'}, status=404)

    # Confirmation — exact business name match karna hoga
    confirm_name = (request.data.get('confirm_name') or '').strip()
    if confirm_name != tenant.name:
        return Response({
            'error': 'Business name does not match. Type the exact name to confirm deletion.'
        }, status=status.HTTP_400_BAD_REQUEST)

    from inventory.models import Product
    from billing.models import Customer, Invoice
    from users.models import CustomUser
    from teams.models import Membership
    from .models import TenantDeletionLog

    # owner_email Tenant model ka real field nahi hai — tenant_list view mein
    # yeh sirf Subquery annotation hai. Yahan Membership se nikalo
    # (role='business_owner' hardcode ab deprecated hai).
    owner_membership = Membership.objects.filter(
        tenant=tenant, role__name='Owner', status='active'
    ).select_related('user').first()
    owner_email = owner_membership.user.email if owner_membership else ''

    # Delete se PEHLE snapshot lo — counts, naam, email — sab save karo
    snapshot = TenantDeletionLog.objects.create(
        tenant_id_snapshot=tenant.id,
        tenant_name=tenant.name,
        owner_email=owner_email,
        products_count=Product.objects.filter(tenant=tenant).count(),
        customers_count=Customer.objects.filter(tenant=tenant).count(),
        invoices_count=Invoice.objects.filter(tenant=tenant).count(),
        users_count=CustomUser.objects.filter(tenant=tenant).count(),
        deleted_by=request.user,
        deleted_by_email_snapshot=request.user.email,
        reason=request.data.get('reason', ''),
    )

    tenant_name = tenant.name
    tenant.delete()  # CASCADE — poora data chala jaayega

    return Response({
        'message': f'"{tenant_name}" and all its data have been permanently deleted.',
        'deletion_log_id': str(snapshot.id),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def deletion_history(request):
    """
    Deleted tenants ka permanent history — founder ke apne records ke liye.
    """
    if not is_super_admin(request.user):
        return Response({'error': 'Access denied.'}, status=403)

    from .models import TenantDeletionLog

    logs = TenantDeletionLog.objects.all()[:100]  # recent 100, simple cap

    data = [{
        'id': str(log.id),
        'tenant_name': log.tenant_name,
        'owner_email': log.owner_email,
        'products_count': log.products_count,
        'customers_count': log.customers_count,
        'invoices_count': log.invoices_count,
        'users_count': log.users_count,
        'deleted_by_email': log.deleted_by_email_snapshot,
        'reason': log.reason,
        'deleted_at': log.deleted_at.isoformat(),
    } for log in logs]

    return Response({'results': data, 'count': len(data)})