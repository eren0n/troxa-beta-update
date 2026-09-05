from rest_framework import serializers
from apps.accounts.serializers import MemberSerializer, InviteSerializer
from .models import APIKey


class APIKeySerializer(serializers.ModelSerializer):
    key_display = serializers.CharField(read_only=True)

    class Meta:
        model = APIKey
        fields = ('id', 'name', 'key_display', 'is_active', 'last_used_at', 'created_at')
