from django.urls import path
from .views import (
    WorkspaceListView, WorkspaceDetailView,
    WorkspaceMembersView, WorkspaceMemberDetailView,
    WorkspaceInvitesView, WorkspaceInviteCancelView,
    InviteAcceptView, InvitePublicView,
)

urlpatterns = [
    path('', WorkspaceListView.as_view()),
    path('create/', WorkspaceListView.as_view()),
    path('<uuid:pk>/', WorkspaceDetailView.as_view()),
    path('<uuid:pk>/members/', WorkspaceMembersView.as_view()),
    path('<uuid:pk>/members/<int:member_id>/', WorkspaceMemberDetailView.as_view()),
    path('<uuid:pk>/members/<int:member_id>/remove/', WorkspaceMemberDetailView.as_view()),
    path('<uuid:pk>/invites/', WorkspaceInvitesView.as_view()),
    path('<uuid:pk>/invites/<int:invite_id>/cancel/', WorkspaceInviteCancelView.as_view()),
    path('invites/<uuid:token>/', InvitePublicView.as_view()),
    path('invites/<uuid:token>/accept/', InviteAcceptView.as_view()),
]
