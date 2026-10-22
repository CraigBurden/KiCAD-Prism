# Licences in native/ (WP-F0)

Everything imported here is MIT (`LICENSE`, Copyright (c) 2026 Wavenumber LLC) except the material below. The crates Prism adds (`src/rs/prism-projections`, `src/rs/prism-bundle`, `src/rs/prism-kicad-cli`) are Apache-2.0, like the rest of Prism (the repository's `LICENSE`). The sign-off and how each item was checked are in `docs/architecture/native-provenance.md`. The repository's root `NOTICE` carries the required credits.

| Path | Material | Licence |
|---|---|---|
| `src/rs/prism-kicad-core/src/fake_style.rs` | port of FreeType 2.13.3's `FT_Outline_EmboldenXY`, `FT_Vector_Transform`, `FT_Vector_NormLen` and `FT_Outline_Get_Orientation` | FreeType License (FTL): its unaltered text, FreeType 2.13.3's `docs/FTL.TXT`, is `licenses/FTL.TXT` and ships in every release package; FreeType's credit is in `NOTICE` |
| `assets/fonts/` | Newstroke stroke fonts, generated from KiCad 10.0's Newstroke tables | CC0-1.0 |
| `tests/L1_parsing/cases/worksheets/input/pagelayout_default.kicad_wks`, `pagelayout_logo.kicad_wks`, `A4_ISO5457-1999_ISO7200-2004_EN.kicad_wks`, `gost_landscape.kicad_wks` | KiCad drawing-sheet templates, test data only, unmodified | CC BY-SA 4.0, with the KiCad libraries' design exception |
| `tests/parity/fixtures/yoshi_mainboard/11-10080__yoshi-mainboard__A.kicad_pcb` | one Wavenumber-sanitized KiCad board, moved here when the imported `kicad-cruncher` package left the workspace (WP-R2) | MIT (published by Wavenumber as a redistributable fixture) |
| `tests/parity/fonts/` | synthetic font fixtures built with fontTools | MIT |
| `third_party/geometer-client/` | Geometer's Rust IPC client at commit `6d659f18` (2026.9.19), vendored without its optional static-SDK dependency (ADR amendment C3 §2 item 4) | MIT, Copyright (c) Wavenumber LLC; text in `third_party/geometer-client/LICENSE`, credit in `NOTICE` |
| Rust dependencies (`Cargo.lock`) | crates.io packages | each crate's own; WP-L adds a `cargo deny` licence check |
