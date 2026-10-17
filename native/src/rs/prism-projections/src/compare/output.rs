//! Building the `prism.compare.object_delta.a0` document from the diff's
//! changes (`ecad-diff.mjs:376-481`).

use super::classify::{self, MergedDelta};
use super::entry::{self, Entry};
use super::json;
use serde::ser::{Serialize, SerializeMap, SerializeSeq, Serializer};
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
/// The whole `prism.compare.object_delta.a0` document, serialized on demand.
///
/// `nativeObjects` and `componentObjects` list every object of both sides, so
/// the document is several times the size of the inputs. It is never built as
/// one value: each element is made as it is written and dropped again, which
/// keeps the peak heap to the two sides' entries and the changes.
pub struct Delta {
    base: Vec<Entry>,
    head: Vec<Entry>,
    base_key: String,
    head_key: String,
    changes: Vec<Value>,
    ignored: Vec<Value>,
    counts: Value,
    by_kind: Value,
    by_reason: Value,
}

impl Delta {
    /// The `counts` record, as written.
    pub fn counts(&self) -> &Value {
        &self.counts
    }

    /// The number of objects on each side, `(base, head)`.
    pub fn objects(&self) -> (usize, usize) {
        (self.base.len(), self.head.len())
    }

    /// Set the two sides' `bundleKey` (the CLI knows them; the engine does not).
    pub fn set_bundle_keys(&mut self, base: &str, head: &str) {
        base.clone_into(&mut self.base_key);
        head.clone_into(&mut self.head_key);
    }
}

impl Serialize for Delta {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut map = serializer.serialize_map(Some(8))?;
        map.serialize_entry("schema", "prism.compare.object_delta.a0")?;
        map.serialize_entry("base", &Side(&self.base, &self.base_key))?;
        map.serialize_entry("head", &Side(&self.head, &self.head_key))?;
        map.serialize_entry("changes", &self.changes)?;
        map.serialize_entry("ignored", &self.ignored)?;
        map.serialize_entry("counts", &self.counts)?;
        map.serialize_entry("byKind", &self.by_kind)?;
        map.serialize_entry("byReason", &self.by_reason)?;
        map.end()
    }
}

/// One side of the document: `bundleKey`, `objects`, `nativeObjects`, `componentObjects`.
struct Side<'a>(&'a [Entry], &'a str);

impl Serialize for Side<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let Side(entries, key) = *self;
        let mut map = serializer.serialize_map(Some(4))?;
        map.serialize_entry("bundleKey", key)?;
        map.serialize_entry("objects", &(entries.len() as u64))?;
        map.serialize_entry("nativeObjects", &Each(entries, Pick::Native))?;
        map.serialize_entry("componentObjects", &Each(entries, Pick::Component))?;
        map.end()
    }
}

#[derive(Clone, Copy)]
enum Pick {
    /// Every entry, as `native_target`.
    Native,
    /// Symbols and footprints, as `native_object`.
    Component,
}

/// A side's entries as one list, each element built while it is written.
struct Each<'a>(&'a [Entry], Pick);

impl Serialize for Each<'_> {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let Each(entries, pick) = *self;
        let mut seq = serializer.serialize_seq(None)?;
        for entry in entries {
            match pick {
                Pick::Native => seq.serialize_element(&entry::native_target(entry))?,
                Pick::Component if matches!(entry.kind.as_str(), "symbol" | "footprint") => {
                    seq.serialize_element(&entry::native_object(entry))?;
                }
                Pick::Component => {}
            }
        }
        seq.end()
    }
}

/// Assemble the document from the diff's outcome; the entries move in.
pub fn document(
    base: Vec<Entry>,
    head: Vec<Entry>,
    changes: Vec<Change>,
    ignored: Vec<Value>,
    unchanged: usize,
) -> Delta {
    let (counts, by_kind, by_reason) =
        tally(&changes, ignored.len(), base.len(), head.len(), unchanged);
    Delta {
        base,
        head,
        base_key: "0".repeat(64),
        head_key: "0".repeat(64),
        changes: changes.into_iter().map(|change| change.value).collect(),
        ignored,
        counts,
        by_kind,
        by_reason,
    }
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
