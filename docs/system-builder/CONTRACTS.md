# System Builder v2 contracts

- **Status:** draft, stages 1a–3c. The design is [ADR: System Builder v2](../architecture/adr-system-builder-v2.md); this file is its contract layer.
- **Covers:** the `prism.system.v2` document (§2), the `prism.system.ops.a0` operations (§3), storage (§4), the HTTP API (§5), permissions and redaction (§6) and limits (§7). The system bundle, `prism.system_bundle.a0`, and the `prism-kicad system build` command that writes it are §8 (placement, stage 3a, is §8.9); its findings are §9. Stage 1c adds board-level sub-ports (§10), publishing (§11), placing entries (§12) and the Git link (§13). Stage 2 adds the schematic (§14); stage 3b the 3D tab and 3c the B2B tab (§15).
- **Authority:** the TypeSpec in `native/src/tsp/prism/system-v2.tsp`, `system-ops-a0.tsp`, `system-bundle-a0.tsp` and `cli-system-a0.tsp`, with JSON Schema generated beside the bundle contracts. Python validates against the generated schema; the stage 1b Rust reads the generated types. This file explains the rules the schema cannot state.

## 1. Rules for the whole document

- **Unfrozen until stage 5.** The schema id stays `prism.system.v2` while stages 2–4 add or change fields. Every shape change ships with a forward migration of stored documents, applied when the store reads one (the first such change adds `backend/app/system_builder/upgrade.py`). It freezes when stage 5 lands.
- **Only what the user decided.** The document stores no copy of board data: no pin nets, no pad positions, no connector lists, no derived mapping or wiring. Whether a referenced connector or pin still exists is a system-bundle finding, never a document error, because a followed board changes underneath the document.
- **One id space.** Every object has an `id` unique across the whole document, matching `^[a-z][a-z0-9_-]{0,63}$`. The caller always chooses it, so a request can add an object and refer to it in the same request, and an operation's inverse is exact. The UI and the script helpers use `<prefix>_<10 random base32>` (`occ_`, `sub_`, `mate_`, `har_`, `end_`, `link_`, `wire_`, …). An id is never reused within a document, even after removal: the store keeps every id the document has held (`seen_ids`), and only an undo may bring one back.
- **Units and naming** follow the bundle conventions (`native/contracts/prism/conventions.md`): camelCase fields, lengths in integer nanometres (`…Nm`), angles in degrees (`…Deg`), kebab-case enum values, unknown values absent, arrays and maps always present.
- **Frames.** System space is right-handed, +z up, in nanometres. Rotations are unit quaternions `{x, y, z, w}`, so a pose has no gimbal lock; they are normalized on write.
- **Order.** Every top-level collection is sorted by `id` in code point order, so a Git diff of the document is stable. Ordered lists inside objects (a sub-port's pins, a cable's conductors) keep the user's order.

## 2. The document, `prism.system.v2`

```
SystemV2
  schema: "prism.system.v2"
  name, description?
  sheets[]            Sheet { id, name, parent? }           absent parent: the root sheet
  occurrences[]       Occurrence
  subPorts[]          SubPort                               occurrence-level only (§2.3)
  dismissedSuggestions[]  { occurrence, connector, key }    §2.3
  bodyConnectors[]    BodyConnector                         board-less systems (§2.7)
  mates[]             Mate
  harnesses[]         Harness                               with every §2.5 object nested
  exports[]           Export
  waivers[]           Waiver
  layout              Record<id, SchematicPlacement>        presentation only
```

### 2.1 Occurrences

```
Occurrence { id, label, sheet?, source, pose?, positioningMate? }
source (oneOf):
  { kind: "board", projectId, track }
     track: { kind: "pinned", commit }
          | { kind: "followed", branch, commit, reviewedCommit? }
  { kind: "entry", componentId, revisionId }    a published system (§12)
  { kind: "body",  componentId, revisionId }    a mechanical catalog part
```

- `pinned.commit` never changes except by `set-occurrence-source`.
- `followed.commit` is the commit the occurrence is at now. The system advances it with `advance-occurrence` (§3.4) whenever a newer commit on `branch` has a built bundle, and logs that like any edit, so the document version and each occurrence's commit always determine the system bundle key. `reviewedCommit` is where the user last acknowledged changes; the "changes since your last review" marker shows while it differs from `commit`.
- `pose` is stored only for a free occurrence (a root, or something bolted into a body): `{ translation: {xNm, yNm, zNm}, rotation: {x, y, z, w} }`. A mated occurrence derives its pose from its positioning mate; a stored pose on it is ignored and reported as a finding.
- `positioningMate`, when present, overrides the automatic spanning-tree choice (ADR §2.6).

### 2.2 Endpoints

Everything that connects names an endpoint:

```
Endpoint { occurrence, connector, subPort? }
  connector: the connector's reference designator on that board (or body connector, §2.7)
  subPort:   { kind: "occurrence", id } | { kind: "board", id, version }   board: §10.5
```

An endpoint without `subPort` means the whole connector. Pins are pad numbers as strings (`"1"`, `"A4"`). On a published entry, `connector` is an export id (§12.1).

### 2.3 Sub-ports

```
SubPort { id, occurrence, connector, name, pins[], suggestion?, promotedTo? }
```

- `pins` are pad numbers in the user's order: the order they were selected in, or the suggestion's order. Sub-ports may overlap.
- `suggestion` is the key of the bundle suggestion it was accepted from, for example `unit:2`, `bus:CAN`, `sheet:/Power/`, `family:I2C`, `power`. Keys are defined with the system bundle (1b).
- `promotedTo` is set when the sub-port was promoted to the board (§10.5); endpoints that used it then point at the board-level id.
- A dismissed suggestion is stored in `dismissedSuggestions` so it stays dismissed; restoring it removes the entry.
- Board-level sub-ports live outside the document, Prism-side against the project and connector (§10). The document refers to them only through endpoints.

### 2.4 B2B mates

```
Mate { id, a: Endpoint, b: Endpoint, orientation, stackHeightNm?, offset?, manualMap?, rows }
  orientation:   { quarterTurns: 0..3, flip: boolean }
  offset:        a pose applied after the mate transform (spacers, a tilted fit)
  manualMap:     [{ a: pad, b: pad }]   present only as a flagged manual override
  rows:          Record<pad on a, { netLabel?, signal? }>
```

- Both endpoints are whole connectors (no `subPort`).
- The pin mapping is derived in the system bundle from both connectors' pads in the mated pose. `manualMap` replaces it when geometry can't decide, and always carries a warning finding.
- `quarterTurns` is `k` in the kept mate transform (`placement/mate.py`). `flip` mates B on its frame flipped over its x axis, for a connector reached through the board.
- Absent `stackHeightNm` means the clearance fallback of the mate maths.

### 2.5 Harnesses

A harness block holds every object of ADR §2.5. Continuity lives only in links (through their derived default wiring), wires and splices; geometry is derived except what the user pinned.

```
Harness { id, label, sheet?, ends[], links[], wires[], splices[], branchPoints[],
          segments[], coverings[], cables[], looseEnds[], markers[], waypoints[] }

End         { id, site?, housing?, contacts, pinMap, bootLengthNm? }
              site: Endpoint without subPort: one mating site is one end; absent on an empty block
              housing: PartRef; contacts: Record<cavity, PartRef>
              pinMap: [{ cavity, pad }]  empty: cavity n is pad n
Link        { id, a: Endpoint, b: Endpoint, unmapped[] }
              a schematic harness wire; each side's connector must be an end's site
              unmapped: pads on side a the user cleared from the default wiring
Wire        { id, from: Terminal, to: Terminal, link?, gaugeAwg?, colour?, lengthNm?, label?, route[] }
              Terminal: { kind: "contact", end, cavity } | { kind: "splice", splice } | { kind: "loose", looseEnd }
              link: the link whose default wire this one replaces, for that link's pin on side a
              route: segment ids from `from` to `to`, in order; empty: derived
Splice      { id, method: "crimp" | "solder", confirmed }
BranchPoint { id, position? }               absent position: derived from the topology
Segment     { id, from: Node, to: Node }      Node: { kind: "end", end } | { kind: "branch-point", branchPoint }
Covering    { id, segment, kind: "sleeve" | "heat-shrink" | "tape" | "zip-ties", part?, startNm?, endNm? }
Cable       { id, part?, label?, conductors[] }  conductors: { name, wire?, drain } in the cable's order
LooseEnd    { id, kind: "pigtail" | "test-point" | "open", lengthNm?, label? }
Marker      { id, wire, kind: "label" | "heat-shrink-marker", text, atNm? }
Waypoint    { id, segment, position, order }
PartRef     { componentId, revisionId? }       a catalog part; absent revision: the latest released
```

- **Default wiring is derived** per link in the system bundle (ADR §2.5 rules). An explicit `Wire` with `link` set replaces the default wire for its pin; `unmapped` removes one. A wire without `link` is free-standing (splice to splice, a pigtail).
- **Splices for shared pins** are proposed by the system bundle and flagged. Confirming one stores a `Splice` with `confirmed: true` and the wires that join it.
- `gaugeAwg` is a string (`"24"`, `"0"`, `"00"`), as the kept harness maths reads it.

### 2.6 Exports and waivers

```
Export { id, name, site: Endpoint, pinNames: Record<pad, string> }
Waiver { id, code, subject, reason }
```

- An export makes a connector or sub-port part of the system's interface when published (§11.1). `pinNames` renames pins for that interface.
- A waiver silences one finding: `code` is the finding code, `subject` the finding's subject key, both defined with the findings catalogue (1b).

### 2.7 Board-less systems

```
BodyConnector { id, occurrence, refdes, part: PartRef, frame: Pose, quarterTurns }
```

A connector part placed on a body occurrence's face. `refdes` is what endpoints name as `connector`. `frame` is the part's mating frame in the body's frame, with the conventions of the kept frame maths (face frame, part mating frame, quarter turns).

### 2.8 Schematic layout

`layout` maps an object id to where and how it is drawn. It is presentation only: no rule reads it, and removing an object removes its entry. Stage 2 adds the optional fields; a stored entry without them is still valid, so no stored document changes.

```
SchematicPlacement {
  sheet?, xNm, yNm, rotationDeg, mirror     where the symbol sits (occurrence, harness block, sheet symbol)
  size?:     { widthNm, heightNm }          a sheet symbol's size (board, body or entry occurrence; harness block)
  ports?:    Record<key, PortPlacement>     a sheet symbol's pins: key = connector refdes (occurrence) or end id (harness block)
  route?:    Point[]                        a connection: a mate's path from side a to side b, or a harness end's from its site's pin to the block
  interior?: Interior                       inside a board or body sheet (§14.3)
  canvas?:   { xNm, yNm }                   on its harness tab (§16.5): an end card's top-left, a splice's, loose end's or branch point's centre
}
PortPlacement { edge: "left" | "right" | "top" | "bottom", offsetNm }
Point         { xNm, yNm }
Interior      { symbol?: { xNm, yNm, widthNm, heightNm }, pins?: Record<refdes, PortPlacement>,
                labels?: Record<refdes, { xNm, yNm, rotationDeg }> }
```

- Coordinates are KiCad's sheet coordinates: +x right, +y down, in nanometres. A sheet symbol's or harness block's `xNm`, `yNm` is its top-left corner.
- `offsetNm` runs along the edge from its top or left end. It is not checked against `size`: a resize keeps the offsets and the drawing clamps them.
- `ports` and `interior` keys name connectors the bundle knows; a key it does not is ignored, never an error (§1).
- `route` belongs to a mate's or a harness end's entry and has at least two points. On the root sheet a harness is drawn per end (one line from the end's site to its block, however many links use it), so the end carries the route, not the link (stage 2b). Absent `route` is drawn by the auto-router (§14.2).
- Any absent field takes the default of §14.2.

## 3. Operations, `prism.system.ops.a0`

### 3.1 Requests

```
SystemOpsA0 { schema: "prism.system.ops.a0", ops[] }
```

- The ops of one request are validated and applied **in order, as one transaction**, producing one new version. Any refusal refuses the whole request and nothing changes.
- The caller sends the version it read as `If-Match: "system:<systemId>:<version>"`, the ETag every read returns (`app/core/preconditions.py`). A missing `If-Match` is `428`; any other version is `412 stale_version` with the current ETag. There is no merge.
- The same request is what the API (§5) and `window.prismSystemBuilder` (stage 2) send. There is no other write path.

### 3.2 The operation set

Each op is `{ kind: "<name>", … }`. Collections get `add-`, `replace-` and `remove-` ops; `replace-` takes the whole object, with the same id, so its inverse is exact.

| Collection | Ops | Cascade on remove |
|---|---|---|
| system | `set-system-info { name?, description? }` | — |
| sheets | `add-sheet`, `replace-sheet`, `remove-sheet` | its objects and child sheets move to its parent |
| occurrences | `add-occurrence`, `replace-occurrence` (also how a source, pose or positioning mate changes), `remove-occurrence` | its sub-ports, dismissed suggestions, body connectors, mates, exports, layout entry; links using it; ends sited on it lose their `site` |
| subPorts | `add-sub-port`, `replace-sub-port`, `remove-sub-port`, `dismiss-suggestion`, `restore-suggestion` | endpoints naming it fall back to the whole connector |
| bodyConnectors | `add-body-connector`, `replace-body-connector`, `remove-body-connector` | as an occurrence's connector: mates, links, exports on it |
| mates | `add-mate`, `replace-mate`, `remove-mate` | `positioningMate` references to it |
| harnesses | `add-harness` (with contents), `replace-harness` (its own fields only: label, sheet), `remove-harness`, `connect-harness` | its whole contents, layout entry |
| harness contents | `add-<kind>`, `replace-<kind>`, `remove-<kind>` with `harness`, for `end`, `link`, `wire`, `splice`, `branch-point`, `segment`, `covering`, `cable`, `loose-end`, `marker`, `waypoint` | end: links and wires on it; splice: its wires; segment: coverings, waypoints, routes through it; wire: markers, cable conductor bindings |
| exports | `add-export`, `replace-export`, `remove-export` | — |
| waivers | `add-waiver`, `remove-waiver` | — |
| layout | `set-layout { item, placement }`, `remove-layout { item }` | — |
| tracking | `advance-occurrence { occurrence, commit }`, `acknowledge-changes { occurrence }` | — |
| board-level sub-ports (§10.5) | `promote-sub-port { subPort, boardSubPort }`, `acknowledge-sub-port { subPort, version }` | — |
| Git (§13.3) | `import-document { document }`, issued only by the import route | — |

- `connect-harness { harness?, newHarness?, newEnds, link }` is the schematic gesture. It uses `harness`, or the block either side's connector already belongs to, or creates `newHarness`; it adds an end (with the id `newEnds.a` or `newEnds.b`) for each side whose connector has no end in that block, then adds the link. Every link drawn from one connector joins that connector's existing harness block (ADR §2.4); naming a different block is refused.
- Validation is document-local: references resolve to objects of the right kind, ids are unique, enums and units are in range, and the §7 limits hold. Whether a connector or pin exists on the board is the system bundle's job (§1). Three ops also check outside the document when applied: `promote-sub-port` (the caller's right on the project, §10.5), an occurrence set to a published entry (§12.1) and `import-document` (only from its route).

### 3.3 Undo (recorded inverse)

- Applying a request records its exact inverse in the log: the ops that restore the previous document, including every object a cascade removed, under their old ids.
- `POST …/undo { version }`, guarded by `If-Match` like any write, applies the inverse of the request that produced `version` as a new request (a new version, logged with `undoes: version`). History stays linear, and an undo is itself undoable.
- **Undo is refused** (`409 system_undo_conflict`, listing the later versions) when any request after `version` changed an object the inverse touches. The user undoes those first.
- A request that changed nothing has an empty inverse; undoing it is refused (`409 system_undo_nothing`).
- The undo stack in the UI is per user: the latest of their own versions not yet undone.

### 3.4 System-issued ops

`advance-occurrence` is issued by the system job when a followed board's newer commit has a built bundle. It is logged with actor `system`, so "advanced silently, recorded in history" holds. It is never refused for staleness: the job rebases it onto the current version.

## 4. Storage

Workspace schema, one migration (125):

| Table | Holds |
|---|---|
| `ws_systems` | `system_id`, `folder_id`, `name` (copied from the document for listing), `document` (jsonb), `version`, `seen_ids` (jsonb: every id the document has held), `created_by`, `created_at`, `updated_at`, `deleted_at` |
| `ws_system_ops` | `system_id`, `version`, `ops`, `inverse`, `actor`, `kind` (`edit`, `undo`, `system`), `undoes`, `touched` (the object ids changed), `created_at` |
| `ws_system_snapshots` | `snapshot_id`, `system_id`, `version`, `name`, `note`, `document`, `created_by`, `created_at` |

- There is no table per concept (ADR §3.1). Board-level sub-ports (§10.3, migration 127) and the system bundle cache (1b, migration 126) add their own tables. Migration 128 adds `ws_systems.catalog_component_id`, `ws_system_snapshots.board_sub_ports` (§10.5), `ws_system_publications` (§11.2) and `ws_system_git_links` (§13.1).
- `touched` makes the undo conflict check a set intersection.
- A snapshot is the document at a version, copied, so it outlives log retention. Deleting a system is a soft delete.

## 5. HTTP API

| Route | Does |
|---|---|
| `GET /api/systems` | list the systems the caller can see (folder visibility) |
| `POST /api/systems` | create `{ name, description?, folderId? }`, version 1 |
| `GET /api/systems/{id}` | `{ systemId, version, document, … }` with an `ETag`, redacted (§6) |
| `POST /api/systems/{id}/ops` | apply a `prism.system.ops.a0` request; returns the new version and the document |
| `POST /api/systems/{id}/undo` | `{ version }` |
| `GET /api/systems/{id}/history` | the log, newest first, paged |
| `GET`, `POST /api/systems/{id}/snapshots`; `GET …/snapshots/{snapshotId}` | list, take and read snapshots |
| `DELETE /api/systems/{id}` | soft delete; owner or admin |
| `POST /api/systems/{id}/publish` | publish to the catalog (§11.2) |
| `PUT`, `DELETE /api/systems/{id}/git`; `POST …/git/commit`, `POST …/git/import` | the Git link (§13) |
| `/api/projects/{projectId}/sub-ports…` | board-level sub-ports (§10.4) |
| `GET /api/catalog/system-entries/{revisionId}` | a published entry's insides (§12.3) |

Reads need `read`; writes need `design` (`app/core/policy.py`).

## 6. Permissions and redaction

- A system's own visibility follows its folder, like a project's.
- **Redaction** (ADR open question 1, today's rule): when the caller cannot see a board occurrence's project, they see the occurrence by its label only. Its `source` is replaced by `{ kind: "redacted" }`, and every pin list, pin map, row label and pin name that names that occurrence's pins is emptied; a mate on it also loses its drawn `pads` (§8.4). The same rule applies to snapshots, history and (1b) the system bundle's reads and findings.
- A request from that caller that would read or change a redacted occurrence, or anything naming its pins, is refused (`403 system_redacted`). Everything else stays editable.
- Redaction happens at read time; the stored document is always complete.

## 7. Limits (ADR open question 4)

| Limit | Value |
|---|---|
| Document size (canonical JSON) | 4 MiB |
| Occurrences | 200 |
| Mates + links | 2,000 |
| Harnesses | 200 |
| Ends per harness | 64 |
| Wires per system | 10,000 |
| Ops per request | 1,000 |

They are settings (`PRISM_SYSTEM_*`), so a deployment can raise them, and are checked on every request.

## 8. The system bundle, `prism.system_bundle.a0`

Derived state (ADR §3.3). It is a pure function of the document and the design bundles of its board occurrences, written by Rust (`native/src/rs/prism-system`, run as `prism-kicad system build`) and orchestrated by Python. Like the document, it is unfrozen until stage 5. Stage 1b computes connectivity: system nets, B2B mappings, harness wiring, sub-port suggestions and findings. Stage 3a adds placement (§8.9); harness geometry and outputs join in stages 4–5.

### 8.1 Inputs and key

- **The document,** canonical JSON without `layout`. Its SHA-256 is `documentSha256`. Layout is presentation only (§2.8), so moving a symbol, a pin or a route reuses the bundle (stage 2b).
- **One design bundle per board occurrence whose bundle has stage `parse` complete.** It reads `projections/system-interface.json` (connectors, pins, pin nets, names and types, power nets, pad geometry and board thickness) and `projections/semantic-index.json` (bus aliases, nets' source sheets). B2B geometry reads `system-interface.json`'s pad geometry, the form the kept placement maths and their goldens use. This amends the ADR's mention of `placements.json` for pads; the maintainer chose it so the goldens replay unchanged.
- **The system bundle key** is SHA-256 over the canonical JSON `{documentSha256, format, generator, members: {occurrence: bundleKey}, absent: [occurrence], pending: [occurrence], boardSubPorts: {id: version}, entries: {occurrence: {payload, stage}}, parts}`; 1c adds `boardSubPorts` and `entries` (§10.5, §12.2), always present. `format` is the system bundle's format number, bumped whenever what the bundle holds changes (1: stage 3a's `placement`; 2: stage 3c's mate `pads`; 3: stage 3d's bodies and `parts`; 4: stage 3d's `placement.exports`), so stored bundles rebuild without any design bundle's key changing. A new document version with the same content, such as one restored by an undo, reuses the bundle.
- **Board-level sub-ports** the document names, as `--board-sub-ports` (§10.5), and **published entries' payloads**, as `--entry` (§12.2), from 1c. Body occurrences and their connectors read their parts from `--parts` (stage 3d, §8.10).

### 8.2 Occurrences

`occurrences[]`, one per occurrence in id order: `{ occurrence, state, revisionKey?, bundleKey?, outline?, connectors[] }`.

- `state` is one of:
  - `ready`: its bundle was read, or, for a body, `--parts` resolved its part (§8.10);
  - `pending`: its bundle is not built yet;
  - `absent`: the project is not present at that commit, or a body's part is not in the catalog;
  - `unsupported`: no longer produced (bodies were, until stage 3d);
  - `redacted`: only in an API read, for an occurrence whose project the reader cannot see (§6); its keys and connectors are withheld. A stored bundle never holds it.
- `connectors` (ready boards only) lists the board's connectors in natural reference order: the components `system-interface.json` marks `candidate`, plus any component a document endpoint names. Each is `{ refdes, value, mpn?, candidate, placement?, pins[] }`. `placement` (stage 2) is `{ angleDeg, side }`: the angle from the centre of the board outline's bounding box to the component's position, counter-clockwise from +x with +y up (the board seen from its top, KiCad's y flipped), in `[0, 360)`, and `side` is `top` or `bottom`; it is absent when the board has no outline. The schematic places a connector's sheet pin by it (§14.2).
- `outline` (stage 2, ready boards with an Edge.Cuts outline) is `{ widthNm, heightNm }`, the outline's bounding box, which sizes the board's sheet by default. Each pin, in natural pad order, is `{ pad, net?, nets[], pinName?, pinType?, power }`. `net` is the pin's first schematic net. This is the per-occurrence view the schematic and harness UI draw from, so a reader needs only the system bundle.

### 8.3 System nets

- **Nodes** are connector pins `(occurrence, connector, pad)`.
- **Board edges:** two pins of one ready board are joined when they share a board net (any of their `nets`). A signal entering on J2 and leaving on J5 is one system net.
- **System edges:** each B2B mate's mapped pairs (§8.4), each harness link's wires (§8.5), and the explicit wires through splices.
- `nets[]` is every connected set that holds a pin of a connection, a sub-port or an export, plus every board net that reaches at least one connector pin. A connector pin on no board net and in no connection is not a net. Each is `{ id, name, names[], boardNets[{occurrence, net}], pins[{occurrence, connector, pad}] }`.
  - `id` is `net-` and the SHA-256 (first 16 hex digits) of its sorted pins, so it is stable while membership is.
  - `name` is the most common board net name, ignoring KiCad's automatic `Net-(…)` and `unconnected-(…)` names. Ties go to the first in code point order. With only automatic names, the first of those. With no board net at all (unconnected pins joined only by connections), the first pin as `<occurrence>/<connector>/<pad>`.
  - `names` lists every distinct board net name.
  - Order: `nets` by `id`, and `pins` and `boardNets` by their fields in code point order (natural order for pads).

### 8.4 B2B mappings

`mates[]`, one per document mate: `{ mate, source, pairs[{a, b}], unmappedA[], unmappedB[], pads? }`.

- **source `geometry`.** Each connector's frame comes from the kept frame maths (`connector_frame`) with its board's thickness. B's pad centres are placed into A's frame by the mate transform, with `k = (padOneTurns + orientation.quarterTurns) mod 4`. `padOneTurns` puts pad 1 on pad 1, so quarter turns 0 is the natural mating. With `flip`, B's frame is first turned 180° about its x axis.
  - An A pad maps to the B pad whose centre lies inside the A pad's landing window in A's xy plane: the A pad's rectangle, turned with its footprint, each half-side at least 0.1 mm. Mating series often pair long pads at different row spacings, so matching centres can sit apart along the pads but not across them. For a name held by several pads, the smallest gives the window. The closest B pad wins, and a B pad maps at most once.
  - Pads named more than once collapse to their centroid, as in the kept maths.
- **source `manual`.** `manualMap` replaces the geometry. Pairs naming pads the connectors lack are dropped and reported.
- **source `unresolved`.** There is no manual map and the geometry cannot decide: a side is not ready, a connector has no pads, or the frame inference has confidence `low`. `pairs` is empty.
- Lists are in natural order of the side's pad.
- **`pads`** (stage 3c), for the B2B tab's drawing: `{ a[], b[] }`, each pad `{ pad, xNm, yNm, angleDeg, longNm, shortNm }` in A's connector frame, looking down its mating axis. A's pads are in that frame; B's are carried into it by the same transform as the mapping. `angleDeg` is the pad's long axis from +x, in [0, 180). Every named pad appears, including pads sharing a number. Present whenever both frames can be inferred, whatever the source; absent otherwise. A protected mate (§6) loses it.

### 8.5 Harness wiring

`links[]`, one per harness link: `{ harness, link, wires[{a, b, rule, suggested}], unmappedA[], unmappedB[] }`. Side A's pins are its endpoint's sub-port pins in order, or else the connector's pins in natural order; side B's likewise.

1. **`explicit`:** each explicit wire of the link between a contact on each side, mapped through each end's `pinMap` (cavity to pad; identity when empty), takes its A pad. A pad any explicit wire of the harness reaches through a contact, whatever its other terminal (a splice, a loose end), is left out of every link's default wiring on that site (stage 4a: a pin routed through a splice or to a drain is wired once).
2. **`sub-port-order`:** when both sides name sub-ports of equal size, the remaining pins map in order.
3. **`net-name`:** otherwise, remaining pins pair by equal board net name (`net`). Several pins on one name pair in pad order; the extras are left unmapped and reported as `duplicate-net-extra`.
4. Pads in the link's `unmapped` are removed from the default wiring. Whatever is left is `unmappedA`/`unmappedB`; pin N is never matched to pin N by position alone.

A wire is `suggested: true` when either pin is power or ground: `power` is true, or the net name is a ground name (`GND`, `AGND`, `DGND`, `PGND`, `GNDA`, `GNDD`, `VSS`, or any of them with a suffix after `_`), unless its rule is `explicit`: a wire the user drew or confirmed is not a suggestion (stage 4b). It still counts for system nets.

**Shared pins.** A pad of one mating site that two links of the same harness wire is a proposed splice. `splices[]` lists `{ harness, end, pad, links[] }`, unless a confirmed splice already joins those wires.

### 8.6 Sub-port suggestions

`suggestions[]`, per ready connector, computed on read (ADR §2.3) and filtered against the document's dismissed suggestions and the sub-ports already accepted from the same key. Each is `{ occurrence, connector, key, name, source, pins[] }`, with pins in natural order and at least two of them:

| `source` | `key` | Pins |
|---|---|---|
| `bus-alias` | `bus:<alias>` | pins whose net's last path segment is a member of a KiCad bus alias |
| `sheet` | `sheet:<sheet path>` | pins whose nets all come from one hierarchical sheet, when the connector's pins span more than one sheet |
| `family` | `family:<prefix>` | pins whose net names share a prefix before the last `_` (or end in `_H`/`_L`, `+`/`-`, `P`/`N`), such as `CAN_H`/`CAN_L` or `I2C_SDA`/`I2C_SCL` |
| `power` | `power` | power and ground pins (§8.5's rule) |

Symbol units are not suggested yet: the bundle does not record which unit owns a pin.

### 8.7 Findings

`findings[]`, sorted by `code` then `subject`: `{ code, severity, subject, message, objects[], waived }`. `subject` is the stable key a waiver names. `objects` lists the document ids involved. `waived` is true when a waiver has this code and subject. The catalogue is §9.

### 8.8 `prism-kicad system build`

```text
prism-kicad system build --document <system.json>
            [--member <occurrence>=<bundle.prism> --member-revision-key <occurrence>=<hex>]...
            [--absent <occurrence>]... [--board-sub-ports <board-sub-ports.json>]
            [--entry <occurrence>=<system-entry.json> --entry-stage <occurrence>=<stage>]...
            -o <system-bundle.json> [COMMON]
```

- **`--member`** gives a board occurrence's stored design bundle. The revision key is its identity, as in `compare`, because a bundle may serve several keys. A board occurrence with neither `--member` nor `--absent` is `pending`.
- **Checks, in order:**
  1. The document validates against `prism.system.v2` (exit 3, `document-invalid`).
  2. Each member passes the reader checks (exit 3, `bundle-invalid`, with `argument` `member:<occurrence>`).
  3. Each `--member` names a board occurrence of the document (exit 7, `occurrence-mismatch`).
  4. All members share one generator id (exit 7, `generator-mismatch`).
  5. Each member's stage `parse` holds both members (exit 7, `member-not-found`).
  6. From 1c: `--board-sub-ports` validates against `prism.board_sub_ports.a0`, and each `--entry` against `prism.system_entry.a0` (exit 3, `input-invalid`; the message names `board-sub-ports` or `entry:<occurrence>`, because `CliArgument` has no value for them); each `--entry` names an entry occurrence of the document (exit 7, `occurrence-mismatch`). Without `--board-sub-ports`, every board-level reference is `board-sub-port-missing`.
- **Output.** `-o` receives the `SystemBundleA0`, written atomically, with stdout giving `CliSystemResultA0` (the bundle key and per-section counts). The same inputs give byte-identical output.
- **Exit codes:** 0, or 1–7 as in `cli-spec.md` §4.

### 8.9 Placement (stage 3a)

`placement` says where every occurrence sits in the system frame (+z up, nanometres; ADR §2.6) and what each mate means for that. It is computed with the connectivity, from the same inputs.

- **Board frame.** An occurrence's pose places its board frame: the frame its bundle's pad positions and outline are in, with z = 0 at the board's mid-plane. `bounds` is the board's outline box across its thickness in that frame (absent for a board that is not ready, a body or an entry).
- **Mated groups.** Occurrences joined by mates whose connector frames can be placed by (the same rule as §8.4 geometry: pads present, inference confidence not `low`) form groups. Each group's **root** is the occurrence with the most connections (mates and harness links) not held by a `positioningMate`, then the first by label (natural order) and id. Every other occurrence of the group is placed through one mate from the part already placed: its `positioningMate` when that names a usable mate of it, else the first by the far connector's reference (natural order), then mate id. That mate is `driving`.
- **The mate transform** places B relative to A as `F_a · O · T(0, 0, h) · Rx(180°) · Rz(k · 90°) · F_b'⁻¹`: `F_a`, `F_b` the connector frames, `k = (padOneTurns + quarterTurns) mod 4` as in §8.4, `F_b'` B's frame turned 180° about its x axis when `flip`, `O` the mate's `offset` (a pose in A's connector frame, so `zNm` is a spacer), and `h` the mate's `stackHeightNm` or, absent, the clearance fallback (the two connector bodies' boxes apart, plus 5 mm; `heightSource` says which).
- **Poses.** A root or an unmated occurrence keeps its stored `pose` (`source: stored`) or takes its slot in the **default row** (`source: default`): occurrences by label then id, side by side along +x with 20 mm between their bounds, a rule that does not move one occurrence when another is placed. A placed non-root has `source: mate` and `positioningMate`. A stored pose on a placed non-root is ignored and reported (`pose-ignored`).
- **Checks.** Every usable mate that does not drive is checked against the placed boards: B's connector frame against where the mate would put it. A miss of more than 0.2 mm across the mating plane, more than 0.2 mm along it (only when the mate states a stack height) or more than 0.5° is `mate-misaligned`, and the mate's `miss` (on A's connector axes) and `missDeg` say by how much. A `positioningMate` that cannot be used is `positioning-mate-ignored`.
- **Frames.** `frameA` and `frameB` are each side's connector frame in the system frame (B's unflipped), absent when a side cannot be placed by. The B2B tab (stage 3c) draws from them.
- **Exports** (stage 3d). `exports` lists every export whose connector has footprint geometry and a place, by export id: `mount`, the frame `geometry` is in, placed in the system frame with the connector's side of its board applied (a board's frame lifted by half its thickness to the connector's surface; a body connector's footprint frame); `geometry`, the connector's footprint geometry in that frame as the board interface's extractor v6 gives it (millimetres, +y up, without its 3D model); and `matesTop`, true for a body's connector, whose unsure mating-axis inference mates out of its top face. A system placing this one as an entry mates by them (§12.2). The export of a sub-port carries its whole connector.
- **Redaction** (§6): for an occurrence the reader cannot see, the placement keeps its pose but withholds `bounds` and `positioningMate`; a mate touching it keeps only `mate` and `driving`; an export on it is left out of `exports`.

### 8.10 Bodies and body connectors (stage 3d)

A body occurrence places a mechanical catalog part; body connectors (§2.7) place connector parts on its faces.

- **Input.** `--parts <system-parts.json>` (`prism.system_parts.a0`) lists every part the document references (each body occurrence's source, each body connector's `part`), keyed by the reference exactly as the document spells it: `componentId`, or `componentId@revisionId` (no revision: the latest released, which the backend resolves). Each part carries its resolved revision, name and MPN; its symbol library and footprint, staged beside the file (paths relative to it, never through `..`) with their SHA-256, which the build checks; and its converted model's box in the part's frame, alignment applied. A reference the catalog cannot resolve is left out.
- **A body reads as a board** whose components are its body connectors, so §8.2–§8.9 apply unchanged:
  - a body connector's pins are its part's symbol pins (number, name, electrical type), one per number; without a symbol, its footprint's pad numbers; with neither, none. A body has no board nets, so its signals are the names its exports give (mockup 05): a pin an export covers is on the board net named by that export's `pinNames[pad]`, so pins given one name are one signal; an exported pin without a name is on `Net-(<refdes>-Pad<pad>)`, KiCad's automatic form, which never names a system net when another name exists; a pin no export covers has no net (stage 3d-2);
  - its geometry is its part's footprint in the footprint's own frame (+y up, KiCad's y flipped), at zero thickness, so the B2B mapping (§8.4) and the drawn `pads` read it as a board's;
  - its footprint sits in the body at `Q = P · Rz(k · 90°) · F_part⁻¹`, with `P` its stored `frame`, `k` its `quarterTurns` and `F_part` the footprint's own mating frame (an unsure inference mates out of its top face). Placement (§8.9) composes `Q` where a board has the identity, so a board mated to a body connector, or a body mated to a board, is placed through it.
- **State.** A body is `ready` when its part resolved, `absent` (`occurrence-absent`) when it did not. Its `connectors` are its body connectors in natural reference order; `placement.angleDeg` is from the centre of its model's box to the connector's mount, `side` is `top`; it has no `outline`, `revisionKey` or `bundleKey`.
- **Placement.** A body's `bounds` is its model's box; a body without a model (`body-model-missing`) is placed as a point. Bodies are free occurrences: they keep a stored pose or take the default row.
- **Findings.** `body-model-missing` (warning, `occurrence:<id>`): the body's part has no converted 3D model. `connector-part-missing` (error, `connector:<occ>/<refdes>`): a body connector's part is not in the catalog. `connector-pins-unknown` (warning, same subject): its part has neither a symbol nor a footprint.
- **Key.** The system bundle key (§8.1) includes `parts`, the SHA-256 of `--parts`'s canonical form (null without it).

## 9. Findings catalogue (ADR open question 2)

Each code has a fixed severity:
- **error** blocks publishing an in-house entry, unless waived (a clean snapshot is one with no unwaived error);
- **warning** and **info** never block.

Waivers apply to warnings and errors. Stage 1c adds the codes of §10.5 and §12.2.

| Code | Severity | Subject | When |
|---|---|---|---|
| `occurrence-pending` | info | `occurrence:<id>` | the board's design bundle is not built yet; its connections are not checked |
| `occurrence-absent` | error | `occurrence:<id>` | the project is not present at the occurrence's commit |
| `occurrence-unsupported` | info | `occurrence:<id>` | no longer raised (bodies were, until stage 3d) |
| `connector-missing` | error | `connector:<occ>/<refdes>` | an endpoint, site or sub-port names a reference the board does not have |
| `not-a-connector` | warning | `connector:<occ>/<refdes>` | the named component is not detected as a connector |
| `pin-missing` | error | `pin:<occ>/<refdes>/<pad>` | a sub-port, pin map, manual map or explicit wire names a pad the connector lacks |
| `mate-manual-override` | warning | `mate:<id>` | the mapping is the manual override, not geometry |
| `mate-unresolved` | error | `mate:<id>` | no mapping: the geometry cannot decide and there is no manual map |
| `mate-pins-unmapped` | warning | `mate:<id>` | pins of either connector have no partner |
| `link-pins-unmapped` | warning | `link:<id>` | the link leaves pins unmapped (an incomplete mapping is a warning, ADR §2.4) |
| `duplicate-net-extra` | warning | `link:<id>` | more pins on one net on one side than the other; splices are offered |
| `power-join-suggested` | info | `link:<id>` | the link joins power or ground pins, shown as suggested until confirmed |
| `splice-proposed` | warning | `splice:<harness>/<end>/<pad>` | a pin is wired to two destinations with no confirmed splice |
| `harness-end-unattached` | info | `end:<id>` | an end has no site yet |
| `net-name-conflict` | warning | `net:<id>` | one system net carries board nets with different names, compared by leaf name after the sheet path with `.` read as `_` (automatic names aside); not raised when `power-net-conflict` is |
| `power-net-conflict` | warning | `net:<id>` | one system net joins power nets of different names (a board may name the same rail differently, so it does not block) |
| `mate-misaligned` | warning | `mate:<id>` | a mate that does not position a board misses where the placed boards put it (§8.9) |
| `pose-ignored` | info | `occurrence:<id>` | an occurrence placed by a mate also stores a pose, which is ignored (§2.1) |
| `positioning-mate-ignored` | warning | `occurrence:<id>` | its `positioningMate` names no mate that can place it, or would place its group's root (§8.9) |
| `body-model-missing` | warning | `occurrence:<id>` | a body's part has no converted 3D model; it is placed as a point (§8.10) |
| `connector-part-missing` | error | `connector:<occ>/<refdes>` | a body connector's part is not in the catalog (§8.10) |
| `connector-pins-unknown` | warning | `connector:<occ>/<refdes>` | a body connector's part has neither a symbol nor a footprint (§8.10) |


## 10. Board-level sub-ports (1c)

A board-level sub-port is a board's published pin group: a named, ordered set of one connector's pads, stored against the project and connector and shared by every system that places the board (ADR §2.3). It lives outside every system document, in the workspace.

### 10.1 The record

```
BoardSubPort { id, projectId, connector, name, pins[], version,
               createdBy, createdAt, updatedBy, updatedAt, deletedAt?, deletedBy? }
```

The HTTP API returns this record in camelCase, times as RFC 3339 UTC. It is not a schema'd contract, because contracts carry no wall-clock time; the build input of §10.5 is.

- `id` matches the document id pattern (§1) and is chosen by the caller (`bsp_<10 random base32>` from the UI). It is unique across the workspace and never reused, even after a delete.
- `connector` is a reference designator and never changes; regrouping another connector's pins is a new sub-port.
- `pins` are pad numbers in the user's order, unique, at least one. Whether they exist on the board is not checked on write, because the board changes underneath: a revision that drops a pin gives `pin-missing` in every system that uses it (§9).
- `name` is 1–64 characters, unique among the live sub-ports of one project and connector.
- `version` starts at 1 and bumps on every change, including the delete.
- **A delete is soft:** the row stays, with `deletedAt`, so a system using it can say what was deleted (`board-sub-port-deleted`, §10.5). A deleted sub-port cannot be edited or restored; create a new one.

### 10.2 Permissions

- **Read** a project's sub-ports: `read` on the project (`app.api._helpers.authorized_project`).
- **Create, change, delete or promote into:** `design` on the project, which with folder visibility is what "project editor" means in Prism today. A system author without it keeps the group at occurrence level.
- A system whose reader cannot see an occurrence's project redacts that occurrence's endpoints as today (§6), board-level ones included.

### 10.3 Storage

Workspace migration 127:

| Table | Holds |
|---|---|
| `ws_board_sub_ports` | `sub_port_id` (primary key), `project_id`, `connector`, `name`, `pins` (jsonb), `version`, `created_by`, `created_at`, `updated_by`, `updated_at`, `deleted_at`, `deleted_by`; indexed on `(project_id, connector)` |
| `ws_board_sub_port_history` | `sub_port_id`, `version`, `action` (`create`, `update`, `delete`), `name`, `pins`, `actor`, `created_at`; primary key `(sub_port_id, version)` |

- Name uniqueness among live rows is a partial unique index on `(project_id, connector, name) WHERE deleted_at IS NULL`.
- Every change writes the row and its history entry in one transaction. History is kept for as long as the row.
- Removing a project from the workspace soft-deletes its sub-ports.

### 10.4 HTTP API

| Route | Does |
|---|---|
| `GET /api/projects/{projectId}/sub-ports` | the live sub-ports, by connector then name; `?connector=` filters, `?deleted=true` adds the deleted ones |
| `GET /api/projects/{projectId}/sub-ports/{id}` | one record, deleted or not, with `ETag: "board-sub-port:<id>:<version>"` |
| `POST /api/projects/{projectId}/sub-ports` | create `{ id, connector, name, pins }`; `201` with the record and its ETag |
| `PUT /api/projects/{projectId}/sub-ports/{id}` | change `{ name, pins }` under `If-Match` |
| `DELETE /api/projects/{projectId}/sub-ports/{id}` | soft delete under `If-Match` |
| `GET /api/projects/{projectId}/sub-ports/{id}/history` | every version, newest first |

- `If-Match` follows §3.1: missing is `428`, another version `412 stale_version`.
- Refusals: `409 board_sub_port_exists` (the id was ever used), `409 board_sub_port_name_taken`, `409 board_sub_port_deleted` (change or delete of a deleted one), `422 board_sub_port_invalid` (id pattern, empty or repeated pins, name length, limits), `404` (unknown id, another project's id, or a project the caller cannot see).
- Limits, as settings: 1,024 pins per sub-port and 2,000 live sub-ports per project.

### 10.5 Use in a system

- **Reference.** An endpoint names one as `subPort: { kind: "board", id, version }`. `version` is the definition the user last saw, not a pin: the system always uses the live definition (ADR §2.3, maintainer decision 2026-10-20). Document validation stays local (§3.2): the server does not look the id up when an op is applied.
- **Promotion.** `promote-sub-port { subPort, boardSubPort }` turns the occurrence-level sub-port `subPort` into a new board-level one with the id `boardSubPort`, the same connector, name and pins, at version 1. In the same transaction it sets `promotedTo` on the occurrence-level sub-port and repoints every endpoint that named it to `{ kind: "board", id: boardSubPort, version: 1 }`. It needs `design` on the occurrence's project, or it is refused `403 board_sub_port_forbidden`; a taken name is `409 board_sub_port_name_taken`. Undoing it restores the document; the board-level sub-port stays, because other systems may already use it.
- **Acknowledgement.** `acknowledge-sub-port { subPort, version }` sets `version` on every endpoint of the document that names the board-level sub-port `subPort`. It is how the user accepts a change.
- **Build input.** The system bundle reads the board-level sub-ports its document names, deleted ones included, as one `prism.board_sub_ports.a0` file (`native/src/tsp/prism/board-sub-ports-a0.tsp`) passed to `prism-kicad system build --board-sub-ports <file>`: `{ schema, subPorts: [{ id, projectId, connector, name, pins, version, deleted, previous }] }`, sorted by id. `previous` holds `{ version, pins }` for each earlier version an endpoint of the document names, read from the history, so a change of pins can be told from a rename. §8.1's key gains `boardSubPorts: { id: version }`, always present, so editing a board-level sub-port rebuilds every system that uses it.
- **Snapshots and published entries** copy the definitions they use at their version into the snapshot row (`ws_system_snapshots.board_sub_ports`, jsonb, the same `prism.board_sub_ports.a0` document). A snapshot's bundle is built from that copy, so a later edit never moves a release.

| Code | Severity | Subject | When |
|---|---|---|---|
| `board-sub-port-missing` | error | `sub-port:<id>` | no board-level sub-port has that id, or it belongs to another project or connector than the endpoint's; the endpoint has no pins |
| `board-sub-port-deleted` | error | `sub-port:<id>` | it was deleted; the endpoint has no pins, so its links break (shown red) |
| `board-sub-port-changed` | warning | `sub-port:<id>` | the live version is newer than an endpoint's `version` and its pins or their order differ; the message lists the pins added, removed and moved. A rename alone is not a finding |

## 11. Publishing (1c)

Publishing a system makes a catalog entry of kind `system` whose interface is the system's exports (ADR §2.1). It is **in-house** (an IPN) or, from stage 3d, **bought-out** (a manufacturer and MPN, and a body with its STEP model). Publishing goes through the catalog's ordinary workflow (maintainer decision 2026-10-20).

### 11.1 What a published revision holds

- **The catalog component** has `kind: "system"` (catalog migration 14 widens `components_kind_check` to `part` and `system`). A bought-out entry has the catalog's ordinary `mpn` identity (manufacturer and MPN, normalized and unique as a part's). An in-house entry has an IPN identity: a new identity kind `ipn` with scope `system`, allowed only on `system` components. It is not the parts' `provisional_ipn`, which stands in until an MPN exists and blocks release; an in-house entry's IPN is final. One system publishes into one component: the first publish creates it with the IPN given, later publishes add revisions to it. `ws_systems.catalog_component_id` records the link.
- **The frozen payload** is one required revision asset of type `system_entry`: the canonical JSON file `prism.system_entry.a0` (`native/src/tsp/prism/system-entry-a0.tsp`). Its SHA-256 joins the revision manifest like every asset, so the audit chain covers it.

```
SystemEntryA0 { schema: "prism.system_entry.a0",
                source: { systemId, version, snapshotId, systemBundleKey },
                document,        prism.system.v2 at that version
                boardSubPorts,   prism.board_sub_ports.a0, the definitions it names
                bundle,          prism.system_bundle.a0, built from exactly those
                parts?,          prism.system_parts.a0, the catalog parts it was built from (stage 3d)
                interface }

interface { exports: [ { id, name, occurrence, connector, subPort?,
                         pins: [ { pad, name, net, signal? } ] } ] }
```

- `interface.exports` lists the document's exports in id order. Each `pins` entry is one pad of the export's site in the site's pin order (a sub-port's order, else natural): `name` is the export's `pinNames[pad]`, else the board's pin name, else the pad; `net` is the system net id it is on and `signal` that net's name.
- A copy of `interface` is the revision's `interface_json`, so Library Manager lists and searches entries without opening the payload.
- **Boards are frozen by recording, not rewriting.** Every board occurrence's `commit` is already exact in the document, and the bundle records each one's revision and bundle key. A followed board stays followed in the live system; the entry is pinned because the payload never changes.

### 11.2 Publishing

`POST /api/systems/{id}/publish { snapshotId?, identity?, ipn?, manufacturer?, mpn?, changeSummary }`, under `If-Match` on the system. `identity` is `in-house` or `bought-out`; absent, it is the published component's, else `in-house`.

1. **Permissions:** `design` on the system and `catalog_write`. The publisher must see every board occurrence (else `403 system_redacted`).
2. **The snapshot:** `snapshotId` names an existing snapshot of this system; without it, publishing takes one at the current version named `Published <IPN>`, but only after the IPN rule of step 4 and the checks of step 3 pass against the live system and its live board-level sub-ports, so a refused publish (which the UI retries while the bundle builds) leaves no snapshot. If the version or the sub-port definitions moved in between, the answer is `412`.
3. **Checks, in order, each a `409` listing what failed:** at least one export (`system_no_exports`); every board occurrence `ready` in the snapshot's system bundle and the bundle built (`system_bundle_not_ready`; the UI waits and retries); no unwaived error finding (`system_not_clean`, listing the findings); every entry occurrence on a `released` revision (`system_entry_unreleased`); for a bought-out entry, at least one body occurrence `ready` in the bundle with its part's model (no `body-model-missing` on it) (`system_body_required`).
4. **The revision:** the payload is written as the `system_entry` asset of a new revision in stage `qa_review`, with the parts input of the bundle's build as its `parts` (§8.10; `parts: []` for a system without bodies). The first in-house publish also needs `ipn` (`422 system_ipn_required`), the first bought-out one `manufacturer` and `mpn` (`422 system_mpn_required`), validated by the catalog's identity rules; another component holding that identity is `409 system_ipn_mismatch` or `409 system_mpn_mismatch`. A later publish keeps the component's identity: another `identity` is `409 system_identity_mismatch`, another number `409 system_ipn_mismatch` or `system_mpn_mismatch`. These rules are checked before the snapshot of step 2 is taken.
5. **The record:** `ws_system_publications` (`system_id`, `version`, `snapshot_id`, `component_id`, `revision_id`, `published_by`, `published_at`) gets a row. The catalog and the workspace are separate databases: the catalog revision is written first, and its `source_ref_json` holds `{ systemId, snapshotId }`, so a retry after a failed workspace write finds the revision instead of making a second one.

The answer is `{ componentId, revisionId, stage }`.

### 11.3 Release

A `system` revision follows the workflow of `catalog/workflow_policy.py` and the gates of `release_workflow.py`, with two-person approval, plus one gate of its own, checked fail-closed: the `system_entry` asset is present, its SHA-256 matches the manifest, and its bundle has no unwaived error finding. A bought-out revision (an `mpn` identity) also needs a body occurrence `ready` in that bundle whose part in `parts` has a model. KLC and representation gates do not apply to `system` revisions.

### 11.4 The publication read (stage 3d)

`GET /api/systems/{id}/publication`, with read access to the system, answers `{ componentId, identity, ipn?, manufacturer?, mpn?, publications }`: the system's catalog component (null before its first publish), its identity (`in-house` with its `ipn`, or `bought-out` with its `manufacturer` and `mpn`; null before the first publish) and every publication newest first, `{ version, snapshotId, revisionId, stage, publishedBy, publishedAt }`, `stage` the revision's workflow stage now. The Publish dialog reads it (§15.4).

## 12. Placing published entries (1c)

### 12.1 The occurrence

- `source: { kind: "entry", componentId, revisionId }`. `revisionId` is required: following new revisions of an entry comes later (ADR §2.8).
- **Who may place what:** adding or changing an occurrence to an entry is checked against the catalog when the op is applied, the one exception to document-local validation. The revision must be of a `system` component and `released`, unless the caller has `design` on the system it was published from (its author testing it). Otherwise `409 system_entry_unreleased`, or `404` for an unknown or invisible revision.
- **Symbol and endpoints.** The symbol's pins are the entry's exports. An endpoint on an entry names an export id as `connector`, and pins are the export's pads, so a `pinMap`, explicit wire or occurrence-level sub-port on it uses those pads. Board-level sub-ports do not apply to entries.

### 12.2 In the system bundle

- **Input.** `prism-kicad system build` takes `--entry <occurrence>=<system-entry.json>` and `--entry-stage <occurrence>=<stage>` per entry occurrence: the payload, and the catalog revision's workflow stage now (`released`, `archived`, …), which can change without the payload. §8.1's key gains `entries: { occurrence: { payload: payloadSha256, stage } }`, always present, where `payloadSha256` is the SHA-256 of the payload's canonical JSON (§8.1's form), not of the file's bytes.
- **Occurrence state.** An entry is `ready` when its payload was given, with `bundleKey` its payload's `source.systemBundleKey` and no `revisionKey`. It is `unsupported` no longer. A missing payload (a revision since deleted from the catalog) is `absent`, with `occurrence-absent`.
- **Connectors.** A ready entry's `connectors` are its exports: `refdes` is the export id, `value` the export name, and each pin is `{ pad, net: signal, nets: [signal], pinName: name, power }`, with `power` from the child bundle's pin.
- **Nets through an entry.** Two pins of an entry are joined when the child bundle puts them on the same system net, as two pins of a board are joined by a board net (§8.3). The child net's name is the entry pin's board net, so names and conflicts work as for boards.
- **Mates with an entry** (stage 3d). An entry reads like a body: each export is a connector with the child bundle's `placement.exports` geometry, at its `mount` in the entry's frame (the child's system frame) and zero thickness, `matesTop` as given. So a mate with an entry maps by geometry (§8.4) and places the entry, contents and all, as one rigid group (§8.9). The entry's `bounds` are the box around its contents' placed boxes. An entry published before format 4 carries no export geometry: a mate with it needs `manualMap`, or it is `mate-unresolved`.

| Code | Severity | Subject | When |
|---|---|---|---|
| `entry-unreleased` | error | `occurrence:<id>` | the revision is not `released` (an author testing it): publishing this system is refused until it is |
| `entry-archived` | warning | `occurrence:<id>` | the revision was archived after it was placed |
| `export-missing` | error | `connector:<occ>/<export id>` | an endpoint names an export the entry does not have |

### 12.3 Reading an entry's insides

`GET /api/catalog/system-entries/{revisionId}` returns the payload read-only, with `catalog_read`. Its `document` and `bundle` are redacted by §6 for each board occurrence of the child whose project the caller cannot see; `interface` is never redacted. When the caller has `design` on the source system, the answer also carries its `systemId`, so the UI can open it for editing.

## 13. Git link (1c)

A system can be linked to a file on a branch of a repository Prism already manages. Prism commits the document there on request; it never pulls on its own (maintainer decision 2026-10-20).

### 13.1 The link

`ws_system_git_links`: `system_id` (primary key), `project_id` (the project whose repository it is), `branch`, `path`, `last_commit` (the commit Prism made last), `last_blob` (that commit's blob of `path`), `last_version`, `linked_by`, `linked_at`.

- `path` defaults to `systems/<slug>.system.json`, `slug` from the system name in lower-case kebab-case. It is repository-relative, must end in `.system.json`, and may not leave the repository or enter `.git`.
- **Permissions:** linking, committing and importing need `design` on the system and on the project.
- `PUT /api/systems/{id}/git { projectId, branch, path? }` links or relinks; `DELETE …/git` unlinks. Relinking clears `last_commit` and `last_blob`.

### 13.2 Commit

`POST /api/systems/{id}/git/commit { message }`, under `If-Match` on the system, queues a job like Release Studio's configuration publish (`release_studio_config_service.py`): a temporary clone of the branch, the commit, a push leased against the fetched head, then a fast-forward of Prism's mirror.

- **The file** is the document at the `If-Match` version, as JSON with two-space indents, keys in code point order and one trailing LF, so a Git diff is stable (§1).
- **The author** is the caller (name and email from their account); the committer is Prism.
- **Diverged:** if the file at the fetched head is not `last_blob` (or exists when `last_blob` is empty), the job fails `system_git_diverged` with that blob, and nothing is pushed. The user imports it (§13.3) or commits after resolving it in Git.
- An unchanged file is not committed; the job answers `unchanged`.
- **Taking a snapshot** of a linked system queues the same commit with the message `Snapshot: <name>`. Its failure is reported on the snapshot and never undoes it.
- On success the link's `last_commit`, `last_blob` and `last_version` are updated.

### 13.3 Import

`POST /api/systems/{id}/git/import`, under `If-Match`, reads `path` at the branch head and replaces the document with it as one request: the op `import-document { document }`, which only this route issues (`/ops` refuses it). The file must be a valid `prism.system.v2` and pass integrity like any request; its ids join `seen_ids`. The inverse is the previous document, so an import is undoable. The link's `last_blob` becomes the imported blob, so the next commit is allowed.

### 13.4 What Git holds

Only the document. Board-level sub-ports stay in Prism; an imported document whose endpoints name unknown ones gets `board-sub-port-missing` findings, not a refusal.

## 14. The schematic (stage 2)

The schematic follows Eeschema: hierarchical sheets, sheet pins, wires, buses, bus entries and bus groups, with KiCad's default colours on light paper. What differs is that a board's sheet and pins are generated from its bundle. Behaviour is specified here from KiCad's documented and observed behaviour; no KiCad source is used (it is GPL, Prism is Apache-2.0). Where this section is silent, KiCad's behaviour is the reference, and a deliberate difference is listed in §14.5.

### 14.1 What each sheet shows

- **The root sheet and user sheets** hold occurrences as sheet symbols, harness blocks, and connections. A board, body or entry occurrence is a sheet symbol whose pins are its connectors, one pin per connector, each carrying a bus of the connector's pins. Sub-ports never appear as pins outside the board's own sheet.
- **A connection** is drawn between two connector pins: a mate as a bus with the mate mark; a harness as a bus in the harness colour from each end's site to its harness block, so a harness link always passes through its block. On the block, each end is one pin; the block shows a one-line summary per end.
- **A board's sheet** (entered by double-click) is generated and read-only except for grouping and layout: one board symbol whose pins are its connectors, each pin's bus running to a hierarchical label named after the connector. Unfolding a connector breaks its bus out into one wire per pin, labelled with the pin's board net. Folding it back shows its groups in the label, in KiCad's bus-group form: `J2201{FAN{TACH PWM} 1 2 MP}`, ungrouped pads as plain members (after eight, the rest as `+N`), a pad in two groups in both. Without groups the label is the reference and pin count, `J202{121}`. A group's members are named from its pins' nets (the part that differs, as G proposes them), falling back to pad numbers.
- **A body's sheet** is the same with the body's connector parts (§2.7); its pins have no board nets, so their names come from the export's `pinNames`.
- Unfolded or folded is per user and per system, kept with the open tabs, not in the document.

### 14.2 Defaults for absent layout

- **Grid.** Everything snaps to 1.27 mm (50 mil); pins and pin offsets to 2.54 mm (100 mil).
- **Sheet size.** A board's sheet takes its `outline` aspect, the longer side 50.8 mm, then grows until every edge fits its pins at 5.08 mm spacing with 10.16 mm clear of each corner. Without an outline it is square. A harness block is 30.48 × 20.32 mm, its pins 5.08 mm clear of each corner, and grows the same way.
- **Symbol position.** An occurrence without a layout entry is placed in a row to the right of the placed ones, 25.4 mm apart, top-aligned with them. A harness block without one sits 25.4 mm out from its sites' pins along their normals (their mean when it has several ends); when that spot overlaps a symbol (sites on facing edges put it inside the board), it takes the clear spot nearest its pins among further out from each pin and just above or below the boards its sites are on. Each end's pin is placed by the angle from the block's centre to its site's pin, by the pin rule below. The "Add board" gesture stores a position in the same request, so these defaults matter mostly to scripts.
- **Pin placement.** A connector's pin starts where the ray from the sheet's centre at its `placement.angleDeg` leaves the rectangle (y flipped for the screen). Pins on one edge keep their angular order and are spread to the 5.08 mm spacing, first forward and then back from the far corner, so none is pushed off the edge. A connector without `placement` (an entry's export, a body without frames yet) is spread evenly along the left edge in natural reference order. `side: bottom` shows a `B` beside the pin.
- **Inside a board's sheet** the board symbol sits at the origin, sized like the sheet, its pins placed by the same rule, and each connector's hierarchical label sits 15.24 mm out from its pin. An unfolded connector's bus runs out past the longest folded label on its edge, its spine runs along the edge (down beside a left or right edge, rightwards beside a top or bottom one), one wire per pad leaves it through a 45° bus entry at 2.54 mm pitch, 12.7 mm long, ending in the pad's net name, and the connector's label moves to the spine's end. A stored label position applies while folded.
- **Route.** An absent `route` is drawn orthogonally: out from each pin along its edge's normal by 5.08 mm, then at most two bends, avoiding sheet symbols; when every such path crosses one, it detours round the symbols in the way. It is redrawn whenever either end moves, until the user edits it, which stores `route`.

### 14.3 Gestures

| Gesture | Does | Ops |
|---|---|---|
| Right or middle drag (Alt + drag on a trackpad); scroll; pinch or Ctrl/⌘ + scroll | pan; pan; zoom at the cursor | — |
| Double-click a sheet symbol | enter its sheet | — |
| Alt/Option+Backspace | leave to the parent sheet | — |
| Drag left → right | select what lies wholly inside (window) | — |
| Drag right → left | select what the rectangle touches (crossing) | — |
| Double-click a connector's bus | unfold or fold it | — |
| G with pins or wires selected (inside a board's sheet) | group them as a sub-port: name from the nets' common part (a shared trailing part such as `_3V3` is dropped from the members), members from what differs, editable; "Group and fold" folds the bus afterwards; pads in natural order | `add-sub-port` |
| Double-click a bus or its label (inside a board's sheet) | unfold or fold it | — |
| Drag the board symbol, a pin or a label (inside a board's sheet) | move it | `set-layout` (`interior`) |
| Accept / accept all on a suggestion | turn a bundle suggestion into a sub-port | `add-sub-port` (with `suggestion`) |
| H from a connector pin, or the Harness tool | draw a harness link; the block is the connector's existing one or a new one | `connect-harness` |
| Mate tool from a connector pin | draw a B2B mate (whole connectors only) | `add-mate` |
| Drag a sheet pin | slide it along the edge; past a corner it moves onto the next edge | `set-layout` |
| Drag a sheet's handle | resize it | `set-layout` |
| M, or drag a symbol | move it; connected routes follow (KiCad's G drag), there is no move that breaks connections | `set-layout` |
| Drag a route segment | edit the route; the result is stored | `set-layout` |
| Add board | place an occurrence; when the system already has an occurrence of the same project, its sub-ports are copied to the new one (new ids, a copy, not a link) | `add-occurrence` + `add-sub-port`… in one request |
| Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z | undo, redo (§3.3) | `undo` |

A gesture is one request: it is one undo step, and a refusal leaves the drawing as it was.

### 14.4 Edge cases (from Eeschema's behaviour)

- **Sheet pins stay on the border.** A pin dragged inside the sheet snaps to the nearest edge; it never sits in a corner (the 10.16 mm clearance). Two pins may not occupy the same spot: a drop onto another pin's spot is refused.
- **A sheet cannot be resized smaller than its pins.** The resize stops where the furthest pin on an edge would leave it; pins on the moving edge move with it.
- **Sheets do not rotate or mirror.** As in KiCad, only their pins move between edges. `rotationDeg` and `mirror` stay 0 for sheet symbols; the generated board symbol inside a sheet may rotate.
- **A wire never joins a bus directly.** A bus becomes wires only through bus entries, as when unfolding. Connections between connector pins are buses end to end.
- **Connection points are pin ends and route ends only.** A route ending on another route's segment does not connect (no junctions between connections: two connections never share a node outside a harness, where splices do that).
- **Dangling ends** are drawn with KiCad's open-end marker: a connection whose pin no longer exists (the bundle lost the connector) and a route end not on a pin.
- **Collinear segments merge** and zero-length segments drop when a route is stored, so a stored route is minimal.
- **Off-grid input snaps** on the way in; a stored point off the 1.27 mm grid (an imported document) is drawn where it is and snapped on its next edit.
- **Labels never edit a board.** A name shown inside a board's sheet comes from the bundle; renaming is only for sub-ports and for a mate row's `netLabel` (§2.4).
- **A redacted occurrence** (§6) is a sheet symbol with its label and no pins; it cannot be entered.

### 14.5 Deliberate differences from KiCad

- G groups (KiCad: drag). Moving always drags connections, so KiCad's G is not needed.
- H draws a harness link (KiCad: hierarchical label). Hierarchical labels inside a board's sheet are generated.
- Sheets are per occurrence: two occurrences of one board each have their own sheet, not shared contents.
- No free wires, labels, power symbols or junctions on root and user sheets in stage 2: every drawn line is a mate or a harness link.

### 14.6 The script API, `window.prismSystemBuilder`

Every write builds one `prism.system.ops.a0` request (§3), so a script and the UI cannot diverge. Selection is by meaning, never by rectangle.

| Call | Does |
|---|---|
| `system()` | `{ systemId, version, document }` as read |
| `bundle()` | the system bundle the view draws from |
| `describeSheet(sheet?)` | the sheet's symbols, pins with resolved positions and edges, connections and their routes; inside a board's sheet, connectors with pins, nets and sub-ports |
| `createSubPort({ occurrence, connector, pads? \| nets? \| netPattern?, name, id? })` | resolves nets or a regular expression over pin nets to pads through the bundle; refused when nothing matches |
| `acceptSuggestions({ occurrence, connector?, keys? \| "all" })` | accepts bundle suggestions as sub-ports |
| `movePort({ item, key, edge, offsetNm })`, `resizeSheet({ item, widthNm, heightNm })`, `place({ item, xNm, yNm, sheet? })` | layout, with §14.4's rules |
| `connect({ a, b, kind: "mate" \| "harness", harness? })` | `add-mate` or `connect-harness` |
| `describePlacement()` | every occurrence's place (§8.9) in millimetres and degrees (turns about x, then y, then z), with its source, root flag, positioning mate and whether it can be moved; and the placed mates |
| `setPose({ occurrence, translationMm, rotationDeg? })`, `resetPose(occurrence)` | a free board's or group root's stored pose as `replace-occurrence`; refused for a board its mate places; reset drops the pose (default row) |
| `setPositioningMate({ occurrence, mate })` | `replace-occurrence` with the mate, refused unless the mate has an end on the occurrence; `null` is automatic |
| `describeMate(mate)`, `setMate(…)`, `nameMateRow(…)`, `setManualMap(…)`, `openMate(mate)` | the B2B tab's data and edits (§15.2) |
| `apply(ops)` | any request, as is |
| `undo()` | §3.3 |
| `open(sheet)`, `select(ids)`, `unfold({ occurrence, connector })` | view only |

Writes take the version the script last read and fail with `412` like the UI's; `system()` re-reads. Every write returns a promise of `{ version }` and rejects with an `Error` whose `status` is the HTTP status when the server refused (412 when stale); a selector that matches nothing rejects before anything is sent. `describeSheet()` returns the root sheet's symbols (rectangle, pins with edge, offset and position) and connections (route, stored or auto); `describeSheet(occurrence)` returns a board's connectors with their pins (pad, nets, power), sub-ports with member names, open suggestions and whether each is unfolded.

## 15. The 3D and B2B tabs (stages 3b–3d)

### 15.1 The 3D tab

The 3D tab draws the system bundle's placement (§8.9) in `<prism-semantic-viewer mode="system">`, each board from its analytic design bundle (the project's `webgpu-3d/status` at the occurrence's commit).

- **Scene.** The host builds a `prism.system_scene.a0` descriptor: per occurrence its world matrix (mm, +z up), bounds, whether it can be moved (a root or free board) and its explode axis; one viewer asset per occurrence, so two occurrences of one board are drawn separately. A board without a ready 3D bundle, or that the reader cannot see, draws as its bounds box. A board's bundle frame is mapped into its board frame by scaling metres to millimetres and centring on the board's mid-plane (the analytic board's z range), matching the bounds of §8.9.
- **Selection** is shared with the other pane: picking a board or anything on it selects the occurrence; the other pane's single occurrence selection is shown here.
- **Move (M).** Only a group's root or a free board takes the gizmo; a mated board follows its mate, and its card offers the positioning mate instead. Arrows move along an axis, rings turn about it, snapping to the card's steps (default 0.5 mm and 15°; Shift for a tenth of the step and 1°), in the world or the board's own axes. Typed values preview; releasing a drag, Enter or Place stores the pose as `replace-occurrence`; Esc drops the preview; Reset to default drops the stored pose. A refused save puts the board back.
- **Explode**, view only, never stored: *assembly explode* slides each mated board away from its parent along the parent connector's axis (frame +z), 30 mm per level at full; *stackup separation* splits each board's layers, on every board or only the selected one.

### 15.2 The B2B tab

One tab per opened mate (`?b2b=<ids>`, `tab=b2b:<id>`), opened from the mate's selection panel on the schematic, the placed board's card in 3D, or `openMate`; it opens beside the 3D tab and closes on its own.

- **Pads.** The bundle's `pads` (§8.4): A's pads as rectangles, B's as rings where the mated pose puts them, looking down A's mating axis. A click on a pad selects its row.
- **Orientation, stack and spacer** are the mate's stored choices, each a `replace-mate`: quarter turns (0°, 90°, 180°, 270°), flip, the stated stack height (empty: from clearance) and a spacer, the offset along the mating axis after the mate transform. Changing any of them rebuilds the bundle, so the mapping and the 3D pose follow. The bar shows how many pads land: pairs over the larger of the two connectors' pad counts.
- **Mapping rows** are derived, one per pair and one per pad without a partner, with both boards' nets. A row's notes come from the findings on the system net it joins (`net-name-conflict`: names differ; `power-net-conflict`: power nets differ) and from the mapping (no partner). Filters: all, with findings, power, and a search over pads and names.
- **System name.** A row's only user field is `rows[aPad].netLabel`, set or cleared with `replace-mate`; it never edits a board.
- **Manual map.** The fallback when geometry cannot decide: pairs typed one per line (A pad, then B pad) replace the derived mapping as `manualMap`, flagged by `mate-manual-override`; going back to geometry drops it.
- **Beside 3D.** Selecting a row lights its net on both boards in the 3D tab and frames the two connectors.

Script API additions: `describeMate(mate)` returns the tab's data (sides, source, orientation, stack height and its source, spacer, pads landed, rows); `setMate({ mate, quarterTurns?, flip?, stackHeightMm?, spacerMm? })` is one `replace-mate`; `nameMateRow({ mate, pad, name })`; `setManualMap({ mate, pairs })` (null: geometry); `openMate(mate)` is view only.

### 15.3 Entries and board-less systems in 3D (stage 3d)

- **A placed entry** is drawn as its contents, one rigid group: the payload's (`GET /api/catalog/system-entries/{revisionId}`, §12.3) board occurrences, each from its analytic design bundle at its pinned commit, and its bodies with their models from the payload's `parts`, each at its pose in the child's `placement`, composed with the entry's pose. Picking any of them selects the entry; only the entry moves. A board the reader cannot see is withheld by the payload's redaction and drawn as nothing; an entry without a payload, or before it loads, is its bounds box.
- **Place published system.** The 3D tab's toolbar and the schematic's add menu search the catalog's `system` components and place a revision as an entry occurrence (`add-occurrence`, §12.1); only released revisions are offered, plus any revision of a system the caller has `design` on.
- **New module.** Library Manager's add menu has **+ New Module**: it creates a system named by the user and opens its 3D tab, where **Add body** places the module's body. A board-less system with a body is offered as bought-out when published (stage 3d-3).

### 15.4 Exports, pin names and publishing (stage 3d-3, mockup 05)

- **Body sheets.** A body occurrence's sheet opens like a board's (§14.3): its connector parts with their pins, unfolding and `G` grouping. The wires carry the body's signals (§8.10).
- **Exports** are made where the connector is: each connector and each sub-port in a board or body sheet's side list has an **Export** toggle. Turning it on adds an export named after the connector's refdes, or the sub-port's name (`add-export`); the name is edited in place (`replace-export`); turning it off removes it (`remove-export`). On the root sheet an exported connector's port carries a hierarchical label with the export's name, marked *exported*; an export of a sub-port lists it under that label as `NAME{members}`.
- **Pins of an export.** Opening an export shows its pins in the site's pin order: pad, name, signal (the system net's name) and type (power or signal). The name column is the export's `pinNames[pad]`; empty shows the board's pin name (§11.1). On a body the name is the signal (§8.10).
- **Header.** **Snapshot** takes a named snapshot (`POST …/snapshots`). **Commit to Git** commits the document to the system's Git link (§13.2), offering to link it first (§13.1); a diverged file offers the import (§13.3). **Publish…** opens the Publish dialog.
- **Publish dialog.** The identity pills: *Bought-out · MPN* and *In-house · IPN*. Before the first publish, bought-out is preselected for a system with a body and no boards (a module), in-house otherwise; afterwards the published identity is fixed and its numbers are shown read-only (§11.4). It lists the STEP row (bought-out: the body whose model the entry carries, or what is missing), the interface (each export and its pins' names, sub-ports as `NAME{members}`) and the checks (§11.2 step 3, from the live bundle: exports, bundle ready, unwaived errors, entries released, and for bought-out a body with its model). **Publish to QA review** publishes; while the bundle is building the answer `system_bundle_not_ready` is retried until it is ready, and a refusal names what failed. The result names the new revision and its stage and links to it in Library Manager.

Script API additions: `setExport({ occurrence, connector, subPort?, name? })` adds or renames an export, `removeExport(id)`, `namePin({ export, pad, name })` sets one of its `pinNames` (empty clears it), and `publish({ identity?, ipn?, manufacturer?, mpn?, changeSummary })`.

## 16. Harnesses (stage 4)

Stage 4 builds the harness on the §2.5 document and the §8.5 wiring in four parts: 4a the parts and the resolved wire list (headless), 4b the harness tab, 4c routing and geometry in 3D, 4d the harness document, CSV and `prism.harness.v1`.

A harness is defined in its own tab, a configurator in the manner of MiniProto's (ADR decision 5): ends, contacts, wires, splices, cables and coverings are chosen there. The schematic only places the block and draws the links that join it to connectors (§14).

### 16.1 Harness parts (4a)

Housings, contacts, cables and coverings are ordinary catalog `part`s (ADR §2.5). Their harness attributes are catalog metadata fields in the group `harness`, seeded by catalog migration 15 as built-in field definitions stored in a revision's `extra_fields`, so they are versioned and reviewed with the revision like any other field. All are optional. They appear in the metadata grid and CSV like other fields, but not in the KiCad DBL export: they describe wiring parts, not symbols.

| Key | Type | For | Meaning |
|---|---|---|---|
| `harness_role` | enum | all | `housing`, `contact`, `cable`, `sleeve`, `heat-shrink`, `tape`, `zip-ties`, `label`, `marker` |
| `harness_cavities` | number | housing | cavity count |
| `harness_contact_family` | text | housing, contact | the family a housing takes and a contact belongs to |
| `harness_gauge_min_awg`, `harness_gauge_max_awg` | text | contact | the gauge range, AWG as written (`"28"`, `"0"`, `"00"`); min is the thinnest |
| `harness_conductors` | number | cable | conductor count, a drain counting as one |
| `harness_shielded` | boolean | cable | has a shield |
| `harness_od_mm` | number | cable | outer diameter |
| `harness_diameter_min_mm`, `harness_diameter_max_mm` | number | sleeve, heat-shrink | the bundle diameters it fits (heat-shrink: recovered and expanded) |
| `harness_shrink_ratio` | number | heat-shrink | expanded over recovered |

A housing's mating board connectors are the existing **mates with** relation (`/api/catalog/components/{id}/mates-with`).

**Quick-create.** The harness tab (4b) creates a missing part through the ordinary catalog create with `kind: part`, these fields pre-filled in `extra_fields` and the role's category; the part then follows the normal review.

### 16.2 In the build (4a)

`--parts` (§8.10) also lists every harness part the document references: each end's `housing` and `contacts`, each cable's and each covering's `part`. A part with a valid `harness_role` carries `harness: { role, cavities?, contactFamily?, gaugeMinAwg?, gaugeMaxAwg?, conductors?, shielded?, odMm?, diameterMinMm?, diameterMaxMm?, shrinkRatio? }` (blank or unparseable values left out: a count must be a whole number of at least one, a measure positive). A housing also carries `matesWith: [{ componentId, mpn? }]`, its **mates with** partners with their current revisions' MPNs. Adding them changes the `parts` digest, so the key (§8.1) follows.

### 16.3 The wire list (4a)

The system bundle gains `harnesses[]`, one per harness block, in document order: `{ harness, ends[], wires[] }`. Every build writes it; a bundle built before format 5, such as the frozen bundle of an entry published earlier (§11.1), has none, and a reader treats that as no wire list.

- **`ends[]`**, in document order: `{ end, site?, housing?, cavities[] }`. `housing` is the resolved reference (`componentId@revisionId`) or absent. `cavities[]` lists each cavity in use, in natural order: `{ cavity, pad, net?, contact? }`. A cavity is the pad's through `pinMap` (identity when empty); `net` is the system net id of the site's pad; `contact` the resolved reference from the end's `contacts`.
- **`wires[]`**: every conductor of the harness, explicit wires in document order, then each link's default wires (§8.5) in link order and side A's pin order. Each is `{ id, origin, link?, from, to, gaugeAwg?, colour?, label?, cable?, conductor?, net?, suggested }`:
  - `origin`: `explicit`, or `default` (id `<link>:<pad A>`);
  - `from`/`to`: `{ kind: "contact", end, cavity, pad }`, `{ kind: "splice", splice }` or `{ kind: "loose", looseEnd }`; a default wire runs from the end on side A's site to the end on side B's;
  - `cable`/`conductor`: the cable and conductor name that carry it (`Cable.conductors[].wire`);
  - `net`: the system net it is on, absent for a wire between splices and loose ends only;
  - `suggested`: as §8.5.

### 16.4 Findings (4a)

| Code | Severity | Subject | When |
|---|---|---|---|
| `harness-part-missing` | error | `end:<id>`, `cable:<id>` or `covering:<id>` | a housing, contact, cable or covering part is not in the catalog, or a reference without a revision finds no released one |
| `housing-not-mating` | warning | `end:<id>` | the housing does not list the site's connector in **mates with**: by component id for a body connector, else by MPN (case and spaces ignored); not raised when the site's connector has no MPN |
| `housing-cavities-short` | error | `end:<id>` | a cavity in use, or in `pinMap`, is above the housing's `harness_cavities` |
| `contact-family-mismatch` | warning | `end:<id>` | a contact's family differs from its housing's |
| `contact-gauge-mismatch` | warning | `wire:<id>` | the wire's gauge is outside a contact's range at either end (a default wire has no gauge and is never raised) |
| `wire-gauge-unknown` | info | `harness:<id>` | wires of the harness have no gauge; the message counts them (4c needs gauges for bundle diameters) |
| `cable-conductors-mismatch` | warning | `cable:<id>` | the cable's conductors differ in number from its part's `harness_conductors` |
| `wire-terminal-invalid` | error | `wire:<id>` | a terminal names an end, cavity, splice or loose end the harness lacks |

A connector whose board revision changed is checked as any other: a pad that vanished is `pin-missing`, a part change shows as `housing-not-mating`.

### 16.5 The harness tab (4b, mockup 09)

One tab per opened harness block (`?harness=<ids>`, `tab=harness:<id>`), opened by double-clicking the block on the root sheet, from its selection panel, or by `openHarness`. It is a configurator in the manner of MiniProto's: a canvas of the block's objects, a toolbar, an inspector for the selection and a wire defaults bar.

**What it draws.**
- **Ends** as cards: the site (`<refdes> · <occurrence label>`), the housing and contacts, and a pin strip with one row per pin of the site's connector (sub-port members grouped under the sub-port's name). A row shows the pad, the board net's leaf name (or the export's pin name on a body) and the cavity when `pinMap` moves it. An end without a site shows its id and "not attached". Ends are made only by links drawn on the schematic (§14.3); the tab never adds one.
- **Wires** between the points of their terminals: explicit wires solid in their colour (grey without one), default wires (§16.3 `origin: default`) dashed; a suggested power join is dashed amber. Pins no wire reaches show an open stub when a link covers them.
- **Splices** (circle `S`), **loose ends** (open circle with kind), **branch points** (diamond) and **segments** (a pale band between the nodes they join). **Coverings** shade their segment. **Cables** draw a dashed jacket around the wires their conductors bind; **X-ray** off draws a cable as one thick line with its name.
- **Placement.** `layout[id].canvas` (§2.8: `{ xNm, yNm }`, top-left of a card, centre of a node) places an end, splice, loose end or branch point; absent, the auto-layout puts the ends that are side A of the block's first link (or of most links) in a column on the left, the rest on the right, nodes between, in document order. Dragging an object stores its `canvas` with `set-layout`.

**Gestures** (each one request, one undo step):
| Gesture | Ops |
|---|---|
| drag a pin to a pin of another end | `add-wire` from contact to contact, `link` set when one link joins the two sites; gauge and colour from the defaults bar |
| drag a pin to a splice or loose end, or a splice to a splice | `add-wire` with that terminal, no `link` |
| `S` / `P` (at the pointer) | `add-splice { method: crimp, confirmed: true }` / `add-loose-end { kind: pigtail }`, with their `canvas` |
| `J` | `add-branch-point` |
| `A` with wires selected | `add-cable` with one conductor per selected wire (named by colour), part chosen in its dialog |
| `B` on a segment | `add-covering { kind: heat-shrink }` |
| `M` on a wire | `add-marker { kind: label, text: <wire label or id> }` |
| edit a default wire (gauge, colour, label) or **Confirm** a suggested join | `add-wire` with the same terminals and `link`: it becomes explicit (§8.5 rule 1) |
| delete a default wire | `replace-link` adding its side-A pad to `unmapped` |
| delete an explicit wire, splice, … | the `remove-*` op (cascades §3.2) |
| double-click an end | its dialog: housing (catalog parts with role `housing`; those whose **mates with** includes the site's connector listed first, marked ✓), contacts per cavity (role `contact` of the housing's family; **Fill all** sets every used cavity), pin map rows; saved as one `replace-end` |

**Inspector.** For a wire: terminals with pads and nets, system net, gauge (checked against both contacts' ranges), colour, label, length (from the 3D route in 4c; a typed `lengthNm` overrides), markers, cable and conductor, and the findings on it. For an end, splice, cable or covering: its fields and part. With nothing selected: the block's label, counts and findings.

**Toolbar.** Pigtail `P`, Splice `S`, Cable `A`, Covering `B`, Branch point `J`, Marker `M`; undo, redo; X-ray `X`, Labels `L`, Auto-layout (clears every `canvas` of the block); **Wires** (the wire list as a table, §16.3), **BOM** (housings, contacts, cables and coverings by part with quantities; wire length by gauge and colour once 4c gives lengths), **Findings** (the bundle's findings whose objects include the block); **＋ Part…** quick-create (§16.1).

**Wire defaults bar.** Gauge and colour for new wires, kept per user in browser storage; length reads "from the 3D route".

**Selection** is shared with the schematic: selecting a wire lights its two pins' connectors there; selecting the block on the schematic opens nothing until double-click.

Script API additions: `openHarness(harness)`; `describeHarness(harness)` returns the tab's data (ends with pins, wires as in §16.3 with their origin, splices, loose ends, cables, coverings, branch points, segments, findings); `addWire({ harness, from, to, gaugeAwg?, colour?, label? })` (terminals as in §2.5; `link` is filled when one link joins the two sites); `setWire({ harness, wire, gaugeAwg?, colour?, label?, lengthNm? })` (a default wire id `<link>:<pad>` makes it explicit); `removeWire({ harness, wire })`; `setEnd({ harness, end, housing?, contacts?, pinMap? })`; `addSplice`, `addLooseEnd`, `addCable({ harness, wires, part? })`. Those that create an object (`addWire`, `setWire` on a default wire, `addSplice`, `addLooseEnd`, `addCable`) return its `id` with the new `version`.

### 16.6 Routing in 3D (4c, mockup 10)

The harness's physical route: where each end's housing sits, the tree of segments between them, a curve per segment through its waypoints, each segment's bundle size, each wire's length, and the checks. The maths is the kept v1 harness maths (CONTRACTS_P2 §17.5–§17.10), ported to Rust in `prism-system` (`placement/harness_*.rs`) with the Python and TypeScript twins and the shared goldens (`placement_cases.json`: `harnessEnds`, `harnessTopologies`, `harnessCurves`, `harnessNodes`, `harnessChecks`). Its numbers (`harness_spec`): boot 10 mm, housing depth 8 mm without a model, bundle Ø = 1.2·√Σdᵢ² (M22759/16 diameters; a missing or unknown gauge takes 24 AWG's and is marked assumed), minimum bend radius 6 × Ø, clearance margin 1 mm, length allowance 10 %.

- **Ends.** An end is posed when its site's connector has a world frame (§15; boards and body connectors alike): the housing meets the connector face to face, the cable leaves its rear face and runs straight for the boot (`End.bootLengthNm`, else 10 mm) along the connector's outward axis to the leg point. An end without a pose is left out and its wires are unrouted.
- **Topology.** With no stored `segments`, the tree is derived as in v1: the posed ends as leaves, the block's branch points that have a `position` as breakouts in document order, and an automatic breakout (the wire-weighted centroid of the leg points, lifted 10 mm along their mean outward axis) when more than two ends meet and none is stored. Derived segments are named `<harness>/<from>~<to>`. With stored segments, they are the tree: each `Segment` joins two nodes (an end or a branch point); a stored set that is not a tree over the posed ends is the finding `harness-topology-invalid` and the derived tree is drawn instead. A branch point without a `position` in a stored tree sits at the mean of its positioned neighbours' points (ends' leg points, other branch points), else at the centroid of the ends' leg points.
- **Wires on segments.** A wire runs the tree path between the ends its terminals reach (a contact: its end; a splice: every end its other wires reach, so the wire takes the subtree joining them), unless its `route` lists segments. A segment's bundle is the wires it carries.
- **Curves.** Each segment is a centripetal Catmull-Rom curve through its control points: the `from` end's exit, half boot, leg point and half boot on (or the branch point), the segment's waypoints by `order`, then the `to` side reversed. Stored waypoints are pinned: they never move. Bends tighter than the minimum radius are reported, not fixed (relaxation only moves unpinned points, and 4c stores none).
- **Checks (flagged only, never re-routed).** `harness-bend-tight` (warning, `segment:<harness>/<segment>`): the tightest bend and the radius needed. `harness-clearance` (warning, `segment:<harness>/<segment>/<occurrence>`): the segment comes closer to a board or body than its radius plus the margin; the first boot of arc from an end is exempt against the occurrence that end sits on. `harness-end-unplaced` (info, `end:<harness>/<end>`): an end has no pose. `harness-waypoint-unused` (info, `waypoint:<harness>/<id>`): its segment is not in the drawn tree. `wire-length-unrouted` (info, `harness:<id>`): wires to a splice or loose end, or touching an unposed end, have no route length; the message counts them. `wire-length-mismatch` (warning, `wire:<id>`): a typed `lengthNm` differs from the route length by more than 15 %.
- **Lengths.** A routed wire's length is the arc length of its segments plus both housings' depths, plus the 10 % allowance. A typed `lengthNm` wins in the wire list, BOM and outputs.

**In the bundle.** Each `harnesses[]` entry gains `route` (format 6; absent before, and absent when fewer than two ends are posed): `{ derived, ends[{ end, exit, outward, leg }], segments[{ id, derived, from, to, wires[], diameterNm, assumedGauge, samplesNm[], lengthNm, minRadiusNm?, minRadiusAllowedNm, tightBend? }], wires[{ wire, lengthNm? }] }`; points in system nanometres, `samplesNm` flat `[x, y, z, …]`, `from`/`to` node ids (an end or branch point id, or `auto` for the automatic breakout). The wire list's (§16.3) wires gain `routeLengthNm` when routed.

**The Route tool (3D tab, `R`).** Harness tubes are drawn when the view's Harnesses toggle is on (on while the tool is active): each segment as a tube of its bundle Ø, in the harness colour, a selected one with the selection halo; tight bends and clearance hits marked red at their point. Gestures, each one request:

| Gesture | Ops |
|---|---|
| drag a tube | a new waypoint at the drop point on that segment, `order` between its neighbours (`add-waypoint`); on a derived tree, the request first stores the tree: `add-segment` per derived segment (fresh ids, waypoints re-pointed), `add-branch-point` (or `replace-branch-point` with its `position`) for the automatic breakout |
| drag a waypoint or branch point | `replace-waypoint` / `replace-branch-point` with the new `position`; arrows of the move gizmo hold an axis, Shift frees it |
| Delete on a waypoint / branch point | `remove-waypoint`; a branch point joining two segments: `remove-branch-point` (which removes its segments and their waypoints), then one `add-segment` joining its neighbours and the old waypoints re-added in order with new ids; one joining three or more is refused (move it instead) |
| **Straighten segment** | removes the segment's waypoints |

While dragging, the tubes follow the pointer from the TypeScript twins (dashed preview); **Place** (Enter or release) sends the request. The route card shows the selected waypoint's position (typed values accepted), and for its segment: wires carried, bundle Ø (assumed gauges marked), length, tightest bend against the minimum, closest clearance, coverings. Selection is shared with the harness tab: a segment, wire or node selected in one is selected in the other; the harness tab's inspector, Wires dialog and BOM show route lengths.

Script API additions: `describeRoute(harness)` (the bundle's `route` and the findings on it), `addWaypoint({ harness, segment, position, order? })`, `moveWaypoint({ harness, waypoint, position })`, `removeWaypoint({ harness, waypoint })`, `setBranchPoint({ harness, branchPoint, position })`, `storeTopology(harness)` (stores the derived tree as segments); creating calls return `{ id, version }`.

### 16.7 Harness outputs (4d)

Generated in the backend on request (`backend/app/system_builder/harness_outputs/`) from the document and the viewer's redacted system bundle, so a restricted board appears in outputs exactly as in the bundle. All outputs of a harness read one model (`model.py`):

- **Wires** are the wire list's (§16.3), sorted by terminals (contact terminals first, by end in document order and cavity in natural order; then splices and loose ends in document order) and numbered `W1…`. A wire's **length** is its typed `lengthNm`, else its route length (§16.6), else unknown.
- **Ends**: title `<refdes> · <occurrence label>` (the end id when it has no site), the board connector's value and MPN, the housing part, the connector's pin count, and each cavity in use with its pad, signal (the board net's leaf name, else the pin name), system net, contact part and the wires landing in it.
- **Nodes**: splices `SP1…` and loose ends `LE1…`, in document order, with the wires reaching them. **Branch points** of the route are named `B1…` in segment order.
- **BOM**: housings and contacts by part (quantity = ends / cavities, where = end titles), wires by gauge and colour (total length when every wire of the row has one, else the count), cables and coverings by part, splices by method, markers.
- Parts are read from the catalog by reference (`<componentId>` or `<componentId>@<revisionId>`, newest released when no revision): MPN, name, manufacturer, description. An unresolvable part reads "not in the catalog".

**The harness document** (`drawing.py`, mockup: the approved render of 2026-10-21). Release Studio sheets (`release_studio/documents/layout.py`) rendered by its SVG and PDF backends, deterministic (no dates, nothing from the host):
- Sheet 1, the drawing, not to scale: the route tree left to right from an end that is a leaf of the route; each end a connector table (title, mates, housing, ways · used · contact) with a row per cavity in use; every wire in its colour (IEC 60757 codes, a second colour as a stripe, unknown colours grey) from its cavity into the bundle with a `W<n> <colour code>` tag; each segment a sheath sized by its wire count with its length (mm) and `<n> wires · <coverings>`; a dot and name at each branch point; ends the route does not reach, splices and loose ends as leaves joined by a dashed "not routed" stub. A3 landscape; a drawing that cannot fit A3 with row text of at least 1.8 mm moves up the ISO ladder (A2, A1, A0).
- Sheets 2…: the **wiring table** (wire, from, to, net, AWG, colour, length mm with "(typed)", label or cable · conductor) and the **BOM**, continued over as many A3 sheets as they need.
- Every sheet has the Release Studio frame and title block: `<label> · Harness`, System `<name> v<version>`, Harness `<label> · <n> wires`, Sheet `<i> of <n>`, Bundle (key, 16 characters).

**Files.**
| Name | Type | Content |
|---|---|---|
| `harness.pdf` | `application/pdf` | every sheet |
| `sheet-<i>.svg` | `image/svg+xml` | one sheet |
| `wiring.csv` | `text/csv` | `wire,from_end,from_cavity,from_signal,to_end,to_cavity,to_signal,net,gauge_awg,colour,colour_code,length_mm,length_typed,label,cable,conductor`; a splice or loose end terminal names it (`SP1`) with empty cavity and signal |
| `bom.csv` | `text/csv` | `item,kind,part,manufacturer,description,quantity,where` |
| `harness.yaml` | `application/yaml` | `prism.harness.v1` |

CSV cells a spreadsheet would read as a formula (`= + - @` first, not a number) are prefixed with `'`. Lengths are millimetres with one decimal.

**`prism.harness.v1`** (YAML, keys in this order, for downstream tools; not WireViz-compatible):
```
schema: prism.harness.v1
system: { name, version, bundleKey }
harness: { id, label, routed }
ends:     [{ id, title, connector, ways, housing: Part | null,
             cavities: [{ cavity, pad, signal, net, contact: Part | null, wires: [W1, …] }] }]
nodes:    [{ id, name, kind, detail, wires: [W1, …] }]          splices and loose ends
wires:    [{ number, id, origin, from: Terminal, to: Terminal, gaugeAwg, colour, colourCodes: [RD, …],
             label, net, cable, conductor, lengthMm, lengthTyped }]
cables:   [{ id, label, part: Part | null, conductors: [{ name, wire, drain }] }]
segments: [{ id, from, to, wires: [W1, …], lengthMm, diameterMm, coverings: [kind, …] }]   empty when not routed
coverings: [{ id, segment, kind, part: Part | null }]
nodeNames: { <route node id>: <name> }
bom:      [{ item, kind, part, manufacturer, description, quantity, where }]
Part:     { reference, mpn, name, manufacturer, description }
Terminal: { kind: contact | splice | loose, node, cavity? }      node: the end, splice or loose end id
```
Absent values are `null` (strings may be empty); numbers in millimetres to three decimals.

**API.** `GET /systems/{id}/harnesses/{harness}/outputs` → `{ state: "ready" | "building", files: [{ name, title, contentType }], sheets }` (`building` with no files while the system bundle is not ready); `GET /systems/{id}/harnesses/{harness}/outputs/{name}` → the file, `Content-Disposition: attachment; filename="<system>-<harness label>-<name>"` (names slugged), `409` while the bundle is building, `404` for an unknown harness or name. Viewer role. Rendered files are cached in-process by system, bundle key, harness and the caller's hidden occurrences.

**The harness tab.** **Outputs** in the toolbar opens a dialog: the sheets previewed (the SVGs, one at a time with sheet arrows), and a download button per file. While the bundle builds it says so and polls the index.

Script API addition: `harnessOutputs(harness)` returns the index (`files`, `sheets`).

## 17. The ICD and the outputs tab (stage 5a)

The interface control document, generated in the backend on request (`backend/app/system_builder/icd/`) from the document and the viewer's redacted system bundle, like the harness outputs (§16.7). Its model (`model.py`) has:

- **Occurrences**: label, kind and source (`<project> @ <commit, 10 characters> (follows <branch> | pinned)`, a catalog part, or `restricted`).
- **Interfaces**: each export in document order: its name, site (`<connector> · <occurrence label>`, `· <sub-port>` for a sub-port) and pins in natural order (a sub-port's own pins, else every pad of the connector), each with its interface name (the export's `pinNames`, else the board pin name) and system net.
- **Connections**, grouped:
  - per mate (`<connector> · <label> ↔ <connector> · <label>`, document order): each derived pair (or the manual map) in side A's natural pad order, both sides with pin name and board net, `via: mated`, the row's `signal` as detail;
  - per harness (`Harness <label>`): each contact-to-contact wire (`via: W<n>`, detail gauge, colour code, length); each splice joins its first contact to each other one (`via: W<a> · SP<n> · W<b>`); a wire to a loose end ends there (`note: open end (<kind>)`).
  - A row whose two board nets have different leaf names notes `net names differ`. A restricted occurrence's pins read `restricted`.
- **System nets**: those with pins on more than one occurrence, in bundle order, with their board nets (`<label>: <net>`) and pins (`<label> <connector>.<pad>`); the count of the rest is stated.

**Files** (`GET /systems/{id}/icd` → `{ state, files, sheets }`, `GET /systems/{id}/icd/{name}`, as §16.7's API, filename `<system>-icd.<ext>`):
| Name | Content |
|---|---|
| `icd.pdf` | Release Studio sheets, A3 landscape, frame and title block (`<system> · ICD`, System `<name> v<version>`, Sheet, Bundle): sheet 1 a summary (occurrences table, counts), then the interfaces, connections (a table per group) and system nets tables, continued over as many sheets as they need |
| `sheet-<i>.svg` | one sheet |
| `icd.html` | one self-contained page (inline CSS, no scripts or external requests), the same sections as the PDF with a contents list, in the sheets' look (the engine's fonts as CSS fallbacks, ruled tables, the title block as a header) |
| `icd.csv` | one row per connection: `group,kind,a_occurrence,a_connector,a_pad,a_pin_name,a_net,b_occurrence,b_connector,b_pad,b_pin_name,b_net,via,detail,note` (formula escaping as §16.7) |

**The ICD / Outputs tab** (ADR §4.1, `tab=outputs`, opened from the header's **Outputs** button). One per system. Left, the ICD preview (its sheets, one at a time with arrows, as the harness Outputs dialog). Right, the downloads, grouped: **ICD** (PDF, HTML, CSV), **Document** (`prism.system.v2` JSON: the document as the caller reads it, `<system>-system.json`), **Harnesses** (per harness, its §16.7 files), and **STEP** (stage 5b; until then "the STEP assembly arrives with stage 5b"). While the bundle builds, the ICD and harness groups say so and poll.

Script API addition: `icd()` returns the ICD index.
