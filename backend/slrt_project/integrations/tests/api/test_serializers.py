"""
Tests for slrt_project/integrations/api/serializers.py.

Strategy
--------
No-DB (plain pytest class, no marker)
    Field-shape, read_only, write_only, required, and validation tests using
    plain dicts.  None of these need ORM rows.

DB (@pytest.mark.django_db)
    ZoteroIntegrationSerializer round-trips that need a real saved instance
    (is_configured property, _api_key exclusion).

One class per serializer; one method per behaviour.

Run with:
    pytest slrt_project/integrations/tests/api/test_serializers.py -v
"""

import pytest

from slrt_project.integrations.api.serializers import (
    ZoteroCollectionItemSerializer,
    ZoteroConfigSerializer,
    ZoteroCreateCollectionResponseSerializer,
    ZoteroCreateCollectionSerializer,
    ZoteroDeletionPreviewResponseSerializer,
    ZoteroDestroyResponseSerializer,
    ZoteroIntegrationSerializer,
    ZoteroPullSerializer,
    ZoteroPushSerializer,
    ZoteroSetCollectionResponseSerializer,
    ZoteroSetCollectionSerializer,
    ZoteroStatusResponseSerializer,
    ZoteroSyncLogSerializer,
    ZoteroTaskResponseSerializer,
    ZoteroTaskStatusResponseSerializer,
    ZoteroToggleActiveResponseSerializer,
    ZoteroUpdateResponseSerializer,
    ZoteroUpdateSerializer,
)
from slrt_project.integrations.tests.factories import (
    ZoteroIntegrationFactory,
    ZoteroSyncLogFactory,
)


# ===========================================================================
# ZoteroIntegrationSerializer
# ===========================================================================


class TestZoteroIntegrationSerializerFields:
    def test_api_key_column_excluded(self):
        """The raw encrypted column must never appear in the field set."""
        assert "_api_key" not in ZoteroIntegrationSerializer().fields

    def test_is_configured_is_read_only(self):
        assert ZoteroIntegrationSerializer().fields["is_configured"].read_only is True

    def test_last_push_at_is_read_only(self):
        assert ZoteroIntegrationSerializer().fields["last_push_at"].read_only is True

    def test_created_at_is_read_only(self):
        assert ZoteroIntegrationSerializer().fields["created_at"].read_only is True

    def test_updated_at_is_read_only(self):
        assert ZoteroIntegrationSerializer().fields["updated_at"].read_only is True

    def test_last_sync_version_is_read_only(self):
        assert (
            ZoteroIntegrationSerializer().fields["last_sync_version"].read_only is True
        )


@pytest.mark.django_db
class TestZoteroIntegrationSerializerDB:
    def test_is_configured_true_when_set(self):
        integration = ZoteroIntegrationFactory()
        data = ZoteroIntegrationSerializer(integration).data
        assert data["is_configured"] is True

    def test_is_configured_false_when_inactive(self):
        integration = ZoteroIntegrationFactory(inactive=True)
        data = ZoteroIntegrationSerializer(integration).data
        assert data["is_configured"] is False

    def test_raw_api_key_not_in_output(self):
        integration = ZoteroIntegrationFactory()
        data = ZoteroIntegrationSerializer(integration).data
        assert "_api_key" not in data
        assert "api_key" not in data

    def test_expected_fields_present(self):
        integration = ZoteroIntegrationFactory()
        data = ZoteroIntegrationSerializer(integration).data
        for field in [
            "id",
            "review",
            "library_id",
            "library_type",
            "is_configured",
            "is_active",
            "last_push_at",
            "last_pull_at",
            "created_at",
        ]:
            assert field in data, f"Missing field: {field}"


# ===========================================================================
# ZoteroSyncLogSerializer
# ===========================================================================


class TestZoteroSyncLogSerializerFields:
    def test_all_fields_included(self):
        # fields = "__all__" — check a representative subset is present.
        s = ZoteroSyncLogSerializer()
        for field in [
            "id",
            "review",
            "sync_type",
            "items_processed",
            "items_with_pdfs",
            "success",
            "error_message",
            "synced_at",
        ]:
            assert field in s.fields, f"Missing: {field}"


@pytest.mark.django_db
class TestZoteroSyncLogSerializerDB:
    def test_serializes_log(self):
        log = ZoteroSyncLogFactory()
        data = ZoteroSyncLogSerializer(log).data
        assert data["success"] is True
        assert data["sync_type"] == "push"

    def test_failed_log(self):
        log = ZoteroSyncLogFactory(failed=True)
        data = ZoteroSyncLogSerializer(log).data
        assert data["success"] is False
        assert data["error_message"] != ""


# ===========================================================================
# ZoteroConfigSerializer
# ===========================================================================


class TestZoteroConfigSerializer:
    def _valid(self, **overrides):
        base = {
            "review": 1,
            "library_id": "1234567",
            "api_key": "a" * 24,
            "library_type": "user",
        }
        return {**base, **overrides}

    def test_valid_data_passes(self):
        s = ZoteroConfigSerializer(data=self._valid())
        assert s.is_valid(), s.errors

    def test_review_required(self):
        data = self._valid()
        del data["review"]
        s = ZoteroConfigSerializer(data=data)
        assert not s.is_valid()
        assert "review" in s.errors

    def test_library_id_required(self):
        data = self._valid()
        del data["library_id"]
        assert not ZoteroConfigSerializer(data=data).is_valid()

    def test_api_key_required(self):
        data = self._valid()
        del data["api_key"]
        assert not ZoteroConfigSerializer(data=data).is_valid()

    def test_non_numeric_library_id_rejected(self):
        s = ZoteroConfigSerializer(data=self._valid(library_id="user-abc"))
        assert not s.is_valid()
        assert "library_id" in s.errors

    def test_short_api_key_rejected(self):
        s = ZoteroConfigSerializer(data=self._valid(api_key="tooshort"))
        assert not s.is_valid()
        assert "api_key" in s.errors

    def test_library_type_defaults_to_user(self):
        data = self._valid()
        del data["library_type"]
        s = ZoteroConfigSerializer(data=data)
        assert s.is_valid(), s.errors
        assert s.validated_data["library_type"] == "user"

    def test_group_library_type_accepted(self):
        s = ZoteroConfigSerializer(data=self._valid(library_type="group"))
        assert s.is_valid(), s.errors

    def test_invalid_library_type_rejected(self):
        s = ZoteroConfigSerializer(data=self._valid(library_type="personal"))
        assert not s.is_valid()
        assert "library_type" in s.errors

    def test_collection_fields_optional(self):
        s = ZoteroConfigSerializer(
            data=self._valid(collection_key=None, collection_name=None)
        )
        assert s.is_valid(), s.errors

    def test_review_is_write_only(self):
        # write_only fields are absent from the .data output.
        s = ZoteroConfigSerializer(data=self._valid())
        s.is_valid()
        assert "review" not in s.data

    def test_api_key_is_write_only(self):
        s = ZoteroConfigSerializer(data=self._valid())
        s.is_valid()
        assert "api_key" not in s.data


# ===========================================================================
# ZoteroUpdateSerializer
# ===========================================================================


class TestZoteroUpdateSerializer:
    def test_all_fields_optional(self):
        s = ZoteroUpdateSerializer(data={})
        assert s.is_valid(), s.errors

    def test_sync_action_defaults_to_keep(self):
        s = ZoteroUpdateSerializer(data={})
        s.is_valid()
        assert s.validated_data.get("sync_action", "keep") == "keep"

    def test_invalid_sync_action_rejected(self):
        s = ZoteroUpdateSerializer(data={"sync_action": "delete_all"})
        assert not s.is_valid()
        assert "sync_action" in s.errors

    def test_valid_sync_actions(self):
        for action in ["reset", "unlink", "keep"]:
            s = ZoteroUpdateSerializer(data={"sync_action": action})
            assert s.is_valid(), f"Failed for action: {action}"


# ===========================================================================
# ZoteroSetCollectionSerializer
# ===========================================================================


class TestZoteroSetCollectionSerializer:
    def test_all_fields_optional(self):
        assert ZoteroSetCollectionSerializer(data={}).is_valid()

    def test_collection_key_accepts_null(self):
        s = ZoteroSetCollectionSerializer(data={"collection_key": None})
        assert s.is_valid(), s.errors

    def test_invalid_sync_action_rejected(self):
        s = ZoteroSetCollectionSerializer(data={"sync_action": "nuke"})
        assert not s.is_valid()


# ===========================================================================
# ZoteroCreateCollectionSerializer
# ===========================================================================


class TestZoteroCreateCollectionSerializer:
    def test_name_required(self):
        s = ZoteroCreateCollectionSerializer(data={})
        assert not s.is_valid()
        assert "name" in s.errors

    def test_set_as_default_defaults_false(self):
        s = ZoteroCreateCollectionSerializer(data={"name": "My Collection"})
        s.is_valid()
        assert s.validated_data["set_as_default"] is False

    def test_valid_with_all_fields(self):
        s = ZoteroCreateCollectionSerializer(
            data={
                "name": "New Col",
                "parent_collection": "ABCD1234",
                "set_as_default": True,
            }
        )
        assert s.is_valid(), s.errors


# ===========================================================================
# ZoteroPushSerializer
# ===========================================================================


class TestZoteroPushSerializer:
    def test_confirm_defaults_false(self):
        s = ZoteroPushSerializer(data={})
        s.is_valid()
        assert s.validated_data["confirm"] is False

    def test_confirm_true_accepted(self):
        s = ZoteroPushSerializer(data={"confirm": True})
        assert s.is_valid()
        assert s.validated_data["confirm"] is True


# ===========================================================================
# ZoteroPullSerializer
# ===========================================================================


class TestZoteroPullSerializer:
    def test_force_defaults_false(self):
        s = ZoteroPullSerializer(data={})
        s.is_valid()
        assert s.validated_data["force"] is False

    def test_force_true_accepted(self):
        s = ZoteroPullSerializer(data={"force": True})
        assert s.is_valid()


# ===========================================================================
# Response serializers — field shape checks (no DB needed)
# ===========================================================================


class TestZoteroStatusResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroStatusResponseSerializer()
        for f in [
            "is_configured",
            "library_type",
            "last_push",
            "last_pull",
            "total_references",
            "synced_references",
            "recent_syncs",
        ]:
            assert f in s.fields, f"Missing: {f}"


class TestZoteroCollectionItemSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroCollectionItemSerializer()
        for f in ["key", "version", "name", "parent_collection"]:
            assert f in s.fields


class TestZoteroDestroyResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroDestroyResponseSerializer()
        for f in ["message", "action_performed", "references_affected", "details"]:
            assert f in s.fields


class TestZoteroUpdateResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroUpdateResponseSerializer()
        for f in ["message", "library_changed", "sync_action_performed", "data"]:
            assert f in s.fields


class TestZoteroTaskResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroTaskResponseSerializer()
        for f in ["message", "task_id", "status"]:
            assert f in s.fields


class TestZoteroTaskStatusResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroTaskStatusResponseSerializer()
        for f in ["task_id", "status"]:
            assert f in s.fields


class TestZoteroToggleActiveResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroToggleActiveResponseSerializer()
        assert "message" in s.fields
        assert "is_active" in s.fields


class TestZoteroSetCollectionResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroSetCollectionResponseSerializer()
        for f in [
            "message",
            "collection_key",
            "sync_version_reset",
            "sync_action_performed",
        ]:
            assert f in s.fields


class TestZoteroCreateCollectionResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroCreateCollectionResponseSerializer()
        for f in ["message", "collection", "set_as_default", "sync_version_reset"]:
            assert f in s.fields


class TestZoteroDeletionPreviewResponseSerializerFields:
    def test_required_fields_present(self):
        s = ZoteroDeletionPreviewResponseSerializer()
        for f in [
            "integration_id",
            "review_id",
            "synced_references",
            "references_with_pdfs",
            "collection",
            "actions",
        ]:
            assert f in s.fields
