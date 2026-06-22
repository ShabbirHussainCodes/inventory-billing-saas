from django.contrib import admin
from .models import Category, Supplier, Product, StockMovement


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'is_active', 'created_at']
    list_filter = ['is_active', 'tenant']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at']


@admin.register(Supplier)
class SupplierAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'email', 'phone', 'country', 'is_active']
    list_filter = ['is_active', 'tenant', 'country']
    search_fields = ['name', 'email', 'phone']
    readonly_fields = ['id', 'created_at']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'tenant',
        'category',
        'supplier',
        'cost_price',
        'selling_price',
        'stock_quantity',
        'is_low_stock',
        'profit_margin',
        'is_active'
    ]
    list_filter = ['is_active', 'tenant', 'category']
    search_fields = ['name', 'sku', 'barcode']
    readonly_fields = [
        'id',
        'profit_margin',
        'is_low_stock',
        'created_at',
        'updated_at'
    ]

    fieldsets = (
        ('Basic Info', {
            'fields': ('tenant', 'name', 'sku', 'barcode', 'description')
        }),
        ('Category & Supplier', {
            'fields': ('category', 'supplier')
        }),
        ('Pricing', {
            'fields': (
                'cost_price',
                'selling_price',
                'profit_margin'
            )
        }),
        ('Stock', {
            'fields': ('stock_quantity', 'reorder_point', 'is_low_stock')
        }),
        ('Tax', {
            'fields': ('tax_rate', 'hsn_code')
        }),
        ('Status', {
            'fields': ('is_active', 'created_at', 'updated_at')
        }),
    )


@admin.register(StockMovement)
class StockMovementAdmin(admin.ModelAdmin):
    list_display = [
        'product',
        'tenant',
        'movement_type',
        'quantity',
        'user',
        'created_at'
    ]
    list_filter = ['movement_type', 'tenant']
    search_fields = ['product__name']
    readonly_fields = ['id', 'created_at']