from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import Category, Supplier, Product, StockMovement
from .serializers import (
    CategorySerializer,
    SupplierSerializer,
    ProductSerializer,
    StockMovementSerializer
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
        products = Product.objects.filter(
            tenant=tenant,
            is_active=True
        )
        serializer = ProductSerializer(products, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        serializer = ProductSerializer(data=request.data)
        if serializer.is_valid():
            product = serializer.save(tenant=tenant)
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
        serializer = ProductSerializer(
            product,
            data=request.data,
            partial=True
        )
        if serializer.is_valid():
            serializer.save()
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