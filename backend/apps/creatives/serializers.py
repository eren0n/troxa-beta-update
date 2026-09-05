from rest_framework import serializers
from .models import GenerationJob, GeneratedCreative, VideoJob, LogoJob, LogoJobImage, CreativeTag, CreativeQualityScore


class CreativeTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreativeTag
        fields = ('id', 'name', 'color')


class GeneratedCreativeSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source='campaign.name', read_only=True, allow_null=True)
    campaign_id = serializers.UUIDField(source='campaign.id', read_only=True, allow_null=True)
    thumbnail = serializers.URLField(source='thumbnail_url', read_only=True)
    vjob_id = serializers.SerializerMethodField()
    vjob_status = serializers.SerializerMethodField()
    video_url = serializers.SerializerMethodField()
    model_name = serializers.SerializerMethodField()
    style = serializers.SerializerMethodField()
    extra_prompt = serializers.SerializerMethodField()
    negative_prompt = serializers.SerializerMethodField()
    generation_mode = serializers.SerializerMethodField()
    blend_weight = serializers.SerializerMethodField()
    use_fingerprint = serializers.SerializerMethodField()
    simplicity_weight = serializers.SerializerMethodField()
    quality_score = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    reference_thumbs = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()
    generated_by_id = serializers.UUIDField(source='created_by.id', read_only=True, allow_null=True)
    generated_by_name = serializers.SerializerMethodField()
    meta_linked = serializers.SerializerMethodField()
    proxy_url = serializers.SerializerMethodField()
    proxy_logo_url = serializers.SerializerMethodField()

    class Meta:
        model = GeneratedCreative
        fields = (
            'id', 'job_id', 'name', 'image_url', 'thumbnail', 'logo_applied_url',
            'campaign_name', 'campaign_id', 'media_type', 'logo_position', 'status', 'compliance',
            'aspect_ratio', 'created_at', 'vjob_id', 'vjob_status', 'video_url',
            'model_name', 'style', 'extra_prompt', 'negative_prompt', 'generation_mode',
            'blend_weight', 'use_fingerprint', 'simplicity_weight', 'quality_score',
            'created_by_name', 'reference_thumbs', 'rating', 'feedback_text',
            # unified table fields
            'source', 'is_edited', 'generated_by_id', 'generated_by_name', 'uploaded_by_name',
            'tags', 'meta_linked', 'proxy_url', 'proxy_logo_url',
            # merged in from the old reference-photo (WinningStatic) table —
            # every creative is captioned so it can be used as a reference
            'caption', 'caption_status',
        )

    def _latest_vjob(self, obj):
        return obj.video_jobs.order_by('-created_at').first()

    def get_vjob_id(self, obj):
        v = self._latest_vjob(obj)
        return v.id if v else None

    def get_vjob_status(self, obj):
        v = self._latest_vjob(obj)
        return v.status if v else None

    def get_video_url(self, obj):
        v = self._latest_vjob(obj)
        if not v or not v.video_url:
            return None
        return f'/api/creatives/video-jobs/{v.id}/video/'

    def get_model_name(self, obj):
        return obj.job.model_name if obj.job else None

    def get_style(self, obj):
        return obj.job.style if obj.job else None

    def get_extra_prompt(self, obj):
        return obj.job.extra_prompt if obj.job else None

    def get_negative_prompt(self, obj):
        return obj.job.negative_prompt if obj.job else None

    def get_generation_mode(self, obj):
        if obj.job is None:
            return None
        job = obj.job
        if job.generation_mode == 'prompt_studio':
            return 'Prompt Studio'
        if job.generation_mode == 'custom':
            return 'Custom'
        # 'auto' could be the real Auto tab OR old data default — detect Custom by
        # fields only available in Custom mode: model, campaign, extra_prompt, etc.
        if (job.model_name not in ('Nano Banana 2', '') or
                job.campaign_id or
                (job.extra_prompt and job.extra_prompt.strip()) or
                (job.negative_prompt and job.negative_prompt.strip()) or
                job.disclaimer_id):
            return 'Custom'
        return 'Auto'

    def get_blend_weight(self, obj):
        if obj.job is None:
            return None
        # Only meaningful when both fingerprint and references were used
        if not obj.job.use_fingerprint:
            return None
        refs = obj.job.reference_creatives.count() if obj.job_id else 0
        if refs == 0:
            return None
        return obj.job.blend_weight

    def get_use_fingerprint(self, obj):
        return obj.job.use_fingerprint if obj.job else False

    def get_simplicity_weight(self, obj):
        if obj.job is None:
            return None
        return obj.job.simplicity_weight  # None means off; 0-100 means on

    def get_quality_score(self, obj):
        try:
            qs = obj.quality_score
        except Exception:
            return None
        if qs is None:
            return None
        return {
            'status':           qs.status,
            'verdict':          qs.verdict,
            'overall':          qs.overall,
            'brand_alignment':  qs.brand_alignment,
            'ad_effectiveness': qs.ad_effectiveness,
            'text_quality':     qs.text_quality,
            'production_quality': qs.production_quality,
            'offer_accuracy':   qs.offer_accuracy,
            'notes':            qs.notes,
        }

    def get_created_by_name(self, obj):
        if obj.job and obj.job.created_by:
            u = obj.job.created_by
            return u.get_full_name().strip() or u.email
        return None

    def get_tags(self, obj):
        return [{'id': t.id, 'name': t.name, 'color': t.color} for t in obj.tags.all()]

    def get_meta_linked(self, obj):
        try:
            return bool(obj.meta_link.ad_id)
        except Exception:
            return False

    def get_proxy_url(self, obj):
        return f'/api/creatives/{obj.id}/image/' if obj.image_url else None

    def get_proxy_logo_url(self, obj):
        if obj.logo_applied_url:
            return f'/api/creatives/{obj.id}/image/?type=logo'
        return f'/api/creatives/{obj.id}/image/' if obj.image_url else None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name().strip() or obj.uploaded_by.email
        return None

    def get_generated_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name().strip() or obj.created_by.email
        return None

    def get_reference_thumbs(self, obj):
        if not obj.job:
            return []
        return [
            {'name': ref.name, 'url': ref.image_url}
            for ref in obj.job.reference_creatives.all()
            if ref.image_url
        ]


class GenerationJobSerializer(serializers.ModelSerializer):
    creatives = GeneratedCreativeSerializer(many=True, read_only=True)

    class Meta:
        model = GenerationJob
        fields = (
            'id', 'status', 'current_step', 'model_name', 'aspect_ratio',
            'resolution', 'num_images', 'output_format', 'extra_prompt',
            'generate_new_character', 'image_size', 'image_quality', 'style',
            'master_prompt', 'vibe_and_atmosphere', 'recommended_colors',
            'character_archetype', 'error_message', 'creatives', 'created_at',
            'negative_prompt',
        )


class VideoJobSerializer(serializers.ModelSerializer):
    video_url = serializers.SerializerMethodField()

    def get_video_url(self, obj):
        if not obj.video_url:
            return None
        return f'/api/creatives/video-jobs/{obj.id}/video/'

    class Meta:
        model = VideoJob
        fields = ('id', 'status', 'source_image_url', 'prompt', 'video_url', 'error_message', 'created_at')


class VideoJobDetailSerializer(serializers.ModelSerializer):
    source_creative_name = serializers.CharField(source='source_creative.name', read_only=True, allow_null=True)
    source_creative_id = serializers.UUIDField(source='source_creative.id', read_only=True, allow_null=True)
    video_url = serializers.SerializerMethodField()

    def get_video_url(self, obj):
        if not obj.video_url:
            return None
        return f'/api/creatives/video-jobs/{obj.id}/video/'

    class Meta:
        model = VideoJob
        fields = ('id', 'status', 'source_image_url', 'prompt', 'video_url', 'error_message',
                  'created_at', 'source_creative_id', 'source_creative_name')


class LogoJobImageSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    source_creative_name = serializers.CharField(source='source_creative.name', read_only=True, allow_null=True)

    class Meta:
        model = LogoJobImage
        fields = ('id', 'url', 'source_creative_id', 'source_creative_name', 'created_at')

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
