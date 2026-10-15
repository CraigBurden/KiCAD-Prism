# System Builder P2 — contracts

**Version P2-1.96 · 2026-10-15 · tickets SB2-00 to SB2-125.** §0 choices S1–S8 were signed off by the user on 2026-09-30, with S6 revised. The M1 choices T1–T7 (§0.1) were signed off by the user on 2026-09-30.

This document extends [CONTRACTS.md](CONTRACTS.md) (P1, v1.12) and never overrides it
silently. Where P2 changes a P1 rule, the P1 section is named and the change is listed in §19.
The plan and decisions (D-P2-1 … D-P2-24) are on the audit board
`audit-reports/system-builder-p2-2026-09-30/PLAN.md`.

Changing a rule here is a contract revision: bump the version, record it in §19, and re-run
the affected goldens.

Machine-checkable parts:

| Artifact | Path |
|---|---|
| Manifest models (the source of truth) | `backend/app/services/systems/manifest_schema.py` |
| Generated JSON Schema | `docs/system-builder/schemas/system_manifest.v1.schema.json` |
| Example manifests | `docs/system-builder/examples/manifest-child-cndh.json`, `manifest-parent-bus.json` |
| Contract tests | `backend/tests/test_system_manifest_schema.py` |

Regenerate the schema with:

```bash
cd backend && venv/bin/python -m app.services.systems.manifest_schema > ../docs/system-builder/schemas/system_manifest.v1.schema.json
```

---

## 0. Choices made in this contract that need sign-off

These defaults were not settled explicitly in the grilling. Each is marked **[S#]** where
it appears.

| # | Choice | Why |
|---|---|---|
| S1 | A harness is **not** a link type. `system_links.type` is `unspecified` \| `b2b`. Pressing **H** or converting a link creates a harness object (§6.3), whose wires replace the link's rows. | One place for pin pairs per connection; avoids a link that is secretly a harness. |
| S2 | One system publishes to **exactly one** catalog `assembly` component, bound on first publish. Publishing the same snapshot twice returns the existing revision. | Stable IPN per subsystem; idempotent retries. |
| S3 | Depth counts **system levels including the root**: root → child → grandchild → great-grandchild is depth 4, the maximum. | A clear reading of "depth 4". |
| S4 | The power-meets-signal finding needs a per-pin **power-net flag**. Extractor **v5** (in M0, SB2-08) adds only that flag. The connector geometry planned as "v5" becomes **v6** (SB2-11). | Connector pins are usually `passive`, so pin types can't tell power from signal. |
| S5 | The name-mismatch finding (V09) compares **tokens**, not whole names (§8.3). `/SPI_SCK` meets `/SCK_IN` → shares `SCK` → no warning. `TM_MON` meets `GND_3` → warning. | Whole-name comparison would warn on nearly every link. |
| S6 | **Revised by the user:** canvas layout is **in** the manifest (`layout`), frozen by snapshots and (M7) committed to Git, like a Vivado block design. It is excluded from the connectivity digest and included in the full digest. Live layout edits still take no If-Match and write no audit event (P1 invariant 6, revised in §9.5). | A saved arrangement is shared work other users should see and get back from a snapshot; it is still never an engineering change. |
| S7 | A child system hidden from the reader shows its **catalog interface** (export names and pin numbers) but no internals, and its export pin nets are redacted if the board behind the export is hidden. | Consistent with catalog readability (D-P2-24) and P1 per-board redaction. |
| S8 | **Viewers** gain catalog read (D-P2-24). The SB2-02 test lists every catalog read route that opens up; inventory and provider tokens stay writer-only. | User decision 2026-09-30; guarded by a test. |

### 0.1 M1 packet (SB2-10) choices, signed off 2026-09-30

| # | Choice | Why |
|---|---|---|
| T1 | **Board frame** origin is KiCad's page origin, y flipped up, z out of the front, **z = 0 at the board mid-plane** (§14.2). | Extractor numbers come straight from the file; top and bottom connectors are symmetric (±t/2); the 3D bundle's own centring is absorbed by a per-asset offset in M2. |
| T2 | **Inference has three confidences** (§15.1). A footprint without `_Vertical`/`_Horizontal` still infers from geometry (body over the pads → vertical) at `medium`. Right-angle axes are named in the **footprint's** frame, so they survive any footprint rotation. | The JTYU mezzanines (Samtec FTSH, SEAF8, ADM6) have no orientation keyword; name-only inference would ask for details on every real B2B. |
| T3 | **Auto-placement uses only confirmed or override frames**; inferred ones are one click from confirmed. A confirmation records the port's geometry digest and goes **stale** (info `SYS-V17`) when the footprint moves (§15.2). | PLAN risk table: confirmation is mandatory before placement; a moved connector must not keep a silently wrong frame. |
| T4 | **Conversions** (§16.1): link → harness always works (rows become wires); harness → link only for 2 ends, no splices, identity pin maps. | Round-trips without losing information; anything richer stays a harness. |
| T5 | **Stack height lives on the B2B link**, not on each port (§16.2); the frozen manifest shape moves `stackHeightMm` from `mating[]` to `links[]` (no data had it yet). | It is a datasheet property of the mated pair; two per-port values could disagree. |
| T6 | **A port is mated once** (§16.2, §17.2): by one `b2b` link, or one harness end, never both (409 `port_already_mated`). `unspecified` links stay as free as in P1. | A physical connector mates one thing; documentation links keep P1 behaviour. |
| T7 | **Board connector part** is found by the component's MPN field matched to a catalog `part` (§18). Mates-with findings are `SYS-V18` (warning, unknown pair) and `SYS-V19` (error, pin count without a map); unknown parts are "not evaluated". | Uses data the boards already carry; never guesses a part from a footprint name. |

---

## 1. Scope

P2-1.0 freezes what **M0** needs, and the shapes later milestones must fit:

- catalog kinds and publishing (§3);
- exports and the export interface (§4);
- the hierarchy of systems (§5);
- links to exports, link types and harness objects (§6);
- child drift (§7);
- system nets and findings (§8);
- the manifest and digests (§9);
- ICD changes (§10);
- API, errors and audit (§11–§13).

Placement conventions (frames, units, quaternions), mating, link types, harness behaviour and "mates with" are frozen by SB2-10 in §14–§18. Harness geometry numbers are frozen in §17.5 (SB2-40) and the Git model in §21 (SB2-52). Before them, the manifest carries their fields with the shapes in §9, but not their math.

## 2. Identity

### 2.1 New portable IDs

The format is P1 §2.1's: a prefix plus 32 lowercase hex characters.

| Object | Prefix |
|---|---|
| Export | `sxp_` |
| Harness | `shn_` |
| Harness end | `she_` |
| Harness wire | `shw_` |
| Harness node (breakout or waypoint) | `shd_` |

Catalog IDs keep the catalog's own formats; the manifest treats them as opaque strings.

### 2.2 Occurrence path

A **board occurrence** is one physical board somewhere in a hierarchy. Its identity is the path of instance IDs from the root system's instances downwards:

```text
occurrence_path = "/" + "/".join(instance_ids)      e.g. /sin_…A/sin_…C
display_path    = " ▸ ".join(labels)                 e.g. CNDH-A ▸ CMBD
```

- The first ID is an instance of the root system; each later ID is an instance inside the child named by the previous one.
- Only IDs are identity. Labels are display, and renaming never changes a path.
- A repeated child (CNDH-A, CNDH-B) gives distinct paths for the same inner instance.
- Everything below the root keys on occurrence paths: system nets, 3D picking and poses, search and ICD grouping.

## 3. Catalog kinds and publishing

### 3.1 Kinds

`components.kind` is `part` (default; every existing component) \| `module` \| `assembly`.

| Kind | Identity | Revision payload | DBL export / KLC |
|---|---|---|---|
| `part` | MPN or provisional IPN (unchanged) | unchanged | unchanged |
| `module` | MPN (bought) or IPN | `interface` (units = connectors) + STEP model (M6) | excluded |
| `assembly` | IPN | `interface` (units = exports) + `source_ref` | excluded |

- **IPN identity (P2-1.2):** an IPN is stored as the catalog's existing `provisional_ipn` identity, with `identity_source = "prism"` and the IPN as the internal part number. This reuses identity uniqueness without touching the catalog's 34 identity checks.
  - For `module` and `assembly`, approval and release accept that identity, in both the Python gate and the database trigger (integrity guards v5).
  - The UI shows such items by kind and never labels them "provisional".
- **Required metadata:** `value` = IPN, `category` = `Assemblies` or `Modules`, and `manufacturer` and `datasheet_url` are required as for parts. Publish passes the organisation name and the system's Prism URL.
- The `kind` of a component never changes after creation (`components.kind`, catalog migration 3, `CHECK` constrained).
- **Hash stability:** the revision payload is stored in `interface_json` and `source_ref_json` (JSON text). Both are left out of the revision manifest hash while empty, so every revision hashed before migration 3 keeps its hash.

### 3.2 Assembly revision payload

- `source_ref`: `{"kind": "system_snapshot", "systemId", "snapshotId", "fullDigest", "connectivityDigest", "openReviewCount", "hierarchyValid", "children": [{"componentId", "revisionId"}]}`. M7 adds `{"kind": "git_commit", …}`.
  - The last three are copied at publish so release gates read **only catalog data**. In CI, and possibly in deployments, the catalog lives in another database than `system_snapshots`. Snapshots are immutable, so the copy never goes stale.
- `interface`: the snapshot's **export interface** (§4.3), computed once at publish and immutable.

A revision **never copies** the manifest. Readers load the snapshot through `source_ref`.

### 3.3 Publish

`POST /api/systems/{id}/snapshots/{sid}/publish`, with body `{ipn?, name?, description?}` on the first publish (creating the component) and `{}` after.

- **Who:** designer on the system (P1 §8.2) **and** `CATALOG_WRITE_ROLES`.
- **Generated symbol (SB2-51b, D-P2-41):** every publish attaches a multi-unit KiCad symbol to the new revision (`catalog/assembly_symbol.py`), replacing the previous publish's. Assemblies and modules then look alike in the catalog and in KiCad.
  - Library `Prism_Assemblies`; the symbol is named after the IPN.
  - One unit per resolved export, named after it.
  - One pin per pad: numbered by pad and named by the pad's net (the last path segment; `~` when unconnected). Power nets are `power_in` pins; everything else is `passive`.
  - The symbol is not required for release. Changed content goes to the catalog's content-addressed path, so older revisions keep their own symbol.
  - KiCad 10.0.6 opens it (`kicad-cli sym upgrade` and `sym export svg` in the tests).
- **Effect:** creates a new `component_revisions` row in stage `open`, with `change_kind = "publish"`.
  - On the first publish it creates the `assembly` component and binds `system_projects.catalog_component_id` **[S2]**.
  - The normal catalog workflow then applies (`open → in_progress → qa_review → done → released`).
- **Idempotent:** a unique constraint on (component, snapshotId). Re-publishing a snapshot returns the existing revision with 200; a new publish returns 201.
- **Two stores, retry-safe:** the catalog and workspace schemas share one database, but are written by different services. The order, under the system lock (no version bump):
  1. the catalog revision;
  2. the binding (`system_projects.catalog_component_id`, workspace migration 32);
  3. the audit event `snapshot_published`.

  If the system is unbound, publish first looks for an active assembly whose revisions name this `systemId` and adopts it. So a first publish that crashed after step 1 is never duplicated.
- **Refusals:**
  - 403 when the caller lacks `CATALOG_WRITE_ROLES`, or when the snapshot names a board the caller cannot see (a published interface must be complete);
  - 422 for a P1 snapshot without a manifest, a snapshot with no exports, an unresolved export, or a first publish without an IPN;
  - 409 when the IPN is already taken;
  - 409 `interface_not_ready` while a board is extracting.
- **Response:** 201 with `{componentId, revisionId, version, releaseStatus}` for a new revision, 200 with the existing one on a re-publish.
- **Assembly metadata:** `value` = IPN, `name` (default: the system name), `manufacturer` (default `In-house`), `description` (default: the system description), and `datasheet_url = /systems/{id}` (the in-app link).
- **Snapshot metadata** gains `publication: {componentId, revisionId, version, releaseStatus} | null`, read from the catalog on a best-effort basis (a catalog failure never breaks the listing). The system summary gains `catalogComponentId`.
- **`source_ref` also carries `snapshotName`.** Until SB2-05, `hierarchyValid` is true and `children` is empty.
- **Release gates** for `assembly` (`catalog/system_items.assert_release_gates`), each fail-closed, replacing the part gates (default representation, KLC):
  - the source snapshot is present (`source_ref.kind = "system_snapshot"`);
  - `source_ref.openReviewCount` is 0;
  - `source_ref.hierarchyValid` is true;
  - every `source_ref.children` revision is `released` (checked in the catalog);
  - the interface is non-empty.

  A `module` needs a non-empty interface and a STEP model (§3.5).

**Deleting a published system (D-P2-29, D-P2-31; P2-1.38).** A catalog revision resolves its boards through the snapshot it was published from. A parent snapshot freezes the revisions it used. So `DELETE …/systems/{id}` **archives** the system while anything references it:
- its catalog component is active;
- a live system instance pins one of its revisions;
- a parent snapshot's manifest (or, before manifests, its document) pins one.

An archived system has `archivedAt` set. It is left out of every system list but stays readable by ID, and every change answers 409 `system_archived`. Source checks and child auto-advance skip it, and its snapshots stay. With no reference, the system and its snapshots are deleted as before, including on a second `DELETE` of an archived system once its references are gone. The answer is 200 `{deleted, archived, references: {activeCatalogComponent, parentInstances, parentSnapshots}}`, replacing the 204 and the 409 `published_in_catalog`.

### 3.5 Modules (SB2-48, D-P2-39)

A `module` is a bought-out unit (a sensor, a radio, a power brick) used in systems, never on a PCB. It is an ordinary catalog component of kind `module`, created and edited through the normal component flow and page (`POST /api/catalog/components` with `kind: "module"`; identity as for parts: the MPN, or a provisional IPN for an in-house unit). It is excluded from the DBL export and KLC like assemblies.

- **The symbol is the interface.** A module carries exactly one KiCad symbol whose **units are its connectors**. Importing a symbol into a module **replaces** the old one on the new revision (assets, previews and representations), rather than adding a second; SB2-51 fixed a revision keeping both, so the interface came from either. Every time a module revision is sealed (created, symbol or model attached, metadata edited) its `interface` is derived from that symbol (`catalog/module_interface.py`) as `prism.module_interface.v1`: `{schema, units: [{key, unit, name, pins: [{pad, name, signal, powerNet}]}]}`.
  - `key` is KiCad's unit letter (A, B, … Z, AA, …) and names the connector for ports and links; `name` is the unit's name in the symbol, else `Unit A`.
  - A pin's number is its `pad`; its **name is its `signal`** (its net in system nets, SB2-50; KiCad's `~` is no name); `power_in`/`power_out` pins are power nets. The alternate (De Morgan) body style is ignored.
  - Refused (the interface has no units and an `error` saying why): no symbol, an unreadable symbol, pins common to all units (unit 0), a pad number used twice within one unit (each connector numbers its own pads, so pad 1 repeats across units), more than 32 units.
- **Models.** A module carries STEP models like a part; conversion, alignment and previews (§18.2) work on modules. "Mates with" stays between parts. Where each connector sits on the module is SB2-48b (D-P2-40).
- **Release gates:** an interface with at least one unit (else the derivation's `error` is quoted) and at least one STEP `3dmodel` asset.
- **Page.** A module uses the part page; its overview shows the derived connectors (read-only: edit the symbol to change them) instead of "mates with", and the models panel.
- **Revision clones keep the payload.** Any clone of a revision copies `interface_json` and `source_ref_json`, for modules and assemblies alike. *(Before P2-1.56 a clone dropped them.)*
- **Fixtures** use a made-up two-unit module symbol (D-P2-38).

### 3.6 Connectors placed on modules (SB2-48b, D-P2-40)

Each unit of a module's symbol is a connector, and that connector is a **catalog part** placed on the module's model. The part's footprint gives the pads, pin 1 and the mating frame; its model (if converted) gives the body. Board, module and assembly ports are then all "a connector part at a pose".

- **Placement** (`placement/module_ports.py`, twin `module-ports.ts`, goldens `modulePorts`): `{originMm: [x, y, z], normal: [x, y, z], quarterTurns: 0..3, axis: AXES | null}` in the **module frame**, i.e. the module's model after its alignment (§18.2).
  - `normal` is the face's outward normal, stored normalised.
  - `axis` overrides the part's inferred mating axis (§15.1); unknown → `top`.
- **Face frame `P`:** origin `originMm`; z is the normal; x is module +x projected onto the face (module +y when the normal is closer to x than to y); then `quarterTurns` rotate x → y about z.
- **Footprint pose:** `P · F_part⁻¹`, where `F_part` is `connector_frame(geometry, 0, axis)` on the part's footprint at the origin. The part's mating frame therefore lands on `P`: its mating axis points out of the face and pad 1 lies on the face's −x side. A module port is "a footprint at this pose on a zero-thickness board", so mates (§14.5), harness ends (§17.6) and checks reuse the board code.
- **Storage:** catalog migration 7 `catalog_module_connectors(component_id, unit_key, part_id, placement_json, updated_by, updated_at)`, keyed by `(component_id, unit_key)`. Like model alignment, a placement belongs to the component, not to a revision. A placement whose unit the symbol no longer has is reported as an orphan and ignored.
- **Part revision** (catalog migration 10, `part_revision_id`). Placing a part on a unit records the part's current revision. The connector's footprint (pads, frame, pose), model, name and MPN come from that revision, so a newer revision of the part never moves the module's ports. Moving or turning the same part keeps the recorded revision; placing another part, or `updatePartRevision: true`, takes the part's current one (the Connectors panel's "Use the part's current revision", shown while they differ). Placements made before migration 10 took the part's current revision then. Artifact maintenance keeps that revision's STEP files: the catalog worker adds the recorded revisions to the pinned set it passes the purge (with System Builder's pins), which both the candidate query and the re-check under the asset lock honour.
- **API** (browse to read, catalog writers to change; 404 unknown component or unit, 422 otherwise):
  - `GET /api/catalog/components/{cid}/module-connectors` → `{units: [{key, name, pads, connector: {part, placement, geometry, footprintPose, model, missingPads, updatedBy, updatedAt} | null}], orphans, complete}`. `part` is `{componentId, revisionId, currentRevisionId, name, mpn, manufacturer}` at the recorded revision. The units are the current revision's; a module instance reads its pinned revision's (§5.6).
  - `PUT …/module-connectors/{unitKey} {partId, originMm, normal, quarterTurns, axis, updatePartRevision?}` places or moves the connector. The part must be an active `part` whose footprint has pads, and the footprint must carry every pad of the unit. Audited as `component.module_connector_placed`.
  - `DELETE …/module-connectors/{unitKey}`, audited as `component.module_connector_removed`.
  - `GET /api/catalog/components/{cid}/connector-geometry` → `{geometry, model}` for a part: its footprint geometry at the origin (§14.6) and its first converted model `{glbKey, boundsMm, alignment}`.
- **Release gate** (§3.3, modules): every unit has a placed connector whose footprint carries the unit's pads.
- **Placing in the UI** (user decision 2026-10-08: the system viewer, not a second 3D engine): the module overview's Connectors panel opens a picker that shows the module in `<prism-semantic-viewer mode="system">` (§20.18).
  - Click a face to place the connector there. A hit on a surface facing well away from the viewer (the wall of a connector's opening) means the module face toward the viewer.
  - Then the board move gizmo (§20.4) slides it along the face (two arrows; Shift for 0.1 mm) and its one ring turns it a quarter at a time; R / Shift+R and the panel's buttons turn it too, and the numbers can be typed.
  - View buttons look square at each face. The connector shows its part's model (else its body box) with pin 1 as a red marker; the module's other connectors are grey.
  - The viewer is page-global (one per page), so the picker runs only where no other viewer is mounted (the catalog page).

### 3.4 "Mates with" (M1; shape frozen here)

`catalog_mates_with(part_a, part_b)` is stored once with `part_a < part_b`, read in both directions, and only between `part` components. The M1 behaviour (suggest, warning, error) is in PLAN D-P2-13.

## 4. Exports

### 4.1 Definition

An export is `{id, name, description, target}`:
- **`target`:** either a board port of the same system (`{instanceId, portKey}`), or a **re-export** of a child's export (`{instanceId, exportId}`), so a mid-level system can pass a grandchild's connector up.
- **Names:** unique per system, case-insensitive, 1–100 characters.
- **Stable ID:** an export ID never changes. Retargeting an export keeps its ID and is an audited change.

### 4.2 Rules

1. **An export's port must be free.** A board port that is an end of any link in the same system cannot be an export target (409 `export_port_linked`), and linking an exported port is refused the same way. The exception, a harness splice, arrives in M1: a port mated by a harness end whose harness sets `allowExport` (M1 contract revision).
2. **An export's port must be exposed** (P1 §4.2), otherwise 409 `port_not_exposed`.
3. **A re-export needs an assembly instance.** Its target must be an assembly instance's export at that instance's pinned revision.
4. **Deleting an export is allowed.** Parents learn of it as `export_missing` in child drift (§7).
5. At most **200 exports** per system (422 `export_limit`).
6. **Removing a board that carries exports** gives 409 unless `?cascade=links`, which also deletes its exports (each audited `export_deleted`).
7. **A port export stores the port baseline** (like a link end) and resolves by `memberKeys` intersection at the board's baseline.
   - When a baseline advances (auto-advance, rebase or an applied review), each export on that board moves to the component it now resolves to, audited `connector_relabelled` or `connector_rebound` with `exportId`.
   - An export that no longer resolves, or whose port is no longer exposed, is **SYS-V16 `export_unresolved`** (error), and its interface entry has `resolved: false` and no pins. Exported connectors are never linked inside the system, so drift never reviews them; this finding is what surfaces a broken export.
8. **An exported port cannot be hidden** (UI) and cannot be an end of a link (409 `export_port_linked`, from both directions).

9. **Batch (SB2-121).** `POST …/exports/batch {exports: [{name, description?, instanceId, portKey, subportId?}]}` (1–200 items, port exports only) creates them in **one** version, each under rules 1–8. The first refusal rolls the batch back; its message starts with that item's name. 201 `{exports}` in request order.

**Storage (workspace migration 31).** `system_exports`: `id`, `system_id`, `name` (unique per system, case-insensitive), `description`, `target_instance_id`, and exactly one of `target_port` (JSONB port baseline) or `target_export_id`.

**Document.** The system document gains `exports: [{id, name, description, instanceId, portKey, port, childExportId, resolved, redacted, updatedAt}]`. On a restricted board, `portKey`, `port` and `resolved` are null and `redacted` is true; the name stays visible.

### 4.3 Export interface (`prism.system_export_interface.v1`)

```json
{
  "schema": "prism.system_export_interface.v1",
  "exports": [{
    "id": "sxp_…", "name": "PWR_IN", "description": "…",
    "occurrence": "/sin_…",            // path inside the child, to the board carrying it
    "reference": "J20", "libId": "…", "footprint": "…", "pinCount": 4,
    "pins": [{"pad": "1", "nets": ["/PWR/VBUS_28V"], "powerNet": true,
              "pinNames": ["VBUS"], "pinTypes": ["passive"]}]
  }]
}
```

- It is computed from the snapshot's instance baselines and their interface artifacts, using P1 §3 pin rules (pad strings, sorted net sets).
- A re-export is resolved to the physical connector (SB2-05).
- `powerNet` comes from extractor v5 **[S4]**. It is null until SB2-08.
- Each entry carries `resolved`. An unresolved entry has `pinCount: 0` and `pins: []`, and publishing refuses it.
- `GET …/export-interface` returns 409 `interface_not_ready` (and queues extraction) while a board behind an export has no interface at the current extractor version. `?snapshot=` computes it from the snapshot's manifest, so a live interface equals its snapshot's until something changes.
- Redaction: an entry on a restricted board keeps its name and pad numbers, but `reference`, `libId`, `footprint`, and every pin's nets, names and types are null, with `redacted: true`.

## 5. Hierarchy

### 5.1 Instances

`system_instances.kind` is `board` (every P1 instance) \| `assembly` \| `module`.

- **Assembly or module instances** carry `catalog_component_id`, `catalog_revision_id` and `follow` (`pinned` \| `latest_released`). Board columns are null.
- **Adding one:** `POST …/instances` with `{kind: "assembly" | "module", componentId, revisionId?, label, follow}`. The component's kind must match.
  - When `revisionId` is omitted, it resolves once to the current released revision. 409 `no_released_revision` if there is none.
  - Pinning an unreleased revision is allowed and produces warning `SYS-V14` (§8.4).
- **Removing one** follows P1 §5.1 (`?cascade=links`).

### 5.2 Resolution

`resolve(root)` builds the occurrence tree:
- an assembly instance → its revision → `source_ref` snapshot → that snapshot's manifest → its instances, recursively;
- snapshots are immutable, so resolution is memoized per snapshot ID.

`flatten(tree)` lists board occurrences with occurrence paths and **world-independent** data (pose composition is a placement concern, SB2-10).

### 5.3 Limits and cycles

| Limit | Value | Error |
|---|---|---|
| Depth (system levels incl. root) **[S3]** | 4 | 422 `hierarchy_too_deep` |
| Board occurrences when flattened | 200 | 422 `hierarchy_too_large` |
| Cycle (a system reaching itself through any child snapshot) | none | 422 `hierarchy_cycle` |

- **Two kinds of limit.** These are *flattened* limits over the whole tree. Each system also keeps P1's *direct* limits (CONTRACTS §8.3: 50 instances, 500 links, 5,000 rows per system); both apply.
- **When checked:** when an assembly instance is added, rebased or auto-advanced, when an outside manifest is imported (§21.3; a refused import rolls back whole and its review stays open), and at publish (`assembly_hierarchy_valid`). An advance is checked again under the system lock before it applies (SB2-97).
- **Advancing:** a parent following `latest_released` does not advance to a revision that would break a limit. It records warning `SYS-V15` instead.
- **Cycle detection:** by system ID along the resolution path, not component ID. A snapshot of an older version of the same system is still a cycle.

### 5.4 Visibility and redaction (extends P1 §8.2)

Redaction recurses. For each board occurrence, P1 §8.2 applies with the reader's access to that board's project today.

- **A hidden child system:** the reader can't see the child system's folder. The occurrence renders as its label plus the catalog interface, with pin nets redacted wherever the board behind the export is hidden **[S7]**. None of its internal boards, links or harnesses are returned.
- **Parent access never grants child access.**
- **Deleted projects:** P1 v1.12 applies at every depth.

**As built (retro D1/D2, P2-1.36).** A reader's view of a document (live or a snapshot's, by today's access) is a set of restricted boards plus **hidden export ends**: each `(assembly instance, export)` whose export resolves, through the child tree, to a board the reader cannot see, or inside a child system they cannot open, or does not resolve at all. Such an end keeps the export, its pins and its pin numbers. Its row nets (`net*`, `observed*`), the wire nets on that side, the link end's `export` landing point, finding details on it, and the assembly interface's pin nets and power flags are null; rows list the end in `redactedEnds`. Documents, snapshots, ICDs, diffs and `GET …/instances/{iid}/interface` apply it, and since P2-1.37 also:
- `GET …/export-interface`, live and frozen: a re-export whose `(target instance, target export)` is hidden is listed with `redacted: true`, its pads, and null reference, libId, footprint, nets, pin names and pin types;
- reviews: an item on a hidden end has `redacted: true` and null `expected`, `observed`, `candidates` and `decisionPayload`, and the review's `pendingChanges` is null. A candidate export with a hidden source keeps its name and pin count; `libId`, `footprint`, `libIdEqual` and `netOverlap` are null;
- `GET …/history`: an event naming a hidden end (its assembly and export), or a link with such an end, has `payload: null, redacted: true`. A snapshot's manifest and publishing still need the whole document (403 when anything is hidden).

### 5.6 Module instances (SB2-49)

A module instance places a catalog module (§3.5) in a system. It is a leaf of the hierarchy, like a board, and its connectors are its ports.

- **Ports.** The interface is built from the pinned revision's units plus the component's connector placements as they are today (§3.6; placements are not revisioned, but each reads its connector part at the revision it recorded) (`systems/modules.py`). The pads and orphans are the pinned revision's units', not the current ones'. There is one component per unit:
  - `portKey` and `memberKeys` are the unit letter; `reference` is the unit name; `mpn` and `value` are the connector part's.
  - Each pin's net is its signal (an unnamed pin has none), so rows, wires and system nets see module signals.
  - `geometry` is the connector part's footprint at the origin; `boardThicknessMm` is 0; `footprintPose` is where that footprint sits on the module.
  - `matingFrame` is the frame the placement was made with (§3.6).

  A unit without a placed connector is still a port: it links but has no geometry, so it can't mate. The interface also carries the module's model and its aligned bounds (`boundsMm`). The model comes from the pinned revision's assets; its alignment stays component-scoped (§18.2).
- **Links, harness ends, exports and nets** treat these ports like a board's. A module port is always exposed (no overrides).
- **Mating.**
  - A module port mates as "a footprint on a zero-thickness board at `footprintPose` on the module". The solve's `inMember` and a harness end's `connector.inOccurrence` carry that pose. Both harness routers compose it onto the occurrence (`harness_route`/`harness-route.ts`).
  - Its frame is `matingFrame`, which counts as stored (§15.2). It is never edited per system: `GET/PUT …/mating` on a module answers 422. Change the placement in the catalog instead.
  - A board end still needs a confirmed frame before a B2B link places the module.
- **Scene** (§20): the occurrence's box is the model's aligned bounds; with a converted model it carries `model {glbKey, matrixMm, boundsMm}` (§20.18).
- **Nets and 3D (SB2-50).** A module pin is a system-net node whose net is its signal, so a trace runs board → harness wire → module pin (`CMBD J24.3 → SBT1 P1 MAIN.4`).
  - In the System 3D view, a lit set's module member counts as lit and frames with the set (the module's model is drawn; the harness tubes light the path).
  - Modules have no section in the Layers panel.
  - Move mode moves a module like a board, and `PATCH …/poses` stores it.
- **Release follow and drift (SB2-51).** A released module revision advances its followers like an assembly's (§7.1, D-P2-4). The candidate is the revision's connectors (§5.6), compared by drift as an export interface.
  - Unchanged connectors and signals advance silently (`auto_advanced`).
  - A renamed signal on a wired or linked pin, a missing unit or a missing pad opens a `child_update` review, and the instance keeps its revision until the review is applied.
  - A manual rebase (`POST …/rebase` with `revisionId`) works for modules too.

## 6. Links, exports as ends, and harnesses

### 6.1 Link ends

A link end is either a **port end** `{instanceId, portKey, port: PortBaseline}` (board or module instance) or an **export end** `{instanceId, exportId, export: ExportBaseline}` (assembly instance).

- `ExportBaseline` is `{exportId, name, reference, libId, footprint, pinCount}`, captured from the export interface of the instance's current revision.
- Row nets on an export end are that interface's pin nets, following the P1 row rules.
- The P1 generators work on export ends, using the interface pins.

### 6.2 Link type

`system_links.type` is `unspecified` (every P1 link) \| `b2b` **[S1]**.
- **B** on the diagram sets the next drawn link to `b2b`.
- `PATCH …/links/{lid}` changes `type`.
- M1 adds the `b2b` mating requirements (PLAN D-P2-10).

### 6.3 Harness objects (shape frozen; behaviour in M1)

A harness has `ends` (1–32), `wires` and `nodes` (see §9.1 for fields).

- **End mates:** an end mates to a port end or export end, or to nothing.
- **Pins:** an end's pins map to the mated connector's pins through `pinMap` (null = identity).
- **Wires:** each wire joins `{end, pin}` to `{end, pin}` and carries `netFrom`/`netTo` baselines, like rows.
- **Pressing H**, drawing A → B, creates a 2-end harness with identity wires.
- **Converting** a P1 link with a `harness` label creates a harness and deletes the link. Its rows become wires with IDs preserved in `label`.
- **Drift:** P1 drift and review rules apply to harness end mates, like link ends (M1).

## 7. Child drift

### 7.1 Trigger

- Releasing a catalog revision of an `assembly` or `module` component enqueues `system_child_check` for every instance with `follow = latest_released` of that component.
- `POST …/instances/{iid}/rebase` with `{revisionId}` evaluates an explicit revision, like P1 rebase.

### 7.2 Evaluation

Evaluation compares, **for the exports this parent's links and harness ends use**, the pinned revision's interface baselines (stored on ends and rows) against the candidate revision's interface.

| Item kind | When | Allowed decisions |
|---|---|---|
| `export_missing` | the export ID is absent | `bind_candidate` (ranked: same name, same pin count, net overlap), `remove_rows` |
| `export_connector_changed` | `libId`, `footprint` or `pinCount` differ | `accept` (refused with 409 if used pads are missing), `remove_rows` |
| `pin_missing` | a used pad is absent | `remap`, `remove_rows` |
| `net_changed` | a used pad's net set differs | `accept`, `remap`, `remove_rows` |

- An export **retargeted** to a different connector with identical libId, footprint, pin count and used-pin nets is a **silent** change (audited `export_retargeted`), like P1 rebind.
- **Auto-advance** happens exactly when there are no items (P1 invariant 2 at the export boundary), and moves `catalog_revision_id` (audited `child_auto_advanced`).
- **Otherwise** a review of kind **`child_update`** opens. It has P1 review semantics: decisions, `keep-pinned`, superseding, and the v1.12 `basis` staleness rule.
- **Never considered:** internal child changes.

### 7.3 Warnings

`SYS-V14` and `SYS-V15` (§8.4) cover revisions pinned deliberately while unreleased or carrying open reviews, and advances blocked by limits.

## 8. System nets

### 8.1 Nodes and edges

- **Node:** `(occurrence_path, net)` for a named board net; `(occurrence_path, "pin:" + portKey + "#" + pad)` for a pin with no net (unconnected), so tracing still reaches it.
- **Edges:**
  - each row joins the nets of its two pins (every net in each sorted set);
  - each harness wire joins the nets of the board pins its two end pins map to;
  - an export end resolves to the child's physical pin before joining.
- **Group:** a connected component (union-find), computed over the flattened hierarchy.

### 8.2 Group output (`GET …/nets`, `GET …/nets/{groupId}`)

```json
{"groupId": "<min member key>", "name": "<clicked or first member leaf>", "aliases": ["SPI_SCK", "SCK_IN"],
 "pinCount": 6, "members": [{"occurrence": "/sin_…", "displayPath": "CNDH-A ▸ OBC-1", "net": "/Payload IF/SPI_SCK"}],
 "hops": [{"kind": "row"|"wire", "linkId"|"harnessId", "from": {"occurrence", "reference", "pad"},
           "to": {…}, "wireId"?: "shw_…"}]}
```

- `groupId` is stable for an unchanged membership, and it is valid only for the system version in the response's ETag.
- Search (`?search=&occurrence=`) matches aliases case-insensitively, using fuzzy ranking.
- Groups with `pinCount > 200` carry `"large": true`. The UI confirms before highlighting.
- Restricted occurrences appear as `{"occurrence": null, "redacted": true}` members, and their hops are dropped.
- **Members (SB2-33, P2-1.34):** `?members=true` adds each listed group's visible board nets, `"members": [{"occurrence", "net"}]` (restricted boards left out). The System 3D tab reads `?members=true&limit=500` once per system version to map board nets to system nets.
- **Paging (retro D6, P2-1.36):** `?offset=` (default 0) pages the sorted list; the response echoes `offset`. The System 3D tab reads every page.
- **Exact lookup (SB2-32, P2-1.33):** `?occurrence=<path>&net=<board net>` lists only the group holding exactly that board net on that occurrence (zero or one group). `net` without `occurrence` is 400. A board net no link carries is in no group.

**As built (SB2-20, P2-1.21): harness wires.**
- Each wire joins the node of the pad its from-end pin lands on (after that end's `pinMap`) with the node of the pad its to-end pin lands on, using the wire's captured `netFrom`/`netTo` like a row's nets. Wires sharing an end pin therefore share a node: a splice joins every wire on it.
- An end on a subsystem export is followed down to the child's board, as for a link end; an end whose export does not resolve drops that wire. Subsystem levels contribute the harnesses in their snapshot manifest.
- A pin of an **unmated** end is an internal node: it carries joins between the wires on it but is never a member, and a group made only of internal nodes is not listed.
- A wire hop is `{"kind": "wire", "harnessId", "harnessName", "wireId", "signal", "from": {occurrence, displayPath, portKey, reference, pad, nets, end: "End N", endPin}, "to": {…}}`. On an unmated end `occurrence`, `displayPath`, `portKey`, `reference` and `pad` are null; `pinCount` counts board pads only.
- Golden: `tests/fixtures/system_builder/p2/goldens/harness_splice_nets.json` (the fixture WH-001 cable as a 3-end harness: PWR J3 pin 3 spliced to PAY J11 pin 1 and J12 pin 1), written by hand from the fixture's rows.

### 8.3 Tokens **[S5]**

A net's **tokens** are the last path segment, uppercased, with KiCad markup (`~{…}`, `{slash}`) removed, split on anything not `[A-Z0-9]`. Pure-number tokens are dropped, and so is the token `NET` from auto-names like `Net-(J1-Pad3)`.

### 8.4 Findings (P1 §7.2 numbering continues)

| Rule | Name | Severity | Definition |
|---|---|---|---|
| SYS-V09 | `net_name_mismatch` | warning | Runs on every system (D-P2-57, §23.4; opt-in from P2-1.10 to P2-1.72). At a join (row or wire), no token on one side is **related** to a token on the other (P2-1.8). Related: equal; one a prefix or suffix of the other (2+ characters, digits kept, so `GPIO4`/`IO4` match and `GPIO4`/`IO5` do not); an in-order abbreviation with the same first letter (`RST`/`RESET`); an acronym of the other side's tokens (`PG`/`PWR_GOOD`); or a crossed pair (`TX`/`RX`, `TXD`/`RXD`, `SDO`/`SDI`, `DOUT`/`DIN`, `CTS`/`RTS`). It is reported once per join, with both names. Unnamed auto-nets and unconnected pins never trigger it. |
| SYS-V10 | `power_meets_signal` | error | At a join, exactly one side's pin has `powerNet: true` and the other side's net is a named, non-power net. |
| SYS-V11 | `mate_mismatch` | warning | A B2B link of this system whose connectors don't line up where the driving mates put its boards (§14.9): lateral > 0.2 mm, angle > 0.5°, or axial > 0.2 mm with a stack height. Detail `{offsetMm, lateralMm, axialMm, angleDeg}`. Only evaluated when the system has B2B links. |
| SYS-V12 | `harness_collision` | warning | A root-level harness segment runs through a board's box (outline × thickness + 1 mm), §17.10. Detail `{harnessId, segmentId, occurrence, distanceMm, radiusMm, atMm}`. |
| SYS-V13 | `length_mismatch` | warning | A harness's cut length differs from its estimated length by more than 15 % (§17.10). Detail `{harnessId, cutLengthMm, estimatedMm, differencePct}`. Not evaluated while an end is unplaced. |
| SYS-V14 | `child_revision_unreleased` | warning | An assembly or module instance pins a revision that is not `released`, or whose snapshot had open reviews. |
| SYS-V15 | `child_advance_blocked` | warning | A released revision exists but advancing would break §5.3 limits. |
| SYS-V16 | `export_unresolved` | error | An export's connector no longer resolves at its board's baseline, or is no longer exposed (§4.2 rule 7). Not evaluated while the board's interface is missing. |
| SYS-V17 | `mating_stale` | info | A confirmed or override mating frame whose port geometry changed since confirmation (§15.2). |
| SYS-V18 | `mate_pair_unknown` | warning | Both parts of a harness end or `b2b` pair are known and not related by mates-with (§18). |
| SYS-V19 | `mate_pin_mismatch` | error | A harness end's part has a different pin count from its mated connector and a wired pin has no map (§17.2). |
| SYS-V20 | `harness_tight_bend` | info | A root-level harness segment still bends tighter than 6 × its bundle diameter after relaxation (§17.8). Detail `{harnessId, segmentId, radiusMm, minRadiusMm, atMm}`. |
| SYS-V21 | `subport_pad_absent` | warning | A sub-port names a pad its connector (or subsystem export) no longer has (§22.4). Detail `{subportId, name, pads}`. |
| SYS-V22 | `part_collision` | warning | Two occurrences' meshes intersect in the 3D view's placement (§24.2). Detail `{a, b, atMm, pairs}`. Raised from the last check while it matches the current `sceneKey`; otherwise not evaluated. |
| SYS-V23 | `net_meets_no_net` | warning | At a join (row or wire), a designer-named net on one side meets a pin on **no net** on the other: no net at all, or KiCad's `unconnected-(…)` (P2-1.87). A `Net-(…)` auto-net is a connection and does not count; an unnamed net meeting no net is not reported. Evaluated only when both ends' interfaces are known. Placed like V09 (§8.5); detail `{pinB, referenceB, namedSide, netA, netB}`, `namedSide` `a`/`b` (links) or `from`/`to` (wires). |

**Optional rules (P2-1.10, user decision 2026-09-30; superseded by D-P2-57 in P2-1.73: SYS-V09 now always runs and the list has no effect).** `system_projects.optional_rules` (migration 35) lists the opt-in rules a system runs; today the only one is `SYS-V09`, because real boards rename nets across connectors far more often than they miswire them (108 warnings on the JTYU C&DH set). It is set with `PATCH /systems/{id}` `{"optionalRules": ["SYS-V09"]}` (the list replaces the stored one; `null` clears it; any other rule is 422), bumps the system version, is audited as `system_updated`, and is shown in the system summary and the manifest header. The Overview tab has a **Checks** section with the switch. `SYS-V10` always runs.

**`powerNet` (extractor v5 [S4]).** A pin's net is a power net when any schematic symbol on that net is a power symbol: KiCad `power` flag set on its lib symbol, or a reference starting with `#PWR`/`#FLG`. The extractor records `powerNet: bool` per pin. `EXTRACTOR_VERSION` goes to 5, and every board re-extracts once.

### 8.5 Waivers (SB2-100, D-P2-56)

- **Identity.** Every finding carries `key`: its rule, instance, link, harness (`detail.harnessId`), end, reference and pin joined by `|`. Not the row ID, which a row save may replace.
- **Batch (SB2-113).** `POST …/waivers/batch {findingKeys: [1–1000], note}` (designer, `If-Match`) waives them with one note in one version and answers 201 `{waived: [waiver…], skipped}`; keys already waived are skipped, and an unknown or hidden finding (404) or an error (422 `finding_not_waivable`) refuses the whole batch. The Findings tray offers it as **Waive all** on a rule's group and on each place under it (a group of more than eight findings splits by link, harness or board), and filters findings by place, pin, net or rule.
- **Join findings (SB2-112).** A finding on a row or a harness wire (SYS-V01, V09, V10) is placed at side A (a wire: its `from` end): `instanceId`, `end` `"a"` (links), `reference` and `pin`, with side B's pin and connector in `detail.pinB` and `detail.referenceB`. Each join therefore has its own key, and a waiver covers that join only. Before P2-1.80 these findings had no place, so every join of one link (or harness) shared a key; a waiver made then no longer matches and lists as no longer raised.
- **What can be waived.** Warnings and info only, with a note. An error is fixed or reviewed; a waiver naming one has no effect.
- **API.** `POST …/waivers {findingKey, note}` (designer, `If-Match`) answers 201 with the waiver; 404 for a finding the reader can't see or that doesn't occur, 422 `finding_not_waivable` for an error or an empty note, 409 `finding_waived` if already waived. `DELETE …/waivers/{id}` answers 204. Both bump the version and audit `finding_waived` / `finding_unwaived`. The lookup runs without the system lock; the lock only stores the waiver (SB2-94).
- **Effect.** A waived finding stays in `findings` with `waived {id, note, by, at}` and leaves `counts`; `counts.waived` says how many. The report lists `waivers` with `active`: whether its finding still occurs. Waivers are applied after every rule, so snapshots freeze them.
- **Record.** Waivers are in the manifest (`waivers[]`, omitted from the full digest while empty, never in the connectivity digest), imported with it, and the ICD (renderer 5) lists them apart under "Waived findings".
- **Redaction.** A finding on a board the reader can't see loses its `key`; a waiver on it loses `findingKey` and `note`.

### 8.6 Reviews and findings report (SB2-107)

- **API.** `GET …/report.xlsx` and `GET …/report.csv` (viewer) answer the live system with its `ETag`, as an attachment `{system}-report.{fmt}`. Read-only, built in one consistent transaction; no snapshot form (a snapshot's findings are in its ICD).
- **Sections.** *Summary*: system, version, generation time, the open finding counts by severity (equal to `findingCounts`), waived count, open reviews, review items and undecided items, and each not-evaluated rule. *Reviews*: one row per item of every open review (review, kind, board, from/to commit, opened, item, change, link, end, connector, pins, expected, observed, decision); expected and observed are the pin's net sets (`(no net)` when unconnected), a connector's lib ID and footprint, or an import's proposed row; a review with no items is one row. *Findings*: every finding, open ones first by severity, then the waived with note, author and date, then waivers no longer raised. *Renames* (SB2-106, §23.5): each open or applied proposal with board, net, new name, rows, note, author and dates.
- **Formats.** The workbook has one sheet per section, the header frozen; every cell is stored as text, so a typed `=…` or `+3V3` never evaluates. The CSV is the sections in order, each a `# {Section}` line, its header and its rows, separated by a blank line; a cell starting `=`, `+`, `-`, `@`, tab or CR is prefixed with `'`.
- **Redaction.** As the trays: a review on a board the reader can't see is one `Restricted` row with no commits or nets; a restricted item is a `Restricted` row; findings and waivers are redacted as in §8.5.

## 9. Manifest `prism.system_manifest.v1`

### 9.1 Shape

The models in `manifest_schema.py` are normative. Top-level keys:

| Key | Content |
|---|---|
| `schema` | `"prism.system_manifest.v1"` |
| `system` | `{id, name, description, optionalRules}`: `optionalRules` defaults to `[]`, is part of the full digest only, and is left out of the full digest when empty so manifests from before P2-1.10 keep their digests |
| `meta` | `{createdAt, createdBy, sourceVersion, snapshot?: {id, name, note}}` |
| `instances` | board `{id, label, kind: "board", projectId, baselineCommit, trackedRef, pinned, portOverrides}` or catalog `{id, label, kind: "assembly"\|"module", catalog: {componentId, revisionId, revisionVersion, identity}, follow}` |
| `exports` | §4.1. A port target is `{instanceId, portKey, port: PortBaseline}` (P2-1.3); a re-export target is `{instanceId, exportId}` |
| `links` | `{id, name, type, harnessLabel, a, b, rows, stackHeightMm}` with P1 rows (`netA`/`netB` baselines); `stackHeightMm` is b2b-only placement data (§16.2) |
| `harnesses` | `{id, name, label, ends[{id, ordinal, mates, part, pinCount, pinMap, bootMm}], wires[{id, from, to, signal, gaugeAwg, colour, label, netFrom, netTo}], nodes[{id, kind, positionMm, pinned, order, ends, between}], cutLengthMm, serviceAllowancePct}` |
| `mating` | `{instanceId, portKey, mode: confirmed\|override, frame: {axis, quarterTurns}, geometryDigest}` (§15.2) |
| `placement` | `{poses[{instanceId, translationMm, rotation (xyzw unit), source}], drivingMates[{instanceId, linkId}]}` |
| `layout` | `{positions: {<nodeKey>: {x, y}}}`, the saved diagram arrangement. Node keys are instance IDs and harness IDs at this level (at most 1000). An expanded child renders with the layout frozen in its own snapshot. |

Rules:
- Unknown fields are rejected.
- Array order is meaningful only where stated (`ordinal`, `order`). Writers emit instances, links, rows and wires sorted by ID; readers must not depend on order.

### 9.2 Referential rules (checked by `reference_problems`)

- Instance IDs are unique, and labels are unique case-insensitively.
- Export names are unique case-insensitively.
- Port ends and targets name board or module instances; export ends and targets name assembly instances.
- Row IDs are unique across the manifest, and pin pairs are unique per link.
- Wire and node ends exist in their harness.
- Mating names a board or module instance.
- There is at most one pose per instance, and every pose names an existing instance.
- Driving mates name an existing link and instance.

Checks that need other documents (a child's export exists at the pinned revision, a portKey exists at the baseline) belong to validation (§8.4, P1 §7.2), not to the manifest.

### 9.3 Digests

The canonical form is JSON with sorted keys, `(",", ":")` separators and `ensure_ascii=False`, hashed with SHA-256 and written `sha256:<hex>`.

- **`full`**: the manifest without `meta`. Fields added after M0 (`system.optionalRules`, `links[].stackHeightMm`) are omitted while empty or null, so manifests written before them keep their digests.
- **`connectivity`**: `full` without `system.optionalRules`, each link's `stackHeightMm`, `layout`, `mating`, `placement`, and each harness's `nodes`, `cutLengthMm`, `serviceAllowancePct` and every end's `bootMm`.

Drift, publish identity and catalog `connectivityDigest` use **connectivity**. Snapshot identity uses **full**.

### 9.4 Snapshots (changes P1 §9.1; implemented in SB2-01)

A snapshot row (migration 30) stores:

- `document`: the P1 rendered document, unchanged (it includes `validation` and `reviewRowIds`). The ICD, diffs and redacted reads keep using it as the evidence of what the system showed.
- `manifest`: v1, unredacted, built in the same transaction as the document. `meta.snapshot` is `{id, name, note}` and `meta.sourceVersion` is the frozen version.
- `manifest_schema`: `"prism.system_manifest.v1"`.
- `digest`: the manifest's **full** digest. P1 snapshots keep their document digest.
- `connectivity_digest`: the manifest's connectivity digest.

Reading rules:

- Snapshot metadata gains `connectivityDigest` and `manifestSchema`. Both are null on P1 snapshots.
- `GET …/snapshots/{sid}/manifest` returns the manifest **whole or not at all**. It gives 403 when the reader cannot see every board it names (a manifest is an exchange artifact; a partial one would be misleading), and 404 for a P1 snapshot without a manifest.
- P1 snapshots stay readable everywhere else, but cannot be published.
- Writers emit instances, links and rows sorted by ID, so an unchanged system snapshots to identical digests.

**Import.** `manifest.import_manifest` recreates a system from a manifest, **keeping every ID** (system, instances, links, rows), and audits `system_imported`. A clash with an existing ID fails the transaction. Harness nodes (SB2-45) and driving mates (SB2-37) import as stored; mating records (SB2-12) and poses (SB2-28) import as stored. There is no HTTP route yet; M7 adds one.

### 9.5 Canvas layout (revises P1 invariant 6)

- **Live:** `GET/PUT …/layout` is unchanged. It is shared by every user of the system, takes no If-Match (last write wins), writes no audit event and never bumps the system version.
- **Frozen:** a snapshot's manifest carries the layout as it was when the snapshot was taken. A system restored or published from a snapshot shows that arrangement.
- **Digests:** layout is excluded from the connectivity digest and included in the full digest.
- **A layout change alone never** opens a review, bumps drift, or makes a parent see a new child revision.

## 10. ICD changes (extends P1 §9.4–§9.5)

- **Parent ICD (default):**
  - A **Subsystems** table: label, kind, identity, revision, stage, snapshot name and digest, open reviews.
  - Link and harness ends on exports print as `CNDH-A ▸ PWR_IN → CMBD J20 pin 3 · /PWR/VBUS_28V`.
  - The printed banner also warns about SYS-V14.
- **`?depth=all`:** every link and harness at every level, grouped by occurrence path, in both CSV and HTML. CSV gains an `occurrence` column.
  - The occurrence column is the display path (`CNDH-A`, `CNDH-A ▸ PAY-SUB`) and comes first; the root system's own links have an empty occurrence.
  - Redaction follows §5.4: hidden boards keep their rows with connector and net blanked; a hidden child system's level is omitted entirely.
  - Without `depth`, or with `depth=own`, the CSV columns are exactly P1's.
- **Release chain (SB2-122).** A catalog instance's `catalog` also carries `latestReleasedVersion` (the component's released revision, or `null`), `newestVersion` and `newestReleaseStatus` (its newest revision, published or not). The inspector's **Revision** reads `v2 · released · v3 released · v4 in QA review`; the diagram node adds "v3 released" when a newer revision is released.
- **Health inside (SB2-117).** A subsystem instance's `catalog.findingCounts` is `{error, warning}` as its pinned snapshot froze them (the snapshot document's `findingCounts`; `null` when the source snapshot is gone). The node shows "{n} inside", the inspector a **Findings inside** fact, and the top bar "+ N errors in subsystems" (warnings when there are no errors). They are not added to the parent's own counts.
- **Diagram (SB2-09):** a subsystem node has a double border, the revision (`vN`) and stage, and an **inside** toggle listing its boards and nested subsystems from `GET …/hierarchy`. The History tab offers an **All levels** ICD link whenever the system has a subsystem.
- **Renderer** version 3.

## 11. API additions

All routes are under `/api/systems/{id}` and follow P1 conventions (If-Match, 412/428, redaction).

| Method and path | Purpose |
|---|---|
| `GET …/exports`, `POST …/exports`, `PATCH …/exports/{xid}`, `DELETE …/exports/{xid}` | Export CRUD (§4) |
| `POST …/exports/batch` | Several port exports in one version (§4.2 rule 9) |
| `GET …/export-interface?snapshot=` | The interface (§4.3), live or for a snapshot |
| `POST …/snapshots/{sid}/publish` | §3.3 |
| `GET …/snapshots/{sid}/manifest` | The frozen manifest, whole or 403 (§9.4) |
| `POST …/instances` (extended) | `kind: "assembly"\|"module"` (§5.1) |
| `POST …/instances/{iid}/rebase` (extended) | `{revisionId}` for assembly and module instances |
| `GET …/hierarchy` | Occurrence tree: `{occurrences: [{path, displayPath, kind, instanceId, systemId?, revision?, restricted}]}` |
| `GET …/nets?search=&occurrence=&limit=`, `GET …/nets/{groupId}` | §8.2 |
| `GET …/icd.{csv,html}?depth=all` | §10 |
| `GET …/scene` | §20: every occurrence placed, with the board bundles that draw it |
| `GET …/poses`, `PUT …/poses/{iid}`, `DELETE …/poses/{iid}`, `DELETE …/poses` | §14.7 |
| Catalog: `GET /api/catalog/components?kind=part\|module\|assembly` | Filter by kind. Component payloads carry `kind`, `interface` and `source_ref` |

**Viewer browsing (D-P2-24, [S8]).** The dependency `require_catalog_browser` (roles `CATALOG_BROWSE_ROLES` = reader roles + `viewer`) guards exactly these 26 routes:
- components list, detail, revisions (list, compare, one), audit (and verify), usage, mates-with (P2-1.17), models, model previews and GLBs (P2-1.18), reviews, releases and validation;
- categories, workflow summary, release queue, asset search, previews and asset content;
- metadata fields, grid, grid preferences (GET and PUT, per user) and `export.csv`.

Everything else stays on reader or writer roles, including inventory export, health, imports, jobs, validation runs and metadata batches. `test_catalog_system_items.ViewerBrowseRoutesTest` pins the list. The frontend `view_catalog` authority includes `viewer`.

## 12. Error codes (additions)

| Status | Code | When |
|---|---|---|
| 409 | `export_port_linked` | Exporting a linked port, or linking an exported port |
| 409 | `no_released_revision` | Following latest-released with none released |
| 409 | `already_published` | Never returned: re-publish is idempotent (200). Listed so clients don't expect it |
| 409 | `review_stale` | P1 v1.12, also for `child_update` |
| 422 | `hierarchy_too_deep`, `hierarchy_too_large`, `hierarchy_cycle` | §5.3 |
| 422 | `export_limit` | More than 200 exports |
| 403 | — | Publish without catalog write role; a manifest naming a board the reader cannot see |
| 409 | `port_already_mated` | A port in a second `b2b` link or harness end (§16.2, §17.2) |
| 409 | `harness_not_linkable` | Converting a harness with more than two ends, splices or a pin map to a link (§16.1) |
| 409 | `mating_not_inferable` | Confirming a `low` inference (§15.3) |
| 409 | `port_split`, `port_b2b_mated`, `port_exported`, `subport_exported` | §22.2–§22.4 |
| 422 | `subport_overlap`, `subport_limit`, `subport_empty`, `subport_name_taken`, `pin_not_on_subport` | §22.1–§22.2 |

## 13. Audit event kinds (additions)

`git_linked`, `git_relinked`, `git_unlinked`, `snapshot_committed`, `snapshot_commit_refused`, `manifest_imported`, `manifest_import_rejected` (§21), `system_imported`, `export_created`, `export_updated`, `export_retargeted`, `export_deleted`, `snapshot_published`, `child_auto_advanced`, `child_rebased`, `link_type_changed`, `harness_created`, `harness_updated`, `harness_deleted`, `pose_updated`, `poses_reset`, `mating_updated`. `subport_created`, `subport_updated`, `subport_deleted` (§22.3). `harness_created` carries `fromLink` or `fromLabel` when it replaced links (§16.1, §17.2).

## 14. Frames and placement conventions (SB2-10)

These conventions are shared by the extractor (v6), the placement library pair (Python
`systems/placement/`, TypeScript `frontend/src/features/system-builder/placement/`) and the
renderer. Goldens in `backend/tests/fixtures/system_builder/placement_cases.json` run in both
languages with a tolerance of 1e-6 mm and 1e-9 on quaternion components.

### 14.1 Units and algebra

- Lengths in **mm**, angles stored in **degrees** (API and manifest) and converted to radians only inside the library.
- **Right-handed** axes; **column vectors**; a transform is `T·R` (rotate, then translate).
- Rotations are **unit quaternions `[x, y, z, w]`**, normalised, with `w ≥ 0` in stored form (the sign is canonicalised so equal rotations serialise equally).
- Composition reads right to left: `A·B` applies `B` first.

### 14.2 Board frame **[T1]**

- **Origin:** KiCad's page origin (the `(0, 0)` of the `.kicad_pcb` file), not the grid or drill origin.
- **x** = KiCad x. **y** = −KiCad y (KiCad's y points down; the board frame's points up). **z** points out of the **front** (F.Cu) side.
- **z = 0 is the board mid-plane.** The front surface is `z = +t/2`, the back `z = −t/2`, where `t` is the board thickness from the board setup (`general (thickness …)`), recorded by extractor v6.
- A KiCad rotation angle (counter-clockwise on screen, degrees) is a positive rotation about +z in the board frame, unchanged in value.
- The 3D bundle of a board is mapped into this frame by its asset's `bundleToBoard` matrix (§20.2); nothing in the placement library depends on how `kicad-cli` centres its GLB.

### 14.3 Parent frame and poses

- A system's frame is the frame its poses are expressed in. A pose `P = T(translationMm)·R(rotation)` maps an instance's own frame (board frame, or the child system's frame for an assembly) into the parent's.
- A board occurrence's world matrix is the product of poses along its occurrence path, root first.
- Default poses (`source: "default"`): the instances of one system, in **label order** (case-insensitive, then instance ID), along +x on the XY plane. Each is placed so its bounding box starts 20 mm after the previous one's ends (the first at x = 0), bottoms aligned at y = 0, with no rotation. A board's box is its `boardOutlineMm` (§14.6) with z = ±t/2; an assembly's is the union of its members' boxes after their own default poses. An instance without a box takes an empty slot (the next one starts 20 mm on). Stored only when the user moves an instance (§14.7). *(P2-1.23: the plan said creation order, which snapshot manifests don't record.)*
- **Placing members** (`place`): a stored pose wins; every other member takes its slot in the default row, which is laid out over **all** members, so moving one never shifts another. M4 inserts the tree solve (`auto`) between the two.

### 14.4 Connector frame `F_c`

Computed from extractor v6 geometry (§14.6) in the board frame:

- **Frame pads:** the connector's **numbered** pads (mechanical ones such as "MP" included); unnumbered pads, the mounting and alignment holes, only when the footprint has no numbered pad. *(P2-1.42: was all pads. Samtec's -A alignment holes sit 1.27 mm off the centreline and skewed the frame by 0.02 mm and 0.2°.)*
- **Origin:** the centroid of the frame pads, at `z = +t/2` when the footprint is on the front, `−t/2` on the back.
- **x axis:** the principal axis of the frame pads' centres (largest eigenvector of their 2D covariance), signed so that **pad "1"** (or, without one, the first pad in natural order) lies at negative x. When the two eigenvalues are within 5 % of each other (a square array) or there is one pad, x is the footprint's own +x rotated by the footprint angle.
- **z axis (mating direction):**
  - vertical: the board normal, +z for a front footprint, −z for a back one;
  - right-angle: in the board plane, along the footprint's own ±x/±y axis named by the inference or override (§15.1), rotated by the footprint angle into the board frame. The body centre is the courtyard centre; M4 may refine it with model bounds.
- **y = z × x**; if z ∥ x (a right-angle connector whose pads run along the mating direction), x is replaced by the in-plane axis perpendicular to z, signed toward pad 1 as above.
- A confirmed override (§15) replaces the inferred axis choice and applies `quarterTurns` × 90° about z.

### 14.5 Mate transform

For a B2B pair (board A connector `a`, board B connector `b`):

```text
B_world = A_world · F_a · T(0, 0, h) · Rx(180°) · Rz(k · 90°) · F_b⁻¹
```

- `k ∈ {0,1,2,3}`: the one that puts pad 1 on pad 1: the least summed distance across the mating plane between same-named pads (pads sharing a name count once, at their centroid), ties to the lower k; 0 when the two share no pad name. It is chosen on the **unturned** frames; `F_a` and `F_b` in the formula carry the user's `quarterTurns`, so a turn on either side turns the mated board about the mating axis.
- `h`: the link's `stackHeightMm` when given (§16.2). Otherwise the **clearance** height: each connector's body is a box in its own connector frame (§14.8); with B's box mapped through `Rx(180°)·Rz(k·90°)`, `h` is the least separation at which the two boxes don't overlap (A's top plus B's top when they overlap across the mating plane, otherwise 0), **plus 5 mm**, so an unknown stack is visibly apart rather than interpenetrating.
- The M4 tree solve, driving mates and `SYS-V11` follow PLAN §5.3; this section fixes only the algebra they use.

### 14.6 Extractor v6 geometry

`EXTRACTOR_VERSION` becomes **6**; every board re-extracts once. The interface gains `boardThicknessMm` (number, or null without a PCB) and each component gains `geometry` (null when the board has no PCB or the footprint is not placed on it):

```json
{"side": "top", "positionMm": [50.0, -10.0], "rotationDeg": 90.0,
 "footprintName": "PinHeader_1x04_P2.54mm_Vertical",
 "pads": [{"pad": "1", "positionMm": [50.0, -10.0], "sizeMm": [1.7, 1.7], "shape": "rect", "tht": true}],
 "courtyard": {"minMm": [-1.33, -8.95], "maxMm": [1.33, 1.33]},
 "model": {"path": "${KICAD10_3DMODEL_DIR}/Connector_PinHeader_2.54mm.3dshapes/PinHeader_1x04_P2.54mm_Vertical.step",
           "offsetMm": [0, 0, 0], "rotationDeg": [0, 0, 0], "scale": [1, 1, 1]}}
```

- `positionMm` and pad `positionMm` are in the **board frame** (§14.2). `rotationDeg` is KiCad's angle.
- `courtyard` is the axis-aligned bounds of the F/B.CrtYd graphics in the **footprint's own frame** (y up, before rotation); null when the footprint has none.
- `model` is the first enabled 3D model reference, unresolved (variables kept); null when none. M1 never loads it.
- Numbers are rounded to 1e-4 mm. Pads are listed in natural pad order; duplicate pad numbers keep every pad.
- `geometry` joins the interface digest, so a moved connector produces a new artifact but **never** a drift item by itself (drift compares pins and nets only, P1 §5).
- **v8 (SB2-22)** adds `boardOutlineMm`: `{"minMm": [x, y], "maxMm": [x, y], "source": "edge_cuts" | "items"}` in the board frame, or null without a PCB. It bounds the **board-level** Edge.Cuts graphics by their line centres (arcs by their true extent; curves by their control points). A board with none falls back to the extent of all its items (`source: "items"`, strokes included), as KiCad does. It joins the digest and never drifts, like `geometry`.

### 14.7 Stored poses (SB2-28)

- **Table** `system_poses` (migration 40): one row per instance of this system, `translation_mm` (3), `rotation` (4, canonical), `source`, `updated_by`, `updated_at`. Deleting the instance deletes its pose.
- **API** (P1 conventions: If-Match, 412/428):

  | Method and path | Role | Body / result |
  |---|---|---|
  | `GET …/poses` | reader | `{systemId, version, poses: [{instanceId, translationMm, rotation, source, updatedBy, updatedAt}]}`, stored poses only |
  | `PUT …/poses/{iid}` | designer | `{translationMm: [x, y, z], rotation: [x, y, z, w]}` → the stored pose, `source: "manual"`. The rotation is normalised and canonicalised; a zero or non-finite quaternion, or a translation beyond ±1 000 000 mm, is 422 |
  | `DELETE …/poses/{iid}` | designer | back to the default: `{instanceId, source: "default"}` |
  | `DELETE …/poses` | designer | every `manual` pose back to its default: `{reset: [instanceId…]}` |
  | `PATCH …/poses` | designer | *(SB2-38)* `{poses: [{instanceId, translationMm, rotation}], clear: [instanceId]}`: several stored and others cleared in **one** version, all or nothing; each instance at most once, 200 at most → `{poses: [{instanceId, …, source}]}` |

- **Engineering data, not connectivity.** A pose change bumps the system version and is audited (`pose_updated` with before and after; `poses_reset` with the instances), like a mating frame. It never changes the connectivity digest, so it never opens a review, moves drift or makes a parent see a new child revision.
- **Snapshots** freeze `placement.poses`, and a system imported from a manifest gets them back. A child system's poses are its snapshot's: inside a parent it moves only as a rigid group, by the parent's pose for the assembly instance.

### 14.8 The mate library (SB2-35)

Python `systems/placement/mate.py`, TypeScript `placement/mate.ts`; goldens in `placement_cases.json` `mates`.

- **An end** is `{geometry, thicknessMm, stored, bodyMm?}`: v6 geometry, the board thickness, the stored mating record `{axis, quarterTurns}` (null: the inference, §15.2 decides whether auto-placement may use it) and optional body bounds.
- **Body.** `bodyMm` is `{minMm, maxMm}` in the footprint's own frame (§14.6: y up, before rotation; a back footprint in its stored mirrored coordinates) with **z measured outward from the mounting surface**, e.g. the 3D model's bounds under its KiCad model transform. Without it the body is the courtyard (or, lacking one, the pad centres) × **5 mm**. Where the server gets model bounds is SB2-37's choice; the library only takes them.
- **`mate(a, b, stackHeightMm?)`** → `{pose, quarterTurns, stackHeightMm, heightSource}` or null when either end has no frame. `pose` is B's board frame in A's (§14.5); `heightSource` is `link` or `clearance`.
- **`residual(aWorld, bWorld, a, b, mateResult)`** → `{offsetMm, distanceMm, lateralMm, angleDeg}`: how far placed board B's connector is from where the pair's mate puts it. `offsetMm` is on A's connector axes (x, y across the mating plane; z along the mating axis, positive = further apart), `lateralMm` its x-y length, `angleDeg` the rotation between the two. `SYS-V11` (SB2-36) is built on it.
- **Datasheet goldens** (SB2-21 Samtec mezzanine): the 7.00 mm stack puts the top board at z = 8.60 with no rotation; the second pair's residual is 0 and the shifted commit's 1.50 mm; Samtec's body heights (terminal 4.90, socket 3.23) give a 13.13 mm clearance height.

### 14.9 The tree solve (SB2-36)

`solve(items, stored, connections, mates, overrides)` (Python `placement/solve.py`, TypeScript `placement/solve.ts`; goldens in `placement_cases.json` `solves`) places one system's members:

- **Usable mates.** A B2B link places only when both ends carry a **stored** frame (confirmed or override, §15.2) and `mate` (§14.8) returns a pose. Others are listed as `unusable` (the UI's "Mating details needed"). An end on an assembly gives `inMember`, its board's pose inside the member, so the assembly moves as a rigid group.
- **Groups and roots.** Members joined by usable mates form groups. Each group's root is its member with the most links of any type (the 2D layout's hub rule), ties to the earlier member in §14.3 order. A member with a driving override is not a root candidate unless every member has one.
- **Driving mates.** From the root outward, the next member placed is the one reached by the mate with the **most rows**, then the lower reference on the member being placed (natural order), then the link ID. A user **override** `{member: linkId}` (manifest `placement.drivingMates`) restricts that member to the named link. It is ignored, and reported in `ignoredOverrides` with a reason, when it names no usable mate of that member (`not_a_usable_mate`), when the member is its group's root (`root`), or when its link can only be reached through the member itself (`unreachable`).
- **Poses.** A stored `manual` pose wins. A root without one takes its default slot, and every other mated member takes `auto`: its driving parent's pose composed with the mate. Unmated members take their default slot (§14.3). `driving[member]` gives `{linkId, from, autoPose, overridden}`: `overridden` is true when a manual pose replaced the auto one, and `autoPose` is where "Snap back" returns it.
- **`SYS-V11 mate_mismatch`.** Every usable mate that isn't driving is measured with `residual` (§14.8) on the **designed** layout (every member where its mates put it, so a board moved by hand shows as overridden, never as a mismatch). A mismatch is a lateral offset above **0.2 mm**, an angle above **0.5°**, or, when the link has a stack height, an axial offset above 0.2 mm. `mismatches[]` gives `{linkId, offsetMm, lateralMm, axialMm, angleDeg}`. The finding itself is raised by the server in SB2-37.

### 14.10 Auto placement on the server (SB2-37)

- **Where.** Poses are solved on read, never stored: `GET …/scene` and the validation report run the same placement (`scene.place_tree`). A change of baseline, mating frame, link, stack height, driving choice or stored pose therefore shows on the next read. Only `manual` poses are stored (§14.7).
- **Levels.** Each system level is solved on its own: the root from the live system; a child system from its snapshot (its links, `mating[]`, `placement.poses` and `placement.drivingMates`), after which it moves as a rigid group. An end on an assembly follows the export down to its board; `inMember` is that board's pose in the assembly.
- **Inputs read.** Each board's outline and thickness, and only the mated connectors' components from the interface artifact. A stored frame whose geometry digest no longer matches is stale (§15.2) and the link is `unusable`, as is a link whose connector can't be read.
- **Driving mate choices.** Table `system_driving_mates (instance_id PK, system_id, link_id, updated_by, updated_at)` (migration 43); deleting the instance or the link drops the choice. API (P1 conventions: If-Match, 412/428):

  | Method and path | Role | Body / result |
  |---|---|---|
  | `GET …/driving-mates` | reader | `{systemId, version, drivingMates: [{instanceId, linkId}]}` |
  | `PUT …/driving-mates/{iid}` | designer | `{linkId}`, a `b2b` link with the instance at one end, else 422 → `{instanceId, linkId}` |
  | `DELETE …/driving-mates/{iid}` | designer | back to the solve's pick → `{instanceId, linkId: null}` |

  Audited `driving_mate_updated` (before, after); bumps the version; placement-only like poses (full digest, never connectivity). Manifests write and import `placement.drivingMates`.
- **Scene.** Each occurrence gains `mate`: `{linkId, from (occurrence path), overridden, autoPose}` when a driving mate placed it, else null; `pose.source` is `auto` for those. The descriptor gains `placement`: the root level's `{roots, mismatches, unusable, ignoredOverrides}`, or null without B2B links.

## 15. Mating frames (SB2-12)

### 15.1 Inference **[T2]**

Inference is a pure function of a component's v6 geometry (both languages, shared goldens in `placement_cases.json`). It returns `{axis, confidence, reasons}`, with `axis` null at `low`. Terms, all in the **footprint's own frame** (§14.6): the *pad box* is the bounding box of the pad centres grown by 1 mm; the *body centre* is the courtyard centre; the body is *off one side* when it lies outside the pad box, at least 0.5 mm from the pad centroid, within 20° of a footprint axis. Keywords are matched case-insensitively on the footprint name as whole `_`-separated words: vertical `_Vertical`; right-angle `_Horizontal`, `_RightAngle`, `_Right_Angle`, `_Angled`, `_RA`.

| Evidence | Result | Confidence |
|---|---|---|
| Vertical keyword, body centre in the pad box | `top` / `bottom` by side | `high` |
| Vertical keyword, no courtyard | `top` / `bottom` by side | `medium` |
| Right-angle keyword, body off one side | that side as `+x`/`-x`/`+y`/`-y` **in the footprint frame** | `high` |
| No keyword, body centre in the pad box (mezzanines such as Hirose DF40, or Samtec FTSH/ADM6 on JTYU) | `top` / `bottom` by side | `medium` |
| No keyword, body off one side | that side | `medium` |
| A keyword the geometry contradicts; no courtyard without a vertical keyword; fewer than two distinct pad positions; a body neither over the pads nor clearly off one side | none | `low` → **"Mating details needed"** |

The right-angle axis is kept in the footprint frame, so rotating the footprint (including by 45°) never invalidates it, and a back-side footprint's axis is read in its stored, mirrored coordinates.

`reasons` lists the evidence used (`name_vertical`, `body_over_pads`, …) for the UI.

### 15.2 Storage and use **[T3]**

- Table `system_port_mating (instance_id, port_key, mode, axis, quarter_turns, geometry_digest, updated_by, updated_at)`, primary key `(instance_id, port_key)`. Only **confirmed** and **override** records are stored; an inferred frame is always recomputed.
- `mode = confirmed`: the user accepted the inference as is. `override`: the user picked `axis`/`quarterTurns`.
- `geometry_digest` is the sha256 of the port's v6 `geometry` at confirmation. When the board's baseline moves and the digest differs, the record is kept but reported as **stale** (info finding `SYS-V17 mating_stale`), and auto-placement treats the port as unconfirmed until re-confirmed.
- **Auto-placement (M4) uses only confirmed or override frames.** A `high`/`medium` inference is shown pre-filled with a one-click Confirm; `low` shows "Mating details needed" and offers only the picker.
- Board and module ports only. An export end uses the mating record frozen in the child's snapshot manifest; a parent cannot override a child's connector frame.
- Manifest: `mating[]` holds the stored records (`mode` ∈ `confirmed` \| `override`, plus `geometryDigest`). Mating stays out of the connectivity digest.

### 15.3 API

| Method and path | Purpose |
|---|---|
| `GET …/instances/{iid}/mating` | `{instanceId, boardThicknessMm, ports}`: every **exposed** port as `{portKey, reference, footprint, hasGeometry, inferred: {axis, confidence, reasons}, stored: {mode, axis, quarterTurns, stale} \| null}` |
| `PUT …/instances/{iid}/mating/{portKey}` | `{mode: "confirmed"}` (takes the inference as is; an axis or turns with it is 422) or `{mode: "override", axis, quarterTurns}`; If-Match; audits `mating_updated` with before/after; bumps the system version; returns the port row |
| `DELETE …/instances/{iid}/mating/{portKey}` | Back to inferred; If-Match; audits `mating_updated` |

Errors: 409 `mating_not_inferable` when confirming a `low` inference (use override), 422 for an axis/turns outside the enum or a port that is not a component at the baseline, 422 on a subsystem instance (its frames are frozen in its snapshot), 409 `interface_not_ready` while the v6 artifact is missing. Manifests carry the stored records (`mating[]`) and import them as stored.

## 16. Link types (SB2-13)

### 16.1 Types and conversion **[T4]**

`system_links.type` ∈ `unspecified` \| `b2b` (§6.2, [S1]). P1 links are `unspecified` (migration default).

| From → to | Rule |
|---|---|
| `unspecified` ↔ `b2b` | `PATCH …/links/{lid}` `{type}`; rows are kept; audits `link_type_changed`. |
| link → harness | `POST …/links/{lid}/to-harness`: a 2-end harness whose ends mate the link's two ends, one wire per row (row ID kept in the wire's `label`, pins and net baselines copied), then the link is deleted. One audit `harness_created` with `fromLink`. |
| harness → link | `POST …/harnesses/{hid}/to-link`: only for **2 ends, no splices, identity pin maps**; otherwise 409 `harness_not_linkable`. Wires become rows of an `unspecified` link. |

### 16.2 B2B rules

- A `b2b` link's two ports must both be **board or module ports, or exports** whose target is one; each such port may be in **only one** `b2b` link and in **no harness end**. Otherwise 409 `port_already_mated` on create, type change or harness end assignment.
- `stackHeightMm` (optional, > 0) lives on the **link**, not the port, because it is a property of the mated pair (datasheet). It is placement-only (manifest `links[].stackHeightMm`, full digest only). **[T5]**
- Link details for a `b2b` link shows both ends' mating frames (inferred badge, confirm, override picker) and the stack height.
- On the diagram, **B** arms the next drawn link as `b2b` (a visible mode chip; Esc disarms). **H** arms harness creation (§17.2). Shortcuts fire only while the diagram has focus and no text field is active.

## 17. Harnesses (SB2-14, SB2-15, SB2-18, SB2-19)

### 17.1 Tables

`system_harnesses (id, system_id, name, label, cut_length_mm, service_allowance_pct)`, `system_harness_ends (id, harness_id, ordinal, mates_instance_id, mates_port, catalog_component_id, catalog_revision_id, part_pins, pin_count, pin_map, boot_mm)`, `system_harness_wires (id, harness_id, from_end, from_pin, to_end, to_pin, signal, gauge_awg, colour, label, net_from, net_to)`, `system_harness_nodes (id, harness_id, kind, position_mm, pinned, ord, ends, between_ids)` (migration 44, §17.9). Field meanings are the manifest's (§9.1). `mates_port` holds a port baseline like a link end (P1 §4), or an export baseline.

### 17.2 Behaviour **[T6]**

- **Ends.** 1–32 per harness. An end mates one port or export, or nothing. A port is mated by **at most one harness end** and then by no `b2b` link (409 `port_already_mated`). An `unspecified` link may still use a harness-mated port (P1 documentation links); V02 treats the harness end like any other use.
- **Mating block.** Every end has one. It starts **Generic**: `part = null`, `pinCount` copied from the mated connector, pins named by pad. Assigning a catalog `part` (§18) sets `pinCount` from the part's pins; a count that differs from the mated connector's keeps the assignment and requires a `pinMap` (error `SYS-V19` until every wired end pin maps).
- **Pin map.** `pinMap` maps **end pin → mated connector pad**; null is identity. Mapped pads must exist on the mated connector; each pad is mapped at most once.
- **Wires.** `from {end, pin}` → `to {end, pin}`, different ends. Several wires on one end pin form a **splice** (allowed; never a fan-out finding). A duplicate wire (same unordered pair) is `SYS-V01`.
- **Net baselines.** `netFrom`/`netTo` are the nets of the **board pins** the end pins map to, at the mated instance's baseline, captured like row nets (P1 §4.3). An unmated end has empty nets.
- **Generators.** P1's generators run **per end pair** (`POST …/harnesses/{hid}/generate {fromEnd, toEnd, generator, options}`), over the end pins mapped to the mated pins, and propose wires with the same skip rules as rows.
- **Creating.** H + drawing A→B creates a 2-end harness with Generic blocks on both ends and **identity wires** for the pads the two connectors share (the `identity` generator). Dragging from the harness node to a port adds an end with no wires.
- **P1 label migration.** `POST …/harnesses/from-label {label}` turns every link carrying that `harness` label into **one** harness: the ends are the distinct `(instance, port)` pairs of those links (ordered by first appearance), each row becomes a wire between the corresponding ends (row ID in `label`), and the links are deleted. One click per label on the Connectivity tab. Audits `harness_created` with `fromLabel`.
- **Drift.** P1 drift applies at each end's mate exactly as at a link end: item kinds `pin_missing`, `net_changed`, `connector_missing`, with `wireId`s in place of row IDs. Accept rewrites wire baselines; Remap edits the end's `pinMap`.
- **Validation.** `SYS-V01` (duplicate wires), `V03` (end mates an unexposed port), `V04` (a mapped pad is absent), `V06`/`V07` on mapped pins, `V09` (opt-in) and `V10` per wire, `V16` for export ends. V02 never counts wires of one harness against each other.

### 17.3 API

| Method and path | Purpose |
|---|---|
| `GET/POST …/harnesses`, `GET/PATCH/DELETE …/harnesses/{hid}` | CRUD; PATCH edits name, label, cut length and allowance |
| `POST …/harnesses/{hid}/ends`, `PATCH/DELETE …/harnesses/{hid}/ends/{eid}` | Add, re-mate, assign part, pin map, remove (removing an end deletes its wires) |
| `PUT …/harnesses/{hid}/wires` | Replace the wire list (like rows: server recaptures net baselines, validates pins) |
| `POST …/harnesses/{hid}/generate` | Per end pair (§17.2) |
| `POST …/harnesses/from-label`, `POST …/links/{lid}/to-harness`, `POST …/harnesses/{hid}/to-link` | Conversions (§16.1) |

All take If-Match and bump the system version. Audits `harness_created`, `harness_updated`, `harness_deleted`.

**As built (SB2-14).**
- `POST …/harnesses` takes `{name, label?, ends: [{instanceId, portKey} | {pinCount}], identity?}`; `identity` needs two mated ends and runs the `identity` generator. An unmated end's pins are `1…pinCount`.
- `POST …/harnesses/{hid}/generate` returns `{wires, skipped}` for `{fromEnd, toEnd, generator, options}`; skipped pairs carry `existing` or `unconnected`.
- **Suspect pairs (SB2-120).** Each proposed row (`POST …/links/{lid}/generate`) and wire (`…/harnesses/{hid}/generate`) carries `flags`: `[{rule, name, severity}]` for the join rules it would raise once saved (SYS-V09, V10, V23), computed with the same functions as validation. The preview marks flagged pairs, counts them, and **Leave out suspect** unticks them. Nothing is dropped automatically.
- Documents gain `harnesses[]`: `{id, name, label, cutLengthMm, serviceAllowancePct, linkable, ends: [{id, ordinal, mates: {instanceId, portKey, port, resolved, redacted} | null, part, pinCount, pinMap, bootMm, pins}], wires: [{id, from, to, signal, gaugeAwg, colour, label, netFrom, netTo, redactedEnds}]}`. An end on a hidden board keeps its place with `mates.port` null, no pins, and that side's wire nets null. Editing a harness with such an end is 404.
- Drift reads each mated end as a link-shaped view (`store.drift_links`): the item's `linkId` is the end ID, `rowIds` are wire IDs and `pins` are connector pads. Accept rewrites the wire's net on that side; Remap writes the end's `pinMap`; Remove rows deletes wires; a port update re-mates the end.
- Re-mating an end or editing its pin map recaptures every wire's nets. Converting links keeps their accepted row baselines as wire baselines.
- Harness findings carry `detail.harnessId` with `endId` or `wireId` (and `rowId` = the wire ID); duplicate wires report `duplicateOf`.
- Manifests export and import harnesses with their `nodes` (§17.9, since SB2-45).

**As built (SB2-18): mating housings as parts.**
- `PATCH …/ends/{eid}` takes `part: {componentId} | null`. A part must be an active catalog `part` (404 otherwise) with pins: its symbol's pins, or its footprint's pads when it has no symbol (422 when it has neither). The part's current revision is recorded (`catalogRevisionId`); the end's housing model is that revision's (§20.17).
- Migration 39 adds `system_harness_ends.part_pins` and `part_summary` (JSONB): the part's pin names and `{name, mpn, manufacturer}` at assignment, so documents, manifests and the ICD show the part without asking the catalog. The pins become the end's `pins` and set `pinCount`. Pin-map entries for pins the part lacks are dropped. Wires on pins the part lacks refuse the change (409 naming them), so no wire is ever dropped silently.
- `part: null` makes the block Generic again: `part_pins` cleared, `pinCount` back to the mated connector's.
- Documents gain `ends[].matePads` (the mated connector's pads, natural order; empty while unmated), the targets the pin map offers. `ends[].part` is `{componentId, revisionId, name, mpn, manufacturer}`. The manifest's `HarnessEnd` gains `partPins` and `PartRef` gains `name`, `mpn`, `manufacturer` (each omitted from the digest when null).
- A wired end pin whose pad the connector lacks keeps empty nets (it is not an error in itself); `SYS-V19` reports it while pin counts differ.
- The harness editor's block cell shows the part's MPN, **Choose part** (the connector's mates-with partners first, then any part by search), **Change part** and **Make generic**. The pin map lists the connector's pads.

### 17.4 ICD and CSV (SB2-19)

- ICD gains a **Harnesses** section per harness: ends (mated connector, block part or "Generic", pin map), the wire table (from end/pin/net → to end/pin/net, signal, gauge, colour, label) and splices. A `b2b` table lists each pair with mating frames and stack height.
- CSV export adds a harness column set: `harness`, `from_end`, `from_pin`, `to_end`, `to_pin`, `gauge_awg`, `colour`, `wire_label` (empty for link rows). Import accepts the same columns and round-trips an exported harness.

**As built (SB2-19, P2-1.20).**
- **Column names.** The end pins are `from_end_pin`/`to_end_pin`, not `from_pin`/`to_pin`: P1 import already reads `from_pin`/`to_pin` as board pads, and other tools' CSVs use those names. The seven columns `from_end, from_end_pin, to_end, to_end_pin, gauge_awg, colour, wire_label` follow the P1 columns; they are empty on link rows. `harness` keeps its P1 meaning (the drawing label).
- **Wire rows.** One per wire, after the link rows, harnesses by name, wires by from end, pin, to end, pin. `row_id` = wire ID, `link_id` = harness ID, `link_name` = harness name, `harness` = harness label. `a_*`/`b_*` name the board, connector and **pad** each end mates (after the pin map), with the wire's captured nets; they are empty for an unmated end and board-only for a restricted one. Ends are named `End N` by position. `status` is `error` for an error finding on the wire or either end, `review` for an open review item, else `ok`. RENDERER_VERSION 3 (4 from P2-1.66: same rows, new layout).
- **Import.** A row with `from_end` or `to_end` is a wire. Its harness is the one owning `row_id`, else the one named `link_name` (an unknown name creates a harness with that name and the row's `harness` as label). For an existing harness each end must exist at that position and mate the connector the row names, and the row's pad must be where the end pin lands; otherwise the row is a conflict (`end_not_found`, `end_mate_mismatch`, `pin_map_mismatch`). A new harness gets Generic ends at the rows' positions, mating the rows' connectors (an end with no connector is unmated, pins `1…N`), with a pin map wherever an end pin lands on another pad; a connector already mated by a harness end or a `b2b` link is `port_already_mated`. Also: `end_label_invalid`, `gauge_invalid` (0–40), `same_end`, `wire_in_other_harness`, `harness_ambiguous`. Signals are checked against the pads' nets as for rows; mismatches go to the import review, whose items may now carry a wire (`observed.kind = "wire"`). Parts are not in the CSV: an imported end is Generic. The commit report adds `harnessesCreated`.
- **ICD.** Stats count harnesses. Link headings say "board-to-board" and the stack height. **Board-to-board mating** lists each `b2b` link with both ends' stored frames (axis, quarter turns, confirmed or set by hand; "not confirmed" when none) and the stack height. **Harnesses** lists per harness its ends (mate, block with the part's MPN, pin map, boot), its wires and its splices. Link documents gain `a.mating`/`b.mating` (`{mode, axis, quarterTurns}` or null) for this.

### 17.5 Harness geometry numbers (SB2-40, D-P2-35)

Frozen for M5 (PLAN §7). Both placement-library halves hold them (`placement/harness_spec.py`, `placement/harness-spec.ts`) and equal `backend/tests/fixtures/system_builder/harness_spec.json`; changing one is a contract change.

| Quantity | Value | Used for (PLAN §7) |
|---|---|---|
| Boot | 10 mm | straight exit leg along the end's outward axis |
| Housing depth (no model) | 8 mm | mating face to cable exit |
| Breakout lift | 10 mm | N-end breakout above the weighted centroid, along the mean outward normal |
| Chord error | 0.2 mm | adaptive sampling of the centripetal Catmull-Rom curve (α = 0.5) |
| Minimum bend radius | 6 × bundle diameter, 8 relaxation passes | tight bends relax, else an info finding |
| Packing factor | 1.2 | bundle diameter `d = k·√Σ dᵢ²` |
| Ring segments | 12 | tube mesh |
| Breakout radius blend | 5 mm | tube mesh |
| Length allowance | 10 % | estimated total length |
| Length mismatch | 15 % | `SYS-V13` against a cut-length override |
| Board collision margin | 1 mm | board OBBs for `SYS-V12` |
| Default gauge | 24 AWG | a wire without a gauge |

**Wire diameters** `dᵢ` are M22759/16 finished diameters (SAE AS22759/16: ETFE, 600 V, medium weight, tin-coated copper, 150 °C), nominal, from NASA NEPP's AS22759/16 table, inches × 25.4: 24 AWG 1.143 mm, 22 → 1.3208, 20 → 1.524, 18 → 1.8034, 16 → 2.0066, 14 → 2.3622, 12 → 2.8956, 10 → 3.5306, 8 → 5.0546, 6 → 6.35, 4 → 7.9248, 2 → 9.8552, 1 → 10.9474, 0 → 12.1666, 00 → 13.8684. M22759/16 starts at 24 AWG, so a wire without a gauge, or with one the table lacks (26 AWG and finer, or a typo), takes the 24 AWG diameter and is marked **assumed**; the UI says so.

### 17.6 End poses and exit legs (SB2-41)

Python `placement/harness_ends.py`, TypeScript `placement/harness-ends.ts`; goldens in `placement_cases.json` `harnessEnds`.

- **Mating plane.** A harness end's housing meets its board connector at the top of the connector's body along `F_c`'s z: the body's height in `F_c` (§14.8: model bounds when given, else courtyard × 5 mm), never below the board surface. *(Refines PLAN §7 item 1, which put the housing face on `F_c`'s origin, inside the connector.)*
- **End pose.** `E = board pose · F_c · T(0, 0, h) · Rx(180°) · Rz(k · 90°)`: the housing's mating frame (§18.2: mating face on z = 0, mating toward +z, pin 1 toward −x), `k` the end's quarter-turns (default 0: pin 1 meets pad 1).
- **Cable exit.** The centre of the housing's rear face: the part model's bounds under its alignment (`T(offset) · Rz · Ry · Rx · S`, §18.2), the face at the lowest z; without a model, 8 mm deep (§17.5). A model aligned inside out (nothing behind the mating face) exits on the mating face.
- **Exit leg.** The **outward axis** is the connector's mating axis (`F_c` z in the world, away from the board). The **leg point** is the exit plus one boot (10 mm) along it; the curve (SB2-43) leaves the leg point tangent to that axis.
- An end on a connector without a frame (`low` inference, nothing stored) has no pose: "Mating details needed".
- Result: `{pose, exitMm, outward, legMm, depthMm, modeled, matingPlaneMm}`.

### 17.7 Topology, breakouts and segment wire sets (SB2-42)

Python `placement/harness_topology.py`, TypeScript `placement/harness-topology.ts`; goldens in `placement_cases.json` `harnessTopologies` (on the fixture's WH-001).

- **Input.** The ends that have a pose (§17.6) in ordinal order, as `{id, legMm, outward}`; the wires `{id, from: {end}, to: {end}, gaugeAwg?}`; the user's breakouts in order `{id, positionMm, ends?}` (SB2-45 stores them).
- **Tree.** Leaves are the ends' **leg points**; inner nodes are breakouts.
  - No user breakouts: two ends make one run; three or more meet at one automatic breakout `auto`, the wire-count-weighted centroid of the leg points (equal weights when no wire is placed) lifted 10 mm along the normalised mean outward axis (not lifted when the axes cancel).
  - User breakouts: consecutive ones are joined; each end joins the breakout that lists it (the first, if several do), else the nearest by leg point (ties to the earlier).
- **Segments** are the tree's edges, `id` `"<from>~<to>"`, end legs first in end order, then breakout links in order. A segment's **wires** are those whose two ends fall on opposite sides of it, in wire order.
- **Bundle diameter** `d = 1.2·√Σ dᵢ²` over a segment's wires (§17.5), `assumedGauge` when any wire's gauge was assumed; 0 for a segment no wire crosses.
- A wire touching an end without a pose is listed in `unplaced` and drawn nowhere.

### 17.8 Curves, bend radius and length (SB2-43)

Python `placement/harness_curves.py`, TypeScript `placement/harness-curves.ts`; goldens in `placement_cases.json` `harnessCurves`. The two halves produce the same samples (lengths agree within 0.01 mm, findings exactly).

- **Control polygon** per segment, from its `from` node to its `to` node: an end contributes its exit, the point half a boot out, its leg point, and the point half a boot beyond (so the curve leaves the leg tangent to the outward axis); a breakout contributes its position; the segment's **waypoints** (SB2-45) sit between, in order. Points closer than 1e-9 mm to the previous one are dropped.
- **Curve.** Centripetal Catmull-Rom (α = 0.5, Barry–Goldman form) through the polygon, with phantom end points reflected (`2P₀ − P₁`). Each span is split in half recursively, at least twice and at most 12 deep, until the mid-point is within the 0.2 mm chord error of its chord; the samples are the split ends in order.
- **Bend radius.** The radius at a sample is the circumradius of it and its neighbours. If the smallest is below `6 × d` (the segment's bundle diameter, §17.7), the **waypoint** nearest the tightest sample (by span index; ties to the earlier) moves halfway to the midpoint of its neighbours, and the curve is resampled; up to 8 times. Exits, legs, their tangent points and breakouts never move. If it still violates, the result carries `tightBend {atMm, radiusMm}`, raised as an info finding by SB2-46. *(Without waypoints nothing can move: a leg that turns sharply toward a nearby breakout reports a tight bend until the user adds a waypoint.)*
- **Length** is the polyline length of the samples.
- Result per segment: `{segmentId, controlMm (after relaxation), samplesMm, lengthMm, minRadiusMm (null when straight), minRadiusAllowedMm, tightBend}`.

### 17.9 Breakouts and waypoints (SB2-45)

Stored in `system_harness_nodes` (migration 44); Python `placement/harness_nodes.py`, TypeScript `placement/harness-nodes.ts`; goldens `placement_cases.json` `harnessNodes`.

- **Node** `{id (shd_…), kind, positionMm, pinned, order, ends, between}`, positions in mm in the harness's system frame.
  - A **breakout** lists the `ends` it branches to (each end at most one breakout); breakouts chain by `order`. `pinned` is false and `between` null.
  - A **waypoint** lies `between` two of the harness's ends or breakouts. The waypoints between one pair name them in the same order and go by `order` from `between[0]`. A **pinned** waypoint is never moved by bend relaxation (§17.8). `ends` is empty.
- **Into the geometry.** `breakouts(nodes)` feeds §17.7 in chain order. `segment_waypoints(tree, nodes)` gives each segment the waypoints of its node pair, reversed when `between[0]` is the segment's `to`, plus their pinned flags; waypoints whose pair is not a segment of the tree (an end without a pose, a breakout that no longer joins them) are listed as `unused` and drawn nowhere. The automatic breakout `auto` is never stored: editing it means storing a breakout in its place.
- **API.** `PUT …/harnesses/{hid}/nodes` (designer, If-Match) replaces the list and returns the harness document, which carries `nodes`. List order is chain order for breakouts and along-pair order for waypoints; `order` is derived from it. A new node may bring its own `shd_` ID (so a waypoint can name a breakout added in the same list). 422 for an unknown kind, a non-finite position or one beyond 1 km, an end or `between` node that is not the harness's, an end on two breakouts, a pinned breakout, mixed pair orders, or more than 256 nodes; 409 for an ID of another harness. Audited as `harness_updated` with `nodesAdded`/`nodesRemoved`.
- Deleting an end deletes the waypoints next to it and drops it from breakouts. Deleting a harness deletes its nodes.
- Nodes are placement data: in the full digest, not the connectivity digest (§9.3). Manifests and snapshots carry them; child systems' harnesses route through their snapshot's nodes.

### 17.10 Routes, lengths and collisions (SB2-46)

Python `placement/harness_route.py` and `placement/harness_checks.py`, TypeScript `harness-route.ts` and `harness-checks.ts`; goldens `placement_cases.json` `harnessChecks`.

- **Route.** From a scene harness (§20.15: ends with occurrence and connector, wires, nodes in the level's frame) and the occurrences' world matrices: the posed ends (§17.6) with their occurrence, the tree through the stored breakouts (§17.7, §17.9), the curves through the stored waypoints (§17.8), with each segment's `from`, `to`, wires, bundle diameter and assumed gauge. A harness with fewer than two posed ends has no route. The browser's tubes are drawn from the same route.
- **Lengths.** Bundle = Σ segment arc lengths + Σ posed ends' housing depths. A wire = the segments that carry it + its two ends' depths. Estimates multiply by 1 + allowance: the harness's `serviceAllowancePct`, else 10 % (§17.5). `complete` is false while a wire touches an unplaced end; the numbers then cover only what is routed.
- **Collisions.** A board is its scene box (`boundsMm`: outline × ±thickness/2 in its own frame) grown by 1 mm; a span between two samples is a capsule of the bundle radius. Its distance to a box is the minimum of the convex squared distance along the span, found by a 60-step golden-section search (plus both ends), in the box's frame; only squares and one square root are used, so the halves agree bit for bit. A span closer than the radius collides. The spans within the first 10 mm (the boot) of arc from an end's exit are exempt against the board that end mates. Result per colliding segment–board pair: `{segmentId, board, distanceMm, radiusMm, atMm, spans}`.
- **Server.** Validation routes the root level's harnesses where the System 3D view draws them (the solved placement, §14.10) and checks them against every board of the tree with an outline: `SYS-V12` per colliding pair, `SYS-V13` for a cut length more than 15 % off the estimate, `SYS-V20` (info) per segment with a tight bend. Child systems' harnesses are checked in their own system.
- **Documents and the ICD.** The live document's harnesses carry `lengths {bundleMm, estimatedMm, allowancePct, complete, wires: {id: {lengthMm, estimatedMm}}}` (0.1 mm; null without a route). The ICD's harness heading shows the estimate and each wire row its estimated length; the harness editor shows the estimate beside the cut length. The CSV columns are unchanged.
- **Browser.** Tubes are checked against the scene's boards on every placement change, drags included; a colliding segment draws red (the whole segment; per-sample tint is not done).

## 18. Mating parts in the catalog: mates with (SB2-16) and models (SB2-17)

### 18.1 "Mates with" **[T7]**

- Catalog migration 4: `catalog_mates_with (part_a, part_b, created_by, created_at)`, stored once with `part_a < part_b`, read in both directions, only between active `part` components (§3.4).
- API: `GET /api/catalog/components/{cid}/mates-with` (catalog browse roles, viewers included), `POST …/mates-with {componentId}` and `DELETE …/mates-with/{otherId}` (catalog writers). Each returns the part's current list. A change writes `component.mates_with_added` or `…_removed` into **both** parts' audit chains; re-adding an existing pair writes nothing. 404 for an unknown part, 422 for a non-part or a part paired with itself.
- **Identifying a board connector's part:** extractor **v7** records `mpn` per component: the first non-empty field named `MPN`, `Manufacturer_Part_Number`, `Manufacturer Part Number`, `MFR_PN`, `Mfr. No.` or `Mfr No` (case-insensitive). It is matched case-insensitively to the MPN of an active `part`'s current revision. An MPN that two parts share matches neither. No match means the part is unknown.
- **Suggestion:** `GET /api/systems/{id}/harnesses/{hid}/ends/{eid}/suggestions` returns `{connectorMpn, connectorPart, suggestions}` for a mated end. The harness editor shows the partners under a Generic block and first in its part picker. It **never assigns** one: a part is assigned only by the user's pick (`PATCH …/ends/{eid} {part}`, §17.3).
- **Findings** (per `b2b` link, and per harness end with a part):
  - `SYS-V18 mate_pair_unknown` (warning): both parts are known and the pair is not in mates-with. Detail: `{partA, partB}` for a link; `{harnessId, endId, part, connectorPart}` for an end.
  - `SYS-V19 mate_pin_mismatch` (error): the part's pin count differs from the connector's and wired part pins have no pin-map entry (§17.2). Detail: `{harnessId, endId, partPins, connectorPins, unmapped}`. Equal counts are not checked: same-named pins land on same-named pads.
  - An unknown part on either side, or no catalog, is not evaluated and never counts as a pass.

| Rule | Name | Severity |
|---|---|---|
| SYS-V17 | `mating_stale` | info |
| SYS-V18 | `mate_pair_unknown` | warning |
| SYS-V19 | `mate_pin_mismatch` | error |

### 18.2 Models and alignment (SB2-17)

- **Conversion.** A part's `3dmodel` assets that are STEP files convert to GLB with Geometer (`step_to_glb`). Bounds come from `model_bounds`, in the STEP's own frame, in mm. The catalog job `catalog_model_glb` runs it. `POST …/components/{cid}/models/convert` queues the job (writers) for the current revision, or for `?revisionId=` (404 unless it is a revision of that component); converting in the domain is idempotent. `GET …/components/{cid}/models` takes the same `?revisionId=` (404 likewise) and lists that revision's models. A job is keyed by component, revision and converter, so a new Geometer converts again. A visible pinned module or part revision, or the part revision a visible harness end pins (its housing, §17.3), whose STEP has no GLB queues that revision's job when a reader allowed `catalog_write` reads the system's scene (§20), unless a job for that key has already ended (failed, cancelled, or completed without a GLB); Convert with `revisionId` retries it. Other reads only draw no model. Such a scene carries `modelsConverting`, the number of those revisions with a job queued or running, and the System 3D view re-reads it every 5 s while it is non-zero; when it drops to zero, the inspector and harness ends re-read their pinned revisions' models. The pins' latest jobs are read in one query, and a pin whose job is still active asks the catalog nothing, so the poll is cheap.
- **Convert in System Builder.** A module or part instance's inspector shows its pinned revision's model state (`Model`: Converted, Not converted, None); a harness end whose part's pinned revision has an unconverted STEP shows it under the block. For a catalog writer each carries Convert, which queues `?revisionId=` for the pinned revision, never the current one, then re-reads the revision's models (one read per revision, shared by every end and inspector showing it) and the scene once the conversion settles.
- **Cache.** Catalog migration 5 adds `catalog_model_glb`, keyed by `sha256(STEP sha256 + converter)`. The converter is Geometer's version (`geometer-2026.9.7`). That version *is* the tessellation setting: this Geometer's GLB export ignores deflection options (checked: identical output across options on planar and cylindrical models). An unchanged STEP is never converted twice, and a new Geometer produces new files. The GLB is served at `GET /api/catalog/models/{key}.glb`, immutable and cacheable.
- **Alignment.** Catalog migration 5 also adds `catalog_model_alignment (component_id, asset_id, alignment_json)` with `{offsetMm[3], rotationDeg[3], scale}`, applied as `T(offset) · Rz · Ry · Rx · S` (rotate about x, then y, then z). It maps the model into the part's **mating frame**: mating face on z = 0, mating toward +z, pin 1 toward −x (the housing twin of `F_c`, §14.4). It is set with `PUT …/components/{cid}/models/{assetId}/alignment` (writers; audited `component.model_aligned`). It belongs to the part, so every harness end or module using the part reuses it, and it is never baked into the GLB.
- **Preview.** `GET …/components/{cid}/models/{assetId}/preview.svg?view=front|side|top&offset=&rotation=&scale=&partner=` renders an orthographic, coloured SVG with Geometer (`model_tessellation` + `mesh_illustration`, about 0.2 s per model). It uses the given alignment (unsaved) or the saved one. `partner` adds the first STEP model of a mating part under its own saved alignment, turned half a turn about x, so the two mating faces meet at z = 0. The M2 viewer replaces this with a live 3D view.
- `GET …/components/{cid}/models` lists `{assetId, name, stepSha256, glb: {key, converter, bounds, materials, sizeBytes} | null, alignment}`. The model reads and the preview are open to browse roles (the viewer list grows to 26).
- **Evidence.** `fixtures/system_builder/p2/evidence/models/record.json` holds five KiCad stock models, including a 4-colour RJ45 and an 8.9 MB, 400-pin Samtec FMC. For each, Geometer's bounds are compared with `kicad-cli`'s GLB of the model placed by its stock footprint.

## 19. Revision log

| Version | Date | Change |
|---|---|---|
| P2-1.96 | 2026-10-15 | #698: a harness end's housing is the model of the part revision the end pins (§17.3, §20.17; scene ends gain `partRevisionId`), and a scene read by a catalog writer queues its conversion. A module connector placement records its part's revision (catalog migration 10) and reads the footprint and model from it; a module instance's connectors use its pinned revision's units (§3.6, §5.6). Moving a placed connector keeps its part revision; `updatePartRevision` takes the current one. `GET …/models` takes `revisionId`; the instance inspector and harness end offer Convert for the pinned revision, and the scene's `modelsConverting` keeps a writer's view polling until queued conversions settle (§18.2). |
| P2-1.95 | 2026-10-14 | A module or part instance draws the model of its pinned revision, not the component's current one (§5.6, §24.1); alignment stays per component. `POST …/models/convert` takes `revisionId`; a scene read by a catalog writer queues the conversion of a pinned revision that has none; conversion jobs are keyed per converter (§18.2). |
| P2-1.94 | 2026-10-11 | AC-37: the systems list's `findingCounts` are written by write paths only (D12): after a system write commits (and after a collision run, a stored board interface, a source check or a git sync) its counts are rebuilt outside the lock; document and report reads write nothing. The 3D toolbar's collision count and a collision selection leave waived SYS-V22 findings out (D1). |
| P2-1.93 | 2026-10-09 | SB2-125: default layout puts boards with no link side by side below the linked ones, four to a row (canvas and ICD block diagram, parity case added); an expanded board pushes the blocks below it in its column down. |
| P2-1.92 | 2026-10-09 | SB2-122: the release chain of a subsystem revision (`latestReleasedVersion`, `newestVersion`, `newestReleaseStatus`; §10) in its inspector and diagram node. |
| P2-1.91 | 2026-10-09 | SB2-123: the wire table takes a pasted spreadsheet block (signal, AWG, colour; down and right from the cell) and sets one AWG/colour on ticked wires. Editor only; no API change. |
| P2-1.90 | 2026-10-09 | SB2-124: `POST …/instances` with a `trackedRef` also queues the source check (P1 §10.1), so a new board is never "Not checked"; **Add → Board** takes several boards (one call each, ETag carried), keeping refused ones with their reason. |
| P2-1.89 | 2026-10-09 | SB2-121: batch exports (§4.2 rule 9) and **Export connectors…**. |
| P2-1.88 | 2026-10-09 | SB2-120: generator previews flag suspect pairs (`flags`, §17.3). |
| P2-1.87 | 2026-10-09 | SB2-119: SYS-V23, a named net meets a pin on no net (§8.4). |
| P2-1.86 | 2026-10-09 | SB2-117: a subsystem's open findings, frozen in its pinned snapshot, on the node, inspector and top bar (§10). |
| P2-1.85 | 2026-10-09 | SB2-116: snapshot listings carry `findingCounts {error, warning}` and `exportCount` from the frozen document; the snapshot dialog shows the live system's open errors, warnings, unreviewed changes and exports, and the publish dialog the snapshot's, warning when it has no exports. |
| P2-1.84 | 2026-10-09 | SB2-115: **Connect…** on a port and **New connection** on the Connections tab make a link, board-to-board link or harness from two lists of connectors (board, reference, MPN, pin count, sub-ports included; a mated or split connector is refused where it cannot be used), then open it. |
| P2-1.83 | 2026-10-09 | SB2-114: a link with no rows offers **Fill pins: Same pin / Reversed** (the generator's rows saved in one step, Undo after); a B2B mating panel offers **Confirm both** when both ends have an inferred frame and neither has a stored one. |
| P2-1.82 | 2026-10-09 | SB2-118: generated rows take their signal from the first net a designer named (side A first), KiCad's `Net-(…)`/`unconnected-(…)` only when neither side has another; the ICD (renderer 6) names rules by their labels and its block diagram drops unlinked ports; creating a system whose boards all fail deletes it again; an empty system opens on the Diagram. |
| P2-1.81 | 2026-10-09 | SB2-113: batch waivers (§8.5), the Findings tray's filter, group and place waivers, and large groups split by place. |
| P2-1.80 | 2026-10-09 | SB2-112: join findings (SYS-V01/V09/V10, rows and wires) placed at side A's pin with side B's in the detail, so each has its own key (§8.5); the Findings tray shows pins and nets, Show opens the row (`&row=`). |
| P2-1.79 | 2026-10-09 | SB2-106 follow-up: the board page's Used in section restyled like the README; proposals no longer listed there (§23.5). |
| P2-1.78 | 2026-10-09 | SB2-109 part 2: harness tubes and end housings in the system STEP (§25); the STEP is not attached to snapshots. |
| P2-1.77 | 2026-10-09 | SB2-111 (D-P2-60): the harness drawing restyled after WireViz on the route tree (§26.3): connector tables, every wire fanned into the bundle, wire list and BOM on the sheet, and a viewer in Prism that traces a wire. Segments named by their nodes in the BOM and WireViz. |
| P2-1.76 | 2026-10-09 | SB2-110: harness manufacturing outputs (§26). A contact part per end and coverings per segment (migration 54, manifest `contactPart`/`coverings`); per harness a layout drawing (SVG, PDF), a wiring list and a BOM (CSV) and a WireViz YAML. |
| P2-1.75 | 2026-10-09 | SB2-109 (D-P2-59): the system STEP export (§25), an OCCT (cadquery-ocp) XCAF assembly of board STEPs from `kicad-cli` and catalog STEPs at their 3D-view poses, run as `system_step_export`; board STEPs cached per commit. |
| P2-1.74 | 2026-10-09 | SB2-108 (D-P2-58): mechanical parts (§24.1), instance kind `part` from catalog parts with a model; the collision check (§24.2), mesh intersection with python-fcl run as `system_collision_check`, SYS-V22 `part_collision`; migration 52. |
| P2-1.73 | 2026-10-09 | SB2-106 (D-P2-57): net rename proposals (§23): one per net on one board; migration 51; applied by the board's next commit with no review when the rename is the only change; `GET /api/systems/by-project/{projectId}` and its renames CSV for the board page's **Used in** panel; a Renames sheet in the report. SYS-V09 runs on every system; `optionalRules` is kept but has no effect. |
| P2-1.72 | 2026-10-09 | SB2-105 (D-P2-55): sub-ports (§22). Named pad sets carved out of a connector or subsystem export, usable as link ends and export targets; the remainder stays on the connector; carving re-homes rows (retarget or split links) in one audited change with a preview; `b2b` connectors cannot be split; SYS-V21 `subport_pad_absent`; migration 50; manifest `subports` and `subportId` omitted while empty. |
| P2-1.71 | 2026-10-09 | SB2-107: the reviews and findings report, `GET …/report.xlsx` and `…/report.csv` (§8.6). `openpyxl` becomes a direct runtime dependency (it was already locked through `kicad-cruncher`). |
| P2-1.70 | 2026-10-09 | SB2-101: system summaries carry `boardTotal` (boards counted through every subsystem; null if the hierarchy can't be resolved). `GET /api/systems` also carries `lastSnapshot {id, name, createdAt}`, `git {branch, outsideChange, error}` and `findingCounts` (the last document build's counts, only when built at the current version). Counts live in `system_finding_counts` (migration 49), without a foreign key so a reader recording them never holds a lock an editor waits on. |
| P2-1.69 | 2026-10-09 | SB2-100 (D-P2-56): finding keys and waivers (§8.5): warnings and info only, with a note, versioned, in the manifest and the ICD (renderer 5); counts leave waived findings out. |
| P2-1.68 | 2026-10-09 | SB2-98: `GET /api/systems/{id}?include=validation` returns the §7.2 report (redacted) with the document. The live document carries `sceneKey` and `netsKey`, digests of what the scene (instances, link ends and types, stack heights, harnesses, mating, poses, driving mates) and the system nets (instances, link ends, row pins and nets, exports, harnesses) depend on; readers re-read those only when the key changes. Snapshots do not freeze the keys. |
| P2-1.67 | 2026-10-09 | SB2-97: the hierarchy limits are also checked when a manifest import is accepted (a refused import rolls back whole), and an advance is re-checked under the lock; flattened and direct limits documented together (§5.3). |
| P2-1.66 | 2026-10-08 | SB2-71..73 (M9): the ICD renderer is version 4. Its block diagram is the Diagram tab's (`layout.py` ports `system-layout.ts`, checked by `tests/fixtures/system_builder/layout_parity.json`): harness blocks, saved canvas positions (a snapshot's from its manifest), kind colours (D-P2-50) and a legend. The document gains a contents list, section ids, a connections overview linking to each connection (`#link-{id}`), each connection's findings beside it, a Modules table and stat apart from Subsystems, and a variable-driven stylesheet with `prism-dark` and `prism-embed` classes for the workspace (D-P2-52); exports stay white. |
| P2-1.65 | 2026-10-08 | SB2-55 (D-P2-46): §21.6 a revision of a committed snapshot records `git {url, branch, commit}` in `source_ref`; 409 `git_commit_pending` while the commit is queued; `POST …/git/commits/{sha}/publish` publishes Prism's own snapshot commits only. |
| P2-1.64 | 2026-10-08 | SB2-54: §21.3 `manifest_import` reviews (migration 46): opened on a new outside commit with a summary and problems, superseded by newer pushes; accept replaces the system with the manifest (same IDs), reject keeps it; both clear the outside change. §21.4 periodic fetch of linked systems. |
| P2-1.63 | 2026-10-08 | SB2-53: §21 implemented. Migration 45 (`system_git_links`, snapshot `git`); jobs `system_git_sync` and `system_git_commit` both take the write lock; failures are recorded and retried through `git-retry`, never by the job runtime; error details are `code: …` strings. |
| P2-1.62 | 2026-10-08 | SB2-52 (D-P2-42..45): §21 Git tracking. A system links to an existing remote and branch; snapshots commit `prism.system.json` there (author = the Prism user, committer = KiCAD Prism, lease-guarded push, no force); an outside manifest change refuses snapshots until it is imported through review (SB2-54). |
| P2-1.61 | 2026-10-08 | SB2-51b (D-P2-41): §3.3 every assembly publish attaches a generated multi-unit symbol (one unit per export, pins = pads named by net). |
| P2-1.60 | 2026-10-08 | SB2-51: §5.6 module release follow and drift (connectors as the candidate interface); §3.5 a module's symbol import replaces its symbol. |
| P2-1.59 | 2026-10-08 | SB2-50: §5.6 module pins in system nets and the System 3D view (lit and framed with a set, no Layers section, moved like a board). |
| P2-1.58 | 2026-10-08 | SB2-49: §5.6 module instances (connectors as ports with signals as nets, footprint pose and catalog frame for mates and harness ends, the scene's model box); `POST …/instances` takes `kind: "module"`. |
| P2-1.57 | 2026-10-08 | SB2-48b (D-P2-40): §20.18 scene occurrences with their own `model`/`box`, gizmo `move` limits, `pickSurface` and the viewer's `pickSurfaceAt`/`focusMoveTarget`/`viewAxis`; §3.6 connectors placed on modules (face frame, footprint pose `P · F_part⁻¹`, goldens `modulePorts`), catalog migration 7 `catalog_module_connectors`, `GET/PUT/DELETE …/module-connectors`, `GET …/connector-geometry`, the every-connector-placed release gate; §3.5: pads are unique within a unit, not across the symbol. |
| P2-1.56 | 2026-10-08 | SB2-48 (D-P2-39): §3.5 modules: created through the normal component flow with `kind: "module"`; the interface (`prism.module_interface.v1`) is derived from the module's multi-unit symbol on every sealed revision (units = connectors, pin names = signals); models on modules; module release gates (interface + STEP model); revision clones keep `interface_json`/`source_ref_json` (they were dropped). |
| P2-1.55 | 2026-10-08 | SB2-47: §20.17 housings at harness ends: scene ends carry the part's model (`housing`), the route exits at its rear face, the viewer draws the GLB under its alignment or a proxy box; a housing click picks its harness. Radius blends at breakouts deferred. |
| P2-1.54 | 2026-10-08 | SB2-46: §17.10 routes, lengths and collisions (library pairs `harness_route`/`harness_checks`, goldens `harnessChecks`); `SYS-V12 harness_collision`, `SYS-V13 length_mismatch`, new info rule `SYS-V20 harness_tight_bend`; harness lengths in documents, the ICD and the harness editor; colliding tubes draw red. |
| P2-1.53 | 2026-10-08 | SB2-45b: §20.16 harness picking and route editing in move mode: tube picks, `harness` events, node handles, the gizmo on a node, the harness panel (add waypoint or breakout, pin, remove), ordered picks. |
| P2-1.52 | 2026-10-08 | SB2-45a: §17.9 harness breakouts and waypoints: migration 44, `PUT …/harnesses/{hid}/nodes`, manifest `nodes` with `between` (import no longer refused), scene harnesses carry nodes, library pair `harness_nodes` (goldens `harnessNodes`) and pinned waypoints in §17.8; tubes route through them (§20.15). |
| P2-1.51 | 2026-10-08 | SB2-44: §20.15 harness tubes: scene ends carry their connector (geometry, thickness, stored frame) and part, wires their gauge; the viewer bundles the placement library, recomputes curves on every placement change, and builds rotation-minimising tubes in a compute pass. Ten harnesses on the JTYU stack while dragging a board: ~101 fps mean, p95 17 ms. |
| P2-1.50 | 2026-10-08 | SB2-43: §17.8 harness curves (library pair, goldens `harnessCurves`): control polygons with tangent points, centripetal Catmull-Rom sampled to 0.2 mm chord error, waypoint relaxation for the 6 d bend radius, tight-bend reports, arc length. |
| P2-1.49 | 2026-10-08 | SB2-42: §17.7 harness topology (library pair, goldens `harnessTopologies` on WH-001): runs, the automatic weighted breakout, user breakouts, segment wire sets and bundle diameters. |
| P2-1.48 | 2026-10-08 | SB2-41: §17.6 harness end poses and exit legs (library pair, goldens `harnessEnds`); the housing meets the top of the connector body, not the board surface. |
| P2-1.47 | 2026-10-08 | SB2-40: §17.5 the frozen harness geometry numbers (PLAN §7 defaults, signed off as D-P2-35) and the M22759/16 wire diameter table (NASA NEPP), default 24 AWG; unknown gauges assumed 24. |
| P2-1.46 | 2026-10-08 | SB2-39: §20.14 mating in link details: `GET …/placement` and `GET …/links/{lid}/mate`; the solve's status per link with the V11 numbers, the driving choice, and a live preview of the mated pair while a frame is picked. Completes M4. |
| P2-1.45 | 2026-10-08 | SB2-38: §20.13 moving mated boards: the stack prompt (Move with its stack / Break the mate), stack moves and their Revert as one `PATCH …/poses` (§14.7), Mated / Mate overridden badges and Snap back. |
| P2-1.44 | 2026-10-08 | SB2-37: §14.10 auto placement on the server: the scene and validation solve every level on read; `SYS-V11 mate_mismatch` (warning) is live; migration 43 `system_driving_mates` with `GET/PUT/DELETE …/driving-mates`; manifests carry `placement.drivingMates`; scene occurrences gain `mate`, the descriptor `placement`. |
| P2-1.43 | 2026-10-07 | SB2-36: §14.9 the tree solve pair: usable mates (stored frames only), roots by the hub rule, driving mates by rows then reference with user overrides (and the reasons one is ignored), `auto` poses, snap-back poses, and SYS-V11 residuals on the designed layout. The misplacement fixture yields V11 at exactly 1.5 mm. |
| P2-1.42 | 2026-10-07 | SB2-35: §14.8 the mate library pair (`mate`, `residual`, body boxes, clearance); §14.5 spells out `k` (unturned frames, user turns on top) and the clearance height; §14.4 builds `F_c` from **numbered** pads only (unnumbered holes when there is no numbered pad). The stock-footprint goldens are unchanged; the Samtec mezzanine now poses exactly. |
| P2-1.41 | 2026-10-07 | SB2-30a (R2, R5): §20.12 level of detail in mode="system": a body level (substrate and mask) between board and box, thresholds in CSS pixels, live tuning with the stats overlay (`setLodThresholds`, kept per browser), labels re-placed only when the view changes. Perf-25 fit-all: 52.5 → ~118 fps, p95 25 → 9.3 ms, 50.1 M → 11 M triangles; JTYU six boards: 58 → 81 fps, p95 25 → 17.5 ms. Board 3D tab pixel diff 0 px. |
| P2-1.40 | 2026-10-07 | D-P2-30 dead-code removal: the board viewer's one-board multi-occurrence mode (`setOccurrences` on the element and controller) is gone, with `setMoveAllowed()` (the `move-allowed` attribute remains), the `"gizmo"` pick kind, the `systemstatus` event, the viewer's Euler helpers and the frontend's unused `getPoses`. `projectComponent` / `projectPoint` take an occurrence in mode="system". §20.3–§20.5 marked superseded where §20.6–§20.8 replaced them. Board 3D tab pixel diff on JTYU-OBC: 0 px. |
| P2-1.39 | 2026-10-07 | SB2-21 review: the mezzanine fixtures move from Hirose DF12(3.0) to Samtec ADM6-30-03.5-L-4-0-A / ADF6-30-03.5-L-4-0-A (the JTYU OBC–CMBD pair; user choice). Footprints written from Samtec's recommended PCB layouts; goldens: mated height 7.00 mm (Samtec ADX6 mated views, Table 1), top pose (0, 0, 8.6) mm, frames at `medium` confidence (no orientation keyword, §15.1). Vendor models are not redistributed. No contract rule changes. |
| P2-1.38 | 2026-10-07 | Follow-up review finding 3, D-P2-31: delete archives a referenced system (frozen parent snapshots count), `archivedAt`, 409 `system_archived`; `DELETE` answers 200 with the outcome. Workspace migration 42. |
| P2-1.37 | 2026-10-07 | Follow-up review findings 1–2: §5.4 hidden export ends now also redact re-export interfaces (live and frozen), review items, candidates and pending changes, and history events. |
| P2-1.36 | 2026-10-07 | Retrospective fixes (RETRO-M0-M3): §5.4 hidden export ends (D1 snapshot crash, D2 nets through exports); D-P2-29 delete refusal (409 `published_in_catalog`); release jobs report `superseded` / `not_following` instead of rolling back (D4); `GET …/nets?offset=` (D6). Viewer: a staged bundle that turns ready at the same URL loads (D5). |
| P2-1.35 | 2026-10-07 | SB2-34: §20.11, proxy harnesses. The scene gains `harnesses`; emphasis sets take `wires`; the viewer draws each harness as straight segments that light per wire and glow their ends. Completes M3. |
| P2-1.34 | 2026-10-07 | SB2-33: §20.10, net search in the System 3D tab: a board picker, one result per system net found by any of its names, Shift-pick adds it to the highlighted nets. `GET …/nets?members=true` (§8.2). |
| P2-1.33 | 2026-10-07 | SB2-32 (D-P2-28): §20.9, click to trace. `GET …/nets?occurrence=&net=` exact lookup (§8.2); the clicked board net's system net lit in the selection green on every board; the System net card with boards and ordered hops; `frameParts`. Move panel: Revert undoes saved moves (SB2-31f follow-up, #490). |
| P2-1.32 | 2026-10-07 | SB2-31f: §20.8. Move mode, board labels, the key list and one GPU budget in the 3D tab's viewer; stackup separation per placement (user request); `<prism-system-scene>` retired. No API change. |
| P2-1.31 | 2026-10-07 | SB2-31e.2: §20.7, the System 3D tab on the 3D tab's viewer: left rail with a Layers section per board, the 3D tab inspector on the board's design index, search over every board, system nets in the right rail. Move mode and labels wait for SB2-31f. |
| P2-1.30 | 2026-10-06 | SB2-31e (D-P2-25, D-P2-26): §20.6, the board 3D tab's viewer with several boards (`<prism-semantic-viewer mode="system">`); per-placement copper layers; isolated picks skip unlit copper on every viewer. No API change. |
| P2-1.29 | 2026-10-05 | SB2-31 follow-up 2 (user feedback): framing per occurrence with no padding, as the board 3D tab frames a net; isolated clicks on hidden copper are empty space; outer copper and barrels take the board's surface finish from its topology, as on its 3D tab. |
| P2-1.28 | 2026-10-05 | SB2-31 follow-up (user feedback): highlighting follows a board's 3D tab net probe (no board body or components; all copper, unlit dimmed, lit nets pulsing; inner copper at every detail level); **I** isolates the lit copper (`setNetIsolation`, `isolation` event); a newly shown net is framed (`frameNetEmphasis`). |
| P2-1.27 | 2026-10-05 | SB2-31: net emphasis per occurrence (§20.5). `setNetEmphasis` on `<prism-system-scene>`, packed-colour emphasis table in the instanced shaders, dimming and see-through boards while lit, >200-pin confirmation in the 3D tab. No API change. |
| P2-1.26 | 2026-10-05 | SB2-29: §20.4 move mode: gizmo, numeric panel, axes toggle, snapping, saving on release through `PUT …/poses/{iid}`, element move API and `move` event, focus-scoped keys and the `?` list. |
| P2-1.25 | 2026-10-01 | SB2-28: stored poses. Migration 40 `system_poses`; `GET/PUT/DELETE …/poses/{iid}` and `DELETE …/poses` (§14.7), version-checked and audited (`pose_updated`, `poses_reset`); manifests write `placement.poses` and import them (driving mates are still refused); the scene draws stored poses, and a child system's from its snapshot. Placement library: `pose_from`, `place` and the TypeScript twin `placement/poses.ts`, with pose goldens in `placement_cases.json`. |
| P2-1.24 | 2026-10-01 | SB2-23…27: §20.3 System 3D tab and `<prism-system-scene>`. §20.2: the `webgpu_3d` job key names the generator build; the scene reads only the outline and thickness of each interface artifact; `last_build` reads decoded job ids (`job_id`). |
| P2-1.23 | 2026-10-01 | SB2-22: §20 system scene (`GET …/scene`, `prism.system_scene.a0`): occurrences with default poses and world matrices, board assets per (project, commit) with `bundleToBoard`, bundle builds queued for designers, restricted boards and child systems as boxes. Extractor **v8** `boardOutlineMm` (§14.6; every board re-extracts once). §14.3 default row: label order instead of creation order, assembly boxes, empty slots. Placement library gains `poses` (Python; the TypeScript twin comes with SB2-28). |
| P2-1.22 | 2026-10-01 | SB2-21: geometry fixtures (plan §8, M1 set): `mezz_base`, `mezz_top` F0/F1, `edge_a`, `edge_b`, `ambiguous`, built through KiCad's IPC API (not SWIG) and clean on ERC, DRC with schematic parity and library checks, netlist, STEP and GLB with 10.0.6. Goldens: DF12(3.0) mated height 3.0 mm from Hirose EDC-390687-51-77, top pose (0, 0, 4.6) mm over the base, V11 shift 1.5 mm, frames per connector. Vendor models are not redistributed. No contract rule changes. |
| P2-1.21 | 2026-10-01 | SB2-20: §8.2 as built for harness wires: edges through pin maps, splices, export ends, subsystem manifests' harnesses, unmated ends as internal nodes; wire hop shape; 3-end splice golden. |
| P2-1.20 | 2026-10-01 | SB2-19: §17.4 as built. CSV wire rows and seven harness columns (`from_end_pin`/`to_end_pin` renamed from the plan's `from_pin`/`to_pin`, which collide with P1 pad columns); import of wire rows into existing or new harnesses with conflicts named; ICD Board-to-board mating and Harnesses sections; link documents gain end `mating`; renderer 3. |
| P2-1.19 | 2026-09-30 | SB2-18: mating housings as parts. Migration 39 `part_pins` and `part_summary`; `PATCH …/ends/{eid} {part}` assigns or clears (404/422/409 refusals); end documents gain `matePads` and the part's name and MPN; manifest `HarnessEnd.partPins` and `PartRef` name/mpn/manufacturer; SYS-V19 lands; harness editor part picker, Make generic and a pin map over the connector's pads. |
| P2-1.18 | 2026-09-30 | SB2-17: §18.2 catalog models. Catalog migration 5 (GLB cache by STEP sha256 + converter; per-part alignment); job `catalog_model_glb`; models, convert, alignment, preview and GLB routes; part page 3D models panel with a numeric alignment editor and a Geometer SVG preview, alone or mated. §18 renamed and split into 18.1/18.2. |
| P2-1.17 | 2026-09-30 | SB2-16: catalog migration 4 `catalog_mates_with`, routes (GET for browse roles: the viewer list grows to 23), audit events on both parts; extractor v7 `mpn`; harness-end suggestions; SYS-V18 on b2b links and parted harness ends; catalog part page gains Mates with; the harness editor shows suggestions. |
| P2-1.16 | 2026-09-30 | SB2-15 harness UI: the diagram lays out each harness as a board whose ports are its ends (mated ends are its links), drawn with a dashed border and a mating cap per end; **H** arms harness creation (identity wires between two ports); dragging from **Add an end**, or from an unmated end, to a port adds or mates an end; nodes without a saved position move clear of saved ones. Connections lists harnesses and opens the harness editor (ends, pin maps, wires with splices, generators per end pair, details, conversion, delete). Links offer Convert to a harness and Make harness from label. |
| P2-1.15 | 2026-09-30 | SB2-14: migration 38 (harnesses, ends, wires); harness store, service and API (§17.3); link↔harness and label conversions (§16.1); a port mated once across b2b links and harness ends (T6); drift and reviews through harness ends; wire validation (V01, V03, V04, V09 opt-in, V10); document, redaction and manifest harnesses. "As built" notes in §17.3. |
| P2-1.14 | 2026-09-30 | SB2-13: migration 37 (`system_links.type` default `unspecified`, `stack_height_mm` b2b-only); `POST …/links` and `PATCH …/links/{lid}` take `type` and `stackHeightMm`; leaving `b2b` drops the stack height; `port_already_mated` between `b2b` links (harness ends join the check in SB2-14); audits `link_type_changed`; documents and manifests carry both fields. UI: Link details type and stack height, a Mating section for `b2b` links (confirm, set by hand, reset), diagram **B** mode and heavier B2B wires. Link↔harness conversions land with harnesses (SB2-14). |
| P2-1.13 | 2026-09-30 | SB2-12: placement library `frames` pair (Python `systems/placement/frames.py`, TypeScript `placement/frames.ts`) with shared goldens `placement_cases.json` (14 cases from KiCad stock footprints); migration 36 `system_port_mating`; mating API (§15.3, response shape fixed); `SYS-V17 mating_stale`; manifest mating import and export. |
| P2-1.12 | 2026-09-30 | SB2-11: extractor v6 implemented as §14.6 (`EXTRACTOR_VERSION` 6, every board re-extracts once). Goldens compare pad centres and footprint poses with `kicad-cli` 10.0.6 IPC-D-356 and position-file exports (`fixtures/system_builder/p2/evidence/geometry`). |
| P2-1.11 | 2026-09-30 | SB2-10 M1 packet: §0.1 choices T1–T7 (signed off by the user 2026-09-30); §14 frames and conventions, extractor v6 geometry; §15 mating inference, storage and API; §16 link type conversions and B2B rules; §17 harness tables, behaviour, API, ICD/CSV; §18 mates with; findings V17–V19; errors and audit additions. Manifest: `mating[]` stores only confirmed/override with `geometryDigest`; `stackHeightMm` moves to `links[]` (b2b only, full digest only, omitted when unset). The revision log becomes §19. |
| P2-1.10 | 2026-09-30 | SYS-V09 becomes opt-in per system (user decision after M0: 108 warnings on JTYU). Migration 35 `optional_rules`; `PATCH /systems/{id}` `optionalRules`; manifest `system.optionalRules` (full digest only, omitted when empty); Overview **Checks** section. SYS-V10 stays an error. |
| P2-1.9 | 2026-09-30 | SB2-09: parent ICD Subsystems table and unreleased banner; `?depth=all` on live and snapshot ICDs (CSV `occurrence` column, HTML "Inside subsystems"), with recursive redaction; diagram subsystem node and its contents list; History "All levels" link. Backfills rows P2-1.5 to P2-1.8, whose document edits were missing from their tickets. |
| P2-1.8 | 2026-09-30 | SB2-08: system nets (§8.1–§8.2) following export ends and re-exports; extractor v5 `powerNet`; V09 refined from "share no token" to "no related token" (§8.4) after the literal rule flagged 11 intentional renames in the fixtures; V10; `GET …/nets`, `…/nets/{groupId}`. The F8 golden gains one V09 (`PAYLOAD_INT#`/`IRQ_OUT#`). |
| P2-1.7 | 2026-09-30 | SB2-07: child drift (§7). Migration 34 `child_update` reviews; `system_child_check` on catalog release; rebase by `{revisionId}`; SYS-V14, SYS-V15. |
| P2-1.6 | 2026-09-30 | SB2-06: export ends (§6.1); re-exports; SYS-V16 also covers a missing child export; ICD export ends print through to the child connector. |
| P2-1.5 | 2026-09-30 | SB2-05: assembly/module instances (migration 33); `hierarchy.resolve` limits and cycles; `GET …/hierarchy` with recursive redaction; publish records children and `hierarchyValid`. |
| P2-1.4 | 2026-09-30 | SB2-04: publishing. Migration 32 binding; write order and orphan adoption; refusals; 201/200; assembly metadata defaults; snapshot `publication`; summary `catalogComponentId`; `source_ref.snapshotName`. |
| P2-1.3 | 2026-09-30 | SB2-03: exports. Migration 31; rules 6–8; SYS-V16; refresh on baseline advance; document `exports`; export interface `resolved`, 409 `interface_not_ready`, snapshot variant, redaction; manifest export port targets carry their baseline. |
| P2-1.2 | 2026-09-30 | SB2-02: catalog kinds (migration 3); IPN via `provisional_ipn` + source `prism` instead of a new identity kind; `source_ref` carries the gate facts; assembly gates; integrity guards v5; hash stability; `?kind=`; viewer browse routes. |
| P2-1.1 | 2026-09-30 | SB2-01: snapshots store the manifest and both digests (`digest` = full); `GET …/manifest` is whole-or-403; `import_manifest` keeps IDs; migration 30. §0 signed off. |
| P2-1.0 | 2026-09-30 | First draft for sign-off (SB2-00). Adds catalog kinds and publishing, exports, hierarchy, child drift, system nets V09–V15, manifest v1 with digests, API, errors and audit kinds. P1 changes: snapshots store a manifest (§9.4); instances gain `kind` (§5.1); extractor v5 adds `powerNet` (§8.4). S6 revised by the user: canvas layout is part of the manifest and snapshots (§9.5, revises P1 invariant 6). |

## 20. System scene (SB2-22)

### 20.1 `GET …/scene` → `prism.system_scene.a0`

Open to every reader of the system, redacted as `GET …/hierarchy` (§5.4). Lengths in mm; matrices are 4×4, column-major (WebGPU's layout), `T·R`.

```json
{"schema": "prism.system_scene.a0", "systemId": "sys_…", "systemVersion": 12, "units": "mm",
 "assets": [{"assetId": "sba_…", "projectId": "prj_…", "commit": "<sha>", "status": "ready",
             "bundleUrl": "/api/projects/prj_…/webgpu-3d/assets/<source>/<build>/bundle.json",
             "sourceRevisionKey": "<source>", "generatorBuild": "<build>", "jobId": null,
             "bundleToBoard": [1000, 0, 0, 0, 0, 1000, 0, 0, 0, 0, 1000, 0, 0, 0, -0.8, 1]}],
 "occurrences": [{"path": "/sin_b", "parentPath": null, "displayPath": "OBC-1",
                  "labels": ["OBC-1"], "instanceId": "sin_b", "kind": "board", "depth": 1,
                  "restricted": false, "assetId": "sba_…",
                  "pose": {"translationMm": [-6.5, 59.11, 0], "rotation": [0, 0, 0, 1], "source": "default"},
                  "worldMatrix": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -6.5, 59.11, 0, 1],
                  "boundsMm": {"minMm": [6.5, -59.11, -0.8], "maxMm": [96.65, -6.5, 0.8]}}]}
```

- **Occurrences** are the hierarchy's, parents before members: boards and assemblies (M6 adds modules). `pose` is in the parent's frame (§14.3) with its `source`: a stored pose (§14.7) or `default`; `worldMatrix` is the product of poses from the root. An assembly is a rigid group: its members' poses are inside its frame. `boundsMm` is the occurrence's box in its **own** frame, or null when unknown (no PCB, no v8 interface yet, or an unresolved assembly).
- **Assets** are board bundles, one per (project, commit), however many occurrences use it: `assetId = "sba_" + sha256(project \0 commit)[:16]`. Two copies of an assembly draw from the same assets.
- **Restricted** (§5.4): a hidden board keeps its path, labels, pose and box, with `assetId: null`; no project, commit or bundle of it appears anywhere in the response. A hidden child system is one occurrence with its box (the union of its contents); its members are left out. The box is the only thing either leaks.
- Reading the scene queues the v8 interface extraction of any board without one, so its box arrives on a later read.

### 20.2 Bundles

A board asset reuses the single-board pipeline and its readiness cache (`semantic_visualizer_service.get_status_fast`) at the board's baseline commit. Nothing about bundles changes.

| `status` | Meaning |
|---|---|
| `ready` | The bundle is complete; `bundleUrl` loads it. |
| `building` | A partial bundle is available (`bundleUrl` set), or a build was just queued (`jobId` set). |
| `missing` | No bundle, and the reader may not queue one (below). |
| `failed` | The project or its status could not be read. |

- **Builds.** A missing bundle is queued as the `webgpu_3d` job for that commit when the reader is a designer or admin, the same roles that can generate a board's 3D view on its own tab. The job's artifact key deduplicates concurrent requests. *(P2-1.24: the key names the 3D generator build, `BUILD_FINGERPRINT`, so a completed job from an older viewer or pipeline build no longer stands in for a bundle the current build reads; before, such a board reported `building` indefinitely.)*
- **`bundleToBoard`** maps the bundle's runtime frame (metres; x right, y up, z out of the front; z = 0 at the bottom face of the substrate) into the board frame (§14.2): scale by 1000, then lower by the mid-plane height `h`. `h` is half the substrate between the inner faces of the outer copper layers in the bundle's layer table (the pipeline's `_set_canonical_board_y_range`), or 0 with fewer than two copper layers. It is null until the bundle's layer table exists.
- A renderer draws a board occurrence with `worldMatrix · bundleToBoard`.
- *(P2-1.24)* Reading the scene reads only each board's outline and thickness from its interface artifact, never the whole artifact.

### 20.3 The System 3D tab (SB2-27)

> **Superseded (P2-1.40).** `<prism-system-scene>` was retired in SB2-31f; the tab runs on `<prism-semantic-viewer mode="system">` (§20.6–§20.8). Still current: the stand-in boxes and their colours, scene-wide pick numbers, and the tab's 5 s re-reads while a bundle builds. Events are `prism-semantic-viewer:*`; there is no `:status` event.

- `<prism-system-scene>`, in the same viewer bundle as `<prism-semantic-viewer>`, takes the descriptor with `setScene(descriptor)` and is given it again on every re-read. Assets already loaded are kept; an asset that becomes `ready` loads.
- Every board asset is drawn by its own renderer over one shared WebGPU device, canvas and pass. Occurrence numbers in the pick target are scene-wide (each asset's first occurrence is its base), so a pick names one occurrence path.
- **Stand-ins.** An occurrence without geometry draws as its `boundsMm` box, coloured by why: `restricted` (grey), `loading`, `building`, `missing`, `failed`. An occurrence with `boundsMm: null` is not drawn; the tab says so.
- **Events.** `prism-system-scene:selectionchange` with `{ selection: { kind: "board" | "component" | "feature", occurrence, displayPath, instanceId, restricted, standIn, reference? } | null }`, plus `:ready`, `:status` and `:error`.
- **The tab** re-reads the scene every 5 s while a bundle builds or a box is unknown. Without WebGPU it shows the 2D diagram with a notice, and never reads the scene.

### 20.4 Move mode (SB2-29)

> **Superseded (P2-1.40).** The behaviour below is current, on `<prism-semantic-viewer mode="system">` (§20.8). Who may move is the `move-allowed` attribute (there is no `setMoveAllowed()`), and the event is `prism-semantic-viewer:move`.

- **Who.** Editors (designer or admin) get a **Move** toggle in the System 3D tab and the **M** key; readers never see it. The element starts with moving disallowed; the host enables it with `setMoveAllowed(true)`.
- **What moves.** The selection's **top-level** occurrence: a board, or a child system as one rigid group (selecting a board inside a child system moves the whole child). Its pose is in the system's frame (§14.3), so a move is a new pose for that instance (§14.7).
- **Gizmo.** Three arrows slide along X, Y or Z and three rings turn about them, all through the target's box centre. **L** switches the axes between the world's and the board's own. Steps are 1 mm and 15°; Shift gives 0.1 mm and 1°. A rotation turns about the box centre, so the translation changes with it.
- **Numeric panel.** X, Y, Z in mm and rotation as degrees about X, then Y, then Z (world axes, `Rz·Ry·Rx`; display only, stored poses stay quaternions). Typing previews; Enter or Save stores; Esc or Revert puts it back. **Back to default** clears the instance's pose; **Reset all** clears every manual pose after a confirmation.
- **Saving (D-P2-14).** Releasing a handle saves. The element only previews: it emits `prism-system-scene:move` with phase `commit`, and the host `PUT`s the pose with If-Match, then re-reads the document and the scene. A failed save (including 412, which reloads) calls `cancelMove()`, so the board goes back.
- **Element API.** `setMoveAllowed(bool)`, `setMoveMode(bool)`, `setMoveSpace("world" | "local")`, `previewPose(pose | null)`, `cancelMove()`, `getMoveState()`, `setHelpVisible(bool)`. Event `prism-system-scene:move` carries `{phase, allowed, enabled, space, dragging, target: {occurrence, instanceId, displayPath, kind, restricted, pose, source, unsaved} | null}`; phases are `mode`, `target`, `preview`, `commit`, `cancel` and `sync` (a re-read scene arrived). An unsaved preview survives the tab's 5 s re-reads and is dropped once the scene shows it saved.
- **Keys** act only while the view has focus: F, A, M, L, Enter, Esc (undo the drag, else leave move mode, else clear the selection), \` (stats) and **?** (the shortcut list).

### 20.5 Net emphasis (SB2-31)

> **Superseded (P2-1.40).** The rules below are current, on `<prism-semantic-viewer mode="system">` (§20.6): events are `prism-semantic-viewer:emphasis` and `:isolation`, and `occurrence` is the placement path.

- **What lights.** A highlighted **system net** (§8) lights each of its members: a board net on one occurrence. The same board net on another copy of that board stays unlit, so OBC-1's `SPI_SCK` does not light OBC-2's. Restricted members (`occurrence: null`) never light.
- **Several nets at once.** Up to **8**, each in its own colour from an 8-colour palette (green, amber, sky, magenta, violet, orange, aqua, yellow), in the order they were added. When two nets claim the same board net, the first keeps its colour.
- **Highlighting (P2-1.28, as a board's 3D tab probes a net).**
  - While any net is highlighted, the board body (substrate, mask, silkscreen, paste) and the components hide.
  - **All copper still draws**, so the review keeps its context: unlit copper and barrels dim on every board, and lit copper pulses in its net's colour.
  - Inner copper draws at every detail level.
  - Clearing every net restores the board and components.
- **Isolation (I).** With nets highlighted and the view focused, **I** toggles an isolated view: only the lit copper and barrels draw, in the copper's own colour, as on a board's 3D tab. `setNetIsolation(bool)` does the same and returns the state; `prism-system-scene:isolation` carries `{isolated}`. Clearing every net leaves isolation.
- **Framing (P2-1.29).** As the board 3D tab frames a selected net: the lit copper's own box, no padding.
  - A newly shown net is framed on the **first board it reaches**.
  - The Nets panel lists each board as a button that frames the net there; the frame icon frames it on every board.
  - `frameNetEmphasis(key?, occurrence?)` frames one set or all sets, on one occurrence or all.
- **Clicks while isolated.** A click on copper that isn't drawn (not lit) is a click on empty space: it clears the selection, and never selects a board.
- **Copper colours (P2-1.29).** As on the board's 3D tab with realistic colours, outer copper and barrels take the board's surface finish (`topology.board.stackup.copper_finish`); for example, HASL draws grey. The topology file is read in parallel with the geometry, through the shared cache.
- **Large nets (D-P2-8).** A group with `large: true` (over 200 pins) asks for confirmation before it lights.
- **Element API.** `setNetEmphasis([{key, color?, members: [{occurrence, net}]}])` returns, per set, `{key, color: "#rrggbb", lit, unresolved: [{occurrence, net, reason}]}`. The reasons are:
  - `loading`: a box until its bundle is ready;
  - `restricted`;
  - `not-drawn`: not in the view;
  - `unknown-net`: the board's 3D model has no net by that name or alias.

  The same report arrives as `prism-system-scene:emphasis` whenever it changes (for example when a board finishes loading). An empty list clears.
- **Resolution.** A member's `net` is matched against the bundle's net records by exact name or alias, the same rule as the one-board viewer's `findNetByName`.
- **Re-reads.** A `groupId` is valid for one system version (§8.2). On every system change the tab re-reads each highlighted net, and drops those that no longer exist.
- **Renderer.**
  - The instanced shaders read the asset's `netMask` buffer as a table of `stride` slots per occurrence: slot = local occurrence × stride + net id, where stride = the largest lit net id + 1, carried in the Globals word that was spare.
  - A slot holds 0 (off), 1 (the default colour) or `0x01RRGGBB`.
  - A stride of 0 keeps the one-board meaning: one shared per-net mask. The one-board shaders are unchanged.

### 20.6 The 3D tab with several boards (SB2-31e, D-P2-25)

The System 3D tab becomes the board 3D tab's own viewer showing several boards. `<prism-system-scene>` stays until SB2-31f moves its move mode, labels and Nets panel across, then retires.

- **Element.** `<prism-semantic-viewer mode="system">` takes no `bundle-url`.
  - `setSystemScene(descriptor)` shows a `prism.system_scene.a0` descriptor (§20.1). Each board asset loads once, from the same bundle and browser cache as its own 3D tab, and draws at every placement that uses it.
  - Placements without geometry draw as the §20.3 stand-in boxes.
  - One viewer per page, as for the board 3D tab.
- **The board.** The board the selection belongs to is "the board" of the 3D tab: picking, inspecting a net or part, framing, Esc and **I** work exactly as on its own tab.
  - Every selection event carries `occurrence`, the placement path.
  - A click on a board away from any feature selects that board: `{kind: "board", occurrence}`.
  - A click on a stand-in also selects its board: `{kind: "board", occurrence, standIn}`.
  - `setSelection({occurrence, netName | netId | featureId | reference})` selects on one placement. Given `occurrence` alone, it selects that board.
- **Inspected net.** A clicked net lights on its own placement only, as the inspected net does on one copy of a board.
  - The probe applies to every board: bodies and components hide, and unlit copper dims everywhere.
  - Clicking a trace to light the whole system net is SB2-32 (D-P2-28).
- **System nets.** `setNetEmphasis`, `frameNetEmphasis` and the report work as in §20.5. The report arrives as `prism-semantic-viewer:emphasis` (`{results}`).
- **Layers per placement (D-P2-26).**
  - `getViewState().boards` lists every placement in order: `{key, name, standIn, layers: [{id, name, color, visible}]}`.
  - `selectedBoard` is the placement holding the selection.
  - `setLayerVisible(layerId, visible, placement?)` and `applyLayerPreset(preset, placement?)` act on one placement. With no placement, they act on every placement of the selected board.
  - Two placements of the same board (OBC-1, OBC-2) show their layers independently.
  - The top-level `layers` are the selected board's.
- **3D only (D-P2-27).** System mode has no 2D compare view.
- **Isolated picks (all viewers).** While isolated, the pick pass discards copper and barrels that are not lit, as the draw pass does. A click lands only on what is drawn; anywhere else is empty space. On a board's own 3D tab this replaces picking the hidden pour under the cursor.
- **Renderer.**
  - Each occurrence record gains `hiddenLayers` (four u32, a 128-bit mask over manifest layer ids). The stride grows from 128 to 144 bytes.
  - The instanced draw and pick shaders collapse a copper or paste draw whose layer the occurrence hides. The draw's layer id + 1 travels in `draw.offset.w`, which the one-board shaders do not read.
  - `SceneRenderer` writes each board's exploded-stackup offsets.
  - The one-board picture is unchanged: pixel diff on JTYU-OBC at 1280×800, 0 px.

### 20.7 The System 3D tab on the 3D tab's viewer (SB2-31e.2)

The tab hosts `<prism-semantic-viewer mode="system">` (§20.6) and the board 3D tab's own controls around it.

- **Left rail (D-P2-26).** The board 3D tab's rail, titled *System 3D*, with Net layers, Isolate, stackup separation and the Settings toggles. Layers has a section per placed board: its layer count, a frame button, and when opened the preset and layer list for that placement only. The board holding the selection opens and is marked. There is no 2D toggle (D-P2-27).
- **Right rail.** *Selection*: the selected board heads it (frame, Open in Boards), and below it the board 3D tab's inspector reads that board's design index (`GET /api/projects/{id}/semantic-index/identity?commit=` at the commit the system pins), so a part, pad or net shows as on the board's own tab. A board selection, or a box (restricted, building), explains itself. *Nets*: the SB2-31 system net panel.
- **Search.** One field (`/`, ⌘F) over every placed board's parts and nets, each hit named with its board; two copies of a board give two hits. Picking one selects it on that placement.
- **Toolbar.** Board counts, search, Move (editors), Nets, Fit all, Labels, Stats, keyboard list (SB2-31f, §20.8).
- **Opening view.** The camera frames the system as boards load, until all are in or the reviewer moves it.

### 20.8 System features in the viewer (SB2-31f)

`<prism-system-scene>` and `system-scene.js` are retired; the System 3D tab runs only on `<prism-semantic-viewer mode="system">`.

- **Move mode (§20.4, SB2-29)**, unchanged for the host:
  - `move-allowed="true"` (editors);
  - `setMoveMode`, `setMoveSpace`, `previewPose`, `cancelMove`, `getMoveState`;
  - `prism-semantic-viewer:move` carries `{phase, allowed, enabled, space, dragging, target}` (phases mode, target, preview, commit, cancel and sync).

  The target is the top-level instance of the selected board. While moving, a click selects the board without framing it, so the gizmo stays in view. Released drags and Enter commit; Esc undoes the drag, then leaves move mode.
- **Board labels** over each placement (`setLabelsVisible`), marked when selected.
- **Keys.** The board 3D tab's keys keep their meaning (F flips the view). The system adds:
  - **M**: move mode;
  - **L**: world or board axes;
  - **Enter**: save;
  - **A**: frame all;
  - **?**: the key list (`setHelpVisible`).
- **GPU budget.** One budget for the whole scene (`setGpuBudget`, default 1.5 GB). Over it, idle boards' components and then unneeded copper tiles are evicted. `getStats().firstFrame` keeps SB2-30's first-full-frame timing.
- **Stackup separation per placement (user request, 2026-10-07).** Each board section in the left rail has its own separation slider, so two copies of a board separate independently.
  - `setSeparation(value, placement?)`; `getViewState().boards[].separation`.
  - As on the board 3D tab, a separated placement spreads its copper layers (barrels stretch with them), fades its mask and silkscreen, and hides its paste. From 10% on, its parts are hidden too.
  - Carried in the occurrence record (`explode: vec4f`; the stride grows from 144 to 160 bytes). Each renderer holds per-layer steps; each occurrence holds its gap.
  - Copper keeps its realistic colours while separated: the board 3D tab's blend to layer colours is per renderer, not per placement.
  - The one-board picture is unchanged (pixel diff 0 px).

### 20.9 Click to trace (SB2-32, D-P2-28)

Clicking a trace (or a pad) in the System 3D tab selects its **system net**.

- The tab resolves the selection's board net with `GET …/nets?occurrence=&net=` (§8.2), then reads the group. A net no link carries stays a board-net selection, as on the board 3D tab, and the card says so.
- The system net lights on every board it reaches as the emphasis set `{key: "trace", color: "#14ff33"}` (the board 3D tab's selection green, pulsing), ahead of the Nets panel's sets. As on the board 3D tab, board bodies and parts hide and unlit copper dims; **I** isolates.
- A group over 200 pins (D-P2-8) lights on the clicked board only; the card offers "Light on all N boards". There is no dialog for a click.
- The selection clears the trace (Esc, a click on empty space, another selection). A system change re-reads it.
- **The System net card** heads the Selection rail, above the board's own inspector:
  - the name of the clicked end, with the other names as aliases;
  - pins and boards (restricted members counted), and each board frames the net there (`frameNetEmphasis("trace", occurrence)`);
  - the path: hops breadth first from the clicked board, each turned to run away from it (`OBC-1 J3.12 → CMBD J1.12`, then the link or harness wire and its signal). Fifty are listed until "Show all". A hop frames its two connectors with `frameParts([{occurrence, reference}])`.
- The Selection rail follows the selection, as on the board 3D tab: a selection opens it and clearing it closes it (the Nets tab stays put).

### 20.10 Net search (SB2-33, D-P2-19)

The System 3D tab's toolbar search (`/` or Cmd+F, as on the board 3D tab) searches parts and nets with the header search's ranking.

- **Board picker** beside it: "All boards", or one placed board (its display path). The search covers that board alone.
- **System nets.** A board net that belongs to a system net (from `GET …/nets?members=true`) is one result for the system net, "System net · OBC-1, CMBD", whichever board matched best. A system net also matches by any of its names (aliases), so on one board it is found by the name it has on another; picking it selects that board's member net. Nets that stay on their board remain per board ("OBC-1 · Default"); parts are per board as before.
- **Pick** selects the board net (on the picked board, else the best match) and so traces its system net (§20.9).
- **Shift-pick** (Shift-click or Shift+Enter) adds the system net to the highlighted nets in the next palette colour and opens the Nets tab. A net over 200 pins asks first (D-P2-8).
- **Esc** closes the list, then clears the query; with the field left, Esc clears the selection.
- More than 500 system nets: the rest are searched per board only.

### 20.11 Proxy harnesses (SB2-34)

Until M5 gives harnesses geometry, the System 3D view draws each one as straight segments between its connectors.

- **Scene.** `GET …/scene` gains `harnesses: [{id, level, name, ends: [{id, ordinal, occurrence, reference}], wires: [{id, from, to}]}]`, every harness of the tree. `level` is the child system's occurrence path (null for the root), so two copies of a subsystem list its harness twice with the same `id`. An end is located on its board occurrence like a link end (an export is followed down); `occurrence` is null for an unmated end or one whose export does not resolve.
  - Redaction (§5.4): an end on a restricted board keeps the board (its box is drawn) but its `reference` is null; an end on a board the reader cannot see at all has no `occurrence`; a harness inside a child system the reader cannot open is left out.
- **Drawing.** An end is anchored at its connector's centre on the placement (the board's box centre before the board loads, or with no reference). Two ends: one segment. More: a star from the centroid of the anchored ends. Each segment carries the set of wires through it: all of them for two ends, those touching its end for a star (M5's per-segment wire sets replace this). Idle segments are dashed; `setHarnessesVisible(false)` hides them (the tab's **Harnesses** button, shown when there are any).
- **Emphasis.** An emphasis set (§20.5) may carry `wires: [{harness, wire, occurrence?}]`, the wire hops of its system net; `occurrence` (a board the wire reaches) tells child-system copies apart. A segment carrying a lit wire draws solid in the set's colour (the first set to claim a wire keeps it, as for copper); the ends that wire reaches glow. With any net lit, unlit segments dim. The report counts `wires` lit per set.
- The traced net (§20.9) and the Nets panel's sets pass their wire hops, so a net crossing a harness lights it.

### 20.12 Level of detail (SB2-30a, user decisions 2026-10-05)

Coarser levels only stop drawing parts of a board; the bundle's geometry is never simplified. mode="system" only: a board's own 3D tab always draws in full (pixel diff 0 px).

- **Levels**, chosen per placement on the GPU each frame from the board's projected radius in **CSS pixels** (device pixels ÷ the canvas ratio, so a 2× screen does not keep every board at full detail):

  | Level | At or above | Draws |
  |---|---|---|
  | full | `fullPx` (140) | everything: components, inner copper |
  | board | `boardPx` (70) | outer copper, barrels, silkscreen, paste, and the body |
  | body | `boxPx` (18) | the substrate and solder mask only |
  | box | below `boxPx` | the board's box |

  A finer level holds until the size drops below its threshold × `keep` (0.8).
- **Tuning.** With the stats overlay (backquote) the view shows a slider per threshold. `setLodThresholds({fullPx?, boardPx?, boxPx?, keep?})` merges and returns the thresholds in force (kept consistent: full ≥ board ≥ box); `null` restores the defaults. Kept per browser.
- `setLodOverride(0…3 | null)` forces a level; `getStats().lod` counts `{full, board, body, box, culled}`.
- **Labels (R5).** Board labels are re-placed only when the view, the selection or the placements change, not on highlight-pulse frames.

### 20.13 Moving mated boards (SB2-38, D-P2-18)

- A **stack** is the root-level members joined by driving mates: a root (`mate: null`) and everything placed from it (`mate.from` chains). A board in no stack moves as before.
- Committing a move of a board in a stack (a released drag, Enter or Save) **asks first**, in the move panel: **Move with its stack** or **Break the mate**; Esc puts the board back.
  - *Break the mate* stores the board's pose (`manual`); its `mate.overridden` turns true.
  - *Move with its stack* applies the same rigid move to the whole stack in one `PATCH …/poses`: the root and the members already overridden get stored poses; the other members follow through their mates. Revert puts every stored pose back (or clears it) in one more `PATCH`.
- The panel badges a target **Mated** (`source: auto`) or **Mate overridden**. An overridden board shows "Mated position overridden · Snap back"; Snap back deletes its stored pose so it returns to its `autoPose`. "Back to default" applies only to a stored (`manual`) pose.


### 20.14 Mating in link details (SB2-39)

- **`GET …/placement`** (reader): the root level's solve without the scene's bundle reads, by instance ID: `{systemId, version, roots, driving: {instanceId: {linkId, from, overridden}}, mismatches, unusable, ignoredOverrides, drivingMates}`.
- **`GET …/links/{lid}/mate`** (reader; 422 unless `b2b`): `{linkId, stackHeightMm, a, b}`, each end `{instanceId, kind, portKey, reference, geometry, thicknessMm, inferred, stored}` (v6 geometry of that one connector; null for a subsystem end or a connector that can't be read).
- A B2B link's **Mating** section shows, besides each end's frame (§15):
  - **what the solve did with it**: places a board ("(chosen)" when the user chose it), lines up, doesn't line up (the V11 numbers), or isn't used yet (an end without a stored frame);
  - **Place <board> by this link** when the link could place a board that another mate places now, and **Place <board> automatically** to drop that choice (§14.10);
  - a **live preview** of the pair: the browser runs `mate` (§14.8) with the frames being picked (else stored, else inferred) and draws both connector bodies, a slab of each board around its pads and pad 1, with the stack height used (the link's, or the clearance height and why).

### 20.15 Harness tubes (SB2-44)

- **Scene.** A harness end in `GET …/scene` also carries `part` (its catalog component, or null for Generic) and `connector`: `{geometry (v6), thicknessMm, stored}` of the board connector it mates, with `stored` the level's confirmed or override frame (null when there is none or it is stale; the browser then infers, §15.1). `connector` is null for an end that is unmated, on a restricted board, or whose connector can't be read. Wires carry `gaugeAwg`.
- **Curves in the browser.** The viewer bundles the placement library (`placement/harness-tubes.ts`, one implementation with the app) and recomputes every harness whenever a placement changes, drag previews included: end poses (§17.6), the tree (§17.7), the curves (§17.8). An end without a connector or a frame drops out; a harness with fewer than two posed ends draws only its proxy dots (§20.11); a segment no wire crosses draws nothing.
- **Tubes on the GPU.** A compute pass gives each sample a rotation-minimising frame (double reflection; one invocation per segment walking its samples), a second writes the vertices: a 12-segment ring per sample (§17.5) at the segment's bundle radius, and flat caps at both ends. The draw shares the scene's render pass and depth buffer. Colour: harness grey; a segment carrying a lit wire takes that set's colour and pulses; the others dim while anything is lit. A harness drawn as tubes drops its proxy straight lines and keeps its end dots.
- **Nodes.** Scene harnesses carry `nodes` (§17.9) in their level's frame; the tubes route through them, moved to world by the level's matrix (identity for the root).
- **Not yet:** radius blends at breakouts (§17.5's 5 mm blend needs a per-sample radius in the tube pass; deferred). A lit wire's segments already take its set's colour (bundle-segment emphasis).


### 20.16 Picking harnesses and editing their route (SB2-45b)

- **Picking.** A click within 5 px of a tube, plus its drawn radius, picks that harness and segment (the nearest on screen wins), ahead of the boards behind it; a click elsewhere drops the pick. The picked harness draws blue. Picks resolve in click order: a slower board pick from an earlier click never replaces a later one.
- **Events.** `prism-semantic-viewer:harness` carries `{phase, harness {id, level, name}, segment {id, from, to, samplesMm}, pointMm, autoMm, node, editable}`, points in the harness's level frame (mm), with phases `select`, `target`, `preview`, `commit`, `delete`, `cancel` and `sync`. `editable` is a root-level harness for a reader who may move boards; a child system's harnesses are read-only here.
- **Handles.** In move mode, the picked editable harness shows a handle per breakout (filled), waypoint (open; dark when pinned) and its automatic breakout (dashed). A click on a handle gives it the gizmo: translate arrows only, world axes, the board snapping (1 mm, Shift 0.1 mm). Dragging previews the tubes; releasing sends `commit`, and the host saves the harness's node list (§17.9) with the new position. Moving the automatic breakout stores a breakout there. Enter commits a preview set through `previewHarnessNode`; Delete removes the targeted node (a breakout takes its neighbouring waypoints); Esc undoes a drag, then lets go of the node, then drops the pick.
- **Panel.** The picked harness's panel offers **Add waypoint** (on the picked segment, in order along it; a segment ending at the automatic breakout stores the breakout first) and **Add breakout** (at the end of the chain), and Pin/Unpin and Remove for the targeted node. A node added from the panel takes the gizmo once the re-read scene arrives. After a re-read, a segment renamed by a breakout change is re-picked as the one running nearest the picked point.
- Element API: `targetHarnessNode(id | null)`, `previewHarnessNode(positionMm | null)`, `cancelHarnessNode()`, `getHarnessState()`.

### 20.17 Housings at harness ends (SB2-47)

- **Scene.** A harness end with a part carries `partRevisionId` (the revision its block pins, §17.3) and `housing {glbKey, boundsMm, alignment}`: the first STEP model of that revision with a GLB for the current converter (§18.2), its bounds in the STEP frame and the part's saved alignment (identity when none). An end recorded without a revision reads the part's current one. It is null for a Generic end, a part without a converted model, or when the catalog can't be read. Restricted boards keep it (it is catalog data) but lose `connector`, so nothing is drawn there.
- **Exit.** The route passes the housing to §17.6, so the cable leaves the model's rear face (server and browser alike: lengths and V12 use it too).
- **Drawing** (`placement/harness-housings.ts`, browser only).
  - A posed end with a model draws the GLB from `GET /api/catalog/models/{glbKey}.glb` at its mating frame · alignment (`T·R·S`). Geometer's GLBs keep the STEP's z-up axes in metres; the viewer maps its loader's y-up reading back to STEP millimetres. While the GLB loads, or if it fails, the model's aligned bounds draw as a box.
  - Any other posed end draws a proxy box in its mating frame: the connector body's x–y extent (y flipped, the housing faces the connector) and the housing depth behind the mating face.
  - Housings hide with the harnesses. A click on one picks its harness on the segment leaving that end.

### 20.18 Occurrences with their own geometry, gizmo limits and surface picks (SB2-48b)

Additions to the `prism.system_scene.a0` occurrence, all optional, so older scenes are unchanged:

- `model {glbKey, matrixMm?, boundsMm?}` draws a catalog GLB (§18.2) at `worldMatrix · matrixMm`. `matrixMm` maps the model's STEP millimetres into the occurrence frame (an alignment, §18.2). While the GLB loads, `boundsMm` draws as a proxy box. SB2-50 draws module instances this way.
- `box {boundsMm, rgba?}` draws a coloured box in the occurrence frame.
- `move: false` keeps the occurrence out of move mode. `move {translate: [axis…], rotate: [axis…], rotateSnapDeg, pivot: "origin" | "bounds"}` limits the gizmo: only the listed arrows and rings show, in the occurrence's own axes; rotation snaps to `rotateSnapDeg`; the pivot is the pose's origin (`"origin"`) or the box centre.
- `pickSurface: true` lets surface picks land on the occurrence's model.

Viewer element methods (mode="system"):
- `pickSurfaceAt(clientX, clientY)` → `{occurrence, pointMm, normal, toCamera}` or null: the camera ray against the model's triangles on the CPU (the GPU pick has no depth). The normal faces the viewer.
- `focusMoveTarget(path)` puts the move gizmo on an occurrence.
- `viewAxis(axis, opposite)` looks along a world axis and frames the scene.
## 21. Git tracking (SB2-52, D-P2-42..45)

A system can be linked to a Git repository of its own. Snapshots then become commits of the manifest (§9) on one branch, and changes pushed from outside Prism come back through a review. Nothing here is required: an unlinked system behaves exactly as before.

### 21.1 The link (D-P2-42)

- **What.** One link per system: `{url, branch}`. The URL is a remote that already exists; Prism never creates a repository on a forge. The URL passes the import policy (`parse_remote_url` with `IMPORT_ALLOWED_HOSTS` and `IMPORT_ALLOW_INSECURE_HTTP`), and credentials come from the workspace, as for project imports (`git_env`: the workspace SSH key, `GITHUB_TOKEN`).
- **Branch.** It defaults to the repository's default branch (`ls-remote --symref HEAD`). It must pass `valid_tracked_ref`. An empty repository is allowed; the branch is then created by the first snapshot.
- **Clone.** Prism keeps a bare clone of its own per linked system at `<PRISM_SYSTEM_REPOS_ROOT>/<systemId>.git` (default `KICAD_PROJECTS_ROOT/.kicad-prism/system-repos`, inside the persisted projects volume), fetching `+refs/heads/*:refs/remotes/origin/*`. It is not a workspace project and never appears in the project list. Prism never uses a working tree: commits are built with plumbing (`hash-object`, a temporary index, `write-tree`, `commit-tree`).
- **File.** The manifest lives at the repository root as **`prism.system.json`**: the snapshot's manifest exactly as `GET …/snapshots/{sid}/manifest` returns it, serialized with sorted keys, two-space indentation and a trailing newline, so diffs are stable. Every other file in the repository is left alone.
- **Linking** checks reachability (`check_repository_access`, read-only, so push rights are only proven by the first push) and queues a `system_git_sync` job (§21.4). Changing the URL or branch, or unlinking, needs no confirmation from the remote. Unlinking deletes the bare clone; snapshot commit records stay.
- **One system per repository branch.** Linking a URL and branch (by `dedup_key`) that another system already uses is refused with 409 `git_link_in_use`.

### 21.2 Commit on snapshot (D-P2-43, D-P2-44)

- A snapshot of a linked system queues a `system_git_commit` job once its row is written. The snapshot itself never waits for Git: its `git` status starts as `queued`.
- **Commit.** The job fetches, then builds a commit whose tree is the branch tip's tree with `prism.system.json` replaced, and whose parent is the tip (none on an empty branch).
  - **Author:** the Prism user who took the snapshot (their name, else their e-mail's local part, and their e-mail), recorded on the snapshot when it is queued.
  - **Committer:** `KiCAD Prism <prism@kicad-prism.invalid>`.
  - **Message:** `Snapshot <name>`, a blank line, the note (when there is one), a blank line, then the trailers `Prism-System: <systemId>` and `Prism-Snapshot: <snapshotId>`.
- **Push.** Directly to the linked branch, with `--force-with-lease=refs/heads/<branch>:<tip>`; never a force push, never another branch or a pull request. If the lease fails because someone pushed in between, the job fetches again. When the new tip's `prism.system.json` is unchanged, it rebuilds the commit on the new tip and pushes again (up to three attempts). Otherwise §21.3 applies.
- **Status** on the snapshot (`git` in snapshot metadata): `null` (the system wasn't linked), `{state: "queued"}`, `{state: "pushed", commit, branch}`, `{state: "refused", reason: "outside-change", commit}` (the outside tip), or `{state: "failed", reason, message}` with a `git_failures` reason (`credentials-required`, `ssh-key-not-authorized`, `repository-not-found`, …, plus `push-denied` for a remote that refuses writes, `branch-busy` after three lost leases, `unlinked`, and `unknown`), or `{state: "skipped"}` (below). A failure is recorded, not retried by the job runtime; `POST …/snapshots/{sid}/git-retry` queues the commit again. A retried job that finds its own manifest already at the tip records `pushed` without committing again.
- Commits follow snapshot order: one job at a time per system (write lock `system-git:<systemId>`), and a job for an older snapshot that finds a newer snapshot already pushed records `{state: "skipped"}` instead of committing older content over newer.

### 21.3 Outside changes (D-P2-45)

- **Known blob.** The link stores the blob ID of `prism.system.json` as Prism last pushed or imported it (`knownBlob`, null before the first one).
- **Detection.** After every fetch (§21.4) and before every commit, Prism compares the branch tip's `prism.system.json` with `knownBlob`. A difference (including a manifest already in the repository at link time, or its removal) is an **outside change**: the link records `outsideCommit` (the tip).
- **Refusal.** While `outsideCommit` is set, `POST …/snapshots` answers 409 `git_outside_change: <commit> …`, and a queued commit job records `refused`. Prism never overwrites or merges an outside push.
- **The review (SB2-54).** Detecting a new outside commit (in a fetch or a commit job) opens a `manifest_import` review: no instance, no items, `fromCommit` = Prism's last tip, `toCommit` = the outside commit, and `pendingChanges {blob, summary, problems}`. At most one is open per system; a newer outside push supersedes it, and a branch back at the known manifest closes it (`superseded`).
  - `summary` compares the outside manifest with the one Prism last pushed or imported: per area (`instances`, `links`, `harnesses`, `exports`), the `added`, `removed` and `changed` labels or names; `system` (which of name, description and optional rules changed); and `placement` and `layout` booleans. It is null when there are `problems`.
  - `problems` lists why the manifest cannot be imported: the file was removed, it is not JSON, it fails `prism.system_manifest.v1` validation (at most 20 messages), or it is another system's manifest.
- **Deciding it.** `POST …/reviews/{rid}/manifest-import {decision}` (If-Match; designer or admin).
  - **`accept`:** the system becomes the manifest. Its instances, links and rows, exports, harnesses, mating frames, poses, driving mates and layout are replaced, keeping the manifest's IDs, along with its name, description and optional rules. Snapshots, history, other reviews and the catalog binding stay; source reviews of removed instances go with them. Board interfaces are queued for extraction.
    - Refused with 422 `manifest_invalid` while there are `problems`, and with 403 when the manifest names a board the caller cannot see.
    - Audit: `manifest_imported {reviewId, commit}`; the review becomes `applied`.
  - **`reject`:** nothing changes, and the next snapshot replaces the outside manifest on the branch. Audit: `manifest_import_rejected`; the review becomes `closed`.
  - Either way, `knownBlob` becomes the outside blob and `outsideCommit` is cleared.
  - Deciding a review whose commit is no longer the link's `outsideCommit` is 409 `review_stale`; deciding a closed one is 409 `review_closed`.
- Changes to other files never count.

### 21.4 Fetching

`system_git_sync` (pool `prism`; like `system_git_commit`, it holds the write lock `system-git:<systemId>`) clones the bare repository when it is missing, fetches with `--prune`, and runs §21.3's detection. It runs on link, before each commit (inline, within the commit job), on `POST …/git/fetch`, and with the periodic project fetch (`PRISM_AUTO_SYNC_INTERVAL_SECONDS`, SB2-54): each scan queues up to 8 linked, unarchived systems not fetched within the interval, oldest first. Its outcome is stored on the link: `lastFetchedAt`, `tip`, and `lastError {reason, message}` (null on success).

### 21.6 Revisions and commits (SB2-55, D-P2-46)

- A catalog revision still pins a snapshot (D-P2-1). When that snapshot was committed (`git.state = pushed`), publishing it adds `git {url, branch, commit}` to the revision's `source_ref`. The URL is the link's at publish time, or null once the system has been unlinked. A snapshot whose commit is still `queued` is refused with 409 `git_commit_pending`; one that failed, was refused or skipped, or belongs to an unlinked system, publishes without `git`.
- Snapshot `publication` entries and publish responses carry `commit` (null without one).
- `POST …/git/commits/{sha}/publish` (same body and answers as §3.3) publishes the snapshot Prism pushed as that full SHA. Any other commit is 404 `commit_not_a_snapshot`; a short SHA is 422. Revisions that pin only a commit, and commits turned into snapshots, are out of scope (D-P2-46).

### 21.5 API

| Method and path | Purpose |
|---|---|
| `GET …/git` | `{url, branch, tip, knownBlob, outsideCommit, lastFetchedAt, lastError, linkedBy, linkedAt}` or `null` |
| `PUT …/git` | `{url, branch?}`: link or change the link. If-Match; designer or admin. 422 `git_url_invalid: …` (policy), 422 `git_unreachable: <reason>: <message>`, 409 `git_link_in_use` |
| `DELETE …/git` | Unlink. If-Match; designer or admin |
| `POST …/git/fetch` | Queue `system_git_sync`; 202 `{jobId}` |
| `POST …/git/commits/{sha}/publish` | §21.6: publish the snapshot Prism pushed as `sha` |
| `POST …/reviews/{rid}/manifest-import` | `{decision: "accept" \| "reject"}` for a `manifest_import` review (§21.3) |
| `POST …/snapshots/{sid}/git-retry` | 202 `{jobId}`: queue the commit again for a `failed` or `refused` snapshot (`refused` only once the outside change is cleared; otherwise 409 `git_outside_change`, `git_not_linked` or `git_not_retryable`) |

Link changes bump the system version and write the audit events `git_linked`, `git_relinked` and `git_unlinked`. Commits write `snapshot_committed {snapshotId, commit, branch}`, and refusals `snapshot_commit_refused {snapshotId, commit}`, as `system:git`.

## 22. Sub-ports (SB2-105, D-P2-55)

A system's designer can split a port on an instance into named **sub-ports**: pin sets carved out of one connector (or one subsystem export), each usable as a port in its own right. `J6.PWR` = pads 1, 2, 15 of `J6`; the pads left over stay on `J6` itself (the **remainder**). Sub-ports are logical: mating, frames, stack height and 3D stay per physical connector.

### 22.1 Definition and storage

- **Where.** Per system, on an instance (like port overrides, P1 §5). Another system using the same board defines its own.
- **Shape.** `{id, instanceId, portKey, port, name, pads}`.
  - `id`: `spt_` ID, stable for the sub-port's life.
  - `portKey` / `port`: the connector's baseline, stored and resolved like a link end's (P1 §6, `memberKeys`). On an assembly instance `portKey` is an export ID and `port` an `ExportBaseline` (§6.1).
  - `name`: 1–32 characters of `A–Z a–z 0–9 _ + -`, unique per connector case-insensitively. Shown as `{reference}.{name}` (`J6.PWR`); exporting a sub-port defaults the export's name to that.
  - `pads`: a non-empty, sorted (`pad_sort_key`) list of the connector's pads. The sub-ports of a connector together always leave at least one pad on it, so the remainder is never empty by definition.
- **Disjoint.** Sub-ports of one connector never share a pad (422 `subport_overlap`). The remainder is every pad of the connector not in a sub-port; it has no row of its own. Other 422 codes: `invalid_name`, `subport_name_taken`, `subport_empty`, `pin_not_found`.
- **Limits.** At most 16 sub-ports per connector and 200 per system (422 `subport_limit`).
- **Storage (workspace migration 50).** `system_subports(id, system_id, instance_id FK cascade, port_key, port JSONB, name, pads JSONB, created_by, created_at, UNIQUE(instance_id, port_key, lower(name)))`. `system_links` gains `a_subport_id` and `b_subport_id`, and `system_exports` gains `target_subport_id`, each nullable and referencing `system_subports(id)` (no cascade: deletion re-homes first, §22.3).

### 22.2 Use as a port

A link end and an export target name a sub-port by adding `subportId` to the port they already name: `{instanceId, portKey, subportId}`. Without `subportId` an end on a split connector is its **remainder**.

- **Pins.** A row's pad on a sub-port end must be in the sub-port's `pads`; on a remainder end it must be in no sub-port of that connector (422 `pin_not_on_subport`). Generators and CSV import work on the end's own pad set.
- **Links.** Unspecified links only. A `b2b` link can neither end at a sub-port or a remainder of a split connector nor be created on one (409 `port_split`), and a connector that is an end of a `b2b` link cannot be split (409 `port_b2b_mated`); its rows all go to the partner (D-P2-55).
- **Harnesses.** A harness end mates the whole connector, split or not. Its wires keep their pads; the document, ICD and CSV name each wire end's pad by the sub-port that holds it (`J6.PWR`), or the connector for the remainder.
- **Exports.** A sub-port or a remainder can be exported (§4). "An export's port must be free" (§4.2 rule 1) and "an exported port cannot be linked" (rule 8) apply per sub-port and per remainder: `J6.PWR` exported and `J6` linked is allowed. The export interface (§4.3) carries the sub-port as a component of its own: `reference` `J6.PWR`, its pads only, and `subport: true`; the parent cannot use it in a `b2b` link. A connector carrying a whole-connector export (no sub-ports when exported) cannot be split while exported (409 `port_exported`): export a sub-port instead, or delete the export first.
- **Exposure.** Only an exposed connector can be split (409 `port_not_exposed`). A split connector counts as linked for hiding (it cannot be hidden while it has sub-ports).
- **Subsystems.** A parent splits a subsystem's export the same way: `portKey` is the export ID and `pads` are pads of that export at the pinned revision.
- **Nets.** System nets (§8) are per pad, so splitting changes no net. Hops name the end as its sub-port.
- **V02.** Fan-out stays keyed by `(instance, connector, pad)`; disjoint sub-ports never raise it.

### 22.3 Carving, editing and removing (rows move)

Every change re-homes rows so no row is on the wrong end, in one audited system change:

1. For each **unspecified link** with an end on the connector, each row goes to the end (sub-port or remainder) that now holds its pad.
2. A link whose rows all go to one other end is **retargeted** (`subportId` set or cleared). A link whose rows split across ends keeps the rows of its current end and gives the rest to **new links**, one per end, each with the same other end, `harness` label and type, named `{link name} · {sub-port name}` (or `{link name}` for the remainder); row IDs are kept.
3. An export on a sub-port being removed, or whose sub-port loses all its pads, refuses the change (409 `subport_exported`). Changing an exported sub-port's pads is allowed and shows in the parent as child drift (§7).

- **API.**
  - `POST …/instances/{iid}/subports {portKey, name, pads}` (designer, `If-Match`) → 201 `{subport, moves}`.
  - `PATCH …/instances/{iid}/subports/{spid} {name?, pads?}` → 200 `{subport, moves}`.
  - `DELETE …/instances/{iid}/subports/{spid}` → 200 `{moves}`: its rows return to the remainder.
  - Each takes `?preview=true`: the same validation and `moves` with nothing written and no version bump.
  - `moves`: `[{linkId, action: "retarget" | "split", rowIds, toSubportId, newLinkName}]`.
- **Audit.** `subport_created`, `subport_updated`, `subport_deleted`, each with `{instanceId, portKey, subportId, name, pads, moves}`.

### 22.4 Drift and findings

- **Baseline.** A sub-port's `port` follows its connector like a link end: when a baseline advance or an applied review moves the connector (silent relabel, accepted connector change), its sub-ports move with it. `bind_candidate` on an end of a split connector is refused (409 `port_split`): ends of one connector could otherwise be bound to different connectors; remove the sub-ports, bind, and carve again.
- **SYS-V21 `subport_pad_absent`** (warning). A sub-port names a pad its connector no longer has at the board's baseline, or that its subsystem export no longer has at the pinned revision. Detail `{subportId, name, pads}` (the missing pads). Rows on that pad are SYS-V04 as before.

### 22.5 Document, manifest, ICD

- **Document.** `instances[].subports: [{id, portKey, name, pads}]`. A link end gains `subport: {id, name} | null`; an export gains `subportId` and `subport`. Restricted boards (§5.4) hide `pads` and the names stay.
- **Manifest.** Board, module and assembly instances gain `subports: [{id, portKey, port, name, pads}]` (`port` the connector's baseline, as on a port end); port and export ends and export targets gain `subportId`. Both are omitted while empty or null, so manifests written before them keep their digests. They are part of `full` and `connectivity` (§9.3). Referential rules (§9.2): a `subportId` names a sub-port of that end's instance and connector; sub-ports of a connector are disjoint; rows on an end use that end's pads.
- **ICD and CSV.** Ends read `{label} {reference}.{name}`. The connector column in the ICD CSV is `J6.PWR`, and import resolves `J6.PWR` to the sub-port (a pad outside it is unresolved, `pin_not_on_subport`). A plain `J6` on a split connector lands each row on whichever end holds its pad, so a wiring list written before the split still imports. The round trip holds.
- **Diagram.** A split connector shows each sub-port and the remainder as ports of their own on the board.

## 23. Net rename proposals (SB2-106, D-P2-57)

Prism never edits a board. When two boards name one signal differently, a system's designer records which board should rename its net, and to what. The board's owner learns of it from the system (its Findings tray, report and the by-project renames CSV) and applies it in KiCad; the board's next commit that carries the new name closes it, with no review.

### 23.1 Proposal

- **Shape.** `{id, instanceId, net, name, note, state, createdBy, createdAt, closedBy, closedAt, closedCommit}`.
  - `id`: an `snr_` ID.
  - `instanceId`: the board (or module) instance whose net is to be renamed.
  - `net`: the net as the rows store it at that board's baseline, for example `/Payload/SPI_SCK`.
  - `name`: the proposed net name. It is 1–100 characters with no `/` and no whitespace, because a sheet path belongs to the board's owner.
  - `note`: optional, up to 2,000 characters.
  - `state`: `open`, `applied` or `withdrawn`.
- **Covers.** One proposal names one net on one board. It covers every row and harness wire in the system whose end on that instance carries `net`. The document reports the count as `rows`. A proposal whose net no rows carry any more stays open with `rows: 0`, until it is applied or withdrawn.
- **One at a time.** At most one open proposal per `(instance, net)`. A second is refused with 409 `rename_open`.
- **Storage (workspace migration 51).** Table `system_net_renames`. Its foreign keys to the system and the instance cascade, and a partial unique index allows one open proposal per `(instance_id, net)`.

### 23.2 API

- `POST …/renames {instanceId, net, name, note?}` (designer; `If-Match`) answers 201 with the proposal.
  - 404: the instance is restricted or unknown.
  - 422: no row on that board carries `net`, or `name` is invalid or already equals the net's last path segment.
  - 409: `rename_open`.
- `DELETE …/renames/{id}` withdraws a proposal (`state: withdrawn`).
- Both bump the version and are audited (`rename_proposed`, `rename_withdrawn`). The open proposals are in the document as `renames[]`, so snapshots freeze them. They are not in the manifest, because they are requests to a board's owner rather than part of the system's connectivity.

### 23.3 Applied by a commit

- **Matching.** When a commit is evaluated for a board, each `net_changed` item on that board matches an open proposal when:
  - its expected net set is exactly `[net]`; and
  - its observed set is one net whose last path segment equals `name`.
- **Only renames.** When every item matches a proposal, the baseline advances with no review:
  - the matched rows' net baselines take the observed nets;
  - each matched proposal becomes `applied`, with `closedCommit` and audit `rename_applied`;
  - the advance itself is audited as usual.
- **Mixed.** When other changes come with the rename, the review opens as usual. After any baseline advance, a proposal is applied when no row on that board still carries `net` and at least one carries a net named `name`.

### 23.4 Findings

- **SYS-V09 runs on every system** (D-P2-57; this reverses the opt-in of P2-1.10). `optionalRules` is still accepted, stored and written to the manifest for compatibility. `SYS-V09` there has no effect, and the workspace no longer shows the switch. Teams clear the findings by waiving them (§8.5) or by proposing renames.
- **Annotations.** A V09 finding whose row carries a net with an open proposal has `detail.rename {id, instanceId, name}`, and the Findings tray shows "rename proposed". The finding stays until the commit lands.

### 23.5 Where the owner sees it

- **API.** `GET /api/systems/by-project/{projectId}` returns the systems the reader can see that use the project:

  ```
  {projectId, systems: [{id, name, instances: [{id, label, baselineCommit, trackedRef, pinned}],
                         renames: [...open proposals on those instances, with rows]}]}
  ```

  `GET /api/systems/by-project/{projectId}/renames.csv` is the owner's work list, with these columns: `system`, `board`, `net`, `rename_to`, `rows`, `connectors`, `note`, `proposed_by`, `proposed_at`.
- **Board page.** The project page has a **Used in** section styled like the README under it (a heading and a table): each system, linked, with its placements (the first four labels, then `+N`). It shows no proposals (user, 2026-10-09): the owner reads them in the system's report or the CSV above.
- **Report.** The SB2-107 report (§8.6) gains a **Renames** sheet with the system's open and applied proposals.

## 24. Mechanical parts and collisions (SB2-108, D-P2-58)

### 24.1 Mechanical parts

- **What.** A system can place mechanical parts: an enclosure, a bracket, a mounting plate. A part is a catalog component of kind `part` with a converted model (§18.2, SB2-17), added from the catalog only. A new enclosure goes into the catalog first.
- **Instance.** A new instance kind, `part`, with the same shape as a module instance: `{kind: "part", catalog: {componentId, revisionId}, follow}`.
  - Its model is the first converted model among the pinned revision's assets, with the component's alignment (§18.2).
  - Its own-frame box is the model's aligned bounds.
  - It has no ports, rows or nets. It is never a link end, export or harness end, and SYS-V14 applies to it as to a module.
- **Placement.** Parts are placed and moved like a board or a module (§14.7, §20.4). Poses are stored and reset alike. With no stored pose, a part takes the default side-by-side layout. A part has no mates.
- **Hierarchy.** A part inside a subsystem is an occurrence of the parent's tree like any other, so it is drawn in the parent's 3D view and checked for collisions there.
- **Storage (workspace migration 52).** `system_instances_kind_shape` admits `part` with the catalog columns, exactly as `module`.
- **Manifest.** `CatalogInstance.kind` takes `part`. A part appears in `instances[]` and `placement.poses` and nowhere else.
- **Document and ICD.**
  - The document lists a part like a module with `ports: []`.
  - The outline has a **Parts** group, and **Add** gets a **Part** item that lists catalog parts with a model.
  - The ICD's board table names parts with their identity and no project.

### 24.2 Collision check

- **What collides.** Each pair of occurrences in the system's 3D view (boards, modules, parts, at every depth) is checked, using the poses the 3D view uses (§14.9, §20.1).
  - Boards: the board body is a solid box, its outline bounds × thickness (the placement's own-frame box, §14.7). Each component body comes from `geometry/components.glb` of the board's viewer bundle at its baseline: one object per footprint node, named by reference (`semantic_geometry.json`). It is mapped to the board frame (§14.2) by the scene's `bundleToBoard`: glTF metres, Y-up, to millimetres, Z-up, about the copper mid-plane. The bundle's board mesh is not used: it is heavy and a box is what the 3D view's separation already assumes.
  - Modules and parts: the catalog GLB, scaled ×1000 and given its alignment (§18.2).
  - An occurrence that cannot be checked is listed in the result's `notEvaluated` as `{occurrence, label, reason}`, with `reason` one of `no_outline`, `restricted`, `bundle_<status>` (no ready bundle) or `no_model`. It is never assumed clear.
- **Method.**
  1. Object boxes, placed from each mesh's own-frame box, find candidate pairs: a sweep on x, then an overlap of more than 0.05 mm on every axis. Bodies that only touch are never a pair.
  2. python-fcl decides each candidate pair: triangle meshes (one BVH per mesh, placed by its transform), or a primitive box for a board body.
  - A board body is solid: a component wholly inside it collides. A mesh is a surface: a body wholly inside a module's or part's mesh, touching none of its triangles, does not.
  - Two objects of the same occurrence are never a pair.
  - **Exempt:** the two connector bodies of each `b2b` link (any depth). Mated connectors touch by design. A module's end is its whole body.
  - Component meshes are cached per bundle as `.npz` beside the semantic store. A bundle never changes once built.
- **Running.**
  - `POST …/collisions` (viewer) queues `system_collision_check` (pool `prism`) and answers 202 `{jobId}`. `GET …/collisions` returns `{systemId, state, checkedAt, notEvaluated, findings}` (the SYS-V22 findings).
  - The result `{collisions, notEvaluated, stats}` is stored per system with the `sceneKey` it was computed for (SB2-98), in `system_collision_checks` (migration 52, no foreign key, deleted with the system). There is no automatic check: a placement edit makes the stored check stale.
- **Document.** `validation.collisionCheck` is `{state, checkedAt, notEvaluated}`:
  - `state` is `current` when the stored check was made for the document's `sceneKey`, `stale` when it was made for another, or `not_checked`;
  - `notEvaluated` is the current check's unchecked occurrences.
  - It is separate from `counts.notEvaluated`. A snapshot freezes it as it stands.
- **SYS-V22 `part_collision`** (warning, waivable, §8.5). There is one finding per colliding occurrence pair, raised only while the check is `current`.
  - `instanceId` is the first occurrence's root instance. `reference` is `"<label a> <ref a> ↔ <label b> <ref b>"`.
  - `detail` is `{a: {occurrence, label, reference}, b: {…}, atMm, pairs}`:
    - `reference` is the first colliding component, or null for a body;
    - `atMm` is a contact point in root coordinates;
    - `pairs` is up to 10 colliding object pairs `{a, b, atMm}`.
- **3D.** **Show** on a V22 finding frames both occurrences and marks `atMm`. The view's toolbar gets **Check collisions**, which shows the check's state and the count of open (not waived) collisions.

## 25. STEP export (SB2-109, D-P2-59)

- **What.** One AP214 STEP of the placed system for MCAD: every board, module and part at the pose the 3D view uses (§14.9, §20.1), at every depth.
- **Product tree.** The root product is the system's name. Each occurrence is a component named by its label. A subsystem is a sub-assembly holding its own occurrences, so the tree follows the instance paths (`C&DH ▸ OBC-1`).
  - A board is one product per `(project, commit)`, shared by every instance of it. A module or part is one product per catalog STEP.
  - Names and colours from the sources are kept. Most MCAD tools list a component by its product's name (`JTYU-IN @ 28550e6`); the instance label is the component's own (NAUO) name.
- **Boards.** `kicad-cli pcb export step --subst-models` runs on the board file in a `git archive` of the instance's baseline commit (§14.2).
  - The STEP's x and y are the board frame. Its z is offset by the copper mid-plane, the same shift the 3D bundle's `bundleToBoard` applies (§20.1). That shift is used when the board's bundle is ready; otherwise the shift is half the placement box's thickness (§14.7).
  - Each result is cached as `<semantic store>/../system-step/<project>/<commit>-<kicad-cli version>.step`. A commit never changes.
  - Its own models are what the board's 3D tab shows. A model that `kicad-cli` cannot find is left out of that board and is not an error.
- **Modules and parts.** The catalog STEP behind the model the 3D view draws (§18.2), under its alignment. The STEP is in millimetres, in the same axes as its GLB.
- **Size.** No surface curves (pcurves) are written, so the file stays close to the sum of its sources.
- **Not exported.** These are listed in the result's `skipped` as `{occurrence, label, reason}`: an occurrence the caller can't read (`restricted`); a board whose STEP export failed (`export_failed`, with `kicad-cli`'s last line); a module or part without a STEP (`no_model`). A harness the caller can't fully read (an end on, or a level in, a restricted occurrence) is skipped as `restricted`, its occurrence `harness:<level>:<id>`.
- **Running.**
  - `POST …/step` (viewer) queues `system_step_export` (pool `prism`, needs `kicad-cli`) and answers 202 `{jobId}`. The job is keyed per system and version, so a second request at the same version joins the running one.
  - `GET …/step` returns `{state: none|running|ready|failed, version, createdAt, sizeBytes, skipped, jobId, error}` for the latest export.
  - `GET …/step/file` downloads `<system name>-v<version>.step` once it is ready. An export made at an older version stays downloadable until the next one starts; its `version` says which version it shows.
- **Storage.** `system_step_exports` (migration 53, no foreign key, deleted with the system) holds the latest export per system. The file sits in `<semantic store>/../system-step/systems/<system id>.step`.
- **UI.** The 3D view's toolbar gets **Export STEP**: running, then a download.
- **Harnesses** (SB2-109 part 2). Every level's routed harnesses go under a `Harnesses` assembly in the system's frame, one sub-assembly `Harness <name>` each (a child system's prefixed with its level path), as the System 3D view draws them (§17.10, §20.15, §20.17):
  - `Bundle`: per segment a wire crosses, a circle of the segment's bundle diameter swept along a curve interpolated through the route's samples (corrected Frenet). Where OCCT cannot sweep, the segment is a cylinder per span with a sphere at each joint. Harness grey.
  - `<reference> housing` per posed end: the part's STEP model at the end's mating frame · alignment, or the proxy box the view draws (connector body x–y × housing depth).
- **Not attached to snapshots** (user, 2026-10-09): a STEP is hundreds of MB; it stays an on-demand export.

## 26. Harness manufacturing outputs (SB2-110)

### 26.1 Model additions

- **Contact part per end.** `PATCH …/harnesses/{hid}/ends/{eid}` takes `contact: {componentId} | null`. The contact must be an active catalog `part`; it needs no pins. Every wired cavity of that end takes one. The part's current revision and `{name, mpn, manufacturer}` are kept, as for the block part (§17.3, SB2-18). Documents show it as `ends[].contact`, shaped like `part`.
- **Coverings per segment.** `PUT …/harnesses/{hid}/coverings` (designer, If-Match) replaces the list `[{segmentId, componentId?, description}]` and returns the harness document.
  - `segmentId` is a route segment (§17.7, `"<from>~<to>"`) or `"*"`, the whole bundle.
  - A covering has a catalog part, a description (≤ 200 characters, e.g. "PET braid 6 mm"), or both. At most 64 per harness.
  - A covering whose segment is not in the current route stays stored and is listed as `unrouted`.
  - Documents show `coverings[]` as `{segmentId, part, description}`. Audited as `harness_updated` with `coverings`.
- **Wire labels** are the existing `label` (§17.2).
- **Segments.** The live document's `lengths` gains `segments: [{id, from, to, lengthMm, wires}]` (0.1 mm). They are the routed segments the coverings name.
- **Storage (migration 54).** `system_harness_ends.contact_component_id`, `contact_revision_id`, `contact_summary`; `system_harnesses.coverings JSONB NOT NULL DEFAULT '[]'`.
- **Manifest.** `HarnessEnd.contactPart` (a `PartRef`) and `Harness.coverings`, each omitted while null or empty, so older digests do not change.

### 26.2 Outputs

`GET …/harnesses/{hid}/outputs/{name}` (viewer), with `name` one of `drawing.svg`, `drawing.pdf`, `wiring.csv`, `bom.csv` or `wireviz.yaml`. The download is named `<harness name>-v<version>-<name>`. A harness with an end on a board the reader cannot see is 404, as for edits. All outputs read the live document at its version.

- **Ends** are named by what they mate, `HPDRM J4` (the instance label and connector reference), or `End N` when unmated. A cavity is an end pin.
- **Cut length** of a wire is its estimated length (§17.10, allowance included), rounded up to the next whole millimetre. While the harness has no route, or the wire is unplaced, it is the harness's `cutLengthMm` when set, else empty.
- **Wiring list (CSV).** One row per wire, ordered by from end, cavity, to end, cavity. Columns: `wire`, `label`, `from_end`, `from_cavity`, `from_net`, `to_end`, `to_cavity`, `to_net`, `signal`, `gauge_awg`, `colour`, `cut_length_mm`. `wire` is `W1…` in that order.
- **BOM (CSV).** Columns: `item`, `kind`, `mpn`, `manufacturer`, `description`, `qty`, `unit`, `where`. Rows:
  - **housing:** one per end with a block part;
  - **contact:** one per contact part, quantity = the wired cavities of the ends that use it;
  - **wire:** one per (gauge, colour), quantity = Σ cut lengths in metres, rounded up to 0.01 m;
  - **splice:** one per end pin that carries more than one wire, unit `each`;
  - **covering:** one per covering, quantity = its segment's length in metres (the bundle's for `"*"`), rounded up to 0.01 m;
  - **label:** quantity = wires with a label.
  - An end with no block part is listed as a `housing` row with an empty MPN and description "Generic N-way (no part)", so the gap is visible.
- **Drawing (SVG; PDF rendered from it):** §26.3.
- **WireViz YAML.** The output renders with WireViz 0.4.
  - **Connectors:** one per end, `X1…`. `type` is the block part's name, or `Generic`. `mpn` and `manufacturer` come from the block part. `pinlabels` are the signals.
    - A canonical number pin is a number; any other name (`01`, `A1`) stays text, so pins stay unique.
    - A label equal to another pin's name gets a zero-width space, because WireViz resolves connections by label too.
    - The contact is an additional component with `qty_multiplier: populated`, so WireViz's BOM counts one per wired cavity.
  - **Cables:** one per end pair and gauge, `W1…`, category `bundle`. Each has its gauge in AWG, `colors` (striped `red/white` → `RDWH`) when every colour maps, and `length` = the longest cut length in m.
  - **Connections:** one per wire. A splice is several connections on one pin.
  - **Text:** escaped, because WireViz puts it into Graphviz HTML unescaped.
  - **Limits (WireViz has no branch topology):**
    - a harness with breakouts becomes one cable per end pair, with no branch points and no segment lengths; the drawing (§26.3) keeps them;
    - coverings ride on the first cable as components, by segment length, so a covering's position is not shown;
    - an end with no wires is a connector WireViz warns is unconnected.
- **Segments are named** by their two nodes, `HPDRM J4 – B1`, in the BOM's `where` and WireViz's covering type; breakouts are `B1…` in route order. A covering whose segment the route no longer has keeps its segment ID.

### 26.3 Drawing (SB2-111, D-P2-60)

One sheet, the route tree in WireViz's look. Not to scale.
- **Connector tables.** One per end: a header (name; block MPN and manufacturer; `N-way · M used · contact MPN`), then a row per wired cavity in cavity order, the cavity number and the net at that end, with a port facing the bundle. A cavity with several wires (a splice) is one row with a filled port.
- **Layout.** The first end that is a route leaf sits on the left; every other end is stacked on the right in route order, so branches do not cross. Breakouts sit by route depth between them, at the middle of the ends they lead to.
- **Wires.** Each wire leaves its cavity as a straight lead tagged `W5 RDWH` (number and colour code), then fans into the bundle at its end. Wires are drawn in their colours, a second colour as a dashed stripe; an unknown colour is grey and keeps its text.
- **Bundle.** A sheath per segment, as thick as √(wires carried), labelled with its length, wire count and covering; a covered segment is hatched (every segment for `"*"`). A breakout is a dot named `B1…`.
  - An end the route passes through hangs off a tap (a hollow dot) by a short stub.
  - An end the route does not reach, or every end without a route, joins the left end by a dashed `not routed` line.
- **Under the drawing:** the wire list (the wiring list's columns with a colour swatch), the BOM (§26.2 rows) and a title block (harness, system and version, wires, bundle length or `not routed`, whole-bundle covering, sheet, date).
- **Tracing.** Every element that belongs to wires carries `data-w="W1 W2"` (fan, tag, cavity row, sheath, breakout, wire-list row); a fan also carries `data-wire` with the wire ID. The viewer uses them; a PDF ignores them.
- **Viewer.** The harness panel opens the drawing in Prism. Hovering anything dims every element not on the hovered wires, so a wire is followed through the bundle; clicking pins the trace, Escape clears it. The status line names a single traced wire (ends and cavities, signal, gauge, colour). Zoom: fit to width, 1:1, ±, ctrl/⌘ + wheel.

