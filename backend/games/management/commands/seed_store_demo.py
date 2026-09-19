"""Seed the offline catalog and optional isolated QA accounts."""

import json
import secrets
from dataclasses import dataclass
from datetime import timedelta
from decimal import Decimal
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from community.models import (
    CommunityPost,
    Friendship,
    GameReview,
    GameWishlist,
    PostComment,
    PostReaction,
)
from games.models import Game, GameScreenshot, Genre
from store.models import Cart, CartItem, LibraryCollection, LibraryItem, Order, OrderItem

DEMO_ROOT = Path(__file__).resolve().parents[2] / "demo"
DEMO_USERNAME = "steamnt_demo"
DEMO_EMAIL = "steamnt-demo@example.invalid"
DEMO_FEATURED_GAME_COUNT = 6
DEMO_SCREENSHOT_COUNT = 3
MINIMUM_DEMO_GAME_COUNT = 10
MINIMUM_DEMO_GENRE_COUNT = 5


@dataclass(frozen=True)
class DemoAccount:
    role: str
    username: str
    email: str
    first_name: str
    last_name: str
    expected_relationship: str


DEMO_ACCOUNTS = (
    DemoAccount(
        "primary",
        DEMO_USERNAME,
        DEMO_EMAIL,
        "Avery",
        "Demo",
        "start here; one friend, one incoming and one outgoing request",
    ),
    DemoAccount(
        "friend",
        "steamnt_demo_friend",
        "steamnt-demo-friend@example.invalid",
        "Morgan",
        "Friend",
        f"accepted friend of {DEMO_USERNAME}",
    ),
    DemoAccount(
        "incoming",
        "steamnt_demo_incoming",
        "steamnt-demo-incoming@example.invalid",
        "Riley",
        "Incoming",
        f"sent a pending request to {DEMO_USERNAME}",
    ),
    DemoAccount(
        "outgoing",
        "steamnt_demo_outgoing",
        "steamnt-demo-outgoing@example.invalid",
        "Jordan",
        "Outgoing",
        f"has a pending request from {DEMO_USERNAME}",
    ),
    DemoAccount(
        "available",
        "steamnt_demo_available",
        "steamnt-demo-available@example.invalid",
        "Casey",
        "Available",
        "no relationship; available for a new request",
    ),
)


class Command(BaseCommand):
    help = (
        "Seed fictional games, genres, featured artwork and screenshots; "
        "optionally create isolated demo or social-QA accounts."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--with-demo-user",
            action="store_true",
            help="Create or synchronize the isolated steamnt_demo account.",
        )
        parser.add_argument(
            "--with-social-demo",
            action="store_true",
            help=(
                "Create five namespaced QA accounts with persistent library, "
                "Community, and Friends states."
            ),
        )
        parser.add_argument(
            "--reset-demo-passwords",
            action="store_true",
            help=(
                "Generate new passwords only for the selected, exact "
                "steamnt demo accounts. Use with a demo-account flag."
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
                raise CommandError(
                    f"Demo catalog row is missing: {', '.join(sorted(missing_keys))}"
                )
            identity = (row["title"], row["developer"])
            if identity in identities:
                raise CommandError(f"Duplicate demo game: {row['title']}")
            if row["slug"] in slugs:
                raise CommandError(f"Duplicate demo slug: {row['slug']}")
            identities.add(identity)
            slugs.add(row["slug"])
            genre_names.update(row["genres"])
            for filename in ["cover.webp"] + [
                f"scene-{position + 1}.webp"
                for position in range(DEMO_SCREENSHOT_COUNT)
            ]:
                asset = DEMO_ROOT / "assets" / row["slug"] / filename
                if not asset.is_file():
                    raise CommandError(f"Missing demo asset: {row['slug']}/{filename}")
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

    def _seed_catalog(self):
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
                # Preserve project-owner edits to existing catalog records. The
                # seed only maintains the documented featured selection.
                game.is_featured = is_featured
                game.save(update_fields=("is_featured", "updated_at"))
                synchronized_count += 1
            games.append(game)
        self.stdout.write(
            self.style.SUCCESS(
                "Demo catalog ready: "
                f"{created_count} new games; "
                f"{sum(game.is_featured for game in games)} featured; "
                f"{synchronized_count} records synchronized."
            )
        )
        return games

    @staticmethod
    def _safe_demo_user(spec, *, reset_password):
        User = get_user_model()
        username_match = User.objects.filter(username=spec.username).first()
        email_match = User.objects.filter(email__iexact=spec.email).first()
        if username_match and email_match and username_match.pk != email_match.pk:
            raise CommandError(
                f"Demo identity collision for {spec.username}; no account was changed."
            )
        user = username_match or email_match
        generated_password = None
        if user:
            if user.username != spec.username or user.email.lower() != spec.email.lower():
                raise CommandError(
                    f"Demo identity collision for {spec.username}; no account was changed."
                )
            changed_fields = []
            for field in ("first_name", "last_name"):
                value = getattr(spec, field)
                if getattr(user, field) != value:
                    setattr(user, field, value)
                    changed_fields.append(field)
            if reset_password:
                generated_password = secrets.token_urlsafe(18)
                user.set_password(generated_password)
                changed_fields.append("password")
            if changed_fields:
                user.save(update_fields=(*changed_fields,))
            return user, generated_password, False

        generated_password = secrets.token_urlsafe(18)
        user = User.objects.create_user(
            username=spec.username,
            email=spec.email,
            first_name=spec.first_name,
            last_name=spec.last_name,
            password=generated_password,
        )
        return user, generated_password, True

    @staticmethod
    def _ensure_library(user, games, *, offset=0):
        owned = [games[(offset + index) % len(games)] for index in range(5)]
        order = (
            Order.objects.filter(user=user, status=Order.Status.COMPLETED)
            .order_by("pk")
            .first()
        )
        total = sum((Decimal(game.price) for game in owned), Decimal("0.00"))
        if order is None:
            order = Order.objects.create(
                user=user,
                status=Order.Status.COMPLETED,
                total_price=total,
            )
        elif order.total_price != total:
            order.total_price = total
            order.save(update_fields=("total_price", "updated_at"))
        for index, game in enumerate(owned):
            OrderItem.objects.update_or_create(
                order=order,
                game=game,
                defaults={"price_at_purchase": game.price},
            )
            LibraryItem.objects.update_or_create(
                user=user,
                game=game,
                defaults={
                    "order": order,
                    "price_at_purchase": game.price,
                    "is_favorite": index < 2,
                },
            )
            GameWishlist.objects.filter(user=user, game=game).delete()
        collection, _created = LibraryCollection.objects.get_or_create(
            user=user,
            name="Weekend picks",
        )
        collection.games.set(owned[:3])
        for index in range(5, 9):
            game = games[(offset + index) % len(games)]
            if game not in owned:
                GameWishlist.objects.get_or_create(user=user, game=game)
        cart, _created = Cart.objects.get_or_create(user=user)
        for index in range(9, 11):
            cart_game = games[(offset + index) % len(games)]
            if cart_game not in owned:
                CartItem.objects.get_or_create(cart=cart, game=cart_game)
        return owned

    @staticmethod
    def _ensure_relationship(first, second, *, requested_by, status):
        low, high = sorted((first, second), key=lambda user: user.pk)
        relationship, _created = Friendship.objects.update_or_create(
            user_low=low,
            user_high=high,
            defaults={
                "requested_by": requested_by,
                "status": status,
                "responded_at": (
                    timezone.now() if status == Friendship.Status.ACCEPTED else None
                ),
            },
        )
        return relationship

    def _seed_social_content(self, users_by_role, games):
        owned_by_role = {}
        for offset, spec in enumerate(DEMO_ACCOUNTS):
            user = users_by_role[spec.role]
            owned = self._ensure_library(user, games, offset=offset)
            owned_by_role[spec.role] = owned
            GameReview.objects.update_or_create(
                user=user,
                game=owned[0],
                defaults={
                    "rating": 3 + (offset % 3),
                    "body": (
                        f"QA review by {user.username}: persistent content for "
                        "Community and profile verification."
                    ),
                },
            )

        primary = users_by_role["primary"]
        friend = users_by_role["friend"]
        incoming = users_by_role["incoming"]
        outgoing = users_by_role["outgoing"]
        self._ensure_relationship(
            primary,
            friend,
            requested_by=primary,
            status=Friendship.Status.ACCEPTED,
        )
        self._ensure_relationship(
            incoming,
            primary,
            requested_by=incoming,
            status=Friendship.Status.PENDING,
        )
        self._ensure_relationship(
            primary,
            outgoing,
            requested_by=primary,
            status=Friendship.Status.PENDING,
        )

        now = timezone.now()
        posts = []
        kinds = (
            CommunityPost.Kind.COMMUNITY,
            CommunityPost.Kind.GUIDE,
            CommunityPost.Kind.SCREENSHOT,
            CommunityPost.Kind.FORUM,
            CommunityPost.Kind.COMMUNITY,
        )
        for index, spec in enumerate(DEMO_ACCOUNTS):
            user = users_by_role[spec.role]
            game = owned_by_role[spec.role][0]
            post, _created = CommunityPost.objects.update_or_create(
                author=user,
                title=f"QA {spec.role}: {game.title}",
                defaults={
                    "game": game,
                    "kind": kinds[index],
                    "body": (
                        f"Persistent database-backed {spec.role} post for testing "
                        "feeds, filters, comments, reactions, and permissions."
                    ),
                    "media_url": "",
                    "is_published": True,
                },
            )
            CommunityPost.objects.filter(pk=post.pk).update(
                created_at=now - timedelta(hours=index + 1)
            )
            posts.append(post)

        comments = (
            (posts[0], friend, "Friend response stored in the database."),
            (posts[1], primary, "Primary demo user joined this discussion."),
            (posts[2], users_by_role["available"], "A separate QA account comment."),
        )
        for index, (post, author, body) in enumerate(comments):
            comment, _created = PostComment.objects.get_or_create(
                post=post,
                author=author,
                body=body,
            )
            PostComment.objects.filter(pk=comment.pk).update(
                created_at=now - timedelta(minutes=30 - index)
            )
        PostReaction.objects.get_or_create(post=posts[0], user=friend)
        PostReaction.objects.get_or_create(post=posts[0], user=incoming)
        PostReaction.objects.get_or_create(post=posts[1], user=primary)

    def _write_credentials(self, account_rows):
        self.stdout.write("")
        self.stdout.write(
            "role | username/email | one-time generated password | expected relationship"
        )
        self.stdout.write("-" * 118)
        needs_reset = False
        for spec, _user, password, created in account_rows:
            if password:
                password_display = password
            else:
                password_display = "unchanged (not recoverable)"
                needs_reset = True
            marker = "new" if created else "existing"
            self.stdout.write(
                f"{spec.role} | {spec.username} / {spec.email} | "
                f"{password_display} | {spec.expected_relationship} [{marker}]"
            )
        self.stdout.write("")
        self.stdout.write(
            "Generated values above are one-time QA credentials; they were not written "
            "to the repository or a credentials file."
        )
        if needs_reset:
            self.stdout.write(
                "Existing demo passwords were not changed. To generate visible new "
                "credentials run: python manage.py seed_store_demo "
                "--with-social-demo --reset-demo-passwords"
            )

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset_demo_passwords"] and not (
            options["with_demo_user"] or options["with_social_demo"]
        ):
            raise CommandError(
                "--reset-demo-passwords requires --with-demo-user or --with-social-demo."
            )

        games = self._seed_catalog()
        from games.models import DLC, GameBundle
        # Stable, idempotent offers for the existing fictional catalog.
        catalog = list(Game.objects.filter(title__in=["Aether Drift", "Afterlight", "Cinderbound"]).order_by("pk"))
        for game in catalog:
            DLC.objects.get_or_create(game=game, title=f"{game.title}: Beyond the Horizon", defaults={"description": f"Explore a new chapter of {game.title} with additional environments and challenges.", "price": Decimal("6.99"), "release_date": game.release_date, "cover": game.cover.name})
        if len(catalog) >= 2:
            bundle, created = GameBundle.objects.get_or_create(title="Worlds to Discover", defaults={"description": "Two adventures and an expansion, brought together in one collection.", "price": Decimal("34.99"), "cover": catalog[0].cover.name})
            if created:
                bundle.games.set(catalog[:2])
                bundle.dlc.set(DLC.objects.filter(game=catalog[0], title=f"{catalog[0].title}: Beyond the Horizon"))
        if not options["with_demo_user"] and not options["with_social_demo"]:
            self.stdout.write(
                "No accounts, purchases, Wishlist items, Cart items, or social data "
                "were changed."
            )
            return

        selected_specs = DEMO_ACCOUNTS if options["with_social_demo"] else DEMO_ACCOUNTS[:1]
        if not options["with_social_demo"]:
            User = get_user_model()
            existing = User.objects.filter(username=DEMO_USERNAME).first()
            if existing and existing.email.lower() != DEMO_EMAIL.lower():
                self.stdout.write(
                    self.style.WARNING(
                        "Skipped optional demo account because steamnt_demo already "
                        "belongs to another email; no account data was changed."
                    )
                )
                return
        account_rows = []
        users_by_role = {}
        for spec in selected_specs:
            user, password, created = self._safe_demo_user(
                spec,
                reset_password=options["reset_demo_passwords"],
            )
            users_by_role[spec.role] = user
            account_rows.append((spec, user, password, created))

        if options["with_social_demo"]:
            self._seed_social_content(users_by_role, games)
            self.stdout.write(
                self.style.SUCCESS(
                    "Social QA state ready: 5 users, accepted/incoming/outgoing "
                    "friend states, libraries, reviews, posts, comments, and reactions."
                )
            )
        else:
            self._ensure_library(users_by_role["primary"], games)
            self.stdout.write(
                self.style.SUCCESS(
                    "Isolated demo account ready: 5 Library games, Wishlist items, "
                    "a collection, and a Cart item."
                )
            )
            self.stdout.write("No Community or Friends records were created by this flag.")

        self._write_credentials(account_rows)
