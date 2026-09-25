from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("games", "0003_gamescreenshot"),
    ]

    operations = [
        migrations.AddField(
            model_name="game",
            name="is_featured",
            field=models.BooleanField(
                db_index=True,
                default=False,
                help_text="Show this game in the limited featured games selection.",
            ),
        ),
    ]
