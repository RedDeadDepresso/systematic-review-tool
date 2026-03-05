"""
Serializers for the references app.

Organisation
------------
Model serializers
  UploadedPDFSerializer          — PDF uploads (model-backed)
  BaseReferenceSerializer        — read-only reference fields shared by all views
  ReferenceSerializer            — full reference with opinions, labels, assignee
  ReferenceOpinionSerializer     — per-member opinion with cross-field validation
  KeywordSerializer              — inclusion / exclusion keywords
  NoteSerializer                 — per-member notes on a reference
  LabelSerializer                — user-owned labels
  ClusterMemberSerializer        — a single member inside a duplicate cluster
  DuplicateClusterSerializer     — a cluster with its members

Input / action serializers
  AttachPDFMappingSerializer     — one mapping entry in an attach-PDFs request
  AttachPDFsSerializer           — bulk PDF-attachment request
  AutoMatchSerializer            — auto-match PDF request
  BulkCreateNoteSerializer       — bulk note creation request
  AssignReferencesSerializer     — assign / remove / split references
  AssignLabelsSerializer         — apply / remove labels across references
  ReferenceOpinionUpsertSerializer — bulk-upsert opinions

Response serializers  (one per custom action, used for OpenAPI docs + validation)
  AttachPDFsResponseSerializer       — attach-pdfs 200 payload
  AutoMatchResponseSerializer        — auto-match 200 payload
  BulkSyncPDFsResponseSerializer     — bulk-sync-pdfs 202 payload
  AssignReferencesResponseSerializer — assign 200 payload
  AssignLabelsResponseSerializer     — assign-to-references 200 payload
  BulkCreateNoteResponseSerializer   — bulk-create note 201 payload
  ResolveClusterResponseSerializer   — cluster resolve 200 payload
  DismissClusterResponseSerializer   — cluster dismiss 200 payload
  ClusterStatsResponseSerializer     — cluster stats 200 payload
  ClusterListResponseSerializer      — cluster list 200 payload (progress metadata)
"""

from drf_spectacular.utils import extend_schema_field, extend_schema_serializer
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from slrt_project.permissions import PERMISSIONS, Permission, permission_denied_message
from slrt_project.references.models import (
    Keyword,
    Label,
    Note,
    Reason,
    Reference,
    ReferenceCluster,
    ReferenceClusterMember,
    ReferenceLabel,
    ReferenceOpinion,
    ReferenceOpinionStatus,
    UploadedPDF,
)
from slrt_project.reviews.api.serializers import ReviewMemberSerializer
from slrt_project.reviews.models import Review, ReviewMember


# ===========================================================================
# Model serializers
# ===========================================================================

# ---------------------------------------------------------------------------
# UploadedPDF
# ---------------------------------------------------------------------------


class UploadedPDFSerializer(serializers.ModelSerializer):
    """
    Serialises an UploadedPDF.

    ``name`` is derived from ``__str__`` so the extension is stripped and the
    display name stays consistent with the stored filename.
    """

    name = serializers.SerializerMethodField()

    class Meta:
        model = UploadedPDF
        fields = ["id", "name", "file", "review"]
        read_only_fields = ["id"]

    @extend_schema_field(serializers.CharField)
    def get_name(self, obj: UploadedPDF) -> str:
        return str(obj)

    def validate_file(self, value):
        """Only PDF files may be uploaded here."""
        if not value.name.lower().endswith(".pdf"):
            raise serializers.ValidationError("Only PDF files are allowed.")
        return value


# ---------------------------------------------------------------------------
# Reference (base — shared read fields)
# ---------------------------------------------------------------------------


class BaseReferenceSerializer(serializers.ModelSerializer):
    """
    Minimal, read-only reference payload.

    Used as a nested serialiser inside ``ClusterMemberSerializer`` and as the
    base for the full ``ReferenceSerializer``.  All fields are read-only so
    it can never be used for writes by mistake.
    """

    # Show the name of the related SearchMethod instead of its PK.
    search_method = serializers.StringRelatedField()

    class Meta:
        model = Reference
        fields = [
            "id",
            "title",
            "publication_type",
            "authors",
            "journal",
            "search_method",
            "article_customizations",
            "abstract",
            "doi",
            "publication_date",
            "duplicate_status",
            "pages",
        ]
        read_only_fields = fields


# ---------------------------------------------------------------------------
# Reference (full — with opinions, labels, assignee)
# ---------------------------------------------------------------------------


class ReferenceSerializer(BaseReferenceSerializer):
    """
    Full reference serializer used in the review-data and screening views.

    Derived fields (``opinions``, ``labels``, ``assignee``) are computed from
    prefetched querysets attached by the view so that no extra DB queries are
    fired per reference row.

    The ``publication_date`` field is formatted as DD/MM/YYYY for the
    frontend; this overrides the ISO format from the base class.
    """

    opinions = serializers.SerializerMethodField(
        help_text="Per-member screening opinions for this reference."
    )
    publication_date = serializers.DateField(
        format="%d/%m/%Y",
        help_text="Publication date formatted as DD/MM/YYYY.",
    )
    labels = serializers.SerializerMethodField(
        help_text="Labels applied by the current user."
    )
    assignee = serializers.SerializerMethodField(
        help_text="The ReviewMember this reference is currently assigned to."
    )

    class Meta(BaseReferenceSerializer.Meta):
        fields = BaseReferenceSerializer.Meta.fields + [
            "file",
            "opinions",
            "labels",
            "assignee",
        ]
        read_only_fields = fields

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_opinions(self, obj: Reference):
        """
        Returns opinions from the ``prefetched_opinions`` queryset attribute
        attached by the view.  Returns ``None`` (not ``[]``) when the view
        has not prefetched opinions — this is an intentional sentinel that
        the frontend interprets as "data not available".
        """
        opinions = getattr(obj, "prefetched_opinions", None)
        if opinions is None:
            return None
        return [
            {
                "member": {
                    "id": op.member.id,
                    "user": {
                        "first_name": op.member.user.first_name,
                        "last_name": op.member.user.last_name,
                        "email": op.member.user.email,
                        "display_name": str(op.member.user),
                    },
                },
                "status": op.status,
                "reason": op.reason.name if op.reason else None,
                "updated_at": op.updated_at.strftime("%H:%M %d/%m/%Y"),
            }
            for op in opinions
        ]

    @extend_schema_field(serializers.ListField(child=serializers.DictField()))
    def get_labels(self, obj: Reference):
        """
        Returns only labels that belong to the requesting user.

        Reads from the ``prefetched_labels`` attribute when available to avoid
        per-reference DB hits; falls back to a direct query otherwise.
        """
        user = self.context["request"].user
        reference_labels = getattr(obj, "prefetched_labels", None)
        if reference_labels is None:
            reference_labels = ReferenceLabel.objects.filter(
                reference=obj, label__user=user
            ).select_related("label")

        return [
            {"id": rl.label.id, "name": rl.label.name, "color": rl.label.color}
            for rl in reference_labels
        ]

    @extend_schema_field(serializers.DictField(allow_null=True))
    def get_assignee(self, obj: Reference):
        """Returns a flat dict of the assigned member's user fields, or null."""
        if not obj.assignee:
            return None
        return {
            "id": obj.assignee.id,
            "user": {
                "first_name": obj.assignee.user.first_name,
                "last_name": obj.assignee.user.last_name,
                "email": obj.assignee.user.email,
            },
        }


# ---------------------------------------------------------------------------
# ReferenceOpinion
# ---------------------------------------------------------------------------


class ReferenceOpinionSerializer(serializers.ModelSerializer):
    """
    Serialiser for a single ReferenceOpinion record.

    Validation rules
    ----------------
    - ``reason`` is only meaningful when ``status`` is EXCLUDED; it is
      silently cleared for all other statuses.
    - When a reason is supplied it must belong to the same review as the
      reference (prevents cross-review data leakage).
    """

    # Display the member's __str__ instead of its PK.
    member = serializers.StringRelatedField()
    reason = serializers.StringRelatedField(read_only=True)
    updated_at = serializers.DateTimeField(format="%H:%M %d/%m/%Y")

    class Meta:
        model = ReferenceOpinion
        fields = ["id", "member", "status", "reason", "updated_at"]
        read_only_fields = ["id", "member", "reason", "updated_at"]

    def validate(self, attrs: dict) -> dict:
        instance = getattr(self, "instance", None)

        status = attrs.get("status", getattr(instance, "status", None))
        reason = attrs.get("reason", getattr(instance, "reason", None))
        reference = attrs.get("reference", getattr(instance, "reference", None))

        # Reason is only valid for EXCLUDED opinions.
        if status != ReferenceOpinionStatus.EXCLUDED:
            attrs["reason"] = None

        # Guard against reasons that belong to a different review.
        if reason and reference and reason.review_id != reference.review_id:
            raise serializers.ValidationError(
                {"reason": "Reason must belong to the same review."}
            )

        return attrs


# ---------------------------------------------------------------------------
# Keyword
# ---------------------------------------------------------------------------


class KeywordSerializer(serializers.ModelSerializer):
    """
    Inclusion / exclusion keyword for a review.

    ``review`` is set by the view's ``perform_create`` — it is read-only here
    to prevent clients from assigning keywords to arbitrary reviews.
    """

    class Meta:
        model = Keyword
        fields = ["id", "review", "name", "type"]
        read_only_fields = ["id", "review"]


# ---------------------------------------------------------------------------
# Note
# ---------------------------------------------------------------------------


class NoteSerializer(serializers.ModelSerializer):
    """
    A reviewer note attached to a specific reference.

    ``member`` is nested and read-only (set from the request user by the view).
    ``created_at`` and ``edited_at`` are managed by the model.
    """

    member = ReviewMemberSerializer(read_only=True)

    class Meta:
        model = Note
        fields = ["id", "member", "content", "created_at", "edited_at"]
        read_only_fields = ["member", "created_at", "edited_at"]


# ---------------------------------------------------------------------------
# Label
# ---------------------------------------------------------------------------


class LabelSerializer(serializers.ModelSerializer):
    """
    User-owned label.

    ``user`` is injected by the view's ``perform_create``; it is read-only
    here so clients cannot create labels on behalf of other users.

    Validation enforces uniqueness of ``name`` per user.
    """

    class Meta:
        model = Label
        fields = ["id", "user", "name", "color", "hotkey"]
        read_only_fields = ["id", "user"]

    def validate_name(self, value: str) -> str:
        """Reject duplicate label names for this user."""
        user = self.context["request"].user
        if Label.objects.filter(user=user, name=value).exists():
            raise serializers.ValidationError(
                "You already have a label with this name."
            )
        return value


# ---------------------------------------------------------------------------
# Reason
# ---------------------------------------------------------------------------


class ReasonSerializer(serializers.ModelSerializer):
    """Exclusion reason for a review."""

    class Meta:
        model = Reason
        fields = ["id", "name", "review"]
        read_only_fields = ["id"]


# ---------------------------------------------------------------------------
# Duplicate cluster
# ---------------------------------------------------------------------------


class ClusterMemberSerializer(serializers.ModelSerializer):
    """
    A single reference inside a duplicate cluster.

    ``reference`` is nested (read-only) to give the frontend all the
    information it needs to render the cluster UI without extra requests.
    """

    reference = BaseReferenceSerializer()

    class Meta:
        model = ReferenceClusterMember
        fields = [
            "id",
            "role",
            "best_similarity_score",
            "doi_matched",
            "completeness_score",
            "reference",
        ]


class DuplicateClusterSerializer(serializers.ModelSerializer):
    """
    A duplicate cluster with all its member references.

    Members are ordered by ``completeness_score`` descending (handled by the
    view's queryset) so the frontend can always show the best candidate first.
    """

    members = ClusterMemberSerializer(many=True)

    class Meta:
        model = ReferenceCluster
        fields = [
            "id",
            "status",
            "doi_match",
            "max_similarity_score",
            "canonical_reference_id",
            "created_at",
            "resolved_at",
            "members",
        ]


# ===========================================================================
# Input / action serializers
# ===========================================================================

# ---------------------------------------------------------------------------
# attach-pdfs
# ---------------------------------------------------------------------------


class AttachPDFMappingSerializer(serializers.Serializer):
    """One (reference → uploaded PDF) mapping entry."""

    reference_id = serializers.IntegerField(
        help_text="ID of the Reference to attach the PDF to."
    )
    uploaded_pdf_id = serializers.IntegerField(
        help_text="ID of the UploadedPDF to attach."
    )


class AttachPDFsSerializer(serializers.Serializer):
    """
    Request body for the ``attach-pdfs`` action.

    Accepts a list of mapping objects that pair each reference with the
    uploaded PDF it should receive.
    """

    mappings = AttachPDFMappingSerializer(
        many=True,
        help_text="List of reference → PDF mappings.",
    )


# ---------------------------------------------------------------------------
# auto-match
# ---------------------------------------------------------------------------


class AutoMatchSerializer(serializers.Serializer):
    """
    Request body for the ``auto-match`` action.

    The view will attempt DOI, exact-name, and trigram fuzzy matching to
    attach uploaded PDFs to the given references automatically.
    """

    review_id = serializers.IntegerField(
        help_text="ID of the Review whose uploaded PDFs should be matched."
    )
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        help_text="References to attempt PDF matching for.",
    )


# ---------------------------------------------------------------------------
# bulk-create notes
# ---------------------------------------------------------------------------


class BulkCreateNoteSerializer(serializers.Serializer):
    """Request body for the ``bulk-create`` notes action."""

    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="References to attach the note to.",
    )
    content = serializers.CharField(
        help_text="Note text to attach to every listed reference."
    )


# ---------------------------------------------------------------------------
# assign references
# ---------------------------------------------------------------------------


class AssignReferencesSerializer(serializers.Serializer):
    """
    Request body for the ``assign`` action.

    ``mode`` controls whether a specific member is assigned, the assignment
    is removed, or references are split equally across all members.
    ``assignee_id`` is required when ``mode`` is ``"assign"``.
    """

    review = serializers.IntegerField(help_text="Review PK.")
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="References to operate on.",
    )
    mode = serializers.ChoiceField(
        choices=["assign", "remove", "split_equally"],
        help_text="Assignment mode.",
    )
    assignee_id = serializers.IntegerField(
        required=False,
        help_text="ReviewMember PK (required for mode=assign).",
    )


# ---------------------------------------------------------------------------
# assign labels to references
# ---------------------------------------------------------------------------


class AssignLabelsSerializer(serializers.Serializer):
    """
    Request body for the ``assign-to-references`` label action.

    Cross-field validation
    ----------------------
    - The requesting user must be a review member with the ASSIGN_LABEL
      permission.
    - All ``reference_ids`` must belong to the supplied ``review``.
    - All label IDs (checked + indeterminate) must belong to the requesting user.

    After validation the ``validated_data`` dict is enriched with resolved
    ORM objects (``member``, ``references``, ``labels``, ``checked_ids``,
    ``indeterminate_ids``) so the view doesn't need to re-query anything.
    """

    review = serializers.PrimaryKeyRelatedField(
        queryset=Review.objects.all(),
        help_text="Review PK.",
    )
    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="References to update labels on.",
    )
    checked_label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Labels to ensure are applied to every reference.",
    )
    indeterminate_label_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
        help_text="Labels to remove from every reference.",
    )

    def validate(self, data: dict) -> dict:
        user = self.context["request"].user
        review = data["review"]

        # Membership + permission check.
        try:
            member = ReviewMember.objects.get(review=review, user=user)
        except ReviewMember.DoesNotExist:
            raise serializers.ValidationError(
                {"review": "You are not a member of this review."}
            )

        permission = Permission.ASSIGN_LABEL
        if member.role not in PERMISSIONS[permission]:
            raise PermissionDenied(permission_denied_message(permission))

        reference_ids = set(data["reference_ids"])
        checked_ids = set(data["checked_label_ids"])
        indeterminate_ids = set(data["indeterminate_label_ids"])

        # Validate all references belong to this review.
        references = Reference.objects.filter(review=review, id__in=reference_ids)
        if references.count() != len(reference_ids):
            raise serializers.ValidationError(
                {
                    "reference_ids": "One or more references do not belong to this review."
                }
            )

        # Validate all labels belong to the requesting user.
        label_ids = checked_ids | indeterminate_ids
        labels = Label.objects.filter(user=user, id__in=label_ids)
        if labels.count() != len(label_ids):
            raise serializers.ValidationError(
                {"label_ids": "One or more labels do not belong to you."}
            )

        # Enrich validated_data so the view doesn't need to re-query.
        data["member"] = member
        data["references"] = references
        data["labels"] = {label.id: label for label in labels}
        data["checked_ids"] = checked_ids
        data["indeterminate_ids"] = indeterminate_ids
        return data


# ---------------------------------------------------------------------------
# bulk-upsert opinions
# ---------------------------------------------------------------------------


class ReferenceOpinionUpsertSerializer(serializers.Serializer):
    """
    Request body for the ``bulk-upsert`` opinion action.

    Deduplicates ``reference_ids`` automatically.
    Clears ``reason`` for any status other than EXCLUDED.
    """

    reference_ids = serializers.ListField(
        child=serializers.IntegerField(),
        allow_empty=False,
        help_text="Reference IDs to upsert opinions for.",
    )
    status = serializers.ChoiceField(
        choices=ReferenceOpinionStatus.choices,
        help_text="Status to set on every opinion.",
    )
    stage = serializers.ChoiceField(
        choices=ReferenceOpinion.Stage.choices,
        help_text="Screening stage for these opinions.",
    )
    reason = serializers.PrimaryKeyRelatedField(
        queryset=Reason.objects.all(),
        required=False,
        allow_null=True,
        help_text="Exclusion reason (only used when status=excluded).",
    )

    def validate_reference_ids(self, value: list) -> list:
        """Silently deduplicate IDs so callers don't need to."""
        return list(set(value))

    def validate(self, attrs: dict) -> dict:
        # Reason only applies to EXCLUDED opinions.
        if attrs["status"] != ReferenceOpinionStatus.EXCLUDED:
            attrs["reason"] = None
        return attrs


# ===========================================================================
# Response serializers
#
# One per custom action.  Used by views to validate outgoing data AND by
# drf-spectacular to generate accurate OpenAPI response schemas.
# ===========================================================================

# ---------------------------------------------------------------------------
# attach-pdfs  →  200
# ---------------------------------------------------------------------------


class AttachedPDFItemSerializer(serializers.Serializer):
    """One updated reference entry in an attach-pdfs response."""

    id = serializers.IntegerField(help_text="Reference ID.")
    file = serializers.URLField(
        allow_null=True,
        help_text="URL of the newly attached file, or null if none.",
    )
    uploaded_pdf_id = serializers.IntegerField(
        help_text="ID of the UploadedPDF that was consumed."
    )


@extend_schema_serializer(component_name="AttachPDFsResponse")
class AttachPDFsResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``attach-pdfs`` action."""

    updated_references = AttachedPDFItemSerializer(
        many=True,
        help_text="Updated reference records.",
    )


# ---------------------------------------------------------------------------
# auto-match  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="AutoMatchResponse")
class AutoMatchResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``auto-match`` action."""

    matched = serializers.IntegerField(
        help_text="Number of references successfully matched to a PDF."
    )
    unmatched = serializers.IntegerField(
        help_text="Number of references for which no PDF was found."
    )


# ---------------------------------------------------------------------------
# bulk-sync-pdfs  →  202
# ---------------------------------------------------------------------------


class SyncTaskSerializer(serializers.Serializer):
    """A single Celery task entry in a bulk-sync-pdfs response."""

    reference_id = serializers.IntegerField()
    task_id = serializers.CharField()


@extend_schema_serializer(component_name="BulkSyncPDFsResponse")
class BulkSyncPDFsResponseSerializer(serializers.Serializer):
    """202 Accepted response body for the ``bulk-sync-pdfs`` action."""

    message = serializers.CharField(help_text="Human-readable status message.")
    tasks = SyncTaskSerializer(
        many=True,
        help_text="Per-reference Celery task entries.",
    )


# ---------------------------------------------------------------------------
# assign references  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="AssignReferencesResponse")
class AssignReferencesResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``assign`` action."""

    detail = serializers.CharField(help_text="Human-readable confirmation message.")


# ---------------------------------------------------------------------------
# assign-to-references (labels)  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="AssignLabelsResponse")
class AssignLabelsResponseSerializer(serializers.Serializer):
    """200 OK response body for the ``assign-to-references`` action."""

    detail = serializers.CharField(help_text="Human-readable confirmation message.")
    created = serializers.IntegerField(
        help_text="Number of ReferenceLabel rows created."
    )
    deleted = serializers.IntegerField(
        help_text="Number of ReferenceLabel rows deleted."
    )


# ---------------------------------------------------------------------------
# bulk-create notes  →  201
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="BulkCreateNoteResponse")
class BulkCreateNoteResponseSerializer(serializers.Serializer):
    """201 Created response body for the note ``bulk-create`` action."""

    created = serializers.IntegerField(help_text="Number of Note rows created.")


# ---------------------------------------------------------------------------
# cluster resolve  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="ResolveClusterResponse")
class ResolveClusterResponseSerializer(serializers.Serializer):
    """200 OK response body for the cluster ``resolve`` action."""

    message = serializers.CharField()
    clusterId = serializers.CharField(help_text="UUID of the resolved cluster.")
    canonicalReferenceId = serializers.IntegerField(
        help_text="ID of the reference chosen as the canonical (kept) record."
    )


# ---------------------------------------------------------------------------
# cluster dismiss  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="DismissClusterResponse")
class DismissClusterResponseSerializer(serializers.Serializer):
    """200 OK response body for the cluster ``dismiss`` action."""

    message = serializers.CharField()
    clusterId = serializers.CharField(help_text="UUID of the dismissed cluster.")


# ---------------------------------------------------------------------------
# cluster stats  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="ClusterStatsResponse")
class ClusterStatsResponseSerializer(serializers.Serializer):
    """200 OK response body for the cluster ``stats`` action."""

    unresolved = serializers.IntegerField()
    autoResolved = serializers.IntegerField()
    manuallyResolved = serializers.IntegerField()
    dismissed = serializers.IntegerField()
    affectedReferences = serializers.IntegerField(
        help_text="References currently inside an unresolved cluster."
    )


# ---------------------------------------------------------------------------
# cluster list  →  200
# ---------------------------------------------------------------------------


@extend_schema_serializer(component_name="ClusterListResponse")
class ClusterListResponseSerializer(serializers.Serializer):
    """
    200 OK response body for the cluster ``list`` action.

    Wraps the paginated cluster data with review-level progress metadata so
    the frontend can render a progress bar without a separate request.
    """

    clusters = DuplicateClusterSerializer(many=True)
    total = serializers.IntegerField(help_text="Total clusters for this review.")
    resolved = serializers.IntegerField(
        help_text="Clusters that have been resolved or dismissed."
    )
    remaining = serializers.IntegerField(
        help_text="Unresolved clusters still requiring attention."
    )
    progress = serializers.FloatField(
        help_text="resolved / total * 100, rounded to one decimal place."
    )
