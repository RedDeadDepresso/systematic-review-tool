from django.contrib.postgres.operations import UnaccentExtension
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0002_reference_search_vector_trigger"),
    ]

    operations = [
        UnaccentExtension(),
    ]
