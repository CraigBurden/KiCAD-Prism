#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path


CONFIRMATION = "RESET-KICAD-PRISM"
SCHEMAS = ("operations", "comments", "catalog", "workspace")


def _dsn() -> str:
    value = os.environ.get("PRISM_DATABASE_URL", "").strip()
    if not value:
        raise SystemExit("PRISM_DATABASE_URL is required")
    return value.replace("postgresql+psycopg://", "postgresql://", 1)


def _artifact_roots(projects_root: Path) -> list[Path]:
    state = projects_root / ".kicad-prism"
    configured = os.environ.get("CATALOG_ARTIFACT_ROOT", "").strip()
    roots = [
        Path(configured).expanduser() if configured else state / "artifacts",
        state / "components",
        state / "validation",
        state / "exports" / "kicad-dbl",
        state / "semantic-index",
        state / "semantic-visualizer",
        state / "project-properties",
    ]
    return [path.resolve() for path in roots]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Destructively reset all KiCAD Prism PostgreSQL schemas and derived state."
    )
    parser.add_argument("--confirm", required=True)
    parser.add_argument("--keep-derived-files", action="store_true")
    args = parser.parse_args()

    if os.environ.get("PRISM_ALLOW_DESTRUCTIVE_RESET", "").strip().lower() != "true":
        raise SystemExit("Set PRISM_ALLOW_DESTRUCTIVE_RESET=true to enable this command")
    if args.confirm != CONFIRMATION:
        raise SystemExit(f"Pass --confirm {CONFIRMATION} exactly")

    try:
        import psycopg
    except ImportError as exc:
        raise SystemExit("psycopg is required") from exc

    with psycopg.connect(_dsn(), autocommit=True) as connection:
        connection.execute("SELECT pg_advisory_lock(hashtext(%s))", ("prism-destructive-reset",))
        try:
            for schema in SCHEMAS:
                connection.execute(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
            for schema in reversed(SCHEMAS):
                connection.execute(f'CREATE SCHEMA "{schema}"')
        finally:
            connection.execute("SELECT pg_advisory_unlock(hashtext(%s))", ("prism-destructive-reset",))

    if not args.keep_derived_files:
        projects_root = Path(os.environ.get("KICAD_PROJECTS_ROOT", "data/projects")).expanduser().resolve()
        for path in _artifact_roots(projects_root):
            if path.exists():
                shutil.rmtree(path)

    print("KiCAD Prism PostgreSQL state reset completed. Project source checkouts were preserved.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
