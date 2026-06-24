from django.contrib import admin
from .models import Customer, Invoice, InvoiceItem


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = [
        'name',
        'tenant',
        'email',
        'phone',
        'country',
        'is_active',
        'created_at'
    ]
    list_filter = ['is_active', 'tenant', 'country']
    search_fields = ['name', 'email', 'phone', 'tax_number']
    readonly_fields = ['id', 'created_at', 'updated_at']


class InvoiceItemInline(admin.TabularInline):
    model = InvoiceItem
    extra = 0
    readonly_fields = [
        'id',
        'subtotal',
        'tax_amount',
        'total',
        'profit'
    ]


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = [
        'invoice_number',
        'tenant',
        'customer',
        'total_amount',
        'tax_label',
        'currency',
        'status',
        'invoice_date',
        'created_at'
    ]
    list_filter = [
        'status',
        'tenant',
        'currency',
        'tax_label'
    ]
    search_fields = [
        'invoice_number',
        'customer__name'
    ]
    readonly_fields = [
        'id',
        'subtotal',
        'tax_amount',
        'total_amount',
        'total_profit',
        'created_at',
        'updated_at'
    ]
    inlines = [InvoiceItemInline]