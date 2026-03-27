from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


# ZoteroIntegration
class ZoteroIntegration(models.Model):
    """
    Stores Zotero library credentials and sync state for a single review.
    """

    class LibraryType(models.TextChoices):
        USER = "user", "Personal Library"
        GROUP = "group", "Group Library"

    # One integration per review — deleting the review removes the integration.
    review = models.OneToOneField(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="zotero_integration",
    )

    # ── Credentials ───────────────────────────────────────────────────────

    # Zotero User ID (for personal libraries) or Group ID (for group libraries).
    library_id = models.CharField(
        max_length=100,
        help_text="Zotero User ID or Group ID.",
    )

    # Encrypted API key stored in the ``api_key`` database column.  Always
    # access via the ``api_key`` property, never read ``_api_key`` directly.
    _api_key = models.CharField(
        max_length=500,
        db_column="api_key",
        help_text="Fernet-encrypted Zotero API key.",
    )

    # Whether this is a personal or group Zotero library.
    library_type = models.CharField(
        max_length=10,
        choices=LibraryType.choices,
        default=LibraryType.USER,
    )

    # ── Collection filter (optional) ──────────────────────────────────────

    # When set, only items in this Zotero collection are synced.
    collection_key = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Zotero collection key. When set, only items in this collection are synced.",
    )

    # Human-readable name for the collection — stored so the UI can display
    # it without making an extra API call.
    collection_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Display name of the selected collection (cached for UI display).",
    )

    # ── Sync metadata ─────────────────────────────────────────────────────

    # Timestamp of the last successful push to Zotero.
    last_push_at = models.DateTimeField(null=True, blank=True)

    # Timestamp of the last successful pull from Zotero.
    last_pull_at = models.DateTimeField(null=True, blank=True)

    # The Zotero library version number at the time of the last successful
    # sync, used to request only items modified since then on the next pull.
    last_sync_version = models.IntegerField(
        default=0,
        help_text="Zotero library version number at the time of the last successful sync.",
    )

    # ── Status ────────────────────────────────────────────────────────────

    # When False the sync tasks will skip this integration without error.
    is_active = models.BooleanField(
        default=True,
        help_text="When False, all sync operations for this review are disabled.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Zotero Integration"
        verbose_name_plural = "Zotero Integrations"

    def __str__(self) -> str:
        return f"Zotero Integration for {self.review.title}"

    # ── api_key property ──────────────────────────────────────────────────

    @property
    def api_key(self) -> str | None:
        """
        Decrypt and return the stored API key.
        """
        if not self._api_key:
            return None

        if settings.ENCRYPTION_KEY:
            try:
                cipher = Fernet(settings.ENCRYPTION_KEY.encode())
                return cipher.decrypt(self._api_key.encode()).decode()
            except (InvalidToken, Exception):
                # Decryption failed — key may have been stored in plaintext
                # before encryption was enabled.  Return raw value so existing
                # records remain usable after encryption is turned on.
                return self._api_key

        return self._api_key

    @api_key.setter
    def api_key(self, value: str | None) -> None:
        """
        Encrypt and store the API key.
        """
        if value is None:
            self._api_key = None
            return

        if settings.ENCRYPTION_KEY:
            cipher = Fernet(settings.ENCRYPTION_KEY.encode())
            self._api_key = cipher.encrypt(value.encode()).decode()
        else:
            self._api_key = value

    # ── Convenience helpers ───────────────────────────────────────────────

    @property
    def is_configured(self) -> bool:
        """
        Return True when the integration has all required credentials and is active.
        """
        return bool(self.library_id and self._api_key and self.is_active)

    def get_credentials(self) -> tuple[str, str, str] | tuple[None, None, None]:
        """
        Return ``(library_id, api_key, library_type)`` when configured.
        """
        if self.is_configured:
            return (self.library_id, self.api_key, self.library_type)
        return (None, None, None)


# ZoteroSyncLog
class ZoteroSyncLog(models.Model):
    """
    Append-only record of a single Zotero push or pull operation.
    """

    class SyncType(models.TextChoices):
        PUSH = "push", "Push to Zotero"
        PULL = "pull", "Pull from Zotero"

    # Deleting the review cascades and removes all sync history for it.
    review = models.ForeignKey(
        "reviews.Review",
        on_delete=models.CASCADE,
        related_name="zotero_sync_logs",
    )

    # Whether this entry records a push (SLRT → Zotero) or pull (Zotero → SLRT).
    sync_type = models.CharField(
        max_length=20,
        choices=SyncType.choices,
    )

    # Total number of references processed during the operation.
    items_processed = models.IntegerField(default=0)

    # Subset of items_processed that had an associated PDF attachment.
    items_with_pdfs = models.IntegerField(default=0)

    # False when the operation raised an exception; True on clean completion.
    success = models.BooleanField(default=True)

    # Human-readable error description.  Empty string on success.
    error_message = models.TextField(blank=True)

    # The Zotero library version reported by the API at the time of the sync.
    # Stored here so the sync history can show which version each run saw.
    library_version = models.IntegerField(
        null=True,
        blank=True,
        help_text="Zotero library version at the time of this sync.",
    )

    # Set automatically when the row is created — not editable.
    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-synced_at"]
        verbose_name = "Zotero Sync Log"
        verbose_name_plural = "Zotero Sync Logs"

    def __str__(self) -> str:
        return f"{self.review.title} — {self.sync_type} — {self.synced_at}"
