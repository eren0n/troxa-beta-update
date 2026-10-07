from rest_framework import serializers

from .models import Competitor, CompetitorAd


class CompetitorSerializer(serializers.ModelSerializer):
    ad_library_url = serializers.CharField(read_only=True)
    active_ads = serializers.IntegerField(read_only=True)
    total_ads = serializers.IntegerField(read_only=True)
    syncing = serializers.SerializerMethodField()

    class Meta:
        model = Competitor
        fields = ('id', 'page_id', 'page_name', 'country', 'ad_library_url', 'active_ads', 'total_ads',
                  'last_synced_at', 'last_error', 'syncing', 'created_at')

    def get_syncing(self, obj):
        # next_sync_at is cleared while a sync holds the competitor
        return obj.next_sync_at is None


class CompetitorAdSerializer(serializers.ModelSerializer):
    days_running = serializers.IntegerField(read_only=True)
    ad_library_url = serializers.CharField(read_only=True)
    competitor_name = serializers.CharField(source='competitor.page_name', read_only=True)

    class Meta:
        model = CompetitorAd
        fields = ('id', 'competitor', 'competitor_name', 'ad_archive_id', 'is_active',
                  'start_date', 'ended_at', 'days_running', 'position', 'display_format',
                  'platforms', 'cta_text', 'cta_type', 'link_url', 'title', 'body',
                  'media', 'cards', 'first_seen_at', 'last_seen_at', 'ad_library_url',
                  'analysis', 'analysis_status')
