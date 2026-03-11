"""
WebSocket consumers for the reviews application.

Three consumers are defined here:

  TaskStatusConsumer      — tracks a single Celery task and closes when done.
  ReviewGroupConsumer     — real-time chat and notifications for review members.
  ScreeningStatConsumer   — tracks active screening time per reviewer session.

Authentication
--------------
``AuthenticateReviewMemberMixin`` is shared by ``ReviewGroupConsumer`` and
``ScreeningStatConsumer``.  It reads ``review_id`` from the URL route, looks up
the ``ReviewMember`` row for the current user, and closes the socket with an
appropriate code on any failure.
"""

import asyncio
import logging

from asgiref.sync import sync_to_async
from celery.result import AsyncResult
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from slrt_project.reviews.models import ReviewChatMessage, ReviewMember, ScreeningStat


logger = logging.getLogger(__name__)


# ── TaskStatusConsumer ─────────────────────────────────────────────────────────


class TaskStatusConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer that streams status updates for a single Celery task.

    URL pattern must capture ``task_id``, e.g.::

        path("ws/tasks/<str:task_id>/", TaskStatusConsumer.as_asgi())

    On connect the consumer joins a channel-layer group named
    ``task_<task_id>`` and immediately pushes the current Celery state.
    Celery tasks should broadcast into that group when they transition states.
    The socket is automatically closed once a terminal status is received
    (``SUCCESS``, ``FAILURE``, or ``ERROR``).
    """

    async def connect(self):
        self.task_id = self.scope["url_route"]["kwargs"]["task_id"]
        self.group_name = f"task_{self.task_id}"

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        logger.info(
            "WebSocket connected for task %s, joined group %s",
            self.task_id,
            self.group_name,
        )

        # Push the current Celery state so the client doesn't have to wait for
        # the first broadcast message.
        await self.send_initial_status()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(
            "WebSocket disconnected for task %s, code: %s",
            self.task_id,
            close_code,
        )

    # ── helpers ───────────────────────────────────────────────────────────────

    async def send_initial_status(self):
        """Fetch and push the task's current Celery status on connection."""
        # run_in_executor keeps the async event loop unblocked while the
        # synchronous Celery backend (Redis/RabbitMQ) is queried.
        loop = asyncio.get_event_loop()
        task_status = await loop.run_in_executor(None, self._get_task_status)
        await self.send_json(task_status)

    def _get_task_status(self):
        """
        Build a status dict from the Celery ``AsyncResult``.

        This is a sync method intentionally — it is run inside an executor by
        ``send_initial_status`` so it must not call any async code.
        """
        task = AsyncResult(self.task_id)

        payload = {
            "task_id": self.task_id,
            "status": task.state,
        }

        if task.state == "PENDING":
            payload["message"] = "Task is waiting to be processed"
        elif task.state == "STARTED":
            payload["message"] = "Task is processing"
        elif task.state == "SUCCESS":
            payload["result"] = task.result
            payload["message"] = "Task completed successfully"
        elif task.state == "FAILURE":
            payload["error"] = str(task.info)
            payload["message"] = "Task failed"
        elif task.state == "RETRY":
            payload["message"] = "Task is retrying after failure"

        return payload

    # ── channel-layer handlers ────────────────────────────────────────────────

    async def task_status_update(self, event):
        """
        Handle ``task_status_update`` messages broadcast by Celery tasks.

        Expected event shape::

            {
                "type": "task_status_update",
                "data": {
                    "task_id": "…",
                    "status": "SUCCESS" | "FAILURE" | …,
                    …
                }
            }

        Closes the socket after a terminal status so that clients don't need
        to manage the lifecycle themselves.
        """
        data = event["data"]

        await self.send_json(data)
        logger.info("Sent status update for task %s: %s", self.task_id, data["status"])

        # Close after terminal states so the client receives the final payload
        # before the connection drops.
        if data["status"] in ("SUCCESS", "FAILURE", "ERROR"):
            logger.info("Task %s completed, closing WebSocket", self.task_id)
            await self.close(code=1000)


# ── AuthenticateReviewMemberMixin ──────────────────────────────────────────────


class AuthenticateReviewMemberMixin:
    """
    Shared authentication logic for review-scoped WebSocket consumers.

    Call ``await self.authenticate()`` at the top of ``connect()``.  On success
    the mixin sets ``self.review_id`` and ``self.member``; on failure it closes
    the socket and returns without calling ``accept()``.

    Close codes:
      4003 — user is not a member of the requested review.
      4000 — any other unexpected error during lookup.
    """

    async def authenticate(self):
        try:
            self.review_id = self.scope["url_route"]["kwargs"]["review_id"]
            self.user = self.scope.get("user")

            # Check membership before fetching the full object to avoid an
            # unnecessary second query on failure.
            has_access = await sync_to_async(
                ReviewMember.objects.filter(
                    review_id=self.review_id, user_id=self.user.id
                ).exists
            )()

            if not has_access:
                logger.warning(
                    "User %s denied access to review %s",
                    self.user.id,
                    self.review_id,
                )
                await self.close(code=4003)
                return

            self.member = await sync_to_async(ReviewMember.objects.get)(
                review_id=self.review_id, user_id=self.user.id
            )

        except Exception as e:
            logger.error("Error in connect: %s", e)
            await self.close(code=4000)
            return

        await self.accept()


# ── ReviewGroupConsumer ────────────────────────────────────────────────────────


class ReviewGroupConsumer(AsyncJsonWebsocketConsumer, AuthenticateReviewMemberMixin):
    """
    Real-time communication channel shared by all members of a review.

    Features
    --------
    - Chat messages: persisted to ``ReviewChatMessage`` and broadcast to the
      group so every open tab sees them immediately.
    - System messages: broadcast by background tasks (e.g. import completed)
      via the channel layer without being persisted here.
    - Typing indicators: lightweight, not persisted.

    On connect the last 50 messages are sent as ``message_history`` so the
    client can render a backlog without a separate REST call.
    """

    async def connect(self):
        await self.authenticate()

        self.group_name = f"review_{self.review_id}"
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        logger.info(
            "User %s (%s) joined review group %s",
            self.user.id,
            self.user.email,
            self.review_id,
        )

        # Send recent message history so the client has context immediately.
        recent_messages = await self.get_recent_messages()
        await self.send_json({"type": "message_history", "messages": recent_messages})

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        user_id = self.user.id if self.user else "Unknown"
        logger.info(
            "User %s left review group %s (code: %s)",
            user_id,
            self.review_id,
            close_code,
        )

    # ── DB helpers ────────────────────────────────────────────────────────────

    @database_sync_to_async
    def get_recent_messages(self, limit=50):
        """
        Return the most recent ``limit`` messages for the review as dicts.

        Ordered oldest-first so the client can append them in chronological
        order.  The avatar URL is built from SITE_URL + MEDIA_URL + file name
        to avoid hitting the storage backend in an async context.
        """
        messages = (
            ReviewChatMessage.objects.filter(review_id=self.review_id)
            .select_related("member__user")
            .order_by("-created_at")[:limit]
        )

        result = []
        for msg in reversed(messages):
            avatar_url = None
            if msg.member and msg.member.user.avatar:
                avatar_url = (
                    f"{settings.SITE_URL}{settings.MEDIA_URL}"
                    f"{msg.member.user.avatar.name}"
                )

            result.append(
                {
                    "message_id": msg.id,
                    "member_id": msg.member_id,
                    "user_id": msg.member.user_id if msg.member else None,
                    "user_name": msg.user_name,
                    "avatar_url": avatar_url,
                    "message": msg.message,
                    "is_system_message": msg.is_system_message,
                    "metadata": msg.metadata,
                    "created_at": msg.created_at.isoformat(),
                }
            )
        return result

    @database_sync_to_async
    def save_chat_message(self, message):
        """
        Persist a user chat message and return metadata needed for broadcasting.

        Returns ``None`` on error so the caller can send an error frame.
        """
        try:
            chat_message = ReviewChatMessage.objects.create(
                review_id=self.review_id,
                member=self.member,
                message=message,
                is_system_message=False,
            )

            avatar_url = None
            if self.member.user.avatar:
                avatar_url = (
                    f"{settings.SITE_URL}{settings.MEDIA_URL}"
                    f"{self.member.user.avatar.name}"
                )

            return {
                "id": chat_message.id,
                "user_name": chat_message.user_name,
                "avatar_url": avatar_url,
                "created_at": chat_message.created_at.isoformat(),
            }
        except Exception as e:
            logger.exception("Error saving chat message: %s", e)
            return None

    # ── incoming message handlers ─────────────────────────────────────────────

    async def receive_json(self, content):
        """
        Dispatch incoming client messages by ``type``.

        Supported types:
          ``chat_message`` — user chat message to be persisted and broadcast.
          ``typing``       — typing indicator (not persisted).
        """
        message_type = content.get("type")

        if message_type == "chat_message":
            await self.handle_chat_message(content)
        elif message_type == "typing":
            await self.handle_typing(content)
        else:
            logger.warning(
                "Unknown message type from user %s: %s",
                self.user.id,
                message_type,
            )

    async def handle_chat_message(self, content):
        """
        Validate, persist, and broadcast a user chat message.

        Validation:
          - Must be non-empty after stripping whitespace.
          - Must be ≤ 5 000 characters.
        """
        message = content.get("message", "").strip()

        if not message:
            logger.warning("Empty message from user %s", self.user.id)
            return

        if len(message) > 5000:
            await self.send_json(
                {"type": "error", "message": "Message too long (max 5000 characters)"}
            )
            return

        chat_message = await self.save_chat_message(message)

        if not chat_message:
            await self.send_json({"type": "error", "message": "Failed to save message"})
            return

        # Broadcast to all group members (including the sender, so their UI
        # confirms the save with server-authoritative data).
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "chat_message",
                "message_id": chat_message["id"],
                "member_id": self.member.id,
                "user_id": self.user.id,
                "user_name": chat_message["user_name"],
                "avatar_url": chat_message["avatar_url"],
                "message": message,
                "is_system_message": False,
                "metadata": None,
                "created_at": chat_message["created_at"],
            },
        )

    async def handle_typing(self, content):
        """Broadcast a typing indicator to all group members except the sender."""
        is_typing = content.get("is_typing", True)

        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_typing",
                "user_id": self.user.id,
                "user_name": (
                    f"{self.user.first_name} {self.user.last_name}".strip()
                    or self.user.email
                ),
                "is_typing": is_typing,
            },
        )

    # ── channel-layer broadcast handlers ─────────────────────────────────────

    async def chat_message(self, event):
        """
        Forward a ``chat_message`` channel-layer event to this WebSocket.

        Called for both user-authored messages (via ``handle_chat_message``)
        and system messages broadcast by background tasks.
        """
        await self.send_json(
            {
                "type": "chat_message",
                "message_id": event.get("message_id"),
                "member_id": event.get("member_id"),
                "user_id": event.get("user_id"),
                "user_name": event.get("user_name"),
                "avatar_url": event.get("avatar_url"),
                "message": event.get("message"),
                "is_system_message": event.get("is_system_message", False),
                "metadata": event.get("metadata"),
                "created_at": event.get("created_at"),
            }
        )

    async def user_typing(self, event):
        """
        Forward a ``user_typing`` event to this WebSocket, suppressing
        events generated by this connection's own user.
        """
        if event.get("user_id") != self.user.id:
            await self.send_json(
                {
                    "type": "user_typing",
                    "user_id": event.get("user_id"),
                    "user_name": event.get("user_name"),
                    "is_typing": event.get("is_typing", True),
                }
            )


# ── ScreeningStatConsumer ──────────────────────────────────────────────────────


class ScreeningStatConsumer(AsyncJsonWebsocketConsumer, AuthenticateReviewMemberMixin):
    """
    Tracks active screening time for a reviewer in real time.

    Lifecycle
    ---------
    1. Client connects and sends ``start_tracking`` when it enters the
       screening view.
    2. ``_start_tracking`` records ``start_time``.
    3. Client sends ``heartbeat`` messages on a regular interval
       (≤ ``HEARTBEAT_INTERVAL`` seconds) to prove liveness.
    4. ``_check_heartbeat`` runs in a background task and closes the socket
       if no heartbeat arrives within ``MAX_IDLE_TIME`` seconds.
    5. Client sends ``stop_tracking`` (or disconnects) to end the session;
       elapsed seconds are written to ``ScreeningStat``.

    Multi-tab handling
    ------------------
    Active connections per user+review are tracked in Django's cache under
    ``screening_stat_<user_id>_<review_id>``.  The session counter in
    ``ScreeningStat`` is only incremented when the *first* tab connects, not
    on subsequent tabs.
    """

    HEARTBEAT_INTERVAL = 30  # seconds between expected heartbeats
    MAX_IDLE_TIME = 60  # seconds of silence before forced disconnect

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.start_time = None
        self.is_on_break = False
        self.is_tracking = False
        self.last_heartbeat = None
        self.heartbeat_task = None
        self.connection_id = None
        self.member = None

    async def connect(self):
        await self.authenticate()

        # Unique ID used as the cache set key for multi-tab deduplication.
        self.connection_id = (
            f"{self.user.id}_{self.review_id}_{timezone.now().timestamp()}"
        )
        self.last_heartbeat = timezone.now()

        # Register in the active-connections cache set.
        cache_key = f"screening_stat_{self.user.id}_{self.review_id}"
        active_connections = cache.get(cache_key, set())
        active_connections.add(self.connection_id)
        cache.set(cache_key, active_connections, timeout=None)

        # Only count the session for the first tab to avoid inflating the count.
        if len(active_connections) == 1:
            await self._increment_session()

        # Launch heartbeat monitor as a background asyncio task.
        self.heartbeat_task = asyncio.create_task(self._check_heartbeat())

        logger.info("Connection established: %s", self.connection_id)

    async def disconnect(self, code):
        if self.heartbeat_task:
            self.heartbeat_task.cancel()

        if not self.member:
            return

        # Flush any in-progress tracking session before closing.
        if self.is_tracking and self.start_time:
            await self._save_current_session()

        # Remove this tab from the active-connections cache set.
        cache_key = f"screening_stat_{self.user.id}_{self.review_id}"
        active_connections = cache.get(cache_key, set())
        active_connections.discard(self.connection_id)

        if active_connections:
            cache.set(cache_key, active_connections, timeout=None)
        else:
            # Last tab closed — clean up the cache entry entirely.
            cache.delete(cache_key)

        logger.info("Disconnected: %s", self.connection_id)

    async def receive_json(self, content):
        """
        Dispatch incoming client messages.

        Supported message types
        -----------------------
        ``heartbeat``      — liveness ping; resets idle timer.
        ``start_tracking`` — begin recording time (ignored while on break).
        ``stop_tracking``  — stop recording time (e.g. navigated away).
        ``break_start``    — user manually paused; stops tracking.
        ``break_end``      — user resumed; restarts tracking.
        """
        msg_type = content.get("type")

        if msg_type == "heartbeat":
            self.last_heartbeat = timezone.now()
            await self.send_json(
                {
                    "type": "heartbeat_ack",
                    "is_tracking": self.is_tracking,
                    "is_on_break": self.is_on_break,
                }
            )

        elif msg_type == "start_tracking":
            # Ignore start requests while the user is on a break.
            if not self.is_on_break:
                await self._start_tracking()

        elif msg_type == "stop_tracking":
            await self._stop_tracking()

        elif msg_type == "break_start":
            self.is_on_break = True
            await self._stop_tracking()
            await self.send_json({"type": "break_started"})
            logger.info("%s started break", self.connection_id)

        elif msg_type == "break_end":
            self.is_on_break = False
            await self._start_tracking()
            await self.send_json({"type": "break_ended"})
            logger.info("%s ended break", self.connection_id)

    # ── tracking helpers ──────────────────────────────────────────────────────

    async def _start_tracking(self):
        """Mark tracking as active and record the start timestamp."""
        if not self.is_tracking:
            self.is_tracking = True
            self.start_time = timezone.now()
            logger.debug("%s started tracking", self.connection_id)

    async def _stop_tracking(self):
        """Stop tracking and persist the elapsed seconds."""
        if self.is_tracking and self.start_time:
            await self._save_current_session()
            self.is_tracking = False
            self.start_time = None
            logger.debug("%s stopped tracking", self.connection_id)

    async def _save_current_session(self):
        """
        Compute elapsed seconds and write them to ``ScreeningStat``.

        Sessions shorter than 5 seconds are discarded to filter out
        accidental page loads and rapid tab switches.
        """
        if not self.start_time:
            return

        elapsed = int((timezone.now() - self.start_time).total_seconds())

        if elapsed >= 5:
            await self._update_stats(elapsed)
            logger.debug("%s saved session: %ds", self.connection_id, elapsed)

    async def _check_heartbeat(self):
        """
        Background task that closes stale connections.

        Runs in a loop, sleeping for ``HEARTBEAT_INTERVAL`` seconds between
        checks.  If the last heartbeat is older than ``MAX_IDLE_TIME`` seconds
        the socket is closed with code 4008 (policy violation / idle timeout).
        The loop exits cleanly on ``CancelledError`` (normal disconnect path).
        """
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)

                if self.last_heartbeat:
                    idle = (timezone.now() - self.last_heartbeat).total_seconds()
                    if idle > self.MAX_IDLE_TIME:
                        logger.warning(
                            "Connection %s idle for %.0fs, closing",
                            self.connection_id,
                            idle,
                        )
                        await self.close(code=4008)
                        break
        except asyncio.CancelledError:
            pass

    # ── DB helpers ────────────────────────────────────────────────────────────

    async def _increment_session(self):
        """Atomically increment the session counter for this reviewer."""

        def _do():
            stat, _ = ScreeningStat.objects.get_or_create(member=self.member)
            stat.sessions += 1
            stat.save(update_fields=["sessions"])

        await sync_to_async(_do)()

    async def _update_stats(self, seconds):
        """Add ``seconds`` to the reviewer's total time-on-task."""

        def _do():
            stat, _ = ScreeningStat.objects.get_or_create(member=self.member)
            stat.seconds += seconds
            stat.save(update_fields=["seconds"])

        await sync_to_async(_do)()
