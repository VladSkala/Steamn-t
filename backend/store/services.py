from decimal import Decimal

from django.db import IntegrityError, transaction

from store.models import (
    ORDER_TOTAL_MAX,
    Cart,
    CartDLCItem,
    CartItem,
    LibraryDLCItem,
    LibraryItem,
    Order,
    OrderDLCItem,
    OrderItem,
    BundlePurchase,
)
from games.models import GameBundle


class CheckoutError(Exception):
    """Base class for checkout failures that are safe to return to a client."""


class EmptyCartError(CheckoutError):
    """Raised when checkout is requested without any cart items."""


class AlreadyOwnedGamesError(CheckoutError):
    """Raised when at least one cart game is already in the user's library."""

    def __init__(self, game_ids):
        self.game_ids = tuple(sorted(set(game_ids)))
        super().__init__("One or more games are already owned.")


class OrderTotalOverflowError(CheckoutError):
    """Raised before persistence when a cart cannot fit the order contract."""


class DLCRequirementError(CheckoutError):
    """A base game is missing, or the add-on is unavailable/already owned."""


class BundleUnavailableError(CheckoutError):
    """The bundle is empty, unavailable, or wholly owned."""


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
    dlc_items = list(
        CartDLCItem.objects.select_for_update()
        .filter(cart=cart)
        .select_related("dlc__game")
        .order_by("created_at", "pk")
    )
    if not cart_items and not dlc_items:
        raise EmptyCartError

    return cart, cart_items, dlc_items


@transaction.atomic
def checkout_user_cart(user, payment_method="demo"):
    """Create a completed demo order and transfer its games to the library.

    The cart row is locked so two checkout requests for the same account cannot
    buy the same cart twice. Every write and the cart cleanup happen in one
    database transaction: either the complete purchase is stored or nothing is
    changed.
    """

    type(user).objects.select_for_update().get(pk=user.pk)
    _cart, cart_items, dlc_items = _load_locked_cart_items(user)
    game_ids = tuple(item.game_id for item in cart_items)

    owned_game_ids = tuple(
        LibraryItem.objects.select_for_update()
        .filter(user=user, game_id__in=game_ids)
        .order_by("game_id")
        .values_list("game_id", flat=True)
    )
    if owned_game_ids:
        raise AlreadyOwnedGamesError(owned_game_ids)

    dlc_ids = tuple(item.dlc_id for item in dlc_items)
    if LibraryDLCItem.objects.select_for_update().filter(user=user, dlc_id__in=dlc_ids).exists():
        raise DLCRequirementError("Remove already owned DLC from the cart.")
    available_base_ids = set(game_ids) | set(
        LibraryItem.objects.filter(user=user).values_list("game_id", flat=True)
    )
    for item in dlc_items:
        if not item.dlc.is_available or item.dlc.game_id not in available_base_ids:
            raise DLCRequirementError("Own or buy the base game before purchasing its DLC.")

    total_price = sum(
        (item.game.price for item in cart_items),
        start=Decimal("0.00"),
    ) + sum((item.dlc.price for item in dlc_items), start=Decimal("0.00"))
    if total_price > ORDER_TOTAL_MAX:
        raise OrderTotalOverflowError

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
    OrderDLCItem.objects.bulk_create(
        [OrderDLCItem(order=order, dlc=item.dlc, price_at_purchase=item.dlc.price)
         for item in dlc_items],
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
                        price_at_purchase=item.game.price,
                    )
                    for item in cart_items
                ],
            )
    except IntegrityError as error:
        raise AlreadyOwnedGamesError(game_ids) from error
    try:
        with transaction.atomic():
            LibraryDLCItem.objects.bulk_create(
                [LibraryDLCItem(user=user, dlc=item.dlc, order=order,
                                price_at_purchase=item.dlc.price) for item in dlc_items],
            )
    except IntegrityError as error:
        raise DLCRequirementError("One or more DLC items are already owned.") from error

    # Ownership and Wishlist cleanup must commit or roll back together. This
    # keeps purchased games out of the personal Wishlist without risking data
    # loss when any checkout write fails.
    from community.models import GameWishlist

    GameWishlist.objects.filter(
        user=user,
        game_id__in=game_ids,
    ).delete()

    CartItem.objects.filter(
        pk__in=[item.pk for item in cart_items],
    ).delete()
    CartDLCItem.objects.filter(pk__in=[item.pk for item in dlc_items]).delete()

    from users.wallet_services import record_purchase
    record_purchase(user, order, payment_method)
    return order


@transaction.atomic
def checkout_bundle(user, bundle_id, payment_method="demo"):
    """Buy the unowned portion of an offer as one atomic demo order."""
    type(user).objects.select_for_update().get(pk=user.pk)
    bundle = GameBundle.objects.select_for_update().filter(pk=bundle_id, is_available=True).first()
    if bundle is None:
        raise BundleUnavailableError("This bundle is not available.")
    games = list(bundle.games.all())
    dlc = list(bundle.dlc.select_related("game").all())
    if not games and not dlc:
        raise BundleUnavailableError("This bundle has no items.")
    owned_games = set(LibraryItem.objects.filter(user=user).values_list("game_id", flat=True))
    owned_dlc = set(LibraryDLCItem.objects.filter(user=user).values_list("dlc_id", flat=True))
    missing_games = [game for game in games if game.pk not in owned_games]
    missing_dlc = [item for item in dlc if item.pk not in owned_dlc]
    if not missing_games and not missing_dlc:
        raise BundleUnavailableError("You already own every item in this bundle.")
    available_games = owned_games | {game.pk for game in missing_games}
    if any(not item.is_available or item.game_id not in available_games for item in missing_dlc):
        raise DLCRequirementError("The bundle requires a base game that you do not own.")
    all_list_price = sum((game.price for game in games), Decimal("0.00")) + sum(
        (item.price for item in dlc), Decimal("0.00")
    )
    missing_list_price = sum((game.price for game in missing_games), Decimal("0.00")) + sum(
        (item.price for item in missing_dlc), Decimal("0.00")
    )
    # Existing ownership reduces the price; a free offer remains free.
    total = min(bundle.price, missing_list_price)
    if all_list_price > 0:
        total = min(bundle.price, (bundle.price * missing_list_price / all_list_price).quantize(Decimal("0.01")))
    if total > ORDER_TOTAL_MAX:
        raise OrderTotalOverflowError
    order = Order.objects.create(user=user, total_price=total, status=Order.Status.COMPLETED)
    BundlePurchase.objects.create(order=order, bundle=bundle, price_at_purchase=total)
    for game in missing_games:
        OrderItem.objects.create(order=order, game=game, price_at_purchase=Decimal("0.00"))
        LibraryItem.objects.create(user=user, game=game, order=order, price_at_purchase=Decimal("0.00"))
    for item in missing_dlc:
        OrderDLCItem.objects.create(order=order, dlc=item, price_at_purchase=Decimal("0.00"))
        LibraryDLCItem.objects.create(user=user, dlc=item, order=order, price_at_purchase=Decimal("0.00"))
    from community.models import GameWishlist
    GameWishlist.objects.filter(user=user, game__in=missing_games).delete()
    CartItem.objects.filter(cart__user=user, game__in=missing_games).delete()
    CartDLCItem.objects.filter(cart__user=user, dlc__in=missing_dlc).delete()
    from users.wallet_services import record_purchase
    record_purchase(user, order, payment_method)
    return order
