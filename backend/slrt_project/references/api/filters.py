"""
Django-filter FilterSets for the references app.

ReferenceFilter        — base filter used in the "review data" (all-references) view
ScreeningFilter        — extends ReferenceFilter with an opinion-status filter
DuplicateClusterFilter — filter set for the duplicate-cluster list view
"""

from django.contrib.postgres.search import SearchQuery
from django_filters import rest_framework as filters

from slrt_project.references.models import Reference, ReferenceCluster, ReferenceOpinion


# ---------------------------------------------------------------------------
# Reusable compound filter types
# ---------------------------------------------------------------------------


class NumberInFilter(filters.BaseInFilter, filters.NumberFilter):
    """Accept a comma-separated list of numbers, e.g. ``?ids=1,2,3``."""


class CharInFilter(filters.BaseInFilter, filters.CharFilter):
    """Accept a comma-separated list of strings, e.g. ``?types=a,b``."""


# ---------------------------------------------------------------------------
# ReferenceFilter
# ---------------------------------------------------------------------------


class ReferenceFilter(filters.FilterSet):
    """
    Filter set for references in a review.

    Supported query parameters
    --------------------------
    search_method_ids   — comma-separated SearchMethod PKs
    label_ids           — comma-separated Label PKs (scoped to the current user)
    include_keywords    — comma-separated terms; references must contain at least one
    exclude_keywords    — comma-separated terms; references must NOT contain any
    search              — free-text websearch against the full-text search vector
    duplicate_statuses  — comma-separated DuplicateStatus values
    publication_types   — comma-separated publication type strings
    publication_years   — comma-separated 4-digit years
    has_file            — boolean; true = with PDF, false = without
    assignee_ids        — comma-separated ReviewMember PKs
    """

    search_method_ids = filters.BaseInFilter(
        field_name="search_method_id",
        lookup_expr="in",
        help_text="Filter by comma-separated SearchMethod IDs.",
    )
    label_ids = filters.BaseInFilter(
        method="filter_label_ids",
        help_text="Filter by labels belonging to the current user.",
    )
    include_keywords = CharInFilter(
        method="filter_include_keywords",
        help_text="Only return references whose search vector matches at least one keyword.",
    )
    exclude_keywords = CharInFilter(
        method="filter_exclude_keywords",
        help_text="Exclude references whose search vector matches any of these keywords.",
    )
    search = filters.CharFilter(
        method="filter_free_text",
        help_text="Full-text websearch against title, abstract, authors, and journal.",
    )
    duplicate_statuses = CharInFilter(
        field_name="duplicate_status",
        lookup_expr="in",
        help_text="Filter by comma-separated duplicate-status values.",
    )
    publication_types = CharInFilter(
        field_name="publication_type",
        lookup_expr="in",
        help_text="Filter by comma-separated publication-type strings.",
    )
    publication_years = filters.BaseInFilter(
        method="filter_publication_years",
        help_text="Filter by comma-separated 4-digit years.",
    )
    has_file = filters.BooleanFilter(
        method="filter_has_file",
        help_text="true = only references with a PDF attached; false = only those without.",
    )
    assignee_ids = filters.BaseInFilter(
        field_name="assignee_id",
        lookup_expr="in",
        help_text="Filter by comma-separated ReviewMember PKs.",
    )

    class Meta:
        model = Reference
        fields = []

    # ------------------------------------------------------------------
    # Custom filter methods
    # ------------------------------------------------------------------

    def filter_include_keywords(self, queryset, name, value):
        """
        Keep only references that match at least one of the supplied keywords
        using a PostgreSQL full-text ``OR`` search (``|`` operator in raw mode).
        """
        if not value:
            return queryset
        query = SearchQuery(" | ".join(value), search_type="raw")
        return queryset.filter(search_vector=query)

    def filter_exclude_keywords(self, queryset, name, value):
        """
        Remove references that match any of the supplied keywords using the
        same ``OR`` full-text query as ``filter_include_keywords``.
        """
        if not value:
            return queryset
        query = SearchQuery(" | ".join(value), search_type="raw")
        return queryset.exclude(search_vector=query)

    def filter_label_ids(self, queryset, name, value):
        """
        Filter by label IDs that belong to the requesting user.

        The extra ``labels__label__user`` guard prevents one user from
        filtering by another user's label IDs even if they guess the PK.
        ``distinct()`` is required because a reference can have multiple labels.
        """
        if not value:
            return queryset
        user = self.request.user
        return queryset.filter(
            labels__label__id__in=value,
            labels__label__user=user,
        ).distinct()

    def filter_free_text(self, queryset, name, value):
        """
        Full-text websearch against the pre-computed ``search_vector`` field.

        ``websearch`` mode supports quoted phrases, ``-`` negation, and ``OR``
        just like Google, without requiring callers to craft raw tsquery syntax.
        """
        if not value:
            return queryset
        query = SearchQuery(value, search_type="websearch")
        return queryset.filter(search_vector=query)

    def filter_publication_years(self, queryset, name, value):
        """Filter references to those published in any of the given years."""
        if not value:
            return queryset
        return queryset.filter(publication_date__year__in=value)

    def filter_has_file(self, queryset, name, value):
        """
        ``True``  → only references with a non-empty ``file`` field.
        ``False`` → only references with an empty ``file`` field.
        ``None``  → no filtering (value not supplied).
        """
        if value is None:
            return queryset
        return queryset.exclude(file="") if value else queryset.filter(file="")


# ---------------------------------------------------------------------------
# ScreeningFilter
# ---------------------------------------------------------------------------


class ScreeningFilter(ReferenceFilter):
    """
    Extends ``ReferenceFilter`` with opinion-status filtering for screening views.

    The correct status field (``screening_status`` vs ``full_text_status``) is
    determined at runtime from the view's ``stage`` class attribute so that
    this single filter class can serve both the screening and full-text views.
    """

    opinion_statuses = CharInFilter(
        method="filter_opinion_statuses",
        help_text=(
            "Filter by comma-separated opinion statuses "
            "(undecided, excluded, maybe, included)."
        ),
    )

    def filter_opinion_statuses(self, queryset, name, value):
        """
        Filter by the denormalised status field that corresponds to the
        current screening stage.  The field is determined from the view's
        ``stage`` class attribute injected via ``request.resolver_match``.
        """
        if not value:
            return queryset
        stage = getattr(self.request.resolver_match.func.cls, "stage", None)
        status_field = (
            "full_text_status"
            if stage == ReferenceOpinion.Stage.FULL_TEXT
            else "screening_status"
        )
        return queryset.filter(**{f"{status_field}__in": value})


# ---------------------------------------------------------------------------
# DuplicateClusterFilter
# ---------------------------------------------------------------------------


class DuplicateClusterFilter(filters.FilterSet):
    """
    Filter set for the duplicate-cluster list view.

    Supported query parameters
    --------------------------
    review         — Review PK (required for the list view)
    status         — cluster status (unresolved, auto_resolved, …)
    doi_match      — boolean; true = DOI-matched clusters only
    min_similarity — float threshold; only clusters with max_similarity ≥ value
    """

    review = filters.NumberFilter(
        field_name="review_id",
        help_text="Filter clusters by Review ID.",
    )
    status = filters.ChoiceFilter(
        choices=ReferenceCluster.Status.choices,
        help_text="Filter by cluster status.",
    )
    doi_match = filters.BooleanFilter(
        field_name="doi_match",
        help_text="true = only DOI-matched clusters.",
    )
    min_similarity = filters.NumberFilter(
        field_name="max_similarity_score",
        lookup_expr="gte",
        help_text="Minimum max_similarity_score threshold.",
    )

    class Meta:
        model = ReferenceCluster
        fields = ["review", "status", "doi_match", "min_similarity"]
