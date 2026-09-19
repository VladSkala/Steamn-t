from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core.models import TimeStampedModel
from games.models import DLC, Game, GameBundle


ORDER_TOTAL_MAX = Decimal("999999999999.99")


class Cart(TimeStampedModel):
    """One active shopping cart owned by one user."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="cart",
    )

    def __str__(self) -> str:
        return f"Cart #{self.pk} — {self.user.username}"


class CartItem(TimeStampedModel):
    """A unique game placed in a user's cart."""

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="items",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "game"],
                name="unique_cart_game",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.game.title} in cart #{self.cart_id}"


class CartDLCItem(TimeStampedModel):
    """An add-on awaiting checkout in the user's existing cart."""

    cart = models.ForeignKey(
        Cart,
        on_delete=models.CASCADE,
        related_name="dlc_items",
    )
    dlc = models.ForeignKey(
        DLC,
        on_delete=models.CASCADE,
        related_name="cart_items",
    )

    class Meta:
        ordering = ["created_at", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["cart", "dlc"],
                name="unique_cart_dlc",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.dlc.title} in cart #{self.cart_id}"


class Order(TimeStampedModel):
    """Immutable purchase header created by demo checkout."""

    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"
        REFUNDED = "refunded", "Refunded"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="orders",
    )
    total_price = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[
            MinValueValidator(Decimal("0.00")),
            MaxValueValidator(ORDER_TOTAL_MAX),
        ],
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        db_index=True,
    )

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(total_price__gte=0),
                name="order_total_non_negative",
            ),
            models.CheckConstraint(
                condition=models.Q(total_price__lte=ORDER_TOTAL_MAX),
                name="order_total_within_range",
            ),
        ]

    def __str__(self) -> str:
        return f"Order #{self.pk} — {self.user.username}"


class OrderItem(TimeStampedModel):
    """A purchased game with its price frozen at checkout time."""

    order = models.ForeignKey(
        Order,
        on_delete=models.CASCADE,
        related_name="items",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.PROTECT,
        related_name="order_items",
    )
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "game"],
                name="unique_order_game",
            ),
            models.CheckConstraint(
                condition=models.Q(price_at_purchase__gte=0),
                name="order_item_price_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.game.title} in order #{self.order_id}"


class OrderDLCItem(TimeStampedModel):
    """Purchased add-on with its exact checkout-time price."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="dlc_items")
    dlc = models.ForeignKey(DLC, on_delete=models.PROTECT, related_name="order_items")
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["created_at", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["order", "dlc"],
                name="unique_order_dlc",
            ),
            models.CheckConstraint(
                condition=models.Q(price_at_purchase__gte=0),
                name="order_dlc_price_non_negative",
            ),
        ]


class BundlePurchase(TimeStampedModel):
    """Receipt line preserving the bundle offer used for a purchase."""

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="bundles")
    bundle = models.ForeignKey(
        GameBundle,
        on_delete=models.PROTECT,
        related_name="purchases",
    )
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["order", "bundle"],
                name="unique_order_bundle",
            ),
        ]


class LibraryItem(TimeStampedModel):
    """A permanent link between a user and a purchased game."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="library_items",
    )
    game = models.ForeignKey(
        Game,
        on_delete=models.PROTECT,
        related_name="library_items",
    )
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        related_name="library_items",
        blank=True,
        null=True,
    )
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    is_favorite = models.BooleanField(default=False)

    @property
    def purchased_at(self):
        """Expose created_at under the domain name used by the API."""

        return self.created_at

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "game"],
                name="unique_library_user_game",
            ),
            models.CheckConstraint(
                condition=models.Q(price_at_purchase__gte=0),
                name="library_item_price_non_negative",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.game.title} in {self.user.username}'s library"


class LibraryDLCItem(TimeStampedModel):
    """Permanent ownership of one purchased add-on."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="library_dlc_items",
    )
    dlc = models.ForeignKey(DLC, on_delete=models.PROTECT, related_name="library_items")
    order = models.ForeignKey(
        Order,
        on_delete=models.SET_NULL,
        related_name="library_dlc_items",
        blank=True,
        null=True,
    )
    price_at_purchase = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.00"))],
    )

    class Meta:
        ordering = ["-created_at", "-pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "dlc"],
                name="unique_library_user_dlc",
            ),
            models.CheckConstraint(
                condition=models.Q(price_at_purchase__gte=0),
                name="library_dlc_price_non_negative",
            ),
        ]


class LibraryCollection(TimeStampedModel):
    """A named group of games owned by exactly one user."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="library_collections",
    )
    name = models.CharField(max_length=80)
    games = models.ManyToManyField(
        Game,
        related_name="library_collections",
        blank=True,
    )

    class Meta:
        ordering = ["name", "pk"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "name"],
                name="unique_library_collection_name_per_user",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.name} — {self.user.username}"
