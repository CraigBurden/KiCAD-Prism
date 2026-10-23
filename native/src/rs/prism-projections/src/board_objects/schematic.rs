//! Schematic objects (`index_schematic`, `ecad-parse.mjs:930-1158`) and the
//! transform in `capture/board_objects.py:337-403`.

use super::emit::{Document, identity, parse_nonempty, point_nm, rotation_deg};
use super::review::{self, shapes};
use super::tree::{self, Node};
use super::units::{centroid_nm, json_text, mm_to_nm};
use crate::ProducerWarning;
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;

/// Every object and review-only object of one `.kicad_sch`.
#[must_use]
pub(crate) fn document(
    path: &str,
    root: &Node<'_>,
    warnings: &mut Vec<ProducerWarning>,
) -> super::DocumentParts {
    let mut document = Document::new(path, super::digest::index(root, false));
    collect(&mut document, root);

    let mut review_only = Vec::new();
    review::bus_aliases(root, &mut review_only);
    let review_only = review::finish_review(review_only);
    let (objects, document_warnings) = document.finish();
    warnings.extend(document_warnings);
    super::DocumentParts {
        objects,
        review_only,
    }
}

/// `index_schematic`'s object loops (`ecad-parse.mjs:958-1134`), split into
/// groups so each stays simple.
fn collect(document: &mut Document, root: &Node<'_>) {
    symbols_sheets(document, root);
    wires_connects(document, root);
    labels_graphics(document, root);
    images_tables(document, root);
}

fn symbols_sheets(document: &mut Document, root: &Node<'_>) {
    for symbol in root.children("symbol") {
        symbols(document, symbol);
    }
    for sheet in root.children("sheet") {
        sheets(document, sheet);
    }
}

fn wires_connects(document: &mut Document, root: &Node<'_>) {
    for (head, kind) in [("wire", "wire"), ("bus", "bus")] {
        for item in root.children(head) {
            wires(document, item, kind);
        }
    }
    for (head, kind) in [
        ("junction", "junction"),
        ("no_connect", "no_connect"),
        ("bus_entry", "bus_entry"),
    ] {
        for item in root.children(head) {
            connect(document, item, kind);
        }
    }
}

fn labels_graphics(document: &mut Document, root: &Node<'_>) {
    for head in ["label", "global_label", "hierarchical_label"] {
        for item in root.children(head) {
            labels(document, item);
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
            graphics(document, item, head);
        }
    }
}

fn images_tables(document: &mut Document, root: &Node<'_>) {
    for item in root.children("image") {
        images(document, item);
    }
    for item in root.children("table") {
        tables(document, item);
    }
}

/// `index_schematic` symbols and their pins (`ecad-parse.mjs:958-1003`).
fn symbols(document: &mut Document, symbol: &Node<'_>) {
    let Some(uuid) = identity(symbol) else {
        return;
    };
    let reference = symbol_reference(symbol);
    let at = tree::point(symbol.child("at"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsSymbol {
        kind: "symbol".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        lib_id: tree::child_text(symbol, "lib_id")
            .filter(|value| !value.is_empty())
            .and_then(parse_nonempty),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, symbol.child("at")),
        mirror: mirror_of(tree::child_text(symbol, "mirror")),
        dnp: child_bool(symbol, "dnp").unwrap_or(false),
        in_bom: child_bool(symbol, "in_bom").unwrap_or(true),
        on_board: child_bool(symbol, "on_board").unwrap_or(true),
        refdes: refdes(reference.clone()),
        kiid_paths: valid_paths(document, kiid_paths(symbol, &uuid)),
        instances: symbol_instances(document, symbol, &uuid),
        properties: symbol_properties(symbol),
        review_fields: review::entry(vec![(
            "Unit",
            tree::child_number(symbol, "unit").map(review::number),
        )]),
    };
    document.add(symbol, &uuid, bo::BoardObjectsObject::Symbol(object));

    for pin in symbol.children("pin") {
        symbol_pin(document, pin, &uuid, &reference, at);
    }
}

fn symbol_pin(
    document: &mut Document,
    pin: &Node<'_>,
    parent: &str,
    reference: &Option<String>,
    at: Option<(f64, f64)>,
) {
    let Some(uuid) = identity(pin) else {
        return;
    };
    let number = tree::text_at(pin, 1);
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsPin {
        kind: "pin".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        number: number.clone().map(bo::PadNumber),
        refdes: refdes(reference.clone()),
        at: at.map(point_nm),
        review_fields: review::entry(vec![("Pin number", number.map(review::text))]),
    };
    document.add(pin, &uuid, bo::BoardObjectsObject::Pin(object));
}

/// `index_schematic` sheets and their pins (`ecad-parse.mjs:1005-1037`).
fn sheets(document: &mut Document, sheet: &Node<'_>) {
    let Some(uuid) = identity(sheet) else {
        return;
    };
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsSheet {
        kind: "sheet".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        at: tree::point(sheet.child("at")).map(point_nm),
        kiid_paths: valid_paths(document, kiid_paths(sheet, &uuid)),
        properties: symbol_properties(sheet),
    };
    document.add(sheet, &uuid, bo::BoardObjectsObject::Sheet(object));

    for pin in sheet.children("pin") {
        sheet_pin(document, pin, &uuid);
    }
}

fn sheet_pin(document: &mut Document, pin: &Node<'_>, parent: &str) {
    let Some(uuid) = identity(pin) else {
        return;
    };
    let name = tree::text_at(pin, 1);
    let shape = tree::text_at(pin, 2);
    let at = tree::point(pin.child("at"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsSheetPin {
        kind: "sheet-pin".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        parent_uuid: Some(bo::KiCadUuid(parent.to_owned())),
        name: name.clone(),
        text: name.clone(),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, pin.child("at")),
        review_fields: review::entry(vec![
            ("Sheet pin", name.map(review::text)),
            ("Electrical type", shape.map(review::text)),
        ]),
    };
    document.add(pin, &uuid, bo::BoardObjectsObject::SheetPin(object));
}

/// `index_schematic` wires and buses (`ecad-parse.mjs:1039-1049`).
fn wires(document: &mut Document, item: &Node<'_>, kind: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let at = centroid_point(tree::pts_points(item));
    let review_fields = review::entry(vec![("Stroke", review::stroke_text(item.child("stroke")))]);
    let digest = document.digest(&uuid);
    let object = if kind == "wire" {
        bo::BoardObjectsObject::Wire(bo::BoardObjectsWire {
            kind: kind.to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            review_fields,
        })
    } else {
        bo::BoardObjectsObject::Bus(bo::BoardObjectsBus {
            kind: kind.to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            review_fields,
        })
    };
    document.add(item, &uuid, object);
}

/// `index_schematic` junctions, no-connects and bus entries
/// (`ecad-parse.mjs:1068-1083`).
fn connect(document: &mut Document, item: &Node<'_>, kind: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let at = tree::point(item.child("at")).map(point_nm);
    let review_fields = review::entry(vec![
        (
            "Diameter",
            tree::child_number(item, "diameter").map(review::number),
        ),
        ("Size", review::vector_text(item.child("size"))),
        ("Stroke", review::stroke_text(item.child("stroke"))),
    ]);
    let digest = document.digest(&uuid);
    let object = match kind {
        "junction" => bo::BoardObjectsObject::Junction(bo::BoardObjectsJunction {
            kind: kind.to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            review_fields,
        }),
        "no_connect" => bo::BoardObjectsObject::NoConnect(bo::BoardObjectsNoConnect {
            kind: kind.to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            review_fields,
        }),
        _ => bo::BoardObjectsObject::BusEntry(bo::BoardObjectsBusEntry {
            kind: kind.to_owned(),
            uuid: bo::KiCadUuid(uuid.clone()),
            content_digest: bo::BoardObjectsContentDigest(digest),
            at,
            review_fields,
        }),
    };
    document.add(item, &uuid, object);
}

/// `index_schematic` labels (`ecad-parse.mjs:1085-1103`).
fn labels(document: &mut Document, item: &Node<'_>) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let text = tree::text_at(item, 1);
    let at = tree::point(item.child("at"));
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsLabel {
        kind: "label".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        text: text.clone(),
        net: text.clone(),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, item.child("at")),
        review_fields: review::entry(vec![("Text", text.map(review::text))]),
    };
    document.add(item, &uuid, bo::BoardObjectsObject::Label(object));
}

/// `index_schematic` drawings (`ecad-parse.mjs:1105-1118`).
fn graphics(document: &mut Document, item: &Node<'_>, head: &str) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let text = tree::text_at(item, 1).filter(|_| matches!(head, "text" | "text_box"));
    let review_fields = graphic_review_fields(item, head);
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsGraphic {
        kind: "graphic".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        at: graphic_at(item, head),
        layer: None,
        text,
        review_fields,
    };
    document.add(item, &uuid, bo::BoardObjectsObject::Graphic(object));
}

fn graphic_at(item: &Node<'_>, head: &str) -> Option<bo::PointNm> {
    if let Some(point) = tree::point(item.child("at")) {
        return Some(point_nm(point));
    }
    if matches!(head, "polyline" | "bezier") {
        return centroid_point(tree::pts_points(item));
    }
    if matches!(head, "rectangle" | "arc") {
        return centroid_point(vec![center_point(item, "start"), center_point(item, "end")]);
    }
    None
}

fn graphic_review_fields(item: &Node<'_>, head: &str) -> review::ReviewRecord {
    let text_value = if matches!(head, "text" | "text_box") {
        tree::text_at(item, 1)
    } else {
        None
    };
    let fill = item
        .child("fill")
        .map(|fill| review::text(json_text(&super::units::canonical(&shapes::sch_fill(fill)))));
    review::graphic_review_fields(
        Some(head),
        text_value.as_deref(),
        item.child("stroke"),
        fill,
    )
}

/// `index_schematic` images (`ecad-parse.mjs:1120-1125`).
fn images(document: &mut Document, item: &Node<'_>) {
    let Some(uuid) = identity(item) else {
        return;
    };
    let scale = tree::child_number(item, "scale").unwrap_or(1.0);
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsImage {
        kind: "image".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        at: tree::point(item.child("at")).map(point_nm),
        review_fields: review::entry(vec![("Scale", Some(review::number(scale)))]),
    };
    document.add(item, &uuid, bo::BoardObjectsObject::Image(object));
}

/// `index_schematic` tables (`ecad-parse.mjs:1126-1134`).
fn tables(document: &mut Document, item: &Node<'_>) {
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
    let digest = document.digest(&uuid);
    let object = bo::BoardObjectsTable {
        kind: "table".to_owned(),
        uuid: bo::KiCadUuid(uuid.clone()),
        content_digest: bo::BoardObjectsContentDigest(digest),
        review_fields: review::entry(vec![
            (
                "Columns",
                tree::child_number(item, "column_count").map(review::number),
            ),
            ("Rows", rows.map(|rows| review::number(rows as f64))),
            ("Table content", Some(review::text(content))),
        ]),
    };
    document.add(item, &uuid, bo::BoardObjectsObject::Table(object));
}

// ------------------------------------------------------------------ helpers

/// A `(property …)` field of a symbol or sheet, typed.
fn property(node: &Node<'_>) -> bo::BoardObjectsSchematicProperty {
    let at = tree::point(node.child("at"));
    bo::BoardObjectsSchematicProperty {
        name: tree::text_at(node, 1).unwrap_or_default(),
        value: tree::text_at(node, 2).unwrap_or_default(),
        at: at.map(point_nm),
        rotation_deg: rotation_deg(at, node.child("at")),
        hide: shapes::atom_flag(node, "hide").unwrap_or(false),
        effects: node.child("effects").map(text_effects),
    }
}

/// `effects()` (`capture/board_objects.py:225-253`), typed.
fn text_effects(node: &Node<'_>) -> bo::BoardObjectsTextEffects {
    bo::BoardObjectsTextEffects {
        font: node.child("font").map(font_shape),
        justify: node.child("justify").map(justify_shape),
        hide: shapes::atom_flag(node, "hide"),
        href: tree::child_text(node, "href"),
    }
}

fn font_shape(node: &Node<'_>) -> bo::BoardObjectsFont {
    bo::BoardObjectsFont {
        face: tree::child_text(node, "face"),
        size: node.child("size").map(|size| bo::BoardObjectsFontSize {
            height_nm: bo::NonNegativeNanometres(
                mm_to_nm(tree::number_at(size, 1).unwrap_or(0.0)).max(0) as u64,
            ),
            width_nm: bo::NonNegativeNanometres(
                mm_to_nm(tree::number_at(size, 2).unwrap_or(0.0)).max(0) as u64,
            ),
        }),
        thickness_nm: tree::child_number(node, "thickness")
            .map(|value| bo::NonNegativeNanometres(mm_to_nm(value).max(0) as u64)),
        bold: shapes::atom_flag(node, "bold"),
        italic: shapes::atom_flag(node, "italic"),
        line_spacing: tree::child_number(node, "line_spacing"),
        color: node.child("color").map(color_shape),
    }
}

fn color_shape(node: &Node<'_>) -> bo::BoardObjectsColor {
    let channel = |index: usize| {
        tree::number_at(node, index)
            .map(|value| ((value / 255.0) * 255.0).round())
            .unwrap_or(0.0)
    };
    bo::BoardObjectsColor {
        red: channel(1),
        green: channel(2),
        blue: channel(3),
        alpha: Some(tree::number_at(node, 4).unwrap_or(1.0)),
    }
}

fn justify_shape(node: &Node<'_>) -> bo::BoardObjectsJustify {
    let mut horizontal = bo::BoardObjectsHorizontalJustify::Center;
    let mut vertical = bo::BoardObjectsVerticalJustify::Center;
    let mut mirror = false;
    for item in node.items().unwrap_or_default().iter().skip(1) {
        match item.text() {
            Some("left") => horizontal = bo::BoardObjectsHorizontalJustify::Left,
            Some("right") => horizontal = bo::BoardObjectsHorizontalJustify::Right,
            Some("top") => vertical = bo::BoardObjectsVerticalJustify::Top,
            Some("bottom") => vertical = bo::BoardObjectsVerticalJustify::Bottom,
            Some("mirror") => mirror = true,
            _ => {}
        }
    }
    bo::BoardObjectsJustify {
        horizontal,
        vertical,
        mirror,
    }
}

/// `symbol_reference` (`ecad-parse.mjs:879-891`).
fn symbol_reference(symbol: &Node<'_>) -> Option<String> {
    if let Some(instances) = symbol.child("instances") {
        for project in instances.children("project") {
            for path in project.children("path") {
                if let Some(reference) = tree::child_text(path, "reference")
                    && !reference.is_empty()
                {
                    return Some(reference);
                }
            }
        }
    }
    if let Some(reference) = symbol
        .child("default_instance")
        .and_then(|default| tree::child_text(default, "reference"))
        && !reference.is_empty()
    {
        return Some(reference);
    }
    for property in symbol.children("property") {
        if tree::text_at(property, 1).as_deref() == Some("Reference") {
            return tree::text_at(property, 2);
        }
    }
    None
}

/// `kiid_paths` (`ecad-parse.mjs:867-877`).
fn kiid_paths(item: &Node<'_>, uuid: &str) -> Vec<String> {
    let mut paths: Vec<String> = Vec::new();
    let Some(instances) = item.child("instances") else {
        return paths;
    };
    for project in instances.children("project") {
        for path in project.children("path") {
            if let Some(text) = tree::text_at(path, 1)
                && !text.is_empty()
            {
                let joined = format!("{}/{uuid}", text.trim_end_matches('/'));
                if !paths.contains(&joined) {
                    paths.push(joined);
                }
            }
        }
    }
    paths.sort();
    paths
}

/// `valid_paths` (`capture/board_objects.py:312-315`): drop invalid KIID paths.
fn valid_paths(document: &mut Document, paths: Vec<String>) -> Vec<bo::KiidPath> {
    let mut out = Vec::new();
    for path in paths {
        if is_kiid_path(&path) {
            out.push(bo::KiidPath(path));
        } else {
            document.invalid_path();
        }
    }
    out
}

/// `symbol_instances` (`ecad-parse.mjs:893-912`) mapped to member instances
/// (`capture/board_objects.py:349-353`).
fn symbol_instances(
    document: &mut Document,
    symbol: &Node<'_>,
    uuid: &str,
) -> Vec<bo::BoardObjectsSymbolInstance> {
    let mut instances = Vec::new();
    if let Some(node) = symbol.child("instances") {
        for project in node.children("project") {
            for path in project.children("path") {
                let reference = tree::child_text(path, "reference").unwrap_or_default();
                let mut entry = bo::BoardObjectsSymbolInstance {
                    reference: refdes(Some(reference)),
                    path: None,
                };
                if let Some(text) = tree::text_at(path, 1)
                    && !text.is_empty()
                {
                    entry.path = add_instance_path(document, &text, uuid);
                }
                instances.push(entry);
            }
        }
    }
    if instances.is_empty()
        && let Some(reference) = symbol
            .child("default_instance")
            .and_then(|default| tree::child_text(default, "reference"))
        && !reference.is_empty()
    {
        instances.push(bo::BoardObjectsSymbolInstance {
            reference: refdes(Some(reference)),
            path: None,
        });
    }
    instances
}

/// Insert an instance's `path`, marking an invalid KIID path
/// (`capture/board_objects.py:349-353`).
fn add_instance_path(document: &mut Document, text: &str, uuid: &str) -> Option<bo::KiidPath> {
    let joined = format!("{}/{uuid}", text.trim_end_matches('/'));
    if is_kiid_path(&joined) {
        Some(bo::KiidPath(joined))
    } else {
        document.invalid_path();
        None
    }
}

/// `symbol_properties` (`ecad-parse.mjs:914-928`) mapped to member properties.
fn symbol_properties(item: &Node<'_>) -> Vec<bo::BoardObjectsSchematicProperty> {
    item.children("property").map(property).collect()
}

/// `parseCenterOrStartOrEnd` (`kicad-sexpr-parser.mjs:2687-2696`): the two
/// coordinates, or `(0, 0)` for anything unreadable.
fn center_point(form: &Node<'_>, name: &str) -> (Option<f64>, Option<f64>) {
    let Some(node) = form.child(name) else {
        return (None, None);
    };
    if let Some(xy) = node.child("xy")
        && let (Some(x), Some(y)) = (tree::number_at(xy, 1), tree::number_at(xy, 2))
    {
        return (Some(x), Some(y));
    }
    if let (Some(x), Some(y)) = (tree::number_at(node, 1), tree::number_at(node, 2)) {
        return (Some(x), Some(y));
    }
    (Some(0.0), Some(0.0))
}

/// `refdes` (`capture/board_objects.py:318-321`): an empty value is absent.
fn refdes(value: Option<String>) -> Option<bo::Refdes> {
    parse_nonempty(value.filter(|text| !text.is_empty())?)
}

fn child_bool(node: &Node<'_>, name: &str) -> Option<bool> {
    shapes::atom_flag(node, name)
        .or_else(|| tree::child_text(node, name).map(|text| shapes::boolean(&text)))
}

/// The `(mirror …)` value as the contract's enum.
fn mirror_of(value: Option<String>) -> Option<bo::BoardObjectsMirror> {
    match value.as_deref() {
        Some("x") => Some(bo::BoardObjectsMirror::X),
        Some("y") => Some(bo::BoardObjectsMirror::Y),
        _ => None,
    }
}

fn centroid_point(points: Vec<(Option<f64>, Option<f64>)>) -> Option<bo::PointNm> {
    centroid_nm(&points).map(|(x, y)| bo::PointNm {
        x_nm: bo::Nanometres(x),
        y_nm: bo::Nanometres(y),
    })
}

/// The `KIID_PATH` pattern (`capture/board_objects.py:47`).
#[must_use]
pub(crate) fn is_kiid_path(text: &str) -> bool {
    text.split('/')
        .skip(1)
        .all(super::digest::is_canonical_uuid)
        && text.starts_with('/')
}
