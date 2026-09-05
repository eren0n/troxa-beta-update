import hashlib
import secrets
from django.db import models
from apps.accounts.models import Workspace, User


class APIKey(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='api_keys')
    name = models.CharField(max_length=100)
    key_prefix = models.CharField(max_length=20)
    key_hash = models.CharField(max_length=64)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.name} ({self.key_prefix}...)'

    @classmethod
    def generate(cls, workspace, name, created_by):
        raw_key = 'tx_live_' + secrets.token_hex(20)
        prefix = raw_key[:12]
        key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
        obj = cls.objects.create(
            workspace=workspace,
            name=name,
            key_prefix=prefix,
            key_hash=key_hash,
            created_by=created_by,
        )
        return obj, raw_key

    @property
    def key_display(self):
        return f'{self.key_prefix}••••••••'
