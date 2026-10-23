# Field map: `projections/placements.json` (`prism.placements.a1`)

Root model `PlacementsA1` in `tsp/prism/placements-a1.tsp`. Example `examples/PlacementsA1.example.json`.
Written by: P3, `native/src/rs/prism-projections/src/placements.rs`. Stage: parse.

Today no single document holds these facts. Three consumers each load the board through Python kicad_monkey 2026.9.7 or scan its text, and read placement facts from it:

- **Release Studio** builds the `testpoints`, `population` and `designators` projections from one `KiCadPcb` parse (`backend/app/release_studio/document_pipeline.py:251`, `:273-281`). The first two go into the dossier's `projection_digests` (`backend/app/release_studio/dossier.py:367`, `:477-478`).
- **System Builder** writes per-footprint `geometry` and `boardOutlineMm` into `prism.system_interface.v1` (`backend/app/services/systems/interface_extractor.py:213-321`, `:384`, `:448`, `:459`). Connector frames and mating read them (`backend/app/services/systems/placement/frames.py`, `…/placement/mate.py` and their TypeScript twins).
- **Catalog project-component import** slices each `(footprint …)` form out of the board text and lists its model references (`backend/app/services/project_component_asset_extractor.py:300-310`, `:99`).

This member gives them all the same facts, from one parse, in nanometres.

Abbreviations used below: `rsp` = `backend/app/release_studio/projections.py`, `rsd` = `backend/app/release_studio/document_pipeline.py`, `rst` = `backend/app/release_studio/documents/tables.py`, `rss` = `backend/app/release_studio/documents/sheets.py`, `rsa` = `backend/app/release_studio/documents/artwork.py`, `ie` = `backend/app/services/systems/interface_extractor.py`, `fr` = `backend/app/services/systems/placement/frames.py`, `mt` = `backend/app/services/systems/placement/mate.py`, `frts` = `frontend/src/features/system-builder/placement/frames.ts`, `mtts` = `frontend/src/features/system-builder/placement/mate.ts`, `pcae` = `backend/app/services/project_component_asset_extractor.py`, `dos` = `backend/app/release_studio/dossier.py`. A `fork:` path is relative to `src/rs/kicad-monkey-core/src/` at `b6316117`.

## Decisions taken in this contract

### Pad geometry detail: coarse pad facts only; drills and exact copper stay in the materialization

What each consumer reads of a pad today:

| Consumer | Reads | Path |
|---|---|---|
| System Builder connector frame and mating | `pad` (number) and `positionMm` only | `fr:35`, `:45`, `:54`, `:60`, `:131`, `:142-144`, `:212`; `mt:62`, `:104`; `frts:81`, `:92`, `:107`, `:198-200`, `:266`; `mtts:89`, `:139` |
| System Builder interface v1 | writes `sizeMm`, `shape`, `tht` into the payload and its digest (`ie:229-234`, `:41-61`) | no code reads them back; `frts:16-18` only declares them |
| Release Studio | no pad fact | `rsp:518-636` |
| Catalog import | the footprint form's text, not parsed geometry | `pcae:97-123` |
| Analytic 3D tab, Simulation Studio (reference branch) | pads, drills and holes from the materialization | ref: `kicad-prism-viewer/viewer/src/analytic-pack.js:65-90`; fork `materialization-a0.tsp` `HoleOperation`, `BindingEntry.pad_number` |

Decision:

- **In placements:**
  - the pad `number`;
  - the board-absolute anchor `positionNm`;
  - the KiCad `type` and `shape` tokens and `size`.

  These are exactly the inputs of System Builder's v1 pad record, so the P3 golden check covers every v1 geometry field (`ie:226-235`). They are KiCad file facts, cost about 40 bytes per pad and are available at stage `parse`. System Builder needs nothing later than stage `parse` (ADR §4.4).
- **Not in placements:**
  - drills (no parse-stage reader anywhere);
  - roundrect ratios, chamfers, trapezoid deltas, custom-pad primitives;
  - pad layers, margins, nets, pad angle.

  The materialization holds exact copper, holes and drills at stage `board` (fork `materialization-a0.tsp:481-494`, `HoleOperation`). The analytic tab and Simulation Studio already wait for that stage. Pad nets are `prism.semantic_index.a1`'s (terminals).

### Courtyard: an axis-aligned box, footprint-local

Every reader takes the courtyard's box and nothing else:

- System Builder takes the box centre (`fr:84-92`, `frts:139-150`) and the box × an assumed height (`mt:100-102`, `mtts:135-137`).
- The materialization's `Component.body_bounds` is the same kind of box at stage `board` (fork `materialization-a0.tsp:487-488`).
- No reader wants the polygon.

So the courtyard is `courtyardBounds`, in the footprint frame the file uses, which is the frame System Builder computes its courtyard in (`ie:180-196`, `:237-242`). The point rule is the one `outlineBounds` uses, with true arc extents. Today's courtyard rule takes only an arc's start, mid and end points; on all 467 courtyards in the fixtures the two rules agree (divergence D3).

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array,
`{key}` is every key of a map. One row per leaf and per array/map.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.placements.a1"` | — | required | new | `backend/app/services/design_bundle/` reader (K) switches on it | — |
| `/footprints` | `PlacementsFootprint[]` | — | required, may be empty; file order (source offset); `uuid` unique | `rsp:571`, `:612` and `ie:257` iterate `pcb.footprints` in file order; `pcae:302` `iter_forms(text, "footprint")` in file order | RS testpoints in this order (`rsp:612-631`, digest-relevant); System Builder "first footprint wins" on a repeated reference (`ie:255-262`); C7 | same order as today. The rows dropped by rule R2 never occur in KiCad 9/10 files or in any fixture |
| `/footprints/*/uuid` | `KiCadUuid` | — | required; unique | fork `pcb.rs:365`, `pcb/decode.rs:191-193` (`uuid` or `tstamp`) | C7 lookup by `pcbRefs[].footprintUuid` (`pcae:385-394`); join with `prism.occurrences.a0` `footprints[*].uuid` | `pcae:304-306` also indexes pad and graphic uuids inside the form; the member has only the footprint's own |
| `/footprints/*/reference` | `Refdes` | — | optional; absent = no `Reference` property and no `fp_text reference`, or both empty | `rsp:639-648` (`Reference` property, then `fp_text reference`); fork `pcb/decode.rs:166-167` (property only) | RS testpoints `ref` (`rsp:613-619`), population (`rsp:572`), designators (`rsp:538`); SB geometry key (`ie:255-262`); C7 `footprints_by_reference` (`pcae:309`, `:396`) | identical to RS on every fixture. v1 reads the property only (`ie:173-177`), so KiCad 7 boards have no SB geometry today (D4) |
| `/footprints/*/libId` | `LibId` | — | optional; absent = empty library link | fork `pcb.rs:354`; kicad_monkey `library_link` (`ie:248`) | SB `footprintName` = text after the last `:` (`ie:248`); `fr:81` and `frts:136` match `_vertical`/`_horizontal` in it | v1 derives `footprintName` from it, equal on every fixture |
| `/footprints/*/side` | `Side` | — | required | `layer.startswith("B.")` (`rsp:574-575`, `:620`; `ie:244-245`) | RS `side` `"top"`/`"bottom"` (`rst:476-490`, `rss:853`, `:939`); SB `side` (`fr:80`, `:205`) | `front` ↔ today's `"top"`, `back` ↔ `"bottom"` |
| `/footprints/*/positionNm` | `PointNm` | nm | required; board-absolute, y down | footprint `(at x y …)`: `at_x`/`at_y` (`rsp:621-622`, `ie:217`); fork `pcb.rs:358-359` | — | — |
| `/footprints/*/positionNm/xNm` | `Nanometres` | nm | required | as above | RS testpoint `x` = `xNm / 1e6` (`rsp:621` → `rst:518`); SB `positionMm[0]` = `round(xNm/1e6, 4)` (`ie:246` → `fr:35`, `mt:108`) | exact: the file has ≤ 6 decimals, so `xNm/1e6` is the parsed double |
| `/footprints/*/positionNm/yNm` | `Nanometres` | nm | required | as above | RS testpoint `y` = `yNm / 1e6` (`rsp:622` → `rst:519`); SB `positionMm[1]` = `round(-yNm/1e6, 4)` (y-up, `ie:246`) | exact, as above |
| `/footprints/*/rotationDeg` | `Degrees` | ° | required; as written, 0 when omitted | `at_angle` (`rsp:623`; `ie:215`); fork `pcb.rs:360` | SB `rotationDeg` = `round(θ, 4)` (`ie:247` → `fr:34`, `:40`; `mt:107`); RS testpoint `rotation` = `null` when 0, else θ (`rsp:623`) | RS writes `null` for an omitted angle and KiCad never writes a zero angle, so 0 ↔ `null` (D1) |
| `/footprints/*/dnp` | boolean | — | required | `is_dnp` (`rsp:577`) | RS population `dnp`/`fitted` (`rsp:577-580` → `rss:861-863`) | identical. Board attribute only, never variant-resolved: that is `prism.semantic_index.a1` `assembly` |
| `/footprints/*/excludeFromPosFiles` | boolean | — | required | `is_excluded_from_pos_files` (`rsp:581`, `:627-629`) | RS population `absent_from_position_file` (`rss:866`), testpoint `excluded_from_position_file` (`rsp:627`) | identical |
| `/footprints/*/courtyardBounds` | `PlacementsBounds` | nm | optional; absent = no graphic on `F.CrtYd`/`B.CrtYd`; footprint-local, y down | `_courtyard_points` (`ie:180-196`) → box (`ie:237-242`) | SB `courtyard` (`fr:84-92`, `mt:100-102`, `frts:139-150`, `mtts:135-137`) | v1 is y-up: `minMm = [minX, −maxY]`, `maxMm = [maxX, −minY]`, each `round(·/1e6, 4)`. Equal on all 467 fixture courtyards (D3) |
| `/footprints/*/courtyardBounds/minNm/xNm` | `Nanometres` | nm | required in its object | min x of the courtyard points | SB `courtyard.minMm[0]` | as above |
| `/footprints/*/courtyardBounds/minNm/yNm` | `Nanometres` | nm | required in its object | min y (y down) | SB `courtyard.maxMm[1]` = `−minNm.yNm/1e6` | as above |
| `/footprints/*/courtyardBounds/maxNm/xNm` | `Nanometres` | nm | required in its object | max x | SB `courtyard.maxMm[0]` | as above |
| `/footprints/*/courtyardBounds/maxNm/yNm` | `Nanometres` | nm | required in its object | max y (y down) | SB `courtyard.minMm[1]` = `−maxNm.yNm/1e6` | as above |
| `/footprints/*/pads` | `PlacementsPad[]` | — | required, may be empty; file order | `footprint.pads` in file order (`ie:226`) | SB `pads`, which v1 sorts by `_natural(pad)` (`ie:236`; natural order, conventions §9; Python's stable sort keeps file order on ties) | readers sort; the member mirrors the file |
| `/footprints/*/pads/*/number` | `PadNumber` | — | required; may be `""` | `pad.number` (`ie:230`); fork `pcb/pads.rs:36` | SB `pad` (`fr:54`, `:131` numbered vs. mounting pads; `fr:130-135` pad one; `mt:62`) | identical |
| `/footprints/*/pads/*/type` | `PlacementsPadType` | — | required | `pad.pad_type` (`ie:227`); fork `pcb/pads.rs:37` (`kind`) | SB `tht` = type ∈ {`thru_hole`, `np_thru_hole`} (`ie:234`) | identical |
| `/footprints/*/pads/*/shape` | `PlacementsPadShape` | — | required | `pad.shape.name.lower()` (`ie:233`; kicad_monkey `PadShape` values are the file tokens); fork `pcb/pads.rs:38` | SB `shape` (`ie:233`) | identical |
| `/footprints/*/pads/*/positionNm` | `PointNm` | nm | required; board-absolute, y down | `board(pad.at_x, pad.at_y)` (`ie:219-223`, `:231`) | SB `positionMm` = `[round(x/1e6,4), round(−y/1e6,4)]` (`fr:35`, `:45`, `:60`, `:142-144`, `:212`; `mt:62`, `:104`) | equal on every fixture pad (all at right angles). At other angles it can differ by 1e-4 mm in v1's last digit (D2). Agrees with KiCad 10.0.6's own pad positions (see "Evidence") |
| `/footprints/*/pads/*/positionNm/xNm` | `Nanometres` | nm | required | as above | as above | as above |
| `/footprints/*/pads/*/positionNm/yNm` | `Nanometres` | nm | required | as above | as above | as above |
| `/footprints/*/pads/*/size` | `PlacementsPadSize` | nm | required | `(size x y)`: `pad.size_x`/`size_y` (`ie:232`); fork `pcb/pads.rs:42-43` | SB `sizeMm` | — |
| `/footprints/*/pads/*/size/xNm` | `NonNegativeNanometres` | nm | required | `pad.size_x` | SB `sizeMm[0]` = `round(xNm/1e6, 4)` | exact |
| `/footprints/*/pads/*/size/yNm` | `NonNegativeNanometres` | nm | required | `pad.size_y` | SB `sizeMm[1]` | exact |
| `/footprints/*/models` | `PlacementsModel[]` | — | required, may be empty; file order; hidden included | `footprint.models` (`ie:200`); `model_references(block)` (`pcae:99`, `backend/app/services/kicad_library_reader.py:263-266`) | SB `model` = first with `hidden` false (`ie:199-209`); C7 stages every listed path (`pcae:401-406`, `:457-485`) | C7 needs every path, hidden ones too, so the member lists all of them, not only the "first model" that ADR §6 names (amendment) |
| `/footprints/*/models/*/path` | string, ≥ 1 char | — | required | `model.path` (`ie:205`); fork `pcb.rs:417-431`, `pcb/decode.rs:343` | SB `model.path`; C7 resolution of `${…}` and `kicad-embed://` paths (`pcae:188`, `:401-406`) | as written. Identical to `model_references` on every fixture |
| `/footprints/*/models/*/hidden` | boolean | — | required | `(hide …)` list form (`ie:202`); fork `pcb/decode.rs:306-324` (also the bare `hide` token) | SB skips hidden models (`ie:202`) | differs on KiCad 6/7 boards with a bare `hide` token (D7) |
| `/footprints/*/models/*/offset/xNm` | `Nanometres` | nm | required | `model.offset[0]` (`ie:206`); fork legacy `(at (xyz))` × 25.4 (`pcb/decode.rs:326-336`) | SB `offsetMm[0]` = `round(xNm/1e6, 4)` | exact |
| `/footprints/*/models/*/offset/yNm` | `Nanometres` | nm | required | `model.offset[1]` | SB `offsetMm[1]` | exact; not converted to the board frame (v1 does not convert either) |
| `/footprints/*/models/*/offset/zNm` | `Nanometres` | nm | required | `model.offset[2]` | SB `offsetMm[2]` | exact |
| `/footprints/*/models/*/rotation/xDeg` | `Degrees` | ° | required; 0 when absent | `model.rotate[0]` (`ie:207`); fork `pcb/decode.rs:346` | SB `rotationDeg[0]` = `round(·, 4)` | exact |
| `/footprints/*/models/*/rotation/yDeg` | `Degrees` | ° | required | `model.rotate[1]` | SB `rotationDeg[1]` | exact |
| `/footprints/*/models/*/rotation/zDeg` | `Degrees` | ° | required | `model.rotate[2]` | SB `rotationDeg[2]` | exact |
| `/footprints/*/models/*/scale/x` | float64 | — | required; 1 when absent | `model.scale[0]` (`ie:208`); fork `pcb/decode.rs:345` | SB `scale[0]` = `round(·, 4)` | exact |
| `/footprints/*/models/*/scale/y` | float64 | — | required | `model.scale[1]` | SB `scale[1]` | exact |
| `/footprints/*/models/*/scale/z` | float64 | — | required | `model.scale[2]` | SB `scale[2]` | exact |
| `/footprints/*/sourceSpan` | `PlacementsSourceSpan` | bytes | required | `iter_forms(text, "footprint")` block (`pcae:302`); fork `pcb.rs:389` (`source_range`) | C7 copies the form from `sources/<board>` instead of scanning (`pcae:300-310` today) | bytes equal to today's block on all 548 fixture footprints (sha256) |
| `/footprints/*/sourceSpan/offsetBytes` | `ByteCount` | bytes | required | fork `source_range.start` | C7 | — |
| `/footprints/*/sourceSpan/lengthBytes` | `PlacementsFormLength` (≥ 2) | bytes | required | fork `source_range.end − start` | C7 | — |
| `/designators` | `Refdes[]` | — | required, may be empty; sorted, code point order; unique | `board_designators` (`rsp:518-540`: `sorted({ref.strip()})`) | RS testpoint staging check (`rsd:279-281` → `backend/app/release_studio/documents/engine.py:276` → `rsa:453-470`); System Builder component-body names (C4; today `semantic_geometry.json` designators, `backend/app/services/systems/collision_meshes.py:83`) | today trims whitespace; the member keeps the references as written (D6) |
| `/designators/*` | `Refdes` | — | — | as above | as above | as above |
| `/outlineBounds` | `PlacementsBounds` | nm | optional; absent = no board-level `Edge.Cuts` graphic, or no board; board-absolute, y down | `_board_outline` edge-cuts branch (`ie:304-321`, board-owned carriers only, `:312`; arc extremes `ie:265-288`) | SB `boardOutlineMm` (`ie:459` → `backend/app/services/systems/scene.py:29`, `backend/app/services/systems/store_reviews.py:342-345`) | `minMm = [minX, −maxY]`, `maxMm = [maxX, −minY]`, `source: "edge_cuts"`; equal on 17 fixture boards. v1's `items` fallback is not here (D5) |
| `/outlineBounds/minNm/xNm` | `Nanometres` | nm | required in its object | min x of the outline points | SB `boardOutlineMm.minMm[0]` | as above |
| `/outlineBounds/minNm/yNm` | `Nanometres` | nm | required in its object | min y | SB `boardOutlineMm.maxMm[1]` = `−minNm.yNm/1e6` | as above |
| `/outlineBounds/maxNm/xNm` | `Nanometres` | nm | required in its object | max x | SB `boardOutlineMm.maxMm[0]` | as above |
| `/outlineBounds/maxNm/yNm` | `Nanometres` | nm | required in its object | max y | SB `boardOutlineMm.minMm[1]` = `−maxNm.yNm/1e6` | as above |
| `/auxAxisOrigin` | `PointNm` | nm | optional; absent = the board does not set `(setup (aux_axis_origin …))`, or no board; board-absolute, y down | `(setup (aux_axis_origin x y))` (`prism-kicad-core/src/pcb/setup.rs` `has_aux_axis_origin`, `aux_axis_origin`), converted to integer nanometres as `positionNm` is | JLCPCB CPL (`prism-kicad vendor run jlcpcb`): Mid X = `(xNm − aux.xNm)/1e6`, Mid Y = `(aux.yNm − yNm)/1e6` (ADR amendment C3 §3.3) | a1. Absent means 0,0; today’s Cruncher reads the same origin from the board |
| `/auxAxisOrigin/xNm` | `Nanometres` | nm | required in its object | x of `(aux_axis_origin x y)` | JLCPCB CPL Mid X | as above |
| `/auxAxisOrigin/yNm` | `Nanometres` | nm | required in its object | y of `(aux_axis_origin x y)` | JLCPCB CPL Mid Y (negated) | as above |

No field is nullable. The optional fields are `reference`, `libId`, `courtyardBounds`, `outlineBounds` and `auxAxisOrigin`, each absent for exactly the reason in its row.

### Computation rules (normative for P3)

Lengths are computed in IEEE-754 binary64 millimetres from the parsed values (the correctly rounded double of the file's decimal). Each output coordinate is converted once with conventions §6: `nm = (mm × 1e6).round()`, half away from zero. KiCad writes at most 6 decimals, so a value copied from the file converts exactly. `-0` is written as `0`.

- **R1, input.** The project's board file as committed: the `source-board` member, `revision.config.board`. Never the refilled board, because the spans (R11) refer to the committed bytes; the refill does not move footprints either. Parse it with `PcbView::parse` (fork `pcb.rs:772`). Without a board: `footprints: []`, `designators: []`, no `outlineBounds`, no `auxAxisOrigin`.
- **R2, footprints and identity.** Take `PcbView::footprints()` in source order (fork `pcb.rs:902`). `uuid` is `PcbFootprint.uuid`: the `(uuid …)`, or in a KiCad 7 file the `(tstamp …)` (fork `pcb/decode.rs:191-193`). Leave out a footprint and report it once as a manifest warning when its uuid is:
  - missing;
  - not a canonical `KiCadUuid`;
  - the same as an earlier listed footprint's.

  The code proposed to the manifest owner is `placements-footprint-skipped`, the same rule as occurrences' `occurrences-footprint-without-uuid`. None occurs in the fixtures.
- **R3, reference.**
  - Use `PcbFootprint.reference` (the first `(property "Reference" …)`, fork `pcb/decode.rs:166-167`) when it is non-empty.
  - Otherwise use the text of the footprint's first `(fp_text reference …)` (`PcbView::footprint_texts()`, `kind == "reference"`, same `footprint_index`).
  - Do not trim. Absent when both are empty.

  This is Release Studio's rule (`rsp:639-648`).

  **Core gap:** `footprint_texts()` fails on KiCad 7's `(at x y unlocked)` (fork `pcb/footprints.rs:154-158`). On cynthion, 24 texts fail; none of them is a `reference` text. P3 must decode the texts one by one and tolerate other texts' errors, or the core must accept the token. Python kicad_monkey once had the same problem (`rsp:266-270`).
- **R4, library link.** `libId` is `PcbFootprint.library_link` (fork `pcb.rs:354`) when it is non-empty.
- **R5, side.** `back` when `PcbFootprint.layer` starts with `B.`; otherwise `front`, including when it is absent.
- **R6, anchor and rotation.**
  - `positionNm` is `(at_x, at_y)`, with (0, 0) when absent.
  - `rotationDeg` is `angle` as parsed, 0 when absent (fork `pcb.rs:358-360`).
- **R7, flags.** `dnp` is true when `PcbFootprint.attributes` contains `dnp`, and `excludeFromPosFiles` when it contains `exclude_from_pos_files` (fork `pcb.rs:368`).
- **R8, courtyard.** Take the footprint's graphics (`PcbView::footprint_graphics()`, same `footprint_index`) whose layer is `F.CrtYd` or `B.CrtYd`. Collect their characteristic points in footprint-local millimetres, as parsed:
  - line or rectangle: `start` and `end`;
  - circle: `c ± (r, r)` with `r = hypot(end.x − c.x, end.y − c.y)`;
  - arc: the arc rule below;
  - polygon: every `Xy` element of `polygon_points`, and an `Arc` element by the arc rule;
  - Bézier curve: its control points.

  The box is the minimum and maximum of x and of y, each converted to nm. Stroke widths are ignored.
- **R8a, arc rule** (port of `ie:265-288`, operation for operation). Use start `a`, mid `m` and end `b`.
  1. The points are `[a, m, b]`. Compute `d = 2·(a.x·(m.y−b.y) + m.x·(b.y−a.y) + b.x·(a.y−m.y))`; if `|d| < 1e-12`, stop.
  2. Compute `ux = ((a.x²+a.y²)·(m.y−b.y) + (m.x²+m.y²)·(b.y−a.y) + (b.x²+b.y²)·(a.y−m.y)) / d` and `uy = ((a.x²+a.y²)·(b.x−m.x) + (m.x²+m.y²)·(a.x−b.x) + (b.x²+b.y²)·(m.x−a.x)) / d`. Then `r = hypot(a.x−ux, a.y−uy)`.
  3. Let `ang(p) = floormod(atan2(p.y−uy, p.x−ux), τ)`. `floormod` is Python's `%` for a positive divisor: the truncating remainder, plus τ when it is negative.
  4. Set `start = ang(a)` and `sweep = floormod(ang(b) − start, τ)`. If `floormod(ang(m) − start, τ) > sweep`, set `start = ang(b)` and `sweep = τ − sweep`.
  5. For `k` in 0, 1, 2, 3, let `θ = k·π/2`. If `floormod(θ − start, τ) ≤ sweep`, add `(ux + r·cos θ, uy + r·sin θ)`.
- **R9, pads.** Take `PcbView::pads()` with the same `footprint_index`, in source order.
  - `number`, `type` and `shape` are `PcbPad.number`, `kind` and `shape` (fork `pcb/pads.rs:36-38`).
  - `size` is `(size_x, size_y)`.
  - `positionNm` is KiCad's own placement (maintainer decision; KiCad 10.0.7 `pcb_io_kicad_sexpr_parser.cpp:6013-6016`, `board_item.cpp:413-424`, `trigo.cpp:227-262`, `eda_angle.h:177-215`):
    1. `(lx, ly)` = the pad's `(at …)` and `(ax, ay)` = the footprint's anchor, each converted to integer nm (conventions §6, KiCad's `parseBoardUnits`).
    2. `θ` = the footprint's `rotationDeg` normalized to [0, 360).
    3. At θ = 0, 90, 180, 270 the rotated point is exact: `(lx, ly)`, `(ly, −lx)`, `(−lx, −ly)`, `(−ly, lx)`.
    4. Otherwise `s`, `c` are `EDA_ANGLE::Sin/Cos`: 0, ±1 and ±`M_SQRT1_2` (0.7071067811865476) at multiples of 45°, else `sin`/`cos` of `θ·π/180` through the pure-Rust `libm` crate. The point is `(KiROUND(ly·s + lx·c), KiROUND(ly·c − lx·s))`, half away from zero.
    5. `positionNm` = `(ax, ay)` + the rotated point.

    This is bit-identical to KiCad's pad positions, and to itself across architectures (conventions §14). It replaces the earlier float-mm rule (`ie:219-223`), which P5 keeps for v1 parity (see D2).

  A type or shape token outside the enums is one KiCad rejects; the member then fails with a diagnostic, as KiCad fails to load the board.
- **R10, models.** Take `PcbView::models()` with the same `footprint_index`, in source order, and skip an empty `path`.
  - `hidden` is true exactly when `PcbModelReference.hidden == Some(true)`: `(hide yes)`, `(hide)` or a bare `hide` (fork `pcb/decode.rs:306-324`).
  - `offset` is `offset` with a legacy `(at)` × 25.4 already applied (fork `pcb/decode.rs:326-336`).
  - `rotation` and `scale` are `rotate` and `scale`, with the defaults 0 and 1 (fork `pcb/decode.rs:345-346`).
- **R11, source span.** `PcbFootprint.source_range` (fork `pcb.rs:389`) is the byte range of the form in the UTF-8 source: `offsetBytes = start`, `lengthBytes = end − start`.
- **R12, outline.** Take the top-level `PcbView::graphics()` (fork `pcb.rs:964`) on layer `Edge.Cuts` of kinds line, rect, circle, arc, poly and curve. Text and text boxes are ignored, and footprint-owned Edge.Cuts are not included. Apply the R8 point rules in board-absolute millimetres and take the box. Absent when there is no such graphic.
- **R13, designators.** The distinct `reference`s of the listed footprints, in a `BTreeSet<String>` (code point order).
- **R14, serialization.** Conventions §13: compact `serde_json`, keys in declared order, `-0.0` written as `0`, one trailing LF.

## Derivations of today's values (C3, C4/P5, C7)

Each consumer re-derives today's values from the member alone. The scratch `derive.py` implements every formula below, and the results are in "Evidence".

**Release Studio (C3),** replacing `rsp:518-636` with no `KiCadPcb` load:

- `testpoints`:
  - envelope: `{"source": "board.footprints", "prefix": "TP", "testpoints": [...]}`;
  - one row per footprint, in `/footprints` order, whose `reference.strip().upper()` starts with `"TP"` (`rsp:610-614`);
  - each row is `{"ref": reference, "side": "bottom" if back else "top", "x": xNm/1e6, "y": yNm/1e6, "rotation": null if rotationDeg == 0 else rotationDeg, "excluded_from_position_file": excludeFromPosFiles}`.
- `population`: count footprints with a `reference` per side; count `dnp` against `fitted`, and `excludeFromPosFiles` as `absent_from_position_file` (`rsp:566-583`).
- `designators`: `sorted({r.strip() for r in designators if r.strip()})` (`rsp:535-540`).

All three are equal as canonical JSON (`json.dumps(sort_keys=True)`) on every fixture. Those are the bytes `dossier.projection_digests` hashes (`dos:225-246`), so the dossier and evidence digests are unchanged. That is C3's acceptance.

**System Builder (P5 cross-check; C4).** Per footprint with a `reference`, the first in `/footprints` order:

- `side`: `"bottom"` if back, else `"top"`.
- `positionMm`: `[r4(xNm/1e6), r4(−yNm/1e6)]`, and `rotationDeg`: `r4(rotationDeg)`, where `r4(v) = round(v, 4) + 0.0` (`ie:168-170`).
- `footprintName`: `libId.split(":")[-1]`, or `""`.
- `pads`: each `{"pad": number, "positionMm": [r4(x/1e6), r4(−y/1e6)], "sizeMm": [r4(sx/1e6), r4(sy/1e6)], "shape": shape, "tht": type in ("thru_hole", "np_thru_hole")}`, sorted by `_natural(pad)`.
- `courtyard`: `{"minMm": [r4(minX/1e6), r4(−maxY/1e6)], "maxMm": [r4(maxX/1e6), r4(−minY/1e6)]}`, or `null`.
- `model`: from the first model with `hidden` false, `{path, offsetMm: r4 each /1e6, rotationDeg: r4 each, scale: r4 each}`, or `null`.

`boardOutlineMm` is the box transformed the same way plus `"source": "edge_cuts"` when `outlineBounds` is present.

**P5 computes the v1 document from the core, not from this member.** v1 must reproduce today's digest byte for byte (conventions §14), and three things in it cannot come from this member:

- its reference rule reads the `Reference` property only (D4);
- its `items` outline fallback is kicad_monkey's `get_bounds` (D5);
- its model-hide rule misses the bare `hide` token (D7);
- its 1e-4 mm values come from unrounded doubles (D2).

The two producers can share the Rust footprint walk in `prism-projections`. P3's acceptance against the System Builder goldens is this derivation, with D2's tolerance.

**Catalog import (C7):**

- `footprints_by_uuid[u]` (`pcae:306`, `:394`) is the footprint with `uuid == u`, and its form text is `sources/<board>[offsetBytes : offsetBytes+lengthBytes]`, decoded as UTF-8.
- `footprints_by_reference[r]` (`pcae:309`, `:396`) is the first footprint in `/footprints` order whose `reference` is `r`.
- `model_paths` (`pcae:99`) is `[m.path for m in models]`.

The form bytes still go through `_sanitize_footprint` (`pcae:97-123`) and `kicad_footprint_normalizer` (`pcae:417`), unchanged. Two differences from today:

- Board-level `(embedded_files …)` for `kicad-embed://` models is decoded from the whole board text today (`pcae:322-334`). It is not part of this member (cross-contract note).
- Today's reference lookup reads `(property "Reference" …)` only (`pcae:260-262`). The member also resolves KiCad 7 `fp_text` references, so C7 gains matches on KiCad 7 boards.

## How a golden is produced from today's code

No document of this shape exists today. The goldens are therefore today's consumer values, and the parity test applies the derivations above to the member.

1. **Fixtures:** every committed board:
   - `fixtures/release-studio/{usb-pd,synthetic,cynthion}`;
   - `backend/tests/fixtures/design_variants/*`;
   - `backend/tests/fixtures/system_builder/**` (31 boards, with the read-only USB-PD-Trigger-Board).

   For the corpus, materialize the revision as Release Studio does and use its configured board.
2. **Today's values** (scratch `today.py`), run from `backend/` with `uv run --offline --no-project --python <backend venv python> --with-requirements ../requirements/test.txt` and `PYTHONPATH=.`:
   - Release Studio:
     - `model = rsp.load_board_model(board)`;
     - `rsp.project_testpoints(board, model=model)`;
     - `rsp.project_population(board, model=model)`;
     - `list(rsp.board_designators(board, model=model))`.
   - System Builder: `ie._board_geometry(pcb)` and `ie._board_outline(pcb)` on the same `KiCadPcb`. These are exactly the values `extract_interface` places in `components[*].geometry` and `boardOutlineMm` (`ie:384`, `:448`, `:459`).
   - Catalog: for each `iter_forms(text, "footprint")` block in file order, the sha256 of its UTF-8 bytes, `ProjectAssetSnapshotIndex._reference_from_block(block)` and `model_references(block)`.
3. **Comparison:**
   - Release Studio: canonical-JSON equality.
   - System Builder: per reference, field by field, exact except D2's tolerance (≤ 1e-4 mm on values computed through a rotation that is not a multiple of 90°). References only the member has (D4) are reported, not failed. Boards with `source: "items"` are skipped for the outline (D5).
   - Catalog: span bytes and model paths equal, by index in file order.
4. **KiCad oracle (optional, local).** Run `kicad-cli pcb export ipcd356 -o out.d356 <copy of board>` on a copy, because kicad-cli writes a `.kicad_prl` beside its input. Every numbered pad's `positionNm` must be within half an IPC unit (1e-4 in / 2 = 1.27 µm) of a record with the same reference and pin. Unnumbered SMD pads (paste apertures) have no record.

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| D1 Testpoint footprint with an explicit `(at x y 0)` (hand-written file) | RS `rotation: 0.0` | `rotationDeg: 0`, which C3 maps to `null` | KiCad omits a zero angle, so 0 ↔ omitted holds for every KiCad-written file. The member has one spelling of "no rotation" | RS testpoints digest, on such files only. None in the fixtures |
| D2 Pad anchor (and circle or arc extremes) of a footprint whose rotation is not a multiple of 90° | v1 `round(x_mm, 4)` of the unrounded float-mm rotation | KiCad's integer-nm rotation (R9), so `round(nm/1e6, 4)` can differ by one unit in the 4th decimal in rare cases | it is KiCad's own pad position, on every architecture. v1 itself is P5's and stays exact (P5 computes from the core, decision 1) | P3's SB golden check only. 0 of 3,064 fixture pads (all fixtures use right angles); 9 of 627 SB pads on scratch copies of usb-pd, mezz_top and mezz_base with arbitrary angles |
| D3 Courtyard arc or Bézier | three points per arc; curves ignored (`ie:180-196`) | true arc extents and curve control points | the courtyard's real extent | SB courtyard centre and body box. 0 of 467 fixture courtyards differ |
| D4 KiCad 7 boards (`fp_text reference`): cynthion, synthetic | v1 has no geometry (`ie:173-177`, property only); RS reads `fp_text` (`rsp:645-647`) | `reference` from `fp_text` | matches Release Studio, Design Comparison and occurrences | SB only if it ever reads the member; P5 keeps v1's rule |
| D5 Board without board-level Edge.Cuts (mini_obc, mini_power: 14 fixture boards) | v1 `boardOutlineMm` from kicad_monkey `get_bounds`, `source: "items"` (`ie:316-320`) | `outlineBounds` absent | `get_bounds` is a kicad_monkey heuristic (text and pad extents), not a parse fact that can be specified | P5 keeps the fallback, computed from the core |
| D6 Reference with surrounding whitespace | RS designators trimmed (`rsp:538`) | `designators` as written | ids are copied, never altered (conventions §8); C3 trims when deriving | none: no fixture reference has whitespace |
| D7 KiCad 6/7 model with a bare `hide` token (cynthion U1, U7) | not hidden (`ie:202` matches only the list form), so v1 would pick the hidden model | `hidden: true` | KiCad hides it (fork `pcb/decode.rs:306`) | SB, through v1, on KiCad 6/7 boards; today masked by D4. P5 keeps today's rule for parity |
| D8 Footprint-owned Edge.Cuts | excluded (`ie:312`) | excluded | parity with v1; KiCad's board outline would include them | none on fixtures: usb-pd J1's 6 footprint Edge.Cuts form an inner slot inside the extent |

## Example provenance

`examples/PlacementsA1.example.json` is the scratch Rust prototype's output for `fixtures/release-studio/cynthion/cynthion.kicad_pcb` (KiCad 7 format: `tstamp` ids, `fp_text` references, bare `hide`), trimmed with the scratch `make_example.mjs`:

- `U7` keeps pads 1 and 8 of 8. It is front-side, rotated 180°, and has a hidden and a visible model.
- `J10` keeps one `np_thru_hole` unnumbered pad of 7 and the `connect` pad 1 of 6. It is excluded from position files and has no model.
- `C22` (back side, rotated 90°) and `TP14` (back-side testpoint, excluded from position files) are complete.
- `designators` is recomputed for the four kept footprints. `outlineBounds` and every `sourceSpan` are those of the real file.

The canonical text is `JSON.stringify(doc, null, 2)` plus LF. No fixture has both a back-side footprint and `dnp: true`, so the example shows `dnp` false only; usb-pd has `dnp: true` on R6, R7 and R13.

## Evidence (W0 scratch, not committed)

The scratch directory is `…/scratchpad/w0/placements/`:

- `rust-proto/` is the prototype on fork `b6316117` implementing R1–R14 (`cargo build --offline --release`).
- `today.py` captures today's values, `derive.py` compares, `oracle_d356.py` runs the KiCad oracle, and `make_angles.py` builds the arbitrary-angle copies.

Results:

- **Schema:** `check-contract.mjs` passes on the file, the example and all 31 prototype outputs, and the schema is byte-identical under TypeSpec 1.14.0.
- **Determinism:** two runs give byte-identical output on all 31 boards.
- **Derivations:** across 31 boards, 548 footprints, 3,064 pads and 408 models, there are 0 mismatches:
  - Release Studio testpoints (46 rows), population and designators;
  - System Builder geometry for 195 references, outline on 17 boards;
  - catalog form bytes and model paths for 548 footprints.
- **KiCad 10.0.6 oracle:** 1,790 numbered pads (cynthion, usb-pd, mezz_top, including 253 back-side footprints) are within 0.496 IPC units. On the arbitrary-angle copies, 2,034 pads are within 0.500.
- **Size:** cynthion (6.1 MB board, 348 footprints, 1,472 pads) gives a 391 KB member.
