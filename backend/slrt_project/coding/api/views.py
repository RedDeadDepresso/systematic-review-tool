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


# Shared mixin
class CodingMixin:
    """
    Permission-aware behaviour shared by all coding ViewSets.
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
        """
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")
        review = get_object_or_404(Review, pk=review_id)
        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)
        serializer.save(member=member)


# CodeViewSet
@extend_schema(tags=["Coding — Codes"])
class CodeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for qualitative Codes.

    Filtering
      ``?review=<pk>``  — required on list; returns only codes for that review.
    """

    serializer_class = CodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        """
        Return all Codes with their reference pre-fetched.
        """
        return Code.objects.select_related("reference")


# SubThemeViewSet
@extend_schema(tags=["Coding — SubThemes"])
class SubThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for SubThemes.

    Filtering
      ``?review=<pk>``  — required on list; returns only sub-themes for that review.
    """

    serializer_class = SubThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = SubTheme.objects.all()


# MainThemeViewSet
@extend_schema(tags=["Coding — MainThemes"])
class MainThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """
    CRUD endpoints for MainThemes.

    Filtering
      ``?review=<pk>``  — required on list; returns only themes for that review.
    """

    serializer_class = MainThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = MainTheme.objects.all()
