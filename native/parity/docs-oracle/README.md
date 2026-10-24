# Documentation oracle

A board KiCad itself finishes, so Prism's document generators are checked
against KiCad and not against our own earlier output.

- `make_board.py` writes `board/oracle.kicad_pcb` as KiCad 10 s-expression text
  (no `pcbnew`): stock footprints copied from KiCad's library (0603, SOIC-8,
  1×4 header, SOT-23) and `OffsetDrills` (a drill offset, oval slots, pads
  turned inside it), each at 0°, 90°, 180°, 270°, −45°, 30° and 137.5° on the
  front and on the back; a solder jumper `JP1`; `UnusualPads` at 0°, 37°, 90°
  and 180° on both sides (custom pads with polygon, circle and arc primitives,
  chamfered pads on all corners, two adjacent corners, and with a round-rect
  radius, round-rect ratios 0.1 and 0.5, a trapezoid, an odd-angle oval, a
  press-fit pad, counterbored and countersunk holes); a castellated pad on the
  board edge (`J90`); a four-layer stackup; an Edge.Cuts outline with
  mixed-radius arc corners, a notch and two cutouts (a circle and an arc-edged
  polygon); every via span (through, blind, buried, micro, backdrilled); arc
  tracks (`J91`); an arc-edged copper zone and a keep-out. A back-side
  footprint is written the way KiCad writes a flipped one.
- `ipc_finish.py` (KiCad's IPC API, `kicad-python`) has KiCad open the board,
  fill its zones and save it in its own form, then writes every pad's outline
  on every copper layer, as KiCad shapes it, to `kicad/pad-outlines.json`
  (bounding box and area per pad and layer).
- `export.sh` writes KiCad's reference outputs into `kicad/`: one drill file
  per span (plus the backdrill files), the position file, IPC-D-356, and
  Gerbers for F.Cu, In1.Cu, In2.Cu, B.Cu and Edge.Cuts.

Everything in `board/` and `kicad/` is committed, so the tests need no KiCad.

| Check | KiCad's answer | Where |
|---|---|---|
| Drill centres, every span (`PcbHole::board_center`) | `kicad/oracle-{PTH,NPTH,front-in1,in1-in2}.drl` | `prism-kicad-core/tests/docs_oracle.rs` |
| Backdrilled vias | `kicad/oracle_Backdrills_Drill_1_2.drl` | same |
| Pad copper centres (`PcbPad::copper_center`) | Gerber flashes on all four copper layers | same |
| Pad outlines (`PcbPad::copper_outline`) | `kicad/pad-outlines.json` | same |
| Assembly artwork drill and slot marks, top and mirrored bottom | `kicad/oracle-*PTH.drl` | `check_artwork.py` (local: needs a full bundle) |
| Placements: position, rotation, side; vendor CPL | `kicad/pos.csv` | committed, not in the suite |
| Pad positions | `kicad/oracle.d356` | committed, not in the suite |

What the board showed (2026-10-22, KiCad 10.0.6):
- A pad's `(offset …)` moves its copper, not its hole; the drill stays at the
  pad position.
- A pad's angle in a `.kicad_pcb` already includes the footprint's rotation.
- A chamfered pad is written as `roundrect` with `chamfer_ratio` and `chamfer`
  corners. Chamfered corners stay sharp; the other corners keep the rounding.
- A trapezoid's `rect_delta` x makes the left side taller and the right side
  shorter; its y makes the bottom wider and the top narrower.
- KiCad's pad outlines approximate arcs with chords up to about 5 µm inside the
  curve, so outline checks allow 6 µm (and that much per mm of perimeter for
  areas).
- KiCad 10.0.6's IPC API cannot create footprints or pads, nor set the
  stackup; it can fill zones, save, and give pad outlines. The SWIG `pcbnew`
  binding is not used: its custom-pad primitives are freed twice unless
  ownership is handed over, which crashed KiCad's Python.

Regenerate (only when KiCad's version changes or the board grows):

```sh
python3 native/parity/docs-oracle/make_board.py native/parity/docs-oracle/board
# KiCad's PCB editor open on board/oracle.kicad_pcb, Preferences > Plugins >
# "Enable IPC API server" on, and kicad-python installed:
python native/parity/docs-oracle/ipc_finish.py native/parity/docs-oracle/kicad/pad-outlines.json
# quit KiCad, delete board/oracle.kicad_prl and board/.history, then:
PATH=/Applications/KiCad/KiCad.app/Contents/MacOS:$PATH \
    native/parity/docs-oracle/export.sh native/parity/docs-oracle/board native/parity/docs-oracle/kicad
```
