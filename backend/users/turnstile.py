import requests
from django.conf import settings


def verify_turnstile_token(token, remote_ip=None):
    """
    Cloudflare Turnstile ke siteverify API se token verify karo.
    Endpoint aur response format Cloudflare ki official docs se hai
    (developers.cloudflare.com/turnstile) — verified as of implementation.

    Returns: (success: bool, error_message: str or None)
    """
    if not settings.TURNSTILE_SECRET_KEY:
        # Secret key set nahi hai — dev/testing mein fail-open kar sakte
        # hain, lekin production mein yeh hamesha set hona chahiye.
        return False, "Turnstile not configured on server."

    if not token:
        return False, "CAPTCHA verification is required."

    url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
    data = {
        'secret': settings.TURNSTILE_SECRET_KEY,
        'response': token,
    }
    if remote_ip:
        data['remoteip'] = remote_ip

    try:
        response = requests.post(url, data=data, timeout=10)
        result = response.json()
        if result.get('success'):
            return True, None
        else:
            return False, "CAPTCHA verification failed. Please try again."
    except requests.exceptions.RequestException:
        return False, "Could not verify CAPTCHA. Please try again."