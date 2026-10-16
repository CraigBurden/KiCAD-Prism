# Field map: `projections/board-objects.json` (`prism.board_objects.a0`)

Root model `BoardObjectsA0` in `tsp/prism/board-objects-a0.tsp`. Example `examples/BoardObjectsA0.example.json`.
Written by: WP-P2, `native/src/rs/prism-projections/src/board_objects.rs`. Stage: parse.

The member replaces today's Node object index, `prism.ecad_object_index_v1` (`backend/design-compare-parser/ecad-parse.mjs`, called by `ecad-diff.mjs` through `design_compare_service.py:638-662`). Design Comparison consumes three things built from that index, and C2 builds them from this member instead:

- `changes`: `diff_indexes` (`ecad-diff.mjs:338-481`), turned into review items by `_node_changes` (`backend/app/services/design_compare_nodes.py:417-422`, `:230-414`);
- `nativeObjects`: `native_target` of every object (`ecad-diff.mjs:222-230`, `:497`, `:505`), read by `_hydrate_native_targets` (`design_compare_nodes.py:425-458`);
- `componentObjects`: `native_object` of every symbol and footprint (`ecad-diff.mjs:194-220`, `:232-236`), read by `revision_components` (`backend/app/services/design_compare_occurrences.py:129-194`).

Route metrics are not here (`projections/route-metrics.json`). The frontend reads none of this member directly: it sees the review items (`frontend/src/components/design-comparison/types.ts:107`, `:149`, `:160-199`), whose kinds are `CHANGE_KINDS` (`comparison-change-kinds.ts:59`).

Design rules:

1. **Mirror today's index entry.** Every object carries the fields today's entry carries, under the same names, so rebuilding the entry is a rename and a unit conversion ("Rebuilding today's index entry"). The only changes are: millimetre coordinates become integer nanometres; `rotation` becomes `rotationDeg`; a footprint's one-entry `kiidPaths` becomes `footprintPath`; `hash` becomes `contentDigest` (a new definition, compared by equality only); symbol `unit` and footprint `sheetfile` are dropped (no reader); Prism-named kinds are kebab-case.
2. **Objects are grouped by document.** `documentPath` is the document's `path`; the object key `documentPath#uuid` is the ObjectRef `<path>#<uuid>`. The path is repository-relative (conventions §8), so Design Comparison object ids change once, by decision (divergence 13); no compatibility with today's project-relative ids is kept.
3. **Review fields stay presentation values.** They are the labels and values today's index writes, unconverted (see the open question on conventions §6 in the W0 report).

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array, `{key}` is every key of a map. One row per leaf and per array/map. Rows under "kind `x`" apply to elements of `/documents/*/objects` whose `kind` is `x`; the prefix `/documents/*/objects/*` is written `…/o`. "ep" is `backend/design-compare-parser/ecad-parse.mjs`, "ed" is `backend/design-compare-parser/ecad-diff.mjs`, "dcn" is `backend/app/services/design_compare_nodes.py`, "dco" is `backend/app/services/design_compare_occurrences.py`.

### Root and documents

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.board_objects.a0"` | — | required | today `"prism.ecad_object_index_v1"` (ep:33) | K reader (`backend/app/services/design_bundle/`), C2 | envelope; not compared |
| `/documents` | `BoardObjectsDocument[]` | — | required; sorted by `path` (code point); may be empty | ep:197-220 (`collect_documents`, sorted), ep:1744-1753 | C2 | today's `documents[]` also has `docType`, `bytes`, `objects`, `parseMs`, `error`: run facts, not member fields |
| `/documents/*/path` | `RepoPath` | — | required; unique | ep:1689 (`relative(root, path)`, root = the snapshot flattened to the project directory) | ed:93-95 (key), dcn:237, dcn:311-312, dcn:371-372, dco:183 | repository-relative; today's `documentPath` is project-relative. Equal for a project at the repository root (divergence 13) |
| `/documents/*/objects` | `BoardObjectsObject[]` | — | required; file order (opening-parenthesis offset); `uuid` unique | ep:930-1158 (schematic), ep:1286-1625 (board) | ed:338-481, ed:222-236 | today's order is by collection; no consumer depends on it (`changes` are sorted by key, ed:465) |
| `/documents/*/reviewOnlyObjects` | `BoardObjectsReviewOnlyObject[]` | — | required; sorted by `id` (code point); `id` unique | ep:553-739, ep:836-858, ep:1051-1066, ep:1586-1591 | ed:338-481 | same set; order differs, not consumed |

### Identity fields (every kind in `objects`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/kind` | string literal (one per variant) | — | required; first property | ep:41-52 (`CANONICAL_KINDS`), ep:950, ep:1359 | ed:34-46, dcn:236, dcn:121-161, dco:143, dco:147 | today's kind = bundle kind with `-` → `_` (`sheet-pin`, `footprint-graphic`, `footprint-text`) |
| `…/o/uuid` | `KiCadUuid` | — | required; unique per document | ep:940 (`item.uuid`), ep:1350 (`uuid \|\| tstamp`) | ed:93-95, dcn:264-266, dcn:309, dcn:201-206, dco:149, dco:188 | objects whose id is not a canonical uuid are not listed (divergence 4) |
| `…/o/contentDigest` | `BoardObjectsContentDigest` | — | required | today's `hash` (ep:952, ep:1366-1374) | ed:125 (`authored_content_identity`), ed:400 | new definition ("contentDigest"); parity by equality pattern, never by value |

### kind `symbol` (`BoardObjectsSymbol`), KiCad `(symbol (lib_id …) …)`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/libId` | `LibId` | — | optional; absent = no `(lib_id …)` | ep:964 | ed:39 (`lib-changed`), ed:290, dco:35-41 (power symbol), dcn:260 | same |
| `…/o/at` | `PointNm` | nm | optional; schematic page frame | ep:965 (`point_of`) | ed:33 (`moved`), ed:284, ed:322-332, dcn:357-358 | mm → nm ("Units") |
| `…/o/rotationDeg` | `Degrees` | ° | optional; present iff `at` | ep:966 (parser default 0, `kicad-sexpr-parser.mjs:483-501`) | ed:34, ed:285 | renamed from `rotation` |
| `…/o/mirror` | `BoardObjectsMirror` | — | optional; absent = not mirrored | ep:967 | ed:35 (`mirrored`), ed:286 | same |
| `…/o/dnp` | boolean | — | required | ep:972 (`=== true`) | ed:40, ed:291, dco:167 | same |
| `…/o/inBom` | boolean | — | required | ep:973 (`!== false`) | ed:292, dco:168 | same |
| `…/o/onBoard` | boolean | — | required | ep:974 (`!== false`) | ed:293 | same |
| `…/o/refdes` | `Refdes` | — | optional; absent = none of the three sources non-empty | ep:975, ep:879-891 | ed:38, ed:289, dcn:256, dcn:268, dco:157 | today `""` possible in theory; bundle omits (divergence 6) |
| `…/o/kiidPaths` | `KiidPath[]` | — | required; sorted (code point), unique; schematic form | ep:976, ep:867-877 | ed:41-45 (`re-pathed`), dcn:304, dcn:313-317 | today absent when empty; bundle `[]` (rebuild drops it) |
| `…/o/kiidPaths/*` | `KiidPath` | — | — | ep:872 | dcn:313-317 | invalid paths are dropped (divergence 5) |
| `…/o/instances` | `BoardObjectsSymbolInstance[]` | — | required; file order | ep:977, ep:893-912 | dco:155-165 | today absent when empty; bundle `[]` |
| `…/o/instances/*/reference` | `Refdes` | — | optional; absent = none or empty | ep:899, ep:909 | dco:157 | empty → absent |
| `…/o/instances/*/path` | `KiidPath` | — | optional; schematic form occurrence path | ep:900-903 | dco:160-165 | invalid → absent (divergence 5) |
| `…/o/properties` | `BoardObjectsSchematicProperty[]` | — | required; file order | ep:978, ep:914-928 | ed:238-279, dcn:209-213, dco:150-154 | see "Schematic properties" |
| `…/o/reviewFields` | map of `BoardObjectsReviewValue` | — | required; keys code point | ep:979 | ed:281-296 | labels: "Review fields" |
| `…/o/reviewFields/{key}` | `BoardObjectsReviewValue` | as written | — | ep:979 (`Unit`) | ed:298-309 | same values |

Today's `unit` (ep:968) is dropped: no reader (it is not in ed:63-84 or ed:194-220); `reviewFields.Unit` carries it.

### kind `pin` (`BoardObjectsPin`), `(pin "<n>" (uuid …))` inside a placed symbol

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/parentUuid` | `KiCadUuid` | — | optional; absent = parent symbol has no valid uuid | ep:991 | ed:65, dcn:310, dcn:379-380, dcn:441-443 | same |
| `…/o/number` | `PadNumber` | — | optional | ep:992 | ed:79, dcn:171, dcn:176-177 | same |
| `…/o/refdes` | `Refdes` | — | optional; the parent's `refdes` | ep:993 | ed:38, dcn:256 | same |
| `…/o/at` | `PointNm` | nm | optional; the parent symbol's anchor | ep:998 | ed:33, dcn:319 | same (pins of a moved symbol read as moved, as today) |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:999 (`Pin number`) | ed:281-296 | same |

### kind `sheet` (`BoardObjectsSheet`), `(sheet …)`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` | `PointNm` | nm | optional; schematic page frame | ep:1010 | ed:33, dcn:319 | same |
| `…/o/kiidPaths`, `/*` | `KiidPath[]` | — | required; sorted, unique; schematic form | ep:1011 | ed:41-45, dcn:304 | `[]` for none |
| `…/o/properties` | `BoardObjectsSchematicProperty[]` | — | required; file order | ep:1012 | ed:238-279 | same |

A sheet has no `reviewFields` today (ep:1009-1013), so the variant has none and the rebuild adds none. Sheet `rotation` does not exist today (ep:1010 keeps only the position).

### kind `sheet-pin` (`BoardObjectsSheetPin`), `(pin "<name>" <type> …)` inside a sheet

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/parentUuid` | `KiCadUuid` | — | optional | ep:1022 | ed:149-157 (`sheet-pin-slot`), dcn:310 | same |
| `…/o/name` | string | — | optional | ep:1017, ep:1026 | ed:81 | same |
| `…/o/text` | string | — | optional; equals `name` | ep:1027 | ed:80, dcn:181-182 | same |
| `…/o/at` | `PointNm` | nm | optional | ep:1028 | ed:149-157, ed:33 | same |
| `…/o/rotationDeg` | `Degrees` | ° | optional; present iff `at` | ep:1029 | ed:34, ed:155 | renamed |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1030-1033 | ed:281-296 | same |

### kinds `wire`, `bus` (`BoardObjectsWire`, `BoardObjectsBus`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` | `PointNm` | nm | optional; centroid of `(pts …)` | ep:1045, ep:310-320 | ed:33, dcn:319 | "Centroid rule" reproduces today's value exactly |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1046 (`Stroke`) | ed:281-296 | same |

### kinds `junction`, `no_connect`, `bus_entry`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` | `PointNm` | nm | optional | ep:1075 | ed:33, dcn:319, dcn:183-184 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required (`{}` for a no-connect) | ep:1076-1080 | ed:281-296 | same |

### kind `label` (`BoardObjectsLabel`), `(label …)`, `(global_label …)`, `(hierarchical_label …)`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/text` | string | — | optional | ep:1095 | ed:80, dcn:172 | same |
| `…/o/net` | string | — | optional; equals `text` | ep:1096 | ed:37 (`net-changed`), dcn:257, dcn:269-270 | same; it is label text, not a resolved `NetName` |
| `…/o/at` | `PointNm` | nm | optional | ep:1097 | ed:33, dcn:478-500 (label pairing) | same |
| `…/o/rotationDeg` | `Degrees` | ° | optional; present iff `at` | ep:1098 | ed:34 | renamed |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1099 (`Text`) | ed:281-296 | same |

The label's scope (`global_label` …) is not a field; it is in `contentDigest` (the form head), as today's `@form` is in `hash` (ep:54-58).

### kind `graphic` (`BoardObjectsGraphic`), schematic drawings and board `gr_*`/`dimension`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` | `PointNm` | nm | optional; "Positions per form" | ep:1110-1113, ep:1562-1565 | ed:33, dcn:319 | same, including the quirks in that table |
| `…/o/layer` | `LayerName` | — | optional; board only | ep:1566, ep:1187-1192 | ed:36, dcn:98-111, dcn:156-159 | same |
| `…/o/text` | string | — | optional; `text`, `text_box`, `gr_text` only | ep:1114, ep:1567 | ed:80, dcn:194-195 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1115, ep:1568, ep:364-371 | ed:281-296 | same |

### kinds `image`, `table`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` (image) | `PointNm` | nm | optional | ep:1122 | ed:33 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1123 (`Scale`), ep:1127-1133 | ed:281-296 | same |

### kind `footprint` (`BoardObjectsFootprint`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/libId` | `LibId` | — | optional; absent = empty library link | ep:1390 | ed:39, ed:290, dcn:196 | same |
| `…/o/at` | `PointNm` | nm | optional; board frame | ep:1391 | ed:33, ed:322-332, dcn:357-358 | same |
| `…/o/rotationDeg` | `Degrees` | ° | optional; present iff `at` | ep:1392 | ed:34 | renamed |
| `…/o/layer` | `LayerName` | — | optional (`F.Cu`/`B.Cu`) | ep:1393 | ed:36, dcn:98-111 | same |
| `…/o/footprintPath` | `KiidPath` | — | optional; board form | ep:1396 (`[footprint.path]`) | ed:41-45 (`re-pathed`), dcn:304, dcn:313-317 | today `kiidPaths: [path]`; rebuild wraps it |
| `…/o/refdes` | `Refdes` | — | optional; absent = missing or empty | ep:1383-1385, ep:1397 | ed:38, dcn:256, dcn:268, dco:140-144 | empty → absent |
| `…/o/properties` | `BoardObjectsFootprintProperty[]` | — | required; "Footprint properties" order | ep:1399, ep:1201-1234 | ed:238-279, dcn:209-213 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1400-1407 | ed:281-296 | same |

Today's `sheetfile` (ep:1398) is dropped: no reader.

### kind `pad` (`BoardObjectsPad`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/parentUuid` | `KiCadUuid` | — | optional | ep:1418 | dcn:310, dcn:379-380, dcn:441-443 | same |
| `…/o/number` | `PadNumber` | — | optional; may be `""` | ep:1419 | ed:79, dcn:174-175 | same |
| `…/o/refdes` | `Refdes` | — | optional | ep:1420 | ed:38, dcn:174-175 | same |
| `…/o/at` | `PointNm` | nm | optional; footprint-local | ep:1421 | ed:33, dcn:319 | same |
| `…/o/rotationDeg` | `Degrees` | ° | optional; board-frame angle as written | ep:1422 | ed:34 | renamed |
| `…/o/layer` | `BoardObjectsLayerSpec` | — | optional; first `(layers …)` entry, wildcards kept | ep:1423 | ed:36, dcn:98-111, dcn:390 | same |
| `…/o/net` | `NetName` | — | optional; absent = no net | ep:1424, ep:1167-1179 | ed:37, dcn:257, dcn:403 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1425-1438 | ed:281-296 | same |

### kind `zone` (`BoardObjectsZone`), board and footprint `(zone …)`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/parentUuid` | `KiCadUuid` | — | optional; footprint zones only | ep:1447 | dcn:310 | same |
| `…/o/refdes` | `Refdes` | — | optional; footprint zones only | ep:1448 | dcn:256 | same |
| `…/o/at` | `PointNm` | nm | optional; outline centroid | ep:1449-1451, ep:1548 | ed:33, dcn:319 | same |
| `…/o/layer` | `BoardObjectsLayerSpec` | — | optional | ep:1452-1454, ep:1549 | ed:36, dcn:98-111 | same |
| `…/o/net` | `NetName` | — | optional | ep:1455, ep:1550 | ed:37, dcn:257 | same |
| `…/o/name` | string | — | optional | ep:1456, ep:1551 | ed:81, dcn:185-186 | same |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1457, ep:1552, ep:373-384 | ed:281-296 | same |

### kinds `footprint-graphic`, `footprint-text`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/parentUuid` | `KiCadUuid` | — | optional | ep:1466, ep:1483 | dcn:310 | same |
| `…/o/refdes` | `Refdes` | — | optional | ep:1467, ep:1484 | dcn:178-180, dcn:256 | same |
| `…/o/at` | `PointNm` | nm | optional; footprint-local | ep:1468-1471, ep:1485 | ed:33, dcn:319 | same |
| `…/o/rotationDeg` (text) | `Degrees` | ° | optional; present iff `at` | ep:1486 | ed:34 | renamed |
| `…/o/layer` | `LayerName` | — | optional | ep:1472, ep:1487 | ed:36, dcn:156-159 | same |
| `…/o/text` (text) | string | — | optional | ep:1488 | ed:80, dcn:178-180 | same; footprint graphics never have `text` (ep:1473 reads a field fp drawings do not have) |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1474, ep:1489-1492 | ed:281-296 | same |

### kinds `track`, `arc`, `via`, `group`

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/at` (track, arc) | `PointNm` | nm | optional; centroid of start, [mid,] end | ep:1507 | ed:33, ed:322-332, dcn:319 | same |
| `…/o/at` (via) | `PointNm` | nm | optional | ep:1529 | ed:33 | same |
| `…/o/layer` (track, arc, via) | `LayerName` | — | optional; via: `layers[0]` | ep:1508, ep:1530 | ed:36, dcn:98-111, dcn:390 | same |
| `…/o/layers` (via) | `LayerName[]` | — | required; file order | ep:1517, ep:1531 | ed:130, dcn:98-111, dcn:391 | same |
| `…/o/net` (track, arc, via) | `NetName` | — | optional | ep:1499, ep:1509, ep:1516, ep:1532 | ed:37, dcn:257, dcn:269-270 | same |
| `…/o/name` (group) | string | — | required; may be `""` | ep:1578 | ed:81, dcn:187-188 | new for KiCad 7+ boards (divergence 3) |
| `…/o/reviewFields`, `/{key}` | map | as written | required | ep:1510, ep:1533-1538, ep:1579-1582 | ed:281-296 | same |

### Schematic properties (`BoardObjectsSchematicProperty`, symbols and sheets)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/properties/*/name` | string | — | required | ep:920 (`property.name`) | ed:240-242, dcn:211, dco:150-154 | same |
| `…/o/properties/*/value` | string | — | required; may be `""` | ep:921 (`property.text`) | ed:266-267, dcn:212, dco:150-154 | same |
| `…/o/properties/*/at` | `PointNm` | nm | optional | ep:922 | ed:251, ed:258 | same |
| `…/o/properties/*/rotationDeg` | `Degrees` | ° | optional; present iff `at` | ep:923 | ed:252, ed:259 | renamed from `rotation` |
| `…/o/properties/*/hide` | boolean | — | required | ep:924 (`true` or absent) | ed:253, ed:260 | today absent when false; rebuild omits `false` |
| `…/o/properties/*/effects` | `BoardObjectsTextEffects` | — | optional | ep:925, `kicad-sexpr-parser.mjs:511-550` | ed:254, ed:261, dcn:216-227 | structure renamed and in nm; rebuild restores today's shape |
| `…/effects/font` | `BoardObjectsFont` | — | optional | parser `font` object | ed:254 | same presence |
| `…/effects/font/face` | string | — | optional | `(face …)` | ed:254 | same |
| `…/effects/font/size/heightNm`, `/widthNm` | `NonNegativeNanometres` | nm | required in `size`; first value is height | parser `size.x`, `size.y` (`T.vec2`, `kicad-sexpr-parser.mjs:272-275`) | ed:254 | today `{x, y}` mm |
| `…/effects/font/thicknessNm` | `NonNegativeNanometres` | nm | optional | `(thickness …)` | ed:254 | today mm |
| `…/effects/font/bold`, `/italic` | boolean | — | optional; as written | `P.atom` (`kicad-sexpr-parser.mjs:364-387`) | ed:254 | same |
| `…/effects/font/lineSpacing` | float64 | ratio | optional | `(line_spacing …)` | ed:254 | renamed from `line_spacing` |
| `…/effects/font/color/red`, `/green`, `/blue` | float64 | 0–255 | required in `color` | `T.color` (`kicad-sexpr-parser.mjs:280-288`) | ed:254 | today `r`, `g`, `b` divided by 255 |
| `…/effects/font/color/alpha` | float64 | 0–1 | optional; absent = not written (reader uses 1) | `T.color` `a` | ed:254 | today `a` defaults to 1 |
| `…/effects/justify/horizontal`, `/vertical` | enums | — | required in `justify` | parser `horiz`, `vert` (`kicad-sexpr-parser.mjs:527-546`) | ed:254 | renamed |
| `…/effects/justify/mirror` | boolean | — | required in `justify` | parser `mirror` | ed:254 | same |
| `…/effects/hide` | boolean | — | optional; as written | `P.atom("hide")` | ed:254 | same (KiCad 7 hides fields here) |
| `…/effects/href` | string | — | optional | `(href …)` | ed:254 | same |

### Footprint properties (`BoardObjectsFootprintProperty`)

`properties` of a footprint, in this order (ep:1201-1234): every `(property "<name>" "<value>" …)` of the footprint in file order; when there is none, the entries of the legacy property map (dead in practice: the vendored parser routes every `property` form to the KiCad 8 collection, `kicad-sexpr-parser.mjs:1221-1226`); then, for `Reference` and `Value`, if no entry of that name exists, one from the footprint's first `(fp_text reference|value …)` (case-insensitive type), KiCad 7 boards.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `…/o/properties/*/name` | string | — | required | ep:1204, ep:1226 | ed:240-242, dcn:211 | same |
| `…/o/properties/*/value` | string | — | required | ep:1205 (`value ?? text`), ep:1227 | ed:266-267, dcn:212 | same |
| `…/o/properties/*/at` | `PointNm` | nm | optional; footprint-local | ep:1206, ep:1228 | ed:251 | same |
| `…/o/properties/*/hide` | boolean | — | required | ep:1207, ep:1229 | ed:253 | today absent when false |

A footprint property has no rotation and no effects today; they are not fields.

### Review-only objects (`BoardObjectsReviewOnlyObject`)

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/documents/*/reviewOnlyObjects/*/kind` | `BoardObjectsReviewOnlyKind` | — | required | ep:571-716, ep:845, ep:1057, ep:1586-1591 | dcn:37-61, dcn:130-136 | today = value with `-` → `_` |
| `…/reviewOnlyObjects/*/id` | `BoardObjectsReviewOnlyId` | — | required; unique per document | ep:542 (`push_review_object`), ep:572, ep:590, ep:608 | ed:93-95, dcn:264-282 (`semantic_id`, the comparison comment anchor) | identical value ("Review-only ids") |
| `…/reviewOnlyObjects/*/name` | string | — | required, non-empty | ep:568, ep:583, ep:601, ep:620-718, ep:843, ep:1052 | ed:81, dcn:189-190 | same |
| `…/reviewOnlyObjects/*/reviewFields` | map of `BoardObjectsReviewValue` | — | required; keys code point | ep:533-551 and the per-kind functions | ed:281-309 | same values; today's `hash` (ep:546) is a function of these fields and is not carried |
| `…/reviewOnlyObjects/*/reviewFields/{key}` | `BoardObjectsReviewValue` | as written | — | "Review fields" | ed:298-309 | same |
| `…/reviewFields/{key}/{key}`, `…/reviewFields/{key}/*/{key}` | `BoardObjectsReviewScalar` (a flat settings table) | as written | keys code point | ep:646-649 (`canonical` sorts keys, ep:228) | ed:298-309 | same |

### Rules the fields refer to

#### Units

- **Positions** (`at`, property `at`): nm = round half away from zero of the IEEE double product (value_mm parsed as a double) × 1e6 (conventions §6). For every value KiCad writes (at most 6 decimals), `nm / 1e6` is exactly the double today's index holds, so the rebuild is exact.
- **Centroids**: see "Centroid rule".
- **Font size and thickness**: the same conversion.
- **Angles** (`rotationDeg`): the number as written, or 0 when the `(at …)` form has no angle (the vendored parser's default, `kicad-sexpr-parser.mjs:483-501`).
- **Review values**: unconverted, exactly as today's index writes them (millimetres as written, JSON numbers from `.kicad_pro`).
- Schematic coordinates are parsed from the tokens, not from the fork's `SchematicPoint`, which rounds to 100 nm (fork: `src/rs/kicad-monkey-core/src/schematic_source.rs:25-41`, `SCHEMATIC_IU_PER_MM = 10_000`).

#### Centroid rule

Today's `centroid_of` (ep:310-320) is reproduced bit for bit: take the listed points' coordinates as IEEE doubles in millimetres (parsed from the file); sum the x values left to right starting from 0, divide by the number of points (mean_x, a double); compute `k = mean_x × 1e6` (double); the coordinate is `floor(k)` if `k − floor(k) < 0.5`, else `floor(k) + 1` (round half toward +∞, ECMAScript `Math.round`). The same for y. A point counts only when both its x and y are numbers; with no point, `at` is absent. Then `nm / 1e6` equals today's `round6(mean)` exactly.

#### Positions per form

| Kind | KiCad form | `at` | Frame |
|---|---|---|---|
| `symbol`, `sheet`, `junction`, `no_connect`, `bus_entry`, `label`, `image`, `sheet-pin` | `(at x y …)` | the position | schematic page |
| `pin` | — | the parent symbol's `(at x y …)` | schematic page |
| `wire`, `bus` | `(pts (xy …)…)` | centroid of all points | schematic page |
| `graphic` | `polyline`, `bezier` | centroid of `(pts …)` | schematic page |
| `graphic` | `rectangle` | centroid of `start`, `end` | schematic page |
| `graphic` | schematic `arc` | centroid of `start`, `end` (today's schematic chain reads no `mid`, ep:1110-1113) | schematic page |
| `graphic` | `text`, `text_box` | `(at …)` | schematic page |
| `graphic` | `circle` | absent (today reads `start`/`end`, which a circle lacks) | — |
| `graphic` | `gr_line`, `gr_rect` | centroid of `start`, `end` | board |
| `graphic` | `gr_arc` | centroid of `start`, `mid`, `end` | board |
| `graphic` | `gr_circle` | its `end` point alone (today reads `start`/`mid`/`end`; a circle has `center`, `end`) | board |
| `graphic` | `gr_poly` | centroid of the `(xy …)` entries of `(pts …)`; `(arc …)` entries skipped | board |
| `graphic` | `gr_text` | `(at …)` | board |
| `graphic` | `dimension` | absent (today's `pts` is a nested list it cannot read) | — |
| `footprint`, `via` | `(at …)` | the position | board |
| `pad`, `footprint-text`, footprint `property` | `(at …)` | the position as written | footprint-local |
| `footprint-graphic` | `fp_line`/`fp_rect`, `fp_arc`, `fp_circle`, `fp_poly` | as `gr_line`/`gr_rect`, `gr_arc`, `gr_circle`, `gr_poly` | footprint-local |
| `zone` | `(polygon (pts …))` | centroid of the `(xy …)` entries of every `polygon`; `filled_polygon` excluded | board; footprint-local for a footprint zone from board format 20260616 (fork: `src/rs/kicad-monkey-core/src/pcb/footprints.rs:36-37`) |
| `track` | `segment` | centroid of `start`, `end` | board |
| `arc` | board `arc` | centroid of `start`, `mid`, `end` | board |
| `table`, `group` | — | none | — |

#### contentDigest

`contentDigest` = the first 16 lowercase hex digits of SHA-256 over the UTF-8 bytes of the object's **canonical text**. Two objects with the same key have equal digests exactly when their canonical texts are equal. Readers compare it only with the same key's digest on the other revision, as today's `hash` (ed:400, ed:125).

The canonical text is built from the object's form F (the list whose direct child `(uuid …)`/`(tstamp …)` is the object's id), as follows:

1. **Direct children kept.** Every atom and string directly in F is kept (positional values such as a pad's number, type and shape). A direct child list is kept only when its head is in F's allow-list below, or is a child-object head of F (step 4). Other direct children are dropped: they are tokens today's parser ignores, so a KiCad release that adds a token does not change every digest.
2. **Dropped at any depth:** lists whose head is `uuid`, `tstamp`, `fields_autoplaced`, `filled_polygon` or `render_cache`, and a `(page …)` list directly inside a `(path …)` that is inside `(instances …)` (ep:182-195, ep:283-300).
3. **Nets by name.** In a `pad`, `segment`, board `arc`, `via` or `zone`, the direct child `(net …)` becomes `(net "<name>")`: for a zone its non-empty `(net_name …)`; otherwise the string in `(net <code> "<name>")` or `(net "<name>")`; otherwise the board net table's name for `<code>`. When the name is empty (net 0), the child is dropped. KiCad renumbers net codes on save; today's hash uses the name too (ep:1361-1374).
4. **Child objects by reference.** A direct child that this member lists as its own object becomes `(<head> "<uuid>")`; one whose id is missing or not canonical becomes `(<head>)`. Child-object heads: footprint `pad`, `zone`, `fp_line`, `fp_circle`, `fp_arc`, `fp_poly`, `fp_rect`, `fp_text`; symbol `pin`; sheet `pin`. Today replaces the same children by their uuid (ep:259-274, ep:984, ep:1014, ep:1411).
5. **Serialization.** A list is `(` + its kept elements joined by one space + `)`, in file order. A quoted string is its JSON string literal (escape `"`, `\` and U+0000–U+001F as `\b \f \n \r \t` or lowercase `\u00XX`; everything else raw UTF-8). An unquoted token matching `^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$` is a number, written as its exact decimal value with no exponent, no leading `+`, no leading zeros before other digits, no trailing fractional zeros or trailing `.`, and `0` for any zero (so `1.0`, `1` and `1.000` agree). Every other unquoted token is written as is.

Allow-lists (direct child heads kept), from the vendored parser's grammar for each form (`kicad-sexpr-parser.mjs`; line numbers there):

| Form head | Kept direct child heads | Parser |
|---|---|---|
| `footprint` (`module`) | `version embedded_fonts generator locked placed layer tedit at descr tags sheetname sheetfile path autoplace_cost90 autoplace_cost180 solder_mask_margin solder_paste_margin solder_paste_ratio clearance zone_connect thermal_width thermal_gap attr variant property model` | :1177-1237 |
| `pad` | `locked at size rect_delta layers remove_unused_layers keep_end_layers roundrect_rratio chamfer_ratio chamfer pinfunction pintype die_length solder_mask_margin solder_paste_margin solder_paste_margin_ratio clearance thermal_width thermal_gap thermal_bridge_angle zone_connect drill net options primitives` | :938-1006 |
| `zone` | `locked net net_name name layer layers hatch priority connect_pads min_thickness filled_areas_thickness keepout fill polygon` | :1095-1133 |
| `fp_line`, `gr_line` | `layer locked start end width stroke` | :716-735 |
| `fp_circle`, `gr_circle` | `layer locked center end width fill stroke` | :736-756 |
| `fp_arc`, `gr_arc` | `layer locked start mid end angle width stroke` | :757-782 |
| `fp_poly`, `gr_poly` | `layer locked pts width fill island stroke` | :783-811 |
| `fp_rect`, `gr_rect` | `layer locked start end width fill stroke` | :818-838 |
| `fp_text` | `locked at hide unlocked layer effects` | :849-872 |
| `gr_text` | `at layer unlocked hide locked effects` | :873-894 |
| `dimension` | `locked layer pts height orientation leader_length gr_text format style` | :895-937 |
| `segment` | `start end width layer net locked` | :1238-1251 |
| board `arc` | `start mid end width layer net locked` | :1252-1266 |
| `via` | `at size drill layers remove_unused_layers keep_end_layers locked free net` | :1267-1284 |
| `group` | `locked members` | :1285-1294 |
| `symbol` (placed) | `lib_name lib_id at mirror exclude_from_sim unit convert body_style in_bom on_board in_pos_files dnp property default_instance instances` | :3049-3114 |
| symbol `pin` | `alternate` | :2974-2982 |
| `sheet` | `at size exclude_from_sim in_bom on_board dnp stroke fill property instances` | :3126-3183 |
| sheet `pin` | `at effects` | :3115-3125 |
| `wire`, `bus` | `pts stroke` | :2612-2629 |
| `bus_entry` | `at size stroke` | :2630-2639 |
| `junction` | `at diameter color` | :2658-2667 |
| `no_connect` | `at` | :2668-2675 |
| `label` | `at effects` | :2879-2889 |
| `global_label` | `at effects shape property` | :2914-2926 |
| `hierarchical_label` | `at effects shape` | :2927-2938 |
| `polyline`, `bezier` | `pts stroke fill` | :2676-2686, :2742-2752 |
| `rectangle` | `start end stroke fill` | :2697-2708 |
| `circle` | `center radius stroke fill` | :2709-2720 |
| schematic `arc` | `start mid end radius stroke fill` | :2721-2741 |
| `text` | `at effects exclude_from_sim` | :2753-2764 |
| `text_box` | `at size effects stroke fill exclude_from_sim margins` | :2765-2780 |
| `image` | `at scale data` | :2781-2802 |
| `table` | `column_count border separators column_widths row_heights cells` | :2836-2878 |

Deliberate differences from today's `hash` (the expected divergences 2a–2e): `model` is kept whole (today only the number of models counts); allowed children are kept whole, so a token added inside one (for example `(show_name no)` inside a `property`) changes the digest; token spelling inside kept children counts (`hide` versus `(hide yes)`, `"x"` versus `x`), where today's parser normalizes.

#### Review fields

Keys are the labels, values are what today's functions return; `entry()` (ep:328-336) drops `undefined` and `null` but keeps `false`, `0` and `""`. Values are written in the member as `BoardObjectsReviewValue`; a value outside its shapes (string, number, boolean, array of strings, array of numbers, flat table, array of flat tables) is written as its canonical JSON text (`JSON.stringify(canonical(v))`, ep:222-250). None of the fixtures or the parser test suite has one.

Formatting helpers, normative as cited: `vector_text` (ep:338-345: `"<x> × <y>"`), `list_text` (ep:347-349: truthy entries joined `", "`, absent when empty), `object_text` (ep:351-354: a non-object as is, an object as canonical JSON), `stroke_text` (ep:356-362: `"<width> mm"` and the type joined `", "`, else canonical JSON), `canonical` (ep:222-250: keys sorted, `uuid`/`tstamp`/generated keys dropped, numbers rounded to 6 decimals, `-0` → 0), `humanize_setting` (ep:400-434). Numbers inside texts use ECMAScript Number-to-String; Rust's `{}` for `f64` gives the same text for every magnitude in [1e-6, 1e21), which covers every value KiCad writes. Objects passed to `object_text` have the vendored parser's shape for their form (for example `drill` = `{oval?, diameter?, width?, offset?: {x, y}}`, `kicad-sexpr-parser.mjs:974-982`), with flags `true` for a bare token or `yes`.

| Kind | Labels (source) |
|---|---|
| `symbol` | `Unit` (ep:979) |
| `pin` | `Pin number` (ep:999) |
| `sheet-pin` | `Sheet pin`, `Electrical type` (ep:1030-1033; the shape token) |
| `wire`, `bus` | `Stroke` (ep:1046) |
| `junction`, `no_connect`, `bus_entry` | `Diameter`, `Size`, `Stroke` as the form has them (ep:1076-1080): a junction has `Diameter`, a bus entry `Size` and `Stroke`, a no-connect none |
| `label` | `Text` (ep:1099) |
| `graphic` | `Graphic type` (schematic only: `polyline`, `rectangle`, `arc`, `text`, `bezier`, `text_box`, `circle`), `Text`, `Stroke`, `Fill` (ep:364-371; board `fill` is the token as written, schematic `fill` its JSON) |
| `image` | `Scale` (ep:1123; 1 when not written) |
| `table` | `Columns`, `Rows`, `Table content` (ep:1127-1133) |
| `footprint` | `Description`, `Attributes`, `Exclude from BOM`, `Exclude from position files`, `Board only` (ep:1400-1407; the three flags always present) |
| `pad` | `Pad number`, `Pad type`, `Pad shape`, `Size`, `Drill`, `Layers`, `Clearance`, `Solder mask margin`, `Solder paste margin`, `Thermal width`, `Thermal gap`, `Zone connection` (ep:1425-1438) |
| `zone` | `Zone name`, `Zone layers`, `Priority`, `Hatch`, `Pad connection`, `Minimum thickness`, `Keepout`, `Fill rules` (ep:373-384) |
| `footprint-graphic` | `Stroke`, `Fill` (ep:364-371) |
| `footprint-text` | `Text kind`, `Text` (ep:1489-1492) |
| `track`, `arc` | `Width` (ep:1510) |
| `via` | `Via type` (absent for a through via), `Diameter`, `Drill`, `Layer span` (ep:1533-1538) |
| `group` | `Group` (name), `Members` (number of entries of `(members …)`; today ep:1581) |
| `net-class` | `Clearance`, `Track width`, `Via diameter`, `Via drill`, `Microvia diameter`, `Microvia drill`, `Differential pair width`, `Differential pair gap`, `Differential pair via gap`: the `.kicad_pro` numbers unrounded (ep:386-398) |
| `net-class-assignment` | `Net pattern`, `Net class` (ep:585-588, ep:603-606) |
| `board-constraint`, `drc-severity`, `board-default`, `project-metadata` | `flattened_review_fields` of `rules`, `rule_severities`, `defaults`, `text_variables` (ep:436-454): one label per leaf, nested labels joined `" · "`, `meta` skipped, values canonical |
| `routing-preset` | `Track widths (mm)`, `Via presets (mm)`, `Differential-pair presets (mm)` (ep:456-475) |
| `teardrop-setting` | `Options`, `Parameters` (ep:646-649; canonical JSON values) |
| `zone-setting` | `Allow external fillets`, `Use no outline` (ep:655-658) |
| `drc-exclusion` | `Violation`, `Location`, `Affected objects` (ep:477-493; location from nm ÷ 1e6) |
| `erc-exclusion` | `Violation`, `Location`, `Affected items` (ep:510-526; location from schematic IU ÷ 1e4) |
| `erc-pin-rule` | `Pin type A`, `Pin type B`, `Severity` (ep:690-711, ep:495-531; upper triangle of `pin_map`, null cells skipped) |
| `custom-rule` | one label per clause (`humanize_setting` of the clause head, `" 2"`, `" 3"` … for repeats) with the clause arguments as s-expression text, then `Definition` (ep:811-834) |
| `fabrication-output` | the labels of `fabrication_output_fields` (ep:1247-1284; `Plot layers` decodes the layer mask with the board's layer table, ep:1236-1245) |
| `bus_alias` | `Bus alias`, `Members` (ep:1061-1064) |

A review-only object with no field is not emitted (ep:540), except `net-class`, which is emitted even with no field (ep:567-580).

#### Review-only ids and names

`id` = `<prefix>:<h>`, `prefix` = today's kind with `_` written `-` (the bundle kind, except `bus_alias` → `bus-alias`), `h` = the first 16 hex digits of BLAKE2b-512 over the UTF-8 bytes of the JSON string literal of the identity string (`content_hash`, ep:252-257: `JSON.stringify(canonical(identity))`; Python `json.dumps(identity, ensure_ascii=False)`). All 111 ids of the cynthion fixture were recomputed this way in Python.

| Kind | `name` | Identity string |
|---|---|---|
| `net-class` | class name, trimmed (empty: skipped) | the name |
| `net-class-assignment` | net pattern, trimmed (empty: skipped) | the name |
| `custom-rule` | rule name, trimmed, or `Unnamed custom rule` | the name |
| `bus_alias` | alias name, trimmed (empty: skipped) | the name |
| `board-constraint`, `drc-severity`, `routing-preset`, `board-default`, `teardrop-setting`, `zone-setting`, `project-metadata`, `fabrication-output` | the fixed name in the enum doc | the name |
| `drc-exclusion`, `erc-exclusion` | `<Violation>[ at <Location>]` | `<name>:<affected count>` |
| `erc-pin-rule` | `<type A> ↔ <type B>` | `<row index>:<column index>` |

Two objects with one id (a net pattern in both `netclass_assignments` and `netclass_patterns`; two exclusions with the same label and count): the later one in today's emission order is kept, as today's keyed map does (ed:339-340). That order is: net classes, `netclass_assignments` entries, `netclass_patterns` entries, the singleton kinds in the enum's order, DRC exclusions, ERC exclusions, ERC pin rules (row-major), project metadata (ep:567-718), each in file order.

#### Producer facts in the fork core (fork `b6316117`)

Every fact the member needs is in `src/rs/kicad-monkey-core`:

- **Spans and tokens:** `sexpr_projection::StructuralIndex` and `FormSpan { head, path, depth, range }` give every list form with its byte range (`src/sexpr_projection.rs:140-190`), and `parse_form` (`:263`) gives the `Sexp` tree with quoted strings decoded and integers and floats distinguished (`src/sexpr.rs:170-181`). The digest, the file order and every "as written" value come from these.
- **Board:** footprints with `uuid`, `placement_path`, library link, layer, position and `source_range` (`src/pcb.rs:353-390`); pads (`src/pcb/pads.rs:31-53`: number, layers, net, uuid); vias (`src/pcb/vias.rs:13-37`); zones (`src/pcb/zones.rs:85-119`: net, `net_name`, layers, uuid, name); segments (`src/pcb.rs:433-449`); graphics (`src/pcb.rs:482-513`); routing arcs (`src/pcb.rs:540-551`); dimensions (`src/pcb.rs:607-619`); groups (`src/pcb.rs:623-629`); footprint properties and texts (`src/pcb/footprints.rs:11-59`); net table (`src/pcb.rs:339-350`).
- **Schematic:** placed symbols with `lib_id`, position, angle, mirror, unit, flags, uuid, pins and instances (`src/schematic_source/symbols.rs:15-37`, pins `:356-360`); instances with project, path and reference (`src/schematic_source/symbol_instances.rs:9-17`); sheets (`src/schematic_bundle.rs:33-44`); sheet pins, labels, junctions, no-connects, bus entries, wires and buses (`src/schematic_source.rs:44-106`); bus aliases (`src/schematic_source/bus_aliases.rs:7`); graphics, images and tables (`src/schematic_plotter_ir.rs:414`, `:454`, `:464`).
- **Gaps P2 fills from the spans:** `SchematicSymbolProperty` holds only key and value (`src/schematic_source/symbols.rs:350-353`), so property `at`, `hide` and `effects` are decoded from the property form; `KiCadTextEffects` fills defaults (`src/text_metadata.rs:48-54`, `:58-80`), so "as written" flags are read from the tokens; `SchematicPoint` is 100 nm (see "Units").
- **Not in the fork:** BLAKE2b (review-only ids; the workspace has `sha2` only, `Cargo.toml:43`) and an ECMAScript number formatter (Rust `{}` suffices in KiCad's range, see "Review fields").

## How a golden is produced from today's code

1. **Inputs.** Materialize the revision as Design Comparison does (`project_revision.materialize(…, source_set=COMPARE_INPUTS, scope=<project dir>, strip_scope=True)`, `design_compare_service.py:77-90`), or copy a committed fixture directory (its `.kicad_sch`, `.kicad_pcb`, `.kicad_pro`, `.kicad_dru`) to a scratch directory.
2. **Today's index.** With Node 24.22.0 and the cache off, so nothing is written beside the snapshot:

   ```sh
   ECAD_INDEX_CACHE=0 node --input-type=module -e '
     const m = await import("<repo>/backend/design-compare-parser/ecad-parse.mjs");
     process.stdout.write(JSON.stringify(m.index_snapshot(process.argv[1])));' <snapshot-dir>
   ```

3. **Transform** each entry of `objects`:
   - group by `documentPath` into `documents[]` (one per entry of the index's `documents`, sorted by path); entries with `reviewOnly: true` go to `reviewOnlyObjects` as `{kind, id: uuid, name, reviewFields}`, the rest to `objects`;
   - kinds: `sheet_pin`, `footprint_graphic`, `footprint_text` and every review-only kind except `bus_alias` take `-` for `_`;
   - `at` and property `at` (and font size and thickness) to nm with `int(Decimal(v * 1e6).quantize(Decimal(1), ROUND_HALF_UP))` (conventions §6; a centroid's value is already `k / 1e6`, so this recovers `k`); `rotation` → `rotationDeg`; footprint `kiidPaths[0]` → `footprintPath`; absent `kiidPaths`/`instances` → `[]`; property `hide` absent → `false`; effects renamed as in "Schematic properties";
   - drop `hash`, symbol `unit`, footprint `sheetfile`, `reviewOnly`, `documentPath`; drop an object whose uuid is not canonical, a KIID path that is not valid, and an empty `refdes` or instance `reference`;
   - sort review-field keys in code point order; order `objects` by the byte offset of each object's form and `reviewOnlyObjects` by `id`;
   - `contentDigest` is not produced by today's code: compute it with a reference implementation of "contentDigest" over the raw files (WP-G owns it; the W0 prototype implemented it in Node).
4. **Compare** a member with the golden by JSON value equality (conventions §14) with `contentDigest` excluded, then check `contentDigest` by **equality pattern**: on every revision pair of the suite, for every key present on both sides, `contentDigest` equal ⇔ today's `hash` equal, except where an expected divergence names the case.
5. **P2 acceptance.** For every pair, rebuild today's entries from the two members ("Rebuilding today's index entry", with `hash := contentDigest`), run today's `diff_indexes` (or C2's port) and compare `changes` (by value), `nativeObjects` and `componentObjects` (as sets keyed by `documentPath#uuid`) with today's run on the same pair. `ignored` is compared as a set (its order follows object order and has no consumer).

### Rebuilding today's index entry (C2, and P2's acceptance harness)

For an object `o` of document `d`:

- `uuid` = `o.uuid`; `kind` = `o.kind` with `-` → `_`; `documentPath` = `d.path`; `hash` = `o.contentDigest`;
- `at` = `[o.at.xNm / 1e6, o.at.yNm / 1e6]`; `rotation` = `o.rotationDeg`;
- footprint: `kiidPaths` = `[o.footprintPath]` when present; symbol and sheet: `kiidPaths` and `instances` omitted when empty;
- properties: `rotation` from `rotationDeg`, `at` to mm, `hide: true` only when true; effects: `font.size` = `{x: heightNm / 1e6, y: widthNm / 1e6}`, `font.thickness` = `thicknessNm / 1e6`, `font.line_spacing` = `lineSpacing`, `font.color` = `{r: red / 255, g: green / 255, b: blue / 255, a: alpha ?? 1}`, `justify` = `{horiz, vert, mirror}`;
- every other field copied under its own name.

For a review-only object: `{uuid: id, kind (with - → _), name, documentPath, reviewFields, reviewOnly: true, hash}` with `hash` any injective function of `reviewFields` (for example its canonical JSON); today's `hash` is `content_hash(reviewFields)` (ep:546).

Readers that format `Position` (ed:284) from `at` must format the millimetre numbers as ECMAScript does (`25`, not `25.0`).

### Prototype evidence (W0)

The W0 prototype ran today's `index_snapshot` on every committed fixture, mapped it into this contract with the digest above, validated every output, rebuilt today's entries and reran today's `diff_indexes`:

- 21 fixture snapshots and the 58 documents the parser test suite indexes (`ecad-parse.test.mjs`, `ecad-diff.test.mjs`, captured from a scratch copy) validate against `BoardObjectsA0`.
- Every listed object rebuilds to today's entry exactly (after divergences 1, 4, 5, 6), and `nativeObjects` and `componentObjects` match on every fixture.
- On 15 revision pairs (`mini_obc` F0→F1…F11.2 and F11.1→F11.2, `mini_power` F0→F10, `design_variants` `oracle`→`oracle_rev2`, `release-studio/usb-pd` → the user's current USB-PD-Trigger-Board), `changes`, `counts`, `byKind`, `byReason` and `ignored` (as a set) are identical with today's `hash` carried, and identical with `hash := contentDigest` on 14 of 15. The exception is one sheet of the USB-PD pair whose properties gained `(show_name no) (do_not_autoplace no)` in a newer KiCad 10 save (divergence 2b).
- Equality pattern of `contentDigest` versus `hash` on the 29 same-document pairs of the parser test suite: 144 objects, 0 disagreements.
- A second, independent implementation of "contentDigest" in Python, written from this field map alone, reproduced all 21,032 digests of nine fixture outputs (cynthion, usb-pd, synthetic, `mini_obc` F0 and F4, `mini_power` F10, `mini_payload` F0, `design_variants/oracle`, the user's USB-PD-Trigger-Board).
- A full-s-expression digest (no allow-lists) also matched on every suite pair but flagged 54 footprints of the USB-PD pair as changed (the newer KiCad writes `(units …)` and `(duplicate_pad_numbers_are_jumpers no)`); the allow-list flags 1 object. See the W0 open question on the digest scope.

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| 1. A coordinate with sub-nanometre digits (hand-written files only, e.g. `backend/tests/fixtures/design_variants/oracle/antenna.kicad_sch:39`, `23.810000000000002`) | the parsed double | rounded to the nm | conventions §6: lengths are integer nm; KiCad itself writes at most 6 decimals | DC position texts; a pair differing only below 1 nm reads unchanged |
| 2a. A footprint's `(model …)` changes (path, offset, rotation, scale) | not seen (models count only, ep:1411) | the footprint is `content-changed` | a 3D-model swap is an authored change | DC footprint rows |
| 2b. A newer KiCad adds a default-valued token inside a kept child (e.g. `(show_name no)` in a sheet `property`) | not seen when the parser ignores it | `content-changed` | the digest keeps allowed children whole (allow-lists are top-level) | DC rows after a KiCad minor upgrade |
| 2c. Token spelling changes inside kept children (`hide` → `(hide yes)`, an atom becomes quoted) or token order inside them | normalized | `content-changed` | spelling is part of the canonical text; KiCad changes it only across format versions. Every revision is upgraded to the worker KiCad's format before parse (bundle-format §2.2), so two revisions saved by different KiCad versions compare in one spelling and this does not occur between them | DC rows across a KiCad format upgrade |
| 2d. A child object form without a valid uuid | its content is not seen | its content is not seen; its presence counts (`(<head>)`) | same as today | none |
| 2e. Numeric spelling (`1.0` vs `1`, `-0`) | equal after rounding to 6 decimals | equal (exact decimal) | values with more than 6 decimals differ in the bundle only | none in practice |
| 3. Board groups in KiCad 7+ files (`(group "…" (uuid …))`) | never listed: the parser reads `(id …)` (`kicad-sexpr-parser.mjs:1285-1294`) | listed, `Members` = member count | the group is an addressable, authored object DC already knows (dcn:187) | DC: new `group` rows |
| 4. An object whose id is not a canonical uuid (legacy 8-hex `tstamp`; hand-written test ids such as `aaaa-0201` in `ecad-parse.test.mjs`) | listed | not listed; stage `parse` warning `board-objects-invalid-uuid` | conventions §8: ids are copied, never invented. Legacy `tstamp` files are upgraded before parse, so only hand-written test ids reach this case | DC rows for such objects; the parser test suite (9 objects) |
| 5. A KIID path that is not valid (`/aaaa-0001` in the parser test suite: 81 paths) | kept | dropped (`instances/*/path` absent; not in `kiidPaths`; no `footprintPath`); stage warning `board-objects-invalid-kiid-path` | `KiidPath` pattern; conventions §8 | `re-pathed` on such inputs; the test suite |
| 6. Empty `refdes` or instance `reference` | `""` | absent | `Refdes` is non-empty | a rename from `""` shows `from` absent |
| 7. Two forms with one uuid in one document | the later in collection order wins (ed:339-340) | the later in file order wins; stage warning `board-objects-duplicate-uuid` | file order is the member's order | none on fixtures |
| 8. Review-field key order changes with equal values (`.kicad_pro` rewritten with keys reordered) | `content-changed` (`same_index_fields`, ed:188-192, compares JSON text) | unchanged | keys are serialized in code point order (conventions §9) | DC rule rows |
| 9. A review value of another shape (nested deeper than a flat table) | the value | its canonical JSON text | the union is closed; none occurs in fixtures | DC field texts |
| 10. A document the parser rejects | listed with `error`, no objects | not listed; stage warning `board-objects-unreadable-document` | the manifest is where build findings go | none: both make its objects absent |
| 11. Documents outside today's snapshot: the bundle's source set (revision-key spec) versus `COMPARE_INPUTS` under the project directory (`project_revision.py:264-284`) | every `.kicad_*` under the project directory | every such file of the project's closure, the bundle's `sources/` (bundle-format §2.2): files attributed to the project through its configuration and references, never by directory | the closure is exactly what the project reads; a sibling project in the same directory is not this project (issue #681) | DC rows for files only one of the two sets holds |
| 12. `ignored` order | head object order | file order | not consumed | none |
| 13. Paths and object ids are repository-relative (maintainer decision, conventions §8; issue #681) | `documentPath` relative to the snapshot, which `design_compare_service.py:77-88` flattens to the project directory; ObjectRef `<project-relative path>#<uuid>` | `path` is a `RepoPath`; ObjectRef `<RepoPath>#<uuid>` | one spelling per file whichever project refers to it; unique across projects that share a directory or sit in subdirectories, which today's ids are not | DC object ids change once, by decision, for every project not at the repository root; stored comparisons are not migrated and no compatibility is kept |

## Example provenance

`examples/BoardObjectsA0.example.json` is the W0 prototype's output (today's index mapped as above, `contentDigest` from the reference digest) on these committed fixtures, trimmed. For each fixture the repository root is taken to be the fixture project's own directory, as if it were its own repository, so every `path` (repository-relative) equals today's project-relative `documentPath`:

- `fixtures/release-studio/cynthion` (KiCad 7 board, format 20221018, with `tstamp` ids): documents `aux_port.kicad_sch` (one object of each schematic kind it has: sheet, sheet pin, the mirrored symbol `D25` with one pin, wire, bus, junction, bus entry, label, text graphic), `bank0_1.kicad_sch` (a no-connect), `cynthion.kicad_sch` (one bus alias), `cynthion.kicad_pcb` (footprint `J10`, its first pad, footprint graphic, footprint text and footprint zone; one board zone, `gr_text`, track, arc track, via; the fabrication-output object), `cynthion.kicad_pro` (one object of each settings kind it has), `cynthion.kicad_dru` (one custom rule).
- `fixtures/release-studio/usb-pd`: the `image` of `USB-PD-Trigger-Board.kicad_sch`.
- `backend/design-compare-parser/ecad-parse.test.mjs` (the test `PROJECT` text, documentPath `board.kicad_pro`): the `erc-exclusion`.

Trimmed: the other objects of those documents; symbol `D25` keeps `Reference` and its first hidden field; footprint `J10` keeps its first property and the `Reference` fallback; the sheet keeps `Sheetname`; `board-constraint`, `board-default`, `drc-severity`, `net-class` and `fabrication-output` keep 2–4 labels; `routing-preset` lists keep 2 entries; `teardrop-setting` keeps one `Parameters` table. Kinds and fields no committed fixture has are absent: `group` and `table` objects, a non-empty `refdes` on a pad's net-less sibling, font `face`, `bold`, `italic`, `thicknessNm`, `lineSpacing`, `color` and `href`, and a `justify` with `mirror: true`. The file is longer than the ~300-line target because it holds one object of each of 35 kinds.
