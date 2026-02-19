from typing import ClassVar

from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.db.models import CharField, EmailField, ImageField
from django.utils.translation import gettext_lazy as _

from .managers import UserManager


class User(AbstractUser):
    """
    Default custom user model for Systematic Literature Review Tool.
    If adding fields that need to be filled at user signup,
    check forms.SignupForm and forms.SocialSignupForms accordingly.
    """

    first_name = CharField(max_length=150)
    last_name = CharField(max_length=150)
    email = EmailField(_("email address"), unique=True)
    username = None  # type: ignore[assignment]
    avatar = ImageField(
        upload_to="avatars/",
        null=True,
        blank=True,
        validators=[FileExtensionValidator(["jpg", "jpeg", "png", "gif"])],
        help_text="Upload a profile picture",
    )

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = []

    objects: ClassVar[UserManager] = UserManager()

    class Meta:
        ordering = ["first_name"]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.email})"
