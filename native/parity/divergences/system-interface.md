# Divergences: system-interface

- Member: `projections/system-interface.json`, schema `prism.system_interface.v1` (root `SystemInterfaceV1`)
- Producer: P5
- Field map: [`native/contracts/prism/field-maps/system-interface.md`](../../contracts/prism/field-maps/system-interface.md)
- Golden: `capture/system_interface.py`, today's `extract_interface` (`EXTRACTOR_VERSION` 8) on the prepared, KiCad-upgraded sources, without `projectId`, `commit` and `extractor`.

No divergence makes a correct P5 output differ from the golden on a committed fixture, so `system-interface.json` accepts nothing. P5's acceptance is the byte-exact `digest`. The runner checks that the member's `digest` matches its own body (`digest-self`), and value equality covers equality with the golden's digest.

## Envelope

- `projectId`, `commit` and `extractor` are absent on both sides (decisions.md, System interface 1).
- Runner: nothing to do.

## KiCad 7 boards

The source upgrade resolves this case (decisions.md, System interface 6). On `rs-cynthion` and `rs-synthetic`, references come from the upgraded `Reference` properties, so geometry and `pcbNets` are present. The digests therefore differ from the W0 table, which was captured on the un-upgraded sources:

- `rs-cynthion`: `160905ab…`, against `eec5e25b…`;
- `rs-synthetic`: `bd997ed2…`, against `fd672984…`;
- `rs-usb-pd` (KiCad 9 → 10): `b9622a24…`, which is the user's KiCad 10 board's digest.

Every other fixture's digest equals the W0 table.

- Runner: nothing to do.

## Project without a schematic

The bundle writes the empty interface. No committed fixture has a project file without a schematic.

## Platform

The golden's floats come from macOS arm64 `libm`. If P5's member on Linux differs only by a 1e-4 rounding flip, recapture in the worker image (`native/parity/README.md`). Do not add a patch for it.
