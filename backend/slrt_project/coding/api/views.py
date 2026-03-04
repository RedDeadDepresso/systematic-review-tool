from django_filters import rest_framework as filters
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
from slrt_project.permissions import Permission, check_permission
from slrt_project.reviews.models import Review, ReviewMember


class CodingMixin:
    def get_object(self):
        obj = super().get_object()
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, obj.review)
        return obj

    def list(self, request, *args, **kwargs):
        review_id = request.query_params.get("review")

        if not review_id:
            return Response(
                {"error": "review is required"}, status=status.HTTP_400_BAD_REQUEST
            )
        review = get_object_or_404(Review, pk=review_id)
        check_permission(Permission.ACCESS_REVIEW, request.user, review)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        review_id = self.request.data.get("review")
        if not review_id:
            raise serializer.ValidationError("Review is required")

        review = get_object_or_404(Review, pk=review_id)

        member = get_object_or_404(ReviewMember, review=review, user=self.request.user)
        check_permission(Permission.MODIFY_THEMES_CODES, self.request.user, review)

        serializer.save(member=member)


class CodeViewSet(CodingMixin, viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete codes"""

    serializer_class = CodeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]

    def get_queryset(self):
        return Code.objects.select_related("reference")


class SubThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete subthemes"""

    serializer_class = SubThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = SubTheme.objects.all()


class MainThemeViewSet(CodingMixin, viewsets.ModelViewSet):
    """Owner and collaborator can create/update/delete themes"""

    serializer_class = MainThemeSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [filters.DjangoFilterBackend]
    filterset_fields = ["review"]
    queryset = MainTheme.objects.all()
