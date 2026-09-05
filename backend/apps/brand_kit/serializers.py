from rest_framework import serializers
from .models import Campaign, Logo, Cta, Promo, WinningStatic, Disclaimer


class CampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = Campaign
        fields = ('id', 'name', 'created_at', 'target_audience', 'target_region', 'objective', 'campaign_brief')


class LogoSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Logo
        fields = ('id', 'name', 'file_url', 'is_primary', 'uploaded_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class CtaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Cta
        fields = ('id', 'name', 'file_url', 'is_primary', 'uploaded_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class PromoSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Promo
        fields = ('id', 'name', 'file_url', 'is_primary', 'uploaded_at')

    def get_file_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class WinningStaticSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = WinningStatic
        fields = ('id', 'name', 'url', 'caption', 'caption_status', 'performance', 'category', 'uploaded_at')

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class DisclaimerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disclaimer
        fields = ('id', 'text', 'name', 'category', 'is_default', 'created_at')
