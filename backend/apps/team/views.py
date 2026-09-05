from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status

from apps.accounts.views import get_workspace, require_admin
from apps.accounts.models import WorkspaceMember, Invite
from apps.accounts.serializers import MemberSerializer, InviteSerializer
from apps.activity.utils import log_event
from .models import APIKey
from .serializers import APIKeySerializer


class InviteAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            invite = Invite.objects.select_related('workspace').get(id=pk, status='pending')
        except Invite.DoesNotExist:
            return Response({'detail': 'Invite not found or already used.'}, status=404)

        if invite.email.lower() != request.user.email.lower():
            return Response({'detail': 'This invite is for a different email address.'}, status=403)

        WorkspaceMember.objects.get_or_create(
            workspace=invite.workspace,
            user=request.user,
            defaults={'role': invite.role},
        )
        invite.status = 'accepted'
        invite.save(update_fields=['status'])

        log_event(
            invite.workspace, request.user,
            'team.member_joined',
            f'{request.user.email} joined as {invite.role}',
        )

        return Response({
            'detail': 'Invite accepted.',
            'workspace_id': str(invite.workspace.id),
            'workspace_name': invite.workspace.name,
        })


class MembersView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        members = ws.memberships.select_related('user').all()
        return Response(MemberSerializer(members, many=True).data)


class MemberDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can change member roles.'}, status=403)
        try:
            m = ws.memberships.get(id=pk)
        except WorkspaceMember.DoesNotExist:
            return Response(status=404)
        role = request.data.get('role')
        if role:
            # Block elevating anyone to owner — ownership transfer is not self-serve
            if role == 'owner':
                return Response({'detail': 'Cannot assign the owner role.'}, status=403)
            # Block changing the workspace owner's role
            if m.role == 'owner':
                return Response({'detail': "Cannot change the owner's role."}, status=403)
            m.role = role
            m.save(update_fields=['role'])
        return Response(MemberSerializer(m).data)

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can remove members.'}, status=403)
        try:
            m = ws.memberships.get(id=pk)
        except WorkspaceMember.DoesNotExist:
            return Response(status=404)
        # Block removing the workspace owner
        if m.role == 'owner':
            return Response({'detail': 'The workspace owner cannot be removed.'}, status=403)
        m.delete()
        return Response(status=204)


class APIKeysView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(APIKeySerializer(ws.api_keys.filter(is_active=True), many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can create API keys.'}, status=403)
        name = request.data.get('name', '').strip()
        if not name:
            return Response({'detail': 'Name required.'}, status=400)
        key_obj, raw_key = APIKey.generate(workspace=ws, name=name, created_by=request.user)
        data = APIKeySerializer(key_obj).data
        data['key'] = raw_key
        log_event(ws, request.user, 'api_key_created', f'API key "{name}" created')
        return Response(data, status=201)


class APIKeyDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can delete API keys.'}, status=403)
        try:
            k = ws.api_keys.get(id=pk)
            k.delete()
            return Response(status=204)
        except APIKey.DoesNotExist:
            return Response(status=404)


class InvitesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        return Response(InviteSerializer(ws.invites.all(), many=True).data)

    def post(self, request):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can send invites.'}, status=403)
        email = request.data.get('email', '').strip()
        role = request.data.get('role', 'analyst')
        if not email:
            return Response({'detail': 'Email required.'}, status=400)
        invite = Invite.objects.create(workspace=ws, email=email, invited_by=request.user, role=role)
        log_event(ws, request.user, 'invite_sent', f'Invite sent to {email}')
        try:
            from apps.accounts.email_utils import send_invite_email
            send_invite_email(invite)
        except Exception:
            pass

        # Notify the invited user if they already have an account
        try:
            from apps.accounts.models import User as UserModel, Workspace as WS
            import logging
            logger = logging.getLogger(__name__)

            invited_user = UserModel.objects.filter(email=email).first()
            if invited_user:
                # Prefer the workspace owned by the invited user, fallback to any membership
                invited_ws = (
                    WS.objects.filter(owner=invited_user).first()
                    or WS.objects.filter(memberships__user=invited_user).first()
                )
                if invited_ws:
                    inviter_name = (
                        f'{request.user.first_name} {request.user.last_name}'.strip()
                        or request.user.email
                    )
                    log_event(
                        invited_ws,
                        invited_user,
                        'team.invited',
                        f'{inviter_name} invited you to join "{ws.name}"',
                        metadata={'invite_id': str(invite.id), 'workspace_id': str(ws.id), 'role': role},
                    )
                    logger.info('Invite notification created for %s on workspace %s', email, invited_ws.id)
                else:
                    logger.warning('Could not find workspace for invited user %s', email)
        except Exception as exc:
            import logging
            logging.getLogger(__name__).error('Failed to create invite notification for %s: %s', email, exc)

        return Response(InviteSerializer(invite).data, status=201)


class InviteCancelView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        ws = get_workspace(request)
        if not require_admin(request.user, ws):
            return Response({'detail': 'Only admins can cancel invites.'}, status=403)
        try:
            invite = ws.invites.get(id=pk)
            invite.delete()
            return Response(status=204)
        except Invite.DoesNotExist:
            return Response(status=404)
