from rest_framework import serializers
from .models import User, Workspace, WorkspaceMember, Invite


class WorkspaceSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    has_plan = serializers.SerializerMethodField()
    plan_tier = serializers.SerializerMethodField()

    class Meta:
        model = Workspace
        fields = ('id', 'name', 'code', 'workspace_type', 'role', 'member_count', 'has_plan', 'plan_tier', 'created_at')

    def get_role(self, obj):
        request = self.context.get('request')
        if not request or not getattr(request.user, 'is_authenticated', False):
            return 'member'
        membership = obj.memberships.filter(user=request.user).first()
        return membership.role if membership else 'member'

    def get_member_count(self, obj):
        return obj.memberships.count()

    def get_has_plan(self, obj):
        return hasattr(obj, 'subscription') and obj.subscription is not None

    def get_plan_tier(self, obj):
        try:
            return obj.subscription.plan.tier
        except Exception:
            return 'free'


class UserSerializer(serializers.ModelSerializer):
    workspaces = serializers.SerializerMethodField()
    avatar_url = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            'id', 'email', 'username', 'first_name', 'last_name', 'full_name',
            'workspaces', 'date_joined',
            'bio', 'location', 'timezone', 'language',
            'twitter', 'linkedin', 'website', 'avatar_url',
            'totp_enabled', 'is_data_user',
        )

    def get_workspaces(self, obj):
        request = self.context.get('request')
        workspaces = obj.workspaces.all()
        return WorkspaceSerializer(workspaces, many=True, context={'request': request}).data

    def get_avatar_url(self, obj):
        request = self.context.get('request')
        if obj.avatar and obj.avatar.name:
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None

    def get_full_name(self, obj):
        name = f'{obj.first_name} {obj.last_name}'.strip()
        return name or obj.email.split('@')[0]


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(min_length=6, write_only=True)
    first_name = serializers.CharField(required=False, default='')
    last_name = serializers.CharField(required=False, default='')

    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return value


class MemberSerializer(serializers.ModelSerializer):
    member_id = serializers.IntegerField(source='user.id', read_only=True)
    name = serializers.SerializerMethodField()
    email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = WorkspaceMember
        fields = ('id', 'member_id', 'name', 'email', 'role', 'joined_at')

    def get_name(self, obj):
        return obj.user.get_full_name() or obj.user.email.split('@')[0]


class InviteSerializer(serializers.ModelSerializer):
    invited_by_email = serializers.CharField(source='invited_by.email', read_only=True, allow_null=True)

    class Meta:
        model = Invite
        fields = ('id', 'email', 'role', 'status', 'invited_by_email', 'expires_at', 'created_at')
