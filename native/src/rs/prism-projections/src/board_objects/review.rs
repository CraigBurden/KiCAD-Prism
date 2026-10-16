//! Review values and review-only objects (field map, "Review fields",
//! "Review-only ids and names"), a port of `ecad-parse.mjs:222-551`,
//! `:553-858`, `:1051-1066`, `:1586-1591` and the transform in
//! `capture/board_objects.py:214-502`.

pub(crate) mod shapes;

use super::blake2b;
use super::tree::{self, Node};
use super::units::{canonical, es_number, json_string, json_text};
use crate::ProducerWarning;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// `entry(fields)`: drop undefined and null, keep `false`, `0` and `""`
/// (`ecad-parse.mjs:328-336`).
#[must_use]
pub(crate) fn entry(pairs: Vec<(&str, Option<Value>)>) -> Value {
    let mut out = Map::new();
    for (key, value) in pairs {
        if let Some(value) = value {
            if !value.is_null() {
                out.insert(key.to_owned(), value);
            }
        }
    }
    Value::Object(out)
}

/// `content_hash(value)`: BLAKE2b-512 of the canonical JSON text, first 16 hex
/// digits (`ecad-parse.mjs:252-257`).
#[must_use]
pub(crate) fn content_hash(value: &Value) -> String {
    let text = json_text(&canonical(value));
    blake2b::hex(text.as_bytes())[..16].to_owned()
}

/// `id` of a review-only object: `<kind with _ as ->:<hash>` (`ecad-parse.mjs:542`).
#[must_use]
pub(crate) fn review_id(kind_today: &str, identity: &str) -> String {
    format!(
        "{}:{}",
        kind_today.replace('_', "-"),
        content_hash(&Value::String(identity.to_owned()))
    )
}

/// Dedupe by `id` (later wins) and sort by `id` (`capture/board_objects.py:491-496`).
#[must_use]
pub(crate) fn finish_review(objects: Vec<Value>) -> Vec<Value> {
    let mut by_id: BTreeMap<String, Value> = BTreeMap::new();
    for object in objects {
        if let Some(id) = object.get("id").and_then(Value::as_str) {
            by_id.insert(id.to_owned(), object);
        }
    }
    by_id.into_values().collect()
}

/// `push_review_object` (`ecad-parse.mjs:533-551`); returns whether it emitted.
/// `kind_today` is today's spelling (`net_class`); the member kind is the
/// kebab-case form except `bus_alias` (`ecad-parse.mjs:329-331`).
pub(crate) fn push_review(
    objects: &mut Vec<Value>,
    kind_today: &str,
    name: &str,
    identity: &str,
    fields: Value,
) -> bool {
    if fields.as_object().is_none_or(Map::is_empty) {
        return false;
    }
    let member_kind = if kind_today == "bus_alias" {
        "bus_alias".to_owned()
    } else {
        kind_today.replace('_', "-")
    };
    objects.push(json!({
        "kind": member_kind,
        "id": review_id(kind_today, identity),
        "name": name,
        "reviewFields": fields,
    }));
    true
}

fn push_unchecked(
    objects: &mut Vec<Value>,
    kind_today: &str,
    name: &str,
    identity: &str,
    fields: Value,
) {
    let member_kind = kind_today.replace('_', "-");
    objects.push(json!({
        "kind": member_kind,
        "id": review_id(kind_today, identity),
        "name": name,
        "reviewFields": fields,
    }));
}

// ------------------------------------------------------------ review values

/// `vector_text` (`ecad-parse.mjs:338-345`).
#[must_use]
pub(crate) fn vector_text(value: Option<&Value>) -> Option<Value> {
    let value = value?;
    if is_falsy(value) {
        return None;
    }
    if let Value::Array(items) = value {
        let parts: Vec<String> = items.iter().map(js_string).collect();
        return Some(Value::String(parts.join(" × ")));
    }
    if let Value::Object(map) = value {
        if let (Some(x), Some(y)) = (
            map.get("x").and_then(Value::as_f64),
            map.get("y").and_then(Value::as_f64),
        ) {
            return Some(Value::String(format!(
                "{} × {}",
                es_number(x),
                es_number(y)
            )));
        }
    }
    Some(Value::String(json_text(&canonical(value))))
}

/// `list_text` (`ecad-parse.mjs:347-349`).
#[must_use]
pub(crate) fn list_text(values: &[Value]) -> Option<Value> {
    let parts: Vec<String> = values
        .iter()
        .filter(|value| !is_falsy(value))
        .map(js_string)
        .collect();
    if parts.is_empty() {
        None
    } else {
        Some(Value::String(parts.join(", ")))
    }
}

/// `object_text` (`ecad-parse.mjs:351-354`).
#[must_use]
pub(crate) fn object_text(value: Option<&Value>) -> Option<Value> {
    let value = value?;
    if is_falsy(value) || !value.is_object() {
        return Some(value.clone());
    }
    Some(Value::String(json_text(&canonical(value))))
}

/// `stroke_text` (`ecad-parse.mjs:356-362`).
#[must_use]
pub(crate) fn stroke_text(stroke: Option<&Value>) -> Option<Value> {
    let stroke = stroke?;
    if is_falsy(stroke) {
        return None;
    }
    let map = stroke.as_object()?;
    let mut parts: Vec<String> = Vec::new();
    if let Some(width) = map.get("width") {
        if !width.is_null() {
            parts.push(format!("{} mm", js_string(width)));
        }
    }
    if let Some(kind) = map.get("type") {
        if !is_falsy(kind) {
            parts.push(js_string(kind));
        }
    }
    if parts.is_empty() {
        Some(Value::String(json_text(&canonical(stroke))))
    } else {
        Some(Value::String(parts.join(", ")))
    }
}

/// `graphic_review_fields` (`ecad-parse.mjs:364-371`).
#[must_use]
pub(crate) fn graphic_review_fields(item: &Value) -> Value {
    entry(vec![
        (
            "Graphic type",
            item.get("type").cloned().filter(|v| !v.is_null()),
        ),
        ("Text", item.get("text").cloned().filter(|v| !v.is_null())),
        ("Stroke", stroke_text(item.get("stroke"))),
        ("Fill", object_text(item.get("fill"))),
    ])
}

/// `zone_review_fields` (`ecad-parse.mjs:373-384`).
#[must_use]
pub(crate) fn zone_review_fields(zone: &Value) -> Value {
    let layers: Vec<Value> = match zone.get("layers") {
        Some(Value::Array(items)) => items.clone(),
        _ => match zone.get("layer") {
            Some(layer) if !is_falsy(layer) => vec![layer.clone()],
            _ => Vec::new(),
        },
    };
    entry(vec![
        (
            "Zone name",
            zone.get("name").cloned().filter(|v| !v.is_null()),
        ),
        ("Zone layers", list_text(&layers)),
        (
            "Priority",
            zone.get("priority").cloned().filter(|v| !v.is_null()),
        ),
        ("Hatch", object_text(zone.get("hatch"))),
        ("Pad connection", object_text(zone.get("connect_pads"))),
        (
            "Minimum thickness",
            zone.get("min_thickness").cloned().filter(|v| !v.is_null()),
        ),
        ("Keepout", object_text(zone.get("keepout"))),
        ("Fill rules", object_text(zone.get("fill"))),
    ])
}

fn is_falsy(value: &Value) -> bool {
    matches!(value, Value::Null | Value::Bool(false))
        || value.as_f64() == Some(0.0)
        || value.as_str() == Some("")
}

/// ECMAScript `String(value)` for the values review texts join.
fn js_string(value: &Value) -> String {
    match value {
        Value::Null => "null".to_owned(),
        Value::Bool(true) => "true".to_owned(),
        Value::Bool(false) => "false".to_owned(),
        Value::Number(number) => es_number(number.as_f64().unwrap_or(0.0)),
        Value::String(text) => text.clone(),
        Value::Array(items) => items.iter().map(js_string).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".to_owned(),
    }
}

// -------------------------------------------------------------- humanize etc.

const SETTING_LABELS: [(&str, &str); 25] = [
    ("COPYRIGHT", "Copyright"),
    ("DATE", "Date"),
    ("LICENSE", "License"),
    ("TITLE", "Title"),
    ("VERSION", "Revision / version"),
    ("allow_blind_buried_vias", "Allow blind/buried vias"),
    ("allow_microvias", "Allow microvias"),
    ("max_error", "Maximum approximation error (mm)"),
    ("min_clearance", "Minimum copper clearance (mm)"),
    ("min_connection", "Minimum connection width (mm)"),
    (
        "min_copper_edge_clearance",
        "Minimum copper-to-edge clearance (mm)",
    ),
    (
        "min_hole_clearance",
        "Minimum copper-to-hole clearance (mm)",
    ),
    ("min_hole_to_hole", "Minimum hole-to-hole clearance (mm)"),
    ("min_microvia_diameter", "Minimum microvia diameter (mm)"),
    ("min_microvia_drill", "Minimum microvia drill (mm)"),
    ("min_resolved_spokes", "Minimum resolved thermal spokes"),
    ("min_silk_clearance", "Minimum silkscreen clearance (mm)"),
    ("min_text_height", "Minimum text height (mm)"),
    ("min_text_thickness", "Minimum text thickness (mm)"),
    (
        "min_through_hole_diameter",
        "Minimum through-hole diameter (mm)",
    ),
    ("min_track_width", "Minimum track width (mm)"),
    ("min_via_annular_width", "Minimum via annular width (mm)"),
    ("min_via_diameter", "Minimum via diameter (mm)"),
    (
        "solder_mask_to_copper_clearance",
        "Solder-mask-to-copper clearance (mm)",
    ),
    (
        "use_height_for_length_calcs",
        "Include via height in length calculations",
    ),
];

/// `humanize_setting` (`ecad-parse.mjs:428-434`).
#[must_use]
pub(crate) fn humanize_setting(key: &str) -> String {
    if let Some((_, label)) = SETTING_LABELS.iter().find(|(name, _)| *name == key) {
        return (*label).to_owned();
    }
    let stripped = key.strip_prefix("td_").unwrap_or(key);
    let spaced = stripped.replace('_', " ");
    let mut out = String::with_capacity(spaced.len());
    let mut at_word_start = true;
    for character in spaced.chars() {
        if character.is_whitespace() {
            at_word_start = true;
            out.push(character);
        } else if at_word_start {
            out.extend(character.to_uppercase());
            at_word_start = false;
        } else {
            out.push(character);
        }
    }
    out
}

/// `flattened_review_fields` (`ecad-parse.mjs:436-454`).
pub(crate) fn flattened_review_fields(
    value: Option<&Value>,
    prefix: &str,
    fields: &mut Map<String, Value>,
) {
    let Some(value) = value else {
        return;
    };
    let Value::Object(map) = value else {
        if !prefix.is_empty() {
            fields.insert(prefix.to_owned(), canonical(value));
        }
        return;
    };
    for (key, child) in map {
        if key == "meta" {
            continue;
        }
        let label = if prefix.is_empty() {
            humanize_setting(key)
        } else {
            format!("{prefix} · {}", humanize_setting(key))
        };
        if child.is_object() {
            flattened_review_fields(Some(child), &label, fields);
        } else if !child.is_null() {
            fields.insert(label, canonical(child));
        }
    }
}

fn flattened_value(value: Option<&Value>) -> Value {
    let mut fields = Map::new();
    flattened_review_fields(value, "", &mut fields);
    Value::Object(fields)
}

/// `formatted_dimensions` (`ecad-parse.mjs:456-461`).
fn formatted_dimensions(values: Option<&Value>, keys: &[&str]) -> Option<Value> {
    let Value::Array(items) = values? else {
        return None;
    };
    if items.is_empty() {
        return None;
    }
    let rendered: Vec<Value> = items
        .iter()
        .map(|value| {
            let parts: Vec<String> = keys
                .iter()
                .map(|key| {
                    let item = value
                        .get(*key)
                        .filter(|v| !v.is_null())
                        .cloned()
                        .unwrap_or(json!(0));
                    format!("{} {}", humanize_setting(key), json_text(&canonical(&item)))
                })
                .collect();
            Value::String(parts.join(" / "))
        })
        .collect();
    Some(Value::Array(rendered))
}

/// `routing_preset_fields` (`ecad-parse.mjs:463-475`).
fn routing_preset_fields(settings: &Value) -> Value {
    let track_widths = settings
        .get("track_widths")
        .filter(|v| !v.is_null())
        .map(|v| canonical(v));
    entry(vec![
        ("Track widths (mm)", track_widths),
        (
            "Via presets (mm)",
            formatted_dimensions(settings.get("via_dimensions"), &["diameter", "drill"]),
        ),
        (
            "Differential-pair presets (mm)",
            formatted_dimensions(
                settings.get("diff_pair_dimensions"),
                &["width", "gap", "via_gap"],
            ),
        ),
    ])
}

fn exclusion_details(signature: &str, erc: bool) -> (String, Value) {
    let mut parts = signature.split('|');
    let violation = parts.next().unwrap_or("").to_owned();
    let violation = if violation.is_empty() {
        if erc {
            "ERC violation"
        } else {
            "DRC violation"
        }
        .to_owned()
    } else {
        violation
    };
    let raw_x = parts.next().unwrap_or("");
    let raw_y = parts.next().unwrap_or("");
    let objects: Vec<&str> = parts.collect();
    let divisor = if erc { 1e4 } else { 1e6 };
    let x = raw_x.parse::<f64>().ok();
    let y = raw_y.parse::<f64>().ok();
    let location = match (x, y) {
        (Some(x), Some(y)) => Some(format!(
            "{} × {} mm",
            es_number(super::units::round6(x / divisor)),
            es_number(super::units::round6(y / divisor))
        )),
        _ => None,
    };
    let violation_label = humanize_setting(&violation);
    let label = match &location {
        Some(location) => format!("{violation_label} at {location}"),
        None => violation_label.clone(),
    };
    let affected = objects.iter().filter(|object| !object.is_empty()).count();
    let count = json!(affected);
    let fields = entry(vec![
        ("Violation", Some(Value::String(violation_label))),
        ("Location", location.map(Value::String)),
        (
            if erc {
                "Affected items"
            } else {
                "Affected objects"
            },
            Some(count),
        ),
    ]);
    (label, fields)
}

fn erc_severity(level: f64) -> String {
    match level as i64 {
        0 => "Allowed".to_owned(),
        1 => "Warning".to_owned(),
        2 => "Error".to_owned(),
        3 => "Excluded".to_owned(),
        _ => format!("Level {}", es_number(level)),
    }
}

const ERC_PIN_TYPES: [&str; 12] = [
    "Input",
    "Output",
    "Bidirectional",
    "Tri-state",
    "Passive",
    "Free",
    "Unspecified",
    "Power input",
    "Power output",
    "Open collector",
    "Open emitter",
    "No connect",
];

fn net_class_review_fields(net_class: &Value) -> Value {
    let get = |key: &str| net_class.get(key).cloned().filter(|v| !v.is_null());
    entry(vec![
        ("Clearance", get("clearance")),
        ("Track width", get("track_width")),
        ("Via diameter", get("via_diameter")),
        ("Via drill", get("via_drill")),
        ("Microvia diameter", get("microvia_diameter")),
        ("Microvia drill", get("microvia_drill")),
        ("Differential pair width", get("diff_pair_width")),
        ("Differential pair gap", get("diff_pair_gap")),
        ("Differential pair via gap", get("diff_pair_via_gap")),
    ])
}

fn text_of(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => js_string(other),
    }
}

// ------------------------------------------------------------- .kicad_pro

/// `index_project` (`ecad-parse.mjs:553-739`) plus the transform
/// (`capture/board_objects.py:453-497`).
#[must_use]
pub(crate) fn project(
    _path: &str,
    text: &str,
    _warnings: &mut Vec<ProducerWarning>,
) -> Option<Vec<Value>> {
    let project: Value = serde_json::from_str(text).ok()?;
    let net_settings = project
        .get("net_settings")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let classes = net_settings
        .get("classes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let assignments = net_settings
        .get("netclass_assignments")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let patterns = net_settings
        .get("netclass_patterns")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let design = project
        .pointer("/board/design_settings")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let erc = project.get("erc").cloned().unwrap_or_else(|| json!({}));
    let mut objects = Vec::new();

    for net_class in &classes {
        let name = text_of(net_class.get("name").unwrap_or(&Value::Null))
            .trim()
            .to_owned();
        if name.is_empty() {
            continue;
        }
        let fields = net_class_review_fields(net_class);
        objects.push(json!({
            "kind": "net-class",
            "id": review_id("net_class", &name),
            "name": name,
            "reviewFields": fields,
        }));
    }
    if let Value::Object(map) = &assignments {
        for (pattern, assigned) in map {
            let name = pattern.trim().to_owned();
            if name.is_empty() {
                continue;
            }
            let fields = entry(vec![
                ("Net pattern", Some(Value::String(name.clone()))),
                ("Net class", Some(assigned.clone()).filter(|v| !v.is_null())),
            ]);
            push_unchecked(&mut objects, "net_class_assignment", &name, &name, fields);
        }
    }
    for assignment in &patterns {
        let name = text_of(assignment.get("pattern").unwrap_or(&Value::Null))
            .trim()
            .to_owned();
        if name.is_empty() {
            continue;
        }
        let fields = entry(vec![
            ("Net pattern", Some(Value::String(name.clone()))),
            (
                "Net class",
                assignment.get("netclass").cloned().filter(|v| !v.is_null()),
            ),
        ]);
        push_unchecked(&mut objects, "net_class_assignment", &name, &name, fields);
    }

    push_review(
        &mut objects,
        "board_constraint",
        "Board constraints",
        "Board constraints",
        flattened_value(design.get("rules")),
    );
    push_review(
        &mut objects,
        "drc_severity",
        "DRC severities",
        "DRC severities",
        flattened_value(design.get("rule_severities")),
    );
    push_review(
        &mut objects,
        "routing_preset",
        "Routing presets",
        "Routing presets",
        routing_preset_fields(&design),
    );
    push_review(
        &mut objects,
        "board_default",
        "Board drawing defaults",
        "Board drawing defaults",
        flattened_value(design.get("defaults")),
    );
    let teardrop = entry(vec![
        (
            "Options",
            design
                .get("teardrop_options")
                .filter(|v| !v.is_null())
                .map(|v| canonical(v)),
        ),
        (
            "Parameters",
            design
                .get("teardrop_parameters")
                .filter(|v| !v.is_null())
                .map(|v| canonical(v)),
        ),
    ]);
    push_review(
        &mut objects,
        "teardrop_setting",
        "Teardrop settings",
        "Teardrop settings",
        teardrop,
    );
    let zone = entry(vec![
        (
            "Allow external fillets",
            design
                .get("zones_allow_external_fillets")
                .cloned()
                .filter(|v| !v.is_null()),
        ),
        (
            "Use no outline",
            design
                .get("zones_use_no_outline")
                .cloned()
                .filter(|v| !v.is_null()),
        ),
    ]);
    push_review(
        &mut objects,
        "zone_setting",
        "Zone settings",
        "Zone settings",
        zone,
    );

    if let Some(Value::Array(exclusions)) = design.get("drc_exclusions") {
        for signature in exclusions {
            if let Value::String(signature) = signature {
                let (label, fields) = exclusion_details(signature, false);
                let count = fields
                    .get("Affected objects")
                    .cloned()
                    .unwrap_or(Value::Null);
                let identity = format!("{label}:{}", js_string(&count));
                push_review(&mut objects, "drc_exclusion", &label, &identity, fields);
            }
        }
    }
    if let Some(Value::Array(exclusions)) = erc.get("erc_exclusions") {
        for signature in exclusions {
            if let Value::String(signature) = signature {
                let (label, fields) = exclusion_details(signature, true);
                let count = fields.get("Affected items").cloned().unwrap_or(Value::Null);
                let identity = format!("{label}:{}", js_string(&count));
                push_review(&mut objects, "erc_exclusion", &label, &identity, fields);
            }
        }
    }
    if let Some(Value::Array(pin_map)) = erc.get("pin_map") {
        for (left, row) in pin_map.iter().enumerate() {
            let Some(row) = row.as_array() else {
                continue;
            };
            for (right, level) in row.iter().enumerate().skip(left) {
                let Some(level) = level.as_f64() else {
                    continue;
                };
                let left_name = ERC_PIN_TYPES
                    .get(left)
                    .map_or_else(|| format!("Pin type {left}"), |name| (*name).to_owned());
                let right_name = ERC_PIN_TYPES
                    .get(right)
                    .map_or_else(|| format!("Pin type {right}"), |name| (*name).to_owned());
                let name = format!("{left_name} ↔ {right_name}");
                let fields = entry(vec![
                    ("Pin type A", Some(Value::String(left_name))),
                    ("Pin type B", Some(Value::String(right_name))),
                    ("Severity", Some(Value::String(erc_severity(level)))),
                ]);
                let identity = format!("{left}:{right}");
                push_review(&mut objects, "erc_pin_rule", &name, &identity, fields);
            }
        }
    }
    push_review(
        &mut objects,
        "project_metadata",
        "Project title-block variables",
        "Project title-block variables",
        flattened_value(project.get("text_variables")),
    );

    Some(finish_review(objects))
}

// ---------------------------------------------------------- .kicad_dru

/// `index_design_rules` (`ecad-parse.mjs:811-858`).
#[must_use]
pub(crate) fn design_rules(_path: &str, text: &str) -> Vec<Value> {
    let Ok(roots) = parse_sexpressions(text) else {
        return Vec::new();
    };
    let mut objects = Vec::new();
    for rule in &roots {
        let Value::Array(items) = rule else {
            continue;
        };
        if items.first().and_then(Value::as_str) != Some("rule") {
            continue;
        }
        let name = items
            .get(1)
            .map(text_of)
            .unwrap_or_default()
            .trim()
            .to_owned();
        let name = if name.is_empty() {
            "Unnamed custom rule".to_owned()
        } else {
            name
        };
        let fields = rule_review_fields(rule);
        push_review(&mut objects, "custom_rule", &name, &name, fields);
    }
    finish_review(objects)
}

/// `rule_review_fields` (`ecad-parse.mjs:819-834`).
fn rule_review_fields(rule: &Value) -> Value {
    let Some(items) = rule.as_array() else {
        return Value::Object(Map::new());
    };
    let mut fields = Map::new();
    let mut repeated: BTreeMap<String, usize> = BTreeMap::new();
    for clause in items.iter().skip(2) {
        let Some(clause) = clause.as_array() else {
            continue;
        };
        if clause.is_empty() {
            continue;
        }
        let raw_name = text_of(&clause[0]);
        let number = repeated.entry(raw_name.clone()).or_insert(0);
        *number += 1;
        let label = if *number > 1 {
            format!("{} {}", humanize_setting(&raw_name), number)
        } else {
            humanize_setting(&raw_name)
        };
        let rendered: Vec<String> = clause.iter().skip(1).map(sexpr_text).collect();
        fields.insert(label, Value::String(rendered.join(" ")));
    }
    fields.insert("Definition".to_owned(), Value::String(sexpr_text(rule)));
    Value::Object(fields)
}

/// `sexpr_text` (`ecad-parse.mjs:811-817`).
fn sexpr_text(value: &Value) -> String {
    match value {
        Value::Array(items) => {
            let parts: Vec<String> = items.iter().map(sexpr_text).collect();
            format!("({})", parts.join(" "))
        }
        other => {
            let text = js_string(other);
            if text
                .chars()
                .any(|character| character.is_whitespace() || matches!(character, '(' | ')'))
            {
                json_string(&text)
            } else {
                text
            }
        }
    }
}

/// `parse_sexpressions` (`ecad-parse.mjs:748-809`).
fn parse_sexpressions(text: &str) -> Result<Vec<Value>, ()> {
    let mut roots: Vec<Value> = Vec::new();
    let mut stack: Vec<Vec<Value>> = Vec::new();
    let mut chars = text.char_indices().peekable();
    while let Some((index, character)) = chars.next() {
        if character.is_whitespace() {
            continue;
        }
        if character == ';' || character == '#' {
            for (_, next) in chars.by_ref() {
                if next == '\n' {
                    break;
                }
            }
            continue;
        }
        match character {
            '(' => stack.push(Vec::new()),
            ')' => {
                let Some(items) = stack.pop() else {
                    return Err(());
                };
                push_form(&mut roots, &mut stack, Value::Array(items));
            }
            '"' => {
                let mut value = String::new();
                while let Some((_, next)) = chars.next() {
                    if next == '"' {
                        break;
                    }
                    if next == '\\' {
                        if let Some((_, escaped)) = chars.next() {
                            match escaped {
                                'n' => value.push('\n'),
                                't' => value.push('\t'),
                                other => value.push(other),
                            }
                        }
                    } else {
                        value.push(next);
                    }
                }
                push_form(&mut roots, &mut stack, Value::String(value));
            }
            _ => {
                let start = index;
                let mut end = index + character.len_utf8();
                while let Some(&(next_index, next)) = chars.peek() {
                    if next.is_whitespace() || next == '(' || next == ')' {
                        break;
                    }
                    chars.next();
                    end = next_index + next.len_utf8();
                }
                push_form(
                    &mut roots,
                    &mut stack,
                    Value::String(text[start..end].to_owned()),
                );
            }
        }
    }
    if stack.is_empty() { Ok(roots) } else { Err(()) }
}

fn push_form(roots: &mut Vec<Value>, stack: &mut [Vec<Value>], value: Value) {
    if let Some(top) = stack.last_mut() {
        top.push(value);
    } else {
        roots.push(value);
    }
}

// ---------------------------------------------------------- board / bus alias

/// `bus_alias` review objects from a schematic (`ecad-parse.mjs:1051-1066`).
pub(crate) fn bus_aliases(schematic: &Node, objects: &mut Vec<Value>) {
    for alias in schematic.children("bus_alias") {
        let name = tree::text_at(alias, 1)
            .unwrap_or_default()
            .trim()
            .to_owned();
        if name.is_empty() {
            continue;
        }
        let members: Vec<Value> = alias
            .child("members")
            .and_then(Node::items)
            .map(|items| {
                items
                    .iter()
                    .skip(1)
                    .map(|item| Value::String(item.text().unwrap_or_default().to_owned()))
                    .collect()
            })
            .unwrap_or_default();
        let joined = members.iter().map(js_string).collect::<Vec<_>>().join(", ");
        let fields = entry(vec![
            ("Bus alias", Some(Value::String(name.clone()))),
            ("Members", Some(Value::String(joined))),
        ]);
        push_review(objects, "bus_alias", &name, &name, fields);
    }
}

/// `fabrication_output_fields` (`ecad-parse.mjs:1247-1284`).
#[must_use]
pub(crate) fn fabrication_output(board_root: &Node) -> Value {
    let setup = board_root.child("setup");
    let plot = setup.and_then(|setup| setup.child("pcbplotparams"));
    let layers: Vec<Value> = board_root
        .child("layers")
        .and_then(Node::items)
        .map(|items| layers_of(items))
        .unwrap_or_default();
    let output_formats = |value: Option<f64>| -> Value {
        match value {
            Some(1.0) => Value::String("Gerber".to_owned()),
            Some(2.0) => Value::String("PostScript".to_owned()),
            Some(3.0) => Value::String("SVG".to_owned()),
            Some(4.0) => Value::String("DXF".to_owned()),
            Some(5.0) => Value::String("HPGL".to_owned()),
            Some(6.0) => Value::String("PDF".to_owned()),
            Some(other) => shapes::number(other),
            None => Value::Null,
        }
    };
    let pair = |key: &str| plot.and_then(|plot| tree::child_number(plot, key));
    let text_pair = |key: &str| plot.and_then(|plot| tree::child_text(plot, key));
    let boolean_pair = |key: &str| text_pair(key).map(|text| Value::Bool(shapes::boolean(&text)));
    let clear = |key: &str| setup.and_then(|setup| tree::child_number(setup, key));
    entry(vec![
        (
            "Solder mask expansion (mm)",
            clear("pad_to_mask_clearance").map(shapes::number),
        ),
        (
            "Solder paste clearance (mm)",
            clear("pad_to_paste_clearance").map(shapes::number),
        ),
        (
            "Solder paste clearance ratio",
            clear("pad_to_paste_clearance_ratio").map(shapes::number),
        ),
        (
            "Plot layers",
            selected_layer_names(pair("layerselection"), &layers),
        ),
        (
            "Plot on all layers",
            selected_layer_names(pair("plot_on_all_layers_selection"), &layers),
        ),
        (
            "Output format",
            Some(output_formats(pair("outputformat"))).filter(|v| !v.is_null()),
        ),
        (
            "Output directory",
            text_pair("outputdirectory").map(Value::String),
        ),
        (
            "Use Gerber file extensions",
            boolean_pair("usegerberextensions"),
        ),
        (
            "Use Gerber X2 attributes",
            boolean_pair("usegerberattributes"),
        ),
        (
            "Use Gerber net attributes",
            boolean_pair("usegerberadvancedattributes"),
        ),
        (
            "Create Gerber job file",
            boolean_pair("creategerberjobfile"),
        ),
        ("Plot drawing sheet", boolean_pair("plotframeref")),
        ("Plot reference designators", boolean_pair("plotreference")),
        ("Plot component values", boolean_pair("plotvalue")),
        ("Plot invisible text", boolean_pair("plotinvisibletext")),
        (
            "Sketch pads on fabrication layers",
            boolean_pair("sketchpadsonfab"),
        ),
        (
            "Subtract solder mask from silkscreen",
            boolean_pair("subtractmaskfromsilk"),
        ),
        ("Include vias on solder mask", boolean_pair("viasonmask")),
        ("Use auxiliary origin", boolean_pair("useauxorigin")),
        ("Mirror output", boolean_pair("mirror")),
        ("Drill marks", pair("drillshape").map(shapes::number)),
    ])
}

fn layers_of(items: &[Node]) -> Vec<Value> {
    items
        .iter()
        .filter_map(|layer| {
            let ordinal = tree::number_at(layer, 1)?;
            let canonical_name = tree::text_at(layer, 2)?;
            Some(json!({"ordinal": ordinal as i64, "canonical_name": canonical_name}))
        })
        .collect()
}

fn selected_layer_names(mask: Option<f64>, layers: &[Value]) -> Option<Value> {
    let mask = mask?;
    if mask < 0.0 || mask.fract() != 0.0 || mask > 9_007_199_254_740_991.0 {
        return None;
    }
    let bits = mask as u64;
    let mut selected: Vec<Value> = Vec::new();
    for layer in layers {
        let Some(ordinal) = layer.get("ordinal").and_then(Value::as_u64) else {
            continue;
        };
        if ordinal < 64 && (bits >> ordinal) & 1 == 1 {
            if let Some(name) = layer.get("canonical_name").and_then(Value::as_str) {
                if !name.is_empty() {
                    selected.push(Value::String(name.to_owned()));
                }
            }
        }
    }
    Some(Value::Array(selected))
}
