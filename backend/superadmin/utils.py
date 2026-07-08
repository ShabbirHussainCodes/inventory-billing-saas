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

    Multi-tenant staff (2+ active Memberships): login ke waqt jo tenant
    choose kiya tha, uski id JWT access token mein 'tenant_id' custom
    claim ke roop mein baked hoti hai (users/views.py get_tokens_for_user).
    Yeh claim SIRF disambiguation ke liye consult hoti hai — is baat ki
    fresh check ki DB se turant call kiya jaata hai ki us tenant ki
    Membership abhi bhi status='active' hai ya nahi (agar beech mein
    suspend ho gayi, agli hi request pe access chala jaata hai — koi
    permission/role kabhi is claim mein cache nahi hoti).

is_edit_mode(request):
    Founder view mode mein hai ya edit mode mein?
    Normal users ke liye hamesha True — unke apne data pe full access.
"""


def get_active_tenant(request):
    user = request.user

    # Normal business user — active Membership(s) se tenant resolve karo
    if user.role != 'super_admin':
        from teams.models import Membership
        memberships = (
            Membership.objects
            .filter(user=user, status='active')
            .select_related('tenant')
        )
        count = memberships.count()

        if count == 0:
            return None

        if count == 1:
            return memberships.first().tenant

        # 2+ active memberships — JWT ke 'tenant_id' claim se disambiguate
        # karo (login ke waqt select kiya gaya business). Claim ko blindly
        # trust nahi kiya — Membership abhi bhi active hai ya nahi, yeh
        # fresh DB filter (upar wali memberships queryset) se hi confirm
        # hota hai, isliye suspend hote hi agli request pe access chala
        # jaata hai.
        auth = getattr(request, 'auth', None)
        tenant_id = None
        if auth is not None:
            try:
                tenant_id = auth.get('tenant_id')
            except (AttributeError, TypeError):
                tenant_id = None

        if tenant_id:
            match = memberships.filter(tenant_id=tenant_id).first()
            if match:
                return match.tenant

        # Ambiguous — koi valid selection nahi mila
        return None

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