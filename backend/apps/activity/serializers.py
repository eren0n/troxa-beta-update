from rest_framework import serializers
from .models import ActivityEvent


class ActivityEventSerializer(serializers.ModelSerializer):
    user = serializers.SerializerMethodField()
    action = serializers.CharField(source='description', read_only=True)

    class Meta:
        model = ActivityEvent
        fields = ('id', 'event_type', 'action', 'description', 'user', 'metadata', 'created_at')

    def get_user(self, obj):
        if not obj.user:
            return None
        name = obj.user.get_full_name().strip()
        return name or obj.user.email
