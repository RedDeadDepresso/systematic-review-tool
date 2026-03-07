"""
Factory classes for the zotero_integration app.

Uses factory_boy with DjangoModelFactory.  Every factory writes a real DB row,
making it straightforward to compose realistic object graphs in tests.

Usage examples
--------------
    # Minimal integration (review created automatically):
    integration = ZoteroIntegrationFactory()

    # Integration with encryption enabled:
    integration = ZoteroIntegrationFactory(encrypted=True)

    # Integration scoped to a specific review:
    review = ReviewFactory()
    integration = ZoteroIntegrationFactory(review=review)

    # Inactive integration (sync disabled):
    integration = ZoteroIntegrationFactory(inactive=True)

    # Integration with a collection filter set:
    integration = ZoteroIntegrationFactory(with_collection=True)

    # Group library integration:
    integration = ZoteroIntegrationFactory(
        library_type=ZoteroIntegration.LibraryType.GROUP
    )

    # Successful push log entry:
    log = ZoteroSyncLogFactory()

    # Failed pull log entry:
    log = ZoteroSyncLogFactory(failed=True, pull=True)

    # Log with a specific item count:
    log = ZoteroSyncLogFactory(items_processed=50, items_with_pdfs=12)
"""

import factory
from factory import Sequence, SubFactory, Trait
from factory.django import DjangoModelFactory

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.reviews.tests.factories import ReviewFactory


# ---------------------------------------------------------------------------
# ZoteroIntegrationFactory
# ---------------------------------------------------------------------------


class ZoteroIntegrationFactory(DjangoModelFactory):
    """
    Creates a ZoteroIntegration with a plaintext API key by default.

    The factory stores the key in plaintext (no encryption) to keep tests
    simple and fast.  Use the ``encrypted`` trait when you need to test the
    encrypt/decrypt path explicitly.

    Traits
    ------
    encrypted      — stores the API key via the encrypting property setter,
                     requiring settings.ENCRYPTION_KEY to be set in the test.
    inactive       — sets is_active=False (sync is disabled).
    with_collection — populates collection_key and collection_name.
    group          — sets library_type to GROUP.
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

        Runs after the row has been inserted so there is no null-constraint
        issue.  Only acts when the ``encrypted`` trait was used (detected by
        the sentinel value) and the ``create`` strategy is in effect.
        """
        if create and obj._api_key == "__encrypt__":
            obj.api_key = f"raw-api-key-{obj.library_id}"
            obj.save(update_fields=["_api_key"])


# ---------------------------------------------------------------------------
# ZoteroSyncLogFactory
# ---------------------------------------------------------------------------


class ZoteroSyncLogFactory(DjangoModelFactory):
    """
    Creates a ZoteroSyncLog representing a successful push operation by default.

    Traits
    ------
    pull    — records a pull (Zotero → SLRT) rather than a push.
    failed  — records a failed operation with a generic error message.
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
