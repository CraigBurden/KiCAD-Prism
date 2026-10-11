from __future__ import annotations

import sys
import unittest
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.catalog.postgres_runtime import (  # noqa: E402
    postgres_dsn,
    split_sql_script,
)


class ComponentCatalogPostgresPrimitiveTests(unittest.TestCase):
    def test_script_split_respects_semicolons_inside_strings(self) -> None:
        self.assertEqual(
            split_sql_script("CREATE TABLE one (value TEXT DEFAULT ';'); CREATE TABLE two (id TEXT);"),
            ["CREATE TABLE one (value TEXT DEFAULT ';')", "CREATE TABLE two (id TEXT)"],
        )

    def test_sqlalchemy_style_psycopg_url_is_normalized(self) -> None:
        self.assertEqual(
            postgres_dsn("postgresql+psycopg://user:pass@db/prism"),
            "postgresql://user:pass@db/prism",
        )


if __name__ == "__main__":
    unittest.main()
