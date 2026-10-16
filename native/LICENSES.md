# Licences in native/ (WP-F0)

Everything imported here is MIT (`LICENSE`, Copyright (c) 2026 Wavenumber LLC) except the material below. The crates Prism adds (`src/rs/prism-projections`, `src/rs/prism-bundle`, `src/rs/prism-kicad-cli`) are Apache-2.0, like the rest of Prism (the repository's `LICENSE`). The sign-off and how each item was checked are in `docs/architecture/native-provenance.md`. The repository's root `NOTICE` carries the required credits.

| Path | Material | Licence |
|---|---|---|
| `src/rs/prism-kicad-core/src/fake_style.rs` | port of FreeType 2.13.3's `FT_Outline_EmboldenXY`, `FT_Vector_Transform`, `FT_Vector_NormLen` and `FT_Outline_Get_Orientation` | FreeType License (FTL), with FreeType's credit in `NOTICE` |
| `assets/fonts/` | Newstroke stroke fonts, generated from KiCad 10.0's Newstroke tables | CC0-1.0 |
| `tests/L1_parsing/cases/worksheets/input/pagelayout_default.kicad_wks`, `pagelayout_logo.kicad_wks`, `A4_ISO5457-1999_ISO7200-2004_EN.kicad_wks`, `gost_landscape.kicad_wks` | KiCad drawing-sheet templates, test data only, unmodified | CC BY-SA 4.0, with the KiCad libraries' design exception |
| `packages/kicad_cruncher/tests/corpus/kicad/projects/` | seven Wavenumber-sanitized KiCad projects | MIT (published by Wavenumber as redistributable fixtures) |
| `tests/parity/fonts/` | synthetic font fixtures built with fontTools | MIT |
| Rust dependencies (`Cargo.lock`) | crates.io packages | each crate's own; WP-L adds a `cargo deny` licence check |
