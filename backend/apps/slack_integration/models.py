from django.db import models
from apps.accounts.models import Workspace

CONTENT_TYPE_CHOICES = [
    ('creatives', 'Generated Creatives'),
    ('videos',    'Videos'),
    ('logos',     'Logo Edits'),
    ('automation','Automation'),
]

ALL_CONTENT_TYPES = [c[0] for c in CONTENT_TYPE_CHOICES]


class SlackInstallation(models.Model):
    """One per Slack team — stores the bot token obtained via OAuth."""
    team_id   = models.CharField(max_length=50, unique=True)
    team_name = models.CharField(max_length=200, blank=True)
    bot_token = models.CharField(max_length=300)
    installed_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.team_name} ({self.team_id})'


class SlackChannel(models.Model):
    """
    One workspace can have multiple channels, each receiving different content types.
    Added via /troxa setup <key> from Slack, or manually via the dashboard API.
    """
    workspace    = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='slack_channels')
    installation = models.ForeignKey(SlackInstallation, on_delete=models.CASCADE, related_name='channels')
    channel_id   = models.CharField(max_length=50)
    channel_name = models.CharField(max_length=200, blank=True)
    label        = models.CharField(max_length=100, blank=True)  # user-defined nickname
    # Which content types are enabled for this channel (subset of ALL_CONTENT_TYPES)
    content_types = models.JSONField(default=list)
    # Subset of content_types that are auto-posted (the rest require manual posting)
    auto_post_types = models.JSONField(default=list)
    connected_by_slack_user = models.CharField(max_length=50, blank=True)
    connected_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'channel_id')

    def __str__(self):
        return f'#{self.channel_name} → {self.workspace.name}'


class SlackPostedMessage(models.Model):
    """
    A message we posted that carries rating rows, remembered so it can be
    edited later.

    Slack lets a bot rewrite its own messages with chat.update, but only if it
    knows the message id, and only by sending the whole message back. Reading
    one back out of Slack would need a history scope and a reinstall in every
    workspace, so what we sent is kept here instead — the blocks are rewritten
    in place and posted again whenever a rating or the Winner badge changes,
    from the dashboard or from Slack.
    """
    channel     = models.ForeignKey(SlackChannel, on_delete=models.CASCADE,
                                    related_name='posted_messages')
    message_ts  = models.CharField(max_length=32)
    text        = models.CharField(max_length=500, blank=True, default='')
    blocks      = models.JSONField(default=list)
    # Which creatives have a rating row in this message.
    creatives   = models.ManyToManyField('creatives.GeneratedCreative',
                                         related_name='slack_posts')
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('channel', 'message_ts')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.channel.channel_name}@{self.message_ts}'
