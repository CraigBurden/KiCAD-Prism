//! Building the `prism.compare.object_delta.a0` document from the diff's
//! changes (`ecad-diff.mjs:376-481`).

use super::CompareError;
use super::classify::{self, MergedDelta};
use super::entry::{self, Entry};
use super::json;
use prism_kicad_contracts::generated::prism_compare_object_delta_a0::CompareObjectDeltaA0;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// How a change relates the two sides; never `ignored`.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Status {
    /// Only in `--head`.
    Added,
    /// Only in `--base`.
    Removed,
    /// In both, content differs.
    Modified,
}

impl Status {
    fn as_str(self) -> &'static str {
        match self {
            Self::Added => "added",
            Self::Removed => "removed",
            Self::Modified => "modified",
        }
    }
}

/// One entry of `changes`.
pub struct Change {
    /// The object's key.
    pub key: String,
    /// The object's kind, today's spelling.
    pub kind: String,
    /// How it relates the two sides.
    pub status: Status,
    /// The classifier reasons (`modified` only).
    pub reasons: Vec<&'static str>,
    /// The change's JSON.
    pub value: Value,
}

/// An `added` change (`ecad-diff.mjs:380-388`).
pub fn added(after: &Entry) -> Change {
    let deltas = classify::review_field_deltas(None, Some(after));
    let mut map = change_map(after, Status::Added);
    set_properties(&mut map, &deltas);
    json::set(&mut map, "compare", entry::native_object(after));
    change(after, Status::Added, Vec::new(), map)
}

/// A `removed` change (`ecad-diff.mjs:441-453`).
pub fn removed(before: &Entry) -> Change {
    let deltas = classify::review_field_deltas(Some(before), None);
    let mut map = change_map(before, Status::Removed);
    set_properties(&mut map, &deltas);
    json::set(&mut map, "base", entry::native_object(before));
    change(before, Status::Removed, Vec::new(), map)
}

/// A `modified` change (`ecad-diff.mjs:415-438`).
pub fn modified(before: &Entry, after: &Entry) -> Change {
    let mut reasons = classify::classify(before, after);
    let deltas = classify::merged_property_deltas(before, after);
    if classify::properties_changed(&deltas) {
        reasons.push("properties-changed");
    }
    if reasons.is_empty() {
        reasons.push("content-changed");
    }
    let mut map = change_map(after, Status::Modified);
    set_properties(&mut map, &deltas);
    json::set(&mut map, "base", entry::native_object(before));
    json::set(&mut map, "compare", entry::native_object(after));
    if let Some(at) = before.at {
        json::set(&mut map, "atBase", json::point(at));
    }
    if let Some((dx, dy, distance)) = classify::position_delta(before, after) {
        json::set(
            &mut map,
            "positionDelta",
            json::object_of([
                ("dx", json::number(dx)),
                ("dy", json::number(dy)),
                ("distance", json::number(distance)),
            ]),
        );
    }
    json::set(
        &mut map,
        "reasons",
        Value::Array(reasons.iter().map(|reason| Value::from(*reason)).collect()),
    );
    change(after, Status::Modified, reasons, map)
}

/// An `ignored` entry (`ecad-diff.mjs:390-411`).
pub fn ignored(after: &Entry, reason: &'static str) -> Value {
    let mut map = Map::new();
    json::set(&mut map, "key", Value::from(after.key.clone()));
    json::set(&mut map, "status", Value::from("ignored"));
    json::set(&mut map, "reason", Value::from(reason));
    merge(&mut map, entry::native_object(after));
    Value::Object(map)
}

/// The whole `CompareObjectDeltaA0` document.
pub fn document(
    base: &[Entry],
    head: &[Entry],
    changes: &[Change],
    ignored: &[Value],
    unchanged: usize,
) -> Result<CompareObjectDeltaA0, CompareError> {
    let mut document = Map::new();
    json::set(
        &mut document,
        "schema",
        Value::from("prism.compare.object_delta.a0"),
    );
    json::set(&mut document, "base", side(base));
    json::set(&mut document, "head", side(head));
    json::set(
        &mut document,
        "changes",
        Value::Array(changes.iter().map(|change| change.value.clone()).collect()),
    );
    json::set(&mut document, "ignored", Value::Array(ignored.to_vec()));
    let (counts, by_kind, by_reason) =
        tally(changes, ignored.len(), base.len(), head.len(), unchanged);
    json::set(&mut document, "counts", counts);
    json::set(&mut document, "byKind", by_kind);
    json::set(&mut document, "byReason", by_reason);
    serde_json::from_value(Value::Object(document)).map_err(|error| {
        CompareError::new(format!(
            "the compare document does not fit its schema: {error}"
        ))
    })
}

fn change(
    entry: &Entry,
    status: Status,
    reasons: Vec<&'static str>,
    map: Map<String, Value>,
) -> Change {
    Change {
        key: entry.key.clone(),
        kind: entry.kind.clone(),
        status,
        reasons,
        value: Value::Object(map),
    }
}

fn change_map(entry: &Entry, status: Status) -> Map<String, Value> {
    let mut map = Map::new();
    json::set(&mut map, "key", Value::from(entry.key.clone()));
    json::set(&mut map, "status", Value::from(status.as_str()));
    merge(&mut map, entry::native_object(entry));
    map
}

/// Overwrite the spread object's own `properties` with the delta list, or drop
/// it when there is none (`ecad-diff.mjs:386`, `:437`, `:451`).
fn set_properties(map: &mut Map<String, Value>, deltas: &[MergedDelta]) {
    map.remove("properties");
    if !deltas.is_empty() {
        json::set(
            map,
            "properties",
            Value::Array(deltas.iter().map(delta_value).collect()),
        );
    }
}

fn delta_value(delta: &MergedDelta) -> Value {
    let mut map = Map::new();
    json::set(&mut map, "name", Value::from(delta.name.clone()));
    if let Some(from) = &delta.from {
        json::set(&mut map, "from", from.clone());
    }
    if let Some(to) = &delta.to {
        json::set(&mut map, "to", to.clone());
    }
    if delta.property {
        json::set(
            &mut map,
            "attributesChanged",
            Value::from(delta.attributes_changed),
        );
        if let Some(attributes) = &delta.from_attributes {
            json::set(&mut map, "fromAttributes", attributes.clone());
        }
        if let Some(attributes) = &delta.to_attributes {
            json::set(&mut map, "toAttributes", attributes.clone());
        }
    }
    Value::Object(map)
}

fn merge(target: &mut Map<String, Value>, source: Value) {
    if let Value::Object(map) = source {
        target.extend(map);
    }
}

fn side(entries: &[Entry]) -> Value {
    json::object_of([
        ("bundleKey", Value::from("0".repeat(64))),
        ("objects", Value::from(entries.len() as u64)),
        (
            "nativeObjects",
            Value::Array(entries.iter().map(entry::native_target).collect()),
        ),
        (
            "componentObjects",
            Value::Array(
                entries
                    .iter()
                    .filter(|entry| matches!(entry.kind.as_str(), "symbol" | "footprint"))
                    .map(entry::native_object)
                    .collect(),
            ),
        ),
    ])
}

#[allow(
    clippy::type_complexity,
    reason = "one small record per level: counts, per-kind and per-reason tallies"
)]
fn tally(
    changes: &[Change],
    ignored: usize,
    base_objects: usize,
    head_objects: usize,
    unchanged: usize,
) -> (Value, Value, Value) {
    let mut added = 0u64;
    let mut removed = 0u64;
    let mut modified = 0u64;
    let mut by_kind: BTreeMap<&str, [u64; 3]> = BTreeMap::new();
    let mut by_reason: BTreeMap<&str, u64> = BTreeMap::new();
    for change in changes {
        let row = by_kind.entry(change.kind.as_str()).or_default();
        match change.status {
            Status::Added => {
                row[0] += 1;
                added += 1;
            }
            Status::Removed => {
                row[1] += 1;
                removed += 1;
            }
            Status::Modified => {
                row[2] += 1;
                modified += 1;
            }
        }
        for reason in &change.reasons {
            *by_reason.entry(reason).or_insert(0) += 1;
        }
    }
    let counts = json::object_of([
        ("added", Value::from(added)),
        ("removed", Value::from(removed)),
        ("modified", Value::from(modified)),
        ("unchanged", Value::from(unchanged as u64)),
        ("ignored", Value::from(ignored as u64)),
        ("baseObjects", Value::from(base_objects as u64)),
        ("headObjects", Value::from(head_objects as u64)),
    ]);
    let kind_counts = Value::Object(
        by_kind
            .into_iter()
            .map(|(kind, row)| {
                (
                    kind.to_owned(),
                    json::object_of([
                        ("added", Value::from(row[0])),
                        ("removed", Value::from(row[1])),
                        ("modified", Value::from(row[2])),
                    ]),
                )
            })
            .collect(),
    );
    let reason_counts = Value::Object(
        by_reason
            .into_iter()
            .map(|(reason, count)| (reason.to_owned(), Value::from(count)))
            .collect(),
    );
    (counts, kind_counts, reason_counts)
}
