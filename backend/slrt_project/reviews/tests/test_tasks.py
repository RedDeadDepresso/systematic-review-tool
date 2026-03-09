"""
Tests for slrt_project/reviews/utils.py and the reference-import /
duplicate-detection Celery tasks.

Strategy
--------
Pure utility functions (parse_bibtex_date, parse_ris_date, etc.) are tested as
plain (no-DB) unit tests — no mocking required.

extract_*_reference_fields helpers are also plain unit tests: they produce
unsaved Reference instances so no DB is needed.

Celery tasks (import_references_task, detect_duplicates_task,
auto_deduplicate_task) are DB tests.  The bind=True calling convention is
handled by _patch_task (see docstring), which uses push_request / pop_request
to set the task's request context and patches task.retry via patch.object so
no broker is required.

send_review_chat_message is a DB test that stubs out the channel layer.

One class per function / task; one method per behaviour.

Run with:
    pytest slrt_project/reviews/tests/test_tasks.py -v
    pytest slrt_project/reviews/tests/test_utils.py -v
"""

import contextlib
from unittest.mock import MagicMock, patch

import pytest


# ===========================================================================
# Shared helpers
# ===========================================================================


@contextlib.contextmanager
def _patch_task(task, retries=0, max_retries=3):
    """
    Patch a real Celery bind=True task for unit testing without a broker.

    Celery injects the real task instance as ``self`` when called normally:
    ``task(arg)`` → ``task.run(task, arg)``.  Tests call ``task(arg)`` and
    use this context manager to set request state and intercept retry().

    ``task.retry`` is patched via ``patch.object`` (not plain attribute
    assignment) because Celery's retry is a bound method and direct
    assignment can be bypassed by the descriptor protocol.

    ``retry`` raises immediately so tests that hit error paths do not
    attempt to re-enqueue to a real broker.
    """
    retry_mock = MagicMock(side_effect=Exception("celery-retry"))
    task.push_request(id="test-task-id", retries=retries)
    with (
        patch.object(task, "retry", retry_mock),
        patch.object(task, "max_retries", max_retries),
    ):
        try:
            yield task
        finally:
            task.pop_request()


# ===========================================================================
# send_review_chat_message
# ===========================================================================


@pytest.mark.django_db
class TestSendReviewChatMessage:
    def test_creates_chat_message(self):
        from slrt_project.reviews.models import ReviewChatMessage
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
        )

        review = ReviewFactory()
        member = ReviewMemberFactory(review=review)
        with patch("slrt_project.reviews.utils.get_channel_layer", return_value=None):
            from slrt_project.reviews.utils import send_review_chat_message

            msg = send_review_chat_message(
                review_id=review.id,
                member=member,
                message="Hello",
                is_system_message=True,
                metadata={"action": "test"},
            )
        assert ReviewChatMessage.objects.filter(id=msg.id).exists()
        assert msg.message == "Hello"
        assert msg.is_system_message is True

    def test_returns_without_broadcast_when_no_channel_layer(self):
        from slrt_project.reviews.tests.factories import ReviewFactory

        review = ReviewFactory()
        with patch("slrt_project.reviews.utils.get_channel_layer", return_value=None):
            from slrt_project.reviews.utils import send_review_chat_message

            msg = send_review_chat_message(review.id, None, "System msg")
        assert msg.member is None

    def test_broadcasts_when_channel_layer_available(self):
        from slrt_project.reviews.tests.factories import (
            ReviewFactory,
            ReviewMemberFactory,
        )

        review = ReviewFactory()
        member = ReviewMemberFactory(review=review)
        mock_layer = MagicMock()
        with (
            patch(
                "slrt_project.reviews.utils.get_channel_layer", return_value=mock_layer
            ),
            patch("slrt_project.reviews.utils.async_to_sync") as mock_async,
        ):
            mock_async.return_value = MagicMock()
            from slrt_project.reviews.utils import send_review_chat_message

            send_review_chat_message(review.id, member, "Broadcast me")
        mock_async.assert_called_once()


# ===========================================================================
# import_references_task
# ===========================================================================


@pytest.mark.django_db
class TestImportReferencesTask:
    def _run(self, review_id, member_id, search_method_id, file_type="bib"):
        from slrt_project.reviews.tasks import import_references_task

        with (
            _patch_task(import_references_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
        ):
            return import_references_task(
                review_id, member_id, search_method_id, file_type
            )

    @contextlib.contextmanager
    def _with_file(self, sm, path="/tmp/test.bib"):
        """
        Context manager that makes the task see a real SearchMethod with a file.

        The task does ``SearchMethod.objects.get(id=…)`` internally, so mutating
        the local ``sm`` variable is not enough — the task would get a fresh
        instance from the DB with no file.

        We patch both:
          1. ``SearchMethod.objects.get`` to return our controlled ``sm``
             instance (a real SearchMethod so the Reference FK assignment works).
          2. The ``FieldFile.name`` attribute and ``path`` property on that
             instance so ``bool(search_method.file)`` is truthy and
             ``search_method.file.path`` returns our fake path without hitting
             storage.
        """
        sm.file.name = "fake/test.bib"
        with (
            patch.object(
                type(sm.file), "path", new_callable=lambda: property(lambda self: path)
            ),
            patch(
                "slrt_project.reviews.tasks.SearchMethod.objects.get", return_value=sm
            ),
        ):
            yield sm

    def test_returns_failure_when_review_not_found(self):
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        sm = SearchMethodFactory(review=member.review)
        result = self._run(review_id=99999, member_id=member.id, search_method_id=sm.id)
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_returns_failure_when_search_method_not_found(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        result = self._run(
            review_id=member.review.id, member_id=member.id, search_method_id=99999
        )
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_returns_failure_when_no_file_attached(self):
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        sm = SearchMethodFactory(review=member.review)
        # SearchMethodFactory leaves file blank — no patch needed, the real DB
        # object has no file so the guard triggers naturally.
        result = self._run(member.review.id, member.id, sm.id)
        assert result["success"] is False
        assert "No file" in result["error"]

    def test_returns_failure_for_unsupported_file_type(self):
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        sm = SearchMethodFactory(review=member.review)
        from slrt_project.reviews.tasks import import_references_task

        with (
            self._with_file(sm),
            _patch_task(import_references_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
            patch(
                "slrt_project.reviews.tasks._parse_file",
                side_effect=Exception("Unsupported file type: pdf"),
            ),
        ):
            with pytest.raises(Exception, match="celery-retry"):
                import_references_task(member.review.id, member.id, sm.id, "pdf")

    def test_imports_bibtex_entries_and_creates_references(self):
        from slrt_project.references.models import Reference
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        sm = SearchMethodFactory(review=member.review)

        mock_entries = [
            {
                "ENTRYTYPE": "article",
                "title": "Test Article",
                "author": "Smith, J and Doe, A",
                "journal": "Nature",
                "year": "2022",
                "doi": "10.1000/xyz",
            }
        ]

        before = Reference.objects.filter(review=member.review).count()
        from slrt_project.reviews.tasks import import_references_task

        with (
            self._with_file(sm),
            _patch_task(import_references_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
            patch("slrt_project.reviews.tasks._parse_file", return_value=mock_entries),
            patch(
                "slrt_project.reviews.tasks.SearchMethod.objects.filter"
            ) as mock_filter,
        ):
            mock_filter.return_value.exists.return_value = False
            result = import_references_task(member.review.id, member.id, sm.id, "bib")

        assert result["success"] is True
        assert result["imported_count"] == 1
        assert Reference.objects.filter(review=member.review).count() == before + 1

    def test_returns_failure_when_file_is_empty(self):
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        sm = SearchMethodFactory(review=member.review)
        from slrt_project.reviews.tasks import import_references_task

        with (
            self._with_file(sm),
            _patch_task(import_references_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
            patch("slrt_project.reviews.tasks._parse_file", return_value=[]),
        ):
            result = import_references_task(member.review.id, member.id, sm.id, "bib")
        assert result["success"] is False
        assert "empty" in result["error"]

    def test_resets_duplicate_detection_status_when_not_started(self):
        from slrt_project.reviews.models import Review
        from slrt_project.reviews.tests.factories import (
            ReviewMemberFactory,
            SearchMethodFactory,
        )

        member = ReviewMemberFactory()
        review = member.review
        review.duplicate_detection_status = Review.DuplicateDetectionStatus.COMPLETED
        review.save()
        sm = SearchMethodFactory(review=review)
        mock_entries = [{"ENTRYTYPE": "article", "title": "T", "year": "2020"}]
        from slrt_project.reviews.tasks import import_references_task

        with (
            self._with_file(sm),
            _patch_task(import_references_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
            patch("slrt_project.reviews.tasks._parse_file", return_value=mock_entries),
            patch(
                "slrt_project.reviews.tasks.SearchMethod.objects.filter"
            ) as mock_filter,
        ):
            mock_filter.return_value.exists.return_value = False
            import_references_task(review.id, member.id, sm.id, "bib")
        review.refresh_from_db()
        assert (
            review.duplicate_detection_status
            == Review.DuplicateDetectionStatus.NOT_STARTED
        )


# ===========================================================================
# detect_duplicates_task
# ===========================================================================


@pytest.mark.django_db
class TestDetectDuplicatesTask:
    def _run(self, review_id, member_id, threshold=0.5):
        from slrt_project.reviews.tasks import detect_duplicates_task

        with (
            _patch_task(detect_duplicates_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
        ):
            return detect_duplicates_task(review_id, member_id, threshold)

    def test_returns_failure_when_review_not_found(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        result = self._run(99999, member.id)
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_returns_zero_clusters_when_no_references(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        # No references created → short-circuit path.
        result = self._run(member.review.id, member.id)
        assert result["success"] is True
        assert result["clusters_found"] == 0

    def test_sets_status_to_completed_when_no_references(self):
        from slrt_project.reviews.models import Review
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        self._run(member.review.id, member.id)
        member.review.refresh_from_db()
        assert (
            member.review.duplicate_detection_status
            == Review.DuplicateDetectionStatus.COMPLETED
        )

    def test_calls_detect_and_persist_clusters(self):
        from slrt_project.references.tests.factories import ReferenceFactory
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        ReferenceFactory(review=member.review)
        ReferenceFactory(review=member.review)

        with (
            patch(
                "slrt_project.reviews.tasks.detect_and_persist_clusters"
            ) as mock_detect,
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
        ):
            mock_detect.return_value = {"clusters_created": 1}
            from slrt_project.reviews.tasks import detect_duplicates_task

            with _patch_task(detect_duplicates_task):
                result = detect_duplicates_task(
                    member.review.id, member.id, threshold=0.7
                )

        assert result["success"] is True
        assert result["clusters_found"] == 1
        mock_detect.assert_called_once()
        _, kwargs = mock_detect.call_args
        assert kwargs["fuzzy_threshold"] == 0.7

    def test_sets_status_completed_after_detection(self):
        from slrt_project.references.tests.factories import ReferenceFactory
        from slrt_project.reviews.models import Review
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        ReferenceFactory(review=member.review)

        with (
            patch(
                "slrt_project.reviews.tasks.detect_and_persist_clusters",
                return_value={"clusters_created": 0},
            ),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
        ):
            from slrt_project.reviews.tasks import detect_duplicates_task

            with _patch_task(detect_duplicates_task):
                detect_duplicates_task(member.review.id, member.id)

        member.review.refresh_from_db()
        assert (
            member.review.duplicate_detection_status
            == Review.DuplicateDetectionStatus.COMPLETED
        )


# ===========================================================================
# auto_deduplicate_task
# ===========================================================================


@pytest.mark.django_db
class TestAutoDedupTask:
    def _run(self, review_id, member_id=None, **kwargs):
        from slrt_project.reviews.tasks import auto_deduplicate_task

        with (
            _patch_task(auto_deduplicate_task),
            patch("slrt_project.reviews.tasks.send_review_chat_message"),
        ):
            return auto_deduplicate_task(review_id, member_id, **kwargs)

    def _mock_manager(self, clusters_created=0, auto_resolved=0, kept=0, removed=0):
        manager = MagicMock()
        manager.run.return_value = {"clusters_created": clusters_created}
        manager.auto_resolve.return_value = {
            "auto_resolved": auto_resolved,
            "kept_references": kept,
            "removed_references": removed,
        }
        return manager

    def test_returns_success_with_no_clusters(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        with patch(
            "slrt_project.reviews.tasks.DuplicateClusterManager",
            return_value=self._mock_manager(),
        ):
            result = self._run(member.review.id, member.id)
        assert result["success"] is True
        assert result["clusters_found"] == 0
        assert result["auto_resolved"] == 0

    def test_detect_first_false_skips_detection(self):
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        mock_mgr = self._mock_manager(auto_resolved=2, kept=1, removed=1)
        with patch(
            "slrt_project.reviews.tasks.DuplicateClusterManager", return_value=mock_mgr
        ):
            result = self._run(member.review.id, member.id, detect_first=False)
        mock_mgr.run.assert_not_called()
        assert result["auto_resolved"] == 2

    def test_auto_resolves_clusters(self):
        from slrt_project.references.tests.factories import ReferenceFactory
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        ReferenceFactory.create_batch(3, review=member.review)
        mock_mgr = self._mock_manager(
            clusters_created=2, auto_resolved=2, kept=2, removed=2
        )
        with patch(
            "slrt_project.reviews.tasks.DuplicateClusterManager", return_value=mock_mgr
        ):
            result = self._run(member.review.id, member.id, detect_first=True)
        assert result["success"] is True
        assert result["clusters_found"] == 2
        assert result["auto_resolved"] == 2
        assert result["kept_references"] == 2
        assert result["removed_references"] == 2

    def test_member_id_none_treated_as_system(self):
        from slrt_project.reviews.tests.factories import ReviewFactory

        review = ReviewFactory()
        with patch(
            "slrt_project.reviews.tasks.DuplicateClusterManager",
            return_value=self._mock_manager(),
        ):
            result = self._run(review.id, member_id=None)
        assert result["success"] is True

    def test_sets_detection_status_completed_when_clusters_found(self):
        from slrt_project.references.tests.factories import ReferenceFactory
        from slrt_project.reviews.models import Review
        from slrt_project.reviews.tests.factories import ReviewMemberFactory

        member = ReviewMemberFactory()
        ReferenceFactory(review=member.review)
        mock_mgr = self._mock_manager(
            clusters_created=1, auto_resolved=1, kept=1, removed=0
        )
        with patch(
            "slrt_project.reviews.tasks.DuplicateClusterManager", return_value=mock_mgr
        ):
            self._run(member.review.id, member.id, detect_first=True)
        member.review.refresh_from_db()
        assert (
            member.review.duplicate_detection_status
            == Review.DuplicateDetectionStatus.COMPLETED
        )


# ===========================================================================
# _parse_file helper
# ===========================================================================


class TestParseFile:
    def _fn(self, file_type, file_path):
        from slrt_project.reviews.tasks import _parse_file

        return _parse_file(file_type, file_path)

    def test_unsupported_type_raises(self):
        with pytest.raises(Exception, match="Unsupported file type"):
            self._fn("pdf", "/some/path.pdf")

    def test_bibtex_delegates_to_parse_bibtex(self):
        with patch(
            "slrt_project.reviews.tasks._parse_bibtex", return_value=[{"a": 1}]
        ) as m:
            result = self._fn("bib", "/tmp/f.bib")
        m.assert_called_once_with("/tmp/f.bib")
        assert result == [{"a": 1}]

    def test_ris_delegates_to_parse_ris(self):
        with patch("slrt_project.reviews.tasks._parse_ris", return_value=[]) as m:
            self._fn("ris", "/tmp/f.ris")
        m.assert_called_once_with("/tmp/f.ris")

    def test_endnote_delegates_to_parse_endnote(self):
        with patch("slrt_project.reviews.tasks._parse_endnote", return_value=[]) as m:
            self._fn("endnote", "/tmp/f.xml")
        m.assert_called_once_with("/tmp/f.xml")
