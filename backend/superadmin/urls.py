from django.urls import path
from . import views

urlpatterns = [
    # Platform Stats
    path('stats/', views.platform_stats, name='admin-stats'),

    # Overview Dashboard (Needs Attention + Trend + Activity)
    path('dashboard/', views.dashboard_data, name='admin-dashboard'),

    # Tenant Management
    path('tenants/', views.tenant_list, name='admin-tenants'),
    path('tenants/<uuid:tenant_id>/toggle/', views.toggle_tenant, name='admin-toggle-tenant'),
    path('tenants/<uuid:tenant_id>/grant-access/', views.grant_access, name='admin-grant-access'),
    path('tenants/<uuid:tenant_id>/upgrade/', views.upgrade_tenant, name='admin-upgrade-tenant'),
    path('tenants/<uuid:tenant_id>/reports/', views.tenant_reports, name='admin-tenant-reports'),

    # View Business Data
    path('tenants/<uuid:tenant_id>/products/', views.tenant_products, name='admin-tenant-products'),
    path('tenants/<uuid:tenant_id>/products/add/', views.add_tenant_product, name='admin-add-product'),
    path('tenants/<uuid:tenant_id>/products/<uuid:product_id>/', views.manage_tenant_product, name='admin-manage-product'),
    path('tenants/<uuid:tenant_id>/invoices/', views.tenant_invoices, name='admin-tenant-invoices'),
    path('tenants/<uuid:tenant_id>/customers/', views.tenant_customers, name='admin-tenant-customers'),

    # User Management
    path('users/', views.user_list, name='admin-users'),
    path('users/<uuid:user_id>/toggle/', views.toggle_user, name='admin-toggle-user'),
    path('users/<uuid:user_id>/reset-password/', views.reset_user_password, name='admin-reset-password'),
]