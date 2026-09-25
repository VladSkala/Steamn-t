from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


ORDER_TOTAL_MAX = Decimal("999999999999.99")


def snapshot_library_prices(apps, schema_editor):
    Game = apps.get_model("games", "Game")
    LibraryItem = apps.get_model("store", "LibraryItem")
    OrderItem = apps.get_model("store", "OrderItem")

    order_prices = {
        (order_id, game_id): price
        for order_id, game_id, price in OrderItem.objects.values_list(
            "order_id",
            "game_id",
            "price_at_purchase",
        )
    }
    game_prices = dict(Game.objects.values_list("pk", "price"))
    changed = []
    for item in LibraryItem.objects.all().iterator():
        item.price_at_purchase = order_prices.get(
            (item.order_id, item.game_id),
            game_prices[item.game_id],
        )
        changed.append(item)
    if changed:
        LibraryItem.objects.bulk_update(changed, ("price_at_purchase",))


class Migration(migrations.Migration):
    dependencies = [("store", "0003_libraryitem_is_favorite_librarycollection")]

    operations = [
        migrations.AddField(
            model_name="libraryitem",
            name="price_at_purchase",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AlterField(
            model_name="libraryitem",
            name="order",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="library_items",
                to="store.order",
            ),
        ),
        migrations.AlterField(
            model_name="order",
            name="total_price",
            field=models.DecimalField(
                decimal_places=2,
                default=Decimal("0.00"),
                max_digits=14,
                validators=[
                    django.core.validators.MinValueValidator(Decimal("0.00")),
                    django.core.validators.MaxValueValidator(ORDER_TOTAL_MAX),
                ],
            ),
        ),
        migrations.RunPython(
            snapshot_library_prices,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="libraryitem",
            name="price_at_purchase",
            field=models.DecimalField(
                decimal_places=2,
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(Decimal("0.00"))],
            ),
        ),
        migrations.AddConstraint(
            model_name="libraryitem",
            constraint=models.CheckConstraint(
                condition=models.Q(("price_at_purchase__gte", 0)),
                name="library_item_price_non_negative",
            ),
        ),
        migrations.AddConstraint(
            model_name="order",
            constraint=models.CheckConstraint(
                condition=models.Q(("total_price__lte", ORDER_TOTAL_MAX)),
                name="order_total_within_range",
            ),
        ),
    ]
