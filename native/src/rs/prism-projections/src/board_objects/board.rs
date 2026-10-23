//! Board objects (`index_board`, `ecad-parse.mjs:1286-1625`) and the
//! transform in `capture/board_objects.py:337-403`.

use super::digest::{self, DigestIndex};
use super::emit::{Document, identity, parse_nonempty, point_nm, rotation_deg};
use super::review::{self, shapes};
use super::tree::{self, Node};
use super::units::centroid_nm;
use crate::ProducerWarning;
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;
use serde_json::{Map, Value};

/// Every object and review-only object of one `.kicad_pcb`.
///
/// The board is read one top-level item at a time ([`tree::items`]): each item
/// is indexed for `contentDigest`, turned into its objects, and dropped, so the
/// document is never held as one tree (about 600 MiB of nodes for a 55 MB
/// board).
#[must_use]
pub(crate) fn document(
    path: &str,
    text: &str,
    warnings: &mut Vec<ProducerWarning>,
) -> super::DocumentParts {
    let net_forms = tree::children_with_head(text, "net");
    let nets = nets_by_code(&net_forms);
    let mut document = Document::new(path, DigestIndex::new(true, digest::net_table(&net_forms)));
    let mut setup: Option<Node<'_>> = None;
    let mut layers: Option<Node<'_>> = None;
    for item in tree::items(text) {
        document.index_form(&item);
        match item.head() {
            Some("footprint" | "module") => footprints(&mut document, &item, &nets),
            Some("segment" | "arc") => segments(&mut document, &item, &nets),
            Some("via") => vias(&mut document, &item, &nets),
            Some("zone") => zones(&mut document, &item, &nets),
            Some(
                "gr_line" | "gr_rect" | "gr_arc" | "gr_circle" | "gr_poly" | "gr_text"
                | "dimension",
            ) => drawings(&mut document, &item),
            Some("group") => groups(&mut document, &item),
            Some("setup") => setup = Some(item),
            Some("layers") => layers = Some(item),
            _ => {}
        }
    }

    let mut review_only = Vec::new();
    review::push_review(
        &mut review_only,
        "fabrication_output",
        "Fabrication output settings",
        "Fabrication output settings",
        review::fabrication_output(setup.as_ref(), layers.as_ref()),
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
fn nets_by_code(forms: &[Node<'_>]) -> Vec<(f64, String)> {
    forms
        .iter()
        .filter_map(|net| {
            let number = tree::number_at(net, 1)?;
            Some((number, tree::text_at(net, 2).unwrap_or_default()))
        })
        .collect()
}

/// `net_name_of` (`ecad-parse.mjs:1167-1179`), by the form's shape.
///
/// - `(net <code> "<name>")` (KiCad 9 and older): the name, or the board net
///   table's name for `<code>` when the name is empty. Reading item 1 as the
///   name here gave the code: JTYU-OBC's pads all reported nets like `"722"`.
/// - `(net "<name>")` (KiCad 10): the name, unless the board has a net table
///   with that code (a legacy code-only form), whose name is used instead.
fn net_name_of(item: &Node<'_>, nets: &[(f64, String)]) -> Option<String> {
    let net = item.child("net")?;
    let by_code = |code: f64| {
        nets.iter()
            .find(|(number, _)| *number == code)
            .map(|(_, name)| name.clone())
            .filter(|name| !name.is_empty())
    };
    let count = net.items().map_or(0, <[Node<'_>]>::len);
    if count >= 3 {
        let name = tree::text_at(net, 2).unwrap_or_default();
        if !name.is_empty() {
            return Some(name);
        }
        return tree::number_at(net, 1).and_then(by_code);
    }
    let first = tree::text_at(net, 1).unwrap_or_default();
    if let Some(name) = tree::number_at(net, 1).and_then(by_code) {
        return Some(name);
    }
    (!first.is_empty()).then_some(first)
}

/// `layer_of(item, head)` (`ecad-parse.mjs:1187-1192`): a non-empty `(head …)`
/// name, as a layer.
fn layer_of(item: &Node<'_>, head: &str) -> Option<bo::LayerName> {
    let name = item
        .child(head)
        .and_then(|child| match tree::text_at(child, 1) {
            Some(name) if !name.is_empty() => Some(name),
            _ => None,
        })?;
    parse_nonempty(name)
}

/// A non-empty name from a layers list, as a layer.
fn layer_name(name: Option<&String>) -> Option<bo::LayerName> {
    parse_nonempty(name.filter(|name| !name.is_empty())?.clone())
}

/// A non-empty name from a layers list, as a layer spec.
fn layer_spec_name(name: Option<&String>) -> Option<bo::BoardObjectsLayerSpec> {
    parse_nonempty(name.filter(|name| !name.is_empty())?.clone())
}

/// The `(head …)` name of a form, as a layer spec.
fn layer_spec_of(item: &Node<'_>, head: &str) -> Option<bo::BoardObjectsLayerSpec> {
    let name = item
        .child(head)
        .and_then(|child| match tree::text_at(child, 1) {
            Some(name) if !name.is_empty() => Some(name),
            _ => None,
        })?;
    parse_nonempty(name)
}

/// The text items after the head of a `(head …)` list (`skip(1)`).
fn text_list(node: Option<&Node<'_>>) -> Vec<String> {
    node.and_then(Node::items)
        .map(|items| {
            items
                .iter()
                .skip(1)
                .filter_map(|item| item.text().map(str::to_owned))
                .collect()
        })
        .unwrap_or_default()
}

/// The layer names of a `(layers …)` list, each as a `LayerName`.
fn layer_list(node: Option<&Node<'_>>) -> Vec<bo::LayerName> {
    text_list(node)
        .iter()
        .filter_map(|name| parse_nonempty(name.clone()))
        .collect()
}

// ---------------------------------------------------------------- footprints

/// `index_board` footprints and their children (`ecad-parse.mjs:1380-1496`).
fn footprints(document: &mut Document, footprint: &Node<'_>, nets: &[(f64, String)]) {
    let Some(uuid) = identity(footprint) else {
        return;
    };
    let properties = footprint_properties(footprint);
    let reference = properties
        .iter()
        .find(|property| property.name == "Reference")
        .map(|property| property.value.clone());
    let at = tree::point(footprint.child("at"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsFootprint {
        kind: "footprint".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        lib_id: tree::text_at(footprint, 1)
            .filter(|text| !text.is_empty())
            .and_then(parse_nonempty),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, footprint.child("at")),
        layer: layer_of(footprint, "layer"),
        footprint_path: footprint_path(document, footprint),
        refdes: refdes(reference.clone()),
        properties,
        review_fields: footprint_review_fields(footprint),
    };
    document.add(footprint, &uuid, bo::BoardObjectsObject::Footprint(object));

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
fn footprint_properties(footprint: &Node<'_>) -> Vec<bo::BoardObjectsFootprintProperty> {
    let kicad8: Vec<bo::BoardObjectsFootprintProperty> = footprint
        .children("property")
        .map(|property| footprint_property(property, false))
        .collect();
    let mut properties = if kicad8.is_empty() {
        footprint
            .children("property")
            .map(|property| footprint_property(property, true))
            .collect()
    } else {
        kicad8
    };
    // The legacy map is dead in practice: the vendored parser routes every
    // `property` form to the KiCad 8 collection (field map, "Footprint
    // properties"). The Reference/Value fp_text fallback is next.
    for (kind, name) in [("reference", "Reference"), ("value", "Value")] {
        if properties.iter().any(|property| property.name == name) {
            continue;
        }
        let found = footprint.children("fp_text").find(|text| {
            tree::text_at(text, 1).is_some_and(|value| value.eq_ignore_ascii_case(kind))
        });
        if let Some(found) = found
            && let Some(value) = tree::text_at(found, 2)
        {
            properties.push(bo::BoardObjectsFootprintProperty {
                name: name.to_owned(),
                value,
                at: tree::point(found.child("at")).map(point_nm),
                hide: shapes::atom_flag(found, "hide").unwrap_or(false),
            });
        }
    }
    properties
}

/// One footprint property; the legacy form has no `at` and no `hide`.
fn footprint_property(node: &Node<'_>, legacy: bool) -> bo::BoardObjectsFootprintProperty {
    bo::BoardObjectsFootprintProperty {
        name: tree::text_at(node, 1).unwrap_or_default(),
        value: tree::text_at(node, 2).unwrap_or_default(),
        at: if legacy {
            None
        } else {
            tree::point(node.child("at")).map(point_nm)
        },
        hide: !legacy && shapes::atom_flag(node, "hide").unwrap_or(false),
    }
}

fn footprint_path(document: &mut Document, footprint: &Node<'_>) -> Option<bo::KiidPath> {
    let path = tree::child_text(footprint, "path")?;
    if super::schematic::is_kiid_path(&path) {
        Some(bo::KiidPath(path))
    } else {
        document.invalid_path();
        None
    }
}

fn footprint_review_fields(footprint: &Node<'_>) -> review::ReviewRecord {
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
            tree::child_text(footprint, "descr").map(review::text),
        ),
        ("Attributes", review::object_text(attr.as_ref())),
        (
            "Exclude from BOM",
            Some(review::flag(flag("exclude_from_bom"))),
        ),
        (
            "Exclude from position files",
            Some(review::flag(flag("exclude_from_pos_files"))),
        ),
        ("Board only", Some(review::flag(flag("board_only")))),
    ])
}

/// The `(attr …)` shape (`parseFootprint`, `kicad-sexpr-parser.mjs:1206-1219`).
fn attr_fields(node: &Node<'_>) -> Value {
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
    pad: &Node<'_>,
    parent: &str,
    reference: &Option<String>,
    nets: &[(f64, String)],
) {
    let Some(uuid) = identity(pad) else {
        return;
    };
    let at = tree::point(pad.child("at"));
    let layers = text_list(pad.child("layers"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsPad {
        kind: "pad".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        number: tree::text_at(pad, 1).map(bo::PadNumber),
        refdes: refdes(reference.clone()),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, pad.child("at")),
        layer: layer_spec_name(layers.first()),
        net: net_name_of(pad, nets).and_then(parse_nonempty),
        review_fields: pad_review_fields(pad, &layers),
    };
    document.add(pad, &uuid, bo::BoardObjectsObject::Pad(object));
}

fn pad_review_fields(pad: &Node<'_>, layers: &[String]) -> review::ReviewRecord {
    review::entry(vec![
        ("Pad number", tree::text_at(pad, 1).map(review::text)),
        ("Pad type", tree::text_at(pad, 2).map(review::text)),
        ("Pad shape", tree::text_at(pad, 3).map(review::text)),
        ("Size", review::vector_text(pad.child("size"))),
        (
            "Drill",
            review::object_text(pad.child("drill").map(drill_fields).as_ref()),
        ),
        ("Layers", review::list_text(layers)),
        (
            "Clearance",
            tree::child_number(pad, "clearance").map(review::number),
        ),
        (
            "Solder mask margin",
            tree::child_number(pad, "solder_mask_margin").map(review::number),
        ),
        (
            "Solder paste margin",
            tree::child_number(pad, "solder_paste_margin").map(review::number),
        ),
        (
            "Thermal width",
            tree::child_number(pad, "thermal_width").map(review::number),
        ),
        (
            "Thermal gap",
            tree::child_number(pad, "thermal_gap").map(review::number),
        ),
        (
            "Zone connection",
            tree::child_number(pad, "zone_connect").map(review::number),
        ),
    ])
}

/// The `(drill …)` shape (`parsePad`, `kicad-sexpr-parser.mjs:974-982`).
fn drill_fields(node: &Node<'_>) -> Value {
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
    zone: &Node<'_>,
    parent: &str,
    reference: &Option<String>,
    nets: &[(f64, String)],
) {
    let Some(uuid) = identity(zone) else {
        return;
    };
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsZone {
        kind: "zone".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        refdes: refdes(reference.clone()),
        at: centroid_point(zone_polygon_points(zone)),
        layer: zone_layer_spec(zone),
        net: zone_net(zone, nets),
        name: tree::child_text(zone, "name"),
        review_fields: review::zone_review_fields(&zone_shape(zone)),
    };
    document.add(zone, &uuid, bo::BoardObjectsObject::Zone(object));
}

/// `index_board` footprint graphics (`ecad-parse.mjs:1461-1477`).
fn footprint_graphics(
    document: &mut Document,
    drawing: &Node<'_>,
    parent: &str,
    reference: &Option<String>,
) {
    let Some(uuid) = identity(drawing) else {
        return;
    };
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsFootprintGraphic {
        kind: "footprint-graphic".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        refdes: refdes(reference.clone()),
        at: drawing_at(drawing, &["start", "mid", "end"]),
        layer: layer_of(drawing, "layer"),
        review_fields: board_drawing_review_fields(drawing),
    };
    document.add(
        drawing,
        &uuid,
        bo::BoardObjectsObject::FootprintGraphic(object),
    );
}

/// `index_board` footprint texts (`ecad-parse.mjs:1478-1495`).
fn footprint_texts(
    document: &mut Document,
    text: &Node<'_>,
    parent: &str,
    reference: &Option<String>,
) {
    let Some(uuid) = identity(text) else {
        return;
    };
    let at = tree::point(text.child("at"));
    let kind = tree::text_at(text, 1);
    let value = tree::text_at(text, 2);
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsFootprintText {
        kind: "footprint-text".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        refdes: refdes(reference.clone()),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, text.child("at")),
        layer: fp_text_layer(text),
        text: value.clone(),
        review_fields: review::entry(vec![
            ("Text kind", kind.map(review::text)),
            ("Text", value.map(review::text)),
        ]),
    };
    document.add(text, &uuid, bo::BoardObjectsObject::FootprintText(object));
}

fn fp_text_layer(text: &Node<'_>) -> Option<bo::LayerName> {
    let layer = text.child("layer")?;
    let name = tree::text_at(layer, 1).filter(|name| !name.is_empty())?;
    parse_nonempty(name)
}

// ------------------------------------------------------------------- tracks

/// `index_board` segments and arcs (`ecad-parse.mjs:1498-1513`).
fn segments(document: &mut Document, item: &Node<'_>, nets: &[(f64, String)]) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let at = drawing_at(item, &["start", "mid", "end"]);
    let layer = layer_of(item, "layer");
    let net = net_name_of(item, nets).and_then(parse_nonempty);
    let width = tree::child_number(item, "width").map(review::number);
    let digest = document.digest(&uuid);
    let review_fields = review::entry(vec![("Width", width)]);
    let object = if item.child("mid").is_some() {
        bo::BoardObjectsObject::Arc(bo::BoardObjectsArc {
            kind: "arc".to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            layer,
            net,
            review_fields,
        })
    } else {
        bo::BoardObjectsObject::Track(bo::BoardObjectsTrack {
            kind: "track".to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            layer,
            net,
            review_fields,
        })
    };
    document.add(item, &uuid, object);
}

/// `index_board` vias (`ecad-parse.mjs:1515-1541`).
fn vias(document: &mut Document, via: &Node<'_>, nets: &[(f64, String)]) {
    let Some(uuid) = identity(via) else {
        return;
    };
    let names = text_list(via.child("layers"));
    let layers = layer_list(via.child("layers"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsVia {
        kind: "via".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        at: tree::point(via.child("at")).map(point_nm),
        layer: layer_name(names.first()),
        layers,
        net: net_name_of(via, nets).and_then(parse_nonempty),
        review_fields: review::entry(vec![
            ("Via type", via_type(via).map(review::text)),
            (
                "Diameter",
                tree::child_number(via, "size").map(review::number),
            ),
            (
                "Drill",
                tree::child_number(via, "drill").map(review::number),
            ),
            ("Layer span", review::list_text(&names)),
        ]),
    };
    document.add(via, &uuid, bo::BoardObjectsObject::Via(object));
}

/// `type` of a via (`parseVia`, `kicad-sexpr-parser.mjs:1282`): a bare
/// `blind`/`micro`/`through-hole` token.
fn via_type(via: &Node<'_>) -> Option<String> {
    via.rest()
        .iter()
        .filter_map(Node::text)
        .find(|text| matches!(*text, "blind" | "micro" | "through-hole"))
        .map(str::to_owned)
}

/// `index_board` zones (`ecad-parse.mjs:1543-1555`).
fn zones(document: &mut Document, zone: &Node<'_>, nets: &[(f64, String)]) {
    let Some(uuid) = identity(zone) else {
        return;
    };
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsZone {
        kind: "zone".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: None,
        refdes: None,
        at: centroid_point(zone_polygon_points(zone)),
        layer: layer_spec_of(zone, "layer"),
        net: zone_net(zone, nets),
        name: tree::child_text(zone, "name"),
        review_fields: review::zone_review_fields(&zone_shape(zone)),
    };
    document.add(zone, &uuid, bo::BoardObjectsObject::Zone(object));
}

/// The zone shape for review fields (`parseZone`, `kicad-sexpr-parser.mjs:1133`).
fn zone_shape(zone: &Node<'_>) -> Value {
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

/// The zone's `(layer …)`, else the first of its `(layers …)`, as a layer spec.
fn zone_layer_spec(zone: &Node<'_>) -> Option<bo::BoardObjectsLayerSpec> {
    if let Some(layer) = tree::child_text(zone, "layer") {
        return parse_nonempty(layer);
    }
    zone.child("layers")
        .and_then(Node::items)
        .and_then(|items| items.get(1))
        .and_then(Node::text)
        .and_then(|text| parse_nonempty(text.to_owned()))
}

fn zone_net(zone: &Node<'_>, nets: &[(f64, String)]) -> Option<bo::NetName> {
    if let Some(name) = tree::child_text(zone, "net_name")
        && !name.is_empty()
    {
        return parse_nonempty(name);
    }
    net_name_of(zone, nets).and_then(parse_nonempty)
}

/// `zone.polygons.flatMap(poly => poly.pts ?? [])` (`ecad-parse.mjs:1449-1451`).
fn zone_polygon_points(zone: &Node<'_>) -> Vec<(Option<f64>, Option<f64>)> {
    let mut points = Vec::new();
    for polygon in zone.children("polygon") {
        points.extend(tree::pts_points(polygon));
    }
    points
}

/// `index_board` board graphics (`ecad-parse.mjs:1557-1571`).
fn drawings(document: &mut Document, drawing: &Node<'_>) {
    let Some(uuid) = identity(drawing) else {
        return;
    };
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsGraphic {
        kind: "graphic".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        at: drawing_at(drawing, &["start", "mid", "end"]),
        layer: layer_of(drawing, "layer"),
        text: if drawing.head() == Some("gr_text") {
            tree::text_at(drawing, 1)
        } else {
            None
        },
        review_fields: board_drawing_review_fields(drawing),
    };
    document.add(drawing, &uuid, bo::BoardObjectsObject::Graphic(object));
}

/// `drawing_review_fields` (`ecad-parse.mjs:364-371`) for a board drawing.
fn board_drawing_review_fields(drawing: &Node<'_>) -> review::ReviewRecord {
    review::graphic_review_fields(
        None,
        tree::text_at(drawing, 1).as_deref(),
        drawing.child("stroke"),
        tree::child_text(drawing, "fill").map(review::text),
    )
}

/// `point_of(at) ?? centroid(pts) ?? centroid([start, mid, end])`
/// (`ecad-parse.mjs:1562-1565`).
fn drawing_at(drawing: &Node<'_>, ends: &[&str]) -> Option<bo::PointNm> {
    if let Some(point) = tree::point(drawing.child("at")) {
        return Some(point_nm(point));
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
            return centroid_point(pts);
        }
    }
    let points: Vec<(Option<f64>, Option<f64>)> = ends
        .iter()
        .filter_map(|name| drawing.child(name))
        .map(vec2_point)
        .collect();
    centroid_point(points)
}

fn vec2_point(node: &Node<'_>) -> (Option<f64>, Option<f64>) {
    (tree::number_at(node, 1), tree::number_at(node, 2))
}

/// `index_board` groups (`ecad-parse.mjs:1573-1584`).
fn groups(document: &mut Document, group: &Node<'_>) {
    let Some(uuid) = identity(group) else {
        return;
    };
    let name = tree::text_at(group, 1).unwrap_or_default();
    let members = group
        .child("members")
        .and_then(Node::items)
        .map(|items| items.len().saturating_sub(1))
        .unwrap_or(0);
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsGroup {
        kind: "group".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        name: name.clone(),
        review_fields: review::entry(vec![
            ("Group", Some(review::text(name))),
            ("Members", Some(review::number(members as f64))),
        ]),
    };
    document.add(group, &uuid, bo::BoardObjectsObject::Group(object));
}

// ------------------------------------------------------------------ helpers

fn refdes(value: Option<String>) -> Option<bo::Refdes> {
    parse_nonempty(value.filter(|text| !text.is_empty())?)
}

fn centroid_point(points: Vec<(Option<f64>, Option<f64>)>) -> Option<bo::PointNm> {
    centroid_nm(&points).map(|(x, y)| bo::PointNm {
        x_nm: bo::Nanometres(x),
        y_nm: bo::Nanometres(y),
    })
}

#[cfg(test)]
mod net_name_tests {
    use super::{net_name_of, nets_by_code, tree};

    fn net_of(board: &str) -> Option<String> {
        let nets = nets_by_code(&tree::children_with_head(board, "net"));
        for footprint in tree::items(board) {
            if footprint.head() != Some("footprint") {
                continue;
            }
            let pad = footprint.child("pad").expect("a pad");
            return net_name_of(pad, &nets);
        }
        panic!("a footprint");
    }

    #[test]
    fn a_kicad_9_pad_names_its_net_not_its_code() {
        let board = r#"(kicad_pcb (net 0 "") (net 722 "S32G3_PWR_EN")
            (footprint "x" (pad "1" smd rect (net 722 "S32G3_PWR_EN"))))"#;
        assert_eq!(net_of(board).as_deref(), Some("S32G3_PWR_EN"));
    }

    #[test]
    fn an_empty_name_falls_back_to_the_net_table() {
        let board = r#"(kicad_pcb (net 7 "VBUS") (footprint "x" (pad "1" smd rect (net 7 ""))))"#;
        assert_eq!(net_of(board).as_deref(), Some("VBUS"));
    }

    #[test]
    fn a_kicad_10_net_named_like_a_number_stays_a_name() {
        let board = r#"(kicad_pcb (footprint "x" (pad "1" smd rect (net "5"))))"#;
        assert_eq!(net_of(board).as_deref(), Some("5"));
    }

    #[test]
    fn a_legacy_code_only_pad_takes_the_tables_name() {
        let board = r#"(kicad_pcb (net 3 "GND") (footprint "x" (pad "1" smd rect (net 3))))"#;
        assert_eq!(net_of(board).as_deref(), Some("GND"));
    }
}
