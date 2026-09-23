"""
Slack notification helpers. Called from creatives/services.py after generation.
All calls are fire-and-forget — exceptions are swallowed so a Slack failure
never breaks a generation job.
"""
import logging

import requests as http_requests
from django.conf import settings

from .models import SlackChannel

logger = logging.getLogger(__name__)

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
    from apps.creatives.rating import format_rating
    parts = []
    if creative.rating:
        parts.append(f':star: *{format_rating(creative.rating)}*')
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

    from apps.creatives.rating import DISPLAY_MAX, DISPLAY_STEP, RATING_MAX, RATING_MIN, format_rating

    cid = str(creative.id)
    # Labelled in half stars, valued on the stored 1-10 scale.
    options = [
        {'text': {'type': 'plain_text', 'text': format_rating(n)}, 'value': f'{cid}:{n}'}
        for n in range(RATING_MIN, RATING_MAX + 1)
    ]
    select = {
        'type': 'static_select',
        'action_id': RATE_ACTION_ID,
        'placeholder': {'type': 'plain_text', 'text': f'Rate {DISPLAY_STEP:g}-{DISPLAY_MAX}'},
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


def rewrite_rating_row(blocks, creative, actor=None):
    """
    Return `blocks` with this creative's rating row rebuilt, or None when the
    message carries no such row.

    Slack only replaces whole messages, so the row is spliced into the blocks
    we already have — the other three variants of a 4-image post are left
    exactly as they were.
    """
    cid = str(creative.id)
    fresh = creative_action_blocks(creative, actor=actor)
    out, replaced = [], False
    for block in (blocks or []):
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
    return out if replaced else None


def refresh_rating_row(response_url, message, creative, actor=None):
    """
    Rewrite the clicked message over the interaction's response_url.

    Only needed for messages posted before we started recording them; anything
    posted since goes through sync_creative_rating, which also reaches the
    copies in other channels.
    """
    blocks = rewrite_rating_row((message or {}).get('blocks'), creative, actor=actor)
    if blocks is None:
        return
    try:
        http_requests.post(
            response_url,
            json={
                'replace_original': True,
                'text': (message or {}).get('text') or 'Creative updated',
                'blocks': blocks,
            },
            timeout=10,
        )
    except Exception:
        pass


def post_message(sc, token, payload, creatives=()):
    """
    chat.postMessage, remembering the result.

    Slack hands back the message id; keeping it together with the blocks we
    sent is what later lets a rating change rewrite the message in place.
    Failing to record must never break the post itself.
    """
    result = _post(token, 'chat.postMessage', payload)
    ts = result.get('ts') if isinstance(result, dict) else None
    rateable = [c for c in creatives if c is not None]
    if ts and rateable:
        try:
            from .models import SlackPostedMessage
            msg, _ = SlackPostedMessage.objects.update_or_create(
                channel=sc, message_ts=ts,
                defaults={'text': (payload.get('text') or '')[:500],
                          'blocks': payload.get('blocks') or []},
            )
            msg.creatives.set(rateable)
        except Exception:
            logger.exception('slack.post_record_failed channel=%s ts=%s', sc.channel_id, ts)
    return result


def sync_creative_rating(creative_id, actor=None):
    """
    Push a creative's current rating and Winner badge into every Slack message
    it was posted to.

    Runs whenever a rating changes, wherever it changed — the gallery's stars,
    the Slack dropdown, the API — because they all go through
    apps.creatives.rating. A creative posted to three channels updates in all
    three.
    """
    from apps.creatives.models import GeneratedCreative
    from .models import SlackPostedMessage

    creative = GeneratedCreative.objects.filter(pk=creative_id).first()
    if not creative:
        return
    for post in (SlackPostedMessage.objects
                 .filter(creatives=creative)
                 .select_related('channel__installation')):
        blocks = rewrite_rating_row(post.blocks, creative, actor=actor)
        if blocks is None:
            continue
        result = _post(post.channel.installation.bot_token, 'chat.update', {
            'channel': post.channel.channel_id,
            'ts': post.message_ts,
            'text': post.text or 'Creative updated',
            'blocks': blocks,
        })
        if result.get('ok'):
            post.blocks = blocks
            post.save(update_fields=['blocks'])
        else:
            logger.warning('slack.chat_update_failed ts=%s error=%s',
                           post.message_ts, result.get('error'))


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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': f'{count} creative{"s" if count > 1 else ""} generated — {campaign}',
            'blocks': blocks,
        }, creatives[:4])

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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': f':clapper: Video ready — {creative_name}',
            'blocks': blocks,
        }, [vjob.source_creative] if vjob.source_creative_id else [])

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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': f':art: Logo applied — {count} image{"s" if count != 1 else ""} saved',
            'blocks': blocks,
        }, creatives[:4])

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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': f':white_check_mark: Automation "{automation.name}" complete — {count} images',
            'blocks': blocks,
        }, creatives[:4])

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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': f':pencil2: Edit saved — {creative.name}',
            'blocks': blocks,
        }, [creative])

    _mark_posted([str(creative.id)])


GENERATE_CALLBACK_ID = 'troxa_generate'
# Modal inputs. The block ids are also where a validation error gets attached,
# so they have to match what the submission handler reports against.
GEN_BLOCK_CAMPAIGN = 'campaign'
GEN_BLOCK_BRIEF    = 'brief'
GEN_BLOCK_PROMPT   = 'prompt'
GEN_BLOCK_COUNT    = 'count'
# One action id per block: picking a campaign or a brief re-renders the dialog,
# so those two have to be distinguishable in the interaction payload.
GEN_ACTIONS = {
    GEN_BLOCK_CAMPAIGN: 'campaign_pick',
    GEN_BLOCK_BRIEF:    'brief_pick',
    GEN_BLOCK_PROMPT:   'prompt_text',
    GEN_BLOCK_COUNT:    'count_pick',
}


def briefs_for_campaign(campaign):
    """
    The campaign's current Creative Director briefs, chosen the same way the
    Generate tab's Campaign Intel panel chooses them: the newest ready set.
    """
    if not campaign:
        return []
    row = campaign.creative_briefs.filter(status='ready').first()
    return [b for b in (row.briefs if row else []) if b.get('extra_prompt')]


def _brief_option(brief):
    kind = (brief.get('type') or '').replace('-', ' ').title()
    title = brief.get('title') or 'Untitled'
    return {'text': {'type': 'plain_text', 'text': f'{title} · {kind}'[:75]},
            'value': str(brief.get('id'))}


def generate_modal_view(ws, campaigns, channel_id, *, campaign_id=None, briefs=None,
                        brief_id=None, prompt='', count='2', max_images=4):
    """
    The /troxa generate dialog.

    Deliberately short: campaign, an optional Campaign Intel brief, prompt, how
    many. Model, ratio, resolution and format take the same defaults the
    Generate tab uses in auto mode, so a Slack request and a dashboard request
    with the same answers produce the same job.

    Picking a brief does here exactly what it does on the Generate tab — drops
    its extra_prompt into the prompt box, editable before submitting. Campaign
    details reach the model through that text and nothing else, which is how
    the dashboard has always worked.
    """
    from apps.creatives.generation import AUTO_MODE_MODEL, MODEL_CREDIT_COST

    per_image = MODEL_CREDIT_COST.get(AUTO_MODE_MODEL, 1)
    counts = [
        {'text': {'type': 'plain_text', 'text': f'{n} image{"s" if n > 1 else ""}'
                                                f'  ·  {n * per_image} credits'},
         'value': str(n)}
        for n in range(1, max_images + 1)
    ]
    count_initial = next((o for o in counts if o['value'] == str(count)), counts[min(1, len(counts) - 1)])

    campaign_options = [
        {'text': {'type': 'plain_text', 'text': (c.name or 'Untitled')[:75]}, 'value': str(c.id)}
        for c in campaigns[:100]
    ]
    campaign_element = {
        'type': 'static_select', 'action_id': GEN_ACTIONS[GEN_BLOCK_CAMPAIGN],
        'placeholder': {'type': 'plain_text', 'text': 'Pick a campaign'},
        'options': campaign_options,
    }
    picked_campaign = next((o for o in campaign_options if o['value'] == str(campaign_id)), None)
    if picked_campaign:
        campaign_element['initial_option'] = picked_campaign

    blocks = [
        {'type': 'context', 'elements': [{'type': 'mrkdwn',
         'text': f'Workspace *{ws.name}*  ·  {AUTO_MODE_MODEL}  ·  {per_image} credit/image'}]},
        {
            'type': 'input', 'block_id': GEN_BLOCK_CAMPAIGN,
            'label': {'type': 'plain_text', 'text': 'Campaign'},
            # Re-render on change so the brief list follows the campaign.
            'dispatch_action': True,
            'element': campaign_element,
        },
    ]

    briefs = briefs or []
    if briefs:
        brief_options = [_brief_option(b) for b in briefs[:100]]
        brief_element = {
            'type': 'static_select', 'action_id': GEN_ACTIONS[GEN_BLOCK_BRIEF],
            'placeholder': {'type': 'plain_text', 'text': 'Start from a brief (optional)'},
            'options': brief_options,
        }
        picked_brief = next((o for o in brief_options if o['value'] == str(brief_id)), None)
        if picked_brief:
            brief_element['initial_option'] = picked_brief
        blocks.append({
            'type': 'input', 'block_id': GEN_BLOCK_BRIEF, 'optional': True,
            'dispatch_action': True,
            'label': {'type': 'plain_text', 'text': 'Campaign Intel brief'},
            'hint': {'type': 'plain_text', 'text': 'Fills the prompt below — edit it freely.'},
            'element': brief_element,
        })
    elif campaign_id:
        blocks.append({'type': 'context', 'elements': [{'type': 'mrkdwn',
            'text': '_No Campaign Intel briefs for this campaign yet — '
                    'run the research from the dashboard to get them._'}]})

    prompt_element = {
        'type': 'plain_text_input', 'action_id': GEN_ACTIONS[GEN_BLOCK_PROMPT],
        'multiline': True, 'max_length': 2000,
        'placeholder': {'type': 'plain_text',
                        'text': 'e.g. summer promo, bright beach scene, big 200% bonus badge'},
    }
    if prompt:
        prompt_element['initial_value'] = prompt[:2000]

    blocks += [
        {
            'type': 'input', 'block_id': GEN_BLOCK_PROMPT,
            'label': {'type': 'plain_text', 'text': 'What should it show?'},
            'element': prompt_element,
        },
        {
            'type': 'input', 'block_id': GEN_BLOCK_COUNT,
            'label': {'type': 'plain_text', 'text': 'How many'},
            'element': {
                'type': 'static_select', 'action_id': GEN_ACTIONS[GEN_BLOCK_COUNT],
                'initial_option': count_initial, 'options': counts,
            },
        },
    ]

    return {
        'type': 'modal',
        'callback_id': GENERATE_CALLBACK_ID,
        # The payload says which team and view, but not which channel the
        # dialog was opened from — carry it so the images go back to the right
        # conversation.
        'private_metadata': channel_id,
        'title': {'type': 'plain_text', 'text': 'Generate creatives'},
        'submit': {'type': 'plain_text', 'text': 'Generate'},
        'close': {'type': 'plain_text', 'text': 'Cancel'},
        'blocks': blocks,
    }


def post_generation_queued(sc, token, job, actor=None):
    """Let the channel know the request landed — the images take a while."""
    campaign = job.campaign.name if job.campaign else 'Creatives'
    _post(token, 'chat.postMessage', {
        'channel': sc.channel_id,
        'text': f':hourglass_flowing_sand: Generating {job.num_images} creative(s) — {campaign}',
        'blocks': [{'type': 'section', 'text': {'type': 'mrkdwn', 'text': (
            f':hourglass_flowing_sand: *Generating {job.num_images} '
            f'creative{"s" if job.num_images > 1 else ""}*\n'
            f'*Campaign:* {campaign}  |  *Model:* {job.model_name}  |  *Format:* {job.aspect_ratio}'
            + (f'\n*Requested by:* {actor}' if actor else '')
        )}}],
    })


def post_generation_result(job, creatives):
    """
    Post a Slack-requested generation's output back to the channel it came from.

    Unlike notify_slack_generation this ignores the channel's auto-post
    settings: somebody asked for these images in that conversation and is
    waiting on them.
    """
    sc = (SlackChannel.objects
          .filter(channel_id=job.origin_channel, workspace=job.workspace)
          .select_related('installation').first())
    if not sc:
        return
    creatives = [c for c in creatives if _creative_url(c)]
    if not creatives:
        return

    campaign = job.campaign.name if job.campaign else 'Creatives'
    count    = len(creatives)
    base_url = settings.SITE_BASE_URL

    blocks = [{'type': 'section', 'text': {'type': 'mrkdwn', 'text': (
        f':sparkles: *{count} creative{"s" if count > 1 else ""} ready*\n'
        f'*Campaign:* {campaign}  |  *Model:* {job.model_name}  |  *Format:* {job.aspect_ratio}'
    )}}]
    for i, c in enumerate(creatives[:4], 1):
        blocks.extend(_creative_blocks(c, f'Variant {i}', f'{campaign} — Variant {i}'))
    if count > 4:
        blocks.append({'type': 'context', 'elements': [{'type': 'mrkdwn',
            'text': f'_+{count - 4} more in your <{base_url}/dashboard|Troxa dashboard>_'}]})
    blocks.append({'type': 'actions', 'elements': [{
        'type': 'button', 'text': {'type': 'plain_text', 'text': 'Open Dashboard'},
        'url': f'{base_url}/dashboard', 'style': 'primary',
    }]})

    post_message(sc, sc.installation.bot_token, {
        'channel': sc.channel_id,
        'text': f'{count} creative{"s" if count > 1 else ""} ready — {campaign}',
        'blocks': blocks,
    }, creatives[:4])
    _mark_posted([str(c.id) for c in creatives])


def post_generation_failed(job, error_msg):
    """A failed Slack-requested job has to say so, or the channel waits forever."""
    sc = (SlackChannel.objects
          .filter(channel_id=job.origin_channel, workspace=job.workspace)
          .select_related('installation').first())
    if not sc:
        return
    campaign = job.campaign.name if job.campaign else 'Creatives'
    _post(sc.installation.bot_token, 'chat.postMessage', {
        'channel': sc.channel_id,
        'text': f':x: Generation failed — {campaign}',
        'blocks': [{'type': 'section', 'text': {'type': 'mrkdwn',
            'text': f':x: *Generation failed* — {campaign}\n```{str(error_msg)[:300]}```'}}],
    })


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
        post_message(sc, token, {
            'channel': sc.channel_id,
            'text': creative.name,
            'blocks': blocks,
        }, [creative])

    _mark_posted([str(c.id) for c in creatives])
