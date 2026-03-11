"""
Serializers for the extraction app.

Organisation
------------
Utility
  _validate_value_for_question     — shared type-validation helper

Model serializers
  ExtractionSectionSerializer      — CRUD with name-uniqueness + auto-order
  ExtractionQuestionSerializer     — CRUD with options validation + auto-order
  ExtractionAnswerSerializer       — CRUD with type validation; create uses
                                     update_or_create for idempotency

Input / action serializers
  ExtractionAnswerBulkSerializer   — dict of {question_id: value} for bulk-save
  BatchAnswerSerializer            — single (reference, question, value) tuple
  BulkUpdateExtractionStatusSerializer — marks references complete/incomplete

Read / table serializers
  ExtractionQuestionTableSerializer — adds section_name for table column headers
  ReferenceTableSerializer          — extends ReferenceSerializer with answers dict
  ExtractionAnswerNestedSerializer  — minimal answer shape for nested contexts
  ExtractionQuestionWithAnswerSerializer — question + pre-attached user_answer
  ExtractionSectionWithQuestionsSerializer — full section tree for form-data

Response serializers  (one per custom action — used for schema + validation)
  BulkSaveResponseSerializer            — bulk-save 200 payload
  BulkUpdateStatusResponseSerializer    — bulk-update-status 200 payload
  FormDataResponseSerializer            — form-data 200 payload
  BarChartDataPointSerializer           — one bar in a bar-chart response
  BarChartResponseSerializer            — full bar-chart 200 payload
  ScatterQuestionSerializer             — axis metadata in scatter response
  ScatterPointSerializer                — one point in a scatter response
  ScatterPlotResponseSerializer         — full scatter-plot 200 payload
  EvidenceGapAxisSerializer             — axis metadata in gap-map response
  EvidenceGapReferenceSerializer        — reference stub in a gap-map cell
  EvidenceGapCellSerializer             — one cell in a gap-map matrix
  EvidenceGapMapResponseSerializer      — full evidence-gap-map 200 payload
  YearRangeSerializer                   — min/max range in timeline response
  PublicationTimelinePointSerializer    — one year point in timeline response
  PublicationTimelineResponseSerializer — full publication-timeline 200 payload
"""

from datetime import date

from django.db import models
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.references.api.serializers import ReferenceSerializer
from slrt_project.references.models import Reference


# ===========================================================================
# Shared helper
# ===========================================================================


def _validate_value_for_question(
    value: str,
    question: ExtractionQuestion,
) -> float | None:
    """
    Validate *value* against the type rules of *question*.

    Returns
    -------
    float | None
        The parsed float when ``question.type == NUMBER``; ``None`` for all
        other types.

    Raises
    ------
    serializers.ValidationError
        When the value violates the type constraint (non-numeric string for a
        NUMBER question, unlisted value for SINGLE_SELECT, etc.).

    Notes
    -----
    * An empty string is always valid — the caller decides whether required.
    * FREE_TEXT is unrestricted; the function returns immediately.
    * MULTI_SELECT values are comma-separated tokens validated independently.
    * BOOLEAN accepts ``"true"`` or ``"false"`` (case-insensitive) only.
    """
    qt = question.type
    v = (value or "").strip()

    # ── free-text: no constraints ──────────────────────────────────────────
    if qt == ExtractionQuestion.QuestionType.FREE_TEXT:
        return None

    # ── number ────────────────────────────────────────────────────────────
    if qt == ExtractionQuestion.QuestionType.NUMBER:
        if v == "":
            return None
        try:
            return float(v)
        except ValueError:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid number for this question."}
            )

    # ── date (ISO 8601: YYYY-MM-DD) ───────────────────────────────────────
    if qt == ExtractionQuestion.QuestionType.DATE:
        if v == "":
            return None
        try:
            date.fromisoformat(v)
        except ValueError:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid ISO-8601 date (YYYY-MM-DD)."}
            )
        return None

    # ── single-select ─────────────────────────────────────────────────────
    if qt == ExtractionQuestion.QuestionType.SINGLE_SELECT:
        if v == "":
            return None
        options = question.options or []
        if v not in options:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid option. Allowed: {options}"}
            )
        return None

    # ── multi-select: comma-separated tokens ──────────────────────────────
    if qt == ExtractionQuestion.QuestionType.MULTI_SELECT:
        if v == "":
            return None
        options = set(question.options or [])
        chosen = [token.strip() for token in v.split(",") if token.strip()]
        invalid = [c for c in chosen if c not in options]
        if invalid:
            raise serializers.ValidationError(
                {"value": f"Invalid option(s): {invalid}. Allowed: {sorted(options)}"}
            )
        return None

    # ── boolean ───────────────────────────────────────────────────────────
    if qt == ExtractionQuestion.QuestionType.BOOLEAN:
        if v == "":
            return None
        if v.lower() not in ("true", "false"):
            raise serializers.ValidationError(
                {"value": "Boolean questions only accept 'true' or 'false'."}
            )
        return None

    return None


# ===========================================================================
# Model serializers
# ===========================================================================


class ExtractionSectionSerializer(serializers.ModelSerializer):
    """
    CRUD serializer for ExtractionSection.

    Validation
    ----------
    * ``name`` uniqueness is enforced case-insensitively within the same review.
      On update the current instance is excluded so a no-op PUT/PATCH does not
      raise a false conflict.

    Create
    ------
    * ``name`` is stripped of surrounding whitespace before saving.
    * When ``order`` is omitted, the section is appended after the current
      highest ``order`` value for that review (or assigned 1 if empty).
    """

    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "review"]
        read_only_fields = ["id"]

    def validate(self, data):
        review = data.get("review")
        name = data.get("name", "").strip()

        # Case-insensitive uniqueness per review; exclude self on update.
        qs = ExtractionSection.objects.filter(review=review, name__iexact=name)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                {"name": "A section with this name already exists for this review."}
            )
        return data

    def create(self, validated_data):
        # Normalise name whitespace before saving.
        validated_data["name"] = validated_data["name"].strip()

        # Auto-assign order to the end of the review's section list.
        if "order" not in validated_data:
            max_order = (
                ExtractionSection.objects.filter(
                    review=validated_data["review"]
                ).aggregate(models.Max("order"))["order__max"]
                or 0
            )
            validated_data["order"] = max_order + 1

        return super().create(validated_data)


class ExtractionQuestionSerializer(serializers.ModelSerializer):
    """
    CRUD serializer for ExtractionQuestion.

    Validation
    ----------
    * ``question`` and ``column_title`` are stripped of surrounding whitespace.
    * ``single-select`` and ``multi-select`` questions must carry a non-empty
      ``options`` list; other types should omit ``options`` (null is fine).

    Create
    ------
    * When ``order`` is omitted, the question is appended after the current
      highest ``order`` value within its section.
    """

    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "question",
            "column_title",
            "type",
            "options",
            "required",
            "order",
        ]
        read_only_fields = ["id"]

    def validate_question(self, value: str) -> str:
        """Strip leading/trailing whitespace from the question text."""
        return value.strip() if value else value

    def validate_column_title(self, value: str) -> str:
        """Strip leading/trailing whitespace from the column title."""
        return value.strip() if value else value

    def validate(self, data):
        question_type = data.get("type")
        options = data.get("options")

        # Select-type questions require a non-empty options list so the
        # frontend can render the dropdown and validate answers client-side.
        if question_type in (
            ExtractionQuestion.QuestionType.SINGLE_SELECT,
            ExtractionQuestion.QuestionType.MULTI_SELECT,
        ):
            if not options or not isinstance(options, list) or len(options) == 0:
                raise serializers.ValidationError(
                    {"options": "Options are required for select type questions."}
                )
        return data

    def create(self, validated_data):
        # Auto-assign order to the end of the section's question list.
        if "order" not in validated_data:
            section = validated_data["section"]
            max_order = (
                ExtractionQuestion.objects.filter(section=section).aggregate(
                    models.Max("order")
                )["order__max"]
                or 0
            )
            validated_data["order"] = max_order + 1
        return super().create(validated_data)


class ExtractionAnswerSerializer(serializers.ModelSerializer):
    """
    CRUD serializer for ExtractionAnswer.

    Validation
    ----------
    Delegates type-level value validation to ``_validate_value_for_question``.
    The parsed ``value_number`` is stashed in ``validated_data["_value_number"]``
    so ``create``/``update`` can persist it without a second parse.

    Create
    ------
    Uses ``update_or_create`` on (reference, question) so calling create twice
    with the same pair updates the existing row rather than raising IntegrityError.

    Update
    ------
    Replaces ``value`` and ``value_number`` on the existing instance.
    """

    class Meta:
        model = ExtractionAnswer
        fields = ["id", "reference", "question", "value"]
        read_only_fields = ["id"]

    def validate(self, data):
        # Resolve question from payload or from the instance being updated.
        question = data.get("question") or (
            self.instance.question if self.instance else None
        )
        value = data.get("value", "")

        if question is None:
            return data

        # Type validation; returns float | None and may raise ValidationError.
        data["_value_number"] = _validate_value_for_question(value, question)
        return data

    def create(self, validated_data):
        value_number = validated_data.pop("_value_number", None)
        answer, _ = ExtractionAnswer.objects.update_or_create(
            reference=validated_data["reference"],
            question=validated_data["question"],
            defaults={
                "value": validated_data.get("value", ""),
                "value_number": value_number,
            },
        )
        return answer

    def update(self, instance, validated_data):
        value_number = validated_data.pop("_value_number", None)
        instance.value = validated_data.get("value", instance.value)
        instance.value_number = value_number
        instance.save()
        return instance


# ===========================================================================
# Input / action serializers
# ===========================================================================


class ExtractionAnswerBulkSerializer(serializers.Serializer):
    """
    Validates all answers for a single reference submitted in one request.

    ``answers`` maps question IDs (string keys) to answer values.  All
    referenced questions are loaded in a single query; each value is validated
    against its question's type and all errors are accumulated so the client
    receives a complete report rather than failing on the first bad answer.
    """

    reference_id = serializers.IntegerField(
        help_text="PK of the Reference being answered."
    )
    answers = serializers.DictField(
        child=serializers.CharField(allow_blank=True),
        help_text="Mapping of question_id (str) → answer value.",
    )

    def validate(self, data):
        answers_dict = data["answers"]

        # Fetch all referenced questions in a single round-trip.
        question_ids = [int(k) for k in answers_dict]
        questions_map = {
            q.id: q for q in ExtractionQuestion.objects.filter(id__in=question_ids)
        }

        errors = {}
        for q_id_str, value in answers_dict.items():
            q_id = int(q_id_str)
            question = questions_map.get(q_id)

            if question is None:
                errors[q_id_str] = f"Question {q_id} does not exist."
                continue

            try:
                _validate_value_for_question(value, question)
            except serializers.ValidationError as exc:
                errors[q_id_str] = exc.detail

        if errors:
            raise serializers.ValidationError(errors)

        return data


class BatchAnswerSerializer(serializers.Serializer):
    """
    Single (reference, question, value) tuple.

    Used internally; prefer ExtractionAnswerBulkSerializer for multi-answer
    requests from the frontend.
    """

    reference_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    value = serializers.CharField(allow_blank=True)


class BulkUpdateExtractionStatusSerializer(serializers.Serializer):
    """Request body for the ``bulk-update-status`` action."""

    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1,
        help_text="PKs of the references to update.",
    )
    is_extraction_completed = serializers.BooleanField(
        help_text="New completion status to apply to all listed references."
    )


# ===========================================================================
# Read / table serializers
# ===========================================================================


class ExtractionQuestionTableSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for question column headers in the extraction table.

    Adds ``section_name`` (from ``section.name``) so the frontend can group
    columns without a separate section request.
    """

    section_name = serializers.CharField(
        source="section.name",
        read_only=True,
        help_text="Display name of the parent section.",
    )

    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "section_name",
            "question",
            "column_title",
            "type",
            "required",
            "order",
            "options",
        ]


class ReferenceTableSerializer(ReferenceSerializer):
    """
    Extends ReferenceSerializer with extraction-specific fields.

    ``answers`` maps question_id (int) → {id, value} and is built from
    ``obj.extraction_answers`` which the view must prefetch to avoid N+1s.

    ``is_extraction_completed`` is exposed directly from the Reference model.
    """

    answers = serializers.SerializerMethodField(
        help_text="Dict mapping question_id → {id, value}."
    )

    class Meta:
        model = Reference
        fields = ReferenceSerializer.Meta.fields + [
            "answers",
            "is_extraction_completed",
        ]

    @extend_schema_field(
        serializers.DictField(
            child=serializers.DictField(child=serializers.CharField())
        )
    )
    def get_answers(self, obj) -> dict:
        """Build answer lookup dict from prefetched extraction_answers."""
        return {
            answer.question_id: {"id": answer.id, "value": answer.value}
            for answer in obj.extraction_answers.all()
        }


class ExtractionAnswerNestedSerializer(serializers.ModelSerializer):
    """
    Minimal read-only answer representation for nested contexts where the
    parent reference is already known from the enclosing object.
    """

    class Meta:
        model = ExtractionAnswer
        fields = ["id", "question", "value"]


class ExtractionQuestionWithAnswerSerializer(serializers.ModelSerializer):
    """
    Question + the current reference's single answer.

    The view attaches an ``ExtractionAnswer`` instance (or ``None``) as
    ``question.user_answer`` before serialization.  ``get_answer`` reads that
    attribute rather than issuing a DB query.
    """

    answer = serializers.SerializerMethodField(
        help_text="The current reference's answer for this question, or null."
    )

    class Meta:
        model = ExtractionQuestion
        fields = [
            "id",
            "section",
            "question",
            "column_title",
            "type",
            "options",
            "required",
            "order",
            "answer",
        ]

    @extend_schema_field(
        serializers.DictField(child=serializers.CharField(), allow_null=True)
    )
    def get_answer(self, obj) -> dict | None:
        """Return {id, value} from the pre-attached user_answer, or None."""
        answer = getattr(obj, "user_answer", None)
        if answer:
            return {"id": answer.id, "value": answer.value}
        return None


class ExtractionSectionWithQuestionsSerializer(serializers.ModelSerializer):
    """
    Full section tree: section → questions → answer for the current reference.

    Used exclusively by the form-data endpoint which pre-attaches answers via
    ``question.user_answer`` before passing sections to this serializer.
    """

    questions = ExtractionQuestionWithAnswerSerializer(many=True)

    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "questions"]


# ===========================================================================
# Response serializers
# ===========================================================================


class BulkSaveResponseSerializer(serializers.Serializer):
    """Response payload returned by ExtractionAnswerViewSet.bulk_save."""

    saved_count = serializers.IntegerField(
        help_text="Number of answers written or updated."
    )
    answers = ExtractionAnswerSerializer(
        many=True,
        help_text="Full representation of each saved answer.",
    )


class BulkUpdateStatusResponseSerializer(serializers.Serializer):
    """Response payload returned by ExtractionTableViewSet.bulk_update_status."""

    updated_count = serializers.IntegerField(
        help_text="Number of references whose status was changed."
    )
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="PKs of the updated references.",
    )
    is_extraction_completed = serializers.BooleanField(
        help_text="The new completion flag that was applied."
    )


class FormDataResponseSerializer(serializers.Serializer):
    """Response payload returned by ExtractionFormViewSet.form_data."""

    sections = ExtractionSectionWithQuestionsSerializer(
        many=True,
        help_text="Ordered sections, each containing questions and their answers.",
    )


# ── Bar chart ──────────────────────────────────────────────────────────────


class BarChartDataPointSerializer(serializers.Serializer):
    """One bar in a bar-chart response."""

    label = serializers.CharField(help_text="Option label (bar name).")
    count = serializers.IntegerField(
        help_text="Number of answers selecting this option."
    )


class BarChartResponseSerializer(serializers.Serializer):
    """Full response returned by BarChartViewSet.bar_chart."""

    question_id = serializers.IntegerField()
    question = serializers.CharField(help_text="Full question text.")
    column_title = serializers.CharField()
    type = serializers.CharField(help_text="QuestionType value (e.g. 'single-select').")
    data = BarChartDataPointSerializer(many=True)


# ── Scatter plot ───────────────────────────────────────────────────────────


class ScatterQuestionSerializer(serializers.Serializer):
    """Axis metadata in a scatter-plot response."""

    id = serializers.IntegerField()
    column_title = serializers.CharField()


class ScatterPointSerializer(serializers.Serializer):
    """One data point in a scatter-plot response."""

    reference_id = serializers.IntegerField()
    title = serializers.CharField(help_text="Reference title for tooltip.")
    x = serializers.FloatField()
    y = serializers.FloatField()
    bubble_size = serializers.IntegerField(
        help_text="Number of references at this (x, y) coordinate."
    )


class ScatterPlotResponseSerializer(serializers.Serializer):
    """Full response returned by ScatterPlotViewSet.scatter_plot."""

    question_x = ScatterQuestionSerializer()
    question_y = ScatterQuestionSerializer()
    data = ScatterPointSerializer(many=True)


# ── Evidence gap map ───────────────────────────────────────────────────────


class EvidenceGapAxisSerializer(serializers.Serializer):
    """Axis metadata in an evidence-gap-map response."""

    id = serializers.IntegerField()
    column_title = serializers.CharField()
    options = serializers.ListField(child=serializers.CharField())


class EvidenceGapReferenceSerializer(serializers.Serializer):
    """Minimal reference stub used inside evidence-gap cells."""

    id = serializers.IntegerField()
    title = serializers.CharField()


class EvidenceGapCellSerializer(serializers.Serializer):
    """One cell in the evidence-gap matrix."""

    row = serializers.CharField(help_text="Row option label.")
    col = serializers.CharField(help_text="Column option label.")
    count = serializers.IntegerField(help_text="References matching both options.")
    references = EvidenceGapReferenceSerializer(many=True)


class EvidenceGapMapResponseSerializer(serializers.Serializer):
    """Full response returned by EvidenceGapMapViewSet.evidence_gap_map."""

    question_row = EvidenceGapAxisSerializer()
    question_col = EvidenceGapAxisSerializer()
    max_count = serializers.IntegerField(
        help_text="Highest cell count (used to scale colour intensity)."
    )
    cells = EvidenceGapCellSerializer(many=True)


# ── Publication timeline ───────────────────────────────────────────────────


class YearRangeSerializer(serializers.Serializer):
    """Min/max publication year range in a timeline response."""

    min = serializers.IntegerField()
    max = serializers.IntegerField()


class PublicationTimelinePointSerializer(serializers.Serializer):
    """One year's count in a publication timeline."""

    year = serializers.IntegerField()
    count = serializers.IntegerField()


class PublicationTimelineResponseSerializer(serializers.Serializer):
    """Full response returned by PublicationTimelineViewSet.publication_timeline."""

    data = PublicationTimelinePointSerializer(many=True)
    total_references = serializers.IntegerField()
    year_range = YearRangeSerializer(allow_null=True)
