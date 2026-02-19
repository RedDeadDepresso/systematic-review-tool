import uuid

from django.db import models


# Create your models here.
class MainTheme(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)

    def __str__(self):
        return self.name


class SubTheme(models.Model):
    name = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)
    main_theme = models.ForeignKey(
        MainTheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_themes",
    )

    def __str__(self):
        return self.name


class Code(models.Model):
    class HighlightType(models.TextChoices):
        TEXT = "text", "Text"
        AREA = "area", "Area"
        FREETEXT = "freetext", "Free text"
        IMAGE = "image", "Image"
        DRAWING = "drawing", "Drawing"
        SHAPE = "shape", "Shape"

    class HighlightStyle(models.TextChoices):
        HIGHLIGHT = "highlight", "Highlight"
        UNDERLINE = "underline", "Underline"
        STRIKETHROUGH = "strikethrough", "Strikethrough"

    # Core identity
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Highlight type
    type = models.CharField(
        max_length=20,
        choices=HighlightType.choices,
        null=True,
        blank=True,
    )

    name = models.TextField(blank=False)
    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)
    reference = models.ForeignKey(
        "references.Reference",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="codes",
    )
    member = models.ForeignKey("reviews.ReviewMember", on_delete=models.CASCADE)
    sub_theme = models.ForeignKey(
        SubTheme, on_delete=models.SET_NULL, null=True, blank=True, related_name="codes"
    )

    # react-pdf-highlighter payloads
    content = models.JSONField(null=True, blank=True)
    position = models.JSONField(null=True, blank=True)

    # Comment
    comment = models.TextField(null=True, blank=True)

    # Text / Area highlight styles
    highlight_color = models.CharField(max_length=50, null=True, blank=True)
    highlight_style = models.CharField(
        max_length=20,
        choices=HighlightStyle.choices,
        null=True,
        blank=True,
    )

    def __str__(self):
        return self.name
