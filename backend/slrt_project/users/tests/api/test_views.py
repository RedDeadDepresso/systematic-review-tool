"""
Tests for slrt_project/users/serializers.py and slrt_project/users/views.py.

Strategy
--------
- APIRequestFactory + bypass_is_authenticated fixture for all view tests.
- allauth EmailAddress is patched where the serializer touches it to keep
  tests hermetic (no allauth setup required).

Coverage
--------
UserView (slrt_project/users/views.py)
  - GET returns 200 with the authenticated user's data
  - PUT updates the user and returns 200
  - PATCH partially updates the user and returns 200
  - DELETE deletes the user and returns 204 with detail message
  - Unauthenticated requests to GET are rejected (401/403)
"""

from unittest.mock import MagicMock, patch

import pytest
from rest_framework.test import APIClient, APIRequestFactory


factory = APIRequestFactory()


# ── Fixtures ───────────────────────────────────────────────────────────────────


@pytest.fixture(autouse=True)
def bypass_is_authenticated():
    """Bypass DRF's IsAuthenticated for all tests in this module."""
    with patch(
        "rest_framework.permissions.IsAuthenticated.has_permission",
        return_value=True,
    ):
        yield


# ── UserView ───────────────────────────────────────────────────────────────────
#
# APIRequestFactory.get/put/patch/delete builds a raw Django request.
# DRF wraps it in rest_framework.request.Request and resolves request.user
# lazily via authentication classes, which resets it to AnonymousUser even
# when we set request.user = user on the factory request.
#
# Solution: use APIClient.force_authenticate() which injects the user into the
# DRF authentication layer before the view runs.


@pytest.mark.django_db
class TestUserViewGet:
    def test_get_returns_200_with_user_data(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(
            first_name="Carol", last_name="White", email="carol@example.com"
        )
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/auth/user/")
        assert response.status_code == 200
        assert response.data["email"] == "carol@example.com"
        assert response.data["first_name"] == "Carol"

    def test_get_includes_display_name(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        client = APIClient()
        client.force_authenticate(user=user)
        response = client.get("/api/auth/user/")
        assert "display_name" in response.data

    def test_unauthenticated_get_is_rejected(self):
        with patch(
            "rest_framework.permissions.IsAuthenticated.has_permission",
            return_value=False,
        ):
            client = APIClient()  # not authenticated
            response = client.get("/api/auth/user/")
        assert response.status_code in (401, 403)


@pytest.mark.django_db
class TestUserViewPut:
    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_put_updates_user_and_returns_200(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Old", last_name="Name", email="put@example.com")
        payload = {
            "first_name": "Updated",
            "last_name": "Name",
            "email": "put@example.com",
        }
        with (
            patch("allauth.account.models.EmailAddress.objects.filter"),
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), False),
            ),
        ):
            response = self._client(user).put("/api/auth/user/", payload, format="json")

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == "Updated"

    def test_put_returns_updated_data_in_response(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="put2@example.com")
        payload = {
            "first_name": "Fresh",
            "last_name": "Data",
            "email": "put2@example.com",
        }
        with (
            patch("allauth.account.models.EmailAddress.objects.filter"),
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), False),
            ),
        ):
            response = self._client(user).put("/api/auth/user/", payload, format="json")

        assert response.data["first_name"] == "Fresh"


@pytest.mark.django_db
class TestUserViewPatch:
    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_patch_partially_updates_user_and_returns_200(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Original")
        with (
            patch("allauth.account.models.EmailAddress.objects.filter"),
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), False),
            ),
        ):
            response = self._client(user).patch(
                "/api/auth/user/", {"first_name": "Patched"}, format="json"
            )

        assert response.status_code == 200
        user.refresh_from_db()
        assert user.first_name == "Patched"

    def test_patch_does_not_overwrite_untouched_fields(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(
            first_name="Keep", last_name="This", email="patch@example.com"
        )
        with (
            patch("allauth.account.models.EmailAddress.objects.filter"),
            patch(
                "allauth.account.models.EmailAddress.objects.get_or_create",
                return_value=(MagicMock(), False),
            ),
        ):
            self._client(user).patch(
                "/api/auth/user/", {"first_name": "Changed"}, format="json"
            )

        user.refresh_from_db()
        assert user.last_name == "This"
        assert user.email == "patch@example.com"


@pytest.mark.django_db
class TestUserViewDelete:
    def _client(self, user):
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_delete_returns_204(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        response = self._client(user).delete("/api/auth/user/")
        assert response.status_code == 204

    def test_delete_removes_user_from_db(self):
        from slrt_project.reviews.tests.factories import UserFactory
        from slrt_project.users.models import User

        user = UserFactory()
        user_id = user.id
        self._client(user).delete("/api/auth/user/")
        assert not User.objects.filter(id=user_id).exists()

    def test_delete_response_contains_detail_message(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        response = self._client(user).delete("/api/auth/user/")
        assert "detail" in response.data
        assert "deleted" in response.data["detail"].lower()
