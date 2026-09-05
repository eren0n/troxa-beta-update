from rest_framework import serializers
from apps.creatives.serializers import GeneratedCreativeSerializer
from .models import Automation, AutomationRun


class AutomationRunSerializer(serializers.ModelSerializer):
    generation_job_id = serializers.UUIDField(source='generation_job.id', read_only=True, allow_null=True)
    logo_job_id = serializers.UUIDField(source='logo_job.id', read_only=True, allow_null=True)
    creatives = serializers.SerializerMethodField()

    class Meta:
        model = AutomationRun
        fields = ('id', 'status', 'generation_job_id', 'logo_job_id',
                  'started_at', 'completed_at', 'error_message', 'creatives')

    def get_creatives(self, obj):
        if obj.generation_job:
            creatives = obj.generation_job.creatives.all()
            return GeneratedCreativeSerializer(creatives, many=True).data
        return []


class AutomationSerializer(serializers.ModelSerializer):
    status = serializers.SerializerMethodField()
    static_ids = serializers.SerializerMethodField()
    logo_id = serializers.SerializerMethodField()
    logo_url = serializers.SerializerMethodField()
    last_run = serializers.SerializerMethodField()
    total_runs = serializers.SerializerMethodField()
    total_creatives = serializers.SerializerMethodField()

    class Meta:
        model = Automation
        fields = (
            'id', 'name', 'generation_mode', 'model_name', 'aspect_ratio', 'aspect_ratios', 'resolution',
            'image_size', 'image_quality', 'num_images', 'output_format',
            'extra_prompt', 'style', 'use_fingerprint', 'blend_weight', 'simplicity_weight',
            'trigger_type', 'schedule_time', 'schedule_timezone',
            'schedule_days', 'is_active', 'status', 'last_run_at', 'next_run_at', 'created_at',
            'static_ids', 'logo_id', 'logo_url', 'last_run', 'total_runs', 'total_creatives',
            'character_id', 'campaign_id',
        )

    def get_status(self, obj):
        return 'active' if obj.is_active else 'paused'

    def get_static_ids(self, obj):
        return [str(pk) for pk in obj.reference_creatives.values_list('id', flat=True)]

    def get_logo_id(self, obj):
        return obj.logo_id

    def get_logo_url(self, obj):
        if obj.logo and obj.logo.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.logo.file.url)
        return None

    def get_last_run(self, obj):
        run = obj.runs.first()
        if not run:
            return None
        return {
            'id': run.id,
            'status': run.status,
            'started_at': run.started_at,
            'completed_at': run.completed_at,
            'error_message': run.error_message,
        }

    def get_total_runs(self, obj):
        return obj.runs.count()

    def get_total_creatives(self, obj):
        total = 0
        for run in obj.runs.filter(generation_job__isnull=False):
            total += run.generation_job.creatives.count()
        return total
