import io
import tempfile

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from chat.models import Conversation, Message
from community.models import CommunityPost, GameReview, GameReviewImage, PostComment
from games.management.commands.seed_full_demo import DEMO_PASSWORD
from games.models import DLC, Game, GameBundle
from store.models import LibraryCollection, LibraryDLCItem, LibraryItem, Order
from users.models import Notification, UserBadge, WalletTransaction


class FullDemoSeedTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable()
        self.addCleanup(setting.disable)

    def seed(self):
        output = io.StringIO()
        call_command("seed_full_demo", stdout=output)
        return output.getvalue()

    def snapshot(self):
        models = (
            get_user_model(), Game, DLC, GameBundle, Order, LibraryItem,
            LibraryDLCItem, GameReview, GameReviewImage, CommunityPost,
            PostComment, Conversation, Message, Notification, UserBadge,
            WalletTransaction,
        )
        return tuple(model.objects.count() for model in models)

    def test_full_seed_populates_every_major_area(self):
        output = self.seed()

        self.assertEqual(get_user_model().objects.count(), 5)
        self.assertEqual(Game.objects.count(), 12)
        self.assertGreaterEqual(DLC.objects.count(), 24)
        self.assertGreaterEqual(GameBundle.objects.count(), 3)
        self.assertEqual(Order.objects.count(), 20)
        self.assertEqual(LibraryItem.objects.count(), 25)
        primary = get_user_model().objects.get(username="steamnt_demo")
        self.assertTrue(
            LibraryCollection.objects.filter(user=primary, name="Demo picks").exists()
        )
        self.assertFalse(
            LibraryCollection.objects.filter(user=primary, name="Favorites").exists()
        )
        self.assertGreaterEqual(LibraryDLCItem.objects.count(), 10)
        self.assertEqual(GameReview.objects.count(), 25)
        self.assertEqual(GameReviewImage.objects.count(), 50)
        self.assertGreaterEqual(CommunityPost.objects.count(), 36)
        self.assertGreaterEqual(PostComment.objects.count(), 72)
        self.assertEqual(Conversation.objects.count(), 4)
        self.assertEqual(Message.objects.count(), 20)
        # Explicit demo notifications plus event-driven notifications from
        # comments, reactions, follows, friendships, and chat messages.
        self.assertGreaterEqual(Notification.objects.count(), 25)
        self.assertEqual(UserBadge.objects.count(), 15)
        self.assertEqual(WalletTransaction.objects.count(), 20)
        self.assertTrue(
            primary.check_password(DEMO_PASSWORD)
        )
        self.assertIn("Full Steamn’t demo dataset is ready", output)

    def test_full_seed_is_idempotent(self):
        self.seed()
        first = self.snapshot()
        self.seed()
        self.assertEqual(self.snapshot(), first)
