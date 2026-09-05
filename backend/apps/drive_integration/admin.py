from django.contrib import admin
from .models import DriveConnection


@admin.register(DriveConnection)
class DriveConnectionAdmin(admin.ModelAdmin):
    list_display = ('user', 'drive_email', 'auto_sync', 'connected_at')
    readonly_fields = ('connected_at', 'token_expiry')
