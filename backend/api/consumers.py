import asyncio
import logging

from asgiref.sync import sync_to_async
from celery.result import AsyncResult
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from api.models import ReviewChatMessage, ReviewMember, ScreeningStat


logger = logging.getLogger(__name__)


class TaskStatusConsumer(AsyncJsonWebsocketConsumer):
    """
    WebSocket consumer for real-time Celery task status updates
    """

    async def connect(self):
        self.task_id = self.scope["url_route"]["kwargs"]["task_id"]
        self.group_name = f"task_{self.task_id}"

        # Join task-specific group
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        await self.accept()

        logger.info(
            f"WebSocket connected for task {self.task_id}, joined group {self.group_name}"
        )

        # Send initial status
        await self.send_initial_status()

    async def disconnect(self, close_code):
        # Leave task group
        await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(
            f"WebSocket disconnected for task {self.task_id}, code: {close_code}"
        )

    async def send_initial_status(self):
        """Send current task status when client connects"""
        import asyncio

        # Get current task status
        task_status = await asyncio.get_event_loop().run_in_executor(
            None, self.get_task_status
        )

        await self.send_json(task_status)

    def get_task_status(self):
        """Get current Celery task status (sync method)"""
        task = AsyncResult(self.task_id)

        response_data = {
            "task_id": self.task_id,
            "status": task.state,
        }

        if task.state == "PENDING":
            response_data["message"] = "Task is waiting to be processed"
        elif task.state == "STARTED":
            response_data["message"] = "Task is processing"
        elif task.state == "SUCCESS":
            response_data["result"] = task.result
            response_data["message"] = "Task completed successfully"
        elif task.state == "FAILURE":
            response_data["error"] = str(task.info)
            response_data["message"] = "Task failed"
        elif task.state == "RETRY":
            response_data["message"] = "Task is retrying after failure"

        return response_data

    # Handler for task status updates sent from Celery
    async def task_status_update(self, event):
        """
        Receive task status updates from Celery tasks via channel layer
        """
        data = event["data"]

        # Send the status update to WebSocket client
        await self.send_json(data)

        logger.info(f"Sent status update for task {self.task_id}: {data['status']}")

        # Close WebSocket connection after task completes
        if data["status"] in ["SUCCESS", "FAILURE", "ERROR"]:
            logger.info(f"Task {self.task_id} completed, closing WebSocket")
            # Send close frame with normal closure code
            await self.close(code=1000)


class AuthenticateReviewMemberMixin:
    async def authenticate(self):
        try:
            self.review_id = self.scope["url_route"]["kwargs"]["review_id"]
            self.user = self.scope.get("user")
            has_access = await sync_to_async(
                ReviewMember.objects.filter(
                    review_id=self.review_id, user_id=self.user.id
                ).exists
            )()

            if not has_access:
                logger.warning(
                    f"User {self.user.id} denied access to review {self.review_id}"
                )
                await self.close(code=4003)
                return

            self.member = await sync_to_async(ReviewMember.objects.get)(
                review_id=self.review_id, user_id=self.user.id
            )

        except Exception as e:
            logger.error(f"Error in connect: {e}")
            await self.close(code=4000)
            return

        await self.accept()


class ReviewGroupConsumer(AsyncJsonWebsocketConsumer, AuthenticateReviewMemberMixin):
    """
    WebSocket consumer for review group communications
    All members of a review can receive real-time updates
    """

    async def connect(self):
        await self.authenticate()

        self.group_name = f"review_{self.review_id}"

        # Join review group
        await self.channel_layer.group_add(self.group_name, self.channel_name)

        logger.info(
            f"User {self.user.id} ({self.user.email}) joined review group {self.review_id}"
        )

        # Send recent messages to newly connected user
        recent_messages = await self.get_recent_messages()
        await self.send_json({"type": "message_history", "messages": recent_messages})

    async def disconnect(self, close_code):
        # Leave review group
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

        logger.info(
            f"User {self.user.id if self.user else 'Unknown'} "
            f"left review group {self.review_id} (code: {close_code})"
        )

    @database_sync_to_async
    def get_recent_messages(self, limit=50):
        """Get recent chat messages"""
        messages = (
            ReviewChatMessage.objects.filter(review_id=self.review_id)
            .select_related("member__user")
            .order_by("-created_at")[:limit]
        )

        result = []
        for msg in reversed(messages):
            avatar_url = None
            if msg.member and msg.member.user.avatar:
                # Build absolute URL
                avatar_url = f"{settings.SITE_URL}{settings.MEDIA_URL}{msg.member.user.avatar.name}"

            message_data = {
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
            result.append(message_data)
        return result

    @database_sync_to_async
    def save_chat_message(self, message):
        """Save chat message to database"""
        try:
            chat_message = ReviewChatMessage.objects.create(
                review_id=self.review_id,
                member=self.member,
                message=message,
                is_system_message=False,
            )

            avatar_url = None
            if self.member.user.avatar:
                avatar_url = f"{settings.SITE_URL}{settings.MEDIA_URL}{self.member.user.avatar.name}"

            return {
                "id": chat_message.id,
                "user_name": chat_message.user_name,
                "avatar_url": avatar_url,
                "created_at": chat_message.created_at.isoformat(),
            }
        except Exception as e:
            logger.exception(f"Error saving chat message: {str(e)}")
            return None

    # Update chat_message handler
    async def handle_chat_message(self, content):
        """Handle chat message from user"""
        message = content.get("message", "").strip()

        if not message:
            logger.warning(f"Empty message from user {self.user.id}")
            return

        # Validate message length
        if len(message) > 5000:
            await self.send_json(
                {"type": "error", "message": "Message too long (max 5000 characters)"}
            )
            return

        # Save message to database
        chat_message = await self.save_chat_message(message)

        if not chat_message:
            await self.send_json({"type": "error", "message": "Failed to save message"})
            return

        # Broadcast to all group members
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

    # Update chat_message broadcast handler
    async def chat_message(self, event):
        """
        Broadcast chat message to all members
        Called from Django/Celery via channel layer
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

    async def receive_json(self, content):
        """Handle incoming messages from client"""
        message_type = content.get("type")

        if message_type == "chat_message":
            await self.handle_chat_message(content)
        elif message_type == "typing":
            # Optional: handle typing indicators
            await self.handle_typing(content)
        else:
            logger.warning(
                f"Unknown message type from user {self.user.id}: {message_type}"
            )

    async def handle_typing(self, content):
        """Handle typing indicator"""
        is_typing = content.get("is_typing", True)

        # Broadcast typing indicator to others (not to self)
        await self.channel_layer.group_send(
            self.group_name,
            {
                "type": "user_typing",
                "user_id": self.user.id,
                "user_name": f"{self.user.first_name} {self.user.last_name}".strip()
                or self.user.email,
                "is_typing": is_typing,
            },
        )

    async def user_typing(self, event):
        """
        Broadcast typing indicator
        Don't send to self
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


class ScreeningStatConsumer(AsyncJsonWebsocketConsumer, AuthenticateReviewMemberMixin):
    HEARTBEAT_INTERVAL = 30  # seconds
    MAX_IDLE_TIME = 60  # seconds without heartbeat = disconnect

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

        self.connection_id = (
            f"{self.user.id}_{self.review_id}_{timezone.now().timestamp()}"
        )

        self.last_heartbeat = timezone.now()

        # Track active connection
        cache_key = f"screening_stat_{self.user.id}_{self.review_id}"
        active_connections = cache.get(cache_key, set())
        active_connections.add(self.connection_id)
        cache.set(cache_key, active_connections, timeout=None)

        # Increment session count only for first tab
        if len(active_connections) == 1:
            await self._increment_session()

        # Start heartbeat checker
        self.heartbeat_task = asyncio.create_task(self._check_heartbeat())

        logger.info(f"Connection established: {self.connection_id}")

    async def disconnect(self, code):
        if self.heartbeat_task:
            self.heartbeat_task.cancel()

        if not self.member:
            return

        # Save any active tracking session
        if self.is_tracking and self.start_time:
            await self._save_current_session()

        # Remove from active connections
        cache_key = f"screening_stat_{self.user.id}_{self.review_id}"
        active_connections = cache.get(cache_key, set())
        active_connections.discard(self.connection_id)

        if active_connections:
            cache.set(cache_key, active_connections, timeout=None)
        else:
            cache.delete(cache_key)

        logger.info(f"Disconnected: {self.connection_id}")

    async def receive_json(self, content):
        """
        Handle messages from client

        Messages:
        - {"type": "heartbeat"}
        - {"type": "start_tracking"}
        - {"type": "stop_tracking"}
        - {"type": "break_start"}
        - {"type": "break_end"}
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
            # Start tracking
            if not self.is_on_break:
                await self._start_tracking()

        elif msg_type == "stop_tracking":
            # Stop tracking (navigated away)
            await self._stop_tracking()

        elif msg_type == "break_start":
            # User manually started break
            self.is_on_break = True
            await self._stop_tracking()
            await self.send_json({"type": "break_started"})
            logger.info(f"{self.connection_id} started break")

        elif msg_type == "break_end":
            # User manually ended break
            self.is_on_break = False
            await self._start_tracking()
            await self.send_json({"type": "break_ended"})
            logger.info(f"{self.connection_id} ended break")

    async def _start_tracking(self):
        """Start tracking time"""
        if not self.is_tracking:
            self.is_tracking = True
            self.start_time = timezone.now()
            logger.debug(f"{self.connection_id} started tracking")

    async def _stop_tracking(self):
        """Stop tracking and save current session"""
        if self.is_tracking and self.start_time:
            await self._save_current_session()
            self.is_tracking = False
            self.start_time = None
            logger.debug(f"{self.connection_id} stopped tracking")

    async def _save_current_session(self):
        """Save the current tracking session"""
        if not self.start_time:
            return

        now = timezone.now()
        delta = now - self.start_time
        total_seconds = int(delta.total_seconds())

        # Only save if >= 5 seconds
        if total_seconds >= 5:
            await self._update_stats(total_seconds)
            logger.debug(f"{self.connection_id} saved session: {total_seconds}s")

    async def _check_heartbeat(self):
        """Periodically check if client is still alive"""
        try:
            while True:
                await asyncio.sleep(self.HEARTBEAT_INTERVAL)

                if self.last_heartbeat:
                    idle_time = (timezone.now() - self.last_heartbeat).total_seconds()
                    if idle_time > self.MAX_IDLE_TIME:
                        logger.warning(
                            f"Connection {self.connection_id} idle for {idle_time}s, closing"
                        )
                        await self.close(code=4008)
                        break
        except asyncio.CancelledError:
            pass

    async def _increment_session(self):
        """Increment session count"""

        def _do_increment():
            stat, _ = ScreeningStat.objects.get_or_create(member=self.member)
            stat.sessions += 1
            stat.save(update_fields=["sessions"])

        await sync_to_async(_do_increment)()

    async def _update_stats(self, seconds):
        """Update time spent"""

        def _do_update():
            stat, _ = ScreeningStat.objects.get_or_create(member=self.member)
            stat.seconds += seconds
            stat.save(update_fields=["seconds"])

        await sync_to_async(_do_update)()
