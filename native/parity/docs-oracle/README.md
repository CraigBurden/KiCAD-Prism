# Documentation oracle

A board built by KiCad's own `pcbnew` to check Prism's document generators
against KiCad, not against our own earlier output.

- `make_board.py` builds `board/oracle.kicad_pcb`: stock footprints (0603,
  SOIC-8, 1×4 header, SOT-23) and a custom one with a drill offset, oval slots
  and pads turned inside it, each at 0°, 90°, 180°, 270°, −45°, 30° and 137.5°,
  on the front and on the back, plus a solder jumper `JP1`.
- `export.sh` writes KiCad 10.0.6's reference outputs into `kicad/`: the drill
  files, the position file, IPC-D-356 and the copper Gerbers. These are
  committed, so the tests need no KiCad.

| Check | KiCad's answer | Test |
|---|---|---|
| Drill centres (`PcbHole::board_center`) | `kicad/oracle-*PTH.drl` | `prism-kicad-core/tests/docs_oracle_holes.rs` |
| Pad copper centres (`PcbPad::copper_center`) | Gerber flashes in `kicad/oracle-*_Cu.gbr` | same |
| Assembly artwork drill and slot marks, top and mirrored bottom | `kicad/oracle-*PTH.drl` | `check_artwork.py` (local: needs a full bundle) |
| Placements position, rotation, side; vendor CPL | `kicad/pos.csv` | checked by hand on 2026-10-22: all 71 placements and the JLCPCB CPL match |
| Pad positions | `kicad/oracle.d356` | checked by hand on 2026-10-22: all 310 pads match `placements.json` |

What the board showed (2026-10-22):
- A pad's `(offset …)` moves its copper, not its hole. The drill stays at the pad position.
- A pad's angle in a `.kicad_pcb` already includes the footprint's rotation.

Regenerate (only when KiCad's version changes):

```sh
KP=/Applications/KiCad/KiCad.app/Contents/Frameworks/Python.framework/Versions/Current/bin/python3
$KP native/parity/docs-oracle/make_board.py native/parity/docs-oracle/board
PATH=/Applications/KiCad/KiCad.app/Contents/MacOS:$PATH \
    native/parity/docs-oracle/export.sh native/parity/docs-oracle/board native/parity/docs-oracle/kicad
```
