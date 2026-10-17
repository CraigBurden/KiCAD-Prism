# prism-projections — Prism's design-bundle projections (P1–P5, WP-P2)

One module per `projections/*.json` member of the design bundle (ADR §6); each
producer reads the single parsed model and returns its contract from
`prism-kicad-contracts`. The field rules for every member are in
`native/contracts/prism/field-maps/`. The crate's interface (`ProjectionInput`,
`Produced`, `Sources`) is documented in `src/lib.rs`.

- `src/semantic_index/` (projections/semantic-index.json, P1),
  `src/board_objects/` (projections/board-objects.json, P2),
  `src/occurrences/` (projections/occurrences.json, P2),
  `src/route_metrics/` (projections/route-metrics.json, P2),
  `src/stackup/` (projections/stackup.json, P3),
  `src/placements/` (projections/placements.json, P3),
  `src/project/` (projections/project.json, P4),
  `src/system_interface/` (projections/system-interface.json, P5).
- `src/compare.rs`, `src/compare/` — Design Comparison's object diff, the Rust
  port of `backend/design-compare-parser/ecad-diff.mjs` (ADR amendment C2).
  `compare::diff` is a pure function of two `board-objects` documents and each
  side's project directory; it returns `CompareObjectDeltaA0`
  (`prism.compare.object_delta.a0`). The command is
  `native/src/rs/prism-kicad-cli/src/cmd_compare.rs`; a parity difference is
  recorded in `native/parity/divergences/compare.md`. The engine reads no
  bundle, no KiCad file and no repository.
