"""Create the complete offline catalog and an optional isolated demo account."""

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
DEMO_EMAIL = "steamnt-demo@example.invalid"
DEMO_FEATURED_GAME_COUNT = 6
DEMO_SCREENSHOT_COUNT = 3
MINIMUM_DEMO_GAME_COUNT = 10
MINIMUM_DEMO_GENRE_COUNT = 5


class Command(BaseCommand):
    help = (
        "Seed fictional games, genres, featured artwork and screenshots; "
        "optionally create a separate demo account."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-demo-user",
            action="store_true",
            help=(
                "Create a new isolated sample account; never change an existing "
                "account or password."
            ),
        )

    def _load_and_validate_records(self):
        records = json.loads((DEMO_ROOT / "catalog.json").read_text(encoding="utf-8"))
        if not isinstance(records, list) or len(records) < MINIMUM_DEMO_GAME_COUNT:
            raise CommandError(
                f"Demo catalog must contain at least {MINIMUM_DEMO_GAME_COUNT} games."
            )

        identities = set()
        slugs = set()
        genre_names = set()
        required_keys = {
            "slug",
            "title",
            "developer",
            "description",
            "price",
            "release_date",
            "requirements",
            "disk_size_gb",
            "genres",
        }

        for row in records:
            missing_keys = required_keys.difference(row)
            if missing_keys:
                missing = ", ".join(sorted(missing_keys))
                raise CommandError(f"Demo catalog row is missing: {missing}")

            identity = (row["title"], row["developer"])
            if identity in identities:
                raise CommandError(f"Duplicate demo game: {row['title']}")
            if row["slug"] in slugs:
                raise CommandError(f"Duplicate demo slug: {row['slug']}")
            identities.add(identity)
            slugs.add(row["slug"])
            genre_names.update(row["genres"])

            asset_names = ["cover.webp"] + [
                f"scene-{position + 1}.webp"
                for position in range(DEMO_SCREENSHOT_COUNT)
            ]
            for filename in asset_names:
                asset = DEMO_ROOT / "assets" / row["slug"] / filename
                if not asset.is_file():
                    raise CommandError(
                        f"Missing demo asset: {row['slug']}/{filename}"
                    )

        if len(genre_names) < MINIMUM_DEMO_GENRE_COUNT:
            raise CommandError(
                f"Demo catalog must contain at least {MINIMUM_DEMO_GENRE_COUNT} genres."
            )
        return records

    @staticmethod
    def _game_defaults(row, is_featured):
        return {
            "description": row["description"],
            "price": row["price"],
            "release_date": row["release_date"],
            "requirements": row["requirements"],
            "disk_size_gb": row["disk_size_gb"],
            "is_featured": is_featured,
        }

    @staticmethod
    def _attach_artwork(game, row):
        game.genres.set(
            [Genre.objects.get_or_create(name=name)[0] for name in row["genres"]]
        )
        asset_dir = DEMO_ROOT / "assets" / row["slug"]
        with (asset_dir / "cover.webp").open("rb") as stream:
            game.cover.save(f"demo-{row['slug']}.webp", File(stream), save=True)

        for position in range(DEMO_SCREENSHOT_COUNT):
            screenshot = GameScreenshot(
                game=game,
                position=position,
                caption=f"{game.title} — concept artwork {position + 1} (demo)",
            )
            filename = f"demo-{row['slug']}-{position + 1}.webp"
            with (asset_dir / f"scene-{position + 1}.webp").open("rb") as stream:
                screenshot.image.save(filename, File(stream), save=True)

    @transaction.atomic
    def handle(self, *args, **options):
        records = self._load_and_validate_records()
        created_count = 0
        synchronized_count = 0
        games = []

        for index, row in enumerate(records):
            is_featured = index < DEMO_FEATURED_GAME_COUNT
            game, created = Game.objects.get_or_create(
                title=row["title"],
                developer=row["developer"],
                defaults=self._game_defaults(row, is_featured),
            )
            created_count += int(created)

            if created:
                self._attach_artwork(game, row)
            elif game.is_featured != is_featured:
                Game.objects.filter(pk=game.pk).update(is_featured=is_featured)
                game.is_featured = is_featured
                synchronized_count += 1

            games.append(game)

        featured_count = sum(game.is_featured for game in games)
        self.stdout.write(
            self.style.SUCCESS(
                "Demo catalog ready: "
                f"{created_count} new games; "
                f"{featured_count} featured; "
                f"{synchronized_count} featured flags synchronized."
            )
        )
        if not options["with_demo_user"]:
            self.stdout.write(
                "No accounts, purchases, Wishlist items or Cart items were changed."
            )
            return

        User = get_user_model()
        if User.objects.filter(
            Q(username=DEMO_USERNAME) | Q(email=DEMO_EMAIL)
        ).exists():
            self.stdout.write(
                "Demo username or email already exists. "
                "Account, password and collections left unchanged."
            )
            return

        password = secrets.token_urlsafe(18)
        user = User.objects.create_user(
            username=DEMO_USERNAME,
            email=DEMO_EMAIL,
            password=password,
        )
        owned = games[:5]
        order = Order.objects.create(
            user=user,
            status=Order.Status.COMPLETED,
            total_price=sum((Decimal(game.price) for game in owned), Decimal("0.00")),
        )
        for index, game in enumerate(owned):
            OrderItem.objects.create(
                order=order,
                game=game,
                price_at_purchase=game.price,
            )
            LibraryItem.objects.create(
                user=user,
                game=game,
                order=order,
                is_favorite=index < 2,
            )
        collection = LibraryCollection.objects.create(user=user, name="Weekend picks")
        collection.games.set(owned[:3])
        for game in games[5:9]:
            GameWishlist.objects.create(user=user, game=game)
        cart, _ = Cart.objects.get_or_create(user=user)
        for game in games[9:11]:
            CartItem.objects.create(cart=cart, game=game)
        self.stdout.write(
            self.style.SUCCESS(
                "Separate demo account created: "
                "5 Library games, 4 Wishlist games, 2 Cart games."
            )
        )
        self.stdout.write(
            f"Username: {DEMO_USERNAME}\nOne-time generated password: {password}"
        )
        self.stdout.write(
            "Only this new demo account was populated. "
            "No money charged; no reviews/social activity generated."
        )
