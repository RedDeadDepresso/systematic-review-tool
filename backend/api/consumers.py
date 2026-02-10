import asyncio
import logging

from asgiref.sync import sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from django.core.cache import cache
from django.utils import timezone

from api.models import ReviewMember, ScreeningStat


logger = logging.getLogger(__name__)


class ScreeningStatConsumer(AsyncJsonWebsocketConsumer):
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
        self.user = self.scope["user"]
        self.review_id = self.scope["url_route"]["kwargs"]["review_id"]

        self.connection_id = (
            f"{self.user.id}_{self.review_id}_{timezone.now().timestamp()}"
        )

        if not self.user.is_authenticated:
            await self.close(code=4001)
            return

        try:
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
