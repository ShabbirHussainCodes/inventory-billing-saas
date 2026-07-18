from django.urls import path
from . import views, platform_cases

urlpatterns = [
    # Platform Stats
    path('stats/', views.platform_stats, name='admin-stats'),

    # Overview Dashboard
    path('dashboard/', views.dashboard_data, name='admin-dashboard'),

    # Tenant Management
    path('tenants/', views.tenant_list, name='admin-tenants'),
    path('tenants/<uuid:tenant_id>/toggle/', views.toggle_tenant, name='admin-toggle-tenant'),
    path('tenants/<uuid:tenant_id>/grant-access/', views.grant_access, name='admin-grant-access'),
    path('tenants/<uuid:tenant_id>/upgrade/', views.upgrade_tenant, name='admin-upgrade-tenant'),
    path('tenants/<uuid:tenant_id>/reports/', views.tenant_reports, name='admin-tenant-reports'),
    path('tenants/<uuid:tenant_id>/permanent-delete/', views.permanent_delete_tenant, name='admin-permanent-delete-tenant'),
    path('deletion-history/', views.deletion_history, name='admin-deletion-history'),

    # View Business Data (old superadmin endpoints)
    path('tenants/<uuid:tenant_id>/products/', views.tenant_products, name='admin-tenant-products'),
    path('tenants/<uuid:tenant_id>/products/add/', views.add_tenant_product, name='admin-add-product'),
    path('tenants/<uuid:tenant_id>/products/<uuid:product_id>/', views.manage_tenant_product, name='admin-manage-product'),
    path('tenants/<uuid:tenant_id>/invoices/', views.tenant_invoices, name='admin-tenant-invoices'),
    path('tenants/<uuid:tenant_id>/customers/', views.tenant_customers, name='admin-tenant-customers'),

    # User Management
    path('users/', views.user_list, name='admin-users'),
    path('users/<uuid:user_id>/toggle/', views.toggle_user, name='admin-toggle-user'),
    path('users/<uuid:user_id>/reset-password/', views.reset_user_password, name='admin-reset-password'),

    # ── Phase 2 — Founder Support Mode ──
    path('workspace/enter/<uuid:tenant_id>/', views.enter_workspace, name='enter-workspace'),
    path('workspace/exit/', views.exit_workspace, name='exit-workspace'),
    path('workspace/switch-mode/', views.switch_mode, name='switch-mode'),
    path('workspace/session/', views.get_active_session, name='active-session'),

    # ── Audit Log ──
    path('audit-logs/', views.audit_logs, name='audit-logs'),

    # ── Phase 3 Analytics ──
    path('analytics/', views.platform_analytics, name='platform-analytics'),

    # ── Phase B.6 Stage E — Platform Cases ──
    path('platform-cases/', platform_cases.list_platform_cases, name='platform-case-list'),
    path('platform-cases/create/', platform_cases.create_platform_case, name='platform-case-create'),
    path('platform-cases/<uuid:case_id>/', platform_cases.platform_case_detail, name='platform-case-detail'),
    path('platform-cases/<uuid:case_id>/close/', platform_cases.close_platform_case, name='platform-case-close'),
    path('tenants/<uuid:tenant_id>/members-for-case/', platform_cases.tenant_members_for_case, name='tenant-members-for-case'),
]