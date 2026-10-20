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
- **The system bundle key** is SHA-256 over the canonical JSON `{documentSha256, format, generator, members: {occurrence: bundleKey}, absent: [occurrence], pending: [occurrence], boardSubPorts: {id: version}, entries: {occurrence: {payload, stage}}, parts}`; 1c adds `boardSubPorts` and `entries` (§10.5, §12.2), always present. `format` is the system bundle's format number, bumped whenever what the bundle holds changes (1: stage 3a's `placement`; 2: stage 3c's mate `pads`; 3: stage 3d's bodies and `parts`), so stored bundles rebuild without any design bundle's key changing. A new document version with the same content, such as one restored by an undo, reuses the bundle.
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

1. **`explicit`:** each explicit wire of the link, mapped through each end's `pinMap` (cavity to pad; identity when empty), takes its A pad.
2. **`sub-port-order`:** when both sides name sub-ports of equal size, the remaining pins map in order.
3. **`net-name`:** otherwise, remaining pins pair by equal board net name (`net`). Several pins on one name pair in pad order; the extras are left unmapped and reported as `duplicate-net-extra`.
4. Pads in the link's `unmapped` are removed from the default wiring. Whatever is left is `unmappedA`/`unmappedB`; pin N is never matched to pin N by position alone.

A wire is `suggested: true` when either pin is power or ground: `power` is true, or the net name is a ground name (`GND`, `AGND`, `DGND`, `PGND`, `GNDA`, `GNDD`, `VSS`, or any of them with a suffix after `_`). It still counts for system nets.

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
- **Redaction** (§6): for an occurrence the reader cannot see, the placement keeps its pose but withholds `bounds` and `positioningMate`; a mate touching it keeps only `mate` and `driving`.

### 8.10 Bodies and body connectors (stage 3d)

A body occurrence places a mechanical catalog part; body connectors (§2.7) place connector parts on its faces.

- **Input.** `--parts <system-parts.json>` (`prism.system_parts.a0`) lists every part the document references (each body occurrence's source, each body connector's `part`), keyed by the reference exactly as the document spells it: `componentId`, or `componentId@revisionId` (no revision: the latest released, which the backend resolves). Each part carries its resolved revision, name and MPN; its symbol library and footprint, staged beside the file (paths relative to it, never through `..`) with their SHA-256, which the build checks; and its converted model's box in the part's frame, alignment applied. A reference the catalog cannot resolve is left out.
- **A body reads as a board** whose components are its body connectors, so §8.2–§8.9 apply unchanged:
  - a body connector's pins are its part's symbol pins (number, name, electrical type; no nets), one per number; without a symbol, its footprint's pad numbers; with neither, none;
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

Publishing a system makes a catalog entry of kind `system` whose interface is the system's exports (ADR §2.1). In 1c only **in-house** entries publish; bought-out entries need bodies and publish from stage 3. Publishing goes through the catalog's ordinary workflow (maintainer decision 2026-10-20).

### 11.1 What a published revision holds

- **The catalog component** has `kind: "system"` (catalog migration 14 widens `components_kind_check` to `part` and `system`) and an IPN identity: a new identity kind `ipn` with scope `system`, allowed only on `system` components. It is not the parts' `provisional_ipn`, which stands in until an MPN exists and blocks release; an in-house entry's IPN is final. One system publishes into one component: the first publish creates it with the IPN given, later publishes add revisions to it. `ws_systems.catalog_component_id` records the link.
- **The frozen payload** is one required revision asset of type `system_entry`: the canonical JSON file `prism.system_entry.a0` (`native/src/tsp/prism/system-entry-a0.tsp`). Its SHA-256 joins the revision manifest like every asset, so the audit chain covers it.

```
SystemEntryA0 { schema: "prism.system_entry.a0",
                source: { systemId, version, snapshotId, systemBundleKey },
                document,        prism.system.v2 at that version
                boardSubPorts,   prism.board_sub_ports.a0, the definitions it names
                bundle,          prism.system_bundle.a0, built from exactly those
                interface }

interface { exports: [ { id, name, occurrence, connector, subPort?,
                         pins: [ { pad, name, net, signal? } ] } ] }
```

- `interface.exports` lists the document's exports in id order. Each `pins` entry is one pad of the export's site in the site's pin order (a sub-port's order, else natural): `name` is the export's `pinNames[pad]`, else the board's pin name, else the pad; `net` is the system net id it is on and `signal` that net's name.
- A copy of `interface` is the revision's `interface_json`, so Library Manager lists and searches entries without opening the payload.
- **Boards are frozen by recording, not rewriting.** Every board occurrence's `commit` is already exact in the document, and the bundle records each one's revision and bundle key. A followed board stays followed in the live system; the entry is pinned because the payload never changes.

### 11.2 Publishing

`POST /api/systems/{id}/publish { snapshotId?, ipn?, changeSummary }`, under `If-Match` on the system:

1. **Permissions:** `design` on the system and `catalog_write`. The publisher must see every board occurrence (else `403 system_redacted`).
2. **The snapshot:** `snapshotId` names an existing snapshot of this system; without it, publishing takes one at the current version named `Published <IPN>`, but only after the IPN rule of step 4 and the checks of step 3 pass against the live system and its live board-level sub-ports, so a refused publish (which the UI retries while the bundle builds) leaves no snapshot. If the version or the sub-port definitions moved in between, the answer is `412`.
3. **Checks, in order, each a `409` listing what failed:** at least one export (`system_no_exports`); no body occurrence (`system_publish_unsupported`, until stage 3); every board occurrence `ready` in the snapshot's system bundle and the bundle built (`system_bundle_not_ready`; the UI waits and retries); no unwaived error finding (`system_not_clean`, listing the findings); every entry occurrence on a `released` revision (`system_entry_unreleased`).
4. **The revision:** the payload is written as the `system_entry` asset of a new revision in stage `qa_review`. The first publish also needs `ipn` (`422 system_ipn_required`), validated by the catalog's identity rules; a later one refuses a different `ipn` (`409 system_ipn_mismatch`).
5. **The record:** `ws_system_publications` (`system_id`, `version`, `snapshot_id`, `component_id`, `revision_id`, `published_by`, `published_at`) gets a row. The catalog and the workspace are separate databases: the catalog revision is written first, and its `source_ref_json` holds `{ systemId, snapshotId }`, so a retry after a failed workspace write finds the revision instead of making a second one.

The answer is `{ componentId, revisionId, stage }`.

### 11.3 Release

A `system` revision follows the workflow of `catalog/workflow_policy.py` and the gates of `release_workflow.py`, with two-person approval, plus one gate of its own, checked fail-closed: the `system_entry` asset is present, its SHA-256 matches the manifest, and its bundle has no unwaived error finding. KLC and representation gates do not apply to `system` revisions.

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
- **Mates with an entry** derive no geometry in 1c: an entry carries no pad geometry until stage 3. Such a mate needs `manualMap`, or it is `mate-unresolved`.

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

## 15. The 3D and B2B tabs (stages 3b, 3c)

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
