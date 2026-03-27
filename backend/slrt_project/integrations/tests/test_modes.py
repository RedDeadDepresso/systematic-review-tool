"""
Tests for slrt_project/zotero_integration/models.py.

Strategy
No-DB (plain pytest class, no marker)
Choice enumerations, Meta options, field defaults, and property logic
that can be tested without ORM involvement.  The ``api_key`` property
and ``is_configured`` / ``get_credentials`` helpers are tested here using
unsaved instances constructed with ``_make()``.

Run with:
pytest slrt_project/zotero_integration/tests/test_models.py -v
"""

import pytest
from django.db.models.base import ModelState

from slrt_project.integrations.models import ZoteroIntegration, ZoteroSyncLog
from slrt_project.integrations.tests.factories import (
    ZoteroIntegrationFactory,
    ZoteroSyncLogFactory,
)
from slrt_project.reviews.tests.factories import ReviewFactory


# A valid 32-byte Fernet key encoded in URL-safe base64 — safe to embed in
# tests because it is only used in the test database.
_TEST_FERNET_KEY = "x3DSg3ELh7BaVMpvRBq8Lb3-0EDIFvKl4mL6YRN3JlI="


# Helper — build unsaved instances without touching the DB


def _make(model_cls, **kwargs):
    """
    Construct an unsaved model instance without any DB access.
    """
    instance = model_cls.__new__(model_cls)
    instance._state = ModelState()
    instance._state.fields_cache = {}
    instance.__dict__["id"] = None
    instance.__dict__.update(kwargs)
    return instance


# ZoteroIntegration.LibraryType choices


class TestLibraryTypeChoices:
    def test_user_and_group_exist(self):
        values = {c[0] for c in ZoteroIntegration.LibraryType.choices}
        assert values == {"user", "group"}

    def test_display_labels(self):
        labels = {c[1] for c in ZoteroIntegration.LibraryType.choices}
        assert "Personal Library" in labels
        assert "Group Library" in labels

    def test_default_is_user(self):
        field = ZoteroIntegration._meta.get_field("library_type")
        assert field.default == ZoteroIntegration.LibraryType.USER


# ZoteroIntegration — field meta


class TestZoteroIntegrationFields:
    def test_library_id_max_length(self):
        assert ZoteroIntegration._meta.get_field("library_id").max_length == 100

    def test_api_key_db_column(self):
        # The encrypted field must use the 'api_key' column name.
        field = ZoteroIntegration._meta.get_field("_api_key")
        assert field.column == "api_key"

    def test_api_key_max_length_accommodates_fernet(self):
        # Fernet tokens are longer than raw keys; 500 chars is sufficient.
        assert ZoteroIntegration._meta.get_field("_api_key").max_length == 500

    def test_collection_key_nullable(self):
        field = ZoteroIntegration._meta.get_field("collection_key")
        assert field.null is True
        assert field.blank is True

    def test_collection_name_nullable(self):
        field = ZoteroIntegration._meta.get_field("collection_name")
        assert field.null is True
        assert field.blank is True

    def test_last_sync_version_default_zero(self):
        assert ZoteroIntegration._meta.get_field("last_sync_version").default == 0

    def test_is_active_default_true(self):
        assert ZoteroIntegration._meta.get_field("is_active").default is True

    def test_review_is_one_to_one(self):
        from django.db.models import OneToOneField

        assert isinstance(ZoteroIntegration._meta.get_field("review"), OneToOneField)

    def test_review_cascade(self):
        field = ZoteroIntegration._meta.get_field("review")
        assert field.remote_field.on_delete.__name__ == "CASCADE"


# ZoteroIntegration.api_key property — no encryption


class TestApiKeyPropertyPlaintext:
    @pytest.fixture(autouse=True)
    def _no_encryption_key(self, settings):
        settings.ENCRYPTION_KEY = None

    """Plaintext path — ENCRYPTION_KEY is None."""

    def test_getter_returns_stored_value(self):
        instance = _make(ZoteroIntegration, _api_key="my-secret-key")
        assert instance.api_key == "my-secret-key"

    def test_getter_returns_none_when_empty(self):
        instance = _make(ZoteroIntegration, _api_key="")
        assert instance.api_key is None

    def test_setter_stores_plaintext(self):
        instance = _make(ZoteroIntegration, _api_key="")
        instance.api_key = "new-key"
        assert instance._api_key == "new-key"

    def test_setter_none_clears_key(self):
        instance = _make(ZoteroIntegration, _api_key="existing")
        instance.api_key = None
        assert instance._api_key is None


# ZoteroIntegration.api_key property — with encryption


class TestApiKeyPropertyEncrypted:
    @pytest.fixture(autouse=True)
    def _set_encryption_key(self, settings):
        settings.ENCRYPTION_KEY = _TEST_FERNET_KEY

    """Encryption path — ENCRYPTION_KEY is a valid Fernet key."""

    def test_setter_does_not_store_plaintext(self):
        instance = _make(ZoteroIntegration, _api_key="")
        instance.api_key = "secret"
        # The stored value must differ from the raw input.
        assert instance._api_key != "secret"

    def test_round_trip(self):
        instance = _make(ZoteroIntegration, _api_key="")
        instance.api_key = "my-zotero-api-key"
        assert instance.api_key == "my-zotero-api-key"

    def test_round_trip_with_special_characters(self):
        instance = _make(ZoteroIntegration, _api_key="")
        instance.api_key = "key-with-special-!@#$%^&*()"
        assert instance.api_key == "key-with-special-!@#$%^&*()"

    def test_setter_none_clears_key(self):
        instance = _make(ZoteroIntegration, _api_key="something")
        instance.api_key = None
        assert instance._api_key is None

    def test_getter_falls_back_on_plaintext_stored_value(self):
        # Simulate a key that was stored as plaintext before encryption was
        # enabled — decryption will fail but the raw value must be returned.
        instance = _make(ZoteroIntegration, _api_key="legacy-plaintext-key")
        assert instance.api_key == "legacy-plaintext-key"


# ZoteroIntegration.is_configured


class TestIsConfigured:
    @pytest.fixture(autouse=True)
    def _no_encryption_key(self, settings):
        settings.ENCRYPTION_KEY = None

    def test_true_when_all_fields_set(self):
        instance = _make(
            ZoteroIntegration,
            library_id="123456",
            _api_key="some-key",
            is_active=True,
        )
        assert instance.is_configured is True

    def test_false_when_library_id_missing(self):
        instance = _make(
            ZoteroIntegration, library_id="", _api_key="key", is_active=True
        )
        assert instance.is_configured is False

    def test_false_when_api_key_missing(self):
        instance = _make(
            ZoteroIntegration, library_id="123", _api_key="", is_active=True
        )
        assert instance.is_configured is False

    def test_false_when_inactive(self):
        instance = _make(
            ZoteroIntegration, library_id="123", _api_key="key", is_active=False
        )
        assert instance.is_configured is False


# ZoteroIntegration.get_credentials


class TestGetCredentials:
    @pytest.fixture(autouse=True)
    def _no_encryption_key(self, settings):
        settings.ENCRYPTION_KEY = None

    def test_returns_tuple_when_configured(self):
        instance = _make(
            ZoteroIntegration,
            library_id="123456",
            _api_key="api-key",
            library_type="user",
            is_active=True,
        )
        lib_id, api_key, lib_type = instance.get_credentials()
        assert lib_id == "123456"
        assert api_key == "api-key"
        assert lib_type == "user"

    def test_returns_none_tuple_when_not_configured(self):
        instance = _make(
            ZoteroIntegration, library_id="", _api_key="key", is_active=True
        )
        assert instance.get_credentials() == (None, None, None)

    def test_returns_none_tuple_when_inactive(self):
        instance = _make(
            ZoteroIntegration, library_id="123", _api_key="key", is_active=False
        )
        assert instance.get_credentials() == (None, None, None)


# ZoteroIntegration — DB tests


@pytest.mark.django_db
class TestZoteroIntegrationDB:
    def test_factory_creates_row(self):
        integration = ZoteroIntegrationFactory()
        assert ZoteroIntegration.objects.filter(pk=integration.pk).exists()

    def test_one_to_one_constraint(self):
        from django.db import IntegrityError

        integration = ZoteroIntegrationFactory()
        with pytest.raises(IntegrityError):
            ZoteroIntegration.objects.create(
                review=integration.review,
                library_id="999",
                _api_key="key",
            )

    def test_str(self):
        integration = ZoteroIntegrationFactory()
        assert str(integration) == f"Zotero Integration for {integration.review.title}"

    def test_cascade_delete_with_review(self):
        integration = ZoteroIntegrationFactory()
        pk = integration.pk
        integration.review.delete()
        assert not ZoteroIntegration.objects.filter(pk=pk).exists()

    def test_inactive_trait(self):
        integration = ZoteroIntegrationFactory(inactive=True)
        assert integration.is_active is False
        assert integration.is_configured is False

    def test_with_collection_trait(self):
        integration = ZoteroIntegrationFactory(with_collection=True)
        assert integration.collection_key is not None
        assert integration.collection_name is not None

    def test_group_trait(self):
        integration = ZoteroIntegrationFactory(group=True)
        assert integration.library_type == ZoteroIntegration.LibraryType.GROUP

    def test_encrypted_trait_round_trips(self, settings):
        settings.ENCRYPTION_KEY = _TEST_FERNET_KEY
        integration = ZoteroIntegrationFactory(encrypted=True)
        # The stored column must not be plaintext.
        raw = ZoteroIntegration.objects.values_list("_api_key", flat=True).get(
            pk=integration.pk
        )
        assert not raw.startswith("raw-api-key")
        # But the property must return the decrypted value.
        assert integration.api_key.startswith("raw-api-key")


# ZoteroSyncLog.SyncType choices


class TestSyncTypeChoices:
    def test_push_and_pull_exist(self):
        values = {c[0] for c in ZoteroSyncLog.SyncType.choices}
        assert values == {"push", "pull"}

    def test_display_labels(self):
        labels = {c[1] for c in ZoteroSyncLog.SyncType.choices}
        assert "Push to Zotero" in labels
        assert "Pull from Zotero" in labels


# ZoteroSyncLog — field meta


class TestZoteroSyncLogFields:
    def test_ordering_newest_first(self):
        assert ZoteroSyncLog._meta.ordering == ["-synced_at"]

    def test_items_processed_default_zero(self):
        assert ZoteroSyncLog._meta.get_field("items_processed").default == 0

    def test_items_with_pdfs_default_zero(self):
        assert ZoteroSyncLog._meta.get_field("items_with_pdfs").default == 0

    def test_success_default_true(self):
        assert ZoteroSyncLog._meta.get_field("success").default is True

    def test_error_message_blank(self):
        field = ZoteroSyncLog._meta.get_field("error_message")
        assert field.blank is True

    def test_library_version_nullable(self):
        field = ZoteroSyncLog._meta.get_field("library_version")
        assert field.null is True
        assert field.blank is True

    def test_review_cascade(self):
        field = ZoteroSyncLog._meta.get_field("review")
        assert field.remote_field.on_delete.__name__ == "CASCADE"

    def test_related_name(self):
        field = ZoteroSyncLog._meta.get_field("review")
        assert field.remote_field.related_name == "zotero_sync_logs"


# ZoteroSyncLog.__str__


@pytest.mark.django_db
class TestZoteroSyncLogStr:
    def test_contains_review_title_and_sync_type(self):
        log = ZoteroSyncLogFactory()
        result = str(log)
        assert log.review.title in result
        assert log.sync_type in result


# ZoteroSyncLog — DB tests


@pytest.mark.django_db
class TestZoteroSyncLogDB:
    def test_factory_creates_row(self):
        log = ZoteroSyncLogFactory()
        assert ZoteroSyncLog.objects.filter(pk=log.pk).exists()

    def test_default_is_push(self):
        log = ZoteroSyncLogFactory()
        assert log.sync_type == ZoteroSyncLog.SyncType.PUSH

    def test_pull_trait(self):
        log = ZoteroSyncLogFactory(pull=True)
        assert log.sync_type == ZoteroSyncLog.SyncType.PULL

    def test_failed_trait(self):
        log = ZoteroSyncLogFactory(failed=True)
        assert log.success is False
        assert log.error_message != ""

    def test_ordering_newest_first(self):
        review = ReviewFactory()
        ZoteroSyncLogFactory(review=review)
        log2 = ZoteroSyncLogFactory(review=review)
        logs = list(ZoteroSyncLog.objects.filter(review=review))
        # Newest (higher PK / later created_at) must be first.
        assert logs[0].pk == log2.pk

    def test_cascade_delete_with_review(self):
        log = ZoteroSyncLogFactory()
        pk = log.pk
        log.review.delete()
        assert not ZoteroSyncLog.objects.filter(pk=pk).exists()

    def test_multiple_logs_per_review(self):
        review = ReviewFactory()
        ZoteroSyncLogFactory(review=review, sync_type=ZoteroSyncLog.SyncType.PUSH)
        ZoteroSyncLogFactory(review=review, sync_type=ZoteroSyncLog.SyncType.PULL)
        assert ZoteroSyncLog.objects.filter(review=review).count() == 2

    def test_items_processed_stored(self):
        log = ZoteroSyncLogFactory(items_processed=42, items_with_pdfs=7)
        log.refresh_from_db()
        assert log.items_processed == 42
        assert log.items_with_pdfs == 7

    def test_library_version_stored(self):
        log = ZoteroSyncLogFactory(library_version=9999)
        log.refresh_from_db()
        assert log.library_version == 9999
