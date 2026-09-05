from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.views import get_workspace, require_editor, require_editor
from .models import BrandFingerprint, ImageAnalysisRecord, CampaignMarketInsight, CampaignCreativeBrief, WorkspaceTrendBrief
from .services import trigger_merge, trigger_synthesis, trigger_market_research, trigger_creative_director, trigger_trend_scout, build_master_prompt


class FingerprintStatusView(APIView):
    """
    GET /api/fingerprint/status/
    Returns current fingerprint state for the active workspace.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        fp = BrandFingerprint.objects.filter(workspace=ws).first()
        corpus_count = ImageAnalysisRecord.objects.filter(workspace=ws).count()
        unmerged_count = ImageAnalysisRecord.objects.filter(
            workspace=ws, included_in_fingerprint_version__isnull=True
        ).count()

        if not fp:
            return Response({
                "exists": False,
                "corpus_count": corpus_count,
                "unmerged_count": unmerged_count,
            })

        return Response({
            "exists": True,
            "brand_profile_version": fp.brand_profile_version,
            "visual_dna_version": fp.visual_dna_version,
            "confidence": fp.confidence,
            "based_on_image_count": fp.based_on_image_count,
            "has_visual_dna": bool(fp.visual_dna),
            "corpus_count": corpus_count,
            "unmerged_count": unmerged_count,
            "last_full_recreate_at": fp.last_full_recreate_at,
            "updated_at": fp.updated_at,
            "summary_style_dna": fp.visual_dna.get("summary_style_dna", "") if fp.visual_dna else "",
            "style_tags_ranked": fp.visual_dna.get("style_tags_ranked", []) if fp.visual_dna else [],
            "brand_tone_keywords": fp.brand_profile.get("brand_tone_keywords", []) if fp.brand_profile else [],
        })


class FingerprintMergeView(APIView):
    """
    POST /api/fingerprint/merge/
    Manually trigger Agent 4 incremental merge.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot trigger fingerprint merge.'}, status=403)
        unmerged = ImageAnalysisRecord.objects.filter(
            workspace=ws, included_in_fingerprint_version__isnull=True
        ).count()
        if unmerged == 0:
            return Response({"status": "nothing_to_merge", "unmerged_count": 0})
        trigger_merge(ws.id)
        return Response({"status": "queued", "unmerged_count": unmerged}, status=202)


class FingerprintRecreateView(APIView):
    """
    POST /api/fingerprint/recreate/
    Manually trigger full Synthesis recreate from entire corpus.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot trigger fingerprint recreate.'}, status=403)
        corpus_count = ImageAnalysisRecord.objects.filter(workspace=ws).count()
        if corpus_count == 0:
            return Response({"status": "no_corpus"}, status=400)
        trigger_synthesis(ws.id, reason="manual")
        return Response({"status": "queued", "corpus_count": corpus_count}, status=202)


# ─── Campaign Intelligence Views ──────────────────────────────────────────────

def _get_campaign(ws, campaign_id):
    from apps.brand_kit.models import Campaign
    return Campaign.objects.filter(workspace=ws, id=campaign_id).first()


def _brief_summary(brief_dict):
    """Slim version of a brief for the intel summary — no extra_prompt."""
    return {
        'id'        : brief_dict.get('id'),
        'type'      : brief_dict.get('type'),
        'title'     : brief_dict.get('title'),
        'concept'   : brief_dict.get('concept'),
        'confidence': brief_dict.get('confidence'),
    }


class CampaignIntelView(APIView):
    """
    GET /api/fingerprint/campaign/<id>/intel/
    Returns intel status, brief count, and a slim brief summary.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, campaign_id):
        ws       = get_workspace(request)
        campaign = _get_campaign(ws, campaign_id)
        if not campaign:
            return Response(status=404)

        fp            = BrandFingerprint.objects.filter(workspace=ws).first()
        fp_version    = fp.visual_dna_version if fp else 0
        has_visual_dna = bool(fp and fp.visual_dna)

        insight = getattr(campaign, 'market_insight', None)
        latest_brief = campaign.creative_briefs.filter(status='ready').first()

        fingerprint_stale = (
            latest_brief is not None and
            latest_brief.fingerprint_version != fp_version
        )

        return Response({
            'campaign_id'        : str(campaign.id),
            'campaign_name'      : campaign.name,
            'has_audience'       : bool(campaign.target_audience),
            'has_visual_dna'     : has_visual_dna,
            'research_status'    : insight.status if insight else None,
            'research_updated_at': insight.updated_at.isoformat() if insight else None,
            'brief_status'       : latest_brief.status if latest_brief else None,
            'brief_count'        : len(latest_brief.briefs) if latest_brief else 0,
            'fingerprint_stale'  : fingerprint_stale,
            'briefs_summary'     : [_brief_summary(b) for b in (latest_brief.briefs if latest_brief else [])],
        })


class CampaignResearchView(APIView):
    """
    POST /api/fingerprint/campaign/<id>/research/
    Trigger Agent 1 (Market Analyst). Agent 2 auto-triggers on success.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, campaign_id):
        ws       = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot trigger campaign research.'}, status=403)
        campaign = _get_campaign(ws, campaign_id)
        if not campaign:
            return Response(status=404)

        # Reject if already running
        insight = getattr(campaign, 'market_insight', None)
        if insight and insight.status == 'pending':
            return Response({'status': 'already_running'}, status=200)

        trigger_market_research(str(campaign.id))
        return Response({'status': 'queued'}, status=202)


class CampaignBriefsView(APIView):
    """
    GET  /api/fingerprint/campaign/<id>/briefs/ — latest ready brief set (full data)
    POST /api/fingerprint/campaign/<id>/briefs/ — trigger Agent 2 only (insight must be ready)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, campaign_id):
        ws       = get_workspace(request)
        campaign = _get_campaign(ws, campaign_id)
        if not campaign:
            return Response(status=404)

        brief = campaign.creative_briefs.filter(status='ready').first()
        if not brief:
            return Response({'briefs': [], 'status': None})

        return Response({
            'status'             : brief.status,
            'fingerprint_version': brief.fingerprint_version,
            'created_at'         : brief.created_at.isoformat(),
            'briefs'             : brief.briefs,
        })

    def post(self, request, campaign_id):
        ws       = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot trigger brief generation.'}, status=403)
        campaign = _get_campaign(ws, campaign_id)
        if not campaign:
            return Response(status=404)

        insight = getattr(campaign, 'market_insight', None)
        if not insight or insight.status != 'ready':
            return Response({'detail': 'Market research must be ready before generating briefs.'}, status=400)

        # Reject if already running
        running = campaign.creative_briefs.filter(status='pending').exists()
        if running:
            return Response({'status': 'already_running'}, status=200)

        trigger_creative_director(str(campaign.id))
        return Response({'status': 'queued'}, status=202)


def _get_staleness_hours(brief):
    """Return how many hours old this brief is."""
    from django.utils import timezone
    if not brief or not brief.created_at:
        return 999
    delta = timezone.now() - brief.created_at
    return delta.total_seconds() / 3600


class WorkspaceTrendView(APIView):
    """
    GET  /api/fingerprint/trends/  — return latest trend brief for this workspace.
        Automatically triggers a new scout run if no brief exists or the latest
        is older than 24 hours and not currently pending.
    POST /api/fingerprint/trends/  — force a fresh scout run immediately.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        latest = WorkspaceTrendBrief.objects.filter(workspace=ws).first()

        stale = _get_staleness_hours(latest) > 24
        if not latest or (stale and latest.status != 'pending'):
            # Auto-trigger a fresh run
            latest = trigger_trend_scout(ws)

        return Response({
            'id':                 latest.id,
            'status':             latest.status,
            'landscape_summary':  latest.landscape_summary,
            'ideas':              latest.ideas,
            'error':              latest.error,
            'created_at':         latest.created_at.isoformat(),
            'stale':              _get_staleness_hours(latest) > 24,
        })

    def post(self, request):
        ws = get_workspace(request)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Analysts cannot trigger trend scout.'}, status=403)
        # Check if one is already running
        running = WorkspaceTrendBrief.objects.filter(workspace=ws, status='pending').first()
        if running:
            return Response({
                'id':     running.id,
                'status': 'already_running',
            }, status=200)
        brief = trigger_trend_scout(ws)
        return Response({
            'id':     brief.id,
            'status': brief.status,
        }, status=202)


class PromptArchitectView(APIView):
    """
    POST /api/fingerprint/build-prompt/

    Synthesise brand DNA + a creative concept seed into a single production-ready
    image generation prompt.  Runs synchronously (~3-5 s).

    Request body:
    {
      "seed": {
        "theme": "...",
        "concept": "...",
        "visual_direction": "...",
        "extra_notes": "..."        // optional
      },
      "aspect_ratio": "9:16"        // optional, default "1:1"
    }

    Response:
    {
      "master_prompt": "..."
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ws = get_workspace(request)
        seed = request.data.get('seed') or {}
        aspect_ratio = request.data.get('aspect_ratio') or '1:1'

        if not seed.get('concept') and not seed.get('theme') and not seed.get('extra_notes'):
            return Response({'detail': 'seed must contain at least one of: theme, concept, extra_notes'}, status=400)

        use_fingerprint = bool(request.data.get('use_fingerprint', True))

        try:
            master_prompt = build_master_prompt(ws, seed, aspect_ratio=aspect_ratio, use_fingerprint=use_fingerprint)
            return Response({'master_prompt': master_prompt})
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error("prompt_architect.view_error: %s", exc)
            return Response({'detail': str(exc)}, status=500)
