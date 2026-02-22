import logging

import bibtexparser
from django.core.exceptions import PermissionDenied
from django.db import transaction
from django.db.models import Count, F, Prefetch
from django.db.models.functions import ExtractYear
from django.http import HttpResponse
from django_filters import rest_framework as filters
from rest_framework import mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.models import Code
from slrt_project.permissions import Permission, check_permission
from slrt_project.references.api.filters import ReferenceFilter
from slrt_project.references.api.serializers import (
    AssignLabelsSerializer,
    AssignReferencesSerializer,
    AttachPDFsSerializer,
    BulkCreateNoteSerializer,
    KeywordSerializer,
    LabelSerializer,
    NoteSerializer,
    ReasonSerializer,
    ReferenceDuplicatePairSerializer,
    ReferenceOpinionSerializer,
    ReferenceOpinionUpsertSerializer,
    ReferenceSerializer,
    UploadedPDFSerializer,
)
from slrt_project.references.models import (
    Keyword,
    Label,
    Note,
    Reason,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
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
    filter_backends = [filters.DjangoFilterBackend]
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


class ReviewQuerysetMixin:
    """
    Handles:
    - Review permission checks
    - Base reference queryset
    - Label prefetching
    """

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

        qs = Reference.objects.select_related(
            "assignee",
            "search_method",
            "review",
        )

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
        review = self.get_review()
        return (
            Reference.objects.filter(review=review)
            if review
            else Reference.objects.none()
        )


class ScreeningQuerysetMixin:
    """
    Screening-specific queryset modifications.
    """

    def apply_screening(self, qs, full_text=None, stage=None):
        user = self.request.user
        review = self.get_review()

        opinions_qs = ReferenceOpinion.objects.filter(stage=stage)

        if review and review.is_blinded:
            opinions_qs = opinions_qs.filter(member__user=user)

        opinions_qs = opinions_qs.select_related("member__user", "reason").only(
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

        qs = qs.exclude(duplicate_status__in=["Undecided", "Deleted"])

        if full_text is not None:
            qs = qs.filter(in_full_text=full_text)

        return qs.prefetch_related(
            Prefetch(
                "referenceopinion_set",
                queryset=opinions_qs,
                to_attr="prefetched_opinions",
            )
        ).distinct()


class ReferenceAggregationService:
    @staticmethod
    def build(reference_qs, user, review):
        base_qs = reference_qs.filter(review=review)

        return {
            "search_methods": (
                SearchMethod.objects.filter(review=review)
                .annotate(count=Count("reference"))
                .values("id", "name", "count")
            ),
            "duplicate_status_counts": dict(
                base_qs.values("duplicate_status")
                .annotate(count=Count("id"))
                .values_list("duplicate_status", "count")
            ),
            "labels": (
                Label.objects.filter(
                    user=user,
                    reference_labels__reference__review=review,
                )
                .annotate(count=Count("reference_labels__reference"))
                .values("id", "name", "count")
            ),
            "publication_types": (
                base_qs.exclude(publication_type="")
                .values("publication_type")
                .annotate(count=Count("id"))
                .order_by("-count")
            ),
            "publication_years": (
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


class ReviewDataViewSet(
    ReviewQuerysetMixin, mixins.ListModelMixin, viewsets.GenericViewSet
):
    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ReferenceFilter

    def get_queryset(self):
        return self.get_base_queryset()

    def list(self, request, *args, **kwargs):
        review = self.get_review()
        if not review:
            return Response(
                {"error": "review parameter required"},
                status=400,
            )

        queryset = self.filter_queryset(self.get_queryset())

        total_count = self.get_base_queryset_for_counts().count()
        filtered_count = queryset.count()

        serializer = self.get_serializer(queryset, many=True)

        aggregations = ReferenceAggregationService.build(
            queryset,
            request.user,
            review,
        )

        return Response(
            {
                "references": serializer.data,
                "total_count": total_count,
                "filtered_count": filtered_count,
                **aggregations,
            }
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request, *args, **kwargs):
        """
        Export filtered references as a BibTeX file using bibtexparser.
        """
        queryset = self.filter_queryset(self.get_queryset())

        bib_content = self._references_to_bibtex(queryset)

        response = HttpResponse(bib_content, content_type="application/x-bibtex")
        response["Content-Disposition"] = 'attachment; filename="references.bib"'
        return response

    def _bibtex_str(self, value):
        if value is None:
            return ""
        return str(value)

    def _references_to_bibtex(self, references):
        """
        Convert a queryset of Reference objects into a BibTeX string using bibtexparser.
        """
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

            # add labels if prefetched
            if hasattr(ref, "prefetched_labels") and ref.prefetched_labels:
                labels = ", ".join(
                    [ref_label.label.name for ref_label in ref.prefetched_labels]
                )
                entry["keywords"] = labels

            entries.append(entry)

        bib_database = bibtexparser.bibdatabase.BibDatabase()
        bib_database.entries = entries

        return bibtexparser.dumps(bib_database)


class ScreeningViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    def get_queryset(self):
        return self.apply_screening(
            super().get_queryset(),
            stage=ReferenceOpinion.Stage.SCREENING,
        )

    def get_base_queryset_for_counts(self):
        return self.apply_screening(
            super().get_base_queryset_for_counts(),
            stage=ReferenceOpinion.Stage.SCREENING,
        )


class ScreeningFullTextViewSet(ScreeningQuerysetMixin, ReviewDataViewSet):
    def get_queryset(self):
        return self.apply_screening(
            super().get_queryset(),
            full_text=True,
            stage=ReferenceOpinion.Stage.FULL_TEXT,
        )

    def get_base_queryset_for_counts(self):
        return self.apply_screening(
            super().get_base_queryset_for_counts(),
            full_text=True,
            stage=ReferenceOpinion.Stage.FULL_TEXT,
        )


class UploadedPDFViewSet(viewsets.ModelViewSet):
    """Only owner/collaborator can upload PDFs"""

    serializer_class = UploadedPDFSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return UploadedPDF.objects.filter(review__members__user=user).distinct()

    def perform_create(self, serializer):
        review = serializer.validated_data["review"]
        user = self.request.user

        check_permission(Permission.UPLOAD_FILES, user, review)

        serializer.save()


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
        if status_value != ReferenceOpinion.Status.EXCLUDED:
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

        opinions = ReferenceOpinion.objects.filter(
            reference_id__in=reference_ids,
            member__in=review_members.values(),
            stage=stage_value,
        )

        response_serializer = self.get_serializer(opinions, many=True)
        return Response(response_serializer.data)


class ReferenceDuplicatePairViewSet(viewsets.ViewSet):
    """
    ViewSet to handle reference duplicate detection and resolution.
    - Detect: run duplicate detection (owner and collaborator)
    - List: retrieve duplicate pairs (all members)
    - Resolve: resolve duplicates (owner and collaborator)
    """

    permission_classes = [IsAuthenticated]

    def _get_review(self, require_manage_duplicates=False):
        review = get_object_or_404(Review, pk=self.request.query_params.get("review"))

        if require_manage_duplicates:
            check_permission(Permission.MANAGE_DUPLICATES, self.request.user, review)

        else:
            check_permission(Permission.ACCESS_REVIEW, self.request.user, review)

        return review

    def list(self, request):
        """All members can view duplicates"""
        review = self._get_review(require_manage_duplicates=False)

        qs = ReferenceDuplicatePair.objects.filter(review=review)
        total = qs.count()
        resolved = qs.filter(resolved=True).count()
        remaining = total - resolved

        pair = qs.filter(resolved=False).first()
        if not pair:
            return Response(
                {
                    "detail": "No reference duplicate pair found.",
                    "total": total,
                    "resolved": resolved,
                    "remaining": 0,
                    "progress": 100,
                },
                status=status.HTTP_200_OK,
            )

        serializer = ReferenceDuplicatePairSerializer(pair)

        return Response(
            {
                "pair": serializer.data,
                "total": total,
                "resolved": resolved,
                "remaining": remaining,
                "current_index": resolved + 1,
                "progress": round((resolved / total) * 100, 1) if total else 0,
            }
        )

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Only owner and collaborator can resolve duplicates"""
        duplicate_pair = get_object_or_404(ReferenceDuplicatePair, pk=pk)

        # Check if user is owner or collaborator of the review
        check_permission(
            Permission.MANAGE_DUPLICATES, request.user, duplicate_pair.review
        )

        try:
            selection = int(request.data.get("selection"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Selection must be an integer (1, 2, or 3)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reference_1 = duplicate_pair.reference1
        reference_2 = duplicate_pair.reference2

        if selection == 1:
            self.set_duplicate_statuses(reference_1, "Resolved", reference_2, "Deleted")
        elif selection == 2:
            self.set_duplicate_statuses(reference_1, "Deleted", reference_2, "Resolved")
        elif selection == 3:
            self.set_duplicate_statuses(
                reference_1, "Not Duplicate", reference_2, "Not Duplicate"
            )
        else:
            return Response(
                {"detail": "Invalid selection. Must be 1, 2, or 3."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate_pair.resolved = True
        duplicate_pair.save(update_fields=["resolved"])
        return Response(
            {"detail": "Reference duplicate resolved successfully."},
            status=status.HTTP_200_OK,
        )

    def set_duplicate_statuses(self, reference_1, status_1, reference_2, status_2):
        reference_1.duplicate_status = status_1
        reference_1.save(update_fields=["duplicate_status"])

        reference_2.duplicate_status = status_2
        reference_2.save(update_fields=["duplicate_status"])


class KeywordViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Keywords:
    - Filter by review via query param: ?review=ID
    - Permissions: owner/collaborator/reviewer can create/update/delete, viewer can only view
    """

    serializer_class = KeywordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review", "is_inclusive"]

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
    filter_backends = [filters.DjangoFilterBackend]
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
