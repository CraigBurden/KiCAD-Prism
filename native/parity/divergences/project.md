# Divergences: project

- Member: `projections/project.json`, schema `prism.project.a0` (root `ProjectA0`)
- Producer: P4 (`native/src/rs/prism-projections/src/project.rs`)
- Field map: [`native/contracts/prism/field-maps/project.md`](../../contracts/prism/field-maps/project.md). Its "Expected divergences" (D1–D12) holds the full text. Maintainer decisions are in [`decisions.md`](../../contracts/prism/decisions.md), "Project".
- Golden: `capture/project.py`, the W0 prototype ported with repository-relative paths, on the prepared, KiCad-upgraded sources.
- Checks: `capture/project_checks.py`, the Card, 3D and Closure adapters.
  - The closure runs on a scratch git repository of a copy of the prepared sources.
  - Two model environments are used: `{}`, and `KICAD10_3DMODEL_DIR` = KiCad 10.0.6 stock models.

No divergence makes a correct P4 output differ from the golden on a committed fixture, so `project.json` accepts nothing. On all 32 captured fixtures every check is `equal`: card, 3d.netClasses, closure.emptyEnv, closure.kicad10Env.

## D1. Bare `(generator eeschema)`

- Superseded by the source upgrade. KiCad 10 writes the generator quoted. `rs-cynthion`'s card is now `equal` (W0: D1).
- Runner: nothing to do. The card check still applies D1 if a bare token appears.

## D2. Library tables outside the project directory

- Fixtures: none. The sb-p2 fixtures' source root is now the project's own `…/F0` directory, so there are no foreign tables (W0 had 10 with `p2/sources` as the root).
- Runner: nothing to do. The closure check removes foreign tables, under D2, if any occur.

## D3. References today's closure does not record

- Today's closure does not record:
  - sheet files;
  - drawing sheets without `${…}`;
  - `kicad-embed://` models.
- Fixtures with such references:
  - `rs-cynthion`: 19 sheet files;
  - `rs-usb-pd`: 1 sheet file, 1 drawing sheet, 2 embedded models;
  - `dv-oracle` and `dv-oracle_rev2`: 4 sheet files each;
  - `sb-mini_obc-*`: 1 each;
  - `sb-mini_payload-F0`: 2.
- Runner: nothing to do. The Closure adapter filters them, so they are in the golden and not compared against today.

## D4. Legacy versioned library variables

- Fixtures: `rs-cynthion` has 28 `KICAD6_3DMODEL_DIR` models; `rs-usb-pd` has 7 `KICAD9_3DMODEL_DIR` models.
- The golden records `kicad-library` with the variable as written. The adapter looks the variable up literally, as today does, so both environments are `equal` (`unreadable` today).
- Runner: nothing to do.

## D5–D11

- D5 detached schematics; D6 text variables in library URIs; D8 non-string text variables; D9 `.prism` yaml; D11 `..` through a missing directory.
  - None occurs in a committed fixture.
- D7 (extra title-block fields) and D10 (empty title-block field) are new data that the card adapter maps back exactly.
- Runner: nothing to do.

## D12. Repository-relative paths

- Every committed fixture has `project_dir == ""`.
- The golden writes `RepoPath`s throughout, and the card adapter strips the project directory.
- Runner: nothing to do.
