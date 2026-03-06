"""
Models for the coding app.

The coding app supports qualitative synthesis by letting reviewers highlight
passages in PDFs and tag them with thematic codes.  The three models form a
simple hierarchy:

    Review ──< MainTheme ──< SubTheme ──< Code >── Reference

MainTheme
    Top-level thematic bucket scoped to a review and the member who created it.

SubTheme
    Optional sub-division of a MainTheme.  ``main_theme`` is nullable so a
    SubTheme can exist independently if it has not yet been assigned to a theme.

Code
    A single highlight on a PDF page (or a free-text note, image annotation,
    drawing, or shape).  Stores the react-pdf-highlighter ``content`` and
    ``position`` payloads as JSON.  Linked to an optional SubTheme and an
    optional Reference.
"""

import uuid

from django.db import models


# ---------------------------------------------------------------------------
# MainTheme
# ---------------------------------------------------------------------------


class MainTheme(models.Model):
    """
    Top-level thematic grouping for qualitative codes within a review.

    Each MainTheme belongs to exactly one Review and is owned by the
    ReviewMember who created it.  Deleting the review cascades and removes
    all associated MainThemes (and, transitively, their SubThemes and Codes).
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


# ---------------------------------------------------------------------------
# SubTheme
# ---------------------------------------------------------------------------


class SubTheme(models.Model):
    """
    Optional refinement of a MainTheme.

    ``main_theme`` is nullable so a SubTheme can be created before it is
    assigned to a parent, or kept as a standalone category.  When a
    MainTheme is deleted the FK is set to NULL rather than cascading, which
    preserves the SubTheme and its Codes.
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


# ---------------------------------------------------------------------------
# Code
# ---------------------------------------------------------------------------


class Code(models.Model):
    """
    A single qualitative annotation on a reference (PDF page, image, etc.).

    Codes are the leaf nodes of the coding hierarchy: Review → MainTheme →
    SubTheme → Code.  Each Code stores the full react-pdf-highlighter payload
    so the UI can reconstruct the highlight without any additional queries.

    Highlight types
    ---------------
    TEXT / AREA    — standard PDF highlights; support color and style.
    FREETEXT       — an inline text note; no position highlight.
    IMAGE          — image region selection.
    DRAWING        — freehand drawing overlay.
    SHAPE          — geometric shape overlay.

    UUID primary key
    ----------------
    react-pdf-highlighter generates client-side IDs as UUIDs.  Using a UUID
    PK here means the client-generated ID can be stored directly without a
    server-side ID mapping step.
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
