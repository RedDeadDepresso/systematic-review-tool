from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated

from slrt_project.coding.api.serializers import (
    CodeSerializer,
    MainThemeSerializer,
    SubThemeSerializer,
)
from slrt_project.coding.models import Code, MainTheme, SubTheme
from slrt_project.permissions import Permission, check_permission
from slrt_project.reviews.models import Review, ReviewMember


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
