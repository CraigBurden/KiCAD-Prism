# ADR amendment: Release Studio without Cruncher (C3)

- **Status:** Accepted (2026-10-17), including the three consequences raised at review: `placements` a1 for the aux origin (§3.3), no testpoint-only board (§2 item 6), and releases waiting for stages `parse`, `board` and `models` (§2 item 5). The contracts PR applies §3.5's new documents; `placements` a1 and the generator id's `hlr_procedure` land with the code that writes them (chunks B and D), as amendment #727 did.
- **Parent:** [`adr-native-design-bundle.md`](adr-native-design-bundle.md): §2.1, §6, §9.3, §9.6 (C3 row), §9.7 (R2, X), §10 items 4 and 6.
- **Supersedes:**
  - ADR §2.1 "kicad-cruncher as a tool" and §10 item 4 ("Release Studio keeps calling it as a tool");
  - `native/contracts/prism/decisions.md`, Ownership map item 1 (Release Studio's Python tools `pcb-svg`, `bom`, `pnp`, the stroke font and the drawing sheet stay as allow-listed uses).
- **Decided before this draft** (maintainer, 2026-10-17):
  1. Drop the `kicad-cruncher` dependency entirely, and with it Release Studio's remaining Python `kicad_monkey` tool uses. Their logic is re-implemented in Prism's Rust parser and CLI.
  2. **Assembly artwork:** port Cruncher's `pcb-svg` to Rust, keeping the hidden-line (HLR) projections of each part's STEP model, through the Rust `geometer-client` Prism already pins.
  3. **Vendor files:** a Rust vendor command, designed so more vendors can be added. Its registry becomes Release Studio's vendor selection.
  4. **Sheet text:** a small `prism-kicad` command exposes the core's NewStroke font and default drawing sheet.
  5. **Zone fills:** board kicad-cli steps read `refilled/`; schematic steps read `sources/`.
  6. **Scope fingerprint:** the technical-scope fingerprint hashes an a0-compatible view of the semantic index.
  7. **HLR cache:** HLR results are cached by model bytes, pose and options, and stored as a bundle member of stage `models`.
  8. **Image:** the image builds `geometer-client` and ships the Geometer runtime.

## 1. Context

Release Studio parses each revision several more times than the bundle allows (ADR §1): `KiCadPcb` in `release_studio/projections.py` and twice in `documents/artwork.py`, `parse_sexp` in `closure.py` and `closure_references.py`, and a full semantic-index build in `document_pipeline.py`. It also depends on two Python packages for its deliverables.

| Use | Today | Call sites |
|---|---|---|
| Assembly and testpoint artwork | `kicad-cruncher pcb-svg <board> --config <cfg> --views <names>`, which uses Python kicad_monkey's plot IR and `wn-geometer` | `documents/artwork.py:652-684`, callers `:480`, `:599`, `:644`; configs `documents/pcb-svg.config.json`, `pcb-svg.testpoints.config.json` |
| Artwork viewport | a `KiCadPcb` load to recompute Cruncher's canvas, because Cruncher 2026.8+ ignores its own `global.canvas` | `artwork.py:699-845` |
| Testpoint-only board | a `KiCadPcb` load, removal of non-TP footprints, save | `artwork.py:494-562` |
| JLCPCB BOM and CPL (CSV members, XLSX evidence) | `kicad-cruncher bom` / `pnp` with `vendors/jlcpcb.config.jsonc` | `vendors/jlcpcb.py:60-120` |
| Sheet text and frame | Python kicad_monkey `kicad_stroke_font` (measure, missing glyphs, polylines) and `drawing_sheet_to_ops(load_default_drawing_sheet())` | `documents/fonts.py:220`, `:300`, `:358`; `documents/worksheet.py:36-66` |

What the artwork actually does:
- **3D-body outlines:** a hidden-line projection of each footprint's first `.step`/`.stp` model, embedded or a file, through `geometer.project_step_hlr`. It yields outline (silhouette) and detail (visible internal edges) segments and arcs, placed by the model pose (`kicad_cruncher_pcb_svg_projection.py:133-196`, `kicad_cruncher_pcb_model_pose.py`).
- **Designators:** auto-fitted inside each part (`kicad_cruncher_cmd_pcb_svg.py:1116-1225`). Today that means the centre of the model, hole or pad bounding box, with a font size from `width / (0.62 × length)` clamped to 0.35–2.5 mm and 80 % fill, and no collision handling.
- **The rest of the view:** board outline, cutouts, drills, slots and pin-1 markers, styled per layer from Prism's config.

What Prism already has in Rust:
- **Plot IR:** the core's board plot IR (`prism-kicad-core::board_plotter_ir`, ADR-007/009) and its SVG serialiser (`prism-kicad-svg`, ADR-012).
- **Sheet text:** NewStroke (`prism-kicad-core/src/newstroke.rs`) and the default worksheet (`schematic_plotter_ir/worksheet_render.rs`).
- **Designator fitting:** the fork's own `pcb_svg` work in `native/packages/kicad_cruncher/src/rs/kicad-cruncher-cli/` includes `designator_layout.rs`, ported from PCB Autodoc. It builds the real body region as a polygon, tries several centres (centroid, interior point, a 4×4 grid) and rotations, binary-searches the largest font whose text box fits, and caches fits.
- **Geometer:** the pinned client `geometer-client` (`rev 703e6002`, `native/Cargo.toml:47`; MIT, about 0.9 MB of Rust over tokio) exposes `model_hlr_projection`, `model_bounds` and `model_illustration_geometry`. The image leaves that crate out today because cargo would clone the 1 GB Geometer repository to build it (`backend/Dockerfile:69-80`).

## 2. Decision

1. **No Cruncher, no Release Studio use of Python kicad_monkey.**
   - `kicad-cruncher` leaves `requirements/runtime.in`, the image, `kicad_tools.KICAD_CRUNCHER` and the settings.
   - Release Studio's direct `kicad_monkey` imports go (`projections.py`, `artwork.py`, `closure*.py`, `fonts.py`, `worksheet.py`).
   - The only Python kicad_monkey use left after C3 is the catalog's library-file imports (decisions.md item 2), so R2's and X's allow-list shrinks to those.
2. **Four Rust capabilities, as `prism-kicad` commands and one bundle member** (§3):
   - the assembly HLR member `models/assembly-hlr.json`, written in stage `models`;
   - `prism-kicad artwork`, the assembly and testpoint views;
   - `prism-kicad vendor`, a vendor registry and its outputs, JLCPCB first;
   - `prism-kicad stroke-text` and `prism-kicad drawing-sheet`, the sheet text and frame.
3. **Two new crates** (an amendment change to `native/Cargo.toml`, owned by this amendment's PRs):
   - **`prism-artwork`:** views, compositing, the HLR overlay, designator fitting, and the stroke-text and drawing-sheet facades over the core;
   - **`prism-vendors`:** the BOM and placement core plus one module per vendor.

   Code is harvested from `kicad-cruncher-cli` (`designator_layout.rs`, `virtual_layers.rs`, `models.rs` and what `preview.rs` holds of model handling). After the harvest R2 removes `kicad-cruncher-cli` from the workspace.
4. **Geometer:**
   - `geometer-client` is vendored at the pinned revision into `native/third_party/geometer-client/`, with its MIT notice added to `NOTICE` and `native/LICENSES.md`, and the workspace points at the path. That removes the 1 GB clone, and the Dockerfile stops deleting the member.
   - The Geometer runtime executable is fetched at a pinned release in the image (the existing SDK step, `backend/Dockerfile:26-48`, is the pattern) and found through `GEOMETER_EXECUTABLE`. It must be the version the vendored client accepts (`pcb_svg/geometer.rs:8-14` checks it).
   - ADR §10 item 6 is unchanged: Geometer stays a pinned external dependency, now as a runtime the CLI launches instead of a Python package.
5. **Release Studio reads the bundle** for everything that was a parse:
   - P3 `stackup` and `placements`, P4 `project` (closure references, text variables) and P2 `occurrences` (variants);
   - P1 `semantic-index`, through an a0-compatible view for the scope fingerprint (§5);
   - kicad-cli on bundle files: board steps (DRC, Gerbers, drill, positions, board stats, renders and plots) on `refilled/<stem>.kicad_pcb`, schematic steps (ERC, BOM, schematic PDF) on `sources/`. A project whose effective configuration says `zone_fills: "saved"` gets the saved fills, as the bundle already records.

   A release therefore waits for stages `parse`, `board` and `models`. The not-ready policy is unchanged: queue the build, and serve today's path until R1.
6. **The testpoint-only board goes.** `artwork` selects footprints by designator pattern itself, as Cruncher's `selector_overrides` already describe (`pcb-svg.testpoints.config.json:129-137`), so no filtered board is written. This replaces the earlier choice of cutting footprints by `sourceSpan`, which only existed to replace the `KiCadPcb` load in that staging.
7. **The viewport workaround goes.** `artwork` applies the config's `global.canvas` (`bounds: "board_outline"`, `margin_mm`) itself, so `_cruncher_board_viewport` and `_apply_cruncher_viewport` are deleted.

## 3. Interfaces

### 3.1 Bundle member `models/assembly-hlr.json` (stage `models`)

- **Contents:** for each footprint with a resolvable first `.step`/`.stp` model, keyed `documentPath#uuid`:
  - `side`, the model reference, and its content digest;
  - the full model pose (the footprint placement and the model's offset, rotation and scale, in Cruncher's `kicad_model_local_pose` order);
  - `outline` and `detail` edge sets (segments and arcs, in board nanometres after the pose, bottom-side views mirrored as today).

  Footprints whose model is missing, not STEP, or rejected by Geometer are listed with a reason (`model-unavailable`, `model-not-step`, `projection-failed`), never silently dropped.
- **Schema:** `prism.assembly_hlr.a0`, TypeSpec `native/src/tsp/prism/assembly-hlr-a0.tsp`.
- **Model resolution:** what `project.json` and `placements` already record:
  - repository models come from `sources/`;
  - `kicad-library` references resolve through a new `--model-dir <VAR>=<dir>` argument (the worker's KiCad stock library, already pinned by the KiCad version in the generator id);
  - `kicad-embed://` models come from the board's or the footprint's embedded files.
- **Cache:** one entry per `(sha256 of the STEP bytes, the pose's rotation and scale, the HLR options, the Geometer runtime version)` under `.kicad-prism/hlr-cache/`. A pose that differs only by board translation or by rotation about the board normal reuses the entry, transformed, so a revision that moves parts does not re-project them.
- **Generator id:** gains `hlr_procedure` (the Geometer runtime version and the HLR options) and the member's schema version. This is a one-time bump of every bundle key.
- **Runs Geometer:** cli-spec §0.4 ("the CLI never runs KiCad") stays true. The CLI does run the pinned Geometer runtime in stage `models`, under the stage's limits and timeout (§7). A Geometer failure on one model is recorded per footprint; failure of the runtime itself fails the stage, retryable like the GLB step.

### 3.2 `prism-kicad artwork`

```text
prism-kicad artwork --in <bundle.prism> --config <artwork.json> --view <name>... -o <dir> [--variant <name>] [COMMON]
```

- **Input:** the board is `refilled/<stem>.kicad_pcb` (or `sources/` with saved fills), parsed once by the core: artwork is a KiCad-output job, like kicad-cli. Body outlines come from `models/assembly-hlr.json`. Designators come from `placements` and `occurrences`, with variants applied.
- **Config:** Prism's existing `pcb-svg` configs, renamed to schema `prism.artwork.config.a0` with the same views, layer tokens (`BOARD_OUTLINE`, `CUTOUTS`, `DRILLS`, `SLOTS`, `PIN1_*`, `ASSEMBLY_HLR_*`, `ASSEMBLY_DESIGNATORS_*`), styles, `selector_overrides` and `global.canvas`.
- **Output:** one SVG per view, `<dir>/<view>.svg`, plus `CliArtworkResultA0` on stdout (the files, their sha256, and per view the footprints drawn, the designators placed and any footprint without a body outline).
- **Designators:** the fork's Autodoc fitting. The body region is the HLR outline polygon when present, else the hole envelope, else the pad envelope. The font family and the 0.62 advance ratio stay as config defaults.
- **Determinism:** byte-identical output for the same bundle, config and generator. Numbers are formatted to a fixed precision.

### 3.3 `prism-kicad vendor`

```text
prism-kicad vendor list                                                       # CliVendorListA0: id, name, outputs, options, config schema
prism-kicad vendor run <vendor-id> --in <bundle.prism> --config <cfg> -o <dir> [--variant <name>] [COMMON]
```

- **Design:** a registry of vendor modules over one shared core. The core normalises BOM rows from `occurrences` (fields, DNP, exclude-from-BOM, variants, grouping) and placements from `placements` (side, position, rotation, excluded-from-position). A vendor module maps them to its files.
- **JLCPCB is the first module:**
  - BOM columns `Comment, Designator, Footprint, JLCPCB Part #`; CPL columns `Designator, Layer, Mid X, Mid Y, Rotation`;
  - today's grouping (`value`, `footprint`), ordering, decimal formatting (Mid X/Y to 4 dp, rotation to 2 dp), coordinates measured from the board's aux origin with y negated, rotation modulo 360;
  - XLSX as well as CSV.

  The rules are ported from Cruncher 2026.9.7 `kicad_manufacturing_design.py` and `bom_pnp_model.py`.
- **Vendor selection:** Release Studio's vendor selection reads `vendor list`. Adding a vendor is a module plus its config schema, with no Python change.
- **Contract gap:** `placements` does not record the board's aux axis origin, which the CPL needs. `placements` goes to **a1**, adding `board.auxAxisOriginNm` (from `(setup (aux_axis_origin …))`, absent means 0,0). That is additive, so P3's parity on the other fields is unchanged.

### 3.4 `prism-kicad stroke-text` and `prism-kicad drawing-sheet`

```text
prism-kicad stroke-text --request <runs.json>        # CliStrokeTextResultA0: per run, polylines (mm), advance width, missing code points
prism-kicad stroke-text --metrics                    # CliStrokeFontMetricsA0: per-glyph advance table, for layout-time measurement
prism-kicad drawing-sheet --request <sheet.json>     # CliDrawingSheetResultA0: the default worksheet's operations for a page and title block
```

- **Batching:** both commands take batches. Release Studio's layout measures text many times, so it loads the metrics table once per build, cached by generator id. It then renders each sheet's runs in one `stroke-text` call, and its frame in one `drawing-sheet` call.
- **Request fields:** they mirror today's calls:
  - runs carry `render_text_polylines(value, x, y, size, size, h_align, v_align)`;
  - the sheet request carries `drawing_sheet_to_ops`'s page size in nm, title block, comments, sheet index and count, paper name, file name, sheet path and name, and KiCad version.
- **`resource_bundle_digest`** (`fonts.py:181-196`) stops hashing kicad_monkey's glyph JSON and records `prism-kicad version`'s generator digest instead.

### 3.5 CLI spec and contracts

- **New cli-spec sections:** §5.7 `artwork`, §5.8 `vendor`, §5.9 `stroke-text` and `drawing-sheet`, and stage `models`'s HLR inputs in §5.2.4 (`--geometer <exe>`, `--model-dir`).
- **New roots:** `CliArtworkResultA0`, `CliVendorListA0`, `CliVendorRunResultA0`, `CliStrokeTextResultA0`, `CliStrokeFontMetricsA0`, `CliDrawingSheetResultA0`, `AssemblyHlrA0`, and `PlacementsA1`.
- **New config schemas:** `prism.artwork.config.a0` and `prism.vendor.jlcpcb.config.a0`.
- **Codes:** `geometer-unavailable`, `geometer-version-mismatch`, `model-not-step`, `projection-failed`, `vendor-unknown`, `view-unknown`.

## 4. Parity and acceptance

| Output | Target |
|---|---|
| JLCPCB BOM and CPL CSVs (dossier members) | **byte-identical** to today's Cruncher output on the Release Studio fixtures (synthetic, usb-pd, cynthion) and the corpus |
| JLCPCB XLSX (evidence) | cell-identical: same sheets, cells, values and types |
| Stroke text | polylines and advance widths equal to Python kicad_monkey's `kicad_stroke_font` within 1e-9 mm on a string corpus (every glyph the documents use, plus all of NewStroke's printable range); the same missing-code-point sets |
| Drawing sheet | operations equal to `drawing_sheet_to_ops(load_default_drawing_sheet(), …)` for every paper size and title block Release Studio uses |
| HLR outlines | per footprint, the segment and arc sets equal to today's Cruncher projection after its own dedupe, within 1e-6 mm, on the fixtures (same Geometer operation and options) |
| Designators | not byte parity (a better algorithm): every placed designator's text box lies inside its body region; none falls below the minimum font; a visual check of the cynthion and usb-pd assembly sheets |
| Release Studio projections | the stackup, placement, testpoint, population and variant results equal today's on the fixtures (P3/P4 parity already covers the inputs) |
| Scope fingerprint | equal to today's for the same revision (the a0-compatible view) |
| Dossier digest | **changes once** at the switch, because the artwork and the sheets that embed it change. This is recorded as divergence `rs-1` with both digests per fixture. The replay recording (`fixtures/release-studio/cli-recordings/synthetic-build/`) is re-captured, and two builds still give the same digest. Fills from `refilled/` are divergence `rs-2` where a fixture's saved fills are stale. |
| Boundary | no `kicad_monkey`, `kicad_cruncher` or `geometer` import under `backend/app/release_studio/` or `backend/app/services/release_studio*` (X's test) |

## 5. The a0-compatible scope view

`semantic.py:23-52` hashes the index per domain. In bundle mode C3 builds the same input from the a1 member:
- it removes `pinName`, `pinType`, `libraryRef` and `schematicNetName`;
- it uses the schema id `prism.semantic_index_a0`.

P1's parity is "a1 equals the a0 golden plus those additions" (`field-maps/semantic-index.md`), so the digest equals today's. Field-map row D8's open question is closed this way.

## 6. Work split

| # | Chunk | Where | Depends on |
|---|---|---|---|
| A | Contracts PR: this text applied to the ADR, cli-spec, decisions.md and ownership.md; the TypeSpec roots and config schemas of §3.5; `placements` a1; the generator id fields | main thread | — |
| B | `prism-vendors` with JLCPCB, and `vendor list`/`run`; goldens captured from today's Cruncher on the fixtures | DeepSeek | A |
| C | `stroke-text` and `drawing-sheet` over the core; parity harness against Python kicad_monkey | DeepSeek | A |
| D | Vendored `geometer-client`, the runtime in the image, the HLR member in stage `models` with its cache; parity against Cruncher's projections | main thread (image, job) + DeepSeek (member) | A |
| E | `prism-artwork`: views, compositing from the plot IR, the HLR overlay, designator fitting, canvas | DeepSeek (L) | A, D |
| F | Release Studio on the bundle: the projection reads (C3a), the a0 scope view (C3b), kicad-cli on `refilled/`/`sources/` (C3c), the closure from P4 (C3d), the artwork/vendor/text calls (from B, C, E), provenance from the generator id (C3f); remove `kicad-cruncher`; re-capture the replay recording | main thread, with DeepSeek for C3a, C3d and C3f | A–E |

**F progress.** F is done. C3a–C3f built bundle mode (the board projections, the
a0-compatible scope view, the `refilled/`/`sources/` kicad-cli inputs, the
closure's documents and references, and the provenance from `bundle.json`'s
generator); F4c removed the switch and the legacy path — the Python
`kicad_monkey` projections, the `kicad-cruncher` artwork/vendor calls, the
settings and the tool — and re-captured the replay recording in bundle mode.
The closure's checkout scan moved to `backend/app/services/closure_scan.py`
because System Builder's board-step job still materializes a closure with no
bundle. `rs-1` and `rs-2` record the dossier and fill divergences
(`native/parity/divergences/release-studio.md`).

R2 then removes `kicad-cruncher-cli` from the workspace and the allow-list
entries this amendment retires; `kicad-monkey` stays installed for the
catalog's library-file imports until R2.

## 7. Risks

| # | Risk | Mitigation |
|---|---|---|
| R1 | HLR on large STEP models is slow, so stage `models` gets longer | the cache across revisions (§3.1); a `timeout-ms` default for `models` sized on cynthion; per-footprint failures recorded, never fatal |
| R2 | The Geometer runtime differs between the CI hosts, macOS and the image | pin one release; check the version at spawn (`geometer-version-mismatch`); run HLR parity in CI only where the runtime is installed, as today's live KiCad lane is gated |
| R3 | The artwork changes the look of released documents | the visual check in §4; styles stay in Prism's config, so they can be tuned without code |
| R4 | A vendor's file format drifts | each vendor module has golden fixtures; `vendor list` declares output versions |
| R5 | Scope: four capabilities instead of a reader migration | chunks B, C and E are independent and run in parallel; F waits only for what it calls |
