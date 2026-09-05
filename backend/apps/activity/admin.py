from django.contrib import admin
from .models import ActivityEvent


@admin.register(ActivityEvent)
class ActivityEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'workspace', 'user', 'description', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('workspace__name', 'user__email', 'description', 'event_type')
    readonly_fields = ('created_at',)
    raw_id_fields = ('workspace', 'user')
