# ruff: noqa: E402

"""
ASGI config for backend project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

from django.core.asgi import get_asgi_application


django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter

import api.routing
from api.middleware import JWTAuthMiddleware


application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(api.routing.websocket_urlpatterns)),
    }
)
