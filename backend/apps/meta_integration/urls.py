from django.urls import path
from . import views

urlpatterns = [
    path('install/',            views.MetaInstallView.as_view()),
    path('oauth/callback/',     views.MetaOAuthCallbackView.as_view()),
    path('status/',             views.MetaStatusView.as_view()),
    path('disconnect/',         views.MetaDisconnectView.as_view()),
    path('accounts/',           views.MetaAdAccountsView.as_view()),
    path('pages/',              views.MetaPagesView.as_view()),
    path('campaigns/',          views.MetaCampaignsView.as_view()),
    path('adsets/',             views.MetaAdsetsView.as_view()),
    path('post/',               views.MetaPostCreativeView.as_view()),
    path('metrics/<uuid:creative_id>/', views.MetaMetricsView.as_view()),
]
