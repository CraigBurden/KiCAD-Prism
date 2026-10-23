//! Route metrics (`/routeMetrics`): each revision's routed nets, from the
//! route-metrics member and the stackup member's layer thicknesses
//! (`field-maps/route-metrics.md` "Design Comparison's derived values (C2)",
//! ported from `backend/app/services/design_compare_bundle_inputs.py`
//! `route_metrics`).

use std::collections::BTreeMap;

use super::Revision;
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use prism_kicad_contracts::generated::prism_route_metrics_a0::{RouteMetricsA0, RouteMetricsNet};
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;

pub(super) fn build(base: &Revision, head: &Revision) -> dc::DesignCompareRouteMetrics {
    dc::DesignCompareRouteMetrics {
        base: dc::RecordDesignCompareRouteMetric(metrics(&base.route_metrics, &base.stackup)),
        head: dc::RecordDesignCompareRouteMetric(metrics(&head.route_metrics, &head.stackup)),
    }
}

/// Every routed net of one revision, keyed by net name (the member already
/// holds the nets in code point order).
fn metrics(
    route_metrics: &RouteMetricsA0,
    stackup: &StackupA0,
) -> BTreeMap<String, dc::DesignCompareRouteMetric> {
    let layers = Thicknesses::new(stackup);
    route_metrics
        .nets
        .iter()
        .filter_map(|net| routed(net, &layers))
        .collect()
}

/// One net, or nothing for the empty name the member never has (today's
/// adapter skips `netName == ""`).
fn routed(
    net: &RouteMetricsNet,
    layers: &Thicknesses,
) -> Option<(String, dc::DesignCompareRouteMetric)> {
    let name = text(&net.net_name);
    if name.is_empty() {
        return None;
    }
    Some((name, metric(net, layers)))
}

/// One `/routeMetrics/{net}` entry. The member holds `routeLengthNm`, but the
/// C2 rule is `round(routeLengthNm / 1e6, 4)` in millimetres, so the value is
/// re-derived through that rounding. The barrel is absent when unreliable
/// (`route-metrics.md` "Reliable barrel").
fn metric(net: &RouteMetricsNet, layers: &Thicknesses) -> dc::DesignCompareRouteMetric {
    let via_count = net.via_count.0;
    let mut barrel = 0.0;
    let mut span_vias = 0_u64;
    let mut reliable = true;
    for span in &net.via_spans {
        let count = span.via_count.0.get();
        span_vias += count;
        match layers.span(&text(&span.start_layer), &text(&span.stop_layer)) {
            Some(length) => barrel += length * count as f64,
            None => reliable = false,
        }
    }
    let reliable = reliable && span_vias == via_count;
    let mut used: Vec<String> = net.used_layers.iter().map(text).collect();
    used.sort();
    dc::DesignCompareRouteMetric {
        route_length_nm: dc::NonNegativeNanometres(round4_to_nm(
            net.route_length_nm.0 as f64 / 1e6,
        )),
        via_count: dc::Count(via_count),
        used_layers: used.into_iter().map(layer_name).collect(),
        via_barrel_length_nm: reliable.then(|| dc::NonNegativeNanometres(round4_to_nm(barrel))),
    }
}

/// The stackup member's thicknesses, indexed by layer name
/// (`route_metrics`' `index_by_name`; a repeated name keeps the last entry).
struct Thicknesses {
    index: BTreeMap<String, usize>,
    millimetres: Vec<Option<f64>>,
}

impl Thicknesses {
    fn new(stackup: &StackupA0) -> Self {
        let mut index = BTreeMap::new();
        let mut millimetres = Vec::with_capacity(stackup.layers.len());
        for (position, layer) in stackup.layers.iter().enumerate() {
            index.insert(text(&layer.name), position);
            millimetres.push(
                layer
                    .thickness_nm
                    .as_ref()
                    .map(|thickness| thickness.0.get() as f64 / 1e6),
            );
        }
        Self { index, millimetres }
    }

    /// `span_length` (`design_compare_nodes.py:531-544`): the sum of the
    /// thicknesses from the lower to the higher index of the pair, inclusive;
    /// `None` when a layer is missing or has no thickness.
    fn span(&self, start: &str, stop: &str) -> Option<f64> {
        let start = *self.index.get(start)?;
        let stop = *self.index.get(stop)?;
        let (lower, upper) = if start <= stop {
            (start, stop)
        } else {
            (stop, start)
        };
        let mut total = 0.0;
        for thickness in &self.millimetres[lower..=upper] {
            total += (*thickness)?;
        }
        Some(total)
    }
}

/// `nm(round(mm, 4))`: Python's `round` (the exact binary value, ties to even;
/// conventions.md §6) then the half-away-from-zero conversion to nanometres.
/// The reference's `centerline_length_mm` and `via_barrel_length_mm` are this
/// (`design-compare.md` `/routeMetrics`).
fn round4_to_nm(millimetres: f64) -> u64 {
    let rounded: f64 = format!("{millimetres:.4}").parse().unwrap_or(millimetres);
    (rounded * 1e6).round() as u64
}

/// A member layer name (never empty) as the tab's `LayerName`.
fn layer_name(name: String) -> dc::LayerName {
    dc::LayerName::try_from(name).expect("a member layer name is non-empty")
}

/// A member string field as the plain string the tab carries.
fn text<T: Clone>(value: &T) -> String
where
    String: From<T>,
{
    String::from(value.clone())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn stackup(layers: serde_json::Value) -> StackupA0 {
        serde_json::from_value(json!({
            "schema": "prism.stackup.a0",
            "present": true,
            "boardThicknessNm": 1_600_000,
            "layers": layers,
            "copperLayers": ["F.Cu", "B.Cu"],
            "settings": {
                "copperFinish": "None",
                "dielectricConstraints": false,
                "edgeConnector": "none",
                "castellatedPads": false,
                "edgePlating": false,
            },
            "maskColors": {},
            "viaSpans": [],
            "boardLayers": [],
        }))
        .expect("a stackup member")
    }

    fn routes(nets: serde_json::Value) -> RouteMetricsA0 {
        serde_json::from_value(json!({
            "schema": "prism.route_metrics.a0",
            "nets": nets,
        }))
        .expect("a route-metrics member")
    }

    fn copper(thickness_nm: u64) -> serde_json::Value {
        json!({"name": "F.Cu", "sublayer": 0, "kind": "copper", "type": "copper",
               "thicknessNm": thickness_nm})
    }

    fn metric_of(stackup: &StackupA0, net: serde_json::Value) -> dc::DesignCompareRouteMetric {
        let routes = routes(json!([net]));
        metrics(&routes, stackup)
            .into_values()
            .next()
            .expect("one net")
    }

    /// A reliable barrel sums the stackup layers from the lower to the higher
    /// index of the pair, inclusive, times the span count
    /// (`route-metrics.md` "Reliable barrel").
    #[test]
    fn a_two_layer_span_is_measured() {
        let stackup = stackup(json!([
            copper(35_000),
            {"name": "dielectric 1", "sublayer": 0, "kind": "dielectric",
             "type": "core", "thicknessNm": 550_000},
            {"name": "B.Cu", "sublayer": 0, "kind": "copper", "type": "copper",
             "thicknessNm": 35_000},
        ]));
        let metric = metric_of(
            &stackup,
            json!({"netName": "GND", "routeLengthNm": 0, "viaCount": 1,
                   "usedLayers": ["B.Cu", "F.Cu"],
                   "viaSpans": [{"startLayer": "F.Cu", "stopLayer": "B.Cu", "viaCount": 1}]}),
        );
        // 35_000 + 550_000 + 35_000 nm = 0.62 mm.
        assert_eq!(
            metric.via_barrel_length_nm.map(|value| value.0),
            Some(620_000)
        );
    }

    /// A span the stackup cannot measure leaves the barrel absent
    /// (`route-metrics.md` C2 "Unreliable barrel": the sum falls short of
    /// `viaCount`).
    #[test]
    fn an_unmeasurable_via_leaves_the_barrel_absent() {
        let stackup = stackup(json!([copper(35_000)]));
        let metric = metric_of(
            &stackup,
            json!({"netName": "GND", "routeLengthNm": 1000, "viaCount": 1,
                   "usedLayers": ["F.Cu"], "viaSpans": []}),
        );
        assert_eq!(metric.via_barrel_length_nm.map(|value| value.0), None);
    }

    /// `routeLengthNm` is `round(mm, 4)` back in nanometres
    /// (`route-metrics.md` D3: the 4th decimal is where the two forms differ).
    #[test]
    fn route_length_is_rounded_to_four_decimals() {
        let stackup = stackup(json!([copper(35_000)]));
        // 13.794350 mm: the exact binary value is just below the tie.
        let metric = metric_of(
            &stackup,
            json!({"netName": "GND", "routeLengthNm": 13_794_350, "viaCount": 0,
                   "usedLayers": [], "viaSpans": []}),
        );
        assert_eq!(metric.route_length_nm.0, 13_794_300);
    }

    #[test]
    fn rounding_matches_python_round_to_four_decimals() {
        // The field map's route-metrics D3 example: 1000049.50 nm rounds to
        // 1.0001 mm, its 4-decimal form.
        assert_eq!(round4_to_nm(1.00005), 1_000_100);
        assert_eq!(round4_to_nm(13.794_35), 13_794_300);
        assert_eq!(round4_to_nm(0.0), 0);
    }
}
