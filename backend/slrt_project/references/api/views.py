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
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.models import Code
from slrt_project.permissions import (
    PERMISSIONS,
    Permission,
    check_permission,
    permission_denied_message,
)
from slrt_project.references.api.filters import (
    DuplicateClusterFilter,
    ReferenceFilter,
    ScreeningFilter,
)
from slrt_project.references.api.serializers import (
    AssignLabelsSerializer,
    AssignReferencesSerializer,
    AttachPDFsSerializer,
    AutoMatchSerializer,
    BulkCreateNoteSerializer,
    DuplicateClusterSerializer,
    KeywordSerializer,
    LabelSerializer,
    NoteSerializer,
    ReasonSerializer,
    ReferenceOpinionSerializer,
    ReferenceOpinionUpsertSerializer,
    ReferenceSerializer,
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
from slrt_project.references.tasks import sync_single_reference_pdf
from slrt_project.reviews.models import Review, ReviewMember, SearchMethod


logger = logging.getLogger(__name__)


class ReferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for References:
    - list, retrieve, update
    - Access restricted to review members
    - Blinded review handling
    """

    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """
        Returns references the user has access to.

        - Blinded review: only current user's opinions
        - Non-blinded: all opinions
        """
        user = self.request.user
        review_id = self.request.query_params.get("review")

        queryset = Reference.objects.all()
        review = None

        # Get the review and enforce access
        if review_id:
            review = get_object_or_404(Review, pk=review_id)
            check_permission(Permission.ACCESS_REVIEW, user, review)
            queryset = queryset.filter(review=review)
        else:
            queryset = queryset.filter(review__members__user=user)

        # Build opinions queryset
        if review and review.is_blinded:
            # Blinded → only current user's opinions
            opinions_qs = ReferenceOpinion.objects.filter(
                member__user=user
            ).select_related("member__user")
        else:
            # Not blinded → all opinions
            opinions_qs = ReferenceOpinion.objects.select_related("member__user")

        # Prefetch and return
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
        """
        Only allow update if user can modify content (owner/collaborator/reviewer).
        """
        reference = self.get_object()
        review = reference.review

        check_permission(Permission.MODIFY_REFERENCE, self.request.user, review)

        serializer.save()

    @action(
        detail=False,
        methods=["post"],
        url_path="attach-pdfs",
    )
    def attach_pdfs(self, request):
        """Only owner/collaborator can attach PDFs"""
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

                # Permission check - owner or collaborator
                check_permission(Permission.UPLOAD_FILES, user, reference.review)

                if uploaded_pdf.review_id != reference.review_id:
                    raise serializers.ValidationError(
                        "Uploaded PDF and reference must belong to the same review."
                    )

                # Delete all codes associated with this reference
                Code.objects.filter(reference=reference).delete()

                # Move file
                reference.file = uploaded_pdf.file
                reference.save(update_fields=["file"])

                # Keep the PDF ID for frontend cache removal
                updated.append(
                    {
                        "id": reference.id,
                        "file": reference.file.url if reference.file else None,
                        "uploaded_pdf_id": uploaded_pdf.id,
                    }
                )

                ids_to_delete.append(uploaded_pdf.pk)

            # Delete uploaded PDFs bypassing django cleanup
            UploadedPDF.objects.filter(pk__in=ids_to_delete)._raw_delete(
                using="default"
            )

        return Response({"updated_references": updated}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="auto-match")
    def auto_match(self, request):
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
            return Response({"matched": [], "unmatched": reference_ids})

        uploaded_pdfs = UploadedPDF.objects.filter(review=review)

        matched_reference_ids = []

        with transaction.atomic():
            # DOI MATCH (Single Bulk Update)
            doi_pdf_subquery = uploaded_pdfs.filter(doi__iexact=OuterRef("doi")).values(
                "file"
            )[:1]

            references.exclude(doi__isnull=True).exclude(doi="").update(
                file=Subquery(doi_pdf_subquery)
            )

            matched_reference_ids.extend(
                Reference.objects.filter(id__in=reference_ids)
                .exclude(file__isnull=True)
                .values_list("id", flat=True)
            )

            # EXACT NORMALIZED NAME MATCH
            remaining_refs = Reference.objects.filter(
                id__in=reference_ids,
                file__isnull=True,
            )

            name_pdf_subquery = (
                uploaded_pdfs.annotate(normalized_name=Lower(ImmutableUnaccent("name")))
                .filter(normalized_name=Lower(ImmutableUnaccent(OuterRef("title"))))
                .values("file")[:1]
            )

            remaining_refs.update(file=Subquery(name_pdf_subquery))

            matched_reference_ids = list(
                Reference.objects.filter(id__in=reference_ids)
                .exclude(file__isnull=True)
                .values_list("id", flat=True)
            )

            # TRIGRAM MATCH (Highest Similarity)
            remaining_refs = Reference.objects.filter(
                id__in=reference_ids,
                file__isnull=True,
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

            remaining_refs.update(file=Subquery(trigram_subquery))

            # Collect final matched IDs
            matched_reference_ids = list(
                Reference.objects.filter(id__in=reference_ids)
                .exclude(file__isnull=True)
                .values_list("id", flat=True)
            )

            # DELETE USED UPLOADED PDFs
            used_files = Reference.objects.filter(
                id__in=matched_reference_ids
            ).values_list("file", flat=True)

            used_pdfs = UploadedPDF.objects.filter(review=review, file__in=used_files)
            used_pdfs.update(file="")  # django-cleanup skips empty file fields
            used_pdfs.delete()

        return Response(
            {
                "matched": len(matched_reference_ids),
                "unmatched": len(set(reference_ids) - set(matched_reference_ids)),
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"])
    def bulk_sync_pdfs(self, request):
        """Start bulk PDF sync for multiple references"""
        reference_ids = request.data.get("reference_ids", [])

        if not reference_ids:
            return Response(
                {"error": "No reference IDs provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tasks = []
        for ref_id in reference_ids:
            task = sync_single_reference_pdf.delay(ref_id)
            tasks.append({"reference_id": ref_id, "task_id": task.id})

        return Response(
            {"message": f"Started sync for {len(tasks)} references", "tasks": tasks},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(
        detail=False,
        methods=["post"],
        url_path="assign",
    )
    def assign(self, request):
        """Only owner can assign references"""
        serializer = AssignReferencesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        review_id = serializer.validated_data["review"]
        reference_ids = serializer.validated_data["reference_ids"]
        reference_ids = list(set(reference_ids))
        mode = serializer.validated_data["mode"]
        assignee_id = serializer.validated_data.get("assignee_id")

        review = get_object_or_404(Review, pk=review_id)

        # Only owner can assign
        check_permission(Permission.INVITE, user, review)

        references = Reference.objects.filter(
            id__in=reference_ids,
            review=review,
        )

        # Get all review members
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
            {"detail": "References updated successfully"},
            status=status.HTTP_200_OK,
        )


# ── Pagination ────────────────────────────────────────────────────────────────


class ReferencePagination(LimitOffsetPagination):
    """
    Standard limit/offset pagination.

    Frontend passes ?limit=50&offset=0 for page 1,
    ?limit=50&offset=50 for page 2, etc.

    Infinite scroll: fetch next page when the user scrolls near the bottom,
    append results to the existing list.
    """

    default_limit = 50
    max_limit = 200

    def get_paginated_response(self, data):
        return Response(
            {
                "references": data,
                "count": self.count,  # total matching references
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


# ── Aggregation service ────────────────────────────────────────────────────────


class ReferenceAggregationService:
    """
    Computes sidebar filter counts from a base queryset scoped to a review.

    Deliberately NOT filtered by the user's current filter selection —
    the sidebar should always show global counts so users know what's
    available before they apply filters.
    """

    @staticmethod
    def build(
        base_qs,
        user,
        include_duplicate_status: bool = True,
        include_extraction_counts: bool = False,
    ):
        result = {
            "search_methods": list(
                SearchMethod.objects.filter(reference__in=base_qs)
                .annotate(count=Count("reference", filter=Q(reference__in=base_qs)))
                .values("id", "name", "count")
            ),
            "labels": list(
                Label.objects.filter(
                    user=user,
                    reference_labels__reference__in=base_qs,  # ← scoped
                )
                .annotate(
                    count=Count(
                        "reference_labels__reference",
                        filter=Q(reference_labels__reference__in=base_qs),
                    )
                )
                .values("id", "name", "count")
            ),
            "duplicate_status_counts": dict(
                base_qs.values("duplicate_status")
                .annotate(count=Count("id"))
                .values_list("duplicate_status", "count")
            ),
            "publication_types": list(
                base_qs.exclude(publication_type="")
                .values("publication_type")
                .annotate(count=Count("id"))
                .order_by("-count")
            ),
            "publication_years": list(
                base_qs.filter(publication_date__isnull=False)
                .annotate(year=ExtractYear("publication_date"))
                .values("year")
                .annotate(count=Count("id"))
                .order_by("-year")
            ),
            "file_counts": {
                "with_file": base_qs.exclude(file="").count(),
                "without_file": base_qs.filter(file="").count(),
            },
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


# ── ReviewQuerysetMixin ────────────────────────────────────────────────────────


class ReviewQuerysetMixin:
    def get_review(self):
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
        user = self.request.user
        review = self.get_review()

        qs = Reference.objects.select_related("assignee", "search_method", "review")
        if review:
            qs = qs.filter(review=review)
        else:
            qs = qs.filter(review__members__user=user)
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
        """Unfiltered queryset used for aggregation counts."""
        review = self.get_review()
        return (
            Reference.objects.filter(review=review)
            if review
            else Reference.objects.none()
        )


# ── ScreeningQuerysetMixin ─────────────────────────────────────────────────────


class ScreeningQuerysetMixin:
    def apply_screening(self, qs, stage=None):
        user = self.request.user
        review = self.get_review()
        if stage is None:
            stage = ReferenceOpinion.Stage.SCREENING

        qs = qs.exclude(duplicate_status__in=["Undecided", "Deleted"])

        if stage == ReferenceOpinion.Stage.FULL_TEXT:
            qs = qs.filter(in_full_text=True)

        status_field = (
            "full_text_status"
            if stage == ReferenceOpinion.Stage.FULL_TEXT
            else "screening_status"
        )

        if review and review.is_blinded:
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
        """Scopes counts to the references visible at this screening stage."""
        stage = getattr(self, "stage", ReferenceOpinion.Stage.SCREENING)
        base = super().get_base_queryset_for_counts()  # plain review queryset
        base = base.exclude(duplicate_status__in=["Undecided", "Deleted"])
        if stage == ReferenceOpinion.Stage.FULL_TEXT:
            base = base.filter(in_full_text=True)
        return base

    @action(detail=False, methods=["get"], url_path="filter-counts")
    def filter_counts(self, request, *args, **kwargs):
        review = self.get_review()
        if not review:
            return Response({"error": "review parameter required"}, status=400)

        base_qs = self.get_base_queryset_for_counts()
        aggregations = ReferenceAggregationService.build(
            base_qs,
            request.user,
            include_duplicate_status=False,  # meaningless at screening stage
        )
        return Response(aggregations)


# ── ReviewDataViewSet ──────────────────────────────────────────────────────────


class ReviewDataViewSet(
    ReviewQuerysetMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [
        django_filters_backend.DjangoFilterBackend,
        drf_filters.OrderingFilter,
    ]
    filterset_class = ReferenceFilter
    pagination_class = ReferencePagination

    # Expose these fields for ?ordering= query param.
    # Prefix with "-" for descending: ?ordering=-publication_date
    ordering_fields = ["title", "authors", "publication_date"]
    ordering = ["title"]  # default sort

    def get_queryset(self):
        return self.get_base_queryset()

    def list(self, request, *args, **kwargs):
        """
        Returns paginated references only.
        totalCount and filteredCount are included for the header display.
        Sidebar aggregation data is fetched separately via /filter-counts/.
        """
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review parameter required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.filter_queryset(self.get_queryset())

        # Counts for the top header ("Showing X of Y")
        total_count = self.get_base_queryset_for_counts().count()
        filtered_count = queryset.count()

        # Paginate
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            response = self.get_paginated_response(serializer.data)
            response.data["total_count"] = total_count
            response.data["filtered_count"] = filtered_count
            return response

        # Fallback (pagination disabled)
        serializer = self.get_serializer(queryset, many=True)
        return Response(
            {
                "references": serializer.data,
                "total_count": total_count,
                "filtered_count": filtered_count,
            }
        )

    @action(detail=False, methods=["get"], url_path="filter-counts")
    def filter_counts(self, request, *args, **kwargs):
        """
        Returns sidebar filter aggregation data.

        Always computed from the *unfiltered* base queryset so that sidebar
        counts always reflect the full dataset — not just what's currently
        visible after the user's filters are applied.

        This endpoint is fetched ONCE when the page loads and whenever
        the review changes, not on every sort/page change.
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

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        """Export filtered references as BibTeX (no pagination)."""
        queryset = self.filter_queryset(self.get_queryset())
        bib_content = self._references_to_bibtex(queryset)

        response = HttpResponse(bib_content, content_type="application/x-bibtex")
        response["Content-Disposition"] = 'attachment; filename="references.bib"'
        return response

    def _bibtex_str(self, value):
        return "" if value is None else str(value)

    def _references_to_bibtex(self, references):
        import bibtexparser

        entries = []
        for ref in references:
            cite_key = (
                ref.doi.replace("/", "_") if ref.doi else f"{ref.review.id}_{ref.id}"
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


# ── Screening subclasses (unchanged interface) ─────────────────────────────────


class ScreeningViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    filterset_class = ScreeningFilter
    stage = ReferenceOpinion.Stage.SCREENING

    def get_queryset(self):
        return self.apply_screening(super().get_queryset(), stage=self.stage)


class ScreeningFullTextViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    filterset_class = ScreeningFilter
    stage = ReferenceOpinion.Stage.FULL_TEXT

    def get_queryset(self):
        return self.apply_screening(super().get_queryset(), stage=self.stage)


class UploadedPDFViewSet(viewsets.ModelViewSet):
    """Only owner/collaborator can upload PDFs"""

    serializer_class = UploadedPDFSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        user = self.request.user
        return UploadedPDF.objects.filter(review__members__user=user).distinct()

    def perform_create(self, serializer):
        review = serializer.validated_data["review"]
        user = self.request.user

        check_permission(Permission.UPLOAD_FILES, user, review)

        # Save first to get file path
        instance = serializer.save()

        # Extract filename without extension
        base_name = os.path.basename(instance.file.name)
        name_without_ext = os.path.splitext(base_name)[0]
        instance.name = name_without_ext

        # Extract DOI from first page
        doi = self.extract_doi(instance.file.path)
        instance.doi = doi

        # Save updated fields
        instance.save()

    def extract_doi(self, file_path):
        doi_pattern = r"10\.\d{4,9}/[-._;()/:A-Z0-9]+"

        try:
            doc = pymupdf.open(file_path)
            if len(doc) > 0:
                text = doc[0].get_text()  # first page only
                match = re.search(doi_pattern, text, re.I)
                if match:
                    return match.group(0)
        except Exception:
            pass

        return None


class LabelViewSet(viewsets.ModelViewSet):
    """All members can create and manage their own labels"""

    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Label.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["post"], url_path="assign-to-references")
    def assign_to_references(self, request):
        serializer = AssignLabelsSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)

        member = serializer.validated_data["member"]
        references = serializer.validated_data["references"]
        labels_map = serializer.validated_data["labels"]
        checked_ids = serializer.validated_data["checked_ids"]
        indeterminate_ids = serializer.validated_data["indeterminate_ids"]
        review = serializer.validated_data["review"]

        created_count = 0

        with transaction.atomic():
            # Create labels
            for ref in references:
                for label_id in checked_ids:
                    obj, created = ReferenceLabel.objects.get_or_create(
                        reference=ref,
                        label=labels_map[label_id],
                        member=member,
                    )
                    if created:
                        created_count += 1

            # Delete labels
            deleted_count, _ = ReferenceLabel.objects.filter(
                reference__review=review,
                reference__in=references,
                label_id__in=indeterminate_ids,
                member=member,
            ).delete()

        return Response(
            {
                "detail": "Labels updated for references.",
                "created": created_count,
                "deleted": deleted_count,
            },
            status=status.HTTP_200_OK,
        )


class ReasonViewSet(viewsets.ModelViewSet):
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


class ReferenceOpinionViewSet(viewsets.GenericViewSet):
    """
    ViewSet to manage a member's opinion on a reference.
    All review members except viewers can create/update opinions.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceOpinionSerializer
    queryset = ReferenceOpinion.objects.all()

    def _get_review_member(self, user, review):
        return get_object_or_404(
            ReviewMember,
            review=review,
            user=user,
        )

    def get_object(self):
        reference_id = self.request.data.get("reference")

        if not reference_id:
            raise serializers.ValidationError({"reference": "This field is required."})

        reference = get_object_or_404(Reference, pk=reference_id)
        review = reference.review
        user = self.request.user

        # Access control - not viewers
        check_permission(Permission.MODIFY_OPINION, user, review)

        review_member = self._get_review_member(user, review)

        opinion, _ = ReferenceOpinion.objects.get_or_create(
            reference=reference,
            member=review_member,
        )
        return opinion

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-upsert")
    @transaction.atomic
    def bulk_upsert(self, request):
        serializer = ReferenceOpinionUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        reference_ids = data["reference_ids"]
        status_value = data["status"]
        stage_value = data["stage"]
        reason_value = data.get("reason")
        user = request.user

        # Normalize reason: only allowed when excluded
        if status_value != ReferenceOpinionStatus.EXCLUDED:
            reason_value = None

        references = Reference.objects.filter(id__in=reference_ids).select_related(
            "review"
        )
        if references.count() != len(reference_ids):
            missing_ids = set(reference_ids) - {ref.id for ref in references}
            raise serializers.ValidationError(
                {"reference_ids": f"References not found: {missing_ids}"}
            )

        # Validate reason belongs to same review
        if reason_value:
            review_ids = {ref.review_id for ref in references}
            if reason_value.review_id not in review_ids:
                raise serializers.ValidationError(
                    {"reason": "Reason must belong to the same review."}
                )

        # Resolve members + permissions
        review_members = {}
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
                opinion = existing_opinions[ref.id]
                opinion.status = status_value
                opinion.reason = reason_value
                to_update.append(opinion)
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
            ReferenceOpinion.objects.bulk_update(
                to_update,
                ["status", "reason"],
            )

        Reference.update_opinion_statuses(
            reference_ids=reference_ids, stage=stage_value
        )

        opinions = ReferenceOpinion.objects.filter(
            reference_id__in=reference_ids,
            member__in=review_members.values(),
            stage=stage_value,
        )

        response_serializer = self.get_serializer(opinions, many=True)
        return Response(response_serializer.data)


class DuplicateClusterViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ReadOnlyModelViewSet — clusters are created only by Celery tasks,
    never directly via API. Write operations are custom actions.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = DuplicateClusterSerializer
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_class = DuplicateClusterFilter

    def get_queryset(self):
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
        Returns all clusters for a review with progress metadata.
        """
        qs = self.filter_queryset(self.get_queryset())

        # Default to unresolved clusters
        if "status" not in request.query_params:
            qs = qs.filter(status=ReferenceCluster.Status.UNRESOLVED)

        # Progress metadata scoped to the review
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
            {
                "clusters": serializer.data,
                "total": total,
                "resolved": resolved,
                "remaining": remaining,
                "progress": round(resolved / total * 100, 1) if total > 0 else 0,
            }
        )

    @action(detail=True, methods=["post"], url_path="resolve")
    def resolve(self, request, pk=None):
        """
        Manually resolve a cluster by choosing which reference to keep.

        Body: { canonicalReferenceId: int }
        (djangorestframework-camelcase converts this to canonical_reference_id)
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

        # djangorestframework-camelcase has already parsed canonicalReferenceId → canonical_reference_id
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
            f"Cluster {cluster.id} resolved by member {member.id}, "
            f"canonical={canonical_reference_id}"
        )

        return Response(
            {
                "message": "Cluster resolved",
                "clusterId": str(cluster.id),
                "canonicalReferenceId": canonical_reference_id,
            }
        )

    @action(detail=True, methods=["post"], url_path="dismiss")
    def dismiss(self, request, pk=None):
        """
        Dismiss a cluster as a false positive.
        Restores all member references to NOT_DUPLICATE.
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

        logger.info(f"Cluster {cluster.id} dismissed by member {member.id}")

        return Response({"message": "Cluster dismissed", "clusterId": str(cluster.id)})

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """
        Aggregate cluster counts for the dashboard.
        Requires: ?review=<id>
        """
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
            {
                "unresolved": count_map.get(ReferenceCluster.Status.UNRESOLVED, 0),
                "autoResolved": count_map.get(ReferenceCluster.Status.AUTO_RESOLVED, 0),
                "manuallyResolved": count_map.get(
                    ReferenceCluster.Status.MANUALLY_RESOLVED, 0
                ),
                "dismissed": count_map.get(ReferenceCluster.Status.DISMISSED, 0),
                "affectedReferences": affected_refs,
            }
        )

    def _require_duplicate_permission(self, cluster) -> ReviewMember | Response:
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


class KeywordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Keywords:
    - Filter by review via query param: ?review=ID
    - Permissions: owner/collaborator/reviewer can create/update/delete, viewer can only view
    """

    serializer_class = KeywordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["review", "type"]

    def get_queryset(self):
        """
        Returns keywords for reviews the user has access to.
        """
        queryset = Keyword.objects.all()
        review_id = self.request.query_params.get("review")

        if review_id:
            queryset = queryset.filter(review_id=review_id)

        # Only include keywords for reviews user has access to
        queryset = queryset.filter(review__members__user=self.request.user)

        return queryset.distinct()

    def perform_create(self, serializer):
        """
        Save a new keyword. Only owner/collaborator/reviewer can create.
        """
        review_id = self.request.data.get("review")
        if not review_id:
            raise PermissionDenied("Review must be provided.")

        review = get_object_or_404(Review, pk=review_id)

        check_permission(Permission.MODIFY_KEYWORD, self.request.user, review)

        serializer.save(review=review)

    def perform_update(self, serializer):
        """Only owner/collaborator/reviewer can update"""
        keyword = self.get_object()
        check_permission(Permission.MODIFY_KEYWORD, self.request.user, keyword.review)
        serializer.save()

    def perform_destroy(self, instance):
        """Only owner/collaborator/reviewer can delete"""
        check_permission(Permission.MODIFY_KEYWORD, self.request.user, instance.review)
        instance.delete()


class NoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Notes with:
    - All review members except viewers can create notes
    - Blinded review handling (can only see own notes if blinded)
    """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [django_filters_backend.DjangoFilterBackend]
    filterset_fields = ["reference"]

    def get_object(self):
        obj = super().get_object()
        review = obj.reference.review
        user = self.request.user

        # Check review access
        if not ReviewMember.objects.filter(review=review, user=user).exists():
            raise PermissionDenied("You do not have access to this note.")

        # Blinded review: only author can see
        if review.is_blinded and obj.member.user != user:
            raise PermissionDenied("You cannot access this note.")

        return obj

    def get_queryset(self):
        """
        Returns notes the user has access to.
        """
        user = self.request.user

        queryset = Note.objects.filter(reference__review__members__user=user)

        reference_id = self.request.query_params.get("reference")
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)

        # Blinded reviews: only own notes
        queryset = queryset.exclude(
            reference__review__is_blinded=True
        ) | queryset.filter(
            reference__review__is_blinded=True,
            member__user=user,
        )

        return queryset.distinct().select_related(
            "member",
            "member__user",
            "reference",
        )

    def perform_create(self, serializer):
        """
        All review members except viewers can create notes.
        """
        reference_id = self.request.data.get("reference")
        if not reference_id:
            raise PermissionDenied("Reference must be provided.")

        reference = get_object_or_404(Reference, pk=reference_id)
        review = reference.review

        # Check if user is not a viewer
        check_permission(Permission.MODIFY_NOTE, self.request.user, review)

        member = get_object_or_404(
            ReviewMember,
            review=review,
            user=self.request.user,
        )

        serializer.save(
            member=member,
            reference=reference,
        )

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """All members except viewers can bulk create notes"""
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
            review = reference.review

            # Check if user is not a viewer
            check_permission(Permission.MODIFY_NOTE, request.user, review)

            member = ReviewMember.objects.filter(
                review=review,
                user=request.user,
            ).first()

            if not member:
                raise PermissionDenied(f"No permission for review {review.id}")

            notes.append(
                Note(
                    member=member,
                    reference=reference,
                    content=content,
                )
            )

        with transaction.atomic():
            Note.objects.bulk_create(notes)

        return Response(
            {"created": len(notes)},
            status=status.HTTP_201_CREATED,
        )
