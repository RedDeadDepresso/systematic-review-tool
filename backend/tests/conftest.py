import pytest

from api.models import User


@pytest.fixture
def user(db):
    """Return a normal user."""
    return User.objects.create_user(
        email="testuser@example.com",
        password="password",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def superuser(db):
    """Return a superuser."""
    return User.objects.create_superuser(
        email="admin@example.com",
        password="adminpass",
        first_name="Admin",
        last_name="User",
    )
