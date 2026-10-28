//! The parse shapes today's index builds for board and schematic forms
//! (`backend/design-compare-parser/vendor/kicad-sexpr-parser.mjs`), as
//! `serde_json::Value` objects. They are inputs to the review-field texts
//! (`ecad-parse.mjs:338-384`) and to `canonical` JSON.

use super::tree::{self, Node};
use serde_json::{Map, Value, json};

/// `T.boolean` (`kicad-sexpr-parser.mjs:216-228`).
#[must_use]
pub(crate) fn boolean(text: &str) -> bool {
    match text {
        "false" | "no" => false,
        "true" | "yes" => true,
        _ => !text.is_empty(),
    }
}

/// The `(color r g b [a])` shape (`T.color`, `kicad-sexpr-parser.mjs:280-288`).
#[must_use]
pub(crate) fn color(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    if let Some(r) = tree::number_at(node, 1) {
        out.insert("r".to_owned(), number(r / 255.0));
    }
    if let Some(g) = tree::number_at(node, 2) {
        out.insert("g".to_owned(), number(g / 255.0));
    }
    if let Some(b) = tree::number_at(node, 3) {
        out.insert("b".to_owned(), number(b / 255.0));
    }
    let alpha = tree::number_at(node, 4).unwrap_or(1.0);
    out.insert("a".to_owned(), number(alpha));
    Value::Object(out)
}

/// The `(stroke …)` shape (`parseStroke`, `kicad-sexpr-parser.mjs:502-510`).
#[must_use]
pub(crate) fn stroke(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    if let Some(width) = tree::child_number(node, "width") {
        out.insert("width".to_owned(), number(width));
    }
    if let Some(kind) = tree::child_text(node, "type") {
        out.insert("type".to_owned(), Value::String(kind));
    }
    if let Some(child) = node.child("color") {
        out.insert("color".to_owned(), color(child));
    }
    Value::Object(out)
}

/// The schematic `(fill …)` shape (`parseFill`, `kicad-sexpr-parser.mjs:2600-2611`).
#[must_use]
pub(crate) fn sch_fill(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    out.insert(
        "type".to_owned(),
        Value::String(tree::child_text(node, "type").unwrap_or_else(|| "none".to_owned())),
    );
    if let Some(child) = node.child("color") {
        out.insert("color".to_owned(), color(child));
    }
    Value::Object(out)
}

/// A `(name x y)` vec2 shape (`T.vec2`, `kicad-sexpr-parser.mjs:272-275`).
#[must_use]
pub(crate) fn vec2(node: &Node<'_>) -> Value {
    json!({
        "x": number(tree::number_at(node, 1).unwrap_or(0.0)),
        "y": number(tree::number_at(node, 2).unwrap_or(0.0)),
    })
}

/// A bare `name` atom or a `(name [value])` pair as a boolean
/// (`P.atom`, `kicad-sexpr-parser.mjs:364-388`).
#[must_use]
pub(crate) fn atom_flag(node: &Node<'_>, name: &str) -> Option<bool> {
    for item in node.items().unwrap_or_default().iter().skip(1) {
        if item.head() == Some(name) {
            return Some(match item.items().and_then(|items| items.get(1)) {
                Some(value) => value.text().is_none_or(boolean),
                None => true,
            });
        }
        if item.text() == Some(name) {
            return Some(true);
        }
    }
    None
}

/// The zone `(fill …)` shape (`parseZoneFill`, `kicad-sexpr-parser.mjs:1055-1082`).
#[must_use]
pub(crate) fn zone_fill(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    if let Some(value) = node
        .items()
        .and_then(|items| items.get(1))
        .and_then(Node::text)
    {
        out.insert("fill".to_owned(), Value::Bool(boolean(value)));
    }
    for key in [
        "mode",
        "thermal_gap",
        "thermal_bridge_width",
        "radius",
        "island_removal_mode",
        "island_area_min",
        "hatch_thickness",
        "hatch_gap",
        "hatch_orientation",
        "hatch_smoothing_level",
        "hatch_smoothing_value",
        "hatch_min_hole_area",
    ] {
        if let Some(value) = tree::child_number(node, key) {
            out.insert(key.to_owned(), number(value));
        }
    }
    if let Some(text) = tree::child_text(node, "hatch_border_algorithm") {
        out.insert("hatch_border_algorithm".to_owned(), Value::String(text));
    }
    if let Some(child) = node.child("smoothing") {
        let mut smoothing = Map::new();
        if let Some(style) = child
            .items()
            .and_then(|items| items.get(1))
            .and_then(Node::text)
        {
            smoothing.insert("style".to_owned(), Value::String(style.to_owned()));
        }
        if let Some(radius) = tree::child_number(child, "radius") {
            smoothing.insert("radius".to_owned(), number(radius));
        }
        out.insert("smoothing".to_owned(), Value::Object(smoothing));
    }
    if let Some(uuid) = tree::child_text(node, "uuid").or_else(|| tree::child_text(node, "tstamp"))
    {
        out.insert("uuid".to_owned(), Value::String(uuid));
    }
    Value::Object(out)
}

/// The `(keepout …)` shape (`parseZoneKeepout`, `kicad-sexpr-parser.mjs:1083-1094`).
#[must_use]
pub(crate) fn zone_keepout(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    for key in ["tracks", "vias", "pads", "copperpour", "footprints"] {
        if let Some(value) = tree::child_text(node, key) {
            out.insert(key.to_owned(), Value::String(value));
        }
    }
    Value::Object(out)
}

/// The `(hatch …)` shape (`parseZone`, `kicad-sexpr-parser.mjs:1105-1112`).
#[must_use]
pub(crate) fn zone_hatch(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    if let Some(style) = node
        .items()
        .and_then(|items| items.get(1))
        .and_then(Node::text)
    {
        out.insert("style".to_owned(), Value::String(style.to_owned()));
    }
    if let Some(pitch) = node
        .items()
        .and_then(|items| items.get(2))
        .and_then(Node::text)
        .and_then(tree::number)
    {
        out.insert("pitch".to_owned(), number(pitch));
    }
    Value::Object(out)
}

/// The `(connect_pads …)` shape (`parseZone`, `kicad-sexpr-parser.mjs:1113-1119`).
#[must_use]
pub(crate) fn zone_connect_pads(node: &Node<'_>) -> Value {
    let mut out = Map::new();
    if let Some(kind) = node
        .items()
        .and_then(|items| items.get(1))
        .and_then(Node::text)
    {
        out.insert("type".to_owned(), Value::String(kind.to_owned()));
    }
    if let Some(clearance) = tree::child_number(node, "clearance") {
        out.insert("clearance".to_owned(), number(clearance));
    }
    Value::Object(out)
}

/// A JSON number from an `f64`.
#[must_use]
pub(crate) fn number(value: f64) -> Value {
    serde_json::Number::from_f64(value).map_or(Value::Null, Value::Number)
}
