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

Do not extend the inheritance split casually. When adding a cohesive capability,
first consider a narrow collaborator with a public API that both workers and
HTTP handlers can use; avoid creating another caller of private catalog methods.

## Catalog jobs

`catalog_worker_tasks.py` holds the `HANDLERS` table — the catalog worker's
equivalent of `job_handlers.py`:

`catalog_validation`, `catalog_preview_generation`, `project_component_import`,
`folder_library_import`, `artifact_maintenance`, `catalog_metadata_batch`,
`catalog_model_glb` (System Builder STEP → GLB with Geometer).

The catalog wrapper restores `catalog_checkpoint` and `catalog_result` into the
legacy handler envelope and persists updates reported through `progress`.
Handlers that report checkpoints must therefore tolerate resumption and must
not duplicate completed work after a lease is reclaimed.

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

`design_compare_service.py` orchestrates; `design_compare_nodes.py` parses;
`design_compare_net_pairing.py` decides which nets correspond across
revisions; `design_compare_semantics.py` classifies and groups;
`design_compare_artifacts.py` persists output; `design_compare_sources.py`
resolves revisions. The correctness rules
for this pipeline are in
`frontend/src/components/design-comparison/AGENTS.md`, because most of the ways
to get it wrong are visible on the frontend side.

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
`systems/reconcile.py` validates and applies review decisions, and
`systems/validation.py` computes the §7.2 findings. Documents are built
unredacted and redacted for the reader last by `systems/redaction.py`, which is
what lets `systems/icd.py` render frozen snapshots and diffs for any reader.
`systems/csv_import.py` parses, classifies and writes connection CSV imports;
`systems/generators.py` proposes rows and never writes. A change to what the
extractor reports must bump `EXTRACTOR_VERSION`, since it keys the cache.
`backend/tests/test_system_e2e_replay.py` pushes the SYS-01 history to real upstreams
and runs sync, detection and reconcile end to end; run it after touching any
of these.

## Comments and issue publication

`comments_store_service.py` owns local discussion writes; `comments_revisions.py`
and `comment_anchor_bindings.py` preserve revision and binding history.
`comment_live_events.py` appends durable metadata in the same transaction as a
mutation; `comment_live_broker.py` wakes socket readers. Keep HTTP snapshots as
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
