import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(unique=True)

    bio = models.TextField(blank=True, default='')
    location = models.CharField(max_length=100, blank=True, default='')
    timezone = models.CharField(max_length=100, blank=True, default='')
    language = models.CharField(max_length=50, blank=True, default='English')
    twitter = models.CharField(max_length=100, blank=True, default='')
    linkedin = models.CharField(max_length=200, blank=True, default='')
    website = models.CharField(max_length=200, blank=True, default='')
    avatar = models.ImageField(upload_to='avatars/', blank=True, null=True)
    totp_secret = models.CharField(max_length=64, blank=True, default='')
    totp_enabled = models.BooleanField(default=False)
    google_linked = models.BooleanField(default=False)
    is_data_user = models.BooleanField(default=False)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    def __str__(self):
        return self.email


class Workspace(models.Model):
    WORKSPACE_TYPE_CHOICES = [('personal', 'Personal'), ('team', 'Team')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_workspaces')
    members = models.ManyToManyField(User, through='WorkspaceMember', related_name='workspaces')
    workspace_type = models.CharField(max_length=20, choices=WORKSPACE_TYPE_CHOICES, default='personal')
    code = models.CharField(max_length=8, blank=True, default='')
    creative_counter = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=['owner']),
            models.Index(fields=['workspace_type']),
        ]

    def __str__(self):
        return self.name


class WorkspaceMember(models.Model):
    ROLE_CHOICES = [('owner', 'Owner'), ('admin', 'Admin'), ('editor', 'Editor'), ('analyst', 'Analyst')]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='memberships')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='analyst')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('workspace', 'user')
        indexes = [models.Index(fields=['workspace'])]

    def __str__(self):
        return f'{self.user.email} in {self.workspace.name} ({self.role})'


class MgmtPermission(models.Model):
    """Per-user tab access for RMGS Management panel."""
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='mgmt_permission')
    tabs = models.JSONField(default=list)  # e.g. ['meta', 'workspaces', 'users', 'plans', 'data-users']
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.user.email}: {self.tabs}'


class Invite(models.Model):
    STATUS_CHOICES = [('pending', 'Pending'), ('accepted', 'Accepted'), ('expired', 'Expired')]
    ROLE_CHOICES = [('admin', 'Admin'), ('editor', 'Editor'), ('analyst', 'Analyst')]

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name='invites')
    email = models.EmailField()
    token = models.UUIDField(default=uuid.uuid4, unique=True)
    invited_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='analyst')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Invite {self.email} → {self.workspace.name}'
