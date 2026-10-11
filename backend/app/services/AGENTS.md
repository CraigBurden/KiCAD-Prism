# Backend services

This map focuses on the catalog subsystem, whose public surface spans several
large modules. Read `AGENTS.md` at the repository root first.

## Catalog layering

Three files, and the names do not tell you which to use:

| File | Role |
| --- | --- |
| `component_catalog_service.py` | Compatibility import and runtime singleton. |
| `component_catalog_service_postgres.py` | Concrete PostgreSQL connection, schema initialization, and database-specific overrides. |
| `component_catalog_domain.py` | Compatibility facade: the historical callable surface, delegating to collaborators in `catalog/`. |

`ComponentCatalogPostgresService` inherits `ComponentCatalogDomainService`,
owns PostgreSQL connection and schema setup, and passes PostgreSQL locks into
the shared collaborator graph in `catalog/collaborators.py`. The compatibility
facade owns transaction boundaries. The
behavior itself lives in `backend/app/services/catalog/`; read
`backend/app/services/catalog/AGENTS.md` for the layer map. To find where a
facade method lands, search the facade for the method name and follow the
`self._<collaborator>.` call. Public reads generally begin with `list_`,
`get_`, or `search_`.

Metadata batches (bulk grid edits and CSV imports) go stage → approve proposed
fields → apply → accounting in `catalog/metadata_batch_lifecycle.py`, which owns
one transaction per step. The facade's batch methods, which the API and the
`catalog_metadata_batch` worker call, forward to it through
`catalog_service.metadata_batch_lifecycle`.

Do not extend the inheritance split casually. When adding a cohesive capability,
first consider a narrow collaborator with a public API that both workers and
HTTP handlers can use; avoid creating another caller of private catalog methods.

## Schema migrations

Every PostgreSQL schema changes only through a numbered ledger.
`schema_ledger.py` is the one runner (ledger table, lock, renumbering, legacy
adoption, pending report); `schema_head.py` lists the ledgers in dependency
order and is what startup calls. Steps live per schema:
`workspace_schema_migrations.py` (bodies in `workspace_migrations/`),
`auth_schema_migrations.py`, `comments_schema_migrations.py`,
`catalog_schema_migrations.py`, `artifact_schema_migrations.py`. Add a step
rather than DDL in a service (see `docs/UPGRADES.md`); the one exception is the
catalog baseline and derived projections, reconciled on every start by
`ComponentCatalogPostgresService.initialize`.

## Catalog jobs

`catalog_worker_tasks.py` holds the `HANDLERS` table and declares one catalog
`JobKind` per entry (`CATALOG_JOB_KINDS`):

`catalog_validation`, `catalog_preview_generation`, `project_component_import`,
`folder_library_import`, `artifact_maintenance`, `catalog_metadata_batch`,
`catalog_model_glb` (System Builder STEP → GLB with Geometer).

Each task takes the `JobContext` and records resumable state with
`context.save_checkpoint(checkpoint=..., result=...)`; a retried attempt reads
`context.checkpoint` and `context.partial_result`. Tasks that checkpoint must
therefore tolerate resumption and must not duplicate completed work after a
lease is reclaimed. `catalog_job_service.py` shows a job in the catalog API's
shape.

## Rules that live here

- **Fail closed.** `rate_limit_service.py` explains why the limiter denies on
  outage rather than allowing. Do not invert it for convenience.
- **Host keys are pinned.** `git_remote_access.py` documents why
  `accept-new` was removed. Do not restore it.
- **Role-aware lookups only.** See the access-control section in the root
  `AGENTS.md`.
- **Audit identity comes from the session**, never from the request payload.

## A project at a revision

`project_revision.py` is the one place that decides where a project sits in its
repository (`locate`, `locate_id`), resolves a ref (`resolve_commit`), and
materializes files at a commit (`checkout`, `materialize`, with the
`FULL_TREE`, `KICAD_SOURCES` and `COMPARE_INPUTS` source sets). It reads Git
objects rather than `git archive`, and keeps only symlinks that resolve inside
the checkout. Do not add another `rev-parse --show-toplevel`, `.git` walk-up or
`git archive | tar` next to a caller. Remote transport (credentials, pinned host
keys, ls-remote) is `git_remote_access.py`.

Which files of a revision are design sources is one rule,
`project_revision.is_generated` (it builds on `kicad_noise_service.is_noise`,
which the desktop agent loads by path, so that module stays stdlib-only). Source
sets, the design-compare file list, the semantic-index cache key and its
schematic field overlay all apply it; do not add another suffix or autosave
filter next to a reader.

Project settings edited in Prism live in the workspace database
(`project_settings_service.py`) and win over the committed .prism.json file;
nothing writes into a checkout, because Sync fast-forwards only a clean tree.

## KiCad tools

`kicad_tools.py` is the only place that locates or starts `kicad-cli` and
`kicad-cruncher` (Settings `KICAD_CLI_PATH`, `KICAD_CRUNCHER_PATH`). Callers take
a `KicadTool` and state a timeout; do not add `subprocess` calls or path lookups
for them elsewhere. `kicad_tool_replay.py` records and replays runs for tests.

## KiCad library text

`kicad_library_reader.py` reads KiCad text without parsing geometry: form
ends, top-level symbol blocks and properties, footprint names (`footprint` and
legacy `module`), model references, and folder link resolution with an explicit
`ambiguous` outcome. Catalog uploads (`catalog/asset_files.py`), folder
discovery (`kicad_library_discovery.py`), folder import
(`library_folder_import_service.py`, built from the discovery result), project
component extraction and the semantic index use it. Do not add another
balancer or property regex.

## Design variants

`project_source_snapshot.py` resolves a working tree or an exact commit
(through `project_revision.py`) and keys it by the configured anchor; `variant_catalog_service.py` discovers the
ordered catalog from source text; `semantic_index_variants.py` resolves
effective default and per-variant occurrence/component/footprint state through
the pinned kicad-monkey helpers (applying the sheet fold and version gate the
resolver leaves to the caller); `semantic_index_service.py` publishes the
`assembly` block, joins it onto existing `componentUid`s, and hashes the three
modules into `GENERATOR_BUILD`. Resolver semantics belong to the frozen
design-variant contract packet (issue #169), not to this file.

## Design comparison

`design_compare_service.py` orchestrates; `design_compare_nodes.py` turns
the parser's object delta into change records; `design_compare_occurrences.py`
owns a revision's component occurrences (fields in the project BOM's mapping
and column names, sheet-folded `DNP` / `In BOM`, designator identity) and the
BOM rows built from them;
`design_compare_net_pairing.py` decides which nets correspond across
revisions; `design_compare_semantics.py` diffs nets, buses and sheet
instances (grouping into review items is the frontend's);
`design_compare_artifacts.py` persists output; `design_compare_sources.py`
resolves revisions. The object index and delta come from the Node package
`backend/design-compare-parser/` (`ecad-parse.mjs`, `ecad-diff.mjs`, the
vendored parser; `npm test` there). The correctness rules
for this pipeline are in
`frontend/src/components/design-comparison/AGENTS.md`, because most of the ways
to get it wrong are visible on the frontend side.

Settled (D24, D25): a change kind's category and primary/secondary stay on the
backend (`_node_classification`); the frontend kind table holds domain, noun
and traits only. There are two component ids on purpose: the project semantic
index keys a component by `(reference, symbol UUID)`, design comparison keys a
review row by designator (`component_uid(reference)`), because a comparison
matches parts across revisions where symbol UUIDs may change. Unifying them
would change every cached index's `componentUid` and the variant join.

One backend rule: the viewer must never infer the old route from the comparison
object (`design_compare_nodes.py`). Each revision carries its own geometry.

## System Builder

`systems/` implements `docs/system-builder/CONTRACTS.md`, and the contract
wins over code. `systems/store.py` is the only writer: every engineering
change goes through `SystemStore.mutation`, which locks the system, checks the
ETag version and writes audit events in the same transaction.
`systems/service.py` owns authorization and O1 redaction, and is the only
thing `backend/app/api/systems.py` calls. `systems/visibility.py` holds the
folder predicate, which must stay in step with
`WorkspaceService.get_project_for_role`. `systems/sources.py` is read-only Git
on the child clone. `systems/jobs.py` runs `systems/interface_extractor.py`
into the `system_interface_artifacts` cache; `systems/interface_cache.py` keeps
parsed artifacts in process (immutable, LRU by size; callers must not mutate
them, and the test suite verifies that). `systems/drift.py` is the pure
drift engine; `systems/detection.py` resolves tips after a fetch and applies
its outcome. Project sync queues detection after every successful fetch.
`systems/reconcile.py` validates and applies review decisions.
`systems/loaded.py` is one system as one transaction reads it: rows, interfaces,
tree, net level, placement and each caller's restricted set, each computed once.
Service reads build a `LoadedSystem` instead of re-reading rows or re-resolving
the hierarchy. `validation.report(loaded, mates=, scene_key=)` returns the whole
report, waivers included, in the order `validation.STAGES` declares; the
catalog's mate pairs are an input. Documents are built unredacted (`_build`) and
leave the service only through `_for_reader`/`_report_for_reader`
(`systems/redaction.py`); that is what lets a snapshot freeze one document and
`systems/icd.py` render frozen snapshots and diffs for any reader.
`systems/links.py` owns the link end rules (one of portKey/exportId, same port,
link type, sub-port membership, exported or linked ports, end pads) and the
link-shaped view of a mated harness end; the API, CSV import, manifest import
and the service go through it, and `systems/store_links.py` is the only code that
tells a harness end's ID from a link's. Both classes are one mixin per concept:
the store's `store_<concept>.py` (instances, placement, links, exports,
harnesses, subports, snapshots, reviews, renames) over `store_base.StoreCore`,
and the service's `service_<concept>.py` over three layers, `service_base`
(plumbing, catalog revisions, Git hooks), `service_reading` (`_load`, the
resolver `LoadedSystem` calls back, reader visibility) and `service_rendering`
(`_build` and the row renderers). A concept calls only its own and the layers'
private methods (`backend/tests/test_system_service_layers.py`).
`systems/csv_import.py` parses, classifies and writes connection CSV imports;
`systems/generators.py` proposes rows and never writes. A change to what the
extractor reports must bump `EXTRACTOR_VERSION`, since it keys the cache.
`backend/tests/test_system_e2e_replay.py` pushes the SYS-01 history to real upstreams
and runs sync, detection and reconcile end to end; run it after touching any
of these.

## Comments and issue publication

Every root and reply write goes through `comments_store_writes.py`: given the
caller's `ActorIdentity` it authorizes inside the write's transaction
(`comment_permissions.py`), mutates, records the revision and the change event,
and returns the thread with the actor's capabilities (`comment_capabilities.py`).
Routes only translate HTTP. Row writes shared with the tracker (inbound replies,
system notes, reply `sync_state`) are `comment_write.py`; edits, status and
tombstones are `comments_revisions.py`, which streams through
`comment_live_events.record_thread_change`. Do not write `comments` or
`comment_replies` anywhere else (`backend/tests/test_comment_write.py` enforces it).
`comments_store_service.py` holds reads, JSON import/export and project
deletion; `comment_anchor_bindings.py` preserves binding history.
`comment_live_events.py` appends durable metadata in the same transaction as a
mutation (tracker tables stream through the trigger in
`trackers/projection_events.py`); `comment_live_broker.py` wakes socket readers. Keep HTTP snapshots as
content authority and never let a tracker failure prevent local discussion.

`trackers/connector_runtime.py` turns a connector into its one status and its
adapters (and hands executors their database connection);
`trackers/providers.py` holds one kit per host with everything provider-specific
(instances, account linking, web URLs, issue and comment adapters, recovery
listing); `trackers/forge_client.py` is the adapters' shared HTTP helper.
Promotion, reply/thread/state executors, webhook inboxes, and polling live under
`trackers/`; provider-specific operations belong in a kit, never in generic
handlers. Tests plug `backend/tests/tracker_fault_harness.py` `StatefulFakeForge` in at
the runtime seam (`install_fake_provider`), not by patching executor privates. Read `docs/TRACKER_INTEGRATION.md` and
`docs/tracker-integration/CONTRACTS.md` before changing credential, idempotency,
remote recovery, or authorization behavior.
