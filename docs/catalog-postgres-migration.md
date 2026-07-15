# Component catalog SQLite → PostgreSQL migration (historical)

> **Status:** Complete and retired. Prism runtime state no longer uses SQLite.
> Authoritative persistence is documented in
> [`postgres-ecad-extension-refactor.md`](./postgres-ecad-extension-refactor.md).

The one-shot `scripts/migrate_catalog_sqlite_to_postgres.py` helper and Compose
`catalog-migrate` service were removed after the native multi-schema reset
(`workspace`, `comments`, `catalog`, `operations`).

## What remains SQLite-related (intentional)

1. **KiCad DBL export** — `export_kicad_dbl_bundle()` writes a disposable
   `exports/kicad-dbl/Prism.sqlite` for KiCad ODBC consumers.
2. **External library import source** — `scripts/import_database_library.py`
   can still *read* CERN-style SQLite databases, but writes into PostgreSQL
   `catalog.*` only.

## Deprecated assets that should not exist on a cleaned host

- `data/projects/.kicad-prism/prism.sqlite3` (+ `-wal` / `-shm`)
- `data/projects/.kicad-prism/comments.sqlite3`
- Pre-reset backups under `data/projects/.kicad-prism/backups/`
- Orphan pre-reset tables in Postgres schema `public` (live data is in
  `catalog` / `workspace` / `comments` / `operations`)

Use `scripts/reset_prism_postgres.py` for a destructive schema reset, or drop
orphan `public` catalog tables after confirming `catalog.components` is healthy.
