from decimal import Decimal

from django.core.validators import FileExtensionValidator, MinValueValidator
from django.db import models

from core.models import TimeStampedModel
from core.validators import validate_image_size


class Genre(TimeStampedModel):
    """A reusable catalog genre assigned to one or more games."""

    name = models.CharField(max_length=100, unique=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "genre"
        verbose_name_plural = "genres"

    def __str__(self) -> str:
        return self.name


class Game(TimeStampedModel):
    """Core catalog item sold by the Steamn’t store."""

    title = models.CharField(max_length=255)
    description = models.TextField()
    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    cover = models.ImageField(
        upload_to="games/covers/%Y/%m/",
        blank=True,
        null=True,
        validators=[
            FileExtensionValidator(["jpg", "jpeg", "png", "webp"]),
            validate_image_size,
        ],
    )
    hero_image_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional wide artwork used by the owned-game library page.",
    )
    download_url = models.URLField(
        max_length=500,
        blank=True,
        help_text="Optional real download target for purchased users.",
    )
    disk_size_gb = models.DecimalField(
        max_digits=8,
        decimal_places=2,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    developer = models.CharField(max_length=255)
    release_date = models.DateField()
    requirements = models.TextField(blank=True)
    genres = models.ManyToManyField(
        Genre,
        related_name="games",
        blank=True,
    )

    class Meta:
        ordering = ["title"]
        indexes = [
            models.Index(fields=["title"], name="game_title_idx"),
            models.Index(fields=["release_date"], name="game_release_date_idx"),
        ]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(price__gte=0),
                name="game_price_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(disk_size_gb__isnull=True)
                | models.Q(disk_size_gb__gte=0),
                name="game_disk_size_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return self.title
