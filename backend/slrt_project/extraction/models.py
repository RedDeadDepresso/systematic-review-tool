from django.db import models


# Create your models here.
class ExtractionSection(models.Model):
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]
        constraints = [
            models.UniqueConstraint(
                fields=["review", "name"], name="unique_review_section_name"
            )
        ]

    def __str__(self):
        return f"{self.review} - {self.name}"


class ExtractionQuestion(models.Model):
    class QuestionType(models.TextChoices):
        FREE_TEXT = "free-text", "Free Text"
        NUMBER = "number", "Number"
        DATE = "date", "Date"
        SINGLE_SELECT = "single-select", "Single Select"
        MULTI_SELECT = "multi-select", "Multi Select"
        BOOLEAN = "boolean", "Boolean"

    section = models.ForeignKey(
        ExtractionSection, on_delete=models.CASCADE, related_name="questions"
    )
    question = models.TextField()
    column_title = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=QuestionType.choices)
    options = models.JSONField(null=True, blank=True)
    required = models.BooleanField(default=False)
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order"]

    def __str__(self):
        return f"{self.section.name} - {self.column_title}"


class ExtractionAnswer(models.Model):
    reference = models.ForeignKey(
        "references.Reference",
        on_delete=models.CASCADE,
        related_name="extraction_answers",
    )
    question = models.ForeignKey(
        ExtractionQuestion,
        on_delete=models.CASCADE,
        related_name="answers",
        db_index=True,
    )
    value = models.TextField(blank=True, default="")
    value_number = models.FloatField(null=True, blank=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["reference", "question"],
                name="unique_reference_question_answer",
            )
        ]

    def __str__(self):
        return f"Answer for {self.question.column_title} - Ref {self.reference.id}"
