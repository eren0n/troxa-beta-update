from rest_framework import serializers
from .models import AdRecord


def _safe_div(a, b):
    try:
        if not b:
            return None
        return round(float(a) / float(b), 4)
    except (TypeError, ValueError):
        return None


class AdRecordSerializer(serializers.ModelSerializer):
    is_labeled = serializers.ReadOnlyField()
    labeled_by_email = serializers.SerializerMethodField()
    creative_image_full_url = serializers.SerializerMethodField()

    # Derived metrics (computed, never stored)
    ctr = serializers.SerializerMethodField()
    cost_per_reg = serializers.SerializerMethodField()
    cost_per_ftp = serializers.SerializerMethodField()
    cost_per_purchase = serializers.SerializerMethodField()
    roas = serializers.SerializerMethodField()
    reg_to_ftp = serializers.SerializerMethodField()
    reg_to_purchase = serializers.SerializerMethodField()

    class Meta:
        model = AdRecord
        fields = [
            'id', 'ad_id', 'ad_name', 'campaign_id', 'campaign_name',
            'adset_id', 'adset_name', 'ad_status', 'objective',
            'daily_budget', 'lifetime_budget',
            'creative_image_path', 'creative_image_url', 'creative_image_full_url',
            # Atomic metrics
            'impressions', 'reach', 'clicks', 'spend',
            'regs', 'ftp', 'purchases', 'revenue',
            # Derived metrics (read-only)
            'ctr', 'cost_per_reg', 'cost_per_ftp', 'cost_per_purchase',
            'roas', 'reg_to_ftp', 'reg_to_purchase',
            # Annotations
            'target_audience', 'notes', 'personal_rating', 'success_rating',
            'labeled_by_email', 'labeled_at',
            'is_labeled', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'ad_id', 'ad_name', 'campaign_id', 'campaign_name',
            'adset_id', 'adset_name', 'ad_status', 'objective',
            'daily_budget', 'lifetime_budget',
            'creative_image_path', 'creative_image_url',
            'impressions', 'reach', 'clicks', 'spend',
            'regs', 'ftp', 'purchases', 'revenue',
            'labeled_by_email', 'labeled_at', 'is_labeled',
            'created_at', 'updated_at',
        ]

    def get_labeled_by_email(self, obj):
        return obj.labeled_by.email if obj.labeled_by else None

    def get_creative_image_full_url(self, obj):
        if not obj.creative_image_path:
            return None
        request = self.context.get('request')
        path = f'/media/{obj.creative_image_path}'
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_ctr(self, obj):
        return _safe_div(obj.clicks, obj.impressions)

    def get_cost_per_reg(self, obj):
        if obj.cost_per_reg is not None:
            return float(obj.cost_per_reg)
        return _safe_div(obj.spend, obj.regs)

    def get_cost_per_ftp(self, obj):
        if obj.cost_per_ftp is not None:
            return float(obj.cost_per_ftp)
        return _safe_div(obj.spend, obj.ftp)

    def get_cost_per_purchase(self, obj):
        return _safe_div(obj.spend, obj.purchases)

    def get_roas(self, obj):
        if obj.roas is not None:
            return float(obj.roas)
        return _safe_div(obj.revenue, obj.spend)

    def get_reg_to_ftp(self, obj):
        return _safe_div(obj.ftp, obj.regs)

    def get_reg_to_purchase(self, obj):
        return _safe_div(obj.purchases, obj.regs)


class AdRecordListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for the queue list view."""
    is_labeled = serializers.ReadOnlyField()
    creative_image_full_url = serializers.SerializerMethodField()
    roas = serializers.SerializerMethodField()
    cost_per_ftp = serializers.SerializerMethodField()

    class Meta:
        model = AdRecord
        fields = [
            'id', 'ad_id', 'ad_name', 'campaign_name', 'ad_status',
            'creative_image_path', 'creative_image_url', 'creative_image_full_url',
            'spend', 'impressions', 'regs', 'ftp', 'purchases', 'revenue',
            'roas', 'cost_per_ftp', 'is_labeled', 'labeled_at', 'updated_at',
        ]

    def get_creative_image_full_url(self, obj):
        if not obj.creative_image_path:
            return None
        request = self.context.get('request')
        path = f'/media/{obj.creative_image_path}'
        if request:
            return request.build_absolute_uri(path)
        return path

    def get_roas(self, obj):
        if obj.roas is not None:
            return float(obj.roas)
        if not obj.spend:
            return None
        return round(float(obj.revenue) / float(obj.spend), 2)

    def get_cost_per_ftp(self, obj):
        if obj.cost_per_ftp is not None:
            return float(obj.cost_per_ftp)
        return _safe_div(obj.spend, obj.ftp)
