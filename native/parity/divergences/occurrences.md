# Divergences: occurrences

- Member: `projections/occurrences.json`, schema `prism.occurrences.a0` (root `OccurrencesA0`)
- Producer: P2 (`native/src/rs/prism-projections/src/occurrences.rs`)
- Field map: [`native/contracts/prism/field-maps/occurrences.md`](../../contracts/prism/field-maps/occurrences.md). Its "Expected divergences" table holds the full text. Maintainer decisions are in [`decisions.md`](../../contracts/prism/decisions.md), "Occurrences".
- Golden: `capture/occurrences.py`, the W0 prototype producer ported, on the prepared, KiCad-upgraded sources. Consumer checks are in `capture/occurrences_checks.py`, the field map's reading rules re-deriving today's outputs.

The field map's divergence table has no ids. They are numbered here D1–D10 in table order, and `Result.checks` uses these numbers.

No divergence makes a correct P2 output differ from the golden on a committed fixture, so `occurrences.json` accepts nothing. Every item below concerns today's consumers against the golden (the `Result.checks` of `capture.json`), not the golden against the member.

## D1. Stale instance record / D2. Orphan `.kicad_sch`

- Today: Design Comparison and catalog usage enumerate instance records and every file.
- Bundle: only occurrences reached through the hierarchy (decisions, Occurrences 3).
- Consumers: C2 BOM diff, C7 usage counts.
- Fixtures: none. Every committed fixture is `equal` on `designCompare.*` and `catalog.placedSymbols`. The W0 scratch case x-stale is not a committed fixture.
- Runner: nothing to do. The check's explain step recognises both if they ever appear.

## D3. Multi-unit reference whose units disagree on a BOM field

- Fixtures: none.
- Runner: nothing to do.

## D4. KiCad 7 board ids / D5. KiCad 7 schematic `Datasheet`

- Superseded by the source upgrade (decisions, Occurrences 1).
- On the upgraded `rs-cynthion` and `rs-synthetic`, `semanticIndex.assembly.default` (inventory included) and `semanticIndex.components.pcbRefs` are `equal`. In W0, on un-upgraded sources, they differed.
- Runner: nothing to do.

## D6. The index's `Description`

- Today: the semantic index's `Description` is the netlist's library description whenever that is non-empty, and only otherwise the placed symbol's. The code is `semantic_index_service.py:497`: `component["description"] or pick("Description")`.
  - The field map says "when the placed symbol's is empty". The code shows the library description takes precedence. On `rs-cynthion` (upgraded) the index shows `Unpolarized capacitor` where the placed symbol says `CAP CER 2.2UF 10V X5R 0603`.
- Bundle: the placed symbol's `Description`, as KiCad's BOM and Design Comparison show it.
- Consumer: none. Design Comparison already uses the placed symbol. Only the index differs, by definition (field map, "Relation").
- Fixtures: shape `semanticIndex.components.fields`, `divergence` (D6) on 31 of 32 captured fixtures. `rs-usb-pd` is `equal`. Counts of differing `Description` values:
  - `rs-cynthion` 337; `dv-oracle` and `dv-oracle_rev2` 12;
  - `sb-mini_obc-F0`…`F8`, `F11.1`, `F11.2` 6; `sb-mini_obc-F9` and `sb-mini_payload-F0` 5; `sb-mini_power-F10` 3;
  - 2 each: `dv-case_fold`, `dv-legacy_in_bom`, `dv-rule_area`, `rs-synthetic`, `sb-mini_power-F0`, `sb-p2-edge_a/edge_b/mezz_base/mezz_top-F0`, `sb-p2-mezz_top-F1`;
  - 1 each: `dv-kicad11_tokens`, `dv-no_variants`, `dv-sch_only`, `sb-p2-ambiguous-F0`.
- Runner: nothing to do for the member. The check accepts a difference only where today's index has a non-empty `Description` that is not the placed symbol's.

## D7. Project registry description `""`

- Fixtures: none. `releaseStudio.*.declarations` is `equal` everywhere.
- Runner: nothing to do.

## D8. Fork core instance fallbacks / D10. Fork core lacks variant records

- These are P2 implementation notes. The golden has `instanceMatched` without fallbacks (`true` on every committed fixture), and every raw record.
- Runner: nothing to do.

## D9. Repository-relative paths

- Every committed fixture has `project_dir == ""`, so `documentPath` is equal to today's.
- Runner: nothing to do. The golden already writes `RepoPath`s.

## Not a divergence: System Builder member-only references

- `rs-cynthion`: `FID1`–`FID4` are re-derived but are not ports today. The netlist pin filter (`interface_extractor.py:394`) stays with P5.
- The identity check compares today's references only, and records the extras in the notes.
