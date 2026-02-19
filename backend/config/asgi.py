# ruff: noqa: E402

"""
ASGI config for Systematic Literature Review Tool project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/dev/howto/deployment/asgi/

"""

import os
import sys
from pathlib import Path

from django.core.asgi import get_asgi_application


# This allows easy placement of apps within the interior
# slrt_project directory.
BASE_DIR = Path(__file__).resolve(strict=True).parent.parent
sys.path.append(str(BASE_DIR / "slrt_project"))

# If DJANGO_SETTINGS_MODULE is unset, default to the local settings
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")

# This application object is used by any ASGI server configured to use this file.
django_application = get_asgi_application()

# Import websocket application here, so apps from django_application are loaded first
from channels.routing import ProtocolTypeRouter, URLRouter

import slrt_project.routing
from config.middleware import JWTAuthMiddleware


application = ProtocolTypeRouter(
    {
        "http": django_application,
        "websocket": JWTAuthMiddleware(
            URLRouter(slrt_project.routing.websocket_urlpatterns)
        ),
    }
)
