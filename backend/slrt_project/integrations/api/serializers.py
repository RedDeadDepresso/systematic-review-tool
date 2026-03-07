"""
Serializers for the zotero_integration app.

Organisation
------------
Model serializers
  ZoteroIntegrationSerializer — safe read/write serializer; never exposes
                                the raw API key column.
  ZoteroSyncLogSerializer     — read-only log entry.

Input serializers
  ZoteroConfigSerializer      — validates credentials on create.
  ZoteroUpdateSerializer      — validates fields on update, including the
                                ``sync_action`` guard for library changes.
  ZoteroSetCollectionSerializer — validates collection change + sync_action.
  ZoteroDestroySerializer     — validates the ``action`` query param on delete.
  ZoteroPushSerializer        — validates the large-batch confirmation flag.
  ZoteroPullSerializer        — validates the ``force`` flag on pull.

Response serializers  (one per custom action — used for schema + documentation)
  ZoteroStatusResponseSerializer      — status action 200 payload.
  ZoteroCollectionItemSerializer      — one item in the collections list.
  ZoteroCollectionsResponseSerializer — collections action 200 payload.
  ZoteroSetCollectionResponseSerializer — set_collection 200 payload.
  ZoteroDeletionPreviewActionSerializer — one action entry in deletion_preview.
  ZoteroDeletionPreviewResponseSerializer — deletion_preview 200 payload.
  ZoteroDestroyResponseSerializer     — destroy 200 payload.
  ZoteroUpdateResponseSerializer      — update 200 payload.
  ZoteroTaskResponseSerializer        — push/pull 202 payload.
  ZoteroTaskStatusResponseSerializer  — task_status 200 payload.
  ZoteroToggleActiveResponseSerializer — toggle_active 200 payload.
  ZoteroCreateCollectionResponseSerializer — create_collection 200 payload.
"""

from rest_framework import serializers

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog


# ===========================================================================
# Model serializers
# ===========================================================================


class ZoteroIntegrationSerializer(serializers.ModelSerializer):
    """
    Safe read/write serializer for ZoteroIntegration.

    The raw ``_api_key`` column is excluded so the encrypted bytes are never
    sent to clients.  ``is_configured`` is a model property exposed as a
    read-only boolean field for convenience.

    Sync timestamps and version are all server-managed and therefore
    read-only.
    """

    # Exposes the model property so clients can check readiness without
    # reading individual credential fields.
    is_configured = serializers.BooleanField(
        read_only=True,
        help_text="True when library_id, api_key, and is_active are all set.",
    )

    class Meta:
        model = ZoteroIntegration
        # Exclude the raw encrypted column — use the api_key property instead.
        exclude = ["_api_key"]
        read_only_fields = [
            "last_push_at",
            "last_pull_at",
            "last_sync_version",
            "created_at",
            "updated_at",
        ]


class ZoteroSyncLogSerializer(serializers.ModelSerializer):
    """
    Read-only serializer for ZoteroSyncLog entries.

    Used inside ZoteroStatusResponseSerializer and as the response type for
    the sync log list endpoint.
    """

    class Meta:
        model = ZoteroSyncLog
        fields = "__all__"


# ===========================================================================
# Input serializers
# ===========================================================================


class ZoteroConfigSerializer(serializers.Serializer):
    """
    Input serializer for creating a new ZoteroIntegration.

    All credential fields are write-only so they are never reflected back
    in API responses.  ``library_id`` must be numeric (Zotero user/group IDs
    are always integers); ``api_key`` must be at least 20 characters (all
    real Zotero API keys exceed this length).
    """

    # Review PK — used to scope the integration.
    review = serializers.IntegerField(
        required=True,
        write_only=True,
        help_text="PK of the Review this integration belongs to.",
    )

    # Zotero User ID or Group ID — always numeric.
    library_id = serializers.CharField(
        required=True,
        write_only=True,
        help_text="Zotero User ID or Group ID (numeric string).",
    )

    # Raw API key — encrypted before storage; never read back.
    api_key = serializers.CharField(
        required=True,
        write_only=True,
        help_text="Zotero API key. Must be at least 20 characters.",
    )

    library_type = serializers.ChoiceField(
        choices=ZoteroIntegration.LibraryType.choices,
        default=ZoteroIntegration.LibraryType.USER,
        required=False,
        help_text="'user' for personal libraries, 'group' for group libraries.",
    )

    collection_key = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Optional Zotero collection key to restrict sync scope.",
    )

    collection_name = serializers.CharField(
        required=False,
        allow_blank=True,
        allow_null=True,
        help_text="Display name of the collection (cached for UI display).",
    )

    def validate_library_id(self, value: str) -> str:
        """Reject non-numeric library IDs early with a clear message."""
        if not value.isdigit():
            raise serializers.ValidationError(
                "Library ID must be numeric (your Zotero user or group ID)."
            )
        return value

    def validate_api_key(self, value: str) -> str:
        """Reject obviously short strings that cannot be valid Zotero keys."""
        if len(value) < 20:
            raise serializers.ValidationError(
                "API key appears too short — Zotero API keys are at least 20 characters."
            )
        return value


class ZoteroUpdateSerializer(serializers.Serializer):
    """
    Input serializer for partial updates to an existing ZoteroIntegration.

    When ``library_id`` or ``library_type`` changes, ``sync_action`` is
    required to be one of the three documented values so the caller
    explicitly acknowledges how existing synced data should be handled.
    """

    library_id = serializers.CharField(
        required=False,
        help_text="New Zotero User ID or Group ID.",
    )
    api_key = serializers.CharField(
        required=False,
        help_text="New Zotero API key.",
    )
    library_type = serializers.ChoiceField(
        choices=ZoteroIntegration.LibraryType.choices,
        required=False,
        help_text="New library type.",
    )
    sync_action = serializers.ChoiceField(
        choices=["reset", "unlink", "keep"],
        default="keep",
        required=False,
        help_text=(
            "How to handle existing synced references when the library changes. "
            "'reset' clears Zotero keys and PDFs; "
            "'unlink' clears only keys; "
            "'keep' leaves everything unchanged."
        ),
    )


class ZoteroSetCollectionSerializer(serializers.Serializer):
    """
    Input serializer for the set_collection action.

    ``sync_action`` governs what happens to currently synced references
    when the collection filter changes.
    """

    collection_key = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="New collection key, or null/blank to sync the entire library.",
    )
    collection_name = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Display name of the new collection.",
    )
    sync_action = serializers.ChoiceField(
        choices=["reset", "unlink", "keep"],
        default="keep",
        required=False,
        help_text=(
            "How to handle existing synced references when the collection changes. "
            "'reset' clears Zotero keys and PDFs; "
            "'unlink' clears only keys; "
            "'keep' leaves everything unchanged."
        ),
    )


class ZoteroCreateCollectionSerializer(serializers.Serializer):
    """Input serializer for the create_collection action."""

    name = serializers.CharField(
        help_text="Name of the new Zotero collection.",
    )
    parent_collection = serializers.CharField(
        required=False,
        allow_null=True,
        allow_blank=True,
        help_text="Optional parent collection key for nesting.",
    )
    set_as_default = serializers.BooleanField(
        default=False,
        required=False,
        help_text="When True, sets this new collection as the active sync collection.",
    )


class ZoteroPushSerializer(serializers.Serializer):
    """
    Input serializer for the push action.

    ``confirm`` is required when the unpushed count exceeds 500 to prevent
    accidental large pushes.
    """

    confirm = serializers.BooleanField(
        default=False,
        required=False,
        help_text=(
            "Must be True when pushing more than 500 references. "
            "Prevents accidental large-batch operations."
        ),
    )


class ZoteroPullSerializer(serializers.Serializer):
    """Input serializer for the pull action."""

    force = serializers.BooleanField(
        default=False,
        required=False,
        help_text=(
            "When True, ignores last_sync_version and re-fetches all items "
            "from Zotero regardless of whether they have changed."
        ),
    )


# ===========================================================================
# Response serializers
# ===========================================================================


class ZoteroStatusResponseSerializer(serializers.Serializer):
    """200 payload returned by the status action."""

    is_configured = serializers.BooleanField(
        help_text="True when the integration has valid credentials and is_active=True.",
    )
    library_type = serializers.CharField(
        help_text="'user' or 'group'.",
    )
    collection_key = serializers.CharField(
        allow_null=True,
        help_text="Active collection filter key, or null for whole-library sync.",
    )
    collection_name = serializers.CharField(
        allow_null=True,
        help_text="Display name of the active collection, or null.",
    )
    last_push = serializers.DateTimeField(
        allow_null=True,
        help_text="Timestamp of the last successful push to Zotero.",
    )
    last_pull = serializers.DateTimeField(
        allow_null=True,
        help_text="Timestamp of the last successful pull from Zotero.",
    )
    last_sync_version = serializers.IntegerField(
        help_text="Zotero library version at the time of the last successful sync.",
    )
    total_references = serializers.IntegerField(
        help_text="Total references in this review.",
    )
    synced_references = serializers.IntegerField(
        help_text="References with a Zotero key (i.e. pushed or pulled at least once).",
    )
    references_with_pdfs = serializers.IntegerField(
        help_text="References that have an uploaded PDF file.",
    )
    recent_syncs = ZoteroSyncLogSerializer(
        many=True,
        help_text="The 10 most recent sync log entries, newest first.",
    )


class ZoteroCollectionItemSerializer(serializers.Serializer):
    """One Zotero collection entry returned by the collections action."""

    key = serializers.CharField(help_text="Zotero collection key.")
    version = serializers.IntegerField(
        help_text="Zotero library version for this collection."
    )
    name = serializers.CharField(help_text="Human-readable collection name.")
    parent_collection = serializers.CharField(
        allow_null=True,
        help_text="Parent collection key, or null for top-level collections.",
    )


class ZoteroCollectionsResponseSerializer(serializers.Serializer):
    """200 payload returned by the collections action."""

    collections = ZoteroCollectionItemSerializer(
        many=True,
        help_text="All collections in the Zotero library.",
    )


class ZoteroSetCollectionResponseSerializer(serializers.Serializer):
    """200 payload returned by the set_collection action."""

    message = serializers.CharField(help_text="Human-readable confirmation message.")
    collection_key = serializers.CharField(
        allow_null=True,
        help_text="The new active collection key, or null.",
    )
    collection_name = serializers.CharField(
        allow_null=True,
        help_text="Display name of the new active collection, or null.",
    )
    sync_version_reset = serializers.BooleanField(
        help_text="True when last_sync_version was reset to 0 due to a collection change.",
    )
    sync_action_performed = serializers.CharField(
        allow_null=True,
        help_text="The sync_action that was applied, or null if the collection did not change.",
    )


class ZoteroDeletionPreviewActionSerializer(serializers.Serializer):
    """Details for a single action option in the deletion_preview response."""

    description = serializers.CharField(
        help_text="Human-readable description of this action."
    )
    affected_references = serializers.IntegerField(
        help_text="Number of references that will be modified.",
    )
    pdfs_lost = serializers.IntegerField(
        help_text="Number of PDF files that will be deleted.",
    )


class ZoteroDeletionPreviewCollectionSerializer(serializers.Serializer):
    """Collection info nested in deletion_preview (present only when a filter is set)."""

    key = serializers.CharField(help_text="Zotero collection key.")
    name = serializers.CharField(help_text="Collection display name.")


class ZoteroDeletionPreviewResponseSerializer(serializers.Serializer):
    """200 payload returned by the deletion_preview action."""

    integration_id = serializers.IntegerField(help_text="PK of this integration.")
    review_id = serializers.IntegerField(help_text="PK of the associated review.")
    synced_references = serializers.IntegerField(
        help_text="Total references with a Zotero key.",
    )
    references_with_pdfs = serializers.IntegerField(
        help_text="Synced references that also have a PDF.",
    )
    collection = ZoteroDeletionPreviewCollectionSerializer(
        allow_null=True,
        help_text="Active collection filter, or null.",
    )
    actions = serializers.DictField(
        child=ZoteroDeletionPreviewActionSerializer(),
        help_text="Impact summary for each available deletion action (keep/unlink/reset).",
    )


class ZoteroDestroyResponseSerializer(serializers.Serializer):
    """200 payload returned on successful destroy."""

    message = serializers.CharField(help_text="Human-readable confirmation.")
    action_performed = serializers.CharField(help_text="The action that was applied.")
    references_affected = serializers.IntegerField(
        help_text="Number of references that were modified.",
    )
    details = serializers.CharField(
        allow_null=True,
        help_text="Human-readable description of what was done to the affected references.",
    )


class ZoteroUpdateResponseSerializer(serializers.Serializer):
    """200 payload returned on successful update."""

    message = serializers.CharField(help_text="Human-readable confirmation.")
    library_changed = serializers.BooleanField(
        help_text="True when library_id or library_type was changed.",
    )
    sync_action_performed = serializers.CharField(
        allow_null=True,
        help_text="The sync_action that was applied, or null if the library did not change.",
    )
    data = ZoteroIntegrationSerializer(
        help_text="Full updated integration representation.",
    )


class ZoteroTaskResponseSerializer(serializers.Serializer):
    """202 payload returned when a push or pull task is enqueued."""

    message = serializers.CharField(help_text="Human-readable status message.")
    task_id = serializers.CharField(help_text="Celery task ID for polling task_status.")
    status = serializers.CharField(help_text="Always 'processing' when first enqueued.")
    total_unpushed = serializers.IntegerField(
        required=False,
        help_text="Number of references queued for push (push action only).",
    )
    estimated_batches = serializers.IntegerField(
        required=False,
        help_text="Estimated number of 50-item batches (push action only).",
    )
    estimated_time_minutes = serializers.IntegerField(
        required=False,
        help_text="Rough time estimate in minutes (push action only).",
    )


class ZoteroTaskStatusResponseSerializer(serializers.Serializer):
    """200 payload returned by the task_status action."""

    task_id = serializers.CharField(help_text="The Celery task ID that was queried.")
    status = serializers.CharField(
        help_text="Celery task state: PENDING, STARTED, SUCCESS, FAILURE, or RETRY.",
    )
    message = serializers.CharField(
        required=False,
        help_text="Human-readable description of the current state.",
    )
    result = serializers.JSONField(
        required=False,
        allow_null=True,
        help_text="Task return value, present only when status=SUCCESS.",
    )
    error = serializers.CharField(
        required=False,
        allow_null=True,
        help_text="Error description, present only when status=FAILURE.",
    )


class ZoteroToggleActiveResponseSerializer(serializers.Serializer):
    """200 payload returned by the toggle_active action."""

    message = serializers.CharField(help_text="'Zotero integration enabled/disabled'.")
    is_active = serializers.BooleanField(help_text="The new is_active state.")


class ZoteroCreateCollectionResponseSerializer(serializers.Serializer):
    """200 payload returned by create_collection on success."""

    message = serializers.CharField(help_text="'Collection created successfully'.")
    collection = ZoteroCollectionItemSerializer(
        help_text="The newly created collection.",
    )
    set_as_default = serializers.BooleanField(
        help_text="Whether this collection was set as the active sync collection.",
    )
    sync_version_reset = serializers.BooleanField(
        help_text="True when last_sync_version was reset because set_as_default=True.",
    )
