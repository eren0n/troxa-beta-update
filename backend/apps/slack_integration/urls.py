from django.urls import path
from .views import (
    SlackInstallView,
    SlackOAuthCallbackView,
    SlackCommandView,
    SlackStatusView,
    SlackDisconnectView,
    SlackChannelsView,
    SlackChannelDetailView,
    SlackAvailableChannelsView,
    SlackManualPostView,
)

urlpatterns = [
    path('install/',            SlackInstallView.as_view()),
    path('oauth/callback/',     SlackOAuthCallbackView.as_view()),
    path('commands/',           SlackCommandView.as_view()),
    path('status/',             SlackStatusView.as_view()),
    path('disconnect/',         SlackDisconnectView.as_view()),
    path('channels/',           SlackChannelsView.as_view()),
    path('channels/<int:pk>/',  SlackChannelDetailView.as_view()),
    path('available-channels/', SlackAvailableChannelsView.as_view()),
    path('post/',               SlackManualPostView.as_view()),
]
