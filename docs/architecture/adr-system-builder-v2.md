# ADR: System Builder v2

- **Status:** Retired (2026-10-23). System Builder v2 was removed from the tree; its code is at tag `archive/system-builder-v2` and its successor is being scoped on `feature/system-builder-v3`. Kept as the record of the decisions below. Was: Accepted (2026-10-19). Every decision below is the maintainer's, from a design review held on 2026-10-19 before any code. The two items the review had left assumed were confirmed on acceptance (§2.8, §5). Stage 0 is done (§6).
- **Replaces:** work package V2b of [amendment V2](adr-native-design-bundle-amendment-v2.md) (§3, §7 V2b, §8), and the parent ADR's C4b row ([`adr-native-design-bundle.md`](adr-native-design-bundle.md) §9.6). It also replaces System Builder v1's contracts, `CONTRACTS.md`, `CONTRACTS_P2.md` and `prism.system_manifest.v1`, which stage 0 removed from the tree ([`docs/system-builder/README.md`](../system-builder/README.md) says where to read them).
- **Builds on:**
  - the design bundle (parent ADR §4–§5): each board is read from its bundle by revision key;
  - amendment V2 §2.1–§2.2: one analytic 3D path with staged readiness;
  - §3.4 of amendment V2: one operations API that the UI and `window.prismSystemBuilder` both call.
- **Inputs:**
  - the maintainer's exploration of MiniProto's harness configurator, a System Builder UI audit, and a "PCB-native interface patchbay" model, in a Codex thread (2026-10-19);
  - the current contracts.

## 1. Context

System Builder connects KiCad boards into systems. It has three surfaces: a diagram, a 3D scene and an ICD. Its current state:

- **Copies board data.** About 30 tables hold instances, links, rows, harnesses, wires, nodes, exports, sub-ports, mating, poses, reviews, renames and snapshots. Each stores baselines of board data (`PortBaseline`, `netA`/`netB` on every row) so drift can be detected.
- **Reads boards twice.** It reads boards through its own interface extractor and through the mesh 3D pipeline: the `webgpu_3d` job, `semantic_visualizer_service.py`, and the topology compiler. That pipeline is now the last thing keeping the mesh path alive (amendment V2 §2.3).
- **Scatters its editing.** One connection is edited in up to five places: canvas, outline, inspector, bottom tray and 3D. Harness editing is a table in the tray.
- **Models modules apart from systems.** A bought-out unit (a radio, a sensor, a power brick) is a catalog `module` described by a hand-drawn multi-unit KiCad symbol. A published system is a catalog `assembly`. They are two kinds with two authoring paths.

No system of value exists yet: the feature is in alpha, and breaking changes are expected. Adding bundle support is the moment to redesign the model rather than port it.

## 2. The model

### 2.1 Everything is a system

- **One authoring environment.** A system is the only thing System Builder authors:
  - a flight stack is a system of boards;
  - a bought-out unit, such as a radio with several connectors, is a system with no boards: one body (a mechanical part with its STEP model) with connector parts placed on it and every connector exported.
- **One catalog entry kind.** Publishing a system produces one catalog entry kind, which merges today's `module` and `assembly`. Its interface is the system's exports: connectors and sub-ports, with pins and signal names. The publish dialog asks which identity applies:

  | Identity | Number | Release needs |
  |---|---|---|
  | Bought-out | vendor MPN and manufacturer | a STEP body |
  | In-house | IPN | a clean snapshot (no open findings that block release) |

- **What can be placed in a system:**
  - **Board.** A KiCad project, placed straight from Projects at a pinned revision or a followed branch. Boards are never catalog entries on their own. Publishing a system freezes its boards at their revisions inside the published entry.
  - **Published entry.** Any published system, bought-out or in-house.
  - **Body.** A mechanical catalog part (enclosure, bracket, a module's body).
- **Same behaviour once placed.** Boards and published entries look and behave the same in a system: a symbol whose pins are connectors.
- **Entry points.** The "New system" dialog asks only for a name and description; the rest is built inside the workspace. Library Manager's add menu has **+ New Part** (today's flow) and **+ New Module**, which opens a new board-less system with "bought-out" preselected.

### 2.2 Boards are references

- **What an occurrence stores.** A board occurrence is a project plus either a pinned revision or a followed branch. The system keeps no copy of the board's interface, nets or geometry.
- **Where board facts come from.** Everything is read from the occurrence's design bundle by revision key:
  - connectors, pins, pin names and types, power nets: `projections/system-interface.json`;
  - nets and terminals: `projections/semantic-index.json`;
  - pad positions and frames: `projections/placements.json`;
  - geometry: `materialization/board.kmpack` and `viewer/models/components.glb`.
- **References into a board.** Anything the system says about a board refers to it by stable identity: connector reference, pin (pad) number, and net name for tracing.
- **System nets.** They are computed, not stored: each board's whole net graph joined by the system's connections. A signal is traced through a board: CAN_H entering on J2 and leaving on J5 of one board is one system net.
- **What can be connected.** Only connectors.

### 2.3 Connectors, unfolding and sub-ports

- **Board symbols.** In the system schematic a board, or published entry, is a symbol whose pins are its connectors.
- **Unfolding.** A connector pin unfolds like a bus into its pins, each labelled with its net. A sub-port unfolds the same way. You can connect at any level:
  - a wire on a connector maps all its pins;
  - a wire on a sub-port maps that sub-port's pins;
  - unfolding a wire shows its pin rows.
- **A sub-port** is a named, ordered set of a connector's pins. Sub-ports may overlap: a pin can sit in several. There is no longer a per-connector limit, a "split" concept, or a refusal for B2B connectors.
- **Three ways to make one,** all producing the same object:
  1. **Drag a pin selection.** Select pins in an unfolded connector and drag them onto a destination. The sub-port is created with the wire, named after the destination until renamed, and keeps the order the pins were selected in.
  2. **Group explicitly.** Select pins in the unfolded fan and choose *Group as sub-port*.
  3. **Accept a suggestion read from the bundle.** Suggestions are computed on read, stored nowhere until accepted, and can be accepted, renamed or dismissed. Sources:
     - symbol units of a multi-unit connector symbol;
     - KiCad buses and bus aliases on the connector's nets;
     - the connector's pins whose nets all enter one hierarchical sheet (named after the sheet);
     - net-name families (`CAN_H`/`CAN_L`, `I2C_*`);
     - power and ground, from pin types and power nets.
- **Two levels:**
  - **Board level:** a board's published groups, stored against the project and connector, shared by every system that uses the board. Pins a new revision drops are flagged.
  - **Occurrence level:** stored in the system. A drag-made sub-port starts here. Any occurrence-level sub-port can be promoted to the board.

### 2.4 Connections

There are two kinds of connection between connectors (or sub-ports): B2B mates and harnesses.

**B2B mate**
- A direct, point-to-point mating of two connectors. It carries physical data: orientation (flip, quarter turns), stack height, and an offset (§2.6).
- **Its pin mapping is derived from geometry.** Both connectors' pads (`placements.json`) are put in the mated pose; each pin maps to the pad it lands on, and a pin with nothing under it is unmapped. Changing the orientation recomputes the mapping on the spot.
- **What the user edits.** The orientation, plus net names and signal labels on the rows; pin numbers can't be typed.
- **Fallback.** When geometry can't decide (no 3D data, an edge connector into a card slot), the user sets the mapping by hand. It is flagged as a manual override and carries a warning.

**Harness**
- **Creation.** Drawing a harness wire between two connectors or sub-ports creates a **harness block** in the schematic. An empty block can also be placed and wired, for a harness designed before its boards.
- **Editing.** Double-clicking the block opens its harness tab (§4), where more ends are added and the harness is built.
- **One mating site is one harness end.** Every harness connection drawn from the same connector, or from any of its sub-ports, joins the same harness block. The connector takes one housing.
  - A pin shared by two destinations becomes a **splice**, created automatically and flagged for confirmation.
  - A header that really takes two housings is declared as two mating sites.
- **Example: one 30-pin connector J1 on PCB-1**, with 10 pins to PCB-2, 20 to PCB-3, and 2 of PCB-2's signals also going to PCB-3:
  - it is one harness with three ends, a branch and two splices;
  - you draw it as two wires from two overlapping sub-ports of J1.
- **An incomplete pin mapping is a warning,** never silently filled.

### 2.5 The harness model

The first cut has every object. Electrical continuity lives only in wires and splices. Physical membership (which wire is in which cable or covered segment) is explicit. Geometry is always derived; only what the user pins is stored.

| Object | Content |
|---|---|
| End | a mating site (connector or sub-port of an occurrence); housing and contact parts, optional until chosen; pin map; boot length |
| Wire | between two contacts or splices: gauge, colour, length, label |
| Splice | joins several wires, with its method (crimp, solder) |
| Branch point | where the bundle physically divides (not an electrical join); created from the topology, movable in 3D |
| Covering | sleeve, heat shrink, tape or zip ties on a segment between branch points; affects diameter and BOM |
| Cable | a jacketed multi-conductor part; its conductors map to wires, and a shield drain is a conductor |
| Pigtail / loose end | an end left open, for a later termination or a test point |
| Label / marker | printed wire labels and heat-shrink markers along a wire |

**Default wiring of a new harness connection**, first match wins per pin:
1. **Sub-port order:** a source sub-port the same size as the target maps in order.
2. **Matching net names** across the two boards.
3. **Unmapped otherwise:** never pin N to pin N when the counts differ. Unmapped pins show as open contacts with a warning and one-click generators: same pin, reversed, or in order from a chosen start.

Two refinements:
- **Duplicate nets.** Several pins on one net (four GND on one side, two on the other) pair in pin order, and splices are offered for the extras, flagged.
- **Power and ground joins** are shown as "suggested" until confirmed.

This is a trial. If the suggestions get in the way, the fallback is a blank configurator showing only the instantiated ends.

**Harness parts** (housings, contacts, sleeves, labels and markers) are ordinary catalog parts with harness attributes:
- a housing: pin count, the board connectors it mates (the existing "mates with" relation), and its contact family;
- a contact: gauge range;
- a sleeve: diameter range and shrink ratio.

The harness tab can quick-create a missing part into Library Manager, with those fields pre-filled. This is a context-scoped entry point to the component database; the part then follows the normal catalog review.

### 2.6 Placement and geometry

- **Mated occurrences derive their pose** from their positioning mate: the connector frames from the bundles, the chosen orientation, the stack height, and an optional **offset override** stored on the mate (spacers, a tilted fit). Moving a root moves its whole mated stack.
- **Free occurrences store a pose:** translation and rotation in the system frame. These are roots, and things bolted into a body.
- **Several mates.** When an occurrence has more than one mate, the positioning mate is chosen automatically as a spanning tree from the root, and the user can switch it. The other mates are checked for agreement within a tolerance; a mismatch is a finding ("J5 ↔ J9 misaligned by 0.4 mm").
- **A new occurrence** is instantiated with its 3D model beside the bounding box of what is already placed, and the user moves it. There is no separate "unplaced" UI.
- **Harness geometry** is derived from:
  - its ends' connector frames;
  - the branch points the user placed;
  - the waypoints the user pinned.

  Lengths, bend checks and collisions with the analytic boards are computed in the system bundle (§3.3).
- **Board-less systems.** Connector parts are placed on a body's faces in 3D. This replaces today's module-connector picker, using the same frame conventions: face frame, part mating frame, quarter turns.

### 2.7 Source changes

- **A pinned occurrence** never changes. A badge shows how many commits it is behind, and offers to update.
- **A followed occurrence advances and flags.** When a new commit's bundle is built, the occurrence always advances. Prism diffs the two bundles' interfaces (connectors, pins, nets, connector frames) against this system's connections:
  - **Nothing used changed:** advance silently, recorded in history.
  - **Something used changed:** findings on the affected connections. For example "J1.12 was CAN_H, now CAN_TX: harness H1 wire 12", or "J4 moved 2 mm: the mapping of J4 ↔ J9 was re-derived". A "changes since your last review" marker is shown until acknowledged.
  - **A used pin or connector disappeared:** the connection is broken (shown red). The occurrence still advances.
- **Snapshots and published entries** pin exact revisions, so a release never moves.
- **Today's blocking review is removed:** holding the old baseline until someone accepts, remaps or rebases.

### 2.8 Hierarchy

- **Sheets (first cut).** One system can be organised into hierarchical sheets, like KiCad's. They are navigated by breadcrumb inside the schematic tab, with no publishing and no versioning.
- **Published entries (first cut).** Placing a published entry in another system is in the first cut, because bought-out units need it:
  - its symbol's pins are its exports;
  - nets resolve through it to the physical pin for tracing;
  - its insides open read-only, or editable for its owner.
- **Later.** Following new revisions of a published entry, child drift and hierarchy limits come in a later stage (confirmed on acceptance).

## 3. Storage

### 3.1 The document

- **One document per system.** A system is one versioned JSON document, `prism.system.v2`. It holds only what the user decided:
  - occurrences, with the revision or branch;
  - board-level sub-port references and occurrence-level sub-ports;
  - B2B mates (orientation, stack height, offset, manual overrides);
  - harness blocks with their full internals;
  - sheets, and the schematic layout (presentation only);
  - free poses, positioning-mate choices, placed branch points and pinned waypoints;
  - exports and waivers.
- **No derived data.** It holds no derived data and no copies of board data. Unknown fields are rejected.
- **Board-level sub-ports** live outside the system, Prism-side against the project and connector, because every system that uses the board shares them.

### 3.2 Operations

- **Every edit is an operation** (`prism.system.ops.a0`): add an occurrence, connect, group pins, promote a sub-port, set an orientation, add a splice, place a waypoint, and so on.
- **Each operation is validated and applied atomically,** and bumps the document version. Concurrent edits are refused on a version conflict.
- **The UI and `window.prismSystemBuilder` call the same operations.** There is no other write path.
- **The operation log** is the system's history and undo stack.
- **A snapshot** is the document at a version.
- **Git:** a system linked to a Git branch commits the document as a file.
- **Postgres** keeps documents, the operation log, snapshots, permissions and caches. There is no table per concept.

### 3.3 The system bundle

- **What it is.** Derived state is a *system bundle*, keyed by the document version plus each occurrence's bundle key (and each published entry's revision). It is built by a job in the ordinary queue, like a design bundle. It holds:
  - system nets;
  - derived B2B mappings;
  - harness wire lists and default wiring;
  - placement and harness geometry (routes, lengths, bends, collisions);
  - findings;
  - the outputs of §5.
- **Readiness is staged.** Connectivity is available before geometry, and geometry before outputs.
- **Members that are not ready.** A board whose bundle is not ready yet queues its build under the usual consumer policy, and the system shows that board as pending.
- **Language.** Geometry and connectivity work over board bundles is written in Rust where the board work already lives; orchestration stays in Python.

## 4. The UI

### 4.1 Tabs and panes

Views are tabs, like browser tabs. A tab fills the workspace, or two tabs sit side by side, or stacked: two panes at most.

| Tab | Content |
|---|---|
| System schematic | one per system; sheets by breadcrumb inside the tab |
| 3D | one per system; the hero view |
| Harness `H1` | one per harness: the configurator, and that harness's route |
| B2B `J1 ↔ J4` | one per mate: orientation and the derived mapping |
| Review | findings, source changes, waivers |
| ICD / Outputs | documents and exports |
| Board | the board's own Visualiser at its revision |

- **Synced selection.** Selection is synced across both visible panes. Selecting `J1.CAN` in the schematic frames it in 3D, highlights its wires in an open harness tab, and filters Review.
- **Unlinking.** A tab can be unlinked to hold its own selection.
- **Edits are always live everywhere.**
- **Persistence.** Open tabs and the split persist per user and system, and can be linked by URL.
- **Default layout.** On a wide screen the workspace opens with the schematic and 3D side by side. On a narrow one it shows tabs, with 3D first.

### 4.2 What is authored where

- **Schematic: connectivity.** Occurrences, sub-ports, B2B and harness wires, sheets, harness blocks.
- **3D: physical facts.** Placement and offsets, B2B orientation (which drives the B2B mapping), harness branch points and waypoints, connector placement on bodies.
- **Either:**
  - add or remove an occurrence; a board dropped into 3D gets a symbol, and a symbol added in the schematic gets its model in 3D (§2.6);
  - make a connection; dragging from connector to connector in 3D, then choosing B2B or harness, creates the same connection the schematic would.
- **Schematic beside harness.** This is the pairing the split is designed for. Pins or a sub-port dragged from an unfolded connector in the schematic onto a harness end's contacts create wires. Selecting a wire in the harness tab highlights both its pins in the schematic.
- **The old shell goes:** the permanent outline, inspector and bottom tray. Details appear contextually, for the selected object.

### 4.3 Mockups

Before stage 2, high-fidelity mockups are reviewed by the maintainer:
- the system schematic with unfolding and sub-ports;
- the harness tab beside the schematic;
- the B2B tab;
- a board-less module system.

They run alongside V2c (§7).

## 5. Outputs (first cut)

| Output | Note |
|---|---|
| Harness document (PDF, SVG) | WireViz-like: connector pinout tables, the wires drawn between them, cable and splice boxes, wiring table and BOM. Rendered by the Release Studio document engine, so it shares its look |
| Harness wiring list and BOM (CSV) | |
| Harness YAML | our own schema, `prism.harness.v1`, for downstream tools; it carries branch points, coverings and cables with shields, which WireViz's format cannot (confirmed on acceptance: not WireViz-compatible; open question 5 keeps a WireViz export for later) |
| ICD (HTML, PDF, CSV) | system connectors, pin-to-pin across every connection, system nets |
| STEP assembly | from the derived placement and harness geometry |
| `prism.system.v2` | the document itself |

- **Later:** a snapshot diff (the document diff stands in until then).
- **Dropped:**
  - WireViz YAML;
  - the separate findings, review and rename-proposal reports, since findings live in Review and the ICD can include them.

## 6. What is deleted, and what is reused

The old System Builder is deleted from the feature branch, with no side-by-side switch.

**Stage 0 is one deletion pull request, after V2c.** It removes:
- System Builder's frontend (`frontend/src/features/system-builder/`), API (`api/systems*.py`), services (`backend/app/services/systems/`), and its workspace tables and migrations;
- the catalog's `module` and `assembly` paths;
- the whole mesh path: the `webgpu_3d` job, the mesh half of `semantic_visualizer_service.py`, `semantic_viewer_runtime.py`, the topology compiler (`kicad-prism-viewer/pipeline/topology_compiler/`) and the viewer's mesh loader;
- `PRISM_DESIGN_SOURCE_VIEWER_3D`, and `PRISM_DESIGN_SOURCE_SYSTEM_BUILDER`.

This is everything amendment V2 §2.3 left to V2b. The feature branch then has no System Builder until stage 2 lands.

**Kept or parked for reuse before deleting:**
- frame and mate maths (`placement/`, CONTRACTS_P2 §14);
- connector detection;
- harness curve, bend and length code;
- the module-connector 3D picker;
- the ICD and harness drawing layouts.

Each is listed in the stage-0 pull request, either kept in place for stage 1 to take over or moved to a parked location.

**Stage 0, as done (2026-10-19):**
- *Kept in place:* both `placement/` packages (`backend/app/services/systems/placement/` and `frontend/src/features/system-builder/placement/`, minus the module scene that drew v1's scene types), their tests, the shared goldens in `backend/tests/fixtures/system_builder/`, and `connector_detection.py`. The mezzanine connector geometry v1 extracted at test time is frozen as `p2/goldens/mezzanine_ends.json`, so the datasheet mate test runs without the extractor.
- *Parked by reference* (bound to v1's model, read them at `59b3e190`): the ICD (`backend/app/services/systems/icd.py`, `frontend/src/features/system-builder/workspace/icd-view.tsx`), the harness drawing (`systems/harness_drawing.py`, `harness_outputs.py`, `frontend/src/features/system-builder/harness-drawing-viewer.tsx`) and the module-connector picker (`frontend/src/components/workspace/library-module-interface.tsx`, `library-module-connector-dialog.tsx`, `module-face-picker.tsx`, `placement/module-scene.ts`).
- *Old data is dropped, not migrated.* Workspace migration 123 drops every `system_*` table, and 124 drops `ws_webgpu_ready`; the registry no longer lists migrations 26–54 (but 41). Catalog migration 13 drops `catalog_module_connectors` and **hard-deletes** every `module` and `assembly` component with what cascades from it, then allows only `part`. The catalog otherwise never hard-deletes a component (its delete is an audited tombstone); this is the one exception, approved by the maintainer for the retired kinds.
- *Kept for the new model:* "mates with" and model alignment, now the catalog's `part_relations` facade and `api/catalog_part_relations.py`.
- *Also gone with the mesh path:* the image's `prism-kicad-native` and Clipper2 helpers and its copy of `kicad-prism-viewer`, the viewer's system mode and standalone page, and the settings only they read.
- *Left for a follow-up:* the viewer's schematic and BOM workspaces, which only the standalone mesh page enabled, and the viewer packages only the mesh writer used.

## 7. Work split

| # | Stage | Contents | Acceptance |
|---|---|---|---|
| — | V2c | Simulation Studio on bundles (amendment V2), first | as amendment V2 §7 |
| 0 | Delete | §6 | the feature branch builds and its suites pass with no System Builder and no mesh path; no `webgpu_3d` job or `topology_compiler` process exists |
| 1 | Format and core | `prism.system.v2`, the operations API, the system bundle job (nets, B2B mappings, findings), board-level sub-ports, publishing and placing published entries, snapshots and Git; headless | operation and system-bundle tests on corpus boards: system nets traced through boards, B2B mappings derived from geometry, the three-board split-and-splice example of §2.4 |
| 2 | Shell and schematic | tabs and panes with sync; the system schematic with symbols, unfolding, the three ways to make sub-ports, B2B and harness wires, harness blocks, sheets; adding and removing occurrences | maintainer review against the mockups |
| 3 | 3D | analytic boards per occurrence from their bundles; mate-derived placement with offsets; the B2B tab; bodies and connector placement for board-less systems | amendment V2's System Builder budgets (five boards: every board drawn ≤ 3 s; exploded GPU p95 ≤ 16.7 ms) |
| 4 | Harness | the harness tab with every object of §2.5, its defaults, harness catalog parts with quick-create, routing and geometry in 3D, the harness document and YAML | the harness fixtures: direct two-end harness; three-end fanout with splices; a four-conductor shielded cable; unknown gauge; unknown cable OD; a covered bundle; a tight bend; a board collision; a connector revision change |
| 5 | ICD and STEP | §5's ICD and STEP assembly | the ICD and STEP of a corpus system; a bought-out unit with several connectors modelled as a board-less system, published and placed |

**Process.**
- One stage at a time on the main thread, as for the bundle work.
- Each stage is a pull request into `feature/native-design-bundle`.
- Mechanical chunks may be offloaded under the usual rules.

## 8. Open questions (settled in the stages that need them)

1. **Permissions and redaction** of restricted boards in the document, the system bundle and outputs. Today's rule: visible by label, hiding project, commit, pins and nets.
2. **The findings catalogue:** today's SYS-V codes, rewritten for the new model.
3. **ICD contents and layout.**
4. **Limits:** occurrences, connections, harness ends and document size.
5. **The `prism.harness.v1` schema**, and whether a WireViz-compatible export is worth adding later.
6. **The exact operation set** of `prism.system.ops.a0`, and its undo semantics across operations that cascade (deleting an occurrence that harnesses use).
7. **Placement details:** the spanning-tree tie-break when several mates could position an occurrence, and the agreement tolerance.

## 9. Text changes on acceptance

Applied with stage 0.

1. **Amendment V2:**
   - §2.3: "V2b" becomes "System Builder v2, stage 0".
   - §3 and V2b's rows in §7–§8 point here.
   - V2c no longer waits on V2b.
2. **Parent ADR §9.6:** the C4b row points here.
3. **System Builder docs:** `docs/system-builder/README.md` notes that `CONTRACTS.md`, `CONTRACTS_P2.md`, `USER_GUIDE.md` and `schemas/system_manifest.v1.schema.json` describe the system this ADR replaces. They are deleted in stage 0, and the new contracts are written in stage 1.
