# Divergences: compare

- Command: `prism-kicad compare` (cli-spec.md §5.6). The entries below were
  recorded against its first document, `prism.compare.object_delta.a0`, which
  the C2r switch removed (ADR amendment C2r §4); the object diff inside today's
  `prism.design_compare.result.a1` keeps the same rules.
- Engine: `native/src/rs/prism-projections/src/compare/` (amendment C2
  §2 item 3).
- Field map: [`field-maps/design-compare.md`](../../contracts/prism/field-maps/design-compare.md).
- Golden: the 16 pairs of the C2 parity harness, today's
  `backend/design-compare-parser/ecad-diff.mjs` output transformed per D1–D3.
- `divergences/compare.json`: none. `compare` is not a bundle member, so the
  parity runner does not read one; this file is the record the amendment C2 §5
  asks for.

`compare` is a parity document. The three entries below are the only places its
output may differ from a golden.

## compare-1. `changes` and property deltas in code point order (D2)

- Case: every pair whose `changes` or `merged_property_deltas` lists more than
  one entry with a different `localeCompare` and code point order.
- Today: `changes.sort((a, b) => a.key.localeCompare(b.key))` and
  `deltas.sort((a, b) => a.name.localeCompare(b.name))`
  (`ecad-diff.mjs:278`, `:308`, `:319`, `:465`), ICU collation under the
  host's `LANG`.
- `compare`: `key` and `name` in Unicode code point order (Rust `str::cmp`,
  `prism-projections/src/compare/diff.rs` and `classify.rs`).
- Why the new output is right: ICU collation depends on the host locale, so
  today's order is not a property of the inputs. Code point order is, and it
  matches `sorted()` in Python (`_node_changes`) and `Array.prototype.toSorted`
  with the default comparator.
- Consumer affected: the order of Design Comparison's review list
  (`backend/app/services/design_compare_nodes.py:417-422`, `_node_changes`).
  Review groups and counts do not change; no consumer reads the order of
  `ignored`.
- Fixtures: the parity harness re-sorts both sides by code point before
  comparing `changes` as a sequence, so no committed pair shows this as a
  difference. It is recorded here because the raw today's output can.

## compare-2. Sub-nanometre property `at` (inherited from board-objects D1)

- Case: a hand-written schematic coordinate with sub-nanometre digits, for
  example `design_variants/oracle/antenna.kicad_sch:39`
  (`23.810000000000002`).
- Today: the parsed double, kept verbatim in `properties[*].at`, for example
  `41.269999999999996`.
- `compare`: the member's integer nanometres as millimetres
  (`nm / 1e6`), for example `41.27`. The member stores `at` as
  `{xNm, yNm}` integers (conventions §6), so the sub-nm digits are not
  recoverable.
- Why the new output is right: it is this exact divergence, not a new one. The
  board-objects field map lists it as expected divergence 1, and
  [`board-objects.md`](board-objects.md) D1 records that the golden transform
  reflects it: "the golden's rebuild check explains every difference with D1 on
  7 cases: `dv-oracle` 24, `dv-oracle_rev2` 24 (symbol property `at` values)".
  A golden value computed from a sub-nm coordinate is a value `compare` cannot
  reproduce from the nm member.
- Consumer affected: Design Comparison position texts and the `at` of a
  changed object.
- Fixtures: `dv-oracle-rev2` only, 64 pointers: 24 `base` component objects,
  24 `head` component objects, and 16 across the `changes` lists' `base` and
  `compare` copies. On the parity harness this pair reports those 64
  differences and nothing else; every other pair is equal.

## compare-3. `nativeObjects` in member order

- Case: every pair. `base.nativeObjects` and `head.nativeObjects` hold the same
  objects as today's, in a different order.
- Today: `base.objects.map(native_target)` (`ecad-diff.mjs:497`, `:505`), the
  order the Node parser walked the files.
- `compare`: the order of `projections/board-objects.json`'s objects, which the
  member fixes (board-objects field map).
- Why the new output is right: the walk order is a property of the old
  parser, not of the design; the member's order is deterministic.
- Consumer affected: none. The only reader,
  `backend/app/services/design_compare_nodes.py` `_native_index`, builds a
  dict keyed by `uuid`, and no harness pair has a repeated `uuid` in
  `nativeObjects`. `componentObjects`, which `design_compare_occurrences.py`
  reads in order, is in today's order on every pair.
- Fixtures: the parity harness compares `nativeObjects` as a set and reports
  the order as a note, on all 16 pairs.

## Note. The anchor precondition on the anchor directory

`compare` refuses `--base`/`--head` whose `config.project_file`s have
different directories (exit 7, `anchor-mismatch`), because object keys and
`documentPath` are relative to the anchor's directory (D1): two projects in one
directory share a key space. The parity harness's `synthetic-usbpd` pair
(`synthetic.kicad_pro` and `USB-PD-Trigger-Board.kicad_pro`) is two anchors in
one directory (both at the repository root) and is expected to compare, which
is why the check is on the directory. A pair whose anchors are in different
directories is refused. cli-spec.md §5.6 and amendment C2 §3.2 item 4 now say
so; this is not an output divergence.

# The Design Comparison result (amendment C2r)

- Document: `compare`'s `prism.design_compare.result.a1` (root
  `DesignCompareResultA1`), every tab except fabrication.
- Reference: today's `prism.semantic_comparison_v3` result on the 18 recorded
  C2r pairs, converted by `field-maps/design-compare.md`.
- Rule: amendment U §3.1. Only differences a user can see are entries; each
  says what the user saw before and sees now. Invisible differences are listed
  once, at the end, so a reviewer knows they were looked at.
- Status by tab (2026-10-17): every tab except fabrication is done (C2r
  step 4, chunks 1–5) and equals the reference on all 18 pairs. Chunks 4
  (connectivity) and 5 (`projectDiff`) added no divergence. Step 6
  (2026-10-18) checked the review list the frontend builds from it: compare-6
  and compare-7.
- Step 7 gate (2026-10-18): today's path, as the code is now, against
  `compare` on the 18 pairs and on one consecutive-commit pair of 6 corpus
  projects (1,971 review groups). It found and fixed two defects, neither a
  divergence: a project in a subdirectory named its net changes' sheets by
  repository path (`result/pages.rs`), and a net the semantic index had merged
  into a board net was diffed under the board name, so a renamed net read as
  "connections 1 → 0" (`result/schematic_nets.rs`; field map
  `semantic-index.md` D7). What remains is compare-7, compare-8 and compare-9.

## compare-4. Structure changes carry both sides

- Case: a change to a sheet instance or a bus, which today's semantic
  comparison reports with source ids but no `base_item` or `compare_item`
  (`design_compare_semantics.py:290-460`).
- Before: the review card names the change, but its before and after panels are
  empty.
- Now: `base` and `head` are filled from the structure's visual targets, with
  the same fields as any other object's sides: source id, page, position,
  layers.
- Why: every change carries its identity the same way, so the property panel
  and the review groups need no special case. Field map `design-compare.md`,
  "Expected divergences", row 2.
- Pairs: every pair with a sheet-instance or bus change. The harness reference
  has the sides already, because the converter fills them the same way.

## compare-5. Inherited from the members

These change a Design Comparison tab because the member they read changed.
Each is recorded, with its fixtures, in the member's own file:

- **Used layers of a net** (`routeMetrics`): every copper layer a via spans, not
  only its two end layers. [`route-metrics.md`](route-metrics.md) D7.
- **Stackup without dielectric constraints** (`stackup`): no spurious
  "changed" on the setting when neither board writes the token.
  [`stackup.md`](stackup.md) D4.
- **Net names** (`schematic`, `pcb`): the reconciled net name.
  [`semantic-index.md`](semantic-index.md) D7.
- **Change order** and **sub-nanometre coordinates**: compare-1 and compare-2
  above.

## compare-6. The review list's order

- Case: every pair. Today's changes arrive in the order Node's sets happen to
  emit them, which has no structure (a page's pins, wires and symbols
  interleave). `compare` writes each tab sorted by `id`, a content hash.
- Before: where a group holds several changes, its summary, its "at x, y"
  position and its "item N" ordinal came from whichever change arrived first,
  so a group of a removed and an added part read "DNP: false → —" or
  "DNP: — → false" depending on that order.
- Now: the frontend orders the review list itself (`reviewOrder`,
  `comparison-review-noise.ts`): page, then removed before changed before
  added, then top to bottom and left to right, then id. A mixed group
  summarises its old object first, and ordinals and positions follow the page.
- Why: the frontend owns presentation order (C2r Q2), and an order that
  follows the drawing reads the same on every run.
- Pairs: all 18. With the same order applied to today's result, the review
  read through the legacy reader equals today's on all 237 groups, and
  `compare`'s on all but the summaries of compare-7.

## compare-7. Field order in a group's summary

- Case: a change whose summary shows two fields, on the 18 pairs 50 groups,
  nearly all net structure changes (`instances`, `connections`) and sheet
  instances (`page`, `sheetPath`).
- Before: the first two fields in the order Python built the change, for
  example "instances: 0 → 1 · connections: 0 → 1".
- Now: the first two in name order, "connections: 0 → 1 · instances: 0 → 1".
- Why: the result's `fields` is a map, written in code point order of its keys
  (contract conventions); its order carries no meaning to keep.
- Pairs: obc-F0-F1, obc-F0-F4, obc-F0-F11.1, obc-F0-F11.2, power-F0-F10,
  synthetic-usbpd.

## compare-8. Changes that are only a KiCad re-save

- Case: a commit where KiCad saved the files in a newer format, alone or with
  real edits. On the corpus: cynthion's "Upgrade board and schematics to the
  KiCad 10 format", openswitch-lan969x's "update to kicad v10", and
  eda-04949's KiCad 8 minor-version save.
- Before: today's path compares the files as committed, so the format change
  itself shows. Cynthion's re-save showed 846 schematic and 2,652 PCB changes.
  Eda-04949 showed 120 removed and 114 added `$teardrop_padvia$` zones and 12
  footprints "content changed" with no field named (their text differs only by
  the `(embedded_fonts no)` token). Lan969x showed a GND zone moved by 8 µm.
- Now: both revisions are upgraded to the generator's KiCad before they are
  compared (the parse stage's sources, ADR §7), so a re-save shows nothing and
  only real edits remain. Cynthion's re-save shows no change; KiCad 9 and later
  store teardrops on the pads and vias, so they show as pad and via settings.
- Why: the reviewer asked what changed in the design, and a format upgrade is
  not a design change.
- Pairs: the corpus pairs above; no recorded pair changes format.

## compare-9. BOM references from this project's instance data

- Case: a schematic shared by several projects in one repository, each with
  its own `(instances (project …))` references. Corpus pair eda-04949: the
  sheet carries references for `vme-wren` and for `EDA-04949-V1-0`.
- Before: the BOM tab read some symbols' references from the other project, so
  16 connectors (JFBP1–5, JIO3–13) were missing from "removed" when the commit
  re-annotated them to J1–J5 and LM0–13.
- Now: 36 added and 36 removed rows, the same as `kicad-cli sch export bom` of
  each revision. The review list groups the 16 connector changes by part, as it
  does for any part with BOM rows on both sides.
- Why: KiCad shows a symbol's reference for the project that is open.
- Pairs: eda-04949 (corpus).

## Pending

- **Property value types** (`projectDiff`, chunk 5) are not a divergence.
  The rule is: a number is `int` when it is integral, `double` otherwise,
  `bool` for a flag and `string` for text. It equals today's Python types on
  all 895 numeric values of the 18 pairs, and ecad-viewer parses `type` but does
  not render it. No reference has a list value, which today would be written as
  its Python `str()`.
## Not divergences

- **BOM columns.** Native output uses today's defaults (Reference, Value,
  Footprint, Datasheet) when `.prism.json` names no `bom.fields`. The first
  recorded references lacked Datasheet because the harness mocked the setting
  to empty. They were regenerated, so this is a reference fix, not a change
  the user sees.
- **Route lengths** are shown as today, to 4 decimal millimetres. The result
  stores them as nanometres of that rounded value.

## Invisible differences

None of these changes a rendered value, an order or a count:

- an integral number written `0.0` where today wrote `0` (chunk 3; the harness
  compares numbers by value);
- map key order;
- `objectKind` spelled with hyphens (`sheet-pin`, `board-constraint`), the
  member's vocabulary. The new frontend (C2r step 6) reads it and shows the same labels;
- `nativeObjects` order (compare-3).
