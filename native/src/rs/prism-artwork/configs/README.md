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
  designators are placed outside the 1 mm pad at `min_font_size_mm` (1.8 mm)
  with a leader line instead of being squeezed into the pad;
- `callout` is absent (false) in the assembly views, which keep the Autodoc fit
  inside the body.

Views, layer tokens, styles, `selector_overrides` and the `dnp` block are
otherwise unchanged, so a tuned drawing still tunes the same way.

Every length here is a **paper millimetre**, the size the line or type prints at.
The defaults follow ISO 128-20 line widths (0.35 mm for the board outline and
cutouts, 0.25 mm for component bodies, 0.18 mm for fine detail) and the ISO 3098
minimum text height of 1.8 mm. `--paper-scale <ratio>` divides those lengths by
the sheet's ratio before drawing, so a stroke tuned at 0.35 mm prints at 0.35 mm
whatever the drawing scale (cli-spec §5.7); Release Studio passes the ratio of
the sheet it selected.

The configuration can also be read as board millimetres, which is what the
`drawing` value of `artwork_line_weights` does: the lengths are not divided, so
strokes and type grow with the drawing. `paper` is the documented default and
the mode these values were tuned for; `drawing` is kept for compatibility, so a
config shared with an older Release Studio still draws as it used to. Geometry
and `canvas.margin_mm` (a board-space margin) are never divided: they describe
the board, not the ink. `dnp.hatch_spacing_mm` is a paper length like the hatch
stroke, so it divides too and a 1.5 mm hatch prints 1.5 mm apart at any scale.

They are checked against the generated `ArtworkConfigA0` schema by
`tests/contract.rs`. `prism-kicad artwork --config` reads either one; the
testpoint config's `selector_overrides` (`*` off, `TP*` on) now selects the
footprints the view draws, replacing Release Studio's filtered staging board
(ADR amendment C3 §2 item 6).
