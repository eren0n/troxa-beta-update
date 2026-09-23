"""
Applying a rating — or the Winner badge — to a creative.

This is the single place either one happens. The dashboard's PATCH and Slack's
interactive controls both call in here, so a rating set from Slack has exactly
the same side effects as one set in the gallery (the fingerprint's Agent 1
re-analysis, an activity-log entry), and anything added here later is picked up
by both instead of only whichever side it was written on.
"""
import logging

from apps.activity.utils import log_event

logger = logging.getLogger(__name__)

# Stored 1-10. Shown out of 5 in half steps, which is what the five stars in
# the UI have always drawn — each star is worth two stored points. Only the
# presentation changed; the stored scale is what the API, Agent 1 and every
# existing row already speak. Mirrors FrontendRework/src/lib/rating.js.
RATING_MIN, RATING_MAX = 1, 10
DISPLAY_MAX = 5
DISPLAY_STEP = 0.5


def format_rating(stored):
    """1-10 in, "4.5/5" out."""
    if stored is None:
        return f'-/{DISPLAY_MAX}'
    value = stored / 2
    return f'{value:g}/{DISPLAY_MAX}'

# Mirrors WINNER_TAG_NAME / WINNER_TAG_COLOR in
# FrontendRework/src/components/dashboard/WinnerBadge.jsx. The Winner badge is
# an ordinary creative tag, so both sides have to name it identically or
# they'd each be toggling a tag of their own.
WINNER_TAG_NAME = 'Winner'
WINNER_TAG_COLOR = '#f59e0b'


def clamp_rating(value):
    """1-10, or None to clear it. Raises on non-numeric input, as the API did before."""
    if value is None or value == '':
        return None
    return max(RATING_MIN, min(RATING_MAX, int(value)))


def _actor_label(user, actor):
    if actor:
        return actor
    if not user:
        return ''
    return (user.get_full_name() or '').strip() or user.email


def apply_rating(creative, value, *, user=None, source='dashboard', actor=None):
    """
    Set or clear a creative's rating. Returns True when the stored value changed.

    `source` and `actor` only describe who did it, for the activity log: a
    rating that arrives from Slack has no Troxa User behind it, so `user` may be
    None while `actor` carries the Slack handle.
    """
    new_rating = clamp_rating(value)
    if new_rating == creative.rating:
        return False

    creative.rating = new_rating
    creative.save(update_fields=['rating'])

    # Agent 1 re-reads the creative whenever its rating moves — this is what
    # teaches the brand fingerprint what "good" looks like in this workspace.
    if new_rating is not None:
        try:
            from apps.fingerprint.services import trigger_analyze_generation
            trigger_analyze_generation(creative.id, creative.workspace_id)
        except Exception:
            logger.exception('rating.fingerprint_trigger_failed creative=%s', creative.id)

    log_event(
        creative.workspace, user, 'creative.rated',
        (f'{creative.name} rated {format_rating(new_rating)}' if new_rating is not None
         else f'{creative.name} rating cleared'),
        {
            'creative_id': str(creative.id),
            'rating': new_rating,
            'source': source,
            'actor': _actor_label(user, actor),
        },
    )
    return True


def toggle_winner(creative, *, user=None, source='dashboard', actor=None):
    """Flip the Winner tag on a creative. Returns True when it's now a winner."""
    from .models import CreativeTag

    tag, _ = CreativeTag.objects.get_or_create(
        workspace=creative.workspace, name=WINNER_TAG_NAME,
        defaults={'color': WINNER_TAG_COLOR, 'created_by': user},
    )
    now_winner = not creative.tags.filter(pk=tag.pk).exists()
    if now_winner:
        creative.tags.add(tag)
    else:
        creative.tags.remove(tag)

    log_event(
        creative.workspace, user,
        'creative.winner_set' if now_winner else 'creative.winner_cleared',
        f'{creative.name} {"marked as winner" if now_winner else "unmarked as winner"}',
        {'creative_id': str(creative.id), 'source': source, 'actor': _actor_label(user, actor)},
    )
    return now_winner


def is_winner(creative):
    return creative.tags.filter(name=WINNER_TAG_NAME).exists()
