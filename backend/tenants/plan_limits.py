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
    'basic': {
        'invoices_per_month': None,
        'products':           None,
        'customers':          None,
        'stock_history_days': None,
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


# ─── Feature gates (4-tier restructure) ─────────────────────────────
#
# Count-based limits (invoices/products/customers) stay in PLAN_LIMITS
# above. These two are different shapes of gate:
# - PLAN_FEATURES: simple on/off flags (AI Insights, Team Activity Log,
#   Custom Roles) — either the plan has it or it doesn't, no count.
# - TEAM_MEMBER_LIMITS: a count-limit like PLAN_LIMITS above, but kept
#   separate since it's a teams-app concept, not billing/inventory.
#
# NOTE — Platform Cases and (Founder's) Audit Log are deliberately NOT
# here. Those are Founder-only tools (superadmin app) — no business
# Owner on any plan can ever see them, so they were never a real
# plan-gated customer feature to begin with. Don't add them here.

PLAN_FEATURES = {
    'free': {
        'ai_insights':       False,   # Forecast, Profit Intelligence, Health Score
        'team_activity_log': False,
        'custom_roles':      False,   # Custom Roles + Permission Editor
    },
    'basic': {
        'ai_insights':       False,
        'team_activity_log': False,
        'custom_roles':      False,
    },
    'pro': {
        'ai_insights':       True,
        'team_activity_log': True,
        'custom_roles':      False,   # Enterprise-only, deliberately not here
    },
    'enterprise': {
        'ai_insights':       True,
        'team_activity_log': True,
        'custom_roles':      True,
    },
    'admin_grant': {
        'ai_insights':       True,
        'team_activity_log': True,
        'custom_roles':      True,
    },
}

TEAM_MEMBER_LIMITS = {
    'free':        1,   # Just the founding Owner — no invites possible
    'basic':       2,   # Owner + 1
    'pro':         None,
    'enterprise':  None,
    'admin_grant': None,
}


def has_feature(tenant, feature):
    """
    Tenant object + feature name do ('ai_insights', 'team_activity_log',
    'custom_roles'), bool milega. Unknown plan → free ke defaults
    (sabse restrictive, safe default — jaisa get_limits() karta hai).
    """
    return PLAN_FEATURES.get(tenant.access_type, PLAN_FEATURES['free']).get(feature, False)


def get_team_member_limit(tenant):
    """None = unlimited."""
    return TEAM_MEMBER_LIMITS.get(tenant.access_type, TEAM_MEMBER_LIMITS['free'])