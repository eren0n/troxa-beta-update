import logging
from datetime import timedelta

from django.db.models import Count, DurationField, ExpressionWrapper, F, Q, Value
from django.db.models.functions import Coalesce, TruncDate
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.views import get_workspace, require_editor
from .analysis import adapt_ad, analyze_ad, needs_analysis
from .models import Competitor, CompetitorAd
from .serializers import CompetitorAdSerializer, CompetitorSerializer
from .services import MAX_COMPETITORS_PER_WORKSPACE, claim, parse_page_id, sync_in_background

logger = logging.getLogger(__name__)

# "Sync now" can't be pressed faster than this — each press opens a browser
# against Meta, and a burst of them is the quickest way to get blocked.
MANUAL_SYNC_COOLDOWN = timedelta(minutes=10)

ORDERINGS = {
    'position':      ('position', '-start_date'),
    '-days_running': ('-ran_for', 'position'),
    '-start_date':   ('-start_date',),
    '-last_seen':    ('-last_seen_at',),
}


def _with_run_length(qs):
    """
    How long each ad ran: until today if it is live, until it ended if not.
    Going by start date alone would rank an ad that started 40 days ago but
    lasted five among the long-runners.
    """
    today = timezone.now().date()
    return qs.annotate(ran_for=ExpressionWrapper(
        Coalesce(TruncDate('ended_at'), Value(today)) - F('start_date'),
        output_field=DurationField(),
    ))


def _with_counts(qs):
    return qs.annotate(
        active_ads=Count('ads', filter=Q(ads__is_active=True)),
        total_ads=Count('ads'),
    )


class CompetitorListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        qs = _with_counts(ws.competitors.all())
        return Response(CompetitorSerializer(qs, many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role cannot add competitors.'}, status=403)

        page_id = parse_page_id(request.data.get('page_id') or request.data.get('url'))
        if not page_id:
            return Response({'detail': 'Give a Facebook page id, or an Ad Library link that '
                                       'contains view_all_page_id.'}, status=400)
        if ws.competitors.filter(page_id=page_id).exists():
            return Response({'detail': 'This page is already being followed.'}, status=400)
        if ws.competitors.count() >= MAX_COMPETITORS_PER_WORKSPACE:
            return Response({'detail': f'A workspace can follow up to '
                                       f'{MAX_COMPETITORS_PER_WORKSPACE} competitors.'}, status=400)

        # Created already claimed (next_sync_at empty) and synced straight
        # away, so the page fills in without waiting for tomorrow's run.
        competitor = ws.competitors.create(page_id=page_id, created_by=request.user, next_sync_at=None)
        sync_in_background(competitor.pk)
        return Response(CompetitorSerializer(_with_counts(ws.competitors.filter(pk=competitor.pk)).first()).data,
                        status=201)


class CompetitorDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        ws = get_workspace(request)
        competitor = ws.competitors.filter(pk=pk).first() if ws else None
        if not competitor:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role cannot remove competitors.'}, status=403)
        competitor.delete()
        return Response(status=204)


class CompetitorSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        competitor = ws.competitors.filter(pk=pk).first() if ws else None
        if not competitor:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role cannot start a sync.'}, status=403)
        if competitor.next_sync_at is None:
            return Response({'detail': 'A sync is already running.'}, status=409)
        if competitor.last_synced_at and timezone.now() - competitor.last_synced_at < MANUAL_SYNC_COOLDOWN:
            return Response({'detail': 'Synced a moment ago — try again in a few minutes.'}, status=429)
        if not claim(competitor):
            return Response({'detail': 'A sync is already running.'}, status=409)
        sync_in_background(competitor.pk)
        return Response({'detail': 'Sync started.'}, status=202)


class CompetitorAdListView(APIView):
    """
    The ads of a workspace's competitors.

    ?competitor=<id>   one competitor
    ?active=true|false running or ended
    ?format=VIDEO|IMAGE|DCO
    ?min_days=<n>      running at least n days — the closest thing to "winners"
    ?ordering=position|-days_running|-start_date|-last_seen
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        p = request.query_params
        qs = _with_run_length(
            CompetitorAd.objects.filter(competitor__workspace=ws).select_related('competitor'))
        if p.get('competitor'):
            qs = qs.filter(competitor_id=p['competitor'])
        if p.get('active') in ('true', 'false'):
            qs = qs.filter(is_active=p['active'] == 'true')
        if p.get('format'):
            qs = qs.filter(display_format__iexact=p['format'])
        if p.get('min_days', '').isdigit():
            qs = qs.filter(ran_for__gte=timedelta(days=int(p['min_days'])))
        qs = qs.order_by(*ORDERINGS.get(p.get('ordering'), ORDERINGS['position']))

        try:
            page = max(1, int(p.get('page', 1)))
            size = min(60, max(1, int(p.get('page_size', 24))))
        except ValueError:
            page, size = 1, 24
        total = qs.count()
        items = qs[(page - 1) * size: page * size]
        return Response({
            'count': total,
            'has_more': page * size < total,
            'results': CompetitorAdSerializer(items, many=True).data,
        })


class CompetitorAdAdaptView(APIView):
    """
    POST /api/competitors/ads/<pk>/adapt/

    One idea for this workspace's brand from one competitor ad, shaped like a
    Trend Scout idea ({id, theme, concept, visual_direction, extra_prompt,
    insight, source}) so Generate can use it as-is. Synchronous, ~5-15 s;
    longer when the ad still has to be analysed first.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        if not require_editor(request.user, ws):
            return Response({'detail': 'Your role cannot generate.'}, status=403)
        ad = (CompetitorAd.objects.select_related('competitor')
              .filter(pk=pk, competitor__workspace=ws).first())
        if not ad:
            return Response(status=404)
        if ad.analysis_status == 'skipped':
            return Response({'detail': 'Only image ads can be adapted for now.'}, status=400)
        if needs_analysis(ad) and not analyze_ad(ad):
            ad.refresh_from_db()
            if ad.analysis_status == 'skipped':
                return Response({'detail': 'Only image ads can be adapted for now.'}, status=400)
            return Response({'detail': 'This ad could not be analysed — its images may no longer be '
                                       'available. Try again after the next sync.'}, status=502)
        ad.refresh_from_db()
        try:
            idea = adapt_ad(ad, ws)
        except Exception as exc:
            logger.warning('competitors.adapt_failed ad=%s error=%s', ad.pk, exc)
            return Response({'detail': 'Could not write an idea from this ad. Please try again.'}, status=502)
        return Response(idea)
