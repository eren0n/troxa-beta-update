from django.urls import path
from .views import (
    DriveInstallView,
    DriveOAuthCallbackView,
    DriveStatusView,
    DriveDisconnectView,
    DriveAutoSyncToggleView,
    DriveFilesView,
    DriveFolderImagesView,
    DriveImportView,
    DriveFolderConfigView,
    DriveUploadCreativeView,
)

urlpatterns = [
    path('install/',                   DriveInstallView.as_view()),
    path('oauth/callback/',            DriveOAuthCallbackView.as_view()),
    path('status/',                    DriveStatusView.as_view()),
    path('disconnect/',                DriveDisconnectView.as_view()),
    path('auto-sync/',                 DriveAutoSyncToggleView.as_view()),
    path('files/',                     DriveFilesView.as_view()),
    path('folders/<str:folder_id>/images/', DriveFolderImagesView.as_view()),
    path('import/',                    DriveImportView.as_view()),
    path('folder-config/',             DriveFolderConfigView.as_view()),
    path('upload-creative/',           DriveUploadCreativeView.as_view()),
]
