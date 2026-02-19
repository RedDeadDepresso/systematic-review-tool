from django_filters import rest_framework as filters

from slrt_project.reviews.models import Review


class ReviewFilter(filters.FilterSet):
    title = filters.CharFilter(field_name="title", lookup_expr="icontains")

    class Meta:
        model = Review
        fields = ["title", "is_active"]
