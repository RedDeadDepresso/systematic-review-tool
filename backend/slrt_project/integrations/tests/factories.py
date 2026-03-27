"""
Factory classes for the zotero_integration app.
"""

import factory
from factory import Sequence, SubFactory, Trait
from factory.django import DjangoModelFactory

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.reviews.tests.factories import ReviewFactory


# ZoteroIntegrationFactory


class ZoteroIntegrationFactory(DjangoModelFactory):
    """
    Creates a ZoteroIntegration with a plaintext API key by default.
    """

    class Meta:
        model = ZoteroIntegration
        # OneToOne — re-use existing integration if the same review is passed.
        django_get_or_create = ("review",)
        # We call save() explicitly in set_encrypted_key when needed, so the
        # automatic post-generation save is redundant and can be skipped.
        skip_postgeneration_save = True

    review = SubFactory(ReviewFactory)

    # A realistic-looking Zotero User ID (8-digit numeric string).
    library_id = Sequence(lambda n: f"{1000000 + n}")

    # Stored directly in _api_key to bypass the encrypting setter.  This keeps
    # the factory fast and avoids a dependency on ENCRYPTION_KEY in most tests.
    _api_key = Sequence(lambda n: f"plaintext-api-key-{n}")

    library_type = ZoteroIntegration.LibraryType.USER
    collection_key = None
    collection_name = None
    last_sync_version = 0
    is_active = True

    class Params:
        encrypted = Trait(
            # Store a recognisable sentinel so post_generation can detect the
            # trait without touching NULL.  The sentinel is a valid non-empty
            # string, so it satisfies the DB not-null constraint during INSERT.
            # post_generation immediately overwrites it with a proper Fernet
            # token via the api_key property setter.
            _api_key="__encrypt__",
        )
        inactive = Trait(is_active=False)
        with_collection = Trait(
            collection_key=Sequence(lambda n: f"COLL{n:04d}"),
            collection_name=Sequence(lambda n: f"Collection {n}"),
        )
        group = Trait(library_type=ZoteroIntegration.LibraryType.GROUP)

    @factory.post_generation
    def set_encrypted_key(obj, create, extracted, **kwargs):
        """
        Overwrite the sentinel with a real Fernet-encrypted key.
        """
        if create and obj._api_key == "__encrypt__":
            obj.api_key = f"raw-api-key-{obj.library_id}"
            obj.save(update_fields=["_api_key"])


# ZoteroSyncLogFactory


class ZoteroSyncLogFactory(DjangoModelFactory):
    """
    Creates a ZoteroSyncLog representing a successful push operation by default.
    """

    class Meta:
        model = ZoteroSyncLog

    review = SubFactory(ReviewFactory)
    sync_type = ZoteroSyncLog.SyncType.PUSH
    items_processed = 10
    items_with_pdfs = 3
    success = True
    error_message = ""
    library_version = Sequence(lambda n: 100 + n)

    class Params:
        pull = Trait(sync_type=ZoteroSyncLog.SyncType.PULL)
        failed = Trait(
            success=False,
            error_message="Sync failed: connection timeout",
        )
