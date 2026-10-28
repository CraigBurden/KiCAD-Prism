# Field map: `-o` of `prism-kicad compare` (`prism.design_compare.result.a1`)

Root model `DesignCompareResultA1` in `tsp/prism/design-compare-a1.tsp`; its `projectDiff` is `KiCadProjectDiffBundleV1` in `tsp/prism/kicad-project-diff-v1.tsp`. Example `examples/DesignCompareResultA1.example.json`.

a1 replaces a0 (C2r step 6). It adds `details.targets` (below, "Targets"): the inventory of 2026-10-17 missed that the review list reads today's visual targets, and without them 71 of the 237 review groups of the 18 harness pairs changed presentation and 65 lost their reference.
Written by: `prism-kicad compare` (ADR amendment C2r, `native/src/rs/prism-projections/src/compare/`). Stage: none (a comparison, not a bundle member).

It replaces today's `prism.semantic_comparison_v3` (`DesignCompareResult`, `frontend/src/components/design-comparison/types.ts:412-437`) for every tab except fabrication. It is **not** a parity document: C2r §5 accepts it by review groups, counts and ecad-viewer's resolution counters, not by bytes. This map gives each of today's fields' fate (moved, renamed, converted or dropped) and abbreviates today's code as:
- `t`: `frontend/src/components/design-comparison/types.ts`;
- `dcn`: `backend/app/services/design_compare_nodes.py`;
- `dcm`: `backend/app/services/design_compare_semantics.py`;
- `dcs`: `backend/app/services/design_compare_service.py`;
- `dca`: `backend/app/services/design_compare_artifacts.py`;
- `dds`: `backend/app/services/document_diff_service.py`;
- `bds`: `backend/app/services/bom_diff_service.py`.

"Read" and "unread" come from an inventory of every reader in `frontend/src/` (non-test) on 2026-10-17.

## Fields

Pointers are RFC 6901 with `*` for every element of an array and `{key}` for every key of a map.

### Envelope and revisions

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.design_compare.result.a1"` | — | required | today `"prism.semantic_comparison_v3"` (dcs:1072) | the result loader | until R1, the frontend reads a v3 result into this shape (`legacy-v3-result.ts`) |
| `/base`, `/head` | `DesignCompareRevision` | — | required | today `base`/`head` commit SHAs (dcs:1073-1075), unread | the result loader, sidecar keys | identity moves from commit SHA to revision key |
| `/base/revisionKey` | `Sha256Hex` | — | required | new | job artifact key | the commit's revision key (revision-key.md) |
| `/base/bundleKey` | `Sha256Hex` | — | optional; absent for a source-tree side | new | K | which bundle was read |
| `/base/projectFile` | `RepoPath` | — | required | the job's `project_file_rel` (dcs:1312) | K | the anchor the side was compared by |
| — | — | — | — | `compare` (dcs:1075) | — | **dropped**: duplicate of `head`, unread |
| — | — | — | — | `diagnostics` (dcs:1076) | — | **dropped**: unread |
| — | — | — | — | `geometry` (`t:428-431`) | — | **dropped**: no producer since the geometry sidecar was retired; the frontend's readers of `ChangeItem.geometry`/`oldGeometry` are dead code removed in C2r step 6 |
| `/files` | `DesignCompareFiles` | — | required | `files` (dcs:1055-1058, `_list_kicad_sources`) | revision sources, file list | same entries |
| `/files/base/*/path`, `/files/head/*/path` | string | — | required; sorted by `path` | `_list_kicad_sources` (`design_compare_sources.py:24-38`) | `revision-sources.ts` | same |
| `/files/base/*/filename` | string | — | required | same | same | same |

### Schematic and PCB changes

`/schematic/changes` and `/pcb/changes` replace `schematic.changes` and `pcb.changes` (`SchematicDiff`, `PcbDiff`, `t:209-222`). Today an object change comes from `_node_change` (dcn:230-416) and a net or structure change from `_diff_nets` and `_semantic_structure_changes` (dcm:290-460, dcm:480-760).

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/schematic/changes`, `/pcb/changes` | `DesignCompareChange[]` | — | required; sorted by `id` in code point order | dcs:1027-1036, dcs:1124-1127 | review groups, queue, policy | same set of changes |
| — | — | — | — | `schematic.pages` (dcs:1059-1065), `schematic.summary`, `pcb.summary` | — | **dropped**: unread; `/counts` replaces the summaries |
| `…/*/id` | string | — | required | dcn:396, dcm:420, dcm:733 | selection bridge, review groups | same ids: the key of `projectDiff.navigation` |
| `…/*/domain` | `DesignCompareDomain` | — | required | dcn:236-244 | review noise, groups, layer focus | same |
| `…/*/kind` | `DesignCompareChangeKind` | — | required | dcn:262-263 | review noise, groups, policy | same (`modified` written `changed`) |
| `…/*/category` | `DesignCompareCategory` | — | required | dcn:121-162 (`_node_classification`), dcm | review policy, workspace | closed set; today `string` |
| `…/*/classification` | `DesignCompareClassification` | — | required | dcn:121-162 | review groups, policy | same |
| `…/*/label` | string | — | required | dcn:164-198 (`_node_label`) | review groups, queue, panes | same text |
| `…/*/objectKind` | string | — | optional; absent for a net-level change | `object_kind` (dcn:414) | layer focus, review policy, property model | **renamed** and spelled as the board-objects member spells kinds (`sheet-pin`, `board-constraint`); today `_` |
| `…/*/reference` | `Refdes` | — | optional | dcn:257 | review groups, policy, workspace | same |
| `…/*/net` | `NetName` | — | optional | dcn:258-262, dcm:738 | review noise, groups, layer focus | same |
| `…/*/semanticId` | string | — | optional | `semantic_id` (dcn:268-288) | review groups, workspace | **renamed** |
| `…/*/page` | string | — | optional | dcn:403, dcm:722-728 | review policy, workspace, queue | same |
| — | — | — | — | `alsoOnPages` (dcn:404) | — | **dropped**: unread |
| `…/*/reasons` | `DesignCompareReason[]` | — | required; never empty | dcn:408-409, dcm:755 | review noise, policy, property model | closed set (`t:124-145`) |
| `…/*/fields` | `Record<DesignCompareFieldDelta>` | — | required; keys are field display names | dcn:289-299, dcm `fields` | review groups, queue, property model | same keys; a side without a value omits it instead of writing `null` |
| `…/*/fields/{key}/old`, `…/new` | `BoardObjectsReviewValue` | — | optional | dcn:295 (`from`/`to` of `properties`), dcn:298 (`attributes`) | property model | same values |
| `…/*/details` | `DesignCompareChangeDetails` | — | required | dcn:410-413, dcm `details` | presentation shell, property model | the review evidence below |
| `…/*/details/reviewOnly` | const `true` | — | optional; absent = false | dcn:412 | review policy | same |
| `…/*/details/connectivity` | `DesignCompareConnectivity` | — | optional | dcm `details.connectivity` | property model | terminals sorted |
| `…/*/details/instanceCount`, `…/labelInstances` | `DesignCompareCountDelta` | — | optional | dcm | property model | same |
| `…/*/details/sheetChange` | `DesignCompareSheetDelta` | — | optional | dcm | property model | same; absent sides omitted |
| — | — | — | — | `details.fieldDeltas`, `details.netInstances`, `details.instanceReplacement` | — | **dropped**: unread |
| `…/*/details/targets` | `DesignCompareTarget[]` | — | optional; absent when empty | `details.visualTargets` (dcn:300-347, dcm:133-245) | review policy, review queue, change facts, review groups, property model | **renamed** and slimmed; see "Targets". `compare` also builds `projectDiff` from them (today `dds:152-235`) |
| `…/*/base`, `…/*/head` | `DesignCompareChangeSide` | — | optional; `base` absent for `added`, `head` absent for `removed` | `base_item`/`compare_item` (dcn:387-406, dcm `_native_item`), `source_id_*`, `parent_source_id_*`, `position_*` | property model, review groups, revision sources, workspace | **merged**: each side's object once |
| `…/*/base/sourceId` | string | — | required | `source_id_base` / `base_item.source_id` (dcn:265-266) | property model, workspace, revision sources | today also `uuid` (compare or base), **dropped** as a duplicate |
| `…/*/base/parentSourceId` | `KiCadUuid` | — | optional | `parent_source_id_base` (dcn:384) | change facts | same |
| `…/*/base/documentPath` | string | — | required | `base_item.page` / `path` | review queue, layer focus | same |
| `…/*/base/layer` | `LayerName` | — | optional | `base_item.layer` (dcn:392) | review groups, policy | same |
| `…/*/base/layers` | `LayerName[]` | — | required; sorted | `base_item.layers`, and the change's union `layers` (dcn:247-249) | review groups, layer focus | the change-level union is **dropped**: readers take the union of the sides |
| `…/*/base/at` | `PointNm` | nm | optional | `position_base` (dcn:384) | review groups, property model | today `[x, y]` mm; × 1e6, rounded half up |
| `…/*/base/reference`, `…/base/net` | `Refdes`, `NetName` | — | optional | `base_item.reference`, `.net` | review queue | same |
| — | — | — | — | `position_delta` (dcn:386), `source_side` (dcn:289), `affected_source_ids_base`, `affected_source_ids_compare` (dcm:743-744) | — | **dropped**: unread |
| — | — | — | — | `derivedFrom` (`t:114`) | — | not in the result: the frontend computes it (`comparison-review-noise.ts:211`; C2r Q2) |

### Targets

`…/*/details/targets` is today's `details.visualTargets`, entry for entry and in the same order: base-side targets first, then head-side, each in the order the change's evidence lists them. A target without a source id is left out. An object's change gives one target per KIID path (dcn `targets_for`), and a net or structure change's targets are merged by side, status, source id and sheet path (dcm `_dedupe_visual_targets`), so one object drawn on two sheet instances is two entries.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `…/targets/*/side` | `DesignCompareSide` | — | required | `side` | — | `reference` written `base`, `comparison` written `head` |
| `…/targets/*/sourceId` | string | — | required | `sourceId` | — | same |
| `…/targets/*/kind` | string | — | optional | `kind` | review policy (`objectKinds`) | spelled as the board-objects member spells kinds (`footprint-graphic`); absent replaces `null` and `""` |
| `…/targets/*/role` | `DesignCompareTargetRole` | — | optional | `role` | review policy (`objectKinds`) | closed set; today's role is the object's kind when it has no role of its own (for example `pin`, `text`), and then `role` is absent and `kind` carries it |
| `…/targets/*/documentPath` | string | — | optional | `documentPath`, else `page` | review queue, change facts (`pageFor`) | today written twice |
| `…/targets/*/at` | `PointNm` | nm | optional | `at` | review groups (the label's position) | today `[x, y]` mm; × 1e6, rounded half up |
| `…/targets/*/sheetPath` | string | — | optional | `sheetPath` | — | keeps one object's entries on two sheet instances apart |
| `…/targets/*/reference` | `Refdes` | — | optional | `reference` | change facts (`referenceFor`), search | same |
| — | — | — | — | `status`, `parentSourceId`, `pin` | — | **dropped**: unread (`kind` already says added, removed or changed; ecad-viewer reads `projectDiff`) |

### BOM

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/bom` | `DesignCompareBom` | — | required | `bom` (dcs:1046-1054, `bds.diff_boms`) | BOM panel | today nullable; now always present |
| `/bom/fields` | `string[]` | — | required; display order | `bds` | BOM panel | same |
| `/bom/changes` | `DesignCompareBomRow[]` | — | required; sorted by `ref` | `bds` | BOM panel | same rows |
| `/bom/changes/*/ref`, `…/status` | `Refdes`, `DesignCompareBomStatus` | — | required | `bds` | BOM panel | same |
| `/bom/changes/*/old`, `…/new`, `…/diffs` | maps of strings | — | optional | `bds` | BOM panel | same |
| `/bom/summary` | `DesignCompareSummary` | — | required | `bds` | BOM panel | same |
| — | — | — | — | `include_unchanged` | — | **dropped**: unread |

### Stackup

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/stackup/present`, `/stackup/changed` | boolean | — | required | `_diff_stackup` (dca:84-100) | stackup panel | `changed` is no longer set by `{}` against `{copper_finish: None, …}` (stackup.md `/settings`) |
| `/stackup/base`, `/stackup/head` | `DesignCompareStackupLayer[]` | — | required; stack order | dca:52-67 | stackup panel | sub-layers folded to forms (stackup.md DC rules) |
| `/stackup/base/*/thicknessNm` | `Nanometres` | nm | optional | `thickness` (dca:57) | stackup panel | today mm or `null`; absent replaces `null` and 0 (stackup D3) |
| `/stackup/base/*/epsilonR`, `…/lossTangent` | float64 | — | optional | `epsilon_r`, `loss_tangent` (dca:65-66) | stackup panel | **renamed**; 0 kept |
| `/stackup/base/*/type`, `…/material`, `…/color` | string | — | optional | dca:56, dca:63-64 | stackup panel | absent replaces `""` and `null` |
| — | — | — | — | `ordinal` | — | **dropped**: unread |
| `/stackup/baseSettings`, `/stackup/headSettings` | `DesignCompareStackupSettings` | — | required | `base_settings`, `head_settings` (dca:75-80) | stackup panel | **renamed**; keys `copperFinish`, `dielectricConstraints`; unknown omitted |

### Route metrics

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/routeMetrics/base`, `/routeMetrics/head` | `Record<DesignCompareRouteMetric>` | — | required; keys are net names | `pcb.route_metrics.base`/`compare` (dcs:1137-1146, dcn:518-573) | property model (`ROUTE_METRIC_ROWS`) | moved out of `pcb`; `compare` written `head` |
| `…/{net}/routeLengthNm` | `NonNegativeNanometres` | nm | required | `centerline_length_mm` (dcn:566) | property model | today mm rounded to 4 decimals; route-metrics.md C2 rules |
| `…/{net}/viaCount` | `Count` | — | required | `via_count` | property model | **renamed** |
| `…/{net}/usedLayers` | `LayerName[]` | — | required; sorted | `used_layers` | property model | every layer a via crosses (route-metrics D7) |
| `…/{net}/viaBarrelLengthNm` | `NonNegativeNanometres` | nm | optional; absent = unreliable | `via_barrel_length_mm` (dcn:569) | property model | today mm or `null` |
| — | — | — | — | `propagation_delay`, `diagnostics` | — | **dropped**: unread (always `null` and a fixed note) |

### ecad-viewer's input and counts

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers | Note |
|---|---|---|---|---|---|---|
| `/projectDiff` | `KiCadProjectDiffBundleV1` | — | required | `document_diff` (dds:237-426, `build_project_diff`) | `comparison-presentation-shell.tsx:690` → ecad-viewer; selection bridge (`navigation`) | **same format** (mirror contract); `compare` writes it |
| `/projectDiff/project/documents/*/changes/*/properties/*/before/type`, `…/after/type` | `KiCadProjectDiffValueType` | — | required | dds:86-95 (`_diff_value`, from the Python value's type) | ecad-viewer | follows the KiCad property, not the JSON text (C2r §2 item 2) |
| `/projectDiff/project/documents/*/changes/*/properties/*/before/v` | string, number, flag or `null` | — | ecad-viewer's encoding | dds:86-95 | ecad-viewer | today a list or table is written as its Python `str()`; `compare` writes its display text |
| `/counts/schematic`, `/counts/pcb`, `/counts/bom` | `DesignCompareSummary` | — | required | today `schematic.summary`, `pcb.summary`, `bom.summary`; the bundle manifest's `domains[*].summary` (dcs:1263-1276) | the bundle manifest | one place for the per-tab counts |
| — | — | — | — | `readiness`, `stackup` readiness, `fabrication` | — | not in this document: the backend adds fabrication and readiness to the job artifact (C2r §2 items 5–7) |

## How a golden is produced from today's code

There is no byte golden (C2r §5). The reference for acceptance is today's `prism.semantic_comparison_v3` result of the same pair, converted to this shape by the rules above. The converter (`c2r-convert.py`, a scratch script today) is committed with the C2r gate harness (C2r §9 step 7); it was run on the eight end-to-end pairs of C2r §1.2 (mini_obc F0→F5 and F0→F11.2, mini_power F0→F10, dv-oracle → rev2, usb-pd self, synthetic → usb-pd, cynthion self, EDA-04903 with one footprint moved), and every converted document validates against this contract. Acceptance then compares review groups and counts, not bytes.

## Expected divergences

| Case | Today | `compare` | Why `compare` is right | Consumer affected |
|---|---|---|---|---|
| Property value types in `projectDiff` | the Python type of the value (`152` int, `152.0` double; a list as `str()`) | the KiCad property's type; a list as its display text | ecad-viewer shows the type and the value; the old encoding leaked implementation detail | ecad-viewer's property panel |
| Sides of structure changes (sheet instances, buses) | `source_id_*` without `base_item`/`compare_item` (dcm:290-460) | `base`/`head` filled from the structure's visual targets | every change carries its identity the same way | property model, review groups |
| `objectKind` spelling | `sheet_pin`, `board_constraint` | `sheet-pin`, `board-constraint` | one kind vocabulary, the member's | review policy, layer focus |
| The C2 divergences compare-1 to compare-3 and the field maps' C2 divergences (semantic-index D7, stackup `/settings`, route-metrics D7) | see `native/parity/divergences/compare.md` and the field maps | as recorded there | as recorded there | as recorded there |

## Example provenance

`examples/DesignCompareResultA1.example.json` is the mini_obc F0 → F5 pair (`backend/tests/fixtures/system_builder/sources/mini_obc/F0` and `F5`, the parity cases `sb-mini_obc-F0` and `sb-mini_obc-F5`): today's `run_comparison` result, converted by the rules above. It is trimmed to the first three changes of each tab (with their `projectDiff` entries and navigation) and three nets of route metrics per side. `bundleKey` and `revisionKey` are the SHA-256 of the two parse-stage bundles built from those cases.
