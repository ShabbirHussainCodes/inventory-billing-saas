from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import F
from .models import Category, Supplier, Product, StockMovement, PurchaseOrder, PurchaseOrderItem
from .serializers import (
    CategorySerializer,
    SupplierSerializer,
    ProductSerializer,
    StockMovementSerializer,
    PurchaseOrderSerializer,
)
from superadmin.utils import get_active_tenant, is_edit_mode


# ─── CATEGORY VIEWS ───────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def category_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        categories = Category.objects.filter(
            tenant=tenant,
            is_active=True
        )
        serializer = CategorySerializer(categories, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = CategorySerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
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
def category_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        category = Category.objects.get(pk=pk, tenant=tenant)
    except Category.DoesNotExist:
        return Response({'error': 'Category not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(CategorySerializer(category).data)

    elif request.method == 'PUT':
        serializer = CategorySerializer(category, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            from superadmin.audit import log_action
            log_action(request, 'product_updated', tenant=tenant,
                       target_type='category', target_name=category.name)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        # Soft delete — products jo isse linked hain unka category null ho jaayega
        category.is_active = False
        category.save()
        from superadmin.audit import log_action
        log_action(request, 'product_deleted', tenant=tenant,
                   target_type='category', target_name=category.name)
        return Response({'message': 'Category deleted successfully.'})


# ─── SUPPLIER VIEWS ───────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def supplier_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        suppliers = Supplier.objects.filter(
            tenant=tenant,
            is_active=True
        )
        serializer = SupplierSerializer(suppliers, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = SupplierSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(tenant=tenant)
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
def supplier_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        supplier = Supplier.objects.get(pk=pk, tenant=tenant)
    except Supplier.DoesNotExist:
        return Response({'error': 'Supplier not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(SupplierSerializer(supplier).data)

    elif request.method == 'PUT':
        serializer = SupplierSerializer(supplier, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            from superadmin.audit import log_action
            log_action(request, 'product_updated', tenant=tenant,
                       target_type='supplier', target_name=supplier.name)
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        supplier.is_active = False
        supplier.save()
        from superadmin.audit import log_action
        log_action(request, 'product_deleted', tenant=tenant,
                   target_type='supplier', target_name=supplier.name)
        return Response({'message': 'Supplier deleted successfully.'})


# ─── PRODUCT VIEWS ────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def product_list(request):
    # Sirf us tenant ke products dikhenge
    # Multi-tenant isolation yahan hoti hai
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        from django.db.models import Sum, Q
        from django.db.models.functions import Coalesce

        # Incoming = ordered but not yet received. v1 only supports full
        # receiving (no partial), so quantity_received is always 0 while
        # status='ordered' — this simplification will need revisiting if
        # partial receiving is added later.
        products = Product.objects.filter(
            tenant=tenant,
            is_active=True
        ).annotate(
            incoming_quantity=Coalesce(
                Sum(
                    'purchaseorderitem__quantity_ordered',
                    filter=Q(purchaseorderitem__purchase_order__status='ordered')
                ), 0
            )
        )
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        # Feature gating — Free plan mein sirf 20 products
        from tenants.plan_limits import is_within_limit
        current_count = Product.objects.filter(tenant=tenant, is_active=True).count()
        allowed, limit = is_within_limit(tenant, 'products', current_count)
        if not allowed:
            return Response({
                'plan_limit': True,
                'error': f'Free plan mein sirf {limit} products add kar sakte hain. Pro plan pe upgrade karo unlimited products ke liye.',
                'resource': 'products',
                'limit': limit,
            }, status=status.HTTP_403_FORBIDDEN)

        # SKU duplicate check — explicit, kyunki 'tenant' field serializer mein
        # nahi hai isliye DRF automatically unique_together validate nahi kar
        # sakta. Iske bina IntegrityError crash hota tha (500 error).
        sku = (request.data.get('sku') or '').strip()
        # Sirf ACTIVE products mein check karo — deleted product ka SKU reuse ho sakta hai
        if sku and Product.objects.filter(tenant=tenant, sku=sku, is_active=True).exists():
            return Response(
                {'sku': [f'A product with SKU "{sku}" already exists.']},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            try:
                product = serializer.save(tenant=tenant)
            except Exception:
                # Safety net — koi bhi DB constraint clash crash na kare
                return Response(
                    {'error': 'Could not create product. SKU may already be in use.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            from superadmin.audit import log_action
            log_action(request, 'product_created', tenant=tenant,
                       target_type='product', target_name=product.name,
                       details={'sku': product.sku})
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
def product_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        product = Product.objects.get(pk=pk, tenant=tenant)
    except Product.DoesNotExist:
        return Response(
            {'error': 'Product not found.'},
            status=status.HTTP_404_NOT_FOUND
        )

    if request.method == 'GET':
        serializer = ProductSerializer(product)
        return Response(serializer.data)

    elif request.method == 'PUT':
        # SKU duplicate check — agar SKU badla ho to verify karo koi aur
        # product (isi tenant mein) wahi SKU use na kar raha ho
        new_sku = (request.data.get('sku') or '').strip()
        if new_sku and new_sku != product.sku:
            if Product.objects.filter(tenant=tenant, sku=new_sku, is_active=True).exclude(pk=product.pk).exists():
                return Response(
                    {'sku': [f'A product with SKU "{new_sku}" already exists.']},
                    status=status.HTTP_400_BAD_REQUEST
                )

        serializer = ProductSerializer(
            product,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            try:
                serializer.save()
            except Exception:
                return Response(
                    {'error': 'Could not update product. SKU may already be in use.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            from superadmin.audit import log_action
            log_action(request, 'product_updated', tenant=tenant,
                       target_type='product', target_name=product.name)
            return Response(serializer.data)
        return Response(
            serializer.errors,
            status=status.HTTP_400_BAD_REQUEST
        )

    elif request.method == 'DELETE':
        product.is_active = False
        product.save()
        from superadmin.audit import log_action
        log_action(request, 'product_deleted', tenant=tenant,
                   target_type='product', target_name=product.name)
        return Response(
            {'message': 'Product deleted successfully.'},
            status=status.HTTP_200_OK
        )


# ─── LOW STOCK ALERT ──────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def low_stock_products(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)
    from django.db.models import F
    # DB-level filter — Python loop nahi, F() se DB pe compare
    low_stock = Product.objects.filter(
        tenant=tenant,
        is_active=True,
        stock_quantity__lte=F('reorder_point')
    )
    serializer = ProductSerializer(low_stock, many=True)
    return Response({
        'count': low_stock.count(),
        'products': serializer.data
    })


# ─── STOCK MOVEMENT ───────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_stock_movement(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    serializer = StockMovementSerializer(data=request.data)
    if serializer.is_valid():
        product = serializer.validated_data['product']

        # Security check — doosre tenant ka product nahi
        if product.tenant != tenant:
            return Response(
                {'error': 'Product not found.'},
                status=status.HTTP_404_NOT_FOUND
            )

        movement_type = serializer.validated_data['movement_type']
        quantity = serializer.validated_data['quantity']

        # Stock update karo
        if movement_type == 'in':
            product.stock_quantity += quantity
        elif movement_type in ['out', 'return']:
            if product.stock_quantity < quantity:
                return Response(
                    {'error': 'Insufficient stock.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            product.stock_quantity -= quantity
        elif movement_type == 'adjustment':
            product.stock_quantity = quantity

        product.save()

        # Movement record save karo
        serializer.save(
            tenant=tenant,
            user=request.user
        )

        return Response({
            'message': 'Stock updated successfully.',
            'new_stock': product.stock_quantity
        }, status=status.HTTP_201_CREATED)

    return Response(
        serializer.errors,
        status=status.HTTP_400_BAD_REQUEST
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def stock_movement_list(request):
    """
    Stock movement history — filters ke saath.
    Query params: product_id, movement_type, days, page, page_size
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    movements = StockMovement.objects.filter(tenant=tenant).select_related('product', 'user')

    product_id = request.query_params.get('product_id')
    if product_id:
        movements = movements.filter(product_id=product_id)

    movement_type = request.query_params.get('movement_type')
    if movement_type:
        movements = movements.filter(movement_type=movement_type)

    days = request.query_params.get('days')
    if days:
        import datetime
        try:
            since = timezone.now() - datetime.timedelta(days=int(days))
            movements = movements.filter(created_at__gte=since)
        except ValueError:
            pass

    movements = movements.order_by('-created_at')

    # Pagination — same pattern jo audit log mein use kiya
    total_count = movements.count()
    page = max(1, int(request.query_params.get('page', 1)))
    page_size = min(100, max(10, int(request.query_params.get('page_size', 50))))
    start = (page - 1) * page_size
    end = start + page_size
    movements_page = movements[start:end]

    data = []
    for m in movements_page:
        data.append({
            'id': str(m.id),
            'product_id': str(m.product_id) if m.product_id else None,
            'product_name': m.product.name if m.product else 'Deleted product',
            'movement_type': m.movement_type,
            'quantity': m.quantity,
            'note': m.note,
            'user_email': m.user.email if m.user else 'System',
            'created_at': m.created_at.isoformat(),
        })

    return Response({
        'count': total_count,
        'page': page,
        'page_size': page_size,
        'total_pages': max(1, (total_count + page_size - 1) // page_size),
        'results': data,
    })


# ─── PURCHASE ORDER VIEWS ─────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def purchase_order_list(request):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    if request.method == 'GET':
        orders = PurchaseOrder.objects.filter(tenant=tenant).prefetch_related('items')
        serializer = PurchaseOrderSerializer(orders, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = PurchaseOrderSerializer(data=request.data, context={'tenant': tenant})
        if serializer.is_valid():
            po = serializer.save()
            # Note: no audit log entry here — AuditLog's ACTION_CHOICES has
            # no "purchase order created" option yet, and forcing a mismatched
            # label (e.g. 'product_updated') would be misleading. Can add a
            # proper choice + migration later if PO audit trail is needed.
            return Response(
                PurchaseOrderSerializer(po).data,
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def purchase_order_detail(request, pk):
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        po = PurchaseOrder.objects.get(pk=pk, tenant=tenant)
    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        return Response(PurchaseOrderSerializer(po).data)

    elif request.method == 'DELETE':
        # Sirf draft orders delete ho sakte hain — ordered/received orders
        # ka data/audit trail preserve karna zaroori hai
        if po.status != 'draft':
            return Response({
                'error': 'Only draft purchase orders can be deleted.'
            }, status=status.HTTP_400_BAD_REQUEST)
        po.delete()
        return Response({'message': 'Purchase order deleted.'})


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def purchase_order_update_status(request, pk):
    """
    Status transitions: draft → ordered → received, or → cancelled.

    v1 receiving is "all or nothing" — marking as Received sets every
    item's quantity_received = quantity_ordered and adds that stock in
    one go. Partial receiving (receiving some items/quantities before
    others) is not supported yet — the data model (quantity_received
    field) is ready for it, but the UI/logic for partial amounts would
    need to be added later as a separate change.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    try:
        po = PurchaseOrder.objects.get(pk=pk, tenant=tenant)
    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase order not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('status')
    valid_statuses = ['draft', 'ordered', 'received', 'cancelled']
    if new_status not in valid_statuses:
        return Response({'error': f'Status must be one of: {", ".join(valid_statuses)}'}, status=400)

    today = timezone.now().date()

    if new_status == 'ordered' and po.status == 'draft':
        po.status = 'ordered'
        po.order_date = po.order_date or today
        po.save()

    elif new_status == 'received' and po.status == 'ordered':
        from decimal import Decimal

        # Stock add karo har item ke liye — F() expression, atomic,
        # stale-object bug se bachne ke liye (established pattern).
        #
        # Known limitation (being transparent about this): old_qty/old_cost
        # are read in Python before the atomic update below. If two purchase
        # orders for the exact same product were received at the exact same
        # instant, there's a small race window. For a single small-business
        # user receiving orders one at a time, this is not a practical risk,
        # but it's not the same as a fully DB-level atomic read+write.
        for item in po.items.select_related('product'):
            item.quantity_received = item.quantity_ordered
            item.save()

            if item.product_id:
                product = item.product
                old_qty = product.stock_quantity
                old_cost = product.cost_price
                new_qty = item.quantity_ordered
                new_cost = item.unit_cost

                # Weighted Average Cost — standard inventory accounting
                # method (same principle as Odoo's AVCO costing) for when
                # the same item is bought at a different price than before.
                # This uses the base unit_cost only, NOT freight-inclusive
                # landed cost — freight is tracked separately (see
                # freight_charge) and does not affect cost_price, per the
                # scope decision made for this feature.
                if old_qty > 0:
                    weighted_avg_cost = (
                        (Decimal(old_qty) * old_cost) + (Decimal(new_qty) * new_cost)
                    ) / Decimal(old_qty + new_qty)
                else:
                    # No existing stock to average against — avoids
                    # division by zero, new cost becomes the cost outright.
                    weighted_avg_cost = new_cost

                Product.objects.filter(pk=item.product_id).update(
                    stock_quantity=F('stock_quantity') + item.quantity_ordered,
                    cost_price=round(weighted_avg_cost, 2),
                )
                note = (
                    f'Purchase order received — '
                    f'{po.supplier.name if po.supplier else "supplier"} '
                    f'(avg cost updated: {old_cost} → {round(weighted_avg_cost, 2)})'
                    if old_qty > 0 else
                    f'Purchase order received — {po.supplier.name if po.supplier else "supplier"}'
                )
                StockMovement.objects.create(
                    tenant=tenant,
                    product_id=item.product_id,
                    movement_type='in',
                    quantity=item.quantity_ordered,
                    note=note,
                    user=request.user,
                )

        po.status = 'received'
        po.received_date = today
        po.save()

    elif new_status == 'cancelled' and po.status in ['draft', 'ordered']:
        po.status = 'cancelled'
        po.save()

    else:
        return Response({
            'error': f'Cannot change status from "{po.status}" to "{new_status}".'
        }, status=status.HTTP_400_BAD_REQUEST)

    return Response(PurchaseOrderSerializer(po).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def freight_summary(request):
    """
    Total freight/shipping charges for a given month — so the business
    owner can see "how much did shipping cost me this month" at a glance.
    Defaults to the current month if no year/month query params given.
    """
    tenant = get_active_tenant(request)
    if not tenant:
        return Response({'error': 'No active business context.'}, status=400)

    from django.db.models import Sum, Count
    from django.db.models.functions import Coalesce
    from decimal import Decimal

    now = timezone.now()
    try:
        year = int(request.query_params.get('year', now.year))
        month = int(request.query_params.get('month', now.month))
    except ValueError:
        return Response({'error': 'Invalid year/month.'}, status=400)

    # Sirf "received" orders count karte hain — draft/ordered ka freight
    # abhi actual expense nahi hai, sirf estimate hai
    agg = PurchaseOrder.objects.filter(
        tenant=tenant, status='received',
        received_date__year=year, received_date__month=month,
    ).aggregate(
        total_freight=Coalesce(Sum('freight_charge'), Decimal('0.00')),
        order_count=Count('id'),
    )

    return Response({
        'year': year,
        'month': month,
        'total_freight': agg['total_freight'],
        'order_count': agg['order_count'],
    })