"""
BillingMars — Team Activity Logging Utility

log_team_activity() — superadmin/audit.py ke log_action() ka exact
mirror, staff-side ke liye. Dono functions jaanbujh kar same call sites
pe, same action names ke saath, side-by-side call hote hain:

    log_action(request, 'product_created', ...)        # Founder-only, no-op for staff
    log_team_activity(request, 'product_created', ...)  # Staff-only, no-op for Founder

Design principles (log_action.py se copy kiye gaye, deliberately):
- Silent failures — logging kabhi bhi main request fail nahi karega
- Founder actions yahan LOG NAHI hote — woh AuditLog (superadmin app) mein
  jaate hain, is se double-logging nahi hoti
- Extensible details — JSONField se future mein koi bhi data add ho sakta hai
"""


def log_team_activity(
    request,
    action,
    tenant=None,
    target_type='',
    target_name='',
    details=None,
):
    """
    Ek staff/Owner action ko ActivityLog mein record karo.

    Founder (super_admin) ke actions yahan skip hote hain — unke liye
    already superadmin.audit.log_action() hai. Exception raise nahi
    hogi — logging always silent fails.
    """
    try:
        user = request.user

        # Founder actions is model mein nahi jaate — AuditLog unka jagah hai
        if user.role == 'super_admin':
            return

        if tenant is None:
            from superadmin.utils import get_active_tenant
            tenant = get_active_tenant(request)

        if tenant is None:
            return  # Tenant ke bina log nahi ho sakta

        # Paranoia guard — has_permission() ne already gate kiya hoga is
        # request ko, par yahan bhi confirm karo ki actor ki is tenant
        # mein genuinely ek active Membership hai, warna silently skip.
        from teams.models import Membership, ActivityLog
        if not Membership.objects.filter(user=user, tenant=tenant, status='active').exists():
            return

        ActivityLog.objects.create(
            actor=user,
            tenant=tenant,
            action=action,
            target_type=target_type,
            target_name=target_name,
            details=details or {},
        )

    except Exception:
        # Logging fail hone pe main request kabhi fail nahi hogi
        pass
