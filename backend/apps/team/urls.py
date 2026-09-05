from django.urls import path
from .views import MembersView, MemberDetailView, APIKeysView, APIKeyDetailView, InvitesView, InviteCancelView, InviteAcceptView

urlpatterns = [
    path('members/', MembersView.as_view()),
    path('members/<int:pk>/', MemberDetailView.as_view()),
    path('members/<int:pk>/remove/', MemberDetailView.as_view()),
    path('api-keys/', APIKeysView.as_view()),
    path('api-keys/<int:pk>/', APIKeyDetailView.as_view()),
    path('invites/', InvitesView.as_view()),
    path('invites/create/', InvitesView.as_view()),
    path('invites/<int:pk>/cancel/', InviteCancelView.as_view()),
    path('invites/<int:pk>/accept/', InviteAcceptView.as_view()),
]
