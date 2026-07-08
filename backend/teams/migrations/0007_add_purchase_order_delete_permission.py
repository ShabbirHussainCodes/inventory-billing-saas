from django.db import migrations


def add_po_delete(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    RolePermission = apps.get_model('teams', 'RolePermission')

    perm, _ = Permission.objects.get_or_create(
        codename='purchase_order.delete',
        defaults={'category': 'Purchase Orders', 'label': 'Delete Purchase Order'}
    )

    # Owner aur Manager hi — same pattern as invoice.delete/estimate.delete
    # (0006): destructive actions sirf Owner/Manager ke paas, Sales Staff
    # aur Accountant ko draft POs delete karne ki permission nahi.
    # Gap found while mapping inventory/views.py — purchase_order_detail
    # ka DELETE method original 0002 catalog mein miss ho gaya tha
    # (sirf view/create/edit/change_status the).
    for role_name in ['Owner', 'Manager']:
        role = Role.objects.get(name=role_name, tenant=None)
        RolePermission.objects.get_or_create(role=role, permission=perm)


def remove_po_delete(apps, schema_editor):
    Permission = apps.get_model('teams', 'Permission')
    Permission.objects.filter(codename='purchase_order.delete').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0006_add_estimate_delete_permission'),
    ]

    operations = [
        migrations.RunPython(add_po_delete, remove_po_delete),
    ]
