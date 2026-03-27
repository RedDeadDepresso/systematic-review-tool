import asyncio
from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from django.utils import timezone

from slrt_project.shared.consumers import (
    ReviewGroupConsumer,
    ScreeningStatConsumer,
    TaskStatusConsumer,
)


# ── TaskStatusConsumer ─────────────────────────────────────────────────────────


class TestTaskStatusConsumerGetTaskStatus:
    """Unit tests for the synchronous ``_get_task_status`` helper."""

    def _make_consumer(self, task_id="abc"):
        consumer = TaskStatusConsumer()
        consumer.task_id = task_id
        return consumer

    def _mock_result(self, state, result=None, info=None):
        mock = MagicMock()
        mock.state = state
        mock.result = result
        mock.info = info or Exception("boom")
        return mock

    def test_pending_state(self):
        consumer = self._make_consumer()
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("PENDING"),
        ):
            payload = consumer._get_task_status()
        assert payload["status"] == "PENDING"
        assert "waiting" in payload["message"]

    def test_started_state(self):
        consumer = self._make_consumer()
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("STARTED"),
        ):
            payload = consumer._get_task_status()
        assert payload["status"] == "STARTED"
        assert "processing" in payload["message"]

    def test_success_state(self):
        consumer = self._make_consumer()
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("SUCCESS", result={"count": 3}),
        ):
            payload = consumer._get_task_status()
        assert payload["status"] == "SUCCESS"
        assert payload["result"] == {"count": 3}

    def test_failure_state(self):
        consumer = self._make_consumer()
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("FAILURE", info=Exception("boom")),
        ):
            payload = consumer._get_task_status()
        assert payload["status"] == "FAILURE"
        assert "boom" in payload["error"]

    def test_retry_state(self):
        consumer = self._make_consumer()
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("RETRY"),
        ):
            payload = consumer._get_task_status()
        assert payload["status"] == "RETRY"
        assert "retrying" in payload["message"]

    def test_task_id_always_present(self):
        consumer = self._make_consumer("task-xyz")
        with patch(
            "slrt_project.shared.consumers.AsyncResult",
            return_value=self._mock_result("PENDING"),
        ):
            payload = consumer._get_task_status()
        assert payload["task_id"] == "task-xyz"


@pytest.mark.asyncio
class TestTaskStatusConsumerWebSocket:
    """Tests for TaskStatusConsumer async methods (direct, no daphne dependency)."""

    async def test_send_initial_status_pushes_current_state(self):
        """send_initial_status fetches via executor and calls send_json."""
        consumer = TaskStatusConsumer()
        consumer.task_id = "t1"
        consumer.send_json = AsyncMock()

        mock_result = MagicMock()
        mock_result.state = "PENDING"
        mock_result.info = None

        with patch(
            "slrt_project.shared.consumers.AsyncResult", return_value=mock_result
        ):
            await consumer.send_initial_status()

        consumer.send_json.assert_called_once()
        sent = consumer.send_json.call_args[0][0]
        assert sent["status"] == "PENDING"

    async def test_task_status_update_forwards_data(self):
        consumer = TaskStatusConsumer()
        consumer.task_id = "t1"
        consumer.send_json = AsyncMock()
        consumer.close = AsyncMock()

        await consumer.task_status_update(
            {"data": {"task_id": "t1", "status": "STARTED"}}
        )

        consumer.send_json.assert_called_once()
        consumer.close.assert_not_called()

    async def test_task_status_update_closes_on_success(self):
        consumer = TaskStatusConsumer()
        consumer.task_id = "t1"
        consumer.send_json = AsyncMock()
        consumer.close = AsyncMock()

        await consumer.task_status_update(
            {"data": {"task_id": "t1", "status": "SUCCESS"}}
        )

        consumer.close.assert_called_once_with(code=1000)

    @pytest.mark.parametrize("status", ["FAILURE", "ERROR"])
    async def test_task_status_update_closes_on_terminal_statuses(self, status):
        consumer = TaskStatusConsumer()
        consumer.task_id = "t1"
        consumer.send_json = AsyncMock()
        consumer.close = AsyncMock()

        await consumer.task_status_update({"data": {"task_id": "t1", "status": status}})

        consumer.close.assert_called_once_with(code=1000)


# ── AuthenticateReviewMemberMixin (tested via ReviewGroupConsumer) ─────────────


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestAuthenticateReviewMemberMixin:
    async def test_authenticate_success_sets_member(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = await asyncio.get_event_loop().run_in_executor(
            None, ReviewMemberFactory
        )
        consumer = ReviewGroupConsumer()
        consumer.scope = {
            "url_route": {"kwargs": {"review_id": member.review_id}},
            "user": member.user,
        }
        consumer.channel_name = "test_channel"
        consumer.accept = AsyncMock()
        consumer.close = AsyncMock()
        consumer.channel_layer = MagicMock(
            group_add=AsyncMock(),
            group_discard=AsyncMock(),
        )
        consumer.send_json = AsyncMock()

        await consumer.authenticate()

        consumer.accept.assert_called_once()
        assert consumer.member.id == member.id

    async def test_authenticate_closes_4003_for_non_member(self):
        from slrt_project.reviews.tests.factories import ReviewFactory, UserFactory

        review = await asyncio.get_event_loop().run_in_executor(None, ReviewFactory)
        user = await asyncio.get_event_loop().run_in_executor(None, UserFactory)

        consumer = ReviewGroupConsumer()
        consumer.scope = {
            "url_route": {"kwargs": {"review_id": review.id}},
            "user": user,
        }
        consumer.accept = AsyncMock()
        consumer.close = AsyncMock()

        await consumer.authenticate()

        consumer.close.assert_called_once_with(code=4003)
        consumer.accept.assert_not_called()

    async def test_authenticate_closes_4000_on_exception(self):
        consumer = ReviewGroupConsumer()
        bad_user = MagicMock()
        bad_user.id = None  # causes .filter(user_id=None) to raise
        consumer.scope = {
            "url_route": {"kwargs": {"review_id": 99999}},
            "user": bad_user,
        }
        consumer.accept = AsyncMock()
        consumer.close = AsyncMock()

        with patch(
            "slrt_project.shared.consumers.sync_to_async",
            side_effect=Exception("db error"),
        ):
            await consumer.authenticate()

        consumer.close.assert_called_once_with(code=4000)


# ── ReviewGroupConsumer ────────────────────────────────────────────────────────


def _make_review_consumer(member):
    """
    Return a ``ReviewGroupConsumer`` with the authentication step already
    completed and all network methods replaced with ``AsyncMock``.
    """
    consumer = ReviewGroupConsumer()
    consumer.review_id = member.review_id
    consumer.user = member.user
    consumer.member = member
    consumer.group_name = f"review_{member.review_id}"
    consumer.channel_name = "test_channel"
    consumer.send_json = AsyncMock()
    consumer.close = AsyncMock()
    consumer.channel_layer = MagicMock(
        group_add=AsyncMock(),
        group_discard=AsyncMock(),
        group_send=AsyncMock(),
    )
    return consumer


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestReviewGroupConsumerChat:
    async def _member(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        return await asyncio.get_event_loop().run_in_executor(None, ReviewMemberFactory)

    async def test_connect_sends_message_history(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        with patch.object(consumer, "get_recent_messages", AsyncMock(return_value=[])):
            await consumer.connect()

        consumer.send_json.assert_called_once_with(
            {"type": "message_history", "messages": []}
        )

    async def test_disconnect_leaves_group(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        await consumer.disconnect(1000)

        consumer.channel_layer.group_discard.assert_called_once_with(
            consumer.group_name, consumer.channel_name
        )

    async def test_handle_chat_message_rejects_empty(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        await consumer.handle_chat_message({"message": "   "})

        consumer.send_json.assert_not_called()
        consumer.channel_layer.group_send.assert_not_called()

    async def test_handle_chat_message_rejects_too_long(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        await consumer.handle_chat_message({"message": "x" * 5001})

        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "error"
        assert "too long" in sent["message"]

    async def test_handle_chat_message_persists_and_broadcasts(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        fake_saved = {
            "id": 42,
            "user_name": "Alice",
            "avatar_url": None,
            "created_at": "2024-01-01T00:00:00",
        }
        with patch.object(
            consumer, "save_chat_message", AsyncMock(return_value=fake_saved)
        ):
            await consumer.handle_chat_message({"message": "Hello!"})

        consumer.channel_layer.group_send.assert_called_once()
        event = consumer.channel_layer.group_send.call_args[0][1]
        assert event["type"] == "chat_message"
        assert event["message"] == "Hello!"
        assert event["message_id"] == 42

    async def test_handle_chat_message_save_failure_sends_error(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        with patch.object(consumer, "save_chat_message", AsyncMock(return_value=None)):
            await consumer.handle_chat_message({"message": "Hi"})

        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "error"

    async def test_receive_json_dispatches_chat_message(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        with patch.object(consumer, "handle_chat_message", AsyncMock()) as mock_handler:
            await consumer.receive_json({"type": "chat_message", "message": "Hi"})

        mock_handler.assert_called_once()

    async def test_receive_json_dispatches_typing(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        with patch.object(consumer, "handle_typing", AsyncMock()) as mock_handler:
            await consumer.receive_json({"type": "typing", "is_typing": True})

        mock_handler.assert_called_once()

    async def test_receive_json_unknown_type_does_not_raise(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        # Should log a warning but not raise.
        await consumer.receive_json({"type": "mystery_event"})

    async def test_handle_typing_broadcasts_to_group(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        await consumer.handle_typing({"is_typing": True})

        consumer.channel_layer.group_send.assert_called_once()
        event = consumer.channel_layer.group_send.call_args[0][1]
        assert event["type"] == "user_typing"
        assert event["user_id"] == member.user.id

    async def test_user_typing_suppresses_own_events(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        # Event originates from this consumer's own user.
        await consumer.user_typing(
            {"user_id": member.user.id, "user_name": "Me", "is_typing": True}
        )

        consumer.send_json.assert_not_called()

    async def test_user_typing_forwards_other_users_events(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        await consumer.user_typing(
            {"user_id": 9999, "user_name": "Other", "is_typing": True}
        )

        consumer.send_json.assert_called_once()
        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "user_typing"
        assert sent["user_id"] == 9999

    async def test_chat_message_handler_forwards_all_fields(self):
        member = await self._member()
        consumer = _make_review_consumer(member)

        event = {
            "type": "chat_message",
            "message_id": 7,
            "member_id": member.id,
            "user_id": member.user.id,
            "user_name": "Alice",
            "avatar_url": None,
            "message": "Hello",
            "is_system_message": False,
            "metadata": None,
            "created_at": "2024-01-01T00:00:00",
        }
        await consumer.chat_message(event)

        sent = consumer.send_json.call_args[0][0]
        assert sent["message_id"] == 7
        assert sent["message"] == "Hello"


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestReviewGroupConsumerGetRecentMessages:
    async def test_returns_messages_in_chronological_order(self):
        from slrt_project.reviews.tests.factories import (
            ReviewChatMessageFactory,
            ReviewMemberFactory,
        )

        def _setup():
            member = ReviewMemberFactory()
            ReviewChatMessageFactory(
                review=member.review, member=member, message="first"
            )
            ReviewChatMessageFactory(
                review=member.review, member=member, message="second"
            )
            return member

        member = await asyncio.get_event_loop().run_in_executor(None, _setup)
        consumer = _make_review_consumer(member)

        messages = await consumer.get_recent_messages()

        assert len(messages) == 2
        # Oldest message first.
        assert messages[0]["message"] == "first"
        assert messages[1]["message"] == "second"

    async def test_system_message_has_no_user_id(self):
        from slrt_project.reviews.tests.factories import (
            ReviewChatMessageFactory,
            ReviewMemberFactory,
        )

        def _setup():
            member = ReviewMemberFactory()
            ReviewChatMessageFactory.create(
                review=member.review,
                member=None,
                is_system_message=True,
                message="sys",
            )
            return member

        member = await asyncio.get_event_loop().run_in_executor(None, _setup)
        consumer = _make_review_consumer(member)

        messages = await consumer.get_recent_messages()

        assert messages[0]["user_id"] is None
        assert messages[0]["is_system_message"] is True


# ── ScreeningStatConsumer ──────────────────────────────────────────────────────


def _make_screening_consumer(member, connection_id=None):
    """
    Return a ``ScreeningStatConsumer`` pre-loaded with the given member and
    all network methods replaced with ``AsyncMock``.
    """
    consumer = ScreeningStatConsumer()
    consumer.review_id = member.review_id
    consumer.user = member.user
    consumer.member = member
    consumer.connection_id = connection_id or f"{member.user_id}_{member.review_id}_1.0"
    consumer.channel_name = "test_channel"
    consumer.send_json = AsyncMock()
    consumer.close = AsyncMock()
    consumer.channel_layer = MagicMock(
        group_add=AsyncMock(),
        group_discard=AsyncMock(),
        group_send=AsyncMock(),
    )
    consumer.last_heartbeat = timezone.now()
    return consumer


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerConnect:
    async def _member(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        return await asyncio.get_event_loop().run_in_executor(None, ReviewMemberFactory)

    async def test_connect_increments_session_for_first_tab(self):
        from slrt_project.reviews.models import ScreeningStat

        member = await self._member()
        consumer = _make_screening_consumer(member)

        cache_key = f"screening_stat_{member.user_id}_{member.review_id}"
        from django.core.cache import cache as django_cache

        django_cache.delete(cache_key)

        with (
            patch.object(consumer, "authenticate", AsyncMock()),
            patch.object(ScreeningStatConsumer, "_check_heartbeat", new=AsyncMock()),
        ):
            consumer.heartbeat_task = MagicMock(cancel=MagicMock())
            await consumer.connect()

        stat = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.get(member=member),
        )
        assert stat.sessions == 1

    async def test_connect_does_not_increment_session_for_second_tab(self):
        from slrt_project.reviews.models import ScreeningStat

        member = await self._member()

        cache_key = f"screening_stat_{member.user_id}_{member.review_id}"
        from django.core.cache import cache as django_cache

        # Pre-populate cache as if a tab is already open.
        django_cache.set(cache_key, {"existing_connection_id"}, timeout=None)

        consumer = _make_screening_consumer(member, connection_id="new_tab")

        with (
            patch.object(consumer, "authenticate", AsyncMock()),
            patch.object(ScreeningStatConsumer, "_check_heartbeat", new=AsyncMock()),
        ):
            consumer.heartbeat_task = MagicMock(cancel=MagicMock())
            await consumer.connect()

        exists = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.filter(member=member).exists(),
        )
        # No stat should have been created (no increment happened).
        assert not exists

        django_cache.delete(cache_key)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerDisconnect:
    async def _member(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        return await asyncio.get_event_loop().run_in_executor(None, ReviewMemberFactory)

    async def test_disconnect_saves_in_progress_session(self):
        member = await self._member()
        consumer = _make_screening_consumer(member)
        consumer.is_tracking = True
        consumer.start_time = timezone.now() - timedelta(seconds=30)

        with patch.object(consumer, "_save_current_session", AsyncMock()) as mock_save:
            await consumer.disconnect(1000)

        mock_save.assert_called_once()

    async def test_disconnect_removes_connection_from_cache(self):
        from django.core.cache import cache as django_cache

        member = await self._member()
        consumer = _make_screening_consumer(member)
        cache_key = f"screening_stat_{member.user_id}_{member.review_id}"
        django_cache.set(cache_key, {consumer.connection_id}, timeout=None)

        await consumer.disconnect(1000)

        remaining = django_cache.get(cache_key)
        assert remaining is None  # entry deleted when set becomes empty

    async def test_disconnect_retains_cache_for_other_tabs(self):
        from django.core.cache import cache as django_cache

        member = await self._member()
        consumer = _make_screening_consumer(member, connection_id="tab_1")
        cache_key = f"screening_stat_{member.user_id}_{member.review_id}"
        django_cache.set(cache_key, {"tab_1", "tab_2"}, timeout=None)

        await consumer.disconnect(1000)

        remaining = django_cache.get(cache_key)
        assert remaining == {"tab_2"}
        django_cache.delete(cache_key)


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerReceiveJson:
    async def _consumer(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = await asyncio.get_event_loop().run_in_executor(
            None, ReviewMemberFactory
        )
        return _make_screening_consumer(member)

    async def test_heartbeat_resets_last_heartbeat_and_sends_ack(self):
        consumer = await self._consumer()
        old_ts = timezone.now() - timedelta(seconds=20)
        consumer.last_heartbeat = old_ts

        await consumer.receive_json({"type": "heartbeat"})

        assert consumer.last_heartbeat > old_ts
        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "heartbeat_ack"

    async def test_start_tracking_starts_when_not_on_break(self):
        consumer = await self._consumer()
        consumer.is_on_break = False

        await consumer.receive_json({"type": "start_tracking"})

        assert consumer.is_tracking is True
        assert consumer.start_time is not None

    async def test_start_tracking_ignored_while_on_break(self):
        consumer = await self._consumer()
        consumer.is_on_break = True

        await consumer.receive_json({"type": "start_tracking"})

        assert consumer.is_tracking is False

    async def test_stop_tracking_stops_and_saves(self):
        consumer = await self._consumer()
        consumer.is_tracking = True
        consumer.start_time = timezone.now() - timedelta(seconds=10)

        with patch.object(consumer, "_save_current_session", AsyncMock()) as mock_save:
            await consumer.receive_json({"type": "stop_tracking"})

        assert consumer.is_tracking is False
        mock_save.assert_called_once()

    async def test_break_start_stops_tracking_and_sets_flag(self):
        consumer = await self._consumer()
        consumer.is_tracking = True
        consumer.start_time = timezone.now() - timedelta(seconds=10)

        with patch.object(consumer, "_save_current_session", AsyncMock()):
            await consumer.receive_json({"type": "break_start"})

        assert consumer.is_on_break is True
        assert consumer.is_tracking is False
        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "break_started"

    async def test_break_end_clears_flag_and_starts_tracking(self):
        consumer = await self._consumer()
        consumer.is_on_break = True

        await consumer.receive_json({"type": "break_end"})

        assert consumer.is_on_break is False
        assert consumer.is_tracking is True
        sent = consumer.send_json.call_args[0][0]
        assert sent["type"] == "break_ended"


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerSaveSession:
    async def _consumer(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = await asyncio.get_event_loop().run_in_executor(
            None, ReviewMemberFactory
        )
        return _make_screening_consumer(member)

    async def test_discards_sessions_shorter_than_5_seconds(self):
        consumer = await self._consumer()
        consumer.start_time = timezone.now() - timedelta(seconds=3)

        with patch.object(consumer, "_update_stats", AsyncMock()) as mock_update:
            await consumer._save_current_session()

        mock_update.assert_not_called()

    async def test_saves_sessions_of_5_seconds_or_more(self):
        consumer = await self._consumer()
        consumer.start_time = timezone.now() - timedelta(seconds=10)

        with patch.object(consumer, "_update_stats", AsyncMock()) as mock_update:
            await consumer._save_current_session()

        mock_update.assert_called_once()
        saved_seconds = mock_update.call_args[0][0]
        assert saved_seconds >= 5

    async def test_save_session_no_ops_without_start_time(self):
        consumer = await self._consumer()
        consumer.start_time = None

        with patch.object(consumer, "_update_stats", AsyncMock()) as mock_update:
            await consumer._save_current_session()

        mock_update.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerCheckHeartbeat:
    async def test_closes_connection_after_idle_timeout(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = await asyncio.get_event_loop().run_in_executor(
            None, ReviewMemberFactory
        )
        consumer = _make_screening_consumer(member)
        # Simulate a heartbeat that arrived well beyond MAX_IDLE_TIME ago.
        consumer.last_heartbeat = timezone.now() - timedelta(
            seconds=ScreeningStatConsumer.MAX_IDLE_TIME + 10
        )

        with patch("asyncio.sleep", AsyncMock()):
            await consumer._check_heartbeat()

        consumer.close.assert_called_once_with(code=4008)

    async def test_does_not_close_within_idle_timeout(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = await asyncio.get_event_loop().run_in_executor(
            None, ReviewMemberFactory
        )
        consumer = _make_screening_consumer(member)
        consumer.last_heartbeat = timezone.now()  # just now → not idle

        sleep_calls = 0

        async def _sleep_once(_):
            nonlocal sleep_calls
            sleep_calls += 1
            if sleep_calls >= 2:
                raise asyncio.CancelledError()

        with patch("asyncio.sleep", side_effect=_sleep_once):
            await consumer._check_heartbeat()

        consumer.close.assert_not_called()


@pytest.mark.asyncio
@pytest.mark.django_db(transaction=True)
class TestScreeningStatConsumerDBHelpers:
    async def _member(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        return await asyncio.get_event_loop().run_in_executor(None, ReviewMemberFactory)

    async def test_increment_session_creates_stat_if_absent(self):
        from slrt_project.reviews.models import ScreeningStat

        member = await self._member()
        consumer = _make_screening_consumer(member)

        await consumer._increment_session()

        stat = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.get(member=member),
        )
        assert stat.sessions == 1

    async def test_increment_session_adds_to_existing_stat(self):
        from slrt_project.reviews.models import ScreeningStat
        from slrt_project.reviews.tests.factories import ScreeningStatFactory

        member = await self._member()
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStatFactory(member=member, sessions=2),
        )
        consumer = _make_screening_consumer(member)

        await consumer._increment_session()

        stat = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.get(member=member),
        )
        assert stat.sessions == 3

    async def test_update_stats_adds_seconds(self):
        from slrt_project.reviews.models import ScreeningStat
        from slrt_project.reviews.tests.factories import ScreeningStatFactory

        member = await self._member()
        await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStatFactory(member=member, seconds=100),
        )
        consumer = _make_screening_consumer(member)

        await consumer._update_stats(30)

        stat = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.get(member=member),
        )
        assert stat.seconds == 130

    async def test_update_stats_creates_stat_if_absent(self):
        from slrt_project.reviews.models import ScreeningStat

        member = await self._member()
        consumer = _make_screening_consumer(member)

        await consumer._update_stats(45)

        stat = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: ScreeningStat.objects.get(member=member),
        )
        assert stat.seconds == 45
