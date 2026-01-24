import pytest

from api.models import User


@pytest.mark.django_db
def test_create_user(user):
    assert user.email == "testuser@example.com"
    assert user.first_name == "Test"
    assert user.last_name == "User"
    assert not user.is_staff
    assert not user.is_superuser
    assert user.check_password("password")  # verifies password is hashed


@pytest.mark.django_db
def test_create_superuser(superuser):
    assert superuser.email == "admin@example.com"
    assert superuser.is_staff
    assert superuser.is_superuser
    assert superuser.check_password("adminpass")


@pytest.mark.django_db
def test_str_method(user):
    assert str(user) == "Test User (testuser@example.com)"


@pytest.mark.django_db
def test_email_normalization():
    user = User.objects.create_user(
        email="TESTEMAIL@Example.COM",
        password="password",
        first_name="Normalize",
        last_name="Test",
    )
    assert user.email == "TESTEMAIL@example.com"
