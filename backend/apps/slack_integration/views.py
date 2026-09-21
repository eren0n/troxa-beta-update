import hashlib
import hmac
import json
import logging
import threading
import time
from urllib.parse import urlencode

import requests as http_requests

from django.conf import settings
from django.core.signing import Signer, BadSignature
from django.shortcuts import redirect

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.accounts.views import get_workspace
from django.core.exceptions import ValidationError

from apps.creatives.rating import apply_rating, toggle_winner
from .models import SlackInstallation, SlackChannel, ALL_CONTENT_TYPES
from .services import (
    RATE_ACTION_ID, WINNER_ACTION_ID, refresh_rating_row,
    GEN_ACTIONS, GEN_BLOCK_BRIEF, GEN_BLOCK_CAMPAIGN, GEN_BLOCK_COUNT, GEN_BLOCK_PROMPT,
    GENERATE_CALLBACK_ID, briefs_for_campaign, generate_modal_view,
    _post as _post_slack,   # same Slack API helper the notifiers use
)

logger = logging.getLogger(__name__)

SLACK_OAUTH_URL = 'https://slack.com/oauth/v2/authorize'
SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access'
SLACK_API       = 'https://slack.com/api'
BOT_SCOPES      = 'chat:write,files:write,commands,channels:read'


def _redirect_uri():
    return f'{settings.SITE_BASE_URL}/api/slack/oauth/callback/'


def _channel_data(sc):
    return {
        'id':              sc.id,
        'channel_id':      sc.channel_id,
        'channel_name':    sc.channel_name,
        'label':           sc.label,
        'content_types':   sc.content_types,
        'auto_post_types': sc.auto_post_types,
        'connected_at':    sc.connected_at,
    }


class SlackInstallView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        signer = Signer()
        state  = signer.sign(str(ws.id))
        params = {
            'client_id':    settings.SLACK_CLIENT_ID,
            'scope':        BOT_SCOPES,
            'redirect_uri': _redirect_uri(),
            'state':        state,
        }
        return Response({'url': f'{SLACK_OAUTH_URL}?{urlencode(params)}'})


class SlackOAuthCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        frontend_base = settings.SITE_BASE_URL
        code  = request.GET.get('code')
        state = request.GET.get('state', '')
        error = request.GET.get('error')

        if error or not code:
            return redirect(f'{frontend_base}/dashboard/integrations?slack=cancelled')

        signer = Signer()
        try:
            workspace_id = signer.unsign(state)
        except BadSignature:
            return redirect(f'{frontend_base}/dashboard/integrations?slack=error')

        resp = http_requests.post(
            SLACK_TOKEN_URL,
            data={
                'client_id':     settings.SLACK_CLIENT_ID,
                'client_secret': settings.SLACK_CLIENT_SECRET,
                'code':          code,
                'redirect_uri':  _redirect_uri(),
            },
            timeout=10,
        )
        data = resp.json()
        if not data.get('ok'):
            return redirect(f'{frontend_base}/dashboard/integrations?slack=error')

        SlackInstallation.objects.update_or_create(
            team_id=data['team']['id'],
            defaults={'team_name': data['team']['name'], 'bot_token': data['access_token']},
        )
        return redirect(
            f'{frontend_base}/dashboard/integrations?slack=installed&team={data["team"]["name"]}'
        )


class SlackCommandView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        if not _verify_slack_signature(request):
            return Response(status=403)

        text          = request.data.get('text', '').strip().strip("'\"")
        command_parts = text.split()

        if not command_parts:
            return _help_response()

        cmd = command_parts[0].lower()
        if cmd == 'setup':
            workspace_key = command_parts[1] if len(command_parts) > 1 else ''
            return _handle_setup(request, workspace_key)
        if cmd == 'disconnect':
            return _handle_disconnect(request)
        if cmd == 'generate':
            return _handle_generate_command(request)
        return _help_response()


def _help_response():
    return Response({
        'response_type': 'ephemeral',
        'text': (
            ':wave: *Troxa Commands*\n'
            '• `/troxa setup <your-troxa-key>` — Connect this channel to your Troxa workspace\n'
            '• `/troxa generate` — Generate creatives without leaving Slack\n'
            '• `/troxa disconnect` — Disconnect this channel\n\n'
            'Find your Troxa Key in *Dashboard → Integrations → Slack*.'
        ),
    })


def _handle_setup(request, workspace_key):
    from apps.accounts.models import Workspace

    team_id    = request.data.get('team_id', '')
    channel_id = request.data.get('channel_id', '')

    try:
        installation = SlackInstallation.objects.get(team_id=team_id)
    except SlackInstallation.DoesNotExist:
        return Response({
            'response_type': 'ephemeral',
            'text': ':x: Troxa bot is not properly installed. Please reinstall from your Troxa dashboard.',
        })

    # The workspace_key is a signed token produced by SlackStatusView
    # (Django Signer wrapping the workspace UUID).  Verifying the signature
    # ensures the token was issued by our dashboard to a legitimate workspace
    # member — raw UUIDs and guessed values are rejected, closing the IDOR.
    signer = Signer()
    try:
        workspace_id = signer.unsign(workspace_key)
        workspace    = Workspace.objects.get(id=workspace_id)
    except (BadSignature, Workspace.DoesNotExist, Exception):
        return Response({
            'response_type': 'ephemeral',
            'text': ':x: Invalid Troxa Key. Find your key in *Dashboard → Integrations → Slack*.',
        })

    sc, created = SlackChannel.objects.update_or_create(
        workspace=workspace,
        channel_id=channel_id,
        defaults={
            'installation':             installation,
            'channel_name':             request.data.get('channel_name', ''),
            'connected_by_slack_user':  request.data.get('user_id', ''),
            'content_types':            ALL_CONTENT_TYPES,  # default: receive everything
        },
    )

    verb = 'connected' if created else 'updated'
    return Response({
        'response_type': 'in_channel',
        'text': (
            f':white_check_mark: *Troxa {verb}!*\n'
            f'This channel will receive all notifications for workspace *{workspace.name}*.\n'
            f'You can customize which content types are posted from *Dashboard → Integrations → Slack*.'
        ),
    })


def _channel_for(request_or_ids):
    """Resolve the SlackChannel a command or interaction came from, or None."""
    team_id, channel_id = request_or_ids
    return (SlackChannel.objects
            .filter(channel_id=channel_id, installation__team_id=team_id)
            .select_related('installation', 'workspace').first())


def _handle_generate_command(request):
    """
    Open the generate dialog.

    Slack invalidates trigger_id after a few seconds, so views.open is called
    inline here rather than handed to a thread.
    """
    from .services import generate_modal_view

    sc = _channel_for((request.data.get('team_id', ''), request.data.get('channel_id', '')))
    if not sc:
        return Response({
            'response_type': 'ephemeral',
            'text': (':x: This channel isn\'t connected to a Troxa workspace yet.\n'
                     'Run `/troxa setup <your-troxa-key>` first — your key is in '
                     '*Dashboard → Integrations → Slack*.'),
        })

    ws = sc.workspace
    campaigns = list(ws.campaigns.all()[:100])
    if not campaigns:
        return Response({
            'response_type': 'ephemeral',
            'text': (f':x: *{ws.name}* has no campaigns yet — a creative is always generated '
                     'against one. Create a campaign in *Dashboard → Brand Kit* first.'),
        })

    result = _post_slack(sc.installation.bot_token, 'views.open', {
        'trigger_id': request.data.get('trigger_id', ''),
        'view': generate_modal_view(ws, campaigns, sc.channel_id),
    })
    if not result.get('ok'):
        logger.warning('slack.views_open_failed error=%s', result.get('error'))
        return Response({
            'response_type': 'ephemeral',
            'text': f':x: Could not open the generate dialog ({result.get("error", "unknown error")}).',
        })
    return Response(status=200)


def _handle_disconnect(request):
    team_id    = request.data.get('team_id', '')
    channel_id = request.data.get('channel_id', '')

    deleted, _ = SlackChannel.objects.filter(
        installation__team_id=team_id,
        channel_id=channel_id,
    ).delete()

    if deleted:
        return Response({'response_type': 'in_channel', 'text': ':wave: Troxa disconnected from this channel.'})
    return Response({'response_type': 'ephemeral', 'text': ':x: This channel was not connected to Troxa.'})


class SlackStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)

        channels = ws.slack_channels.select_related('installation').all()
        installation = channels.first().installation if channels.exists() else None

        # Issue a signed token instead of the raw workspace UUID so that
        # /troxa setup can verify the key was legitimately issued to a
        # workspace member (prevents IDOR via guessed/scraped UUIDs).
        signer = Signer()
        return Response({
            'connected':      channels.exists(),
            'team_name':      installation.team_name if installation else None,
            'troxa_key':      signer.sign(str(ws.id)),
            'channels':       [_channel_data(sc) for sc in channels],
            'content_types':  ALL_CONTENT_TYPES,  # available choices for frontend
        })


class SlackDisconnectView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        ws = get_workspace(request)
        if not ws:
            return Response(status=404)
        ws.slack_channels.all().delete()
        return Response({'detail': 'Disconnected.'})


class SlackChannelsView(APIView):
    """List channels or add a channel manually (without /troxa setup)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        channels = ws.slack_channels.select_related('installation').all()
        return Response([_channel_data(sc) for sc in channels])

    def post(self, request):
        """
        Add a channel manually. Requires the Slack installation to already exist
        (user must have gone through OAuth first).
        Body: { channel_id, channel_name, label?, content_types? }
        """
        ws = get_workspace(request)
        channels = ws.slack_channels.select_related('installation').all()
        if not channels.exists():
            return Response({'error': 'No Slack installation found. Connect Slack first.'}, status=400)

        installation = channels.first().installation
        channel_id   = request.data.get('channel_id', '').strip()
        if not channel_id:
            return Response({'error': 'channel_id required'}, status=400)

        content_types = request.data.get('content_types', ALL_CONTENT_TYPES)
        sc, _ = SlackChannel.objects.update_or_create(
            workspace=ws,
            channel_id=channel_id,
            defaults={
                'installation':  installation,
                'channel_name':  request.data.get('channel_name', ''),
                'label':         request.data.get('label', ''),
                'content_types': content_types,
            },
        )
        return Response(_channel_data(sc), status=201)


class SlackChannelDetailView(APIView):
    """Update or delete a single channel config."""
    permission_classes = [IsAuthenticated]

    def _get(self, ws, pk):
        return ws.slack_channels.filter(pk=pk).first()

    def patch(self, request, pk):
        ws = get_workspace(request)
        sc = self._get(ws, pk)
        if not sc:
            return Response(status=404)
        if 'label' in request.data:
            sc.label = request.data['label']
        if 'content_types' in request.data:
            types = request.data['content_types']
            sc.content_types = [t for t in types if t in ALL_CONTENT_TYPES]
            # Remove auto_post_types that are no longer in content_types
            sc.auto_post_types = [t for t in sc.auto_post_types if t in sc.content_types]
        if 'auto_post_types' in request.data:
            types = request.data['auto_post_types']
            sc.auto_post_types = [t for t in types if t in (sc.content_types or [])]
        sc.save()
        return Response(_channel_data(sc))

    def delete(self, request, pk):
        ws = get_workspace(request)
        sc = self._get(ws, pk)
        if not sc:
            return Response(status=404)
        sc.delete()
        return Response(status=204)


class SlackAvailableChannelsView(APIView):
    """
    Fetch the list of public + private channels from Slack API.
    Requires channels:read (public) and groups:read (private) scopes.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        ws = get_workspace(request)
        channel = ws.slack_channels.select_related('installation').first()
        if not channel:
            return Response({'error': 'Slack not connected'}, status=400)

        token  = channel.installation.bot_token
        cursor = request.query_params.get('cursor', '')
        result = []

        params = {
            'types':            'public_channel',
            'exclude_archived': 'true',
            'limit':            200,
        }
        if cursor:
            params['cursor'] = cursor

        try:
            resp = http_requests.get(
                f'{SLACK_API}/conversations.list',
                headers={'Authorization': f'Bearer {token}'},
                params=params,
                timeout=10,
            )
            data = resp.json()
        except Exception as e:
            return Response({'error': str(e), 'channels': []}, status=502)

        if not data.get('ok'):
            slack_error = data.get('error', 'unknown_error')
            needs_reinstall = slack_error in ('missing_scope', 'not_allowed_token_type', 'token_revoked', 'invalid_auth')
            return Response({
                'error': slack_error,
                'needs_reinstall': needs_reinstall,
                'channels': [],
            }, status=400)

        channels = [
            {'id': c['id'], 'name': c['name'], 'is_private': c.get('is_private', False)}
            for c in data.get('channels', [])
        ]
        next_cursor = data.get('response_metadata', {}).get('next_cursor', '')
        return Response({'channels': channels, 'next_cursor': next_cursor})


class SlackManualPostView(APIView):
    """
    POST /api/slack/post/
    Body: { creative_ids: [uuid, ...], channel_pk: <SlackChannel.id> }
    Posts each creative as a Slack message and marks them slack_posted=True.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.creatives.models import GeneratedCreative
        from .services import post_creatives_to_channel

        ws           = get_workspace(request)
        channel_pk   = request.data.get('channel_pk')
        creative_ids = request.data.get('creative_ids', [])

        if not channel_pk or not creative_ids:
            return Response({'error': 'channel_pk and creative_ids required'}, status=400)

        sc = ws.slack_channels.filter(pk=channel_pk).select_related('installation').first()
        if not sc:
            return Response({'error': 'Channel not found'}, status=404)

        creatives = list(ws.creatives.filter(id__in=creative_ids))
        if not creatives:
            return Response({'error': 'No matching creatives found'}, status=404)

        post_creatives_to_channel(sc, sc.installation.bot_token, creatives)
        return Response({'posted': len(creatives)})


def _verify_slack_signature(request):
    signing_secret = settings.SLACK_SIGNING_SECRET.encode()
    timestamp  = request.headers.get('X-Slack-Request-Timestamp', '')
    signature  = request.headers.get('X-Slack-Signature', '')

    if abs(time.time() - float(timestamp or 0)) > 300:
        return False

    body     = request.body.decode('utf-8')
    base     = f'v0:{timestamp}:{body}'
    mac      = hmac.new(signing_secret, base.encode(), hashlib.sha256)
    expected = 'v0=' + mac.hexdigest()
    return hmac.compare_digest(expected, signature)


class SlackInteractionView(APIView):
    """
    Where Slack delivers button and select clicks.

    Slack allows one interactivity Request URL per app, so this is the single
    entry point for every interactive control we put in a message; it
    dispatches on the action id. The rating itself is applied through
    apps.creatives.rating, the same path the dashboard's PATCH takes, so a
    score set from a channel triggers the fingerprint re-analysis and lands in
    the activity log exactly like one set in the gallery.
    """
    permission_classes = [AllowAny]
    # Every click in every connected workspace arrives from Slack's own IPs, so
    # the default 30/min anonymous throttle would start dropping them as soon
    # as a couple of people worked through a 4-variant post. The HMAC check
    # below is the real gate here — nothing without our signing secret gets in.
    throttle_classes = []

    def post(self, request):
        # Read the raw body for the HMAC before anything parses it.
        if not _verify_slack_signature(request):
            return Response(status=403)

        try:
            payload = json.loads(request.data.get('payload') or '{}')
        except (TypeError, ValueError):
            return Response(status=400)

        if payload.get('type') == 'view_submission':
            return self._generate_submission(payload)
        if payload.get('type') != 'block_actions':
            return Response(status=200)

        actions = payload.get('actions') or []
        if not actions:
            return Response(status=200)

        action    = actions[0]
        action_id = action.get('action_id')
        if action_id in (GEN_ACTIONS[GEN_BLOCK_CAMPAIGN], GEN_ACTIONS[GEN_BLOCK_BRIEF]):
            return self._generate_dialog_changed(payload, action_id)
        if action_id not in (RATE_ACTION_ID, WINNER_ACTION_ID):
            return Response(status=200)

        raw = (action.get('selected_option') or {}).get('value') or action.get('value') or ''
        creative_id, _, score = raw.partition(':')

        # Authorization. The ids in these controls come from our own messages,
        # but a channel must never be able to touch another workspace's
        # creatives just by replaying a value from somewhere else — so the
        # creative has to belong to the workspace this channel is wired to.
        # A valid Slack signature only proves the click came through our app;
        # it says nothing about which workspace's data the clicker may reach.
        team_id    = (payload.get('team') or {}).get('id') or ''
        channel_id = (payload.get('channel') or {}).get('id') or ''
        sc = (SlackChannel.objects
              .filter(channel_id=channel_id, installation__team_id=team_id)
              .select_related('workspace').first())
        if not sc:
            return Response(status=200)

        from apps.creatives.models import GeneratedCreative
        try:
            creative = GeneratedCreative.objects.filter(
                pk=creative_id, workspace=sc.workspace,
            ).first()
        except (ValueError, ValidationError):
            return Response(status=200)   # not a uuid — nothing to act on
        if not creative:
            return Response(status=200)

        slack_user = payload.get('user') or {}
        actor = '@' + (slack_user.get('username')
                       or (slack_user.get('name') or '')
                       or slack_user.get('id') or 'slack')

        try:
            if action_id == RATE_ACTION_ID:
                apply_rating(creative, score, source='slack', actor=actor)
            else:
                toggle_winner(creative, source='slack', actor=actor)
        except Exception:
            logger.exception('slack.interaction_failed action=%s creative=%s', action_id, creative_id)
            return Response(status=200)

        # Slack wants an ack within 3 seconds and rewriting the message is
        # another round trip, so it goes to a thread and this returns now.
        response_url = payload.get('response_url')
        if response_url:
            threading.Thread(
                target=refresh_rating_row,
                args=(response_url, payload.get('message'), creative),
                kwargs={'actor': actor},
                daemon=True,
            ).start()

        return Response(status=200)

    def _generate_submission(self, payload):
        """
        Someone submitted the /troxa generate dialog.

        Returning an empty 200 closes the modal; returning a response_action of
        'errors' keeps it open with the message pinned to one of its inputs,
        which is where a credit shortfall belongs — the person can lower the
        count and submit again without retyping the prompt.
        """
        from apps.creatives.generation import (
            AUTO_MODE_MODEL, DEFAULT_BLEND_WEIGHT, FINGERPRINT_ALWAYS_ON, start_generation,
        )
        from .services import post_generation_queued

        view = payload.get('view') or {}
        if view.get('callback_id') != GENERATE_CALLBACK_ID:
            return Response(status=200)

        def error_on(block_id, message):
            return Response({'response_action': 'errors', 'errors': {block_id: message[:150]}})

        sc = _channel_for(((payload.get('team') or {}).get('id') or '',
                           view.get('private_metadata') or ''))
        if not sc:
            return error_on(GEN_BLOCK_PROMPT,
                            'This channel is no longer connected to a Troxa workspace.')

        state = self._dialog_state(view)
        campaign_id = state['campaign_id']
        prompt      = state['prompt'].strip()
        try:
            count = int(state['count'] or 2)
        except ValueError:
            count = 2

        if not prompt:
            return error_on(GEN_BLOCK_PROMPT, 'Say what the creative should show.')

        ws = sc.workspace
        if not ws.campaigns.filter(id=campaign_id).exists():
            return error_on(GEN_BLOCK_CAMPAIGN, 'That campaign no longer exists.')

        slack_user = payload.get('user') or {}
        actor = '@' + (slack_user.get('username') or slack_user.get('name')
                       or slack_user.get('id') or 'slack')

        job, err = start_generation(
            ws,
            {
                'campaign_id': campaign_id,
                'extra_prompt': prompt,
                'num_images': count,
                # The modal doesn't ask for these, so it takes what the Generate
                # tab sends in auto mode — same three answers, same job. The
                # fingerprint especially: without it the images come back
                # generic instead of on-brand.
                'model_name': AUTO_MODE_MODEL,
                'generation_mode': 'auto',
                'use_fingerprint': FINGERPRINT_ALWAYS_ON,
                'blend_weight': DEFAULT_BLEND_WEIGHT,
                'actor': actor,
            },
            user=None, origin='slack', origin_channel=sc.channel_id,
        )
        if err:
            return error_on(GEN_BLOCK_COUNT, err.get('detail', 'Could not start the generation.'))

        # Images take a while; say so in the channel now, and the worker posts
        # the results (or the failure) there when it lands.
        threading.Thread(
            target=post_generation_queued,
            args=(sc, sc.installation.bot_token, job),
            kwargs={'actor': actor},
            daemon=True,
        ).start()
        return Response(status=200)

    @staticmethod
    def _dialog_state(view):
        """What the person has filled in so far, so a re-render doesn't lose it."""
        values = (view.get('state') or {}).get('values') or {}

        def picked(block_id):
            el = (values.get(block_id) or {}).get(GEN_ACTIONS[block_id]) or {}
            return (el.get('selected_option') or {}).get('value') or el.get('value') or ''

        return {
            'campaign_id': picked(GEN_BLOCK_CAMPAIGN),
            'brief_id':    picked(GEN_BLOCK_BRIEF),
            'prompt':      picked(GEN_BLOCK_PROMPT),
            'count':       picked(GEN_BLOCK_COUNT) or '2',
        }

    def _generate_dialog_changed(self, payload, action_id):
        """
        Someone picked a campaign or a brief in the dialog — re-render it.

        Slack can't populate one select from another on its own, so the brief
        list is rebuilt for the chosen campaign here. Picking a brief drops its
        extra_prompt into the prompt box, which is exactly what the Generate
        tab's brief cards do; it stays editable afterwards.
        """
        view = payload.get('view') or {}
        if view.get('callback_id') != GENERATE_CALLBACK_ID:
            return Response(status=200)

        sc = _channel_for(((payload.get('team') or {}).get('id') or '',
                           view.get('private_metadata') or ''))
        if not sc:
            return Response(status=200)

        ws = sc.workspace
        state = self._dialog_state(view)
        campaign = ws.campaigns.filter(id=state['campaign_id']).first() if state['campaign_id'] else None
        briefs = briefs_for_campaign(campaign)

        brief_id = state['brief_id']
        prompt = state['prompt']
        if action_id == GEN_ACTIONS[GEN_BLOCK_CAMPAIGN]:
            # Briefs belong to a campaign, so a campaign change drops the
            # selection rather than leaving a brief from the previous one.
            brief_id = ''
        else:
            chosen = next((b for b in briefs if str(b.get('id')) == str(brief_id)), None)
            if chosen:
                prompt = chosen.get('extra_prompt') or prompt

        result = _post_slack(sc.installation.bot_token, 'views.update', {
            'view_id': view.get('id'),
            'hash': view.get('hash'),
            'view': generate_modal_view(
                ws, list(ws.campaigns.all()[:100]), sc.channel_id,
                campaign_id=state['campaign_id'], briefs=briefs, brief_id=brief_id,
                prompt=prompt, count=state['count'],
            ),
        })
        if not result.get('ok'):
            logger.warning('slack.views_update_failed error=%s', result.get('error'))
        return Response(status=200)
