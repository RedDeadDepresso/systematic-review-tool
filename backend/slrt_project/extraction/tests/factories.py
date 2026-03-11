"""
Factory classes for the extraction app.

Uses factory_boy with DjangoModelFactory.  Every factory writes a real DB row,
making it straightforward to compose realistic object graphs in tests.

Usage examples
--------------
    # Minimal section (review created automatically):
    section = ExtractionSectionFactory()

    # Two sections in the same review, explicit ordering:
    review = ReviewFactory()
    s1 = ExtractionSectionFactory(review=review, name="Population", order=0)
    s2 = ExtractionSectionFactory(review=review, name="Outcomes", order=1)

    # Free-text question inside a section:
    question = ExtractionQuestionFactory(section=s1)

    # Select question with explicit options:
    q = ExtractionQuestionFactory(
        section=s1,
        type=ExtractionQuestion.QuestionType.SINGLE_SELECT,
        options=["RCT", "cohort", "case-control"],
    )

    # Required number question:
    q = ExtractionQuestionFactory(number=True, required=True)

    # Answer linking a reference to a question:
    answer = ExtractionAnswerFactory(value="42", value_number=42.0)
"""

from factory import Sequence, SubFactory, Trait
from factory.django import DjangoModelFactory

from slrt_project.extraction.models import (
    ExtractionAnswer,
    ExtractionQuestion,
    ExtractionSection,
)
from slrt_project.references.tests.factories import ReferenceFactory

# Import shared factories — adjust the import path if your project layout differs.
from slrt_project.reviews.tests.factories import ReviewFactory


# ---------------------------------------------------------------------------
# ExtractionSectionFactory
# ---------------------------------------------------------------------------


class ExtractionSectionFactory(DjangoModelFactory):
    """
    Creates an ExtractionSection with a unique name per sequence counter.

    The ``review`` sub-factory means every call creates a fresh review unless
    you pass one explicitly.
    """

    class Meta:
        model = ExtractionSection

    review = SubFactory(ReviewFactory)
    # Sequence ensures the unique_review_section_name constraint is never
    # violated when multiple sections are created in the same test.
    name = Sequence(lambda n: f"Section {n}")
    order = Sequence(lambda n: n)  # 0, 1, 2, … — keeps sections sortable


# ---------------------------------------------------------------------------
# ExtractionQuestionFactory
# ---------------------------------------------------------------------------


class ExtractionQuestionFactory(DjangoModelFactory):
    """
    Creates an ExtractionQuestion inside an ExtractionSection.

    Defaults to ``FREE_TEXT`` — use traits to create other types.

    Traits
    ------
    number        — NUMBER type, value_number expected on answers
    date          — DATE type
    single_select — SINGLE_SELECT type with three default options
    multi_select  — MULTI_SELECT type with three default options
    boolean       — BOOLEAN type
    """

    class Meta:
        model = ExtractionQuestion

    section = SubFactory(ExtractionSectionFactory)
    question = Sequence(lambda n: f"Question {n}?")
    column_title = Sequence(lambda n: f"Col {n}")
    type = ExtractionQuestion.QuestionType.FREE_TEXT
    options = None  # Only populated for select-type questions
    required = False
    order = Sequence(lambda n: n)

    class Params:
        number = Trait(type=ExtractionQuestion.QuestionType.NUMBER)
        date = Trait(type=ExtractionQuestion.QuestionType.DATE)
        single_select = Trait(
            type=ExtractionQuestion.QuestionType.SINGLE_SELECT,
            options=["Option A", "Option B", "Option C"],
        )
        multi_select = Trait(
            type=ExtractionQuestion.QuestionType.MULTI_SELECT,
            options=["Option A", "Option B", "Option C"],
        )
        boolean = Trait(type=ExtractionQuestion.QuestionType.BOOLEAN)


# ---------------------------------------------------------------------------
# ExtractionAnswerFactory
# ---------------------------------------------------------------------------


class ExtractionAnswerFactory(DjangoModelFactory):
    """
    Creates an ExtractionAnswer linking a Reference to an ExtractionQuestion.

    By default ``value_number`` is None.  For numeric questions set both
    ``value`` and ``value_number`` explicitly or use the ``numeric`` trait.

    Traits
    ------
    numeric — creates a number-type question and sets value/value_number to 42
    """

    class Meta:
        model = ExtractionAnswer
        # Prevent duplicate (reference, question) pairs within a single test.
        django_get_or_create = ("reference", "question")

    reference = SubFactory(ReferenceFactory)
    question = SubFactory(ExtractionQuestionFactory)
    value = ""
    value_number = None

    class Params:
        numeric = Trait(
            question=SubFactory(ExtractionQuestionFactory, number=True),
            value="42",
            value_number=42.0,
        )
