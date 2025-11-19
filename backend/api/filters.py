from django_filters import rest_framework as filters

from api.models import Keyword, Review


class ReviewFilter(filters.FilterSet):
    title = filters.CharFilter(field_name="title", lookup_expr="icontains")

    class Meta:
        model = Review
        fields = ["title", "is_active"]


class KeywordFilter(filters.FilterSet):
    is_inclusive = filters.BooleanFilter(field_name="is_inclusive")

    class Meta:
        model = Keyword
        fields = ["is_inclusive"]
