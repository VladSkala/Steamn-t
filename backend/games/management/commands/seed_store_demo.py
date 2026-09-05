"""Offline demo data; never alters existing accounts or non-demo game records."""
import json
import secrets
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Q

from community.models import GameWishlist
from games.models import Game, GameScreenshot, Genre
from store.models import Cart, CartItem, LibraryCollection, LibraryItem, Order, OrderItem

DEMO_ROOT = Path(__file__).resolve().parents[2] / "demo"
DEMO_USERNAME = "steamnt_demo"


class Command(BaseCommand):
    help = "Seed 12 fictional games and local artwork; optionally create a separate demo account."

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-demo-user", action="store_true",
            help="Create a NEW sample account; never change an existing account or its password.",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        records = json.loads((DEMO_ROOT / "catalog.json").read_text())
        for row in records:
            for filename in ("cover.webp", "scene-1.webp", "scene-2.webp", "scene-3.webp"):
                if not (DEMO_ROOT / "assets" / row["slug"] / filename).is_file():
                    raise CommandError(f"Missing demo asset: {row['slug']}/{filename}")
        created_count = 0
        games = []
        for row in records:
            defaults = {
                key: row[key] for key in
                ("description", "price", "release_date", "requirements", "disk_size_gb")
            }
            game, created = Game.objects.get_or_create(
                title=row["title"], developer=row["developer"], defaults=defaults,
            )
            created_count += int(created)
            if created:
                game.genres.set([Genre.objects.get_or_create(name=name)[0] for name in row["genres"]])
                asset_dir = DEMO_ROOT / "assets" / row["slug"]
                with (asset_dir / "cover.webp").open("rb") as stream:
                    game.cover.save(f"demo-{row['slug']}.webp", File(stream), save=True)
                for position in range(3):
                    screenshot = GameScreenshot(
                        game=game, position=position,
                        caption=f"{game.title} — concept artwork {position + 1} (demo)",
                    )
                    with (asset_dir / f"scene-{position + 1}.webp").open("rb") as stream:
                        screenshot.image.save(f"demo-{row['slug']}-{position + 1}.webp", File(stream), save=True)
            games.append(game)
        self.stdout.write(self.style.SUCCESS(
            f"Demo catalog ready: {created_count} new games; existing entries unchanged."
        ))
        if not options["with_demo_user"]:
            self.stdout.write("No accounts, purchases, Wishlist items or Cart items were changed.")
            return
        User = get_user_model()
        if User.objects.filter(Q(username=DEMO_USERNAME) | Q(email="steamnt-demo@example.invalid")).exists():
            self.stdout.write("Demo username or email already exists. Account, password and collections left unchanged.")
            return
        password = secrets.token_urlsafe(18)
        user = User.objects.create_user(
            username=DEMO_USERNAME, email="steamnt-demo@example.invalid", password=password,
        )
        owned = games[:5]
        order = Order.objects.create(
            user=user, status=Order.Status.COMPLETED,
            total_price=sum((Decimal(game.price) for game in owned), Decimal("0.00")),
        )
        for index, game in enumerate(owned):
            OrderItem.objects.create(order=order, game=game, price_at_purchase=game.price)
            LibraryItem.objects.create(user=user, game=game, order=order, is_favorite=index < 2)
        collection = LibraryCollection.objects.create(user=user, name="Weekend picks")
        collection.games.set(owned[:3])
        for game in games[5:9]:
            GameWishlist.objects.create(user=user, game=game)
        cart, _ = Cart.objects.get_or_create(user=user)
        for game in games[9:11]:
            CartItem.objects.create(cart=cart, game=game)
        self.stdout.write(self.style.SUCCESS(
            "Separate demo account created: 5 Library games, 4 Wishlist games, 2 Cart games."
        ))
        self.stdout.write(f"Username: {DEMO_USERNAME}\nOne-time generated password: {password}")
        self.stdout.write("Only this new demo account was populated. No money charged; no reviews/social activity generated.")
