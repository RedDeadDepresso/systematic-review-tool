import os

from django.urls import path

from . import consumers


os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

websocket_urlpatterns = [
    path(
        "ws/screening-stats/<int:review_id>/", consumers.ScreeningStatConsumer.as_asgi()
    ),
]
