# Phase B.6 Stage 1 — backfill is_primary_owner for every EXISTING tenant.
#
# For each tenant, the earliest-created active Membership with role='Owner'
# becomes the Primary Owner. "Earliest-created" is used as the best
# available proxy for "the founding Owner" since no such marker existed
# before this migration — for the overwhelming majority of tenants there's
# only one active Owner anyway, so this is unambiguous. For tenants that
# already have multiple co-Owners, this picks the one who's been an Owner
# the longest, which is a reasonable, defensible default (matches "whoever
# was here first"). Tenants with zero active Owners (shouldn't exist, given
# the invite/registration flow always creates one, but handled defensively)
# are simply skipped — no primary is force-created out of nothing.

from django.db import migrations


def backfill_primary_owners(apps, schema_editor):
    Tenant = apps.get_model('tenants', 'Tenant')
    Membership = apps.get_model('teams', 'Membership')

    for tenant in Tenant.objects.all():
        already_primary = Membership.objects.filter(tenant=tenant, is_primary_owner=True).exists()
        if already_primary:
            continue

        founding_owner = (
            Membership.objects
            .filter(tenant=tenant, status='active', role__name='Owner')
            .order_by('created_at')
            .first()
        )
        if founding_owner:
            founding_owner.is_primary_owner = True
            founding_owner.save(update_fields=['is_primary_owner'])


def noop_reverse(apps, schema_editor):
    # Reversible in spirit (clears the flag) but not required — deliberately
    # left as a no-op since un-setting Primary Owner has no safe automatic
    # meaning. If this migration is ever rolled back, is_primary_owner rows
    # simply stay set; the field itself gets dropped by the previous
    # migration's reversal anyway.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('teams', '0009_membership_is_primary_owner_and_more'),
    ]

    operations = [
        migrations.RunPython(backfill_primary_owners, noop_reverse),
    ]
