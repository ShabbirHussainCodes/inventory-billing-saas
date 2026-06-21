from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(UserAdmin):

    # Admin panel mein kaunse columns dikhenge
    list_display = [
        'email',
        'first_name',
        'last_name',
        'role',
        'tenant',
        'is_active',
        'created_at'
    ]

    # Filter sidebar
    list_filter = [
        'role',
        'is_active',
        'tenant'
    ]

    # Search bar
    search_fields = ['email', 'first_name', 'last_name']

    # Default UserAdmin fields override
    ordering = ['-created_at']

    fieldsets = (
        ('Login Info', {
            'fields': ('email', 'password')
        }),
        ('Personal Info', {
            'fields': (
                'first_name',
                'last_name',
                'phone'
            )
        }),
        ('Role & Tenant', {
            'fields': ('role', 'tenant')
        }),
        ('Permissions', {
            'fields': (
                'is_active',
                'is_staff',
                'is_superuser'
            )
        }),
        ('Important Dates', {
            'fields': ('created_at', 'updated_at')
        }),
    )

    readonly_fields = ['id', 'created_at', 'updated_at']

    add_fieldsets = (
        ('Create New User', {
            'fields': (
                'email',
                'first_name',
                'last_name',
                'password1',
                'password2',
                'role',
                'tenant'
            )
        }),
    )