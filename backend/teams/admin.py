from django.contrib import admin
from .models import Role, Permission, RolePermission, Membership, ActivityLog, LoginEvent


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ['name', 'tenant', 'is_system_role', 'created_at']
    list_filter = ['is_system_role']
    search_fields = ['name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ['codename', 'category', 'label']
    list_filter = ['category']
    search_fields = ['codename', 'label']


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ['role', 'permission']
    list_filter = ['role']


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ['invite_email', 'user', 'tenant', 'role', 'status', 'created_at']
    list_filter = ['status', 'role']
    search_fields = ['invite_email', 'user__email', 'tenant__name']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ['actor', 'action', 'tenant', 'created_at']
    list_filter = ['action']
    search_fields = ['actor__email', 'tenant__name', 'target_name']
    readonly_fields = ['id', 'created_at']


@admin.register(LoginEvent)
class LoginEventAdmin(admin.ModelAdmin):
    list_display = ['user', 'tenant', 'success', 'ip_address', 'created_at']
    list_filter = ['success']
    search_fields = ['user__email']
    readonly_fields = ['id', 'created_at']
