from django.urls import path
from .views import (
    AutomationListView, AutomationDetailView,
    AutomationRunNowView, AutomationToggleView,
    AutomationRunsView, RunStatusView,
)

urlpatterns = [
    path('', AutomationListView.as_view()),
    path('<uuid:pk>/', AutomationDetailView.as_view()),
    path('<uuid:pk>/run/', AutomationRunNowView.as_view()),
    path('<uuid:pk>/toggle/', AutomationToggleView.as_view()),
    path('<uuid:pk>/runs/', AutomationRunsView.as_view()),
    path('runs/<int:run_pk>/status/', RunStatusView.as_view()),
]
