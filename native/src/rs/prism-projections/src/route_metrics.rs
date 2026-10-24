//! `projections/route-metrics.json` (`prism.route_metrics.a0`), WP-P2's
//! producer. A faithful Rust port of the golden transform
//! `native/parity/prism_parity/capture/route_metrics.py:golden` over the
//! field map `contracts/prism/field-maps/route-metrics.md` rules R1-R7.
//!
//! The facts are today's per-net "route digest" of Design Comparison's Node
//! parser: `index_board` builds it (`backend/design-compare-parser/ecad-parse.mjs:1294-1347`,
//! `:1498-1525`). The contract root is
//! [`RouteMetricsA0`](prism_kicad_contracts::generated::prism_route_metrics_a0::RouteMetricsA0).
//!
//! The inputs are the fork's single board parse (`BoardModel.view`): its
//! top-level `segment`, `arc` and `via` forms only (field map:31). The copper
//! order R6 needs is the produced `prism.stackup.a0` `copperLayers`, read
//! through [`crate::stackup::copper_layers`] from the board's layer and
//! stackup forms rather than by building the whole stackup member, the whole
//! board tree, or restating its rule. Tracks and vias come from the shared
//! `PcbView` decode memo, so the per-net totals keep only what the member
//! needs.
//!
//! A project without a board gets the empty form (bundle-format.md §2.1):
//! `{"schema": …, "nets": []}`. Rules are grouped into [`accumulate`] (R1,
//! R3-R6) and [`length`] (R2); this module converts the totals to the contract
//! (R7: `BTreeMap`/`BTreeSet`, code point order).

mod accumulate;
mod length;

use crate::{Produced, ProjectionError, ProjectionInput, document};
use accumulate::NetMetric;
use prism_kicad_contracts::generated::prism_route_metrics_a0::{
    Count, LayerName, NetName, NonNegativeNanometres, RouteMetricsA0, RouteMetricsNet,
    RouteMetricsSpanCount, RouteMetricsViaSpan,
};
use serde_json::json;
use std::collections::BTreeMap;
use std::num::NonZeroU64;

/// The member's schema id.
pub const SCHEMA: &str = "prism.route_metrics.a0";
const NAME: &str = "projections/route-metrics.json";

/// Build `projections/route-metrics.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<RouteMetricsA0>, ProjectionError> {
    let Some(board) = input.board else {
        return document(NAME, json!({"schema": SCHEMA, "nets": []}));
    };
    // R6's copper order is the stackup member's own rule; do not restate it.
    let copper = crate::stackup::copper_layers(board)?;
    let nets = accumulate::accumulate(board.view, &copper)?;
    Ok(Produced::new(build_document(nets)?))
}

/// R7 (`field-map:54`): the contract document from the per-net totals. A
/// `BTreeMap`/`BTreeSet` already puts nets, layers and spans in code point
/// order.
fn build_document(nets: BTreeMap<String, NetMetric>) -> Result<RouteMetricsA0, ProjectionError> {
    let mut out = Vec::with_capacity(nets.len());
    for (name, metric) in nets {
        out.push(net_entry(name, metric)?);
    }
    Ok(RouteMetricsA0 {
        schema: SCHEMA.to_owned(),
        nets: out,
    })
}

/// One `/nets/*` entry (`ecad-parse.mjs:1299-1302`; R4 for the length).
fn net_entry(name: String, metric: NetMetric) -> Result<RouteMetricsNet, ProjectionError> {
    let NetMetric {
        total_mm,
        via_count,
        used_layers,
        via_spans,
    } = metric;
    let mut used = Vec::with_capacity(used_layers.len());
    for layer in used_layers {
        used.push(layer_name(layer)?);
    }
    let mut spans = Vec::with_capacity(via_spans.len());
    for ((start, stop), count) in via_spans {
        if let Some(count) = NonZeroU64::new(count) {
            spans.push(RouteMetricsViaSpan {
                start_layer: layer_name(start)?,
                stop_layer: layer_name(stop)?,
                via_count: RouteMetricsSpanCount(count),
            });
        }
    }
    Ok(RouteMetricsNet {
        net_name: net_name(name)?,
        route_length_nm: NonNegativeNanometres(nanometres(total_mm)),
        via_count: Count(via_count),
        used_layers: used,
        via_spans: spans,
    })
}

/// R4 (conventions.md §6): `round_half_away_from_zero(value_mm × 1e6)`; Rust's
/// `f64::round` is half away from zero.
fn nanometres(total_mm: f64) -> u64 {
    (total_mm * 1e6).round() as u64
}

/// A non-empty net name (R1 guarantees it); the contract's `NetName`.
fn net_name(name: String) -> Result<NetName, ProjectionError> {
    NetName::try_from(name).map_err(|_| ProjectionError::new(format!("{NAME}: empty net name")))
}

/// A non-empty layer name (R5-R6 keep only non-empty names).
fn layer_name(name: String) -> Result<LayerName, ProjectionError> {
    LayerName::try_from(name).map_err(|_| ProjectionError::new(format!("{NAME}: empty layer name")))
}

#[cfg(test)]
mod tests {
    use super::*;
    use prism_kicad_core::{PcbLimits, PcbView};
    use serde_json::{Value, json};

    /// Parse `body` as a `(kicad_pcb …)`, accumulate with `copper` and build
    /// the document, as [`produce`] does once it has the stackup's copper order.
    fn build_document_for(body: &str, copper: &[&str]) -> Value {
        let text = format!("(kicad_pcb {body})");
        let view = PcbView::parse(&text, PcbLimits::default()).expect("the board parses");
        let copper: Vec<String> = copper.iter().map(|name| (*name).to_owned()).collect();
        let nets = accumulate::accumulate(&view, &copper).expect("the board accumulates");
        serde_json::to_value(build_document(nets).expect("the document builds"))
            .expect("the document serializes")
    }

    /// The `/nets/*/usedLayers` of the single net entry.
    fn used_layers(document: &Value) -> Value {
        document["nets"][0]["usedLayers"].clone()
    }

    #[test]
    fn a_project_without_a_board_gets_the_empty_form() {
        crate::test_support::with_bare_project(|input| {
            let produced = produce(input).expect("the empty form builds");
            let value = serde_json::to_value(&produced.document).expect("serializes");
            assert_eq!(value, json!({"schema": SCHEMA, "nets": []}));
        });
    }

    #[test]
    fn a_plural_layer_track_adds_its_copper_entry() {
        // R5: no `(layer …)`, so the copper entry of `(layers "F.Cu" "F.Mask")`
        // is added; the mask entry is not.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (segment (start 0 0) (end 1 0) (width 0.2)
                (layers "F.Cu" "F.Mask") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["F.Cu"]));
        assert_eq!(document["nets"][0]["routeLengthNm"], 1_000_000);
    }

    #[test]
    fn a_singular_layer_track_ignores_its_plural_form() {
        // R5: a `(layer …)` wins; the plural is not consulted.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (segment (start 0 0) (end 1 0) (width 0.2)
                (layer "B.Cu") (layers "F.Cu" "F.Mask") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["B.Cu"]));
    }

    #[test]
    fn a_blind_via_adds_every_copper_layer_it_spans() {
        // R6: `(layers "F.Cu" "In1.Cu")`, both in the copper order, so both and
        // every copper layer between them (none) are added; the span is kept.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "In1.Cu" signal) (4 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (via blind (at 0 0) (size 0.4) (drill 0.2) (layers "F.Cu" "In1.Cu") (net 1))
            "#,
            &["F.Cu", "In1.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["F.Cu", "In1.Cu"]));
        assert_eq!(document["nets"][0]["viaCount"], 1);
        assert_eq!(
            document["nets"][0]["viaSpans"],
            json!([{"startLayer": "F.Cu", "stopLayer": "In1.Cu", "viaCount": 1}])
        );
    }

    #[test]
    fn a_through_via_adds_the_layers_between_its_pair() {
        // R6: `F.Cu` to `B.Cu` spans `In1.Cu` too, in copper order.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "In1.Cu" signal) (4 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (via (at 0 0) (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu") (net 1))
            "#,
            &["F.Cu", "In1.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["B.Cu", "F.Cu", "In1.Cu"]));
    }

    #[test]
    fn a_via_without_exactly_two_layers_has_no_span() {
        // R6: three named layers add every one, but there is no span
        // (`viaCount` 1, `viaSpans` empty).
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "In1.Cu" signal) (4 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (via (at 0 0) (size 0.4) (drill 0.2)
                (layers "F.Cu" "In1.Cu" "B.Cu") (net 1))
            "#,
            &["F.Cu", "In1.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["B.Cu", "F.Cu", "In1.Cu"]));
        assert_eq!(document["nets"][0]["viaCount"], 1);
        assert_eq!(document["nets"][0]["viaSpans"], json!([]));
    }

    #[test]
    fn a_two_layer_via_off_the_copper_order_keeps_its_names() {
        // R6: `In5.Cu` is not in the board's copper order, so both names are
        // added as written, but the span is still kept.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (via (at 0 0) (size 0.4) (drill 0.2) (layers "In5.Cu" "B.Cu") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(used_layers(&document), json!(["B.Cu", "In5.Cu"]));
        assert_eq!(
            document["nets"][0]["viaSpans"],
            json!([{"startLayer": "In5.Cu", "stopLayer": "B.Cu", "viaCount": 1}])
        );
    }

    #[test]
    fn a_no_net_track_and_via_are_skipped_completely() {
        // R1: net 0 adds no length, no via and no layer, so there is no entry.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu") (net 0))
            (via (at 0 0) (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu") (net 0))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(document["nets"], json!([]));
    }

    #[test]
    fn a_missing_net_form_resolves_to_net_zero_and_is_skipped() {
        // R1: no `(net …)` form defaults to ordinal 0, no name, so it is
        // no-net copper.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu"))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(document["nets"], json!([]));
    }

    #[test]
    fn a_net_with_two_layer_names_merges_in_code_point_order() {
        // R7: nets are a `BTreeMap` (code point order), layers and spans a
        // sorted set/map. `A` < `a` in code point order.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "a")
            (net 2 "A")
            (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu") (net 1))
            (segment (start 0 0) (end 1 0) (width 0.2) (layer "B.Cu") (net 2))
            (via (at 0 0) (size 0.4) (drill 0.2) (layers "B.Cu" "F.Cu") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        let names: Vec<&str> = document["nets"]
            .as_array()
            .expect("nets")
            .iter()
            .map(|net| net["netName"].as_str().expect("netName"))
            .collect();
        assert_eq!(names, vec!["A", "a"]);
        // The via on net `a` has its pair in the order written.
        assert_eq!(
            document["nets"][1]["viaSpans"],
            json!([{"startLayer": "B.Cu", "stopLayer": "F.Cu", "viaCount": 1}])
        );
    }

    #[test]
    fn the_d3_example_rounds_the_half_nanometre_away_from_zero() {
        // Field map D3 (`field-map:124`): the segment (0, 0) -> (1.000049,
        // 0.001001) mm has length ~1000049.50 nm, which rounds to 1000050. The
        // naive 4th-decimal float round would print 1.0 mm; the integer member
        // keeps the half nanometre.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (segment (start 0 0) (end 1.000049 0.001001) (width 0.2) (layer "F.Cu") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        assert_eq!(document["nets"][0]["routeLengthNm"], 1_000_050);
    }

    #[test]
    fn segments_and_arcs_sum_per_net_in_file_order() {
        // R3: a segment then an arc on one net accumulate together. The arc is
        // a half unit circle: 1 mm (segment) + pi mm.
        let document = build_document_for(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (net 0 "")
            (net 1 "N")
            (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu") (net 1))
            (arc (start 1 0) (mid 0 1) (end -1 0) (width 0.2) (layer "F.Cu") (net 1))
            "#,
            &["F.Cu", "B.Cu"],
        );
        let expected = ((1.0 + std::f64::consts::PI) * 1e6).round() as u64;
        assert_eq!(document["nets"][0]["routeLengthNm"], expected);
        assert_eq!(used_layers(&document), json!(["F.Cu"]));
    }
}
