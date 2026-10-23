# Operations

This runbook covers backup, restore, upgrades, rollback, capacity, and diagnosis
for a shared KiCAD Prism installation.

Run commands from the active deployment directory containing `compose.yml` and
`.env`. Source-built installations use `docker-compose.yml` instead.

These procedures describe PostgreSQL-backed V3 installations. They do not
convert a V2 alpha SQLite data directory into V3; use a fresh V3 data location
and the release-specific re-import steps for that transition.

For an upgrade, follow [Upgrades and backups](UPGRADES.md) instead of assembling
the steps below by hand. It wraps the backup, the archive check and the schema
ladder into one ordered procedure, and `scripts/prism_backup.py` captures the
database and the component assets as a single consistent set — which the manual
`pg_dump` here does not. The sections below remain the reference for the
individual pieces, and for anything the tool does not cover.

## Record the deployed state

For a release-bundle installation:

```bash
cat VERSION
grep '^PRISM_.*_IMAGE=' .env
docker compose images
```

For a source-built legacy installation:

```bash
git rev-parse HEAD
docker compose images
```

Keep this record with every backup.

## What must be backed up

A recoverable backup contains one consistent set of:

1. the `prism-postgres-data` PostgreSQL volume;
2. the directory the backend mounts at `/app/projects` (`data/projects` by
   default);
3. the directory the backend mounts at `/root/.ssh` (`data/ssh` by default);
4. the deployed `.env`;
5. the release bundle or source revision record.

`scripts/prism_backup.py` reads the two directories from the selected Compose
configuration and records them in the archive manifest, so an overlay that
moves storage is archived from where it actually lives. Only bind mounts inside
the deployment directory are supported, and the two directories must be
separate: a named volume, a mount elsewhere, the deployment directory itself,
or one directory nested inside the other stops the backup (and a restore,
before anything is touched) instead of archiving the default path.

PostgreSQL alone cannot restore component assets or imported repositories.
Project storage alone cannot restore users, roles, comments, catalog metadata,
jobs, audit records, or sessions.

## Logical backup

Choose a maintenance window or otherwise ensure the database dump and filesystem
archive represent a known point in time.

Create a PostgreSQL custom-format dump:

```bash
docker compose exec -T postgres \
  pg_dump -U kicad_prism -d kicad_prism -Fc \
  > prism-postgres.dump
```

Substitute the configured PostgreSQL user and database when they differ from
the defaults.

Archive persistent files:

```bash
tar -C data -czf prism-files.tar.gz projects ssh
```

Store the dump, file archive, `.env`, release bundle, version record, and
checksums away from the Prism host. Encrypt the backup because it can contain
source repositories, component assets, tokens, and SSH private keys.

## Restore test

Test restores on an isolated AMD64 host:

1. install the recorded release bundle;
2. restore `.env` without exposing the test host;
3. restore `data/projects` and `data/ssh`;
4. start PostgreSQL only;
5. restore the database;
6. start the remaining services;
7. verify login, a project, comments, comparison, Library Manager, and Remote
   Symbol placement.

Example database restore into a fresh configured database:

```bash
docker compose up -d postgres
docker compose exec -T postgres \
  pg_restore -U kicad_prism -d kicad_prism --clean --if-exists --single-transaction \
  < prism-postgres.dump
```

Run `--clean` only against the isolated restore target; it replaces objects in
that database. Keep `--single-transaction`: without it `pg_restore` continues
past a failed object and leaves a database that is neither the old one nor the
archive's, whereas with it the first error rolls the whole restore back.

## Tracker credential custody, rotation, and restore

Encrypted connector PEMs, webhook secrets, OAuth client secrets, and user token
envelopes live in PostgreSQL. The wrapping root keys
(`TRACKER_CREDENTIAL_ROOT_KEY` and optional
`TRACKER_CREDENTIAL_PREVIOUS_ROOT_KEY`) live only in `.env` on `backend` and
`prism-worker`. Never put plaintext root keys into the database, into
`manifest.json`, or into an unencrypted off-host archive.

`scripts/prism_backup.py` records whether those keys were configured and which
key ids were active. It does not write key material into the manifest. The
archive's `env` member still carries the deployment `.env`; encrypt that archive
and restrict who can read it.

### Root key rotation

1. Generate a new 32-byte key and choose a new `TRACKER_CREDENTIAL_ROOT_KEY_ID`
   (for example `v2`).
2. Move the current key and id to `TRACKER_CREDENTIAL_PREVIOUS_*`.
3. Set the new values on `TRACKER_CREDENTIAL_ROOT_KEY` and
   `TRACKER_CREDENTIAL_ROOT_KEY_ID` on both `backend` and `prism-worker`.
4. Restart both services, re-wrap or re-save connectors so envelopes use the new
   id, then clear `TRACKER_CREDENTIAL_PREVIOUS_*` and restart again.

Rotation and backup tests must cover both previous and current key ids. Do not
reset production databases to force a key change.

### After restoring a backup

1. Restore the matching `.env` (or reinstate the same root key and id, plus any
   grace previous key) before starting workers that decrypt credentials.
2. Start PostgreSQL and restore the dump; ciphertext rows stay intact even when
   the root key is wrong or missing.
3. `prism_backup.py restore` sets every connector `paused=TRUE` with
   `paused_reason='restored'`. Leave them paused until **Test connection**
   succeeds and connector health is ready on both services; then clear the
   pause deliberately.
4. Resume carefully: `pending` ops execute once; `sent` / `recovering` /
   `quarantine` ops claim as recovery and must not blind-create remote issues.
5. Confirm webhook `remote_deliveries` and pending `remote_hints` survived; a
   replayed delivery id remains idempotent.
6. Verify local comments and revisions are readable even when credentials are
   locked — wrong or missing keys pause tracker APIs with `503`, they do not
   discard envelopes.

`prism_backup.py restore` warns when archive key-id custody does not match the
live `.env`, then proceeds so ciphertext is preserved. Fix custody before
resuming promotion. See [Tracker integration](TRACKER_INTEGRATION.md) for the
full rotation and troubleshooting matrix.

## Upgrade a release bundle

Release bundles use relative `data/` bind mounts and a stable Compose project
name. Upgrade the existing installation directory so it continues to reference
the same filesystem data and PostgreSQL volume.

1. Download and verify the next stable bundle and its external checksum.
2. Read the release notes.
3. Back up PostgreSQL, `data/projects`, `data/ssh`, `.env`, and the active
   deployment files.
4. Extract the new bundle to a staging directory.
5. Start from the new `.env.example`; migrate site-specific values from the old
   `.env`.
6. Keep the new `PRISM_BACKEND_IMAGE` and `PRISM_FRONTEND_IMAGE` digest values.
7. Validate the staged configuration.
8. Stop the active stack.
9. Replace `compose.yml`, `.env.example`, Caddy templates, `README.md`,
   `VERSION`, and `SHA256SUMS` in the active directory. Install the prepared
   `.env`.
10. Pull and start the new release.
11. Run the post-change checklist.

Do not copy the old `.env` wholesale: doing so also copies the old image digests.
Do not run the next bundle from a new directory unless its `data/` paths have
been deliberately mapped to the existing storage.

Validation and startup:

```bash
docker compose --env-file .env -f compose.yml config --quiet
docker compose pull
docker compose up -d --wait
docker compose logs --tail=200 postgres backend prism-worker catalog-worker
```

## Rollback

Application rollback and data rollback are separate decisions.

If no incompatible schema or data change occurred:

1. stop the current stack;
2. restore the previous bundle's deployment files and `.env` in the same active
   installation directory;
3. run `docker compose pull`;
4. start with `docker compose up -d --wait`;
5. run the verification checklist.

If the release changed data incompatibly, restore PostgreSQL, `data/projects`,
and `data/ssh` from the same pre-upgrade backup before starting the older
application.

Never move or recreate a published Git tag to perform a rollback. The previous
bundle retains the original Prism image digests.

## Upgrade a legacy source deployment

For a stable release that predates bundles:

1. back up all state;
2. fetch and check out the target stable tag;
3. compare the new `.env.example` with `.env`;
4. render Compose;
5. rebuild and start;
6. record the resulting commit and images.

```bash
docker compose --env-file .env -f docker-compose.yml config --quiet
docker compose up --build -d
```

Prefer moving to the release-bundle contract when a later stable release
provides one. Follow that release's data-migration notes explicitly; do not
assume that a V2 alpha SQLite installation can be upgraded in place.

## Post-change verification

- frontend and API health endpoints
- OIDC login and logout
- viewer and designer permissions
- repository import or synchronization
- schematic, PCB, 3D, and BOM display
- Design Comparison completion
- comment creation and resolution
- one jobset and artifact download
- catalog search and release queue
- Remote Symbol Provider discovery and placement
- backup job completion
- tracker connector health and Test connection after any restore or key rotation

## Logs and job diagnosis

```bash
docker compose ps
docker compose logs --tail=200 backend
docker compose logs --tail=200 prism-worker
docker compose logs --tail=200 catalog-worker
docker compose logs --tail=200 postgres
docker compose logs --tail=200 frontend
```

For a failed job, capture its job ID, type, project or component, attempt logs,
worker logs, release version, and source commit. Record evidence before retrying.

### Recover failed import follow-ups

A completed project import records metadata and thumbnail scheduling outcomes in
`result.follow_ups`. A designer can retry those follow-ups for a registered
project with:

```text
POST /api/projects/{project_id}/import-follow-ups/retry
```

The response lists one outcome for each operation, including any partial
failures. Job IDs identify the follow-up work for log and worker diagnosis.
The retry does not register or remove the project; existing metadata and
thumbnail artifact keys let active work be reused instead of duplicated.

## Capacity and retention

Monitor:

- host and Docker disk usage;
- PostgreSQL volume growth;
- `data/projects/.kicad-prism` artifact growth;
- worker memory on the largest projects;
- queued and repeatedly retried jobs;
- catalog import and validation duration;
- PostgreSQL connection-pool saturation.

Design bundles (`.kicad-prism/bundles`) are kept by use. An hourly pass on the
general worker keeps the bundles of the prebuild's commits (branch heads, each
branch's newest `PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS` commits and every tagged
commit), released Release Studio commits and every bundle an alias still points
to. It removes the rest after `PRISM_DESIGN_BUNDLE_RETENTION_DAYS` unused, and
sweeps old unpacked-cache versions, archives no row names and `prism-kicad`'s
stale temporary files. Unpacked caches are also dropped after
`PRISM_DESIGN_BUNDLE_CACHE_IDLE_DAYS` without a read and kept under the
`PRISM_DESIGN_BUNDLE_CACHE_*_MAX_BYTES` caps; a reader re-extracts what it
needs. The worker logs each pass's counts (`Design bundle retention: ...`).

Plan disk for the archives: a large board (about 55 MB of `.kicad_pcb`) takes
about 47 MB per bundled revision, so twenty prebuilt revisions of one such
design hold about 1 GB, plus its unpacked cache.

With `PRISM_DESIGN_BUNDLE_AUTO_BUILD=true`, the first deploy does not rebuild
every project at once: the worker's backfill queues at most one branch-head
bundle per `PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS`, and only while no
`design_bundle` job is active. It records in `ws_design_bundle_flags` each
project whose board or root schematic no longer resolves by its project file
(`board-unresolved`, `schematic-unresolved`), whose committed `.prism.json` is
invalid, or whose project file is missing at HEAD (`project-absent`). Fix a
flagged project by setting its board or schematic path in the project settings;
the flag clears at the next backfill or build of its HEAD.

A `design_bundle` job that fails in a KiCad step (zone refill, GLB export,
source upgrade) is retried; after its last attempt the stage stays pending and
the bundle row is marked `failed` with the error. Readers then answer *failed*
instead of *pending*. The first status read after
`PRISM_DESIGN_BUNDLE_FAILED_RETRY_SECONDS` (default one hour) queues it again;
Generate or Regenerate retries at once. A source KiCad cannot read stays failed
until a deliberate retry.

Use configured artifact and partial-output retention. Do not delete unknown
content inside `.kicad-prism` manually. Confirm whether it is authoritative data
or a regenerable cache first.

## Common failures

### Frontend returns 502

Inspect `/api/health/ready` and backend startup. Common causes are invalid OIDC
settings, PostgreSQL unavailability, unwritable project storage, or a startup
exception.

### A release starts with old code

Inspect `PRISM_BACKEND_IMAGE` and `PRISM_FRONTEND_IMAGE` in `.env`. Copying an
old environment file during upgrade also copies its old digest pins.

### Imported projects disappear

Verify the active installation directory and its `data/projects` mount. Then
verify project rows in PostgreSQL; both are required.

### Authentication loops

Check redirect URIs, `PUBLIC_BASE_URL`, CORS, proxy headers, cookie Secure
behavior, and the host clock.

### Jobs remain queued

Confirm both workers are healthy and use the same `PRISM_DATABASE_URL`. Inspect
leases and worker logs before restarting.

### Tracker sync stalled or credentials locked

Confirm `TRACKER_CREDENTIAL_ROOT_KEY` is set, valid, and identical on `backend`
and `prism-worker`. Inspect connector health
(`GET /api/admin/trackers/connectors/{id}/health`) for pause reason, backlog,
and rate-limit resume time. A missing or wrong root key preserves local comments
and leaves encrypted credentials in place, but returns `503` on connector and
OAuth APIs until the matching key (or rotation-grace previous key) is restored.

Webhook delivery is optional; polling-only deployments should still show recent
poll and sweep timestamps within the budgets documented in
[Tracker integration](TRACKER_INTEGRATION.md). Restart both services after root
key rotation and verify **Test connection** before resuming promotion.

Include `TRACKER_CREDENTIAL_ROOT_KEY*` in backup custody planning. Restoring a
database without the matching root key leaves encrypted credentials unreadable;
do not delete those rows or re-seed production to "fix" the key. Follow
[Tracker credential custody, rotation, and restore](#tracker-credential-custody-rotation-and-restore)
so outbound work resumes through recovery rather than duplicate creates.

### Catalog metadata exists but placement fails

Verify released asset files in persistent storage and confirm provider metadata
advertises the correct public origin.

`scripts/check_catalog_asset_files.py` lists every revision-linked asset file
that is missing or no longer matches its sha256, grouped as
`placement_broken` (the released head of an active part), `history_broken`
(older releases and deactivated parts), and `draft_only`. It exits 1 while `placement_broken` is not empty. Run it with
`docker compose run --rm --no-deps backend python scripts/check_catalog_asset_files.py`.
Add `--restore` to look for exact sha256 copies of missing files. It searches
the catalog object store first and then each `--search DIR` (volume backups,
library checkouts, `RemoteLibrary/remote_3d/`; mount them into the container).
It is a dry run until `--apply` is added and never changes the object store.
`--database-url` selects the database for both the catalog and the object-store
ledger. Restored files get the same mode as the store's other files.
It writes only inside the catalog store and refuses paths behind a symlink. It
never replaces an existing file, so a file with different content is only
reported. These checks assume that no untrusted user changes the catalog store's
directories while the script runs. The script neither initializes nor migrates
the catalog. It exits 2 when the schema is not at head.

Artifact maintenance never deletes a superseded never-released draft STEP at
once. It moves the file to `quarantine/<entry>/` under the catalog store and
deletes it once `CATALOG_DRAFT_MODEL_QUARANTINE_DAYS` (default 30) have passed;
the purge ledger records both steps. The check lists quarantined files under
`quarantine` with their `expires_at`, marks a missing file the ledger accounts
for with `ledger` (`quarantined` or `purged`), and `--restore --apply` moves a
quarantined file back and records the restore. A restored file stays until its
asset is linked again and then abandoned. A quarantined file whose revision is
released again before it expires is restored by maintenance itself.

`scripts/report_unpinned_board_models.py [DIR ...]` (default
`KICAD_PROJECTS_ROOT`) lists every board footprint whose 3D model still points
at the provider's shared `<prefix>_3d` folder, so a fresh clone opens without
it: parts placed before footprints embedded their models, with embedding off,
or over the embed cap. Each entry says whether the file is present in that
checkout and, with `--database-url`, which catalog 3D model assets carry the
same bytes. It only reads; place such a part again from KiCad to pin it.

`--record-legacy` lists missing never-released draft STEP files that no ledger
row accounts for: files the purge deleted before its ledger existed (see
[Upgrades](UPGRADES.md#superseded-draft-step-files-wait-in-quarantine)). With
`--apply` it records them as `legacy_pre_ledger`, after which their components'
audit chains verify again. It never records a released or head revision's
file; restore those.

### Disk is full

Stop new imports and generation. Preserve PostgreSQL and authoritative assets
before removing anything. Expire known generated artifacts through a documented
retention path instead of deleting arbitrary directories.
