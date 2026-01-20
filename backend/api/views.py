import json
import os

import bibtexparser
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import generics, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import (
    SAFE_METHODS,
    AllowAny,
    BasePermission,
    IsAuthenticated,
)
from rest_framework.response import Response

from api.filters import KeywordFilter, ReviewFilter
from api.models import (
    Code,
    Keyword,
    MainTheme,
    Note,
    Reference,
    ReferenceDuplicatePair,
    ReferenceOpinion,
    Review,
    ReviewInvitation,
    SubTheme,
    User,
)
from api.serializers import (
    CodeSerializer,
    KeywordSerializer,
    MainThemeSerializer,
    NoteSerializer,
    ReferenceDuplicatePairSerializer,
    ReferenceOpinionSerializer,
    ReferenceSerializer,
    RegisterSerializer,
    ReviewInvitationSerializer,
    ReviewListSerializer,
    ReviewSerializer,
    SubThemeSerializer,
)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer


class RetrieveUserView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        user = request.user
        user_data = {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "display_name": str(user),
            "avatar": "",
        }
        return Response(user_data, status=status.HTTP_200_OK)


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
            return user == obj.owner or user in obj.collaborators.all()

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

        search_methods = f"Uploaded References [{uploaded_file.name}]"
        references = [
            self._extract_reference_fields(review.id, search_methods, entry)
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

    def _extract_reference_fields(self, review_id, search_methods, entry):
        """Extract reference fields from BibTeX entry"""
        publication_types = {
            "article": "Journal Article",
            "book": "Book",
            "inproceedings": "Conference Paper",
            "phdthesis": "PhD Thesis",
            "mastersthesis": "Master's Thesis",
            "techreport": "Technical Report",
            "misc": "Miscellaneous",
        }

        publication_type = publication_types.get(
            entry.get("ENTRYTYPE", "").lower(), "Other"
        )

        authors = (
            ", ".join(a.strip() for a in entry.get("author", "").split(" and "))
            if "author" in entry
            else ""
        )

        journal = entry.get("journal") or entry.get("booktitle") or ""
        article_customizations = entry.get("note") or entry.get("howpublished")

        return Reference(
            review_id=review_id,
            title=entry.get("title", "No Title"),
            publication_types=publication_type,
            authors=authors,
            journal=journal,
            search_methods=search_methods,
            article_customizations=article_customizations or "",
            abstract=entry.get("abstract", ""),
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


class ReferenceListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer
    pagination_class = None

    def get_queryset(self):
        review_id = self.kwargs["pk"]
        user = self.request.user
        review = get_object_or_404(Review, pk=review_id)

        # Access control
        if not (review.owner == user or user in review.collaborators.all()):
            return Reference.objects.none()

        qs = Reference.objects.filter(review=review_id)

        if review.is_blinded:
            # Blinded -> ONLY this user's opinion
            qs = qs.prefetch_related(
                Prefetch(
                    "referenceopinion_set",
                    queryset=ReferenceOpinion.objects.filter(reviewer=user)
                    .select_related("reviewer")
                    .only(
                        "id",
                        "status",
                        "reviewer__first_name",
                        "reviewer__last_name",
                        "reviewer__email",
                    ),
                    to_attr="opinions_for_user",
                )
            )
        else:
            # Not blinded -> include ALL opinions
            qs = qs.prefetch_related(
                Prefetch(
                    "referenceopinion_set",
                    queryset=ReferenceOpinion.objects.select_related("reviewer").only(
                        "id",
                        "status",
                        "reviewer__first_name",
                        "reviewer__last_name",
                        "reviewer__email",
                    ),
                    to_attr="opinions_all",
                )
            )

        return qs


class ReferenceOpinionUpdateView(generics.UpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceOpinionSerializer

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        reference_id = self.kwargs["reference_pk"]

        review = get_object_or_404(Review, pk=review_id)

        if not (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            return ReferenceOpinion.objects.none()

        return ReferenceOpinion.objects.filter(
            reference_id=reference_id, reviewer=self.request.user
        )

    def get_object(self):
        review_id = self.kwargs["review_pk"]
        reference_id = self.kwargs["reference_pk"]

        review = get_object_or_404(Review, pk=review_id)
        reference = get_object_or_404(Reference, pk=reference_id, review=review)

        opinion, created = ReferenceOpinion.objects.get_or_create(
            reference=reference, reviewer=self.request.user
        )
        return opinion


class ReferenceRetrieveUpdateView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        reference_pk = self.kwargs["pk"]
        review = get_object_or_404(Review, pk=review_id)
        if (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            return Reference.objects.filter(review=review, pk=reference_pk)
        return Reference.objects.none()


class ReferenceDuplicatePairCreateView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceSerializer

    def post(self, request, *args, **kwargs):
        review_id = self.kwargs["review_pk"]
        review = get_object_or_404(Review, pk=review_id, owner=self.request.user)
        if review.reference_duplicate_detected:
            return Response(
                {
                    "error": "Duplicate detection has already been performed for this review."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = Reference.objects.filter(review=review)
        created_count = ReferenceDuplicatePair.create_pairs(review, queryset)

        review.reference_duplicate_detected = True
        review.save()

        return Response(
            {
                "duplicates_found_count": created_count,
            }
        )


class ReferenceDuplicatePairRetrieveView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = ReferenceDuplicatePairSerializer

    def get_object(self):
        review_id = self.kwargs.get("review_pk")
        review = get_object_or_404(Review, pk=review_id, owner=self.request.user)
        return ReferenceDuplicatePair.objects.filter(review=review).first()

    def get(self, request, *args, **kwargs):
        obj = self.get_object()
        if obj is None:
            return Response(
                {"detail": "No reference duplicate pair found for this review."},
                status=status.HTTP_200_OK,
            )
        serializer = self.get_serializer(obj)
        return Response(serializer.data)


class ReferenceDuplicatePairResolveView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        review_id = kwargs.get("review_pk")
        duplicate_pair_id = kwargs.get("pk")

        review = get_object_or_404(Review, pk=review_id, owner=request.user)
        duplicate_pair = get_object_or_404(
            ReferenceDuplicatePair, review=review, pk=duplicate_pair_id
        )

        try:
            selection = int(request.data.get("selection"))
        except (TypeError, ValueError):
            return Response(
                {"detail": "Selection must be an integer (1 or 2)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if selection == 1:
            duplicate_pair.reference2.delete()
        elif selection == 2:
            duplicate_pair.reference1.delete()
        else:
            return Response(
                {"detail": "Invalid selection. Must be 1 or 2."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate_pair.delete()
        return Response(
            {"detail": "Reference duplicate resolved successfully."},
            status=status.HTTP_200_OK,
        )


class KeywordListCreateView(generics.ListCreateAPIView):
    serializer_class = KeywordSerializer
    filter_backends = (filters.DjangoFilterBackend,)
    filterset_class = KeywordFilter

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        return Keyword.objects.filter(review_id=review_id)

    def perform_create(self, serializer):
        review_id = self.kwargs["review_pk"]
        serializer.save(review_id=review_id)


class NoteRetrieveUpdateDestroyView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]


class NoteListCreateView(generics.ListCreateAPIView):
    queryset = Note.objects.all()
    serializer_class = NoteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        review_id = self.kwargs["review_pk"]
        reference_id = self.kwargs["reference_pk"]
        review = get_object_or_404(Review, pk=review_id)
        if not (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            return Note.objects.none()
        reference = get_object_or_404(Reference, pk=reference_id, review=review)
        if review.is_blinded:
            queryset = Note.objects.filter(
                reference=reference, author=self.request.user
            )
        else:
            queryset = Note.objects.filter(reference=reference)
        return queryset

    def perform_create(self, serializer):
        review_id = self.kwargs["review_pk"]
        reference_id = self.kwargs["reference_pk"]

        review = get_object_or_404(Review, pk=review_id)
        if not (
            review.owner == self.request.user
            or self.request.user in review.collaborators.all()
        ):
            raise generics.PermissionDenied("You do not have permission to add notes.")
        reference = get_object_or_404(Reference, pk=reference_id, review=review)

        serializer.save(
            author=self.request.user,
            reference=reference,
        )


class ReviewInvitationCreateView(views.APIView):
    def post(self, request, *args, **kwargs):
        user = request.user
        review = get_object_or_404(Review, pk=kwargs["pk"], owner=user)
        emails = request.data.get("emails", [])
        for email in emails:
            if email == request.user.email:
                continue
            ReviewInvitation.objects.create(email=email, review=review, invited_by=user)
            # invite_link = request.build_absolute_uri(
            #     reverse("accept-invite", args=[str(invitation.token)])
            # )
            # send_mail(
            #     "You're invited to review!",
            #     f"Click to join the review: {invite_link}",
            #     "no-reply@example.com",
            #     [email],
            # )
        return Response(
            {"detail": "Invitations sent successfully."},
            status=status.HTTP_201_CREATED,
        )


class ReviewInvitationListView(generics.ListAPIView):
    serializer_class = ReviewInvitationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return ReviewInvitation.objects.filter(email=self.request.user.email)


class ReviewInvitationUpdateView(views.APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        invitation_id = kwargs.get("pk")
        invitation = get_object_or_404(
            ReviewInvitation, pk=invitation_id, email=request.user.email
        )

        action = request.data.get("action")
        if action == "accept":
            invitation.review.collaborators.add(request.user)
            invitation.delete()
            return Response(
                {"detail": "Invitation accepted."},
                status=status.HTTP_200_OK,
            )
        elif action == "decline":
            invitation.delete()
            return Response(
                {"detail": "Invitation declined."},
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {"detail": "Invalid action."},
                status=status.HTTP_400_BAD_REQUEST,
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
