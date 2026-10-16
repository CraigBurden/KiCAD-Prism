//! Board objects (`index_board`, `ecad-parse.mjs:1286-1625`) and the
//! transform in `capture/board_objects.py:337-403`.

use super::emit::{Document, IntoValue, identity};
use super::review::{self, shapes};
use super::tree::{self, Node};
use super::units::centroid_nm;
use crate::ProducerWarning;
use serde_json::{Map, Value, json};

/// Every object and review-only object of one `.kicad_pcb`.
#[must_use]
pub(crate) fn document(
    path: &str,
    root: &Node,
    warnings: &mut Vec<ProducerWarning>,
) -> super::DocumentParts {
    let mut document = Document::new(path, root, true);
    let nets = nets_by_code(root);
    for footprint in root.children("footprint").chain(root.children("module")) {
        footprints(&mut document, footprint, &nets);
    }
    for item in root.children("segment").chain(root.children("arc")) {
        segments(&mut document, item, &nets);
    }
    for item in root.children("via") {
        vias(&mut document, item, &nets);
    }
    for item in root.children("zone") {
        zones(&mut document, item, &nets);
    }
    for head in [
        "gr_line",
        "gr_rect",
        "gr_arc",
        "gr_circle",
        "gr_poly",
        "gr_text",
        "dimension",
    ] {
        for item in root.children(head) {
            drawings(&mut document, item);
        }
    }
    for item in root.children("group") {
        groups(&mut document, item);
    }

    let mut review_only = Vec::new();
    review::push_review(
        &mut review_only,
        "fabrication_output",
        "Fabrication output settings",
        "Fabrication output settings",
        review::fabrication_output(root),
    );
    let review_only = review::finish_review(review_only);
    let (objects, document_warnings) = document.finish();
    warnings.extend(document_warnings);
    super::DocumentParts {
        objects,
        review_only,
    }
}

/// The board net table, `number -> name` (`ecad-parse.mjs:1293`).
fn nets_by_code(root: &Node) -> Vec<(f64, String)> {
    root.children("net")
        .filter_map(|net| {
            let number = tree::number_at(net, 1)?;
            Some((number, tree::text_at(net, 2).unwrap_or_default()))
        })
        .collect()
}

/// `net_name_of` (`ecad-parse.mjs:1167-1179`).
fn net_name_of(item: &Node, nets: &[(f64, String)]) -> Option<String> {
    let net = item.child("net")?;
    let name = tree::text_at(net, 1).unwrap_or_default();
    let number = tree::number_at(net, 1);
    if let Some(number) = number {
        if !name.is_empty() {
            return Some(name);
        }
        return nets
            .iter()
            .find(|(code, _)| *code == number)
            .map(|(_, name)| name.clone())
            .filter(|name| !name.is_empty());
    }
    (!name.is_empty()).then_some(name)
}

/// `layer_name_of` (`ecad-parse.mjs:1187-1192`).
fn layer_name_of(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::Object(map)) => map
            .get("name")
            .or_else(|| map.get("canonical_name"))
            .and_then(Value::as_str)
            .map(str::to_owned),
        Some(Value::String(text)) if !text.is_empty() => Some(text.clone()),
        _ => None,
    }
}

fn layer_of(item: &Node, head: &str) -> Option<String> {
    item.child(head)
        .and_then(|child| match tree::text_at(child, 1) {
            Some(name) if !name.is_empty() => Some(name),
            _ => None,
        })
}

// ---------------------------------------------------------------- footprints

/// `index_board` footprints and their children (`ecad-parse.mjs:1380-1496`).
fn footprints(document: &mut Document, footprint: &Node, nets: &[(f64, String)]) {
    let Some(uuid) = identity(footprint) else {
        return;
    };
    let properties = footprint_properties(footprint);
    let reference = properties
        .iter()
        .find(|property| property.get("name").and_then(Value::as_str) == Some("Reference"))
        .and_then(|property| property.get("value"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    let at = tree::point(footprint.child("at"));
    let mut fields = Map::new();
    insert(
        &mut fields,
        "libId",
        tree::text_at(footprint, 1).filter(|text| !text.is_empty()),
    );
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(footprint.child("at")).unwrap_or(0.0)))
            .map(shapes::number),
    );
    insert(&mut fields, "layer", layer_of(footprint, "layer"));
    insert(
        &mut fields,
        "footprintPath",
        footprint_path(document, footprint),
    );
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(
        &mut fields,
        "properties",
        Value::Array(properties.iter().map(member_footprint_property).collect()),
    );
    fields.insert(
        "reviewFields".to_owned(),
        footprint_review_fields(footprint),
    );
    document.add(footprint, "footprint", &uuid, fields);

    for pad in footprint.children("pad") {
        pads(document, pad, &uuid, &reference, nets);
    }
    for zone in footprint.children("zone") {
        footprint_zones(document, zone, &uuid, &reference, nets);
    }
    for drawing in ["fp_line", "fp_rect", "fp_arc", "fp_circle", "fp_poly"]
        .iter()
        .flat_map(|head| footprint.children(head))
    {
        footprint_graphics(document, drawing, &uuid, &reference);
    }
    for text in footprint.children("fp_text") {
        footprint_texts(document, text, &uuid, &reference);
    }
}

/// `footprint_properties` (`ecad-parse.mjs:1201-1234`).
fn footprint_properties(footprint: &Node) -> Vec<Value> {
    let kicad8: Vec<Value> = footprint
        .children("property")
        .map(|property| {
            json!({
                "name": tree::text_at(property, 1).unwrap_or_default(),
                "value": tree::text_at(property, 2).unwrap_or_default(),
                "at": tree::point(property.child("at")).map(|(x, y)| vec![x, y]),
                "hide": shapes::atom_flag(property, "hide").unwrap_or(false),
            })
        })
        .collect();
    let mut properties = if kicad8.is_empty() {
        footprint
            .children("property")
            .map(|property| json!({"name": tree::text_at(property, 1).unwrap_or_default(), "value": tree::text_at(property, 2).unwrap_or_default()}))
            .collect()
    } else {
        kicad8
    };
    // The legacy map is dead in practice: the vendored parser routes every
    // `property` form to the KiCad 8 collection (field map, "Footprint
    // properties"). The Reference/Value fp_text fallback is next.
    for (kind, name) in [("reference", "Reference"), ("value", "Value")] {
        if properties
            .iter()
            .any(|property| property.get("name").and_then(Value::as_str) == Some(name))
        {
            continue;
        }
        let found = footprint.children("fp_text").find(|text| {
            tree::text_at(text, 1).is_some_and(|value| value.eq_ignore_ascii_case(kind))
        });
        if let Some(found) = found
            && let Some(value) = tree::text_at(found, 2)
        {
            properties.push(json!({
                "name": name,
                "value": value,
                "at": tree::point(found.child("at")).map(|(x, y)| vec![x, y]),
                "hide": shapes::atom_flag(found, "hide").unwrap_or(false),
            }));
        }
    }
    properties
}

fn member_footprint_property(property: &Value) -> Value {
    review::entry(vec![
        (
            "name",
            Some(property.get("name").cloned().unwrap_or(json!(""))),
        ),
        (
            "value",
            Some(property.get("value").cloned().unwrap_or(json!(""))),
        ),
        (
            "at",
            property
                .get("at")
                .cloned()
                .filter(|value| !value.is_null())
                .map(|value| points_nm(&value)),
        ),
        ("hide", property.get("hide").cloned()),
    ])
}

fn footprint_path(document: &mut Document, footprint: &Node) -> Option<String> {
    let path = tree::child_text(footprint, "path")?;
    if super::schematic::is_kiid_path(&path) {
        Some(path)
    } else {
        document.invalid_path();
        None
    }
}

fn footprint_review_fields(footprint: &Node) -> Value {
    let attr = footprint.child("attr").map(attr_fields);
    let flag = |name: &str| {
        attr.as_ref()
            .and_then(|attr| attr.get(name))
            .and_then(Value::as_bool)
            .unwrap_or(false)
    };
    review::entry(vec![
        (
            "Description",
            tree::child_text(footprint, "descr").map(Value::String),
        ),
        ("Attributes", review::object_text(attr.as_ref())),
        (
            "Exclude from BOM",
            Some(Value::Bool(flag("exclude_from_bom"))),
        ),
        (
            "Exclude from position files",
            Some(Value::Bool(flag("exclude_from_pos_files"))),
        ),
        ("Board only", Some(Value::Bool(flag("board_only")))),
    ])
}

/// The `(attr …)` shape (`parseFootprint`, `kicad-sexpr-parser.mjs:1206-1219`).
fn attr_fields(node: &Node) -> Value {
    let mut out = Map::new();
    for flag in [
        "through_hole",
        "smd",
        "virtual",
        "board_only",
        "exclude_from_pos_files",
        "exclude_from_bom",
        "dnp",
        "allow_solder_mask_bridges",
        "allow_missing_courtyard",
    ] {
        if node.rest().iter().any(|token| token.text() == Some(flag)) {
            out.insert(flag.to_owned(), Value::Bool(true));
        }
    }
    Value::Object(out)
}

/// `index_board` pads (`ecad-parse.mjs:1413-1441`).
fn pads(
    document: &mut Document,
    pad: &Node,
    parent: &str,
    reference: &Option<String>,
    nets: &[(f64, String)],
) {
    let Some(uuid) = identity(pad) else {
        return;
    };
    let at = tree::point(pad.child("at"));
    let layers: Vec<Value> = pad
        .child("layers")
        .and_then(Node::items)
        .map(|items| {
            items
                .iter()
                .skip(1)
                .filter_map(|item| item.text().map(|text| Value::String(text.to_owned())))
                .collect()
        })
        .unwrap_or_default();
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", parent.to_owned());
    insert(&mut fields, "number", tree::text_at(pad, 1));
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(pad.child("at")).unwrap_or(0.0)))
            .map(shapes::number),
    );
    insert(&mut fields, "layer", layer_name_of(layers.first()));
    insert(&mut fields, "net", net_name_of(pad, nets));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            ("Pad number", tree::text_at(pad, 1).map(Value::String)),
            ("Pad type", tree::text_at(pad, 2).map(Value::String)),
            ("Pad shape", tree::text_at(pad, 3).map(Value::String)),
            (
                "Size",
                review::vector_text(pad.child("size").map(shapes::vec2).as_ref()),
            ),
            (
                "Drill",
                review::object_text(pad.child("drill").map(drill_fields).as_ref()),
            ),
            ("Layers", review::list_text(&layers)),
            (
                "Clearance",
                tree::child_number(pad, "clearance").map(shapes::number),
            ),
            (
                "Solder mask margin",
                tree::child_number(pad, "solder_mask_margin").map(shapes::number),
            ),
            (
                "Solder paste margin",
                tree::child_number(pad, "solder_paste_margin").map(shapes::number),
            ),
            (
                "Thermal width",
                tree::child_number(pad, "thermal_width").map(shapes::number),
            ),
            (
                "Thermal gap",
                tree::child_number(pad, "thermal_gap").map(shapes::number),
            ),
            (
                "Zone connection",
                tree::child_number(pad, "zone_connect").map(shapes::number),
            ),
        ]),
    );
    document.add(pad, "pad", &uuid, fields);
}

/// The `(drill …)` shape (`parsePad`, `kicad-sexpr-parser.mjs:974-982`).
fn drill_fields(node: &Node) -> Value {
    let mut out = Map::new();
    if node.rest().iter().any(|token| token.text() == Some("oval")) {
        out.insert("oval".to_owned(), Value::Bool(true));
    }
    let numeric: Vec<f64> = node
        .rest()
        .iter()
        .filter_map(|item| item.text().and_then(tree::number))
        .collect();
    if let Some(diameter) = numeric.first() {
        out.insert("diameter".to_owned(), shapes::number(*diameter));
    }
    if let Some(width) = numeric.get(1) {
        out.insert("width".to_owned(), shapes::number(*width));
    }
    if let Some(offset) = node.child("offset") {
        out.insert("offset".to_owned(), shapes::vec2(offset));
    }
    Value::Object(out)
}

/// `index_board` footprint zones (`ecad-parse.mjs:1442-1460`).
fn footprint_zones(
    document: &mut Document,
    zone: &Node,
    parent: &str,
    reference: &Option<String>,
    nets: &[(f64, String)],
) {
    let Some(uuid) = identity(zone) else {
        return;
    };
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", parent.to_owned());
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(&mut fields, "at", centroid_value(zone_polygon_points(zone)));
    insert(&mut fields, "layer", zone_layer(zone));
    insert(&mut fields, "net", zone_net(zone, nets));
    insert(&mut fields, "name", tree::child_text(zone, "name"));
    fields.insert(
        "reviewFields".to_owned(),
        review::zone_review_fields(&zone_shape(zone)),
    );
    document.add(zone, "zone", &uuid, fields);
}

/// `index_board` footprint graphics (`ecad-parse.mjs:1461-1477`).
fn footprint_graphics(
    document: &mut Document,
    drawing: &Node,
    parent: &str,
    reference: &Option<String>,
) {
    let Some(uuid) = identity(drawing) else {
        return;
    };
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", parent.to_owned());
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(
        &mut fields,
        "at",
        drawing_at(drawing, &["start", "mid", "end"]),
    );
    insert(&mut fields, "layer", layer_of(drawing, "layer"));
    insert(&mut fields, "text", tree::text_at(drawing, 1));
    fields.insert("reviewFields".to_owned(), drawing_review_fields(drawing));
    document.add(drawing, "footprint-graphic", &uuid, fields);
}

/// `index_board` footprint texts (`ecad-parse.mjs:1478-1495`).
fn footprint_texts(document: &mut Document, text: &Node, parent: &str, reference: &Option<String>) {
    let Some(uuid) = identity(text) else {
        return;
    };
    let at = tree::point(text.child("at"));
    let kind = tree::text_at(text, 1);
    let value = tree::text_at(text, 2);
    let mut fields = Map::new();
    insert(&mut fields, "parentUuid", parent.to_owned());
    insert(&mut fields, "refdes", refdes(reference.clone()));
    insert(&mut fields, "at", point_value(at));
    insert(
        &mut fields,
        "rotationDeg",
        at.and(Some(tree::rotation(text.child("at")).unwrap_or(0.0)))
            .map(shapes::number),
    );
    insert(&mut fields, "layer", fp_text_layer(text));
    insert(&mut fields, "text", value.clone());
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            ("Text kind", kind.map(Value::String)),
            ("Text", value.map(Value::String)),
        ]),
    );
    document.add(text, "footprint-text", &uuid, fields);
}

fn fp_text_layer(text: &Node) -> Option<String> {
    let layer = text.child("layer")?;
    tree::text_at(layer, 1).filter(|name| !name.is_empty())
}

// ------------------------------------------------------------------- tracks

/// `index_board` segments and arcs (`ecad-parse.mjs:1498-1513`).
fn segments(document: &mut Document, item: &Node, nets: &[(f64, String)]) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let kind = if item.child("mid").is_some() {
        "arc"
    } else {
        "track"
    };
    let mut fields = Map::new();
    insert(
        &mut fields,
        "at",
        drawing_at(item, &["start", "mid", "end"]),
    );
    insert(&mut fields, "layer", layer_of(item, "layer"));
    insert(&mut fields, "net", net_name_of(item, nets));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![(
            "Width",
            tree::child_number(item, "width").map(shapes::number),
        )]),
    );
    document.add(item, kind, &uuid, fields);
}

/// `index_board` vias (`ecad-parse.mjs:1515-1541`).
fn vias(document: &mut Document, via: &Node, nets: &[(f64, String)]) {
    let Some(uuid) = identity(via) else {
        return;
    };
    let layers: Vec<Value> = via
        .child("layers")
        .and_then(Node::items)
        .map(|items| {
            items
                .iter()
                .skip(1)
                .filter_map(|item| item.text().map(|text| Value::String(text.to_owned())))
                .collect()
        })
        .unwrap_or_default();
    let mut fields = Map::new();
    insert(&mut fields, "at", point_value(tree::point(via.child("at"))));
    insert(&mut fields, "layer", layer_name_of(layers.first()));
    insert(&mut fields, "layers", Value::Array(layers.clone()));
    insert(&mut fields, "net", net_name_of(via, nets));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            ("Via type", via_type(via).map(Value::String)),
            (
                "Diameter",
                tree::child_number(via, "size").map(shapes::number),
            ),
            (
                "Drill",
                tree::child_number(via, "drill").map(shapes::number),
            ),
            ("Layer span", review::list_text(&layers)),
        ]),
    );
    document.add(via, "via", &uuid, fields);
}

/// `type` of a via (`parseVia`, `kicad-sexpr-parser.mjs:1282`): a bare
/// `blind`/`micro`/`through-hole` token.
fn via_type(via: &Node) -> Option<String> {
    via.rest()
        .iter()
        .filter_map(Node::text)
        .find(|text| matches!(*text, "blind" | "micro" | "through-hole"))
        .map(str::to_owned)
}

/// `index_board` zones (`ecad-parse.mjs:1543-1555`).
fn zones(document: &mut Document, zone: &Node, nets: &[(f64, String)]) {
    let Some(uuid) = identity(zone) else {
        return;
    };
    let mut fields = Map::new();
    insert(&mut fields, "at", centroid_value(zone_polygon_points(zone)));
    insert(&mut fields, "layer", layer_of(zone, "layer"));
    insert(&mut fields, "net", zone_net(zone, nets));
    insert(&mut fields, "name", tree::child_text(zone, "name"));
    fields.insert(
        "reviewFields".to_owned(),
        review::zone_review_fields(&zone_shape(zone)),
    );
    document.add(zone, "zone", &uuid, fields);
}

/// The zone shape for review fields (`parseZone`, `kicad-sexpr-parser.mjs:1133`).
fn zone_shape(zone: &Node) -> Value {
    let mut out = Map::new();
    if let Some(name) = tree::child_text(zone, "name") {
        out.insert("name".to_owned(), Value::String(name));
    }
    if let Some(layer) = tree::child_text(zone, "layer") {
        out.insert("layer".to_owned(), Value::String(layer));
    }
    if let Some(layers) = zone.child("layers").and_then(Node::items) {
        let values: Vec<Value> = layers
            .iter()
            .skip(1)
            .filter_map(|item| item.text().map(|text| Value::String(text.to_owned())))
            .collect();
        out.insert("layers".to_owned(), Value::Array(values));
    }
    if let Some(priority) = tree::child_number(zone, "priority") {
        out.insert("priority".to_owned(), shapes::number(priority));
    }
    if let Some(child) = zone.child("hatch") {
        out.insert("hatch".to_owned(), shapes::zone_hatch(child));
    }
    if let Some(child) = zone.child("connect_pads") {
        out.insert("connect_pads".to_owned(), shapes::zone_connect_pads(child));
    }
    if let Some(min) = tree::child_number(zone, "min_thickness") {
        out.insert("min_thickness".to_owned(), shapes::number(min));
    }
    if let Some(child) = zone.child("keepout") {
        out.insert("keepout".to_owned(), shapes::zone_keepout(child));
    }
    if let Some(child) = zone.child("fill") {
        out.insert("fill".to_owned(), shapes::zone_fill(child));
    }
    Value::Object(out)
}

fn zone_layer(zone: &Node) -> Option<String> {
    if let Some(layer) = tree::child_text(zone, "layer") {
        return Some(layer);
    }
    zone.child("layers")
        .and_then(Node::items)
        .and_then(|items| items.get(1))
        .and_then(Node::text)
        .map(str::to_owned)
}

fn zone_net(zone: &Node, nets: &[(f64, String)]) -> Option<String> {
    if let Some(name) = tree::child_text(zone, "net_name")
        && !name.is_empty()
    {
        return Some(name);
    }
    net_name_of(zone, nets)
}

/// `zone.polygons.flatMap(poly => poly.pts ?? [])` (`ecad-parse.mjs:1449-1451`).
fn zone_polygon_points(zone: &Node) -> Vec<(Option<f64>, Option<f64>)> {
    let mut points = Vec::new();
    for polygon in zone.children("polygon") {
        points.extend(tree::pts_points(polygon));
    }
    points
}

/// `index_board` board graphics (`ecad-parse.mjs:1557-1571`).
fn drawings(document: &mut Document, drawing: &Node) {
    let Some(uuid) = identity(drawing) else {
        return;
    };
    let mut fields = Map::new();
    insert(
        &mut fields,
        "at",
        drawing_at(drawing, &["start", "mid", "end"]),
    );
    insert(&mut fields, "layer", layer_of(drawing, "layer"));
    if drawing.head() == Some("gr_text") {
        insert(&mut fields, "text", tree::text_at(drawing, 1));
    }
    fields.insert("reviewFields".to_owned(), drawing_review_fields(drawing));
    document.add(drawing, "graphic", &uuid, fields);
}

/// `point_of(at) ?? centroid(pts) ?? centroid([start, mid, end])`
/// (`ecad-parse.mjs:1562-1565`).
fn drawing_at(drawing: &Node, ends: &[&str]) -> Option<Value> {
    if let Some(point) = tree::point(drawing.child("at")) {
        return point_value(Some(point));
    }
    // Only `gr_poly`/`fp_poly` (and the schematic poly forms) carry a flat
    // `(pts (xy …)…)`; a `dimension`'s `pts` is a nested list the reference
    // reads as no point (field map, "Positions per form").
    if matches!(
        drawing.head(),
        Some("gr_poly" | "fp_poly" | "polyline" | "bezier")
    ) {
        let pts = tree::pts_points(drawing);
        if !pts.is_empty() {
            return centroid_value(pts);
        }
    }
    let points: Vec<(Option<f64>, Option<f64>)> = ends
        .iter()
        .filter_map(|name| drawing.child(name))
        .map(vec2_point)
        .collect();
    centroid_value(points)
}

fn vec2_point(node: &Node) -> (Option<f64>, Option<f64>) {
    (tree::number_at(node, 1), tree::number_at(node, 2))
}

fn drawing_review_fields(drawing: &Node) -> Value {
    review::graphic_review_fields(&json!({
        "text": tree::text_at(drawing, 1),
        "stroke": drawing.child("stroke").map(shapes::stroke),
        "fill": tree::child_text(drawing, "fill"),
    }))
}

/// `index_board` groups (`ecad-parse.mjs:1573-1584`).
fn groups(document: &mut Document, group: &Node) {
    let Some(uuid) = identity(group) else {
        return;
    };
    let name = tree::text_at(group, 1).unwrap_or_default();
    let members = group
        .child("members")
        .and_then(Node::items)
        .map(|items| items.len().saturating_sub(1))
        .unwrap_or(0);
    let mut fields = Map::new();
    fields.insert("name".to_owned(), Value::String(name.clone()));
    fields.insert(
        "reviewFields".to_owned(),
        review::entry(vec![
            ("Group", Some(Value::String(name))),
            ("Members", Some(json!(members))),
        ]),
    );
    document.add(group, "group", &uuid, fields);
}

// ------------------------------------------------------------------ helpers

fn refdes(value: Option<String>) -> Option<String> {
    value.filter(|text| !text.is_empty())
}

fn point_value(point: Option<(f64, f64)>) -> Option<Value> {
    point.map(|(x, y)| json!({"xNm": super::units::mm_to_nm(x), "yNm": super::units::mm_to_nm(y)}))
}

fn centroid_value(points: Vec<(Option<f64>, Option<f64>)>) -> Option<Value> {
    centroid_nm(&points).map(|(x, y)| json!({"xNm": x, "yNm": y}))
}

fn points_nm(value: &Value) -> Value {
    let x = value.get(0).and_then(Value::as_f64).unwrap_or(0.0);
    let y = value.get(1).and_then(Value::as_f64).unwrap_or(0.0);
    json!({"xNm": super::units::mm_to_nm(x), "yNm": super::units::mm_to_nm(y)})
}

fn insert(map: &mut Map<String, Value>, key: &str, value: impl IntoValue) {
    if let Some(value) = value.into_value() {
        map.insert(key.to_owned(), value);
    }
}
