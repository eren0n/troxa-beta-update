from django.db import models
from apps.accounts.models import User, Workspace


class DriveConnection(models.Model):
    """One per user — personal Google Drive connection."""
    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name='drive_connection'
    )
    drive_email = models.EmailField(blank=True)
    access_token = models.TextField()
    refresh_token = models.TextField()
    token_expiry = models.DateTimeField(null=True, blank=True)
    root_folder_id = models.CharField(max_length=200, blank=True)  # "Troxa.ai" root
    auto_sync = models.BooleanField(default=True)
    connected_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.drive_email} ({self.user.email})'


class DriveWorkspaceFolder(models.Model):
    """Caches per-workspace subfolder IDs inside the user's Troxa.ai root."""
    connection = models.ForeignKey(DriveConnection, on_delete=models.CASCADE, related_name='workspace_folders')
    workspace  = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='drive_folders')

    # Auto-created folder IDs (Troxa.ai/{workspace}/Images|Videos|With Logo)
    workspace_folder_id = models.CharField(max_length=200, blank=True)
    images_folder_id    = models.CharField(max_length=200, blank=True)
    videos_folder_id    = models.CharField(max_length=200, blank=True)
    logos_folder_id     = models.CharField(max_length=200, blank=True)

    # Optional user-defined override folders (null = use auto folder)
    custom_images_folder_id = models.CharField(max_length=200, blank=True)
    custom_videos_folder_id = models.CharField(max_length=200, blank=True)
    custom_logos_folder_id  = models.CharField(max_length=200, blank=True)

    # Per-type sync toggles
    sync_creatives = models.BooleanField(default=True)
    sync_videos    = models.BooleanField(default=True)
    sync_logos     = models.BooleanField(default=True)

    class Meta:
        unique_together = ('connection', 'workspace')
