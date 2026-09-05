from django.urls import path
from .mgmt_views import (
    MgmtMyPermissionsView,
    MgmtPermissionsView,
    MgmtPermissionDetailView,
    MgmtUsersView,
    MgmtUserDetailView,
    MgmtWorkspacesView,
    MgmtWorkspaceDetailView,
    MgmtWorkspaceMembersView,
    MgmtWorkspaceCreditsView,
    MgmtWorkspacePlanView,
    MgmtWorkspaceCodeView,
    MgmtPlansView,
    MgmtPlanDetailView,
    MgmtDataUsersView,
)
from .meta_ads_views import MetaAdsView, MetaAdsAccountsView, MetaAdsDebugView, AdCreativeView

urlpatterns = [
    # Permissions
    path('my-permissions/', MgmtMyPermissionsView.as_view()),
    path('permissions/', MgmtPermissionsView.as_view()),
    path('permissions/<int:pk>/', MgmtPermissionDetailView.as_view()),
    # Users
    path('users/', MgmtUsersView.as_view()),
    path('users/<int:pk>/', MgmtUserDetailView.as_view()),
    # Workspaces
    path('workspaces/', MgmtWorkspacesView.as_view()),
    path('workspaces/<uuid:pk>/', MgmtWorkspaceDetailView.as_view()),
    path('workspaces/<uuid:pk>/members/', MgmtWorkspaceMembersView.as_view()),
    path('workspaces/<uuid:pk>/members/<int:member_pk>/', MgmtWorkspaceMembersView.as_view()),
    path('workspaces/<uuid:pk>/credits/', MgmtWorkspaceCreditsView.as_view()),
    path('workspaces/<uuid:pk>/plan/', MgmtWorkspacePlanView.as_view()),
    path('workspaces/<uuid:pk>/code/', MgmtWorkspaceCodeView.as_view()),
    # Plans
    path('plans/', MgmtPlansView.as_view()),
    path('plans/<int:pk>/', MgmtPlanDetailView.as_view()),
    # Data Users
    path('data-users/', MgmtDataUsersView.as_view()),
    path('data-users/<int:pk>/', MgmtDataUsersView.as_view()),
    # Meta Ads
    path('meta-ads/', MetaAdsView.as_view()),
    path('meta-ads/accounts/', MetaAdsAccountsView.as_view()),
    path('meta-ads/debug/', MetaAdsDebugView.as_view()),
    path('meta-ads/creative/<str:ad_id>/', AdCreativeView.as_view()),
]
