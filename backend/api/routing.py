from django.urls import path

from . import consumers


websocket_urlpatterns = [
    path(
        "ws/screening-stats/<int:review_id>/", consumers.ScreeningStatConsumer.as_asgi()
    ),
]
