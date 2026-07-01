# BillingMars — Plan Limits
# Yeh single source of truth hai — sirf yahan change karo,
# poore system mein automatically reflect hoga.
# None = unlimited

PLAN_LIMITS = {
    'free': {
        'invoices_per_month': 10,
        'products':           20,
        'customers':          25,
        'stock_history_days': 30,    # kitne purane movements dikhenge
    },
    'pro': {
        'invoices_per_month': None,
        'products':           None,
        'customers':          None,
        'stock_history_days': None,
    },
    'enterprise': {
        'invoices_per_month': None,
        'products':           None,
        'customers':          None,
        'stock_history_days': None,
    },
    'admin_grant': {
        'invoices_per_month': None,
        'products':           None,
        'customers':          None,
        'stock_history_days': None,
    },
}


def get_limits(tenant):
    """
    Tenant object do, uske plan ke limits wapas milenge.
    Agar unknown plan hai toh free limits apply honge (safe default).
    """
    return PLAN_LIMITS.get(tenant.access_type, PLAN_LIMITS['free'])


def is_within_limit(tenant, resource, current_count):
    """
    Check karo ki tenant ne apni limit cross ki ya nahi.
    resource = 'products', 'customers', 'invoices_per_month'
    current_count = DB se fetch ki gayi current count
    Returns: (allowed: bool, limit: int or None)
    """
    limits = get_limits(tenant)
    limit = limits.get(resource)

    if limit is None:
        return True, None   # Unlimited

    return current_count < limit, limit