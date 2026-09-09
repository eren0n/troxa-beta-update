"""
Cookie-based JWT auth — the access/refresh tokens travel as httpOnly cookies
instead of being handed to the frontend to store in localStorage (readable,
and therefore stealable, by any JS that ends up running on the page via an
XSS bug). The Authorization: Bearer header path is still accepted for
backward compatibility (a browser tab still running the previous frontend
bundle, or any future non-browser client) — CookieJWTAuthentication just
falls back to the cookie when no header is present.

CSRF: DRF's APIView wraps every view with @csrf_exempt by default and only
SessionAuthentication opts back into Django's CSRF check. A Bearer header
can't be attached to a request a malicious site tricks the browser into
making (that's exactly what CSRF exploits — an auto-attached credential,
which a custom header isn't), so header-authenticated requests stay exempt.
A cookie *is* auto-attached by the browser, so any request that authenticates
via the cookie has to pass the same CSRF check Django's session auth uses.
"""
from django.middleware.csrf import CsrfViewMiddleware, get_token
from rest_framework.exceptions import PermissionDenied
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

ACCESS_COOKIE = 'access_token'
REFRESH_COOKIE = 'refresh_token'
# Scoped to /api/auth/ rather than the full /api/ so it isn't attached to
# every request — but broad enough to cover both endpoints that actually
# need to read it (refresh, and logout — which reads it to blacklist it).
REFRESH_COOKIE_PATH = '/api/auth/'


class _CSRFCheck(CsrfViewMiddleware):
    """Runs Django's CSRF validation without the middleware's request/response
    plumbing — same approach DRF's own SessionAuthentication.enforce_csrf uses."""
    def _reject(self, request, reason):
        return reason


def _enforce_csrf(request):
    check = _CSRFCheck(lambda r: None)
    check.process_request(request)
    reason = check.process_view(request, None, (), {})
    if reason:
        raise PermissionDenied(f'CSRF Failed: {reason}')


class CookieJWTAuthentication(JWTAuthentication):
    def authenticate(self, request):
        header_result = super().authenticate(request)
        if header_result is not None:
            return header_result

        raw_token = request.COOKIES.get(ACCESS_COOKIE)
        if not raw_token:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except (InvalidToken, TokenError):
            # An expired/garbage cookie shouldn't hard-fail requests that
            # don't actually require auth (AllowAny views, e.g. login
            # itself — authentication runs before permission_classes is
            # even consulted) — treat it the same as no cookie at all.
            return None

        _enforce_csrf(request)
        return self.get_user(validated_token), validated_token


def set_auth_cookies(response, access, refresh=None):
    """Set the access-token cookie (and optionally the refresh-token cookie,
    scoped to only the refresh endpoint so it isn't sent on every request)."""
    from django.conf import settings

    access_seconds = int(settings.SIMPLE_JWT['ACCESS_TOKEN_LIFETIME'].total_seconds())
    response.set_cookie(
        ACCESS_COOKIE, access, max_age=access_seconds,
        httponly=True, secure=True, samesite='Lax', path='/api/',
    )
    if refresh is not None:
        refresh_seconds = int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds())
        response.set_cookie(
            REFRESH_COOKIE, refresh, max_age=refresh_seconds,
            httponly=True, secure=True, samesite='Lax', path=REFRESH_COOKIE_PATH,
        )
    return response


def clear_auth_cookies(response):
    response.delete_cookie(ACCESS_COOKIE, path='/api/')
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)
    return response


def prime_csrf_cookie(request):
    """Ensures the (JS-readable, non-httpOnly) csrftoken cookie is set —
    Django only sends it once something calls get_token() during the
    request/response cycle, which never happens on a pure-API/SPA project
    unless we do it explicitly."""
    get_token(request)
