# Component catalog SQLite to PostgreSQL migration

Run the catalog migration once after the PostgreSQL service is reachable and the
shared component asset store is mounted at the same canonical paths used by the
legacy backend:

```bash
backend/venv/bin/python scripts/migrate_catalog_sqlite_to_postgres.py \
  --sqlite /app/projects/.kicad-prism/prism.sqlite3 \
  --database-url "$CATALOG_DATABASE_URL" \
  --report /app/projects/.kicad-prism/catalog-migration-report.json
```

Stop the legacy backend and every other writer to `prism.sqlite3` before running
the command, and keep them stopped until it finishes. The migration takes a
point-in-time backup, then re-fingerprints and re-stats the live database and WAL
immediately before the PostgreSQL commit. If either changed, it rolls back and
requires a retry. This fence detects accidental writes; it is not a replacement
for a read-only cutover window.

The bundled Compose stack runs this as the one-shot `catalog-migrate` service
before the API may start. Its durable report is written to
`/app/projects/.kicad-prism/catalog-postgres-migration-report.json`. A failed
migration or verification keeps the backend stopped instead of serving an empty
or partial catalog.

The command creates a consistent SQLite snapshot with the backup API, initializes
the target schema through `ComponentCatalogPostgresService`, copies every catalog
row with its original identity, and verifies primary keys, common-column row
counts, deterministic hashes, and each file-backed asset's SHA-256. The target
migration marker is committed only after every check succeeds.

The migration is deliberately lossless. If SQLite contains a catalog column
that is absent from PostgreSQL, the command fails and names the omitted
table/columns. This protects legacy PLM synchronization payloads and future
extension fields from silent data loss.

After the exact source-row verification, the command adds deterministic release
evidence for older released components that predate structured release records.
Those records use UUIDv5 identities, retain the revision manifest and legacy
timestamp, and are reported separately from copied rows. The preview tree is
inventoried and preserved in place—including files not indexed by a preview row.
Ready indexed previews must still exist. Use `--preview-root` only when the tree
cannot be inferred from the indexed paths or conventional component store.

Legacy preview rows are frozen during cutover and backfilled into append-only
`asset_preview_versions` plus immutable `revision_previews` evidence links.
Existing `prism.revision_manifest_a0`/`a1` hashes remain unchanged. New revisions
use `prism.revision_manifest_a2`: previews are derived automatically from the
revision's symbol and footprint assets and linked through
`revision_preview_outputs`, but are intentionally excluded from component version
identity. Manual preview regeneration therefore never creates a component
revision or changes its manifest hash. The migration report records and verifies
legacy synthesized preview versions separately.

The destination must be empty. A repeat invocation is accepted when its verified
marker matches the same logical SQLite snapshot. For deployment startup scripts,
use `--if-needed`. Once PostgreSQL is authoritative, catalog heads, workflow
state, previews, usage, OAuth records, and audit anchors legitimately evolve, so
a matching verified marker—not byte equality with the frozen SQLite rows—is the
repeat-start proof. The source fingerprint and shared asset store are still
checked before returning `already_migrated`:

```bash
backend/venv/bin/python scripts/migrate_catalog_sqlite_to_postgres.py --if-needed
```

`--allow-nonempty` is an explicit recovery/merge escape hatch. It never overwrites
conflicting rows: inserts use `ON CONFLICT DO NOTHING`, after which hash
verification fails if a shared primary key has different data. Review and retain
the JSON report as release evidence.

On a brand-new installation, empty initialization requires both `--if-needed` and
the explicit `--initialize-empty` opt-in. It succeeds only when PostgreSQL has no
catalog rows and Prism finds no legacy component files, SQLite WAL, or catalog
backup. The bundled Compose service supplies this guarded opt-in so zero-data new
installs continue to start normally. An absent source without the opt-in, an
unmarked non-empty target, or any legacy evidence fails closed.

If a verified migration marker already exists, the legacy SQLite source may be
removed from the catalog migration path; `--if-needed` reports
`already_migrated_without_source`. The state database configured by
`PRISM_STATE_SQLITE_PATH` must still be retained when it also stores project and
workspace state.
