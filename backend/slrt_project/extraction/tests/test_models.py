import pytest
from django.db import IntegrityError
from django.db.models.base import ModelState

from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.extraction.tests.factories import (
    ExtractionAnswerFactory,
    ExtractionQuestionFactory,
    ExtractionSectionFactory,
)
from slrt_project.references.tests.factories import ReferenceFactory
from slrt_project.reviews.tests.factories import ReviewFactory


# Helper — build unsaved instances without touching the DB
def _make(model_cls, **kwargs):
    """
    Construct a model instance without touching the database.
    """
    instance = model_cls.__new__(model_cls)
    instance._state = ModelState()
    instance._state.fields_cache = {}
    instance.__dict__["id"] = None
    instance.__dict__.update(kwargs)
    return instance


# ExtractionSection — no-DB tests
@pytest.mark.django_db
class TestExtractionSectionStr:
    """
    __str__ accesses self.review (FK) so these need a real DB row.
    """

    def test_format(self):
        section = ExtractionSectionFactory(name="Population")
        result = str(section)
        assert result.endswith(" - Population")

    def test_empty_name(self):
        section = ExtractionSectionFactory(name="")
        result = str(section)
        assert result.endswith(" - ")


class TestExtractionSectionMeta:
    def test_default_ordering_is_by_order(self):
        assert ExtractionSection._meta.ordering == ["order"]

    def test_unique_constraint_name(self):
        names = [c.name for c in ExtractionSection._meta.constraints]
        assert "unique_review_section_name" in names

    def test_order_field_default_is_zero(self):
        field = ExtractionSection._meta.get_field("order")
        assert field.default == 0


# ExtractionQuestion — no-DB tests
@pytest.mark.django_db
class TestExtractionQuestionStr:
    """
    __str__ accesses self.section.name (FK chain) so these need a real DB row.
    """

    def test_format(self):
        section = ExtractionSectionFactory(name="Methods")
        q = ExtractionQuestionFactory(section=section, column_title="Sample size")
        assert str(q) == "Methods - Sample size"

    def test_empty_column_title(self):
        section = ExtractionSectionFactory(name="S")
        q = ExtractionQuestionFactory(section=section, column_title="")
        assert str(q) == "S - "


class TestExtractionQuestionType:
    def test_all_six_types_exist(self):
        db_values = {c[0] for c in ExtractionQuestion.QuestionType.choices}
        assert db_values == {
            "free-text",
            "number",
            "date",
            "single-select",
            "multi-select",
            "boolean",
        }

    def test_display_labels(self):
        labels = {c[1] for c in ExtractionQuestion.QuestionType.choices}
        assert "Free Text" in labels
        assert "Single Select" in labels
        assert "Multi Select" in labels


class TestExtractionQuestionMeta:
    def test_default_ordering_is_by_order(self):
        assert ExtractionQuestion._meta.ordering == ["order"]

    def test_required_default_is_false(self):
        field = ExtractionQuestion._meta.get_field("required")
        assert field.default is False

    def test_options_is_nullable(self):
        field = ExtractionQuestion._meta.get_field("options")
        assert field.null is True
        assert field.blank is True

    def test_order_default_is_zero(self):
        assert ExtractionQuestion._meta.get_field("order").default == 0


# ExtractionAnswer — no-DB tests


@pytest.mark.django_db
class TestExtractionAnswerStr:
    """
    __str__ accesses self.question.column_title and self.reference.id (FK chain)
    so this needs a real DB row.
    """

    def test_format(self):
        q = ExtractionQuestionFactory(column_title="Sample size")
        ref = ReferenceFactory()
        answer = ExtractionAnswerFactory(question=q, reference=ref)
        assert str(answer) == f"Answer for Sample size - Ref {ref.id}"


class TestExtractionAnswerMeta:
    def test_unique_constraint_name(self):
        names = [c.name for c in ExtractionAnswer._meta.constraints]
        assert "unique_reference_question_answer" in names

    def test_value_default_is_empty_string(self):
        field = ExtractionAnswer._meta.get_field("value")
        assert field.default == ""
        assert field.blank is True

    def test_value_number_is_nullable(self):
        field = ExtractionAnswer._meta.get_field("value_number")
        assert field.null is True
        assert field.blank is True

    def test_question_fk_has_db_index(self):
        field = ExtractionAnswer._meta.get_field("question")
        assert field.db_index is True


# ExtractionSectionFactory — DB tests
@pytest.mark.django_db
class TestExtractionSectionFactory:
    def test_creates_row(self):
        section = ExtractionSectionFactory()
        assert section.pk is not None

    def test_linked_to_review(self):
        section = ExtractionSectionFactory()
        assert section.review_id is not None

    def test_custom_name(self):
        section = ExtractionSectionFactory(name="Outcomes")
        assert section.name == "Outcomes"

    def test_custom_order(self):
        section = ExtractionSectionFactory(order=5)
        assert section.order == 5

    def test_unique_name_per_review_constraint(self):
        review = ReviewFactory()
        ExtractionSectionFactory(review=review, name="Methods")
        with pytest.raises(IntegrityError):
            ExtractionSectionFactory(review=review, name="Methods")

    def test_same_name_allowed_in_different_reviews(self):
        # The unique constraint is scoped to a single review.
        ExtractionSectionFactory(name="Methods")
        ExtractionSectionFactory(name="Methods")  # different review → OK

    def test_str_matches_expected_format(self):
        section = ExtractionSectionFactory(name="Population")
        assert " - Population" in str(section)

    def test_cascade_delete_with_review(self):
        section = ExtractionSectionFactory()
        review = section.review
        review.delete()
        assert not ExtractionSection.objects.filter(pk=section.pk).exists()


# ExtractionQuestionFactory — DB tests
@pytest.mark.django_db
class TestExtractionQuestionFactory:
    def test_creates_row(self):
        q = ExtractionQuestionFactory()
        assert q.pk is not None

    def test_default_type_is_free_text(self):
        q = ExtractionQuestionFactory()
        assert q.type == ExtractionQuestion.QuestionType.FREE_TEXT

    def test_number_trait(self):
        q = ExtractionQuestionFactory(number=True)
        assert q.type == ExtractionQuestion.QuestionType.NUMBER

    def test_date_trait(self):
        q = ExtractionQuestionFactory(date=True)
        assert q.type == ExtractionQuestion.QuestionType.DATE

    def test_single_select_trait_has_options(self):
        q = ExtractionQuestionFactory(single_select=True)
        assert q.type == ExtractionQuestion.QuestionType.SINGLE_SELECT
        assert isinstance(q.options, list)
        assert len(q.options) > 0

    def test_multi_select_trait_has_options(self):
        q = ExtractionQuestionFactory(multi_select=True)
        assert q.type == ExtractionQuestion.QuestionType.MULTI_SELECT
        assert isinstance(q.options, list)

    def test_boolean_trait(self):
        q = ExtractionQuestionFactory(boolean=True)
        assert q.type == ExtractionQuestion.QuestionType.BOOLEAN

    def test_required_default_false(self):
        assert ExtractionQuestionFactory().required is False

    def test_required_override(self):
        assert ExtractionQuestionFactory(required=True).required is True

    def test_linked_to_section(self):
        q = ExtractionQuestionFactory()
        assert q.section_id is not None

    def test_questions_share_section(self):
        section = ExtractionSectionFactory()
        q1 = ExtractionQuestionFactory(section=section)
        q2 = ExtractionQuestionFactory(section=section)
        assert q1.section_id == q2.section_id

    def test_str_format(self):
        section = ExtractionSectionFactory(name="Methods")
        q = ExtractionQuestionFactory(section=section, column_title="Design")
        assert str(q) == "Methods - Design"

    def test_cascade_delete_with_section(self):
        q = ExtractionQuestionFactory()
        section = q.section
        section.delete()
        assert not ExtractionQuestion.objects.filter(pk=q.pk).exists()

    def test_ordering_by_order_field(self):
        section = ExtractionSectionFactory()
        q2 = ExtractionQuestionFactory(section=section, order=2)
        q0 = ExtractionQuestionFactory(section=section, order=0)
        q1 = ExtractionQuestionFactory(section=section, order=1)
        qs = list(ExtractionQuestion.objects.filter(section=section))
        assert qs[0].pk == q0.pk
        assert qs[1].pk == q1.pk
        assert qs[2].pk == q2.pk


# ExtractionAnswerFactory — DB tests
@pytest.mark.django_db
class TestExtractionAnswerFactory:
    def test_creates_row(self):
        answer = ExtractionAnswerFactory()
        assert answer.pk is not None

    def test_default_value_is_empty_string(self):
        assert ExtractionAnswerFactory().value == ""

    def test_default_value_number_is_none(self):
        assert ExtractionAnswerFactory().value_number is None

    def test_numeric_trait_sets_both_fields(self):
        answer = ExtractionAnswerFactory(numeric=True)
        assert answer.value == "42"
        assert answer.value_number == 42.0

    def test_custom_value(self):
        answer = ExtractionAnswerFactory(value="RCT")
        assert answer.value == "RCT"

    def test_linked_to_reference_and_question(self):
        answer = ExtractionAnswerFactory()
        assert answer.reference_id is not None
        assert answer.question_id is not None

    def test_unique_reference_question_constraint(self):
        # Use .objects.create() directly — the factory has django_get_or_create
        # which silently returns the existing row rather than raising IntegrityError.
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        ExtractionAnswer.objects.create(reference=ref, question=q, value="first")
        with pytest.raises(IntegrityError):
            ExtractionAnswer.objects.create(reference=ref, question=q, value="second")

    def test_get_or_create_prevents_duplicates(self):
        # The factory's django_get_or_create means calling it twice with the
        # same (reference, question) returns the same row rather than raising.
        ref = ReferenceFactory()
        q = ExtractionQuestionFactory()
        a1 = ExtractionAnswerFactory(reference=ref, question=q)
        a2 = ExtractionAnswerFactory(reference=ref, question=q)
        assert a1.pk == a2.pk

    def test_same_question_different_references(self):
        # One question may have answers from many references.
        q = ExtractionQuestionFactory()
        a1 = ExtractionAnswerFactory(question=q, reference=ReferenceFactory())
        a2 = ExtractionAnswerFactory(question=q, reference=ReferenceFactory())
        assert a1.pk != a2.pk

    def test_same_reference_different_questions(self):
        # One reference may have answers to many questions.
        ref = ReferenceFactory()
        a1 = ExtractionAnswerFactory(
            reference=ref, question=ExtractionQuestionFactory()
        )
        a2 = ExtractionAnswerFactory(
            reference=ref, question=ExtractionQuestionFactory()
        )
        assert a1.pk != a2.pk

    def test_str_format(self):
        q = ExtractionQuestionFactory(column_title="Study design")
        ref = ReferenceFactory()
        answer = ExtractionAnswerFactory(question=q, reference=ref)
        assert str(answer) == f"Answer for Study design - Ref {ref.id}"

    def test_cascade_delete_with_reference(self):
        answer = ExtractionAnswerFactory()
        ref = answer.reference
        ref.delete()
        assert not ExtractionAnswer.objects.filter(pk=answer.pk).exists()

    def test_cascade_delete_with_question(self):
        answer = ExtractionAnswerFactory()
        q = answer.question
        q.delete()
        assert not ExtractionAnswer.objects.filter(pk=answer.pk).exists()
