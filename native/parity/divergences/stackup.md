# Divergences: `projections/stackup.json`

- Member: `stackup`, schema `prism.stackup.a0` (root `StackupA0`)
- Producer: WP-P3 (`native/src/rs/prism-projections/src/stackup.rs`)
- Field map: [`native/contracts/prism/field-maps/stackup.md`](../../contracts/prism/field-maps/stackup.md), "Expected divergences" (full text there)
- Golden: `capture/stackup.py` (the W0 prototype producer, ported: `capture/stackup_build.py`), with consumer checks `rs`, `dc`, `3d`, `topology-layers`, `topology-board`, `mid-plane`, `mid-plane-nm`, `board-looks` (`capture/stackup_derive.py`)

No document of this shape exists today, so the golden *is* the contract's
value and every divergence below is between the member and one of today's
consumer shapes, not between a correct Rust member and the golden. None of
them occurs on a committed fixture: on all 28 boards every check is `equal`.
`stackup.json` therefore accepts nothing (`"accepted": []`).

## D1. Dielectric sub-layers (`addsublayer`)

- Case: a dielectric `(layer …)` form with `addsublayer` tokens.
- Today: one row per form; sub-layer thicknesses after the first are dropped (RS `total_thickness`, 3D thickness and z, mid-plane short).
- Bundle: one entry per sub-layer; `stackThicknessNm` counts them all (decisions.md, Stackup 1).
- Why: KiCad's thickness, stackup table and GLB board count every sub-layer.
- Consumers: C2, C3, C4, C5.
- Fixtures: none has sub-layers (0 of 28 boards). Needs nothing: the golden is the member, and the checks' fold-to-forms adapter reproduces today's shapes.

## D2. Locked thickness `(thickness <mm> locked)`

- Today: DC's regex misses it (`null`, or the next sub-layer's value). Bundle: the written thickness.
- Consumer: C2. Fixtures: none (W0 scratch `edge-6l` only). Needs nothing.

## D3. `(thickness 0)`

- Today: DC `0.0`, RS `null`, 3D `0.0`. Bundle: absent (zero is KiCad's "unspecified").
- Consumer: C2. Fixtures: none. Needs nothing.

## D4. Stackup without `(dielectric_constraints …)`

- Today: DC `null`. Bundle: `false`, as KiCad reads it.
- Consumer: C2. Fixtures: none (every committed stackup writes the token). Needs nothing.

## D5. Release Studio's kicad_monkey fallback

- Today: `source: "kicad_monkey.fallback"` when kicad_monkey rejects the board. Bundle: always the typed source.
- Consumer: C3. Fixtures: none (kicad_monkey parses every committed board; `rs` is `equal` on all 28). Needs nothing.

## D6. Empty strings and tokens outside the enums

- Today: copied verbatim. Bundle: absent, with the stage-parse warning `stackup-unknown-token` for a token (decisions.md, Stackup 2).
- Consumers: C2, C3, C5 (theoretical). Fixtures: none (no `stackup-unknown-token` warning on any board). Needs nothing.

## D7. Values with more than 6 decimals in mm

- Today: the parsed double. Bundle: rounded to whole nm.
- Consumer: none in practice. Fixtures: none. Needs nothing.

## Notes for the runner

- **Source upgrade.** `rs-cynthion` (KiCad 7) and `rs-synthetic`, `rs-usb-pd` (KiCad 9) are upgraded to KiCad 10.0.6's format before capture. The goldens therefore differ from the W0 prototype's outputs on the committed bytes only in `boardLayers`: KiCad 10 renumbers the layer ordinals (`B.Cu` 31 → 2, `In1.Cu` 1 → 4, …) and writes the full default layer table on `rs-synthetic` (5 → 8 rows). Everything else is identical; usb-pd, oracle, mini_obc/F0 and mezz_base/F0 are identical throughout.
- **Stale stackup** (decisions.md, Stackup 3): no committed board's stackup copper differs from its layer table (no `stackup-copper-mismatch` warning).
- **No board** (`dv-legacy_in_bom`, `dv-rule_area`, `dv-sch_only`, `sb-mini_payload-F0`): the golden is the empty form `{present: false, boardThicknessNm: 1600000, layers: [], copperLayers: [], maskColors: {}, viaSpans: [], boardLayers: []}`. The contract does not state this form (reported as a gap); it is what the producer rules give for an absent board file. No consumer check runs (today's RS and 3D need a board; DC returns its own `{present: false, layers: [], settings: {}}`, which is not the adapter's `present: false` form, whose `settings` has two `null`s).
- **`dv-malformed`**: not captured. Its root schematic does not parse, so stage parse fails and no projection is written.
