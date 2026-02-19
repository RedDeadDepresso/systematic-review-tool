import json
import os
import re
import tempfile
from datetime import date
from urllib.parse import urlencode

import bibtexparser
from django.core.files.base import ContentFile
from django.db.models import (
    Count,
    Exists,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
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
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
)
from slrt_project.reviews.api.filters import ReviewFilter
from slrt_project.reviews.api.serializers import (
    AddDataSerializer,
    ArticleCountSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewMemberSerializer,
    ReviewSerializer,
    ScreeningCriteriaSerializer,
)
from slrt_project.reviews.models import (
    Review,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    SearchMethod,
)
from slrt_project.reviews.tasks import auto_deduplicate_task
from vendor.prisma_flow_diagram.prisma import Prisma2020Diagram, plot_prisma2020_new
from vendor.prisma_flow_diagram.validation import _human_issue


ANSI_ESCAPE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)


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
    BIBTEX_MONTHS = {
        "jan": 1,
        "feb": 2,
        "mar": 3,
        "apr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "aug": 8,
        "sep": 9,
        "oct": 10,
        "nov": 11,
        "dec": 12,
    }
    PUBLICATION_TYPES = {
        "article": "Journal Article",
        "book": "Book",
        "inproceedings": "Conference Paper",
        "phdthesis": "PhD Thesis",
        "mastersthesis": "Master's Thesis",
        "techreport": "Technical Report",
        "misc": "Miscellaneous",
    }

    def get_queryset(self):
        user = self.request.user

        owner_membership = ReviewMember.objects.filter(
            review=OuterRef("pk"), role=ReviewMember.Role.OWNER
        )

        user_membership = ReviewMember.objects.filter(review=OuterRef("pk"), user=user)

        queryset = (
            Review.objects.filter(members__user=user)
            .distinct()
            .annotate(
                owner_id=Subquery(owner_membership.values("user_id")[:1]),
                owner_first_name=Subquery(
                    owner_membership.values("user__first_name")[:1]
                ),
                owner_last_name=Subquery(
                    owner_membership.values("user__last_name")[:1]
                ),
                owner_email=Subquery(owner_membership.values("user__email")[:1]),
                user_role=Subquery(user_membership.values("role")[:1]),
                user_member_id=Subquery(user_membership.values("id")[:1]),
                reference_count=Count("reference", distinct=True),
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
                    filter=Q(
                        reference__duplicate_status=Reference.DuplicateStatus.DELETED
                    ),
                    distinct=True,
                ),
                duplicate_pairs_count=Count("referenceduplicatepair", distinct=True),
                duplicate_pairs_unresolved_count=Count(
                    "referenceduplicatepair",
                    filter=Q(referenceduplicatepair__resolved=False),
                    distinct=True,
                ),
            )
        )

        if self.action != "list":
            queryset = queryset.prefetch_related(
                Prefetch(
                    "members",
                    queryset=ReviewMember.objects.select_related("user"),
                )
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

    @action(detail=True, methods=["post"], url_path="upload-references")
    def upload_references(self, request, pk=None):
        """
        Upload BibTeX file to add references to review.
        Only owner and collaborator can upload.
        """
        review = self.get_object()

        # Check permissions - only owner and collaborator
        check_permission(Permission.UPLOAD_FILES, request.user, review)

        uploaded_file = request.FILES.get("file")
        if not uploaded_file:
            return Response(
                {"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Validate file extension
        _, ext = os.path.splitext(uploaded_file.name)
        if ext.lower() != ".bib":
            return Response(
                {"error": "Invalid file type. Please upload a .bib file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            bib_database = bibtexparser.load(uploaded_file)
        except Exception as e:
            return Response(
                {"error": f"Failed to parse BibTeX file: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        add_id = SearchMethod.objects.filter(
            name=uploaded_file.name, review=review
        ).exists()
        search_method = SearchMethod.objects.create(
            name=uploaded_file.name, review=review
        )
        if add_id:
            search_method.name = f"{search_method.name}_{search_method.id}"
            search_method.save(update_fields=["name"])
        references = [
            self._extract_reference_fields(review.id, search_method, entry)
            for entry in bib_database.entries
        ]

        Reference.objects.bulk_create(references)

        review.reference_duplicate_detected = False
        review.save()

        return Response(
            {
                "message": "References uploaded successfully",
                "uploaded_reference_count": len(bib_database.entries),
            },
            status=status.HTTP_201_CREATED,
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
                & Q(referenceopinion__status=ReferenceOpinion.Status.INCLUDED),
                distinct=True,
            ),
            maybe=Count(
                "referenceopinion",
                filter=opinion_filter
                & Q(referenceopinion__status=ReferenceOpinion.Status.MAYBE),
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
            type_q |= Q(referenceopinion__status=ReferenceOpinion.Status.INCLUDED)

        if "maybe" in article_types:
            type_q |= Q(referenceopinion__status=ReferenceOpinion.Status.MAYBE)

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
                status=ReferenceOpinion.Status.EXCLUDED,
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

    @action(detail=True, methods=["post"])
    def auto_resolve_duplicates(self, request, pk=None):
        """
        Start automatic duplicate resolution
        """
        review = self.get_object()

        # Check user permission
        try:
            member = ReviewMember.objects.get(review=review, user=request.user)
            if not member.role not in PERMISSIONS[Permission.MANAGE_DUPLICATES]:
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

    @action(detail=True, methods=["get"])
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

    @action(detail=True, methods=["get"])
    def auto_resolve_preview(self, request, pk=None):
        """
        Preview how many pairs would be auto-resolved

        """
        review = self.get_object()

        confidence_threshold = request.query_params.get("confidence_threshold", 0.9)

        try:
            confidence_threshold = float(confidence_threshold)
            if not (0.0 <= confidence_threshold <= 1.0):
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "confidence_threshold must be a number between 0.0 and 1.0"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Count pairs that would be auto-resolved
        high_confidence_pairs = ReferenceDuplicatePair.objects.filter(
            review=review, resolved=False, similarity_score__gte=confidence_threshold
        ).count()

        total_unresolved = ReferenceDuplicatePair.objects.filter(
            review=review, resolved=False
        ).count()

        return Response(
            {
                "total_unresolved": total_unresolved,
                "would_auto_resolve": high_confidence_pairs,
                "confidence_threshold": confidence_threshold,
                "remaining_after": total_unresolved - high_confidence_pairs,
            }
        )

    # === Helper Methods ===

    def _parse_bibtex_date(self, entry):
        # Full ISO date: 2022-03-15
        raw_date = entry.get("date")
        if raw_date:
            try:
                parts = [int(p) for p in raw_date.split("-")]
                return date(*parts)
            except Exception:
                pass

        # Year + month
        year = entry.get("year")
        if not year:
            return None

        try:
            year = int(year)
        except ValueError:
            return None

        month = entry.get("month")
        if month:
            month = month.lower()[:3]
            month = self.BIBTEX_MONTHS.get(month, 1)
        else:
            month = 1

        return date(year, month, 1)

    def _extract_reference_fields(self, review_id, search_method, entry):
        """Extract reference fields from BibTeX entry"""
        publication_type = self.PUBLICATION_TYPES.get(
            entry.get("ENTRYTYPE", "").lower(), "Other"
        )
        publication_date = self._parse_bibtex_date(entry)

        authors = (
            ", ".join(a.strip() for a in entry.get("author", "").split(" and "))
            if "author" in entry
            else ""
        )

        journal = entry.get("journal") or entry.get("booktitle") or ""
        article_customizations = entry.get("note") or entry.get("howpublished")

        doi = entry.get("doi") or entry.get("DOI", "")

        if doi:
            doi = (
                doi.lower().replace("doi:", "").replace("https://doi.org/", "").strip()
            )

        url = entry.get("url") or entry.get("URL", "")

        return Reference(
            review_id=review_id,
            title=entry.get("title", "No Title"),
            publication_type=publication_type,
            authors=authors,
            journal=journal,
            search_method=search_method,
            article_customizations=article_customizations or "",
            abstract=entry.get("abstract", ""),
            doi=doi,
            url=url,
            publication_date=publication_date,
            pages=entry.get("pages", ""),
        )

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
        """
        List invitations:
        - ?sent=true → invitations sent by current user
        - ?sent=false → invitations received by current user
        """
        sent_param = self.request.query_params.get("sent", "false").lower() == "true"
        user = self.request.user

        if sent_param:
            return ReviewInvitation.objects.filter(invited_by=user)
        else:
            return ReviewInvitation.objects.filter(email=user.email)

    def create(self, request, *args, **kwargs):
        """Only owner can invite"""
        review_id = request.data.get("review")
        emails = request.data.get("emails", [])
        role = request.data.get("role", ReviewMember.Role.VIEWER)

        review = get_object_or_404(Review, pk=review_id)

        # Check if user is owner
        check_permission(Permission.INVITE, request.user, review)

        # Validate role
        if role not in [choice[0] for choice in ReviewMember.Role.choices]:
            return Response(
                {
                    "detail": f"Invalid role. Must be one of: {', '.join([c[0] for c in ReviewMember.Role.choices])}"
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_invitations = []
        for email in emails:
            if email == request.user.email:
                continue
            invitation = ReviewInvitation.objects.create(
                email=email,
                review=review,
                invited_by=request.user,
                role=role,  # Store the role in invitation
            )
            created_invitations.append(invitation)

        serializer = ReviewInvitationSerializer(created_invitations, many=True)
        return Response(serializer.data, status=201)

    def update(self, request, pk=None):
        """
        Accept or decline an invitation.
        On accept, create ReviewMember with the specified role.
        """
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )
        action_type = request.data.get("action", "").lower()

        if action_type == "accept":
            # Create ReviewMember with role from invitation
            ReviewMember.objects.create(
                review=invitation.review,
                user=request.user,
                role=invitation.role,  # Use role from invitation
            )
            invitation.delete()
            return Response(
                {"detail": "Invitation accepted."}, status=status.HTTP_200_OK
            )
        elif action_type == "decline":
            invitation.delete()
            return Response(
                {"detail": "Invitation declined."}, status=status.HTTP_200_OK
            )
        else:
            return Response(
                {"detail": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST
            )

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
