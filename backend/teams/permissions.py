"""
BillingMars — Team Management permission checking.

has_permission(request, codename):
    Core permission-check utility. Plan ke "Turant Effect Guarantee"
    section ke mutabik — permission KABHI JWT/session mein "baked in"
    nahi hoti. Har call par FRESH database query hoti hai, taaki
    role/permission change hote hi staff ki agli hi API call se naya
    rule turant lagu ho jaaye — logout-login ki zaroorat nahi.

    Do alag paths:
    - Founder (super_admin): Role/Permission catalog unhe apply nahi
      hota — plan mein explicitly decide hua tha ki Founder ka access
      is poore system se completely alag rahega. Read-only requests
      (GET/HEAD) hamesha allowed hain agar active support session hai
      (View Mode ka poora point hi "dekh sakte ho" hai). Sirf state-
      changing requests (POST/PUT/PATCH/DELETE) ke liye is_edit_mode()
      check hota hai. Codename yahan ignore hota hai — Founder ke liye
      yeh check purely method-based hai, koi granular permission catalog
      unhe apply nahi hoti.
      (BUG FIX: pehle version mein GET requests bhi is_edit_mode() se
      block ho jaate the — matlab Founder View Mode mein kuch bhi nahi
      dekh paata, jo View Mode ke poore purpose ko hi ulta kar deta.
      is_edit_mode() khud kabhi kisi existing view mein call nahi hoti
      thi is se pehle — View/Edit Mode ka distinction ab tak sirf
      frontend UI convention tha, backend kabhi enforce nahi karta tha.)
    - Normal user / staff: get_active_tenant() jo tenant resolve karta
      hai, usi tenant ki active Membership dhoondi jaati hai, aur uske
      Role ke paas woh specific permission (codename) hai ya nahi,
      yeh check hota hai.

require_permission(codename):
    Optional DRF view decorator — jab Phase B/C mein existing views
    mein permission-check gate gradually add kiya jayega (plan ke
    "dheere dheere add hoga, ek session mein poora nahi hoga" ke
    mutabik), views isse use kar sakte hain. ABHI (Phase A) kisi bhi
    existing view mein wire nahi kiya gaya hai — sirf utility ready hai.
"""

from functools import wraps
from rest_framework.response import Response


def has_permission(request, codename):
    """
    request  — DRF/Django request object, request.user set hona chahiye
    codename — teams.models.Permission.codename, e.g. 'invoice.create'

    Returns: bool
    """
    user = getattr(request, 'user', None)
    if not user or not user.is_authenticated:
        return False

    # Founder — Role/Permission system bypass. Reads (GET/HEAD) allowed
    # hamesha (agar active support session hai — get_active_tenant() ne
    # already tenant resolve kiya hoga jahan se yeh call ho rahi hai).
    # Writes ke liye is_edit_mode() check hota hai.
    if user.role == 'super_admin':
        if request.method in ('GET', 'HEAD'):
            return True
        from superadmin.utils import is_edit_mode
        return is_edit_mode(request)

    # Normal business user / staff — active Membership + Role check
    from superadmin.utils import get_active_tenant
    from teams.models import Membership

    tenant = get_active_tenant(request)
    if not tenant:
        return False

    membership = (
        Membership.objects
        .filter(user=user, tenant=tenant, status='active')
        .select_related('role')
        .first()
    )
    if not membership:
        return False

    return membership.role.role_permissions.filter(permission__codename=codename).exists()


def require_permission(codename):
    """
    Optional decorator for DRF @api_view functions:

        @api_view(['POST'])
        @permission_classes([IsAuthenticated])
        @require_permission('invoice.create')
        def create_invoice(request):
            ...

    NOTE: is session mein (Phase A) kisi bhi existing view pe yeh laga
    NAHI hai — sirf future use ke liye ready hai, taaki Phase B/C mein
    gradual rollout ke waqt views mein ek consistent pattern mile.
    """
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not has_permission(request, codename):
                return Response({'error': 'Access denied.'}, status=403)
            return view_func(request, *args, **kwargs)
        return wrapped
    return decorator
