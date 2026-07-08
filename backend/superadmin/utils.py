"""
BillingMars — Founder Support Mode utilities

get_active_tenant(request):
    Yeh function poore project ka core utility hai.
    Har inventory/billing view mein request.user.tenant ki jagah yeh call hoti hai.

    Kaise kaam karta hai:
    - Normal user  → unki active Membership se tenant resolve hota hai
                     (Team Management ke baad se — pehle user.tenant FK
                     directly use hota tha, ab Membership source of truth hai)
    - Founder      → jis client ke workspace mein hai (SupportSession se resolve)
    - Founder (no session) → None

    NOTE (known limitation, Step 5 mein solve hoga): agar ek user ki
    multiple active Memberships hain (multi-tenant staff, abhi tak koi
    aisa real case nahi hai), yeh function abhi sirf sabse recent wali
    utha leta hai — "kaunsa business is session mein active hai" wala
    proper selection mechanism Step 5 (multi-tenant login flow) mein aayega.

is_edit_mode(request):
    Founder view mode mein hai ya edit mode mein?
    Normal users ke liye hamesha True — unke apne data pe full access.
"""


def get_active_tenant(request):
    user = request.user

    # Normal business user — active Membership se tenant resolve karo
    if user.role != 'super_admin':
        from teams.models import Membership
        membership = (
            Membership.objects
            .filter(user=user, status='active')
            .select_related('tenant')
            .first()
        )
        return membership.tenant if membership else None

    # Founder hai — active support session check karo (UNCHANGED)
    from superadmin.models import SupportSession
    session = (
        SupportSession.objects
        .filter(founder=user, is_active=True)
        .select_related('tenant')
        .first()
    )
    return session.tenant if session else None


def is_edit_mode(request):
    user = request.user

    # Normal user — hamesha edit allowed (apne data pe)
    if user.role != 'super_admin':
        return True

    from superadmin.models import SupportSession
    session = SupportSession.objects.filter(
        founder=user, is_active=True
    ).first()

    if not session:
        return False

    return session.mode == 'edit'