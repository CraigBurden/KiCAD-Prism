# Field map: Release Studio tools (`prism.artwork.config.a0`, `prism.vendor.jlcpcb.config.a0`, `prism.stroke_text.request.a0`, `prism.drawing_sheet.request.a0`, `prism.assembly_hlr.a0`, and the C3 `prism.cli.*` results)

Root models `ArtworkConfigA0`, `VendorJlcpcbConfigA0`, `StrokeTextRequestA0`, `DrawingSheetRequestA0`, `AssemblyHlrA0` in `tsp/prism/{artwork-a0,vendor-jlcpcb-a0,stroke-text-a0,drawing-sheet-a0,assembly-hlr-a0}.tsp`, and `CliArtworkResultA0`, `CliVendorListA0`, `CliVendorRunResultA0`, `CliStrokeTextResultA0`, `CliStrokeFontMetricsA0`, `CliDrawingSheetResultA0` in `tsp/prism/cli-a0.tsp`. Examples `examples/<RootModel>.example.json`.

This one field map covers the five contracts ADR amendment C3 §3.5 adds together, because they are one deliverable (the Cruncher replacement) and share their sources. It is the exception to "one field map per contract file" (`conventions.md` §2).

Written by: chunk A (this contracts PR) types them. The producers are chunk B (`prism-vendors`, `CliVendorListA0`/`CliVendorRunResultA0`), chunk C (`prism-artwork`'s stroke-text and drawing-sheet facades, `CliStrokeTextResultA0`/`CliStrokeFontMetricsA0`/`CliDrawingSheetResultA0`), chunk D (`models/assembly-hlr.json`) and chunk E (`prism-kicad artwork`, `CliArtworkResultA0`). Stage: `models` for `AssemblyHlrA0`; `board` (or saved fills) for `artwork`; none of the CLI result documents is a bundle member.

Citations: `backend/…` is this repository; `kicad_monkey` / `kicad_cruncher` are the pinned 2026.9.7 packages (read-only). The Python files are the sources today; the Rust port replaces them.

## Fields — `ArtworkConfigA0` (`prism.artwork.config.a0`)

A config file that mirrors an existing file, so every JSON pointer keeps the file's spelling (`conventions.md` §5, the config-file exemption: snake_case, and the enum tokens as written). The only change from the files is `/schema`.

Source of truth: `backend/app/release_studio/documents/pcb-svg.config.json` and `pcb-svg.testpoints.config.json`, loaded by `kicad_cruncher.kicad_cruncher_pcb_svg_config.py` (the model: `_PcbSvgConfig` `:1210`, `_PcbSvgGlobalConfig` `:764`, `_PcbSvgViewConfig` `:820`, `_PcbSvgAssemblyConfig` `:907`, `_PcbSvgDnpConfig` `:942`, `_PcbSvgPin1Config` `:1028`, `_PcbSvgComponentOverride` `:1072`).

| Field (JSON pointer) | Source (file:line) | Exemption |
|---|---|---|
| `/schema` | const, new (files say `kicad_cruncher.pcb_svg.config.a0`) | value changed |
| `/global`, `/global/canvas`, `/global/canvas/bounds`, `/global/canvas/margin_mm` | `pcb-svg.config.json:27-31` | snake_case |
| `/global/include_metadata`, `/global/show_empty_layers`, `/global/clip_to_outline`, `/global/clip_holes_from_copper`, `/global/mirror_bottom_view`, `/global/svg_scale`, `/global/svg_size_unit`, `/global/clean_output` | `pcb-svg.config.json:32-39` | snake_case |
| `/global/styles` and every `board_outline`, `board_cutouts`, `drills`, `slots`, `assembly_hlr`, `assembly_designators`, `pin1_marker` entry; `selector_overrides` under `assembly_designators` | `pcb-svg.config.json:40-92`; the testpoints file adds `selector_overrides` `pcb-svg.testpoints.config.json:129-136`, `:159-166` | snake_case; the keys of `selector_overrides` (`*`, `TP*`) are map data and keep their spelling |
| `/assembly`, `/assembly/default_projection`, `/assembly/dnp_projection`, `/assembly/designator_color`, `/assembly/dnp_designator_color` | `pcb-svg.config.json:94-99` | snake_case |
| `/dnp`, `/dnp/color`, `/dnp/hatch`, `/dnp/hatch_spacing_mm`, `/dnp/hatch_angle_deg`, `/dnp/hatch_line_width_mm` | `pcb-svg.config.json:100-106` | snake_case |
| `/pin1`, `/pin1/exclude_designators`, `/pin1/exclude_single_pin` | `pcb-svg.config.json:107-113` | snake_case |
| `/components` (`{designator}` → override) | `pcb-svg.config.json:114` (empty in both files); the override model `kicad_cruncher_pcb_svg_config.py:1072-1209` | keys are refdes data |
| `/layer_outputs`, `/layer_outputs/enabled` | `pcb-svg.config.json:115-117` | snake_case |
| `/views`, `/views/*/name`, `enabled`, `group_id`, `output_svg`, `layers`, `assembly_hlr_mode`, `styles` | `pcb-svg.config.json:118-161`; `_PcbSvgViewConfig.from_dict` `kicad_cruncher_pcb_svg_config.py:833-878` | snake_case; `layers` tokens (`BOARD_OUTLINE`, `ASSEMBLY_HLR_TOP`, `F.Cu`) are map data |

Every non-`schema` field is optional except the blocks the two files always write (`global`, `assembly`, `dnp`, `pin1`, `components`, `layer_outputs`, `views`), so one contract types both files. `global` and each `styles` entry are always present because both files have them.

### Not typed

- `_prism`: both files carry a `_prism` author-comment array (`pcb-svg.config.json:3-26`). It is not a rendering field, and a bundle field name never starts with an underscore (`conventions.md` §5); it is dropped from the file, not typed (the `ArtworkConfigA0` header states this). The **real configs therefore do not validate verbatim**: the validation copy drops `_prism` as well as replacing `schema`.
- The Cruncher options the two files do not set (`pcbdoc`, `max_arc_segment_mm`, per-component `side`/`projection`/`pin1_*`/`diode_*`, `mirror`, `description`): a config that needs them needs a contract change, per the config-file exemption. `projection_algorithm`, `curve_mode` and the mesh options of `assembly_hlr` are not in the contract either; Geometer's default (`poly`, no arcs) is what a shipped member uses.

## Fields — `VendorJlcpcbConfigA0` (`prism.vendor.jlcpcb.config.a0`)

A config file that mirrors an existing file (JSONC): every pointer keeps the file's spelling. The only change is `/schema`.

Source of truth: `backend/app/release_studio/vendors/jlcpcb.config.jsonc`, loaded by `kicad_cruncher.bom_pnp_model.BomPnpConfig` (`:313-355`) through `kicad_cruncher_cmd_jlc.py`.

| Field (JSON pointer) | Source (file:line) | Exemption |
|---|---|---|
| `/schema` | const, new (file says `kicad_cruncher.bom.config.a0`) | value changed |
| `/variants`, `/variants/mode`, `/variants/names`, `/variants/include_base` | `jlcpcb.config.jsonc:37-41`; `bom_pnp_model.py:318-320`, `:361-363` | snake_case; enum tokens as written |
| `/bom`, `/bom/outputs`, `/bom/group_fields`, `/bom/include_dnp`, `/bom/split_dnp` | `jlcpcb.config.jsonc:43-48`; `bom_pnp_model.py:321-330` | snake_case; output tokens (`jlc-csv`) as written |
| `/pnp`, `/pnp/outputs`, `/pnp/units` | `jlcpcb.config.jsonc:50-53`; `bom_pnp_model.py:341-343` | snake_case; unit token (`mm`) as written |

## Fields — `StrokeTextRequestA0` (`prism.stroke_text.request.a0`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers |
|---|---|---|---|---|---|
| `/schema` | const | — | required | new | chunk C |
| `/runs` | `StrokeTextRun[]` | — | required, may be empty; in the request's order; the result mirrors it | one call per run to `render_text_polylines` (`backend/app/release_studio/documents/fonts.py:363-371`) | `CliStrokeTextResultA0` |
| `/runs/*/text` | string | — | required | the `value` argument (`fonts.py:364`) | NewStroke renderer |
| `/runs/*/x_mm` | float64 | mm | required | the `x` argument (`fonts.py:365`) | NewStroke renderer |
| `/runs/*/y_mm` | float64 | mm | required | the `y` argument (`fonts.py:366`) | NewStroke renderer |
| `/runs/*/size_mm` | float64 | mm | required | `size`, passed twice as size_x and size_y (`fonts.py:367-368`) | NewStroke renderer |
| `/runs/*/h_align` | `StrokeTextHAlign` | — | required | the mapped `anchor` (`fonts.py:360-369`): `start`→`left`, `middle`→`center`, `end`→`right` | NewStroke renderer |
| `/runs/*/v_align` | `StrokeTextVAlign` | — | required | `"bottom"` (`fonts.py:370`); the request exposes the other renderer alignments | NewStroke renderer |

Millimetres, not nanometres: `render_text_polylines` takes and returns page millimetres (`kicad_stroke_font.py:453-465`).

## Fields — `DrawingSheetRequestA0` (`prism.drawing_sheet.request.a0`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers |
|---|---|---|---|---|---|
| `/schema` | const | — | required | new | chunk C |
| `/paper_width_nm`, `/paper_height_nm` | `NonNegativeNanometres` | nm | required | `paper_width_nm`/`paper_height_nm` (`backend/app/release_studio/documents/worksheet.py:49-50`) | `drawing_sheet_to_ops` |
| `/title_block`, `/title_block/title`, `/date`, `/rev`, `/company` | string | — | required | the `title_block` dict (`worksheet.py:51-57`) | `drawing_sheet_to_ops` |
| `/title_block/comments` (`{key}`) | `Record<string>` | — | required; keys `"1"`–`"4"`, code point order; values may be empty | `comments` (`worksheet.py:41-46`, int keys 1–4) | `drawing_sheet_to_ops` |
| `/sheet_index`, `/sheet_count` | safeint ≥ 1 | — | required | `sheet_index`/`sheet_count` (`worksheet.py:58-59`) | `drawing_sheet_to_ops` |
| `/paper_name` | string | — | required | `paper_name` (`worksheet.py:60`) | `drawing_sheet_to_ops` |
| `/file_name` | string | — | required | the `filename` argument (`worksheet.py:61`) | `drawing_sheet_to_ops` |
| `/sheet_path`, `/sheet_name` | string | — | required | `sheet_path`/`sheet_name` (`worksheet.py:62-63`) | `drawing_sheet_to_ops` |
| `/kicad_version` | string | — | required | `kicad_version`, `KiCad` when unknown (`worksheet.py:64`) | `drawing_sheet_to_ops` |

`file_name` is the one rename from the call's `filename`, for the snake_case family.

## Fields — `AssemblyHlrA0` (`prism.assembly_hlr.a0`)

Bundle member `models/assembly-hlr.json`, stage `models` (ADR amendment C3 §3.1, cli-spec.md §5.2.4).

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers |
|---|---|---|---|---|---|
| `/schema` | const | — | required | new | |
| `/options` | `AssemblyHlrOptions` | — | required | `_assembly_projection_options` (`kicad_cruncher_cmd_pcb_svg.py:1718-1747`) → `_hlr_options_for_geometer` (`kicad_cruncher_pcb_svg_projection.py:198-225`) | the member's cache key; chunk E |
| `/options/projectionAlgorithm` | enum | — | optional; absent = Geometer's default (`poly`) | `projection_algorithm` (`projection.py:214-215`; `_AssemblyProjectionOptions` `:20`) | — |
| `/options/outlineAlgorithm`, `/options/curveMode`, `/options/samplesPerCurve`, `/options/roundDigits`, `/options/includeVisible`, `/options/includeOutline`, `/options/unionPolygons` | enum / `Count` / boolean | — | required | `projection.py:205-213`, `:207-211`; defaults `:21-27` | — |
| `/options/meshLinearDeflection`, `/options/meshAngularDeflection`, `/options/meshRelative`, `/options/hlrAngleTolerance` | float64 / boolean | mm, rad, deg | optional; absent when Geometer's default applies | `projection.py:216-223`, `:28-31` | — |
| `/options/edgeFlags` (`{key}`) | `Record<boolean>` | — | optional; keys are Geometer flag names, code point order | `projection.py:224`; `_ASSEMBLY_HLR_EDGE_FLAG_KEYS` | — |
| `/runtime`, `/runtime/geometerVersion` | string | — | required | `geometer.version().string`; part of the generator id's `hlr_procedure` (cli-spec.md §5.2.4) | the cache key |
| `/footprints` | `AssemblyHlrFootprint[]` | — | required, may be empty; sorted by `documentPath`, then `uuid`, code point order | one row per footprint that names a 3D model (`cmd.py:1689-1712`) | chunk E |
| `/footprints/*/documentPath` | `RepoPath` | — | required | the board file (`repo path`) | |
| `/footprints/*/uuid` | `KiCadUuid` | — | required | `footprint.uuid` (`kicad_pcb_footprint.py:264`) | |
| `/footprints/*/reference` | `Refdes` | — | optional; absent when empty | the `Reference` property | |
| `/footprints/*/side` | `Side` | — | required | `back` iff `(layer …)` starts `B.` (`kicad_cruncher_pcb_model_pose.py:69`) | projection direction |
| `/footprints/*/stepModel/reference` | string | — | required when a STEP model is named | `model.path` (`_first_step_model` `cmd.py:1768-1773`) | model resolution |
| `/footprints/*/stepModel/sha256` | `Sha256Hex` | — | optional; absent on `model-unavailable` | `sha256(_resolve_model_step_bytes(...))` (`cmd.py:1776-1785`) | the HLR cache key |
| `/footprints/*/pose/positionNm`, `/rotationDeg` | `PointNm`, `Degrees` | nm, deg | present exactly on success | `footprint.at_x/at_y/at_angle` | |
| `/footprints/*/pose/modelOffset` | `AssemblyHlrVector3Nm` | nm | present exactly on success | `model.offset` (`kicad_cruncher_pcb_model_pose.py:71`) | |
| `/footprints/*/pose/modelRotation` | `AssemblyHlrRotation3Deg` | deg | present exactly on success | `model.rotate` (`:73`) | |
| `/footprints/*/pose/modelScale` | `AssemblyHlrScale3` | — | present exactly on success | `model.scale` (`:72`) | |
| `/footprints/*/outline`, `/detail` | `AssemblyHlrEdges` | — | present exactly on success | `projected.outline_*` / `projected.detail_*` (`projection.py:46-51`) | chunk E |
| `/footprints/*/outline/segments/*`, `/detail/segments/*` | `{startNm, endNm}` | nm | in Geometer order after dedupe | `_segments_from_mode` / `_segment_from_json` (`projection.py:351-388`), `_dedupe_segments` `:227-249` | |
| `/footprints/*/outline/arcs/*`, `/detail/arcs/*` | `AssemblyHlrArc` | nm, deg | in Geometer order after dedupe | `_arcs_from_mode` / `_arc_from_json` (`projection.py:391-462`), `_dedupe_arcs` `:251-302` | |
| `/footprints/*/status` | `AssemblyHlrStatus` | — | present exactly when `outline`/`detail` are absent | `model-unavailable`, `model-not-step`, `projection-failed` (cli-spec.md §5.2.4) | |

`AssemblyHlrArc` fields are Geometer's own (`projection.py:437-462`): `startNm`, `endNm`, `centerNm`, `radiusNm`, `extentDeg` (from `extent_rad`), `ccw`, `fullCircle`. ADR amendment §3.1 sketches the arc as `{centerNm, radiusNm, startDeg, endDeg}`; Geometer returns start/end points plus an angular extent and the `ccw`/`full_circle` flags, so the contract keeps those. `extent_deg = extent_rad × 180/π`.

## Fields — `CliArtworkResultA0` (`prism.cli.artwork_result.a0`)

stdout of `artwork` (cli-spec.md §5.7). No producer yet (chunk E); the example is built from the `AssemblyHlrA0` example's identities.

| Field (JSON pointer) | Source | Exemption |
|---|---|---|
| `/schema` | new | |
| `/views`, `/views/*/name`, `file`, `sha256`, `footprints_drawn`, `designators_placed`, `footprints_without_outline` | cli-spec.md §5.7 output bullet; `name`/`file`/`sha256` from the config's view and written SVG, the counts from the designator fitter | snake_case (bundle machinery) |

## Fields — `CliVendorListA0` (`prism.cli.vendor_list.a0`) and `CliVendorRunResultA0` (`prism.cli.vendor_run_result.a0`)

stdout of `vendor list` / `vendor run` (cli-spec.md §5.8). No producer yet (chunk B).

| Field (JSON pointer) | Source | Exemption |
|---|---|---|
| `/vendors/*/id`, `name`, `outputs`, `outputs/*/kind`, `format`, `version`, `config_schema` | cli-spec.md §5.8; `outputs` and `config_schema` mirror `VendorJlcpcbConfigA0`'s `bom.outputs`/`pnp.outputs` and its schema id | snake_case |
| `/vendor`, `/files`, `/files/*/path`, `sha256`, `/rows` (`{key}`), `/excluded`, `/excluded/*/key`, `reference`, `code`, `message` | cli-spec.md §5.8; `rows` keys are the vendor's table names (`bom`, `cpl`) | snake_case; `code` is a `DiagnosticCode` |

## Fields — `CliStrokeTextResultA0` (`prism.cli.stroke_text_result.a0`)

stdout of `stroke-text --request` (cli-spec.md §5.9).

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) |
|---|---|---|---|---|
| `/schema` | const | — | required | new |
| `/runs` | `CliStrokeTextRun[]` | — | required; mirrors the request run order | one `render_text_polylines` call per run |
| `/runs/*/polylines_mm`, `/*/*` | `CliMmPolyline[]` | mm | required; renderer order, each polyline one stroke | the returned list of point lists (`kicad_stroke_font.py:453-612`) |
| `/runs/*/advance_mm` | float64 | mm | required | `_calculate_text_width(text) × size_mm` (`fonts.py:226-229`) |
| `/runs/*/missing_codepoints` | `Count[]` | — | required, may be empty; ascending | `fonts.unsupported_codepoints` (`fonts.py:289-310`, `get_glyph(char) is None`), which the renderer substitutes with `?` (`kicad_stroke_font.py:547-553`) |

## Fields — `CliStrokeFontMetricsA0` (`prism.cli.stroke_font_metrics.a0`)

stdout of `stroke-text --metrics` (cli-spec.md §5.9).

| Field (JSON pointer) | Type | Order / nullability | Today's source (path:line) |
|---|---|---|---|
| `/schema` | const | required | new |
| `/space_width` | float64 | required | `get_space_width()` = glyph(`" "`).width (`kicad_stroke_font.py:412-415`) |
| `/super_sub_size_multiplier` | float64 | required | `SUPER_SUB_SIZE_MULTIPLIER = 0.8` (`kicad_stroke_font.py:40`) |
| `/advances` (`{key}`) | `Record<float64>` | required; keys are the decimal code points the font has a glyph for, `"32"`–`"11263"` | `get_glyph(chr(cp)).width` for `cp` in `0x20 … 0x20+len(data)-1` (`kicad_stroke_font.py:388-409`; the table's index is `ord(c) − 0x20`, `:401`) |

**Width formula** (the contract's doc comment is normative). For a string, the normalized advance is the left-to-right IEEE-754 sum of the per-scalar contributions: U+0020 contributes `space_width`; any other scalar contributes `advances[<decimal code point>]` when present and `0` when absent. This reproduces `_calculate_text_width` (`kicad_stroke_font.py:653-668`). For markup, a text node inside a `^{}`/`_{}` span is scaled by `super_sub_size_multiplier`, a `~{}` span is not (`_markup_nodes_width` `:670-681`, `has_markup` `:65-67`). Checked against `_calculate_text_width` on every printable ASCII character, `R12`, `U3.1`, `TP7`, `Ω`, `µ`, `±`, `°`, a long title line and four markup strings: exact.

## Fields — `CliDrawingSheetResultA0` (`prism.cli.drawing_sheet_result.a0`)

stdout of `drawing-sheet --request` (cli-spec.md §5.9). Typed from the real `KiCadPlotterOp`s `drawing_sheet_to_ops` returns.

| Field (JSON pointer) | Type | Order / nullability | Today's source (path:line) |
|---|---|---|---|
| `/schema` | const | required | new |
| `/ops` | `CliDrawingSheetOp[]` | required; the worksheet's on-disk element order with repeats expanded in place | `drawing_sheet_to_ops` (`kicad_monkey/kicad_drawing_sheet.py:730-820`) |
| `/ops/*/kind` (`poly`) | const | required | `KiCadPlotterOp.plot_poly` (`kicad_plotter_ir.py:511-529`); a two-point poly is the `Line` of `worksheet.py:84-92` |
| `/ops/*/{points,fill,width_nm,stroke_color}` | `CliPointNm[]`, enum, `NonNegativeNanometres`, string | required | `_line_repeat_ops` (`kicad_drawing_sheet.py:498-539`) |
| `/ops/*/kind` (`rect`) | const | required | `KiCadPlotterOp.rect` (`kicad_plotter_ir.py:484-509`) |
| `/ops/*/{x1_nm,y1_nm,x2_nm,y2_nm,corner_radius_nm,fill,width_nm,stroke_color}` | `Nanometres`, `NonNegativeNanometres`, enum, string | required | `_rect_repeat_ops` (`kicad_drawing_sheet.py:542-590`) |
| `/ops/*/kind` (`text`) | const | required | `KiCadPlotterOp.text` (`kicad_plotter_ir.py:531-580`) |
| `/ops/*/{x_nm,y_nm,text,color,orient_deg,size_x_nm,size_y_nm,pen_width_nm,h_align,v_align,italic,bold,multiline,font_face}` | `Nanometres`, string, `Degrees`, `NonNegativeNanometres`, enums, boolean | required | `_tbtext_repeat_ops` (`kicad_drawing_sheet.py:593-674`); `apply_default_text_style` fills `color`, `font_face` and `pen_width_nm` (`kicad_schematic_style.py:180-215`) |

The text op carries the run's parameters; the CLI renders the glyph geometry with the core's NewStroke font, so a consumer draws `text` at (`x_nm`,`y_nm`) with `size_x_nm`/1e6 mm and `h_align`/`v_align` (cli-spec.md §5.9, ADR amendment §2 item 4). The op's `color`/`stroke_color` are `#RRGGBB` or `#RRGGBBAA`; the default worksheet's are `#840000FF`.

## How a golden is produced from today's code

- **`AssemblyHlrA0`.** Run Cruncher 2026.9.7's own projection path on the fixture board:
  `KiCadPcb.from_file(<board>)` with `KIPRJMOD` set and `KICAD9_3DMODEL_DIR` pointing at the fixture's `packages3D/`; for each footprint, `_first_step_model` → `_resolve_model_step_bytes` → `kicad_model_local_pose` → `_assembly_projection_options` → `_get_assembly_projection_cache().project` → `_projected_geometry_to_footprint_board_world` (`kicad_cruncher_cmd_pcb_svg.py:1689-1712`, `:1768-1785`, `:1718-1747`, `:1903-1938`). Convert each board-world point `(wx, wy)` to the board frame as `(wx, −wy)` and to nanometres with `round_half_away(v_mm × 1e6)` (`conventions.md` §6); `radiusNm` the same; `extentDeg = extent_rad × 180/π`. The member records `options` and `geometer.version().string`.
  - The example is one footprint with a full-circle arc, one with partial arcs and one `model-unavailable`, trimmed to its first segments/arcs. It sets `options.projectionAlgorithm = "exact"` so the arc fields are exercised (`exact` + `native_arcs` is Geometer's arc mode); the shipped configs leave it unset, so real members have empty `arcs`.
  - Validated on `fixtures/release-studio/usb-pd`: the default options give 5 projected and 31 `model-unavailable` footprints (the stock `${KICAD9_3DMODEL_DIR}` models are not in the fixture), 0 failures; the `exact` options add 23 arcs. Both validate.
- **`CliStrokeFontMetricsA0` / `CliStrokeTextResultA0`.** `get_renderer()`, `_calculate_text_width`, `render_text_polylines` and `get_glyph` over the corpus above; the metrics table reproduces `_calculate_text_width` exactly.
- **`CliDrawingSheetResultA0` / `DrawingSheetRequestA0`.** `drawing_sheet_to_ops(load_default_drawing_sheet(), …)` for A4 and A3 with a full title block, as `worksheet.py:47-65` calls it; the ops are the `PlotPoly`/`Rect`/`Text` payloads mapped one-to-one (A4 58 ops, A3 76 ops). Both validate.
- **`ArtworkConfigA0` / `VendorJlcpcbConfigA0`.** The committed configs with `_prism` dropped and `schema` replaced (see "Not typed").

## Expected divergences

None. These documents are new; `AssemblyHlrA0`'s geometry is equal to today's Cruncher projection (§4), and the config schemas are the files' own shape. `AssemblyHlrArc` keeps Geometer's fields rather than the amendment's sketch (see above).

## Example provenance

| Root | Derived from | Trimmed |
|---|---|---|
| `ArtworkConfigA0` | `backend/app/release_studio/documents/pcb-svg.config.json`, `_prism` dropped, `schema` replaced | nothing else |
| `VendorJlcpcbConfigA0` | `backend/app/release_studio/vendors/jlcpcb.config.jsonc`, comments stripped, `schema` replaced | nothing |
| `StrokeTextRequestA0` / `CliStrokeTextResultA0` | `get_renderer().render_text_polylines` for `R12` (left/bottom, 1.27 mm) and `TP7` (center/center, 2.5 mm) | two of the corpus's runs |
| `DrawingSheetRequestA0` / `CliDrawingSheetResultA0` | `drawing_sheet_to_ops(load_default_drawing_sheet(), A4 full title block)` | the result keeps one `poly`, one `rect` and one `text` op of the 58 |
| `AssemblyHlrA0` | `fixtures/release-studio/usb-pd`, Cruncher's projection (`exact` options), three footprints trimmed | 3 of 36 footprints; 2 segments and up to 2 arcs per edge set |
| `CliStrokeFontMetricsA0` | the full 11,232-entry glyph table | 17 representative code points |
| `CliArtworkResultA0` | the `AssemblyHlrA0` example's footprint identities (its `footprints_without_outline`) and the artwork config's view names; no producer yet | the two assembly views |
| `CliVendorListA0` | cli-spec.md §5.8; the JLCPCB outputs | one vendor |
| `CliVendorRunResultA0` | the `AssemblyHlrA0` example's `R6` identity; no producer yet | one excluded component |
