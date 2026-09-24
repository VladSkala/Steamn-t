from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0004_notification"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="language",
            field=models.CharField(
                choices=[
                    ("en", "English"),
                    ("ru", "Русский"),
                    ("uk", "Українська"),
                ],
                default="en",
                max_length=5,
            ),
        ),
    ]
