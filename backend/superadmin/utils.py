"""
BillingMars — Founder Support Mode utilities

get_active_tenant(request):
    Yeh function poore project ka core utility hai.
    Har inventory/billing view mein request.user.tenant ki jagah yeh call hoti hai.

    Kaise kaam karta hai:
    - Normal user  → unka apna tenant (as before)
    - Founder      → jis client ke workspace mein hai (SupportSession se resolve)
    - Founder (no session) → None

is_edit_mode(request):
    Founder view mode mein hai ya edit mode mein?
    Normal users ke liye hamesha True — unke apne data pe full access.
"""


def get_active_tenant(request):
    user = request.user

    # Normal business user — apna tenant return karo
    if user.role != 'super_admin':
        return user.tenant

    # Founder hai — active support session check karo
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