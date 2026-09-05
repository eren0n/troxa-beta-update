import os
from pathlib import Path
from datetime import timedelta
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    raise RuntimeError('SECRET_KEY environment variable is not set. Refusing to start.')

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

ALLOWED_HOSTS = ['troxa.ai', 'www.troxa.ai', 'test.troxa.ai', '34.212.125.6', '44.252.187.137', 'localhost', '127.0.0.1']

CSRF_TRUSTED_ORIGINS = [
    'https://troxa.ai',
    'https://www.troxa.ai',
    'https://test.troxa.ai',
]

# HTTPS security headers
SECURE_HSTS_SECONDS = 31536000          # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

AUTH_USER_MODEL = 'accounts.User'

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'apps.accounts',
    'apps.billing',
    'apps.brand_kit',
    'apps.team',
    'apps.creatives',
    'apps.activity',
    'apps.automation',
    'apps.slack_integration',
    'apps.drive_integration',
    'apps.data_lab',
    'apps.meta_integration',
    'apps.public_api',
    'apps.fingerprint',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ.get('DB_NAME', 'troxa_ai'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', ''),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '30/minute',
        'user': '300/minute',
        'login': '10/minute',
    },
}

SPECTACULAR_SETTINGS = {
    'TITLE': 'Troxa API',
    'DESCRIPTION': (
        'The Troxa public API lets you generate creatives, manage campaigns, '
        'and retrieve assets programmatically. Authenticate with your workspace '
        'API key via the `X-API-Key` header.'
    ),
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'CONTACT': {'email': 'support@troxa.ai'},
    'LICENSE': {'name': 'Proprietary'},
    'SERVERS': [{'url': 'https://troxa.ai', 'description': 'Production'}],
    'SWAGGER_UI_SETTINGS': {
        'persistAuthorization': True,
    },
    'REDOC_UI_SETTINGS': {
        'hideDownloadButton': False,
        'expandResponses': '200,201',
        'pathInMiddlePanel': True,
    },
    'COMPONENT_SPLIT_REQUEST': True,
    'SORT_OPERATIONS': False,
    'TAGS': [
        {'name': 'Creatives', 'description': 'Generate and manage creatives'},
        {'name': 'Campaigns', 'description': 'Campaign management'},
        {'name': 'Brand Kit', 'description': 'Logos and brand assets'},
    ],
}

_jwt_signing_key = os.environ.get('JWT_SIGNING_KEY')
if not _jwt_signing_key:
    raise RuntimeError('JWT_SIGNING_KEY environment variable is not set. Refusing to start.')

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
    'AUTH_HEADER_TYPES': ('Bearer',),
    'SIGNING_KEY': _jwt_signing_key,
}

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    'https://troxa.ai',
    'https://www.troxa.ai',
    'https://test.troxa.ai',
    # Local development
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
]
CORS_ALLOW_HEADERS = [
    'accept',
    'authorization',
    'content-type',
    'x-workspace-id',
]

FILE_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024

FAL_KEY = os.environ.get('FAL_KEY', '')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.environ.get('GOOGLE_CLIENT_SECRET', '')

SLACK_CLIENT_ID = os.environ.get('SLACK_CLIENT_ID', '')
SLACK_CLIENT_SECRET = os.environ.get('SLACK_CLIENT_SECRET', '')
SLACK_SIGNING_SECRET = os.environ.get('SLACK_SIGNING_SECRET', '')

META_APP_ID     = os.environ.get('META_APP_ID', '')
META_APP_SECRET = os.environ.get('META_APP_SECRET', '')
SITE_BASE_URL = os.environ.get('SITE_BASE_URL', 'https://troxa.ai')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '')

FREE_TRIAL_CREDITS = 10

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'apps.drive_integration': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
        'apps.creatives': {
            'handlers': ['console'],
            'level': 'ERROR',
            'propagate': False,
        },
    },
}
