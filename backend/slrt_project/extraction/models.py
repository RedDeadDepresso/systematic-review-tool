"""
Extraction data models for structured data capture during the full-text review stage.

Domain overview
---------------
After a reference passes full-text screening it enters the *extraction* stage,
where reviewers fill in structured answers to pre-defined questions.  The schema
is organised as a three-level hierarchy:

    Review  ──►  ExtractionSection  ──►  ExtractionQuestion  ──►  ExtractionAnswer
                 (e.g. "Methods")        (e.g. "Sample size")      (actual value)

Model inventory
---------------
ExtractionSection
    A named group of questions belonging to a review (e.g. "Population",
    "Intervention", "Outcomes").  Sections are ordered and unique per review.

ExtractionQuestion
    A single question within a section.  The ``type`` field controls how the
    answer is rendered and validated on the front-end.  Questions that accept
    discrete choices store those choices in the ``options`` JSON field.

ExtractionAnswer
    One answer per (reference, question) pair.  Text answers go into ``value``;
    numeric answers are additionally stored in ``value_number`` so they can be
    filtered and sorted efficiently without casting.
"""

from django.db import models


class ExtractionSection(models.Model):
    """
    A named, ordered group of extraction questions within a review.

    Sections exist only within a single review — deleting the review cascades
    to all its sections (and transitively to their questions and answers).

    Ordering
    --------
    The default queryset is ordered by ``order`` (ascending), so sections
    are always returned in the sequence the review owner chose.

    Constraints
    -----------
    ``unique_review_section_name`` — two sections in the same review cannot
    share a name, preventing ambiguity when referring to sections by label.
    """

    # The review this section belongs to.  Cascades so orphaned sections are
    # never left behind when a review is deleted.
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="extraction_sections",
    )

    # Human-readable label shown as a column group header in the extraction table.
    name = models.CharField(max_length=255)

    # Zero-based position used to sort sections within a review.  Lower values
    # appear first.  Two sections may share the same order value; in that case
    # their relative position is undefined but stable within a single query.
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["review", "name"],
                name="unique_review_section_name",
            )
        ]

    def __str__(self) -> str:
        # e.g. "Systematic Review 2024 - Population"
        return f"{self.review} - {self.name}"


class ExtractionQuestion(models.Model):
    """
    A single structured question within an ExtractionSection.

    Question types
    --------------
    The ``type`` field maps to ``QuestionType`` choices.  The front-end uses
    this to decide which input widget to render and how to validate the answer:

    * ``free-text``      — unrestricted multi-line text
    * ``number``         — numeric input; answer stored in both ``value`` and
                          ``value_number`` on the answer model
    * ``date``           — ISO 8601 date string
    * ``single-select``  — one item chosen from ``options``
    * ``multi-select``   — one or more items chosen from ``options``
    * ``boolean``        — yes / no / unknown

    Options
    -------
    For ``single-select`` and ``multi-select`` questions the valid choices are
    stored as a JSON array in ``options`` (e.g. ``["RCT", "cohort", "case-control"]``).
    ``options`` is null for all other question types.

    Ordering
    --------
    Like sections, questions default to ascending ``order`` within their section.
    """

    class QuestionType(models.TextChoices):
        FREE_TEXT = "free-text", "Free Text"
        NUMBER = "number", "Number"
        DATE = "date", "Date"
        SINGLE_SELECT = "single-select", "Single Select"
        MULTI_SELECT = "multi-select", "Multi Select"
        BOOLEAN = "boolean", "Boolean"

    # Parent section; deleting the section removes all its questions.
    section = models.ForeignKey(
        ExtractionSection,
        on_delete=models.CASCADE,
        related_name="questions",
    )

    # The full question text shown to the reviewer (e.g. "What was the sample size?").
    question = models.TextField()

    # Short label used as a column heading in the extraction export table
    # (e.g. "Sample size").
    column_title = models.CharField(max_length=255)

    # Controls the input widget and validation logic on the front-end.
    type = models.CharField(
        max_length=20,
        choices=QuestionType.choices,
    )

    # Valid choices for single-select / multi-select questions.  Stored as a
    # JSON array so the list can be modified without a schema migration.
    # Null for all other question types.
    options = models.JSONField(null=True, blank=True)

    # When True the front-end blocks form submission until the reviewer
    # provides an answer.
    required = models.BooleanField(default=False)

    # Zero-based position within the section.
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self) -> str:
        # e.g. "Population - Sample size"
        return f"{self.section.name} - {self.column_title}"


class ExtractionAnswer(models.Model):
    """
    One reviewer-supplied answer for a specific question on a specific reference.

    There is at most one answer per (reference, question) pair — the unique
    constraint ``unique_reference_question_answer`` enforces this at the DB level,
    so upsert-style operations should use ``update_or_create`` or bulk operations
    with ``update_conflicts=True``.

    Dual-value storage
    ------------------
    Answers are always stored as text in ``value`` so they can round-trip
    without loss of formatting.  For ``number``-type questions the parsed float
    is *also* written to ``value_number``, which carries a DB index and allows
    efficient numeric filtering, sorting, and aggregation in the extraction
    export without casting.

    Cascade behaviour
    -----------------
    * Deleting a ``Reference`` removes all its answers.
    * Deleting an ``ExtractionQuestion`` removes all answers to that question.
    """

    # The reference (paper) this answer relates to.
    reference = models.ForeignKey(
        "references.Reference",
        on_delete=models.CASCADE,
        related_name="extraction_answers",
    )

    # The question being answered.  db_index speeds up lookups by question
    # (e.g. "give me all answers to question X across all references").
    question = models.ForeignKey(
        ExtractionQuestion,
        on_delete=models.CASCADE,
        related_name="answers",
        db_index=True,
    )

    # The canonical text representation of the answer.  Always populated;
    # empty string signals "no answer provided" rather than null.
    value = models.TextField(blank=True, default="")

    # Parsed numeric value for ``number``-type questions.  Null for all other
    # types, or when the text value cannot be parsed as a float.  Indexed to
    # enable fast range queries in the extraction export.
    value_number = models.FloatField(null=True, blank=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "question"],
                name="unique_reference_question_answer",
            )
        ]

    def __str__(self) -> str:
        # e.g. "Answer for Sample size - Ref 42"
        return f"Answer for {self.question.column_title} - Ref {self.reference.id}"
