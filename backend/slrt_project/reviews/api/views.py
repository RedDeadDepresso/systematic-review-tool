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
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.models import MainTheme
from slrt_project.permissions import (
    PERMISSIONS,
    IsReviewOwner,
    Permission,
    check_permission,
    permission_denied_message,
)
from slrt_project.references.models import (
    Reference,
    ReferenceLabel,
    ReferenceOpinion,
    ReferenceOpinionStatus,
)
from slrt_project.reviews.api.filters import ReviewFilter
from slrt_project.reviews.api.serializers import (
    AddDataSerializer,
    ArticleCountSerializer,
    OpinionStatsSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewMemberSerializer,
    ReviewSerializer,
    ScreeningCriteriaSerializer,
    ScreeningStatSerializer,
    SearchMethodSerializer,
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
from vendor.prisma_flow_diagram.prisma import Prisma2020Diagram, plot_prisma2020_new
from vendor.prisma_flow_diagram.validation import _human_issue


logger = logging.getLogger(__name__)


class ReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing reviews and related operations.

    Provides standard CRUD operations plus custom actions:
    - upload_references: Upload BibTeX file (owner/collaborator/reviewer)
    - export_latex: Export themes table as LaTeX (any member)
    - export_json: Export themes as JSON (any member)
    """

    permission_classes = [IsAuthenticated]
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = ReviewFilter

    def get_queryset(self):
        user = self.request.user

        base_qs = Review.objects.filter(members__user=user).distinct()

        owner_membership = ReviewMember.objects.filter(
            review=OuterRef("pk"),
            role=ReviewMember.Role.OWNER,
        )

        user_membership = ReviewMember.objects.filter(
            review=OuterRef("pk"),
            user=user,
        )

        search_method_exists = SearchMethod.objects.filter(
            review=OuterRef("pk"),
            file__gt="",
        )

        # ===============================
        # LIST VIEW (lightweight)
        # ===============================
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
                    When(
                        Exists(search_method_exists),
                        then=Value(None),
                    ),
                    default=Count("reference", distinct=True),
                    output_field=IntegerField(),
                ),
            )

        # ===============================
        # DETAIL / RETRIEVE VIEW
        # ===============================
        queryset = base_qs.annotate(
            user_role=Subquery(user_membership.values("role")[:1]),
            user_member_id=Subquery(user_membership.values("id")[:1]),
            # Conditionally null reference_count
            reference_count=Case(
                When(
                    Exists(search_method_exists),
                    then=Value(None),
                ),
                default=Count("reference", distinct=True),
                output_field=IntegerField(),
            ),
            # Duplicate reference status counts
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
            # Conditionally null duplicate pair counts
            duplicate_pairs_count=Case(
                When(
                    duplicate_detection_status=Review.DuplicateDetectionStatus.COMPLETED,
                    then=Count("referenceduplicatepair", distinct=True),
                ),
                default=Value(None),
                output_field=IntegerField(),
            ),
            duplicate_pairs_unresolved_count=Case(
                When(
                    duplicate_detection_status=Review.DuplicateDetectionStatus.COMPLETED,
                    then=Count(
                        "referenceduplicatepair",
                        filter=Q(referenceduplicatepair__resolved=False),
                        distinct=True,
                    ),
                ),
                default=Value(None),
                output_field=IntegerField(),
            ),
        )
        return queryset

    def get_serializer_class(self):
        """Use different serializers for list vs detail views"""
        if self.action == "list":
            return ReviewListSerializer
        return ReviewSerializer

    def get_permissions(self):
        """Apply role-based permissions"""
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsReviewOwner()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Set the creator as owner when creating"""
        review = serializer.save()
        # Create ReviewMember with owner role
        ReviewMember.objects.create(
            review=review, user=self.request.user, role=ReviewMember.Role.OWNER
        )

    # === Custom Actions ===
    @action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        """
        Get all members of a review
        """
        review = self.get_object()

        members = ReviewMember.objects.filter(review=review).select_related("user")
        members_data = ReviewMemberSerializer(
            members, many=True, context={"request": request}
        ).data
        return Response(members_data)

    @action(detail=True, methods=["get"], url_path="screening-stats")
    def screening_stats(self, request, pk=None):
        review = self.get_object()
        user = request.user

        qs = ScreeningStat.objects.filter(member__review=review).select_related(
            "member__user"
        )

        if review.is_blinded:
            qs = qs.filter(member__user=user)

        serializer = ScreeningStatSerializer(qs.order_by("-seconds"), many=True)

        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="screening-opinions")
    def screening_opinions(self, request, pk=None):
        review = self.get_object()
        data = review.compute_opinion_stats(
            ReferenceOpinion.Stage.SCREENING, request.user
        )
        return Response(OpinionStatsSerializer(data, many=True).data)

    @action(detail=True, methods=["get"], url_path="full-text-opinions")
    def full_text_opinions(self, request, pk=None):
        review = self.get_object()
        data = review.compute_opinion_stats(
            ReferenceOpinion.Stage.FULL_TEXT, request.user
        )
        return Response(OpinionStatsSerializer(data, many=True).data)

    @action(detail=True, methods=["post"], url_path="upload-references")
    def upload_references(self, request, pk=None):
        """
        Upload BibTeX, RIS, or EndNote XML file to add references to review.
        File is processed asynchronously via Celery.
        """
        review = self.get_object()

        # Check permissions
        check_permission(Permission.UPLOAD_FILES, request.user, review)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extension
        filename, ext = os.path.splitext(uploaded_file.name)
        ext = ext.lower()

        if ext not in [".bib", ".ris", ".xml"]:
            return Response(
                {
                    "error": "Invalid file type. Please upload a .bib, .ris, or .xml (EndNote) file."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get ReviewMember
        try:
            member = ReviewMember.objects.get(review=review, user=request.user)
        except ReviewMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Create SearchMethod with file
        try:
            # Check if name already exists
            base_name = uploaded_file.name
            name = base_name
            counter = 1

            while SearchMethod.objects.filter(name=name, review=review).exists():
                name_without_ext, file_ext = os.path.splitext(base_name)
                name = f"{name_without_ext}_{counter}{file_ext}"
                counter += 1

            search_method = SearchMethod.objects.create(
                review=review, name=name, file=uploaded_file
            )

            logger.info(
                f"Created SearchMethod {search_method.id} with file: {search_method.file.path}"
            )

        except Exception as e:
            logger.error(f"Failed to create SearchMethod: {str(e)}")
            return Response(
                {"error": f"Failed to save file: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        # Determine file type
        if ext == ".xml":
            file_type = "endnote"
        else:
            file_type = ext[1:]  # Remove the dot

        # Start async task with file type
        task = import_references_task.delay(
            review_id=review.id,
            member_id=member.id,
            search_method_id=search_method.id,
            file_type=file_type,
        )

        logger.info(
            f"Started import task {task.id} for SearchMethod {search_method.id}"
        )

        return Response(
            {
                "message": "File uploaded successfully. Processing in background...",
                "task_id": task.id,
                "search_method_id": search_method.id,
                "filename": uploaded_file.name,
                "file_type": file_type,
                "status": "processing",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="article-counts")
    def article_counts(self, request, pk=None):
        review = self.get_object()
        stage = request.query_params.get("stage")

        member = get_object_or_404(
            ReviewMember,
            review=review,
            user=request.user,
        )

        # Opinion filtering
        opinion_filter = Q(referenceopinion__member=member)
        if stage:
            opinion_filter &= Q(referenceopinion__stage=stage)

        # Base counts
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
            labeled=Count(
                "labels",
                filter=Q(labels__member=member),
                distinct=True,
            ),
        )

        # Label counts
        label_qs = (
            ReferenceLabel.objects.filter(
                reference__review=review,
                member=member,
            )
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

        serializer = ArticleCountSerializer(counts)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="add-data")
    def add_data(self, request, pk=None):
        review = self.get_object()
        check_permission(Permission.ADD_DATA, self.request.user, review)
        serializer = AddDataSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        data_source = data["data_source"]
        data_sink = data["data_sink"]
        article_types = data["article_types"]
        label_ids = data["label_ids"]

        member = get_object_or_404(
            ReviewMember,
            review=review,
            user=request.user,
        )

        refs = Reference.objects.filter(review=review)

        # Opinion filtering with stage
        opinion_q = Q(
            referenceopinion__member=member,
            referenceopinion__stage=data_source,
        )

        type_q = Q()

        if "included" in article_types:
            type_q |= Q(referenceopinion__status=ReferenceOpinionStatus.INCLUDED)

        if "maybe" in article_types:
            type_q |= Q(referenceopinion__status=ReferenceOpinionStatus.MAYBE)

        if type_q:
            refs = refs.filter(opinion_q & type_q).distinct()

        # Label filtering
        if "labeled" in article_types and label_ids:
            refs = refs.filter(
                labels__member=member,
                labels__label_id__in=label_ids,
            ).distinct()

        # Apply destination
        if data_sink == "full-text":
            refs.update(in_full_text=True)

        elif data_sink == "extraction":
            refs.update(in_extraction=True)

        return Response({"updated": refs.count()})

    @action(detail=True, methods=["post"], url_path="prisma")
    def prisma(self, request, pk=None):
        """
        Generate PRISMA flow diagram for the review
        """
        review = self.get_object()
        check_permission(Permission.ACCESS_REVIEW, self.request.user, review)

        # Get all references for this review
        references_qs = Reference.objects.filter(review=review)

        # Total references from all sources
        total_references = references_qs.count()

        # Duplicates count
        duplicates_count = references_qs.filter(
            duplicate_status=Reference.DuplicateStatus.DELETED
        ).count()

        # References after duplicate removal
        screened_qs = references_qs.exclude(
            duplicate_status__in=[
                Reference.DuplicateStatus.UNRESOLVED,
                Reference.DuplicateStatus.DELETED,
            ]
        )
        screened_count = screened_qs.count()

        # Reports sought for full-text
        full_text_qs = references_qs.filter(in_full_text=True)
        sought_count = full_text_qs.count()

        # Excluded in screening
        screening_excluded_count = screened_count - sought_count

        # Not retrieved (references in full-text but no full-text opinion/assessment yet)
        not_retrieved_count = full_text_qs.filter(
            ~Exists(
                ReferenceOpinion.objects.filter(
                    reference_id=OuterRef("pk"), stage=ReferenceOpinion.Stage.FULL_TEXT
                )
            )
        ).count()

        # Assessed for full-text (references with at least one full-text opinion)
        assessed_count = full_text_qs.filter(
            Exists(
                ReferenceOpinion.objects.filter(
                    reference_id=OuterRef("pk"), stage=ReferenceOpinion.Stage.FULL_TEXT
                )
            )
        ).count()

        # Full-text exclusion reasons
        # Subquery: latest FULL-TEXT exclusion opinion per reference
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

        # Aggregate reasons from those latest opinions only
        excluded_reasons_qs = (
            ReferenceOpinion.objects.filter(id__in=Subquery(latest_opinion_ids))
            .values("reason__name")
            .annotate(count=Count("reference_id"))
            .order_by("-count")
        )

        excluded_reasons = {
            item["reason__name"]: item["count"] for item in excluded_reasons_qs
        }

        # Studies included in data extraction
        studies_count = references_qs.filter(in_extraction=True).count()
        reports_count = studies_count  # Assuming 1:1 for now

        # Build PRISMA data structure
        prisma_data = {
            "db_registers": {
                "identification": {
                    "databases": total_references,
                },
                "removed_before_screening": {
                    "duplicates": duplicates_count,
                },
                "records": {
                    "screened": screened_count,
                    "excluded": screening_excluded_count,
                },
                "reports": {
                    "sought": sought_count,
                    "not_retrieved": not_retrieved_count,
                    "assessed": assessed_count,
                    "excluded_reasons": excluded_reasons,
                },
            },
            "included": {"studies": studies_count, "reports": reports_count},
        }

        try:
            # Validate the diagram data first
            diagram = Prisma2020Diagram(
                db_registers=prisma_data["db_registers"],
                included=prisma_data["included"],
            )
            validation_issues = diagram.validate()

            # Generate the diagram to temp file
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
                tmp_path = tmp_file.name

            try:
                # Generate diagram
                plot_prisma2020_new(
                    db_registers=prisma_data["db_registers"],
                    included=prisma_data["included"],
                    filename=tmp_path,
                    validation="off",
                )

                # Read temp file and save to model
                with open(tmp_path, "rb") as f:
                    filename = f"prisma_{review.id}_{timezone.now().strftime('%Y%m%d_%H%M%S')}.png"
                    review.prisma_file.save(filename, ContentFile(f.read()), save=True)
            finally:
                # Clean up temp file
                if os.path.exists(tmp_path):
                    os.unlink(tmp_path)

            # Build interactive PRISMA URL
            interactive_url = self._build_prisma_url(prisma_data)

            # Prepare response
            response_data = {
                "message": "PRISMA diagram generated successfully",
                "file_url": request.build_absolute_uri(review.prisma_file.url)
                if review.prisma_file
                else None,
                "interactive_url": interactive_url,
                "data": prisma_data,
            }

            # Include validation issues
            if validation_issues:
                response_data["validation_issues"] = []
                for issue in validation_issues:
                    severity, message = _human_issue(issue)
                    response_data["validation_issues"].append(
                        {
                            "severity": strip_ansi(severity),
                            "message": strip_ansi(message),
                        }
                    )

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {"error": f"Failed to generate PRISMA diagram: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=True, methods=["get"], url_path="export-json")
    def export_json(self, request, pk=None):
        """
        Export themes, subthemes, and codes as structured JSON.
        All members can export.
        """
        review = self.get_object()

        # Check if user has access
        check_permission(Permission.ACCESS_REVIEW, request.user, review)

        # Build structured data
        themes_data = []
        main_themes = MainTheme.objects.filter(
            review=review, user=request.user
        ).prefetch_related("sub_themes__codes")

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

        export_data = {
            "reviewId": review.id,
            "reviewTitle": review.title,
            "exportedAt": timezone.now().isoformat(),
            "themeCount": len(themes_data),
            "themes": themes_data,
        }

        # Return as file download
        if request.query_params.get("download") == "true":
            pretty = request.query_params.get("pretty", "true") == "true"
            json_str = json.dumps(
                export_data, indent=2 if pretty else None, ensure_ascii=False
            )

            response = HttpResponse(
                json_str, content_type="application/json; charset=utf-8"
            )
            filename = f"themes_review_{review.id}.json"
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        # Return as JSON response
        return Response(export_data)

    @action(detail=True, methods=["get", "post"], url_path="export-latex")
    def export_latex(self, request, pk=None):
        """
        Export themes table as LaTeX code.
        All members can export.
        """
        review = self.get_object()

        # Check if user has access
        check_permission(Permission.ACCESS_REVIEW, request.user, review)

        is_download = request.query_params.get("download") == "true"

        # Get format preference
        if request.method == "POST":
            export_format = request.data.get("format", "table_only")
            theme_ids = request.data.get("theme_ids")
        else:
            # Default to full_document for downloads, table_only for JSON preview
            default_format = "full_document" if is_download else "table_only"
            export_format = request.query_params.get("format", default_format)
            theme_ids = None

        # Generate LaTeX code
        latex_code = self._generate_theme_table_latex(
            review.id, request.user.id, export_format=export_format, theme_ids=theme_ids
        )

        # Return as file download
        if is_download:
            response = HttpResponse(
                latex_code, content_type="text/plain; charset=utf-8"
            )
            filename = f"themes_review_{review.id}.tex"
            response["Content-Disposition"] = f'attachment; filename="{filename}"'
            return response

        # Return as JSON (for preview or copying)
        return Response(
            {
                "latex_code": latex_code,
                "review_id": review.id,
                "review_title": review.title,
                "theme_count": MainTheme.objects.filter(
                    review=review, user=request.user
                ).count(),
                "format": export_format,
            }
        )

    @action(detail=True, methods=["post"], url_path="detect-duplicates")
    def detect_duplicates(self, request, pk=None):
        """
        Detect duplicate references asynchronously
        Only owner, collaborator, and reviewer can detect duplicates
        """
        review = self.get_object()

        # Check user permission
        try:
            member = ReviewMember.objects.get(review=review, user=request.user)
            if member.role not in PERMISSIONS[Permission.MANAGE_DUPLICATES]:
                return permission_denied_message(Permission.MANAGE_DUPLICATES)
        except ReviewMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check current status
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

        # Check if there are references to check
        reference_count = Reference.objects.filter(review=review).count()

        if reference_count == 0:
            return Response(
                {"error": "No references found to check for duplicates"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get threshold from request (optional)
        threshold = float(request.data.get("threshold", 0.5))

        # Validate threshold
        if not (0.0 <= threshold <= 1.0):
            return Response(
                {"error": "Threshold must be between 0.0 and 1.0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Update status to pending
        review.duplicate_detection_status = Review.DuplicateDetectionStatus.PENDING
        review.save()

        # Start async task
        task = detect_duplicates_task.delay(
            review_id=review.id, member_id=member.id, threshold=threshold
        )

        logger.info(
            f"Started duplicate detection task {task.id} for review {review.id}"
        )

        return Response(
            {
                "message": "Duplicate detection started. You'll be notified when complete.",
                "task_id": task.id,
                "status": "processing",
                "threshold": threshold,
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="auto-resolve-duplicates")
    def auto_resolve_duplicates(self, request, pk=None):
        """
        Start automatic duplicate resolution
        """
        review = self.get_object()

        # Check user permission
        try:
            member = ReviewMember.objects.get(review=review, user=request.user)
            if member.role not in PERMISSIONS[Permission.MANAGE_DUPLICATES]:
                permission_denied_message(Permission.MANAGE_DUPLICATES)
        except ReviewMember.DoesNotExist:
            return Response(
                {"error": "You are not a member of this review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Get settings from request
        confidence_threshold = request.data.get("confidence_threshold", 0.90)
        create_pairs_first = request.data.get("create_pairs_first", True)
        criteria = request.data.get("criteria", {})
        text_normalization = request.data.get("text_normalization", False)
        preferred_search_method_id = request.data.get("preferred_search_method_id")

        # Validate confidence threshold
        try:
            confidence_threshold = float(confidence_threshold)
            if not (0.0 <= confidence_threshold <= 1.0):
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "confidence_threshold must be a number between 0.0 and 1.0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate search method if provided
        if preferred_search_method_id:
            try:
                SearchMethod.objects.get(id=preferred_search_method_id, review=review)
            except SearchMethod.DoesNotExist:
                return Response(
                    {"error": "Invalid search method"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # Start async task
        task = auto_deduplicate_task.delay(
            review_id=review.id,
            member_id=member.id,
            confidence_threshold=confidence_threshold,
            create_pairs_first=create_pairs_first,
            criteria=criteria,
            text_normalization=text_normalization,
            preferred_search_method_id=preferred_search_method_id,
        )

        return Response(
            {
                "message": "Auto-resolution started",
                "task_id": task.id,
                "confidence_threshold": confidence_threshold,
                "criteria": criteria,
                "text_normalization": text_normalization,
                "preferred_search_method_id": preferred_search_method_id,
                "status": "processing",
            },
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["get"], url_path="search-methods")
    def search_methods(self, request, pk=None):
        """
        Get all search methods for a review

        GET /api/reviews/{id}/search_methods/
        """
        review = self.get_object()

        search_methods = SearchMethod.objects.filter(review=review)

        return Response(
            [
                {
                    "id": method.id,
                    "name": method.name,
                }
                for method in search_methods
            ]
        )

    # === Helper Methods ===
    def _generate_theme_table_latex(
        self, review_id, user_id, export_format="table_only", theme_ids=None
    ):
        """Generate LaTeX code for themes table"""
        queryset = MainTheme.objects.filter(
            review_id=review_id, user_id=user_id
        ).prefetch_related("sub_themes__codes")

        if theme_ids:
            queryset = queryset.filter(id__in=theme_ids)

        main_themes = queryset.order_by("id")

        # Build LaTeX table with tabularx - description and example get more space
        latex = r"""\begin{table}[h]
    \centering
    \caption{Themes and subthemes identified from Challenge Wall cards}
    \begin{tabularx}{\textwidth}{|p{0.4cm}|>{\hsize=0.7\hsize}X|>{\hsize=0.8\hsize}X|>{\hsize=1.2\hsize}X|>{\hsize=1.3\hsize}X|}
    \hline
    & \textbf{Main themes} & \textbf{Subthemes} & \textbf{Description of subthemes} & \textbf{Example challenge} \\
    \hline
    """

        for idx, theme in enumerate(main_themes, 1):
            subtheme_data = []

            for subtheme in theme.sub_themes.all():
                count = subtheme.codes.count()
                name = self._escape_latex(f"{subtheme.name} ({count})")
                description = self._escape_latex(subtheme.description or "")

                code = subtheme.codes.first()
                example = self._escape_latex(code.name if code else "")

                subtheme_data.append(
                    {"name": name, "description": description, "example": example}
                )

            theme_name = self._escape_latex(theme.name)
            theme_count = theme.sub_themes.count()

            latex += f"{idx} & {theme_name} ({theme_count}) & "
            latex += r" \newline ".join(s["name"] for s in subtheme_data) + " & "
            latex += (
                r" \newline\newline ".join(s["description"] for s in subtheme_data)
                + " & "
            )
            latex += (
                r" \newline\newline ".join(s["example"] for s in subtheme_data) + r" \\"
            )
            latex += "\n\\hline\n"

        latex += r"""\end{tabularx}
    \label{tab:themes}
    \end{table}"""

        if export_format == "full_document":
            latex = (
                r"""\documentclass{article}
    \usepackage[utf8]{inputenc}
    \usepackage{tabularx}
    \usepackage{array}

    \begin{document}

    """
                + latex
                + r"""

    \end{document}"""
            )

        return latex

    def _escape_latex(self, text):
        """Escape special LaTeX characters"""
        if not text:
            return ""

        replacements = {
            "&": r"\&",
            "%": r"\%",
            "$": r"\$",
            "#": r"\#",
            "_": r"\_",
            "{": r"\{",
            "}": r"\}",
            "~": r"\textasciitilde{}",
            "^": r"\^{}",
            "\\": r"\textbackslash{}",
        }

        for old, new in replacements.items():
            text = text.replace(old, new)

        return text

    def _build_prisma_url(self, prisma_data: dict) -> str:
        """
        Build interactive PRISMA flowchart URL with pre-populated data
        using the correct PRISMA shiny app parameter names
        https://estech.shinyapps.io/prisma_flowdiagram/
        """
        base_url = "https://estech.shinyapps.io/prisma_flowdiagram/"

        db_reg = prisma_data.get("db_registers", {})
        identification = db_reg.get("identification", {})
        removed = db_reg.get("removed_before_screening", {})
        records = db_reg.get("records", {})
        reports = db_reg.get("reports", {})
        included = prisma_data.get("included", {})
        excluded_reasons = reports.get("excluded_reasons", {})

        params = {
            # Identification
            "database_results": identification.get("databases", 0),
            "register_results": identification.get("registers", 0),
            # Removed before screening
            "duplicates": removed.get("duplicates", 0),
            "excluded_automatic": removed.get("automation", 0),
            "excluded_other": removed.get("other", 0),
            # Screening
            "records_screened": records.get("screened", 0),
            "records_excluded": records.get("excluded", 0),
            # Full-text retrieval
            "dbr_sought_reports": reports.get("sought", 0),
            "dbr_notretrieved_reports": reports.get("not_retrieved", 0),
            "dbr_assessed": reports.get("assessed", 0),
            # Included studies
            "new_studies": included.get("studies", 0),
            "new_reports": included.get("reports", included.get("studies", 0)),
            "total_studies": included.get("studies", 0),
            "total_reports": included.get("reports", included.get("studies", 0)),
        }

        # Add exclusion reasons (format expected by CSV description)
        if excluded_reasons:
            reasons_str = "; ".join(
                f"{reason}, {count}" for reason, count in excluded_reasons.items()
            )
            params["dbr_excluded"] = reasons_str

        query_string = urlencode(params)
        return f"{base_url}?{query_string}"


class ReviewInvitationViewSet(
    viewsets.GenericViewSet,
    viewsets.mixins.CreateModelMixin,
    viewsets.mixins.ListModelMixin,
    viewsets.mixins.DestroyModelMixin,
):
    """
    ViewSet to handle review invitations.
    - Create: only owner and collaborator can send invitations
    - List: sent or received invitations
    - Update: accept or decline invitation (custom action)
    - Destroy: only user who created the invitation
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
        elif invitation_type == "received":
            return ReviewInvitation.objects.filter(email=user.email)

        # default: return both
        return ReviewInvitation.objects.filter(Q(invited_by=user) | Q(email=user.email))

    def create(self, request, *args, **kwargs):
        review_id = request.data.get("review")
        emails = request.data.get("emails", [])
        role = request.data.get("role", ReviewMember.Role.VIEWER)

        review = get_object_or_404(Review, pk=review_id)

        # Permission check
        check_permission(Permission.INVITE, request.user, review)

        # Validate role
        if role not in ReviewMember.Role.values:
            return Response(
                {
                    "detail": f"Invalid role. Must be one of: {', '.join(ReviewMember.Role.values)}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get existing member emails
        existing_member_emails = set(
            review.members.select_related("user").values_list("user__email", flat=True)
        )

        # Get already invited emails (optional but recommended)
        existing_invited_emails = set(
            ReviewInvitation.objects.filter(review=review).values_list(
                "email", flat=True
            )
        )

        created_invitations = []

        for email in emails:
            if (
                email == request.user.email
                or email in existing_member_emails
                or email in existing_invited_emails
            ):
                continue

            invitation = ReviewInvitation.objects.create(
                email=email,
                review=review,
                invited_by=request.user,
                role=role,
            )
            created_invitations.append(invitation)

        serializer = ReviewInvitationSerializer(created_invitations, many=True)
        return Response(serializer.data, status=201)

    @action(detail=True, methods=["post"])
    def accept(self, request, pk=None):
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )

        # Prevent duplicate membership
        ReviewMember.objects.get_or_create(
            review=invitation.review,
            user=request.user,
            defaults={"role": invitation.role},
        )

        invitation.delete()
        return Response({"detail": "Invitation accepted."})

    @action(detail=True, methods=["post"])
    def decline(self, request, pk=None):
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )

        invitation.delete()
        return Response({"detail": "Invitation declined."})

    def destroy(self, request, pk=None):
        """
        Only the user who created the invitation can delete it.
        """
        invitation = get_object_or_404(ReviewInvitation, pk=pk, invited_by=request.user)
        invitation.delete()
        return Response(
            {"detail": "Invitation deleted."}, status=status.HTTP_204_NO_CONTENT
        )


class ScreeningCriteriaViewSet(viewsets.ModelViewSet):
    """
    CRUD for ScreeningCriteria.
    Only owner and collaborator can create/update/delete.
    All members can view.
    """

    serializer_class = ScreeningCriteriaSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ["review", "kind"]

    def get_queryset(self):
        """
        List only criteria belonging to reviews the user can access.
        """
        queryset = ScreeningCriteria.objects.all()

        review_id = self.request.query_params.get("review")
        if review_id:
            queryset = queryset.filter(review_id=review_id)

        user = self.request.user
        return queryset.filter(review__members__user=user)

    def perform_create(self, serializer):
        """Only owner and collaborator can create screening criteria"""
        review = serializer.validated_data["review"]

        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA, self.request.user, review
        )

        serializer.save()

    def perform_update(self, serializer):
        """Only owner and collaborator can update screening criteria"""
        criteria = self.get_object()
        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA, self.request.user, criteria.review
        )
        serializer.save()

    def perform_destroy(self, instance):
        """Only owner and collaborator can delete screening criteria"""
        check_permission(
            Permission.MODIFY_SCREENING_CRITERIA, self.request.user, instance.review
        )
        instance.delete()

    def get_object(self):
        """
        Enforce permissions for retrieve.
        """
        obj = super().get_object()

        check_permission(Permission.ACCESS_REVIEW, self.request.user, obj.review)

        return obj


class ReviewMemberRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    """
    ViewSet for managing review members.
    Only owner can update/delete members.
    """

    serializer_class = ReviewMemberSerializer
    queryset = ReviewMember.objects.all()
    permission_classes = [IsAuthenticated]

    def get_object(self):
        """
        Enforce permissions for retrieve.
        """
        obj = super().get_object()

        check_permission(Permission.MODIFY_REVIEW, self.request.user, obj.review)

        return obj

    def perform_destroy(self, instance):
        """Cannot remove the owner"""
        if instance.role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError("You cannot remove the review owner.")
        instance.delete()


class SearchMethodDestroyView(generics.DestroyAPIView):
    """
    View to delete a search method.
    Only owner and collaborator can delete.
    """

    serializer_class = SearchMethodSerializer
    queryset = SearchMethod.objects.all()
    permission_classes = [IsAuthenticated]

    def perform_destroy(self, instance):
        """Only owner and collaborator can delete search method"""
        check_permission(Permission.UPLOAD_FILES, self.request.user, instance.review)
        instance.delete()
