//! Review values and review-only objects (field map, "Review fields",
//! "Review-only ids and names"), a port of `ecad-parse.mjs:222-551`,
//! `:553-858`, `:1051-1066`, `:1586-1591` and the transform in
//! `capture/board_objects.py:214-502`.

mod project;
pub(crate) mod shapes;

pub(crate) use project::project;

use super::blake2b;
use super::tree::{self, Node};
use super::units::{canonical, es_number, json_string, json_text};
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// `entry(fields)`: drop undefined and null, keep `false`, `0` and `""`
/// (`ecad-parse.mjs:328-336`).
#[must_use]
pub(crate) fn entry(pairs: Vec<(&str, Option<Value>)>) -> Value {
    let mut out = Map::new();
    for (key, value) in pairs {
        if let Some(value) = value
            && !value.is_null()
        {
            out.insert(key.to_owned(), value);
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
    if let Value::Object(map) = value
        && let (Some(x), Some(y)) = (
            map.get("x").and_then(Value::as_f64),
            map.get("y").and_then(Value::as_f64),
        )
    {
        return Some(Value::String(format!(
            "{} × {}",
            es_number(x),
            es_number(y)
        )));
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
    if let Some(width) = map.get("width")
        && !width.is_null()
    {
        parts.push(format!("{} mm", js_string(width)));
    }
    if let Some(kind) = map.get("type")
        && !is_falsy(kind)
    {
        parts.push(js_string(kind));
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
pub(crate) fn js_string(value: &Value) -> String {
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

/// ECMAScript `String(value)` for a JSON value (`ecad-parse.mjs:492-498`).
pub(crate) fn text_of(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        other => js_string(other),
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

/// `parse_sexpressions` (`ecad-parse.mjs:748-809`): a tolerant multi-root
/// reader for `.kicad_dru` files.
fn parse_sexpressions(text: &str) -> Result<Vec<Value>, ()> {
    SexprReader {
        chars: text.char_indices().peekable(),
        text,
        roots: Vec::new(),
        stack: Vec::new(),
    }
    .run()
}

struct SexprReader<'a> {
    chars: std::iter::Peekable<std::str::CharIndices<'a>>,
    text: &'a str,
    roots: Vec<Value>,
    stack: Vec<Vec<Value>>,
}

impl SexprReader<'_> {
    fn run(mut self) -> Result<Vec<Value>, ()> {
        while let Some((index, character)) = self.chars.next() {
            if character.is_whitespace() {
                continue;
            }
            if character == ';' || character == '#' {
                self.skip_comment();
                continue;
            }
            self.step(index, character)?;
        }
        if self.stack.is_empty() {
            Ok(self.roots)
        } else {
            Err(())
        }
    }

    fn step(&mut self, index: usize, character: char) -> Result<(), ()> {
        match character {
            '(' => self.stack.push(Vec::new()),
            ')' => {
                let Some(items) = self.stack.pop() else {
                    return Err(());
                };
                self.push(Value::Array(items));
            }
            '"' => {
                let value = self.read_string();
                self.push(Value::String(value));
            }
            _ => {
                let atom = self.read_atom(index, character);
                self.push(Value::String(atom));
            }
        }
        Ok(())
    }

    fn skip_comment(&mut self) {
        for (_, next) in self.chars.by_ref() {
            if next == '\n' {
                break;
            }
        }
    }

    fn read_string(&mut self) -> String {
        let mut value = String::new();
        while let Some((_, next)) = self.chars.next() {
            if next == '"' {
                break;
            }
            if next != '\\' {
                value.push(next);
                continue;
            }
            if let Some((_, escaped)) = self.chars.next() {
                value.push(match escaped {
                    'n' => '\n',
                    't' => '\t',
                    other => other,
                });
            }
        }
        value
    }

    fn read_atom(&mut self, index: usize, character: char) -> String {
        let mut end = index + character.len_utf8();
        while let Some(&(next_index, next)) = self.chars.peek() {
            if next.is_whitespace() || next == '(' || next == ')' {
                break;
            }
            self.chars.next();
            end = next_index + next.len_utf8();
        }
        self.text[index..end].to_owned()
    }

    fn push(&mut self, value: Value) {
        if let Some(top) = self.stack.last_mut() {
            top.push(value);
        } else {
            self.roots.push(value);
        }
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
        .map(layers_of)
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
        if ordinal < 64
            && (bits >> ordinal) & 1 == 1
            && let Some(name) = layer.get("canonical_name").and_then(Value::as_str)
            && !name.is_empty()
        {
            selected.push(Value::String(name.to_owned()));
        }
    }
    Some(Value::Array(selected))
}
