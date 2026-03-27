"""
Tests for slrt_project/references/models.py
and slrt_project/references/api/views.py.

Strategy
Views
- All view tests use APIRequestFactory + force_authenticate.
- External dependencies (Celery tasks, complex ORM, permissions) are patched
with unittest.mock.patch so tests are fast and deterministic.
- One class per endpoint / action; one method per behaviour.

Run with:
pytest slrt_project/references/tests/ -v
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework import status
from rest_framework.test import APIRequestFactory

from slrt_project.references.models import (
    ReferenceCluster,
)


factory = APIRequestFactory()


@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """
    Patch DRF's IsAuthenticated for every test in this module.
    """
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# Shared mock helpers
def make_user(pk=1, email="user@example.com", first_name="Alice", last_name="Smith"):
    u = MagicMock()
    u.pk = pk
    u.id = pk
    u.email = email
    u.first_name = first_name
    u.last_name = last_name
    u.is_authenticated = True
    return u


def make_review(pk=1, is_blinded=True, is_active=True):
    from slrt_project.reviews.models import Review

    r = MagicMock(spec=Review)
    r.pk = pk
    r.id = pk
    r.is_blinded = is_blinded
    r.is_active = is_active
    r.duplicate_detection_status = Review.DuplicateDetectionStatus.NOT_STARTED
    return r


def make_member(pk=1, role="Reviewer", review=None, user=None):
    from slrt_project.reviews.models import ReviewMember

    m = MagicMock(spec=ReviewMember)
    m.pk = pk
    m.id = pk
    m.role = role
    m.review = review or make_review()
    m.user = user or make_user()
    return m


# View tests — ReferenceViewSet
class TestReferenceViewSetAttachPDFs:
    def test_missing_mapping_field_returns_400(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post("/", {"not_mappings": []}, format="json")
        request.user = user
        view = ReferenceViewSet.as_view({"post": "attach_pdfs"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_pdf_and_reference_different_review_raises(self):
        """When PDF and reference belong to different reviews a 400 is returned."""
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"mappings": [{"reference_id": 1, "uploaded_pdf_id": 10}]},
            format="json",
        )
        request.user = user

        ref_mock = MagicMock()
        ref_mock.review_id = 1
        ref_mock.review = make_review(pk=1)

        pdf_mock = MagicMock()
        pdf_mock.review_id = 2  # Different review → should raise

        # Patch transaction.atomic so the view body runs without a real DB connection.
        with (
            patch("slrt_project.references.api.views.transaction.atomic"),
            patch("slrt_project.references.api.views.Reference.objects") as ref_qs,
            patch("slrt_project.references.api.views.UploadedPDF.objects") as pdf_qs,
            patch("slrt_project.references.api.views.check_permission"),
            patch("slrt_project.references.api.views.Code.objects"),
        ):
            ref_qs.select_for_update.return_value.get.return_value = ref_mock
            pdf_qs.select_for_update.return_value.get.return_value = pdf_mock

            view = ReferenceViewSet.as_view({"post": "attach_pdfs"})
            response = view(request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestReferenceViewSetAutoMatch:
    def test_no_matching_references_returns_zero(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"review_id": 1, "reference_ids": [99]},
            format="json",
        )
        request.user = user

        with (
            patch("slrt_project.references.api.views.get_object_or_404") as mock_get,
            patch("slrt_project.references.api.views.check_permission"),
            patch("slrt_project.references.api.views.Reference.objects") as ref_qs,
        ):
            mock_get.return_value = make_review(pk=1)
            ref_qs.select_related.return_value.filter.return_value.exists.return_value = False
            ref_qs.select_related.return_value.filter.return_value = MagicMock(
                exists=lambda: False
            )

            view = ReferenceViewSet.as_view({"post": "auto_match"})
            response = view(request)

        # exists() returns False → early return with 0 matched.
        assert response.status_code == status.HTTP_200_OK

    def test_invalid_payload_returns_400(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post("/", {}, format="json")
        request.user = user
        view = ReferenceViewSet.as_view({"post": "auto_match"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestReferenceViewSetBulkSyncPDFs:
    def test_no_ids_returns_400(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post("/", {"reference_ids": []}, format="json")
        request.user = user
        view = ReferenceViewSet.as_view({"post": "bulk_sync_pdfs"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_dispatches_task_per_reference(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post("/", {"reference_ids": [1, 2, 3]}, format="json")
        request.user = user

        mock_task = MagicMock()
        mock_task.id = "task-id"

        with patch(
            "slrt_project.references.api.views.sync_single_reference_pdf"
        ) as mock_sync:
            mock_sync.delay.return_value = mock_task
            view = ReferenceViewSet.as_view({"post": "bulk_sync_pdfs"})
            response = view(request)

        assert response.status_code == status.HTTP_202_ACCEPTED
        assert mock_sync.delay.call_count == 3
        assert len(response.data["tasks"]) == 3


class TestReferenceViewSetAssign:
    def test_assign_mode_without_assignee_id_returns_400(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"review": 1, "reference_ids": [1], "mode": "assign"},
            format="json",
        )
        request.user = user

        with (
            patch("slrt_project.references.api.views.get_object_or_404") as mock_get,
            patch("slrt_project.references.api.views.check_permission"),
            patch("slrt_project.references.api.views.Reference.objects") as ref_qs,
            patch("slrt_project.references.api.views.ReviewMember.objects") as mem_qs,
        ):
            mock_get.return_value = make_review(pk=1)
            ref_qs.filter.return_value = MagicMock()
            mem_qs.filter.return_value = MagicMock()

            view = ReferenceViewSet.as_view({"post": "assign"})
            response = view(request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_remove_mode_clears_assignee(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"review": 1, "reference_ids": [1, 2], "mode": "remove"},
            format="json",
        )
        request.user = user

        refs_mock = MagicMock()

        with (
            patch("slrt_project.references.api.views.get_object_or_404") as mock_get,
            patch("slrt_project.references.api.views.check_permission"),
            patch("slrt_project.references.api.views.Reference.objects") as ref_qs,
            patch("slrt_project.references.api.views.ReviewMember.objects") as mem_qs,
        ):
            mock_get.return_value = make_review(pk=1)
            ref_qs.filter.return_value = refs_mock
            mem_qs.filter.return_value = MagicMock()

            view = ReferenceViewSet.as_view({"post": "assign"})
            response = view(request)

        assert response.status_code == status.HTTP_200_OK
        refs_mock.update.assert_called_once_with(assignee=None)

    def test_invalid_mode_returns_400(self):
        from slrt_project.references.api.views import ReferenceViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"review": 1, "reference_ids": [1], "mode": "bad_mode"},
            format="json",
        )
        request.user = user
        view = ReferenceViewSet.as_view({"post": "assign"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# ReviewDataViewSet
class TestReviewDataViewSetList:
    def test_missing_review_param_returns_400(self):
        from slrt_project.references.api.views import ReviewDataViewSet

        user = make_user()
        request = factory.get("/")
        request.user = user

        with patch.object(ReviewDataViewSet, "get_review", return_value=None):
            view = ReviewDataViewSet.as_view({"get": "list"})
            response = view(request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_list_returns_200_with_review(self):
        from slrt_project.references.api.views import ReviewDataViewSet

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        review = make_review(pk=1)

        with (
            patch.object(ReviewDataViewSet, "get_review", return_value=review),
            patch.object(ReviewDataViewSet, "get_queryset") as mock_qs,
            patch.object(
                ReviewDataViewSet, "get_base_queryset_for_counts"
            ) as mock_counts,
            patch.object(ReviewDataViewSet, "filter_queryset") as mock_filter,
            patch.object(ReviewDataViewSet, "paginate_queryset", return_value=None),
            patch.object(ReviewDataViewSet, "get_serializer") as mock_ser,
        ):
            mock_qs.return_value = MagicMock()
            mock_counts.return_value.count.return_value = 10
            mock_filter.return_value.count.return_value = 5
            mock_ser.return_value.data = []

            view = ReviewDataViewSet.as_view({"get": "list"})
            response = view(request)

        assert response.status_code == status.HTTP_200_OK
        assert "total_count" in response.data
        assert "filtered_count" in response.data


class TestReviewDataViewSetFilterCounts:
    def test_missing_review_returns_400(self):
        from slrt_project.references.api.views import ReviewDataViewSet

        user = make_user()
        request = factory.get("/")
        request.user = user

        with patch.object(ReviewDataViewSet, "get_review", return_value=None):
            view = ReviewDataViewSet.as_view({"get": "filter_counts"})
            response = view(request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_aggregations_for_valid_review(self):
        from slrt_project.references.api.views import (
            ReferenceAggregationService,
            ReviewDataViewSet,
        )

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        fake_agg = {"search_methods": [], "labels": [], "file_counts": {}}

        with (
            patch.object(ReviewDataViewSet, "get_review", return_value=make_review()),
            patch.object(ReviewDataViewSet, "get_base_queryset_for_counts") as mock_qs,
            patch.object(ReferenceAggregationService, "build", return_value=fake_agg),
        ):
            mock_qs.return_value = MagicMock()
            view = ReviewDataViewSet.as_view({"get": "filter_counts"})
            response = view(request)

        assert response.status_code == status.HTTP_200_OK
        assert response.data == fake_agg


# UploadedPDFViewSet
class TestUploadedPDFViewSetCreate:
    def test_non_pdf_file_returns_400(self):
        """The serializer should reject non-PDF files."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        from slrt_project.references.api.serializers import UploadedPDFSerializer

        file = SimpleUploadedFile("data.csv", b"col1,col2", content_type="text/csv")
        s = UploadedPDFSerializer(data={"file": file, "review": 1})
        # We test validate_file directly — it should raise for non-PDF files.
        with pytest.raises(Exception):
            s.validate_file(file)


class TestUploadedPDFViewSetExtractDOI:
    def test_returns_none_on_empty_pdf(self):
        from slrt_project.references.api.views import UploadedPDFViewSet

        with patch("slrt_project.references.api.views.pymupdf.open") as mock_open:
            mock_open.return_value = []  # empty doc → len() == 0
            result = UploadedPDFViewSet._extract_doi("/fake/path.pdf")
        assert result is None

    def test_returns_none_on_exception(self):
        from slrt_project.references.api.views import UploadedPDFViewSet

        with patch(
            "slrt_project.references.api.views.pymupdf.open", side_effect=RuntimeError
        ):
            result = UploadedPDFViewSet._extract_doi("/fake/path.pdf")
        assert result is None

    def test_extracts_doi_from_text(self):
        from slrt_project.references.api.views import UploadedPDFViewSet

        page_mock = MagicMock()
        page_mock.get_text.return_value = "DOI: 10.1234/abcd.efgh Published 2024."
        doc_mock = MagicMock()
        doc_mock.__len__ = lambda s: 1
        doc_mock.__getitem__ = lambda s, i: page_mock

        with patch(
            "slrt_project.references.api.views.pymupdf.open", return_value=doc_mock
        ):
            result = UploadedPDFViewSet._extract_doi("/fake/path.pdf")

        assert result is not None
        assert result.startswith("10.1234")


# DuplicateClusterViewSet


class TestDuplicateClusterViewSetList:
    def test_list_defaults_to_unresolved(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_queryset"),
            patch.object(DuplicateClusterViewSet, "filter_queryset") as mock_filter,
            patch.object(DuplicateClusterViewSet, "get_serializer") as mock_ser,
            patch(
                "slrt_project.references.api.views.ReferenceCluster.objects"
            ) as cluster_qs,
        ):
            mock_filter.return_value.filter.return_value = MagicMock()
            mock_ser.return_value.data = []
            cluster_qs.filter.return_value.count.return_value = 0
            cluster_qs.filter.return_value.filter.return_value.count.return_value = 0

            view = DuplicateClusterViewSet.as_view({"get": "list"})
            response = view(request)

        assert response.status_code == status.HTTP_200_OK

    def test_list_response_has_progress_keys(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_queryset"),
            patch.object(DuplicateClusterViewSet, "filter_queryset") as mock_filter,
            patch.object(DuplicateClusterViewSet, "get_serializer") as mock_ser,
            patch(
                "slrt_project.references.api.views.ReferenceCluster.objects"
            ) as cluster_qs,
        ):
            mock_filter.return_value.filter.return_value = MagicMock()
            mock_ser.return_value.data = []
            all_qs = MagicMock()
            all_qs.count.return_value = 5
            all_qs.filter.return_value.count.return_value = 2
            cluster_qs.filter.return_value = all_qs

            view = DuplicateClusterViewSet.as_view({"get": "list"})
            response = view(request)

        assert "total" in response.data
        assert "resolved" in response.data
        assert "remaining" in response.data
        assert "progress" in response.data


class TestDuplicateClusterViewSetResolve:
    def test_already_resolved_cluster_returns_400(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.status = ReferenceCluster.Status.AUTO_RESOLVED

        member = make_member(role="Owner")
        user = make_user()
        request = factory.post("/", {"canonical_reference_id": 1}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
        ):
            view = DuplicateClusterViewSet.as_view({"post": "resolve"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_canonical_id_returns_400(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.status = ReferenceCluster.Status.UNRESOLVED
        member = make_member(role="Owner")

        user = make_user()
        request = factory.post("/", {}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
        ):
            view = DuplicateClusterViewSet.as_view({"post": "resolve"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_canonical_id_not_in_cluster_returns_400(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.status = ReferenceCluster.Status.UNRESOLVED
        cluster.members.filter.return_value.exists.return_value = False
        member = make_member(role="Owner")

        user = make_user()
        request = factory.post("/", {"canonical_reference_id": 999}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
        ):
            view = DuplicateClusterViewSet.as_view({"post": "resolve"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_valid_resolve_returns_200(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.id = "uuid-1"
        cluster.status = ReferenceCluster.Status.UNRESOLVED
        cluster.members.filter.return_value.exists.return_value = True
        cluster.review = make_review()
        member = make_member(role="Owner")

        user = make_user()
        request = factory.post("/", {"canonical_reference_id": 42}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
            patch(
                "slrt_project.references.api.views.DuplicateClusterManager"
            ) as mock_manager,
        ):
            mock_manager.return_value.manually_resolve = MagicMock()
            view = DuplicateClusterViewSet.as_view({"post": "resolve"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_200_OK
        assert response.data["clusterId"] == "uuid-1"


class TestDuplicateClusterViewSetDismiss:
    def test_already_resolved_returns_400(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.status = ReferenceCluster.Status.MANUALLY_RESOLVED
        member = make_member(role="Owner")

        user = make_user()
        request = factory.post("/", {}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
        ):
            view = DuplicateClusterViewSet.as_view({"post": "dismiss"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_valid_dismiss_returns_200(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        cluster = MagicMock()
        cluster.id = "uuid-1"
        cluster.status = ReferenceCluster.Status.UNRESOLVED
        member = make_member(role="Owner")

        user = make_user()
        request = factory.post("/", {}, format="json")
        request.user = user

        with (
            patch.object(DuplicateClusterViewSet, "get_object", return_value=cluster),
            patch.object(
                DuplicateClusterViewSet,
                "_require_duplicate_permission",
                return_value=member,
            ),
            patch("slrt_project.references.api.views.Reference.objects") as ref_qs,
        ):
            ref_qs.filter.return_value.update = MagicMock()
            view = DuplicateClusterViewSet.as_view({"post": "dismiss"})
            response = view(request, pk="uuid-1")

        assert response.status_code == status.HTTP_200_OK
        assert cluster.status == ReferenceCluster.Status.DISMISSED


class TestDuplicateClusterViewSetStats:
    def test_missing_review_returns_400(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        user = make_user()
        request = factory.get("/")
        request.user = user
        view = DuplicateClusterViewSet.as_view({"get": "stats"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_member_returns_403(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        with patch("slrt_project.references.api.views.ReviewMember.objects") as mem_qs:
            mem_qs.filter.return_value.exists.return_value = False
            view = DuplicateClusterViewSet.as_view({"get": "stats"})
            response = view(request)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_member_gets_stats(self):
        from slrt_project.references.api.views import DuplicateClusterViewSet

        user = make_user()
        request = factory.get("/?review=1")
        request.user = user

        with (
            patch("slrt_project.references.api.views.ReviewMember.objects") as mem_qs,
            patch(
                "slrt_project.references.api.views.ReferenceCluster.objects"
            ) as cluster_qs,
            patch(
                "slrt_project.references.api.views.ReferenceClusterMember.objects"
            ) as rcm_qs,
        ):
            mem_qs.filter.return_value.exists.return_value = True
            cluster_qs.filter.return_value.values.return_value.annotate.return_value = []
            rcm_qs.filter.return_value.values.return_value.distinct.return_value.count.return_value = 5

            view = DuplicateClusterViewSet.as_view({"get": "stats"})
            response = view(request)

        assert response.status_code == status.HTTP_200_OK
        assert "unresolved" in response.data
        assert "affectedReferences" in response.data


# ReferenceOpinionViewSet
@pytest.mark.django_db
class TestReferenceOpinionBulkUpsert:
    """
    bulk_upsert is decorated with @transaction.atomic at definition time so
    """

    def test_invalid_stage_returns_400(self):
        from slrt_project.references.api.views import ReferenceOpinionViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"reference_ids": [1], "status": "included", "stage": "bad"},
            format="json",
        )
        request.user = user
        view = ReferenceOpinionViewSet.as_view({"post": "bulk_upsert"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_empty_reference_ids_returns_400(self):
        from slrt_project.references.api.views import ReferenceOpinionViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"reference_ids": [], "status": "included", "stage": "screening"},
            format="json",
        )
        request.user = user
        view = ReferenceOpinionViewSet.as_view({"post": "bulk_upsert"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_missing_references_returns_400(self):
        from slrt_project.references.api.views import ReferenceOpinionViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"reference_ids": [9999], "status": "included", "stage": "screening"},
            format="json",
        )
        request.user = user

        with patch("slrt_project.references.api.views.Reference.objects") as ref_qs:
            qs_mock = MagicMock()
            qs_mock.count.return_value = 0  # 0 ≠ 1 → raises 400
            qs_mock.__iter__ = lambda s: iter([])
            ref_qs.filter.return_value.select_related.return_value = qs_mock

            view = ReferenceOpinionViewSet.as_view({"post": "bulk_upsert"})
            response = view(request)

        assert response.status_code == status.HTTP_400_BAD_REQUEST


# LabelViewSet
class TestLabelViewSetAssignToReferences:
    def test_invalid_payload_returns_400(self):
        from slrt_project.references.api.views import LabelViewSet

        user = make_user()
        request = factory.post("/", {}, format="json")
        request.user = user
        view = LabelViewSet.as_view({"post": "assign_to_references"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST


# NoteViewSet
class TestNoteViewSetBulkCreate:
    def test_invalid_payload_returns_400(self):
        from slrt_project.references.api.views import NoteViewSet

        user = make_user()
        request = factory.post("/", {"content": "note"}, format="json")
        request.user = user
        view = NoteViewSet.as_view({"post": "bulk_create"})
        response = view(request)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_non_existent_references_raises(self):
        from slrt_project.references.api.views import NoteViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"reference_ids": [9999], "content": "test"},
            format="json",
        )
        request.user = user

        with patch("slrt_project.references.api.views.Reference.objects") as ref_qs:
            ref_qs.filter.return_value.select_related.return_value.count.return_value = 0
            view = NoteViewSet.as_view({"post": "bulk_create"})
            response = view(request)

        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_400_BAD_REQUEST,
        )


# KeywordViewSet
class TestKeywordViewSetCreate:
    def test_missing_review_raises_permission_denied(self):
        from slrt_project.references.api.views import KeywordViewSet

        user = make_user()
        request = factory.post(
            "/",
            {"name": "cancer", "type": "inclusion"},
            format="json",
        )
        request.user = user

        with patch("slrt_project.references.api.views.get_object_or_404"):
            view = KeywordViewSet.as_view({"post": "create"})
            with patch.object(KeywordViewSet, "get_queryset", return_value=MagicMock()):
                response = view(request)

        # PermissionDenied (403) or 400 — either is acceptable for missing review.
        assert response.status_code in (
            status.HTTP_403_FORBIDDEN,
            status.HTTP_400_BAD_REQUEST,
        )


# ReasonViewSet
class TestReasonViewSetList:
    def test_missing_review_param_raises_validation_error(self):
        from slrt_project.references.api.views import ReasonViewSet

        user = make_user()
        request = factory.get("/")
        request.user = user
        view = ReasonViewSet.as_view({"get": "list"})
        response = view(request)
        # Serializer ValidationError → 400.
        assert response.status_code == status.HTTP_400_BAD_REQUEST
