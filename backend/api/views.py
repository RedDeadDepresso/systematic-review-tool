import csv
import json
import os
import re
import tempfile
from datetime import date
from urllib.parse import urlencode

import bibtexparser
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import (
    Count,
    Exists,
    F,
    OuterRef,
    Prefetch,
    Q,
    Subquery,
)
from django.db.models.functions import ExtractYear
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from djangorestframework_camel_case.parser import CamelCaseJSONParser
from rest_framework import generics, mixins, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from api.filters import ReferenceFilter, ReviewFilter
from api.models import (
    Code,
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
    Keyword,
    Label,
    MainTheme,
    Note,
    Reason,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
    Review,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    SearchMethod,
    SubTheme,
    UploadedPDF,
    User,
)
from api.permissions import IsReviewOwner, Permission, check_permission
from api.serializers import (
    AddDataSerializer,
    ArticleCountSerializer,
    AssignLabelsSerializer,
    AssignReferencesSerializer,
    AttachPDFsSerializer,
    BulkCreateNoteSerializer,
    BulkUpdateExtractionStatusSerializer,
    CodeSerializer,
    ExtractionAnswerBulkSerializer,
    ExtractionAnswerSerializer,
    ExtractionQuestionSerializer,
    ExtractionSectionSerializer,
    ExtractionTableDataSerializer,
    KeywordSerializer,
    LabelSerializer,
    MainThemeSerializer,
    NoteSerializer,
    ReasonSerializer,
    ReferenceDuplicatePairSerializer,
    ReferenceOpinionSerializer,
    ReferenceOpinionUpsertSerializer,
    ReferenceSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewMemberSerializer,
    ReviewSerializer,
    ScreeningCriteriaSerializer,
    SubThemeSerializer,
    UploadedPDFSerializer,
    UserSerializer,
)
from vendor.prisma_flow_diagram.prisma import Prisma2020Diagram, plot_prisma2020_new
from vendor.prisma_flow_diagram.validation import _human_issue


ANSI_ESCAPE = re.compile(r"\x1B\[[0-?]*[ -/]*[@-~]")


def strip_ansi(text: str) -> str:
    return ANSI_ESCAPE.sub("", text)


class UserViewSet(
    viewsets.GenericViewSet,
    viewsets.mixins.CreateModelMixin,
    viewsets.mixins.RetrieveModelMixin,
    viewsets.mixins.UpdateModelMixin,
    viewsets.mixins.DestroyModelMixin,
):
    """
    UserViewSet handles:
    - Registration (create)
    - Retrieve current user profile (retrieve)
    - Update user profile including password (update/partial_update)
    - Delete account (destroy)
    """

    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_permissions(self):
        """
        Allow anyone to register, but other actions require authentication.
        """
        if self.action == "create":
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_object(self):
        """
        Ensure all retrieve/update/delete operations are for the current user only.
        """
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        """
        Return the current user's profile.
        """
        user = self.get_object()
        data = {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "display_name": str(user),
            "avatar": getattr(
                user, "avatar", ""
            ),  # replace with user.avatar.url if using ImageField
        }
        return Response(data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Delete the current user's account.
        """
        user = self.get_object()
        user.delete()
        return Response(
            {"detail": "User account deleted."}, status=status.HTTP_204_NO_CONTENT
        )


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
            review=OuterRef("pk"),
            role=ReviewMember.Role.OWNER,
        )

        user_membership = ReviewMember.objects.filter(
            review=OuterRef("pk"),
            user=user,
        )

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
            )
        )

        # LIST → lightweight
        if self.action == "list":
            queryset = queryset.annotate(reference_count=Count("reference"))

        # DETAIL → include members
        else:
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

        add_id = SearchMethod.objects.filter(name=uploaded_file.name).exists()
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


class ReferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for References:
    - list, retrieve, update
    - Access restricted to review members
    - Blinded review handling
    """

    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
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
        return queryset.prefetch_related(
            Prefetch(
                "referenceopinion_set",
                queryset=opinions_qs,
                to_attr="prefetched_opinions",
            ),
            "labels",
        ).distinct()

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
        parser_classes=[CamelCaseJSONParser],
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

    @action(
        detail=False,
        methods=["post"],
        url_path="assign",
        parser_classes=[CamelCaseJSONParser],
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

    @action(detail=False, methods=["post"])
    def detect(self, request):
        """Only owner and collaborator can detect duplicates"""
        review = self._get_review(require_manage_duplicates=True)

        if review.reference_duplicate_detected:
            return Response(
                {"detail": "Duplicate detection already performed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Reference.objects.filter(review=review)
        created_count = ReferenceDuplicatePair.create_pairs(review, queryset)
        review.reference_duplicate_detected = True
        review.save()

        return Response(
            {"duplicates_found_count": created_count},
            status=status.HTTP_201_CREATED,
        )

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


class CodeViewSet(viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete codes"""

    serializer_class = CodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        user = self.request.user
        return Code.objects.filter(member__user=user).select_related("reference")

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")

        review = get_object_or_404(Review, pk=review_id)

        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)

        serializer.save(member=member)

    def perform_update(self, serializer):
        code = self.get_object()
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, code.review)
        serializer.save()

    def perform_destroy(self, instance):
        check_permission(
            Permission.MODIFY_THEMES_CODES, self.request.user, instance.review
        )
        instance.delete()


class SubThemeViewSet(viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete subthemes"""

    serializer_class = SubThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        user = self.request.user
        return SubTheme.objects.filter(member__user=user)

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")

        review = get_object_or_404(Review, pk=review_id)

        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)

        serializer.save(member=member)

    def perform_update(self, serializer):
        subtheme = self.get_object()
        check_permission(
            Permission.MODIFY_THEMES_CODES, self.request.user, subtheme.review
        )
        serializer.save()

    def perform_destroy(self, instance):
        check_permission(
            Permission.MODIFY_THEMES_CODES, self.request.user, instance.review
        )
        instance.delete()


class MainThemeViewSet(viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete themes"""

    serializer_class = MainThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        user = self.request.user
        return MainTheme.objects.filter(member__user=user)

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")

        review = get_object_or_404(Review, pk=review_id)

        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)

        serializer.save(member=member)

    def perform_update(self, serializer):
        theme = self.get_object()
        check_permission(
            Permission.MODIFY_THEMES_CODES, self.request.user, theme.review
        )
        serializer.save()

    def perform_destroy(self, instance):
        check_permission(
            Permission.MODIFY_THEMES_CODES, self.request.user, instance.review
        )
        instance.delete()


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


class ExtractionSectionViewSet(viewsets.ModelViewSet):
    queryset = ExtractionSection.objects.all()
    serializer_class = ExtractionSectionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]


class ExtractionQuestionViewSet(viewsets.ModelViewSet):
    queryset = ExtractionQuestion.objects.all()
    serializer_class = ExtractionQuestionSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["section"]


class ExtractionAnswerViewSet(viewsets.ModelViewSet):
    queryset = ExtractionAnswer.objects.all()
    serializer_class = ExtractionAnswerSerializer
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["reference", "question"]

    def create(self, request, *args, **kwargs):
        """
        Create or update answer - returns existing answer if reference-question pair exists
        """
        reference_id = request.data.get("reference")
        question_id = request.data.get("question")

        # Check if answer already exists
        existing_answer = ExtractionAnswer.objects.filter(
            reference=reference_id, question=question_id
        ).first()

        if existing_answer:
            # Update existing answer
            serializer = self.get_serializer(
                existing_answer, data=request.data, partial=True
            )
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        else:
            # Create new answer
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            headers = self.get_success_headers(serializer.data)
            return Response(
                serializer.data, status=status.HTTP_201_CREATED, headers=headers
            )

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        """
        Save all answers for a reference in a single transaction
        """
        serializer = ExtractionAnswerBulkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_id = serializer.validated_data["reference_id"]
        answers_dict = serializer.validated_data["answers"]

        saved_answers = []

        with transaction.atomic():
            for question_id_str, value in answers_dict.items():
                question_id = int(question_id_str)

                answer, _ = ExtractionAnswer.objects.update_or_create(
                    reference_id=reference_id,
                    question_id=question_id,
                    defaults={"value": value},
                )
                saved_answers.append(answer)

        result_serializer = ExtractionAnswerSerializer(saved_answers, many=True)
        return Response(
            {"saved_count": len(saved_answers), "answers": result_serializer.data},
            status=status.HTTP_200_OK,
        )


class ExtractionTableViewSet(viewsets.ViewSet):
    """
    ViewSet for extraction table operations
    """

    @action(detail=False, methods=["get"], url_path="table-data")
    def table_data(self, request):
        """
        Get all data needed for extraction table in a single request
        """
        review_id = request.query_params.get("review")

        if not review_id:
            return Response(
                {"error": "review is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get questions with sections, ordered
        questions = (
            ExtractionQuestion.objects.filter(section__review=review_id)
            .select_related("section")
            .order_by("section__order", "order")
        )

        # Get references with prefetched answers for efficiency
        references = (
            Reference.objects.filter(review=review_id, in_extraction=True)
            .prefetch_related(
                Prefetch(
                    "extraction_answers",
                    queryset=ExtractionAnswer.objects.select_related("question"),
                ),
                Prefetch(
                    "labels",
                    queryset=ReferenceLabel.objects.filter(
                        label__user=self.request.user
                    ).select_related("label"),
                    to_attr="prefetched_labels",
                ),
            )
            .select_related("assignee__user")
        )

        serializer = ExtractionTableDataSerializer(
            {"questions": questions, "references": references},
            context={"request": request},
        )

        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        """
        Export extraction data as CSV
        """
        review_id = request.query_params.get("review_id")

        if not review_id:
            return Response(
                {"error": "review_id is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        # Get questions with sections, ordered
        questions = (
            ExtractionQuestion.objects.filter(section__review_id=review_id)
            .select_related("section")
            .order_by("section__order", "order")
        )

        # Get references with prefetched answers
        references = (
            Reference.objects.filter(review_id=review_id)
            .prefetch_related(
                Prefetch(
                    "extraction_answers",
                    queryset=ExtractionAnswer.objects.select_related("question"),
                )
            )
            .order_by("id")
        )

        # Create CSV response
        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="extraction_data_review_{review_id}.csv"'
        )

        writer = csv.writer(response)

        # Write header row
        header = ["Title"]
        for question in questions:
            header.append(question.column_title)
        writer.writerow(header)

        # Write data rows
        for ref in references:
            row = [ref.title]

            # Create answers dict for quick lookup
            answers_dict = {}
            for answer in ref.extraction_answers.all():
                answers_dict[answer.question_id] = answer.value

            # Add answer values in question order
            for question in questions:
                row.append(answers_dict.get(question.id, ""))

            writer.writerow(row)

        return response

    @action(detail=False, methods=["post"], url_path="bulk-update-status")
    def bulk_update_status(self, request):
        """
        Bulk update extraction completion status for multiple references
        """
        serializer = BulkUpdateExtractionStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        reference_ids = serializer.validated_data["reference_ids"]
        is_extraction_completed = serializer.validated_data["is_extraction_completed"]

        # Update references
        updated_count = Reference.objects.filter(id__in=reference_ids).update(
            is_extraction_completed=is_extraction_completed
        )

        return Response(
            {
                "updated_count": updated_count,
                "reference_ids": reference_ids,
                "is_extraction_completed": is_extraction_completed,
            },
            status=status.HTTP_200_OK,
        )
