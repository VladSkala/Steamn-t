from django.contrib.auth.models import AbstractUser
from django.core.validators import FileExtensionValidator
from django.db import models

from core.validators import validate_image_size


class User(AbstractUser):
    """Project user used by authentication, profiles, orders, and reviews."""

    email = models.EmailField(unique=True)
    avatar = models.ImageField(
        upload_to="avatars/%Y/%m/",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )

    REQUIRED_FIELDS = ["email"]

    class Meta:
        ordering = ["username"]

    @property
    def created_at(self):
        """Expose Django's date_joined under the project API name."""

        return self.date_joined

    def __str__(self) -> str:
        return self.username
