from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("api", "00015_enable_unaccent"),
    ]

    operations = [
        migrations.RunSQL(
            sql=r"""
            CREATE OR REPLACE FUNCTION normalize_text(text) RETURNS text AS $$
            BEGIN
                RETURN lower(
                    regexp_replace(
                        regexp_replace(
                            public.unaccent(COALESCE($1, '')),
                            '\s+',
                            ' ',
                            'g'
                        ),
                        '[^a-z0-9\s]',
                        '',
                        'g'
                    )
                );
            END;
            $$ LANGUAGE plpgsql IMMUTABLE;
            """,
            reverse_sql="DROP FUNCTION IF EXISTS normalize_text(text);",
        ),
        migrations.RunSQL(
            sql="""
            CREATE INDEX IF NOT EXISTS idx_reference_normalized_title 
            ON api_reference(normalize_text(title));
            
            CREATE INDEX IF NOT EXISTS idx_reference_normalized_authors 
            ON api_reference(normalize_text(authors));
            
            CREATE INDEX IF NOT EXISTS idx_reference_normalized_journal 
            ON api_reference(normalize_text(journal));
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_reference_normalized_title;
            DROP INDEX IF EXISTS idx_reference_normalized_authors;
            DROP INDEX IF EXISTS idx_reference_normalized_journal;
            """,
        ),
    ]
