from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.component_catalog_service_postgres import (  # noqa: E402
    _postgres_dsn,
    _split_sql_script,
    _translate_postgres_sql,
    _translate_qmark_sql,
)


class ComponentCatalogPostgresCompatibilityTests(unittest.TestCase):
    def test_qmark_translation_preserves_quoted_question_marks(self) -> None:
        sql = "SELECT '?' AS literal, \"?\" AS identifier, value FROM rows WHERE id = ? AND note = 'why?'"
        self.assertEqual(
            _translate_qmark_sql(sql),
            "SELECT '?' AS literal, \"?\" AS identifier, value FROM rows WHERE id = %s AND note = 'why?'",
        )

    def test_catalog_meta_replace_becomes_postgres_upsert(self) -> None:
        translated = _translate_postgres_sql(
            "INSERT OR REPLACE INTO catalog_meta (key, value) VALUES (?, ?)"
        )
        self.assertIn("ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", translated)
        self.assertEqual(translated.count("%s"), 2)

    def test_insert_or_ignore_becomes_conflict_safe_insert(self) -> None:
        translated = _translate_postgres_sql(
            "INSERT OR IGNORE INTO catalog_meta (key, value) VALUES (?, ?)"
        )
        self.assertIn("INSERT INTO catalog_meta", translated)
        self.assertTrue(translated.endswith("ON CONFLICT DO NOTHING"))

    def test_script_split_respects_semicolons_inside_strings(self) -> None:
        self.assertEqual(
            _split_sql_script("CREATE TABLE one (value TEXT DEFAULT ';'); CREATE TABLE two (id TEXT);"),
            ["CREATE TABLE one (value TEXT DEFAULT ';')", "CREATE TABLE two (id TEXT)"],
        )

    def test_sqlalchemy_style_psycopg_url_is_normalized(self) -> None:
        self.assertEqual(
            _postgres_dsn("postgresql+psycopg://user:pass@db/prism"),
            "postgresql://user:pass@db/prism",
        )


if __name__ == "__main__":
    unittest.main()
