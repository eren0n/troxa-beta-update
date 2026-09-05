from django.urls import path
from .views import GenerateView, JobStatusView, ReferencesView

urlpatterns = [
    path('references/', ReferencesView.as_view(), name='v1-references'),
    path('generate/',   GenerateView.as_view(),   name='v1-generate'),
    path('jobs/<uuid:job_id>/', JobStatusView.as_view(), name='v1-job-status'),
]
