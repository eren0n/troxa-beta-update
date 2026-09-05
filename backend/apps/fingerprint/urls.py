from django.urls import path
from .views import (
    FingerprintStatusView, FingerprintMergeView, FingerprintRecreateView,
    CampaignIntelView, CampaignResearchView, CampaignBriefsView,
    WorkspaceTrendView, PromptArchitectView,
)

urlpatterns = [
    path('status/',   FingerprintStatusView.as_view()),
    path('merge/',    FingerprintMergeView.as_view()),
    path('recreate/', FingerprintRecreateView.as_view()),

    # Campaign Intelligence
    path('campaign/<uuid:campaign_id>/intel/',    CampaignIntelView.as_view()),
    path('campaign/<uuid:campaign_id>/research/', CampaignResearchView.as_view()),
    path('campaign/<uuid:campaign_id>/briefs/',   CampaignBriefsView.as_view()),

    # Workspace Trend Scout (campaign-independent, daily)
    path('trends/', WorkspaceTrendView.as_view()),

    # Prompt Architect — DNA × seed → master prompt
    path('build-prompt/', PromptArchitectView.as_view()),
]
