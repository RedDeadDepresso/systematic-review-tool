from django.urls import path, re_path

from . import consumers


websocket_urlpatterns = [
    path(
        "ws/screening-stats/<int:review_id>/", consumers.ScreeningStatConsumer.as_asgi()
    ),
    re_path(
        r"ws/task-status/(?P<task_id>[^/]+)/$", consumers.TaskStatusConsumer.as_asgi()
    ),
    re_path(r"ws/review/(?P<review_id>\d+)/$", consumers.ReviewGroupConsumer.as_asgi()),
]
