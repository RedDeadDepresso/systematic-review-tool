"""
Tests for slrt_project/integrations/tasks.py.

Strategy
Helper functions (zotero_type_to_pub_type, format_creators, parse_zotero_date,
get_or_create_zotero_search_method) are tested as plain unit tests — no mocking
required because they have no side effects.

Run with:
pytest slrt_project/integrations/tests/test_tasks.py -v
"""

import contextlib
from datetime import date
from unittest.mock import MagicMock, patch

import pytest


# zotero_type_to_pub_type


class TestZoteroTypeToPubType:
    def _fn(self, v):
        from slrt_project.integrations.tasks import zotero_type_to_pub_type

        return zotero_type_to_pub_type(v)

    def test_journal_article(self):
        assert self._fn("journalArticle") == "journal article"

    def test_conference_paper(self):
        assert self._fn("conferencePaper") == "conference paper"

    def test_book(self):
        assert self._fn("book") == "book"

    def test_book_section(self):
        assert self._fn("bookSection") == "book chapter"

    def test_thesis(self):
        assert self._fn("thesis") == "thesis"

    def test_unknown_defaults_to_journal_article(self):
        assert self._fn("unknownType") == "journal article"

    def test_empty_string_defaults(self):
        assert self._fn("") == "journal article"


# format_creators


class TestFormatCreators:
    def _fn(self, v):
        from slrt_project.integrations.tasks import format_creators

        return format_creators(v)

    def test_empty_list_returns_empty_string(self):
        assert self._fn([]) == ""

    def test_none_returns_empty_string(self):
        assert self._fn(None) == ""

    def test_single_author_two_field_format(self):
        creators = [{"creatorType": "author", "lastName": "Smith", "firstName": "John"}]
        assert self._fn(creators) == "Smith, John"

    def test_single_author_name_field(self):
        creators = [{"creatorType": "author", "name": "John Smith"}]
        assert self._fn(creators) == "John Smith"

    def test_only_last_name(self):
        creators = [{"creatorType": "author", "lastName": "Smith"}]
        assert self._fn(creators) == "Smith"

    def test_multiple_authors_joined_by_semicolons(self):
        creators = [
            {"creatorType": "author", "lastName": "Smith", "firstName": "John"},
            {"creatorType": "author", "lastName": "Jones", "firstName": "Jane"},
        ]
        assert self._fn(creators) == "Smith, John; Jones, Jane"

    def test_non_author_creator_types_skipped(self):
        creators = [
            {"creatorType": "editor", "lastName": "Ed", "firstName": "E"},
            {"creatorType": "author", "lastName": "Auth", "firstName": "A"},
        ]
        assert self._fn(creators) == "Auth, A"

    def test_all_editors_returns_empty_string(self):
        creators = [{"creatorType": "editor", "lastName": "Ed", "firstName": "E"}]
        assert self._fn(creators) == ""


# parse_zotero_date


class TestParseZoteroDate:
    def _fn(self, v):
        from slrt_project.integrations.tasks import parse_zotero_date

        return parse_zotero_date(v)

    def test_none_returns_none(self):
        assert self._fn(None) is None

    def test_empty_string_returns_none(self):
        assert self._fn("") is None

    def test_no_year_returns_none(self):
        assert self._fn("no date here") is None

    def test_year_only_returns_jan_1(self):
        result = self._fn("2023")
        assert result == date(2023, 1, 1)

    def test_iso_date_string(self):
        assert self._fn("2023-07-15") == date(2023, 7, 15)

    def test_slash_date_string(self):
        assert self._fn("2023/07/15") == date(2023, 7, 15)

    def test_year_embedded_in_text(self):
        result = self._fn("Published in 2021")
        assert result == date(2021, 1, 1)

    def test_pre_1900_year_ignored(self):
        # Only years matching (19|20)\d{2} are accepted.
        assert self._fn("1899-01-01") is None

    def test_returns_date_not_datetime(self):
        result = self._fn("2023-07-15")
        assert isinstance(result, date)


# send_task_update


class TestSendTaskUpdate:
    def test_sends_to_channel_group(self):
        from slrt_project.integrations.tasks import send_task_update

        mock_layer = MagicMock()
        with (
            patch(
                "slrt_project.integrations.tasks.get_channel_layer",
                return_value=mock_layer,
            ),
            patch("slrt_project.integrations.tasks.async_to_sync") as mock_a2s,
        ):
            mock_group_send = MagicMock()
            mock_a2s.return_value = mock_group_send
            send_task_update("task-1", "PROGRESS", "Doing stuff")
            mock_a2s.assert_called_once()
            mock_group_send.assert_called_once()
            call_args = mock_group_send.call_args[0]
            assert call_args[0] == "task_task-1"

    def test_no_op_when_channel_layer_none(self):
        from slrt_project.integrations.tasks import send_task_update

        with (
            patch(
                "slrt_project.integrations.tasks.get_channel_layer", return_value=None
            ),
            patch("slrt_project.integrations.tasks.async_to_sync") as mock_a2s,
        ):
            send_task_update("task-1", "SUCCESS", "Done")
            mock_a2s.assert_not_called()

    def test_result_included_when_provided(self):
        from slrt_project.integrations.tasks import send_task_update

        mock_layer = MagicMock()
        sent_data = {}

        def capture(group_name, message):
            sent_data.update(message["data"])

        with (
            patch(
                "slrt_project.integrations.tasks.get_channel_layer",
                return_value=mock_layer,
            ),
            patch(
                "slrt_project.integrations.tasks.async_to_sync",
                return_value=capture,
            ),
        ):
            send_task_update("t1", "SUCCESS", "Done", result={"pushed": 5})
        assert sent_data.get("result") == {"pushed": 5}


# get_or_create_zotero_search_method


@pytest.mark.django_db
class TestGetOrCreateZoteroSearchMethod:
    def test_creates_search_method(self):
        from slrt_project.integrations.tasks import get_or_create_zotero_search_method
        from slrt_project.reviews.tests.factories import ReviewFactory

        review = ReviewFactory()
        sm = get_or_create_zotero_search_method(review)
        assert sm.name == "Zotero Import"
        assert sm.review == review

    def test_idempotent_when_called_twice(self):
        from slrt_project.integrations.tasks import get_or_create_zotero_search_method
        from slrt_project.reviews.models import SearchMethod
        from slrt_project.reviews.tests.factories import ReviewFactory

        review = ReviewFactory()
        get_or_create_zotero_search_method(review)
        get_or_create_zotero_search_method(review)
        count = SearchMethod.objects.filter(review=review, name="Zotero Import").count()
        assert count == 1


# push_references_to_zotero_task


@contextlib.contextmanager
def _patch_task(task, retries=0, max_retries=3):
    """
    Patch a real Celery task object in-place for unit testing bind=True tasks.
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


@pytest.mark.django_db
class TestPushReferencesTask:
    def _run(self, review_id):
        from slrt_project.integrations.tasks import push_references_to_zotero_task

        with (
            _patch_task(push_references_to_zotero_task),
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            return push_references_to_zotero_task(review_id)

    def test_returns_failure_when_review_not_found(self):
        result = self._run(review_id=99999)
        assert result["success"] is False
        assert "Review not found" in result["error"]

    def test_returns_failure_when_integration_missing(self):
        from slrt_project.reviews.tests.factories import ReviewFactory

        review = ReviewFactory()  # no ZoteroIntegration
        result = self._run(review.id)
        assert result["success"] is False
        assert "not configured" in result["error"]

    def test_returns_success_when_no_refs_to_push(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory()
        # No references in DB → nothing to push.
        result = self._run(integration.review.id)
        assert result["success"] is True
        assert result["pushed"] == 0

    def test_returns_failure_when_not_configured(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory(inactive=True)
        result = self._run(integration.review.id)
        assert result["success"] is False

    def test_pushes_refs_and_creates_sync_log(self):
        from slrt_project.integrations.models import ZoteroSyncLog
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.tests.factories import ReferenceFactory

        integration = ZoteroIntegrationFactory()
        ReferenceFactory(
            review=integration.review,
            zotero_key=None,
            in_full_text=True,
        )
        mock_push_result = {"created": 1, "failed": 0, "errors": None}
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            MockService.return_value.push_references_to_zotero.return_value = (
                mock_push_result
            )
            from slrt_project.integrations.tasks import push_references_to_zotero_task

            with _patch_task(push_references_to_zotero_task):
                result = push_references_to_zotero_task(integration.review.id)

        assert result["pushed"] == 1
        assert ZoteroSyncLog.objects.filter(
            review=integration.review, sync_type="push"
        ).exists()

    def test_updates_last_push_at(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.tests.factories import ReferenceFactory

        integration = ZoteroIntegrationFactory()
        assert integration.last_push_at is None
        ReferenceFactory(review=integration.review, zotero_key=None, in_full_text=True)
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            MockService.return_value.push_references_to_zotero.return_value = {
                "created": 1,
                "failed": 0,
                "errors": None,
            }
            from slrt_project.integrations.tasks import push_references_to_zotero_task

            with _patch_task(push_references_to_zotero_task):
                push_references_to_zotero_task(integration.review.id)
        integration.refresh_from_db()
        assert integration.last_push_at is not None


# pull_references_from_zotero_task


def _zotero_item(key="K1", item_type="journalArticle", title="Test Paper"):
    """Build a minimal pyzotero item dict."""
    return {
        "data": {
            "key": key,
            "itemType": item_type,
            "title": title,
            "creators": [
                {"creatorType": "author", "lastName": "Smith", "firstName": "J"}
            ],
            "date": "2023",
            "abstractNote": "",
            "DOI": "",
            "url": "",
            "version": 1,
        }
    }


@pytest.mark.django_db
class TestPullReferencesTask:
    def _run(self, review_id, force=False):
        from slrt_project.integrations.tasks import pull_references_from_zotero_task

        with (
            _patch_task(pull_references_from_zotero_task),
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            return pull_references_from_zotero_task(review_id, force=force)

    def test_returns_failure_when_review_not_found(self):
        result = self._run(99999)
        assert result["success"] is False

    def test_returns_failure_when_not_configured(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory(inactive=True)
        result = self._run(integration.review.id)
        assert result["success"] is False

    def test_creates_reference_from_pulled_item(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.models import Reference

        integration = ZoteroIntegrationFactory()
        pull_result = {
            "success": True,
            "items": [_zotero_item("NEWKEY")],
            "library_version": 10,
        }
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            svc = MockService.return_value
            svc.pull_references_from_zotero.return_value = pull_result
            # No PDF children.
            svc.get_item_with_children.return_value = {
                "success": True,
                "item": {},
                "children": [],
            }
            from slrt_project.integrations.tasks import pull_references_from_zotero_task

            with _patch_task(pull_references_from_zotero_task):
                result = pull_references_from_zotero_task(integration.review.id)

        assert result["items_created"] == 1
        assert Reference.objects.filter(
            review=integration.review, zotero_key="NEWKEY"
        ).exists()

    def test_updates_last_sync_version(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory()
        pull_result = {"success": True, "items": [], "library_version": 99}
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            MockService.return_value.pull_references_from_zotero.return_value = (
                pull_result
            )
            from slrt_project.integrations.tasks import pull_references_from_zotero_task

            with _patch_task(pull_references_from_zotero_task):
                pull_references_from_zotero_task(integration.review.id)
        integration.refresh_from_db()
        assert integration.last_sync_version == 99

    def test_creates_sync_log(self):
        from slrt_project.integrations.models import ZoteroSyncLog
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory()
        pull_result = {"success": True, "items": [], "library_version": 1}
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            MockService.return_value.pull_references_from_zotero.return_value = (
                pull_result
            )
            from slrt_project.integrations.tasks import pull_references_from_zotero_task

            with _patch_task(pull_references_from_zotero_task):
                pull_references_from_zotero_task(integration.review.id)
        assert ZoteroSyncLog.objects.filter(
            review=integration.review, sync_type="pull"
        ).exists()

    def test_skips_attachment_items(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.models import Reference

        integration = ZoteroIntegrationFactory()
        pull_result = {
            "success": True,
            "items": [_zotero_item("ATT1", item_type="attachment")],
            "library_version": 1,
        }
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            MockService.return_value.pull_references_from_zotero.return_value = (
                pull_result
            )
            from slrt_project.integrations.tasks import pull_references_from_zotero_task

            with _patch_task(pull_references_from_zotero_task):
                pull_references_from_zotero_task(integration.review.id)
        assert not Reference.objects.filter(review=integration.review).exists()

    def test_downloads_pdf_attachment(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory

        integration = ZoteroIntegrationFactory()
        pull_result = {
            "success": True,
            "items": [_zotero_item("PDFKEY")],
            "library_version": 1,
        }
        pdf_child = {
            "data": {
                "key": "PDFATT",
                "itemType": "attachment",
                "contentType": "application/pdf",
            }
        }
        with (
            patch("slrt_project.integrations.tasks.ZoteroService") as MockService,
            patch("slrt_project.integrations.tasks.send_task_update"),
        ):
            svc = MockService.return_value
            svc.pull_references_from_zotero.return_value = pull_result
            svc.get_item_with_children.return_value = {
                "success": True,
                "item": {},
                "children": [pdf_child],
            }
            svc.download_pdf_file.return_value = b"%PDF-fake"
            from slrt_project.integrations.tasks import pull_references_from_zotero_task

            with _patch_task(pull_references_from_zotero_task):
                result = pull_references_from_zotero_task(integration.review.id)

        assert result["pdfs_downloaded"] == 1
        svc.download_pdf_file.assert_called_once_with("PDFATT")


# sync_single_reference_pdf


@pytest.mark.django_db
class TestSyncSingleReferencePdf:
    def _run(self, reference_id):
        from slrt_project.integrations.tasks import sync_single_reference_pdf

        with _patch_task(sync_single_reference_pdf):
            return sync_single_reference_pdf(reference_id)

    def test_returns_failure_when_reference_not_found(self):
        result = self._run(99999)
        assert result["success"] is False
        assert "not found" in result["error"]

    def test_returns_failure_when_no_zotero_key(self):
        from slrt_project.references.tests.factories import ReferenceFactory

        ref = ReferenceFactory(zotero_key=None)
        result = self._run(ref.id)
        assert result["success"] is False
        assert "not linked" in result["error"]

    def test_returns_failure_when_no_pdf_child(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.tests.factories import ReferenceFactory

        integration = ZoteroIntegrationFactory()
        ref = ReferenceFactory(review=integration.review, zotero_key="ZKEY")
        with patch("slrt_project.integrations.tasks.ZoteroService") as MockService:
            MockService.return_value.get_item_with_children.return_value = {
                "success": True,
                "item": {},
                "children": [],
            }
            result = self._run(ref.id)
        assert result["success"] is False
        assert "No PDF" in result["error"]

    def test_downloads_pdf_and_saves_to_reference(self):
        from slrt_project.integrations.tests.factories import ZoteroIntegrationFactory
        from slrt_project.references.tests.factories import ReferenceFactory

        integration = ZoteroIntegrationFactory()
        ref = ReferenceFactory(review=integration.review, zotero_key="ZKEY")
        pdf_child = {
            "data": {
                "key": "PDFATT",
                "itemType": "attachment",
                "contentType": "application/pdf",
            }
        }
        with patch("slrt_project.integrations.tasks.ZoteroService") as MockService:
            svc = MockService.return_value
            svc.get_item_with_children.return_value = {
                "success": True,
                "item": {},
                "children": [pdf_child],
            }
            svc.download_pdf_file.return_value = b"%PDF-fake-content"
            result = self._run(ref.id)
        assert result["success"] is True
        assert result["pdf_size"] == len(b"%PDF-fake-content")
