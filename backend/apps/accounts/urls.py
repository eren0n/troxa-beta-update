from django.urls import path
from .views import MeView, ChangePasswordView, TwoFactorSetupView, TwoFactorConfirmView, TwoFactorDisableView

urlpatterns = [
    path('me/', MeView.as_view()),
    path('me/change-password/', ChangePasswordView.as_view()),
    path('me/2fa/setup/', TwoFactorSetupView.as_view()),
    path('me/2fa/confirm/', TwoFactorConfirmView.as_view()),
    path('me/2fa/disable/', TwoFactorDisableView.as_view()),
]
