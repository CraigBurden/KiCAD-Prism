# Divergences: board-objects

- Member: `projections/board-objects.json`, schema `prism.board_objects.a0` (root `BoardObjectsA0`)
- Producer: WP-P2 (`native/src/rs/prism-projections/src/board_objects.rs`)
- Field map: [`field-maps/board-objects.md`](../../contracts/prism/field-maps/board-objects.md), "Expected divergences" (ids below are its numbers)
- Golden: `capture/board_objects.py` (today's `index_snapshot`, `ECAD_INDEX_CACHE=0`, on a COMPARE_INPUTS copy of the project directory); `contentDigest` from the reference implementation `capture/board_objects_sexpr.mjs`, cross-checked object by object against the independent `capture/board_objects_digest.py` (all 23,322 digests of the 32 goldens agree).
- Accepted entries in `board-objects.json`: none. Every divergence below is either already reflected by the golden transform or does not occur on a committed fixture.

Measured on the 33 committed fixtures (32 goldens; `dv-malformed` has none, see D10).

## D1. Sub-nanometre coordinates

- Case: hand-written schematic coordinates such as `23.810000000000002` (`design_variants/*`).
- Today: the parsed double. Bundle: integer nm (conventions §6).
- Why: lengths are integer nm; KiCad writes at most 6 decimals.
- Consumer: DC position texts.
- Fixtures: the golden's rebuild check explains every difference with D1 on 7 cases: `dv-case_fold` 2, `dv-kicad11_tokens` 1, `dv-no_variants` 1, `dv-oracle` 24, `dv-oracle_rev2` 24, `dv-rule_area` 2, `dv-sch_only` 1 (symbol property `at` values).
- Runner: nothing; the golden is already in nm, so a correct member equals it.

## D2a–2e. `contentDigest` versus today's `hash`

- Case: model changes, tokens inside kept children, token spelling, numeric spelling.
- Today: `hash` ignores them. Bundle: the canonical-text digest sees them (2a–2c), or agrees (2d, 2e).
- Why: field map "contentDigest" (maintainer decision, Board objects 1).
- Consumer: DC `content-changed` rows.
- Fixtures: `contentDigest` is non-semantic in value comparison (`members.py`) and checked by the step-4 equality pattern from the sidecar `board-objects.today-hash.json`. On the 15 `fixtures.json` pairs: 2,016 keys present on both sides, digest equal ⇔ hash equal on every one (0 disagreements). Rerunning today's `diff_indexes` on entries rebuilt from the goldens gives `changes`, `ignored` (as a set), `counts`, `byKind`, `byReason` identical to today's run on all 15 pairs, with today's hash carried and with `hash := contentDigest`. (Scratch script, not part of capture.)
- Runner: nothing beyond the equality-pattern check.

## D3. Board groups (KiCad 7+)

- Today: never listed. Bundle: listed.
- Fixtures: no committed board (after the KiCad 10.0.6 upgrade) has a `(group "…" (uuid …))`; 0 objects. Runner: nothing. A corpus board with groups needs a patch or a rule.

## D4, D5, D6. Non-canonical uuids, invalid KIID paths, empty refdes

- Today: listed / kept / `""`. Bundle: not listed / dropped / absent.
- Fixtures: 0 each. Every fixture is upgraded before capture, so cynthion's KiCad 7 `tstamp` ids are canonical uuids in the prepared sources. The golden transform applies all three, so the member equals the golden either way.

## D7. Duplicate uuid in one document

- Fixtures: 0. Golden keeps the later in collection order, as today; would need attention only if one appears.

## D10. A document the parser rejects

- Case: `design_variants/malformed`, whose `broken.kicad_sch` has an unclosed root list.
- Today: `index_snapshot` accepts it with no `error` (the vendored reader tolerates the missing `)`) and lists 12 objects.
- Bundle: a malformed schematic fails stage parse (bundle-format §2.3, field-maps/cli.md: `source-unparseable` at line 1, column 1), so no member is written; D10's per-document warning applies only to a document a successful parse cannot read.
- Capture: a balanced-list scan of every snapshot `.kicad_sch`/`.kicad_pcb` (fork reader rule) finds it; `NotCaptured`, status `stage-parse-fails`. No golden.

## D11. Documents outside the closure

- Today: every parsed kind under the project directory. Bundle: the project's closure.
- Implemented in K2a: before it, the producer took every document of the repository-wide source set.
- Fixtures: every listed document is the anchor's `.kicad_pro`/`.kicad_pcb`/`.kicad_dru` or a schematic reachable from the root sheet; 0 outside the closure. Runner: nothing.

## D13. Repository-relative paths

- Golden `path`s are `ctx.repo_path` of today's project-relative `documentPath`; the sidecar and the rebuild check use the same ObjectRefs. Every committed fixture has its project at the root, so the paths are unchanged. Runner: nothing.

Not applicable to golden comparison: D8 (review-field key order, golden sorted), D9 (no fixture has such a value; capture fails loudly if one appears), D12 (`ignored` is not in the member).

## bo-net-code: a pad's net is its name, in every board format (2026-10-22)

`net_name_of` read item 1 of a net form as the name. For KiCad 9 and older, `(net 722 "S32G3_PWR_EN")`, that is the code, so every pad, track, arc and via of an un-upgraded board reported nets like `"722"`. JTYU-OBC (format 20241229) had 3,886 of 4,118 pads affected, and Release Studio's testpoint schedule printed net numbers. The field map always said `NetName` (rule 3). Upgraded sources write `(net "<name>")` and were never affected, so the parity goldens, which are captured from upgraded sources, do not move. The committed CLI fixtures built from older formats do, and `crate_version` rises to 0.8.0 with the regenerated generator pin.
