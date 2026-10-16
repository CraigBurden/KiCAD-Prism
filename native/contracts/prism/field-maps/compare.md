# Field map: `-o` of `prism-kicad compare` (`prism.compare.object_delta.a0`)

Root model `CompareObjectDeltaA0` in `tsp/prism/compare-a0.tsp`. Example `examples/CompareObjectDeltaA0.example.json`.
Written by: WP-? `prism-kicad compare`, `native/src/rs/prism-projections/src/compare/` (subject of the C2 amendment). Stage: none (a comparison, not a bundle member).

It is a **parity document**: today's `prism.ecad_object_delta_v1`, the output of `backend/design-compare-parser/ecad-diff.mjs` (`diff_snapshots` plus `diff_indexes`), kept field for field except for the changes in the ADR amendment C2 §4. This map abbreviates today's code as `ed` (`ecad-diff.mjs`), `ep` (`ecad-parse.mjs`), `dcn` (`design_compare_nodes.py`), `dco` (`design_compare_occurrences.py`) and `dcs` (`design_compare_service.py`).

## Fields

Pointers are RFC 6901, with `*` for every element of an array and `{key}` for every key of a map. One row per leaf and per array/map. Rows under "every object" cover the fields `native_object` spreads (`ed:194-220`) into a change and into `ignored`, plus the `base`/`compare` objects; `CompareNativeObjectA0`, `CompareObjectDeltaChangeA0` and `CompareObjectDeltaIgnoredA0` all carry them.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.compare.object_delta.a0"` | — | required | today `"prism.ecad_object_delta_v1"` (ed:29) | K reader (`design_bundle`) | envelope; not compared |
| `/base`, `/head` | `CompareObjectDeltaSideA0` | — | required | ed:493-508 | dcn:201-206, dcn:425-458; dco:129-194; dcs:1021-1044, dcs:1140-1144 | today's side minus `root`, `timings`, `routeMetrics`, plus `bundleKey` |
| `/base/bundleKey`, `/head/bundleKey` | `Sha256Hex` | — | required | new | K's `CliCompareResultA0` | added by C2; fixes the side's identity |
| `/base/objects`, `/head/objects` | `Count` | — | required | ed:494, ed:502 (`index_snapshot().counts.total`) | none | same |
| `/base/nativeObjects`, `/head/nativeObjects` | `CompareNativeTargetA0[]` | — | required; in the side's index object order | ed:497, ed:505 (`native_target`) | dcn:201-206, dcn:425-458 | same; order not consumed (indexed by `uuid`) |
| `/base/componentObjects`, `/head/componentObjects` | `CompareNativeObjectA0[]` | — | required; in the side's index object order | ed:498, ed:506 (`component_objects`) | dco:129-194 | same set (symbols and footprints) |
| `/changes` | `CompareObjectDeltaChangeA0[]` | — | required; **sorted by `key` in code point order (D2)** | ed:465 (`localeCompare`) | dcn:417-422 | D2: today's order is locale-dependent (divergence compare-1) |
| `/changes/*/key` | `string` | — | required | ed:93-95 (`documentPath#uuid`) | dcn:356 | project-relative (D1) |
| `/changes/*/status` | `CompareObjectDeltaStatus` | — | required; `added`, `removed` or `modified` | ed:382, ed:426, ed:446 | dcn:262-263 | same |
| `/changes/*` every object field | see "Every object" | — | optional (except `uuid`, `kind`, `documentPath`) | ed:194-220 | dcn:231-408 | same names and millimetres; `properties` is overwritten, below |
| `/changes/*/properties` | `CompareObjectPropertyDeltaA0[]` | — | optional; **sorted by `name` in code point order (D2)**; absent when empty | ed:238-320, ed:380, ed:418, ed:445 | dcn:289-299 | the property-**delta** list, not the object's list; overwrites the spread's `properties` and, when empty, removes it (ed:386, ed:437, ed:451) |
| `/changes/*/base` | `CompareNativeObjectA0` | — | optional; present for `removed` and `modified` | ed:428, ed:450 | dcn:231 | same |
| `/changes/*/compare` | `CompareNativeObjectA0` | — | optional; present for `added` and `modified` | ed:385, ed:429 | dcn:232 | same |
| `/changes/*/atBase` | `CompareMmPoint` | mm | optional; `[x, y]` in that order; `modified` only | ed:430 | none | same |
| `/changes/*/reasons` | `CompareObjectDeltaReason[]` | — | optional; in the classifier order; `modified` only | ed:415-435 | dcn:351, dcn:407, dcn:459 | same values |
| `/changes/*/positionDelta` | `ComparePositionDeltaA0` | mm | optional; `modified` only | ed:436 | dcn:385 | same (`round6`) |
| `/ignored` | `CompareObjectDeltaIgnoredA0[]` | — | required; in head object order | ed:391-411 | none (compared as a set) | same entries; no consumer reads its order |
| `/ignored/*/reason` | `CompareObjectDeltaIgnoredReason` | — | required | ed:393, ed:408 | none | `internal-identity-only`, `generated-content-only` |
| `/ignored/*/properties` | `CompareObjectPropertyA0[]` | — | optional; in file order | ed:395 (spread `native_object`) | none | the object's **own** property list, not a delta list |
| `/counts` | `CompareObjectDeltaCountsA0` | — | required | ed:469-477 | none | same |
| `/byKind` | `Record<CompareObjectDeltaKindCountsA0>` | — | required; keys are `CompareObjectDeltaKind` values, in code point order | ed:455-463, ed:478 | none | same counts; key order is code point (today insertion order) |
| `/byReason` | `Record<Count>` | — | required; keys are `CompareObjectDeltaReason` values, in code point order | ed:460-462, ed:479 | none | same counts |

### Every object (`CompareNativeObjectFields`, `ed:194-220`)

| Field | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `uuid` | `string` | — | required | ed:195 (`object.uuid`); a review-only id today | dcn:203-206, dcn:309, dcn:441-443; dco:149 | KiCad uuid, or a review-only `<kind>:<hex>` id |
| `kind` | `CompareObjectDeltaKind` | — | required | ed:196 | dcn:236, dcn:121-161; dco:143, dco:147 | today's kind = bundle kind with `-` → `_` |
| `documentPath` | `string` | — | required | ed:198 (ep:1689) | dcn:237, dcn:311-312, dcn:371-372; dco:183 | project-relative (D1); today's `documentPath` |
| `parentUuid` | `KiCadUuid` | — | optional | ed:199 | dcn:310, dcn:379-380, dcn:441-443 | same |
| `at` | `CompareMmPoint` | mm | optional; `[x, y]` in that order | ed:200 (ep:302-308) | dcn:319, dcn:357-358 | same parsed millimetres |
| `rotation` | `float64` | ° | optional | ed:201 | dcn:285 | same |
| `mirror` | `CompareObjectDeltaMirror` | — | optional | ed:202 | dcn:286 | `x` or `y` |
| `layer` | `string` | — | optional | ed:203 | dcn:98-111, dcn:390 | same, wildcards kept |
| `layers` | `string[]` | — | optional; in file order (vias) | ed:204 | dcn:98-111, dcn:391 | same |
| `net` | `string` | — | optional | ed:205 | dcn:257, dcn:403 | same |
| `refdes` | `string` | — | optional; absent = empty | ed:206 | dcn:256, dcn:268; dco:140-144 | same |
| `libId` | `string` | — | optional | ed:207 | dcn:260 | same |
| `dnp` | boolean | — | optional | ed:208 | dcn:167 | same |
| `inBom` | boolean | — | optional | ed:209 | dcn:168 | same |
| `onBoard` | boolean | — | optional | ed:210 | none | same |
| `kiidPaths` | `string[]` | — | optional; schematic form, sorted in code point order | ed:211 | dcn:304, dcn:313-317 | same |
| `instances` | `CompareSymbolInstanceA0[]` | — | optional; in file order | ed:212 | dco:155-165 | same |
| `number` | `string` | — | optional | ed:214 | dcn:171, dcn:174-177 | same |
| `text` | `string` | — | optional | ed:215 | dcn:172, dcn:178-182, dcn:194-195 | same |
| `name` | `string` | — | optional | ed:216 | dcn:185-190 | same |
| `reviewFields` | `Record<BoardObjectsReviewValue>` | as written | optional; keys are review labels, in code point order | ed:217 | dcn:281-296 | today's labels and values, unconverted |
| `reviewOnly` | boolean | — | optional; true for a review-only object | ed:218 | dcn:302, dcn:411 | same |

### Supporting models

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/base/nativeObjects/*`, `…/nativeObjects/*` (`CompareNativeTargetA0`) | `uuid`, `kind`, `documentPath`, `parentUuid?`, `at?` | mm | as "Every object" | ed:222-230 | dcn:201-206, dcn:425-458 | same fields |
| `…/componentObjects/*`, `…/base`, `…/compare` (`CompareNativeObjectA0`) | every object field plus `properties?` | mm | `properties` in file order | ed:194-220, ep:914-928, ep:1201-1234 | dcn:209-213; dco:150-154 | same |
| `CompareSymbolInstanceA0` (`reference?`, `path?`) | strings | — | — | ed:212 (ep:893-912) | dco:155-165 | same |
| `CompareObjectPropertyA0` (`name`, `value`, `at?`, `rotation?`, `hide?`, `effects?`) | — | mm/° | `name`, `value` required; `hide` is `true`-only for schematic properties | ed:238-279 (ep:914-928, ep:1201-1234) | dcn:209-213; dco:150-154 | same; a footprint property has no `rotation`/`effects` |
| `CompareTextEffectsA0` (`font?`, `justify?`, `hide?`, `href?`) | — | — | — | ep:925 (parser `kicad-sexpr-parser.mjs:511-550`) | dcn:216-227 | same parser shape; the font models are in `compare-font-a0.tsp` (see "Naming") |
| `CompareTextFontA0` (`face?`, `size?`, `thickness?`, `bold?`, `italic?`, `line_spacing?`, `color?`) | — | mm | — | parser `font` | dcn:216-227 | same |
| `CompareFontSizeA0` (`x`, `y`) / `CompareColorA0` (`r`,`g`,`b`,`a`) | numbers | — | required | parser `T.vec2`, `T.color` | dcn:216-227 | same |
| `CompareTextJustifyA0` (`horiz`, `vert`, `mirror`) | enums, boolean | — | required | parser `justify` | dcn:216-227 | same |
| `CompareObjectPropertyDeltaA0` (`name`, `from?`, `to?`, `attributesChanged?`, `fromAttributes?`, `toAttributes?`) | — | mm | — | ed:238-279 (`property_deltas`), ed:298-309 (`review_field_deltas`) | dcn:289-299 | a review-field delta carries only `name`, `from`, `to` |
| `ComparePropertyAttributesA0` (`at?`, `rotation?`, `hide`, `effects?`) | — | mm/° | `hide` required | ed:248-263 | dcn:291-299, dcn:216-227 | same |
| `ComparePositionDeltaA0` (`dx`, `dy`, `distance`) | `float64` | mm, `1e-6` | required | ed:322-332 | dcn:385 | same |
| `CompareMmPoint` (`[x, y]`) | `float64[]`, 2 items | mm | — | ed:200, ep:302-308 | dcn:319 | same parsed value |

## Dropped versus `prism.ecad_object_delta_v1`

- Top-level `timings` (`{baseMs, headMs, deltaMs, totalMs}`), `peakRssBytes` and `node` (ed:510-517) — run facts; the benchmark (`design_compare_benchmark.py`) times the subprocess from Python instead.
- Each side's `root` (ed:494, ed:502) — a host path; forbidden by conventions §4. `dco:138` read it for sheet-level DNP/BOM in C2's Python path; the bundle branch replaces that input.
- Each side's `timings` (ed:496, ed:504) — run facts.
- Each side's `routeMetrics` (ed:499, ed:507) — C2 reads `projections/route-metrics.json` instead (`dcs:1140-1144` is the consumer that moves).
- Added: `base.bundleKey`, `head.bundleKey`.

## D1 and D2

- **D1 — object keys and `documentPath` stay project-relative.** Today's key is `<documentPath>#<uuid>`, where `documentPath` is relative to the project directory (the snapshot root, `dcs:77-88`). The builder strips the anchor's directory from each member `RepoPath` (as C8 does in `_strip_project_directory`), so `_node_changes`, `_hydrate_native_targets` and the stored comparison ids keep their keys.
- **D2 — code point order.** `changes` is sorted by `key` and each `changes[*].properties` delta list by `name`, both in Unicode code point order (Rust `str::cmp`, Python `sorted`). Today's `localeCompare` order depends on the host locale; the divergence is `compare-1`. Review groups and counts do not change; only the order of Design Comparison's review list does.

## Naming

This is a parity document and keeps every one of today's names, `font.line_spacing` included. A contract file holds one naming family (conventions §5, enforced by `check-contract.mjs`), and that key is today's only snake-case one, so the font models (`CompareTextFontA0`, `CompareFontSizeA0`, `CompareColorA0`) live in their own file, `native/src/tsp/prism/compare-font-a0.tsp`. Today's real diffs on the 16 validation pairs do not emit the key. (`BoardObjectsFont` spells it `lineSpacing`, under the bundle's own naming; the Rust engine writes `line_spacing` here.)

## Example provenance

`examples/CompareObjectDeltaA0.example.json` is cut from `transformed` real diffs of the prepared `sb-mini_obc` and `sb-mini_obc-F9` fixture pairs: one `added` pad and one `removed` pad and the `symbol` `Reference` property delta (with `fromAttributes`/`toAttributes`) from `F0`→`F2`; the moved footprint with `positionDelta` from `F0`→`F9`; the `ignored` entry from `F0`→`F3` (which has none of the other statuses). `bundleKey`s and object counts are fixed, `changes` and the delta lists are re-sorted by code point, and `base`/`head` `nativeObjects`/`componentObjects` are trimmed to keep the file small. Because no single prepared pair carries all four statuses at once, entries are taken verbatim from the pairs named here.
