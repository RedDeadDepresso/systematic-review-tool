"""
Django-filters FilterSets for the extraction app.

ExtractionQuestionFilter
    Filters questions by section, review, and/or a comma-separated list of
    question types (``type=number,date``).

ExtractionReferenceFilter
    Extends the shared ReferenceFilter with an ``is_extraction_completed``
    boolean field so the extraction table sidebar can filter by completion.
"""

import django_filters
from django_filters import rest_framework as filters

from slrt_project.extraction.models import ExtractionQuestion
from slrt_project.references.api.filters import ReferenceFilter
from slrt_project.references.models import Reference


class ExtractionQuestionFilter(filters.FilterSet):
    """
    FilterSet for ExtractionQuestion.

    ``type`` accepts a comma-separated list of values (BaseInFilter) so the
    frontend can request multiple types in a single call, e.g.
    ``?type=single-select,multi-select``.

    Supported filter params
    -----------------------
    section          (int)    — filter by section PK
    section__review  (int)    — filter by the section's parent review PK
    type             (str[])  — filter by one or more QuestionType values
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

    Adds
    ----
    is_extraction_completed (bool) — filter by whether a reviewer has marked
        all extraction fields complete for this reference.

    All filters inherited from ReferenceFilter remain available (search,
    labels, screening_status, etc.).
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
