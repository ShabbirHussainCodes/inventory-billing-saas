from django.db import migrations


def migrate_existing_users(apps, schema_editor):
    """
    Existing CustomUser rows ko Membership records mein convert karta hai.

    Verified against real production data before writing this (2026-07-07):
        business_owner: 2, super_admin: 1, staff: 0

    Rules:
    - super_admin (Founder) users ko koi Membership NAHI milti — unka
      access SupportSession se hi chalta hai, jaisa plan mein already
      decide hua tha ("Founder ka access is poore system se completely
      alag, untouched rahega").
    - business_owner -> Role 'Owner'
    - koi bhi aur/unexpected role value (abhi koi nahi hai, but future
      safety ke liye) -> Role 'Viewer' (sabse restrictive, safe default)
      — aur is case mein ek print statement chalega taaki tum manually
      review kar sako, guess nahi kiya ja raha silently.
    - Idempotent hai (get_or_create) — dobara chalane se duplicate rows
      nahi banenge.
    - Har row ko invite_token='migrated:<user_id>' diya gaya hai, taaki
      reverse migration sirf inhi rows ko safely delete kare, kisi
      future manual invite ko touch na kare.
    """
    CustomUser = apps.get_model('users', 'CustomUser')
    Role = apps.get_model('teams', 'Role')
    Membership = apps.get_model('teams', 'Membership')

    owner_role = Role.objects.get(name='Owner', tenant=None)
    viewer_role = Role.objects.get(name='Viewer', tenant=None)

    converted = 0
    fallback_used = 0
    skipped_no_tenant = 0

    for user in CustomUser.objects.exclude(role='super_admin'):
        if not user.tenant_id:
            # Defensive — shouldn't happen given the registration flow,
            # but a business_owner/staff row without a tenant can't get
            # a Membership (tenant is required on Membership).
            skipped_no_tenant += 1
            print(f"[teams migration] SKIPPED (no tenant): {user.email}")
            continue

        if user.role == 'business_owner':
            role = owner_role
        else:
            role = viewer_role
            fallback_used += 1
            print(f"[teams migration] Unexpected role '{user.role}' for {user.email} -> defaulted to Viewer, please review manually.")

        _, created = Membership.objects.get_or_create(
            user=user,
            tenant=user.tenant,
            defaults={
                'role': role,
                'status': 'active',
                'invite_email': user.email,
                'invite_token': f'migrated:{user.id}',
                'joined_at': user.created_at,
            }
        )
        if created:
            converted += 1

    print(f"[teams migration] Done. Converted={converted}, Viewer-fallback={fallback_used}, skipped(no tenant)={skipped_no_tenant}")


def reverse_migrate_existing_users(apps, schema_editor):
    Membership = apps.get_model('teams', 'Membership')
    deleted, _ = Membership.objects.filter(invite_token__startswith='migrated:').delete()
    print(f"[teams migration] Reversed. Deleted {deleted} membership row(s) created by this migration.")


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0002_seed_roles_and_permissions'),
        ('users', '0002_customuser_users_custo_tenant__29ab49_idx_and_more'),
    ]

    operations = [
        migrations.RunPython(migrate_existing_users, reverse_migrate_existing_users),
    ]
