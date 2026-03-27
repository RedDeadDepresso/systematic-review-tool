"""
Tests for slrt_project/users/models.py — the custom User model.
"""

import pytest
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile


# ── Helpers ────────────────────────────────────────────────────────────────────


def _make_user(**kwargs):
    """Return an unsaved User instance with sensible defaults."""
    from slrt_project.users.models import User

    defaults = {
        "first_name": "Alice",
        "last_name": "Smith",
        "email": "alice@example.com",
    }
    defaults.update(kwargs)
    return User(**defaults)


# ── Fields ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserFields:
    def test_email_is_stored_correctly(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="bob@example.com")
        user.refresh_from_db()
        assert user.email == "bob@example.com"

    def test_email_must_be_unique(self):
        from django.db import IntegrityError

        from slrt_project.users.models import User

        # UserFactory has django_get_or_create=("email",) so a second call
        # silently returns the existing row instead of raising.  Use the
        # manager directly to guarantee an actual INSERT attempt.
        User.objects.create_user(email="dup@example.com", password="pass")
        with pytest.raises(IntegrityError):
            User.objects.create_user(email="dup@example.com", password="pass")

    def test_username_field_does_not_exist(self):
        from slrt_project.users.models import User

        assert not hasattr(User, "username") or User.username is None

    def test_first_and_last_name_stored(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(first_name="Carol", last_name="Jones")
        user.refresh_from_db()
        assert user.first_name == "Carol"
        assert user.last_name == "Jones"

    def test_avatar_is_optional(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        assert not user.avatar  # falsy when no avatar set

    def test_avatar_accepts_valid_extension(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        for ext in ("jpg", "jpeg", "png", "gif"):
            user.avatar = SimpleUploadedFile(
                f"pic.{ext}", b"data", content_type=f"image/{ext}"
            )
            # run_validators raises if the extension is invalid
            user.avatar.field.run_validators(user.avatar)

    def test_avatar_rejects_invalid_extension(self):
        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory()
        user.avatar = SimpleUploadedFile(
            "malicious.exe", b"data", content_type="application/octet-stream"
        )
        with pytest.raises(ValidationError):
            user.avatar.field.run_validators(user.avatar)


# ── Authentication config ──────────────────────────────────────────────────────


class TestUserAuthConfig:
    def test_username_field_is_email(self):
        from slrt_project.users.models import User

        assert User.USERNAME_FIELD == "email"

    def test_required_fields_is_empty(self):
        from slrt_project.users.models import User

        assert User.REQUIRED_FIELDS == []

    @pytest.mark.django_db
    def test_user_authenticates_with_email_and_password(self):
        from django.contrib.auth import authenticate

        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="login@example.com")
        user.set_password("s3cr3t!")
        user.save()
        result = authenticate(username="login@example.com", password="s3cr3t!")
        assert result is not None
        assert result.pk == user.pk

    @pytest.mark.django_db
    def test_wrong_password_returns_none(self):
        from django.contrib.auth import authenticate

        from slrt_project.reviews.tests.factories import UserFactory

        user = UserFactory(email="fail@example.com")
        user.set_password("correct")
        user.save()
        result = authenticate(username="fail@example.com", password="wrong")
        assert result is None


# ── __str__ ────────────────────────────────────────────────────────────────────


class TestUserStr:
    def test_str_format(self):
        user = _make_user(
            first_name="Alice", last_name="Smith", email="alice@example.com"
        )
        assert str(user) == "Alice Smith (alice@example.com)"

    def test_str_with_blank_first_name(self):
        user = _make_user(first_name="", last_name="Smith", email="x@example.com")
        result = str(user)
        assert "Smith" in result
        assert "x@example.com" in result

    def test_str_with_blank_last_name(self):
        user = _make_user(first_name="Alice", last_name="", email="x@example.com")
        result = str(user)
        assert "Alice" in result
        assert "x@example.com" in result


# ── Meta ───────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserMeta:
    def test_default_ordering_is_first_name(self):
        from slrt_project.users.models import User

        assert User._meta.ordering == ["first_name"]

    def test_queryset_ordered_by_first_name(self):
        from slrt_project.reviews.tests.factories import UserFactory

        # Create users whose natural insertion order differs from alphabetical.
        UserFactory(first_name="Zara", email="zara@example.com")
        UserFactory(first_name="Alice", email="alice2@example.com")
        UserFactory(first_name="Mona", email="mona@example.com")

        from slrt_project.users.models import User

        names = list(
            User.objects.filter(
                email__in=["zara@example.com", "alice2@example.com", "mona@example.com"]
            ).values_list("first_name", flat=True)
        )
        assert names == sorted(names)


# ── Manager ────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
class TestUserManager:
    def test_objects_is_user_manager(self):
        from slrt_project.users.managers import UserManager
        from slrt_project.users.models import User

        assert isinstance(User.objects, UserManager)

    def test_create_user_stores_email_and_hashed_password(self):
        from slrt_project.users.models import User

        user = User.objects.create_user(email="mgr@example.com", password="pass123")
        assert user.email == "mgr@example.com"
        assert user.check_password("pass123")
        assert not user.is_staff
        assert not user.is_superuser

    def test_create_user_without_email_raises(self):
        from slrt_project.users.models import User

        with pytest.raises((ValueError, TypeError)):
            User.objects.create_user(email="", password="pass")

    def test_create_superuser_sets_flags(self):
        from slrt_project.users.models import User

        su = User.objects.create_superuser(email="su@example.com", password="pass123")
        assert su.is_staff is True
        assert su.is_superuser is True
