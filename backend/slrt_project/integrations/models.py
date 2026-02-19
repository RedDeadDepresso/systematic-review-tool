from cryptography.fernet import Fernet
from django.conf import settings
from django.db import models


# Create your models here.
class ZoteroIntegration(models.Model):
    """Zotero integration settings for a review"""

    review = models.OneToOneField(
        "reviews.Review", on_delete=models.CASCADE, related_name="zotero_integration"
    )

    # Library credentials
    library_id = models.CharField(
        max_length=100, help_text="Zotero User ID or Group ID"
    )
    _api_key = models.CharField(
        max_length=500, db_column="api_key", help_text="Encrypted Zotero API key"
    )
    library_type = models.CharField(
        max_length=10,
        choices=[("user", "Personal Library"), ("group", "Group Library")],
        default="user",
    )

    # Collection filter (optional)
    collection_key = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        help_text="Optional: Only sync items from this collection",
    )
    collection_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Display name of the selected collection",
    )

    # Sync metadata
    last_push_at = models.DateTimeField(null=True, blank=True)
    last_pull_at = models.DateTimeField(null=True, blank=True)
    last_sync_version = models.IntegerField(
        default=0, help_text="Last library version synced"
    )

    # Status
    is_active = models.BooleanField(
        default=True, help_text="Enable/disable Zotero sync for this review"
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Zotero Integration"
        verbose_name_plural = "Zotero Integrations"

    def __str__(self):
        return f"Zotero Integration for {self.review.title}"

    @property
    def api_key(self):
        """Decrypt and return API key"""
        if not self._api_key:
            return None

        # If encryption is enabled
        if settings.ENCRYPTION_KEY:
            try:
                cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
                return cipher_suite.decrypt(self._api_key.encode()).decode()
            except Exception:
                # If decryption fails, return as-is (backwards compatibility)
                return self._api_key

        return self._api_key

    @api_key.setter
    def api_key(self, value):
        """Encrypt and store API key"""
        if value is None:
            self._api_key = None
            return

        # If encryption is enabled
        if settings.ENCRYPTION_KEY:
            cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
            self._api_key = cipher_suite.encrypt(value.encode()).decode()
        else:
            self._api_key = value

    @property
    def is_configured(self):
        """Check if Zotero is properly configured"""
        return bool(self.library_id and self._api_key and self.is_active)

    def get_credentials(self):
        """Get Zotero credentials tuple"""
        if self.is_configured:
            return (self.library_id, self.api_key, self.library_type)
        return (None, None, None)


class ZoteroSyncLog(models.Model):
    """Track Zotero sync operations"""

    review = models.ForeignKey("reviews.Review", on_delete=models.CASCADE)

    sync_type = models.CharField(
        max_length=20,
        choices=[
            ("push", "Push to Zotero"),
            ("pull", "Pull from Zotero"),
        ],
    )

    items_processed = models.IntegerField(default=0)
    items_with_pdfs = models.IntegerField(default=0)

    success = models.BooleanField(default=True)
    error_message = models.TextField(blank=True)

    library_version = models.IntegerField(
        null=True, blank=True, help_text="Zotero library version at time of sync"
    )

    synced_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-synced_at"]
        verbose_name = "Zotero Sync Log"
        verbose_name_plural = "Zotero Sync Logs"

    def __str__(self):
        return f"{self.review.title} - {self.sync_type} - {self.synced_at}"
