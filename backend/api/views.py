import json
import os
from datetime import date

import bibtexparser
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, F, Prefetch, Q
from django.db.models.functions import ExtractYear
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from djangorestframework_camel_case.parser import CamelCaseJSONParser
from rest_framework import generics, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAuthenticated,
)
from rest_framework.response import Response

from api.filters import ReferenceFilter, ReviewFilter
from api.models import (
    Code,
    Keyword,
    Label,
    MainTheme,
    Note,
    Reference,
    ReferenceDuplicatePair,
    ReferenceLabel,
    ReferenceOpinion,
    Review,
    ReviewInvitation,
    SearchMethod,
    SubTheme,
    UploadedPDF,
    User,
)
from api.serializers import (
    AssignReferencesSerializer,
    AttachPDFsSerializer,
    BulkCreateNoteSerializer,
    CodeSerializer,
    KeywordSerializer,
    LabelSerializer,
    MainThemeSerializer,
    NoteSerializer,
    ReferenceDuplicatePairSerializer,
    ReferenceOpinionSerializer,
    ReferenceSerializer,
    ReviewInvitationCreateSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewSerializer,
    SubThemeSerializer,
    UploadedPDFSerializer,
    UserSerializer,
)


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


def is_owner_or_collaborator(user, review):
    """
    Check if the user is the owner of the review or a collaborator.
    """
    return review.owner == user or user in review.collaborators.all()


class IsOwnerOrCollaboratorReadOnly(BasePermission):
    """
    Owners can do anything.
    Collaborators can only read.
    Others get no access.
    """

    def has_object_permission(self, request, view, obj):
        user = request.user

        # SAFE METHODS: collaborators + owner can view
        if request.method in SAFE_METHODS:
            return is_owner_or_collaborator(user, obj)

        # WRITE METHODS: only owner
        return user == obj.owner


class ReviewViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing reviews and related operations.

    Provides standard CRUD operations plus custom actions:
    - upload_references: Upload BibTeX file
    - export_latex: Export themes table as LaTeX
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
        """Filter reviews to those owned by or shared with the user"""
        user = self.request.user
        queryset = Review.objects.filter(
            Q(owner=user) | Q(collaborators=user)
        ).distinct()

        # Only annotate for list view to optimize performance
        if self.action == "list":
            queryset = queryset.annotate(reference_count=Count("reference"))

        return queryset

    def get_serializer_class(self):
        """Use different serializers for list vs detail views"""
        if self.action == "list":
            return ReviewListSerializer
        return ReviewSerializer

    def get_permissions(self):
        """Apply stricter permissions for update/delete"""
        if self.action in ["update", "partial_update", "destroy"]:
            return [IsAuthenticated(), IsOwnerOrCollaboratorReadOnly()]
        return [IsAuthenticated()]

    def perform_create(self, serializer):
        """Set the owner to the current user when creating"""
        serializer.save(owner=self.request.user)

    # === Custom Actions ===

    @action(detail=True, methods=["post"], url_path="upload-references")
    def upload_references(self, request, pk=None):
        """
        Upload BibTeX file to add references to review.

        Expected multipart/form-data with 'file' field containing .bib file.
        """
        review = self.get_object()

        # Check ownership
        if review.owner != request.user:
            return Response(
                {"error": "Only the review owner can upload references"},
                status=status.HTTP_403_FORBIDDEN,
            )

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

    @action(detail=True, methods=["get"], url_path="export-json")
    def export_json(self, request, pk=None):
        """
        Export themes, subthemes, and codes as structured JSON.

        Query parameters:
        - download: 'true' to download as .json file
        - pretty: 'true' for formatted JSON (default: true)
        """
        review = self.get_object()

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

    # Also update the export_latex action to support both formats
    @action(detail=True, methods=["get", "post"], url_path="export-latex")
    def export_latex(self, request, pk=None):
        """
        Export themes table as LaTeX code.

        Query parameters (GET):
        - download: 'true' to download as .tex file
        - format: 'table_only' or 'full_document' (default: 'full_document' for downloads, 'table_only' for JSON)
        """
        review = self.get_object()

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


class ReferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for References:
    - list, retrieve, update
    - Access restricted to review owners or collaborators
    - Blinded review handling
    """

    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """
        Returns references for reviews the user has access to.
        Handles blinded reviews by prefetching only the current user's opinions.
        Can filter by review via query param ?review=ID
        """
        user = self.request.user
        review_id = self.request.query_params.get("review")

        queryset = Reference.objects.all()

        if review_id:
            review = get_object_or_404(Review, pk=review_id)
            if not is_owner_or_collaborator(user, review):
                return Reference.objects.none()
            queryset = queryset.filter(review=review)
        else:
            queryset = queryset.filter(
                Q(review__owner=user) | Q(review__collaborators=user)
            )

        return queryset.prefetch_related(
            Prefetch(
                "referenceopinion_set",
                queryset=ReferenceOpinion.objects.select_related("reviewer").only(
                    "id",
                    "status",
                    "reviewer__first_name",
                    "reviewer__last_name",
                    "reviewer__email",
                ),
                to_attr="prefetched_opinions",
            ),
            "labels",
        ).distinct()

    def perform_update(self, serializer):
        """
        Only allow update if user has access to the review.
        """
        reference = self.get_object()
        review = reference.review

        if not is_owner_or_collaborator(self.request.user, review):
            raise PermissionDenied(
                "You do not have permission to update this reference."
            )

        serializer.save()

    @action(
        detail=False,
        methods=["post"],
        url_path="attach-pdfs",
        parser_classes=[CamelCaseJSONParser],
    )
    def attach_pdfs(self, request):
        serializer = AttachPDFsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        updated = []

        with transaction.atomic():
            for item in serializer.validated_data["mappings"]:
                reference = Reference.objects.select_for_update().get(
                    id=item["reference_id"]
                )
                uploaded_pdf = UploadedPDF.objects.select_for_update().get(
                    id=item["uploaded_pdf_id"]
                )

                # Permission check
                if not (
                    reference.review.owner == user
                    or reference.review.collaborators.filter(id=user.id).exists()
                ):
                    raise PermissionDenied("You do not have access to this review.")

                if uploaded_pdf.review_id != reference.review_id:
                    raise serializers.ValidationError(
                        "Uploaded PDF and reference must belong to the same review."
                    )

                # Delete existing reference file (if any)
                if reference.file and default_storage.exists(reference.file.name):
                    default_storage.delete(reference.file.name)

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

                # Delete uploaded PDF
                uploaded_pdf.delete()

        return Response({"updated_references": updated}, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="assign",
        parser_classes=[CamelCaseJSONParser],
    )
    def assign(self, request):
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
        if review.owner != user:
            return Response(
                {"detail": "Only the review owner can assign references"},
                status=status.HTTP_403_FORBIDDEN,
            )

        references = Reference.objects.filter(
            id__in=reference_ids,
            review=review,
        )

        assignable_users = User.objects.filter(
            id__in=[review.owner_id, *review.collaborators.values_list("id", flat=True)]
        )

        if mode == "assign":
            if not assignee_id:
                return Response(
                    {"detail": "assignee_id is required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            assignee = get_object_or_404(assignable_users, pk=assignee_id)
            references.update(assignee=assignee)

        elif mode == "remove":
            references.update(assignee=None)

        elif mode == "split_equally":
            assignees = list(assignable_users)

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


class ReviewDataView(generics.ListAPIView):
    serializer_class = ReferenceSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_class = ReferenceFilter

    def get_queryset(self):
        user = self.request.user
        review_id = self.request.query_params.get("review")

        queryset = Reference.objects.select_related(
            "assignee",
            "search_method",
            "review",
        )

        if review_id:
            review = get_object_or_404(Review, pk=review_id)
            if not is_owner_or_collaborator(user, review):
                return Reference.objects.none()
            queryset = queryset.filter(review=review)
        else:
            queryset = queryset.filter(
                Q(review__owner=user) | Q(review__collaborators=user)
            )

        # Prefetch ReferenceLabels for the current user only
        queryset = queryset.prefetch_related(
            Prefetch(
                "labels",
                queryset=ReferenceLabel.objects.filter(label__user=user).select_related(
                    "label"
                ),
                to_attr="user_labels",  # store them in a custom attribute
            )
        )

        return queryset

    def list(self, request, *args, **kwargs):
        """
        Return aggregated data along with references, including user labels.
        """
        review_id = request.query_params.get("review")
        if not review_id:
            return Response(
                {"error": "review parameter is required for list view"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        review = get_object_or_404(Review, pk=review_id)
        if not is_owner_or_collaborator(request.user, review):
            return Response(
                {"error": "You do not have permission to access this review"},
                status=status.HTTP_403_FORBIDDEN,
            )

        total_count = Reference.objects.filter(review_id=review_id).count()
        queryset = self.filter_queryset(self.get_queryset())
        filtered_count = queryset.count()

        page = self.paginate_queryset(queryset)
        references = page if page is not None else queryset

        # Serialize references
        serializer = ReferenceSerializer(
            references, many=True, context={"request": request}
        )

        # Search methods with counts
        search_methods = list(
            SearchMethod.objects.filter(review_id=review_id)
            .annotate(count=Count("reference"))
            .values("id", "name", "count")
        )

        # Keywords
        keywords = KeywordSerializer(
            Keyword.objects.filter(review_id=review_id), many=True
        )

        # Duplicate status counts
        duplicate_status_counts = (
            Reference.objects.filter(review_id=review_id)
            .values("duplicate_status")
            .annotate(count=Count("id"))
        )
        status_counts_dict = {
            "Unresolved": 0,
            "Deleted": 0,
            "Not Duplicate": 0,
            "Resolved": 0,
        }
        for item in duplicate_status_counts:
            status_value = item["duplicate_status"]
            if status_value in status_counts_dict:
                status_counts_dict[status_value] = item["count"]

        # Labels with counts (only user labels)
        labels_qs = Label.objects.filter(
            user=request.user, reference_labels__reference__review_id=review_id
        )
        labels = labels_qs.annotate(count=Count("reference_labels__reference")).values(
            "id", "name", "count"
        )

        # Publication type counts
        publication_types = list(
            Reference.objects.filter(review_id=review_id)
            .exclude(publication_type="")
            .values("publication_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Publication year counts
        publication_years = list(
            Reference.objects.filter(
                review_id=review_id, publication_date__isnull=False
            )
            .annotate(year=ExtractYear("publication_date"))
            .values("year")
            .annotate(count=Count("id"))
            .order_by("-year")
        )

        # File status counts
        file_counts = {
            "with_file": Reference.objects.filter(review_id=review_id)
            .exclude(file="")
            .count(),
            "without_file": Reference.objects.filter(
                review_id=review_id, file=""
            ).count(),
        }

        # Assignee counts
        assignees = list(
            Reference.objects.filter(review_id=review_id, assignee__isnull=False)
            .values(
                _id=F("assignee__id"),
                first_name=F("assignee__first_name"),
                last_name=F("assignee__last_name"),
                email=F("assignee__email"),
            )
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Add unassigned count
        unassigned_count = Reference.objects.filter(
            review_id=review_id, assignee__isnull=True
        ).count()
        if unassigned_count > 0:
            assignees.append(
                {
                    "id": None,
                    "first_name": None,
                    "last_name": None,
                    "email": None,
                    "count": unassigned_count,
                }
            )

        response_data = {
            "references": serializer.data,
            "total_count": total_count,
            "filtered_count": filtered_count,
            "search_methods": search_methods,
            "keywords": keywords.data,
            "duplicate_status_counts": status_counts_dict,
            "labels": list(labels),
            "publication_types": publication_types,
            "publication_years": publication_years,
            "file_counts": file_counts,
            "assignees": assignees,
        }

        return Response(response_data)


class ScreeningView(ReviewDataView):
    def get_queryset(self):
        queryset = super().get_queryset()
        queryset = (
            queryset.exclude(duplicate_status__in=["Undecided", "Deleted"])
            .prefetch_related(
                Prefetch(
                    "referenceopinion_set",
                    queryset=ReferenceOpinion.objects.select_related("reviewer").only(
                        "id",
                        "status",
                        "reviewer__first_name",
                        "reviewer__last_name",
                        "reviewer__email",
                    ),
                    to_attr="prefetched_opinions",
                )
            )
            .distinct()
        )
        return queryset


class ScreeningFullTextView(ScreeningView):
    pass


class ReferenceOpinionViewSet(viewsets.GenericViewSet):
    """
    ViewSet to manage a user's opinion on a reference.
    - Update: create or update the current user's opinion for a reference
    """

    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceOpinionSerializer
    queryset = ReferenceOpinion.objects.all()

    def get_object(self):
        reference_id = self.request.data.get("reference")

        if not reference_id:
            raise serializers.ValidationError({"reference": "This field is required."})

        reference = get_object_or_404(Reference, pk=reference_id)
        review = reference.review
        user = self.request.user

        # Access control
        if not is_owner_or_collaborator(user, review):
            raise PermissionDenied("You do not have access to this review.")

        opinion, _ = ReferenceOpinion.objects.get_or_create(
            reference=reference,
            reviewer=user,
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

    @action(detail=False, methods=["patch"], url_path="upsert")
    @transaction.atomic
    def upsert(self, request):
        reference_ids = request.data.get("reference_ids")
        reference_ids = request.data.get("reference_ids")
        reference_ids = list(set(reference_ids))
        status = request.data.get("status")

        if not reference_ids or not isinstance(reference_ids, list):
            raise serializers.ValidationError(
                {"reference_ids": "This field must be a non-empty list."}
            )

        if not status:
            raise serializers.ValidationError({"status": "This field is required."})

        user = request.user

        references = Reference.objects.filter(id__in=reference_ids).select_related(
            "review"
        )

        if references.count() != len(reference_ids):
            raise serializers.ValidationError("One or more references do not exist.")

        #  Access control (all references must belong to reviews user can access)
        reviews = {ref.review for ref in references}
        for review in reviews:
            if not is_owner_or_collaborator(user, review):
                raise PermissionDenied("You do not have access to one or more reviews.")

        existing_opinions = {
            op.reference_id: op
            for op in ReferenceOpinion.objects.filter(
                reference_id__in=reference_ids,
                reviewer=user,
            )
        }

        to_create = []
        to_update = []

        for ref in references:
            if ref.id in existing_opinions:
                opinion = existing_opinions[ref.id]
                opinion.status = status
                to_update.append(opinion)
            else:
                to_create.append(
                    ReferenceOpinion(
                        reference=ref,
                        reviewer=user,
                        status=status,
                    )
                )

        if to_create:
            ReferenceOpinion.objects.bulk_create(to_create)

        if to_update:
            ReferenceOpinion.objects.bulk_update(to_update, ["status"])

        # Return updated opinions
        opinions = ReferenceOpinion.objects.filter(
            reference_id__in=reference_ids,
            reviewer=user,
        )

        serializer = self.get_serializer(opinions, many=True)
        return Response(serializer.data)


class ReferenceDuplicatePairViewSet(viewsets.ViewSet):
    """
    ViewSet to handle reference duplicate detection and resolution.
    - Detect: run duplicate detection for a review (owner only)
    - List: retrieve the next unresolved duplicate pair for a review
    - Resolve: keep one reference and delete the other (owner only)
    """

    permission_classes = [IsAuthenticated]

    def _get_review(self):
        return get_object_or_404(
            Review,
            pk=self.request.query_params.get("review"),
            owner=self.request.user,
        )

    @action(detail=False, methods=["post"])
    def detect(self, request):
        review = self._get_review()

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
        review = self._get_review()

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
        duplicate_pair = get_object_or_404(
            ReferenceDuplicatePair,
            pk=pk,
        )
        try:
            selection = int(request.data.get("selection"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Selection must be an integer (1 or 2)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reference_1 = duplicate_pair.reference1
        reference_2 = duplicate_pair.reference2

        if selection == 1:
            # Mark reference1 as Resolved, reference2 as Deleted
            self.set_duplicate_statuses(reference_1, "Resolved", reference_2, "Deleted")
        elif selection == 2:
            # Mark reference2 as Resolved, reference1 as Deleted
            self.set_duplicate_statuses(reference_1, "Deleted", reference_2, "Resolved")
        elif selection == 3:
            # Mark both references as Not Duplicate
            self.set_duplicate_statuses(
                reference_1, "Not Duplicate", reference_2, "Not Duplicate"
            )
        else:
            return Response(
                {"detail": "Invalid selection. Must be 1 or 2."},
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
    - Permissions enforced for review owner/collaborators
    - Create keywords linked to a review via POST data
    """

    serializer_class = KeywordSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review", "is_inclusive"]

    def get_queryset(self):
        """
        Returns keywords for reviews the user has access to.
        Can filter by query param ?review=ID
        """
        queryset = Keyword.objects.all()
        review_id = self.request.query_params.get("review")

        if review_id:
            queryset = queryset.filter(review_id=review_id)

        # Only include keywords for reviews user can access
        queryset = queryset.filter(review__owner=self.request.user) | queryset.filter(
            review__collaborators=self.request.user
        )

        return queryset.distinct()

    def perform_create(self, serializer):
        """
        Save a new keyword linked to a review from POST data.
        Enforces permission check.
        """
        review_id = self.request.data.get("review")
        if not review_id:
            raise PermissionDenied("Review must be provided.")

        review = get_object_or_404(Review, pk=review_id)

        if not is_owner_or_collaborator(self.request.user, review):
            raise PermissionDenied(
                "You do not have permission to add keywords to this review."
            )

        serializer.save(review=review)


class NoteViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Notes with:
    - Filtering by reference or review
    - Permissions for review owner/collaborators
    - Blinded review handling
    """

    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["reference"]

    def get_object(self):
        obj = super().get_object()
        review = obj.reference.review
        user = self.request.user

        if not is_owner_or_collaborator(user, review):
            raise PermissionDenied("You do not have access to this note.")

        # Blinded review rule
        if review.is_blinded and obj.author != user:
            raise PermissionDenied("You cannot access this note.")

        return obj

    def get_queryset(self):
        """
        Returns notes the user has access to.
        Can filter by query params: ?reference=ID or ?review=ID
        """
        queryset = Note.objects.all()

        # Get filters from query params
        reference_id = self.request.query_params.get("reference")
        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)

        # Only include notes from reviews the user can access
        queryset = queryset.filter(
            reference__review__owner=self.request.user
        ) | queryset.filter(reference__review__collaborators=self.request.user)

        # Handle blinded reviews: only show own notes
        blinded_reviews = queryset.filter(reference__review__is_blinded=True)
        queryset = queryset.exclude(
            reference__review__is_blinded=True
        ) | blinded_reviews.filter(author=self.request.user)

        return queryset.distinct().select_related("author")

    def perform_create(self, serializer):
        """
        Saves a new note using the reference ID from POST request data.
        Ensures the user has access to the review.
        """
        reference_id = self.request.data.get("reference")
        if not reference_id:
            raise PermissionDenied("Reference must be provided.")

        reference = get_object_or_404(Reference, pk=reference_id)
        review = reference.review

        if not is_owner_or_collaborator(self.request.user, review):
            raise PermissionDenied(
                "You do not have permission to add notes to this review."
            )

        serializer.save(author=self.request.user, reference=reference)

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
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

            if not is_owner_or_collaborator(request.user, review):
                raise PermissionDenied(f"No permission for review {review.id}")

            notes.append(
                Note(
                    author=request.user,
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
    - Create: only review owner can send invitations
    - List: sent or received invitations via query param ?sent=true/false
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
        Default → received invitations
        """
        sent_param = self.request.query_params.get("sent", "false").lower() == "true"
        user = self.request.user

        if sent_param:
            return ReviewInvitation.objects.filter(invited_by=user)
        else:
            return ReviewInvitation.objects.filter(email=user.email)

    def create(self, request, *args, **kwargs):
        review_id = request.data.get("review")
        emails = request.data.get("emails", [])

        review = get_object_or_404(Review, pk=review_id)
        if review.owner != request.user:
            raise PermissionDenied("You are not the owner of this review.")

        created_invitations = []
        for email in emails:
            if email == request.user.email:
                continue
            invitation = ReviewInvitation.objects.create(
                email=email, review=review, invited_by=request.user
            )
            created_invitations.append(invitation)

        serializer = ReviewInvitationSerializer(created_invitations, many=True)
        return Response(serializer.data, status=201)

    def update(self, request, pk=None):
        """
        Accept or decline an invitation.
        Only the recipient (email) can perform this.
        """
        invitation = get_object_or_404(
            ReviewInvitation, pk=pk, email=request.user.email
        )
        action = request.data.get("action", "").lower()

        if action == "accept":
            invitation.review.collaborators.add(request.user)
            invitation.delete()
            return Response(
                {"detail": "Invitation accepted."}, status=status.HTTP_200_OK
            )
        elif action == "decline":
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
    serializer_class = CodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        return Code.objects.select_related("reference").filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class SubThemeViewSet(viewsets.ModelViewSet):
    serializer_class = SubThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        return SubTheme.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class MainThemeViewSet(viewsets.ModelViewSet):
    serializer_class = MainThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        return MainTheme.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class UploadedPDFViewSet(viewsets.ModelViewSet):
    serializer_class = UploadedPDFSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return UploadedPDF.objects.filter(
            Q(review__owner=user) | Q(review__collaborators=user)
        ).distinct()

    def perform_create(self, serializer):
        review = serializer.validated_data["review"]
        user = self.request.user

        if not (
            review.owner == user or review.collaborators.filter(id=user.id).exists()
        ):
            raise PermissionDenied("You do not have access to this review.")

        serializer.save()


class LabelViewSet(viewsets.ModelViewSet):
    serializer_class = LabelSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Label.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=["post"], url_path="assign-to-references")
    def assign_to_references(self, request):
        """
        Custom action to assign/unassign labels to multiple references.
        Expects payload:
        {
            "reference_ids": [1, 2, 3],
            "checked_label_ids": [1, 2],
            "indeterminate_label_ids": [3]
        }
        """
        user = request.user
        reference_ids = request.data.get("reference_ids", [])
        if reference_ids:
            reference_ids = request.data.get("reference_ids")
            reference_ids = list(set(reference_ids))
        checked_label_ids = request.data.get("checked_label_ids", [])
        indeterminate_label_ids = request.data.get("indeterminate_label_ids", [])

        if not reference_ids:
            return Response(
                {"detail": "reference_ids is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Fetch labels belonging to the user
        labels = Label.objects.filter(
            user=user, id__in=set(checked_label_ids + indeterminate_label_ids)
        )
        labels_map = {label.id: label for label in labels}

        # Fetch references
        references = Reference.objects.filter(id__in=reference_ids)

        created_count = 0
        deleted_count = 0

        with transaction.atomic():
            # Create ReferenceLabels for checked_label_ids
            for ref in references:
                for label_id in checked_label_ids:
                    label = labels_map.get(label_id)
                    if label:
                        obj, created = ReferenceLabel.objects.get_or_create(
                            reference=ref,
                            label=label,
                        )
                        if created:
                            created_count += 1

            # Delete ReferenceLabels for indeterminate_label_ids
            to_delete = ReferenceLabel.objects.filter(
                reference_id__in=reference_ids,
                label_id__in=indeterminate_label_ids,
            )
            deleted_count = to_delete.count()
            to_delete.delete()

        return Response(
            {
                "detail": "Labels updated for references.",
                "created": created_count,
                "deleted": deleted_count,
            },
            status=status.HTTP_200_OK,
        )
