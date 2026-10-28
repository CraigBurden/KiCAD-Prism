//! The stackup producer's vias, drills and spans.
//!
//! Ports `stackup_build.py:150-170` (a back or tertiary [`Drill`] and its
//! comparison key), `:243-286` (`viaSpans`, rule 6: every top-level `(via …)`
//! grouped, resolved against `copper` and sorted) and `:257-261` (`spanLayers`).

use super::VIA_TYPES;
use super::tree::{as_f64, child, form_children, is_form, nm, non_negative, py_str, text, value};
use crate::ProjectionError;
use prism_kicad_core::Sexp;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// A back drill or tertiary drill (`stackup_build.py:150-164`).
#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
struct Drill {
    size_nm: Option<u64>,
    start_layer: Option<String>,
    stop_layer: Option<String>,
}

/// The grouping key of a via (`stackup_build.py:255`): technology, span and
/// the two drills. `BTreeMap` keeps determinism; the sort that follows is
/// total, so the map's order never reaches the output.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct ViaKey {
    via_type: String,
    start: Option<String>,
    stop: Option<String>,
    backdrill: Option<Drill>,
    tertiary: Option<Drill>,
}

/// `_drill_key` (`stackup_build.py:167-170`): the drill comparison tuple.
#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct DrillKey(u8, i64, String, String);

impl DrillKey {
    fn of(drill: Option<&Drill>) -> Self {
        match drill {
            None => Self(0, -1, String::new(), String::new()),
            Some(drill) => Self(
                1,
                drill.size_nm.map_or(-1, |size| size as i64),
                drill.start_layer.clone().unwrap_or_default(),
                drill.stop_layer.clone().unwrap_or_default(),
            ),
        }
    }
}

/// The via sort key (`stackup_build.py:279-286`).
#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct SpanKey {
    start_index: usize,
    stop_index: usize,
    via_type: String,
    start: String,
    stop: String,
    backdrill: DrillKey,
    tertiary: DrillKey,
}

/// `viaSpans` (`stackup_build.py:243-286`, rule 6): every top-level `(via …)`
/// grouped, resolved against `copper` and sorted.
pub(super) fn via_spans(
    root_items: &[Sexp],
    copper: &[String],
) -> Result<Vec<Value>, ProjectionError> {
    let mut groups: BTreeMap<ViaKey, u64> = BTreeMap::new();
    for via in root_items.iter().skip(1) {
        if !is_form(via, "via") {
            continue;
        }
        let key = via_key(form_children(via))?;
        *groups.entry(key).or_insert(0) += 1;
    }
    let mut spans: Vec<(&ViaKey, u64)> = groups.iter().map(|(key, count)| (key, *count)).collect();
    spans.sort_by_key(|(key, _)| span_key(key, copper));
    Ok(spans
        .into_iter()
        .map(|(key, count)| via_span_value(key, count, copper))
        .collect())
}

/// The grouping key of one via (`stackup_build.py:247-255`).
fn via_key(via_items: &[Sexp]) -> Result<ViaKey, ProjectionError> {
    let header: Vec<String> = via_items
        .iter()
        .skip(1)
        .filter(|item| !matches!(item, Sexp::List(_)))
        .filter_map(py_str)
        .collect();
    let via_type = VIA_TYPES
        .iter()
        .find(|name| header.iter().any(|token| token == *name))
        .copied()
        .unwrap_or("through");
    let names: Vec<String> = child(via_items.iter(), "layers")
        .map(|form| {
            form_children(form)
                .iter()
                .skip(1)
                .filter_map(py_str)
                .collect()
        })
        .unwrap_or_default();
    let start = names.first().filter(|name| !name.is_empty()).cloned();
    let stop = names.get(1).filter(|name| !name.is_empty()).cloned();
    Ok(ViaKey {
        via_type: via_type.to_owned(),
        start,
        stop,
        backdrill: drill(via_items.iter(), "backdrill")?,
        tertiary: drill(via_items.iter(), "tertiary_drill")?,
    })
}

/// One `viaSpans` record (`stackup_build.py:262-274`).
fn via_span_value(key: &ViaKey, count: u64, copper: &[String]) -> Value {
    let mut record = Map::new();
    record.insert("viaType".to_owned(), json!(key.via_type));
    if let Some(start) = &key.start {
        record.insert("startLayer".to_owned(), json!(start));
    }
    if let Some(stop) = &key.stop {
        record.insert("stopLayer".to_owned(), json!(stop));
    }
    record.insert("spanLayers".to_owned(), json!(span_layers(key, copper)));
    if let Some(backdrill) = &key.backdrill {
        record.insert("backdrill".to_owned(), drill_value(backdrill));
    }
    if let Some(tertiary) = &key.tertiary {
        record.insert("tertiaryDrill".to_owned(), drill_value(tertiary));
    }
    record.insert("count".to_owned(), json!(count));
    Value::Object(record)
}

/// `_drill` (`stackup_build.py:150-164`): a back or tertiary drill, `None`
/// when neither a size nor a two-name `(layers …)` is written.
fn drill<'a, I>(items: I, head: &str) -> Result<Option<Drill>, ProjectionError>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    let Some(form) = child(items, head) else {
        return Ok(None);
    };
    let cells = form_children(form);
    let mut result = Drill::default();
    if let Some(size) = value(cells.iter(), "size")
        && !matches!(size, Sexp::List(_))
    {
        result.size_nm = Some(non_negative(nm(as_f64(size)?), "drill size")?);
    }
    if let Some(layers) = child(cells.iter(), "layers") {
        let layer_cells = form_children(layers);
        if layer_cells.len() >= 3 {
            if let Some(start) = text(&layer_cells[1]) {
                result.start_layer = Some(start);
            }
            if let Some(stop) = text(&layer_cells[2]) {
                result.stop_layer = Some(stop);
            }
        }
    }
    if result.size_nm.is_none() && result.start_layer.is_none() && result.stop_layer.is_none() {
        Ok(None)
    } else {
        Ok(Some(result))
    }
}

/// The index of a layer name in `copper`, or `len(copper)` when absent
/// (`index_of`, `stackup_build.py:276-277`).
fn index_of(copper: &[String], name: Option<&str>) -> usize {
    match name {
        Some(name) => copper
            .iter()
            .position(|layer| layer == name)
            .unwrap_or(copper.len()),
        None => copper.len(),
    }
}

/// The `viaSpans` sort key (`stackup_build.py:279-286`).
fn span_key(key: &ViaKey, copper: &[String]) -> SpanKey {
    SpanKey {
        start_index: index_of(copper, key.start.as_deref()),
        stop_index: index_of(copper, key.stop.as_deref()),
        via_type: key.via_type.clone(),
        start: key.start.clone().unwrap_or_default(),
        stop: key.stop.clone().unwrap_or_default(),
        backdrill: DrillKey::of(key.backdrill.as_ref()),
        tertiary: DrillKey::of(key.tertiary.as_ref()),
    }
}

/// `spanLayers` (`stackup_build.py:257-261`): the copper layers from
/// `startLayer` to `stopLayer` inclusive, whatever their order; empty when
/// either is absent or not in `copper`.
fn span_layers(key: &ViaKey, copper: &[String]) -> Vec<String> {
    let (Some(start), Some(stop)) = (key.start.as_deref(), key.stop.as_deref()) else {
        return Vec::new();
    };
    let (Some(first), Some(last)) = (
        copper.iter().position(|layer| layer == start),
        copper.iter().position(|layer| layer == stop),
    ) else {
        return Vec::new();
    };
    let (low, high) = if first <= last {
        (first, last)
    } else {
        (last, first)
    };
    copper[low..=high].to_vec()
}

/// The JSON of one drill (`stackup_build.py:150-164`).
fn drill_value(drill: &Drill) -> Value {
    let mut map = Map::new();
    if let Some(size) = drill.size_nm {
        map.insert("sizeNm".to_owned(), json!(size));
    }
    if let Some(start) = &drill.start_layer {
        map.insert("startLayer".to_owned(), json!(start));
    }
    if let Some(stop) = &drill.stop_layer {
        map.insert("stopLayer".to_owned(), json!(stop));
    }
    Value::Object(map)
}
