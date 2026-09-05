from django.urls import path
from .views import AdListView, AdSyncView, AdDetailView, ExportView, ExportZipView, AdImageProxyView, AdMediaInfoView

urlpatterns = [
    path('ads/', AdListView.as_view()),
    path('ads/sync/', AdSyncView.as_view()),
    path('ads/<int:pk>/', AdDetailView.as_view()),
    path('ads/<int:pk>/image/', AdImageProxyView.as_view()),
    path('ads/<int:pk>/media/', AdMediaInfoView.as_view()),
    path('export/', ExportView.as_view()),
    path('export/zip/', ExportZipView.as_view()),
]
