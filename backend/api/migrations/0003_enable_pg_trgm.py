from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0002_remove_code_background_color_remove_code_color_and_more"),
    ]

    operations = [
        migrations.RunSQL(
            sql="CREATE EXTENSION IF NOT EXISTS pg_trgm;",
            reverse_sql="DROP EXTENSION IF EXISTS pg_trgm;",
        ),
    ]
