# Artwork configs

`assembly.json` and `testpoints.json` started as Release Studio's
`backend/app/release_studio/documents/pcb-svg.config.json` and
`pcb-svg.testpoints.config.json` with one change: `schema` is
`prism.artwork.config.a0` and the `_prism` author comment is dropped, because
the contract has no field for it (`native/src/tsp/prism/artwork-a0.tsp`).

They now also use three of the contract's improvements (C3 chunk G1), so a
field-by-field diff against the Cruncher files shows them:

- `global.canvas.bounds` is `board_and_bodies`, so a connector that hangs over
  the board edge (usb-pd `J1` and `J2`) stays inside the canvas with its
  designator;
- the testpoint views set `styles.assembly_designators.callout: true`, so their
  designators are placed outside the 1 mm pad at `min_font_size_mm` (1 mm) with
  a leader line instead of being squeezed into the pad;
- `callout` is absent (false) in the assembly views, which keep the Autodoc fit
  inside the body.

Views, layer tokens, styles, `selector_overrides` and the `dnp` block are
otherwise unchanged, so a tuned drawing still tunes the same way.

They are checked against the generated `ArtworkConfigA0` schema by
`tests/contract.rs`. `prism-kicad artwork --config` reads either one; the
testpoint config's `selector_overrides` (`*` off, `TP*` on) now selects the
footprints the view draws, replacing Release Studio's filtered staging board
(ADR amendment C3 §2 item 6).
