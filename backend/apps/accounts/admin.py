from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, Workspace, WorkspaceMember, Invite


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'username', 'first_name', 'last_name', 'is_active', 'totp_enabled', 'date_joined')
    list_filter = ('is_active', 'is_staff', 'totp_enabled')
    search_fields = ('email', 'username', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Profile', {'fields': ('bio', 'location', 'timezone', 'language', 'twitter', 'linkedin', 'website', 'avatar')}),
        ('2FA', {'fields': ('totp_enabled', 'totp_secret')}),
    )


class WorkspaceMemberInline(admin.TabularInline):
    model = WorkspaceMember
    extra = 0
    readonly_fields = ('joined_at',)


@admin.register(Workspace)
class WorkspaceAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'owner', 'workspace_type', 'creative_counter', 'member_count', 'created_at')
    list_filter = ('workspace_type',)
    search_fields = ('name', 'code', 'owner__email')
    readonly_fields = ('id', 'creative_counter', 'created_at')
    inlines = [WorkspaceMemberInline]

    def member_count(self, obj):
        return obj.memberships.count()
    member_count.short_description = 'Members'


@admin.register(WorkspaceMember)
class WorkspaceMemberAdmin(admin.ModelAdmin):
    list_display = ('workspace', 'user', 'role', 'joined_at')
    list_filter = ('role',)
    search_fields = ('workspace__name', 'user__email')


@admin.register(Invite)
class InviteAdmin(admin.ModelAdmin):
    list_display = ('email', 'workspace', 'role', 'status', 'invited_by', 'expires_at', 'created_at')
    list_filter = ('status', 'role')
    search_fields = ('email', 'workspace__name')
    readonly_fields = ('token', 'created_at')
