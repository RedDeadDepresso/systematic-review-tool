import json
import logging
import os
import tempfile
from urllib.parse import urlencode

from django.core.files.base import ContentFile
from django.db.models import (
    Case,
    Count,
    Exists,
    IntegerField,
    OuterRef,
    Q,
    Subquery,
    Value,
    When,
)
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    extend_schema_view,
)
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.models import MainTheme
from slrt_project.references.models import (
    Reference,
    ReferenceCluster,
    ReferenceLabel,
    ReferenceOpinion,
    ReferenceOpinionStatus,
)
from slrt_project.reviews.api.filters import ReviewFilter
from slrt_project.reviews.api.serializers import (
    # Action / response serializers
    AddDataResponseSerializer,
    AddDataSerializer,
    ArticleCountSerializer,
    AutoResolveDuplicatesRequestSerializer,
    AutoResolveDuplicatesResponseSerializer,
    DetectDuplicatesRequestSerializer,
    DetectDuplicatesResponseSerializer,
    ExportJsonResponseSerializer,
    ExportLatexResponseSerializer,
    InvitationAcceptDeclineResponseSerializer,
    OpinionStatsSerializer,
    PrismaResponseSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewMemberSerializer,
    ReviewSerializer,
    ScreeningCriteriaSerializer,
    ScreeningStatSerializer,
    SearchMethodDetailSerializer,
    SearchMethodSerializer,
    UploadReferencesResponseSerializer,
)
from slrt_project.reviews.models import (
    Review,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
)
from slrt_project.reviews.tasks import (
    auto_deduplicate_task,
    detect_duplicates_task,
    import_references_task,
)
from slrt_project.reviews.utils import strip_ansi
from slrt_project.shared.permissions import (
    PERMISSIONS,
    IsReviewOwner,
    Permission,
    check_permission,
    permission_denied_message,
)
from vendor.prisma_flow_diagram.prisma import Prisma2020Diagram, plot_prisma2020_new
from vendor.prisma_flow_diagram.validation import _human_issue


logger = logging.getLogger(__name__)

# File extensions accepted by the upload-references endpoint.
_ALLOWED_UPLOAD_EXTENSIONS = {".bib", ".ris", ".xml"}
_EXT_TO_FILE_TYPE = {".bib": "bib", ".ris": "ris", ".xml": "endnote"}


# ReviewViewSet
@extend_schema_view(
    list=extend_schema(
        summary="List reviews",
        description="Returns all reviews the authenticated user is a member of.",
        responses={200: ReviewListSerializer(many=True)},
    ),
    retrieve=extend_schema(
        summary="Retrieve a review",
        responses={200: ReviewSerializer},
    ),
    create=extend_schema(
        summary="Create a review",
        description="Creates a new review and assigns the creator as Owner.",
        responses={201: ReviewSerializer},
    ),
    update=extend_schema(
        summary="Update a review (owner only)",
        responses={200: ReviewSerializer},
    ),
    partial_update=extend_schema(
        summary="Partially update a review (owner only)",
        responses={200: ReviewSerializer},
    ),
    destroy=extend_schema(
        summary="Delete a review (owner only)",
        responses={204: None},
    ),
)
class ReviewViewSet(viewsets.ModelViewSet):
    """
    CRUD for Review objects plus custom actions for members, screening,
    duplicate detection, data promotion, and exports.
    """

    permission_classes = [IsAuthenticated]
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = ReviewFilter

    # Queryset / serializer selection

    def get_queryset(self):
        user = self.request.user
        base_qs = Review.objects.filter(members__user=user).distinct()

        # Reusable correlated subqueries.
        owner_membership = ReviewMember.objects.filter(
            review=OuterRef("pk"), role=ReviewMember.Role.OWNER
        )
        user_membership = ReviewMember.objects.filter(review=OuterRef("pk"), user=user)
        # A non-empty ``file`` on a SearchMethod means an import is in progress;
        # suppress the count until the file is deleted after a successful import.
        search_method_pending = SearchMethod.objects.filter(
            review=OuterRef("pk"), file__gt=""
        )

        if self.action == "list":
            return base_qs.annotate(
                owner_first_name=Subquery(
                    owner_membership.values("user__first_name")[:1]
                ),
                owner_last_name=Subquery(
                    owner_membership.values("user__last_name")[:1]
                ),
                owner_email=Subquery(owner_membership.values("user__email")[:1]),
                user_role=Subquery(user_membership.values("role")[:1]),
                reference_count=Case(
                    When(Exists(search_method_pending), then=Value(None)),
                    default=Count("reference", distinct=True),
                    output_field=IntegerField(),
                ),
            )

        # Detail view — adds duplicate-detection counters.
        return base_qs.annotate(
            user_role=Subquery(user_membership.values("role")[:1]),
            user_member_id=Subquery(user_membership.values("id")[:1]),
            reference_count=Case(
                When(Exists(search_method_pending), then=Value(None)),
                default=Count("reference", distinct=True),
                output_field=IntegerField(),
            ),
            duplicate_resolved_count=Count(
                "reference",
                filter=Q(
                    reference__duplicate_status=Reference.DuplicateStatus.RESOLVED
                ),
                distinct=True,
            ),
            duplicate_not_duplicate_count=Count(
                "reference",
                filter=Q(
                    reference__duplicate_status=Reference.DuplicateStatus.NOT_DUPLICATE
                ),
                distinct=True,
            ),
            duplicate_deleted_count=Count(
                "reference",
                filter=Q(reference__duplicate_status=Reference.DuplicateStatus.DELETED),
                distinct=True,
            ),
            # Cluster counts are only meaningful once detection has completed.
            duplicate_clusters_count=Case(
                When(
                    duplicate_detection_status=Review.DuplicateDetectionStatus.COMPLETED,
                    then=Count("duplicate_clusters", distinct=True),
                ),
                default=Value(None),
                output_field=IntegerField(),
            ),
            duplicate_clusters_unresolved_count=Case(
                When(
                    duplicate_detection_status=Review.DuplicateDetectionStatus.COMPLETED,
                    then=Count(
                        "duplicate_clusters",
                        filter=Q(
                            duplicate_clusters__status=ReferenceCluster.Status.UNRESOLVED
                        ),
                        distinct=True,
                    ),
                ),
                default=Value(None),
                output_field=IntegerField(),
            ),
        )

    def get_serializer_class(self):
        if self.action == "list":
            return ReviewListSerializer
        return ReviewSerializer

    def get_permissions(self):
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsReviewOwner()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Save the new review and assign the creator as Owner."""
        review = serializer.save()
        ReviewMember.objects.create(
            review=review,
            user=self.request.user,
            role=ReviewMember.Role.OWNER,
        )

    # Read-only custom actions

    @extend_schema(
        summary="List review members",
        responses={200: ReviewMemberSerializer(many=True)},
    )
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """Return all members of a review with nested user details."""
        review = self.get_object()
        qs = ReviewMember.objects.filter(review=review).select_related("user")
        return Response(
            ReviewMemberSerializer(qs, many=True, context={"request": request}).data
        )

    @extend_schema(
        summary="Screening time stats per member",
        description="When the review is blinded, only the requesting user's stats are returned.",
        responses={200: ScreeningStatSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="screening-stats")
    def screening_stats(self, request, pk=None):
        review = self.get_object()
        qs = ScreeningStat.objects.filter(member__review=review).select_related(
            "member__user"
        )
        if review.is_blinded:
            qs = qs.filter(member__user=request.user)
        return Response(
            ScreeningStatSerializer(qs.order_by("-seconds"), many=True).data
        )

    @extend_schema(
        summary="Opinion stats — screening stage",
        responses={200: OpinionStatsSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="screening-opinions")
    def screening_opinions(self, request, pk=None):
        review = self.get_object()
        data = review.compute_opinion_stats(
            ReferenceOpinion.Stage.SCREENING, request.user
        )
        return Response(OpinionStatsSerializer(data, many=True).data)

    @extend_schema(
        summary="Opinion stats — full-text stage",
        responses={200: OpinionStatsSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="full-text-opinions")
    def full_text_opinions(self, request, pk=None):
        review = self.get_object()
        data = review.compute_opinion_stats(
            ReferenceOpinion.Stage.FULL_TEXT, request.user
        )
        return Response(OpinionStatsSerializer(data, many=True).data)

    @extend_schema(
        summary="Article counts by opinion status",
        parameters=[
            OpenApiParameter(
                name="stage",
                description="Filter opinions by stage (e.g. 'screening', 'full_text').",
                required=False,
                type=str,
            )
        ],
        responses={200: ArticleCountSerializer},
    )
    @action(detail=True, methods=["get"], url_path="article-counts")
    def article_counts(self, request, pk=None):
        """
        Return per-member opinion counts (included / maybe / labeled) plus a
        per-label breakdown for the requesting user.
        """
        review = self.get_object()
        stage = request.query_params.get("stage")
        member = get_object_or_404(ReviewMember, review=review, user=request.user)

        opinion_filter = Q(referenceopinion__member=member)
        if stage:
            opinion_filter &= Q(referenceopinion__stage=stage)

        counts = Reference.objects.filter(review=review).aggregate(
            included=Count(
                "referenceopinion",
                filter=opinion_filter
                & Q(referenceopinion__status=ReferenceOpinionStatus.INCLUDED),
                distinct=True,
            ),
            maybe=Count(
                "referenceopinion",
                filter=opinion_filter
                & Q(referenceopinion__status=ReferenceOpinionStatus.MAYBE),
                distinct=True,
            ),
            labeled=Count("labels", filter=Q(labels__member=member), distinct=True),
        )

        label_qs = (
            ReferenceLabel.objects.filter(reference__review=review, member=member)
            .values("label__id", "label__name", "label__color")
            .annotate(count=Count("reference", distinct=True))
            .order_by("label__name")
        )

        counts["labels"] = [
            {
                "id": row["label__id"],
                "name": row["label__name"],
                "color": row["label__color"],
                "count": row["count"],
            }
            for row in label_qs
        ]

        return Response(ArticleCountSerializer(counts).data)

    @extend_schema(
        summary="List search methods for a review",
        responses={200: SearchMethodDetailSerializer(many=True)},
    )
    @action(detail=True, methods=["get"], url_path="search-methods")
    def search_methods(self, request, pk=None):
        review = self.get_object()
        qs = SearchMethod.objects.filter(review=review)
        return Response(SearchMethodDetailSerializer(qs, many=True).data)

    # Write custom actions

    @extend_schema(
        summary="Upload a reference file (BibTeX / RIS / EndNote XML)",
        description=(
            "Saves the file to a new SearchMethod and enqueues an async import task. "
            "Accepts .bib, .ris, and .xml files."
        ),
        responses={
            202: UploadReferencesResponseSerializer,
            400: OpenApiResponse(description="Missing or invalid file"),
            403: OpenApiResponse(description="Permission denied"),
            500: OpenApiResponse(description="Internal error saving file"),
        },
    )
    @action(detail=True, methods=["post"], url_path="upload-references")
    def upload_references(self, request, pk=None):
        """
        Accept a BibTeX (.bib), RIS (.ris), or EndNote XML (.xml) file,
        persist it as a SearchMethod, and dispatch an async import task.
        """
        review = self.get_object()
        check_permission(Permission.UPLOAD_FILES, request.user, review)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        _, ext = os.path.splitext(uploaded_file.name)
        ext = ext.lower()
        if ext not in _ALLOWED_UPLOAD_EXTENSIONS:
            return Response(
                {
                    "error": "Invalid file type. Please upload a .bib, .ris, or .xml (EndNote) file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        member = get_object_or_404(ReviewMember, review=review, user=request.user)

        search_method = self._create_search_method(review, uploaded_file)
        if isinstance(search_method, Response):
            return search_method

        file_type = _EXT_TO_FILE_TYPE[ext]
        task = import_references_task.delay(
            review_id=review.id,
            member_id=member.id,
            search_method_id=search_method.id,
            file_type=file_type,
        )
        logger.info(
            "Started import task %s for SearchMethod %s", task.id, search_method.id
        )

        payload = {
            "message": "File uploaded successfully. Processing in background...",
            "task_id": task.id,
            "search_method_id": search_method.id,
            "filename": uploaded_file.name,
            "file_type": file_type,
            "status": "processing",
        }
        return Response(
            UploadReferencesResponseSerializer(payload).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Promote references to another stage",
        request=AddDataSerializer,
        responses={
            200: AddDataResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=True, methods=["post"], url_path="add-data")
    def add_data(self, request, pk=None):
        """
        Move references matching the supplied criteria from one stage to
        another.
        """
        review = self.get_object()
        check_permission(Permission.ADD_DATA, request.user, review)

        serializer = AddDataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        member = get_object_or_404(ReviewMember, review=review, user=request.user)
        refs = self._filter_refs_for_add_data(review, member, data)

        if data["data_sink"] == "full-text":
            refs.update(in_full_text=True)
        elif data["data_sink"] == "extraction":
            refs.update(in_extraction=True)

        return Response(AddDataResponseSerializer({"updated": refs.count()}).data)

    @extend_schema(
        summary="Generate a PRISMA 2020 flow diagram",
        responses={
            200: PrismaResponseSerializer,
            403: OpenApiResponse(description="Permission denied"),
            500: OpenApiResponse(description="Diagram generation failed"),
        },
    )
    @action(detail=True, methods=["post"], url_path="prisma")
    def prisma(self, request, pk=None):
        """
        Compute PRISMA 2020 counts, render a PNG diagram, persist it on the
        Review model, and return the file URL, an interactive-diagram URL, and
        any validation warnings.
        """
        review = self.get_object()
        check_permission(Permission.ACCESS_REVIEW, request.user, review)

        prisma_data = self._build_prisma_data(review)

        try:
            diagram = Prisma2020Diagram(
                db_registers=prisma_data["db_registers"],
                included=prisma_data["included"],
            )
            validation_issues = diagram.validate()

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
                tmp_path = tmp.name

            try:
                plot_prisma2020_new(
                    db_registers=prisma_data["db_registers"],
                    included=prisma_data["included"],
                    filename=tmp_path,
                    validation="off",
                )
                with open(tmp_path, "rb") as f:
                    fname = f"prisma_{review.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.png"
                    review.prisma_file.save(fname, ContentFile(f.read()), save=True)
            finally:
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            response_data = {
                "message": "PRISMA diagram generated successfully",
                "file_url": (
                    request.build_absolute_uri(review.prisma_file.url)
                    if review.prisma_file
                    else None
                ),
                "interactive_url": self._build_prisma_url(prisma_data),
                "data": prisma_data,
                "validation_issues": [
                    {"severity": strip_ansi(sev), "message": strip_ansi(msg)}
                    for sev, msg in [_human_issue(i) for i in validation_issues]
                ],
            }
            return Response(PrismaResponseSerializer(response_data).data)

        except Exception as exc:
            logger.exception("PRISMA generation failed for review %s", review.id)
            return Response(
                {"error": f"Failed to generate PRISMA diagram: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @extend_schema(
        summary="Export themes as JSON",
        parameters=[
            OpenApiParameter(
                name="download", type=bool, description="Return as file attachment."
            ),
            OpenApiParameter(
                name="pretty",
                type=bool,
                description="Pretty-print JSON (default true).",
            ),
        ],
        responses={200: ExportJsonResponseSerializer},
    )
    @action(detail=True, methods=["get"], url_path="export-json")
    def export_json(self, request, pk=None):
        """
        Export the requesting user's themes, subthemes, and codes as JSON.
        Pass ``?download=true`` to receive a file attachment.
        """
        review = self.get_object()
        check_permission(Permission.ACCESS_REVIEW, request.user, review)

        export_data = self._build_themes_export(review, request.user)

        if request.query_params.get("download") == "true":
            pretty = request.query_params.get("pretty", "true") == "true"
            json_str = json.dumps(
                export_data, indent=2 if pretty else None, ensure_ascii=False
            )
            response = HttpResponse(
                json_str, content_type="application/json; charset=utf-8"
            )
            response["Content-Disposition"] = (
                f'attachment; filename="themes_review_{review.id}.json"'
            )
            return response

        return Response(ExportJsonResponseSerializer(export_data).data)

    @extend_schema(
        summary="Export themes as LaTeX",
        parameters=[
            OpenApiParameter(
                name="download", type=bool, description="Return as .tex attachment."
            ),
            OpenApiParameter(
                name="format",
                type=str,
                enum=["table_only", "full_document"],
                description="Output format.",
            ),
        ],
        responses={200: ExportLatexResponseSerializer},
    )
    @action(detail=True, methods=["get", "post"], url_path="export-latex")
    def export_latex(self, request, pk=None):
        """
        Export themes as a LaTeX table.  Supports preview (JSON) and
        file-download modes.  POST body may include ``format`` and ``theme_ids``.
        """
        review = self.get_object()
        check_permission(Permission.ACCESS_REVIEW, request.user, review)

        is_download = request.query_params.get("download") == "true"

        if request.method == "POST":
            export_format = request.data.get("format", "table_only")
            theme_ids = request.data.get("theme_ids")
        else:
            export_format = request.query_params.get(
                "format", "full_document" if is_download else "table_only"
            )
            theme_ids = None

        latex_code = self._generate_theme_table_latex(
            review.id, request.user.id, export_format=export_format, theme_ids=theme_ids
        )

        if is_download:
            response = HttpResponse(
                latex_code, content_type="text/plain; charset=utf-8"
            )
            response["Content-Disposition"] = (
                f'attachment; filename="themes_review_{review.id}.tex"'
            )
            return response

        payload = {
            "latex_code": latex_code,
            "review_id": review.id,
            "review_title": review.title,
            "theme_count": MainTheme.objects.filter(
                review=review, user=request.user
            ).count(),
            "format": export_format,
        }
        return Response(ExportLatexResponseSerializer(payload).data)

    # Duplicate detection actions

    @extend_schema(
        summary="Start async duplicate detection",
        request=DetectDuplicatesRequestSerializer,
        responses={
            202: DetectDuplicatesResponseSerializer,
            400: OpenApiResponse(
                description="Already running / no references / bad threshold"
            ),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=True, methods=["post"], url_path="detect-duplicates")
    def detect_duplicates(self, request, pk=None):
        """
        Enqueue a Celery task that clusters duplicates via DOI hard-matching
        and fuzzy title/author similarity.
        """
        review = self.get_object()
        member = self._require_duplicate_permission(request, review)
        if isinstance(member, Response):
            return member

        match review.duplicate_detection_status:
            case Review.DuplicateDetectionStatus.PENDING:
                return Response(
                    {"detail": "Duplicate detection is already in progress."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            case Review.DuplicateDetectionStatus.COMPLETED:
                return Response(
                    {"detail": "Duplicate detection already performed."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        if not Reference.objects.filter(review=review).exists():
            return Response(
                {"error": "No references found to check for duplicates"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        req_ser = DetectDuplicatesRequestSerializer(data=request.data)
        req_ser.is_valid(raise_exception=True)
        threshold = req_ser.validated_data["threshold"]

        review.duplicate_detection_status = Review.DuplicateDetectionStatus.PENDING
        review.save(update_fields=["duplicate_detection_status"])

        task = detect_duplicates_task.delay(
            review_id=review.id, member_id=member.id, threshold=threshold
        )
        logger.info(
            "Started detect_duplicates_task %s for review %s", task.id, review.id
        )

        payload = {
            "message": "Duplicate detection started. You'll be notified when complete.",
            "task_id": task.id,
            "status": "processing",
            "threshold": threshold,
        }
        return Response(
            DetectDuplicatesResponseSerializer(payload).data,
            status=status.HTTP_202_ACCEPTED,
        )

    @extend_schema(
        summary="Auto-resolve high-confidence duplicate clusters",
        request=AutoResolveDuplicatesRequestSerializer,
        responses={
            202: AutoResolveDuplicatesResponseSerializer,
            400: OpenApiResponse(description="Validation error"),
            403: OpenApiResponse(description="Permission denied"),
        },
    )
    @action(detail=True, methods=["post"], url_path="auto-resolve-duplicates")
    def auto_resolve_duplicates(self, request, pk=None):
        """
        Enqueue an auto-resolution task.  Optionally runs detection first.
        """
        review = self.get_object()
        member = self._require_duplicate_permission(request, review)
        if isinstance(member, Response):
            return member

        req_ser = AutoResolveDuplicatesRequestSerializer(
            data=request.data, context={"review": review}
        )
        req_ser.is_valid(raise_exception=True)
        data = req_ser.validated_data

        task = auto_deduplicate_task.delay(
            review_id=review.id, member_id=member.id, **data
        )

        payload = {
            "message": "Auto-resolution started",
            "task_id": task.id,
            "status": "processing",
            **data,
        }
        return Response(
            AutoResolveDuplicatesResponseSerializer(payload).data,
            status=status.HTTP_202_ACCEPTED,
        )

    # Private helpers

    def _require_duplicate_permission(
        self, request, review
    ) -> "ReviewMember | Response":
        """
        Return the ReviewMember when the user has MANAGE_DUPLICATES permission,
        or a 403 Response when not.
        """
        try:
            member = ReviewMember.objects.get(review=review, user=request.user)
        except ReviewMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )
        if member.role not in PERMISSIONS[Permission.MANAGE_DUPLICATES]:
            return permission_denied_message(Permission.MANAGE_DUPLICATES)
        return member

    def _create_search_method(self, review, uploaded_file) -> "SearchMethod | Response":
        """
        Persist a SearchMethod with a name that is unique within the review.
        """
        base_name = uploaded_file.name
        name, counter = base_name, 1

        while SearchMethod.objects.filter(name=name, review=review).exists():
            stem, ext = os.path.splitext(base_name)
            name = f"{stem}_{counter}{ext}"
            counter += 1

        try:
            sm = SearchMethod.objects.create(
                review=review, name=name, file=uploaded_file
            )
            logger.info("Created SearchMethod %s at %s", sm.id, sm.file.path)
            return sm
        except Exception as exc:
            logger.error("Failed to create SearchMethod: %s", exc)
            return Response(
                {"error": f"Failed to save file: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _filter_refs_for_add_data(review, member, data):
        """Build the Reference queryset for the ``add-data`` action."""
        refs = Reference.objects.filter(review=review)

        opinion_q = Q(
            referenceopinion__member=member,
            referenceopinion__stage=data["data_source"],
        )
        type_q = Q()

        if "included" in data["article_types"]:
            type_q |= Q(referenceopinion__status=ReferenceOpinionStatus.INCLUDED)
        if "maybe" in data["article_types"]:
            type_q |= Q(referenceopinion__status=ReferenceOpinionStatus.MAYBE)
        if type_q:
            refs = refs.filter(opinion_q & type_q).distinct()

        if "labeled" in data["article_types"] and data.get("label_ids"):
            refs = refs.filter(
                labels__member=member,
                labels__label_id__in=data["label_ids"],
            ).distinct()

        return refs

    @staticmethod
    def _build_prisma_data(review) -> dict:
        """Compute all PRISMA 2020 counts from the review's reference data."""
        refs_qs = Reference.objects.filter(review=review)
        total = refs_qs.count()
        duplicates = refs_qs.filter(
            duplicate_status=Reference.DuplicateStatus.DELETED
        ).count()

        screened_qs = refs_qs.exclude(
            duplicate_status__in=[
                Reference.DuplicateStatus.UNRESOLVED,
                Reference.DuplicateStatus.DELETED,
            ]
        )
        screened = screened_qs.count()
        full_text_qs = refs_qs.filter(in_full_text=True)
        sought = full_text_qs.count()

        has_full_text_opinion = Exists(
            ReferenceOpinion.objects.filter(
                reference_id=OuterRef("pk"),
                stage=ReferenceOpinion.Stage.FULL_TEXT,
            )
        )

        not_retrieved = full_text_qs.filter(~has_full_text_opinion).count()
        assessed = full_text_qs.filter(has_full_text_opinion).count()

        # Postgres DISTINCT ON: latest exclusion opinion per reference.
        latest_opinion_ids = (
            ReferenceOpinion.objects.filter(
                reference__review=review,
                reference__in_full_text=True,
                reference__in_extraction=False,
                stage=ReferenceOpinion.Stage.FULL_TEXT,
                status=ReferenceOpinionStatus.EXCLUDED,
                reason__isnull=False,
            )
            .order_by("reference_id", "-updated_at")
            .distinct("reference_id")
            .values("id")
        )

        excluded_reasons = {
            item["reason__name"]: item["count"]
            for item in (
                ReferenceOpinion.objects.filter(id__in=Subquery(latest_opinion_ids))
                .values("reason__name")
                .annotate(count=Count("reference_id"))
                .order_by("-count")
            )
        }

        studies = refs_qs.filter(in_extraction=True).count()

        return {
            "db_registers": {
                "identification": {"databases": total},
                "removed_before_screening": {"duplicates": duplicates},
                "records": {"screened": screened, "excluded": screened - sought},
                "reports": {
                    "sought": sought,
                    "not_retrieved": not_retrieved,
                    "assessed": assessed,
                    "excluded_reasons": excluded_reasons,
                },
            },
            "included": {"studies": studies, "reports": studies},
        }

    @staticmethod
    def _build_themes_export(review, user) -> dict:
        """Build the JSON-serialisable themes export payload."""
        main_themes = MainTheme.objects.filter(
            review=review, user=user
        ).prefetch_related("sub_themes__codes")

        themes_data = []
        for theme in main_themes:
            subthemes_data = []
            for subtheme in theme.sub_themes.all():
                codes_data = [
                    {
                        "id": str(code.id),
                        "name": code.name,
                        "comment": code.comment,
                        "type": code.type,
                        "highlightColor": code.highlight_color,
                        "referenceId": code.reference_id,
                    }
                    for code in subtheme.codes.all()
                ]
                subthemes_data.append(
                    {
                        "id": subtheme.id,
                        "name": subtheme.name,
                        "description": subtheme.description,
                        "codeCount": len(codes_data),
                        "codes": codes_data,
                    }
                )
            themes_data.append(
                {
                    "id": theme.id,
                    "name": theme.name,
                    "description": theme.description,
                    "subthemeCount": len(subthemes_data),
                    "subthemes": subthemes_data,
                }
            )

        return {
            "reviewId": review.id,
            "reviewTitle": review.title,
            "exportedAt": timezone.now().isoformat(),
            "themeCount": len(themes_data),
            "themes": themes_data,
        }

    def _generate_theme_table_latex(
        self,
        review_id: int,
        user_id: int,
        export_format: str = "table_only",
        theme_ids: list | None = None,
    ) -> str:
        """Render themes as a LaTeX ``tabularx`` table."""
        qs = (
            MainTheme.objects.filter(review_id=review_id, user_id=user_id)
            .prefetch_related("sub_themes__codes")
            .order_by("id")
        )
        if theme_ids:
            qs = qs.filter(id__in=theme_ids)

        latex = r"""\begin{table}[h]
\centering
\caption{Themes and subthemes identified from Challenge Wall cards}
\begin{tabularx}{\textwidth}{|p{0.4cm}|>{\hsize=0.7\hsize}X|>{\hsize=0.8\hsize}X|>{\hsize=1.2\hsize}X|>{\hsize=1.3\hsize}X|}
\hline
& \textbf{Main themes} & \textbf{Subthemes} & \textbf{Description of subthemes} & \textbf{Example challenge} \\
\hline
"""

        for idx, theme in enumerate(qs, start=1):
            subtheme_rows = []
            for subtheme in theme.sub_themes.all():
                first_code = subtheme.codes.first()
                subtheme_rows.append(
                    {
                        "name": self._escape_latex(
                            f"{subtheme.name} ({subtheme.codes.count()})"
                        ),
                        "description": self._escape_latex(subtheme.description or ""),
                        "example": self._escape_latex(
                            first_code.name if first_code else ""
                        ),
                    }
                )

            theme_cell = self._escape_latex(
                f"{theme.name} ({theme.sub_themes.count()})"
            )
            latex += f"{idx} & {theme_cell} & "
            latex += r" \newline ".join(s["name"] for s in subtheme_rows) + " & "
            latex += (
                r" \newline\newline ".join(s["description"] for s in subtheme_rows)
                + " & "
            )
            latex += (
                r" \newline\newline ".join(s["example"] for s in subtheme_rows) + r" \\"
            )
            latex += "\n\\hline\n"

        latex += "\\end{tabularx}\n\\label{tab:themes}\n\\end{table}"

        if export_format == "full_document":
            latex = (
                "\\documentclass{article}\n"
                "\\usepackage[utf8]{inputenc}\n"
                "\\usepackage{tabularx}\n"
                "\\usepackage{array}\n\n"
                "\\begin{document}\n\n" + latex + "\n\n\\end{document}"
            )

        return latex

    @staticmethod
    def _escape_latex(text: str) -> str:
        """Escape special LaTeX characters in *text*."""
        if not text:
            return ""
        # Backslash must be replaced first to avoid double-escaping.
        replacements = [
            ("\\", r"\textbackslash{}"),
            ("&", r"\&"),
            ("%", r"\%"),
            ("$", r"\$"),
            ("#", r"\#"),
            ("_", r"\_"),
            ("{", r"\{"),
            ("}", r"\}"),
            ("~", r"\textasciitilde{}"),
            ("^", r"\^{}"),
        ]
        for old, new in replacements:
            text = text.replace(old, new)
        return text

    @staticmethod
    def _build_prisma_url(prisma_data: dict) -> str:
        """
        Build the pre-populated interactive PRISMA URL for
        https://estech.shinyapps.io/prisma_flowdiagram/.
        """
        base_url = "https://estech.shinyapps.io/prisma_flowdiagram/"
        db_reg = prisma_data.get("db_registers", {})
        ident = db_reg.get("identification", {})
        removed = db_reg.get("removed_before_screening", {})
        records = db_reg.get("records", {})
        reports = db_reg.get("reports", {})
        included = prisma_data.get("included", {})
        excluded_reasons = reports.get("excluded_reasons", {})

        params = {
            "database_results": ident.get("databases", 0),
            "register_results": ident.get("registers", 0),
            "duplicates": removed.get("duplicates", 0),
            "excluded_automatic": removed.get("automation", 0),
            "excluded_other": removed.get("other", 0),
            "records_screened": records.get("screened", 0),
            "records_excluded": records.get("excluded", 0),
            "dbr_sought_reports": reports.get("sought", 0),
            "dbr_notretrieved_reports": reports.get("not_retrieved", 0),
            "dbr_assessed": reports.get("assessed", 0),
            "new_studies": included.get("studies", 0),
            "new_reports": included.get("reports", included.get("studies", 0)),
            "total_studies": included.get("studies", 0),
            "total_reports": included.get("reports", included.get("studies", 0)),
        }

        if excluded_reasons:
            params["dbr_excluded"] = "; ".join(
                f"{reason}, {count}" for reason, count in excluded_reasons.items()
            )

        return f"{base_url}?{urlencode(params)}"


# ReviewInvitationViewSet
@extend_schema_view(
    create=extend_schema(
        summary="Invite one or more users to a review",
        request=ReviewInvitationCreateSerializer,
        responses={201: ReviewInvitationSerializer(many=True)},
    ),
    list=extend_schema(
        summary="List invitations (sent or received)",
        parameters=[
            OpenApiParameter(
                name="type",
                enum=["sent", "received"],
                description="Filter direction. Omit to return both.",
            )
        ],
        responses={200: ReviewInvitationSerializer(many=True)},
    ),
    destroy=extend_schema(
        summary="Cancel an invitation (sender only)",
        responses={204: None},
    ),
)
class ReviewInvitationViewSet(
    viewsets.GenericViewSet,
    viewsets.mixins.CreateModelMixin,
    viewsets.mixins.ListModelMixin,
    viewsets.mixins.DestroyModelMixin,
):
    """
    Manages review invitations.
    """

    serializer_class = ReviewInvitationSerializer
    permission_classes = [IsAuthenticated]
    queryset = ReviewInvitation.objects.all()

    def get_serializer_class(self):
        if self.action == "create":
            return ReviewInvitationCreateSerializer
        return ReviewInvitationSerializer

    def get_queryset(self):
        user = self.request.user
        invitation_type = self.request.query_params.get("type")

        if invitation_type == "sent":
            return ReviewInvitation.objects.filter(invited_by=user)
        if invitation_type == "received":
            return ReviewInvitation.objects.filter(email=user.email)

        # Default: both directions.
        return ReviewInvitation.objects.filter(Q(invited_by=user) | Q(email=user.email))

    def create(self, request, *args, **kwargs):
        review_id = request.data.get("review")
        emails = request.data.get("emails", [])
        role = request.data.get("role", ReviewMember.Role.VIEWER)

        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.INVITE, request.user, review)

        if role not in ReviewMember.Role.values:
            return Response(
                {
                    "detail": f"Invalid role. Must be one of: {', '.join(ReviewMember.Role.values)}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_members = set(
            review.members.select_related("user").values_list("user__email", flat=True)
        )
        existing_invited = set(
            ReviewInvitation.objects.filter(review=review).values_list(
                "email", flat=True
            )
        )
        # Skip the requester themselves, current members, and already-invited.
        skip = {request.user.email} | existing_members | existing_invited

        created = [
            ReviewInvitation.objects.create(
                email=email, review=review, invited_by=request.user, role=role
            )
            for email in emails
            if email not in skip
        ]

        return Response(ReviewInvitationSerializer(created, many=True).data, status=201)

    @extend_schema(
        summary="Accept an invitation",
        responses={
            200: InvitationAcceptDeclineResponseSerializer,
            404: OpenApiResponse(description="Invitation not found"),
        },
    )
    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )
        # get_or_create guards against double-acceptance.
        ReviewMember.objects.get_or_create(
            review=invitation.review,
            user=request.user,
            defaults={"role": invitation.role},
        )
        invitation.delete()
        return Response(
            InvitationAcceptDeclineResponseSerializer(
                {"detail": "Invitation accepted."}
            ).data
        )

    @extend_schema(
        summary="Decline an invitation",
        responses={
            200: InvitationAcceptDeclineResponseSerializer,
            404: OpenApiResponse(description="Invitation not found"),
        },
    )
    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )
        invitation.delete()
        return Response(
            InvitationAcceptDeclineResponseSerializer(
                {"detail": "Invitation declined."}
            ).data
        )

    def destroy(self, request, pk=None):
        """Only the invitation sender may cancel it."""
        invitation = get_object_or_404(ReviewInvitation, pk=pk, invited_by=request.user)
        invitation.delete()
        return Response(
            {"detail": "Invitation deleted."}, status=status.HTTP_204_NO_CONTENT
        )


# ScreeningCriteriaViewSet
@extend_schema_view(
    list=extend_schema(summary="List screening criteria"),
    retrieve=extend_schema(summary="Retrieve a criterion"),
    create=extend_schema(summary="Create a criterion (owner / collaborator only)"),
    update=extend_schema(summary="Update a criterion (owner / collaborator only)"),
    partial_update=extend_schema(summary="Partially update a criterion"),
    destroy=extend_schema(summary="Delete a criterion (owner / collaborator only)"),
)
class ScreeningCriteriaViewSet(viewsets.ModelViewSet):
    """
    CRUD for ScreeningCriteria.
    """

    serializer_class = ScreeningCriteriaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["review", "type"]

    def get_queryset(self):
        qs = ScreeningCriteria.objects.filter(review__members__user=self.request.user)
        review_id = self.request.query_params.get("review")
        if review_id:
            qs = qs.filter(review_id=review_id)
        return qs

    def get_object(self):
        obj = super().get_object()
        check_permission(Permission.ACCESS_REVIEW, self.request.user, obj.review)
        return obj

    def perform_create(self, serializer):
        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA,
            self.request.user,
            serializer.validated_data["review"],
        )
        serializer.save()

    def perform_update(self, serializer):
        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA,
            self.request.user,
            self.get_object().review,
        )
        serializer.save()

    def perform_destroy(self, instance):
        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA, self.request.user, instance.review
        )
        instance.delete()


# ReviewMemberRetrieveUpdateDestroyView
@extend_schema_view(
    retrieve=extend_schema(summary="Retrieve a review member"),
    update=extend_schema(summary="Update a member's role (owner only)"),
    partial_update=extend_schema(
        summary="Partially update a member's role (owner only)"
    ),
    destroy=extend_schema(
        summary="Remove a member (owner only; cannot remove the owner)"
    ),
)
class ReviewMemberRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    Retrieve, update role, or remove a single ReviewMember.
    """

    serializer_class = ReviewMemberSerializer
    queryset = ReviewMember.objects.all()
    permission_classes = [IsAuthenticated]

    def get_object(self):
        obj = super().get_object()
        check_permission(Permission.MODIFY_REVIEW, self.request.user, obj.review)
        return obj

    def perform_destroy(self, instance):
        if instance.role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError("You cannot remove the review owner.")
        instance.delete()


# SearchMethodDestroyView


@extend_schema(
    summary="Delete a search method (owner / collaborator only)",
    responses={204: None},
)
class SearchMethodDestroyView(generics.DestroyAPIView):
    """Delete a SearchMethod.  Requires UPLOAD_FILES permission."""

    serializer_class = SearchMethodSerializer
    queryset = SearchMethod.objects.all()
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        check_permission(Permission.UPLOAD_FILES, self.request.user, instance.review)
        instance.delete()
