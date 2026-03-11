"""
Serializers for the reviews app.

Covers:
- Model serializers: Review, ReviewMember, ReviewChatMessage, ReviewInvitation,
  ScreeningCriteria, ScreeningStat, SearchMethod.
- Action / response serializers: one dedicated serializer per custom-view
  response shape, ensuring Spectacular generates accurate OpenAPI docs and
  that response payloads are always validated before being sent.
"""

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers

from slrt_project.integrations.models import ZoteroIntegration
from slrt_project.reviews.models import (
    Review,
    ReviewChatMessage,
    ReviewInvitation,
    ReviewMember,
    ScreeningCriteria,
    ScreeningStat,
    SearchMethod,
)
from slrt_project.users.api.serializers import UserSerializer


# ===========================================================================
# Model serializers
# ===========================================================================

# ---------------------------------------------------------------------------
# ReviewMember
# ---------------------------------------------------------------------------


class ReviewMemberSerializer(serializers.ModelSerializer):
    """
    Serializes a ReviewMember with the nested User.

    Role validation rules:
    - An existing Owner's role cannot be changed.
    - No member may be promoted to Owner via this serializer.
    """

    user = UserSerializer(read_only=True)

    class Meta:
        model = ReviewMember
        fields = ["id", "role", "user"]
        read_only_fields = ["id", "user"]

    def validate_role(self, new_role: str) -> str:
        """Prevent illegal role mutations (see class docstring)."""
        instance: ReviewMember | None = self.instance

        if instance is None:
            return new_role  # No constraints on creation.

        if instance.role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError(
                "You cannot change the role of the review owner."
            )
        if new_role == ReviewMember.Role.OWNER:
            raise serializers.ValidationError("You cannot assign the Owner role.")

        return new_role


# ---------------------------------------------------------------------------
# ReviewChatMessage
# ---------------------------------------------------------------------------


class ReviewChatMessageSerializer(serializers.ModelSerializer):
    """
    Full serialization of a chat message with the nested member.
    System messages have ``member`` set to null.
    """

    member = ReviewMemberSerializer()

    class Meta:
        model = ReviewChatMessage
        fields = "__all__"


# ---------------------------------------------------------------------------
# ScreeningStat
# ---------------------------------------------------------------------------


class ScreeningStatSerializer(serializers.ModelSerializer):
    """
    Flat screening-activity payload with derived display fields.

    ``user_name`` and ``user_email`` are pulled from the related member's user
    so callers receive a ready-to-display payload without extra lookups.
    ``hours`` converts raw seconds to a rounded float.
    """

    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()
    hours = serializers.SerializerMethodField()

    class Meta:
        model = ScreeningStat
        fields = ["id", "user_name", "user_email", "seconds", "hours", "sessions"]

    @extend_schema_field(serializers.CharField)
    def get_user_name(self, obj: ScreeningStat) -> str:
        user = obj.member.user
        return f"{user.first_name} {user.last_name}".strip()

    @extend_schema_field(serializers.EmailField)
    def get_user_email(self, obj: ScreeningStat) -> str:
        return obj.member.user.email

    @extend_schema_field(serializers.FloatField)
    def get_hours(self, obj: ScreeningStat) -> float:
        """Total seconds converted to hours, rounded to 2 decimal places."""
        return round(obj.seconds / 3600, 2)


# ---------------------------------------------------------------------------
# OpinionStats  (aggregated — no model backing)
# ---------------------------------------------------------------------------


class OpinionStatsSerializer(serializers.Serializer):
    """
    Read-only serializer for per-member opinion counts returned by
    ``Review.compute_opinion_stats()``.

    Backed by plain dicts from the ORM ``.values().annotate()`` query.
    """

    member_id = serializers.IntegerField()
    user_name = serializers.CharField()
    user_email = serializers.EmailField()
    excluded = serializers.IntegerField()
    maybe = serializers.IntegerField()
    included = serializers.IntegerField()
    total = serializers.IntegerField()


# ---------------------------------------------------------------------------
# Review (detail)
# ---------------------------------------------------------------------------


class ReviewSerializer(serializers.ModelSerializer):
    """
    Detail serializer for a single Review.

    Several fields (``reference_count``, ``duplicate_*_count``) are expected
    to be annotated by the view's queryset — they are read-only here and
    return ``None`` when the annotation is absent.

    ``user_role`` is also annotated by the view to avoid an extra DB query
    per request.
    """

    user_role = serializers.SerializerMethodField()
    user_member_id = serializers.IntegerField(read_only=True)

    reference_count = serializers.IntegerField(read_only=True, allow_null=True)
    duplicate_resolved_count = serializers.IntegerField(read_only=True)
    duplicate_not_duplicate_count = serializers.IntegerField(read_only=True)
    duplicate_deleted_count = serializers.IntegerField(read_only=True)
    duplicate_clusters_count = serializers.IntegerField(read_only=True, allow_null=True)
    duplicate_clusters_unresolved_count = serializers.IntegerField(
        read_only=True, allow_null=True
    )

    date_created = serializers.DateTimeField(format="%d %b %Y", read_only=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "title",
            "description",
            "is_active",
            "reference_count",
            "date_created",
            "is_blinded",
            "user_role",
            "user_member_id",
            "duplicate_detection_status",
            "duplicate_resolved_count",
            "duplicate_not_duplicate_count",
            "duplicate_deleted_count",
            "duplicate_clusters_unresolved_count",
            "duplicate_clusters_count",
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_user_role(self, obj: Review) -> str | None:
        """Return the pre-annotated role of the requesting user."""
        return getattr(obj, "user_role", None)

    def get_has_zotero_integration(self, obj: Review) -> bool:
        """
        True when the review has a fully configured Zotero integration.
        Not included in ``Meta.fields`` by default.
        """
        try:
            return obj.zotero_integration.is_configured
        except ZoteroIntegration.DoesNotExist:
            return False


# ---------------------------------------------------------------------------
# Review (list)
# ---------------------------------------------------------------------------


class ReviewListSerializer(serializers.ModelSerializer):
    """
    Lightweight list serializer.

    ``owner`` is built from queryset annotations to avoid N+1 queries.
    ``user_role`` is similarly annotated by the view.
    """

    user_role = serializers.SerializerMethodField()
    date_created = serializers.DateTimeField(format="%d %b %Y")
    owner = serializers.SerializerMethodField()
    reference_count = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = Review
        fields = [
            "id",
            "title",
            "date_created",
            "owner",
            "reference_count",
            "user_role",
        ]

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_user_role(self, obj: Review) -> str | None:
        return getattr(obj, "user_role", None)

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_owner(self, obj: Review) -> str | None:
        """Format owner as "First Last (email)" from annotated fields."""
        email = getattr(obj, "owner_email", None)
        if not email:
            return None
        first = getattr(obj, "owner_first_name", "")
        last = getattr(obj, "owner_last_name", "")
        full_name = f"{first} {last}".strip()
        return f"{full_name} ({email})" if full_name else email


# ---------------------------------------------------------------------------
# ReviewInvitation
# ---------------------------------------------------------------------------


class ReviewInvitationCreateSerializer(serializers.Serializer):
    """
    Validates bulk-invite payloads.

    ``emails`` is a non-empty list of valid e-mail addresses; the view
    iterates over them and creates individual invitation records.
    """

    review = serializers.IntegerField()
    emails = serializers.ListField(child=serializers.EmailField(), allow_empty=False)


class ReviewInvitationSerializer(serializers.ModelSerializer):
    """Full read-oriented serialization of an existing ReviewInvitation."""

    review = serializers.StringRelatedField()
    invited_by = serializers.StringRelatedField()
    created_at = serializers.DateTimeField(format="%d %b %Y")

    class Meta:
        model = ReviewInvitation
        fields = "__all__"
        read_only_fields = ["created_at"]


# ---------------------------------------------------------------------------
# ScreeningCriteria
# ---------------------------------------------------------------------------


class ScreeningCriteriaSerializer(serializers.ModelSerializer):
    """Serializer for inclusion/exclusion screening criteria."""

    class Meta:
        model = ScreeningCriteria
        fields = ["id", "review", "name", "description", "type"]
        read_only_fields = ["id"]


# ---------------------------------------------------------------------------
# Label / article count helpers  (read-only)
# ---------------------------------------------------------------------------


class LabelCountSerializer(serializers.Serializer):
    """Pairs a label with the number of references that carry it."""

    id = serializers.IntegerField()
    name = serializers.CharField()
    color = serializers.CharField(allow_null=True)
    count = serializers.IntegerField()


class ArticleCountSerializer(serializers.Serializer):
    """
    Summary of how many references fall into each screening bucket
    plus a per-label breakdown.
    """

    included = serializers.IntegerField()
    maybe = serializers.IntegerField()
    labeled = serializers.IntegerField()
    labels = LabelCountSerializer(many=True)


# ---------------------------------------------------------------------------
# AddData  (request)
# ---------------------------------------------------------------------------


class AddDataSerializer(serializers.Serializer):
    """
    Validates the ``add-data`` action request body.

    Cross-field rule: source and sink cannot both be ``"full-text"``.
    ``label_ids`` is optional and only meaningful when ``"labeled"`` is in
    ``article_types``.
    """

    data_source = serializers.ChoiceField(choices=["screening", "full-text"])
    data_sink = serializers.ChoiceField(choices=["full-text", "extraction"])
    article_types = serializers.ListField(
        child=serializers.ChoiceField(choices=["included", "maybe", "labeled"]),
    )
    label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )

    def validate(self, attrs: dict) -> dict:
        if attrs["data_source"] == "full-text" and attrs["data_sink"] == "full-text":
            raise serializers.ValidationError(
                "Source and destination cannot both be full-text."
            )
        return attrs


# ---------------------------------------------------------------------------
# SearchMethod
# ---------------------------------------------------------------------------


class SearchMethodSerializer(serializers.ModelSerializer):
    """Minimal serializer for a SearchMethod (id + name only)."""

    class Meta:
        model = SearchMethod
        fields = ["id", "name"]


class SearchMethodDetailSerializer(serializers.ModelSerializer):
    """
    SearchMethod serializer used in the ``search-methods`` list action.
    Mirrors the minimal form for now; extend with file metadata if required.
    """

    class Meta:
        model = SearchMethod
        fields = ["id", "name"]


# ===========================================================================
# Action / response serializers
#
# One serializer per custom-endpoint response shape.
# Used by views for serializing output AND by drf-spectacular for OpenAPI docs.
# ===========================================================================

# ---------------------------------------------------------------------------
# upload-references  →  202
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="UploadReferencesResponse")
class UploadReferencesResponseSerializer(serializers.Serializer):
    """202 Accepted response body for the ``upload-references`` action."""

    message = serializers.CharField(help_text="Human-readable status message.")
    task_id = serializers.CharField(help_text="Celery task ID for the import job.")
    search_method_id = serializers.IntegerField(
        help_text="ID of the created SearchMethod record."
    )
    filename = serializers.CharField(help_text="Original filename as uploaded.")
    file_type = serializers.ChoiceField(
        choices=["bib", "ris", "endnote"],
        help_text="Detected file format used by the import task.",
    )
    status = serializers.CharField(
        help_text="Current processing status (always 'processing' at this point)."
    )


# ---------------------------------------------------------------------------
# add-data  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="AddDataResponse")
class AddDataResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``add-data`` action."""

    updated = serializers.IntegerField(
        help_text="Number of references promoted to the destination stage."
    )


# ---------------------------------------------------------------------------
# detect-duplicates  —  request + 202 response
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="DetectDuplicatesRequest")
class DetectDuplicatesRequestSerializer(serializers.Serializer):
    """Request body for the ``detect-duplicates`` action."""

    threshold = serializers.FloatField(
        default=0.5,
        min_value=0.0,
        max_value=1.0,
        help_text="Fuzzy-similarity threshold (0.0–1.0, default 0.5).",
    )


@extend_schema_serializer(component_name="DetectDuplicatesResponse")
class DetectDuplicatesResponseSerializer(serializers.Serializer):
    """202 Accepted response body for the ``detect-duplicates`` action."""

    message = serializers.CharField()
    task_id = serializers.CharField(help_text="Celery task ID.")
    status = serializers.CharField()
    threshold = serializers.FloatField()


# ---------------------------------------------------------------------------
# auto-resolve-duplicates  —  request + 202 response
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="AutoResolveDuplicatesRequest")
class AutoResolveDuplicatesRequestSerializer(serializers.Serializer):
    """
    Request body for the ``auto-resolve-duplicates`` action.

    All fields are optional; defaults are applied automatically.
    ``preferred_search_method_id`` is validated against the review passed
    in serializer context.
    """

    confidence_threshold = serializers.FloatField(
        default=0.90,
        min_value=0.0,
        max_value=1.0,
        help_text="Minimum cluster confidence score to trigger auto-resolution.",
    )
    detect_first = serializers.BooleanField(
        default=True,
        help_text="Run detection before attempting resolution.",
    )
    fuzzy_threshold = serializers.FloatField(
        default=0.50,
        min_value=0.0,
        max_value=1.0,
        help_text="Similarity threshold used in the optional detection step.",
    )
    doi_clusters_always = serializers.BooleanField(
        default=True,
        help_text="Always resolve DOI-matched clusters regardless of confidence.",
    )
    preferred_search_method_id = serializers.IntegerField(
        required=False,
        allow_null=True,
        default=None,
        help_text="Prefer references from this SearchMethod when picking a canonical record.",
    )

    def validate_preferred_search_method_id(self, value: int | None) -> int | None:
        """Check that the supplied SearchMethod belongs to the current review."""
        if value is None:
            return value
        review = self.context.get("review")
        if review and not review.searchmethod_set.filter(id=value).exists():
            raise serializers.ValidationError("Invalid search method for this review.")
        return value


@extend_schema_serializer(component_name="AutoResolveDuplicatesResponse")
class AutoResolveDuplicatesResponseSerializer(serializers.Serializer):
    """202 Accepted response body for the ``auto-resolve-duplicates`` action."""

    message = serializers.CharField()
    task_id = serializers.CharField(help_text="Celery task ID.")
    status = serializers.CharField()
    confidence_threshold = serializers.FloatField()
    detect_first = serializers.BooleanField()
    fuzzy_threshold = serializers.FloatField()
    doi_clusters_always = serializers.BooleanField()
    preferred_search_method_id = serializers.IntegerField(allow_null=True)


# ---------------------------------------------------------------------------
# prisma  →  200
# ---------------------------------------------------------------------------


class PrismaValidationIssueSerializer(serializers.Serializer):
    """A single PRISMA diagram validation warning or error."""

    severity = serializers.CharField()
    message = serializers.CharField()


@extend_schema_serializer(component_name="PrismaResponse")
class PrismaResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``prisma`` action."""

    message = serializers.CharField()
    file_url = serializers.URLField(
        allow_null=True,
        help_text="Absolute URL of the generated PNG diagram.",
    )
    interactive_url = serializers.URLField(
        help_text="Pre-populated interactive PRISMA flowchart URL."
    )
    data = serializers.DictField(
        help_text="Raw PRISMA data structure (db_registers + included)."
    )
    validation_issues = PrismaValidationIssueSerializer(many=True)


# ---------------------------------------------------------------------------
# export-json  →  200
# ---------------------------------------------------------------------------


class CodeExportSerializer(serializers.Serializer):
    id = serializers.CharField()
    name = serializers.CharField()
    comment = serializers.CharField(allow_null=True)
    type = serializers.CharField()
    highlightColor = serializers.CharField(allow_null=True)
    referenceId = serializers.IntegerField(allow_null=True)


class SubthemeExportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    codeCount = serializers.IntegerField()
    codes = CodeExportSerializer(many=True)


class ThemeExportSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    name = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    subthemeCount = serializers.IntegerField()
    subthemes = SubthemeExportSerializer(many=True)


@extend_schema_serializer(component_name="ExportJsonResponse")
class ExportJsonResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``export-json`` action (non-download mode)."""

    reviewId = serializers.IntegerField()
    reviewTitle = serializers.CharField()
    exportedAt = serializers.CharField(help_text="ISO-8601 timestamp.")
    themeCount = serializers.IntegerField()
    themes = ThemeExportSerializer(many=True)


# ---------------------------------------------------------------------------
# export-latex  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="ExportLatexResponse")
class ExportLatexResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``export-latex`` action (non-download mode)."""

    latex_code = serializers.CharField(help_text="Generated LaTeX source code.")
    review_id = serializers.IntegerField()
    review_title = serializers.CharField()
    theme_count = serializers.IntegerField()
    format = serializers.ChoiceField(choices=["table_only", "full_document"])


# ---------------------------------------------------------------------------
# Invitation accept / decline  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="InvitationAcceptDeclineResponse")
class InvitationAcceptDeclineResponseSerializer(serializers.Serializer):
    """200 OK response body for the invitation ``accept`` and ``decline`` actions."""

    detail = serializers.CharField()
