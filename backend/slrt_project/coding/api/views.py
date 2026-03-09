"""
Views for the coding app.

ViewSet inventory
-----------------
CodeViewSet
    Full CRUD for Code instances.  Filtered by ``review`` query param.
    ``get_queryset`` selects related ``reference`` to avoid N+1 queries
    from CodeSerializer's ``get_reference_title`` / ``get_reference_file_url``.

SubThemeViewSet
    Full CRUD for SubTheme instances.  Filtered by ``review`` query param.

MainThemeViewSet
    Full CRUD for MainTheme instances.  Filtered by ``review`` query param.

Mixin
-----
CodingMixin
    Shared behaviour applied to all three ViewSets:

    get_object   — calls check_permission(MODIFY_THEMES_CODES) on the
                   object's review before returning it, enforcing object-level
                   permission on retrieve / update / destroy.

    list         — requires the ``review`` query param and calls
                   check_permission(ACCESS_REVIEW) before delegating to the
                   base implementation.

    perform_create — resolves the review and the caller's ReviewMember from
                     request.data, calls check_permission(MODIFY_THEMES_CODES),
                     then saves with member= set automatically so the client
                     cannot spoof the creating member.
"""

from django_filters import rest_framework as filters
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from slrt_project.coding.api.serializers import (
    CodeSerializer,
    MainThemeSerializer,
    SubThemeSerializer,
)
from slrt_project.coding.models import Code, MainTheme, SubTheme
from slrt_project.reviews.models import Review, ReviewMember
from slrt_project.shared.permissions import Permission, check_permission


# ===========================================================================
# Shared mixin
# ===========================================================================


class CodingMixin:
    """
    Permission-aware behaviour shared by all coding ViewSets.

    Applied as a left-most mixin so its method resolution order takes
    priority over the ModelViewSet base class.
    """

    @extend_schema(
        summary="Retrieve a single object",
        responses={
            200: None,  # child class overrides with its own serializer
            403: OpenApiResponse(description="Permission denied"),
            404: OpenApiResponse(description="Not found"),
        },
    )
    def get_object(self):
        """
        Retrieve the object and assert MODIFY_THEMES_CODES permission.

        Called by retrieve, update, partial_update, and destroy.  If the
        caller lacks permission check_permission raises PermissionDenied,
        which DRF converts to a 403 response.
        """
        obj = super().get_object()
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, obj.review)
        return obj

    @extend_schema(
        summary="List objects for a review",
        parameters=[
            OpenApiParameter(
                "review",
                int,
                description="Review PK (required). Only objects belonging to this review are returned.",
            ),
        ],
        responses={
            400: OpenApiResponse(description="'review' query param missing"),
            403: OpenApiResponse(
                description="Caller does not have ACCESS_REVIEW permission"
            ),
        },
    )
    def list(self, request, *args, **kwargs):
        """
        Return all objects for the given review.

        Requires the ``review`` query param.  Returns 400 if it is absent
        and 403 (via check_permission) if the caller cannot access the review.
        """
        review_id = request.query_params.get("review")
        if not review_id:
            return Response(
                {"error": "review is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.ACCESS_REVIEW, request.user, review)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        """
        Save a new object, resolving member from the request user.

        Looks up the Review from request.data["review"] and the caller's
        ReviewMember from that review, then asserts MODIFY_THEMES_CODES
        permission before saving.  This means the client never needs to send
        a ``member`` field — it is always inferred server-side.

        Raises
        ------
        ValidationError
            When ``review`` is absent from the request body.
        Http404
            When the review or reviewer membership does not exist.
        PermissionDenied
            When the caller lacks MODIFY_THEMES_CODES on the review.
        """
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")
        review = get_object_or_404(Review, pk=review_id)
        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)
        serializer.save(member=member)


# ===========================================================================
# CodeViewSet
# ===========================================================================


@extend_schema(tags=["Coding — Codes"])
class CodeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for qualitative Codes.

    Codes are the leaf nodes of the coding hierarchy.  Each Code stores the
    full react-pdf-highlighter payload (``content``, ``position``) together
    with optional thematic grouping (``sub_theme``), visual style, and a
    reviewer comment.

    ``get_queryset`` selects the related ``reference`` in one query to avoid
    N+1 hits from the ``reference_title`` / ``reference_file_url`` computed
    fields on CodeSerializer.

    Filtering
    ---------
    ``?review=<pk>``  — required on list; returns only codes for that review.
    """

    serializer_class = CodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """
        Return all Codes with their reference pre-fetched.

        select_related("reference") avoids per-code DB hits when
        CodeSerializer reads reference.title and reference.file.
        """
        return Code.objects.select_related("reference")


# ===========================================================================
# SubThemeViewSet
# ===========================================================================


@extend_schema(tags=["Coding — SubThemes"])
class SubThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for SubThemes.

    SubThemes optionally belong to a MainTheme and group related Codes.
    The ``code_ids`` field on the serializer lists all Code PKs in this
    sub-theme without triggering an N+1 query (the reverse relation is
    resolved by DRF's PrimaryKeyRelatedField in a single prefetch when
    the queryset is used with prefetch_related).

    Filtering
    ---------
    ``?review=<pk>``  — required on list; returns only sub-themes for that review.
    """

    serializer_class = SubThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = SubTheme.objects.all()


# ===========================================================================
# MainThemeViewSet
# ===========================================================================


@extend_schema(tags=["Coding — MainThemes"])
class MainThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for MainThemes.

    MainThemes are the top-level thematic groupings.  The ``sub_theme_ids``
    field lists all child SubTheme PKs so clients can build the full
    theme tree without a separate SubTheme list call.

    Filtering
    ---------
    ``?review=<pk>``  — required on list; returns only themes for that review.
    """

    serializer_class = MainThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = MainTheme.objects.all()
