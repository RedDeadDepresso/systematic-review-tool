"""
Tests for slrt_project/integrations/services.py.

Strategy
All tests patch ``self.zot`` (the pyzotero client) via a MagicMock so no
real HTTP calls are made.  Tests are organised by public method.

Run with:
pytest slrt_project/integrations/tests/test_services.py -v
"""

from unittest.mock import MagicMock, patch

import pytest


# Factory helper — build a ZoteroService with a mocked pyzotero client


def make_service(**kwargs):
    """
    Return a ZoteroService with self.zot replaced by a MagicMock.
    """
    with patch("slrt_project.integrations.services.zotero.Zotero"):
        from slrt_project.integrations.services import ZoteroService

        svc = ZoteroService(
            library_id=kwargs.get("library_id", "123"),
            api_key=kwargs.get("api_key", "key"),
            library_type=kwargs.get("library_type", "user"),
        )
    svc.zot = MagicMock()
    return svc


# Constructor


class TestZoteroServiceInit:
    def test_stores_library_id(self):
        svc = make_service(library_id="999")
        assert svc.library_id == "999"

    def test_stores_library_type(self):
        svc = make_service(library_type="group")
        assert svc.library_type == "group"

    def test_default_library_type_is_user(self):
        svc = make_service()
        assert svc.library_type == "user"

    def test_batch_size_constants(self):
        from slrt_project.integrations.services import ZoteroService

        assert ZoteroService.MAX_WRITE_BATCH_SIZE == 50
        assert ZoteroService.MAX_READ_BATCH_SIZE == 100


# get_collections


class TestGetCollections:
    def test_returns_list_from_api(self):
        svc = make_service()
        svc.zot.collections.return_value = [{"key": "A"}, {"key": "B"}]
        result = svc.get_collections()
        assert len(result) == 2
        assert result[0]["key"] == "A"

    def test_returns_empty_list_on_exception(self):
        svc = make_service()
        svc.zot.collections.side_effect = Exception("network error")
        result = svc.get_collections()
        assert result == []

    def test_calls_zot_collections(self):
        svc = make_service()
        svc.zot.collections.return_value = []
        svc.get_collections()
        svc.zot.collections.assert_called_once()


# get_collection


class TestGetCollection:
    def test_returns_collection_dict(self):
        svc = make_service()
        svc.zot.collection.return_value = {"key": "COL1", "data": {"name": "Papers"}}
        result = svc.get_collection("COL1")
        assert result["key"] == "COL1"
        svc.zot.collection.assert_called_once_with("COL1")

    def test_returns_none_on_exception(self):
        svc = make_service()
        svc.zot.collection.side_effect = Exception("not found")
        assert svc.get_collection("MISSING") is None


# create_collection


class TestCreateCollection:
    def _api_response(self, key="NEW1", version=1):
        return {"successful": {"0": {"key": key, "version": version}}, "failed": {}}

    def test_returns_collection_on_success(self):
        svc = make_service()
        svc.zot.create_collections.return_value = self._api_response()
        result = svc.create_collection("My Collection")
        assert result["key"] == "NEW1"

    def test_passes_name_and_parent_to_api(self):
        svc = make_service()
        svc.zot.create_collections.return_value = self._api_response()
        svc.create_collection("Sub", parent_collection="PARENT1")
        svc.zot.create_collections.assert_called_once_with(
            [{"name": "Sub", "parentCollection": "PARENT1"}]
        )

    def test_returns_none_when_no_successful_entry(self):
        svc = make_service()
        svc.zot.create_collections.return_value = {
            "successful": {},
            "failed": {"0": {}},
        }
        assert svc.create_collection("Bad") is None

    def test_returns_none_on_exception(self):
        svc = make_service()
        svc.zot.create_collections.side_effect = Exception("API error")
        assert svc.create_collection("Boom") is None


# add_items_to_collection


class TestAddItemsToCollection:
    def test_returns_true_on_success(self):
        svc = make_service()
        svc.zot.addto_collection.return_value = None
        assert svc.add_items_to_collection(["A", "B"], "COL1") is True

    def test_returns_false_on_exception(self):
        svc = make_service()
        svc.zot.addto_collection.side_effect = Exception("oops")
        assert svc.add_items_to_collection(["A"], "COL1") is False

    def test_calls_api_with_correct_args(self):
        svc = make_service()
        svc.zot.addto_collection.return_value = None
        svc.add_items_to_collection(["K1", "K2"], "TARGET")
        svc.zot.addto_collection.assert_called_once_with("TARGET", ["K1", "K2"])


# push_references_to_zotero


class TestPushReferencesToZotero:
    def _mock_ref(
        self,
        pk=1,
        title="Paper",
        pub_type="journal article",
        journal="Nature",
        doi="10.1234/x",
        url="",
        abstract="",
        authors="Smith, John",
        pub_date=None,
    ):
        ref = MagicMock()
        ref.id = pk
        ref.pk = pk
        ref.title = title
        ref.publication_type = pub_type
        ref.journal = journal
        ref.doi = doi
        ref.url = url
        ref.abstract = abstract
        ref.authors = authors
        ref.publication_date = pub_date
        return ref

    def _success_response(self, count=1):
        successful = {str(i): {"key": f"KEY{i}", "version": i} for i in range(count)}
        return {"successful": successful, "failed": {}, "unchanged": {}}

    def test_returns_success_dict_with_counts(self):
        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(2)
        refs = [self._mock_ref(1), self._mock_ref(2)]
        result = svc.push_references_to_zotero(refs)
        assert result["success"] is True
        assert result["created"] == 2
        assert result["failed"] == 0

    def test_empty_list_returns_early(self):
        svc = make_service()
        result = svc.push_references_to_zotero([])
        svc.zot.create_items.assert_not_called()
        assert result["created"] == 0

    def test_truncates_oversized_batch(self):
        svc = make_service()
        refs = [self._mock_ref(i) for i in range(60)]
        svc.zot.create_items.return_value = self._success_response(50)
        svc.push_references_to_zotero(refs)
        # Should only send 50 items.
        call_args = svc.zot.create_items.call_args[0][0]
        assert len(call_args) == 50

    def test_adds_collection_when_provided(self):
        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(1)
        svc.push_references_to_zotero([self._mock_ref()], collection_key="COL1")
        items_sent = svc.zot.create_items.call_args[0][0]
        assert items_sent[0]["collections"] == ["COL1"]

    def test_no_collection_field_when_key_is_none(self):
        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(1)
        svc.push_references_to_zotero([self._mock_ref()], collection_key=None)
        items_sent = svc.zot.create_items.call_args[0][0]
        assert "collections" not in items_sent[0]

    def test_returns_failure_on_exception(self):
        svc = make_service()
        svc.zot.create_items.side_effect = Exception("API down")
        result = svc.push_references_to_zotero([self._mock_ref()])
        assert result["success"] is False
        assert result["created"] == 0

    def test_returns_failure_on_unexpected_response_format(self):
        svc = make_service()
        svc.zot.create_items.return_value = "not a dict"
        result = svc.push_references_to_zotero([self._mock_ref()])
        assert result["success"] is False

    def test_errors_key_is_none_when_no_failures(self):
        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(1)
        result = svc.push_references_to_zotero([self._mock_ref()])
        assert result["errors"] is None

    def test_errors_key_populated_on_partial_failure(self):
        svc = make_service()
        svc.zot.create_items.return_value = {
            "successful": {"0": {"key": "K0", "version": 1}},
            "failed": {"1": {"message": "bad item"}},
            "unchanged": {},
        }
        refs = [self._mock_ref(1), self._mock_ref(2)]
        result = svc.push_references_to_zotero(refs)
        assert result["failed"] == 1
        assert result["errors"] is not None

    @pytest.mark.django_db
    def test_updates_reference_with_zotero_key(self):
        from slrt_project.references.tests.factories import ReferenceFactory

        svc = make_service()
        ref = ReferenceFactory(zotero_key=None)
        svc.zot.create_items.return_value = {
            "successful": {"0": {"key": "ZOT123", "version": 7}},
            "failed": {},
            "unchanged": {},
        }
        svc.push_references_to_zotero([ref])
        ref.refresh_from_db()
        assert ref.zotero_key == "ZOT123"
        assert ref.zotero_version == 7

    def test_publication_date_formatted_as_iso(self):
        from datetime import date

        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(1)
        ref = self._mock_ref(pub_date=date(2023, 6, 15))
        svc.push_references_to_zotero([ref])
        items_sent = svc.zot.create_items.call_args[0][0]
        assert items_sent[0]["date"] == "2023-06-15"

    def test_empty_date_when_none(self):
        svc = make_service()
        svc.zot.create_items.return_value = self._success_response(1)
        ref = self._mock_ref(pub_date=None)
        svc.push_references_to_zotero([ref])
        items_sent = svc.zot.create_items.call_args[0][0]
        assert items_sent[0]["date"] == ""


# pull_references_from_zotero


class TestPullReferencesFromZotero:
    def _items(self, n=2):
        return [
            {"data": {"key": f"K{i}", "itemType": "journalArticle"}} for i in range(n)
        ]

    def test_returns_items_and_version(self):
        svc = make_service()
        svc.zot.top.return_value = self._items(3)
        svc.zot.last_modified_version.return_value = 42
        result = svc.pull_references_from_zotero()
        assert result["success"] is True
        assert len(result["items"]) == 3
        assert result["library_version"] == 42

    def test_uses_top_without_collection(self):
        svc = make_service()
        svc.zot.top.return_value = []
        svc.zot.last_modified_version.return_value = 1
        svc.pull_references_from_zotero(since_version=0)
        svc.zot.top.assert_called_once()
        svc.zot.collection_items_top.assert_not_called()

    def test_uses_since_version_when_nonzero(self):
        svc = make_service()
        svc.zot.top.return_value = []
        svc.zot.last_modified_version.return_value = 10
        svc.pull_references_from_zotero(since_version=5)
        svc.zot.top.assert_called_once_with(since=5)

    def test_uses_collection_items_top_when_key_set(self):
        svc = make_service()
        svc.zot.collection_items_top.return_value = []
        svc.zot.last_modified_version.return_value = 1
        svc.pull_references_from_zotero(collection_key="COL1")
        svc.zot.collection_items_top.assert_called_once_with("COL1")

    def test_returns_failure_on_exception(self):
        svc = make_service()
        svc.zot.top.side_effect = Exception("timeout")
        result = svc.pull_references_from_zotero(since_version=5)
        assert result["success"] is False
        # Returns the input version so the caller doesn't lose its sync point.
        assert result["library_version"] == 5


# get_item_with_children


class TestGetItemWithChildren:
    def test_returns_item_and_children(self):
        svc = make_service()
        svc.zot.item.return_value = {"key": "K1"}
        svc.zot.children.return_value = [{"key": "CHILD1"}]
        result = svc.get_item_with_children("K1")
        assert result["success"] is True
        assert result["item"]["key"] == "K1"
        assert len(result["children"]) == 1

    def test_returns_failure_on_exception(self):
        svc = make_service()
        svc.zot.item.side_effect = Exception("not found")
        result = svc.get_item_with_children("MISSING")
        assert result["success"] is False
        assert result["item"] is None
        assert result["children"] == []


# download_pdf_file


class TestDownloadPdfFile:
    def test_returns_bytes_on_success(self):
        svc = make_service()
        svc.zot.file.return_value = b"%PDF-content"
        result = svc.download_pdf_file("ATT1")
        assert result == b"%PDF-content"

    def test_returns_none_on_exception(self):
        svc = make_service()
        svc.zot.file.side_effect = Exception("not found")
        assert svc.download_pdf_file("MISSING") is None


# _get_publication_field


class TestGetPublicationField:
    def test_journal_article_returns_publicationTitle(self):
        svc = make_service()
        assert svc._get_publication_field("journalArticle") == "publicationTitle"

    def test_conference_paper_returns_proceedingsTitle(self):
        svc = make_service()
        assert svc._get_publication_field("conferencePaper") == "proceedingsTitle"

    def test_book_section_returns_bookTitle(self):
        svc = make_service()
        assert svc._get_publication_field("bookSection") == "bookTitle"

    def test_thesis_returns_university(self):
        svc = make_service()
        assert svc._get_publication_field("thesis") == "university"

    def test_unknown_type_returns_none(self):
        svc = make_service()
        assert svc._get_publication_field("unknownType") is None

    def test_book_returns_none(self):
        # Books have no separate publication title field.
        svc = make_service()
        assert svc._get_publication_field("book") is None


# _map_publication_type


class TestMapPublicationType:
    def test_journal_article(self):
        svc = make_service()
        assert svc._map_publication_type("journal article") == "journalArticle"

    def test_case_insensitive(self):
        svc = make_service()
        assert svc._map_publication_type("Journal Article") == "journalArticle"

    def test_conference_paper(self):
        svc = make_service()
        assert svc._map_publication_type("conference paper") == "conferencePaper"

    def test_conference_proceeding_maps_to_conference_paper(self):
        svc = make_service()
        assert svc._map_publication_type("conference proceeding") == "conferencePaper"

    def test_dissertation_maps_to_thesis(self):
        svc = make_service()
        assert svc._map_publication_type("dissertation") == "thesis"

    def test_unknown_defaults_to_journal_article(self):
        svc = make_service()
        assert svc._map_publication_type("random type") == "journalArticle"

    def test_none_defaults_to_journal_article(self):
        svc = make_service()
        assert svc._map_publication_type(None) == "journalArticle"

    def test_empty_string_defaults_to_journal_article(self):
        svc = make_service()
        assert svc._map_publication_type("") == "journalArticle"


# _parse_authors


class TestParseAuthors:
    def test_empty_string_returns_empty_list(self):
        svc = make_service()
        assert svc._parse_authors("") == []

    def test_none_returns_empty_list(self):
        svc = make_service()
        assert svc._parse_authors(None) == []

    def test_single_author_last_first_format(self):
        svc = make_service()
        result = svc._parse_authors("Smith, John")
        assert len(result) == 1
        assert result[0]["lastName"] == "Smith"
        assert result[0]["firstName"] == "John"
        assert result[0]["creatorType"] == "author"

    def test_single_author_full_name_format(self):
        svc = make_service()
        result = svc._parse_authors("John Smith")
        assert len(result) == 1
        assert result[0]["name"] == "John Smith"

    def test_multiple_authors_separated_by_semicolons(self):
        svc = make_service()
        result = svc._parse_authors("Smith, John; Jones, Jane")
        assert len(result) == 2
        assert result[1]["lastName"] == "Jones"

    def test_author_name_truncated_at_100_chars(self):
        svc = make_service()
        long_name = "A" * 150
        result = svc._parse_authors(long_name)
        assert len(result[0]["name"]) == 100

    def test_last_name_truncated_at_50_chars(self):
        svc = make_service()
        result = svc._parse_authors(f"{'L' * 60}, First")
        assert len(result[0]["lastName"]) == 50

    def test_more_than_100_authors_truncated(self):
        svc = make_service()
        authors = "; ".join([f"Author{i}" for i in range(110)])
        result = svc._parse_authors(authors)
        assert len(result) == 100

    def test_empty_semicolon_entries_skipped(self):
        svc = make_service()
        result = svc._parse_authors("Smith, John; ; Jones, Jane")
        assert len(result) == 2
