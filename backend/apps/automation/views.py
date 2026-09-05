from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.accounts.views import get_workspace, require_editor
from apps.brand_kit.models import Logo
from .models import Automation, AutomationRun
from .serializers import AutomationSerializer, AutomationRunSerializer
from .services import run_automation_async, _calculate_next_run


class AutomationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        automations = ws.automations.all()
        return Response(AutomationSerializer(automations, many=True, context={'request': request}).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot create automations.'}, status=403)
        d = request.data

        logo = None
        if d.get('logo_id'):
            logo = ws.logos.filter(id=d['logo_id']).first()

        campaign = None
        if d.get('campaign_id'):
            campaign = ws.campaigns.filter(id=d['campaign_id']).first()

        character = None
        if d.get('character_id'):
            from apps.brand_kit.models import Character
            character = Character.objects.filter(id=d['character_id'], workspace=ws).first()

        simplicity_on = d.get('simplicity_mode', False)
        simplicity_weight = int(d['simplicity_weight']) if simplicity_on and d.get('simplicity_weight') is not None else None

        raw_ratios = d.get('aspect_ratios', [])
        primary_ratio = d.get('aspect_ratio') or (raw_ratios[0] if raw_ratios else '1:1')

        auto = Automation.objects.create(
            workspace=ws,
            created_by=request.user,
            name=d.get('name', 'Automation'),
            extra_prompt=d.get('extra_prompt', ''),
            style=d.get('style', ''),
            generation_mode=d.get('generation_mode', 'auto'),
            model_name=d.get('model_name', 'Nano Banana 2'),
            aspect_ratio=primary_ratio,
            aspect_ratios=raw_ratios,
            resolution=d.get('resolution', '1K'),
            image_size=d.get('image_size', ''),
            image_quality=d.get('image_quality', 'high'),
            num_images=int(d.get('num_images', 2)),
            output_format=d.get('output_format', 'png'),
            use_fingerprint=bool(d.get('use_fingerprint', True)),
            blend_weight=int(d.get('blend_weight', 50)),
            simplicity_weight=simplicity_weight,
            trigger_type=d.get('trigger_type', 'manual'),
            schedule_time=d.get('schedule_time') or None,
            schedule_timezone=d.get('schedule_timezone', 'UTC') or 'UTC',
            schedule_days=d.get('schedule_days', []),
            logo=logo,
            campaign=campaign,
            character=character,
        )

        static_ids = d.get('static_ids', [])
        if static_ids:
            auto.reference_creatives.set(ws.creatives.filter(id__in=static_ids, media_type='Photo'))

        if auto.trigger_type == 'scheduled':
            auto.next_run_at = _calculate_next_run(auto)
            auto.save(update_fields=['next_run_at'])

        return Response(AutomationSerializer(auto, context={'request': request}).data, status=201)


class AutomationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.automations.filter(pk=pk).first()

    def get(self, request, pk):
        ws = get_workspace(request)
        auto = self._get(ws, pk)
        if not auto:
            return Response(status=404)
        return Response(AutomationSerializer(auto, context={'request': request}).data)

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot edit automations.'}, status=403)
        auto = self._get(ws, pk)
        if not auto:
            return Response(status=404)
        d = request.data

        simple_fields = [
            'name', 'extra_prompt', 'style', 'model_name', 'aspect_ratio', 'resolution',
            'image_size', 'image_quality', 'num_images', 'output_format',
            'trigger_type', 'schedule_time', 'schedule_timezone', 'schedule_days', 'is_active',
            'generation_mode',
        ]
        for field in simple_fields:
            if field in d:
                setattr(auto, field, d[field] or (None if field == 'schedule_time' else d[field]))

        if 'aspect_ratios' in d:
            auto.aspect_ratios = d['aspect_ratios'] or []

        if 'use_fingerprint' in d:
            auto.use_fingerprint = bool(d['use_fingerprint'])

        if 'blend_weight' in d:
            auto.blend_weight = int(d['blend_weight'])

        if 'simplicity_mode' in d or 'simplicity_weight' in d:
            simplicity_on = d.get('simplicity_mode', auto.simplicity_weight is not None)
            sw = d.get('simplicity_weight')
            auto.simplicity_weight = int(sw) if simplicity_on and sw is not None else None

        if 'campaign_id' in d:
            auto.campaign = ws.campaigns.filter(id=d['campaign_id']).first() if d['campaign_id'] else None

        if 'character_id' in d:
            from apps.brand_kit.models import Character
            auto.character = Character.objects.filter(id=d['character_id'], workspace=ws).first() if d['character_id'] else None

        if 'logo_id' in d:
            auto.logo = ws.logos.filter(id=d['logo_id']).first() if d['logo_id'] else None

        if 'static_ids' in d:
            auto.reference_creatives.set(ws.creatives.filter(id__in=d['static_ids'], media_type='Photo'))

        if auto.trigger_type == 'scheduled':
            auto.next_run_at = _calculate_next_run(auto)

        auto.save()
        return Response(AutomationSerializer(auto, context={'request': request}).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot delete automations.'}, status=403)
        auto = self._get(ws, pk)
        if not auto:
            return Response(status=404)
        auto.delete()
        return Response(status=204)


class AutomationRunNowView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot run automations.'}, status=403)
        auto = ws.automations.filter(pk=pk).first()
        if not auto:
            return Response(status=404)
        run_id = run_automation_async(auto.pk)
        return Response({'run_id': run_id}, status=202)


class AutomationToggleView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot toggle automations.'}, status=403)
        auto = ws.automations.filter(pk=pk).first()
        if not auto:
            return Response(status=404)
        auto.is_active = not auto.is_active
        if auto.is_active and auto.trigger_type == 'scheduled':
            auto.next_run_at = _calculate_next_run(auto)
        auto.save(update_fields=['is_active', 'next_run_at'])
        return Response({'is_active': auto.is_active})


class AutomationRunsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        ws = get_workspace(request)
        auto = ws.automations.filter(pk=pk).first()
        if not auto:
            return Response(status=404)
        runs = auto.runs.all()[:30]
        return Response(AutomationRunSerializer(runs, many=True).data)


class RunStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, run_pk):
        ws = get_workspace(request)
        try:
            run = AutomationRun.objects.select_related('automation').get(pk=run_pk, automation__workspace=ws)
        except AutomationRun.DoesNotExist:
            return Response(status=404)
        return Response(AutomationRunSerializer(run).data)
