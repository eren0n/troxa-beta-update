from django.db.models import Count, Q
from django.db.models.functions import TruncDate, TruncMonth
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.views import get_workspace
from .models import ActivityEvent
from .serializers import ActivityEventSerializer

USER_SCOPED_EVENTS = {'team.invited'}

# Event types that count as "generated"
GENERATED_TYPES = {'generation', 'creative.generated', 'job.completed'}
# Event types that count as "exported"
EXPORTED_TYPES = {'creative.exported', 'drive_import'}


class EventsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)

        qs = ActivityEvent.objects.filter(
            Q(workspace=ws) | Q(user=request.user, event_type__in=USER_SCOPED_EVENTS)
        ).distinct()

        period_map = {'7d': 7, '30d': 30, '12m': 365}
        days = period_map.get(request.query_params.get('period', '7d'), 7)
        qs = qs.filter(created_at__gte=timezone.now() - timedelta(days=days))

        event_type = request.query_params.get('type')
        if event_type:
            qs = qs.filter(event_type=event_type)

        return Response(ActivityEventSerializer(qs[:200], many=True).data)


class AnalyticsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        now = timezone.now()
        since_14 = now - timedelta(days=14)
        since_180 = now - timedelta(days=180)
        events = ActivityEvent.objects.filter(workspace=ws)

        total = events.count()
        by_type = list(events.values('event_type').annotate(count=Count('id')).order_by('-count'))
        type_counts = {row['event_type']: row['count'] for row in by_type}

        # Daily totals last 14 days — bucket by generation vs export vs other
        daily_qs = (
            events.filter(created_at__gte=since_14)
            .annotate(day=TruncDate('created_at'))
            .values('day', 'event_type')
            .annotate(count=Count('id'))
            .order_by('day')
        )
        daily_map = {}
        for row in daily_qs:
            d = str(row['day'])
            if d not in daily_map:
                daily_map[d] = {'day': d, 'gen': 0, 'exp': 0, 'other': 0}
            et = row['event_type']
            if et in GENERATED_TYPES:
                daily_map[d]['gen'] += row['count']
            elif et in EXPORTED_TYPES:
                daily_map[d]['exp'] += row['count']
            else:
                daily_map[d]['other'] += row['count']
        daily = sorted(daily_map.values(), key=lambda x: x['day'])

        # Monthly totals last 6 months
        monthly = list(
            events.filter(created_at__gte=since_180)
            .annotate(month=TruncMonth('created_at'))
            .values('month')
            .annotate(count=Count('id'))
            .order_by('month')
        )

        # Credits from new billing model
        credits_data = {'total': None, 'used': 0, 'remaining': None}
        try:
            sub = ws.subscription
            credits_data = {
                'total': sub.credits_limit,       # None = unlimited
                'used': sub.credit_used,
                'remaining': sub.credits_available,  # None = unlimited
            }
        except Exception:
            pass

        generated = sum(type_counts.get(t, 0) for t in GENERATED_TYPES)
        exported = sum(type_counts.get(t, 0) for t in EXPORTED_TYPES)

        return Response({
            'total_events': total,
            'by_type': by_type,
            'daily': daily,
            'monthly': [{'month': row['month'].strftime('%b'), 'count': row['count']} for row in monthly],
            'generated': generated,
            'exported': exported,
            'team_events': sum(v for k, v in type_counts.items() if k.startswith('team.')),
            'automation_runs': sum(v for k, v in type_counts.items() if k.startswith('automation.')),
            'credits': credits_data,
        })
