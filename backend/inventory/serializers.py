from rest_framework import serializers
from .models import Category, Supplier, Product, StockMovement


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