from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0007_enable_extensions"),
    ]

    operations = [
        migrations.RunSQL(
            """
            CREATE OR REPLACE FUNCTION immutable_unaccent(text)
            RETURNS text
            LANGUAGE sql
            IMMUTABLE
            PARALLEL SAFE
            AS $$
                SELECT public.unaccent($1)  -- schema-qualify!
            $$;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS immutable_unaccent(text);",
        )
    ]
