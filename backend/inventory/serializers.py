from rest_framework import serializers
from .models import Category, Supplier, Product, StockMovement, PurchaseOrder, PurchaseOrderItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = [
            'id',
            'name',
            'description',
            'is_active',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = [
            'id',
            'name',
            'email',
            'phone',
            'address',
            'country',
            'is_active',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class ProductSerializer(serializers.ModelSerializer):

    # Yeh extra fields automatically calculate honge
    profit_margin = serializers.ReadOnlyField()
    is_low_stock = serializers.ReadOnlyField()
    # SerializerMethodField — safe whether the queryset is annotated
    # (product_list) or not (product_detail). getattr avoids AttributeError.
    incoming_quantity = serializers.SerializerMethodField()

    def get_incoming_quantity(self, obj):
        return getattr(obj, 'incoming_quantity', None)

    # Category aur Supplier ka naam dikhega — sirf ID nahi
    category_name = serializers.CharField(
        source='category.name',
        read_only=True
    )
    supplier_name = serializers.CharField(
        source='supplier.name',
        read_only=True
    )

    class Meta:
        model = Product
        fields = [
            'id',
            'name',
            'sku',
            'description',
            'barcode',
            'category',
            'category_name',
            'supplier',
            'supplier_name',
            'cost_price',
            'selling_price',
            'profit_margin',
            'stock_quantity',
            'reorder_point',
            'volume_cbm',
            'units_per_box',
            'incoming_quantity',
            'is_low_stock',
            'tax_rate',
            'hsn_code',
            'is_active',
            'created_at',
            'updated_at'
        ]
        read_only_fields = [
            'id',
            'profit_margin',
            'is_low_stock',
            'created_at',
            'updated_at'
        ]


class StockMovementSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(
        source='product.name',
        read_only=True
    )

    class Meta:
        model = StockMovement
        fields = [
            'id',
            'product',
            'product_name',
            'movement_type',
            'quantity',
            'note',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at']

class PurchaseOrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    volume_cbm = serializers.DecimalField(
        source='product.volume_cbm', max_digits=10, decimal_places=4,
        read_only=True, allow_null=True
    )
    units_per_box = serializers.IntegerField(
        source='product.units_per_box', read_only=True, default=1
    )

    class Meta:
        model = PurchaseOrderItem
        fields = [
            'id', 'product', 'product_name',
            'quantity_ordered', 'quantity_received',
            'unit_cost', 'volume_cbm', 'volume_cbm_override',
            'units_per_box', 'units_per_box_override',
        ]
        read_only_fields = ['id', 'quantity_received']


class PurchaseOrderSerializer(serializers.ModelSerializer):
    items = PurchaseOrderItemSerializer(many=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    # Computed — per-item freight share + landed unit cost. Kept as a
    # separate computed field (not merged into each item) so the core
    # PurchaseOrderItem data stays simple; frontend matches by item id.
    freight_allocation = serializers.SerializerMethodField()

    class Meta:
        model = PurchaseOrder
        fields = [
            'id', 'supplier', 'supplier_name', 'status',
            'order_date', 'expected_date', 'received_date',
            'freight_charge', 'freight_split_method', 'freight_allocation',
            'notes', 'items', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'received_date', 'created_at', 'updated_at']

    def get_freight_allocation(self, obj):
        from decimal import Decimal
        allocation = obj.get_freight_allocation()
        result = []
        for item in obj.items.all():
            # Bug fix: must use Decimal('0'), not plain int 0 — dividing
            # int 0 by quantity_ordered produces a Python float (0.0),
            # and Decimal + float raises TypeError. This caused a 500
            # error on every purchase order without freight_charge set
            # (i.e. almost all of them, since freight is optional).
            allocated = allocation.get(item.id, Decimal('0'))
            landed_unit_cost = item.unit_cost + (
                allocated / item.quantity_ordered if item.quantity_ordered else Decimal('0')
            )
            result.append({
                'item_id': str(item.id),
                'allocated_freight': str(round(allocated, 2)) if allocated else '0.00',
                'landed_unit_cost': str(round(landed_unit_cost, 2)),
            })
        return result

    def validate(self, attrs):
        # Tenant isolation — supplier aur har product is tenant ka hona chahiye
        tenant = self.context['tenant']

        supplier = attrs.get('supplier')
        if supplier and supplier.tenant != tenant:
            raise serializers.ValidationError({'supplier': 'Invalid supplier.'})

        items = attrs.get('items', [])
        if not items:
            raise serializers.ValidationError({'items': 'At least one item is required.'})

        for i, item in enumerate(items):
            product = item.get('product')
            if product and product.tenant != tenant:
                raise serializers.ValidationError({'items': f'Invalid product in item {i + 1}.'})

        return attrs

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        tenant = self.context['tenant']

        purchase_order = PurchaseOrder.objects.create(tenant=tenant, **validated_data)

        for item_data in items_data:
            product = item_data.get('product')
            PurchaseOrderItem.objects.create(
                purchase_order=purchase_order,
                product=product,
                product_name=product.name if product else 'Unknown product',
                quantity_ordered=item_data['quantity_ordered'],
                unit_cost=item_data['unit_cost'],
                volume_cbm_override=item_data.get('volume_cbm_override'),
                units_per_box_override=item_data.get('units_per_box_override'),
            )

        return purchase_order