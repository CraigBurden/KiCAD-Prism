# Divergences: compare

- Command: `prism-kicad compare` (cli-spec.md §5.6); the `-o` document is
  `prism.compare.object_delta.a0` (root `CompareObjectDeltaA0`).
- Engine: `native/src/rs/prism-projections/src/compare/` (amendment C2
  §2 item 3).
- Field map: [`field-maps/compare.md`](../../contracts/prism/field-maps/compare.md).
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
- `compare`: `key` and `name` in Unicode code point order (Rust `str::cmp`; the
  `CompareObjectDeltaChangeA0.properties` and `CompareObjectDeltaA0.changes`
  documentation).
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
