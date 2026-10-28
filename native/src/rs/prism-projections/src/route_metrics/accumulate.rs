//! R1 and R3-R6 (`contracts/prism/field-maps/route-metrics.md:33-51`): one pass
//! over the board's top-level `segment`, `arc` and `via` forms, into one
//! running metric per resolved net.
//!
//! Segments and arcs are summed per net in file order, interleaved by
//! `source_range.start` (R3, `ecad-parse.mjs:1498-1504`); vias contribute the
//! count, the spanned copper layers and the `(layers[0], layers[1])` span (R6,
//! `ecad-parse.mjs:1515-1525`). The fork resolves every item's net reference
//! through the board's net table (`NetResolver::resolve`, field map R1), so an
//! absent or empty name here is no-net copper and the item is skipped.

use super::length;
use crate::ProjectionError;
use prism_kicad_core::{Error as CoreError, PcbNetRef, PcbRoutingArc, PcbSegment, PcbVia, PcbView};
use std::collections::{BTreeMap, BTreeSet};

/// One net's running totals before conversion to the contract
/// (`ecad-parse.mjs:1296-1304`'s `route_metric` record).
#[derive(Debug, Default, PartialEq)]
pub(super) struct NetMetric {
    /// R2-R4: the IEEE-754 binary64 millimetre total, accumulated in file
    /// order.
    pub(super) total_mm: f64,
    /// R6: every via with a net, of every type.
    pub(super) via_count: u64,
    /// R5-R6: the copper layers, each once, code point order.
    pub(super) used_layers: BTreeSet<String>,
    /// R6: vias by `(layers[0], layers[1])`, sorted by the pair.
    pub(super) via_spans: BTreeMap<(String, String), u64>,
}

/// R1-R6 for one board view: the net metric of every net with at least one
/// track or via, keyed by net name in code point order.
///
/// `copper` is `prism.stackup.a0` `copperLayers` for the same board (field map
/// R6), used to expand a two-layer via to every copper layer it spans.
pub(super) fn accumulate(
    view: &PcbView<'_>,
    copper: &[String],
) -> Result<BTreeMap<String, NetMetric>, ProjectionError> {
    let mut nets = BTreeMap::new();
    merge_tracks(&mut nets, view)?;
    for via in view.decoded_vias() {
        let via = via.as_ref().map_err(|error| board_error(error.clone()))?;
        add_via(&mut nets, via, copper);
    }
    Ok(nets)
}

/// R3 (`field-map:45`): merge the segment and arc families in file order by
/// `source_range.start`. Each family is already in source order, so a
/// two-pointer walk interleaves them without collecting either.
fn merge_tracks(
    nets: &mut BTreeMap<String, NetMetric>,
    view: &PcbView<'_>,
) -> Result<(), ProjectionError> {
    let mut segments = view.decoded_segments().iter();
    let mut arcs = view.decoded_arcs().iter();
    let mut segment = next_record(&mut segments)?;
    let mut arc = next_record(&mut arcs)?;
    while segment.is_some() || arc.is_some() {
        let take_segment = match (&segment, &arc) {
            (Some(segment), Some(arc)) => segment.source_range.start <= arc.source_range.start,
            (Some(_), None) => true,
            _ => false,
        };
        if take_segment {
            if let Some(item) = segment.take() {
                add_segment(nets, item);
            }
            segment = next_record(&mut segments)?;
        } else {
            if let Some(item) = arc.take() {
                add_arc(nets, item);
            }
            arc = next_record(&mut arcs)?;
        }
    }
    Ok(())
}

/// Pull the next successfully decoded record, surfacing the first error.
fn next_record<'a, T>(
    iter: &mut std::slice::Iter<'a, Result<T, CoreError>>,
) -> Result<Option<&'a T>, ProjectionError> {
    match iter.next() {
        Some(Ok(value)) => Ok(Some(value)),
        Some(Err(error)) => Err(board_error(error.clone())),
        None => Ok(None),
    }
}

/// R2, R5 for one `segment` form (`ecad-parse.mjs:1498-1504`).
fn add_segment(nets: &mut BTreeMap<String, NetMetric>, segment: &PcbSegment) {
    let Some(name) = net_name(&segment.net) else {
        return;
    };
    let metric = nets.entry(name).or_default();
    metric.total_mm += length::segment(segment);
    add_track_layers(
        &mut metric.used_layers,
        segment.layer.as_deref(),
        segment.layers.as_deref(),
    );
}

/// R2, R5 for one `arc` form (`ecad-parse.mjs:1498-1504`).
fn add_arc(nets: &mut BTreeMap<String, NetMetric>, arc: &PcbRoutingArc) {
    let Some(name) = net_name(&arc.net) else {
        return;
    };
    let metric = nets.entry(name).or_default();
    metric.total_mm += length::arc(arc.start, arc.mid, arc.end);
    add_track_layers(
        &mut metric.used_layers,
        arc.layer.as_deref(),
        arc.layers.as_deref(),
    );
}

/// R5 (`field-map:47`): a track's `(layer …)`, or, when it has none, the
/// copper entries of its plural `(layers …)` form. An empty singular layer is
/// treated as absent, as today's `layer_name_of` does (`ecad-parse.mjs:1187-1192`).
fn add_track_layers(layers: &mut BTreeSet<String>, layer: Option<&str>, plural: Option<&[String]>) {
    if let Some(layer) = layer.filter(|name| !name.is_empty()) {
        layers.insert(layer.to_owned());
        return;
    }
    for entry in plural.unwrap_or_default() {
        if entry.ends_with(".Cu") {
            layers.insert(entry.clone());
        }
    }
}

/// R6 (`field-map:48-51`): one via with a net.
fn add_via(nets: &mut BTreeMap<String, NetMetric>, via: &PcbVia, copper: &[String]) {
    let Some(name) = net_name(&via.net) else {
        return;
    };
    // Today's `layer_name_of` drops an empty entry (`ecad-parse.mjs:1187-1192`),
    // and the `viaSpans` key is built from the remaining names (`:1516-1523`).
    let layers: Vec<&str> = via
        .layers
        .iter()
        .map(String::as_str)
        .filter(|name| !name.is_empty())
        .collect();
    let metric = nets.entry(name).or_default();
    metric.via_count += 1;
    match layers.as_slice() {
        [start, stop] => {
            let (start, stop) = (*start, *stop);
            add_span_layers(&mut metric.used_layers, start, stop, copper);
            *metric
                .via_spans
                .entry((start.to_owned(), stop.to_owned()))
                .or_insert(0) += 1;
        }
        _ => metric
            .used_layers
            .extend(layers.iter().map(|layer| (*layer).to_owned())),
    }
}

/// R6 (`field-map:48-51`): when both names are in the copper order, add both
/// and every copper layer between them; otherwise add both as written.
fn add_span_layers(layers: &mut BTreeSet<String>, start: &str, stop: &str, copper: &[String]) {
    let span = copper
        .iter()
        .position(|layer| layer.as_str() == start)
        .zip(copper.iter().position(|layer| layer.as_str() == stop));
    if let Some((first, second)) = span {
        let (low, high) = if first <= second {
            (first, second)
        } else {
            (second, first)
        };
        layers.extend(copper[low..=high].iter().cloned());
    } else {
        layers.insert(start.to_owned());
        layers.insert(stop.to_owned());
    }
}

/// R1 (`field-map:33`): the resolved net name, or `None` for no-net copper
/// (net 0, a missing code, an empty name, or no `(net …)` form).
fn net_name(net: &PcbNetRef) -> Option<String> {
    net.name
        .as_deref()
        .filter(|name| !name.is_empty())
        .map(str::to_owned)
}

/// A board item that fails to decode fails the pass (`lib.rs`, D5).
fn board_error(error: CoreError) -> ProjectionError {
    ProjectionError::new(format!("route-metrics board: {}", error.message))
}
