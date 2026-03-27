"""
Tests for slrt_project/users/serializers.py and slrt_project/users/views.py.

Strategy
- Serializer tests are pure unit/integration tests (no HTTP layer needed).
- allauth EmailAddress is patched where the serializer touches it to keep
tests hermetic (no allauth setup required).
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIRequestFactory


factory = APIRequestFactory()


# ── UserSerializer ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserSerializer:
    def _serializer(self, user, data=None, partial=False):
        from slrt_project.users.api.serializers import UserSerializer

        if data is not None:
            return UserSerializer(user, data=data, partial=partial)
        return UserSerializer(user)

    def test_serializes_expected_fields(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Alice", last_name="Smith")
        data = self._serializer(user).data
        assert set(data.keys()) == {
            "id",
            "email",
            "first_name",
            "last_name",
            "avatar",
            "display_name",
        }

    def test_display_name_equals_str(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Bob", last_name="Jones", email="bob@example.com")
        data = self._serializer(user).data
        assert data["display_name"] == str(user)
        assert "Bob" in data["display_name"]
        assert "bob@example.com" in data["display_name"]

    def test_id_is_read_only(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        original_id = user.id
        s = self._serializer(
            user,
            data={"id": 9999, "email": user.email, "first_name": "X", "last_name": "Y"},
        )
        assert s.is_valid()
        s.save()
        user.refresh_from_db()
        assert user.id == original_id

    def test_update_changes_name_fields(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Old", last_name="Name")
        s = self._serializer(
            user,
            data={"email": user.email, "first_name": "New", "last_name": "Name"},
        )
        assert s.is_valid(), s.errors
        s.save()
        user.refresh_from_db()
        assert user.first_name == "New"

    def test_update_with_empty_avatar_string_clears_avatar(self):
        from slrt_project.reviews.tests.factories import UserFactory
        from slrt_project.users.api.serializers import UserSerializer

        user = UserFactory()
        # Simulate an avatar already being set.
        user.avatar.name = "avatars/old.jpg"

        # The serializer checks self.initial_data.get("avatar") == "" to detect
        # the multipart "clear avatar" intent.  We need initial_data populated
        # with avatar="" AND for DRF's ImageField to pass validation.
        # Patching to_internal_value on the field instance bypasses all file/
        # image checks while still leaving the value in validated_data so
        # update() receives it and triggers the avatar-clear branch.
        payload = {
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "avatar": "",
        }
        with (
            patch("allauth.account.models.EmailAddress.objects.filter"),
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), False),
            ),
        ):
            serializer = UserSerializer(user, data=payload, partial=True)
            # Bypass the entire field pipeline (to_internal_value + run_validators)
            # by patching run_validation on the field instance. This makes DRF
            # treat "" as a valid value so it reaches update() unchanged.
            serializer.fields["avatar"].run_validation = lambda value: value
            assert serializer.is_valid(), serializer.errors
            serializer.save()

        assert not user.avatar

    def test_update_new_email_replaces_emailaddress(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="old@example.com")

        s = self._serializer(
            user,
            data={
                "email": "new@example.com",
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
        )
        assert s.is_valid(), s.errors

        mock_qs = MagicMock()
        with (
            patch(
                "allauth.account.models.EmailAddress.objects.filter",
                return_value=mock_qs,
            ) as mock_filter,
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), True),
            ) as mock_get_or_create,
        ):
            s.save()

        mock_filter.assert_called_once_with(user=user, email="old@example.com")
        mock_qs.delete.assert_called_once()
        mock_get_or_create.assert_called_once_with(user=user, email="new@example.com")

    def test_update_same_email_does_not_touch_emailaddress(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="same@example.com")

        s = self._serializer(
            user,
            data={"email": "same@example.com", "first_name": "A", "last_name": "B"},
        )
        assert s.is_valid(), s.errors

        with (
            patch("allauth.account.models.EmailAddress.objects.filter") as mock_filter,
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create"
            ) as mock_goc,
        ):
            s.save()

        mock_filter.assert_not_called()
        mock_goc.assert_not_called()
