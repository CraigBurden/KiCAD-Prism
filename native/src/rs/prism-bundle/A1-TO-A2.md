# prism-bundle: manifest a1 → a2

This crate is prism-sim-studio's `prism-bundle` (manifest `prism.bundle.manifest` a1, sim `a714101`), moved into Prism and rebuilt for manifest `prism.bundle.manifest.a2`. The field-by-field contract mapping is `native/contracts/prism/field-maps/bundle-manifest.md` ("a1 → a2 mapping"); this file maps the code and states what the implementation does for each field.

## Manifest fields

| a1 field | a2 field | Implementation |
|---|---|---|
| `schema: "prism.bundle.manifest"` + `version: "a1"` | `schema: "prism.bundle.manifest.a2"` | `manifest::MANIFEST_SCHEMA`. The reader rejects an a1 manifest with `manifest-unsupported` (`reader::read_manifest`); `--in` maps it to exit 7. |
| `board_id` | `board_id` | always `main` (`manifest::BOARD_ID`). |
| `created_by {name, version}` | `generator` | the `prism-kicad version` document, embedded verbatim (`stages::Generator`). |
| `created_at?` | — | dropped; no member holds a time. |
| `members[]` (`role`, `path`, `sha256`, `bytes`, `member_schema?`) | `members[]` + `stage` + `source?` | `stages::MemberData::record`. Sources are `sources/<repo path>` and carry their key entry (`source`); `member_schema` is set for `design`, `materialization` and every `projection`. |
| role `viewer-asset` | — | removed with the `--viewer-dir` input (decisions.md). |
| `materializer.schema` | `members[materialization/board.kmpack].member_schema` | `manifest::MATERIALIZATION_SCHEMA`. |
| `materializer.pack_format_version` | `generator.pack_format_version` | `PACK_FORMAT_VERSION` of the pack crate, in the CLI's generator. |
| `materializer.producer`, `.repository`, `.revision`, `.tile_size_nm` | — | dropped; the pack header keeps producer and tile size, `generator.crate_version` pins the code. The tile size is fixed at 10 mm (`stages::materialize::DEFAULT_TILE_SIZE_NM`). |
| `design {name, version}` | — | dropped; `design.json` carries its own generator, `generator.engine_version` pins the core. |
| `fill_provenance` | `stages.board.fill_provenance` | `refilled` from `--refilled-board`, `saved` exactly when `config.zone_fills` is `saved`; a1's `--no-refill` has no successor (`stages::board`). |
| `kicad_cli_version?` | `generator.kicad_version` | `--refill-tool`/`--models-tool` must equal it (`kicad-version-mismatch`). |
| `source_board {path, sha256}` | `config.board` + its member | no duplicate hash. |
| `refilled_board? {path, sha256}` | member `refilled/<board name>` | no duplicate hash. |
| `fill_check?` | `stages.board.fill_check?` | a1's comparison, unchanged (`stages::materialize::compare_fills`). |
| `cross_check` | `stages.board.cross_check?` | a1's rules, unchanged (`stages::crosscheck`); warnings and errors sorted by code then message, `errors` always written (`manifest_report`). |
| `warnings` | `stages.<stage>.warnings` | per stage, sorted; cross-check findings stay in `cross_check`. |
| — | `revision_key`, `bundle_key`, `config`, `stages` | new. |

## Modules

| a1 (sim `src/prism-bundle/src/`) | a2 (this crate) | Change |
|---|---|---|
| `zip.rs` | `zip.rs` | streaming writer; the reader accepts only the canonical layout and checks everything of cli-spec.md §6.2 before inflating. CRC through `crc32fast`. |
| `reader.rs` | `reader.rs`, `verify.rs` | bundle-format.md §9 steps 1–7, JSON Schema validation (`schema.rs`), invariants I1–I12. `geometry()` is gone: open the pack with `prism_geometry::Geometry::open(reader.member(…))`. |
| `manifest.rs` | `manifest.rs` | the generated `prism_bundle_manifest_a2` types replace the hand-written a1 structs. |
| `sources.rs`, `sheets.rs` | `stages/sources.rs`, `stages/sexpr_check.rs`, `stages/sheets.rs`, `stages/parse.rs` | the source set comes from the revision key's name rules under `--source-root`; files are repository paths; the closure the build read becomes `sources/`. Malformed or missing sources are recorded (stage parse `failed`) instead of failing the build. |
| `design.rs` | `stages/design.rs` | built in stage parse from the source board (a1 used the refilled board). |
| `materialize.rs`, `stackup.rs`, `crosscheck.rs` | `stages/` | moved; the operation bound is `max-materialization-operations`; a failing materializer is `materialization-failed` (stage board `partial`). |
| `refill.rs`, `scratch.rs` | — | the CLI never runs KiCad; the backend refills (`pcbnew-zone-filler-a0`) and hands the board in. |
| `build.rs` | `stages/{parse,board,models,chain}.rs` | three stages chained through `--in`, each rewriting the archive atomically (the CLI's `atomic.rs`). |
| `board_refs.rs` (uncommitted in sim) | — | not moved; not part of a1 at `a714101`. |
| `bin/prism-bundle.rs` | `prism-kicad-cli` | `prism-kicad` replaces the `prism-bundle` binary. |

## Archive

a2 writes `bundle.json` compact plus one LF (a1 pretty-printed it), deflates `bundle.json` like every other member, and adds the GLB canonicalization of stage models. Everything else of a1's deterministic zip (fixed 1980-01-01 time, UTF-8 flag, no extra fields, members by path after `bundle.json`) is unchanged.
