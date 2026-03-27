from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory

from slrt_project.extraction.api.views import (
    EvidenceGapMapViewSet,
    _get_question_or_400,
)
from slrt_project.extraction.models import ExtractionQuestion
from slrt_project.extraction.tests.factories import (
    ExtractionAnswerFactory,
    ExtractionQuestionFactory,
    ExtractionSectionFactory,
)
from slrt_project.references.tests.factories import ReferenceFactory
from slrt_project.reviews.tests.factories import ReviewFactory


factory = APIRequestFactory()


# Module-level autouse fixture — bypass IsAuthenticated for every test
@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """
    Patch DRF's IsAuthenticated so tests using APIRequestFactory (which does
    not run middleware) are not rejected with 401.  Individual tests that
    exercise permission logic should patch the relevant check directly.
    """
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# Shared mock helpers
def make_user(pk=1):
    u = MagicMock()
    u.pk = pk
    u.id = pk
    u.is_authenticated = True
    return u


# _get_question_or_400 helper
@pytest.mark.django_db
class TestGetQuestionOr400:
    def test_returns_question_when_found(self):
        q = ExtractionQuestionFactory()
        result, err = _get_question_or_400(q.pk)
        assert result.pk == q.pk
        assert err is None

    def test_returns_404_response_when_not_found(self):
        q, err = _get_question_or_400(99999)
        assert q is None
        assert err.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_400_on_type_mismatch(self):
        q = ExtractionQuestionFactory()  # defaults to free-text
        _, err = _get_question_or_400(q.pk, allowed_types=["number"])
        assert err is not None
        assert err.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_question_when_type_matches(self):
        q = ExtractionQuestionFactory(number=True)
        result, err = _get_question_or_400(q.pk, allowed_types=["number"])
        assert result.pk == q.pk
        assert err is None

    def test_no_allowed_types_accepts_any_type(self):
        q = ExtractionQuestionFactory(boolean=True)
        result, err = _get_question_or_400(q.pk, allowed_types=None)
        assert result.pk == q.pk
        assert err is None


# ExtractionSectionViewSet
@pytest.mark.django_db
class TestExtractionSectionViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionSectionViewSet

        return ExtractionSectionViewSet

    def test_list_returns_200(self):
        ExtractionSectionFactory()
        request = factory.get("/")
        request.user = make_user()
        view = self._view().as_view({"get": "list"})
        response = view(request)
        assert response.status_code == status.HTTP_200_OK

    def test_list_filtered_by_review(self):
        s1 = ExtractionSectionFactory()
        ExtractionSectionFactory()  # different review
        request = factory.get("/", {"review": s1.review.pk})
        request.user = make_user()
        view = self._view().as_view({"get": "list"})
        response = view(request)
        assert response.status_code == status.HTTP_200_OK
        assert all(s["review"] == s1.review.pk for s in response.data)

    def test_create_returns_201(self):
        review = ReviewFactory()
        request = factory.post(
            "/", {"name": "Methods", "review": review.pk}, format="json"
        )
        request.user = make_user()
        view = self._view().as_view({"post": "create"})
        response = view(request)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.data["name"] == "Methods"

    def test_create_duplicate_name_returns_400(self):
        s = ExtractionSectionFactory(name="Methods")
        request = factory.post(
            "/", {"name": "Methods", "review": s.review.pk}, format="json"
        )
        request.user = make_user()
        view = self._view().as_view({"post": "create"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_retrieve_returns_200(self):
        s = ExtractionSectionFactory()
        request = factory.get("/")
        request.user = make_user()
        view = self._view().as_view({"get": "retrieve"})
        response = view(request, pk=s.pk)
        assert response.status_code == status.HTTP_200_OK

    def test_destroy_returns_204(self):
        s = ExtractionSectionFactory()
        request = factory.delete("/")
        request.user = make_user()
        view = self._view().as_view({"delete": "destroy"})
        response = view(request, pk=s.pk)
        assert response.status_code == status.HTTP_204_NO_CONTENT


# ExtractionQuestionViewSet
@pytest.mark.django_db
class TestExtractionQuestionViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionQuestionViewSet

        return ExtractionQuestionViewSet

    def test_list_returns_200(self):
        ExtractionQuestionFactory()
        request = factory.get("/")
        request.user = make_user()
        view = self._view().as_view({"get": "list"})
        assert view(request).status_code == status.HTTP_200_OK

    def test_list_filtered_by_section(self):
        q = ExtractionQuestionFactory()
        ExtractionQuestionFactory()  # different section
        request = factory.get("/", {"section": q.section.pk})
        request.user = make_user()
        view = self._view().as_view({"get": "list"})
        response = view(request)
        assert response.status_code == status.HTTP_200_OK
        assert all(item["section"] == q.section.pk for item in response.data)

    def test_list_filtered_by_type(self):
        ExtractionQuestionFactory(number=True)
        ExtractionQuestionFactory()  # free-text
        request = factory.get("/", {"type": "number"})
        request.user = make_user()
        view = self._view().as_view({"get": "list"})
        response = view(request)
        assert all(item["type"] == "number" for item in response.data)

    def test_create_free_text_returns_201(self):
        section = ExtractionSectionFactory()
        request = factory.post(
            "/",
            {
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "free-text",
            },
            format="json",
        )
        request.user = make_user()
        view = self._view().as_view({"post": "create"})
        assert view(request).status_code == status.HTTP_201_CREATED

    def test_create_select_without_options_returns_400(self):
        section = ExtractionSectionFactory()
        request = factory.post(
            "/",
            {
                "section": section.pk,
                "question": "Q?",
                "column_title": "Q",
                "type": "single-select",
            },
            format="json",
        )
        request.user = make_user()
        view = self._view().as_view({"post": "create"})
        assert view(request).status_code == status.HTTP_400_BAD_REQUEST


# ExtractionAnswerViewSet — create (upsert)
@pytest.mark.django_db
class TestExtractionAnswerCreate:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionAnswerViewSet

        return ExtractionAnswerViewSet.as_view({"post": "create"})

    def test_new_pair_returns_201(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        request = factory.post(
            "/",
            {
                "reference": ref.pk,
                "question": q.pk,
                "value": "hello",
            },
            format="json",
        )
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_201_CREATED

    def test_existing_pair_returns_200(self):
        answer = ExtractionAnswerFactory(value="old")
        request = factory.post(
            "/",
            {
                "reference": answer.reference.pk,
                "question": answer.question.pk,
                "value": "new",
            },
            format="json",
        )
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["value"] == "new"

    def test_invalid_number_value_returns_400(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory(number=True)
        request = factory.post(
            "/",
            {
                "reference": ref.pk,
                "question": q.pk,
                "value": "not-a-number",
            },
            format="json",
        )
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST


# ExtractionAnswerViewSet — bulk_save
@pytest.mark.django_db
class TestExtractionAnswerBulkSave:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionAnswerViewSet

        return ExtractionAnswerViewSet.as_view({"post": "bulk_save"})

    def test_saves_all_answers_returns_200(self):
        ref = ReferenceFactory()
        q1 = ExtractionQuestionFactory()
        q2 = ExtractionQuestionFactory()
        request = factory.post(
            "/",
            {
                "reference_id": ref.pk,
                "answers": {str(q1.pk): "yes", str(q2.pk): "no"},
            },
            format="json",
        )
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["saved_count"] == 2

    def test_invalid_value_returns_400(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory(number=True)
        request = factory.post(
            "/",
            {
                "reference_id": ref.pk,
                "answers": {str(q.pk): "not-a-number"},
            },
            format="json",
        )
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_reference_id_returns_400(self):
        request = factory.post("/", {"answers": {}}, format="json")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_is_idempotent(self):
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        for value in ("first", "second"):
            request = factory.post(
                "/",
                {
                    "reference_id": ref.pk,
                    "answers": {str(q.pk): value},
                },
                format="json",
            )
            request.user = make_user()
            self._view()(request)
        from slrt_project.extraction.models import ExtractionAnswer

        assert ExtractionAnswer.objects.filter(reference=ref, question=q).count() == 1


# ExtractionTableViewSet — list
@pytest.mark.django_db
class TestExtractionTableList:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionTableViewSet

        return ExtractionTableViewSet.as_view({"get": "list"})

    def test_missing_review_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_200_with_review(self):
        # Patch get_base_queryset to avoid the user-as-PK error from
        # ReviewDataViewSet, and get_labels to avoid the per-row user lookup.
        # Do NOT add prefetch_related("extraction_answers") to the test queryset:
        # get_queryset() adds its own Prefetch object for that relation, and
        # Django raises ValueError for duplicate lookups with different querysets.
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True)
        qs = Reference.objects.filter(review=review, in_extraction=True)
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
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
        assert response.status_code == status.HTTP_200_OK

    def test_only_in_extraction_references_returned(self):
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True)
        ReferenceFactory(review=review, in_extraction=False)
        qs = Reference.objects.filter(review=review, in_extraction=True)
        request = factory.get("/", {"review": review.pk})
        request.user = make_user()
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


# ExtractionTableViewSet — filter_counts
@pytest.mark.django_db
class TestExtractionTableFilterCounts:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionTableViewSet

        return ExtractionTableViewSet.as_view({"get": "filter_counts"})

    def test_missing_review_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        with patch(
            "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
            return_value=None,
        ):
            assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_200_with_aggregations(self):
        review = ReviewFactory()
        request = factory.get("/")
        request.user = make_user()
        with (
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
                return_value=review,
            ),
            patch(
                "slrt_project.extraction.api.views.ReferenceAggregationService.build",
                return_value={"search_methods": []},
            ),
        ):
            response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK


# ExtractionTableViewSet — export_csv


@pytest.mark.django_db
class TestExtractionTableExportCsv:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionTableViewSet

        return ExtractionTableViewSet.as_view({"get": "export_csv"})

    def test_missing_review_id_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_csv_content_type(self):
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True)
        qs = Reference.objects.filter(
            review=review, in_extraction=True
        ).prefetch_related("extraction_answers")
        request = factory.get("/", {"review_id": review.pk})
        request.user = make_user()
        with (
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
                return_value=review,
            ),
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_queryset",
                return_value=qs,
            ),
        ):
            response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        assert "text/csv" in response["Content-Type"]

    def test_csv_has_header_row(self):
        from slrt_project.references.models import Reference

        review = ReviewFactory()
        section = ExtractionSectionFactory(review=review)
        ExtractionQuestionFactory(section=section, column_title="Design")
        ReferenceFactory(review=review, in_extraction=True)
        qs = Reference.objects.filter(
            review=review, in_extraction=True
        ).prefetch_related("extraction_answers")
        request = factory.get("/", {"review_id": review.pk})
        request.user = make_user()
        with (
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_review",
                return_value=review,
            ),
            patch(
                "slrt_project.extraction.api.views.ExtractionTableViewSet.get_queryset",
                return_value=qs,
            ),
        ):
            response = self._view()(request)
        content = (
            b"".join(response.streaming_content).decode()
            if hasattr(response, "streaming_content")
            else response.content.decode()
        )
        assert "Title" in content
        assert "Design" in content


# ExtractionTableViewSet — bulk_update_status
@pytest.mark.django_db
class TestExtractionTableBulkUpdateStatus:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionTableViewSet

        return ExtractionTableViewSet.as_view({"post": "bulk_update_status"})

    def test_marks_references_completed(self):
        ref = ReferenceFactory(in_extraction=True, is_extraction_completed=False)
        request = factory.post(
            "/",
            {
                "reference_ids": [ref.pk],
                "is_extraction_completed": True,
            },
            format="json",
        )
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["updated_count"] == 1
        ref.refresh_from_db()
        assert ref.is_extraction_completed is True

    def test_empty_list_returns_400(self):
        request = factory.post(
            "/",
            {
                "reference_ids": [],
                "is_extraction_completed": True,
            },
            format="json",
        )
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_response_includes_reference_ids_and_flag(self):
        ref = ReferenceFactory(in_extraction=True)
        request = factory.post(
            "/",
            {
                "reference_ids": [ref.pk],
                "is_extraction_completed": False,
            },
            format="json",
        )
        request.user = make_user()
        response = self._view()(request)
        assert response.data["reference_ids"] == [ref.pk]
        assert response.data["is_extraction_completed"] is False


# ExtractionFormViewSet — form_data
@pytest.mark.django_db
class TestExtractionFormData:
    def _view(self):
        from slrt_project.extraction.api.views import ExtractionFormViewSet

        return ExtractionFormViewSet.as_view({"get": "form_data"})

    def test_missing_params_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_non_integer_params_returns_400(self):
        request = factory.get("/", {"reference_id": "abc", "review_id": "xyz"})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_unknown_reference_returns_404(self):
        request = factory.get("/", {"reference_id": 99999, "review_id": 99999})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_404_NOT_FOUND

    def test_returns_sections_with_questions_and_answers(self):
        review = ReviewFactory()
        ref = ReferenceFactory(review=review, in_extraction=True)
        section = ExtractionSectionFactory(review=review, name="Methods")
        q = ExtractionQuestionFactory(section=section, column_title="Design")
        ExtractionAnswerFactory(reference=ref, question=q, value="RCT")

        request = factory.get("/", {"reference_id": ref.pk, "review_id": review.pk})
        request.user = make_user()
        response = self._view()(request)

        assert response.status_code == status.HTTP_200_OK
        assert "sections" in response.data
        sections = response.data["sections"]
        assert len(sections) == 1
        assert sections[0]["name"] == "Methods"
        questions = sections[0]["questions"]
        assert len(questions) == 1
        assert questions[0]["answer"]["value"] == "RCT"

    def test_unanswered_question_has_null_answer(self):
        review = ReviewFactory()
        ref = ReferenceFactory(review=review, in_extraction=True)
        section = ExtractionSectionFactory(review=review)
        ExtractionQuestionFactory(section=section)

        request = factory.get("/", {"reference_id": ref.pk, "review_id": review.pk})
        request.user = make_user()
        response = self._view()(request)
        assert response.data["sections"][0]["questions"][0]["answer"] is None


# BarChartViewSet
@pytest.mark.django_db
class TestBarChartViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import BarChartViewSet

        return BarChartViewSet.as_view({"get": "bar_chart"})

    def test_missing_question_id_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_wrong_type_returns_400(self):
        q = ExtractionQuestionFactory()  # free-text
        request = factory.get("/", {"question_id": q.pk})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_single_select_returns_counts(self):
        q = ExtractionQuestionFactory(single_select=True)
        ref1 = ReferenceFactory()
        ref2 = ReferenceFactory()
        ExtractionAnswerFactory(question=q, reference=ref1, value="Option A")
        ExtractionAnswerFactory(question=q, reference=ref2, value="Option A")

        request = factory.get("/", {"question_id": q.pk})
        request.user = make_user()
        response = self._view()(request)

        assert response.status_code == status.HTTP_200_OK
        counts = {item["label"]: item["count"] for item in response.data["data"]}
        assert counts.get("Option A") == 2

    def test_boolean_uses_synthesised_options(self):
        q = ExtractionQuestionFactory(boolean=True)
        request = factory.get("/", {"question_id": q.pk})
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        labels = {item["label"] for item in response.data["data"]}
        assert {"true", "false"} == labels

    def test_zero_count_options_are_included(self):
        q = ExtractionQuestionFactory(single_select=True)
        # No answers added — all options should appear with count=0.
        request = factory.get("/", {"question_id": q.pk})
        request.user = make_user()
        response = self._view()(request)
        assert all(item["count"] == 0 for item in response.data["data"])

    def test_multi_select_tokenises_values(self):
        q = ExtractionQuestionFactory(multi_select=True)
        ref = ReferenceFactory()
        # Answer covers two options in one value.
        ExtractionAnswerFactory(question=q, reference=ref, value="Option A,Option B")

        request = factory.get("/", {"question_id": q.pk})
        request.user = make_user()
        response = self._view()(request)
        counts = {item["label"]: item["count"] for item in response.data["data"]}
        assert counts.get("Option A") == 1
        assert counts.get("Option B") == 1


# ScatterPlotViewSet
@pytest.mark.django_db
class TestScatterPlotViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import ScatterPlotViewSet

        return ScatterPlotViewSet.as_view({"get": "scatter_plot"})

    def test_missing_params_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_wrong_type_returns_400(self):
        q = ExtractionQuestionFactory()  # free-text, not number
        request = factory.get("/", {"question_x": q.pk, "question_y": q.pk})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_points_for_references_with_both_answers(self):
        q_x = ExtractionQuestionFactory(number=True)
        q_y = ExtractionQuestionFactory(number=True)
        ref = ReferenceFactory()
        ExtractionAnswerFactory(
            question=q_x, reference=ref, value="10", value_number=10.0
        )
        ExtractionAnswerFactory(
            question=q_y, reference=ref, value="20", value_number=20.0
        )

        request = factory.get("/", {"question_x": q_x.pk, "question_y": q_y.pk})
        request.user = make_user()
        response = self._view()(request)

        assert response.status_code == status.HTTP_200_OK
        assert len(response.data["data"]) == 1
        point = response.data["data"][0]
        assert point["x"] == 10.0
        assert point["y"] == 20.0
        assert point["bubble_size"] == 1

    def test_reference_missing_y_answer_excluded(self):
        q_x = ExtractionQuestionFactory(number=True)
        q_y = ExtractionQuestionFactory(number=True)
        ref = ReferenceFactory()
        # Only x answer; no y → excluded.
        ExtractionAnswerFactory(
            question=q_x, reference=ref, value="5", value_number=5.0
        )

        request = factory.get("/", {"question_x": q_x.pk, "question_y": q_y.pk})
        request.user = make_user()
        response = self._view()(request)
        assert response.data["data"] == []

    def test_bubble_size_counts_shared_coordinates(self):
        q_x = ExtractionQuestionFactory(number=True)
        q_y = ExtractionQuestionFactory(number=True)
        for _ in range(3):
            ref = ReferenceFactory()
            ExtractionAnswerFactory(
                question=q_x, reference=ref, value="1", value_number=1.0
            )
            ExtractionAnswerFactory(
                question=q_y, reference=ref, value="1", value_number=1.0
            )

        request = factory.get("/", {"question_x": q_x.pk, "question_y": q_y.pk})
        request.user = make_user()
        response = self._view()(request)
        assert all(p["bubble_size"] == 3 for p in response.data["data"])


# EvidenceGapMapViewSet — helper methods (no DB)
class TestEvidenceGapHelpers:
    def _vs(self):
        return EvidenceGapMapViewSet()

    def test_get_options_boolean_returns_yes_no(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.BOOLEAN
        assert self._vs()._get_options(q) == ["Yes", "No"]

    def test_get_options_single_select_returns_options_list(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.SINGLE_SELECT
        q.options = ["A", "B"]
        assert self._vs()._get_options(q) == ["A", "B"]

    def test_get_options_empty_returns_empty_list(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.SINGLE_SELECT
        q.options = None
        assert self._vs()._get_options(q) == []

    def test_expand_single_select_maps_value_to_set(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.SINGLE_SELECT
        result = self._vs()._expand([(1, "RCT"), (2, "cohort")], q)
        assert result[1] == {"RCT"}
        assert result[2] == {"cohort"}

    def test_expand_multi_select_tokenises_values(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.MULTI_SELECT
        result = self._vs()._expand([(1, "A,B")], q)
        assert result[1] == {"A", "B"}

    def test_expand_boolean_true_maps_to_yes(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.BOOLEAN
        result = self._vs()._expand([(1, "true"), (2, "1"), (3, "yes")], q)
        assert result[1] == {"Yes"}
        assert result[2] == {"Yes"}
        assert result[3] == {"Yes"}

    def test_expand_boolean_false_maps_to_no(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.BOOLEAN
        result = self._vs()._expand([(1, "false"), (2, "0"), (3, "no")], q)
        assert all(result[k] == {"No"} for k in (1, 2, 3))

    def test_expand_boolean_invalid_is_skipped(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.BOOLEAN
        result = self._vs()._expand([(1, "maybe")], q)
        assert 1 not in result

    def test_expand_empty_value_is_skipped(self):
        q = MagicMock()
        q.type = ExtractionQuestion.QuestionType.SINGLE_SELECT
        result = self._vs()._expand([(1, "")], q)
        assert 1 not in result


@pytest.mark.django_db
class TestEvidenceGapMapViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import EvidenceGapMapViewSet

        return EvidenceGapMapViewSet.as_view({"get": "evidence_gap_map"})

    def test_missing_params_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_wrong_type_returns_400(self):
        q = ExtractionQuestionFactory(number=True)
        request = factory.get("/", {"question_row": q.pk, "question_col": q.pk})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_matrix_with_cells(self):
        q_row = ExtractionQuestionFactory(single_select=True)
        q_col = ExtractionQuestionFactory(single_select=True)
        ref = ReferenceFactory()
        ExtractionAnswerFactory(question=q_row, reference=ref, value="Option A")
        ExtractionAnswerFactory(question=q_col, reference=ref, value="Option A")

        request = factory.get("/", {"question_row": q_row.pk, "question_col": q_col.pk})
        request.user = make_user()
        response = self._view()(request)

        assert response.status_code == status.HTTP_200_OK
        assert "cells" in response.data
        assert "max_count" in response.data

    def test_cell_count_correct(self):
        q_row = ExtractionQuestionFactory(single_select=True)
        q_col = ExtractionQuestionFactory(single_select=True)
        for _ in range(2):
            ref = ReferenceFactory()
            ExtractionAnswerFactory(question=q_row, reference=ref, value="Option A")
            ExtractionAnswerFactory(question=q_col, reference=ref, value="Option A")

        request = factory.get("/", {"question_row": q_row.pk, "question_col": q_col.pk})
        request.user = make_user()
        response = self._view()(request)

        cell = next(
            c
            for c in response.data["cells"]
            if c["row"] == "Option A" and c["col"] == "Option A"
        )
        assert cell["count"] == 2


# PublicationTimelineViewSet
@pytest.mark.django_db
class TestPublicationTimelineViewSet:
    def _view(self):
        from slrt_project.extraction.api.views import PublicationTimelineViewSet

        return PublicationTimelineViewSet.as_view({"get": "publication_timeline"})

    def test_missing_review_id_returns_400(self):
        request = factory.get("/")
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_non_integer_review_id_returns_400(self):
        request = factory.get("/", {"review_id": "abc"})
        request.user = make_user()
        assert self._view()(request).status_code == status.HTTP_400_BAD_REQUEST

    def test_no_references_returns_empty_data(self):
        review = ReviewFactory()
        request = factory.get("/", {"review_id": review.pk})
        request.user = make_user()
        response = self._view()(request)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["data"] == []
        assert response.data["total_references"] == 0
        assert response.data["year_range"] is None

    def test_returns_counts_by_year(self):
        from datetime import date as dt

        review = ReviewFactory()
        ReferenceFactory(
            review=review, in_extraction=True, publication_date=dt(2020, 1, 1)
        )
        ReferenceFactory(
            review=review, in_extraction=True, publication_date=dt(2020, 6, 1)
        )
        ReferenceFactory(
            review=review, in_extraction=True, publication_date=dt(2022, 3, 1)
        )

        request = factory.get("/", {"review_id": review.pk})
        request.user = make_user()
        response = self._view()(request)

        assert response.status_code == status.HTTP_200_OK
        years = {item["year"]: item["count"] for item in response.data["data"]}
        assert years[2020] == 2
        assert years[2021] == 0  # gap filled with 0
        assert years[2022] == 1
        assert response.data["total_references"] == 3
        assert response.data["year_range"] == {"min": 2020, "max": 2022}

    def test_references_without_dates_excluded(self):
        review = ReviewFactory()
        ReferenceFactory(review=review, in_extraction=True, publication_date=None)

        request = factory.get("/", {"review_id": review.pk})
        request.user = make_user()
        response = self._view()(request)
        assert response.data["total_references"] == 0
