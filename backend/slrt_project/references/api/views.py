"""
Views for the references app.

ViewSet inventory
-----------------
ReferenceViewSet          — CRUD + attach-pdfs, auto-match, bulk-sync, assign
ReviewDataViewSet         — paginated reference list for the review-data page
ScreeningViewSet          — screening-stage reference list
ScreeningFullTextViewSet  — full-text-stage reference list
UploadedPDFViewSet        — PDF upload management
LabelViewSet              — label CRUD + assign-to-references
ReasonViewSet             — exclusion reason CRUD
ReferenceOpinionViewSet   — single-opinion update + bulk-upsert
DuplicateClusterViewSet   — cluster list, resolve, dismiss, stats
KeywordViewSet            — keyword CRUD
NoteViewSet               — note CRUD + bulk-create

Supporting classes / functions
-------------------------------
ReferencePagination           — limit/offset pagination with custom response shape
ReferenceAggregationService   — sidebar filter count aggregations
ReviewQuerysetMixin           — shared review access + base queryset helpers
ScreeningQuerysetMixin        — screening-specific queryset + filter-counts action
"""

import logging
import os
import re

import pymupdf
import rest_framework.filters as drf_filters
from django.contrib.postgres.search import TrigramSimilarity
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import CharField, Count, F, OuterRef, Prefetch, Q, Subquery
from django.db.models.functions import ExtractYear, Lower
from django.http import HttpResponse
from django.utils import timezone
from django_filters import rest_framework as django_filters_backend
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.models import Code
from slrt_project.integrations.tasks import sync_single_reference_pdf
from slrt_project.references.api.filters import (
    DuplicateClusterFilter,
    ReferenceFilter,
    ScreeningFilter,
)
from slrt_project.references.api.serializers import (
    AssignLabelsResponseSerializer,
    AssignLabelsSerializer,
    AssignReferencesResponseSerializer,
    AssignReferencesSerializer,
    AttachPDFsResponseSerializer,
    AttachPDFsSerializer,
    AutoMatchResponseSerializer,
    AutoMatchSerializer,
    BulkCreateNoteResponseSerializer,
    BulkCreateNoteSerializer,
    BulkSyncPDFsResponseSerializer,
    ClusterListResponseSerializer,
    ClusterStatsResponseSerializer,
    DismissClusterResponseSerializer,
    DuplicateClusterSerializer,
    KeywordSerializer,
    LabelSerializer,
    NoteSerializer,
    ReasonSerializer,
    ReferenceOpinionSerializer,
    ReferenceOpinionUpsertSerializer,
    ReferenceSerializer,
    ResolveClusterResponseSerializer,
    UploadedPDFSerializer,
)
from slrt_project.references.models import (
    DuplicateClusterManager,
    ImmutableUnaccent,
    Keyword,
    Label,
    Note,
    Reason,
    Reference,
    ReferenceCluster,
    ReferenceClusterMember,
    ReferenceLabel,
    ReferenceOpinion,
    ReferenceOpinionStatus,
    UploadedPDF,
)
from slrt_project.reviews.models import Review, ReviewMember, SearchMethod
from slrt_project.shared.permissions import (
    PERMISSIONS,
    Permission,
    check_permission,
    permission_denied_message,
)


logger = logging.getLogger(__name__)


# ===========================================================================
# ReferenceViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(
        summary="List references",
        description=(
            "Returns references the user has access to. "
            "In blinded reviews only the user's own opinions are included."
        ),
        responses={200: ReferenceSerializer(many=True)},
    ),
    retrieve=extend_schema(
        summary="Retrieve a reference",
        responses={200: ReferenceSerializer},
    ),
    update=extend_schema(
        summary="Update a reference (owner / collaborator / reviewer)"
    ),
    partial_update=extend_schema(summary="Partially update a reference"),
)
class ReferenceViewSet(viewsets.ModelViewSet):
    """
    CRUD for Reference objects plus attach-pdfs, auto-match, bulk-sync, and
    assign custom actions.

    Permissions
    -----------
    - List / Retrieve : any authenticated review member.
    - Update          : members with MODIFY_REFERENCE permission
                        (owner / collaborator / reviewer).

    Blinded reviews
    ---------------
    When a review is blinded the queryset restricts ``prefetched_opinions`` to
    the requesting user's own opinions so reviewers cannot see each other's
    work.
    """

    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """
        Build the base queryset.

        - Filters to reviews the user belongs to.
        - Prefetches opinions (blinded: only user's own; unblinded: all).
        - Prefetches labels.
        """
        user = self.request.user
        review_id = self.request.query_params.get("review")

        queryset = Reference.objects.all()
        review = None

        if review_id:
            review = get_object_or_404(Review, pk=review_id)
            check_permission(Permission.ACCESS_REVIEW, user, review)
            queryset = queryset.filter(review=review)
        else:
            queryset = queryset.filter(review__members__user=user)

        # Scope the opinions prefetch to what the user is allowed to see.
        if review and review.is_blinded:
            opinions_qs = ReferenceOpinion.objects.filter(
                member__user=user
            ).select_related("member__user")
        else:
            opinions_qs = ReferenceOpinion.objects.select_related("member__user")

        return (
            queryset.prefetch_related(
                Prefetch(
                    "referenceopinion_set",
                    queryset=opinions_qs,
                    to_attr="prefetched_opinions",
                ),
                "labels",
            )
            .distinct()
            .select_related("search_method")
        )

    def perform_update(self, serializer):
        """Guard: only members with MODIFY_REFERENCE permission may update."""
        reference = self.get_object()
        check_permission(
            Permission.MODIFY_REFERENCE, self.request.user, reference.review
        )
        serializer.save()

    # ------------------------------------------------------------------
    # attach-pdfs
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Attach uploaded PDFs to references",
        description=(
            "Accepts a list of (reference_id, uploaded_pdf_id) mappings. "
            "Moves the file from the UploadedPDF to the Reference and deletes "
            "the UploadedPDF row.  Existing codes on the reference are removed."
        ),
        request=AttachPDFsSerializer,
        responses={
            200: AttachPDFsResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=False, methods=["post"], url_path="attach-pdfs")
    def attach_pdfs(self, request):
        """
        Move uploaded PDFs onto their target references in a single transaction.

        For each mapping:
        1. Verify the reference and PDF belong to the same review.
        2. Delete all codes on the reference (their highlight positions will be
           invalidated by a new PDF).
        3. Copy the file field from UploadedPDF → Reference.
        4. Bulk-delete the consumed UploadedPDF rows using ``_raw_delete`` to
           bypass django-cleanup's signal so the file is not deleted from
           storage (it's now referenced by the Reference).
        """
        serializer = AttachPDFsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        updated = []
        ids_to_delete = []

        with transaction.atomic():
            for item in serializer.validated_data["mappings"]:
                reference = Reference.objects.select_for_update().get(
                    id=item["reference_id"]
                )
                uploaded_pdf = UploadedPDF.objects.select_for_update().get(
                    id=item["uploaded_pdf_id"]
                )
                check_permission(Permission.UPLOAD_FILES, user, reference.review)

                if uploaded_pdf.review_id != reference.review_id:
                    raise serializers.ValidationError(
                        "Uploaded PDF and reference must belong to the same review."
                    )

                # Codes become invalid after a new PDF is attached.
                Code.objects.filter(reference=reference).delete()

                reference.file = uploaded_pdf.file
                reference.save(update_fields=["file"])

                updated.append(
                    {
                        "id": reference.id,
                        "file": reference.file.url if reference.file else None,
                        "uploaded_pdf_id": uploaded_pdf.id,
                    }
                )
                ids_to_delete.append(uploaded_pdf.pk)

            # Skip django-cleanup's post_delete signal so the file stays on disk.
            UploadedPDF.objects.filter(pk__in=ids_to_delete)._raw_delete(
                using="default"
            )

        return Response(
            AttachPDFsResponseSerializer({"updated_references": updated}).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # auto-match
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Auto-match uploaded PDFs to references",
        description=(
            "Attempts three matching strategies in order: "
            "(1) DOI exact match, "
            "(2) exact normalised title match (unaccented, lowercased), "
            "(3) trigram similarity > 0.6. "
            "Matched PDFs are deleted after assignment."
        ),
        request=AutoMatchSerializer,
        responses={
            200: AutoMatchResponseSerializer,
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=False, methods=["post"], url_path="auto-match")
    def auto_match(self, request):
        """
        Automatically pair uploaded PDFs with references using three strategies.

        Strategy order (each operates only on still-unmatched references):
        1. DOI exact match (case-insensitive via ``doi__iexact``).
        2. Normalised title exact match using immutable_unaccent + Lower.
        3. Trigram similarity (threshold 0.6) on the normalised title.

        After matching, consumed UploadedPDF rows are deleted.
        """
        serializer = AutoMatchSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        reference_ids = serializer.validated_data["reference_ids"]
        review = get_object_or_404(Review, id=serializer.validated_data["review_id"])
        check_permission(Permission.UPLOAD_FILES, user, review)

        references = Reference.objects.select_related("review").filter(
            id__in=reference_ids,
            review=review,
        )
        if not references.exists():
            return Response({"matched": 0, "unmatched": len(reference_ids)})

        uploaded_pdfs = UploadedPDF.objects.filter(review=review)
        matched_reference_ids = []

        with transaction.atomic():
            # --- Pass 1: DOI match ---
            doi_pdf_subquery = uploaded_pdfs.filter(doi__iexact=OuterRef("doi")).values(
                "file"
            )[:1]
            references.exclude(doi__isnull=True).exclude(doi="").update(
                file=Subquery(doi_pdf_subquery)
            )

            # --- Pass 2: Exact normalised title ---
            remaining = Reference.objects.filter(
                id__in=reference_ids, file__isnull=True
            )
            name_pdf_subquery = (
                uploaded_pdfs.annotate(normalized_name=Lower(ImmutableUnaccent("name")))
                .filter(normalized_name=Lower(ImmutableUnaccent(OuterRef("title"))))
                .values("file")[:1]
            )
            remaining.update(file=Subquery(name_pdf_subquery))

            # --- Pass 3: Trigram similarity ---
            remaining = Reference.objects.filter(
                id__in=reference_ids, file__isnull=True
            )
            trigram_subquery = (
                uploaded_pdfs.annotate(
                    similarity=TrigramSimilarity(
                        Lower(ImmutableUnaccent("name")),
                        Lower(ImmutableUnaccent(OuterRef("title"))),
                    )
                )
                .filter(similarity__gt=0.6)
                .order_by("-similarity")
                .values("file")[:1]
            )
            remaining.update(file=Subquery(trigram_subquery))

            matched_reference_ids = list(
                Reference.objects.filter(id__in=reference_ids)
                .exclude(file__isnull=True)
                .values_list("id", flat=True)
            )

            # Delete consumed UploadedPDFs without removing the actual files.
            used_files = Reference.objects.filter(
                id__in=matched_reference_ids
            ).values_list("file", flat=True)
            used_pdfs = UploadedPDF.objects.filter(review=review, file__in=used_files)
            used_pdfs.update(file="")  # empty field → django-cleanup skips it
            used_pdfs.delete()

        return Response(
            AutoMatchResponseSerializer(
                {
                    "matched": len(matched_reference_ids),
                    "unmatched": len(set(reference_ids) - set(matched_reference_ids)),
                }
            ).data,
            status=status.HTTP_200_OK,
        )

    # ------------------------------------------------------------------
    # bulk-sync-pdfs
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Bulk sync PDFs from Zotero",
        description="Enqueues a Celery sync task for each reference ID provided.",
        responses={
            202: BulkSyncPDFsResponseSerializer,
            400: OpenApiResponse(description="No reference IDs provided"),
        },
    )
    @action(detail=False, methods=["post"])
    def bulk_sync_pdfs(self, request):
        """Dispatch one ``sync_single_reference_pdf`` task per reference ID."""
        reference_ids = request.data.get("reference_ids", [])
        if not reference_ids:
            return Response(
                {"error": "No reference IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tasks = [
            {
                "reference_id": ref_id,
                "task_id": sync_single_reference_pdf.delay(ref_id).id,
            }
            for ref_id in reference_ids
        ]

        return Response(
            BulkSyncPDFsResponseSerializer(
                {
                    "message": f"Started sync for {len(tasks)} references",
                    "tasks": tasks,
                }
            ).data,
            status=status.HTTP_202_ACCEPTED,
        )

    # ------------------------------------------------------------------
    # assign
    # ------------------------------------------------------------------

    @extend_schema(
        summary="Assign / remove / split references",
        description=(
            "Modes: "
            "``assign`` — assign to a specific member (requires ``assignee_id``); "
            "``remove`` — clear all assignments; "
            "``split_equally`` — round-robin across all review members."
        ),
        request=AssignReferencesSerializer,
        responses={
            200: AssignReferencesResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied (owner only)"),
        },
    )
    @action(detail=False, methods=["post"], url_path="assign")
    def assign(self, request):
        """
        Assign, un-assign, or split references across members.

        Only the review owner may use this action (``Permission.INVITE`` is
        used as the owner-only gate — the same permission guards invitations).
        """
        serializer = AssignReferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        review_id = serializer.validated_data["review"]
        reference_ids = list(set(serializer.validated_data["reference_ids"]))
        mode = serializer.validated_data["mode"]
        assignee_id = serializer.validated_data.get("assignee_id")

        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.INVITE, user, review)

        references = Reference.objects.filter(id__in=reference_ids, review=review)
        assignable_members = ReviewMember.objects.filter(review=review)

        if mode == "assign":
            if not assignee_id:
                return Response(
                    {"detail": "assignee_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            assignee = get_object_or_404(assignable_members, pk=assignee_id)
            references.update(assignee=assignee)

        elif mode == "remove":
            references.update(assignee=None)

        elif mode == "split_equally":
            assignees = list(assignable_members)
            if not assignees:
                return Response(
                    {"detail": "No users to split references"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            for index, reference in enumerate(references):
                reference.assignee = assignees[index % len(assignees)]
                reference.save(update_fields=["assignee"])

        return Response(
            AssignReferencesResponseSerializer(
                {"detail": "References updated successfully"}
            ).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# Pagination
# ===========================================================================


class ReferencePagination(LimitOffsetPagination):
    """
    Standard limit/offset pagination for the reference list views.

    Frontend sends ``?limit=50&offset=0`` for the first page, then increments
    ``offset`` by ``limit`` for subsequent pages (infinite scroll).

    The paginated response wraps the standard DRF ``count`` / ``next`` /
    ``previous`` fields with the ``references`` list key so the frontend
    always receives a consistent envelope shape.
    """

    default_limit = 50
    max_limit = 200

    def get_paginated_response(self, data):
        return Response(
            {
                "references": data,
                "count": self.count,
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "offset": self.offset,
                "limit": self.limit,
            }
        )

    def get_paginated_response_schema(self, schema):
        return {
            "type": "object",
            "properties": {
                "count": {"type": "integer"},
                "next": {"type": "string", "nullable": True},
                "previous": {"type": "string", "nullable": True},
                "offset": {"type": "integer"},
                "limit": {"type": "integer"},
                "references": schema,
            },
        }


# ===========================================================================
# ReferenceAggregationService
# ===========================================================================


class ReferenceAggregationService:
    """
    Computes sidebar filter counts from a base queryset scoped to a review.

    The counts are intentionally computed from the *unfiltered* queryset so
    that the sidebar always shows the full universe of available values — not
    just what's visible after the user's current filters are applied.  This
    prevents confusing "disappearing" filter options as the user narrows down.

    ``build()`` is a static method so it can be called from multiple view
    classes without instantiation overhead.
    """

    @staticmethod
    def build(
        base_qs,
        user,
        include_duplicate_status: bool = True,
        include_extraction_counts: bool = False,
    ) -> dict:
        """
        Return a dict of aggregated counts for the sidebar filter panel.

        Args:
            base_qs:                   Unfiltered Reference queryset for the review.
            user:                      Requesting user (for label scoping).
            include_duplicate_status:  Include ``duplicate_status_counts`` key.
            include_extraction_counts: Include ``completedCount`` / ``inProgressCount``.
        """
        result = {
            # How many references came from each SearchMethod.
            "search_methods": list(
                SearchMethod.objects.filter(reference__in=base_qs)
                .annotate(count=Count("reference", filter=Q(reference__in=base_qs)))
                .values("id", "name", "count")
            ),
            # Labels applied by this user to references in this review.
            "labels": list(
                Label.objects.filter(
                    user=user,
                    reference_labels__reference__in=base_qs,
                )
                .annotate(
                    count=Count(
                        "reference_labels__reference",
                        filter=Q(reference_labels__reference__in=base_qs),
                    )
                )
                .values("id", "name", "count")
            ),
            # Publication type breakdown.
            "publication_types": list(
                base_qs.exclude(publication_type="")
                .values("publication_type")
                .annotate(count=Count("id"))
                .order_by("-count")
            ),
            # Publication year breakdown.
            "publication_years": list(
                base_qs.filter(publication_date__isnull=False)
                .annotate(year=ExtractYear("publication_date"))
                .values("year")
                .annotate(count=Count("id"))
                .order_by("-year")
            ),
            # PDF presence counts.
            "file_counts": {
                "with_file": base_qs.exclude(file="").count(),
                "without_file": base_qs.filter(file="").count(),
            },
            # Assignee breakdown.
            "assignees": list(
                base_qs.filter(assignee__isnull=False)
                .values(
                    _id=F("assignee__id"),
                    first_name=F("assignee__user__first_name"),
                    last_name=F("assignee__user__last_name"),
                    email=F("assignee__user__email"),
                )
                .annotate(count=Count("id"))
            ),
            # Placeholder; overwritten below when include_duplicate_status=True.
            "duplicate_status_counts": {},
        }

        if include_duplicate_status:
            result["duplicate_status_counts"] = dict(
                base_qs.values("duplicate_status")
                .annotate(count=Count("id"))
                .values_list("duplicate_status", "count")
            )

        if include_extraction_counts:
            result["completedCount"] = base_qs.filter(
                is_extraction_completed=True
            ).count()
            result["inProgressCount"] = base_qs.filter(
                is_extraction_completed=False
            ).count()

        return result


# ===========================================================================
# Mixins
# ===========================================================================


class ReviewQuerysetMixin:
    """
    Mixin that resolves and caches the current review from the ``?review=`` query
    parameter, enforcing access-control, and exposes helpers used by both the
    review-data view and the screening views.
    """

    def get_review(self):
        """
        Return the Review from ``?review=<pk>``, checking access permission.

        The result is cached on ``self._review`` so repeated calls within the
        same request incur only one DB hit.
        """
        if hasattr(self, "_review"):
            return self._review
        review_id = self.request.query_params.get("review")
        if not review_id:
            self._review = None
            return None
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.ACCESS_REVIEW, self.request.user, review)
        self._review = review
        return review

    def get_base_queryset(self):
        """
        Return a Reference queryset with select_related + labels prefetch.

        Scoped to the review when ``?review=`` is supplied, otherwise to all
        reviews the user belongs to.
        """
        user = self.request.user
        review = self.get_review()

        qs = Reference.objects.select_related("assignee", "search_method", "review")
        qs = (
            qs.filter(review=review)
            if review
            else qs.filter(review__members__user=user)
        )

        return qs.prefetch_related(
            Prefetch(
                "labels",
                queryset=ReferenceLabel.objects.filter(label__user=user).select_related(
                    "label"
                ),
                to_attr="prefetched_labels",
            )
        )

    def get_base_queryset_for_counts(self):
        """
        Return an unfiltered Reference queryset for sidebar aggregations.

        Returns ``Reference.objects.none()`` when no review is resolved so
        aggregation methods never accidentally count across reviews.
        """
        review = self.get_review()
        return (
            Reference.objects.filter(review=review)
            if review
            else Reference.objects.none()
        )


class ScreeningQuerysetMixin:
    """
    Mixin that applies screening-stage queryset transformations and provides
    a ``filter-counts`` action used by both the screening and full-text views.
    """

    def apply_screening(self, qs, stage=None):
        """
        Restrict and annotate a queryset for the given screening stage.

        Steps:
        1. Exclude unresolved/deleted duplicates.
        2. For full-text stage: keep only ``in_full_text=True`` references.
        3. Annotate ``effective_status``:
           - Blinded review: subquery for the current user's opinion.
           - Non-blinded: use the denormalised status field directly.
        4. Prefetch opinions for the stage.
        """
        user = self.request.user
        review = self.get_review()
        if stage is None:
            stage = ReferenceOpinion.Stage.SCREENING

        qs = qs.exclude(
            duplicate_status__in=[
                Reference.DuplicateStatus.DELETED,
                Reference.DuplicateStatus.UNRESOLVED,
            ]
        )

        if stage == ReferenceOpinion.Stage.FULL_TEXT:
            qs = qs.filter(in_full_text=True)

        status_field = (
            "full_text_status"
            if stage == ReferenceOpinion.Stage.FULL_TEXT
            else "screening_status"
        )

        if review and review.is_blinded:
            # Blinded: each reviewer sees only their own effective status.
            user_opinions = ReferenceOpinion.objects.filter(
                reference=OuterRef("pk"),
                member__user=user,
                stage=stage,
            ).values("status")[:1]
            qs = qs.annotate(
                effective_status=Subquery(user_opinions, output_field=CharField())
            )
        else:
            qs = qs.annotate(effective_status=F(status_field))

        opinions_qs = (
            ReferenceOpinion.objects.filter(stage=stage)
            .select_related("member__user", "reason")
            .only(
                "id",
                "status",
                "stage",
                "updated_at",
                "member__id",
                "member__user__first_name",
                "member__user__last_name",
                "member__user__email",
                "reason__name",
            )
        )

        return qs.prefetch_related(
            Prefetch(
                "referenceopinion_set",
                queryset=opinions_qs,
                to_attr="prefetched_opinions",
            )
        ).distinct()

    def get_base_queryset_for_counts(self):
        """
        Scope the aggregation base queryset to the references visible at this
        screening stage (excludes duplicates; full-text: only in_full_text).
        """
        stage = getattr(self, "stage", ReferenceOpinion.Stage.SCREENING)
        base = super().get_base_queryset_for_counts()
        base = base.exclude(
            duplicate_status__in=[
                Reference.DuplicateStatus.DELETED,
                Reference.DuplicateStatus.UNRESOLVED,
            ]
        )
        if stage == ReferenceOpinion.Stage.FULL_TEXT:
            base = base.filter(in_full_text=True)
        return base

    @extend_schema(
        summary="Sidebar filter counts for the screening view",
        responses={200: OpenApiResponse(description="Aggregated counts dict")},
    )
    @action(detail=False, methods=["get"], url_path="filter-counts")
    def filter_counts(self, request, *args, **kwargs):
        """Return sidebar aggregation counts for the screening stage."""
        review = self.get_review()
        if not review:
            return Response({"error": "review parameter required"}, status=400)

        base_qs = self.get_base_queryset_for_counts()
        aggregations = ReferenceAggregationService.build(
            base_qs,
            request.user,
            include_duplicate_status=False,  # not meaningful during screening
        )
        return Response(aggregations)


# ===========================================================================
# ReviewDataViewSet
# ===========================================================================


class ReviewDataViewSet(
    ReviewQuerysetMixin,
    mixins.ListModelMixin,
    viewsets.GenericViewSet,
):
    """
    Paginated list of all references for a review.

    Used by the "Review Data" page which shows every reference (regardless of
    screening stage) with rich filter and sort capabilities.

    Endpoints
    ---------
    GET  /?review=<id>              — paginated reference list
    GET  /filter-counts/?review=<id> — sidebar aggregation counts
    GET  /export/?review=<id>       — BibTeX export of filtered references
    """

    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        django_filters_backend.DjangoFilterBackend,
        drf_filters.OrderingFilter,
    ]
    filterset_class = ReferenceFilter
    pagination_class = ReferencePagination
    ordering_fields = ["title", "authors", "publication_date"]
    ordering = ["title"]

    def get_queryset(self):
        return self.get_base_queryset()

    @extend_schema(
        summary="List references with pagination",
        parameters=[
            OpenApiParameter(
                name="review", required=True, type=int, description="Review ID."
            ),
        ],
        responses={200: OpenApiResponse(description="Paginated reference list.")},
    )
    def list(self, request, *args, **kwargs):
        """
        Return a paginated reference list plus ``total_count`` / ``filtered_count``
        for the header display ("Showing X of Y").
        """
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review parameter required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.filter_queryset(self.get_queryset())

        total_count = self.get_base_queryset_for_counts().count()
        filtered_count = queryset.count()

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["total_count"] = total_count
            response.data["filtered_count"] = filtered_count
            return response

        # Fallback path when pagination is disabled (e.g. in tests).
        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "references": serializer.data,
                "total_count": total_count,
                "filtered_count": filtered_count,
            }
        )

    @extend_schema(
        summary="Sidebar filter counts (unfiltered)",
        parameters=[
            OpenApiParameter(
                name="review", required=True, type=int, description="Review ID."
            ),
        ],
        responses={
            200: OpenApiResponse(description="Aggregated sidebar filter counts.")
        },
    )
    @action(detail=False, methods=["get"], url_path="filter-counts")
    def filter_counts(self, request, *args, **kwargs):
        """
        Return sidebar aggregation counts computed from the *unfiltered* base
        queryset so the sidebar always shows global counts.

        Fetched once on page load, not on every sort or page change.
        """
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review parameter required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        base_qs = self.get_base_queryset_for_counts()
        aggregations = ReferenceAggregationService.build(base_qs, request.user)
        return Response(aggregations)

    @extend_schema(
        summary="Export filtered references as BibTeX",
        parameters=[
            OpenApiParameter(
                name="review", required=True, type=int, description="Review ID."
            ),
        ],
        responses={200: OpenApiResponse(description="BibTeX file attachment.")},
    )
    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        """Export the currently filtered references as a ``references.bib`` file."""
        queryset = self.filter_queryset(self.get_queryset())
        bib_content = self._references_to_bibtex(queryset)

        response = HttpResponse(bib_content, content_type="application/x-bibtex")
        response["Content-Disposition"] = 'attachment; filename="references.bib"'
        return response

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _bibtex_str(value) -> str:
        return "" if value is None else str(value)

    def _references_to_bibtex(self, references) -> str:
        """Render a queryset of References as a BibTeX string."""
        import bibtexparser

        entries = []
        for ref in references:
            cite_key = (
                ref.doi.replace("/", "_") if ref.doi else f"{ref.review_id}_{ref.id}"
            )
            entry = {
                "ENTRYTYPE": "article",
                "ID": cite_key,
                "author": self._bibtex_str(ref.authors),
                "title": self._bibtex_str(ref.title),
                "journal": self._bibtex_str(ref.journal),
                "year": self._bibtex_str(
                    ref.publication_date.year if ref.publication_date else ""
                ),
            }
            if ref.doi:
                entry["doi"] = ref.doi
            if ref.url:
                entry["url"] = ref.url
            if hasattr(ref, "prefetched_labels") and ref.prefetched_labels:
                entry["keywords"] = ", ".join(
                    rl.label.name for rl in ref.prefetched_labels
                )
            entries.append(entry)

        bib_database = bibtexparser.bibdatabase.BibDatabase()
        bib_database.entries = entries
        return bibtexparser.dumps(bib_database)


# ===========================================================================
# Screening subclasses
# ===========================================================================


class ScreeningViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    """
    Reference list for the abstract-screening stage.

    Inherits all filtering, pagination, and export from ``ReviewDataViewSet``
    and adds:
    - Duplicate exclusion.
    - Opinion-status filtering via ``ScreeningFilter``.
    - ``effective_status`` annotation for blinded reviews.
    - ``filter-counts`` action scoped to the screening stage.
    """

    filterset_class = ScreeningFilter
    stage = ReferenceOpinion.Stage.SCREENING

    def get_queryset(self):
        return self.apply_screening(super().get_queryset(), stage=self.stage)


class ScreeningFullTextViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    """Full-text screening stage — only ``in_full_text=True`` references."""

    filterset_class = ScreeningFilter
    stage = ReferenceOpinion.Stage.FULL_TEXT

    def get_queryset(self):
        return self.apply_screening(super().get_queryset(), stage=self.stage)


# ===========================================================================
# UploadedPDFViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List uploaded PDFs"),
    retrieve=extend_schema(summary="Retrieve an uploaded PDF"),
    create=extend_schema(summary="Upload a PDF for later matching"),
    destroy=extend_schema(summary="Delete an uploaded PDF"),
)
class UploadedPDFViewSet(viewsets.ModelViewSet):
    """
    Manage uploaded PDFs that are awaiting attachment to references.

    On creation the view:
    1. Saves the file.
    2. Derives the display name from the filename (without extension).
    3. Extracts the DOI from the first page of the PDF (if present) to enable
       DOI-based auto-matching later.

    Requires UPLOAD_FILES permission (owner / collaborator).
    """

    serializer_class = UploadedPDFSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """Return only PDFs belonging to reviews the user is a member of."""
        return UploadedPDF.objects.filter(
            review__members__user=self.request.user
        ).distinct()

    def perform_create(self, serializer):
        review = serializer.validated_data["review"]
        check_permission(Permission.UPLOAD_FILES, self.request.user, review)

        instance = serializer.save()

        # Derive display name from the filename (strip extension).
        base_name = os.path.basename(instance.file.name)
        instance.name = os.path.splitext(base_name)[0]

        # Attempt to extract a DOI from the first page for later matching.
        instance.doi = self._extract_doi(instance.file.path)
        instance.save()

    @staticmethod
    def _extract_doi(file_path: str) -> str | None:
        """
        Return the first DOI found on the first page of the PDF, or None.

        Uses PyMuPDF to extract text; silently ignores any extraction errors
        (e.g. encrypted PDFs, corrupt files) so that a failed DOI extraction
        never blocks an upload.
        """
        doi_pattern = r"10\.\d{4,9}/[-._;()/:A-Z0-9]+"
        try:
            doc = pymupdf.open(file_path)
            if len(doc) > 0:
                text = doc[0].get_text()
                match = re.search(doi_pattern, text, re.I)
                if match:
                    return match.group(0)
        except Exception:
            pass
        return None


# ===========================================================================
# LabelViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(summary="List the current user's labels"),
    create=extend_schema(summary="Create a label"),
    update=extend_schema(summary="Update a label"),
    partial_update=extend_schema(summary="Partially update a label"),
    destroy=extend_schema(summary="Delete a label"),
)
class LabelViewSet(viewsets.ModelViewSet):
    """
    Manage user-owned labels.

    All review members may create and manage their own labels.  Labels are
    personal and not shared between users.  The ``assign-to-references`` action
    applies or removes labels across multiple references in a single call.
    """

    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Label.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        """Inject the current user so clients cannot create labels for others."""
        serializer.save(user=self.request.user)

    @extend_schema(
        summary="Apply / remove labels across multiple references",
        request=AssignLabelsSerializer,
        responses={
            200: AssignLabelsResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=False, methods=["post"], url_path="assign-to-references")
    def assign_to_references(self, request):
        """
        Batch label operation.

        - ``checked_label_ids``       — ensure these labels are applied to every reference.
        - ``indeterminate_label_ids`` — remove these labels from every reference.

        All validation (membership, reference ownership, label ownership) is
        handled by ``AssignLabelsSerializer.validate()``.
        """
        serializer = AssignLabelsSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        member = serializer.validated_data["member"]
        references = serializer.validated_data["references"]
        labels_map = serializer.validated_data["labels"]
        checked_ids = serializer.validated_data["checked_ids"]
        indeterminate_ids = serializer.validated_data["indeterminate_ids"]
        review = serializer.validated_data["review"]

        created_count = deleted_count = 0

        with transaction.atomic():
            for ref in references:
                for label_id in checked_ids:
                    _, created = ReferenceLabel.objects.get_or_create(
                        reference=ref,
                        label=labels_map[label_id],
                        member=member,
                    )
                    if created:
                        created_count += 1

            deleted_count, _ = ReferenceLabel.objects.filter(
                reference__review=review,
                reference__in=references,
                label_id__in=indeterminate_ids,
                member=member,
            ).delete()

        return Response(
            AssignLabelsResponseSerializer(
                {
                    "detail": "Labels updated for references.",
                    "created": created_count,
                    "deleted": deleted_count,
                }
            ).data,
            status=status.HTTP_200_OK,
        )


# ===========================================================================
# ReasonViewSet
# ===========================================================================


class ReasonViewSet(viewsets.ModelViewSet):
    """
    CRUD for exclusion reasons.

    ``?review=<id>`` is required for the list action.  Create requires
    MODIFY_REASON permission (owner / collaborator / reviewer).
    """

    serializer_class = ReasonSerializer
    permission_classes = [IsAuthenticated]
    queryset = Reason.objects.all()

    def _get_review(self):
        review_id = self.request.query_params.get("review")
        if not review_id:
            raise serializers.ValidationError(
                {"review": "This query parameter is required."}
            )
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.ACCESS_REVIEW, self.request.user, review)
        return review

    def get_queryset(self):
        if self.action == "list":
            review = self._get_review()
            return Reason.objects.filter(review=review)
        return super().get_queryset()

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.MODIFY_REASON, self.request.user, review)
        serializer.save(review=review)


# ===========================================================================
# ReferenceOpinionViewSet
# ===========================================================================


class ReferenceOpinionViewSet(viewsets.GenericViewSet):
    """
    Manage screening opinions.

    - ``PUT /update/``        — update a single opinion (get-or-create then partial update).
    - ``POST /bulk-upsert/``  — upsert opinions for multiple references at once.

    After every write ``Reference.update_opinion_statuses()`` is called to keep
    the denormalised ``screening_status`` / ``full_text_status`` fields in sync.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceOpinionSerializer
    queryset = ReferenceOpinion.objects.all()

    def _get_review_member(self, user, review) -> ReviewMember:
        return get_object_or_404(ReviewMember, review=review, user=user)

    def get_object(self) -> ReferenceOpinion:
        """Get or create the opinion for the reference in the request body."""
        reference_id = self.request.data.get("reference")
        if not reference_id:
            raise serializers.ValidationError({"reference": "This field is required."})

        reference = get_object_or_404(Reference, pk=reference_id)
        check_permission(Permission.MODIFY_OPINION, self.request.user, reference.review)
        review_member = self._get_review_member(self.request.user, reference.review)

        opinion, _ = ReferenceOpinion.objects.get_or_create(
            reference=reference,
            member=review_member,
        )
        return opinion

    @extend_schema(
        summary="Update a single reference opinion",
        request=ReferenceOpinionSerializer,
        responses={200: ReferenceOpinionSerializer},
    )
    def update(self, request, *args, **kwargs):
        """Partial-update the requesting user's opinion on a single reference."""
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        summary="Bulk upsert reference opinions",
        request=ReferenceOpinionUpsertSerializer,
        responses={200: ReferenceOpinionSerializer(many=True)},
    )
    @action(detail=False, methods=["post"], url_path="bulk-upsert")
    @transaction.atomic
    def bulk_upsert(self, request):
        """
        Upsert opinions for multiple references in a single transaction.

        Steps:
        1. Validate the request with ``ReferenceOpinionUpsertSerializer``.
        2. Load all referenced Review objects and check permissions once per review.
        3. Split into ``to_create`` and ``to_update`` lists.
        4. ``bulk_create`` + ``bulk_update`` in a single DB round-trip each.
        5. Call ``update_opinion_statuses`` to sync the denormalised fields.
        """
        serializer = ReferenceOpinionUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reference_ids = data["reference_ids"]
        status_value = data["status"]
        stage_value = data["stage"]
        reason_value = data.get("reason")
        user = request.user

        # Reason only applies to exclusions.
        if status_value != ReferenceOpinionStatus.EXCLUDED:
            reason_value = None

        references = Reference.objects.filter(id__in=reference_ids).select_related(
            "review"
        )

        if references.count() != len(reference_ids):
            missing = set(reference_ids) - {r.id for r in references}
            raise serializers.ValidationError(
                {"reference_ids": f"References not found: {missing}"}
            )

        if reason_value:
            review_ids = {ref.review_id for ref in references}
            if reason_value.review_id not in review_ids:
                raise serializers.ValidationError(
                    {"reason": "Reason must belong to the same review."}
                )

        # Resolve members + check permissions once per review.
        review_members: dict[Review, ReviewMember] = {}
        for ref in references:
            review = ref.review
            if review not in review_members:
                check_permission(Permission.MODIFY_OPINION, user, review)
                review_members[review] = self._get_review_member(user, review)

        existing_opinions = {
            op.reference_id: op
            for op in ReferenceOpinion.objects.filter(
                reference_id__in=reference_ids,
                member__in=review_members.values(),
                stage=stage_value,
            )
        }

        to_create, to_update = [], []
        for ref in references:
            review_member = review_members[ref.review]
            if ref.id in existing_opinions:
                op = existing_opinions[ref.id]
                op.status = status_value
                op.reason = reason_value
                to_update.append(op)
            else:
                to_create.append(
                    ReferenceOpinion(
                        reference=ref,
                        member=review_member,
                        status=status_value,
                        stage=stage_value,
                        reason=reason_value,
                    )
                )

        if to_create:
            ReferenceOpinion.objects.bulk_create(to_create)
        if to_update:
            ReferenceOpinion.objects.bulk_update(to_update, ["status", "reason"])

        # Sync denormalised status fields.
        Reference.update_opinion_statuses(
            reference_ids=reference_ids, stage=stage_value
        )

        opinions = ReferenceOpinion.objects.filter(
            reference_id__in=reference_ids,
            member__in=review_members.values(),
            stage=stage_value,
        )
        return Response(self.get_serializer(opinions, many=True).data)


# ===========================================================================
# DuplicateClusterViewSet
# ===========================================================================


@extend_schema_view(
    list=extend_schema(
        summary="List duplicate clusters",
        description="Returns clusters with progress metadata. Defaults to unresolved clusters.",
        responses={200: ClusterListResponseSerializer},
    ),
    retrieve=extend_schema(
        summary="Retrieve a single cluster",
        responses={200: DuplicateClusterSerializer},
    ),
)
class DuplicateClusterViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to duplicate clusters.

    Clusters are created exclusively by Celery tasks (never via direct API
    writes).  Write operations are limited to:

    - ``POST /{id}/resolve/``  — manually resolve by choosing a canonical ref.
    - ``POST /{id}/dismiss/``  — dismiss as a false positive.
    - ``GET  /stats/``         — aggregate counts for the review dashboard.

    Default ordering: DOI-matched clusters first, then by descending similarity
    score, then by creation date.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DuplicateClusterSerializer
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_class = DuplicateClusterFilter

    def get_queryset(self):
        """Return clusters for reviews the user belongs to, with members prefetched."""
        user = self.request.user
        member_review_ids = ReviewMember.objects.filter(user=user).values_list(
            "review_id", flat=True
        )
        member_prefetch = Prefetch(
            "members",
            queryset=ReferenceClusterMember.objects.select_related(
                "reference__search_method"
            ).order_by("-completeness_score"),
        )
        return (
            ReferenceCluster.objects.filter(review_id__in=member_review_ids)
            .prefetch_related(member_prefetch)
            .select_related("review")
            .order_by("-doi_match", "-max_similarity_score", "created_at")
        )

    def list(self, request, *args, **kwargs):
        """
        Return clusters plus review-level progress metadata (total / resolved /
        remaining / progress %) so the frontend can render a progress bar.

        Defaults to unresolved clusters when ``?status=`` is not supplied.
        """
        qs = self.filter_queryset(self.get_queryset())
        if "status" not in request.query_params:
            qs = qs.filter(status=ReferenceCluster.Status.UNRESOLVED)

        review_id = request.query_params.get("review")
        total = resolved = remaining = 0

        if review_id:
            all_qs = ReferenceCluster.objects.filter(review_id=review_id)
            total = all_qs.count()
            resolved = all_qs.filter(
                status__in=[
                    ReferenceCluster.Status.AUTO_RESOLVED,
                    ReferenceCluster.Status.MANUALLY_RESOLVED,
                    ReferenceCluster.Status.DISMISSED,
                ]
            ).count()
            remaining = all_qs.filter(status=ReferenceCluster.Status.UNRESOLVED).count()

        serializer = self.get_serializer(qs, many=True)
        return Response(
            ClusterListResponseSerializer(
                {
                    "clusters": serializer.data,
                    "total": total,
                    "resolved": resolved,
                    "remaining": remaining,
                    "progress": round(resolved / total * 100, 1) if total > 0 else 0,
                }
            ).data
        )

    @extend_schema(
        summary="Manually resolve a cluster",
        request=None,
        responses={
            200: ResolveClusterResponseSerializer,
            400: OpenApiResponse(
                description="Already resolved or invalid canonical ID"
            ),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        """
        Resolve a cluster by nominating the canonical reference.

        Request body (camelCase — converted by djangorestframework-camelcase)::

            { "canonicalReferenceId": <int> }

        The nominated reference must be a member of the cluster.
        """
        cluster = self.get_object()

        member = self._require_duplicate_permission(cluster)
        if isinstance(member, Response):
            return member

        if cluster.status != ReferenceCluster.Status.UNRESOLVED:
            return Response(
                {"error": f"Cluster is already '{cluster.status}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        canonical_reference_id = request.data.get("canonical_reference_id")
        if not canonical_reference_id:
            return Response(
                {"error": "canonicalReferenceId is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not cluster.members.filter(reference_id=canonical_reference_id).exists():
            return Response(
                {"error": "canonicalReferenceId is not a member of this cluster"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        manager = DuplicateClusterManager(cluster.review)
        manager.manually_resolve(
            cluster,
            canonical_reference_id=int(canonical_reference_id),
            resolved_by=member,
        )
        logger.info(
            "Cluster %s resolved by member %s, canonical=%s",
            cluster.id,
            member.id,
            canonical_reference_id,
        )

        return Response(
            ResolveClusterResponseSerializer(
                {
                    "message": "Cluster resolved",
                    "clusterId": str(cluster.id),
                    "canonicalReferenceId": canonical_reference_id,
                }
            ).data
        )

    @extend_schema(
        summary="Dismiss a cluster as a false positive",
        responses={
            200: DismissClusterResponseSerializer,
            400: OpenApiResponse(description="Already resolved"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=True, methods=["post"], url_path="dismiss")
    def dismiss(self, request, pk=None):
        """
        Mark a cluster as dismissed (false positive).

        All member references are restored to ``NOT_DUPLICATE``.
        """
        cluster = self.get_object()

        member = self._require_duplicate_permission(cluster)
        if isinstance(member, Response):
            return member

        if cluster.status != ReferenceCluster.Status.UNRESOLVED:
            return Response(
                {"error": f"Cluster is already '{cluster.status}'"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        cluster.status = ReferenceCluster.Status.DISMISSED
        cluster.resolved_at = timezone.now()
        cluster.resolved_by = member
        cluster.save(update_fields=["status", "resolved_at", "resolved_by"])

        Reference.objects.filter(cluster_memberships__cluster=cluster).update(
            duplicate_status=Reference.DuplicateStatus.NOT_DUPLICATE
        )

        logger.info("Cluster %s dismissed by member %s", cluster.id, member.id)

        return Response(
            DismissClusterResponseSerializer(
                {
                    "message": "Cluster dismissed",
                    "clusterId": str(cluster.id),
                }
            ).data
        )

    @extend_schema(
        summary="Aggregate cluster counts for the dashboard",
        parameters=[
            OpenApiParameter(
                name="review", required=True, type=int, description="Review ID."
            )
        ],
        responses={200: ClusterStatsResponseSerializer},
    )
    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Return counts per cluster status plus the number of affected references."""
        review_id = request.query_params.get("review")
        if not review_id:
            return Response(
                {"error": "review query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not ReviewMember.objects.filter(
            review_id=review_id, user=request.user
        ).exists():
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        counts = (
            ReferenceCluster.objects.filter(review_id=review_id)
            .values("status")
            .annotate(count=Count("id"))
        )
        count_map = {row["status"]: row["count"] for row in counts}

        affected_refs = (
            ReferenceClusterMember.objects.filter(
                cluster__review_id=review_id,
                cluster__status=ReferenceCluster.Status.UNRESOLVED,
            )
            .values("reference_id")
            .distinct()
            .count()
        )

        return Response(
            ClusterStatsResponseSerializer(
                {
                    "unresolved": count_map.get(ReferenceCluster.Status.UNRESOLVED, 0),
                    "autoResolved": count_map.get(
                        ReferenceCluster.Status.AUTO_RESOLVED, 0
                    ),
                    "manuallyResolved": count_map.get(
                        ReferenceCluster.Status.MANUALLY_RESOLVED, 0
                    ),
                    "dismissed": count_map.get(ReferenceCluster.Status.DISMISSED, 0),
                    "affectedReferences": affected_refs,
                }
            ).data
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _require_duplicate_permission(self, cluster) -> "ReviewMember | Response":
        """
        Return the member if they have MANAGE_DUPLICATES permission, else a
        403 Response.
        """
        try:
            member = ReviewMember.objects.get(
                review=cluster.review, user=self.request.user
            )
            if member.role not in PERMISSIONS[Permission.MANAGE_DUPLICATES]:
                return permission_denied_message(Permission.MANAGE_DUPLICATES)
            return member
        except ReviewMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )


# ===========================================================================
# KeywordViewSet
# ===========================================================================


class KeywordViewSet(viewsets.ModelViewSet):
    """
    CRUD for inclusion / exclusion keywords.

    ``?review=<id>`` scopes the list to a specific review.
    Write operations require MODIFY_KEYWORD permission (owner / collaborator /
    reviewer).
    """

    serializer_class = KeywordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review", "type"]

    def get_queryset(self):
        queryset = Keyword.objects.filter(review__members__user=self.request.user)
        review_id = self.request.query_params.get("review")
        if review_id:
            queryset = queryset.filter(review_id=review_id)
        return queryset.distinct()

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        if not review_id:
            raise PermissionDenied("Review must be provided.")
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.MODIFY_KEYWORD, self.request.user, review)
        serializer.save(review=review)

    def perform_update(self, serializer):
        check_permission(
            Permission.MODIFY_KEYWORD,
            self.request.user,
            self.get_object().review,
        )
        serializer.save()

    def perform_destroy(self, instance):
        check_permission(Permission.MODIFY_KEYWORD, self.request.user, instance.review)
        instance.delete()


# ===========================================================================
# NoteViewSet
# ===========================================================================


class NoteViewSet(viewsets.ModelViewSet):
    """
    CRUD + bulk-create for reviewer notes.

    Blinded reviews: members can only read their own notes (enforced in both
    ``get_object`` and the queryset).  Write access requires MODIFY_NOTE
    permission (owner / collaborator / reviewer).
    """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["reference"]

    def get_object(self):
        obj = super().get_object()
        review = obj.reference.review
        user = self.request.user

        if not ReviewMember.objects.filter(review=review, user=user).exists():
            raise PermissionDenied("You do not have access to this note.")

        if review.is_blinded and obj.member.user != user:
            raise PermissionDenied("You cannot access this note.")

        return obj

    def get_queryset(self):
        user = self.request.user
        queryset = Note.objects.filter(reference__review__members__user=user)

        reference_id = self.request.query_params.get("reference")
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)

        # In blinded reviews only show the user's own notes.
        queryset = queryset.exclude(
            reference__review__is_blinded=True
        ) | queryset.filter(reference__review__is_blinded=True, member__user=user)

        return queryset.distinct().select_related("member", "member__user", "reference")

    def perform_create(self, serializer):
        reference_id = self.request.data.get("reference")
        if not reference_id:
            raise PermissionDenied("Reference must be provided.")

        reference = get_object_or_404(Reference, pk=reference_id)
        check_permission(Permission.MODIFY_NOTE, self.request.user, reference.review)

        member = get_object_or_404(
            ReviewMember, review=reference.review, user=self.request.user
        )
        serializer.save(member=member, reference=reference)

    @extend_schema(
        summary="Bulk create notes across multiple references",
        request=BulkCreateNoteSerializer,
        responses={
            201: BulkCreateNoteResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """Create an identical note on each of the supplied references."""
        serializer = BulkCreateNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_ids = serializer.validated_data["reference_ids"]
        content = serializer.validated_data["content"]

        references = Reference.objects.filter(id__in=reference_ids).select_related(
            "review"
        )

        if references.count() != len(reference_ids):
            raise PermissionDenied("One or more references do not exist.")

        notes = []
        for reference in references:
            check_permission(Permission.MODIFY_NOTE, request.user, reference.review)
            member = ReviewMember.objects.filter(
                review=reference.review, user=request.user
            ).first()
            if not member:
                raise PermissionDenied(
                    f"No permission for review {reference.review_id}"
                )
            notes.append(Note(member=member, reference=reference, content=content))

        with transaction.atomic():
            Note.objects.bulk_create(notes)

        return Response(
            BulkCreateNoteResponseSerializer({"created": len(notes)}).data,
            status=status.HTTP_201_CREATED,
        )
