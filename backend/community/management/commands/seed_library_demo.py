from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from community.models import CommunityPost
from games.models import Game


class Command(BaseCommand):
    help = "Create idempotent API-backed demo posts for existing games."

    def handle(self, *args, **options):
        user = get_user_model().objects.order_by("pk").first()
        games = list(Game.objects.order_by("pk")[:6])
        if user is None or not games:
            raise CommandError("Create at least one user and one game first.")

        created = 0
        templates = (
            (CommunityPost.Kind.NEWS, "New update for {title}", "Read the latest developer update and patch notes."),
            (CommunityPost.Kind.COMMUNITY, "Community spotlight: {title}", "Players are sharing new highlights and discoveries."),
            (CommunityPost.Kind.GUIDE, "Getting started with {title}", "A practical guide created for the Steamnt community."),
        )
        for game in games:
            for kind, title, body in templates:
                _, was_created = CommunityPost.objects.get_or_create(
                    author=user,
                    game=game,
                    kind=kind,
                    title=title.format(title=game.title),
                    defaults={"body": body, "media_url": game.hero_image_url or str(game.cover or "")},
                )
                created += int(was_created)
        self.stdout.write(self.style.SUCCESS(f"Library demo ready: {created} posts created."))
