# prism-projections — Prism's design-bundle projections (P1–P5, WP-P2)

One module per `projections/*.json` member of the design bundle (ADR §6); each
producer reads the single parsed model and returns its contract from
`prism-kicad-contracts`. The field rules for every member are in
`native/contracts/prism/field-maps/`. The crate's interface (`ProjectionInput`,
`Produced`, `Sources`) is documented in `src/lib.rs`.

- `src/assembly_hlr.rs` (bundle member models/assembly-hlr.json, stage
  `models`, amendment C3 §3.1): the Geometer HLR projection of every
  footprint's first STEP model, with its `--hlr-cache`. Its submodules are the
  pose, the geometry (dedupe and back-side mirror), the model resolver and the
  cache.
- `src/semantic_index/` (projections/semantic-index.json, P1),
  `src/board_objects/` (projections/board-objects.json, P2),
  `src/occurrences/` (projections/occurrences.json, P2),
  `src/route_metrics/` (projections/route-metrics.json, P2),
  `src/stackup/` (projections/stackup.json, P3),
  `src/placements/` (projections/placements.json, P3),
  `src/project/` (projections/project.json, P4),
  `src/system_interface/` (projections/system-interface.json, P5).
- `src/compare.rs`, `src/compare/` — Design Comparison in Rust (ADR
  amendments C2 and C2r). The object diff (`diff.rs`, `entry.rs`,
  `classify.rs`, `output.rs`) is the port of the retired Node object diff
  (`ecad-diff`, removed in WP-R2); `compare::result::build`
  turns two revisions' typed members into `DesignCompareResultA1`
  (`prism.design_compare.result.a1`), one module per tab under
  `src/compare/result/` (`files`, `objects`, `connectivity`, `bom`,
  `stackup`, `route_metrics`, `project_diff`; `review` holds the visual
  targets). The spec of each field is
  `native/contracts/prism/field-maps/design-compare.md`. The command is
  `native/src/rs/prism-kicad-cli/src/cmd_compare.rs`; a divergence from
  today's output is recorded in `native/parity/divergences/compare.md`. The
  engine reads no bundle, no KiCad file and no repository.
