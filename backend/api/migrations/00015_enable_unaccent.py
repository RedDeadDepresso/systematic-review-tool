from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0014_referenceduplicatepair_auto_resolved_and_more"),
    ]

    operations = [
        UnaccentExtension(),
    ]
