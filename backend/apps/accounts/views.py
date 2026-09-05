from django.contrib.auth import authenticate
from django.conf import settings
from rest_framework import status, throttling as rest_throttle
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
import requests as http_requests

from .models import User, Workspace, WorkspaceMember, Invite
from .serializers import (
    UserSerializer, WorkspaceSerializer, RegisterSerializer,
    MemberSerializer, InviteSerializer
)


def get_workspace(request):
    ws_id = request.headers.get('X-Workspace-ID') or request.query_params.get('workspace_id')
    if ws_id:
        try:
            return Workspace.objects.get(id=ws_id, members=request.user)
        except Workspace.DoesNotExist:
            pass
    return request.user.workspaces.order_by('memberships__joined_at').first()


def get_member_role(user, workspace):
    """Returns the user's role string in the workspace, or None if not a member."""
    try:
        return WorkspaceMember.objects.get(workspace=workspace, user=user).role
    except WorkspaceMember.DoesNotExist:
        return None


def require_editor(user, workspace):
    """owner/admin/editor can generate creatives."""
    return get_member_role(user, workspace) in ('owner', 'admin', 'editor')


def require_admin(user, workspace):
    """Only owner/admin can manage team, billing, brand kit, API keys."""
    return get_member_role(user, workspace) in ('owner', 'admin')


class LoginRateThrottle(rest_throttle.AnonRateThrottle):
    """Strict per-IP throttle for login attempts (10 req/min)."""
    scope = 'login'


class TokenObtainView(APIView):
    permission_classes = [AllowAny]
    throttle_classes = [LoginRateThrottle]

    def post(self, request):
        import pyotp
        email = request.data.get('email', '')
        password = request.data.get('password', '')
        totp_code = request.data.get('totp_code', '')

        # Reject non-string types early — passing a dict/list to authenticate()
        # causes an unhandled TypeError (HTTP 500) that leaks server internals.
        if not isinstance(email, str) or not isinstance(password, str):
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        user = authenticate(request, username=email, password=password)
        if not user:
            return Response({'detail': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

        if user.totp_enabled:
            if not totp_code:
                return Response({'requires_2fa': True}, status=status.HTTP_200_OK)
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(totp_code, valid_window=1):
                return Response({'detail': 'Invalid 2FA code.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        return Response(
            {'detail': 'Troxa.ai is currently in closed beta. Contact info@rmgs.online to request access.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    def _post_disabled(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        username = _unique_username(d['email'])

        user = User.objects.create_user(
            email=d['email'],
            username=username,
            password=d['password'],
            first_name=d.get('first_name', ''),
            last_name=d.get('last_name', ''),
        )

        ws_name = f"{user.first_name}'s Workspace" if user.first_name else 'My Workspace'
        workspace = Workspace.objects.create(name=ws_name, owner=user, workspace_type='personal')
        WorkspaceMember.objects.create(workspace=workspace, user=user, role='owner')

        _bootstrap_free_trial(workspace, user)

        return Response(UserSerializer(user, context={'request': request}).data, status=status.HTTP_201_CREATED)


def _bootstrap_free_trial(workspace, user):
    from apps.billing.models import Plan, Subscription, CreditTransaction
    from django.conf import settings
    from django.utils import timezone
    from datetime import timedelta

    plan, _ = Plan.objects.get_or_create(
        tier='free',
        defaults={
            'name': 'Free Trial',
            'monthly_credits': 50,
            'trial_days': 14,
            'trial_credits': 50,
            'member_limit': 1,
            'price_monthly': 0,
            'features': [],
        }
    )

    credits = settings.FREE_TRIAL_CREDITS
    now = timezone.now()
    Subscription.objects.create(
        workspace=workspace,
        plan=plan,
        status='trialing',
        monthly_usage=0,
        credit_bonus=credits,
        credit_used=0,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    CreditTransaction.objects.create(
        workspace=workspace,
        amount=credits,
        transaction_type='credit',
        description='Free trial credits',
        reference_type='trial',
    )


class GoogleAuthView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        import pyotp
        access_token = request.data.get('access_token', '')
        totp_code = request.data.get('totp_code', '')

        if not access_token:
            return Response({'detail': 'Google access_token required.'}, status=status.HTTP_400_BAD_REQUEST)

        resp = http_requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10,
        )
        if not resp.ok:
            return Response({'detail': 'Invalid Google token.'}, status=status.HTTP_401_UNAUTHORIZED)

        userinfo = resp.json()
        email = userinfo.get('email', '')
        if not email:
            return Response({'detail': 'Could not retrieve email from Google.'}, status=status.HTTP_400_BAD_REQUEST)

        # Block new registrations — closed beta
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Troxa.ai is currently in closed beta. Contact info@rmgs.online to request access.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        # If account has a password and hasn't linked Google yet → require confirmation
        if user.has_usable_password() and not user.google_linked:
            return Response({'action': 'link_required', 'email': email}, status=status.HTTP_200_OK)

        # Check 2FA
        if user.totp_enabled:
            if not totp_code:
                return Response({'requires_2fa': True}, status=status.HTTP_200_OK)
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(totp_code, valid_window=1):
                return Response({'detail': 'Invalid 2FA code.'}, status=status.HTTP_401_UNAUTHORIZED)

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


class GoogleLinkView(APIView):
    """Verify password then permanently link Google to the existing account."""
    permission_classes = [AllowAny]

    def post(self, request):
        access_token = request.data.get('access_token', '')
        password = request.data.get('password', '')

        if not access_token or not password:
            return Response({'detail': 'access_token and password required.'}, status=status.HTTP_400_BAD_REQUEST)

        resp = http_requests.get(
            'https://www.googleapis.com/oauth2/v3/userinfo',
            headers={'Authorization': f'Bearer {access_token}'},
            timeout=10,
        )
        if not resp.ok:
            return Response({'detail': 'Invalid Google token.'}, status=status.HTTP_401_UNAUTHORIZED)

        email = resp.json().get('email', '')
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({'detail': 'Account not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user.check_password(password):
            return Response({'detail': 'Incorrect password.'}, status=status.HTTP_401_UNAUTHORIZED)

        user.google_linked = True
        user.save(update_fields=['google_linked'])

        refresh = RefreshToken.for_user(user)
        return Response({'access': str(refresh.access_token), 'refresh': str(refresh)})


def _unique_username(email):
    base = email.split('@')[0]
    username = base
    counter = 1
    while User.objects.filter(username=username).exists():
        username = f'{base}{counter}'
        counter += 1
    return username


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        user = request.user
        data = request.data

        for field in ['first_name', 'last_name', 'bio', 'location', 'timezone', 'language', 'twitter', 'linkedin', 'website']:
            if field in data:
                setattr(user, field, data[field])

        if 'avatar' in request.FILES:
            user.avatar = request.FILES['avatar']

        user.save()
        return Response(UserSerializer(user, context={'request': request}).data)


class TwoFactorSetupView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import pyotp, qrcode, io, base64

        user = request.user
        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.save(update_fields=['totp_secret'])

        uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name='Troxa.ai',
        )

        qr = qrcode.QRCode(version=1, box_size=8, border=4)
        qr.add_data(uri)
        qr.make(fit=True)
        img = qr.make_image(fill_color='black', back_color='white')
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        qr_base64 = base64.b64encode(buf.getvalue()).decode()

        return Response({
            'secret': secret,
            'qr_code': f'data:image/png;base64,{qr_base64}',
        })


class TwoFactorConfirmView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import pyotp
        user = request.user
        code = request.data.get('code', '')

        if not user.totp_secret:
            return Response({'detail': 'No 2FA setup in progress.'}, status=400)

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response({'detail': 'Invalid code. Please try again.'}, status=400)

        user.totp_enabled = True
        user.save(update_fields=['totp_enabled'])
        return Response({'detail': '2FA enabled successfully.'})


class TwoFactorDisableView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import pyotp
        user = request.user
        code = request.data.get('code', '')

        if not user.totp_enabled:
            return Response({'detail': '2FA is not enabled.'}, status=400)

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response({'detail': 'Invalid code.'}, status=400)

        user.totp_enabled = False
        user.totp_secret = ''
        user.save(update_fields=['totp_enabled', 'totp_secret'])
        return Response({'detail': '2FA disabled.'})


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_password = request.data.get('current_password', '')
        new_password = request.data.get('new_password', '')

        if not current_password or not new_password:
            return Response({'detail': 'Both current and new password are required.'}, status=400)
        if not user.check_password(current_password):
            return Response({'detail': 'Current password is incorrect.'}, status=400)
        if len(new_password) < 6:
            return Response({'detail': 'New password must be at least 6 characters.'}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed successfully.'})


class WorkspaceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        workspaces = request.user.workspaces.all()
        return Response(WorkspaceSerializer(workspaces, many=True, context={'request': request}).data)

    def post(self, request):
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)
        ws = Workspace.objects.create(name=name, owner=request.user)
        WorkspaceMember.objects.create(workspace=ws, user=request.user, role='owner')
        _bootstrap_free_trial(ws, request.user)
        return Response(WorkspaceSerializer(ws, context={'request': request}).data, status=201)


class WorkspaceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_ws(self, pk, user):
        try:
            return Workspace.objects.get(id=pk, members=user)
        except Workspace.DoesNotExist:
            return None

    def get(self, request, pk):
        ws = self._get_ws(pk, request.user)
        if not ws:
            return Response(status=404)
        return Response(WorkspaceSerializer(ws, context={'request': request}).data)


class WorkspaceMembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        members = ws.memberships.select_related('user').all()
        return Response(MemberSerializer(members, many=True).data)


_ADMIN_ROLES = {'owner', 'admin'}


class WorkspaceMemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk, member_id):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        # Only admins/owners may change member roles
        if get_member_role(request.user, ws) not in _ADMIN_ROLES:
            return Response({'detail': 'Admin permission required.'}, status=403)
        try:
            m = ws.memberships.get(id=member_id)
        except Exception:
            return Response(status=404)
        # Protect the owner slot — cannot be reassigned via API
        if m.role == 'owner':
            return Response({'detail': 'Cannot modify the workspace owner role.'}, status=403)
        role = request.data.get('role')
        if role:
            if role == 'owner':
                return Response({'detail': 'Cannot assign owner role via API.'}, status=403)
            m.role = role
            m.save(update_fields=['role'])
        return Response(MemberSerializer(m).data)

    def delete(self, request, pk, member_id):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        # Only admins/owners may remove members
        if get_member_role(request.user, ws) not in _ADMIN_ROLES:
            return Response({'detail': 'Admin permission required.'}, status=403)
        try:
            m = ws.memberships.get(id=member_id)
        except Exception:
            return Response(status=404)
        # Protect the owner from being removed
        if m.role == 'owner':
            return Response({'detail': 'Cannot remove the workspace owner.'}, status=403)
        m.delete()
        return Response(status=204)


class WorkspaceInvitesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        return Response(InviteSerializer(ws.invites.all(), many=True).data)

    def post(self, request, pk):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        # Only admins/owners may send invites
        if get_member_role(request.user, ws) not in _ADMIN_ROLES:
            return Response({'detail': 'Admin permission required.'}, status=403)
        email = request.data.get('email', '').strip()
        role = request.data.get('role', 'analyst')
        if not email:
            return Response({'detail': 'Email required.'}, status=400)
        # Cannot invite someone with the owner role
        if role == 'owner':
            return Response({'detail': 'Cannot invite with owner role.'}, status=403)
        invite = Invite.objects.create(workspace=ws, email=email, invited_by=request.user, role=role)
        try:
            from .email_utils import send_invite_email
            send_invite_email(invite)
        except Exception:
            pass
        return Response(InviteSerializer(invite).data, status=201)


class WorkspaceInviteCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, invite_id):
        try:
            ws = Workspace.objects.get(id=pk, members=request.user)
        except Workspace.DoesNotExist:
            return Response(status=404)
        # Only admins/owners may cancel invites
        if get_member_role(request.user, ws) not in _ADMIN_ROLES:
            return Response({'detail': 'Admin permission required.'}, status=403)
        try:
            invite = ws.invites.get(id=invite_id)
            invite.delete()
            return Response(status=204)
        except Exception:
            return Response(status=404)


class InviteAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, token):
        try:
            invite = Invite.objects.select_related('workspace').get(token=token, status='pending')
        except Invite.DoesNotExist:
            return Response({'detail': 'Invalid or expired invite.'}, status=400)
        if invite.email.lower() != request.user.email.lower():
            return Response({'detail': 'wrong_account', 'invite_email': invite.email}, status=403)
        WorkspaceMember.objects.get_or_create(
            workspace=invite.workspace,
            user=request.user,
            defaults={'role': invite.role},
        )
        invite.status = 'accepted'
        invite.save(update_fields=['status'])
        return Response({
            'detail': 'Joined workspace.',
            'workspace_id': str(invite.workspace.id),
            'workspace_name': invite.workspace.name,
        })


class InvitePublicView(APIView):
    """Public endpoint — returns invite metadata without auth."""
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        try:
            invite = Invite.objects.select_related('workspace', 'invited_by').get(token=token)
        except Invite.DoesNotExist:
            return Response({'detail': 'Invite not found.'}, status=404)
        has_account = User.objects.filter(email__iexact=invite.email).exists()
        return Response({
            'token': str(invite.token),
            'email': invite.email,
            'role': invite.role,
            'workspace_name': invite.workspace.name,
            'invited_by': invite.invited_by.email if invite.invited_by else None,
            'status': invite.status,
            'has_account': has_account,
        })


class RegisterWithInviteView(APIView):
    """Create account using a valid invite token."""
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get('invite_token')
        if not token:
            return Response({'detail': 'invite_token required.'}, status=400)
        try:
            invite = Invite.objects.select_related('workspace').get(token=token, status='pending')
        except Invite.DoesNotExist:
            return Response({'detail': 'Invalid or expired invite.'}, status=400)

        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        d = ser.validated_data

        if d['email'].lower() != invite.email.lower():
            return Response({'detail': 'Email does not match the invite.'}, status=400)

        username = _unique_username(d['email'])
        user = User.objects.create_user(
            email=d['email'],
            username=username,
            password=d['password'],
            first_name=d.get('first_name', ''),
            last_name=d.get('last_name', ''),
        )

        ws_name = f"{user.first_name}'s Workspace" if user.first_name else 'My Workspace'
        workspace = Workspace.objects.create(name=ws_name, owner=user, workspace_type='personal')
        WorkspaceMember.objects.create(workspace=workspace, user=user, role='owner')
        _bootstrap_free_trial(workspace, user)

        WorkspaceMember.objects.get_or_create(
            workspace=invite.workspace,
            user=user,
            defaults={'role': invite.role},
        )
        invite.status = 'accepted'
        invite.save(update_fields=['status'])

        refresh = RefreshToken.for_user(user)
        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'workspace_id': str(invite.workspace.id),
            'workspace_name': invite.workspace.name,
        }, status=201)
