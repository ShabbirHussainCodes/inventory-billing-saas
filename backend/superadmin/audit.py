"""
BillingMars — Audit Logging Utility

log_action() — poore project mein ek hi function call se audit log banta hai.

Design principles:
- Silent failures — logging kabhi bhi main request fail nahi karega
- Founder-only abhi — normal user actions Phase 4/5 mein
- Extensible details — JSONField se future mein koi bhi data add ho sakta hai

Usage:
    from superadmin.audit import log_action

    log_action(
        request,
        action='product_created',
        tenant=tenant,              # optional — agar None hai toh get_active_tenant se
        target_type='product',
        target_name=product.name,
        details={'sku': product.sku}
    )
"""


def log_action(
    request,
    action,
    tenant=None,
    target_type='',
    target_name='',
    details=None,
):
    """
    Ek founder action ko AuditLog mein record karo.

    Sirf super_admin ke actions log hote hain abhi.
    Exception raise nahi hogi — logging always silent fails.
    """
    try:
        # Sirf founder actions log karo abhi
        if request.user.role != 'super_admin':
            return

        # Tenant resolve karo
        if tenant is None:
            from superadmin.utils import get_active_tenant
            tenant = get_active_tenant(request)

        if tenant is None:
            return  # Tenant ke bina log nahi ho sakta

        from superadmin.models import AuditLog
        AuditLog.objects.create(
            actor=request.user,
            tenant=tenant,
            action=action,
            target_type=target_type,
            target_name=target_name,
            details=details or {},
            is_support_action=True,
        )

    except Exception:
        # Logging fail hone pe main request kabhi fail nahi hogi
        pass