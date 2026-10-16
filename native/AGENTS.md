# native/ — Prism's KiCad parser and design bundle (Rust)

Imported with its history from `krishna-swaroop/kicad_monkey` at `b6316117` (WP-F1). The design is `docs/architecture/adr-native-design-bundle.md`; the frozen contracts are in `docs/architecture/design-bundle-contracts/`, which move into `native/` after F1 (ADR §9).

- **Build and test** from this directory: `cargo test --workspace` (Rust 1.98.0, pinned by `rust-toolchain.toml`), `cargo clippy --workspace -- -D warnings`, `cargo fmt --check`.
- **Crates:** `src/rs/kicad-monkey-*` (core, contracts, materialization-pack, svg, wasm, native, codegen) and `packages/kicad_cruncher/src/rs/kicad-cruncher-cli`. WP-F2 renames them to `prism-kicad-*` and adds `prism-projections`, `prism-bundle` and `prism-kicad-cli`.
- **Contracts:** TypeSpec in `src/tsp/`, JSON Schema in `contracts/generated/schema/` (committed), Rust in `src/rs/kicad-monkey-contracts/src/generated/` via `kicad-monkey-codegen`. Never edit generated files by hand.
- **Licences:** MIT (`LICENSE`, Wavenumber LLC). `LICENSES.md` lists the third-party material per directory; `docs/architecture/native-provenance.md` records the sign-off.
- The imported `README.md`, `ARCHITECTURE.md` and `docs/` describe the fork, including its Python provider, which was not imported.
