import django_filters
from django_filters import rest_framework as filters

from slrt_project.extraction.models import ExtractionQuestion
from slrt_project.references.api.filters import ReferenceFilter
from slrt_project.references.models import Reference


class ExtractionQuestionFilter(filters.FilterSet):
    """
    FilterSet for ExtractionQuestion.
    """

    # BaseInFilter splits comma-separated query values into a list and applies
    # a SQL IN clause, matching Django's built-in ``__in`` lookup.
    type = filters.BaseInFilter(field_name="type", lookup_expr="in")

    class Meta:
        model = ExtractionQuestion
        fields = ["section", "section__review", "type"]


class ExtractionReferenceFilter(ReferenceFilter):
    """
    Extends ReferenceFilter with extraction-specific filters.
    """

    is_extraction_completed = django_filters.BooleanFilter(
        field_name="is_extraction_completed",
        help_text="Filter references by extraction completion status.",
    )

    class Meta:
        model = Reference
        # Append the new field to the parent's field list so the combined
        # filter includes every filter the parent already supports.
        fields = ReferenceFilter.Meta.fields + ["is_extraction_completed"]
