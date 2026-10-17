//! The `.kicad_pro` review-only objects (`index_project`,
//! `ecad-parse.mjs:553-739`) and their transform
//! (`capture/board_objects.py:453-497`).

use super::{
    entry_value, finish_review, humanize_setting, js_string, push_review, review_id, text_of,
};
use crate::ProducerWarning;
use crate::board_objects::units::{canonical, es_number, json_text, round6};
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;
use serde_json::{Map, Value, json};

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
        .map(canonical);
    entry_value(vec![
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
            es_number(round6(x / divisor)),
            es_number(round6(y / divisor))
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
    let fields = entry_value(vec![
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
    entry_value(vec![
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

// ------------------------------------------------------------- .kicad_pro

/// `index_project` (`ecad-parse.mjs:553-739`) plus the transform
/// (`capture/board_objects.py:453-497`).
#[must_use]
pub(crate) fn project(
    _path: &str,
    text: &str,
    _warnings: &mut Vec<ProducerWarning>,
) -> Option<Vec<bo::BoardObjectsReviewOnlyObject>> {
    let project: Value = serde_json::from_str(text).ok()?;
    let mut objects = Vec::new();
    project_net_settings(&mut objects, &project);
    project_settings(&mut objects, &project);
    project_exclusions(&mut objects, &project);
    project_erc_pin_rules(&mut objects, &project);
    push_review(
        &mut objects,
        "project_metadata",
        "Project title-block variables",
        "Project title-block variables",
        flattened_value(project.get("text_variables")),
    );
    Some(finish_review(objects))
}

/// The net classes, `netclass_assignments` and `netclass_patterns`
/// (`ecad-parse.mjs:567-616`).
fn project_net_settings(objects: &mut Vec<Value>, project: &Value) {
    let net_settings = project
        .get("net_settings")
        .cloned()
        .unwrap_or_else(|| json!({}));
    let classes = net_settings
        .get("classes")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
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
    if let Value::Object(map) = net_settings
        .get("netclass_assignments")
        .cloned()
        .unwrap_or_else(|| json!({}))
    {
        for (pattern, assigned) in &map {
            let name = pattern.trim().to_owned();
            if name.is_empty() {
                continue;
            }
            let fields = entry_value(vec![
                ("Net pattern", Some(Value::String(name.clone()))),
                ("Net class", Some(assigned.clone()).filter(|v| !v.is_null())),
            ]);
            push_unchecked(objects, "net_class_assignment", &name, &name, fields);
        }
    }
    let patterns = net_settings
        .get("netclass_patterns")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    for assignment in &patterns {
        let name = text_of(assignment.get("pattern").unwrap_or(&Value::Null))
            .trim()
            .to_owned();
        if name.is_empty() {
            continue;
        }
        let fields = entry_value(vec![
            ("Net pattern", Some(Value::String(name.clone()))),
            (
                "Net class",
                assignment.get("netclass").cloned().filter(|v| !v.is_null()),
            ),
        ]);
        push_unchecked(objects, "net_class_assignment", &name, &name, fields);
    }
}

/// `board.design_settings` (`ecad-parse.mjs:563`).
fn design_settings(project: &Value) -> Value {
    project
        .pointer("/board/design_settings")
        .cloned()
        .unwrap_or_else(|| json!({}))
}

/// The `.kicad_pro` singleton settings objects (`ecad-parse.mjs:618-659`).
fn project_settings(objects: &mut Vec<Value>, project: &Value) {
    let design = design_settings(project);
    push_review(
        objects,
        "board_constraint",
        "Board constraints",
        "Board constraints",
        flattened_value(design.get("rules")),
    );
    push_review(
        objects,
        "drc_severity",
        "DRC severities",
        "DRC severities",
        flattened_value(design.get("rule_severities")),
    );
    push_review(
        objects,
        "routing_preset",
        "Routing presets",
        "Routing presets",
        routing_preset_fields(&design),
    );
    push_review(
        objects,
        "board_default",
        "Board drawing defaults",
        "Board drawing defaults",
        flattened_value(design.get("defaults")),
    );
    let teardrop = entry_value(vec![
        (
            "Options",
            design
                .get("teardrop_options")
                .filter(|v| !v.is_null())
                .map(canonical),
        ),
        (
            "Parameters",
            design
                .get("teardrop_parameters")
                .filter(|v| !v.is_null())
                .map(canonical),
        ),
    ]);
    push_review(
        objects,
        "teardrop_setting",
        "Teardrop settings",
        "Teardrop settings",
        teardrop,
    );
    let zone = entry_value(vec![
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
        objects,
        "zone_setting",
        "Zone settings",
        "Zone settings",
        zone,
    );
}

/// The DRC and ERC exclusions (`ecad-parse.mjs:661-688`).
fn project_exclusions(objects: &mut Vec<Value>, project: &Value) {
    let design = design_settings(project);
    let erc = project.get("erc").cloned().unwrap_or_else(|| json!({}));
    for (key, kind, affected, is_erc) in [
        ("drc_exclusions", "drc_exclusion", "Affected objects", false),
        ("erc_exclusions", "erc_exclusion", "Affected items", true),
    ] {
        let source = if is_erc { &erc } else { &design };
        if let Some(Value::Array(exclusions)) = source.get(key) {
            for signature in exclusions {
                let Value::String(signature) = signature else {
                    continue;
                };
                let (label, fields) = exclusion_details(signature, is_erc);
                let count = fields.get(affected).cloned().unwrap_or(Value::Null);
                let identity = format!("{label}:{}", js_string(&count));
                push_review(objects, kind, &label, &identity, fields);
            }
        }
    }
}

/// The ERC pin-conflict matrix (`ecad-parse.mjs:690-711`).
fn project_erc_pin_rules(objects: &mut Vec<Value>, project: &Value) {
    let erc = project.get("erc").cloned().unwrap_or_else(|| json!({}));
    let Some(Value::Array(pin_map)) = erc.get("pin_map") else {
        return;
    };
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
            let fields = entry_value(vec![
                ("Pin type A", Some(Value::String(left_name))),
                ("Pin type B", Some(Value::String(right_name))),
                ("Severity", Some(Value::String(erc_severity(level)))),
            ]);
            let identity = format!("{left}:{right}");
            push_review(objects, "erc_pin_rule", &name, &identity, fields);
        }
    }
}
