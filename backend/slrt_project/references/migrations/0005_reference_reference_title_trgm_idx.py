import django.contrib.postgres.indexes
import django.db.models.functions.text
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0004_create_normalize_function"),
        ("reviews", "0001_initial"),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        CREATE INDEX IF NOT EXISTS reference_title_trgm_idx
                        ON references_reference
                        USING gin (LOWER(title) gin_trgm_ops);
                    """,
                    reverse_sql="DROP INDEX IF EXISTS reference_title_trgm_idx;",
                ),
            ],
            state_operations=[
                migrations.AddIndex(
                    model_name="reference",
                    index=django.contrib.postgres.indexes.GinIndex(
                        django.contrib.postgres.indexes.OpClass(
                            django.db.models.functions.text.Lower("title"),
                            "gin_trgm_ops",
                        ),
                        name="reference_title_trgm_idx",
                    ),
                ),
            ],
        ),
    ]
