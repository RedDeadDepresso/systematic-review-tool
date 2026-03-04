from django.contrib.postgres.search import SearchQuery
from django_filters import rest_framework as filters

from slrt_project.references.models import Reference, ReferenceCluster, ReferenceOpinion


# Reusable "InFilter" for numbers
class NumberInFilter(filters.BaseInFilter, filters.NumberFilter):
    pass


# Reusable "InFilter" for strings
class CharInFilter(filters.BaseInFilter, filters.CharFilter):
    pass


class ReferenceFilter(filters.FilterSet):
    search_method_ids = filters.BaseInFilter(
        field_name="search_method_id", lookup_expr="in"
    )
    label_ids = filters.BaseInFilter(method="filter_label_ids")
    include_keywords = CharInFilter(method="filter_include_keywords")
    exclude_keywords = CharInFilter(method="filter_exclude_keywords")
    search = filters.CharFilter(method="filter_free_text")
    duplicate_statuses = CharInFilter(field_name="duplicate_status", lookup_expr="in")
    publication_types = CharInFilter(field_name="publication_type", lookup_expr="in")
    publication_years = filters.BaseInFilter(method="filter_publication_years")
    has_file = filters.BooleanFilter(method="filter_has_file")
    assignee_ids = filters.BaseInFilter(field_name="assignee_id", lookup_expr="in")

    class Meta:
        model = Reference
        fields = []

    def filter_include_keywords(self, queryset, name, value):
        if not value:
            return queryset

        query = SearchQuery(
            " | ".join(value),
            search_type="raw",
        )

        return queryset.filter(search_vector=query)

    def filter_exclude_keywords(self, queryset, name, value):
        if not value:
            return queryset

        query = SearchQuery(
            " | ".join(value),
            search_type="raw",
        )
        queryset = queryset.exclude(search_vector=query)
        print(queryset.query)
        return queryset

    def filter_label_ids(self, queryset, name, value):
        print(value)
        if not value:
            return queryset

        user = self.request.user

        return queryset.filter(
            labels__label__id__in=value,
            labels__label__user=user,
        ).distinct()

    def filter_free_text(self, queryset, name, value):
        if not value:
            return queryset

        query = SearchQuery(value, search_type="websearch")
        return queryset.filter(search_vector=query)

    def filter_publication_years(self, queryset, name, value):
        if not value:
            return queryset
        return queryset.filter(publication_date__year__in=value)

    def filter_has_file(self, queryset, name, value):
        if value is None:
            return queryset
        if value:
            return queryset.exclude(file="")
        else:
            return queryset.filter(file="")


class ScreeningFilter(ReferenceFilter):
    opinion_statuses = CharInFilter(method="filter_opinion_statuses")

    def filter_opinion_statuses(self, queryset, name, value):
        if not value:
            return queryset

        stage = getattr(self.request.resolver_match.func.cls, "stage", None)

        status_field = (
            "full_text_status"
            if stage == ReferenceOpinion.Stage.FULL_TEXT
            else "screening_status"
        )

        return queryset.filter(**{f"{status_field}__in": value})


class DuplicateClusterFilter(filters.FilterSet):
    review = filters.NumberFilter(field_name="review_id")
    status = filters.ChoiceFilter(choices=ReferenceCluster.Status.choices)
    doi_match = filters.BooleanFilter(field_name="doi_match")
    min_similarity = filters.NumberFilter(
        field_name="max_similarity_score", lookup_expr="gte"
    )

    class Meta:
        model = ReferenceCluster
        fields = ["review", "status", "doi_match", "min_similarity"]
