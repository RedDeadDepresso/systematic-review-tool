from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("references", "0003_enable_unaccent"),
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
            ON references_reference(normalize_text(title));
            
            CREATE INDEX IF NOT EXISTS idx_reference_normalized_authors 
            ON references_reference(normalize_text(authors));
            
            CREATE INDEX IF NOT EXISTS idx_reference_normalized_journal 
            ON references_reference(normalize_text(journal));
            """,
            reverse_sql="""
            DROP INDEX IF EXISTS idx_reference_normalized_title;
            DROP INDEX IF EXISTS idx_reference_normalized_authors;
            DROP INDEX IF EXISTS idx_reference_normalized_journal;
            """,
        ),
    ]
