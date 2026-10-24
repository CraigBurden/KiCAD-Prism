//! The object index the diff works on: the fields of today's entry, rebuilt
//! from a `board-objects` member object
//! (`field-maps/board-objects.md`, "Rebuilding today's index entry").
//!
//! Only the fields the diff reads are rebuilt. Nanometres become millimetres
//! by `/ 1e6`; a bundle kind's `-` becomes `_`; `rotationDeg` becomes
//! `rotation`; a footprint's `footprintPath` becomes `kiidPaths`;
//! `contentDigest` stands in for today's `hash`; property and effects names
//! are restored. A review-only object has no digest, so its `hash` is the
//! canonical JSON of its review fields, an injective function of them.

use super::CompareError;
use super::canonical::canonical;
use super::json::{self, Point};
use super::numbers::position_text;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

/// One `(property …)` of a symbol, sheet or footprint, as today's index
/// writes it (`ecad-diff.mjs:238-279`).
#[derive(Clone, Debug, PartialEq)]
pub struct Property {
    /// The field name.
    pub name: String,
    /// The field value as written; may be empty.
    pub value: String,
    /// The field's position in millimetres, in that order.
    pub at: Option<Point>,
    /// The field's rotation in degrees.
    pub rotation: Option<f64>,
    /// Whether the field is hidden; today's index omits `false`.
    pub hide: bool,
    /// The field's text effects, in today's parser shape.
    pub effects: Option<Value>,
}

/// One `(path …)` instance of a placed symbol.
#[derive(Clone, Debug, PartialEq)]
pub struct Instance {
    /// The instance's reference; absent when it has none or it is empty.
    pub reference: Option<String>,
    /// The occurrence path, schematic form.
    pub path: Option<String>,
}

/// One object, in the shape the diff reads.
#[derive(Clone, Debug)]
pub struct Entry {
    /// `documentPath#uuid`.
    pub key: String,
    /// The document's path, project-relative (D1).
    pub document_path: String,
    /// The object's id.
    pub uuid: String,
    /// Today's kind spelling, `-` written `_`.
    pub kind: String,
    /// `contentDigest`, today's `hash`.
    pub hash: String,
    /// Today's `generatedHash`; always absent for `board-objects` (T7), kept so
    /// the `generated-content-only` branch can be exercised by a unit test.
    pub generated_hash: Option<String>,
    /// Uuid of the parent.
    pub parent_uuid: Option<String>,
    /// The object's position in millimetres, in that order.
    pub at: Option<Point>,
    /// The object's rotation in degrees.
    pub rotation: Option<f64>,
    /// How a symbol is mirrored.
    pub mirror: Option<String>,
    /// The object's layer as written.
    pub layer: Option<String>,
    /// A via's layer list, in file order.
    pub layers: Option<Vec<String>>,
    /// The object's net, by name.
    pub net: Option<String>,
    /// The object's reference designator.
    pub refdes: Option<String>,
    /// The object's library link.
    pub lib_id: Option<String>,
    /// True when the object is do-not-populate.
    pub dnp: Option<bool>,
    /// False when the object is excluded from the BOM.
    pub in_bom: Option<bool>,
    /// False when the object is not on the board.
    pub on_board: Option<bool>,
    /// Every occurrence path of a symbol or sheet.
    pub kiid_paths: Option<Vec<String>>,
    /// A symbol's instances, in file order.
    pub instances: Option<Vec<Instance>>,
    /// A pad's or pin's number as written.
    pub number: Option<String>,
    /// A label's, sheet pin's or footprint text's text.
    pub text: Option<String>,
    /// A zone's, group's or review-only object's name.
    pub name: Option<String>,
    /// The object's own review fields, exactly as the member carries them.
    pub review_fields: Option<Value>,
    /// True for a review-only object.
    pub review_only: Option<bool>,
    /// The object's own property list, rebuilt, in file order.
    pub properties: Option<Vec<Property>>,
    /// The computed review fields overlaid with the member's own: what
    /// `review_fields(object)` returns (`ecad-diff.mjs:281-296`).
    pub combined_review_fields: BTreeMap<String, Value>,
}

/// One side's rebuilt index entries, opaque outside the engine.
pub struct Entries(pub(crate) Vec<Entry>);

/// Rebuild the entries of `document` (a `board-objects` member), stripping
/// `anchor_dir` from every document path (D1). The member's parsed JSON can be
/// dropped afterwards: nothing borrows from it.
pub fn entries(document: &Value, anchor_dir: &str) -> Result<Entries, CompareError> {
    build(document, anchor_dir).map(Entries)
}

/// [`entries`], as the plain list.
pub fn build(document: &Value, anchor_dir: &str) -> Result<Vec<Entry>, CompareError> {
    let documents = document
        .get("documents")
        .and_then(Value::as_array)
        .ok_or_else(|| CompareError::new("the board-objects member has no documents array"))?;
    let mut entries = Vec::new();
    for doc in documents {
        let path = doc
            .get("path")
            .and_then(Value::as_str)
            .ok_or_else(|| CompareError::new("a board-objects document has no path"))?;
        let document_path = strip_directory(anchor_dir, path);
        for value in array_of(doc, "objects") {
            entries.push(finish(object_entry(value, &document_path)?));
        }
        for value in array_of(doc, "reviewOnlyObjects") {
            entries.push(finish(review_only_entry(value, &document_path)?));
        }
    }
    Ok(entries)
}

/// The anchor's directory: `config.project_file` up to its last `/`.
pub fn anchor_directory(project_file: &str) -> &str {
    project_file
        .rsplit_once('/')
        .map_or("", |(directory, _)| directory)
}

/// `_strip_project_directory` (C8): the document's path below the project
/// directory, or its file name when it lies outside it.
pub(super) fn strip_directory(anchor_dir: &str, path: &str) -> String {
    if anchor_dir.is_empty() {
        return path.to_owned();
    }
    let prefix = format!("{}/", anchor_dir.trim_end_matches('/'));
    match path.strip_prefix(&prefix) {
        Some(rest) => rest.to_owned(),
        None => path.rsplit('/').next().unwrap_or(path).to_owned(),
    }
}

fn array_of<'a>(value: &'a Value, key: &str) -> &'a [Value] {
    value
        .get(key)
        .and_then(Value::as_array)
        .map(Vec::as_slice)
        .unwrap_or(&[])
}

fn object_entry(value: &Value, document_path: &str) -> Result<Entry, CompareError> {
    let kind = normalize_kind(required(value, "kind")?);
    let uuid = required(value, "uuid")?.to_owned();
    let hash = required(value, "contentDigest")?.to_owned();
    let review_fields = value.get("reviewFields").cloned().map(json::ecma);
    Ok(Entry {
        key: key_of(document_path, &uuid),
        document_path: document_path.to_owned(),
        uuid,
        kind,
        hash,
        generated_hash: None,
        parent_uuid: text(value, "parentUuid").map(str::to_owned),
        at: value.get("at").and_then(point_of),
        rotation: value.get("rotationDeg").and_then(Value::as_f64),
        mirror: text(value, "mirror").map(str::to_owned),
        layer: text(value, "layer").map(str::to_owned),
        layers: string_list(value, "layers"),
        net: text(value, "net").map(str::to_owned),
        refdes: text(value, "refdes").map(str::to_owned),
        lib_id: text(value, "libId").map(str::to_owned),
        dnp: value.get("dnp").and_then(Value::as_bool),
        in_bom: value.get("inBom").and_then(Value::as_bool),
        on_board: value.get("onBoard").and_then(Value::as_bool),
        kiid_paths: kiid_paths(value),
        instances: instances(value),
        number: text(value, "number").map(str::to_owned),
        text: text(value, "text").map(str::to_owned),
        name: text(value, "name").map(str::to_owned),
        review_fields,
        review_only: None,
        properties: value
            .get("properties")
            .and_then(Value::as_array)
            .map(|items| parse_properties(items)),
        combined_review_fields: BTreeMap::new(),
    })
}

fn review_only_entry(value: &Value, document_path: &str) -> Result<Entry, CompareError> {
    let kind = normalize_kind(required(value, "kind")?);
    let uuid = required(value, "id")?.to_owned();
    let review_fields = value.get("reviewFields").cloned().map(json::ecma);
    let hash = canonical(review_fields.as_ref().unwrap_or(&Value::Null));
    Ok(Entry {
        key: key_of(document_path, &uuid),
        document_path: document_path.to_owned(),
        uuid,
        kind,
        hash,
        generated_hash: None,
        parent_uuid: None,
        at: None,
        rotation: None,
        mirror: None,
        layer: None,
        layers: None,
        net: None,
        refdes: None,
        lib_id: None,
        dnp: None,
        in_bom: None,
        on_board: None,
        kiid_paths: None,
        instances: None,
        number: None,
        text: None,
        name: text(value, "name").map(str::to_owned),
        review_fields,
        review_only: Some(true),
        properties: None,
        combined_review_fields: BTreeMap::new(),
    })
}

fn finish(mut entry: Entry) -> Entry {
    entry.combined_review_fields = combined_review_fields(&entry);
    entry
}

fn key_of(document_path: &str, uuid: &str) -> String {
    format!("{document_path}#{uuid}")
}

fn normalize_kind(kind: &str) -> String {
    kind.replace('-', "_")
}

fn required<'a>(value: &'a Value, key: &str) -> Result<&'a str, CompareError> {
    text(value, key)
        .ok_or_else(|| CompareError::new(format!("a board-objects object has no {key}")))
}

fn text<'a>(value: &'a Value, key: &str) -> Option<&'a str> {
    value.get(key).and_then(Value::as_str)
}

fn point_of(value: &Value) -> Option<Point> {
    let x = value.get("xNm")?.as_f64()?;
    let y = value.get("yNm")?.as_f64()?;
    Some([x / 1e6, y / 1e6])
}

fn string_list(value: &Value, key: &str) -> Option<Vec<String>> {
    let items = value.get(key).and_then(Value::as_array)?;
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        out.push(item.as_str()?.to_owned());
    }
    Some(out)
}

fn kiid_paths(value: &Value) -> Option<Vec<String>> {
    if let Some(inner) = string_list(value, "kiidPaths") {
        return (!inner.is_empty()).then_some(inner);
    }
    text(value, "footprintPath").map(|path| vec![path.to_owned()])
}

fn instances(value: &Value) -> Option<Vec<Instance>> {
    let items = value.get("instances").and_then(Value::as_array)?;
    let mut out = Vec::with_capacity(items.len());
    for item in items {
        out.push(Instance {
            reference: text(item, "reference")
                .filter(|text| !text.is_empty())
                .map(str::to_owned),
            path: text(item, "path").map(str::to_owned),
        });
    }
    (!out.is_empty()).then_some(out)
}

fn parse_properties(items: &[Value]) -> Vec<Property> {
    items.iter().map(parse_property).collect()
}

fn parse_property(value: &Value) -> Property {
    Property {
        name: text(value, "name").unwrap_or_default().to_owned(),
        value: text(value, "value").unwrap_or_default().to_owned(),
        at: value.get("at").and_then(point_of),
        rotation: value.get("rotationDeg").and_then(Value::as_f64),
        hide: value.get("hide").and_then(Value::as_bool).unwrap_or(false),
        effects: value.get("effects").map(rebuild_effects),
    }
}

fn rebuild_effects(effects: &Value) -> Value {
    let mut out = Map::new();
    if let Some(font) = effects.get("font") {
        json::set(&mut out, "font", rebuild_font(font));
    }
    if let Some(justify) = effects.get("justify") {
        json::set(&mut out, "justify", rebuild_justify(justify));
    }
    if let Some(hide) = effects.get("hide").and_then(Value::as_bool) {
        json::set(&mut out, "hide", Value::from(hide));
    }
    if let Some(href) = text(effects, "href") {
        json::set(&mut out, "href", Value::from(href));
    }
    Value::Object(out)
}

fn rebuild_font(font: &Value) -> Value {
    let mut out = Map::new();
    if let Some(face) = text(font, "face") {
        json::set(&mut out, "face", Value::from(face));
    }
    if let Some(size) = font.get("size") {
        json::set(
            &mut out,
            "size",
            json::object_of([
                ("x", millimetres(size, "heightNm")),
                ("y", millimetres(size, "widthNm")),
            ]),
        );
    }
    if let Some(thickness) = font.get("thicknessNm").and_then(Value::as_f64) {
        json::set(&mut out, "thickness", json::number(thickness / 1e6));
    }
    for key in ["bold", "italic"] {
        if let Some(flag) = font.get(key).and_then(Value::as_bool) {
            json::set(&mut out, key, Value::from(flag));
        }
    }
    if let Some(spacing) = font.get("lineSpacing").and_then(Value::as_f64) {
        json::set(&mut out, "line_spacing", json::number(spacing));
    }
    if let Some(color) = font.get("color") {
        json::set(&mut out, "color", rebuild_color(color));
    }
    Value::Object(out)
}

fn millimetres(value: &Value, key: &str) -> Value {
    let nm = value.get(key).and_then(Value::as_f64).unwrap_or(0.0);
    json::number(nm / 1e6)
}

fn rebuild_color(color: &Value) -> Value {
    let channel = |key: &str| {
        let raw = color.get(key).and_then(Value::as_f64).unwrap_or(0.0);
        json::number(raw / 255.0)
    };
    let alpha = color.get("alpha").and_then(Value::as_f64).unwrap_or(1.0);
    json::object_of([
        ("r", channel("red")),
        ("g", channel("green")),
        ("b", channel("blue")),
        ("a", json::number(alpha)),
    ])
}

fn rebuild_justify(justify: &Value) -> Value {
    let horizontal = text(justify, "horizontal").unwrap_or("center");
    let vertical = text(justify, "vertical").unwrap_or("center");
    let mirror = justify
        .get("mirror")
        .and_then(Value::as_bool)
        .unwrap_or(false);
    json::object_of([
        ("horiz", Value::from(horizontal)),
        ("vert", Value::from(vertical)),
        ("mirror", Value::from(mirror)),
    ])
}

fn combined_review_fields(entry: &Entry) -> BTreeMap<String, Value> {
    let mut fields = BTreeMap::new();
    if let Some(at) = entry.at {
        fields.insert("Position".to_owned(), Value::from(position_text(at)));
    }
    if let Some(rotation) = entry.rotation {
        fields.insert("Rotation".to_owned(), json::number(rotation));
    }
    insert_str(&mut fields, "Mirror", &entry.mirror);
    insert_str(&mut fields, "Layer", &entry.layer);
    insert_str(&mut fields, "Net", &entry.net);
    insert_str(&mut fields, "Reference", &entry.refdes);
    insert_str(&mut fields, "Library", &entry.lib_id);
    insert_bool(&mut fields, "DNP", entry.dnp);
    insert_bool(&mut fields, "In BOM", entry.in_bom);
    insert_bool(&mut fields, "On board", entry.on_board);
    if let Some(Value::Object(raw)) = &entry.review_fields {
        for (key, value) in raw {
            fields.insert(key.clone(), value.clone());
        }
    }
    fields
}

fn insert_str(fields: &mut BTreeMap<String, Value>, label: &str, value: &Option<String>) {
    if let Some(value) = value {
        fields.insert(label.to_owned(), Value::from(value.clone()));
    }
}

fn insert_bool(fields: &mut BTreeMap<String, Value>, label: &str, value: Option<bool>) {
    if let Some(value) = value {
        fields.insert(label.to_owned(), Value::from(value));
    }
}

fn instances_value(instances: &[Instance]) -> Value {
    Value::Array(
        instances
            .iter()
            .map(|instance| {
                let mut item = Map::new();
                json::set_opt_str(&mut item, "reference", &instance.reference);
                json::set_opt_str(&mut item, "path", &instance.path);
                Value::Object(item)
            })
            .collect(),
    )
}

fn properties_value(properties: &[Property]) -> Value {
    Value::Array(properties.iter().map(property_value).collect())
}

fn property_value(property: &Property) -> Value {
    let mut map = Map::new();
    json::set(&mut map, "name", Value::from(property.name.clone()));
    json::set(&mut map, "value", Value::from(property.value.clone()));
    if let Some(at) = property.at {
        json::set(&mut map, "at", json::point(at));
    }
    if let Some(rotation) = property.rotation {
        json::set(&mut map, "rotation", json::number(rotation));
    }
    if property.hide {
        json::set(&mut map, "hide", Value::from(true));
    }
    if let Some(effects) = &property.effects {
        json::set(&mut map, "effects", effects.clone());
    }
    Value::Object(map)
}

/// Authored-content identity for unmatched UUIDs (`ecad-diff.mjs:109-145`).
/// UUID and parent UUID are deliberately absent.
pub fn authored_identity(entry: &Entry) -> Option<String> {
    let container = matches!(entry.kind.as_str(), "symbol" | "footprint" | "sheet");
    Some(canonical(&json::object_of([
        ("documentPath", Value::from(entry.document_path.clone())),
        ("kind", Value::from(entry.kind.clone())),
        (
            "hash",
            if container {
                Value::Null
            } else {
                Value::from(entry.hash.clone())
            },
        ),
        ("at", option_point(entry.at)),
        ("rotation", option_number(entry.rotation)),
        ("mirror", option_str(&entry.mirror)),
        ("layer", option_str(&entry.layer)),
        ("layers", option_strings(&entry.layers)),
        ("net", option_str(&entry.net)),
        ("refdes", option_str(&entry.refdes)),
        ("libId", option_str(&entry.lib_id)),
        ("dnp", option_bool(entry.dnp)),
        ("inBom", option_bool(entry.in_bom)),
        ("onBoard", option_bool(entry.on_board)),
        ("kiidPaths", option_strings(&entry.kiid_paths)),
        ("instances", option_instances(&entry.instances)),
        ("properties", option_properties(&entry.properties)),
        ("number", option_str(&entry.number)),
        ("text", option_str(&entry.text)),
        ("name", option_str(&entry.name)),
        (
            "reviewFields",
            entry.review_fields.clone().unwrap_or(Value::Null),
        ),
    ])))
}

/// A sheet pin's logical interface slot (`ecad-diff.mjs:147-157`); `None` for
/// every other kind and for a pin without a parent or a position.
pub fn sheet_pin_slot_identity(entry: &Entry) -> Option<String> {
    if entry.kind != "sheet_pin" {
        return None;
    }
    let parent = entry.parent_uuid.as_ref()?;
    let at = entry.at?;
    Some(canonical(&Value::Array(vec![
        Value::from(entry.document_path.clone()),
        Value::from(entry.kind.clone()),
        Value::from(parent.clone()),
        json::point(at),
        json::number(entry.rotation.unwrap_or(0.0)),
    ])))
}

fn option_point(at: Option<Point>) -> Value {
    at.map_or(Value::Null, json::point)
}

fn option_number(value: Option<f64>) -> Value {
    value.map_or(Value::Null, json::number)
}

fn option_str(value: &Option<String>) -> Value {
    value
        .as_ref()
        .map_or(Value::Null, |text| Value::from(text.clone()))
}

fn option_bool(value: Option<bool>) -> Value {
    value.map_or(Value::Null, Value::from)
}

fn option_strings(value: &Option<Vec<String>>) -> Value {
    value
        .as_ref()
        .map_or(Value::Null, |items| json::strings(items))
}

fn option_instances(value: &Option<Vec<Instance>>) -> Value {
    value
        .as_ref()
        .map_or(Value::Null, |instances| instances_value(instances))
}

fn option_properties(value: &Option<Vec<Property>>) -> Value {
    value
        .as_ref()
        .map_or(Value::Null, |properties| properties_value(properties))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn strips_the_anchor_directory() {
        assert_eq!(strip_directory("", "a.kicad_pcb"), "a.kicad_pcb");
        assert_eq!(strip_directory("sub", "sub/a.kicad_pcb"), "a.kicad_pcb");
        assert_eq!(
            strip_directory("sub/dir", "sub/dir/x/a.kicad_pcb"),
            "x/a.kicad_pcb"
        );
        assert_eq!(strip_directory("sub", "other/a.kicad_pcb"), "a.kicad_pcb");
        assert_eq!(anchor_directory("sub/dir/proj.kicad_pro"), "sub/dir");
        assert_eq!(anchor_directory("proj.kicad_pro"), "");
    }

    #[test]
    fn rebuilds_a_pad_from_the_member() {
        let member = json!({
            "schema": "prism.board_objects.a0",
            "documents": [{
                "path": "mini_obc.kicad_pcb",
                "objects": [{
                    "kind": "pad",
                    "uuid": "u1",
                    "contentDigest": "abcd",
                    "parentUuid": "p1",
                    "number": "17",
                    "refdes": "J7",
                    "at": {"xNm": 0, "yNm": 40640000},
                    "rotationDeg": 0.0,
                    "layer": "*.Cu",
                    "net": "PAYLOAD_RESET#",
                    "reviewFields": {"Pad number": "17"}
                }],
                "reviewOnlyObjects": []
            }]
        });
        let entries = build(&member, "").unwrap();
        assert_eq!(entries.len(), 1);
        let entry = &entries[0];
        assert_eq!(entry.key, "mini_obc.kicad_pcb#u1");
        assert_eq!(entry.kind, "pad");
        assert_eq!(entry.at, Some([0.0, 40.64]));
        assert_eq!(entry.rotation, Some(0.0));
        assert_eq!(
            entry.combined_review_fields.get("Position").unwrap(),
            &json!("0, 40.64")
        );
        assert_eq!(
            entry.combined_review_fields.get("Net").unwrap(),
            &json!("PAYLOAD_RESET#")
        );
    }

    #[test]
    fn reconstructs_schematic_property_effects() {
        let value = json!({
            "name": "Reference", "value": "J2", "hide": false,
            "at": {"xNm": 43810000, "yNm": 40000000}, "rotationDeg": 0.0,
            "effects": {"font": {"size": {"heightNm": 1270000, "widthNm": 1270000}}}
        });
        let property = parse_property(&value);
        assert_eq!(property.at, Some([43.81, 40.0]));
        assert!(!property.hide);
        assert_eq!(
            property.effects.as_ref().unwrap(),
            &json!({"font": {"size": {"x": 1.27, "y": 1.27}}})
        );
        assert_eq!(property_value(&property)["hide"], Value::Null);
    }

    #[test]
    fn review_only_hash_is_injective_over_review_fields() {
        let a = review_only_entry(&json!({"kind": "net-class", "id": "net-class:1", "name": "A", "reviewFields": {"x": 1}}), "d").unwrap();
        let b = review_only_entry(&json!({"kind": "net-class", "id": "net-class:1", "name": "A", "reviewFields": {"x": 2}}), "d").unwrap();
        assert_ne!(a.hash, b.hash);
        assert_eq!(a.kind, "net_class");
        assert_eq!(a.review_only, Some(true));
    }
}
