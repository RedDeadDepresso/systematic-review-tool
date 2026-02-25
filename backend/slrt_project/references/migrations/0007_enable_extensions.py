from django.contrib.postgres.operations import TrigramExtension, UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0006_label_hotkey"),
    ]

    operations = [
        TrigramExtension(),
        UnaccentExtension(),
    ]
