from datetime import date

from django.contrib import admin
from django.test import SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from games.admin import GameAdmin, GameScreenshotInline
from games.models import Game, GameScreenshot, Genre
from games.serializers import GameScreenshotSerializer


class GameScreenshotModelTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.game = Game.objects.create(
            title="Screenshot model",
            description="Screenshot model contract.",
            price="9.99",
            developer="Gallery Studio",
            release_date=date(2026, 9, 10),
        )

    def test_default_position_and_deterministic_model_ordering(self):
        first = GameScreenshot.objects.create(
            game=self.game,
            image="games/screenshots/first.webp",
        )
        tied = GameScreenshot.objects.create(
            game=self.game,
            image="games/screenshots/tied.webp",
            position=0,
        )
        last = GameScreenshot.objects.create(
            game=self.game,
            image="games/screenshots/last.webp",
            position=2,
        )

        self.assertEqual(first.position, 0)
        self.assertEqual(GameScreenshot._meta.ordering, ["position", "pk"])
        self.assertEqual(
            list(self.game.screenshots.values_list("pk", flat=True)),
            [first.pk, tied.pk, last.pk],
        )

    def test_deleting_game_cascades_to_screenshots(self):
        screenshot = GameScreenshot.objects.create(
            game=self.game,
            image="games/screenshots/cascade.webp",
        )

        self.game.delete()

        self.assertFalse(GameScreenshot.objects.filter(pk=screenshot.pk).exists())

    def test_string_representation_uses_caption_or_ordered_fallback(self):
        captioned = GameScreenshot(
            game=self.game,
            image="games/screenshots/captioned.webp",
            caption="Boss encounter",
        )
        fallback = GameScreenshot(
            game=self.game,
            image="games/screenshots/fallback.webp",
            position=2,
        )

        self.assertEqual(str(captioned), "Boss encounter")
        self.assertEqual(str(fallback), "Screenshot model — image 3")


class GameScreenshotAdminTests(SimpleTestCase):
    def test_game_admin_exposes_an_ordered_screenshot_inline(self):
        game_admin = GameAdmin(Game, admin.site)

        self.assertEqual(game_admin.inlines, (GameScreenshotInline,))
        self.assertEqual(
            GameScreenshotInline.fields,
            ("image", "caption", "position"),
        )
        self.assertEqual(GameScreenshotInline.extra, 0)
        self.assertEqual(GameScreenshotInline.ordering, ("position", "pk"))


@override_settings(MEDIA_URL="/media/")
class GameScreenshotSerializerTests(TestCase):
    def test_serializer_returns_relative_media_url_without_request_context(self):
        game = Game.objects.create(
            title="Serializer screenshot",
            description="Serializer contract.",
            price="3.50",
            developer="Gallery Studio",
            release_date=date(2026, 9, 10),
        )
        screenshot = GameScreenshot.objects.create(
            game=game,
            image="games/screenshots/serializer.webp",
            caption="Serializer image",
            position=1,
        )

        self.assertEqual(
            GameScreenshotSerializer(screenshot).data,
            {
                "id": screenshot.pk,
                "image": "/media/games/screenshots/serializer.webp",
                "caption": "Serializer image",
                "position": 1,
            },
        )


@override_settings(MEDIA_URL="/media/")
class GameScreenshotDetailAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.genre = Genre.objects.create(name="Screenshot Adventure")
        cls.game = Game.objects.create(
            title="API screenshot game",
            description="Public screenshot API contract.",
            price="14.25",
            developer="Gallery Studio",
            release_date=date(2026, 9, 10),
        )
        cls.game.genres.add(cls.genre)
        cls.other_game = Game.objects.create(
            title="Other screenshot game",
            description="Must not leak artwork.",
            price="7.00",
            developer="Other Studio",
            release_date=date(2026, 9, 9),
        )
        cls.url = reverse("games:game-detail", kwargs={"pk": cls.game.pk})

    def create_screenshot(
        self,
        *,
        game=None,
        filename="image.webp",
        caption="Screenshot",
        position=0,
    ):
        return GameScreenshot.objects.create(
            game=game or self.game,
            image=f"games/screenshots/{filename}",
            caption=caption,
            position=position,
        )

    def test_detail_returns_public_ordered_absolute_screenshot_contract(self):
        late = self.create_screenshot(
            filename="late.webp",
            caption="Late",
            position=2,
        )
        first = self.create_screenshot(
            filename="first.webp",
            caption="First",
            position=0,
        )
        tied = self.create_screenshot(
            filename="tied.webp",
            caption="Tied",
            position=0,
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["screenshots"]],
            [first.pk, tied.pk, late.pk],
        )
        self.assertEqual(
            response.data["screenshots"][0],
            {
                "id": first.pk,
                "image": "http://testserver/media/games/screenshots/first.webp",
                "caption": "First",
                "position": 0,
            },
        )

    def test_empty_gallery_does_not_leak_another_games_artwork(self):
        self.create_screenshot(
            game=self.other_game,
            filename="other.webp",
            caption="Other",
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["screenshots"], [])

    def test_detail_prefetches_screenshots_without_n_plus_one_queries(self):
        for index in range(4):
            self.create_screenshot(
                filename=f"prefetch-{index}.webp",
                caption=f"Prefetch {index}",
                position=index,
            )

        with self.assertNumQueries(3):
            response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["screenshots"]), 4)

    def test_detail_keeps_screenshots_read_only(self):
        self.assertEqual(self.client.head(self.url).status_code, status.HTTP_200_OK)
        self.assertEqual(self.client.options(self.url).status_code, status.HTTP_200_OK)

        for method_name in ("post", "put", "patch", "delete"):
            with self.subTest(method=method_name):
                method = getattr(self.client, method_name)
                response = method(self.url, {"screenshots": []}, format="json")

                self.assertEqual(
                    response.status_code,
                    status.HTTP_405_METHOD_NOT_ALLOWED,
                )
