import django_filters
from django_filters import rest_framework as filters

from slrt_project.extraction.models import ExtractionQuestion
from slrt_project.references.api.filters import ReferenceFilter
from slrt_project.references.models import Reference


class ExtractionQuestionFilter(filters.FilterSet):
    type = filters.BaseInFilter(field_name="type", lookup_expr="in")

    class Meta:
        model = ExtractionQuestion
        fields = ["section", "section__review", "type"]


class ExtractionReferenceFilter(ReferenceFilter):
    is_extraction_completed = django_filters.BooleanFilter(
        field_name="is_extraction_completed"
    )

    class Meta:
        model = Reference
        fields = ReferenceFilter.Meta.fields + ["is_extraction_completed"]
