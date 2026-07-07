from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Customer, Invoice, Estimate, Expense
from .serializers import (
    CustomerSerializer,
    InvoiceSerializer,
    InvoiceCreateSerializer,
    EstimateSerializer,
    ExpenseSerializer,
)
from superadmin.utils import get_active_tenant, is_edit_mode


# ─── CUSTOMER VIEWS ───────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def customer_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        customers = Customer.objects.filter(
            tenant=tenant,
            is_active=True
        )
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # Feature gating — Free plan mein sirf 25 customers
        from tenants.plan_limits import is_within_limit
        current_count = Customer.objects.filter(tenant=tenant, is_active=True).count()
        allowed, limit = is_within_limit(tenant, 'customers', current_count)
        if not allowed:
            return Response({
                'plan_limit': True,
                'error': f'Free plan mein sirf {limit} customers add kar sakte hain. Pro plan pe upgrade karo unlimited customers ke liye.',
                'resource': 'customers',
                'limit': limit,
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            customer = serializer.save(tenant=tenant)
            from superadmin.audit import log_action
            log_action(request, 'customer_created', tenant=tenant,
                       target_type='customer', target_name=customer.name)
            return Response(
                serializer.data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def customer_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        customer = Customer.objects.get(pk=pk, tenant=tenant)
    except Customer.DoesNotExist:
        return Response(
            {'error': 'Customer not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = CustomerSerializer(customer)
        return Response(serializer.data)

    elif request.method == 'PUT':
        serializer = CustomerSerializer(
            customer,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
            from superadmin.audit import log_action
            log_action(request, 'customer_updated', tenant=tenant,
                       target_type='customer', target_name=customer.name)
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    elif request.method == 'DELETE':
        customer.is_active = False
        customer.save()
        from superadmin.audit import log_action
        log_action(request, 'customer_deleted', tenant=tenant,
                   target_type='customer', target_name=customer.name)
        return Response(
            {'message': 'Customer deleted successfully.'},
            status=status.HTTP_200_OK
        )


# ─── INVOICE VIEWS ────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def invoice_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        invoices = Invoice.objects.filter(tenant=tenant)
        serializer = InvoiceSerializer(invoices, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # Feature gating — Free plan mein sirf 10 invoices/month
        from tenants.plan_limits import is_within_limit
        from django.utils import timezone
        month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        monthly_count = Invoice.objects.filter(
            tenant=tenant, created_at__gte=month_start
        ).count()
        allowed, limit = is_within_limit(tenant, 'invoices_per_month', monthly_count)
        if not allowed:
            return Response({
                'plan_limit': True,
                'error': f'Free plan mein sirf {limit} invoices/month ban sakte hain. Pro plan pe upgrade karo unlimited invoices ke liye.',
                'resource': 'invoices_per_month',
                'limit': limit,
            }, status=status.HTTP_403_FORBIDDEN)

        serializer = InvoiceCreateSerializer(
            data=request.data,
            context={
                'tenant': tenant,
                'user': request.user
            }
        )
        if serializer.is_valid():
            invoice = serializer.save()

            # Suspicious activity alert — bulk invoice creation in a short
            # window. Threshold (20/hour) is a design choice, not a proven
            # fraud-detection number — a genuine busy shop could hit this
            # too. Alert fires only ONCE per burst (when count first
            # crosses the threshold), not on every invoice after, to
            # avoid spamming the founder repeatedly for the same event.
            from django.conf import settings
            if settings.FOUNDER_TELEGRAM_CHAT_ID:
                from django.utils import timezone
                from tenants.telegram import send_telegram_message
                SUSPICIOUS_THRESHOLD = 20
                one_hour_ago = timezone.now() - timezone.timedelta(hours=1)
                recent_count = Invoice.objects.filter(
                    tenant=tenant, created_at__gte=one_hour_ago
                ).count()
                if recent_count == SUSPICIOUS_THRESHOLD:
                    send_telegram_message(
                        settings.FOUNDER_TELEGRAM_CHAT_ID,
                        f"⚠️ <b>Suspicious Activity</b>\n\n"
                        f"{tenant.name} created {recent_count} invoices "
                        f"in the last hour."
                    )

            return Response(
                InvoiceSerializer(invoice).data,
                status=status.HTTP_201_CREATED
            )
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )


@api_view(['GET', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def invoice_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        invoice = Invoice.objects.get(pk=pk, tenant=tenant)
    except Invoice.DoesNotExist:
        return Response(
            {'error': 'Invoice not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = InvoiceSerializer(invoice)
        return Response(serializer.data)

    elif request.method == 'DELETE':
        # Sirf draft invoices delete ho sakte hain — sent/paid pe history
        # preserve karni hai (accounting integrity)
        if invoice.status != 'draft':
            return Response(
                {'error': 'Only draft invoices can be deleted.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.db import transaction
        from django.db.models import F
        from inventory.models import Product

        with transaction.atomic():
            # Stock wapas restore karo before delete
            for item in invoice.items.all():
                if item.product_id:
                    Product.objects.filter(pk=item.product_id).update(
                        stock_quantity=F('stock_quantity') + item.quantity
                    )
            invoice_number = invoice.invoice_number
            invoice.delete()

        from superadmin.audit import log_action
        log_action(request, 'invoice_status_changed', tenant=tenant,
                   target_type='invoice', target_name=invoice_number,
                   details={'action': 'deleted'})

        return Response({'message': 'Draft invoice deleted.'}, status=status.HTTP_200_OK)

    elif request.method == 'PUT':
        # Sirf draft invoices edit ho sakte hain — business rule
        if invoice.status != 'draft':
            return Response(
                {'error': 'Only draft invoices can be edited.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from .serializers import InvoiceEditSerializer
        serializer = InvoiceEditSerializer(
            invoice,
            data=request.data,
            context={'tenant': tenant, 'user': request.user}
        )
        if serializer.is_valid():
            updated_invoice = serializer.save()

            from superadmin.audit import log_action
            log_action(request, 'invoice_status_changed', tenant=tenant,
                       target_type='invoice', target_name=updated_invoice.invoice_number,
                       details={'action': 'edited'})

            return Response(InvoiceSerializer(updated_invoice).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def invoice_update_status(request, pk):
    """Invoice ka status update karo — sirf status field"""
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        invoice = Invoice.objects.get(pk=pk, tenant=tenant)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found.'}, status=404)

    new_status = request.data.get('status')
    valid = ['draft', 'sent', 'paid', 'cancelled']
    if new_status not in valid:
        return Response({'error': f"Status must be one of: {', '.join(valid)}"}, status=400)

    old_status = invoice.status
    invoice.status = new_status
    invoice.save(update_fields=['status'])
    from superadmin.audit import log_action
    log_action(request, 'invoice_status_changed', tenant=tenant,
               target_type='invoice', target_name=invoice.invoice_number,
               details={'from': old_status, 'to': new_status})
    return Response({'id': str(invoice.id), 'status': invoice.status})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def invoice_summary(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    from django.db.models import Sum, Count, Q
    from django.db.models.functions import Coalesce
    from decimal import Decimal

    # Single DB query — koi Python loop nahi
    agg = Invoice.objects.filter(tenant=tenant).aggregate(
        total_revenue=Coalesce(Sum('total_amount'), Decimal('0.00')),
        total_profit=Coalesce(Sum('total_profit'), Decimal('0.00')),
        total_invoices=Count('id'),
        paid_invoices=Count('id', filter=Q(status='paid')),
    )

    return Response({
        'total_invoices': agg['total_invoices'],
        'paid_invoices': agg['paid_invoices'],
        'total_revenue': agg['total_revenue'],
        'total_profit': agg['total_profit'],
        'currency': tenant.currency,
        'tax_label': tenant.tax_label,
    })

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def close_day(request):
    """
    Aaj ka collection + profit calculate karo aur Telegram pe bhejo.
    Manual trigger — "Close Day" button se call hota hai.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if not tenant.telegram_chat_id:
        return Response({
            'error': 'Telegram Chat ID not set. Add it in Settings first.'
        }, status=status.HTTP_400_BAD_REQUEST)

    from django.db.models import Sum, Count
    from django.db.models.functions import Coalesce
    from django.utils import timezone
    from decimal import Decimal
    from tenants.telegram import send_telegram_message, build_daily_summary_message

    today = timezone.now().date()
    today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = timezone.now().replace(hour=23, minute=59, second=59, microsecond=999999)

    # Sirf aaj ke invoices — draft exclude, sirf sent/paid count hone chahiye
    agg = Invoice.objects.filter(
        tenant=tenant,
        created_at__gte=today_start,
        created_at__lte=today_end,
        status__in=['sent', 'paid'],
    ).aggregate(
        subtotal=Coalesce(Sum('subtotal'), Decimal('0.00')),
        tax_amount=Coalesce(Sum('tax_amount'), Decimal('0.00')),
        total_amount=Coalesce(Sum('total_amount'), Decimal('0.00')),
        total_profit=Coalesce(Sum('total_profit'), Decimal('0.00')),
        invoice_count=Count('id'),
    )

    message = build_daily_summary_message(
        tenant=tenant,
        date=today,
        subtotal=agg['subtotal'],
        tax_amount=agg['tax_amount'],
        total_amount=agg['total_amount'],
        total_profit=agg['total_profit'],
        invoice_count=agg['invoice_count'],
        currency=tenant.currency,
    )

    success, error = send_telegram_message(tenant.telegram_chat_id, message)

    if success:
        return Response({
            'message': 'Daily report sent to Telegram successfully.',
            'summary': agg,
        })
    else:
        return Response({'error': error}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cashflow_summary(request):
    """
    Cashflow visibility — abhi "prediction" nahi hai, yeh real-time
    tracking hai: kitna paisa outstanding hai (sent, unpaid) aur
    kitna overdue hai (due_date nikal chuki, abhi bhi unpaid).

    True forecasting (future revenue predict karna) ke liye real
    payment-behavior history chahiye — woh ab collect hona shuru
    hoga jab se Mark as Paid feature hai, par abhi meaningful
    pattern banne mein time lagega.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Sum, Count
    from django.db.models.functions import Coalesce
    from decimal import Decimal
    from django.utils import timezone

    today = timezone.now().date()

    # Outstanding — sab "sent" invoices jo abhi paid nahi hain
    outstanding_agg = Invoice.objects.filter(
        tenant=tenant, status='sent'
    ).aggregate(
        outstanding_amount=Coalesce(Sum('total_amount'), Decimal('0.00')),
        outstanding_count=Count('id'),
    )

    # Overdue — sent + due_date nikal chuki
    overdue_qs = Invoice.objects.filter(
        tenant=tenant, status='sent',
        due_date__isnull=False, due_date__lt=today,
    )
    overdue_agg = overdue_qs.aggregate(
        overdue_amount=Coalesce(Sum('total_amount'), Decimal('0.00')),
        overdue_count=Count('id'),
    )

    # Top 10 overdue invoices — follow-up ke liye specific list
    overdue_list = overdue_qs.select_related('customer').order_by('due_date')[:10]
    overdue_data = [{
        'id': str(inv.id),
        'invoice_number': inv.invoice_number,
        'customer_name': inv.customer.name if inv.customer else '—',
        'total_amount': inv.total_amount,
        'due_date': inv.due_date.isoformat() if inv.due_date else None,
        'days_overdue': (today - inv.due_date).days if inv.due_date else 0,
    } for inv in overdue_list]

    return Response({
        'outstanding_amount': outstanding_agg['outstanding_amount'],
        'outstanding_count': outstanding_agg['outstanding_count'],
        'overdue_amount': overdue_agg['overdue_amount'],
        'overdue_count': overdue_agg['overdue_count'],
        'overdue_invoices': overdue_data,
        'currency': tenant.currency,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_business_brief(request):
    """
    v1 Decision Engine — 3 rules-based categories, max 3 suggestions
    returned (highest priority first). Manual trigger for now (no
    Celery scheduling yet — that's a Phase 12 item).

    NOTE on thresholds below (dead stock days, etc.) — these are
    reasonable starting defaults, NOT proven-optimal numbers. They
    should become tenant-configurable later; hardcoded here for v1.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Max, F
    from django.utils import timezone
    from inventory.models import Product, StockMovement
    from .models import BusinessSuggestion
    from tenants.telegram import send_telegram_message

    today = timezone.now().date()
    now = timezone.now()
    sym = {'INR': '₹', 'USD': '$', 'AED': 'AED ', 'GBP': '£', 'EUR': '€'}.get(tenant.currency, tenant.currency + ' ')
    suggestions = []

    # ── Rule 1: Restock Needed (reuses existing is_low_stock logic) ──
    low_stock_products = Product.objects.filter(
        tenant=tenant, is_active=True, stock_quantity__lte=F('reorder_point')
    )
    for p in low_stock_products:
        suggestions.append({
            'category': 'restock',
            'title': f'Restock {p.name}',
            'detail': f'{p.stock_quantity} units left, reorder point is {p.reorder_point}.',
            'priority_score': 100 - p.stock_quantity,  # kam stock = zyada urgent
            'related_product_id': p.id,
        })

    # ── Rule 2: Dead Stock — no 'out' movement in last 30 days, stock > 0 ──
    # 30 days = reasonable default, not a proven threshold. Configurable later.
    DEAD_STOCK_DAYS = 30
    cutoff = now - timezone.timedelta(days=DEAD_STOCK_DAYS)
    candidates = Product.objects.filter(tenant=tenant, is_active=True, stock_quantity__gt=0)
    for p in candidates:
        last_sale = StockMovement.objects.filter(
            tenant=tenant, product=p, movement_type='out'
        ).aggregate(last=Max('created_at'))['last']
        if last_sale is None or last_sale < cutoff:
            locked_value = p.stock_quantity * p.cost_price
            days_idle = (now - last_sale).days if last_sale else None
            suggestions.append({
                'category': 'dead_stock',
                'title': f'{p.name} — not selling',
                'detail': (
                    f'No sales in {days_idle} days, {sym}{locked_value:,.2f} locked in stock.'
                    if days_idle is not None else
                    f'Never sold, {sym}{locked_value:,.2f} locked in stock.'
                ),
                'priority_score': int(locked_value),  # zyada locked value = zyada urgent
                'related_product_id': p.id,
            })

    # ── Rule 3: Overdue Collection (reuses cashflow_summary logic) ──
    overdue_invoices = Invoice.objects.filter(
        tenant=tenant, status='sent', due_date__isnull=False, due_date__lt=today,
    ).select_related('customer').order_by('due_date')
    for inv in overdue_invoices:
        days_overdue = (today - inv.due_date).days
        suggestions.append({
            'category': 'overdue',
            'title': f'Collect from {inv.customer.name if inv.customer else "customer"}',
            'detail': f'{sym}{inv.total_amount:,.2f}, {days_overdue} days overdue.',
            'priority_score': int(inv.total_amount) + (days_overdue * 10),
            'related_invoice_id': inv.id,
        })

    # Top 3 by priority — "3 decisions, never more"
    suggestions.sort(key=lambda s: s['priority_score'], reverse=True)
    top_3 = suggestions[:3]

    # Save as BusinessSuggestion rows — foundation for future tracking
    saved = []
    for s in top_3:
        obj = BusinessSuggestion.objects.create(
            tenant=tenant,
            category=s['category'],
            title=s['title'],
            detail=s['detail'],
            priority_score=s['priority_score'],
            related_product_id=s.get('related_product_id'),
            related_invoice_id=s.get('related_invoice_id'),
        )
        saved.append(obj)

    # Build Telegram message
    if not top_3:
        message = f"<b>📋 Business Brief — {tenant.name}</b>\n\nAll clear! No urgent items today."
    else:
        lines = [f"<b>📋 Business Brief — {tenant.name}</b>\n"]
        icons = {'restock': '🟡', 'dead_stock': '🔵', 'overdue': '🟢'}
        for i, s in enumerate(top_3, 1):
            lines.append(f"{icons.get(s['category'], '•')} {i}. {s['title']}\n   {s['detail']}")
        message = "\n\n".join(lines)

    telegram_sent = False
    telegram_error = None
    if tenant.telegram_chat_id:
        telegram_sent, telegram_error = send_telegram_message(tenant.telegram_chat_id, message)

    return Response({
        'suggestions': [{
            'id': str(s.id),
            'category': s.category,
            'title': s.title,
            'detail': s.detail,
            'status': s.status,
            'related_product_id': str(s.related_product_id) if s.related_product_id else None,
            'related_invoice_id': str(s.related_invoice_id) if s.related_invoice_id else None,
        } for s in saved],
        'telegram_sent': telegram_sent,
        'telegram_error': telegram_error,
    })


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def update_suggestion_status(request, suggestion_id):
    """
    Mark a suggestion as 'acted' or 'dismissed' — this status history is
    the raw data future Business Memory pattern-learning will use.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.utils import timezone
    from .models import BusinessSuggestion

    new_status = request.data.get('status')
    if new_status not in ['acted', 'dismissed']:
        return Response({'error': 'Status must be "acted" or "dismissed".'}, status=400)

    try:
        suggestion = BusinessSuggestion.objects.get(id=suggestion_id, tenant=tenant)
    except BusinessSuggestion.DoesNotExist:
        return Response({'error': 'Suggestion not found.'}, status=404)

    suggestion.status = new_status
    suggestion.resolved_at = timezone.now()
    suggestion.save()

    return Response({'message': 'Updated.', 'status': suggestion.status})


# ─── ESTIMATE VIEWS ───────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def estimate_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        estimates = Estimate.objects.filter(tenant=tenant).select_related('customer')
        serializer = EstimateSerializer(estimates, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # NOTE: Estimates deliberately do NOT count against the plan's
        # monthly invoice limit — a quote isn't a sale yet.
        serializer = EstimateSerializer(
            data=request.data,
            context={'tenant': tenant, 'user': request.user}
        )
        if serializer.is_valid():
            estimate = serializer.save()
            return Response(
                EstimateSerializer(estimate).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def estimate_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        estimate = Estimate.objects.get(pk=pk, tenant=tenant)
    except Estimate.DoesNotExist:
        return Response({'error': 'Estimate not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(EstimateSerializer(estimate).data)

    elif request.method == 'DELETE':
        if estimate.status != 'draft':
            return Response({
                'error': 'Only draft estimates can be deleted.'
            }, status=status.HTTP_400_BAD_REQUEST)
        estimate.delete()
        return Response({'message': 'Estimate deleted.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def estimate_update_status(request, pk):
    """
    Status transitions: draft → sent → accepted / rejected.
    'converted' is set only by convert_to_invoice, not here directly.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        estimate = Estimate.objects.get(pk=pk, tenant=tenant)
    except Estimate.DoesNotExist:
        return Response({'error': 'Estimate not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_transitions = {
        'draft':    ['sent'],
        'sent':     ['accepted', 'rejected'],
        'accepted': ['rejected'],  # allow correcting a mistaken accept
    }

    allowed = valid_transitions.get(estimate.status, [])
    if new_status not in allowed:
        return Response({
            'error': f'Cannot change status from "{estimate.status}" to "{new_status}".'
        }, status=status.HTTP_400_BAD_REQUEST)

    estimate.status = new_status
    estimate.save()
    return Response(EstimateSerializer(estimate).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convert_to_invoice(request, pk):
    """
    Turns an Accepted estimate into a real Invoice. Reuses
    InvoiceCreateSerializer entirely — stock validation and deduction
    happen through the exact same path as a normal invoice, so there's
    no duplicated/divergent logic to maintain.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        estimate = Estimate.objects.get(pk=pk, tenant=tenant)
    except Estimate.DoesNotExist:
        return Response({'error': 'Estimate not found.'}, status=status.HTTP_404_NOT_FOUND)

    if estimate.status != 'accepted':
        return Response({
            'error': 'Only accepted estimates can be converted to an invoice.'
        }, status=status.HTTP_400_BAD_REQUEST)

    from django.utils import timezone

    payload = {
        'customer': estimate.customer_id,
        'invoice_date': timezone.now().date().isoformat(),
        'status': 'sent',
        'notes': estimate.notes or '',
        'items': [
            {
                'product': item.product_id,
                'quantity': item.quantity,
                'unit_price': item.unit_price,
            }
            for item in estimate.items.all()
        ],
    }

    invoice_serializer = InvoiceCreateSerializer(
        data=payload,
        context={'tenant': tenant, 'user': request.user}
    )
    if invoice_serializer.is_valid():
        invoice = invoice_serializer.save()
        estimate.status = 'converted'
        estimate.converted_invoice = invoice
        estimate.save()
        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)

    # Agar stock insufficient hai ya koi aur validation fail ho, estimate
    # ka status wahi rehta hai — user ko pata chal jaayega kya galat hai
    return Response(invoice_serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def profit_intelligence(request):
    """
    Profit Intelligence — pure aggregation on already-tracked InvoiceItem
    data (product, quantity, profit). No new fields, no subjective scoring
    — just "which products actually make you money."

    Only 'sent'/'paid' invoices count — draft isn't a real sale yet,
    cancelled is voided. Same filtering principle used in Business Brief.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Sum
    from django.db.models.functions import Coalesce
    from decimal import Decimal
    from django.utils import timezone
    from .models import InvoiceItem

    items_qs = InvoiceItem.objects.filter(
        invoice__tenant=tenant,
        invoice__status__in=['sent', 'paid'],
    )

    by_product = items_qs.values('product_id', 'product_name').annotate(
        total_profit=Coalesce(Sum('profit'), Decimal('0.00')),
        total_revenue=Coalesce(Sum('total'), Decimal('0.00')),
        total_quantity=Coalesce(Sum('quantity'), 0),
    )

    top_products = list(by_product.order_by('-total_profit')[:5])

    # Loss-making products only — not just "the bottom 5 regardless of
    # sign", which would be misleading for a small business with few
    # products (could show profitable items as if they were a problem).
    bottom_products = list(by_product.filter(total_profit__lt=0).order_by('total_profit')[:5])

    by_category = items_qs.filter(product__category__isnull=False).values(
        'product__category__name'
    ).annotate(
        total_profit=Coalesce(Sum('profit'), Decimal('0.00')),
        total_revenue=Coalesce(Sum('total'), Decimal('0.00')),
    ).order_by('-total_profit')

    # Month-over-month margin trend
    now = timezone.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
    if this_month_start.month == 1:
        last_month_start = this_month_start.replace(year=this_month_start.year - 1, month=12)
    else:
        last_month_start = this_month_start.replace(month=this_month_start.month - 1)
    last_month_end = this_month_start - timezone.timedelta(days=1)

    this_month_agg = items_qs.filter(invoice__invoice_date__gte=this_month_start).aggregate(
        profit=Coalesce(Sum('profit'), Decimal('0.00')),
        revenue=Coalesce(Sum('total'), Decimal('0.00')),
    )
    last_month_agg = items_qs.filter(
        invoice__invoice_date__gte=last_month_start,
        invoice__invoice_date__lte=last_month_end,
    ).aggregate(
        profit=Coalesce(Sum('profit'), Decimal('0.00')),
        revenue=Coalesce(Sum('total'), Decimal('0.00')),
    )

    def margin(revenue, profit):
        # Honest: with zero revenue, margin is undefined, NOT 0%.
        # Returning None lets the frontend show "—" instead of a
        # misleading "0%".
        if revenue and revenue > 0:
            return round((profit / revenue) * 100, 2)
        return None

    return Response({
        'currency': tenant.currency,
        'top_products': [{
            'product_id': str(p['product_id']) if p['product_id'] else None,
            'product_name': p['product_name'],
            'total_profit': p['total_profit'],
            'total_revenue': p['total_revenue'],
            'total_quantity': p['total_quantity'],
        } for p in top_products],
        'bottom_products': [{
            'product_id': str(p['product_id']) if p['product_id'] else None,
            'product_name': p['product_name'],
            'total_profit': p['total_profit'],
            'total_revenue': p['total_revenue'],
            'total_quantity': p['total_quantity'],
        } for p in bottom_products],
        'by_category': [{
            'category_name': c['product__category__name'],
            'total_profit': c['total_profit'],
            'total_revenue': c['total_revenue'],
        } for c in by_category],
        'this_month': {
            'profit': this_month_agg['profit'],
            'revenue': this_month_agg['revenue'],
            'margin_percent': margin(this_month_agg['revenue'], this_month_agg['profit']),
        },
        'last_month': {
            'profit': last_month_agg['profit'],
            'revenue': last_month_agg['revenue'],
            'margin_percent': margin(last_month_agg['revenue'], last_month_agg['profit']),
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def business_health_score(request):
    """
    Business Health Score — a DESIGNED scoring model, not a scientifically
    validated formula. Every weight and threshold below is a reasonable
    judgment call, not an industry standard. The breakdown is always shown
    alongside the total score — never just a bare number — specifically
    so this doesn't become an unexplainable black box.

    Weights: Cash 35 / Sales 25 / Inventory 25 / Operations 15 (out of 100)
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Sum, Count, Max, F
    from django.db.models.functions import Coalesce
    from decimal import Decimal
    from django.utils import timezone
    from inventory.models import Product, PurchaseOrder, StockMovement
    from .models import Estimate, HealthScoreSnapshot

    today = timezone.now().date()
    now = timezone.now()
    reasons = []
    actions = []  # each: {'weight': number for sorting, 'text': str}

    # ══════════════════════════════════════════════════════════
    # 1. CASH HEALTH (35 points) — based on overdue invoices
    # ══════════════════════════════════════════════════════════
    overdue_agg = Invoice.objects.filter(
        tenant=tenant, status='sent', due_date__isnull=False, due_date__lt=today,
    ).aggregate(
        amount=Coalesce(Sum('total_amount'), Decimal('0.00')),
        count=Count('id'),
    )
    overdue_amount = overdue_agg['amount']
    overdue_count = overdue_agg['count']

    # Thresholds below are a design choice, not a proven formula.
    # Split into two genuinely distinct signals: HOW MANY invoices are
    # overdue (frequency/count) vs HOW MUCH money is at risk (severity).
    # Honest limitation: amount thresholds below are absolute rupee
    # values, not scaled to the business's typical revenue size — ₹50,000
    # overdue means something very different for a large vs small
    # business, and this view doesn't have an easy "typical scale"
    # baseline to normalize against without restructuring. Noted as a
    # known simplification, not hidden.
    if overdue_count == 0:
        count_sub = 15
    elif overdue_count <= 2:
        count_sub = 10
    elif overdue_count <= 5:
        count_sub = 5
    else:
        count_sub = 1

    if overdue_amount == 0:
        amount_sub = 20
    elif overdue_amount <= 10000:
        amount_sub = 14
    elif overdue_amount <= 50000:
        amount_sub = 7
    else:
        amount_sub = 2

    cash_score = count_sub + amount_sub

    if overdue_count > 0:
        reasons.append(f"₹{overdue_amount:,.2f} overdue across {overdue_count} invoice(s)")
        actions.append({
            'weight': float(overdue_amount),
            'text': f'Collect {overdue_count} overdue invoice(s) worth ₹{overdue_amount:,.2f}',
        })

    # ══════════════════════════════════════════════════════════
    # 2. SALES HEALTH (25 points) — this month vs last month revenue
    # ══════════════════════════════════════════════════════════
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).date()
    if this_month_start.month == 1:
        last_month_start = this_month_start.replace(year=this_month_start.year - 1, month=12)
    else:
        last_month_start = this_month_start.replace(month=this_month_start.month - 1)
    last_month_end = this_month_start - timezone.timedelta(days=1)

    this_month_rev = Invoice.objects.filter(
        tenant=tenant, status__in=['sent', 'paid'], invoice_date__gte=this_month_start
    ).aggregate(total=Coalesce(Sum('total_amount'), Decimal('0.00')))['total']

    last_month_rev = Invoice.objects.filter(
        tenant=tenant, status__in=['sent', 'paid'],
        invoice_date__gte=last_month_start, invoice_date__lte=last_month_end
    ).aggregate(total=Coalesce(Sum('total_amount'), Decimal('0.00')))['total']

    revenue_change_percent = None
    if last_month_rev > 0:
        revenue_change_percent = round(float((this_month_rev - last_month_rev) / last_month_rev) * 100, 1)

    # Honest: with no last-month baseline, we can't judge a "trend" at
    # all — this gives a neutral score rather than pretending to know.
    if last_month_rev == 0:
        sales_score = 15 if this_month_rev > 0 else 8
    elif revenue_change_percent >= 10:
        sales_score = 25
    elif revenue_change_percent >= 0:
        sales_score = 20
    elif revenue_change_percent >= -20:
        sales_score = 12
    else:
        sales_score = 5

    if revenue_change_percent is not None and revenue_change_percent < 0:
        reasons.append(f"Revenue down {abs(revenue_change_percent)}% vs last month")

    # ══════════════════════════════════════════════════════════
    # 3. INVENTORY HEALTH (25 points) — low stock + dead stock
    # ══════════════════════════════════════════════════════════
    low_stock_count = Product.objects.filter(
        tenant=tenant, is_active=True, stock_quantity__lte=F('reorder_point')
    ).count()

    # Same 30-day default used in Business Brief — not a proven threshold,
    # kept consistent with that feature rather than inventing a new number.
    DEAD_STOCK_DAYS = 30
    cutoff = now - timezone.timedelta(days=DEAD_STOCK_DAYS)
    dead_stock_count = 0
    dead_stock_names = []
    for p in Product.objects.filter(tenant=tenant, is_active=True, stock_quantity__gt=0):
        last_sale = StockMovement.objects.filter(
            tenant=tenant, product=p, movement_type='out'
        ).aggregate(last=Max('created_at'))['last']
        if last_sale is None or last_sale < cutoff:
            dead_stock_count += 1
            dead_stock_names.append(p.name)

    # Split into two sub-scores (for the granular breakdown) — split
    # is roughly even (12 + 13 = 25), a design choice, not a formula.
    if low_stock_count == 0:
        low_stock_sub = 12
    elif low_stock_count <= 2:
        low_stock_sub = 8
    elif low_stock_count <= 5:
        low_stock_sub = 4
    else:
        low_stock_sub = 1

    if dead_stock_count == 0:
        dead_stock_sub = 13
    elif dead_stock_count <= 2:
        dead_stock_sub = 9
    elif dead_stock_count <= 5:
        dead_stock_sub = 5
    else:
        dead_stock_sub = 1

    inventory_score = low_stock_sub + dead_stock_sub

    if dead_stock_count > 0:
        reasons.append(f"{dead_stock_count} dead stock item(s)")
        actions.append({
            'weight': dead_stock_count * 1000,
            'text': f'Clear dead stock: {", ".join(dead_stock_names[:2])}'
                    + (f' and {dead_stock_count - 2} more' if dead_stock_count > 2 else ''),
        })
    if low_stock_count > 0:
        reasons.append(f"{low_stock_count} product(s) low on stock")
        actions.append({
            'weight': low_stock_count * 900,
            'text': f'Restock {low_stock_count} low-stock product(s)',
        })

    # ══════════════════════════════════════════════════════════
    # 4. OPERATIONS (15 points) — estimate conversion + PO delays
    # ══════════════════════════════════════════════════════════
    total_estimates = Estimate.objects.filter(
        tenant=tenant, status__in=['accepted', 'rejected', 'converted']
    ).count()
    converted_estimates = Estimate.objects.filter(tenant=tenant, status='converted').count()
    conversion_rate = round((converted_estimates / total_estimates) * 100, 1) if total_estimates > 0 else None

    received_pos = PurchaseOrder.objects.filter(
        tenant=tenant, status='received', expected_date__isnull=False
    )
    total_received = received_pos.count()
    delayed_pos = received_pos.filter(received_date__gt=F('expected_date')).count()
    delay_rate = round((delayed_pos / total_received) * 100, 1) if total_received > 0 else None

    # Split into two sub-scores (7 + 8 = 15) for granular breakdown.
    conversion_sub = 7
    if conversion_rate is not None and conversion_rate < 50:
        conversion_sub = 2

    delay_sub = 8
    if delay_rate is not None and delay_rate > 30:
        delay_sub = 3

    ops_score = conversion_sub + delay_sub

    if delay_rate is not None and delay_rate > 30:
        reasons.append(f"{delay_rate}% of purchase orders arrived later than expected")

    total_score = cash_score + sales_score + inventory_score + ops_score

    top_actions = [a['text'] for a in sorted(actions, key=lambda a: a['weight'], reverse=True)[:3]]

    # Save snapshot for future trend comparisons
    HealthScoreSnapshot.objects.create(
        tenant=tenant,
        total_score=total_score,
        cash_score=cash_score,
        sales_score=sales_score,
        inventory_score=inventory_score,
        operations_score=ops_score,
    )

    # Trend — compare against the closest snapshot from ~30 days ago.
    # Honest limitation: if the business is newer than 30 days, or this
    # is literally the first time the score has ever been calculated,
    # there's nothing to compare against — trend will be None, not a
    # fabricated "0% change".
    trend = None
    thirty_days_ago = now - timezone.timedelta(days=30)
    older_snapshot = HealthScoreSnapshot.objects.filter(
        tenant=tenant, created_at__lte=thirty_days_ago
    ).order_by('-created_at').first()
    if older_snapshot:
        trend = {
            'change': total_score - older_snapshot.total_score,
            'compared_to_date': older_snapshot.created_at.date().isoformat(),
        }

    return Response({
        'total_score': total_score,
        'trend': trend,
        'breakdown': {
            'cash':        {'score': cash_score, 'max': 35, 'label': 'Cash Health'},
            'sales':       {'score': sales_score, 'max': 25, 'label': 'Sales Health'},
            'inventory':   {'score': inventory_score, 'max': 25, 'label': 'Inventory Health'},
            'operations':  {'score': ops_score, 'max': 15, 'label': 'Operations'},
        },
        'sub_breakdown': {
            'cash': [
                {'label': 'Overdue Count', 'score': count_sub, 'max': 15},
                {'label': 'Overdue Amount', 'score': amount_sub, 'max': 20},
            ],
            'inventory': [
                {'label': 'Low Stock', 'score': low_stock_sub, 'max': 12},
                {'label': 'Dead Stock', 'score': dead_stock_sub, 'max': 13},
            ],
            'operations': [
                {'label': 'Estimate Conversion', 'score': conversion_sub, 'max': 7},
                {'label': 'On-time Delivery', 'score': delay_sub, 'max': 8},
            ],
        },
        'reasons': reasons,
        'recommended_actions': top_actions,
        'details': {
            'overdue_amount': overdue_amount,
            'overdue_count': overdue_count,
            'revenue_this_month': this_month_rev,
            'revenue_last_month': last_month_rev,
            'revenue_change_percent': revenue_change_percent,
            'low_stock_count': low_stock_count,
            'dead_stock_count': dead_stock_count,
            'estimate_conversion_rate': conversion_rate,
            'po_delay_rate': delay_rate,
        },
        'currency': tenant.currency,
    })


# ─── EXPENSE VIEWS ────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def expense_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        expenses = Expense.objects.filter(tenant=tenant)
        return Response(ExpenseSerializer(expenses, many=True).data)

    elif request.method == 'POST':
        serializer = ExpenseSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def expense_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        expense = Expense.objects.get(pk=pk, tenant=tenant)
    except Expense.DoesNotExist:
        return Response({'error': 'Expense not found.'}, status=status.HTTP_404_NOT_FOUND)

    expense.delete()
    return Response({'message': 'Expense deleted.'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def expense_summary(request):
    """
    Monthly total + category-wise breakdown. Defaults to current month;
    accepts ?year=&month= query params for other months.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Sum
    from django.db.models.functions import Coalesce
    from decimal import Decimal
    from django.utils import timezone

    now = timezone.now()
    try:
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))
    except ValueError:
        return Response({'error': 'Invalid year/month.'}, status=400)

    expenses_qs = Expense.objects.filter(
        tenant=tenant, expense_date__year=year, expense_date__month=month
    )

    total = expenses_qs.aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']

    by_category = expenses_qs.values('category').annotate(
        total=Coalesce(Sum('amount'), Decimal('0.00'))
    ).order_by('-total')

    # Previous month (relative to the requested month, not necessarily
    # "today") — lets the month navigator show a comparison for ANY
    # month browsed, not just the current one.
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    prev_total = Expense.objects.filter(
        tenant=tenant, expense_date__year=prev_year, expense_date__month=prev_month
    ).aggregate(total=Coalesce(Sum('amount'), Decimal('0.00')))['total']

    change_percent = None
    if prev_total > 0:
        change_percent = round(float((total - prev_total) / prev_total) * 100, 1)

    # Map category codes to display labels
    category_labels = dict(Expense.CATEGORY_CHOICES)

    return Response({
        'year': year,
        'month': month,
        'total': total,
        'previous_month_total': prev_total,
        'change_percent': change_percent,
        'by_category': [{
            'category': c['category'],
            'category_label': category_labels.get(c['category'], c['category']),
            'total': c['total'],
        } for c in by_category],
        'currency': tenant.currency,
    })


# ─── DEMAND FORECASTING VIEWS ─────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_demand_forecasts(request):
    """
    Manual trigger — jaisa 'Generate Business Brief' hai. Har active
    product ke liye forecast (re)calculate karta hai. Purana forecast
    overwrite hota hai (history table nahi hai v1 mein).
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from inventory.models import Product
    from .forecasting import classify_and_forecast
    from .models import DemandForecast

    products = Product.objects.filter(tenant=tenant, is_active=True)
    results = []

    for product in products:
        forecast_data = classify_and_forecast(tenant, product)
        obj, _ = DemandForecast.objects.update_or_create(
            tenant=tenant, product=product,
            defaults={
                'pattern_type': forecast_data['pattern_type'],
                'forecast_daily_rate': forecast_data['forecast_daily_rate'],
                'data_points_used': forecast_data['data_points_used'],
                'note': forecast_data['note'],
            }
        )
        results.append(obj)

    return Response({
        'message': f'Forecasts generated for {len(results)} product(s).',
        'count': len(results),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_demand_forecasts(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from .models import DemandForecast

    forecasts = DemandForecast.objects.filter(tenant=tenant).select_related('product')

    data = [{
        'id': str(f.id),
        'product_id': str(f.product.id),
        'product_name': f.product.name,
        'pattern_type': f.pattern_type,
        'forecast_daily_rate': f.forecast_daily_rate,
        'data_points_used': f.data_points_used,
        'note': f.note,
        'generated_at': f.generated_at.isoformat(),
    } for f in forecasts]

    return Response({'results': data, 'count': len(data)})