# Field map: `projections/stackup.json` (`prism.stackup.a0`)

Root model `StackupA0` in `tsp/prism/stackup-a0.tsp`. Example `examples/StackupA0.example.json`.
Written by: WP-P3, `native/src/rs/prism-projections/src/stackup.rs`. Stage: parse.

The member is a superset of today's three stackup shapes:

| Shape | Producer today | Re-derived from this member by |
|---|---|---|
| **RS**: Release Studio `prism.release_studio.stackup.a0` | `backend/app/release_studio/projections.py:324-462` (`project_stackup`) | C3 (rules in "How a golden is produced", RS) |
| **DC**: Design Comparison stackup | `backend/app/services/design_compare_artifacts.py:25-81` (`_extract_stackup`) | C2 (rules: DC) |
| **3D**: 3D pipeline `pcb_metadata.board.stackup` and `board.thickness_mm`, legacy geometry backend (the default: `docker-compose.yml:158`) | `kicad-prism-viewer/pipeline/topology_compiler/pcb_extract.py:222-284`, `:931-990`, `board_metadata.py:101-128` | C5 (rules: 3D) |

It also feeds:
- the System Builder mid-plane (`backend/app/services/systems/bundles.py:21-37`, C4);
- the analytic tab's mask colours (ref: `kicad-prism-viewer/pipeline/topology_compiler/board_looks.py:46-87`, C5/V1);
- Simulation Studio (C6).

On every committed fixture tried, all three shapes, the mid-plane and the board looks re-derive exactly from a prototype of this member ("How a golden is produced").

Sources for the Rust producer:
- the fork's parsed model: `fork: src/rs/kicad-monkey-core/src/pcb/setup.rs:40-74` (stackup, sub-layers), `:169-260` (parse);
- `fork: src/rs/kicad-monkey-core/src/pcb/extended.rs:10,159-160` (board thickness, default 1.6);
- `fork: src/rs/kicad-monkey-core/src/pcb.rs:330-336` (layer table);
- `fork: src/rs/kicad-monkey-core/src/pcb/vias.rs:13-38,63-78` and `pcb/manufacturing.rs:12-16` (vias, drills).

One gap: the fork's `PcbStackup` has no `castellated_pads` (see the P3 rules).

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array,
`{key}` is every key of a map. One row per leaf and per array/map.

Abbreviations:
- `rs:` is `backend/app/release_studio/projections.py`;
- `dc:` is `backend/app/services/design_compare_artifacts.py`;
- `pe:` is `kicad-prism-viewer/pipeline/topology_compiler/pcb_extract.py`;
- `bm:` is `…/topology_compiler/board_metadata.py`;
- `cc:` is `…/topology_compiler/compiler.py`;
- `km:` is the installed `kicad_monkey` 2026.9.7 package (`kicad_pcb_other.py` unless named);
- `vjs:` is `kicad-prism-viewer/viewer/src/main.js`;
- `tbl:` is `backend/app/release_studio/documents/tables.py`;
- `sp:` is `frontend/src/components/design-comparison/stackup-panel.tsx`.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.stackup.a0"` | — | required | new (conventions §4) | `backend/app/services/design_bundle/` reader (K) | not in any of today's shapes |
| `/present` | `boolean` | — | required | RS `present` `rs:435`; DC `present` `dc:81` (= any layer read); 3D: always `true` in the legacy backend (`bm:41` default, not passed at `pe:976-988`) | RS `document_pipeline.py:253`; DC `design_compare_service.py:1135` → `sp:165`; 3D `cc:196-198` | RS: equal. DC: `present && layers.length > 0`. 3D: constant `true` |
| `/boardThicknessNm` | `NonNegativeNanometres` | nm | required; KiCad default 1 600 000 when `(general (thickness))` is absent | RS `board_thickness` `rs:445` (km `kicad_pcb.py:290`, default 1.6); 3D `pe:947` (`pcb.thickness or 1.6`); fork `extended.rs:159-160` | RS (dossier digest); 3D synthetic stack `pe:224,273-279`, `pe:947`; system interface `boardThicknessMm` `backend/app/services/systems/interface_extractor.py:458` (P5) | RS mm = nm / 1e6, `or None` |
| `/stackThicknessNm` | `NonNegativeNanometres` | nm | optional; absent when `present` is false, there is no copper/dielectric/soldermask entry, or one of them has no thickness | RS `total_thickness` `rs:393-407` (same rule, float mm); 3D `computed_thickness_mm` `pe:947-950` (km `get_board_thickness`, `:871`) | RS (dossier digest); 3D `cc:199` (copied into the topology's `board.stackup`; no viewer code reads it, `vjs:6151` re-sums layer thickness itself) | RS adapter re-sums per-entry mm floats as today (see RS rules), not nm / 1e6; equal on every fixture. Includes sub-layers; today does not (divergence D1) |
| `/layers` | `StackupLayer[]` | — | required; in stack order from front to back (file order of `(layer …)` forms; sub-layers consecutive) | RS `rs:346-366`; DC `dc:52-67`; 3D `pe:228-244`; fork `setup.rs:176-184` | `tbl:316-346`, `documents/acquisition.py:76-98`, `sp:10-16,112-141`, `design_compare_nodes.py:518-545`, `cc:73-142`, `vjs:6081-6340`, C6 | today one row per form; this member one entry per sub-layer (D1). Empty when `present` is false: RS then uses `boardLayers`, 3D synthesises a stack |
| `/layers/*/name` | `string` (min 1) | — | required | RS `rs:351`, DC `dc:60`, 3D `pe:232`; fork `setup.rs:202` | `tbl:329`, `acquisition.py:86`, `sp:10,119-121`, `design_compare_nodes.py:526`, `cc:120`, `vjs` (names), `board_looks.py:25,51-56` (ref) | equal |
| `/layers/*/sublayer` | `Count` | — | required; 0 for a form's own values, n after the n-th `addsublayer` | new; fork `setup.rs:59-61,204-230` keeps sub-layers (as `sublayers`), km drops them (`:741-766`) | the readers' fold to one row per form (rules below); C2/C3/C5 per-sub-layer rows (open question 1) | today has no equivalent |
| `/layers/*/kind` | `StackupLayerKind` | — | required | RS `kind` `rs:102-115` (`mask` for `soldermask`); 3D `role` `pe:347-352` via km `get_item_type` (`:791-805`); fork role `board_materialization/layers.rs:33-46` | `tbl:334`, `acquisition.py:93-96`, `cc:121`, `vjs:6081-6083` | RS adapter recomputes `kind` with `rs:_layer_kind(name, type)` (same value on KiCad-written stackups), 3D with km `get_item_type(type)` |
| `/layers/*/type` | `StackupLayerType` | — | optional; absent when not written or outside the KiCad set | RS `type` `rs:352` (`or None`); DC `type` `dc:56,61` (`""` when absent); 3D `pe:234` | `tbl:334`, `sp:11,112,126`, `vjs:6106-6108` (core/prepreg), 3D role | RS `type or None`; DC `type ?? ""`; 3D `type ?? ""` |
| `/layers/*/thicknessNm` | `StackupPositiveNanometres` | nm | optional; absent when not written or written as 0; never 0 | RS `rs:354` (0 → None, `rs:118-122`); DC `dc:57,62` (regex; misses `locked`); 3D `pe:235` (absent → 0.0); fork `setup.rs:243-254` | `tbl:328,335`, `sp:12,129`, `design_compare_nodes.py:536-544` (via barrel length), `cc:114,119`, `vjs:6121,6338`, mid-plane `bundles.py:30-35`, C6 copper thickness (sim: `contracts/contracts/setup.tsp:46-47`) | mm = nm / 1e6 reproduces the file's double exactly for ≤ 6 decimals (every KiCad-written value); RS `None`, DC `None`, 3D `0.0` when absent. DC divergences D2, D3 |
| `/layers/*/material` | `string` (min 1) | — | optional; absent when not written or empty | RS `rs:353` (km gives `""` when absent); DC `dc:63` (`None`); 3D `pe:236` (`""`, then `_layer_material(role)` default `pe:378`) | `tbl:336`, `sp:13,132`, `cc:139`, `cc:205-211` (materials), `vjs:6100-6110` | RS `?? ""`; DC `?? None`; 3D `?? ""` |
| `/layers/*/epsilonR` | `float64` | — | optional; absent when not written; 0 kept | RS `rs:355` (km: `float(x) if x else None`, `:763`); DC `dc:65` (0 kept); 3D `pe:237` (via km) | `tbl:337`, `sp:15,135`, `cc:143`, `vjs:6090-6093,6131,6336` | RS/3D adapters map 0 → `None` (km truthiness), DC keeps 0 |
| `/layers/*/lossTangent` | `float64` | — | optional; absent when not written; 0 kept | RS `rs:356` (km `:764`); DC `dc:66`; 3D `pe:238` | `sp:16,138`, `cc:144`, `vjs:6132,6337` | as `epsilonR`. Cynthion's prepregs write `(loss_tangent 0)`: RS/3D show `null`, DC `0.0`, this member `0` |
| `/layers/*/color` | `string` (min 1) | — | optional; absent when not written or empty | RS `rs:357` (`""` when absent); DC `dc:64` (`None`); 3D `pe:239` then palette `pe:363-379`; ref `board_looks.py:46-57` | `sp:14,141`, `cc:140`, ref `analytic-renderer.js:835-837` (laminate colour) | RS `?? ""`; DC `?? None`; 3D `?? ""` before its palette |
| `/copperLayers` | `LayerName[]` | — | required; in stack order from front to back | RS `copper_layers` `rs:389`; fork `board_materialization/stack.rs:41-53` (layer-table copper, ranked) | `tbl:108` (count), `rs:136-184` (span resolution), `acquisition.py:76-98`, `vjs` copper order, route metrics (C2), C6 | RS equal (asserted on every fixture) |
| `/copperLayers/*` | `LayerName` | — | — | as above | as above | equal |
| `/settings` | `StackupSettings` | — | optional; absent when `present` is false | RS `settings` `rs:453-458`; DC `settings` `dc:75-80`; 3D `bm:113-128` | `tbl:87`, `sp:41,60,65`, `cc:197-204` | RS: every key `None` when absent; DC: both keys `None`; 3D: `"None"`/`false` defaults |
| `/settings/copperFinish` | `string` (min 1) | — | optional; absent when not written or empty | RS `rs:409-414` (`"None"` when km yields None, `""` when absent); DC `dc:73,76`; 3D `bm:117-118` (`_clean_enum_text` `pe:541-549`, default `"None"`); fork `setup.rs:187-188`; fork materializer `layers.rs:187-189` | `tbl:113`, `sp:60`, `vjs:3569` → `bundle-geometry.js:138-143` (finish colour), `vjs:6417` | RS `?? ""`; DC `?? None`; 3D `_clean_enum_text(v) or "None"` |
| `/settings/dielectricConstraints` | `boolean` | — | required; `false` when the token is absent | RS `rs:415-419`; DC `dc:74,77-79` (`None` when absent); fork `setup.rs:189` | `tbl:114` ("Impedance control"), `sp:65` | DC divergence D4 (token absent only) |
| `/settings/edgeConnector` | `StackupEdgeConnector` | — | required; `none` when the token is absent | RS `rs:420-424` (`None`/`"yes"`/`"bevelled"`); 3D `bm:119-121` (boolean); fork `setup.rs:190-191` (default `"none"`) | `tbl:97-105` ("Edge card connectors"), `vjs:6421` | RS `none → None`; 3D `!= none` |
| `/settings/castellatedPads` | `boolean` | — | required; `false` when absent | 3D only: raw scan `pe:457` → `bm:122-124`; not in km's or the fork's `PcbStackup` | `vjs:6425`; RS reads castellation from KiCad's board stats instead (`tbl:115`) | 3D equal. **P3 gap:** fork `setup.rs:40-47` lacks it |
| `/settings/edgePlating` | `boolean` | — | required; `false` when absent | RS `rs:425-429`; 3D `bm:125-127`; fork `setup.rs:192` | `tbl:117`, `vjs:6429`; ref `analytic-board.js:105` reads it from the pack | equal |
| `/maskColors` | `StackupMaskColors` | — | required (members optional) | ref `board_looks.py:46-57` (`stackup_mask_colors`); same text as `/layers/*/color` of `F.Mask`/`B.Mask` | ref `board_looks.py:76-87` → `kicad_cli_export.py:359` → `analytic-renderer.js:82-85,820-832`, ref `main.js:1505` (C5, V1) | adapter: `back ?? front ?? ""`, then `mask_rgba` (ref `board_looks.py:65-73`) |
| `/maskColors/front` | `string` (min 1) | — | optional | as above | as above | equal |
| `/maskColors/back` | `string` (min 1) | — | optional | as above | as above | equal |
| `/viaSpans` | `StackupViaSpan[]` | — | required; sorted as the TypeSpec doc states (= RS `_via_sort_key`, `rs:162-184`) | RS `via_spans` `rs:187-217,430-432`; fork `vias.rs:63-78` | `tbl:381-412` (VIA STATISTICS), RS `via_count`/`via_type_counts` (`rs:459-461`); C5 may replace `stackup-vias.js:30` (`collectStackupViaData`) | RS equal, including blind, buried, micro, reversed, unresolved and back-drilled groups (edge board) |
| `/viaSpans/*/viaType` | `StackupViaType` | — | required | RS `rs:140` (km `kicad_pcb_routing.py:212-219`); fork `vias.rs:63-66` (same priority: blind, buried, micro) | `tbl:392`, `via_type_counts` | equal |
| `/viaSpans/*/startLayer` | `LayerName` | — | optional; absent when the via names no layer | RS `start_layer` `rs:142,153` | `tbl:389-393` | RS `?? None` |
| `/viaSpans/*/stopLayer` | `LayerName` | — | optional | RS `stop_layer` `rs:143,154` | `tbl:390-393` | RS `?? None` |
| `/viaSpans/*/spanLayers` | `LayerName[]` | — | required; in stack order from front to back; empty = unresolved | RS `span_layers` `rs:144-150` | `tbl:394` (`span_layer_count`) | RS: empty → `span_layers: None`, `span_layer_count: None`; else the list and its length |
| `/viaSpans/*/spanLayers/*` | `LayerName` | — | — | RS `rs:148` (`copper_layers[lo : hi + 1]`) | as above | equal |
| `/viaSpans/*/backdrill` | `StackupViaDrill` | — | optional; absent when none (or neither size nor layers) | RS `backdrill` `rs:125-133,157`; km `DrillProps` (`:224-251`); fork `manufacturing.rs:12-16` | RS dossier digest; KiCad 10 back-drill fabrication (C3) | RS `{size, start_layer, stop_layer}` or `None` |
| `/viaSpans/*/backdrill/sizeNm` | `NonNegativeNanometres` | nm | optional | RS `size` `rs:130` (mm) | as above | mm = nm / 1e6; `None` when absent |
| `/viaSpans/*/backdrill/startLayer` | `LayerName` | — | optional | RS `rs:131` (km `DrillLayerSpan.start`) | as above | `?? None` |
| `/viaSpans/*/backdrill/stopLayer` | `LayerName` | — | optional | RS `rs:132` | as above | `?? None` |
| `/viaSpans/*/tertiaryDrill` | `StackupViaDrill` | — | optional | RS `tertiary_drill` `rs:158` | as `backdrill` | as `backdrill` |
| `/viaSpans/*/tertiaryDrill/sizeNm` | `NonNegativeNanometres` | nm | optional | RS `rs:130` | as above | as above |
| `/viaSpans/*/tertiaryDrill/startLayer` | `LayerName` | — | optional | RS `rs:131` | as above | as above |
| `/viaSpans/*/tertiaryDrill/stopLayer` | `LayerName` | — | optional | RS `rs:132` | as above | as above |
| `/viaSpans/*/count` | `StackupPositiveCount` | — | required, ≥ 1 | RS `count` `rs:213-214` | `tbl:395`; RS `via_count`, `via_type_counts` (sums) | equal |
| `/boardLayers` | `StackupBoardLayer[]` | — | required; in file order | RS no-stackup rows `rs:367-385` (km `KiCadPcb.layers`, file order); 3D synthetic stack `pe:252-271`; fork `pcb.rs:330-336` | RS (no stackup) `tbl:316-346`, `acquisition.py:76-98`; 3D synthetic stack (C5); fork materializer's copper order `stack.rs:41-53` | RS equal (USB-PD's table is not in ordinal order and still matches) |
| `/boardLayers/*/ordinal` | `Count` | — | required | RS `layer_id` `rs:370` | RS dossier digest | equal |
| `/boardLayers/*/name` | `LayerName` | — | required | RS `rs:371`; 3D `pe:254` | as above; `copperLayers` without a stackup | equal |
| `/boardLayers/*/type` | `StackupBoardLayerType` | — | optional; absent when missing or outside the KiCad set | RS `rs:372` (km `LayerType`, `user` when missing, `kicad_base.py:49-55`); 3D `pe:257` | RS `type` column; 3D `_role_for_layer` | RS `?? "user"` |
| `/boardLayers/*/userName` | `string` (min 1) | — | optional | RS `user_name` `rs:378` (km `:59`) | `tbl:329` (shown instead of `name`) | RS `?? None` |

### Producer rules (WP-P3)

1. **Units.** Every thickness and drill size goes from the file's mm to nm with `round_half_away_from_zero(double(mm) × 1e6)` (conventions §6).
   - `boardThicknessNm` is KiCad's 1.6 mm default when `(general (thickness))` is absent (fork `extended.rs:10,159-160`).
   - `thicknessNm` is omitted when the conversion gives 0 or less. This is the fork materializer's own rule (`layers.rs:100`) and RS's (`rs:118-122`).
2. **Sub-layers (`addsublayer`).** Split each stackup `(layer …)` form at its bare `addsublayer` tokens, as the fork does (`setup.rs:204-230`).
   - The values before the first token are entry `sublayer: 0`; the values after the n-th token are entry `sublayer: n`.
   - `name`, `kind` and `type` repeat on every entry. `thicknessNm`, `material`, `epsilonR`, `lossTangent` and `color` are per sub-layer.
   - The fork already parses this: `PcbStackupLayer` holds sub-layer 0, `sublayers[i]` is entry `i + 1`.
3. **`kind`** comes from `name` only, checked in this order:
   - a name ending in `.Cu` is `copper`;
   - `F.Mask`/`B.Mask` is `soldermask`;
   - `F.Paste`/`B.Paste` is `paste`;
   - `F.SilkS`/`B.SilkS` is `silkscreen`;
   - a name starting with `dielectric` is `dielectric`;
   - anything else is `other`.

   Today's RS (`rs:102-115`) and 3D (km `:791-805`) classifiers use the `type` string. They agree with this rule on every KiCad-written stackup (all 17 cynthion entries). The fork materializer's role (`layers.rs:33-46`) agrees too.
4. **Empty strings are absent.**
   - `material`, `color`, `copperFinish` and `userName` are never `""`.
   - A `type` or layer-type token outside the enum is omitted and reported in the manifest (see the cross-contract notes).
5. **Settings.**
   - `castellatedPads` reads `(castellated_pads yes)` inside `(stackup …)`. The fork's `PcbStackup` (`setup.rs:40-47,185-194`) has no such field: P3 adds it to the core parser as an additive field (`child_bool(…, "castellated_pads")`), or reads the token from the stackup span.
   - `copperFinish` must distinguish "absent" from `""`. The fork's `unwrap_or_default` (`setup.rs:187-188`) loses that; read the `Option`.
6. **Vias.** Read every top-level `(via …)`.
   - `viaType` is the first of `blind`, `buried`, `micro` among the header tokens, else `through` (fork `vias.rs:63-66`).
   - `startLayer`/`stopLayer` are the first and second names of `(layers …)`.
   - A drill is kept when it has a size or a two-name `(layers …)`.
   - Group by (`viaType`, `startLayer`, `stopLayer`, `backdrill`, `tertiaryDrill`). Resolve `spanLayers` against `copperLayers`, then sort as the TypeSpec doc of `viaSpans` states.
7. **`copperLayers`** follows the stackup when one is present, as RS does, even when the stackup's copper differs from the layer table's. In that case the fork materializer ignores the stackup instead (`layers.rs:206-215`, `stackup_mismatch`). See open question 3.
8. **`stackThicknessNm`** is the exact integer sum of `thicknessNm` over the copper, dielectric and soldermask entries. Every sub-layer is included.

## How a golden is produced from today's code

All commands run offline from `backend/` of the `wp-w0-contracts` worktree. The interpreter is the one named in conventions/README: `uv run --offline --no-project --python <host-footprint venv python> --with-requirements ../requirements/test.txt python <script>`. Put both `backend/` and `kicad-prism-viewer/pipeline/` on `sys.path`.

| Shape | Call on dev (or ref) |
|---|---|
| RS | `app.release_studio.projections.project_stackup(board)` |
| DC | `app.services.design_compare_artifacts._extract_stackup(snapshot_dir, None)`, with the board copied alone into `snapshot_dir` |
| 3D | `topology_compiler.pcb_extract._pcb_metadata_common(KiCadPcb.from_file(board), board.with_suffix(".kicad_pro"), physical_objects=[], terminal_pad_links=[], board_bbox=[0,0,1,1], components=[], stats={})["board"]` → keep `thickness_mm` and `stackup` (legacy backend) |
| Topology layers | `topology_compiler.compiler._layers_from_pcb_metadata(metadata)` (dataclasses as dicts); `_board_from_pcb_metadata(metadata)` keys `thickness_mm`, `stackup_present`, `stackup`, `materials` |
| System Builder mid-plane | `app.services.systems.bundles.mid_plane_from_layers(<topology layers>)` |
| Board looks (ref) | `board_looks(board)` from ref `kicad-prism-viewer/pipeline/topology_compiler/board_looks.py` |

**Reader adapters: this member → today's shapes.** Each rule uses only the member. Where noted, it reuses today's pure presentation helpers, as C2/C3/C5 would.

**Fold to forms** (RS, DC, 3D): today's readers see one row per stackup `(layer …)` form, never a sub-layer.
- Group consecutive entries that start at `sublayer: 0`.
- Each field is the *first value written* across the group's sub-layers. km's `get_value`/`find_element` (`:741-766`) and DC's regexes (`dc:56-66`) both take the first match in the form's text.

**RS** (C3):
- `present`, `source` = `source_detail` = `"board.setup.stackup"` if `present` else `"board.layers"`; `fallback_reason: None`; `units: "mm"`.
- `layers`:
  - if `present`, one row per form: `order`, `layer_id: None`, `name`, `type ?? None`, `material ?? ""`, `thickness: thicknessNm/1e6 ?? None`, `epsilon_r: εr or None` (0 → None), `loss_tangent` likewise, `color ?? ""`, `user_name: None`, `kind: _layer_kind(name, type ?? "")` (`rs:102`);
  - otherwise one row per `boardLayers` row: `layer_id: ordinal`, `type ?? "user"`, `user_name: userName ?? None`, physical fields `None`.
  - If that list is empty, the whole shape is `_empty_stackup()` (`rs:220-244`).
- `copper_layers`/`dielectric_layers` and their counts come from `kind`; `copper_layers` equals `copperLayers`.
- `board_thickness: boardThicknessNm/1e6 or None`.
- `total_thickness`: the float sum, in row order, of the copper/dielectric/mask rows' mm thickness, when every such row has one (`rs:393-407`). `total_thickness_status` and `total_thickness_source` follow the same rule.
- `settings`: if `present`, `{copper_finish: copperFinish ?? "", dielectric_constraints, edge_connector: none → None else the token, edge_plating}`; otherwise all `None`.
- `via_spans`: one record per `viaSpans` entry, in order. `span_layers: spanLayers or None`, `span_layer_count: len or None`, drills `{size: mm ?? None, start_layer ?? None, stop_layer ?? None}` or `None`.
- `via_type_counts`: `{through, blind, buried, micro}`, summed from `count`; `via_count` is their sum.

**DC** (C2):
- If not `present`: `{present: false, layers: [], settings: {copper_finish: None, dielectric_constraints: None}}`. Today's layer-table fallback (`dc:68-71`) needs a quoted type token, which no KiCad 6+ layer table writes, so it yields nothing.
- Otherwise one row per form: `{name, type ?? "", thickness: mm ?? None, material ?? None, color ?? None, epsilon_r ?? None, loss_tangent ?? None}` (0 kept); `present: len(layers) > 0`; `settings: {copper_finish: copperFinish ?? None, dielectric_constraints}`.

**3D** (C5, legacy backend):
1. Build km objects from the member:
   - `Stackup(layers=[StackupLayer(name, type_name=type ?? "", thickness=mm ?? 0.0, material ?? "", epsilon_r=εr or None, loss_tangent=tanδ or None, color ?? "")] (one per form), copper_finish ?? "", dielectric_constraints, edge_connector=EdgeConnectorConstraint, edge_plating)` when `present`, else `None`;
   - `layers=[Layer(ordinal, name, LayerType(type ?? "user"), userName)]`;
   - `thickness = boardThicknessNm/1e6`.
2. Call `pe:_declared_layers(pcb, None)`.
3. `computed = stackup.get_board_thickness() or thickness or 1.6`.
4. Settings:
   - `copper_finish = _clean_enum_text(copperFinish) or "None"`;
   - `edge_connector = edgeConnector != none`;
   - `castellated_pads = castellatedPads`;
   - `edge_plating = edgePlating`;
   - all `false`/`"None"` without settings.
5. `present: true`.

The topology layers then come from `cc:_layers_from_pcb_metadata` unchanged.

**System Builder mid-plane** (C4):
- Exact form: half the sum of `thicknessNm` of the entries strictly between the first and last `copper` entries, divided by 1e6. It counts only entries the 3D stack keeps (a KiCad `type`) and only sub-layer 0 for parity. It is 0 with fewer than two copper entries, and `boardThicknessNm/2/1e6` when `present` is false.
- It equals today's chain after `poses._clean` (`round(·, 9)`, `backend/app/services/systems/placement/poses.py:20-22`), which `bundleToBoard` applies (`backend/app/services/systems/scene.py:36-43`). Today's float can differ in the last ulp (cynthion: 0.7342000000000001 against 0.7342).

**Board looks** (C5/V1): `{soldermask: {front: mask_rgba(front ?? ""), back: mask_rgba(back ?? front ?? "")}, paste: PASTE_COLOR}` (ref `board_looks.py:65-87`).

**Proof (W0, scratch).** A prototype producer applies the rules above with kicad_monkey's tokenizer only. Its output validated against the schema on every board. Each shape was then re-derived from that output by the adapters above and compared by JSON value equality (conventions §14) with today's output:

| Board | RS | DC | 3D | topology layers | topology board | mid-plane | looks |
|---|---|---|---|---|---|---|---|
| `fixtures/release-studio/cynthion` (stackup, 6 Cu, 651 vias) | = | = | = | = | = | = | = |
| `fixtures/release-studio/usb-pd` (no stackup) | = | = | = | = | = | = | = |
| `fixtures/release-studio/synthetic` (no stackup, no vias) | = | = | = | = | = | = | = |
| USB-PD-Trigger-Board (user project) | = | = | = | = | = | = | = |
| `backend/tests/fixtures/design_variants/oracle` | = | = | = | = | = | = | = |
| `backend/tests/fixtures/system_builder/sources/mini_obc/F0` | = | = | = | = | = | = | = |
| `backend/tests/fixtures/system_builder/p2/sources/mezz_base/F0` | = | = | = | = | = | = | = |
| scratch `edge-6l`: cynthion + a 2-sub-layer dielectric with a locked thickness, every setting, custom mask colour, blind/buried/micro/reversed/unresolved/back-drilled vias | = | D2 | = | = | = | = | = |
| scratch `edge-nostack`: `edge-6l` without its stackup (6 Cu from the layer table) | = | = | = | = | = | = | = |
| scratch `edge-min`: synthetic + a minimal stackup (no finish or constraint tokens, an untyped `B.Mask`, `(thickness 0)`, `(epsilon_r 0)`, no `(general (thickness))`) | = | D3, D4 | = | = | = | = | = |

`=` is exact equality. Only the documented divergences remain.

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| D1 Dielectric sub-layers (`addsublayer`) | One row per form. Each field is the first value written in the form, so a sub-layer's colour or material can land on the row. Every sub-layer's thickness after the first is dropped: km ignores `addsublayer` (`:741-766`). RS `total_thickness`, 3D `computed_thickness_mm`, the 3D z placement and the System Builder mid-plane are short by those thicknesses (`edge-6l`: mid-plane 0.6092 against 0.7342 mm). | One entry per sub-layer; `stackThicknessNm` includes them all | KiCad's board thickness, its stackup table and its GLB board body count every sub-layer. The fork materializer already emits one slice per sub-layer (`layers.rs:88-125`). | C2 stackup panel, C3 dossier tables and digests, C4 mid-plane, C5 3D stack. No committed fixture has sub-layers, so CI parity is unaffected. Accepted (maintainer decision): every consumer shows and counts each sub-layer. |
| D2 Locked thickness `(thickness <mm> locked)` | DC's regex (`dc:57`) does not match it. The row shows `null`, or the next sub-layer's thickness (`edge-6l`: 0.25 for a 0.3 mm locked core). The route metrics' via barrel length becomes unavailable (`design_compare_nodes.py:536-544`). | the written thickness | `locked` only pins the value in KiCad's thickness editor; the value is the thickness | C2 |
| D3 `(thickness 0)` | DC `0.0`; RS `null`; 3D `0.0` | absent | Zero is KiCad's "unspecified" (RS `rs:118-122`, fork materializer `layers.rs:100`); conventions §10 forbid 0 as a placeholder | C2 shows "—" instead of "0.0000" |
| D4 Stackup without `(dielectric_constraints …)` | DC `null` | `false` | KiCad reads the absent token as false and always writes the token; RS already shows `false` | C2 (settings diff) |
| D5 Release Studio's km fallback (`rs:263-321`) | `source: "kicad_monkey.fallback"` with a `fallback_reason` when km rejects the board | always the typed source, `fallback_reason: None` | the Rust parser has no such gap; the warning in `document_pipeline.py:253-257` disappears | C3 |
| D6 Empty strings (`(material "")`, `(color "")`, an empty user name) and type tokens outside the enums | RS/DC/3D copy them verbatim | absent (plus a manifest warning for a token) | conventions §10; no KiCad-written file has them | C2, C3, C5 (theoretical) |
| D7 Values with more than 6 decimals in mm | the parsed double | rounded to whole nm | KiCad's own unit is 1 nm and it never writes more | none in practice |

The DC layer-table fallback, RS's empty stackup when a `(stackup)` form has no layers, and the 3D legacy backend's constant `present: true` and synthetic stack are not divergences. The adapters reproduce them.

## Example provenance

`examples/StackupA0.example.json` is the prototype producer's output on `fixtures/release-studio/cynthion/cynthion.kicad_pcb`. It was written as `JSON.stringify(doc, null, 2)` plus LF, and two changes were made:

- **Trimmed:** `boardLayers` keeps 9 of the file's 30 rows: the six copper rows, `B.Adhes` (for `userName`), `F.Mask` and `Edge.Cuts`.
- **Spliced:** two `viaSpans` groups come from the scratch board `edge-6l`, which is cynthion with injected vias, so its layer names match. They are the `blind` `F.Cu`–`In1.Cu` group (count 2) and a `through` group with `backdrill` and `tertiaryDrill` (count 1). No committed fixture has a blind or back-drilled via; without them the example would have no `StackupViaDrill`.

Everything else is cynthion's own: 17 stackup entries with `(loss_tangent 0)` kept as `0`, `Green`/`White` colours, finish `None` and 651 through vias. A sub-layer entry is not in the example, because no committed fixture has one. This is what `edge-6l` gives for its `dielectric 2`:

```json
{ "name": "dielectric 2", "sublayer": 0, "kind": "dielectric", "type": "core", "thicknessNm": 300000, "material": "FR4", "epsilonR": 4.6, "lossTangent": 0.02 },
{ "name": "dielectric 2", "sublayer": 1, "kind": "dielectric", "type": "core", "thicknessNm": 250000, "material": "FR4-HiTg", "epsilonR": 4.4, "lossTangent": 0.015, "color": "FR4 natural" }
```
