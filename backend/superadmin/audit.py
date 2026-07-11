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

    Phase B.5 — "View As Member" (Founder side): AuditLog mein
    Team ActivityLog jaisa dedicated viewed_as_membership FK column
    nahi hai (schema change avoid kiya gaya — yeh case rare hai,
    Founder View-As sirf tabhi possible hai jab woh already ek
    SupportSession ke andar ho). Iski jagah, agar Founder ka active
    ViewAsSession hai, details JSON mein 'viewed_as' key add ho jaati
    hai — details field already isi tarah ke extensible use ke liye
    design kiya gaya tha. Real actor (request.user, Founder) yahan
    bhi kabhi overwrite nahi hota.
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

        details = dict(details or {})
        try:
            from teams.models import ViewAsSession
            active_view_as = (
                ViewAsSession.objects
                .filter(initiator=request.user, is_active=True)
                .select_related('target_membership', 'target_membership__user', 'target_membership__role')
                .first()
            )
            if active_view_as:
                vam = active_view_as.target_membership
                details['viewed_as'] = {
                    'membership_id': str(vam.id),
                    'name': (vam.user.first_name if vam.user else vam.invite_email) or vam.invite_email,
                    'role_name': vam.role.name,
                }
        except Exception:
            pass

        from superadmin.models import AuditLog
        AuditLog.objects.create(
            actor=request.user,
            tenant=tenant,
            action=action,
            target_type=target_type,
            target_name=target_name,
            details=details,
            is_support_action=True,
        )

    except Exception:
        # Logging fail hone pe main request kabhi fail nahi hogi
        pass