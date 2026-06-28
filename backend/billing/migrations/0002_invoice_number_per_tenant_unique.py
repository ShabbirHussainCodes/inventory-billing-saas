from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('billing', '0001_initial'),
    ]

    operations = [
        # Step 1: Global unique=True hatao invoice_number se
        migrations.AlterField(
            model_name='invoice',
            name='invoice_number',
            field=models.CharField(max_length=50),
        ),
        # Step 2: Per-tenant unique constraint add karo
        # Ab INV-2026-001 do alag tenants mein ho sakta hai — crash nahi hoga
        migrations.AlterUniqueTogether(
            name='invoice',
            unique_together={('tenant', 'invoice_number')},
        ),
    ]