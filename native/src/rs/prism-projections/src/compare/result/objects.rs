//! Object changes of the Schematic and PCB tabs: one review change per
//! object the object diff added, removed or modified, with its
//! classification, label, semantic identity, sides and visual targets. Today's
//! code: `backend/app/services/design_compare_nodes.py` (`_node_change`,
//! `_hydrate_native_targets`).
//!
//! This is a Rust-native rebuild on the typed [`Entry`] fields and the diff's
//! [`Pair`]: no `serde_json::Value` in the path except the field values, which
//! already are `Value`. The kind sets are `const` slices, the taxonomy
//! decisions are enums, and every string is allocated once, only for the
//! output.

use super::super::classify::MergedDelta;
use super::super::diff::{Outcome, Pair};
use super::super::entry::Entry;
use super::super::output::Status;
use super::{ReviewChange, VisualRole, VisualSide, VisualStatus, VisualTarget};
use crate::semantic_index::stable_uid;
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};

/// The tab a change belongs to, and its id prefix (`sch`/`pcb`).
#[derive(Clone, Copy, PartialEq, Eq)]
enum Domain {
    Schematic,
    Pcb,
}

impl Domain {
    fn as_dc(self) -> dc::DesignCompareDomain {
        match self {
            Self::Schematic => dc::DesignCompareDomain::Schematic,
            Self::Pcb => dc::DesignCompareDomain::Pcb,
        }
    }

    fn as_str(self) -> &'static str {
        match self {
            Self::Schematic => "schematic",
            Self::Pcb => "pcb",
        }
    }

    fn prefix(self) -> &'static str {
        match self {
            Self::Schematic => "sch",
            Self::Pcb => "pcb",
        }
    }
}

/// The change-level facts every target and the semantic id are shaped from
/// (`_node_change`'s captured locals).
struct Facts<'a> {
    domain: Domain,
    kind: &'a str,
    document_path: &'a str,
    power: bool,
    category: dc::DesignCompareCategory,
    classification: dc::DesignCompareClassification,
    reference: Option<&'a str>,
}

// The kind sets of `design_compare_nodes.py:21-86`, as `const` slices: built
// once, never per call.

const SCHEMATIC_NET_OBJECT_KINDS: &[&str] = &[
    "wire",
    "bus",
    "bus_alias",
    "bus_entry",
    "label",
    "junction",
    "pin",
    "sheet_pin",
    "no_connect",
];
const PCB_COPPER_OBJECT_KINDS: &[&str] = &["track", "arc", "via"];
const PRIMARY_CONSTRAINT_KINDS: &[&str] = &[
    "board_constraint",
    "custom_rule",
    "drc_exclusion",
    "erc_exclusion",
    "erc_pin_rule",
    "fabrication_output",
    "net_class",
    "net_class_assignment",
];
const SECONDARY_CONSTRAINT_KINDS: &[&str] = &[
    "board_default",
    "drc_severity",
    "routing_preset",
    "teardrop_setting",
    "zone_setting",
];
const SCHEMATIC_PROJECT_KINDS: &[&str] = &["erc_exclusion", "erc_pin_rule", "project_metadata"];
const NET_AGGREGATE_OBJECT_KINDS: &[&str] =
    &["track", "arc", "via", "wire", "bus", "label", "junction"];
const PCB_GRAPHIC_OBJECT_KINDS: &[&str] = &["graphic", "footprint_graphic", "footprint_text"];
const PCB_FABRICATION_LAYER_SUFFIXES: &[&str] = &[
    ".cu", ".mask", ".paste", ".silks", ".fab", ".crtyd", ".adhes",
];

/// A native kind's drawing role (`targets_for`'s `role`, one entry per role
/// name of the frontend's list).
const ROLE_NAMES: &[(&str, VisualRole)] = &[
    ("wire", VisualRole::Wire),
    ("bus", VisualRole::Bus),
    ("bus_entry", VisualRole::BusEntry),
    ("label", VisualRole::Label),
    ("junction", VisualRole::Junction),
    ("terminal", VisualRole::Terminal),
    ("sheet", VisualRole::Sheet),
    ("sheet_pin", VisualRole::SheetPin),
    ("symbol", VisualRole::Symbol),
    ("no_connect", VisualRole::NoConnect),
    ("graphic", VisualRole::Graphic),
    ("footprint", VisualRole::Footprint),
    ("pad", VisualRole::Pad),
    ("track", VisualRole::Track),
    ("arc", VisualRole::Arc),
    ("via", VisualRole::Via),
    ("zone", VisualRole::Zone),
    ("footprint_graphic", VisualRole::FootprintGraphic),
    ("footprint_text", VisualRole::FootprintText),
    ("image", VisualRole::Image),
    ("table", VisualRole::Table),
    ("group", VisualRole::Group),
    ("net_class", VisualRole::NetClass),
    ("net_class_assignment", VisualRole::NetClassAssignment),
];

/// One review change per object of `outcome`, in key order.
pub(super) fn build(base: &[Entry], head: &[Entry], outcome: &Outcome) -> Vec<ReviewChange> {
    outcome
        .changes
        .iter()
        .map(|pair| {
            let before = pair.before.map(|index| &base[index]);
            let after = pair.after.map(|index| &head[index]);
            change(before, after, pair)
        })
        .collect()
}

fn change(before: Option<&Entry>, after: Option<&Entry>, pair: &Pair) -> ReviewChange {
    let active = after.or(before).expect("a change has at least one side");
    let facts = Facts::of(active, &union_layers(before, after));
    let reference = reference_of(active, facts.power);
    let net = net_of(active, facts.power);
    let source = after
        .map(|entry| entry.uuid.as_str())
        .or_else(|| before.map(|entry| entry.uuid.as_str()));
    let semantic_id = semantic_id(&facts, reference, net, source);
    let reasons = reason_list(pair);
    let change = dc::DesignCompareChange {
        id: change_id(facts.domain, kind_str(pair.status), pair.key),
        domain: facts.domain.as_dc(),
        kind: change_kind(pair.status),
        category: facts.category,
        classification: facts.classification,
        label: node_label(active, facts.kind, reference, net),
        object_kind: object_kind(facts.kind),
        reference: reference.and_then(parse_refdes),
        net: net.and_then(parse_net),
        semantic_id,
        page: (!active.document_path.is_empty()).then(|| active.document_path.clone()),
        reasons,
        fields: fields_of(&pair.deltas),
        details: details_of(active),
        base: base_side(pair, before, active),
        head: head_side(pair, after, active),
    };
    ReviewChange {
        visual_targets: visual_targets(&facts, pair, before, after),
        change,
    }
}

impl<'a> Facts<'a> {
    fn of(active: &'a Entry, layers: &[String]) -> Self {
        let kind = active.kind.as_str();
        let document_path = active.document_path.as_str();
        let power = is_power_symbol(active);
        let domain = domain_of(kind, document_path);
        let (category, classification) = classification(domain, kind, power, layers);
        Self {
            domain,
            kind,
            document_path,
            power,
            category,
            classification,
            reference: reference_of(active, power),
        }
    }
}

// ----------------------------------------------------------------- kind sets

fn is_schematic_net_object(kind: &str) -> bool {
    SCHEMATIC_NET_OBJECT_KINDS.contains(&kind)
}

fn is_pcb_copper(kind: &str) -> bool {
    PCB_COPPER_OBJECT_KINDS.contains(&kind)
}

fn is_primary_constraint(kind: &str) -> bool {
    PRIMARY_CONSTRAINT_KINDS.contains(&kind)
}

fn is_secondary_constraint(kind: &str) -> bool {
    SECONDARY_CONSTRAINT_KINDS.contains(&kind)
}

fn is_constraint(kind: &str) -> bool {
    is_primary_constraint(kind) || is_secondary_constraint(kind)
}

fn is_schematic_project(kind: &str) -> bool {
    SCHEMATIC_PROJECT_KINDS.contains(&kind)
}

fn is_net_aggregate(kind: &str) -> bool {
    NET_AGGREGATE_OBJECT_KINDS.contains(&kind)
}

fn is_pcb_graphic(kind: &str) -> bool {
    PCB_GRAPHIC_OBJECT_KINDS.contains(&kind)
}

// ---------------------------------------------------------------- the change

fn domain_of(kind: &str, document_path: &str) -> Domain {
    if is_schematic_project(kind) {
        return Domain::Schematic;
    }
    let board = document_path.ends_with(".kicad_pcb")
        || document_path.ends_with(".kicad_pro")
        || document_path.ends_with(".kicad_dru");
    if is_constraint(kind) || board {
        Domain::Pcb
    } else {
        Domain::Schematic
    }
}

fn is_power_symbol(entry: &Entry) -> bool {
    entry.kind == "symbol"
        && entry
            .lib_id
            .as_deref()
            .is_some_and(|id| id.to_lowercase().starts_with("power:"))
}

fn reference_of(entry: &Entry, power: bool) -> Option<&str> {
    if power {
        return None;
    }
    entry.refdes.as_deref().filter(|text| !text.is_empty())
}

fn net_of(entry: &Entry, power: bool) -> Option<&str> {
    if let Some(net) = entry.net.as_deref().filter(|text| !text.is_empty()) {
        return Some(net);
    }
    if !power {
        return None;
    }
    if let Some(value) = property_value(entry, "Value").filter(|text| !text.is_empty()) {
        return Some(value);
    }
    let lib_id = entry.lib_id.as_deref().unwrap_or_default();
    let name = lib_id.split_once(':').map_or(lib_id, |(_, rest)| rest);
    (!name.is_empty()).then_some(name)
}

fn property_value<'a>(entry: &'a Entry, name: &str) -> Option<&'a str> {
    entry
        .properties
        .as_ref()?
        .iter()
        .find(|property| property.name == name)
        .map(|property| property.value.as_str())
}

fn classification(
    domain: Domain,
    kind: &str,
    power: bool,
    layers: &[String],
) -> (dc::DesignCompareCategory, dc::DesignCompareClassification) {
    if kind == "project_metadata" {
        return (
            dc::DesignCompareCategory::Text,
            dc::DesignCompareClassification::Secondary,
        );
    }
    if is_constraint(kind) {
        return (
            dc::DesignCompareCategory::Rules,
            constraint_classification(kind),
        );
    }
    if domain == Domain::Schematic {
        return schematic_classification(kind, power);
    }
    pcb_classification(kind, layers)
}

fn constraint_classification(kind: &str) -> dc::DesignCompareClassification {
    if is_primary_constraint(kind) {
        dc::DesignCompareClassification::Primary
    } else {
        dc::DesignCompareClassification::Secondary
    }
}

fn schematic_classification(
    kind: &str,
    power: bool,
) -> (dc::DesignCompareCategory, dc::DesignCompareClassification) {
    use dc::DesignCompareCategory as Category;
    use dc::DesignCompareClassification as Classification;
    if kind == "symbol" && !power {
        return (Category::Components, Classification::Primary);
    }
    if power || is_schematic_net_object(kind) {
        return (Category::Nets, Classification::Primary);
    }
    if kind == "sheet" {
        return (Category::Sheets, Classification::Primary);
    }
    (Category::Graphics, Classification::Secondary)
}

fn pcb_classification(
    kind: &str,
    layers: &[String],
) -> (dc::DesignCompareCategory, dc::DesignCompareClassification) {
    use dc::DesignCompareCategory as Category;
    use dc::DesignCompareClassification as Classification;
    match kind {
        "footprint" | "pad" => (Category::Components, Classification::Primary),
        "zone" => (Category::Zones, Classification::Primary),
        _ if is_pcb_copper(kind) => (Category::Nets, Classification::Primary),
        _ if is_pcb_graphic(kind) => {
            let classification = if layers.iter().any(|layer| is_fabrication_layer(layer)) {
                Classification::Primary
            } else {
                Classification::Secondary
            };
            (Category::Graphics, classification)
        }
        _ => (Category::Other, Classification::Secondary),
    }
}

fn is_fabrication_layer(layer: &str) -> bool {
    let folded = layer.to_lowercase();
    folded == "edge.cuts"
        || folded == "margin"
        || PCB_FABRICATION_LAYER_SUFFIXES
            .iter()
            .any(|suffix| folded.ends_with(suffix))
}

fn item_layers(entry: Option<&Entry>) -> Vec<String> {
    let mut layers: BTreeSet<&str> = BTreeSet::new();
    if let Some(entry) = entry {
        if let Some(layer) = normalized_layer(entry.layer.as_deref()) {
            layers.insert(layer);
        }
        if let Some(list) = &entry.layers {
            for layer in list {
                if let Some(layer) = normalized_layer(Some(layer.as_str())) {
                    layers.insert(layer);
                }
            }
        }
    }
    layers.into_iter().map(str::to_owned).collect()
}

fn union_layers(before: Option<&Entry>, after: Option<&Entry>) -> Vec<String> {
    let mut layers: BTreeSet<String> = BTreeSet::new();
    layers.extend(item_layers(before));
    layers.extend(item_layers(after));
    layers.into_iter().collect()
}

fn normalized_layer(value: Option<&str>) -> Option<&str> {
    let value = value?;
    let trimmed = value.trim();
    (!trimmed.is_empty()).then_some(trimmed)
}

fn semantic_id(
    facts: &Facts,
    reference: Option<&str>,
    net: Option<&str>,
    source: Option<&str>,
) -> Option<String> {
    if let Some(reference) = reference.filter(|_| matches!(facts.kind, "footprint" | "symbol")) {
        return Some(component_uid(reference));
    }
    if let Some(net) = net.filter(|_| facts.power || is_net_aggregate(facts.kind)) {
        return Some(net_uid(net));
    }
    if let Some(source) = source {
        return Some(object_uid(
            facts.domain,
            facts.document_path,
            facts.kind,
            source,
        ));
    }
    net.map(net_uid)
}

fn component_uid(reference: &str) -> String {
    stable_uid("cmp", &[reference])
}

fn net_uid(net: &str) -> String {
    stable_uid("net", &[net])
}

fn object_uid(domain: Domain, document_path: &str, kind: &str, source: &str) -> String {
    stable_uid("obj", &[domain.as_str(), document_path, kind, source])
}

fn change_id(domain: Domain, kind: &str, key: &str) -> String {
    let digest = Sha256::digest(key.as_bytes());
    let mut id = String::with_capacity(9 + kind.len() + 20);
    id.push_str(domain.prefix());
    id.push('-');
    id.push_str(kind);
    id.push('-');
    for byte in &digest[..10] {
        id.push_str(&format!("{byte:02x}"));
    }
    id
}

fn kind_str(status: Status) -> &'static str {
    match status {
        Status::Added => "added",
        Status::Removed => "removed",
        Status::Modified => "changed",
    }
}

fn change_kind(status: Status) -> dc::DesignCompareChangeKind {
    match status {
        Status::Added => dc::DesignCompareChangeKind::Added,
        Status::Removed => dc::DesignCompareChangeKind::Removed,
        Status::Modified => dc::DesignCompareChangeKind::Changed,
    }
}

fn reason_list(pair: &Pair) -> Vec<dc::DesignCompareReason> {
    if !pair.reasons.is_empty() {
        return pair
            .reasons
            .iter()
            .map(|reason| reason_of(reason))
            .collect();
    }
    match pair.status {
        Status::Added => vec![dc::DesignCompareReason::ObjectAdded],
        _ => vec![dc::DesignCompareReason::ObjectRemoved],
    }
}

fn reason_of(reason: &str) -> dc::DesignCompareReason {
    reason
        .parse()
        .unwrap_or(dc::DesignCompareReason::ContentChanged)
}

pub(super) fn object_kind(kind: &str) -> Option<String> {
    (!kind.is_empty()).then(|| kind.replace('_', "-"))
}

fn details_of(active: &Entry) -> dc::DesignCompareChangeDetails {
    dc::DesignCompareChangeDetails {
        review_only: (active.review_only == Some(true)).then_some(true),
        ..Default::default()
    }
}

fn base_side(
    pair: &Pair,
    before: Option<&Entry>,
    active: &Entry,
) -> Option<dc::DesignCompareChangeSide> {
    if pair.status == Status::Added {
        return None;
    }
    before.map(|entry| side(entry, active.document_path.as_str()))
}

fn head_side(
    pair: &Pair,
    after: Option<&Entry>,
    active: &Entry,
) -> Option<dc::DesignCompareChangeSide> {
    if pair.status == Status::Removed {
        return None;
    }
    after.map(|entry| side(entry, active.document_path.as_str()))
}

fn side(entry: &Entry, fallback_page: &str) -> dc::DesignCompareChangeSide {
    dc::DesignCompareChangeSide {
        source_id: entry.uuid.clone(),
        parent_source_id: non_empty(&entry.parent_uuid).map(|id| dc::KiCadUuid(id.to_owned())),
        document_path: if entry.document_path.is_empty() {
            fallback_page.to_owned()
        } else {
            entry.document_path.clone()
        },
        layer: normalized_layer(entry.layer.as_deref()).and_then(parse_layer),
        layers: item_layers(Some(entry))
            .iter()
            .filter_map(|layer| parse_layer(layer))
            .collect(),
        at: side_at(entry),
        reference: non_empty(&entry.refdes).and_then(parse_refdes),
        net: non_empty(&entry.net).and_then(parse_net),
    }
}

fn side_at(entry: &Entry) -> Option<dc::PointNm> {
    entry.at.map(|at| dc::PointNm {
        x_nm: dc::Nanometres(nanometres(at[0])),
        y_nm: dc::Nanometres(nanometres(at[1])),
    })
}

fn nanometres(millimetres: f64) -> i64 {
    (millimetres * 1e6 + 0.5).floor() as i64
}

fn non_empty(value: &Option<String>) -> Option<&str> {
    value.as_deref().filter(|text| !text.is_empty())
}

fn parse_refdes(value: &str) -> Option<dc::Refdes> {
    value.parse().ok()
}

fn parse_net(value: &str) -> Option<dc::NetName> {
    value.parse().ok()
}

fn parse_layer(value: &str) -> Option<dc::LayerName> {
    value.parse().ok()
}

// -------------------------------------------------------------------- fields

fn fields_of(deltas: &[MergedDelta]) -> dc::RecordDesignCompareFieldDelta {
    let mut fields: BTreeMap<String, dc::DesignCompareFieldDelta> = BTreeMap::new();
    for delta in deltas {
        if delta.name.is_empty() {
            continue;
        }
        let from = present(&delta.from);
        let to = present(&delta.to);
        if from != to {
            fields.insert(
                delta.name.clone(),
                dc::DesignCompareFieldDelta {
                    old: from.map(review_value),
                    new: to.map(review_value),
                },
            );
        }
        if delta.attributes_changed {
            fields.insert(
                format!("{} attributes", delta.name),
                dc::DesignCompareFieldDelta {
                    old: attributes_field(&delta.from_attributes),
                    new: attributes_field(&delta.to_attributes),
                },
            );
        }
    }
    dc::RecordDesignCompareFieldDelta(fields)
}

/// A delta value that is absent or `null` reads back as absent (Python's
/// `delta.get("from")`).
fn present(value: &Option<Value>) -> Option<&Value> {
    value.as_ref().filter(|item| !item.is_null())
}

/// `_property_attributes`: a property's attributes, compacted.
fn attributes_field(value: &Option<Value>) -> Option<dc::BoardObjectsReviewValue> {
    let Value::Object(entries) = value.as_ref()? else {
        return None;
    };
    let table = entries
        .iter()
        .filter(|(_, item)| !is_falsy(item))
        .map(|(key, item)| (key.clone(), scalar_of(item)))
        .collect();
    Some(dc::BoardObjectsReviewValue::Variant5(
        dc::BoardObjectsReviewTable(table),
    ))
}

/// Python's `item not in (None, False, "", [], {})`: `0` and `0.0` fold to
/// `False`, so every zero and every empty shape is dropped.
fn is_falsy(value: &Value) -> bool {
    match value {
        Value::Null => true,
        Value::Bool(flag) => !flag,
        Value::Number(number) => number.as_f64() == Some(0.0),
        Value::String(text) => text.is_empty(),
        Value::Array(items) => items.is_empty(),
        Value::Object(map) => map.is_empty(),
    }
}

fn review_value(value: &Value) -> dc::BoardObjectsReviewValue {
    match value {
        Value::Bool(flag) => dc::BoardObjectsReviewValue::Variant2(*flag),
        Value::Number(number) => {
            dc::BoardObjectsReviewValue::Variant1(number.as_f64().unwrap_or(0.0))
        }
        Value::String(text) => dc::BoardObjectsReviewValue::Variant0(text.clone()),
        Value::Array(items) => array_value(items),
        Value::Object(_) => dc::BoardObjectsReviewValue::Variant5(table_of(value)),
        Value::Null => dc::BoardObjectsReviewValue::Variant0(String::new()),
    }
}

fn array_value(items: &[Value]) -> dc::BoardObjectsReviewValue {
    match items.first() {
        Some(Value::String(_)) => dc::BoardObjectsReviewValue::Variant3(
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_owned)
                .collect(),
        ),
        Some(Value::Number(_)) => {
            dc::BoardObjectsReviewValue::Variant4(items.iter().filter_map(Value::as_f64).collect())
        }
        Some(Value::Object(_)) => {
            dc::BoardObjectsReviewValue::Variant6(items.iter().map(table_of).collect())
        }
        _ => dc::BoardObjectsReviewValue::Variant3(Vec::new()),
    }
}

fn table_of(value: &Value) -> dc::BoardObjectsReviewTable {
    let mut table = BTreeMap::new();
    if let Value::Object(entries) = value {
        for (key, item) in entries {
            table.insert(key.clone(), scalar_of(item));
        }
    }
    dc::BoardObjectsReviewTable(table)
}

fn scalar_of(value: &Value) -> dc::BoardObjectsReviewScalar {
    match value {
        Value::Bool(flag) => dc::BoardObjectsReviewScalar::Boolean(*flag),
        Value::Number(number) => {
            dc::BoardObjectsReviewScalar::Number(number.as_f64().unwrap_or(0.0))
        }
        Value::String(text) => dc::BoardObjectsReviewScalar::String(text.clone()),
        other => dc::BoardObjectsReviewScalar::String(other.to_string()),
    }
}

// -------------------------------------------------------------------- labels

fn node_label(entry: &Entry, kind: &str, reference: Option<&str>, net: Option<&str>) -> String {
    if let Some(label) = numbered_label(kind, reference, entry.number.as_deref()) {
        return label;
    }
    if let Some(label) = footprint_label(kind, reference, entry.text.as_deref()) {
        return label;
    }
    if let Some(label) = sheet_pin_label(kind, entry.text.as_deref()) {
        return label;
    }
    if let Some(label) = named_label(kind, entry.name.as_deref()) {
        return label;
    }
    fallback_label(entry, reference, net)
}

fn numbered_label(kind: &str, reference: Option<&str>, number: Option<&str>) -> Option<String> {
    let reference = reference.filter(|_| matches!(kind, "pad" | "pin"))?;
    let number = number.filter(|text| !text.is_empty())?;
    let noun = if kind == "pad" { "pad" } else { "pin" };
    Some(format!("{reference} {noun} {number}"))
}

fn footprint_label(kind: &str, reference: Option<&str>, text: Option<&str>) -> Option<String> {
    let reference = reference.filter(|_| matches!(kind, "footprint_graphic" | "footprint_text"))?;
    let detail = match text.filter(|text| !text.is_empty()) {
        Some(text) => text.to_owned(),
        None => kind.replace('_', " "),
    };
    Some(format!("{reference} · {detail}"))
}

fn sheet_pin_label(kind: &str, text: Option<&str>) -> Option<String> {
    let text = text
        .filter(|_| kind == "sheet_pin")
        .filter(|text| !text.is_empty())?;
    Some(format!("Sheet pin {text}"))
}

fn named_label(kind: &str, name: Option<&str>) -> Option<String> {
    if kind == "no_connect" {
        return Some("No-connect marker".to_owned());
    }
    if !matches!(kind, "zone" | "group") && !is_constraint(kind) {
        return None;
    }
    name.filter(|text| !text.is_empty()).map(str::to_owned)
}

fn fallback_label(entry: &Entry, reference: Option<&str>, net: Option<&str>) -> String {
    reference
        .or(net)
        .or(entry.name.as_deref().filter(|text| !text.is_empty()))
        .or(entry.text.as_deref().filter(|text| !text.is_empty()))
        .or(entry.lib_id.as_deref().filter(|text| !text.is_empty()))
        .map_or_else(|| first_twelve(&entry.uuid), str::to_owned)
}

fn first_twelve(uuid: &str) -> String {
    uuid.chars().take(12).collect()
}

// ------------------------------------------------------------------- targets

fn visual_targets(
    facts: &Facts,
    pair: &Pair,
    before: Option<&Entry>,
    after: Option<&Entry>,
) -> Vec<VisualTarget> {
    let copper =
        pair.status == Status::Modified && facts.domain == Domain::Pcb && is_pcb_copper(facts.kind);
    let repathed = pair.status == Status::Modified && pair.reasons.contains(&"re-pathed");
    if copper || repathed {
        return two_sided(facts, before, after);
    }
    let status = visual_status(pair.status);
    match change_side(pair.status) {
        VisualSide::Reference => before
            .map(|entry| targets_for(facts, entry, VisualSide::Reference, status))
            .unwrap_or_default(),
        VisualSide::Comparison => after
            .map(|entry| targets_for(facts, entry, VisualSide::Comparison, status))
            .unwrap_or_default(),
    }
}

fn two_sided(facts: &Facts, before: Option<&Entry>, after: Option<&Entry>) -> Vec<VisualTarget> {
    let mut targets = Vec::new();
    if let Some(entry) = before {
        targets.extend(targets_for(
            facts,
            entry,
            VisualSide::Reference,
            VisualStatus::Modified,
        ));
    }
    if let Some(entry) = after {
        targets.extend(targets_for(
            facts,
            entry,
            VisualSide::Comparison,
            VisualStatus::Modified,
        ));
    }
    targets
}

fn change_side(status: Status) -> VisualSide {
    if status == Status::Removed {
        VisualSide::Reference
    } else {
        VisualSide::Comparison
    }
}

fn visual_status(status: Status) -> VisualStatus {
    match status {
        Status::Added => VisualStatus::Added,
        Status::Removed => VisualStatus::Removed,
        Status::Modified => VisualStatus::Modified,
    }
}

fn targets_for(
    facts: &Facts,
    entry: &Entry,
    side: VisualSide,
    status: VisualStatus,
) -> Vec<VisualTarget> {
    if entry.review_only == Some(true) {
        return Vec::new();
    }
    target_paths(entry)
        .into_iter()
        .map(|path| VisualTarget {
            side,
            status,
            source_id: entry.uuid.clone(),
            parent_source_id: non_empty(&entry.parent_uuid).map(str::to_owned),
            kind: Some(facts.kind.to_owned()),
            document_path: Some(entry.document_path.clone()),
            sheet_path: sheet_path(path, &entry.uuid),
            at: side_at(entry),
            role: role_for(facts),
            reference: facts.reference.map(str::to_owned),
            pin: None,
        })
        .collect()
}

fn target_paths(entry: &Entry) -> Vec<Option<&str>> {
    match &entry.kiid_paths {
        Some(paths) if !paths.is_empty() => paths.iter().map(|path| Some(path.as_str())).collect(),
        _ => vec![None],
    }
}

/// The KIID path minus its trailing `/<uuid>`; `/` when that leaves nothing,
/// `None` when the path does not end in the object's uuid.
fn sheet_path(path: Option<&str>, uuid: &str) -> Option<String> {
    let path = path?;
    let prefix = path.strip_suffix(&format!("/{uuid}"))?;
    Some(if prefix.is_empty() {
        "/".to_owned()
    } else {
        prefix.to_owned()
    })
}

fn role_for(facts: &Facts) -> VisualRole {
    if facts.category == dc::DesignCompareCategory::Components {
        return VisualRole::Component;
    }
    if facts.power {
        return VisualRole::Label;
    }
    role_by_name(facts.kind)
}

fn role_by_name(kind: &str) -> VisualRole {
    ROLE_NAMES
        .iter()
        .find(|(name, _)| *name == kind)
        .map_or(VisualRole::Other, |(_, role)| *role)
}

#[cfg(test)]
mod tests;
