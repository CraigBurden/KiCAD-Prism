//! Schematic objects (`index_schematic`, `ecad-parse.mjs:930-1158`) and the
//! transform in `capture/board_objects.py:337-403`.

use super::emit::{Document, IntoValue, identity};
use super::review::{self, shapes};
use super::tree::{self, Node};
use super::units::{centroid_nm, mm_to_nm};
use crate::ProducerWarning;
use serde_json::{Map, Value, json};

/// Every object and review-only object of one `.kicad_sch`.
#[must_use]
pub(crate) fn document(
    path: &str,
    root: &Node,
    warnings: &mut Vec<ProducerWarning>,
) -> super::DocumentParts {
    let mut document = Document::new(path, root, false);
    for symbol in root.children("symbol") {
        symbols(&mut document, symbol);
    }
    for sheet in root.children("sheet") {
        sheets(&mut document, sheet);
    }
    for (head, kind) in [("wire", "wire"), ("bus", "bus")] {
        for item in root.children(head) {
            wires(&mut document, item, kind);
        }
    }
    for (head, kind) in [
        ("junction", "junction"),
        ("no_connect", "no_connect"),
        ("bus_entry", "bus_entry"),
    ] {
        for item in root.children(head) {
            connect(&mut document, item, kind);
        }
    }
    for (head, _) in [
        ("label", "label"),
        ("global_label", "label"),
        ("hierarchical_label", "label"),
    ] {
        for item in root.children(head) {
            labels(&mut document, item);
        }
    }
    for head in [
        "polyline",
        "rectangle",
        "arc",
        "circle",
        "bezier",
        "text",
        "text_box",
    ] {
        for item in root.children(head) {
            graphics(&mut document, item, head);
        }
    }
    for item in root.children("image") {
        images(&mut document, item);
    }
    for item in root.children("table") {
        tables(&mut document, item);
    }

    let mut review_only = Vec::new();
    review::bus_aliases(root, &mut review_only);
    review_only = review::finish_review(review_only);
    let (objects, document_warnings) = document.finish();
    warnings.extend(document_warnings);
    super::DocumentParts {
        objects,
        review_only,
    }
}

/// `index_schematic` symbols and their pins (`ecad-parse.mjs:958-1003`).
fn symbols(document: &mut Document, symbol: &Node) {
    let Some(uuid) = identity(symbol) else {
        return;
    };
    let reference = symbol_reference(symbol);
    let at = tree::point(symbol.child("at"));
    let mut fields = Map::new();
    insert(
        &mut fields,
        "libId",
        tree::child_text(symbol, "lib_id").filter(|v| !v.is_empty()),
    );
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(symbol.child("at")).unwrap_or(0.0)))
            .map(f64_value),
    );
    insert(&mut fields, "mirror", tree::child_text(symbol, "mirror"));
    insert(
        &mut fields,
        "dnp",
        Some(Value::Bool(child_bool(symbol, "dnp").unwrap_or(false))),
    );
    insert(
        &mut fields,
        "inBom",
        Some(Value::Bool(child_bool(symbol, "in_bom").unwrap_or(true))),
    );
    insert(
        &mut fields,
        "onBoard",
        Some(Value::Bool(child_bool(symbol, "on_board").unwrap_or(true))),
    );
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(
        &mut fields,
        "kiidPaths",
        Value::Array(valid_paths(document, kiid_paths(symbol, &uuid))),
    );
    insert(
        &mut fields,
        "instances",
        Value::Array(symbol_instances(document, symbol, &uuid)),
    );
    insert(
        &mut fields,
        "properties",
        Value::Array(symbol_properties(symbol)),
    );
    let unit = tree::child_number(symbol, "unit");
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![("Unit", unit.map(shapes::number))]),
    );
    document.add(symbol, "symbol", &uuid, fields);

    for pin in symbol.children("pin") {
        symbol_pin(document, pin, &uuid, &reference, at);
    }
}

fn symbol_pin(
    document: &mut Document,
    pin: &Node,
    parent: &str,
    reference: &Option<String>,
    at: Option<(f64, f64)>,
) {
    let Some(uuid) = identity(pin) else {
        return;
    };
    let number = tree::text_at(pin, 1);
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", Some(parent.to_owned()));
    insert(&mut fields, "number", number.clone());
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(&mut fields, "at", point_value(at));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![("Pin number", number.map(Value::String))]),
    );
    document.add(pin, "pin", &uuid, fields);
}

/// `index_schematic` sheets and their pins (`ecad-parse.mjs:1005-1037`).
fn sheets(document: &mut Document, sheet: &Node) {
    let Some(uuid) = identity(sheet) else {
        return;
    };
    let at = tree::point(sheet.child("at"));
    let mut fields = Map::new();
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "kiidPaths",
        Value::Array(valid_paths(document, kiid_paths(sheet, &uuid))),
    );
    insert(
        &mut fields,
        "properties",
        Value::Array(symbol_properties(sheet)),
    );
    document.add(sheet, "sheet", &uuid, fields);

    for pin in sheet.children("pin") {
        sheet_pin(document, pin, &uuid);
    }
}

fn sheet_pin(document: &mut Document, pin: &Node, parent: &str) {
    let Some(uuid) = identity(pin) else {
        return;
    };
    let name = tree::text_at(pin, 1);
    let shape = tree::text_at(pin, 2);
    let at = tree::point(pin.child("at"));
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", Some(parent.to_owned()));
    insert(&mut fields, "name", name.clone());
    insert(&mut fields, "text", name.clone());
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(pin.child("at")).unwrap_or(0.0)))
            .map(f64_value),
    );
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            ("Sheet pin", name.map(Value::String)),
            ("Electrical type", shape.map(Value::String)),
        ]),
    );
    document.add(pin, "sheet-pin", &uuid, fields);
}

/// `index_schematic` wires and buses (`ecad-parse.mjs:1039-1049`).
fn wires(document: &mut Document, item: &Node, kind: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let mut fields = Map::new();
    insert(&mut fields, "at", centroid_value(tree::pts_points(item)));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![(
            "Stroke",
            review::stroke_text(stroke_of(item).as_ref()),
        )]),
    );
    document.add(item, kind, &uuid, fields);
}

/// `index_schematic` junctions, no-connects and bus entries
/// (`ecad-parse.mjs:1068-1083`).
fn connect(document: &mut Document, item: &Node, kind: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let mut fields = Map::new();
    insert(
        &mut fields,
        "at",
        point_value(tree::point(item.child("at"))),
    );
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            (
                "Diameter",
                tree::child_number(item, "diameter").map(shapes::number),
            ),
            (
                "Size",
                review::vector_text(item.child("size").map(shapes::vec2).as_ref()),
            ),
            ("Stroke", review::stroke_text(stroke_of(item).as_ref())),
        ]),
    );
    document.add(item, kind, &uuid, fields);
}

/// `index_schematic` labels (`ecad-parse.mjs:1085-1103`).
fn labels(document: &mut Document, item: &Node) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let text = tree::text_at(item, 1);
    let at = tree::point(item.child("at"));
    let mut fields = Map::new();
    insert(&mut fields, "text", text.clone());
    insert(&mut fields, "net", text.clone());
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(item.child("at")).unwrap_or(0.0)))
            .map(f64_value),
    );
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![("Text", text.map(Value::String))]),
    );
    document.add(item, "label", &uuid, fields);
}

/// `index_schematic` drawings (`ecad-parse.mjs:1105-1118`).
fn graphics(document: &mut Document, item: &Node, head: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let mut fields = Map::new();
    insert(&mut fields, "at", graphic_at(item, head));
    insert(
        &mut fields,
        "text",
        tree::text_at(item, 1).filter(|_| matches!(head, "text" | "text_box")),
    );
    fields.insert("reviewFields".to_owned(), graphic_review_fields(item, head));
    document.add(item, "graphic", &uuid, fields);
}

fn graphic_at(item: &Node, head: &str) -> Option<Value> {
    if let Some(point) = tree::point(item.child("at")) {
        return point_value(Some(point));
    }
    if matches!(head, "polyline" | "bezier") {
        return centroid_value(tree::pts_points(item));
    }
    if matches!(head, "rectangle" | "arc") {
        return centroid_value(vec![center_point(item, "start"), center_point(item, "end")]);
    }
    None
}

fn graphic_review_fields(item: &Node, head: &str) -> Value {
    review::graphic_review_fields(&json!({
        "type": head,
        "text": if matches!(head, "text" | "text_box") { tree::text_at(item, 1) } else { None },
        "stroke": stroke_of(item),
        "fill": item.child("fill").map(shapes::sch_fill),
    }))
}

/// `index_schematic` images (`ecad-parse.mjs:1120-1125`).
fn images(document: &mut Document, item: &Node) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let mut fields = Map::new();
    insert(
        &mut fields,
        "at",
        point_value(tree::point(item.child("at"))),
    );
    let scale = tree::child_number(item, "scale").unwrap_or(1.0);
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![("Scale", Some(shapes::number(scale)))]),
    );
    document.add(item, "image", &uuid, fields);
}

/// `index_schematic` tables (`ecad-parse.mjs:1126-1134`).
fn tables(document: &mut Document, item: &Node) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let rows = item
        .child("row_heights")
        .and_then(Node::items)
        .map(|items| items.len().saturating_sub(1));
    let content = item
        .child("cells")
        .and_then(Node::items)
        .map(|items| {
            items
                .iter()
                .filter(|cell| cell.head() == Some("table_cell"))
                .map(|cell| tree::text_at(cell, 1).unwrap_or_default())
                .collect::<Vec<_>>()
                .join(" | ")
        })
        .unwrap_or_default();
    let mut fields = Map::new();
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            (
                "Columns",
                tree::child_number(item, "column_count").map(shapes::number),
            ),
            ("Rows", rows.map(|rows| json!(rows))),
            ("Table content", Some(Value::String(content))),
        ]),
    );
    document.add(item, "table", &uuid, fields);
}

// ------------------------------------------------------------------ helpers

/// The `(stroke …)` shape of a form, or `None`.
fn stroke_of(form: &Node) -> Option<Value> {
    form.child("stroke").map(shapes::stroke)
}

/// `symbol_reference` (`ecad-parse.mjs:879-891`).
fn symbol_reference(symbol: &Node) -> Option<String> {
    if let Some(instances) = symbol.child("instances") {
        for project in instances.children("project") {
            for path in project.children("path") {
                if let Some(reference) = tree::child_text(path, "reference") {
                    if !reference.is_empty() {
                        return Some(reference);
                    }
                }
            }
        }
    }
    if let Some(reference) = symbol
        .child("default_instance")
        .and_then(|default| tree::child_text(default, "reference"))
    {
        if !reference.is_empty() {
            return Some(reference);
        }
    }
    for property in symbol.children("property") {
        if tree::text_at(property, 1).as_deref() == Some("Reference") {
            return tree::text_at(property, 2);
        }
    }
    None
}

/// `kiid_paths` (`ecad-parse.mjs:867-877`).
fn kiid_paths(item: &Node, uuid: &str) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();
    if let Some(instances) = item.child("instances") {
        for project in instances.children("project") {
            for path in project.children("path") {
                if let Some(text) = tree::text_at(path, 1) {
                    if !text.is_empty() {
                        let joined = format!("{}/{uuid}", text.trim_end_matches('/'));
                        if !paths.contains(&joined) {
                            paths.push(joined);
                        }
                    }
                }
            }
        }
    }
    paths.sort();
    paths
}

/// `valid_paths` (`capture/board_objects.py:312-315`): drop invalid KIID paths.
fn valid_paths(document: &mut Document, paths: Vec<String>) -> Vec<Value> {
    let mut out = Vec::new();
    for path in paths {
        if is_kiid_path(&path) {
            out.push(Value::String(path));
        } else {
            document.invalid_path();
        }
    }
    out
}

/// `symbol_instances` (`ecad-parse.mjs:893-912`) mapped to member instances
/// (`capture/board_objects.py:349-353`).
fn symbol_instances(document: &mut Document, symbol: &Node, uuid: &str) -> Vec<Value> {
    let mut instances = Vec::new();
    if let Some(node) = symbol.child("instances") {
        for project in node.children("project") {
            for path in project.children("path") {
                let reference = tree::child_text(path, "reference").unwrap_or_default();
                let mut entry = Map::new();
                insert(&mut entry, "reference", refdes(Some(reference)));
                if let Some(text) = tree::text_at(path, 1) {
                    if !text.is_empty() {
                        let joined = format!("{}/{uuid}", text.trim_end_matches('/'));
                        if is_kiid_path(&joined) {
                            insert(&mut entry, "path", Some(joined));
                        } else {
                            document.invalid_path();
                        }
                    }
                }
                instances.push(Value::Object(entry));
            }
        }
    }
    if instances.is_empty() {
        if let Some(reference) = symbol
            .child("default_instance")
            .and_then(|default| tree::child_text(default, "reference"))
        {
            if !reference.is_empty() {
                instances.push(json!({"reference": reference}));
            }
        }
    }
    instances
}

/// `symbol_properties` (`ecad-parse.mjs:914-928`) mapped to member properties.
fn symbol_properties(item: &Node) -> Vec<Value> {
    item.children("property").map(property).collect()
}

fn property(node: &Node) -> Value {
    let at = tree::point(node.child("at"));
    let effects = node
        .child("effects")
        .map(|effects| member_effects(&shapes::effects(effects)));
    json!({
        "name": tree::text_at(node, 1).unwrap_or_default(),
        "value": tree::text_at(node, 2).unwrap_or_default(),
        "at": point_value(at),
        "rotationDeg": at.and(Some(tree::rotation(node.child("at")).unwrap_or(0.0))).map(f64_value),
        "hide": review::shapes::atom_flag(node, "hide").unwrap_or(false),
        "effects": effects,
    })
    .as_object()
    .map(|map| {
        Value::Object(
            map.iter()
                .filter(|(_, value)| !value.is_null())
                .map(|(key, value)| (key.clone(), value.clone()))
                .collect(),
        )
    })
    .unwrap_or(Value::Null)
}

/// `effects()` (`capture/board_objects.py:225-253`).
fn member_effects(effects: &Value) -> Value {
    let mut out = Map::new();
    if let Some(font) = effects.get("font") {
        out.insert("font".to_owned(), member_font(font));
    }
    if let Some(justify) = effects.get("justify") {
        out.insert(
            "justify".to_owned(),
            json!({
                "horizontal": justify.get("horiz").cloned().unwrap_or(json!("center")),
                "vertical": justify.get("vert").cloned().unwrap_or(json!("center")),
                "mirror": justify.get("mirror").cloned().unwrap_or(json!(false)),
            }),
        );
    }
    if let Some(hide) = effects.get("hide") {
        out.insert("hide".to_owned(), hide.clone());
    }
    if let Some(href) = effects.get("href") {
        out.insert("href".to_owned(), href.clone());
    }
    Value::Object(out)
}

fn member_font(font: &Value) -> Value {
    let mut out = Map::new();
    if let Some(face) = font.get("face") {
        out.insert("face".to_owned(), face.clone());
    }
    if let Some(size) = font.get("size") {
        out.insert(
            "size".to_owned(),
            json!({
                "heightNm": mm_to_nm(size.get("x").and_then(Value::as_f64).unwrap_or(0.0)),
                "widthNm": mm_to_nm(size.get("y").and_then(Value::as_f64).unwrap_or(0.0)),
            }),
        );
    }
    if let Some(thickness) = font.get("thickness").and_then(Value::as_f64) {
        out.insert("thicknessNm".to_owned(), json!(mm_to_nm(thickness)));
    }
    for key in ["bold", "italic"] {
        if let Some(flag) = font.get(key) {
            out.insert(key.to_owned(), flag.clone());
        }
    }
    if let Some(spacing) = font.get("line_spacing") {
        out.insert("lineSpacing".to_owned(), spacing.clone());
    }
    if let Some(color) = font.get("color") {
        out.insert("color".to_owned(), member_color(color));
    }
    Value::Object(out)
}

fn member_color(color: &Value) -> Value {
    let channel =
        |key: &str, fallback: f64| color.get(key).and_then(Value::as_f64).unwrap_or(fallback);
    let mut out = Map::new();
    out.insert("red".to_owned(), scaled(channel("r", 0.0)));
    out.insert("green".to_owned(), scaled(channel("g", 0.0)));
    out.insert("blue".to_owned(), scaled(channel("b", 0.0)));
    if let Some(alpha) = color.get("a") {
        out.insert("alpha".to_owned(), alpha.clone());
    }
    Value::Object(out)
}

fn scaled(value: f64) -> Value {
    json!((value * 255.0).round() as i64)
}

/// `parseCenterOrStartOrEnd` (`kicad-sexpr-parser.mjs:2687-2696`): the two
/// coordinates, or `(0, 0)` for anything unreadable.
fn center_point(form: &Node, name: &str) -> (Option<f64>, Option<f64>) {
    let Some(node) = form.child(name) else {
        return (None, None);
    };
    if let Some(xy) = node.child("xy") {
        if let (Some(x), Some(y)) = (tree::number_at(xy, 1), tree::number_at(xy, 2)) {
            return (Some(x), Some(y));
        }
    }
    if let (Some(x), Some(y)) = (tree::number_at(node, 1), tree::number_at(node, 2)) {
        return (Some(x), Some(y));
    }
    (Some(0.0), Some(0.0))
}

/// `refdes` (`capture/board_objects.py:318-321`): an empty value is absent.
fn refdes(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.is_empty())
}

fn child_bool(node: &Node, name: &str) -> Option<bool> {
    shapes::atom_flag(node, name)
        .or_else(|| tree::child_text(node, name).map(|text| shapes::boolean(&text)))
}

fn point_value(point: Option<(f64, f64)>) -> Option<Value> {
    point.map(|(x, y)| json!({"xNm": mm_to_nm(x), "yNm": mm_to_nm(y)}))
}

fn centroid_value(points: Vec<(Option<f64>, Option<f64>)>) -> Option<Value> {
    centroid_nm(&points).map(|(x, y)| json!({"xNm": x, "yNm": y}))
}

fn f64_value(value: f64) -> Value {
    shapes::number(value)
}

fn insert(map: &mut Map<String, Value>, key: &str, value: impl IntoValue) {
    if let Some(value) = value.into_value() {
        map.insert(key.to_owned(), value);
    }
}

/// The `KIID_PATH` pattern (`capture/board_objects.py:47`).
#[must_use]
pub(crate) fn is_kiid_path(text: &str) -> bool {
    text.split('/')
        .skip(1)
        .all(|part| super::digest::is_canonical_uuid(part))
        && text.starts_with('/')
}
