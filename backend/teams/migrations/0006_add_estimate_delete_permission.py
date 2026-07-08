from django.db import migrations


def add_estimate_delete(apps, schema_editor):
    Role = apps.get_model('teams', 'Role')
    Permission = apps.get_model('teams', 'Permission')
    RolePermission = apps.get_model('teams', 'RolePermission')

    perm, _ = Permission.objects.get_or_create(
        codename='estimate.delete',
        defaults={'category': 'Estimates', 'label': 'Delete Estimate'}
    )

    # Owner aur Manager hi — Sales Staff ko estimate.delete nahi diya gaya,
    # consistent with invoice.delete/customer.delete already excluded
    # for that role (no destructive actions for Sales Staff).
    for role_name in ['Owner', 'Manager']:
        role = Role.objects.get(name=role_name, tenant=None)
        RolePermission.objects.get_or_create(role=role, permission=perm)


def remove_estimate_delete(apps, schema_editor):
    Permission = apps.get_model('teams', 'Permission')
    Permission.objects.filter(codename='estimate.delete').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0005_business_settings_perms_and_role_matrix'),
    ]

    operations = [
        migrations.RunPython(add_estimate_delete, remove_estimate_delete),
    ]
