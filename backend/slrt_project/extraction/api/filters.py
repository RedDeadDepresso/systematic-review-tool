from django_filters import rest_framework as filters

from slrt_project.extraction.models import ExtractionQuestion


class ExtractionQuestionFilter(filters.FilterSet):
    type = filters.BaseInFilter(field_name="type", lookup_expr="in")

    class Meta:
        model = ExtractionQuestion
        fields = ["section", "section__review", "type"]
