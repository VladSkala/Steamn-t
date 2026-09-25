import io
import tempfile

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings

from community.models import CommunityPost, Friendship, PostComment, PostReaction
from games.management.commands.seed_store_demo import DEMO_ACCOUNTS
from store.models import LibraryItem, Order


class SocialDemoSeedTests(TestCase):
    def setUp(self):
        self.media = tempfile.TemporaryDirectory()
        self.addCleanup(self.media.cleanup)
        setting = override_settings(MEDIA_ROOT=self.media.name)
        setting.enable()
        self.addCleanup(setting.disable)

    def seed(self, **options):
        output = io.StringIO()
        call_command("seed_store_demo", stdout=output, **options)
        return output.getvalue()

    def snapshot(self):
        User = get_user_model()
        return (User.objects.count(), Order.objects.count(), LibraryItem.objects.count(), Friendship.objects.count(), CommunityPost.objects.count(), PostComment.objects.count(), PostReaction.objects.count())

    def test_social_seed_creates_expected_relationships_and_database_content(self):
        output = self.seed(with_social_demo=True)
        User = get_user_model()
        users = {spec.role: User.objects.get(username=spec.username) for spec in DEMO_ACCOUNTS}
        self.assertEqual(len(users), 5)
        self.assertEqual(Friendship.objects.count(), 3)
        self.assertEqual(Friendship.objects.filter(status=Friendship.Status.ACCEPTED).count(), 1)
        self.assertEqual(Friendship.objects.filter(status=Friendship.Status.PENDING).count(), 2)
        self.assertGreaterEqual(CommunityPost.objects.count(), 5)
        self.assertGreaterEqual(PostComment.objects.count(), 3)
        self.assertGreaterEqual(PostReaction.objects.count(), 3)
        self.assertTrue(all(LibraryItem.objects.filter(user=user).count() == 5 for user in users.values()))
        self.assertIn("one-time generated password", output)
        self.assertIn("steamnt-demo-available@example.invalid", output)

    def test_social_seed_is_idempotent(self):
        self.seed(with_social_demo=True)
        first = self.snapshot()
        self.seed(with_social_demo=True)
        self.assertEqual(self.snapshot(), first)

    def test_password_reset_changes_only_exact_demo_accounts(self):
        User = get_user_model()
        real = User.objects.create_user(username="real_user", email="real@example.invalid", password="keep-me")
        self.seed(with_social_demo=True)
        before = {spec.username: User.objects.get(username=spec.username).password for spec in DEMO_ACCOUNTS}
        output = self.seed(with_social_demo=True, reset_demo_passwords=True)
        after = {spec.username: User.objects.get(username=spec.username).password for spec in DEMO_ACCOUNTS}
        real.refresh_from_db()
        self.assertTrue(real.check_password("keep-me"))
        self.assertTrue(all(before[name] != after[name] for name in before))
        self.assertIn("one-time generated password", output)
