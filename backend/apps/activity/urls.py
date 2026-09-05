from django.urls import path
from .views import EventsView, AnalyticsView

urlpatterns = [
    path('events/', EventsView.as_view()),
    path('analytics/', AnalyticsView.as_view()),
]
