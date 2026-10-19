# System Builder v2 contracts

- **Status:** draft, stages 1a–1b. The design is [ADR: System Builder v2](../architecture/adr-system-builder-v2.md); this file is its contract layer.
- **Covers:** the `prism.system.v2` document (§2), the `prism.system.ops.a0` operations (§3), storage (§4), the HTTP API (§5), permissions and redaction (§6) and limits (§7). The system bundle, `prism.system_bundle.a0`, and the `prism-kicad system build` command that writes it are §8; its findings are §9.
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
  { kind: "entry", componentId, revisionId }    a published system (1c)
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
  subPort:   { kind: "occurrence", id } | { kind: "board", id }
```

An endpoint without `subPort` means the whole connector. Pins are pad numbers as strings (`"1"`, `"A4"`).

### 2.3 Sub-ports

```
SubPort { id, occurrence, connector, name, pins[], suggestion?, promotedTo? }
```

- `pins` are pad numbers in the user's order: the order they were selected in, or the suggestion's order. Sub-ports may overlap.
- `suggestion` is the key of the bundle suggestion it was accepted from, for example `unit:2`, `bus:CAN`, `sheet:/Power/`, `family:I2C`, `power`. Keys are defined with the system bundle (1b).
- `promotedTo` is set when the sub-port was promoted to the board (1c); endpoints that used it then point at the board-level id.
- A dismissed suggestion is stored in `dismissedSuggestions` so it stays dismissed; restoring it removes the entry.
- Board-level sub-ports live outside the document, Prism-side against the project and connector (1c). The document refers to them only through endpoints.

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

- An export makes a connector or sub-port part of the system's interface when published (1c). `pinNames` renames pins for that interface.
- A waiver silences one finding: `code` is the finding code, `subject` the finding's subject key, both defined with the findings catalogue (1b).

### 2.7 Board-less systems

```
BodyConnector { id, occurrence, refdes, part: PartRef, frame: Pose, quarterTurns }
```

A connector part placed on a body occurrence's face. `refdes` is what endpoints name as `connector`. `frame` is the part's mating frame in the body's frame, with the conventions of the kept frame maths (face frame, part mating frame, quarter turns).

### 2.8 Schematic layout

`layout` maps an object id (occurrence, harness block, sheet symbol) to `{ sheet?, xNm, yNm, rotationDeg, mirror }`. It is presentation only: no rule reads it, and removing an object removes its entry.

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

- `connect-harness { harness?, newHarness?, newEnds, link }` is the schematic gesture. It uses `harness`, or the block either side's connector already belongs to, or creates `newHarness`; it adds an end (with the id `newEnds.a` or `newEnds.b`) for each side whose connector has no end in that block, then adds the link. Every link drawn from one connector joins that connector's existing harness block (ADR §2.4); naming a different block is refused.
- Validation is document-local: references resolve to objects of the right kind, ids are unique, enums and units are in range, and the §7 limits hold. Whether a connector or pin exists on the board is the system bundle's job (§1).

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

- There is no table per concept (ADR §3.1). Board-level sub-ports (1c) and the system bundle cache (1b) add their own tables.
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

Reads need `read`; writes need `design` (`app/core/policy.py`).

## 6. Permissions and redaction

- A system's own visibility follows its folder, like a project's.
- **Redaction** (ADR open question 1, today's rule): when the caller cannot see a board occurrence's project, they see the occurrence by its label only. Its `source` is replaced by `{ kind: "redacted" }`, and every pin list, pin map, row label and pin name that names that occurrence's pins is emptied. The same rule applies to snapshots, history and (1b) the system bundle's reads and findings.
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

Derived state (ADR §3.3). It is a pure function of the document and the design bundles of its board occurrences, written by Rust (`native/src/rs/prism-system`, run as `prism-kicad system build`) and orchestrated by Python. Like the document, it is unfrozen until stage 5. Stage 1b computes connectivity only: system nets, B2B mappings, harness wiring, sub-port suggestions and findings. Geometry (placement, harness routes) and outputs join as further members in stages 3–5.

### 8.1 Inputs and key

- **The document,** canonical JSON. Its SHA-256 is `documentSha256`.
- **One design bundle per board occurrence whose bundle has stage `parse` complete.** It reads `projections/system-interface.json` (connectors, pins, pin nets, names and types, power nets, pad geometry and board thickness) and `projections/semantic-index.json` (bus aliases, nets' source sheets). B2B geometry reads `system-interface.json`'s pad geometry, the form the kept placement maths and their goldens use. This amends the ADR's mention of `placements.json` for pads; the maintainer chose it so the goldens replay unchanged.
- **The system bundle key** is SHA-256 over the canonical JSON `{documentSha256, generator, members: {occurrence: bundleKey}, absent: [occurrence], pending: [occurrence]}`. A new document version with the same content, such as one restored by an undo, reuses the bundle.
- Published entries (1c) and body connectors' pins (stage 3) are not inputs yet. Their occurrences are reported with the state `unsupported`.

### 8.2 Occurrences

`occurrences[]`, one per occurrence in id order: `{ occurrence, state, revisionKey?, bundleKey?, connectors[] }`.

- `state` is one of:
  - `ready`: its bundle was read;
  - `pending`: its bundle is not built yet;
  - `absent`: the project is not present at that commit;
  - `unsupported`: a published entry or body, until their stages;
  - `redacted`: only in an API read, for an occurrence whose project the reader cannot see (§6); its keys and connectors are withheld. A stored bundle never holds it.
- `connectors` (ready boards only) lists the board's connectors in natural reference order: the components `system-interface.json` marks `candidate`, plus any component a document endpoint names. Each is `{ refdes, value, mpn?, candidate, pins[] }`. Each pin, in natural pad order, is `{ pad, net?, nets[], pinName?, pinType?, power }`. `net` is the pin's first schematic net. This is the per-occurrence view the schematic and harness UI draw from, so a reader needs only the system bundle.

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

`mates[]`, one per document mate: `{ mate, source, pairs[{a, b}], unmappedA[], unmappedB[] }`.

- **source `geometry`.** Each connector's frame comes from the kept frame maths (`connector_frame`) with its board's thickness. B's pad centres are placed into A's frame by the mate transform, with `k = (padOneTurns + orientation.quarterTurns) mod 4`. `padOneTurns` puts pad 1 on pad 1, so quarter turns 0 is the natural mating. With `flip`, B's frame is first turned 180° about its x axis.
  - An A pad maps to the B pad whose centre lies inside the A pad's landing window in A's xy plane: the A pad's rectangle, turned with its footprint, each half-side at least 0.1 mm. Mating series often pair long pads at different row spacings, so matching centres can sit apart along the pads but not across them. For a name held by several pads, the smallest gives the window. The closest B pad wins, and a B pad maps at most once.
  - Pads named more than once collapse to their centroid, as in the kept maths.
- **source `manual`.** `manualMap` replaces the geometry. Pairs naming pads the connectors lack are dropped and reported.
- **source `unresolved`.** There is no manual map and the geometry cannot decide: a side is not ready, a connector has no pads, or the frame inference has confidence `low`. `pairs` is empty.
- Lists are in natural order of the side's pad.

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
            [--absent <occurrence>]... -o <system-bundle.json> [COMMON]
```

- **`--member`** gives a board occurrence's stored design bundle. The revision key is its identity, as in `compare`, because a bundle may serve several keys. A board occurrence with neither `--member` nor `--absent` is `pending`.
- **Checks, in order:**
  1. The document validates against `prism.system.v2` (exit 3, `document-invalid`).
  2. Each member passes the reader checks (exit 3, `bundle-invalid`, with `argument` `member:<occurrence>`).
  3. Each `--member` names a board occurrence of the document (exit 7, `occurrence-mismatch`).
  4. All members share one generator id (exit 7, `generator-mismatch`).
  5. Each member's stage `parse` holds both members (exit 7, `member-not-found`).
- **Output.** `-o` receives the `SystemBundleA0`, written atomically, with stdout giving `CliSystemResultA0` (the bundle key and per-section counts). The same inputs give byte-identical output.
- **Exit codes:** 0, or 1–7 as in `cli-spec.md` §4.

## 9. Findings catalogue (ADR open question 2)

Each code has a fixed severity:
- **error** blocks publishing an in-house entry, unless waived (a clean snapshot is one with no unwaived error);
- **warning** and **info** never block.

Waivers apply to warnings and errors.

| Code | Severity | Subject | When |
|---|---|---|---|
| `occurrence-pending` | info | `occurrence:<id>` | the board's design bundle is not built yet; its connections are not checked |
| `occurrence-absent` | error | `occurrence:<id>` | the project is not present at the occurrence's commit |
| `occurrence-unsupported` | info | `occurrence:<id>` | a published entry or body, checked from its stage on |
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

