# Provenance of the imported kicad_monkey Rust (WP-F0)

- **Status:** signed off by the maintainer on 2026-10-16: option (a) on every decision of §3, and `git-filter-repo` 2.47.0 installed for F1.
- **Source:** `krishna-swaroop/kicad_monkey` at `b6316117` (upstream `wavenumber-eng/kicad_monkey` `bc6796c1` plus 30 commits). Licence: MIT, "Copyright (c) 2026 Wavenumber LLC" (`LICENSE`). Its workspace declares `license = "MIT"`, `authors = ["Wavenumber LLC"]`.
- **Destination:** `native/`, through `git filter-repo --paths-from-file docs/architecture/native-import-paths.txt` and then `git subtree add --prefix=native` (ADR §4.3).
- **Parent:** ADR §4.2 (licence gates), §9.4 (F0).

## 1. What is imported

The allow-list, [`native-import-paths.txt`](native-import-paths.txt), keeps 1,005 of the 1,518 files at `b6316117`, about 125 MB. Only allow-listed paths survive, in every commit of the imported history, so anything left out never enters Prism's history.

**WP-R2 removal (recorded, not rewritten).** The imported `packages/kicad_cruncher/` package left the workspace in WP-R2 (ADR §9.7 R2) after its artwork, vendor and CLI work was harvested into `src/rs/prism-artwork` and `src/rs/prism-vendors`. The tables below record the import as it was. One board from its corpus — `yoshi_mainboard`'s `11-10080__yoshi-mainboard__A.kicad_pcb` — moved to `tests/parity/fixtures/yoshi_mainboard/` because the SVG test reads it; the rest left with the package.

| Kept | Why |
|---|---|
| `src/rs/` (7 crates), `packages/kicad_cruncher/src/rs/` (the cruncher CLI) | the Rust workspace (ADR §4.2: nothing trimmed) |
| `Cargo.*`, `rust-toolchain.toml`, `clippy.toml`, `rust-hygiene*`, `.cargo/` | how it builds, lints and pins its toolchain |
| `src/tsp/`, `src/ts/`, `contracts/`, `package*.json`, `tspconfig.yaml`, `tsconfig.contracts.json`, and the cruncher's `src/tsp`, `src/ts` and `tspconfig.yaml` | the contract pipeline (TypeSpec, then JSON Schema, then Rust codegen and the TypeScript bindings) |
| `scripts/`, `tools/`, the cruncher's `scripts/` and `runtimes/` | contract, test-vector and release scripts; the pinned Geometer runtime manifest (ADR §10.6) |
| `assets/` | the CC0 Newstroke stroke fonts the crates embed |
| `tests/parity/`, `tests/cases/project_bus_alias_hierarchy/`, `tests/L1_parsing/cases/worksheets/`, `packages/kicad_cruncher/tests/corpus/` | the test data the Rust tests read (`include_bytes!`, `include_str!` and `CARGO_MANIFEST_DIR` paths); nothing else under `tests/` is read by Rust |
| `docs/`, the cruncher's `docs/`, `README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `.gitattributes`, `.gitignore` | design records of the imported code |
| `.github/workflows/` | the fork's CI, for WP-F3 to port; inert under `native/` |

Left out, and so absent from all imported history:
- the Python provider: `src/py/`, `pyproject.toml`, `uv.lock`, `hatch_build.py`, `__init__.py`, `pyrightconfig.json`, `packaging/`, the cruncher's `src/py/` and `pyproject.toml`;
- the Python test suites (`tests/L0`–`L99`, `tests/svg`, `tests/performance`, `tests/*.py`, `tests/rack.*`), including the KiCad library symbol fixtures (`tests/L1_parsing/cases/symbols`, KiCad's CC-BY-SA libraries) and schematic fixtures, which no Rust test reads;
- `tests/corpus/`: the external corpus (266 MB on `artifacts.wavenumber.net`). Its history holds only a 134-byte LFS pointer to `kicad.zip`. WP-F3 replaces it with Prism's parity corpus;
- `AGENTS.md` files, which describe the Python layout and would fail `check_agent_docs.py`;
- `.env.example`.

**GPL content.** The fork's history holds no GPL file. Its KiCad QA netlist fixtures (GPL-2.0-or-later, inherited from KiCad) live only inside the external corpus archive; the repository has only the script that mirrors them (`scripts/sync_upstream_qa_netlist_fixtures.py`, MIT) and a Python test that reads them, which is left out. The full history (338 commits, 1,688 distinct paths) has no other KiCad-QA or third-party netlist file.

## 2. Third-party material in the kept paths

| Material | Where | Licence | Treatment |
|---|---|---|---|
| FreeType fake-bold/fake-italic arithmetic | `src/rs/kicad-monkey-core/src/fake_style.rs` | FreeType License (FTL) or GPL-2.0, at the user's choice (FreeType 2.13.3) | **Decision 1.** The module is a line-level port of `FT_Outline_EmboldenXY`, `FT_Vector_Transform`, `FT_Vector_NormLen` and `FT_Outline_Get_Orientation`. Under the FTL it may be kept in Prism (Apache-2.0) with FreeType's credit in the documentation, given in the root `NOTICE`. The FTL's unaltered text (FreeType 2.13.3's `docs/FTL.TXT`) is `native/licenses/FTL.TXT`, as the FTL requires for source redistribution, and the release packages ship it. |
| Newstroke stroke fonts | `assets/fonts/` | CC0-1.0 (`kicad-stroke-font-package.json`: "Generated from the non-CJK CC0 Newstroke range vendored from the KiCad 10.0 branch") | kept, with the notice |
| KiCad drawing-sheet templates (`pagelayout_default`, `pagelayout_logo`, `A4_ISO5457-1999_ISO7200-2004_EN`, `gost_landscape`) | `tests/L1_parsing/cases/worksheets/input/` | KiCad's template library, CC-BY-SA 4.0 with KiCad's design exception | **Decision 2.** Test data only, unmodified; `worksheet.rs` asserts all five sheets. Kept with attribution in `NOTICE`. They do not affect the licence of Prism's code. |
| Wavenumber's drawing sheets (`Wavenumber.kicad_wks`, `wavenumber-sch.kicad_wks`) | worksheets and the cruncher corpus | MIT (the repository's licence) | kept |
| The cruncher corpus: `4-ch-backplane`, `charge_indicator`, `cutout_test`, `hlr_test`, `speedy_processing_module`, `taillight`, `yoshi_mainboard` | `packages/kicad_cruncher/tests/corpus/kicad/projects/` | published by Wavenumber in its MIT repository as "redistributable KiCad fixtures" (`packages/kicad_cruncher/tests/corpus/README.md`). `4-ch-backplane`'s metadata says `"source_kind": "sanitized_internal_project"`; title blocks are stripped; `taillight` (11-10045) and `yoshi_mainboard` (11-10080) carry Wavenumber's part numbers, and `yoshi_mainboard` uses `wavenumber-sch.kicad_wks` | **Decision 3.** Treated as Wavenumber's own designs under the repository's MIT licence. These seven are the only projects ever committed there. |
| Font fixtures (`outline-*-fixture.*`, `shaping-variable-fixture.ttf`, about 1 KB each) | `tests/parity/fonts/` | MIT: synthetic, named "KiCad Monkey … Fixture", built with fontTools by the fork's own `scripts/generate_font_*_vectors.py` | kept |
| `tests/cases/project_bus_alias_hierarchy` | tests | MIT: `"origin": "generated_synthetic_project"` (`case_metadata.json`) | kept |
| PCB Autodoc | `packages/kicad_cruncher/src/rs/kicad-cruncher-cli/src/pcb_svg/designator_layout.rs` ("ported from PCB Autodoc") | the README describes it as following Autodoc's algorithm (`packages/kicad_cruncher/README.md:231`); it is a re-implementation of the method, not copied source | kept; Prism does not use the `--assembly` path at first |
| Behaviour that mirrors KiCad (markup grammar, `KiROUND`, plotter rules) | core | interoperability re-implementations, not copied KiCad source; no module states it copies KiCad code | kept |
| Rust dependencies (crates.io) | `Cargo.lock` | each crate's own licence | WP-L adds a `cargo deny` licence check (follow-up below) |

## 3. Decisions for sign-off

1. **`fake_style.rs`.** (a) Keep it under the FreeType License, with FreeType's credit in `NOTICE` (recommended). (b) Replace it with an original implementation before F1, which breaks "verbatim first". (c) Drop fake bold/italic.
2. **KiCad's drawing-sheet templates in test data.** (a) Import them unmodified with attribution (recommended). (b) Leave them out of the history and change `worksheet.rs` after the import. That breaks "`cargo test --workspace` passes as imported".
3. **The cruncher corpus** is covered by Wavenumber's MIT release (recommended). The alternative is to leave it out and have the cruncher's corpus tests fail as imported.
4. **F1's tooling.** F1 needs `git-filter-repo`, which is not installed here: `brew install git-filter-repo`, a download.

## 4. After F1

- `native/LICENSES.md` (F0's second deliverable) lands right after the import commit, because `git subtree add` refuses an existing `native/`. It repeats §2 per directory.
- WP-L adds `cargo deny check licenses` for the workspace, allowing MIT, Apache-2.0, BSD, ISC, Zlib, Unicode-3.0, CC0-1.0, FTL and MPL-2.0.

## 5. How this was checked

- **Rust's reads.** Every path the Rust code reads was found by searching `include_bytes!`, `include_str!` and `CARGO_MANIFEST_DIR` joins across `src/rs` and the cruncher. All of them are under the kept paths.
- **History.** `git log --all --name-only` over the fork's history gave every path ever committed, which the GPL and third-party search covered.
- **Completeness.** A dry run exported exactly the allow-listed paths at `b6316117` and ran `cargo test --workspace --offline --no-fail-fast` on Rust 1.98.0: 103 test binaries, 883 tests passed, 0 failed, 0 ignored. The allow-list is complete for the workspace's own tests, with no network.

## 6. SolidCraft (removed)

`native/src/rs/prism-step/` adapted SolidCraft's ISO 10303-21 parser and AP242
assembly writer (MIT OR Apache-2.0) for System Builder's STEP assembly. The
crate went with System Builder on 2026-10-23; the archive tag
`archive/system-builder-v2` keeps it.

## 7. Geometer client (vendored)

`native/third_party/geometer-client/` is `src/rust/geometer-client` of
https://github.com/wavenumber-eng/geometer at release **2026.9.19** (tag
`v2026-09-19`, commit `6d659f18`), with the repository's MIT `LICENSE` beside
it (ADR amendment C3 §2 item 4). First vendored at 2026.9.13 (`703e6002`, the
revision `native/Cargo.toml` had pinned as a git dependency), upgraded on
2026-10-21. Changes from upstream: no standalone `Cargo.lock`, and the
optional `geometer-sys` dependency (the static C SDK, not vendored) is removed
with the `direct_static_illustration` example, leaving the `direct-static`
feature empty; it must stay off. Vendoring removes cargo's clone of the 1 GB
Geometer repository; the crate is a path dependency excluded from the
workspace's lints and tests. The image's Geometer runtime is the same release
(`backend/Dockerfile`, sha256 from the release inventory). To update, copy the
same directory at the new release, make the same two changes, and record the
commit here and in `NOTICE`.
