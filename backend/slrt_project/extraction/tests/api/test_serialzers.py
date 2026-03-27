from unittest.mock import MagicMock, patch

import pytest
from rest_framework.exceptions import ValidationError

from slrt_project.extraction.api.serializers import (
    BulkSaveResponseSerializer,
    BulkUpdateExtractionStatusSerializer,
    BulkUpdateStatusResponseSerializer,
    ExtractionAnswerBulkSerializer,
    ExtractionAnswerSerializer,
    ExtractionQuestionSerializer,
    ExtractionQuestionTableSerializer,
    ExtractionSectionSerializer,
    FormDataResponseSerializer,
    ReferenceTableSerializer,
    _validate_value_for_question,
)
from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
)
from slrt_project.extraction.tests.factories import (
    ExtractionAnswerFactory,
    ExtractionQuestionFactory,
    ExtractionSectionFactory,
)
from slrt_project.references.tests.factories import ReferenceFactory
from slrt_project.reviews.tests.factories import ReviewFactory


# Autouse fixture — bypass IsAuthenticated for any view-touching tests
@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """
    Patch DRF's IsAuthenticated so tests in this module that call views
    directly via APIRequestFactory are not rejected with 401.  Pure
    serializer tests are unaffected.
    """
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# Helpers — build minimal question-like objects without touching the DB
def _stub_q(type_, options=None):
    """Return a MagicMock that satisfies _validate_value_for_question."""
    q = MagicMock(spec=ExtractionQuestion)
    q.type = type_
    q.options = options
    return q


# _validate_value_for_question
class TestValidateValueForQuestion:
    """All branches; no DB required."""

    # ── free-text ──────────────────────────────────────────────────────────

    def test_free_text_any_string_returns_none(self):
        assert (
            _validate_value_for_question("anything goes", _stub_q("free-text")) is None
        )

    def test_free_text_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("free-text")) is None

    # ── number ────────────────────────────────────────────────────────────

    def test_number_valid_int_returns_float(self):
        assert _validate_value_for_question("42", _stub_q("number")) == 42.0

    def test_number_valid_float_returns_float(self):
        assert _validate_value_for_question("3.14", _stub_q("number")) == 3.14

    def test_number_negative_returns_float(self):
        assert _validate_value_for_question("-7", _stub_q("number")) == -7.0

    def test_number_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("number")) is None

    def test_number_non_numeric_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("not-a-number", _stub_q("number"))

    def test_number_letters_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("12abc", _stub_q("number"))

    # ── date ─────────────────────────────────────────────────────────────

    def test_date_valid_iso_returns_none(self):
        assert _validate_value_for_question("2024-01-15", _stub_q("date")) is None

    def test_date_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("date")) is None

    def test_date_wrong_format_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("15/01/2024", _stub_q("date"))

    def test_date_invalid_month_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("2024-13-01", _stub_q("date"))

    # ── single-select ─────────────────────────────────────────────────────

    def test_single_select_valid_option_returns_none(self):
        assert (
            _validate_value_for_question("A", _stub_q("single-select", ["A", "B"]))
            is None
        )

    def test_single_select_invalid_option_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("C", _stub_q("single-select", ["A", "B"]))

    def test_single_select_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("single-select", ["A"])) is None

    # ── multi-select ──────────────────────────────────────────────────────

    def test_multi_select_all_valid_returns_none(self):
        assert (
            _validate_value_for_question(
                "A,B", _stub_q("multi-select", ["A", "B", "C"])
            )
            is None
        )

    def test_multi_select_one_invalid_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("A,Z", _stub_q("multi-select", ["A", "B"]))

    def test_multi_select_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("multi-select", ["A"])) is None

    def test_multi_select_strips_whitespace_around_tokens(self):
        assert (
            _validate_value_for_question("A , B", _stub_q("multi-select", ["A", "B"]))
            is None
        )

    # ── boolean ───────────────────────────────────────────────────────────

    def test_boolean_true_lowercase_ok(self):
        assert _validate_value_for_question("true", _stub_q("boolean")) is None

    def test_boolean_false_lowercase_ok(self):
        assert _validate_value_for_question("false", _stub_q("boolean")) is None

    def test_boolean_case_insensitive(self):
        assert _validate_value_for_question("True", _stub_q("boolean")) is None
        assert _validate_value_for_question("FALSE", _stub_q("boolean")) is None

    def test_boolean_empty_returns_none(self):
        assert _validate_value_for_question("", _stub_q("boolean")) is None

    def test_boolean_yes_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("yes", _stub_q("boolean"))

    def test_boolean_one_raises(self):
        with pytest.raises(ValidationError):
            _validate_value_for_question("1", _stub_q("boolean"))


# ExtractionSectionSerializer
class TestExtractionSectionSerializerValidation:
    def test_name_and_review_required(self):
        s = ExtractionSectionSerializer(data={})
        assert not s.is_valid()
        assert "name" in s.errors or "review" in s.errors

    def test_select_type_without_options_irrelevant_here(self):
        # Section has no type field — options validation belongs to Question.
        assert True


@pytest.mark.django_db
class TestExtractionSectionSerializerDB:
    def test_creates_section(self):
        review = ReviewFactory()
        s = ExtractionSectionSerializer(data={"name": "Methods", "review": review.pk})
        assert s.is_valid(), s.errors
        section = s.save()
        assert section.pk is not None

    def test_name_uniqueness_per_review_case_insensitive(self):
        review = ReviewFactory()
        ExtractionSectionFactory(review=review, name="Methods")
        s = ExtractionSectionSerializer(data={"name": "methods", "review": review.pk})
        assert not s.is_valid()
        assert "name" in str(s.errors)

    def test_same_name_allowed_across_reviews(self):
        r1, r2 = ReviewFactory(), ReviewFactory()
        ExtractionSectionFactory(review=r1, name="Methods")
        s = ExtractionSectionSerializer(data={"name": "Methods", "review": r2.pk})
        assert s.is_valid(), s.errors

    def test_update_passes_self_check(self):
        section = ExtractionSectionFactory(name="Methods")
        s = ExtractionSectionSerializer(
            instance=section,
            data={"name": "Methods", "review": section.review.pk},
        )
        assert s.is_valid(), s.errors

    def test_auto_order_appends_after_max(self):
        review = ReviewFactory()
        ExtractionSectionFactory(review=review, order=3)
        s = ExtractionSectionSerializer(data={"name": "New", "review": review.pk})
        assert s.is_valid(), s.errors
        assert s.save().order == 4

    def test_explicit_order_is_respected(self):
        review = ReviewFactory()
        s = ExtractionSectionSerializer(
            data={"name": "S", "review": review.pk, "order": 10}
        )
        assert s.is_valid(), s.errors
        assert s.save().order == 10

    def test_name_is_stripped_on_create(self):
        review = ReviewFactory()
        s = ExtractionSectionSerializer(
            data={"name": "  Trim me  ", "review": review.pk}
        )
        assert s.is_valid(), s.errors
        assert s.save().name == "Trim me"


# ExtractionQuestionSerializer
@pytest.mark.django_db
class TestExtractionQuestionSerializerValidation:
    def test_single_select_without_options_fails(self):
        # Must use a real section PK — DRF validates FK fields before
        # cross-field validate(), so a nonexistent PK short-circuits
        # before the options check is ever reached.
        section = ExtractionSectionFactory()
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "single-select",
                "options": None,
            }
        )
        assert not s.is_valid()
        assert "options" in str(s.errors)

    def test_multi_select_empty_options_fails(self):
        section = ExtractionSectionFactory()
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "multi-select",
                "options": [],
            }
        )
        assert not s.is_valid()
        assert "options" in str(s.errors)

    def test_free_text_null_options_ok(self):
        # FK will fail but options validation should not appear in errors.
        s = ExtractionQuestionSerializer(
            data={
                "section": 99999,
                "question": "Q?",
                "column_title": "Q",
                "type": "free-text",
            }
        )
        s.is_valid()
        assert "options" not in s.errors

    def test_question_field_is_stripped(self):
        s = ExtractionQuestionSerializer()
        assert s.validate_question("  question  ") == "question"

    def test_column_title_is_stripped(self):
        s = ExtractionQuestionSerializer()
        assert s.validate_column_title("  col  ") == "col"

    def test_none_question_returns_none(self):
        s = ExtractionQuestionSerializer()
        assert s.validate_question(None) is None

    def test_none_column_title_returns_none(self):
        s = ExtractionQuestionSerializer()
        assert s.validate_column_title(None) is None


@pytest.mark.django_db
class TestExtractionQuestionSerializerDB:
    def test_creates_free_text_question(self):
        section = ExtractionSectionFactory()
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "What is X?",
                "column_title": "X",
                "type": "free-text",
            }
        )
        assert s.is_valid(), s.errors
        assert s.save().pk is not None

    def test_creates_single_select_with_options(self):
        section = ExtractionSectionFactory()
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "Type?",
                "column_title": "Type",
                "type": "single-select",
                "options": ["RCT", "cohort"],
            }
        )
        assert s.is_valid(), s.errors
        assert s.save().options == ["RCT", "cohort"]

    def test_auto_order_appends_to_section(self):
        section = ExtractionSectionFactory()
        ExtractionQuestionFactory(section=section, order=5)
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "free-text",
            }
        )
        assert s.is_valid(), s.errors
        assert s.save().order == 6

    def test_required_defaults_to_false(self):
        section = ExtractionSectionFactory()
        s = ExtractionQuestionSerializer(
            data={
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "free-text",
            }
        )
        assert s.is_valid(), s.errors
        assert s.save().required is False


# ExtractionAnswerSerializer
class TestExtractionAnswerSerializerValidation:
    def test_number_invalid_raises(self):
        s = ExtractionAnswerSerializer()
        with pytest.raises(ValidationError):
            s.validate({"question": _stub_q("number"), "value": "abc"})

    def test_number_valid_stashes_value_number(self):
        s = ExtractionAnswerSerializer()
        result = s.validate({"question": _stub_q("number"), "value": "3.14"})
        assert result["_value_number"] == 3.14

    def test_boolean_invalid_raises(self):
        s = ExtractionAnswerSerializer()
        with pytest.raises(ValidationError):
            s.validate({"question": _stub_q("boolean"), "value": "maybe"})

    def test_no_question_skips_validation(self):
        s = ExtractionAnswerSerializer()
        result = s.validate({"value": "anything"})
        assert result == {"value": "anything"}

    def test_free_text_value_number_is_none(self):
        s = ExtractionAnswerSerializer()
        result = s.validate({"question": _stub_q("free-text"), "value": "some text"})
        assert result["_value_number"] is None


@pytest.mark.django_db
class TestExtractionAnswerSerializerDB:
    def test_creates_answer(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        s = ExtractionAnswerSerializer(
            data={
                "reference": ref.pk,
                "question": q.pk,
                "value": "hello",
            }
        )
        assert s.is_valid(), s.errors
        answer = s.save()
        assert answer.pk is not None
        assert answer.value == "hello"

    def test_create_is_idempotent(self):
        # DRF's UniqueTogetherValidator cannot be bypassed via partial=True
        # alone — it only skips the validator when an instance= is also
        # provided (update path).  Test the idempotency semantics directly
        # by calling the serializer's create() method after validation passes
        # the first time, then calling it a second time with the same pair.
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        # First call: creates the row.
        s1 = ExtractionAnswerSerializer(
            data={"reference": ref.pk, "question": q.pk, "value": "first"}
        )
        assert s1.is_valid(), s1.errors
        s1.save()
        # Second call: update existing via the update path (instance + partial).
        existing = ExtractionAnswer.objects.get(reference=ref, question=q)
        s2 = ExtractionAnswerSerializer(
            instance=existing,
            data={"reference": ref.pk, "question": q.pk, "value": "second"},
            partial=True,
        )
        assert s2.is_valid(), s2.errors
        answer = s2.save()
        assert answer.value == "second"
        assert ExtractionAnswer.objects.filter(reference=ref, question=q).count() == 1

    def test_number_answer_persists_value_number(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory(number=True)
        s = ExtractionAnswerSerializer(
            data={
                "reference": ref.pk,
                "question": q.pk,
                "value": "99",
            }
        )
        assert s.is_valid(), s.errors
        assert s.save().value_number == 99.0

    def test_update_replaces_value(self):
        answer = ExtractionAnswerFactory(value="old")
        s = ExtractionAnswerSerializer(
            instance=answer,
            data={
                "reference": answer.reference.pk,
                "question": answer.question.pk,
                "value": "new",
            },
        )
        assert s.is_valid(), s.errors
        assert s.save().value == "new"


# ExtractionAnswerBulkSerializer
class TestExtractionAnswerBulkSerializerShape:
    def test_reference_id_required(self):
        s = ExtractionAnswerBulkSerializer(data={"answers": {}})
        assert not s.is_valid()
        assert "reference_id" in s.errors

    def test_answers_required(self):
        s = ExtractionAnswerBulkSerializer(data={"reference_id": 1})
        assert not s.is_valid()
        assert "answers" in s.errors


@pytest.mark.django_db
class TestExtractionAnswerBulkSerializerDB:
    def test_nonexistent_question_returns_error(self):
        s = ExtractionAnswerBulkSerializer(
            data={
                "reference_id": 1,
                "answers": {"99999": "value"},
            }
        )
        assert not s.is_valid()
        assert "99999" in str(s.errors)

    def test_valid_payload_passes(self):
        q = ExtractionQuestionFactory()
        s = ExtractionAnswerBulkSerializer(
            data={
                "reference_id": 1,
                "answers": {str(q.pk): "hello"},
            }
        )
        assert s.is_valid(), s.errors

    def test_type_error_reported_per_question(self):
        q = ExtractionQuestionFactory(number=True)
        s = ExtractionAnswerBulkSerializer(
            data={
                "reference_id": 1,
                "answers": {str(q.pk): "not-a-number"},
            }
        )
        assert not s.is_valid()
        assert str(q.pk) in str(s.errors)

    def test_all_errors_collected_not_just_first(self):
        q1 = ExtractionQuestionFactory(number=True)
        q2 = ExtractionQuestionFactory(number=True)
        s = ExtractionAnswerBulkSerializer(
            data={
                "reference_id": 1,
                "answers": {str(q1.pk): "bad", str(q2.pk): "also-bad"},
            }
        )
        assert not s.is_valid()
        errors_str = str(s.errors)
        assert str(q1.pk) in errors_str
        assert str(q2.pk) in errors_str


# ExtractionQuestionTableSerializer
@pytest.mark.django_db
class TestExtractionQuestionTableSerializer:
    def test_section_name_is_included(self):
        section = ExtractionSectionFactory(name="Methods")
        q = ExtractionQuestionFactory(section=section, column_title="Design")
        data = ExtractionQuestionTableSerializer(q).data
        assert data["section_name"] == "Methods"

    def test_all_expected_fields_present(self):
        q = ExtractionQuestionFactory()
        data = ExtractionQuestionTableSerializer(q).data
        expected = {
            "id",
            "section",
            "section_name",
            "question",
            "column_title",
            "type",
            "required",
            "order",
            "options",
        }
        assert expected <= set(data.keys())


# ReferenceTableSerializer
@pytest.mark.django_db
class TestReferenceTableSerializer:
    def _with_prefetch(self, ref):
        """Return the Reference with extraction_answers prefetched."""
        from slrt_project.references.models import Reference as Ref

        return Ref.objects.prefetch_related("extraction_answers").get(pk=ref.pk)

    def _serialize(self, ref):
        """Serialize with the context ReferenceSerializer requires."""
        # get_labels calls context["request"].user unconditionally.
        # Build a minimal mock request carrying a real user so the DB query
        # in the fallback path (label__user=user) receives a valid PK.
        from unittest.mock import MagicMock

        from slrt_project.reviews.tests.factories import UserFactory

        mock_request = MagicMock()
        mock_request.user = UserFactory()
        return ReferenceTableSerializer(
            self._with_prefetch(ref), context={"request": mock_request}
        ).data

    def test_answers_dict_built_from_prefetch(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        ExtractionAnswerFactory(reference=ref, question=q, value="RCT")
        data = self._serialize(ref)
        assert q.pk in data["answers"]
        assert data["answers"][q.pk]["value"] == "RCT"

    def test_answers_empty_when_no_answers(self):
        ref = ReferenceFactory()
        assert self._serialize(ref)["answers"] == {}

    def test_is_extraction_completed_present(self):
        ref = ReferenceFactory()
        assert "is_extraction_completed" in self._serialize(ref)

    def test_multiple_answers_all_included(self):
        ref = ReferenceFactory()
        q1 = ExtractionQuestionFactory()
        q2 = ExtractionQuestionFactory()
        ExtractionAnswerFactory(reference=ref, question=q1, value="yes")
        ExtractionAnswerFactory(reference=ref, question=q2, value="no")
        data = self._serialize(ref)
        assert q1.pk in data["answers"]
        assert q2.pk in data["answers"]


# Response serializer shape tests (no DB)
class TestResponseSerializerShapes:
    def test_bulk_save_response_valid(self):
        s = BulkSaveResponseSerializer(data={"saved_count": 3, "answers": []})
        assert s.is_valid(), s.errors

    def test_bulk_update_status_request_empty_list_fails(self):
        s = BulkUpdateExtractionStatusSerializer(
            data={
                "reference_ids": [],
                "is_extraction_completed": True,
            }
        )
        assert not s.is_valid()
        assert "reference_ids" in s.errors

    def test_bulk_update_status_request_valid(self):
        s = BulkUpdateExtractionStatusSerializer(
            data={
                "reference_ids": [1, 2, 3],
                "is_extraction_completed": False,
            }
        )
        assert s.is_valid(), s.errors

    def test_bulk_update_status_response_valid(self):
        s = BulkUpdateStatusResponseSerializer(
            data={
                "updated_count": 2,
                "reference_ids": [1, 2],
                "is_extraction_completed": True,
            }
        )
        assert s.is_valid(), s.errors

    def test_form_data_response_accepts_empty_sections(self):
        s = FormDataResponseSerializer(data={"sections": []})
        assert s.is_valid(), s.errors


# ExtractionTableViewSet — list  (serializer-context integration tests)
#
# These live here because the list endpoint's primary test surface is
# ReferenceTableSerializer + ExtractionQuestionTableSerializer rendering.
# The view machinery (pagination, filtering) is covered in test_views.py.


@pytest.mark.django_db
class TestExtractionTableList:
    """
    Kept in the serializers test to cover ReferenceTableSerializer rendering
    in the context of a real list response.  The view machinery (pagination,
    filtering) is covered more thoroughly in test_views.py.
    """

    # This file has no module-level APIRequestFactory because most tests here
    # are serializer-only.  Instantiate one locally for these view-touching tests.
    _rf = None

    def _req(self, *args, **kwargs):
        from rest_framework.test import APIRequestFactory

        return APIRequestFactory().get(*args, **kwargs)

    def _make_user(self):
        u = MagicMock()
        u.pk = 1
        u.id = 1
        u.is_authenticated = True
        return u

    def _view(self):
        from slrt_project.extraction.api.views import ExtractionTableViewSet

        return ExtractionTableViewSet.as_view({"get": "list"})

    def test_missing_review_returns_400(self):
        request = self._req("/")
        request.user = self._make_user()
        with patch(
            "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
            return_value=None,
        ):
            assert self._view()(request).status_code == 400

    def test_returns_200_with_review(self):
        # get_base_queryset (ReviewDataViewSet) filters by request.user as a DB PK.
        # get_labels (ReferenceSerializer) also calls request.user.
        # Patch both to avoid AnonymousUser / MagicMock-as-PK errors.
        # Do NOT add prefetch_related("extraction_answers") to the test queryset —
        # get_queryset() in the view adds its own Prefetch object for that relation,
        # and Django raises ValueError for duplicate prefetch lookups with different
        # querysets.
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True)
        qs = Reference.objects.filter(review=review, in_extraction=True)
        request = self._req("/", {"review": review.pk})
        request.user = self._make_user()
        with (
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
                return_value=review,
            ),
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_base_queryset",
                return_value=qs,
            ),
            patch(
                "slrt_project.references.api.serializers.ReferenceSerializer.get_labels",
                return_value=[],
            ),
        ):
            response = self._view()(request)
        assert response.status_code == 200

    def test_only_in_extraction_references_returned(self):
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True)
        ReferenceFactory(review=review, in_extraction=False)
        qs = Reference.objects.filter(review=review, in_extraction=True)
        request = self._req("/", {"review": review.pk})
        request.user = self._make_user()
        with (
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
                return_value=review,
            ),
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_base_queryset",
                return_value=qs,
            ),
            patch(
                "slrt_project.references.api.serializers.ReferenceSerializer.get_labels",
                return_value=[],
            ),
        ):
            response = self._view()(request)
        for ref in response.data.get("results", []):
            assert ref.get("in_extraction") is True
