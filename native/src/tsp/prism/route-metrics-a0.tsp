import "@typespec/json-schema";
import "./common.tsp";

using TypeSpec.JsonSchema;
using Prism.Contracts.Common;

/**
 * Bundle member `projections/route-metrics.json` (`prism.route_metrics.a0`),
 * written in stage `parse`: per-net routing metrics of the project's board.
 * Field-by-field sources, the normative length algorithm and the parity rules
 * are in `field-maps/route-metrics.md`.
 */
namespace Prism.Contracts.RouteMetricsA0;

/**
 * Per-net routing metrics of the project's board: routed centerline length,
 * via count, copper layers used and via layer pairs. Computed from the
 * top-level tracks (`segment` and `arc` forms) and vias (`via` forms) of the
 * project's board, exactly the effective configuration's `board`
 * (`config.board` in the manifest; never chosen by directory), as
 * committed: never the refilled board. Pads, zones,
 * zone fills and graphic shapes contribute nothing, even when they carry a
 * net. Design Comparison reads it for the route rows of a rerouted net
 * (route length, via count, used layers, via barrel length).
 */
@jsonSchema
@id("urn:prism:schema:prism.route_metrics:a0")
@extension("title", "Route metrics a0")
model RouteMetricsA0 {
  /** Schema id of this document. */
  schema: "prism.route_metrics.a0";

  /**
   * One entry per net that has at least one track or via on the board,
   * sorted by `netName` in code point order; `netName` is unique. A net
   * with no track and no via is absent. Tracks and vias with no net (net 0,
   * a net code missing from the board's net table, an empty net name, or no
   * `(net …)` form at all) belong to no entry and are not reported. Empty
   * when no net is routed or the project has no board.
   */
  nets: RouteMetricsNet[];
}

/** Routing metrics of one net on the board. */
model RouteMetricsNet {
  /**
   * KiCad full net name of the net's tracks and vias as the board resolves
   * it: the name in the item's `(net "<name>")` form (KiCad 10), or the name
   * the board's net table gives the item's `(net <code>)` (KiCad 9 and
   * earlier). Copied exactly: not trimmed, not re-cased.
   */
  netName: NetName;

  /**
   * Routed centerline length of the net in nanometres: the sum, over the
   * net's tracks, of each `segment`'s straight start-to-end distance and
   * each `arc`'s circular arc length through its start, mid and end points
   * (the polyline start-mid-end when the three points are collinear). Summed
   * in file order in IEEE double millimetres, then converted once with the
   * conventions' rule (value_mm * 1e6, rounded half away from zero). The
   * arc's `hypot` and `atan2` are the pure-Rust `libm` crate's, so the total
   * is the same on every architecture (conventions.md §14). One
   * total over all layers; track widths, via barrels, pads and zones are not
   * included. 0 when the net has vias but no track.
   */
  routeLengthNm: NonNegativeNanometres;

  /**
   * Number of vias on the net, of every type (through, blind, buried,
   * micro). Includes vias whose `(layers …)` form does not name exactly two
   * layers, which `viaSpans` leaves out.
   */
  viaCount: Count;

  /**
   * Layers the net's copper is routed on, each once, sorted in code point
   * order: the layer of every track (its `(layer …)`, or the copper entries
   * of its `(layers …)` form when KiCad writes the plural form for a track
   * with a solder-mask opening), plus, for every via, every copper layer it
   * spans: for a `(layers …)` form naming exactly two layers, both of them
   * and every copper layer between them in the board's copper order (the
   * same order as `prism.stackup.a0` `copperLayers`: the stackup's copper
   * entries when the board has a stackup, else the layer table's `.Cu` rows
   * in file order), so a through via adds every copper layer; otherwise the
   * layers its form names. Empty only when every track and via of the net
   * lacks a layer.
   */
  usedLayers: LayerName[];

  /**
   * The net's vias grouped by layer pair, sorted by `startLayer`, then
   * `stopLayer`, both in code point order; each pair appears once. Only vias
   * whose `(layers …)` form names exactly two layers are counted here, so
   * `viaCount` minus the sum of `viaSpans[*].viaCount` is the number of the
   * net's vias that have no usable layer pair. Empty when the net has no
   * such via.
   */
  viaSpans: RouteMetricsViaSpan[];
}

/**
 * The vias of one net that share one layer pair, as their `(layers …)` form
 * names it. The layers between the pair follow from the board's stackup.
 */
model RouteMetricsViaSpan {
  /**
   * First layer of the via's `(layers …)` form, as written. KiCad writes the
   * layer nearer the front first, so for a through via this is `F.Cu`.
   */
  startLayer: LayerName;

  /**
   * Second layer of the via's `(layers …)` form, as written: for a through
   * via `B.Cu`, for a blind or micro via the inner layer it ends on.
   */
  stopLayer: LayerName;

  /** Number of the net's vias with exactly this layer pair, in this order. */
  viaCount: RouteMetricsSpanCount;
}

/** A via count within one via span: at least 1, because a span is listed only when one of the net's vias has that layer pair. */
@minValue(1)
scalar RouteMetricsSpanCount extends Count;
