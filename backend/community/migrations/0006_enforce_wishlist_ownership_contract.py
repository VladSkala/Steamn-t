from django.db import migrations


def transfer_legacy_owned_wishes_to_favorites(apps, schema_editor):
    GameWishlist = apps.get_model("community", "GameWishlist")
    LibraryItem = apps.get_model("store", "LibraryItem")

    for item in LibraryItem.objects.all().iterator():
        old_toggle = GameWishlist.objects.filter(
            user_id=item.user_id,
            game_id=item.game_id,
        )
        if old_toggle.exists():
            LibraryItem.objects.filter(pk=item.pk).update(is_favorite=True)
            old_toggle.delete()


class Migration(migrations.Migration):
    dependencies = [
        ("community", "0005_friendship"),
        ("store", "0004_order_totals_and_library_ownership"),
    ]

    operations = [
        migrations.RunPython(
            transfer_legacy_owned_wishes_to_favorites,
            reverse_code=migrations.RunPython.noop,
        )
    ]
