from decimal import Decimal

from django.db import IntegrityError, transaction

from store.models import Cart, CartItem, LibraryItem, Order, OrderItem


class CheckoutError(Exception):
    """Base class for checkout failures that are safe to return to a client."""


class EmptyCartError(CheckoutError):
    """Raised when checkout is requested without any cart items."""


class AlreadyOwnedGamesError(CheckoutError):
    """Raised when at least one cart game is already in the user's library."""

    def __init__(self, game_ids):
        self.game_ids = tuple(sorted(set(game_ids)))
        super().__init__("One or more games are already owned.")


def _load_locked_cart_items(user):
    """Lock one user's cart and return the exact items included in checkout."""

    cart = (
        Cart.objects.select_for_update()
        .filter(user=user)
        .first()
    )
    if cart is None:
        raise EmptyCartError

    cart_items = list(
        CartItem.objects.select_for_update()
        .filter(cart=cart)
        .select_related("game")
        .order_by("created_at", "pk")
    )
    if not cart_items:
        raise EmptyCartError

    return cart, cart_items


@transaction.atomic
def checkout_user_cart(user):
    """Create a completed demo order and transfer its games to the library.

    The cart row is locked so two checkout requests for the same account cannot
    buy the same cart twice. Every write and the cart cleanup happen in one
    database transaction: either the complete purchase is stored or nothing is
    changed.
    """

    _cart, cart_items = _load_locked_cart_items(user)
    game_ids = tuple(item.game_id for item in cart_items)

    owned_game_ids = tuple(
        LibraryItem.objects.select_for_update()
        .filter(user=user, game_id__in=game_ids)
        .order_by("game_id")
        .values_list("game_id", flat=True)
    )
    if owned_game_ids:
        raise AlreadyOwnedGamesError(owned_game_ids)

    total_price = sum(
        (item.game.price for item in cart_items),
        start=Decimal("0.00"),
    )
    order = Order.objects.create(
        user=user,
        total_price=total_price,
        status=Order.Status.COMPLETED,
    )

    OrderItem.objects.bulk_create(
        [
            OrderItem(
                order=order,
                game=item.game,
                price_at_purchase=item.game.price,
            )
            for item in cart_items
        ],
    )

    # The model-level unique constraint is the final protection against two
    # concurrent requests trying to grant the same game to one user. The nested
    # savepoint lets us translate that race safely without leaving a broken
    # transaction behind.
    try:
        with transaction.atomic():
            LibraryItem.objects.bulk_create(
                [
                    LibraryItem(
                        user=user,
                        game=item.game,
                        order=order,
                    )
                    for item in cart_items
                ],
            )
    except IntegrityError as error:
        raise AlreadyOwnedGamesError(game_ids) from error

    CartItem.objects.filter(
        pk__in=[item.pk for item in cart_items],
    ).delete()

    return order
