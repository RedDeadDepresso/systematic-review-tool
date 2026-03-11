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

from datetime import date

import pytest
from lxml import etree


# ===========================================================================
# parse_bibtex_date
# ===========================================================================


class TestParseBibtexDate:
    def _fn(self, entry):
        from slrt_project.reviews.utils import parse_bibtex_date

        return parse_bibtex_date(entry)

    def test_year_only(self):
        assert self._fn({"year": "2021"}) == date(2021, 1, 1)

    def test_year_and_month_abbreviation(self):
        assert self._fn({"year": "2021", "month": "jun"}) == date(2021, 6, 1)

    def test_month_case_insensitive(self):
        assert self._fn({"year": "2021", "month": "JUN"}) == date(2021, 6, 1)

    def test_month_full_name_uses_prefix(self):
        # "January" → first three chars "jan" → 1
        assert self._fn({"year": "2021", "month": "January"}) == date(2021, 1, 1)

    def test_unknown_month_defaults_to_january(self):
        assert self._fn({"year": "2021", "month": "xyz"}) == date(2021, 1, 1)

    def test_no_date_or_year_returns_none(self):
        assert self._fn({}) is None

    def test_invalid_year_returns_none(self):
        assert self._fn({"year": "forthcoming"}) is None


# ===========================================================================
# extract_bibtex_reference_fields
# ===========================================================================


@pytest.mark.django_db
class TestExtractBibtexReferenceFields:
    @pytest.fixture(autouse=True)
    def _sm(self):
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        self.sm = SearchMethodFactory()

    def _fn(self, entry):
        from slrt_project.reviews.utils import extract_bibtex_reference_fields

        return extract_bibtex_reference_fields(
            review_id=self.sm.review.id, search_method=self.sm, entry=entry
        )

    def test_basic_article(self):
        ref = self._fn(
            {
                "ENTRYTYPE": "article",
                "title": "Test Title",
                "author": "Smith, J and Doe, A",
                "year": "2022",
                "journal": "Nature",
                "doi": "10.1000/xyz",
                "abstract": "An abstract.",
                "pages": "1-10",
            }
        )
        assert ref.title == "Test Title"
        assert ref.publication_type == "Journal Article"
        assert ref.authors == "Smith, J, Doe, A"
        assert ref.journal == "Nature"
        assert ref.doi == "10.1000/xyz"
        assert ref.abstract == "An abstract."
        assert ref.pages == "1-10"
        assert ref.publication_date == date(2022, 1, 1)

    def test_doi_prefix_stripped(self):
        ref = self._fn({"doi": "doi:10.1000/xyz"})
        assert ref.doi == "10.1000/xyz"

    def test_doi_url_stripped(self):
        ref = self._fn({"DOI": "https://doi.org/10.1000/xyz"})
        assert ref.doi == "10.1000/xyz"

    def test_empty_entry_uses_defaults(self):
        ref = self._fn({})
        assert ref.title == "No Title"
        assert ref.publication_type == "Other"
        assert ref.authors == ""
        assert ref.doi == ""

    def test_journal_falls_back_to_booktitle(self):
        ref = self._fn({"booktitle": "ICML Proceedings"})
        assert ref.journal == "ICML Proceedings"

    def test_unknown_entry_type_maps_to_other(self):
        ref = self._fn({"ENTRYTYPE": "nonexistent"})
        assert ref.publication_type == "Other"


# ===========================================================================
# parse_ris_date
# ===========================================================================


class TestParseRisDate:
    def _fn(self, entry):
        from slrt_project.reviews.utils import parse_ris_date

        return parse_ris_date(entry)

    def test_year_field(self):
        assert self._fn({"year": "2019"}) == date(2019, 1, 1)

    def test_publication_year_field(self):
        assert self._fn({"publication_year": "2018"}) == date(2018, 1, 1)

    def test_no_year_returns_none(self):
        assert self._fn({}) is None

    def test_non_numeric_year_returns_none(self):
        assert self._fn({"year": "n/a"}) is None


# ===========================================================================
# extract_ris_reference_fields
# ===========================================================================


@pytest.mark.django_db
class TestExtractRisReferenceFields:
    @pytest.fixture(autouse=True)
    def _sm(self):
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        self.sm = SearchMethodFactory()

    def _fn(self, entry):
        from slrt_project.reviews.utils import extract_ris_reference_fields

        return extract_ris_reference_fields(
            review_id=self.sm.review.id, search_method=self.sm, entry=entry
        )

    def test_basic_journal_article(self):
        ref = self._fn(
            {
                "type_of_reference": "JOUR",
                "title": "My Paper",
                "authors": ["Smith, J", "Doe, A"],
                "journal_name": "Science",
                "year": "2023",
                "doi": "10.1000/abc",
                "abstract": "Summary.",
                "start_page": "5",
                "end_page": "10",
            }
        )
        assert ref.title == "My Paper"
        assert ref.publication_type == "Journal Article"
        assert ref.authors == "Smith, J, Doe, A"
        assert ref.journal == "Science"
        assert ref.doi == "10.1000/abc"
        assert ref.pages == "5-10"
        assert ref.publication_date == date(2023, 1, 1)

    def test_title_fallback_to_primary_title(self):
        ref = self._fn({"primary_title": "Fallback Title"})
        assert ref.title == "Fallback Title"

    def test_title_fallback_to_titles_list(self):
        ref = self._fn({"titles": ["List Title", "Other"]})
        assert ref.title == "List Title"

    def test_empty_entry_defaults(self):
        ref = self._fn({})
        assert ref.title == "No Title"
        assert ref.authors == ""
        assert ref.doi == ""

    def test_doi_normalised(self):
        ref = self._fn({"doi": "DOI:10.1000/abc"})
        assert ref.doi == "10.1000/abc"

    def test_page_range_with_start_only(self):
        ref = self._fn({"start_page": "42"})
        assert ref.pages == "42"

    def test_unknown_type_defaults_to_miscellaneous(self):
        ref = self._fn({"type_of_reference": "UNKN"})
        assert ref.publication_type == "Miscellaneous"

    def test_first_authors_fallback(self):
        ref = self._fn({"first_authors": ["Brown, B"]})
        assert ref.authors == "Brown, B"


# ===========================================================================
# parse_endnote_date
# ===========================================================================


class TestParseEndnoteDate:
    def _record(self, xml: str):
        return etree.fromstring(xml)

    def _fn(self, xml):
        from slrt_project.reviews.utils import parse_endnote_date

        return parse_endnote_date(self._record(xml))

    def test_year_only(self):
        assert self._fn("<record><dates><year>2020</year></dates></record>") == date(
            2020, 1, 1
        )

    def test_year_and_month(self):
        assert self._fn(
            "<record><dates><year>2020</year><month>6</month></dates></record>"
        ) == date(2020, 6, 1)

    def test_no_dates_element_returns_none(self):
        assert self._fn("<record></record>") is None

    def test_no_year_element_returns_none(self):
        assert self._fn("<record><dates></dates></record>") is None

    def test_invalid_year_returns_none(self):
        assert self._fn("<record><dates><year>n/a</year></dates></record>") is None

    def test_invalid_month_defaults_to_january(self):
        result = self._fn(
            "<record><dates><year>2021</year><month>XX</month></dates></record>"
        )
        assert result == date(2021, 1, 1)


# ===========================================================================
# get_endnote_text
# ===========================================================================


class TestGetEndnoteText:
    def _fn(self, xml, path):
        from slrt_project.reviews.utils import get_endnote_text

        return get_endnote_text(etree.fromstring(xml), path)

    def test_returns_text(self):
        assert (
            self._fn("<record><abstract>Hello</abstract></record>", ".//abstract")
            == "Hello"
        )

    def test_missing_element_returns_empty_string(self):
        assert self._fn("<record></record>", ".//abstract") == ""

    def test_empty_element_returns_empty_string(self):
        assert self._fn("<record><abstract/></record>", ".//abstract") == ""


# ===========================================================================
# get_endnote_authors
# ===========================================================================


class TestGetEndnoteAuthors:
    def _fn(self, xml):
        from slrt_project.reviews.utils import get_endnote_authors

        return get_endnote_authors(etree.fromstring(xml))

    def test_primary_authors(self):
        xml = """<record><contributors><authors>
            <author>Smith, J</author><author>Doe, A</author>
        </authors></contributors></record>"""
        assert self._fn(xml) == "Smith, J, Doe, A"

    def test_falls_back_to_secondary_authors(self):
        xml = """<record><contributors>
            <secondary-authors><author>Brown, B</author></secondary-authors>
        </contributors></record>"""
        assert self._fn(xml) == "Brown, B"

    def test_no_contributors_returns_empty(self):
        assert self._fn("<record></record>") == ""

    def test_primary_authors_take_precedence(self):
        xml = """<record><contributors>
            <authors><author>Primary, P</author></authors>
            <secondary-authors><author>Secondary, S</author></secondary-authors>
        </contributors></record>"""
        assert self._fn(xml) == "Primary, P"


# ===========================================================================
# extract_endnote_reference_fields
# ===========================================================================


@pytest.mark.django_db
class TestExtractEndnoteReferenceFields:
    @pytest.fixture(autouse=True)
    def _sm(self):
        from slrt_project.reviews.tests.factories import SearchMethodFactory

        self.sm = SearchMethodFactory()

    def _record(self, xml):
        return etree.fromstring(xml)

    def _fn(self, xml):
        from slrt_project.reviews.utils import extract_endnote_reference_fields

        return extract_endnote_reference_fields(
            self.sm.review.id, self.sm, self._record(xml)
        )

    def test_journal_article(self):
        xml = """<record>
            <ref-type name="Journal Article"/>
            <titles><title>My Study</title></titles>
            <contributors><authors><author>Doe, J</author></authors></contributors>
            <periodical><full-title>Nature</full-title></periodical>
            <dates><year>2021</year></dates>
            <electronic-resource-num>10.1234/abc</electronic-resource-num>
            <abstract>Abstract text.</abstract>
            <pages>100-110</pages>
        </record>"""
        ref = self._fn(xml)
        assert ref.title == "My Study"
        assert ref.publication_type == "Journal Article"
        assert ref.authors == "Doe, J"
        assert ref.journal == "Nature"
        assert ref.doi == "10.1234/abc"
        assert ref.abstract == "Abstract text."
        assert ref.pages == "100-110"
        assert ref.publication_date == date(2021, 1, 1)

    def test_title_falls_back_to_secondary_title(self):
        xml = """<record>
            <titles><secondary-title>Fallback</secondary-title></titles>
        </record>"""
        assert self._fn(xml).title == "Fallback"

    def test_no_title_uses_placeholder(self):
        assert self._fn("<record></record>").title == "No Title"

    def test_unknown_ref_type_maps_to_miscellaneous(self):
        xml = """<record><ref-type name="Patent"/></record>"""
        assert self._fn(xml).publication_type == "Miscellaneous"

    def test_doi_normalised(self):
        xml = """<record>
            <electronic-resource-num>https://doi.org/10.1234/xyz</electronic-resource-num>
        </record>"""
        assert self._fn(xml).doi == "10.1234/xyz"


# ===========================================================================
# strip_ansi
# ===========================================================================


class TestStripAnsi:
    def _fn(self, text):
        from slrt_project.reviews.utils import strip_ansi

        return strip_ansi(text)

    def test_strips_colour_codes(self):
        assert self._fn("\x1b[31mred\x1b[0m") == "red"

    def test_plain_text_unchanged(self):
        assert self._fn("hello") == "hello"

    def test_empty_string(self):
        assert self._fn("") == ""


# ===========================================================================
# _normalise_doi (via public extract functions)
# ===========================================================================


class TestNormaliseDoi:
    """Covered via the extract_* helpers above, but test the edge cases explicitly."""

    def _fn(self, doi):
        from slrt_project.reviews.utils import _normalise_doi

        return _normalise_doi(doi)

    def test_bare_doi(self):
        assert self._fn("10.1000/xyz") == "10.1000/xyz"

    def test_doi_prefix(self):
        assert self._fn("doi:10.1000/xyz") == "10.1000/xyz"

    def test_https_url(self):
        assert self._fn("https://doi.org/10.1000/xyz") == "10.1000/xyz"

    def test_empty_returns_empty(self):
        assert self._fn("") == ""

    def test_none_like_falsy_returns_empty(self):
        assert self._fn(None) == ""
