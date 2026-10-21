# Divergences: `projections/placements.json`

- Member: `placements`, schema `prism.placements.a1` (root `PlacementsA1`)
- Producer: WP-P3 (`native/src/rs/prism-projections/src/placements.rs`)
- Field map: [`native/contracts/prism/field-maps/placements.md`](../../contracts/prism/field-maps/placements.md), "Expected divergences" (full text there)
- Golden: `capture/placements.py`, an independent Python producer of R1-R13 (`capture/placements_build.py`; the W0 prototype is Rust on the fork core, the code under test), with consumer checks `rs-testpoints`, `rs-population`, `rs-designators`, `sb-geometry`, `sb-outline`, `catalog` (`capture/placements_derive.py`) and the KiCad 10.0.6 `ipcd356` oracle as a note (`capture/placements_oracle.py`)

No document of this shape exists today: the golden is the contract's value,
and the divergences below are between the member and today's consumer values.
A correct Rust member equals the golden on every committed fixture, so
`placements.json` accepts nothing (`"accepted": []`).

## D1. Testpoint with an explicit `(at x y 0)`

- Today: RS `rotation: 0.0`. Bundle: `rotationDeg: 0`, which C3 maps to `null`.
- Consumer: RS testpoints digest. Fixtures: none (`rs-testpoints` equal on all 28 boards, 46 rows on cynthion and usb-pd). Needs nothing.

## D2. Pad anchor of a footprint rotated by an angle that is not a multiple of 90°

- Today: v1 rounds the float-mm rotation to 1e-4 mm. Bundle: KiCad's integer-nm rotation (R9, decisions.md Placements 5), so v1's 4th decimal can differ by one unit.
- Why: it is KiCad's own pad position (the oracle agrees within 0.5 IPC units).
- Consumer: P3's SB check only. Fixtures: none (every committed footprint is at a multiple of 90°). The `sb-geometry` check accepts it by rule (≤ 1e-4 mm on a pad or courtyard value); measured on the W0 arbitrary-angle copies: mezz_base and mezz_top are `divergence D2` (a handful of pads each), usb-pd `equal`.

- **Wider than the field map states (corpus, 2026-10-16).** The same one-unit flip occurs at 0°, 90° and 180° when a value sits exactly on a 4th-decimal half-tie. Example: C226 of vme-wren at x = 211.49225 mm. v1's float error (~1e-14 mm) then decides the side. Measured on the corpus: EDA-04903, vme-wren and openswitch-lan969x (J1: 6 pads). The rule therefore applies at any rotation. It is still a display rounding of the same KiCad position. The field map's D2 row should drop "not a multiple of 90°".

## D3. Courtyard arc or Bézier

- Today: three points per arc, curves ignored. Bundle: true arc extents and curve control points.
- Consumer: SB courtyard. Fixtures: none (`sb-geometry` equal on every courtyard). Needs nothing.

## D4. KiCad 7 references (`fp_text reference`)

- Resolved by the source upgrade (decisions.md, Occurrences 1): `rs-cynthion` and `rs-synthetic` are upgraded to KiCad 10.0.6's format before capture, so every footprint has a `Reference` property and v1 sees every reference. The `sb-geometry` check would report references only the member has as D4; there are none (0 on all 28 boards). The producer has no `fp_text` or `tstamp` fallback (the field map's R2/R3 still mention them; `placements-a0.tsp` and decisions.md do not).

## D5. Board without board-level Edge.Cuts

- Today: v1 `boardOutlineMm` from kicad_monkey's `get_bounds`, `source: "items"`. Bundle: `outlineBounds` absent.
- Consumer: none through the member (P5 keeps the fallback, computed from the core).
- Fixtures: the 14 `sb-mini_obc-*` and `sb-mini_power-*` boards. The `sb-outline` check records `divergence D5` there and skips the outline. The golden already reflects it; the runner needs nothing.

## D6. Reference with surrounding whitespace

- Today: RS designators trimmed. Bundle: as written; C3 trims.
- Fixtures: none. Needs nothing.

## D7. Hidden models

- Case: a footprint whose first model is hidden.
- Today: v1 picks it. `interface_extractor._model` skips a model only when kicad_monkey's `Model.to_sexp()` holds a `(hide …)` list, and kicad_monkey 2026.9.7 drops `(hide yes)` from `to_sexp()` (it is only in the model's raw S-expression). The field map attributes D7 to the bare KiCad 6/7 `hide` token; on an upgraded board KiCad writes `(hide yes)` and today still misses it, so the cause is broader than the field map says.
- Bundle: `hidden: true`, and the SB derivation takes the first visible model.
- Why: KiCad hides it.
- Consumer: SB through v1 (P5 keeps today's rule for the digest).
- Fixtures: `rs-cynthion` U1 and U7 (hidden QFN-16 EP1.45 / SOIC-8 models before the visible ones). With the upgrade D4 no longer masks it, so the `sb-geometry` check records `divergence D7` on cynthion. The golden already reflects it; the runner needs nothing.

## D8. Footprint-owned Edge.Cuts

- Excluded in both. Fixtures: usb-pd J1's six footprint Edge.Cuts form an inner slot; `sb-outline` equal. Needs nothing.

## Notes for the runner

- **Source spans** refer to the prepared (upgraded) bytes, which are the `sources/` member's bytes (bundle-format.md §2.2). On the three upgraded boards they differ from the committed file's offsets.
- **Cross-check with the W0 Rust prototype** (`w0/placements/out/proto`, run on the committed bytes): JSON-value equal on all 25 boards whose source is not upgraded. On the three upgraded boards only `sourceSpan` differs (cynthion 348 footprints, usb-pd 37, synthetic 3); uuids, references, pads and models are equal.
- **No board** (`dv-legacy_in_bom`, `dv-rule_area`, `dv-sch_only`, `sb-mini_payload-F0`): the R1 empty form `{footprints: [], designators: []}`, no `outlineBounds`.
- **`dv-malformed`**: not captured. Its root schematic does not parse, so stage parse fails and no projection is written.
