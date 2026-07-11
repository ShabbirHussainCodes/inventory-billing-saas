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


_VIEWED_AS_NOT_PASSED = object()


def log_team_activity(
    request,
    action,
    tenant=None,
    target_type='',
    target_name='',
    details=None,
    viewed_as_membership=_VIEWED_AS_NOT_PASSED,
):
    """
    Ek staff/Owner action ko ActivityLog mein record karo.

    Founder (super_admin) ke actions yahan skip hote hain — unke liye
    already superadmin.audit.log_action() hai. Exception raise nahi
    hogi — logging always silent fails.

    Phase B.5 — "View As Member" dual-actor recording:
    Agar is request ke peeche Owner ka active ViewAsSession chal raha
    hai, real actor (request.user, e.g. Owner) KABHI overwrite nahi
    hota — bas ADDITIONALLY yeh record hota hai ki woh kis member ki
    tarah dekh/act kar raha tha (viewed_as_membership). Yeh auto-detect
    hota hai (fresh DB query, koi caching nahi) taaki mojooda 15+ call
    sites (billing/inventory views mein) ko chhedna na pade — sirf ek
    hi jagah (yahan) yeh logic centralize hai. Explicit override bhi
    possible hai (e.g. view_as start/end/switch endpoints khud apna
    viewed_as_membership pass kar sakte hain) — isliye default sentinel
    use kiya gaya hai, None se alag pehchaanne ke liye.
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

        if viewed_as_membership is _VIEWED_AS_NOT_PASSED:
            from teams.models import ViewAsSession
            active_view_as = (
                ViewAsSession.objects
                .filter(initiator=user, is_active=True)
                .select_related('target_membership')
                .first()
            )
            viewed_as_membership = active_view_as.target_membership if active_view_as else None

        ActivityLog.objects.create(
            actor=user,
            tenant=tenant,
            action=action,
            target_type=target_type,
            target_name=target_name,
            details=details or {},
            viewed_as_membership=viewed_as_membership,
        )

    except Exception:
        # Logging fail hone pe main request kabhi fail nahi hogi
        pass
