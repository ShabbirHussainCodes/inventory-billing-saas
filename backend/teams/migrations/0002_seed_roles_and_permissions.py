from django.db import migrations


# 5 system roles — plan mein finalize hue naam
SYSTEM_ROLES = [
    ('Owner', 'Poora access, delete nahi ho sakta, kam se kam ek Owner hamesha zaroori hai.'),
    ('Manager', 'Zyadatar cheezein manage kar sakta hai.'),
    ('Sales Staff', 'Invoice, estimate, customer se related kaam.'),
    ('Accountant', 'Reports, profit, payment related kaam.'),
    ('Viewer', 'Sirf dekh sakta hai, kuch edit nahi kar sakta.'),
]

# Permission catalog — actual existing modules/endpoints (billing/urls.py,
# inventory/urls.py) ke basis par banaya gaya hai, guess nahi kiya gaya.
PERMISSIONS = [
    # (codename, category, label)
    ('invoice.view',              'Billing',   'View Invoices'),
    ('invoice.create',            'Billing',   'Create Invoice'),
    ('invoice.edit',               'Billing',   'Edit Invoice'),
    ('invoice.delete',             'Billing',   'Delete Invoice'),
    ('invoice.change_status',      'Billing',   'Change Invoice Status'),
    ('billing.close_day',          'Billing',   'Close Day'),
    ('billing.view_cashflow',      'Billing',   'View Cashflow Summary'),
    ('billing.view_business_brief', 'Billing',  'View Business Brief / Decision Engine'),

    ('estimate.view',              'Estimates', 'View Estimates'),
    ('estimate.create',            'Estimates', 'Create Estimate'),
    ('estimate.edit',               'Estimates', 'Edit Estimate'),
    ('estimate.change_status',      'Estimates', 'Change Estimate Status'),
    ('estimate.convert',            'Estimates', 'Convert Estimate to Invoice'),

    ('customer.view',              'Customers', 'View Customers'),
    ('customer.create',            'Customers', 'Create Customer'),
    ('customer.edit',               'Customers', 'Edit Customer'),
    ('customer.delete',             'Customers', 'Delete Customer'),

    ('product.view',               'Inventory', 'View Products'),
    ('product.create',             'Inventory', 'Create Product'),
    ('product.edit',                'Inventory', 'Edit Product'),
    ('product.delete',              'Inventory', 'Delete Product'),
    ('category.manage',             'Inventory', 'Manage Categories'),
    ('supplier.manage',             'Inventory', 'Manage Suppliers'),
    ('stock.manage',                'Inventory', 'Add Stock Movement'),
    ('stock.view_history',          'Inventory', 'View Stock History'),

    ('purchase_order.view',        'Purchase Orders', 'View Purchase Orders'),
    ('purchase_order.create',      'Purchase Orders', 'Create Purchase Order'),
    ('purchase_order.edit',         'Purchase Orders', 'Edit Purchase Order'),
    ('purchase_order.change_status', 'Purchase Orders', 'Change Purchase Order Status'),

    ('expense.view',                'Reports & Intelligence', 'View Expenses'),
    ('expense.create',              'Reports & Intelligence', 'Create Expense'),
    ('expense.edit',                 'Reports & Intelligence', 'Edit Expense'),
    ('expense.delete',               'Reports & Intelligence', 'Delete Expense'),
    ('profit_intelligence.view',    'Reports & Intelligence', 'View Profit Intelligence'),
    ('health_score.view',           'Reports & Intelligence', 'View Business Health Score'),
    ('forecast.view',               'Reports & Intelligence', 'View Demand Forecasts'),
    ('forecast.generate',           'Reports & Intelligence', 'Generate Demand Forecasts'),

    ('team.manage',                 'Team', 'Invite / Suspend / Remove Members, Change Roles'),
    ('team.view_activity',          'Team', 'View Team Activity Log'),
    ('role.manage_custom',          'Team', 'Create / Edit / Delete Custom Roles (Pro/Enterprise)'),
]


def seed_roles_and_permissions(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    RolePermission = apps.get_model('teams', 'RolePermission')

    roles_by_name = {}
    for name, description in SYSTEM_ROLES:
        role, _ = Role.objects.get_or_create(
            name=name, tenant=None,
            defaults={'is_system_role': True, 'description': description}
        )
        roles_by_name[name] = role

    permissions = []
    for codename, category, label in PERMISSIONS:
        perm, _ = Permission.objects.get_or_create(
            codename=codename,
            defaults={'category': category, 'label': label}
        )
        permissions.append(perm)

    # Owner => sab kuch (plan explicitly says "Owner - sab kuch").
    # Manager / Sales Staff / Accountant / Viewer ke liye exact permission
    # mapping is session mein decide NAHI ki gayi (plan mein explicitly
    # flagged: "Role-permission exact mapping abhi decide nahi") — is liye
    # yahan koi permission assign nahi ki gayi, taaki galat guess na ho.
    # Owner ke alawa baaki 4 roles filhaal "no access" state mein hain jab
    # tak mapping user ke saath decide na ho jaaye.
    owner_role = roles_by_name['Owner']
    for perm in permissions:
        RolePermission.objects.get_or_create(role=owner_role, permission=perm)


def unseed_roles_and_permissions(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    Role.objects.filter(tenant=None, name__in=[n for n, _ in SYSTEM_ROLES]).delete()
    Permission.objects.filter(codename__in=[c for c, _, _ in PERMISSIONS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_roles_and_permissions, unseed_roles_and_permissions),
    ]
