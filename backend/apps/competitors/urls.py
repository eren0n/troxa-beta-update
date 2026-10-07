from django.urls import path

from .views import CompetitorAdListView, CompetitorDetailView, CompetitorListView, CompetitorSyncView

urlpatterns = [
    path('',                CompetitorListView.as_view()),
    path('ads/',            CompetitorAdListView.as_view()),
    path('<int:pk>/',       CompetitorDetailView.as_view()),
    path('<int:pk>/sync/',  CompetitorSyncView.as_view()),
]
