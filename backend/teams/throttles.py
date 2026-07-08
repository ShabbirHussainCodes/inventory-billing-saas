from rest_framework.throttling import AnonRateThrottle


class SelectBusinessThrottle(AnonRateThrottle):
    """
    /login/select-business/ endpoint ke liye rate limit — temporary_token
    guessing/brute-force ke against basic protection.

    HONEST NOTE (DRF ke apne docs se): yeh "not a security measure
    against deliberate malicious actors" hai — IP spoof ho sakta hai.
    Yeh basic abuse-prevention hai, hard guarantee nahi.

    Django ke default LocMemCache pe chalta hai (koi extra config nahi
    chahiye) — Render Free tier (single worker) ke liye theek hai. Agar
    future mein multiple gunicorn workers honge, har worker apna alag
    count rakhega (weaker guarantee us case mein).
    """
    scope = 'select_business'
