from django.contrib import admin
from .models import Tenant


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):

    # Admin panel mein kaunse columns dikhenge
    list_display = [
        'name',
        'country',
        'currency',
        'tax_label',
        'access_type',
        'is_active',
        'created_at'
    ]

    # Filter sidebar
    list_filter = [
        'access_type',
        'is_active',
        'country',
        'currency'
    ]

    # Search bar
    search_fields = ['name', 'subdomain']

    # Click karke edit karne pe kya dikhega
    readonly_fields = ['id', 'created_at', 'updated_at']