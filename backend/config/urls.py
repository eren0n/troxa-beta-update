from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework.permissions import IsAuthenticated
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView
from apps.accounts.views import RegisterView, RegisterWithInviteView, TokenObtainView, GoogleAuthView, GoogleLinkView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/token/', TokenObtainView.as_view(), name='token_obtain'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/register-invite/', RegisterWithInviteView.as_view(), name='register_invite'),
    path('api/auth/google/', GoogleAuthView.as_view(), name='google_auth'),
    path('api/auth/google/link/', GoogleLinkView.as_view(), name='google_link'),
    path('api/users/', include('apps.accounts.urls')),
    path('api/workspaces/', include('apps.accounts.workspace_urls')),
    path('api/creatives/', include('apps.creatives.urls')),
    path('api/brand-kit/', include('apps.brand_kit.urls')),
    path('api/team/', include('apps.team.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/activity/', include('apps.activity.urls')),
    path('api/automation/', include('apps.automation.urls')),
    path('api/slack/', include('apps.slack_integration.urls')),
    path('api/drive/', include('apps.drive_integration.urls')),
    path('api/meta/', include('apps.meta_integration.urls')),
    path('api/mgmt/', include('apps.accounts.mgmt_urls')),
    path('api/data-lab/', include('apps.data_lab.urls')),
    path('api/v1/', include('apps.public_api.urls')),
    path('api/fingerprint/', include('apps.fingerprint.urls')),
    # API Docs — restricted to authenticated users only (prevents unauthenticated recon)
    path('api/schema/', SpectacularAPIView.as_view(permission_classes=[IsAuthenticated]), name='schema'),
    path('api/docs/', SpectacularRedocView.as_view(url_name='schema', permission_classes=[IsAuthenticated]), name='redoc'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
