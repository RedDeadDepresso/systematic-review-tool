import json
import os

import bibtexparser
from django.core.files.storage import default_storage
from django.db import transaction
from django.db.models import Count, Prefetch, Q
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters import rest_framework as filters
from djangorestframework_camel_case.parser import CamelCaseJSONParser
from rest_framework import serializers, status, viewsets
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

from api.filters import ReviewFilter
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
    UploadedPDF,
    User,
)
from api.serializers import (
    AttachPDFsSerializer,
    CodeSerializer,
    KeywordSerializer,
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
            )
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
        print(request.data)
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
    def upsert(self, request):
        return self.update(request)


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

        pair = ReferenceDuplicatePair.objects.filter(review=review).first()
        if not pair:
            return Response(
                {"detail": "No reference duplicate pair found."},
                status=status.HTTP_200_OK,
            )

        serializer = ReferenceDuplicatePairSerializer(pair)
        return Response(serializer.data)

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        review = self._get_review()
        duplicate_pair = get_object_or_404(
            ReferenceDuplicatePair,
            pk=pk,
            review=review,
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
    filterset_fields = ["reference", "reference__review"]

    def get_queryset(self):
        """
        Returns notes the user has access to.
        Can filter by query params: ?reference=ID or ?review=ID
        """
        queryset = Note.objects.all()

        # Get filters from query params
        reference_id = self.request.query_params.get("reference")
        review_id = self.request.query_params.get("review")

        if reference_id:
            queryset = queryset.filter(reference_id=reference_id)
        elif review_id:
            queryset = queryset.filter(reference__review_id=review_id)

        # Only include notes from reviews the user can access
        queryset = queryset.filter(
            reference__review__owner=self.request.user
        ) | queryset.filter(reference__review__collaborators=self.request.user)

        # Handle blinded reviews: only show own notes
        blinded_reviews = queryset.filter(reference__review__is_blinded=True)
        queryset = queryset.exclude(
            reference__review__is_blinded=True
        ) | blinded_reviews.filter(author=self.request.user)

        return queryset.distinct()

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
