from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("community", "0002_gamereviewimage")]

    operations = [
        migrations.AddConstraint(
            model_name="gamereview",
            constraint=models.CheckConstraint(
                condition=models.Q(rating__gte=1, rating__lte=5),
                name="review_rating_between_1_and_5",
            ),
        ),
        migrations.AddIndex(
            model_name="gamereview",
            index=models.Index(
                fields=["game", "-updated_at", "-id"],
                name="review_game_updated_idx",
            ),
        ),
    ]
