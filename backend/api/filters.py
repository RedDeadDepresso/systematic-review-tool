from django_filters import rest_framework as filters

from api.models import Reference, Review


class ReviewFilter(filters.FilterSet):
    title = filters.CharFilter(field_name="title", lookup_expr="icontains")

    class Meta:
        model = Review
        fields = ["title", "is_active"]


# Reusable "InFilter" for numbers
class NumberInFilter(filters.BaseInFilter, filters.NumberFilter):
    pass


# Reusable "InFilter" for strings
class CharInFilter(filters.BaseInFilter, filters.CharFilter):
    pass


class ReferenceFilter(filters.FilterSet):
    # Filters
    search_method_ids = NumberInFilter(field_name="search_method_id", lookup_expr="in")
    # include_keyword_ids = NumberInFilter(method="filter_include_keywords")
    # exclude_keyword_ids = NumberInFilter(method="filter_exclude_keywords")
    label_ids = NumberInFilter(field_name="labels__id", lookup_expr="in")
    duplicate_statuses = CharInFilter(field_name="duplicate_status", lookup_expr="in")
    search = filters.CharFilter(method="filter_search")

    class Meta:
        model = Reference
        fields = []

    # Text search in title
    def filter_search(self, queryset, name, value):
        if value:
            return queryset.filter(title__icontains=value)
        return queryset
