# Divergences: route-metrics

- Member: `projections/route-metrics.json`, schema `prism.route_metrics.a0` (root `RouteMetricsA0`)
- Producer: WP-P2 (`native/src/rs/prism-projections/src/route_metrics.rs`)
- Field map: [`field-maps/route-metrics.md`](../../contracts/prism/field-maps/route-metrics.md), "Expected divergences"
- Golden: `capture/route_metrics.py`: today's `index_snapshot(...).routeMetrics` (`ECAD_INDEX_CACHE=0`) through the field map's step-3 transform, verbatim. The golden is today's truth; it does not include D7.
- Check `dc` (step 5): today's `_route_metrics_from_digest` against the C2 rebuild from the golden, same `_extract_stackup`: equal on all 32 goldens (no D3, no D4 case).

Measured on the 33 committed fixtures (32 goldens; `dv-malformed` has none: its schematic is malformed, stage parse fails). Nets: 735 in total; boards with vias: `rs-cynthion` (651 vias, 6 copper layers) and `rs-usb-pd` (21 vias, 2 copper layers).

## D7. Vias add every copper layer they span

- Case: a via whose two end layers have copper layers between them (through vias on a board with more than two copper layers; buried/blind vias spanning more than two).
- Today: only the via's two named layers enter `usedLayers` (`ecad-parse.mjs:1517`, `:1520-1522`).
- Bundle: both and every copper layer between them in `copperLayers` order (R6, maintainer decision Route metrics 2).
- Why: the net's copper is on every layer the barrel crosses.
- Consumer: DC "Used layers" row.
- Fixtures: changes only `rs-cynthion`: 150 of its 336 nets (exactly the nets with vias) gain 585 layer entries in total. Every other golden is unchanged (two-copper-layer boards, or no vias).
- Runner: rule `route-metrics/via-spans-used-layers` (`divergences.py`), cases `["*"]` (a no-op where it changes nothing, so corpus boards get it too). The rule reads the case's stackup golden `copperLayers`. Its body agrees with R6: for each span (a via form with exactly two layers) both layers in the copper order add the inclusive range, otherwise the two layers as written; vias with another number of layers already contribute every entry as written in today's `usedLayers`.
- Sanity check: the W0 prototype producer (`rm_lib.prototype_from_board`, extended with R6 using the board's copper order, stackup copper entries else layer-table `.Cu` rows) equals the ruled golden on every fixture board; on cynthion 336 nets, 0 mismatches (and 150 mismatches against the unruled golden, the D7 nets).

## D1, D2, D3, D4, D5, D6

- D1 (several boards in the snapshot): no fixture project directory holds more than one `.kicad_pcb`. The capture keeps only the anchor-named board when it does (note `D1: …` in capture.json).
- D2 (plural `(layers …)` tracks): none on the fixtures (the producer-vs-golden check above would show it).
- D3 (4th-decimal display rounding): 3 of 735 nets have `routeLengthNm ≡ 50 (mod 100)`, but on none of them does the DC value differ; `dc` check equal everywhere.
- D4 (padded net names), D5 (tracks without endpoints), D6 (half-nm ties): none on the fixtures.

Runner: nothing for these.
