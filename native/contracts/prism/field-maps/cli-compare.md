# Field map: stdout of `prism-kicad compare` (`prism.cli.compare_result.a1`)

Root model `CliCompareResultA1` in `tsp/prism/cli-compare-a1.tsp`. Example `examples/CliCompareResultA1.example.json`.
Written by: `prism-kicad compare` (`native/src/rs/prism-kicad-cli/src/cmd_compare.rs`), after `-o` holds the `DesignCompareResultA1` (field map `design-compare.md`). Stage: none.

a1 replaces a0 at the C2r switch (ADR amendment C2r §4): a0's `counts` were the object diff's counts of `prism.compare.object_delta.a0`, which was removed with its field map (`compare.md`). a1's `counts` are the result's own.

## Fields

| Field (JSON pointer) | Type | Unit | Order / nullability | Source | Consumers | Note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.cli.compare_result.a1"` | — | required | `cmd_compare.rs` | `design_compare_bundle_path.py` (`expect`) | envelope |
| `/base`, `/head` | `CliCompareSide` | — | required | `cmd_compare.rs` `emit_result` | none | as a0 |
| `/base/revision_key`, `/head/revision_key` | `Sha256Hex` | — | required | `--<side>-revision-key` (ADR amendment K2 §3.6) | none | as a0 |
| `/base/bundle_key`, `/head/bundle_key` | `Sha256Hex` | — | absent for a source tree | the side's manifest (cli-spec.md §5.1.4) | none | as a0 |
| `/base/objects`, `/head/objects` | `Count` | — | required | the side's `board-objects` object count, review-only objects included | none | as a0 |
| `/counts` | `DesignCompareCounts` | — | required | the `-o` result's `/counts` | none | a0's object diff counts (`added`, `removed`, `modified`, `unchanged`, `ignored`, `base_objects`, `head_objects`) are gone; the per-tab `schematic`, `pcb` and `bom` summaries replace them |
