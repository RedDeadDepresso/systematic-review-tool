import uuid

from django.db import models


# MainTheme
class MainTheme(models.Model):
    """
    Top-level thematic grouping for qualitative codes within a review.
    """

    # Display label shown in the UI and used by __str__.
    name = models.CharField(max_length=150)

    # Optional free-text explanation of what belongs under this theme.
    description = models.TextField(blank=True)

    # Review this theme belongs to.  Cascade ensures cleanup when a review
    # is deleted.
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="main_themes",
    )

    # The reviewer who created this theme.  Cascade mirrors the review FK —
    # removing a member removes their themes.
    member = models.ForeignKey(
        "reviews.ReviewMember",
        on_delete=models.CASCADE,
        related_name="main_themes",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# SubTheme
class SubTheme(models.Model):
    """
    Optional refinement of a MainTheme.
    """

    # Display label shown in the UI and used by __str__.
    name = models.CharField(max_length=150)

    # Optional free-text explanation of what belongs under this sub-theme.
    description = models.TextField(blank=True)

    # Review this sub-theme belongs to.
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="sub_themes",
    )

    # The reviewer who created this sub-theme.
    member = models.ForeignKey(
        "reviews.ReviewMember",
        on_delete=models.CASCADE,
        related_name="sub_themes",
    )

    # Parent theme — nullable so sub-themes survive their parent being deleted.
    main_theme = models.ForeignKey(
        MainTheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sub_themes",
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


# Code
class Code(models.Model):
    """
    A single qualitative annotation on a reference (PDF page, image, etc.).
    """

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

    # UUID PK — allows the client to generate IDs before the server persists them.
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
    )

    # Which kind of highlight/annotation this code represents.
    type = models.CharField(
        max_length=20,
        choices=HighlightType.choices,
        null=True,
        blank=True,
    )

    # The coded label / quotation entered by the reviewer.
    name = models.TextField(blank=False)

    # Review this code belongs to.
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="codes",
    )

    # Source document.  SET_NULL so deleting the reference preserves the code
    # for review-level analysis even without the original document.
    reference = models.ForeignKey(
        "references.Reference",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="codes",
    )

    # Reviewer who created this code.
    member = models.ForeignKey(
        "reviews.ReviewMember",
        on_delete=models.CASCADE,
        related_name="codes",
    )

    # Thematic grouping.  SET_NULL preserves the code if the sub-theme is removed.
    sub_theme = models.ForeignKey(
        SubTheme,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="codes",
    )

    # react-pdf-highlighter JSON payloads ─────────────────────────────────────
    # ``content`` holds the selected text or image data ({"text": "…"} or
    # {"image": "<data-url>"}).
    content = models.JSONField(null=True, blank=True)

    # ``position`` holds the bounding rects and page number returned by the
    # highlighter library ({"boundingRect": {…}, "rects": […], "pageNumber": N}).
    position = models.JSONField(null=True, blank=True)

    # Reviewer's annotation note attached to this highlight.
    comment = models.TextField(null=True, blank=True)

    # Visual style — only meaningful for TEXT and AREA highlights.
    highlight_color = models.CharField(max_length=50, null=True, blank=True)
    highlight_style = models.CharField(
        max_length=20,
        choices=HighlightStyle.choices,
        null=True,
        blank=True,
    )

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
