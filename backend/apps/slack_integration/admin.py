from django.contrib import admin
from .models import SlackInstallation, SlackChannel


@admin.register(SlackInstallation)
class SlackInstallationAdmin(admin.ModelAdmin):
    list_display = ('team_name', 'team_id', 'installed_at')
    readonly_fields = ('installed_at',)


@admin.register(SlackChannel)
class SlackChannelAdmin(admin.ModelAdmin):
    list_display = ('channel_name', 'workspace', 'connected_at')
    readonly_fields = ('connected_at',)
