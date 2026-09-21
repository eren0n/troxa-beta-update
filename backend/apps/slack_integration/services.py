"""
Slack notification helpers. Called from creatives/services.py after generation.
All calls are fire-and-forget — exceptions are swallowed so a Slack failure
never breaks a generation job.
"""
import requests as http_requests
from django.conf import settings

SLACK_API = 'https://slack.com/api'


def _post(token, method, payload):
    try:
        resp = http_requests.post(
            f'{SLACK_API}/{method}',
            headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
            json=payload,
            timeout=10,
        )
        return resp.json()
    except Exception:
        return {}


def _get_channels(workspace, content_type):
    """Return (SlackChannel, bot_token) tuples for channels that auto-post this content_type."""
    try:
        channels = workspace.slack_channels.select_related('installation').all()
        result = []
        for sc in channels:
            enabled = sc.content_types or []
            auto = sc.auto_post_types or []
            if content_type in enabled and content_type in auto:
                result.append((sc, sc.installation.bot_token))
        return result
    except Exception:
        return []


def _mark_posted(creative_ids):
    """Add 'Slack Posted' tag to the given GeneratedCreative ids."""
    if not creative_ids:
        return
    try:
        from apps.creatives.models import GeneratedCreative, CreativeTag
        creatives = list(GeneratedCreative.objects.filter(id__in=creative_ids).select_related('workspace'))
        if not creatives:
            return
        workspace = creatives[0].workspace
        tag, _ = CreativeTag.objects.get_or_create(
            workspace=workspace, name='Slack Posted',
            defaults={'color': '#8B5CF6'},
        )
        for c in creatives:
            c.tags.add(tag)
    except Exception:
        pass


def _user_label(user):
    if not user:
        return None
    name = user.get_full_name().strip()
    return name or user.email


# Action ids travel in the message and come back in the interaction payload;
# SlackInteractionView dispatches on them.
RATE_ACTION_ID   = 'creative_rate'
WINNER_ACTION_ID = 'creative_winner'
# Block ids tag each creative's row so a click can be rewritten in place
# without disturbing the other variants in the same message.
RATE_BLOCK_PREFIX  = 'rate:'
RATED_BLOCK_PREFIX = 'rated:'

# Slack echoes these back on image blocks it has already fetched; they aren't
# valid input, so they're stripped before a message is re-posted.
_ECHOED_IMAGE_FIELDS = ('fallback', 'image_width', 'image_height', 'image_bytes', 'is_animated')


def _creative_url(creative):
    if creative is None:
        return ''
    return creative.logo_applied_url or creative.image_url or ''


def _rating_status_text(creative, actor=None):
    parts = []
    if creative.rating:
        parts.append(f':star: *{creative.rating}/10*')
    from apps.creatives.rating import is_winner
    if is_winner(creative):
        parts.append(':trophy: *Winner*')
    if not parts:
        return ''
    if actor:
        parts.append(f'_by {actor}_')
    return '  ·  '.join(parts)


def creative_action_blocks(creative, actor=None):
    """
    The rating row that sits under a posted creative.

    Slack has no star widget, so the gallery's 1-10 scale becomes a select, and
    the trophy button toggles the same 'Winner' tag the gallery's badge writes.
    Both carry the creative id in their value: the interaction payload
    otherwise only says "someone clicked in this channel", so that id is the
    one thing tying a click back to a row.
    """
    if creative is None:
        return []

    from apps.creatives.rating import RATING_MAX, RATING_MIN

    cid = str(creative.id)
    options = [
        {'text': {'type': 'plain_text', 'text': f'{n}/10'}, 'value': f'{cid}:{n}'}
        for n in range(RATING_MIN, RATING_MAX + 1)
    ]
    select = {
        'type': 'static_select',
        'action_id': RATE_ACTION_ID,
        'placeholder': {'type': 'plain_text', 'text': 'Rate 1-10'},
        'options': options,
    }
    if creative.rating:
        # initial_option has to be one of the options above, value included.
        select['initial_option'] = options[creative.rating - RATING_MIN]

    from apps.creatives.rating import is_winner
    winner = is_winner(creative)
    winner_btn = {
        'type': 'button',
        'action_id': WINNER_ACTION_ID,
        'text': {'type': 'plain_text', 'text': ':trophy: Winner' if winner else 'Mark winner', 'emoji': True},
        'value': cid,
    }
    if winner:
        winner_btn['style'] = 'primary'

    blocks = [{
        'type': 'actions',
        'block_id': f'{RATE_BLOCK_PREFIX}{cid}',
        'elements': [select, winner_btn],
    }]
    status = _rating_status_text(creative, actor=actor)
    if status:
        blocks.append({
            'type': 'context',
            'block_id': f'{RATED_BLOCK_PREFIX}{cid}',
            'elements': [{'type': 'mrkdwn', 'text': status}],
        })
    return blocks


def _creative_blocks(creative, title, alt=None):
    """An image plus its own rating row, so every variant in a post is rateable."""
    blocks = [{
        'type': 'image',
        'image_url': _creative_url(creative),
        'alt_text': (alt or title)[:2000],
        'title': {'type': 'plain_text', 'text': title[:75]},
    }]
    blocks.extend(creative_action_blocks(creative))
    return blocks


def refresh_rating_row(response_url, message, creative, actor=None):
    """
    Rewrite one creative's rating row in the message it was clicked in.

    Slack only offers whole-message replacement, so the original blocks arrive
    in the interaction payload and we splice in just the row that changed —
    the other three variants of a 4-image post are left exactly as they were.
    """
    cid = str(creative.id)
    fresh = creative_action_blocks(creative, actor=actor)
    out, replaced = [], False
    for block in ((message or {}).get('blocks') or []):
        bid = block.get('block_id') or ''
        if bid == f'{RATE_BLOCK_PREFIX}{cid}':
            out.extend(fresh)
            replaced = True
            continue
        if bid == f'{RATED_BLOCK_PREFIX}{cid}':
            continue  # the fresh row brings its own status line
        if block.get('type') == 'image':
            block = {k: v for k, v in block.items() if k not in _ECHOED_IMAGE_FIELDS}
        out.append(block)
    if not replaced:
        return
    try:
        http_requests.post(
            response_url,
            json={
                'replace_original': True,
                'text': (message or {}).get('text') or 'Creative updated',
                'blocks': out,
            },
            timeout=10,
        )
    except Exception:
        pass


def notify_slack_generation(workspace, job, creatives):
    channels = _get_channels(workspace, 'creatives')
    creatives = [c for c in (creatives or []) if _creative_url(c)]
    if not channels or not creatives:
        return

    campaign  = job.campaign.name if job.campaign else 'Creatives'
    count     = len(creatives)
    base_url  = settings.SITE_BASE_URL
    by        = _user_label(job.created_by)

    blocks = [
        {
            'type': 'section',
            'text': {
                'type': 'mrkdwn',
                'text': (
                    f':sparkles: *{count} new creative{"s" if count > 1 else ""} generated*\n'
                    f'*Campaign:* {campaign}  |  *Model:* {job.model_name}  |  *Format:* {job.aspect_ratio}'
                    + (f'\n*Generated by:* {by}' if by else '')
                ),
            },
        },
    ]
    for i, c in enumerate(creatives[:4], 1):
        blocks.extend(_creative_blocks(c, f'Variant {i}', f'{campaign} — Variant {i}'))
    if count > 4:
        blocks.append({'type': 'context', 'elements': [
            {'type': 'mrkdwn', 'text': f'_+{count - 4} more in your <{base_url}/dashboard|Troxa dashboard>_'}]})
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f'{count} creative{"s" if count > 1 else ""} generated — {campaign}',
            'blocks': blocks,
        })

    _mark_posted([str(c.id) for c in creatives])


def notify_slack_video(workspace, vjob):
    channels = _get_channels(workspace, 'videos')
    if not channels or not vjob.video_url:
        return

    creative_name = (vjob.source_creative.name or '') if vjob.source_creative else ''
    base_url = settings.SITE_BASE_URL

    blocks = [
        {
            'type': 'section',
            'text': {
                'type': 'mrkdwn',
                'text': (
                    f':clapper: *Video generated*\n'
                    + (f'*Creative:* {creative_name}\n' if creative_name else '')
                    + f'<{vjob.video_url}|Download video>'
                ),
            },
        },
    ]
    # The rating lives on the source creative — same row the gallery's video
    # card rates — so the clip is scored from Slack just like a still.
    blocks.extend(creative_action_blocks(vjob.source_creative))
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':clapper: Video ready — {creative_name}',
            'blocks': blocks,
        })

    if vjob.source_creative_id:
        _mark_posted([str(vjob.source_creative_id)])


def notify_slack_logo_save(workspace, creatives, user=None):
    channels = _get_channels(workspace, 'logos')
    creatives = [c for c in (creatives or []) if _creative_url(c)]
    if not channels or not creatives:
        return

    count    = len(creatives)
    base_url = settings.SITE_BASE_URL
    by       = _user_label(user)

    blocks = [{'type': 'section', 'text': {'type': 'mrkdwn',
        'text': f':art: *Logo applied* — {count} image{"s" if count != 1 else ""} saved'
                + (f'\n*Saved by:* {by}' if by else ''),
    }}]
    for i, c in enumerate(creatives[:4], 1):
        blocks.extend(_creative_blocks(c, f'Variant {i}', f'With Logo — Variant {i}'))
    if count > 4:
        blocks.append({'type': 'context', 'elements': [
            {'type': 'mrkdwn', 'text': f'_+{count - 4} more in your <{base_url}/dashboard|Troxa dashboard>_'}]})
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':art: Logo applied — {count} image{"s" if count != 1 else ""} saved',
            'blocks': blocks,
        })

    _mark_posted([str(c.id) for c in creatives])


def notify_slack_automation_start(workspace, automation):
    channels = _get_channels(workspace, 'automation')
    if not channels:
        return
    by = _user_label(automation.created_by)
    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':robot_face: Automation "{automation.name}" started',
            'blocks': [{'type': 'section', 'text': {'type': 'mrkdwn',
                'text': (f':robot_face: *Automation started*\n*{automation.name}* — generating '
                         f'{automation.num_images} image{"s" if automation.num_images != 1 else ""}'
                         + (f'\n*Triggered by:* {by}' if by else '')),
            }}],
        })


def notify_slack_automation_done(workspace, automation, creatives):
    channels = _get_channels(workspace, 'automation')
    creatives = [c for c in (creatives or []) if _creative_url(c)]
    if not channels:
        return

    count    = len(creatives)
    base_url = settings.SITE_BASE_URL
    by       = _user_label(automation.created_by)

    blocks = [{'type': 'section', 'text': {'type': 'mrkdwn',
        'text': (f':white_check_mark: *Automation complete*\n*{automation.name}* — '
                 f'{count} image{"s" if count != 1 else ""} generated'
                 + (f'\n*Generated by:* {by}' if by else '')),
    }}]
    for i, c in enumerate(creatives[:4], 1):
        blocks.extend(_creative_blocks(c, f'Variant {i}', f'{automation.name} — Variant {i}'))
    if count > 4:
        blocks.append({'type': 'context', 'elements': [
            {'type': 'mrkdwn', 'text': f'_+{count - 4} more in your <{base_url}/dashboard|Troxa dashboard>_'}]})
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':white_check_mark: Automation "{automation.name}" complete — {count} images',
            'blocks': blocks,
        })

    _mark_posted([str(c.id) for c in creatives])


def notify_slack_automation_error(workspace, automation, error_msg):
    channels = _get_channels(workspace, 'automation')
    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':x: Automation "{automation.name}" failed',
            'blocks': [{'type': 'section', 'text': {'type': 'mrkdwn',
                'text': f':x: *Automation failed*\n*{automation.name}*\n```{error_msg}```',
            }}],
        })


def notify_slack_edit(workspace, creative, user=None):
    """
    Post a single edited creative to channels that have 'logos' (Edits) content type enabled.
    Called after AiEdit or SaveCanvas saves a creative with is_edited=True.
    """
    channels = _get_channels(workspace, 'logos')
    if not channels:
        return

    url = creative.image_url
    if not url:
        return

    base_url = settings.SITE_BASE_URL
    by = _user_label(user)

    blocks = [
        {
            'type': 'section',
            'text': {
                'type': 'mrkdwn',
                'text': (
                    f':pencil2: *Edit saved — {creative.name}*'
                    + (f'\n*Campaign:* {creative.campaign.name}' if creative.campaign else '')
                    + (f'\n*Saved by:* {by}' if by else '')
                ),
            },
        },
        {'type': 'image', 'image_url': url, 'alt_text': creative.name,
         'title': {'type': 'plain_text', 'text': creative.name[:75]}},
    ]
    blocks.extend(creative_action_blocks(creative))
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    for sc, token in channels:
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': f':pencil2: Edit saved — {creative.name}',
            'blocks': blocks,
        })

    _mark_posted([str(creative.id)])


def post_creatives_to_channel(sc, token, creatives):
    """
    Manually post a list of GeneratedCreative objects to a specific channel.
    Called from the manual post endpoint.
    """
    base_url = settings.SITE_BASE_URL
    for creative in creatives:
        url = creative.logo_applied_url or creative.image_url
        if not url:
            continue
        blocks = [
            {'type': 'image', 'image_url': url, 'alt_text': creative.name,
             'title': {'type': 'plain_text', 'text': creative.name[:75]}},
            {'type': 'context', 'elements': [{'type': 'mrkdwn',
                'text': (f'*{creative.name}*'
                         + (f'  |  Campaign: {creative.campaign.name}' if creative.campaign else '')
                         + f'  |  {creative.aspect_ratio}  |  {creative.media_type}'),
            }]},
        ]
        blocks.extend(creative_action_blocks(creative))
        blocks.append({'type': 'actions', 'elements': [{
            'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
            'url': f'{base_url}/dashboard', 'style': 'primary',
        }]})
        _post(token, 'chat.postMessage', {
            'channel': sc.channel_id,
            'text': creative.name,
            'blocks': blocks,
        })

    _mark_posted([str(c.id) for c in creatives])
