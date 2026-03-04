from datetime import date

from django.db import models
from rest_framework import serializers

from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.references.api.serializers import ReferenceSerializer
from slrt_project.references.models import Reference


def _validate_value_for_question(
    value: str, question: ExtractionQuestion
) -> float | None:
    """
    Validate *value* against *question.type*.
    Returns the numeric float when type == "number", else None.
    Raises serializers.ValidationError on any constraint violation.
    """
    qt = question.type
    v = (value or "").strip()

    if qt == ExtractionQuestion.QuestionType.FREE_TEXT:
        return None

    if qt == ExtractionQuestion.QuestionType.NUMBER:
        if v == "":
            return None
        try:
            return float(v)
        except ValueError:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid number for this question."}
            )

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

    if qt == ExtractionQuestion.QuestionType.SINGLE_SELECT:
        if v == "":
            return None
        options = question.options or []
        if v not in options:
            raise serializers.ValidationError(
                {"value": f"'{v}' is not a valid option. Allowed: {options}"}
            )
        return None

    if qt == ExtractionQuestion.QuestionType.MULTI_SELECT:
        if v == "":
            return None
        options = set(question.options or [])
        chosen = [token.strip() for token in v.split(",") if token.strip()]
        invalid = [c for c in chosen if c not in options]
        if invalid:
            raise serializers.ValidationError(
                {"value": (f"Invalid option(s): {invalid}. Allowed: {sorted(options)}")}
            )
        return None

    if qt == ExtractionQuestion.QuestionType.BOOLEAN:
        if v == "":
            return None
        if v.lower() not in ("true", "false"):
            raise serializers.ValidationError(
                {"value": "Boolean questions only accept 'true' or 'false'."}
            )
        return None

    return None


class ExtractionSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "review"]
        read_only_fields = ["id"]

    def validate(self, data):
        review = data.get("review")
        name = data.get("name", "").strip()
        queryset = ExtractionSection.objects.filter(review=review, name__iexact=name)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                {"name": "A section with this name already exists for this review."}
            )
        return data

    def create(self, validated_data):
        validated_data["name"] = validated_data["name"].strip()
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

    def validate_question(self, value):
        return value.strip() if value else value

    def validate_column_title(self, value):
        return value.strip() if value else value

    def validate(self, data):
        question_type = data.get("type")
        options = data.get("options")
        if question_type in ["single-select", "multi-select"]:
            if not options or not isinstance(options, list) or len(options) == 0:
                raise serializers.ValidationError(
                    {"options": "Options are required for select type questions."}
                )
        return data

    def create(self, validated_data):
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
    class Meta:
        model = ExtractionAnswer
        fields = ["id", "reference", "question", "value"]
        read_only_fields = ["id"]

    def validate(self, data):
        """Enforce type constraints and populate value_number."""
        question = data.get("question") or (
            self.instance.question if self.instance else None
        )
        value = data.get("value", "")

        if question is None:
            return data

        # Run type validation; returns float | None
        numeric = _validate_value_for_question(value, question)
        # Stash for create/update
        data["_value_number"] = numeric
        return data

    def create(self, validated_data):
        value_number = validated_data.pop("_value_number", None)
        reference = validated_data["reference"]
        question = validated_data["question"]
        value = validated_data.get("value", "")

        answer, _ = ExtractionAnswer.objects.update_or_create(
            reference=reference,
            question=question,
            defaults={"value": value, "value_number": value_number},
        )
        return answer

    def update(self, instance, validated_data):
        value_number = validated_data.pop("_value_number", None)
        instance.value = validated_data.get("value", instance.value)
        instance.value_number = value_number
        instance.save()
        return instance


class ExtractionAnswerBulkSerializer(serializers.Serializer):
    reference_id = serializers.IntegerField()
    answers = serializers.DictField(child=serializers.CharField(allow_blank=True))

    def validate(self, data):
        """Validate each answer value against its question type."""
        answers_dict = data["answers"]

        errors = {}
        question_ids = [int(k) for k in answers_dict.keys()]
        questions_map = {
            q.id: q for q in ExtractionQuestion.objects.filter(id__in=question_ids)
        }

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


class ExtractionQuestionTableSerializer(serializers.ModelSerializer):
    """Serializer for questions in the table view"""

    section_name = serializers.CharField(source="section.name", read_only=True)

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
    answers = serializers.SerializerMethodField()

    class Meta:
        model = Reference
        fields = ReferenceSerializer.Meta.fields + [
            "answers",
            "is_extraction_completed",
        ]

    def get_answers(self, obj):
        """Returns dict mapping question_id -> {id, value}"""
        # Access prefetched answers
        answers = {}
        for answer in obj.extraction_answers.all():
            answers[answer.question_id] = {"id": answer.id, "value": answer.value}
        return answers


class ExtractionAnswerNestedSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExtractionAnswer
        fields = ["id", "question", "value"]


class ExtractionQuestionWithAnswerSerializer(serializers.ModelSerializer):
    answer = serializers.SerializerMethodField()

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

    def get_answer(self, obj):
        # The answer will be prefetched and attached to the question object
        answer = getattr(obj, "user_answer", None)
        if answer:
            return {
                "id": answer.id,
                "value": answer.value,
            }
        return None


class ExtractionSectionWithQuestionsSerializer(serializers.ModelSerializer):
    questions = ExtractionQuestionWithAnswerSerializer(many=True)

    class Meta:
        model = ExtractionSection
        fields = ["id", "name", "order", "questions"]


class BatchAnswerSerializer(serializers.Serializer):
    """Serializer for batch answer updates"""

    reference_id = serializers.IntegerField()
    question_id = serializers.IntegerField()
    value = serializers.CharField(allow_blank=True)


class BulkUpdateExtractionStatusSerializer(serializers.Serializer):
    """Serializer for bulk updating extraction completion status"""

    reference_ids = serializers.ListField(
        child=serializers.IntegerField(), min_length=1
    )
    is_extraction_completed = serializers.BooleanField()
