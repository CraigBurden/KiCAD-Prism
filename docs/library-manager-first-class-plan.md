# First-Class Library Manager Product and Implementation Plan

## Product intent

KiCAD-Prism Library Manager is the governed system for importing, authoring,
reviewing, releasing, and distributing reusable components to KiCad 10 and
newer. A component has a stable identity and immutable revisions covering its
metadata, symbol, footprint, 3D models, mappings, documents, and generated
previews.

Every explicit save creates an immutable `rN` revision. Approved revisions
receive a separate release label. Released content cannot be edited; it can
only be superseded, deprecated, or withdrawn through an audited workflow.

## Implementation status

The first production foundation is implemented on `feature/library-manager-first-class`:

- Metadata and asset saves create immutable revisions, with no-op suppression
  and optimistic revision conflicts.
- Revision manifests, hash-chained audit events, history APIs, two-person
  approval enforcement, and audited administrator overrides are available.
- PostgreSQL 17 is now the authoritative Compose catalog with bounded per-worker
  connection pools, serialized component heads, serialized audit sequences,
  trigram search, schema versioning, and database triggers that reject direct
  deletion or mutation of immutable evidence.
- The one-shot SQLite migration snapshots the source, retains every current
  identity and PLM sync field, verifies deterministic table hashes and all
  file-backed asset hashes, inventories the complete preview tree, and records a
  marker only after verification. Historical releases receive deterministic
  `legacy_snapshot` release records.
- Conflicting logical asset paths retain prior bytes through content-addressed
  revision storage.
- Rendered symbol/footprint previews are append-only, content-addressed
  artifacts bound to exact component revisions. New A1 manifests hash preview
  bytes and generator identity; every migrated A0 manifest remains unchanged.
- Project import sessions capture the authorized project set and resolved Git
  revisions at job creation.
- Background semantic scans create deduplicated, provenance-preserving import
  proposals for selected components, one project, or all projects.
- Project scans walk each captured project snapshot once, index embedded
  schematic symbols and PCB footprints by UUID/reference, cache local 3D model
  reads, and deduplicate staged bytes by SHA-256 across the import session.
- Proposal acceptance atomically creates one draft revision, preserves custom
  KiCad fields, and updates an existing manufacturer/MPN match instead of
  duplicating the component.
- The Visualizer selection inspector can queue the selected component into this
  project-import pipeline.
- A route-level Import Center now supports project/all-project scans, session
  progress, findings, staged asset review, and accept/reject actions alongside
  the new server-paginated Catalog workspace.
- Import remediation can complete required metadata, select one primary symbol
  and footprint when projects disagree, and include multiple 3D/SPICE assets in
  one immutable revision.
- The deep-linked Component workspace provides revision-aware metadata and
  asset editing, validation, derived preview regeneration, Overview, immutable
  Revisions/Compare, Release Review, Where Used, and verified Audit views.
  Optional evidence loads lazily and cannot block basic component access.
- Symbol and footprint previews regenerate automatically when a component
  revision is finalized. They remain revision-linked comparison outputs, including
  every symbol unit, without participating in version or manifest identity.
- The route-level Release Queue uses server-side search/filter/pagination,
  shows queue-wide evidence blockers, and opens the exact immutable revision
  for a structured decision without downloading the entire queue.
- Revision comparison covers metadata, symbol, and footprint changes. 3D and
  SPICE files remain hashed/versioned release assets but intentionally do not
  receive visual diff tooling.
- Semantic project scans update revision-pinned Where Used observations even
  when an import proposal is not accepted; the API filters usage to projects the
  caller can read.

The next slice delivers browser/server-root folder snapshots, a PostgreSQL-
leased worker, and local content-addressed artifact storage. Prism remains a
local deployment for small engineering teams (up to roughly 100 concurrent
users); it does not require a desktop companion, Redis, S3, or autoscaling.
REST/SQL imports are intentionally one-shot migration snapshots. PLM and
database export remain a later design pass. The old monolithic Library Manager
is no longer part of the primary navigation.

### Measured migration and read performance

The production-shaped rehearsal used the current 23,743-component catalog
(23,743 revisions, 17,037 assets, 47,484 revision links, 5,450 validation runs,
and 20,026 findings):

- Lossless PostgreSQL v4 migration and full verification: **47.2 s** for 185,004
  copied rows, 23,742 synthesized legacy release records, 30 legacy preview
  versions, and 453 revision-preview links.
- A matching-marker `--if-needed` startup does not recopy rows or compare the
  frozen SQLite snapshot with legitimately evolved PostgreSQL workflow state;
  first-cutover evidence remains in the durable migration report and marker.
- Exact MPN search: **24.8 ms p95**.
- Broad text search: **32.4 ms p95**.
- Component detail: **5.8 ms p95**.
- Dense 50-row admin page with batch validation evidence: **53.5 ms p95**.

These are local PostgreSQL 17 measurements, not the final 100,000-component / 100
concurrent-user acceptance run.

## Product principles

- KiCad remains the geometry editor. Prism edits metadata, aliases,
  classifications, asset associations, and pin/pad/model mappings.
- Imports are non-destructive and enter a staged review flow. Nothing imported
  from a folder, project, database, or HTTP service is automatically released.
- Parseable but incomplete content is quarantined with actionable issues rather
  than rejected.
- Each source declares field and lifecycle authority. Conflicts are visible and
  never resolved through silent last-write-wins behavior.
- KiCad clients consume precomputed immutable releases. Search and placement
  requests never parse or regenerate EDA assets synchronously.

## Core workflows

### Revision and release workflow

Use `Draft -> Submitted -> Technical review -> Approved -> Released`, followed
by optional `Deprecated` or `Withdrawn` states.

- Browser autosave remains local until **Save revision** is selected.
- A save may atomically group related metadata and asset edits into one
  revision.
- Canonically identical no-op saves do not create revisions.
- Authors cannot approve their own revisions. An administrator override
  requires a reason and creates a prominent audit event.
- Revision manifests contain the parent revision, actor, timestamp, change
  summary, source provenance, tool versions, and hashes for all associated
  content.
- Preview regeneration never creates a component revision. Preview bytes and
  generator identity are revision-bound derived evidence; validation reruns,
  review comments, and lifecycle transitions are audit evidence rather than
  component-content revisions.

### Local KiCad library import

Expose explicit one-time folder snapshots in the Prism Import Center. There is
no separate desktop application.

1. The user chooses a folder in the browser, or an administrator selects a
   subdirectory beneath a configured read-only server import root.
2. Prism uploads/copies and hashes files into an immutable staging snapshot
   without modifying the source folder.
3. Prism discovers packed `.kicad_sym`, unpacked `.kicad_symdir`, `.pretty`,
   STEP, WRL, SPICE, datasheets, and KiCad library tables.
4. An import session presents component candidates, inferred relationships,
   duplicates, safe sanitation steps, and unresolved issues.
5. Accepted proposals create draft revisions.

Duplicate resolution uses content hashes, normalized manufacturer part
numbers, external IDs, asset identities, and configured aliases. Ambiguous
matches require an explicit user decision.

### Import components from Prism projects

Project-derived import is a first-class source alongside folders, CSV, REST,
and SQL/ODBC.

Supported entry points:

- **Import from this project** scans the selected project and source revision.
- **Import from all projects** starts a resumable background scan across every
  project the user is authorized to read.
- **Import into Library** in the Visualizer selection inspector stages the
  currently selected component.

The project extractor resolves, where available:

- Symbol definitions embedded in the schematic and their source library IDs
- Symbol fields, aliases, units, pins, and project overrides
- Instantiated footprints and their source library IDs
- Pin-to-pad associations
- Referenced 3D models after resolving KiCad path variables and project-relative
  paths
- Datasheets and other explicitly linked documents
- Project ID, source commit, schematic/PCB UUIDs, references, and extraction
  tool version as provenance

Project extraction follows these rules:

- The source snapshot is the explicitly selected commit. For an all-project
  import, each project uses its current synchronized/default revision captured
  at job creation.
- Repeated references using the same logical part become one proposal with a
  usage count and provenance list.
- Cross-project candidates are deduplicated by external identity and canonical
  content hashes, not reference designator.
- Missing source libraries do not block extraction when a usable symbol or
  footprint definition is embedded in the project.
- Unresolvable models, path variables, conflicting overrides, and incomplete
  mappings become import findings.
- Existing released matches offer **Open in Library**. Content differences
  offer **Propose new revision**. Otherwise the action is **Create component**.
- Bulk project imports remain staged until a user reviews and commits their
  proposals. They never auto-release components.

The Visualizer action reuses its normalized component selection identity. It
opens a compact import flow containing the extracted symbol, footprint, model,
metadata, duplicate match, and validation summary. The user may confirm it
without leaving the Project Detail page or open the full Import Center for
remediation. The placeholder currently shown in the right-side selection panel
becomes this action.

### External systems and KiCad delivery

HTTP and SQL/ODBC sources are one-shot migration inputs. Prism captures the
current metadata and KiCad assets, stages them for review, and becomes the
system of record after acceptance. Continuous synchronization, webhooks, PLM
authority rules, and database export are deferred until their product contract
is agreed.

The first delivery and integration paths are:

1. KiCad HTTP Library metadata delivery plus matching immutable symbol,
   footprint, and model packages
2. Generic REST snapshot importer
3. SQL/ODBC snapshot importer for existing database-library deployments
4. Existing Prism Remote Symbol Provider backed by immutable releases
5. KiCad DBL export as a compatibility path

## User experience

Replace the monolithic manager with route-level workspaces:

- **Catalog**: virtualized table, faceted search, saved views, and bulk actions
- **Component**: Overview, EDA Assets, Mappings, Revisions, Reviews, Sources,
  Usage, and Audit
- **Import Center**: Folder, Project, All Projects, CSV, REST, and Database
  sources; quarantine; duplicates; bulk remediation
- **Release Queue**: assigned reviews, visual diffs, findings, and approvals
- **Migration sources**: reusable HTTP/SQL snapshot mappings and import history
- **Administration**: policies, validation profiles, labels, and retention

The project import UI must show scan progress, allow cancellation/resumption,
support per-project filtering, and make provenance visible before commit. Large
result sets use server pagination and virtualization.

## Architecture and contracts

Use PostgreSQL for transactional catalog data, workflow, audit, permissions,
job leases/checkpoints, import state, and the denormalized search read model.
Store artifacts in a local content-addressed store on the deployment volume.
A single worker service claims jobs with `FOR UPDATE SKIP LOCKED`, maintains a
lease and checkpoint, and resumes abandoned work after lease expiry. The
default worker runs at most two jobs concurrently and at most one KiCad-heavy
process. No Redis, message broker, S3 service, dynamic scaling, or cloud control
plane is required. Retain SQLite only as a compatibility/development mode for
non-catalog features.

Released source artifacts are retained indefinitely. Unreleased draft source
artifacts may be archived after 90 days, derived previews are regenerable, and
garbage collection always quarantines before deletion. Large STEP files are an
explicit exception: when a newer component revision supplies a replacement
STEP file, the older STEP bytes may be purged and the historical revision marks
that asset unavailable rather than retaining or archiving it.

Core public identities are:

```ts
type ComponentRevisionId = { componentUid: string; revision: number };

type ProjectComponentSource = {
  projectId: string;
  sourceRevision: string;
  schematicUuids: string[];
  pcbFootprintUuids: string[];
  references: string[];
  extractionVersion: string;
};

type ProjectImportRequest = {
  scope: "component" | "project" | "all-projects";
  projectId?: string;
  sourceRevision?: string;
  selection?: {
    componentUid?: string;
    reference?: string;
    schematicUuid?: string;
    pcbFootprintUuid?: string;
  };
};
```

Every mutation requires an idempotency key and expected head revision. Stale
updates return a structured conflict. Import sessions and proposals are durable
and resumable; their source snapshot cannot change after creation.

Split the current catalog implementation into catalog/revision, release/policy,
artifact, validation, import, project extraction, connector, search/read-model,
KiCad delivery, and audit modules.

## Delivery phases

### Phase 1: immutable foundation

- Introduce revision manifests, release records, optimistic concurrency,
  append-only audit events, and two-person approval.
- Migrate existing component IDs, revisions, released pointers, and assets.
- Move the production catalog to PostgreSQL and local content-addressed storage.
- Make the current Remote Symbol Provider consume released manifests only.

### Phase 2: Import Center and project extraction

- Implement durable import sessions, quarantine, duplicate resolution,
  sanitation, and reusable field mappings.
- Add browser-upload and configured read-only server-root folder snapshots.
- Add selected-project and all-project extraction jobs.
- Wire Visualizer **Import into Library**, **Open in Library**, and **Propose new
  revision** actions to the same import pipeline.
- Generate previews and validation asynchronously.

### Phase 3: KiCad-native distribution

- Ship KiCad HTTP Library endpoints and generated `.kicad_httplib`
  configuration.
- Publish immutable `.kicad_symdir`, `.pretty`, model, and metadata packages.
- Add caching, scoped tokens, ETags, and rate limits.

### Phase 4: migration sources and future integrations

- Ship generic one-shot REST and SQL/ODBC snapshot importers.
- Defer continuous PLM synchronization and database export until their product
  and authority model is agreed.

## Acceptance and scale tests

- Every committed metadata or asset change creates exactly one immutable
  revision; no-op saves create none.
- Released bytes and manifests cannot be mutated.
- Authors cannot approve their own releases.
- Importing imperfect libraries or projects produces actionable staged findings.
- Folder import never modifies its source.
- A component selected in SCH, PCB, 3D, or BOM can be staged from the Visualizer
  panel when its project source can be resolved.
- A project import deduplicates repeated references while retaining usage
  provenance.
- All-project import is resumable, permission-aware, idempotent, and
  deterministic for its captured project revisions.
- Existing components are offered as matches and changed content creates a new
  revision proposal rather than a duplicate component.
- Repeating an identical migration snapshot is idempotent.
- KiCad delivery exposes only released, non-withdrawn revisions.
- Search and filters remain below 250 ms p95 with 100,000 components and 100
  simulated concurrent designers.
