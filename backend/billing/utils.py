from django.utils import timezone


def generate_invoice_number(tenant):
    from .models import Invoice

    # Current year lo
    year = timezone.now().year

    # Is tenant ke is saal ke invoices count karo
    count = Invoice.objects.filter(
        tenant=tenant,
        invoice_date__year=year
    ).count()

    # Next number = count + 1
    next_number = count + 1

    # Format karo — 001, 002, 003
    formatted_number = str(next_number).zfill(3)

    # Final invoice number
    return f"INV-{year}-{formatted_number}"


def generate_estimate_number(tenant):
    from .models import Estimate

    year = timezone.now().year

    count = Estimate.objects.filter(
        tenant=tenant,
        estimate_date__year=year
    ).count()

    next_number = count + 1
    formatted_number = str(next_number).zfill(3)

    return f"EST-{year}-{formatted_number}"