# Field map: `projections/route-metrics.json` (`prism.route_metrics.a0`)

Root model `RouteMetricsA0` in `tsp/prism/route-metrics-a0.tsp`. Example `examples/RouteMetricsA0.example.json`.
Written by: P2, `native/src/rs/prism-projections/src/route_metrics.rs`. Stage: parse.

Today the same facts are the per-net `routeMetrics` "route digest" of Design Comparison's Node parser. `index_board` builds it (`backend/design-compare-parser/ecad-parse.mjs:1294-1347`, `:1498-1525`), and `index_snapshot` merges it across the documents of a snapshot (`:1680`, `:1728-1743`, `:1768`). `ecad-diff.mjs:499` and `:507` hand it to Python as `object_delta["base"|"head"]["routeMetrics"]`. There, `_route_metrics_from_digest` (`backend/app/services/design_compare_nodes.py:518-573`, called from `design_compare_service.py:1137-1146`) finishes it into the `pcb.route_metrics` the browser shows (`frontend/src/components/design-comparison/comparison-property-model.ts:279-353`).

## Fields

Pointers are RFC 6901 with two extensions: `*` is every element of an array,
`{key}` is every key of a map. One row per leaf and per array/map.

| Field (JSON pointer) | Type | Unit | Order / nullability | Today's source (path:line) | Consumers (path:line) | Parity note |
|---|---|---|---|---|---|---|
| `/schema` | const `"prism.route_metrics.a0"` | — | required | new (today's digest has no envelope; `ecad-diff.mjs:496-508`) | `backend/app/services/design_bundle/` reader (K) switches on it; C2 | — |
| `/nets` | `RouteMetricsNet[]` | — | required, may be empty; sorted by `netName` in code point order; `netName` unique | the `routeMetrics` object, keyed by net name in first-seen order (`ecad-parse.mjs:1294-1304`, merged at `:1728-1743`) | C2 replaces `design_compare_nodes.py:547` (`for net, raw in digest["routeMetrics"].items()`); the browser looks a net up by name (`comparison-property-model.ts:334-335`) | today an object in insertion order, the bundle a sorted array: the golden sorts (code point, Python `sorted`). Today's `""` key (no-net copper, R1) has no entry; DC drops it already (`design_compare_nodes.py:548-550`) |
| `/nets/*/netName` | `NetName` | — | required, non-empty, unique | the digest key: `net_name_of` (`ecad-parse.mjs:1167-1179`) gives a track's or via's own `(net "<name>")` or the net-table name of its `(net <code>)` (`:1293`, `:1499`, `:1516`) | key of DC's `route_metrics.base/compare` (`design_compare_nodes.py:548`, `:565`); `metrics.base[oldNet]` / `metrics.compare[newNet]` (`comparison-property-model.ts:334-335`), where the name comes from the board object's `net` (`:305-331`) | same string. Today DC `.strip()`s the key (`design_compare_nodes.py:548`); the bundle keeps it exact (divergence D4) |
| `/nets/*/routeLengthNm` | `NonNegativeNanometres` | nm | required; 0 for a net with vias only | `routeLengthMm`, a float mm sum (`ecad-parse.mjs:1299`, `:1501`, `segment_length` `:1313-1347`; merged `:1735`) | `centerline_length_mm` = `round(routeLengthMm, 4)` (`design_compare_nodes.py:566`) → `RouteMetrics.centerline_length_mm` (`frontend/src/components/design-comparison/types.ts:225`) → "Route length" row shown as `` `${raw} mm` `` (`comparison-property-model.ts:286-291`, `:344`) | golden = `round_half_away(routeLengthMm × 1e6)` (conventions §6). Equal to the Rust value on every fixture net (R2–R4). C2 shows `round(routeLengthNm / 1e6, 4)`, which can differ from today in the 4th decimal (D3) |
| `/nets/*/viaCount` | `Count` | count | required | `viaCount` (`ecad-parse.mjs:1300`, `:1519`; merged `:1736`) | `via_count` (`design_compare_nodes.py:559`, `:567`) → "Via count" row (`comparison-property-model.ts:292`); also gates the barrel diagnostic (`design_compare_nodes.py:561`) | identical |
| `/nets/*/usedLayers` | `LayerName[]` | — | required, may be empty; sorted in code point order; each layer once | `usedLayers`: a track's `(layer …)` (`ecad-parse.mjs:1502`) and every via layer (`:1517`, `:1520-1522`), de-duplicated (`add_layer` `:1306-1311`), then sorted by JS `sort()` at `:1737-1739` | `used_layers` = `sorted(...)` (`design_compare_nodes.py:568`) → "Used layers" row (`comparison-property-model.ts:293`) | identical: layer names are ASCII, so JS `sort()` and code point order agree. One divergence for plural-layer tracks (D2) |
| `/nets/*/usedLayers/*` | `LayerName` | — | canonical name as written on the item | `layer_name_of` (`ecad-parse.mjs:1187-1192`) of `segment.layer` and `via.layers` (`backend/design-compare-parser/vendor/kicad-sexpr-parser.mjs:1238-1283`) | as above | identical |
| `/nets/*/viaSpans` | `RouteMetricsViaSpan[]` | — | required, may be empty; sorted by `startLayer`, then `stopLayer`, code point order; each pair once | `viaSpans`: an object `{"<l1>\|<l2>…": count}` keyed by the via's layers joined with `\|` (`ecad-parse.mjs:1523-1524`; merged `:1740-1742`) | `span_length` and barrel sum (`design_compare_nodes.py:531-558`) → `via_barrel_length_mm` (`:569`) → "Via barrel" row (`comparison-property-model.ts:294-299`) | golden splits each key on `\|` and keeps the keys with exactly two parts. A via whose `(layers …)` form does not name exactly two layers has no span, so it is counted only in `viaCount`. That keeps DC's "unreliable barrel" outcome (see "Design Comparison's derived values") |
| `/nets/*/viaSpans/*/startLayer` | `LayerName` | — | first layer as written | first part of the `viaSpans` key, i.e. `via.layers[0]` (`ecad-parse.mjs:1517`, `:1523`) | `span_length` endpoints (`design_compare_nodes.py:532-535`) | identical; not normalized (a hand-written `"B.Cu" "F.Cu"` stays `B.Cu`→`F.Cu`, as today) |
| `/nets/*/viaSpans/*/stopLayer` | `LayerName` | — | second layer as written | second part of the key, `via.layers[1]` | as above | identical |
| `/nets/*/viaSpans/*/viaCount` | `RouteMetricsSpanCount` (integer ≥ 1) | count | required | the key's count (`ecad-parse.mjs:1524`, `:1741`) | `barrel += length * int(count)` (`design_compare_nodes.py:558`) | identical |

No field is nullable or optional.

### Computation rules (normative for P2)

The inputs are the project's board parsed by the imported core: `PcbView::parse` (fork: `src/rs/kicad-monkey-core/src/pcb.rs:772`), and only its top-level `segment`, `arc` and `via` forms (`PcbView::segments`, `vias`, `arcs`, fork `pcb.rs:928`, `:940`, `:971`). Tracks are never nested: KiCad's tuning patterns (`generated`) and groups refer to top-level tracks by uuid. Pads, zones, zone fills, copper graphics with a net, footprints and the refilled board play no part, today (`ecad-parse.mjs:1498-1525` reads only `board.segments` and `board.vias`) and here.

- **R1, net.** An item's net is `PcbNetRef.name` after `NetResolver::resolve` (fork `pcb.rs:674-700`): the item's own non-empty `(net "<name>")`, which KiCad 10 writes, or else the board net table's name for its `(net <code>)`, which KiCad 9 and earlier write. An item whose result is absent or empty is **no-net copper**. That covers net 0 (`(net 0 "")`), a code missing from the table, an empty name and a missing `(net …)`. Such an item is skipped completely: it adds no length, no via and no layer.
  - Today these items go to the `""` key (`route_metric(net \|\| "")`, `ecad-parse.mjs:1296-1304`), which DC discards (`design_compare_nodes.py:548-550`).
  - The fork defaults a missing `(net …)` to ordinal 0 (`pcb/scalars.rs:511-523`).
- **R2, track length.** Lengths are computed in IEEE-754 binary64 **millimetres** from the parsed coordinates: the correctly rounded double of the file's decimal, which is the fork's `PcbSegment`/`PcbRoutingArc` fields (`pcb.rs:433-449`, `:540-552`) and today's parser tokens alike.
  - `segment`: `hypot(end.x − start.x, end.y − start.y)` (`ecad-parse.mjs:1313-1319`).
  - `arc` with start a, mid b and end c, in absolute board coordinates, operation for operation as `ecad-parse.mjs:1320-1346`:
    - `det = 2·(a.x·(b.y−c.y) + b.x·(c.y−a.y) + c.x·(a.y−b.y))`. If `|det| < 1e-12`, the length is `hypot(b−a) + hypot(c−b)`.
    - Otherwise compute `aa = a.x²+a.y²`, `bb`, `cc` the same way, then `ux = (aa·(b.y−c.y) + bb·(c.y−a.y) + cc·(a.y−b.y)) / det` and `uy = (aa·(c.x−b.x) + bb·(a.x−c.x) + cc·(b.x−a.x)) / det`.
    - `r = hypot(a.x−ux, a.y−uy)` and `θ(p) = atan2(p.y−uy, p.x−ux)`.
    - `ccw = ((θ(c)−θ(a)) % τ + τ) % τ` and `m = ((θ(b)−θ(a)) % τ + τ) % τ`, where `τ = 2π` and `%` is the truncating remainder: JS `%`, Rust `%` on `f64` and C `fmod`, never Python's `%`.
    - `sweep = ccw` if `m ≤ ccw + 1e-9`, else `τ − ccw`. The length is `r · sweep`.
  - The rule mirrors today's formula, absolute coordinates included, because the goldens are computed with it. On cynthion the better-conditioned form, relative to `a`, differs from it by up to 1.6e-4 nm per arc. That is below the 1 nm output resolution, but often enough near a rounding tie to break golden equality.
- **R3, summation.** Per net, the track lengths are added into a binary64 accumulator that starts at `0.0`, in file order. Segments and arcs are interleaved by source offset (fork `source_range.start`). Today's parser collects both forms into one `segments` list in file order (`kicad-sexpr-parser.mjs:1347-1348`, `:325-334`).
- **R4, conversion.** `routeLengthNm = round_half_away_from_zero(total_mm × 1e6)`, which is Rust `(total * 1e6).round() as i64` (conventions §6).
- **R5, track layers.** A track's layers are its `(layer …)`. When it has none, they are the entries of its plural `(layers …)` form that are copper layers, that is whose canonical name ends in `.Cu`. KiCad writes the plural form for a track with a solder-mask opening, `(layers "F.Cu" "F.Mask")` (fork `pcb.rs:440-441`, `:546-547`). These layers are added to `usedLayers`.
- **R6, vias.** Each via with a net (R1):
  - adds 1 to `viaCount`;
  - adds to `usedLayers` every copper layer it spans (maintainer decision): when its `(layers …)` form (fork `pcb/vias.rs:18`) names exactly two layers that are both in the board's copper order, both and every copper layer between them in that order; otherwise every entry of the form, as written. The copper order is `prism.stackup.a0` `copperLayers`' rule, computed from the same parse: the stackup's copper entries if present, else the layer table's `.Cu` rows in file order;
  - adds 1 to the span `(layers[0], layers[1])` when the form names exactly two layers.

  The via type (`blind`, `micro`, through) does not matter (`ecad-parse.mjs:1515-1525`).
- **R7, output.** There is one entry per net that R2–R6 touched, which is exactly the nets with at least one track or via. In Rust, nets are a `BTreeMap<String, _>` (code point order), `usedLayers` a `BTreeSet<String>` and spans a `BTreeMap<(String, String), u32>`. Serialization follows conventions §13.

**Agreement with today, measured.** The scratch Rust prototype on fork `b6316117` implements R1–R7. On every committed fixture board it equals the golden: 13 boards, 758 nets (see "Example provenance").
- A binary64 total differs from today's V8 total only through `hypot`/`atan2` ulps. CPython against V8 on the same fixtures: at most 7.1e-9 nm per net, and 707 of 756 totals are bit-identical.
- The smallest distance of any fixture total from a half-nanometre tie is 8.6e-4 nm. R4 therefore gives the same integer with overwhelming probability.
- Byte identity across CPU architectures: `hypot` and `atan2` are the pure-Rust `libm` crate's (conventions §14, maintainer decision), so the producer gives the same bits on every architecture.

### Design Comparison's derived values (C2)

C2 rebuilds today's `pcb.route_metrics[side][netName]` from one member and its `stackup`, with `_route_metrics_from_digest` (`design_compare_nodes.py:518-573`) changed only in how it reads its input:

- `centerline_length_mm = round(routeLengthNm / 1e6, 4)`.
- `via_count = viaCount`, and `used_layers = usedLayers`, already sorted.
- **Reliable barrel.** The barrel is reliable when `sum(viaSpans[*].viaCount) == viaCount` and both layers of every span are in the stackup with numeric thicknesses. In that case `via_barrel_length_mm = round(Σ span_length(startLayer, stopLayer) × viaCount, 4)`. `span_length` sums the stackup layers from the lower to the higher index of the pair, inclusive (`:531-544`).
- **Unreliable barrel.** Otherwise `via_barrel_length_mm` is `None`. When `viaCount > 0`, the "Via barrel length is unavailable…" diagnostic is added (`:560-564`).

This reproduces today's reliability outcome:
- today, a via without exactly two layers yields a span key that `span_length` rejects (`:532-534`);
- here, it is missing from `viaSpans`, so the sum falls short of `viaCount`.

On every fixture, plus a scratch edge board with blind, micro, reversed and one-layer vias, this function equals today's DC output field for field (scratch `compare.py`, `edge_dc.py`). Those runs feed it today's stackup (`_extract_stackup`), so they test this member alone.

**The barrel also needs the stackup member.** With the bundle, the thicknesses come from `prism.stackup.a0` `layers[*].thicknessNm / 1e6`, indexed by `layers[*].name`. That stackup lists each dielectric sub-layer as its own entry and leaves zero thicknesses absent. Today's regex takes the first `(thickness <n>)` of each `(layer …)` form and none at all when the thickness is `locked` (`design_compare_artifacts.py:52-62`). `via_barrel_length_mm` can therefore change on boards with sub-layered, locked or zero-thickness dielectrics. That divergence belongs to the stackup member and C2, not to this member.

## How a golden is produced from today's code

1. **Snapshot.** For a corpus revision, materialize the project exactly as DC does: `project_revision.materialize(repo, commit, dest, source_set=project_revision.COMPARE_INPUTS, scope=<project dir>, strip_scope=True)` (`backend/app/services/design_compare_service.py:77-89`, `backend/app/services/project_revision.py:264-284`). For a committed fixture, copy its project directory's `.kicad_pcb`, `.kicad_pro`, `.kicad_sch` and `.kicad_dru` files into an empty directory **outside the repository**: `index_snapshot` writes a cache file beside the snapshot directory. If the snapshot then holds more than one `.kicad_pcb`, delete all but the project's own board, or record the case under D1.
2. **Digest.** With Node 24.22.0 and `ECAD_INDEX_CACHE=0`:

   ```js
   const { index_snapshot } = await import("<repo>/backend/design-compare-parser/ecad-parse.mjs");
   const digest = index_snapshot(snapshotDir).routeMetrics;  // what ecad-diff.mjs:499/507 passes to DC
   ```

3. **Transform** to this contract (Python):

   ```python
   def golden(route_metrics):
       nets = []
       for name, raw in route_metrics.items():
           if name == "":                       # no-net copper: not reported (R1)
               continue
           spans = {}
           for key, count in raw["viaSpans"].items():
               parts = key.split("|") if key else []
               if len(parts) == 2:              # other vias: in viaCount only (R6)
                   spans[tuple(parts)] = spans.get(tuple(parts), 0) + count
           nets.append({
               "netName": name,
               "routeLengthNm": int(Decimal(raw["routeLengthMm"] * 1e6)
                                    .quantize(Decimal(1), rounding=ROUND_HALF_UP)),
               "viaCount": raw["viaCount"],
               "usedLayers": sorted(set(raw["usedLayers"])),
               "viaSpans": [{"startLayer": a, "stopLayer": b, "viaCount": c}
                            for (a, b), c in sorted(spans.items())],
           })
       nets.sort(key=lambda n: n["netName"])        # code point order
       return {"schema": "prism.route_metrics.a0", "nets": nets}
   ```

   Never use Python's `round()` for the nanometres (conventions §6). The `""` key and the span keys without exactly two parts are the only things the transform drops, and neither ever reaches DC's output.
4. **Compare** by JSON value (conventions §14). There are no non-semantic fields.
5. **DC-level check (C2).** Run `design_compare_nodes._route_metrics_from_digest(digest, _extract_stackup(snapshot))` (`design_compare_artifacts.py:25`) against the C2 function above on the golden with the same stackup. They must be equal except for the cases in D3.

## Expected divergences

| Case | Today | Bundle | Why the bundle is right | Consumer affected |
|---|---|---|---|---|
| D1. The project directory holds more than one `.kicad_pcb`: a second project, a panel, or an old copy outside the skipped directories | `index_snapshot` parses every `.kicad_pcb` under the snapshot (`ecad-parse.mjs:197-219`) and adds same-named nets together (`:1728-1743`) | only the project's own board | A bundle is one project (ADR §11 G5). DC's own stackup and Gerber passes already pick one board, and say why (`design_compare_artifacts.py:26-29`). | DC route rows of the shared net names |
| D2. A track written with the plural `(layers "F.Cu" "F.Mask")` form (KiCad 9+ track with a solder-mask opening) and no `(layer …)` | the vendored parser reads only `(layer …)` (`kicad-sexpr-parser.mjs:1238-1265`), so the track's length counts but its layer is not added (`ecad-parse.mjs:1502`, `:1306-1311`) | the copper entry (`F.Cu`) is added to `usedLayers` (R5) | The copper is on that layer; today's omission is a parser gap. Shown on a scratch board: today `usedLayers: []`, prototypes `["B.Cu"]`. | DC "Used layers" row |
| D3. `routeLengthNm` is ≡ 50 (mod 100), and the exact length is on the other side of the 4-decimal tie than the binary value of `routeLengthNm/1e6` | `round(routeLengthMm, 4)` on the float (`design_compare_nodes.py:566`) | `round(routeLengthNm / 1e6, 4)`. Example: a segment (0, 0)→(1.000049, 0.001001) mm, exact length 1000049.50 nm. Today shows `1.0`, the bundle `1.0001`. | Lengths are integer nm (conventions §6). The difference is 0.1 µm of display rounding, below any engineering meaning. Expected on about 0.5 % of nets; 0 of 758 fixture nets. | DC "Route length" row, 4th decimal |
| D7. A via that crosses inner copper layers (a through via on a board with more than two copper layers, or a buried or blind via spanning more than two layers) | only the via's two named layers enter `usedLayers` (`ecad-parse.mjs:1517`, `:1520-1522`) | every copper layer the via spans (R6) | the net's copper is on every layer the barrel crosses (maintainer decision) | DC "Used layers" row on every multilayer board with vias. In the example, 3 of its 5 cynthion nets gain inner layers |
| D4. A net name with leading or trailing white space | DC `.strip()`s the key (`design_compare_nodes.py:548`): two names can merge, and the browser's exact-name lookup (`comparison-property-model.ts:334-335`) misses | the name exactly as KiCad resolves it | `NetName` is copied, never trimmed (conventions §8). The board objects carry the same exact name. | DC route rows of such nets |
| D5. A track without `start`/`end` (or an arc without `mid`) | contributes 0 to the length (`ecad-parse.mjs:1313-1314`, `:1323-1325`) | the fork's decoder rejects the board (`pcb/decode.rs:385-386`, `:517-519`), so stage `parse` fails with a diagnostic | KiCad's own parser rejects such a file too, so it is not a KiCad board | DC gets no bundle for that revision (manifest error) |
| D6. A tie at a half nanometre | binary64 total from V8's `Math.hypot`/`atan2` | binary64 total from the pure-Rust `libm` crate (conventions §14) | Both are within ~1e-8 nm of the exact length. When they straddle `x.5`, the side nearer the exact value is right. Not seen on the fixtures; the smallest margin was 8.6e-4 nm. | none in practice; the parity runner reports the net and its exact margin |

Not divergences:
- net order (sorted here; an unordered object today);
- usedLayers order (both code point);
- vias whose `(layers …)` form does not name exactly two layers (dropped from `viaSpans` here, rejected by DC today, with the same DC output);
- reversed via pairs (kept as written by both);
- no-net copper (dropped by both before DC's output).

## Example provenance

- **Fixture:** `fixtures/release-studio/cynthion/cynthion.kicad_pcb`, KiCad format 20221018, with 3484 segments, 138 track arcs, 651 vias and 336 routed nets.
- **Command:** the golden steps above, run on a scratch copy of the fixture directory (`ECAD_INDEX_CACHE=0`).
- **Check:** the result equals the scratch Rust prototype's output on fork `b6316117` for all 336 nets.
- **Trimmed to 5 of the 336 nets,** one per shape, with values unchanged and sort order kept:
  - `/AUX Port/AUX PHY/CLK`: tracks on one layer, no via;
  - `/FPGA Banks 6 and 7/RAM.CK`: includes track arcs;
  - `/Power Distribution and Monitoring/~{POWER_GOOD}`: inner layers `In2.Cu` and `In3.Cu`, vias;
  - `GND`: 210 through vias;
  - `Net-(D1-A)`: vias only, `routeLengthNm` 0.
- **Not shown:** the fixture has no blind or micro via, no via with an incomplete layer pair, and no plural-layer track. Those cases were checked on a scratch edge board only.
