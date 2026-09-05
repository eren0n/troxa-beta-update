from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.contrib.auth import get_user_model
from django.db.models import Count

from apps.accounts.models import Workspace, WorkspaceMember, MgmtPermission
from apps.billing.models import Plan, Subscription, CreditTransaction
from apps.creatives.models import GenerationJob, GeneratedCreative, VideoJob

User = get_user_model()

# Full-access admins — always see every tab
RMGS_ADMINS = {'eren@rmgs.online', 'kaan@rmgs.online', 'tolga@rmgs.online'}

# Can access Upper Management tab (configure who sees what)
UPPER_MANAGEMENT = {'eren@rmgs.online', 'cuneyt@rmgs.online'}

ALL_TABS = ['meta', 'workspaces', 'users', 'plans', 'data-users']


def _user_tabs(user):
    """Return the list of tabs this user is allowed to see. Empty = no access."""
    if user.email in RMGS_ADMINS:
        return ALL_TABS
    try:
        return user.mgmt_permission.tabs or []
    except MgmtPermission.DoesNotExist:
        return []


def _has_tab(user, tab):
    return tab in _user_tabs(user)


class IsRMGSAdmin(IsAuthenticated):
    """Allows full-access admins OR users with at least one tab permission."""
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return len(_user_tabs(request.user)) > 0


class IsUpperManagement(IsAuthenticated):
    def has_permission(self, request, view):
        if not super().has_permission(request, view):
            return False
        return request.user.email in UPPER_MANAGEMENT


def _require_tab(user, tab):
    """Return 403 response if user can't access this tab, else None."""
    if not _has_tab(user, tab):
        return Response({'detail': f'No access to tab: {tab}'}, status=403)
    return None


# ──────────────────────────────────────────────────────────
# My permissions (used by frontend on load)
# ──────────────────────────────────────────────────────────

class MgmtMyPermissionsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        tabs = _user_tabs(request.user)
        return Response({
            'tabs': tabs,
            'is_upper_management': request.user.email in UPPER_MANAGEMENT,
        })


# ──────────────────────────────────────────────────────────
# Upper Management — grant/revoke tab access per user
# ──────────────────────────────────────────────────────────

class MgmtPermissionsView(APIView):
    permission_classes = [IsUpperManagement]

    def get(self, request):
        users = User.objects.order_by('email')
        result = []
        for u in users:
            try:
                tabs = u.mgmt_permission.tabs
            except MgmtPermission.DoesNotExist:
                tabs = []
            result.append({
                'id': u.id,
                'email': u.email,
                'full_name': u.get_full_name().strip() or '—',
                'tabs': tabs,
                'is_rmgs_admin': u.email in RMGS_ADMINS,
                'is_upper_management': u.email in UPPER_MANAGEMENT,
            })
        return Response(result)


class MgmtPermissionDetailView(APIView):
    permission_classes = [IsUpperManagement]

    def patch(self, request, pk):
        try:
            u = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=404)
        tabs = request.data.get('tabs', [])
        tabs = [t for t in tabs if t in ALL_TABS]
        perm, _ = MgmtPermission.objects.get_or_create(user=u)
        perm.tabs = tabs
        perm.save(update_fields=['tabs'])
        return Response({'id': u.id, 'email': u.email, 'tabs': perm.tabs})


# ──────────────────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────────────────

class MgmtUsersView(APIView):
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'users')
        if guard: return guard
        users = User.objects.annotate(ws_count=Count('workspaces')).order_by('-date_joined')
        data = [
            {
                'id': u.id,
                'email': u.email,
                'full_name': u.get_full_name().strip() or '—',
                'first_name': u.first_name,
                'last_name': u.last_name,
                'date_joined': u.date_joined,
                'is_active': u.is_active,
                'ws_count': u.ws_count,
            }
            for u in users
        ]
        return Response(data)

    def post(self, request):
        guard = _require_tab(request.user, 'users')
        if guard: return guard
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '').strip()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()

        if not email or not password:
            return Response({'error': 'email and password required'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'User with this email already exists'}, status=400)

        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )
        return Response({
            'id': user.id,
            'email': user.email,
            'full_name': user.get_full_name().strip() or '—',
            'first_name': user.first_name,
            'last_name': user.last_name,
            'date_joined': user.date_joined,
            'is_active': user.is_active,
            'ws_count': 0,
        }, status=201)


class MgmtUserDetailView(APIView):
    permission_classes = [IsRMGSAdmin]

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'users')
        if guard: return guard
        try:
            u = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=404)

        for field in ('first_name', 'last_name', 'is_active'):
            if field in request.data:
                setattr(u, field, request.data[field])

        new_email = request.data.get('email', '').strip().lower()
        if new_email and new_email != u.email:
            if User.objects.filter(email=new_email).exclude(pk=pk).exists():
                return Response({'error': 'Email already in use'}, status=400)
            u.email = new_email
            u.username = new_email

        new_password = request.data.get('password', '').strip()
        if new_password:
            u.set_password(new_password)

        u.save()
        return Response({
            'id': u.id,
            'email': u.email,
            'full_name': u.get_full_name().strip() or '—',
            'first_name': u.first_name,
            'last_name': u.last_name,
            'is_active': u.is_active,
        })


# ──────────────────────────────────────────────────────────
# Workspaces
# ──────────────────────────────────────────────────────────

def _ws_data(ws):
    try:
        sub              = ws.subscription
        plan_name        = sub.plan.name if sub.plan else '—'
        plan_tier        = sub.plan.tier if sub.plan else '—'
        sub_status       = sub.status
        sub_id           = sub.id
        monthly_usage    = sub.monthly_usage
        credit_bonus     = sub.credit_bonus
        credit_used      = sub.credit_used
        monthly_credits  = sub.plan.monthly_credits
        unlimited_usage  = sub.plan.unlimited_usage
        credits_available = None if unlimited_usage else sub.credits_available
    except Exception:
        plan_name        = '—'
        plan_tier        = '—'
        sub_status       = 'none'
        sub_id           = None
        monthly_usage    = 0
        credit_bonus     = 0
        credit_used      = 0
        monthly_credits  = 0
        unlimited_usage  = False
        credits_available = 0

    member_count   = ws.members.count()
    job_count      = ws.generation_jobs.count()
    creative_count = ws.creatives.count()

    return {
        'id': str(ws.id),
        'name': ws.name,
        'code': ws.code or '',
        'owner_email': ws.owner.email if ws.owner else '—',
        'owner_name': ws.owner.get_full_name().strip() if ws.owner else '—',
        'created_at': ws.created_at,
        'plan_name': plan_name,
        'plan_tier': plan_tier,
        'sub_status': sub_status,
        'sub_id': sub_id,
        # credit fields
        'monthly_credits':  monthly_credits,
        'monthly_usage':    monthly_usage,
        'credit_bonus':     credit_bonus,
        'credits_available': credits_available,  # None = unlimited
        'credit_used':      credit_used,
        'unlimited_usage':  unlimited_usage,
        # counts
        'member_count':  member_count,
        'job_count':     job_count,
        'creative_count': creative_count,
    }


class MgmtWorkspacesView(APIView):
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        workspaces = Workspace.objects.select_related('owner').order_by('-created_at')
        return Response([_ws_data(ws) for ws in workspaces])

    def post(self, request):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        name = request.data.get('name', '').strip()
        owner_email = request.data.get('owner_email', '').strip().lower()
        plan_tier = request.data.get('plan_tier', 'free')

        if not name or not owner_email:
            return Response({'error': 'name and owner_email required'}, status=400)

        owner = User.objects.filter(email=owner_email).first()
        if not owner:
            return Response({'error': f'No user with email {owner_email}'}, status=400)

        ws = Workspace.objects.create(name=name, owner=owner, workspace_type='team')
        WorkspaceMember.objects.create(workspace=ws, user=owner, role='owner')

        plan = Plan.objects.filter(tier=plan_tier).first()
        if plan:
            Subscription.objects.create(
                workspace=ws,
                plan=plan,
                status='active',
                credit_bonus=plan.trial_credits,
                credit_used=0,
            )

        return Response(_ws_data(ws), status=201)


class MgmtWorkspaceDetailView(APIView):
    permission_classes = [IsRMGSAdmin]

    def _get_ws(self, pk):
        try:
            return Workspace.objects.select_related('owner').get(pk=pk)
        except Workspace.DoesNotExist:
            return None

    def get(self, request, pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        ws = self._get_ws(pk)
        if not ws:
            return Response(status=404)

        members = WorkspaceMember.objects.filter(workspace=ws).select_related('user')
        members_data = [
            {
                'id': m.id,
                'user_id': m.user.id,
                'email': m.user.email,
                'full_name': m.user.get_full_name().strip() or '—',
                'role': m.role,
                'joined_at': m.joined_at,
            }
            for m in members
        ]

        jobs = GenerationJob.objects.filter(workspace=ws).order_by('-created_at')[:10]
        jobs_data = [
            {
                'id': str(j.id),
                'model_name': j.model_name,
                'num_images': j.num_images,
                'status': j.status,
                'created_at': j.created_at,
            }
            for j in jobs
        ]

        return Response({
            **_ws_data(ws),
            'members': members_data,
            'recent_jobs': jobs_data,
        })


class MgmtWorkspaceMembersView(APIView):
    """Add or remove members from a workspace."""
    permission_classes = [IsRMGSAdmin]

    def post(self, request, pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        try:
            ws = Workspace.objects.get(pk=pk)
        except Workspace.DoesNotExist:
            return Response(status=404)

        email = request.data.get('email', '').strip().lower()
        role = request.data.get('role', 'editor')
        if not email:
            return Response({'error': 'email required'}, status=400)

        user = User.objects.filter(email=email).first()
        if not user:
            return Response({'error': f'No user with email {email}'}, status=404)

        # Hard member-limit check (None = unlimited for enterprise)
        try:
            limit = ws.subscription.plan.member_limit
            if limit is not None:
                current_count = WorkspaceMember.objects.filter(workspace=ws).count()
                if current_count >= limit:
                    return Response(
                        {'error': f'Member limit reached ({limit}). Upgrade the plan to add more members.'},
                        status=400,
                    )
        except Exception:
            pass

        m, created = WorkspaceMember.objects.get_or_create(
            workspace=ws, user=user,
            defaults={'role': role},
        )
        if not created:
            return Response({'error': 'User is already a member'}, status=400)

        return Response({
            'id': m.id,
            'user_id': user.id,
            'email': user.email,
            'full_name': user.get_full_name().strip() or '—',
            'role': m.role,
            'joined_at': m.joined_at,
        }, status=201)

    def delete(self, request, pk, member_pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        try:
            ws = Workspace.objects.get(pk=pk)
            m = WorkspaceMember.objects.get(pk=member_pk, workspace=ws)
        except (Workspace.DoesNotExist, WorkspaceMember.DoesNotExist):
            return Response(status=404)
        if m.role == 'owner':
            return Response({'error': 'Cannot remove the owner'}, status=400)
        m.delete()
        return Response(status=204)


class MgmtWorkspaceCreditsView(APIView):
    permission_classes = [IsRMGSAdmin]

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        try:
            ws = Workspace.objects.get(pk=pk)
            sub = ws.subscription
        except (Workspace.DoesNotExist, Subscription.DoesNotExist):
            return Response(status=404)

        amount = request.data.get('credit_bonus')
        if amount is None:
            return Response({'error': 'credit_bonus required'}, status=400)

        sub.credit_bonus = int(amount)
        sub.save(update_fields=['credit_bonus'])

        CreditTransaction.objects.create(
            workspace=ws,
            amount=int(amount),
            transaction_type='credit',
            description=f'Bonus credit adjustment by {request.user.email}',
        )

        return Response({
            'credit_bonus':     sub.credit_bonus,
            'monthly_usage':    sub.monthly_usage,
            'credits_available': sub.credits_available,
        })


class MgmtWorkspacePlanView(APIView):
    permission_classes = [IsRMGSAdmin]

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        try:
            ws = Workspace.objects.get(pk=pk)
        except Workspace.DoesNotExist:
            return Response(status=404)

        plan_tier = request.data.get('plan_tier')
        plan = Plan.objects.filter(tier=plan_tier).first()
        if not plan:
            return Response({'error': f'Plan "{plan_tier}" not found'}, status=400)

        try:
            sub = ws.subscription
            sub.plan = plan
            sub.save(update_fields=['plan'])
        except Subscription.DoesNotExist:
            Subscription.objects.create(
                workspace=ws,
                plan=plan,
                status='active',
                credit_bonus=plan.trial_credits,
                credit_used=0,
            )

        return Response(_ws_data(ws))


class MgmtWorkspaceCodeView(APIView):
    """Update the short code used in creative file names (e.g. TROXA_ES_S_0001_1x1)."""
    permission_classes = [IsRMGSAdmin]

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'workspaces')
        if guard: return guard
        try:
            ws = Workspace.objects.get(pk=pk)
        except Workspace.DoesNotExist:
            return Response(status=404)

        raw = request.data.get('code', '').strip().upper()
        if not raw:
            return Response({'error': 'code is required'}, status=400)
        if len(raw) > 8:
            return Response({'error': 'code must be 8 characters or fewer'}, status=400)
        if not raw.isalnum():
            return Response({'error': 'code must be alphanumeric (letters and numbers only)'}, status=400)

        ws.code = raw
        ws.save(update_fields=['code'])
        return Response({'code': ws.code})


# ──────────────────────────────────────────────────────────
# Plans
# ──────────────────────────────────────────────────────────

def _plan_data(p):
    return {
        'id':              p.id,
        'name':            p.name,
        'tier':            p.tier,
        'monthly_credits': p.monthly_credits,
        'trial_days':      p.trial_days,
        'trial_credits':   p.trial_credits,
        'unlimited_usage': p.unlimited_usage,
        'member_limit':    p.member_limit,   # null = unlimited
        'price_monthly':   str(p.price_monthly),
        'features':        p.features,
        'is_active':       p.is_active,
    }


class MgmtPlansView(APIView):
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'plans')
        if guard: return guard
        plans = Plan.objects.order_by('price_monthly')
        return Response([_plan_data(p) for p in plans])

    def post(self, request):
        guard = _require_tab(request.user, 'plans')
        if guard: return guard
        name = request.data.get('name', '').strip()
        tier = request.data.get('tier', '').strip()
        if not name or not tier:
            return Response({'error': 'name and tier required'}, status=400)
        raw_member = request.data.get('member_limit')
        member_limit = None if raw_member in (None, '', 'null') else int(raw_member)
        plan = Plan.objects.create(
            name            = name,
            tier            = tier,
            monthly_credits = int(request.data.get('monthly_credits', 0)),
            trial_days      = int(request.data.get('trial_days', 0)),
            trial_credits   = int(request.data.get('trial_credits', 0)),
            unlimited_usage = bool(request.data.get('unlimited_usage', False)),
            member_limit    = member_limit,
            price_monthly   = request.data.get('price_monthly', '0.00'),
            features        = request.data.get('features', []),
            is_active       = request.data.get('is_active', True),
        )
        return Response(_plan_data(plan), status=201)


class MgmtPlanDetailView(APIView):
    permission_classes = [IsRMGSAdmin]

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'plans')
        if guard: return guard
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response(status=404)

        for field in ('name', 'monthly_credits', 'trial_days', 'trial_credits',
                      'unlimited_usage', 'price_monthly', 'is_active', 'features'):
            if field in request.data:
                setattr(plan, field, request.data[field])
        if 'member_limit' in request.data:
            raw = request.data['member_limit']
            plan.member_limit = None if raw in (None, '', 'null') else int(raw)
        plan.save()
        return Response(_plan_data(plan))

    def delete(self, request, pk):
        guard = _require_tab(request.user, 'plans')
        if guard: return guard
        try:
            plan = Plan.objects.get(pk=pk)
        except Plan.DoesNotExist:
            return Response(status=404)
        plan.delete()
        return Response(status=204)


# ──────────────────────────────────────────────────────────
# Data Users
# ──────────────────────────────────────────────────────────

class MgmtDataUsersView(APIView):
    permission_classes = [IsRMGSAdmin]

    def get(self, request):
        guard = _require_tab(request.user, 'data-users')
        if guard: return guard
        users = User.objects.order_by('email').values('id', 'email', 'first_name', 'last_name', 'is_data_user', 'date_joined')
        return Response(list(users))

    def patch(self, request, pk):
        guard = _require_tab(request.user, 'data-users')
        if guard: return guard
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=404)
        is_data_user = request.data.get('is_data_user')
        if is_data_user is None:
            return Response({'error': 'is_data_user required'}, status=400)
        user.is_data_user = bool(is_data_user)
        user.save(update_fields=['is_data_user'])
        return Response({'id': user.pk, 'email': user.email, 'is_data_user': user.is_data_user})
