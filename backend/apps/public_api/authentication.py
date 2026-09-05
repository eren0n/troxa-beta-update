import hashlib
from django.utils import timezone
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from apps.team.models import APIKey


class APIKeyAuthentication(BaseAuthentication):
    def authenticate(self, request):
        raw_key = request.headers.get('X-API-Key') or request.META.get('HTTP_X_API_KEY')
        if not raw_key:
            return None

        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()

        try:
            api_key = APIKey.objects.select_related('workspace', 'created_by').get(
                key_hash=key_hash, is_active=True
            )
        except APIKey.DoesNotExist:
            raise AuthenticationFailed('Invalid or inactive API key.')

        APIKey.objects.filter(pk=api_key.pk).update(last_used_at=timezone.now())

        request.api_key = api_key
        request.workspace = api_key.workspace
        return (api_key.created_by, api_key)
