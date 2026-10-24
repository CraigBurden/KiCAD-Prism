# Architecture

KiCAD Prism is a five-service Docker Compose application with PostgreSQL, project/asset storage, and SSH identity persistence.

## Runtime services

| Service | Responsibility |
| --- | --- |
| `frontend` | Nginx-served React application and reverse proxy |
| `backend` | FastAPI requests, authentication, authorization, and metadata APIs |
| `prism-worker` | project import, synchronization, comparison, visualization, and jobset work |
| `catalog-worker` | catalog import, validation, preview, release, and retention work |
| `postgres` | authoritative workspace, comments, catalog, operations, and session state |

Tracker connectors, encrypted credentials, project destinations, durable sync
operations, and inbound hint inboxes also live in PostgreSQL (`workspace` and
`comments` schemas). Outbound promotion and inbound reconciliation run as bounded
`tracker_*` jobs in `prism-worker`; admin and webhook endpoints run in `backend`.
Both services must share `TRACKER_CREDENTIAL_ROOT_KEY*` and `PUBLIC_BASE_URL`.
See [Tracker integration](TRACKER_INTEGRATION.md).

The frontend is the normal external entry point. It proxies API, OAuth, provider
metadata, and Remote Symbol Provider panel requests to the backend. A production
TLS proxy should route to the frontend instead of exposing the backend directly.

## Persistent data

The default Compose stack persists:

- PostgreSQL in the `prism-postgres-data` named volume;
- imported repositories and generated artifacts under `./data/projects`;
- the Prism-managed Git SSH key and `known_hosts` under `./data/ssh`.

Within `data/projects/.kicad-prism`, Prism stores design bundles, job artifacts
and logs, catalog asset objects, revisions, previews, KLC evidence, and DBL
exports. The old `semantic-index/` and `semantic-visualizer/` caches are removed
by a one-off startup cleanup ([ADR](architecture/adr-native-design-bundle.md) §8).

Job artifacts and catalog source objects share one content-addressed object
store, `.kicad-prism/artifacts/objects/sha256` by default
(`backend/app/services/object_store.py`). An object may be pinned by job
metadata (`ws_artifacts`, release pins) and by `catalog_artifacts` at once, so
the daily `artifact_maintenance` collection and catalog retention both ask
every registered owner before removing or moving a file.

Design bundles live in `.kicad-prism/bundles/<project>/<revision key>/`
([ADR](architecture/adr-native-design-bundle.md) §5): one
`<generator digest>.prism` archive per revision and generator, written by
`prism-kicad` and rewritten atomically at the end of each stage, and beside it
an unpacked cache that can always be deleted. `backend/app/services/design_bundle/`
is the only Python package that reads them; the workspace tables
`ws_design_bundle_commit_index`, `ws_design_bundles`, `ws_design_bundle_absences`
and `ws_design_bundle_flags` record keys, stages, use and the backfill's
findings. Bundles are rebuilt from Git, so they are a cache for backups.

All three persistence domains must be included in backup and restore procedures.
See [Operations](OPERATIONS.md).

## PostgreSQL schemas

The application separates concerns into PostgreSQL schemas:

- `workspace`: projects, folders, roles, sessions, service clients, tracker
  connectors, identities, and project destinations;
- `comments`: project and comparison discussions, tracked threads, sync
  operations, inbound remote hints, and comment attachment metadata (the
  files themselves are content-addressed under `COMMENT_ATTACHMENT_ROOT`,
  never in the project repository);
- `catalog`: component metadata, revisions, assets, validation, and release data;
- `operations`: jobs, leases, logs, artifacts, and runtime coordination.

Each schema's tables change only through a numbered migration ledger
(`backend/app/services/schema_ledger.py`); the backend brings every ledger to
head at startup through `schema_head.bring_every_schema_to_head()`, and workers
reach the same ledgers through the services they initialise. See
[Upgrades](UPGRADES.md) for the ledger tables and how to add a migration.

SQLite files may still appear inside generated KiCad DBL exports. Those are
delivery artifacts, not Prism's runtime database.

## Job execution

User-triggered work is recorded in PostgreSQL and claimed by workers using
leases, heartbeats, and fencing. The API returns job identifiers; the browser
polls job state and logs. Completed outputs are published into immutable job
artifact locations and surfaced through the Assets portal.

Each job kind is declared once, next to its handler
(`backend/app/services/job_kinds.py`): the worker pool (`prism` or `catalog`),
the resource slots it holds, the shape of its lock, its attempts and priority.
CPU-heavy kinds take separate slots (`import`, `design_compare`,
`design_bundle`, `workflow`, `semantic_compile`, `sim`, `catalog_kicad`) with
their own concurrency settings, so imports, design comparison, bundle builds,
simulations and jobsets do not consume unbounded resources. Tracker jobs take a
dedicated `tracker_sync` slot at a low priority.

Memory-heavy kinds also reserve units of the shared `memory` slot, one unit per
256 MiB of their measured peak: a design bundle build 2.25 GiB, a design
comparison 3 GiB, a Release Studio build 3.25 GiB, a jobset 1.25 GiB and a
simulation 1 GiB. The slot's capacity is `PRISM_WORKER_MEMORY_BUDGET_MIB`, so
jobs that would together exceed the worker's memory wait instead of being
killed (`backend/app/core/worker_memory.py`).

Some features keep their own rows next to the job (a Release Studio build
attempt). Their kind declares an end hook: success settles the row inside the
job's completion transaction, the runner and the supervisor call the hook after
any other terminal transition, and the prism worker sweeps once a minute for
rows whose job's process died before it could settle them. A design
comparison's hook relabels the domains its partial result still shows as
building as `failed` when its process died (an unfenced publish that applies
only to an ended job). Nothing traps SIGTERM; a cancel that kills the runner is
settled by the hook.

`/api/jobs/{id}` (status, events, artifact, cancel) is authorised by the job's
subject, never by who queued it, because enqueue deduplicates a second request
onto the first job: project jobs follow the project, import and analyze jobs anyone who may import, catalog jobs the catalog roles;
only a job with none of these is its requester's or an admin's.

## Project ingestion

Prism validates remote URLs before invoking Git. Analyze and import jobs discover
KiCad projects, support monorepos, preserve the selected branch, and register
project paths without turning Prism into the source repository.

The imported checkout is server-managed. Engineers should continue to edit and
push from their normal development clones.

## Viewer architecture

Schematic and PCB content is rendered through the bundled ECAD viewer, from the
source files in the revision's design bundle. Prism adds semantic selection
identity, cross-probe state, comment overlays, and comparison presentation.

The 3D tab draws the board analytically: the browser lowers the bundle's
`materialization/board.kmpack` with Prism's own WASM build of the parser
(`native/src/rs/prism-kicad-wasm`) in a worker, and loads the parts from the
bundle's `viewer/models/components.glb`, which `kicad-cli` exports in the
bundle's `models` stage (`backend/app/services/viewer_3d_bundle.py`).

Design bundles are caches and can be rebuilt from Git, but a cold build of a
large board takes minutes. Include `.kicad-prism/bundles` in backups only when
recovery time matters more than storage.

## Trust boundaries

- The browser receives a signed, opaque session cookie after OIDC or enabled
  local password login.
- KiCad Remote Symbol Provider access uses a separate OAuth2 authorization-code
  and PKCE flow with `remote_symbols.read`.
- Service clients use scoped bearer tokens and should be stored in a secret
  manager.
- Signed catalog asset URLs are time-limited bearer capabilities.
- The backend and workers can clone Git repositories and invoke KiCad tooling;
  keep them on a trusted network and do not expose their ports publicly.

See [Authentication and access](AUTHENTICATION_AND_ACCESS.md) and the
[Security policy](../SECURITY.md).
