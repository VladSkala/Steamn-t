"""Fill every user-facing area with repeatable local demo data."""

import json
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.files import File
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from chat.models import Conversation, ConversationPreference, Message
from community.models import (
    CommunityPost,
    Friendship,
    GameReview,
    GameReviewImage,
    PostComment,
    PostReaction,
    UserFollow,
)
from games.management.commands.seed_store_demo import (
    DEMO_ACCOUNTS,
    DEMO_ROOT,
    Command as StoreSeedCommand,
)
from games.models import DLC, Game, GameBundle
from store.models import (
    BundlePurchase,
    Cart,
    CartDLCItem,
    CartItem,
    LibraryCollection,
    LibraryDLCItem,
    Order,
    OrderDLCItem,
    OrderItem,
)
from users.models import Notification, ProfileComment, UserBadge, UserBlock, WalletTransaction


DEMO_PASSWORD = "SteamntDemo2026!"


class Command(BaseCommand):
    help = (
        "Create a large, idempotent local demo dataset covering the catalog, DLC, "
        "bundles, accounts, store, libraries, reviews, Community, Friends, chat, "
        "profiles, notifications, badges, and wallet history."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--password",
            default=DEMO_PASSWORD,
            help=f"Password assigned to all demo accounts (default: {DEMO_PASSWORD}).",
        )

    def _accounts(self, password):
        User = get_user_model()
        users = {}
        for index, spec in enumerate(DEMO_ACCOUNTS):
            username_match = User.objects.filter(username=spec.username).first()
            email_match = User.objects.filter(email__iexact=spec.email).first()
            if username_match and email_match and username_match.pk != email_match.pk:
                raise CommandError(f"Demo identity collision for {spec.username}.")
            user = username_match or email_match
            if user and (
                user.username != spec.username
                or user.email.lower() != spec.email.lower()
            ):
                raise CommandError(
                    f"{spec.username} or {spec.email} belongs to another account."
                )
            if user is None:
                user = User(username=spec.username, email=spec.email)

            user.first_name = spec.first_name
            user.last_name = spec.last_name
            user.bio = (
                f"Demo profile for testing Steamn’t as the {spec.role} account. "
                "This account and its content may be safely recreated."
            )
            user.language = ("en", "ru", "uk", "en", "ru")[index]
            user.dark_theme = index % 2 == 0
            user.privacy_games = index != 4
            user.privacy_wishlist = index not in (2, 4)
            user.privacy_friends = index != 4
            user.privacy_activity = index != 3
            user.privacy_messages = ("everyone", "friends", "everyone", "friends", "nobody")[index]
            user.show_online = index < 3
            user.last_seen_at = timezone.now() - timedelta(minutes=index * 9)
            user.set_password(password)
            user.save()
            users[spec.role] = user
        return users

    @staticmethod
    def _seed_dlc_and_bundles(games):
        dlc = []
        for game_index, game in enumerate(games):
            offers = (
                (
                    "Original Soundtrack",
                    "A complete digital soundtrack with themes from every major area.",
                    Decimal("4.99"),
                    Decimal("1.20"),
                    True,
                ),
                (
                    "Echoes Expansion",
                    "A substantial expansion with new locations, challenges, and story content.",
                    Decimal("9.99") + Decimal(game_index % 3),
                    Decimal("8.50") + Decimal(game_index),
                    game_index % 4 != 3,
                ),
            )
            for title, description, price, size, available in offers:
                item, _ = DLC.objects.update_or_create(
                    game=game,
                    title=title,
                    defaults={
                        "description": description,
                        "price": price,
                        "cover": game.cover.name if game.cover else None,
                        "release_date": game.release_date + timedelta(days=30),
                        "is_available": available,
                        "disk_size_gb": size,
                    },
                )
                dlc.append(item)

        bundle_specs = (
            ("Indie Discovery Pack", games[:4], Decimal("39.99")),
            ("Night and Neon Collection", games[4:8], Decimal("44.99")),
            ("Complete Demo Collection", games[8:12], Decimal("49.99")),
        )
        bundles = []
        for title, bundle_games, price in bundle_specs:
            bundle, _ = GameBundle.objects.update_or_create(
                title=title,
                defaults={
                    "description": "A curated Steamn’t demo bundle with games and matching add-ons.",
                    "price": price,
                    "cover": bundle_games[0].cover.name if bundle_games[0].cover else None,
                    "is_available": True,
                },
            )
            bundle.games.set(bundle_games)
            bundle.dlc.set(
                DLC.objects.filter(game__in=bundle_games, title="Original Soundtrack")
            )
            bundles.append(bundle)
        return dlc, bundles

    @staticmethod
    def _seed_orders_and_library(users, games, dlc, bundles):
        helper = StoreSeedCommand()
        owned = {}
        for offset, spec in enumerate(DEMO_ACCOUNTS):
            user = users[spec.role]
            owned[spec.role] = helper._ensure_library(user, games, offset=offset)

            # Older demo datasets created a custom collection named exactly like
            # the built-in Favorites filter. Keep user-created collections
            # unrestricted, but give this seed-owned collection a distinct name.
            legacy_favorites = LibraryCollection.objects.filter(
                user=user, name="Favorites"
            ).first()
            if legacy_favorites and not LibraryCollection.objects.filter(
                user=user, name="Demo picks"
            ).exists():
                legacy_favorites.name = "Demo picks"
                legacy_favorites.save(update_fields=("name",))

            for name, selection in (
                ("Demo picks", owned[spec.role][:2]),
                ("Currently playing", owned[spec.role][1:4]),
                ("Completed", owned[spec.role][3:5]),
            ):
                collection, _ = LibraryCollection.objects.get_or_create(
                    user=user, name=name
                )
                collection.games.set(selection)

            for status, total in (
                (Order.Status.PENDING, Decimal("12.34") + offset),
                (Order.Status.CANCELLED, Decimal("18.40") + offset),
                (Order.Status.REFUNDED, Decimal("23.50") + offset),
            ):
                order, _ = Order.objects.get_or_create(
                    user=user, status=status, total_price=total
                )
                OrderItem.objects.get_or_create(
                    order=order,
                    game=games[(offset + 6) % len(games)],
                    defaults={"price_at_purchase": games[(offset + 6) % len(games)].price},
                )

            completed = Order.objects.filter(
                user=user, status=Order.Status.COMPLETED
            ).order_by("pk").first()
            owned_dlc = [
                item
                for item in dlc
                if item.game in owned[spec.role] and item.is_available
            ][:3]
            for item in owned_dlc:
                OrderDLCItem.objects.update_or_create(
                    order=completed,
                    dlc=item,
                    defaults={"price_at_purchase": item.price},
                )
                LibraryDLCItem.objects.update_or_create(
                    user=user,
                    dlc=item,
                    defaults={"order": completed, "price_at_purchase": item.price},
                )

            bundle = bundles[offset % len(bundles)]
            BundlePurchase.objects.update_or_create(
                order=completed,
                bundle=bundle,
                defaults={"price_at_purchase": bundle.price},
            )

            cart, _ = Cart.objects.get_or_create(user=user)
            CartDLCItem.objects.get_or_create(
                cart=cart, dlc=dlc[(offset * 2 + 1) % len(dlc)]
            )
            CartItem.objects.get_or_create(
                cart=cart, game=games[(offset + 7) % len(games)]
            )
        return owned

    @staticmethod
    def _seed_reviews(users, owned):
        reviews = []
        for user_index, spec in enumerate(DEMO_ACCOUNTS):
            user = users[spec.role]
            for game_index, game in enumerate(owned[spec.role]):
                review, _ = GameReview.objects.update_or_create(
                    user=user,
                    game=game,
                    defaults={
                        "rating": 1 + ((user_index + game_index + 2) % 5),
                        "body": (
                            f"Demo review from {user.username}. I tested the campaign, "
                            "performance, controls, and replay value for this build."
                        ),
                    },
                )
                screenshots = list(game.screenshots.all()[:2])
                for position, screenshot in enumerate(screenshots):
                    if review.images.filter(position=position).exists():
                        continue
                    image = GameReviewImage(review=review, position=position)
                    with screenshot.image.open("rb") as source:
                        image.image.save(
                            f"demo-review-{review.pk}-{position}.webp",
                            File(source),
                            save=True,
                        )
                reviews.append(review)
        return reviews

    @staticmethod
    def _seed_social(users, games):
        helper = StoreSeedCommand()
        primary = users["primary"]
        friend = users["friend"]
        incoming = users["incoming"]
        outgoing = users["outgoing"]
        available = users["available"]
        helper._ensure_relationship(
            primary, friend, requested_by=primary, status=Friendship.Status.ACCEPTED
        )
        helper._ensure_relationship(
            incoming, primary, requested_by=incoming, status=Friendship.Status.PENDING
        )
        helper._ensure_relationship(
            primary, outgoing, requested_by=primary, status=Friendship.Status.PENDING
        )
        helper._ensure_relationship(
            friend, available, requested_by=friend, status=Friendship.Status.ACCEPTED
        )

        user_list = list(users.values())
        for index, user in enumerate(user_list):
            for step in (1, 2):
                target = user_list[(index + step) % len(user_list)]
                UserFollow.objects.get_or_create(follower=user, following=target)

        templates = (
            (CommunityPost.Kind.NEWS, "Patch notes: {title}", "A new update is live with balance changes, fixes, and quality-of-life improvements."),
            (CommunityPost.Kind.GUIDE, "Starter guide for {title}", "Useful routes, settings, and early-game tips collected by the community."),
            (CommunityPost.Kind.SCREENSHOT, "A memorable view from {title}", "A full-size gallery image shared from a recent play session."),
            (CommunityPost.Kind.FORUM, "What should we try next in {title}?", "Join the discussion and share your favorite strategies and moments."),
            (CommunityPost.Kind.VIDEO, "Community showcase: {title}", "A demo video post for checking every Community content filter."),
            (CommunityPost.Kind.COMMUNITY, "Players are talking about {title}", "A general activity post used to test feeds, reactions, and comments."),
        )
        posts = []
        now = timezone.now()
        for game_index, game in enumerate(games):
            for template_index in range(3):
                kind, title, body = templates[(game_index + template_index) % len(templates)]
                author = user_list[(game_index + template_index) % len(user_list)]
                post, _ = CommunityPost.objects.update_or_create(
                    author=author,
                    game=game,
                    kind=kind,
                    title=title.format(title=game.title),
                    defaults={
                        "body": body,
                        "media_url": game.cover.url if game.cover else "",
                        "is_published": True,
                    },
                )
                CommunityPost.objects.filter(pk=post.pk).update(
                    created_at=now - timedelta(hours=game_index * 3 + template_index)
                )
                for comment_index in range(2):
                    commenter = user_list[(game_index + template_index + comment_index + 1) % len(user_list)]
                    PostComment.objects.get_or_create(
                        post=post,
                        author=commenter,
                        body=f"Demo comment {comment_index + 1}: this section is ready for interaction testing.",
                    )
                    PostReaction.objects.get_or_create(post=post, user=commenter)
                posts.append(post)
        return posts

    @staticmethod
    def _seed_profiles_and_chat(users):
        user_list = list(users.values())
        for index, user in enumerate(user_list):
            for code, name, icon, points in (
                ("early-player", "Early Player", "★", 100),
                ("reviewer", "Helpful Reviewer", "✦", 250),
                ("collector", "Game Collector", "◆", 500),
            ):
                UserBadge.objects.update_or_create(
                    user=user,
                    code=code,
                    defaults={
                        "name": name,
                        "description": f"Demo badge for the {name.lower()} milestone.",
                        "icon": icon,
                        "points": points,
                    },
                )
            ProfileComment.objects.get_or_create(
                profile=user,
                author=user_list[(index + 1) % len(user_list)],
                body="Great profile! This persistent demo comment is here for UI testing.",
            )
            for kind, amount, description in (
                ("topup", Decimal("100.00"), "Demo wallet top-up"),
                ("purchase", Decimal("-24.99"), "Demo game purchase"),
                ("refund", Decimal("9.99"), "Demo refund"),
                ("demo_payment", Decimal("-4.50"), "Demo payment method check"),
            ):
                WalletTransaction.objects.get_or_create(
                    event_key=f"full-demo:{user.username}:{kind}",
                    defaults={
                        "user": user,
                        "amount": amount,
                        "kind": kind,
                        "description": description,
                    },
                )
            for kind, title, path in (
                ("news", "A game in your library has been updated", "/community"),
                ("comment", "Someone replied to your post", "/community"),
                ("friend_request", "You have a new friend request", "/friends"),
                ("wishlist_sale", "A wishlist game is on sale", "/store/wishlist"),
                ("message", "You received a new message", "/chat"),
            ):
                Notification.objects.get_or_create(
                    user=user,
                    kind=kind,
                    title=title,
                    target_path=path,
                    defaults={"body": "Persistent notification created by seed_full_demo."},
                )

        pairs = ((0, 1), (0, 2), (1, 4), (2, 3))
        for pair_index, (first_index, second_index) in enumerate(pairs):
            low, high = sorted(
                (user_list[first_index], user_list[second_index]), key=lambda user: user.pk
            )
            conversation, _ = Conversation.objects.get_or_create(
                user_low=low, user_high=high
            )
            ConversationPreference.objects.update_or_create(
                conversation=conversation,
                user=low,
                defaults={"muted": pair_index == 3},
            )
            for message_index in range(5):
                sender = low if message_index % 2 == 0 else high
                Message.objects.get_or_create(
                    conversation=conversation,
                    sender=sender,
                    kind=Message.Kind.TEXT,
                    body=f"Demo message {message_index + 1} in conversation {pair_index + 1}.",
                    defaults={
                        "read_at": timezone.now() if message_index < 3 else None
                    },
                )

        UserBlock.objects.get_or_create(
            blocker=users["available"], blocked=users["outgoing"]
        )

    @transaction.atomic
    def handle(self, *args, **options):
        password = options["password"]
        if len(password) < 8:
            raise CommandError("The demo password must contain at least 8 characters.")

        call_command("seed_store_demo", stdout=self.stdout)
        catalog = json.loads((DEMO_ROOT / "catalog.json").read_text(encoding="utf-8"))
        games = [
            Game.objects.get(title=row["title"], developer=row["developer"])
            for row in catalog
        ]
        users = self._accounts(password)
        dlc, bundles = self._seed_dlc_and_bundles(games)
        owned = self._seed_orders_and_library(users, games, dlc, bundles)
        self._seed_reviews(users, owned)
        self._seed_social(users, games)
        self._seed_profiles_and_chat(users)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("Full Steamn’t demo dataset is ready."))
        self.stdout.write(f"Password for all demo accounts: {password}")
        for spec in DEMO_ACCOUNTS:
            self.stdout.write(f"  {spec.role:9} {spec.username} / {spec.email}")
        self.stdout.write("")
        self.stdout.write(
            "Created coverage: games, screenshots, DLC, bundles, carts, orders, "
            "libraries, wishlists, reviews with images, news and Community posts, "
            "comments, reactions, friendships, follows, profiles, badges, wallet "
            "history, notifications, blocks, and chat messages."
        )
