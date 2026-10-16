# native/ — Prism's KiCad parser and design bundle (Rust)

Imported with its history from `krishna-swaroop/kicad_monkey` at `b6316117` (WP-F1). The design is `docs/architecture/adr-native-design-bundle.md`; the frozen contracts are TypeSpec in `src/tsp/prism/`, JSON Schema in `contracts/generated/schema/` and their examples, field maps and specs in `contracts/prism/` (start with `contracts/prism/README.md`).

- **Build and test** from this directory: `cargo test --workspace` (Rust 1.98.0, pinned by `rust-toolchain.toml`), `cargo clippy --workspace -- -D warnings`, `cargo fmt --check`.
- **Crates:** `src/rs/kicad-monkey-*` (core, contracts, materialization-pack, svg, wasm, native, codegen) and `packages/kicad_cruncher/src/rs/kicad-cruncher-cli`. WP-F2 renames them to `prism-kicad-*` and adds `prism-projections`, `prism-bundle` and `prism-kicad-cli`.
- **Prism contracts:** check and build them with `node scripts/contracts/check-contract.mjs` and `node scripts/contracts/build.mjs` (Node 24.22.0; `contracts/prism/README.md`).
- **Fork contracts:** TypeSpec in `src/tsp/kicad_monkey/`, JSON Schema in `contracts/generated/schema/` (committed), Rust in `src/rs/prism-kicad-contracts/src/generated/` via `prism-kicad-codegen`. Never edit generated files by hand.
- **Licences:** MIT (`LICENSE`, Wavenumber LLC). `LICENSES.md` lists the third-party material per directory; `docs/architecture/native-provenance.md` records the sign-off.
- The imported `README.md`, `ARCHITECTURE.md` and `docs/` describe the fork, including its Python provider, which was not imported.
