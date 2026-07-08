from django.db import migrations


# Naye permissions — 'Business Settings' category pehle exist nahi karta
# tha (tenants/views.py ka business_settings view abhi tak KOI permission
# check nahi karta tha). customer.edit_basic — Sales Staff ke liye field-level
# restricted customer edit (sirf Basic Info: name/email/phone/address,
# NAHI: tax_number/country — jo Customer model mein pehle se hi "Business
# Info" ke roop mein comment kiya hua tha).
NEW_PERMISSIONS = [
    ('tenant.view_settings',   'Business Settings', 'View Business Settings'),
    ('tenant.manage_settings', 'Business Settings', 'Edit Business Settings'),
    ('customer.edit_basic',    'Customers',          'Edit Customer (Basic Info Only)'),
]

# Role -> permission codenames. Owner ke liye sirf naye 3 permissions add
# honge (baaki 40 already 0002 mein assign ho chuke hain — RunPython
# idempotent hai, get_or_create use hota hai, dobara chalane se duplicate
# nahi banega).
OWNER_NEW_PERMS = [
    'tenant.view_settings', 'tenant.manage_settings', 'customer.edit_basic',
]

MANAGER_PERMS = [
    'invoice.view', 'invoice.create', 'invoice.edit', 'invoice.delete', 'invoice.change_status',
    'billing.close_day', 'billing.view_cashflow', 'billing.view_business_brief',
    'estimate.view', 'estimate.create', 'estimate.edit', 'estimate.change_status', 'estimate.convert',
    'customer.view', 'customer.create', 'customer.edit', 'customer.delete',
    'product.view', 'product.create', 'product.edit', 'product.delete',
    'category.manage', 'supplier.manage', 'stock.manage', 'stock.view_history',
    'purchase_order.view', 'purchase_order.create', 'purchase_order.edit', 'purchase_order.change_status',
    'expense.view', 'expense.create', 'expense.edit', 'expense.delete',
    'profit_intelligence.view', 'health_score.view', 'forecast.view', 'forecast.generate',
    'team.view_activity',
    # Deliberately excluded: team.manage, role.manage_custom,
    # tenant.view_settings, tenant.manage_settings
]

SALES_STAFF_PERMS = [
    'invoice.view', 'invoice.create', 'invoice.edit', 'invoice.change_status',
    'estimate.view', 'estimate.create', 'estimate.edit', 'estimate.change_status', 'estimate.convert',
    'customer.view', 'customer.create', 'customer.edit_basic',
    'product.view',
    # Deliberately excluded: invoice.delete, customer.edit (full), customer.delete
]

ACCOUNTANT_PERMS = [
    'invoice.view', 'invoice.change_status',
    'billing.close_day', 'billing.view_cashflow', 'billing.view_business_brief',
    'expense.view', 'expense.create', 'expense.edit', 'expense.delete',
    'profit_intelligence.view', 'health_score.view', 'forecast.view',
    'purchase_order.view',
    'customer.view',
    # Deliberately excluded: purchase_order.create, all inventory management, forecast.generate
]

VIEWER_PERMS = [
    'invoice.view', 'estimate.view', 'customer.view', 'product.view', 'stock.view_history',
    'purchase_order.view', 'expense.view', 'profit_intelligence.view', 'health_score.view',
    'forecast.view', 'billing.view_cashflow', 'billing.view_business_brief', 'tenant.view_settings',
    # NOTE: team.view_activity deliberately NOT included for Viewer — only
    # Manager was explicitly asked for this, treating team activity as an
    # internal-staff-oversight permission rather than a general "view" one.
    # Flag this to the user if that assumption is wrong.
]


def seed_new_permissions_and_matrix(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    RolePermission = apps.get_model('teams', 'RolePermission')

    for codename, category, label in NEW_PERMISSIONS:
        Permission.objects.get_or_create(
            codename=codename, defaults={'category': category, 'label': label}
        )

    def assign(role_name, codenames):
        role = Role.objects.get(name=role_name, tenant=None)
        for codename in codenames:
            perm = Permission.objects.get(codename=codename)
            RolePermission.objects.get_or_create(role=role, permission=perm)

    assign('Owner', OWNER_NEW_PERMS)
    assign('Manager', MANAGER_PERMS)
    assign('Sales Staff', SALES_STAFF_PERMS)
    assign('Accountant', ACCOUNTANT_PERMS)
    assign('Viewer', VIEWER_PERMS)


def unseed_new_permissions_and_matrix(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    RolePermission = apps.get_model('teams', 'RolePermission')

    # Manager/Sales Staff/Accountant/Viewer RolePermission rows hata do
    # (Owner ke naye 3 bhi, but Owner ki role khud delete nahi hoti)
    for role_name in ['Owner', 'Manager', 'Sales Staff', 'Accountant', 'Viewer']:
        role = Role.objects.filter(name=role_name, tenant=None).first()
        if role:
            RolePermission.objects.filter(role=role).delete()

    Permission.objects.filter(codename__in=[c for c, _, _ in NEW_PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0004_pendinglogintoken'),
    ]

    operations = [
        migrations.RunPython(seed_new_permissions_and_matrix, unseed_new_permissions_and_matrix),
    ]
