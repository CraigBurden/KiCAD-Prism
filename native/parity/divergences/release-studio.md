# Release Studio: bundle-only divergences (C3 F4c)

Release Studio's consumer-side divergences at the switch to the design bundle
(ADR amendment C3 §4). They are not bundle members, so the parity runner has no
entry for them; each is measured on the three Release Studio fixtures and
recorded here.

## rs-1: the dossier digest changes once

The dossier digest changes exactly once at the switch, because the assembly and
testpoint artwork come from `prism-kicad artwork` instead of `kicad-cruncher
pcb-svg`, and the DNP legend reads the native artwork configuration. It is
expected and recorded, not a regression: two bundle-mode builds of the same
revision still give the same digest (`backend/tests/test_release_studio_replay_build.py`).

Measured with a whole build per fixture (the same catalogue, tools and
configuration in each mode; `executor_image` and the candidate's identity fixed
so only the source switch moves the digest):

> The legacy builds ran without `kicad-cruncher` (it is not installed on the
> machine that measured them), so their assembly and testpoint sheets were
> composed without artwork. The legacy column is therefore Release Studio's
> legacy path minus Cruncher's artwork, not a production legacy dossier; the
> change it shows on the artwork sheets is the expected one, and every other
> member's comparison is unaffected.

| Fixture | Legacy dossier digest | Bundle dossier digest |
|---|---|---|
| `rs-synthetic` | `a680c6f44c456179a8db23b8f074af6e5236ebc6a3c9520674ceb694ab997532` | `8ce859ecfbad2f2d7dc7de45cbe77ff9e031d123306f52f25472469a7162c0fd` |
| `rs-usb-pd` | `1babd093cd723452a6afa840416ed9c1945659b1c3dca51e1ee0262b19b5ab0f` | `53f82d59b38c400e8ac86716589c1dc34493ae42e8e54ffa566fe311f3e670f7` |
| `rs-cynthion` | `c2ddf6a295c76e55bbcacaa585358d80b9c3380a10090f6cda24d0279db74ea9` | `828c0779d624428c17dffd4738a04f23dac81e02c1e81c4ebe05b0b92db103c6` |

Which members changed:

- **`rs-synthetic`:** `documentation/assembly.pdf`,
  `documentation/cover.pdf`, `documentation/testpoint.pdf`,
  `evidence/drc.json`.
- **`rs-usb-pd`:** the same three documents plus
  `documentation/fabrication.pdf`, `evidence/drc.json`,
  `fabrication/board-stats.json`, and the `F_Cu`/`B_Cu`/`.gbrjob` Gerbers.
- **`rs-cynthion`:** the same set as `rs-usb-pd` plus
  `evidence/erc.json` and every other Gerber layer.

The artwork and the sheets that embed it move as the amendment expects. The
Gerber, board-statistics and DRC/ERC changes on `rs-usb-pd` and `rs-cynthion`
are rs-2 (below), not the artwork switch. The vendor CSVs
(`manufacturing/vendors/jlcpcb/{bom,cpl}.csv`), positions, drill, BOM PDF,
schematic PDF and every unchanged Gerber are **byte-identical** across the
switch.

## rs-2: fills come from `refilled/`

The board steps read `refilled/<stem>.kicad_pcb`; a project whose saved fills
are stale therefore releases different copper than the legacy path, which read
the saved board. The bundle's own `fill_check` records the difference:

| Fixture | `fill_check` | Verdict |
|---|---|---|
| `rs-synthetic` | `differing_operations: 0`, `stale: false` | saved fills equal the refilled board; no divergence |
| `rs-usb-pd` | `differing_operations: 24`, `stale: true` | **rs-2 applies**: refilled copper differs from the saved board |
| `rs-cynthion` | `differing_operations: 458`, `stale: true` | **rs-2 applies**: refilled copper differs from the saved board |

The refilled board is right: a release is fabricated from the fills the board
actually has, and KiCad refills a board the project's own settings describe.
The released Gerber copper, board statistics and DRC/ERC counts on those two
fixtures therefore differ from the legacy path; the recorded digests in rs-1
carry that difference.

## rs-3: documentation corrections found by the KiCad oracle review (2026-10-22)

Reviewed changes to what the released documents say. In each case the legacy output was wrong, and the new output agrees with KiCad's own files for the same board (`native/parity/docs-oracle/`, JTYU-OBC).

| What | Legacy | Now |
|---|---|---|
| Cover "Front / back" | counted from `positions.csv`, which leaves out footprints marked "exclude from position files"; JTYU-OBC read 982 components over 396 / 503 | KiCad's statistics, the same source as the total (479 / 503); the position file's count is its own row, "In position file" |
| Drill schedule, slots | the slot's length only (`2.2000 mm`), which reads as a round hole | length by width (`2.2000 x 0.9000 mm`) |
| Testpoint schedule Y | KiCad's internal y, pointing down, so it had the opposite sign to the same release's `positions.csv` | the position file's y, pointing up |
| Testpoint at x = 0 or y = 0 | printed as "—", as if unknown | `0.000` |
| Assembly artwork drill marks, offset drills | moved by the pad offset, turned the wrong way and by the footprint angle twice | at the pad position, where KiCad drills (drill files) |
| Assembly artwork and ICD/atlas pad copper, offset pads | centred on the hole | moved by the offset, where KiCad flashes it (copper Gerbers) |
| Assembly artwork testpoint callouts and ICD/atlas pads: chamfered, trapezoid and custom pads | chamfers dropped, trapezoids drawn as rectangles, a custom pad as its anchor (plus its polygon, rect and circle primitives in the ICD/atlas, filled even-odd) | the copper as KiCad shapes it (`PcbPad::copper_outline`, KiCad's own pad outlines over IPC); crate_version 0.9.0 |
| Assembly artwork body of a footprint without a 3D model (its pad extent) | each pad's size rectangle at its position: drill offsets and custom-pad copper ignored | the union of the pads' copper (KiCad's pad outlines) |
