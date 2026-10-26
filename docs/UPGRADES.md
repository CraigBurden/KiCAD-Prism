# Upgrades and backups

How to move a Prism installation to a newer release without losing the component
catalog, the imported projects, or anything else that took work to create.

[Operations](OPERATIONS.md) is the general runbook. This document is the
narrower thing: the exact sequence for an upgrade, what protects you at each
step, and what to do when a step goes wrong.

> **Scope:** This procedure applies to PostgreSQL-backed V3 installations and
> later releases that use the same storage model. It is not a migration from
> the V2 alpha SQLite layout to V3 PostgreSQL. For that transition, deploy V3
> into a fresh data location and re-import the projects and component sources
> as described in the V3 release notes. Alpha releases do not promise
> backwards-compatible data or API contracts.

## The rule the whole scheme rests on

> **An upgrade may only add.** Anything that removes or narrows waits for a
> later release, once the version that needed it is out of support.

Within that PostgreSQL release line, a rollback can normally use the previous
application images without restoring data: new columns and tables are designed
to be ignored by older code. This is an application and schema convention, not
a general alpha compatibility guarantee. Read the release notes for the exact
release before relying on an image-only rollback; if the release changed data
incompatibly, restoring the matching backup is required.

Every schema Prism owns carries a numbered ledger. One module,
[`schema_ledger.py`](../backend/app/services/schema_ledger.py), runs them all: it
takes the schema's advisory lock, applies the steps a database has not recorded,
renumbers branch-era rows and adopts legacy markers. At startup
[`schema_head.py`](../backend/app/services/schema_head.py) brings every ledger to
head in dependency order:

| Schema | Ledger | Migrations |
| --- | --- | --- |
| `workspace` | `workspace.ws_schema_migrations` | [`workspace_schema_migrations.py`](../backend/app/services/workspace_schema_migrations.py) (registry), bodies under [`workspace_migrations/`](../backend/app/services/workspace_migrations/) |
| `workspace` (auth tables) | `workspace.auth_schema_migrations` | [`auth_schema_migrations.py`](../backend/app/services/auth_schema_migrations.py) |
| `comments` | `comments.comment_schema_migrations` | [`comments_schema_migrations.py`](../backend/app/services/comments_schema_migrations.py) |
| `catalog` | `catalog.catalog_schema_versions` | [`catalog_schema_migrations.py`](../backend/app/services/catalog_schema_migrations.py) |
| `operations` | `operations.artifact_schema_migrations` | [`artifact_schema_migrations.py`](../backend/app/services/artifact_schema_migrations.py) |

The auth and artifact ledgers, and step 0 of the workspace and comments ledgers,
hold DDL that earlier releases ran on every start outside any ledger. Each of
those steps is safe on a database that already has it, so an existing
installation runs them once on upgrade and records them; no manual step is
needed.

The catalog's baseline (base tables, epoch row, metadata registry and its
built-in field seed, the first install of the head projections) is step 0 of
the catalog ledger. Earlier releases reconciled it on every start; an existing
installation runs it once on upgrade, where it changes nothing, and records it.
From then on the catalog is forward-only: a later change to any of it ships as a
new step, and rolling back to a release from before the ledger is not supported
(see below).

Derived state sits outside those ledgers on purpose. Component-head projections,
search indexes and integrity guards are rebuilt whenever their definition version
changes, which a run-once ledger cannot express, and the catalog's epoch guard
still refuses a populated pre-epoch-2 catalog on every start. They rebuild from authoritative
data, so they are not schema-migrated and are omitted from the standard
`prism_backup.py` archive. Include them separately when faster recovery is worth
the additional storage.

## What is authoritative, and what is not

Four things hold state you cannot recreate:

| | Where | Why it matters |
| --- | --- | --- |
| PostgreSQL | the `prism-postgres-data` volume | users, roles, projects, comments, jobs, audit records, catalog rows |
| Component assets | `data/projects/.kicad-prism/components` | the symbol, footprint, 3D model and revision files the catalog rows point at |
| Project storage | the rest of `data/projects` | imported repositories and checkouts |
| Git identity | `data/ssh` | the keys your Git host has authorised |

Smaller, but also worth keeping: `data/secrets` (the Release Studio signing key),
the Caddy data volume (ACME account and issued certificates; public CAs
rate-limit reissuing), and the deployment configuration in `generated/` and
`sites/`. `prism_backup.py` archives each of these that the deployment has.

**A database dump on its own is not a backup of Prism.** Restore it without the
component store and every component in the catalog exists, with a broken
reference to its files. The two have to travel together.

Everything else under `.kicad-prism` — job artifacts, design bundles and their
unpacked caches, KiCad database-library exports, validation runs — rebuilds on
demand. On a
working installation that is most of the bytes, and `prism_backup.py` leaves it
out.

---

# The upgrade, step by step

Run everything from the deployment directory: the one holding `compose.yml`
(release bundle) or `docker-compose.yml` (source build).

Release-bundle users should first extract the next bundle into a separate
staging directory. Do not replace the active deployment or start the new images
yet. The staged bundle contains this runbook and the backup tool used below.

## 1. Record what you are running

```bash
docker compose images
```

Add `cat VERSION` for a release bundle, or `git rev-parse HEAD` for a source
build. Keep this with the backup — a rollback needs to know what to roll back
*to*, and "the previous one" is not an answer at 6pm.

## 2. Take a backup

Release bundle, before replacing the active files:

```bash
python3 /path/to/staged-bundle/scripts/prism_backup.py \
  --root /path/to/active-prism create
```

Source checkout:

```bash
python3 scripts/prism_backup.py create
```

Use the backup tool from the release you are running, or a newer one. It needs
only Python 3 and Docker, not the rest of the checkout, so it can be fetched
on its own:

```bash
git show <tag>:scripts/prism_backup.py > prism_backup.py
python3 prism_backup.py --root /path/to/prism create
```

This stops `frontend`, `backend`, `prism-worker` and `catalog-worker`, leaves
PostgreSQL running, captures the dump and the files as one set, and restarts
the application before it hashes and writes the final archive. The pause is
what makes the database and the filesystem describe the same moment.

The pause lasts as long as compressing project storage takes. Expect seconds
for a small installation; a Windows host with Docker Desktop has taken about
2 minutes per GB of `data/projects` (16 minutes for 8.5 GB). Schedule it.

Payloads are staged in a hidden `.prism-backup-*` directory beside the output
archive, not in the system temp directory. Free space needed on that disk is
about twice the finished archive while it is written. Point `--output` at
another disk when the deployment disk is tight:

```bash
python3 scripts/prism_backup.py create --output D:/backups/prism-backup.tar.gz
```

`--hot` skips the pause. Use it for a routine off-hours snapshot, not before an
upgrade: the whole point of this backup is that you may need it.

The archive contains the dump, project storage, `data/ssh`, the `.env`, and,
when the deployment has them, `data/secrets`, the Caddy data volume, and the
installer's `generated/` files plus `sites/`. Anything absent is skipped with a
note. The manifest records the running containers' image names and IDs, the
build's `PRISM_RELEASE` and `PRISM_REVISION`, both schema ledger versions, and
a SHA-256 of every payload.

> **The archive contains secrets.** Repositories, tokens, SSH private keys, the
> signing key and Caddy's ACME account key, plus the `.env` verbatim. Encrypt it
> and store it off this host.

## 3. Check that the backup is real

Use the same copy of `prism_backup.py` that created the archive. For a release
bundle staged outside the active deployment, that is:

```bash
python3 /path/to/staged-bundle/scripts/prism_backup.py verify \
  /path/to/active-prism/prism-backup-<timestamp>.tar.gz
```

For a source checkout:

```bash
python3 scripts/prism_backup.py verify prism-backup-<timestamp>.tar.gz
```

Every payload is re-hashed against the manifest, read straight from the
archive without unpacking it. An untested backup is a rumour; this is a few
minutes against the possibility of finding out during a restore.

## 4. Read the release notes

Specifically, whether the release says anything about schema or data. If it
announces a breaking change, the rollback path in step 8 needs the backup rather
than just the old images.

## 5. Get the new code

Source build:

```bash
git fetch origin
git checkout <tag>
```

Release bundle: extract the new bundle to a staging directory, then replace
`compose.yml`, `.env.example`, the Caddy templates, `VERSION` and `SHA256SUMS`
in the active directory.

**Do not copy the old `.env` over the new one.** It carries the old image
digests, and the stack will start on the old code while everything appears to
have upgraded. Start from the new `.env.example` and carry your site values
across. For source deployments configured with the installer, regenerate their
settings:

```bash
python3 -m scripts.prism_deploy
```

The installer reads existing answers, keeps secrets, and takes new defaults.
It generates source Compose overlays; do not run it against a pull-only release
bundle. Bundle users should carry values into the new `.env.example` manually.

From v5, `docker-compose.yml` passes the deployment env file to `backend`,
`catalog-worker` and `prism-worker` as `env_file: ${PRISM_ENV_FILE:-.env}`.
Installer deployments keep it in `generated/.env`, so `PRISM_ENV_FILE` must name
that file or every setting not listed under `environment:` (forge host tokens,
for example) silently stops reaching the containers. Re-running the installer
writes `PRISM_ENV_FILE=generated/.env` into `generated/.env` and pins the same
file in `generated/docker-compose.generated.yml`. If you do not re-run it, add
the line yourself and check:

```bash
grep '^PRISM_ENV_FILE=' generated/.env
```

Hand edits to `generated/Caddyfile` are overwritten by the installer. Move any
extra site into `sites/<name>.caddy` first; the regenerated Caddyfile imports
that directory. See
[Additional Caddy sites](DEPLOYMENT.md#additional-caddy-sites).

## 6. Validate before you switch

```bash
docker compose --env-file .env -f compose.yml config --quiet
```

Substitute your own file list. This catches a broken merge while the old stack
is still serving.

## 7. Start the new release

```bash
docker compose pull            # release bundle
docker compose up -d --wait
```

Source builds need `--build` instead of `pull`, because the application code is
baked into the image at build time:

```bash
docker compose up -d --build --wait
```

Migrations run during startup, inside the advisory lock, before the service
accepts traffic. Watch them:

```bash
docker compose logs -f backend | grep -i "schema migration"
```

You should see one line per migration, or silence if there were none.

## 8. Verify, or roll back

Work through the checklist in [Operations](OPERATIONS.md#post-change-verification).
The short version: log in, open a project, view schematic / PCB / 3D, search the
catalog, place a Remote Symbol.

If it is wrong and the release changed nothing incompatibly, put the previous
deployment files and `.env` back and start again — the data is untouched:

```bash
docker compose up -d --wait
```

If the release did change data incompatibly, restore instead:

```bash
python3 scripts/prism_backup.py restore prism-backup-<timestamp>.tar.gz
```

When both schema ledgers can be read, restore refuses an archive newer than the
build receiving it, because that would leave the database below the schema
version its contents assume. On an empty or otherwise unreadable database it
warns that this comparison could not run; stop and investigate before
continuing. Restore replaces the database, project storage and SSH keys in
place, and asks before it does. It also puts back `data/secrets` and the Caddy
data volume when the archive has them. It leaves `generated/`, `sites/` and the
`.env` as they are unless you pass `--with-config`, which writes the archived
`generated/` files and `sites/` over the current ones. Restore unpacks into a
hidden `.prism-restore-*` directory inside the deployment, so that disk needs
free space for the unpacked archive as well as the data it replaces.

Never move or recreate a published Git tag to roll back. The previous bundle
still pins the original image digests; that is what makes it a rollback.

---

# Restore onto a fresh host

The same archive rebuilds an installation from nothing — for disaster recovery,
or to rehearse one.

1. Install the recorded release into an empty directory.
2. Extract the archive's `env` and adapt it to the new host. Do not reuse a
   hostname or certificate that still belongs to the live installation.
   Installer deployments put it at `generated/.env`.
3. Bring up PostgreSQL alone: `docker compose up -d postgres`.
4. `python3 scripts/prism_backup.py restore <archive>`. Add `--with-config` to
   bring back `generated/` and `sites/` as well; leave it off when the new host
   needs a different hostname or certificate, and re-run the installer instead.
5. Start everything: `docker compose up -d --wait`.
6. Run the verification checklist.

Rehearse this on an isolated host **before** you need it. A restore you have
never performed is not a recovery plan.

---

# Adding a migration

For contributors changing the schema.

Append to `MIGRATIONS` in the relevant module. Never renumber, never edit a
migration that has shipped — an installation that already applied version 4 will
never run it again, so changing it only affects databases that have not seen it,
and the two diverge silently.

```python
def _thing_that_was_added(conn: Any) -> None:
    """Say what this is for and why, not what the SQL says."""
    conn.execute(
        "ALTER TABLE ws_projects ADD COLUMN IF NOT EXISTS thing TEXT NOT NULL DEFAULT ''"
    )


MIGRATIONS = (
    ...
    (8, "thing_that_was_added", _thing_that_was_added),
)
```

Requirements:

- **Additive only.** `ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`. No `DROP`, no `NOT NULL` without a default, no
  narrowing type change.
- **Idempotent.** It may run against a database that partly has the change.
- **Fast, or deliberately not.** `ALTER COLUMN ... TYPE` rewrites the whole
  table and holds a lock for the duration. If a migration will take minutes on a
  real catalog, say so in the release notes.

To drop something, ship the code that stops using it first. Remove the column a
release later.

## Project settings move out of the checkout

Earlier releases wrote project-property edits (name, description, paths) into
the checkout's `.prism.json`. A tracked file changed that way made the checkout
dirty, and Sync stopped fast-forwarding the project.

These settings now live in the workspace database (migration 55,
`project_path_settings`). On the first start after upgrading, Prism reads each
checkout's `.prism.json` once. If the file is untracked, or a tracked file
differs from `HEAD`, the values that differ are copied into the database.

Once those values are stored, Prism restores a tracked file it dirtied to the
committed version, so Sync fast-forwards again without a manual step. A file
that supplied no values, and an untracked file (which never blocks Sync), are
left in place. To share the settings with the team, commit them upstream.

## DBL footprints reference bundled 3D models

Earlier DBL exports wrote footprints whose model paths pointed at
`${KIPRJMOD}/RemoteLibrary/remote_3d/...`, which exists only where the Remote
Symbol Provider placed the same part. The export now ships the models under
`3DModels/` and footprints reference `${PRISM_LIB_DIR}/3DModels/...`. Boards
that placed DBL footprints before this change keep the old paths; run "Update
footprints from library" once to pick up the new ones. There is no automatic
migration.

## DBL keys no longer depend on export order

Earlier exports gave components that share a DBL key (`Part Number Nocolon`,
for example the same manufacturer part number from two manufacturers, or parts
keyed by an identical value) suffixes `_2`, `_3`, ... in export order, so a key
could move to another part between exports. Now the oldest component keeps the
bare key and each other one gets `_` plus the first eight characters of its
component id ([key rule](LIBRARY_MANAGER.md#kicad-dbl-export)). Each affected
part changes key once, at the first export after the upgrade; keys without a
collision are unchanged.

Designs that placed a part under an `_N` key must be re-pointed to the new key.
To find them:

1. Before the first new export, keep a copy of the current bundle's
   `Prism.sqlite` and list the old suffixed keys, for each table:
   `sqlite3 Prism.sqlite 'SELECT "Part Number Nocolon", "Manufacturer", "Manufacturer Part Number" FROM "<category>"'`,
   keeping the keys that end in `_<digits>`.
2. Run the export and read the same columns from the new `Prism.sqlite` to map
   each manufacturer and part number to its new key.
3. Search the projects for the old keys:
   `grep -rnE '"Part Number" "[^"]*_[0-9]+"' --include='*.kicad_sch' <projects>`
   (the DBL copies the key into each placed symbol's `Part Number` field), and
   change those symbols in KiCad to the new key ("Change Symbol" from the
   `Prism` library).

A key that only looks suffixed (an MPN that really ends in `_2`) is unaffected;
step 1 shows which keys were generated.

## Release Studio configurations in a monorepo subproject

Earlier releases read a monorepo subproject's committed Release Studio
configurations from the repository root's `.prism/release-studio/configurations/`
at a commit, with repository-relative file references. A subproject now reads
only its own folder, `<subproject>/.prism/release-studio/configurations/`, where
Settings saves it, with references relative to the subproject. Root-level files
no longer show for a subproject. A candidate that already captured its
configuration snapshot keeps building from that snapshot.

To keep such a configuration, move it into the subproject and make its
references relative to the subproject folder:

```sh
git mv .prism/release-studio/configurations/release.yaml \
       alpha/.prism/release-studio/configurations/release.yaml
# edit: board: alpha/board.kicad_pcb  ->  board: board.kicad_pcb
```

Or open it in Settings for the subproject and save it again. A project at the
repository root is unaffected.

## Placed symbols carry a catalog revision stamp

Remote placement (part manifest, inline bundle, and signed asset download) now
adds two hidden properties to every symbol it serves: `Prism_Component` and
`Prism_Revision`, the catalog component and released revision ids (see
[Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md#placed-symbol-provenance)).
Three things change once:

- **Symbol bytes and manifest hashes.** Every served symbol's bytes, and so its
  `sha256` in the placement manifest, change on the first request after the
  upgrade. Output is byte-stable again from then on. The manifest and bundle
  shapes do not change; `provider_version` `0.4.0` records the change (see
  below). A client that caches by hash downloads each symbol once more.
- **Reserved field keys.** `prism_component` and `prism_revision` become
  reserved custom field keys, matched after key canonicalization (`Prism
  Revision` and `prism-revision` count, `prismrevision` does not). Creating a
  field with either key is refused. A field created earlier under one of them
  keeps its catalog values, but placement no longer writes it into symbols:
  the stamp replaces it. To keep such a value in KiCad, move it to a field with
  another key. Project imports treat the two properties as per-placement
  context, not part metadata.
- **BOM columns.** Parts placed after the upgrade carry the two properties, so
  a KiCad BOM that exports all symbol fields gains `Prism_Component` and
  `Prism_Revision` columns. A BOM preset that lists its fields is unaffected.

The DBL export does not stamp symbols; its files are unchanged.

### Library usage of each synced commit

Catalog step 12 (`project_catalog_placements`) adds `project_catalog_scans`
and `project_catalog_placements`. After every successful sync the catalog
worker scans the new `HEAD`'s schematics (`project_catalog_usage` job) and
records the catalog revision each part placed, from the stamp or, for parts
placed before it, by inference. Existing projects are scanned on their next
sync, or with `POST /api/projects/{id}/catalog-usage/scan`.

## Placed footprints embed their 3D models

KiCad placements now carry 3D models inside the footprint as KiCad embedded
files (see [3D models](REMOTE_SYMBOL_PROVIDER.md#3d-models)). After upgrading:

- Each placed part can add up to 4 MiB to the board file, since the board
  stores the embedded (compressed) model data.
- The placed footprint's bytes change, so its `sha256` in the part manifest
  changes once for every component with a 3D model.
- Embedded models leave the manifest and inline bundle as separate `3dmodel`
  entries; models that are not embedded are still listed.

Set `REMOTE_PROVIDER_EMBED_3D_MODELS=false` to keep the previous behaviour.

### Larger embed cap and kept compressed copies

The per-footprint embed cap is now a setting,
`REMOTE_PROVIDER_EMBED_MAX_COMPRESSED_BYTES`, counted in compressed bytes with
a default of 16 MiB (it was about 3 MiB of compressed data, a fixed 4 MiB of
footprint text). Models between the two caps now embed, so their placed
footprints change once and a board can grow by up to about 21 MiB per such
part. The 64 MiB raw-model ceiling is unchanged. Set the cap to `3145728` to
keep the previous limit.

Placement now keeps each embedded model's compressed copy under
`embedded-models/` in the catalog store and reuses it, so a later `zstandard`
upgrade does not change placed bytes. Back it up with the rest of the store; a
missing copy is recreated on the next placement. Boards placed before
embedding are not changed; `scripts/report_unpinned_board_models.py` lists
their unpinned models.

## Remote provider 0.4.0: placing an earlier released revision

Discovery metadata now reports `provider_version` `0.4.0`. It records the
stamped symbols and embedded footprint models above, and adds an optional
`revision` parameter to the component detail, part manifest and inline bundle
so a released project can place the exact released revision it used
(`released_revisions` in the detail lists them). Clients that ignore the new
fields keep getting the current release. Drafts and archived revisions are
never served (404 `revision_not_released`). See
[Placing an earlier released revision](REMOTE_SYMBOL_PROVIDER.md#placing-an-earlier-released-revision).

## Bulk import overwrite flags keep existing files

`--overwrite-assets` (`scripts/import_database_library.py`,
`scripts/import_footprint_library.py`) and `--overwrite`
(`scripts/import_kicad_library_assets.py`) no longer rewrite a canonical asset
file whose content changed. The file at its familiar path, for example
`footprints/<Library>.pretty/<Name>.kicad_mod`, keeps its old bytes, because
revisions already linked to it, released ones included, record those bytes'
sha256. The changed content is written to `revisions/<sha256>/<same relative
path>` under the catalog store, and the rows this import creates point there.
Identical content is still reused in place.

The asset browser lists only the familiar paths, so it keeps offering the old
file there. Picking it links the old content, not the imported one; to use the
new content, link the asset the import created or upload the file to the part.

Two modes leave files no row describes:

- `--replace-catalog` (`import_database_library.py`) clears the rows first, so nothing links the old file at
  the familiar path any more, but it stays on disk and in the browser, and the
  new rows point at `revisions/<sha256>/`. To have the replacement land at the
  familiar paths, take a backup and move the affected `symbols/`,
  `footprints/`, and `3dmodels/` files out of the catalog store before the
  import.
- `--no-index-db` writes files only, so changed content under
  `revisions/<sha256>/` is referenced by nothing. Run the same import again
  without `--no-index-db` to register it, or delete those directories once
  `SELECT canonical_path FROM catalog.assets WHERE canonical_path LIKE
  '%/revisions/<sha256>/%'` returns no row for them.

## Release Studio pins 3D models outside the closure

Earlier releases recorded a board's 3D models outside the repository, such as
the stock `${KICAD9_3DMODEL_DIR}` library, as advisory and left their bytes out
of the input closure. The cover render and the assembly views open those
models, so a release now resolves each one as KiCad does and hashes its bytes
into the input closure digest.

- **One new build key.** The first build of an existing board that uses stock or
  other host models after the upgrade gets a new input closure digest, and so a
  new candidate, even with an unchanged commit and configuration. Later builds
  are stable again while the model files do not change.
- **Non-hermetic where the variable is unset.** A worker without the variable
  (for example no `KICAD9_3DMODEL_DIR` in its environment) cannot read those
  models, so the build reports them as unreadable and itself as non-hermetic.
  Set the variable on every worker to the same model library to keep builds
  hermetic and their digests equal across workers.

Only regular files are hashed, up to 256 MiB each, and only when both the
written and the resolved name end in a suffix KiCad's 3D plugins load (`.step`,
`.stp`, `.stpz`, `.stepz`, `.step.gz`, `.stp.gz`, `.igs`, `.iges`, `.wrl`,
`.wrz`, `.x3d`, `.idf`, `.emn`). Any other host file, a device, a FIFO, a larger
file, or a repository symlink that leads out of the repository is unreadable,
and the build non-hermetic.

## Release Studio acknowledges unpinned 3D models

Migration 56 (`release_studio_model_inputs`) adds `ws_release_model_inputs`, a
nullable `self_contained` on `ws_release_candidates`, and
`acknowledged_models` on review decisions and publish records. Candidates made
before it have no model rows and `self_contained` NULL.

- **Approve and publish acknowledge unpinned models.** A build whose 3D models
  include an unreadable one, or a missing `.wrl` KiCad may swap for a STEP
  model, is still built, approved and published, but each approval and the
  publish must name those models as acknowledged. The API takes them as
  `acknowledged_models` (the `key` of each `approvals.unpinned_models` entry)
  and answers 409 listing the ones missing. For an older candidate the list is
  read from its non-hermetic reasons.
- **One new build key for more model forms.** Relative model paths, `:alias:`
  forms and `$(VAR)` / `$VAR` references are now resolved and pinned instead of
  skipped, so a board that uses them gets a new input closure digest, and a new
  candidate, on its first build after the upgrade.
- **Staged host models.** The tools read a copy of each hashed host model made
  under the build's staging directory, so a host file changed during a build
  cannot reach the outputs.

## Superseded draft STEP files wait in quarantine

**Data-loss window.** From v3.0.0-alpha up to and including v4.0.0-alpha, and
on `dev` until #684 (merged 2026-10-15), daily artifact maintenance
(`CATALOG_RETENTION_ENABLED=true`) could delete the STEP file of a released
revision: it kept only the models of each component's head, so opening a
draft that replaced a model let the next run delete the released model.
Placement of that part then fails with a missing file, and its audit chain
reports `asset_content_mismatch`. Never-released draft models were deleted
too, with no record, until the purge ledger (#691, catalog step 9). After
upgrading from any release in that window:

1. run `scripts/check_catalog_asset_files.py`; a non-empty `placement_broken`
   or `history_broken` is a released model that was lost;
2. restore those with `--restore --search DIR --apply` from a volume backup,
   the source library checkout, or users' `RemoteLibrary/remote_3d/` folders;
3. run `--record-legacy --apply` to record the never-released draft models
   the old purge deleted, so their components' audit chains verify again.

Catalog step 11 (`asset_file_purge_events`) adds `event`, `quarantine_path`
and `quarantine_id` to the purge ledger; rows from step 9 become `purged`.
From this release on, maintenance moves a superseded never-released draft STEP
to `quarantine/` under the catalog store instead of deleting it, and deletes it
only after `CATALOG_DRAFT_MODEL_QUARANTINE_DAYS` (default 30). Until then
`--restore --apply` moves it back. Back up the catalog store's `quarantine/`
directory with the rest of the store. Reads of a quarantined model answer 404
`asset_quarantined` (`asset_purged` once it is deleted).

## API clients

Scripts and integrations that call the Prism API directly, as opposed to the
browser and the KiCad panel, see these changes:

- **Error bodies.** Every error is `{"detail": "<message>", "code": "<code>"}`,
  sometimes with extra fields. `detail` is unchanged, so a reader of it keeps
  working; match on `code` instead of parsing the message.
- **Scopes.** A bearer token needs `api:read` for every read and `api:write`
  for every write. A service client created without either can no longer read;
  give it `api:read`. KiCad provider tokens work only on
  `/api/remote-provider/*`. See [Authentication and access](AUTHENTICATION_AND_ACCESS.md).
- **Guarded writes.** Comment, reply and catalog component edits take `If-Match`
  with the ETag that was read. A stale one answers 412 with the current ETag;
  where the precondition is required, a missing one answers 428.

## System Builder data is dropped

System Builder never shipped in a tagged release: v4.0.0-alpha has none of its
tables or catalog kinds, so an upgrade from v4.0.0-alpha loses nothing here.
An installation that ran `dev` between 2026-10-09 and 2026-10-23 did store
System Builder data, and the first start of v5.0.0-alpha deletes it without a
copy:

| Ledger | Step | Drops |
|---|---|---|
| workspace | 123 `drop_system_builder_v1` | every `system_*` table (v1 systems, harnesses, reviews, snapshots, exports) |
| workspace | 124 `drop_mesh_viewer_readiness` | `ws_webgpu_ready`; the 3D tab reads the design bundle instead |
| workspace | 129 `drop_system_builder_v2` | `ws_systems` and the other `ws_system_*` / `ws_board_sub_port*` tables |
| catalog | 13 `retire_module_and_assembly` | `module` and `assembly` components, `catalog_module_connectors` |
| catalog | 16 `retire_system_entries` | `system` components and `system_entry` assets |

The catalog deletes cascade to those components' revisions, asset links,
audit records and mates. Parts are untouched.

To keep that data, take the backup in step 2 before starting the new release;
the code that reads it is kept at the tag `archive/system-builder-v2`. After
the upgrade, `.kicad-prism/system-bundles/` and `.kicad-prism/system-steps/`
under the projects root are no longer read and can be deleted.

## Why the catalog gate is gone

Until [`catalog_schema_migrations.py`](../backend/app/services/catalog_schema_migrations.py)
existed, the catalog carried a single version string, and a database that did
not match it raised at startup:

> Catalog schema predates the PostgreSQL reset architecture. Run
> `scripts/reset_prism_postgres.py` with destructive confirmation.

The documented remedy for a catalog schema change was to wipe the catalog. It
had never fired, because the version had never been bumped — so the first
release to change a catalog table would have discovered it on somebody's
production database, mid-upgrade, after the old stack had been stopped.

The ladder replaced it. Until the baseline moved into the ledger (step 0), the
legacy version row was still written on every startup so that an older Prism,
which treats that row as a hard precondition, could open a database a newer
build had touched. That row is no longer written: the catalog is forward-only,
and a rollback to an older Prism needs the pre-upgrade backup. Existing
databases keep the row they already have; a database created by this release
never gets one.

## Catalog epoch 2 cutover

The component-as-part catalog is an intentional destructive catalog boundary.
The backend refuses a populated pre-epoch-2 catalog and leaves every
non-catalog PostgreSQL schema untouched. Use this rollout order:

1. Create and verify a Prism backup.
2. Stop frontend, backend, and both worker services before catalog migration.
3. If the legacy catalog contains non-CERN work, export and verify the survivor
   archive described below.
4. Run `import_database_library.py --dry-run --report-json …` and archive the report.
5. Check that report against the survivor archive before deleting anything.
6. Run the catalog-only reset below.
7. Start the new backend once to create epoch 2.
8. Restore the survivor archive before importing CERN.
9. Re-import CERN without `--replace-catalog`, then generate previews.
10. Rebuild project usage if the deployment requires it.
11. Run catalog acceptance queries and default/non-default KiCad placement smoke tests before reopening access.

### Run the catalog tools from the release bundle

The release bundle deliberately keeps backend dependencies inside the
digest-pinned backend image. After the verified backup, replace the deployment
files with the new bundle, carry site values into its `.env`, pull the new
backend image, and stop every catalog writer while leaving PostgreSQL running:

```bash
docker compose pull backend
docker compose stop frontend backend prism-worker catalog-worker
```

Choose an absolute host directory outside `data/projects` for migration
archives and reports, then define the command used by the examples below:

```bash
mkdir -p /absolute/host/migration
run_catalog_tool() {
  docker compose run --rm --no-deps \
    --volume /absolute/host/migration:/migration \
    backend python "$@"
}
```

This one-off container uses the active deployment's PostgreSQL network and
`data/projects` mount without starting the backend service. Source checkouts
with the backend dependencies installed can use the same examples with:

```bash
run_catalog_tool() { python3 "$@"; }
```

After the catalog-only reset, initialize epoch 2 once with
`docker compose up -d backend`, wait for it to become healthy, then stop it
again before restoring survivors. Do not start the workers until restoration
and the CERN import have completed.

### Preserving non-CERN work from a legacy catalog

Pre-epoch-2 CERN imports did not carry the newer `external_source` marker. Their
immutable first revision did use `system:import_database_library`, which is the
one-time classifier used by `migrate_legacy_catalog_survivors.py`. Everything
whose first revision has a different creator is archived as a survivor,
including manually created components and footprint-library imports.

Run the export with deployment-specific expected counts so an unexpected row is
a hard stop. Write the archive outside
`data/projects/.kicad-prism/components`, because the full reset removes that
component store:

```bash
run_catalog_tool scripts/migrate_legacy_catalog_survivors.py export \
  --output /migration/prism-legacy-survivors.zip \
  --expect-survivors <survivor-count> \
  --expect-librarian <librarian-impacted-count> \
  --expect-excluded-cern <legacy-cern-count>

run_catalog_tool scripts/migrate_legacy_catalog_survivors.py verify \
  /migration/prism-legacy-survivors.zip
```

The archive contains the complete legacy component, revision, audit, review,
release, usage, and asset rows plus checksum-verified asset payloads. Epoch 2
restores the active current/released snapshots as new A3 representations while
the complete historical evidence remains in the archive. A provisional or
incomplete legacy revision that cannot satisfy epoch-2 release invariants is
restored as an open draft and listed in the restore report rather than silently
being treated as released.

After producing the CERN importer dry-run report, require a clean identity
comparison:

```bash
run_catalog_tool scripts/migrate_legacy_catalog_survivors.py check-cern-report \
  /migration/prism-legacy-survivors.zip \
  /migration/cern-preflight.json
```

Only after the backup, archive verification, importer preflight, and collision
check all pass should the full reset run. Start the new backend once to create
epoch 2, stop catalog writers again, and preflight then execute restoration:

```bash
run_catalog_tool scripts/migrate_legacy_catalog_survivors.py restore \
  /migration/prism-legacy-survivors.zip \
  --expect-components <survivor-count> \
  --confirm RESTORE-PRISM-LEGACY-SURVIVORS-EPOCH-2 \
  --dry-run

run_catalog_tool scripts/migrate_legacy_catalog_survivors.py restore \
  /migration/prism-legacy-survivors.zip \
  --expect-components <survivor-count> \
  --confirm RESTORE-PRISM-LEGACY-SURVIVORS-EPOCH-2
```

Restore preserves component IDs, current metadata attribution, active assets,
and component-usage rows. It refuses corrupt payloads, duplicate survivor
identities, existing destination IDs/slugs/identities, ambiguous legacy asset
pairing, a non-epoch-2 destination, or a CERN preflight identity collision.
Keep the verified archive with the full Prism backup; neither is replaced by
the other.

The reset command is:

```bash
run_catalog_tool scripts/reset_prism_catalog.py \
  --confirm RESET-PRISM-CATALOG-EPOCH-2
```

After an epoch-2 CERN import, later refreshes can remove only components carrying
the importer's explicit CERN origin marker. Non-CERN components and assets still
referenced by them are preserved:

```bash
run_catalog_tool scripts/reset_prism_catalog.py \
  --cern-only \
  --confirm RESET-PRISM-CERN-IMPORTS
```

Add `--dry-run` to preview the CERN-scoped component and orphan-asset counts.
Stop the backend and catalog workers before executing the non-dry-run form; the
reset temporarily disables named catalog immutability triggers inside its locked
transaction and restores them before commit.

The command removes only the `catalog` schema and catalog component,
preview, KLC-validation, and DBL artifact roots. Project repositories, database
volumes, environment files, other PostgreSQL schemas, and unrelated derived data
are preserved. Rolling a populated epoch-2 catalog back to a pre-epoch-2 backend
is unsupported; restore the backup instead.

---

# Reference

## Commands

```bash
python3 scripts/prism_backup.py create --help
```

| Command | Purpose |
| --- | --- |
| `create` | write an archive; `--hot` to skip the pause, `--output` to choose the path |
| `verify` | re-hash every payload against the manifest |
| `restore` | replace this deployment's data with an archive; `--yes` to skip the prompt |

Global: `--root` for the deployment directory, `--env-file` and `--compose-file`
when detection needs help. `restore --with-config` also restores the archived
`generated/` files and `sites/`.

## Manifest

```json
{
  "schema": "prism.backup.a1",
  "created_at": "20260727T101500Z",
  "hot": false,
  "postgres": { "user": "kicad_prism", "database": "kicad_prism" },
  "images": { "PRISM_BACKEND_IMAGE": "ghcr.io/…@sha256:…" },
  "build": {
    "PRISM_RELEASE": "v5.0.0-alpha",
    "PRISM_RELEASE_source": "container",
    "PRISM_REVISION": "…",
    "PRISM_REVISION_source": "container"
  },
  "containers": {
    "backend": { "container": "kicad-prism-backend", "image": "kicad-prism-backend", "image_id": "sha256:…" }
  },
  "payloads": { "secrets": { "source": "data/secrets", "target": "/run/secrets/prism" } },
  "extras": { "caddy_data": "caddy_data.tar.gz", "config": { "archive": "config.tar.gz", "files": ["generated/Caddyfile"] } },
  "versions": { "workspace_schema": "7", "catalog_schema": "2" },
  "checksums": { "postgres.dump": "…", "projects.tar.gz": "…" }
}
```

`images` lists the `*_IMAGE` settings from the env file, which a source build
mostly does not set; `containers` and `build` say what was actually running.
`build` comes from the backend container's environment (what
`/api/health/ready` reports), then image labels, then the env file; the
`*_source` keys say which. Archives written before these fields existed still
verify and restore.

The manifest itself holds no secrets, so it is safe to keep alongside an
inventory of backups. The archive it describes is not.

## Windows

- **Console encoding.** On a cp1252 console the installer and backup tool fall
  back to ASCII. Set `PYTHONUTF8=1` (for example `$env:PYTHONUTF8 = "1"` in
  PowerShell) for the full output and UTF-8 file handling.
- **Git Bash path conversion.** MSYS rewrites arguments that look like POSIX
  paths, so `docker exec … /app/…` or `docker compose exec postgres psql -f /tmp/…`
  receive `C:/Program Files/Git/app/…`. Prefix those commands with
  `MSYS_NO_PATHCONV=1`. Do not export it for the whole shell: native commands
  given MSYS paths, such as `git -C /c/prism …`, need the conversion. PowerShell
  is not affected. `prism_backup.py` calls Docker directly, so it is not
  affected either.
- **Disk.** Docker Desktop keeps volumes inside its VM disk, and the backup
  stages beside `--output`. Check free space on both before a backup or
  restore.

## Known gaps

- **PostgreSQL runs on a floating tag.** Every Prism image is digest-pinned;
  `postgres:17-alpine` is not. Within major 17 that is safe by PostgreSQL
  policy, but a move to 18 would leave `PGDATA` unreadable and the container
  crash-looping, discovered right after `docker compose pull`. Pin
  `PRISM_POSTGRES_IMAGE` to a digest if you want that decision to be yours.
- **Restore has no CI coverage yet.** The archive format and the refusal rules
  are tested; restoring a previous release's dump into the current build is not.
  Until it is, rehearse restores yourself.
