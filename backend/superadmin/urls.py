from django.urls import path
from . import views

urlpatterns = [
    # Platform Stats
    path('stats/', views.platform_stats, name='admin-stats'),

    # Tenant Management
    path('tenants/', views.tenant_list, name='admin-tenants'),
    path('tenants/<uuid:tenant_id>/toggle/', views.toggle_tenant, name='admin-toggle-tenant'),
    path('tenants/<uuid:tenant_id>/grant-access/', views.grant_access, name='admin-grant-access'),

    # User Management
    path('users/', views.user_list, name='admin-users'),
    path('users/<uuid:user_id>/toggle/', views.toggle_user, name='admin-toggle-user'),
]