//! Reading a `.kicad_pcb` into the stackup document.
//!
//! Ports `stackup_build.py:173-298`: [`build`] (the whole document), the board
//! thickness form (`:183-184`), the layer table (`:186-200`), the stackup form
//! (`:202-220`) and one stackup layer's sub-layer entries (`:106-143`).

use super::records::{Document, Layer, Stackup};
use super::summary::{copper_layers, mask_colors, stack_thickness};
use super::tree::{
    as_f64, as_u64, child, form_children, is_form, kind_of, nm, non_negative, py_repr, py_str,
    text, value, warning, yes,
};
use super::via::via_spans;
use super::{BOARD_LAYER_TYPES, DEFAULT_THICKNESS_NM, EDGE_CONNECTORS, NAME, STACKUP_TYPES};
use crate::{ProducerWarning, ProjectionError};
use prism_kicad_core::Sexp;
use serde_json::{Map, Value, json};

/// `build` (`stackup_build.py:173-298`): `(document, warnings)` for one
/// `.kicad_pcb` text, from the shared board tree.
pub(super) fn build(
    root: &Sexp,
    board_path: &str,
) -> Result<(Value, Vec<ProducerWarning>), ProjectionError> {
    if !is_form(root, "kicad_pcb") {
        return Err(ProjectionError::new(format!("{NAME}: not a kicad_pcb")));
    }
    let root_items = form_children(root);
    let mut warnings: Vec<ProducerWarning> = Vec::new();

    let board_thickness = board_thickness(root_items)?;
    let (board_layers, table_copper) = read_board_layers(root_items, &mut warnings, board_path)?;
    let stackup = read_stackup(root_items, &mut warnings, board_path)?;
    let present = stackup.is_some();
    let (layers, settings) = stackup.map_or_else(
        || (Vec::new(), None),
        |stackup| (stackup.layers, Some(stackup.settings)),
    );
    let copper = copper_layers(present, &layers, &table_copper, &mut warnings, board_path);
    let stack_thickness = stack_thickness(present, &layers);
    let mask_colors = mask_colors(&layers);
    let via_spans = via_spans(root_items, &copper)?;

    let document = Document {
        present,
        board_thickness_nm: non_negative(board_thickness, "board thickness")?,
        stack_thickness_nm: stack_thickness,
        layers: layers.iter().map(Layer::to_value).collect(),
        copper_layers: copper,
        settings,
        mask_colors,
        via_spans,
        board_layers,
    };
    Ok((document.to_value(), warnings))
}

/// R6's copper order for `route_metrics`: the stackup member's `copperLayers`
/// (`stackup_build.py:222-228`, rule 7) from the shared tree alone, without
/// building the rest of the member. It reads the same layer table and stackup
/// forms as [`build`] and applies the one shared rule
/// (`summary::copper_layers`), so the value is exactly `build`'s.
pub(super) fn copper_order(root: &Sexp, board_path: &str) -> Result<Vec<String>, ProjectionError> {
    if !is_form(root, "kicad_pcb") {
        return Err(ProjectionError::new(format!("{NAME}: not a kicad_pcb")));
    }
    let root_items = form_children(root);
    let mut warnings: Vec<ProducerWarning> = Vec::new();
    let (_, table_copper) = read_board_layers(root_items, &mut warnings, board_path)?;
    let stackup = read_stackup(root_items, &mut warnings, board_path)?;
    let present = stackup.is_some();
    let layers = stackup.map_or_else(Vec::new, |stackup| stackup.layers);
    Ok(copper_layers(
        present,
        &layers,
        &table_copper,
        &mut warnings,
        board_path,
    ))
}

/// `(general (thickness …))` (`stackup_build.py:183-184`), or KiCad's default.
fn board_thickness(root_items: &[Sexp]) -> Result<i64, ProjectionError> {
    let general = child(root_items.iter(), "general");
    let thickness = general.and_then(|general| value(form_children(general).iter(), "thickness"));
    match thickness {
        Some(thickness) if !matches!(thickness, Sexp::List(_)) => Ok(nm(as_f64(thickness)?)),
        _ => Ok(DEFAULT_THICKNESS_NM),
    }
}

/// The `(layers …)` table (`stackup_build.py:186-200`): the rows and the
/// table's copper names.
fn read_board_layers(
    root_items: &[Sexp],
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Result<(Vec<Value>, Vec<String>), ProjectionError> {
    let mut rows = Vec::new();
    if let Some(table) = child(root_items.iter(), "layers") {
        for row in form_children(table).iter().skip(1) {
            let Sexp::List(cells) = row else {
                continue;
            };
            if cells.len() < 2 {
                continue;
            }
            rows.push(board_layer_row(cells, warnings, board_path)?);
        }
    }
    let table_copper = rows
        .iter()
        .filter_map(|row| row["name"].as_str())
        .filter(|name| name.ends_with(".Cu"))
        .map(str::to_owned)
        .collect();
    Ok((rows, table_copper))
}

/// One row of the `(layers …)` table (`stackup_build.py:186-200`).
fn board_layer_row(
    cells: &[Sexp],
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Result<Value, ProjectionError> {
    let ordinal = as_u64(&cells[0])?;
    let name = py_str(&cells[1])
        .ok_or_else(|| ProjectionError::new(format!("{NAME}: a layer row has no name token")))?;
    let mut item = Map::new();
    item.insert("ordinal".to_owned(), json!(ordinal));
    item.insert("name".to_owned(), json!(name));
    if let Some(token) = cells.get(2).and_then(text) {
        if BOARD_LAYER_TYPES.contains(&token.as_str()) {
            item.insert("type".to_owned(), json!(token));
        } else {
            warnings.push(warning(
                board_path,
                "stackup-unknown-token",
                format!(
                    "layer {}: type {} is not a KiCad layer type",
                    py_repr(&name),
                    py_repr(&token)
                ),
            ));
        }
    }
    if let Some(user_name) = cells.get(3).and_then(text) {
        item.insert("userName".to_owned(), json!(user_name));
    }
    Ok(Value::Object(item))
}

/// The `(setup (stackup …))` form (`stackup_build.py:202-220`), or `None`.
fn read_stackup(
    root_items: &[Sexp],
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Result<Option<Stackup>, ProjectionError> {
    let setup = child(root_items.iter(), "setup");
    let Some(stackup) = setup.and_then(|setup| child(form_children(setup).iter(), "stackup"))
    else {
        return Ok(None);
    };
    let children = form_children(stackup);
    let mut layers = Vec::new();
    for form in children.iter().skip(1) {
        if is_form(form, "layer") && form_children(form).len() > 1 {
            stackup_entries(form, &mut layers, warnings, board_path)?;
        }
    }
    let mut settings = Map::new();
    if let Some(finish) = value(children.iter(), "copper_finish").and_then(text) {
        settings.insert("copperFinish".to_owned(), json!(finish));
    }
    settings.insert(
        "dielectricConstraints".to_owned(),
        json!(yes(children.iter(), "dielectric_constraints")),
    );
    let edge = value(children.iter(), "edge_connector").and_then(text);
    if let Some(edge) = edge.as_ref()
        && !EDGE_CONNECTORS.contains(&edge.as_str())
    {
        warnings.push(warning(
            board_path,
            "stackup-unknown-token",
            format!("edge_connector {} is not a KiCad value", py_repr(edge)),
        ));
    }
    let edge_connector = match edge.as_deref() {
        Some(edge) if EDGE_CONNECTORS.contains(&edge) => edge.to_owned(),
        _ => "none".to_owned(),
    };
    settings.insert("edgeConnector".to_owned(), json!(edge_connector));
    settings.insert(
        "castellatedPads".to_owned(),
        json!(yes(children.iter(), "castellated_pads")),
    );
    settings.insert(
        "edgePlating".to_owned(),
        json!(yes(children.iter(), "edge_plating")),
    );
    Ok(Some(Stackup { layers, settings }))
}

/// `_stackup_entries` (`stackup_build.py:106-143`): one entry per sub-layer of
/// one stackup `(layer …)` form (rules 2 and 3).
fn stackup_entries(
    form: &Sexp,
    layers: &mut Vec<Layer>,
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Result<(), ProjectionError> {
    let items = form_children(form);
    let name = py_str(&items[1]).ok_or_else(|| {
        ProjectionError::new(format!("{NAME}: a stackup layer has no name token"))
    })?;
    let kind = kind_of(&name);
    let layer_type = stackup_type(items, &name, warnings, board_path);
    for (index, group) in sublayer_groups(items).iter().enumerate() {
        layers.push(sublayer_entry(
            group,
            &name,
            index as u64,
            kind,
            layer_type.as_deref(),
        )?);
    }
    Ok(())
}

/// The stackup layer's `type`, or `None` when absent or outside the KiCad set
/// (`stackup_build.py:111-114`, rule 2).
fn stackup_type(
    items: &[Sexp],
    name: &str,
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Option<String> {
    let layer_type = value(items.iter(), "type").and_then(text);
    if let Some(token) = layer_type.as_ref()
        && !STACKUP_TYPES.contains(&token.as_str())
    {
        warnings.push(warning(
            board_path,
            "stackup-unknown-token",
            format!(
                "stackup layer {}: type {} is not a KiCad stackup type",
                py_repr(name),
                py_repr(token)
            ),
        ));
        return None;
    }
    layer_type
}

/// Split a stackup form at each bare `addsublayer` token
/// (`stackup_build.py:115-120`).
fn sublayer_groups(items: &[Sexp]) -> Vec<Vec<&Sexp>> {
    let mut groups: Vec<Vec<&Sexp>> = vec![Vec::new()];
    for item in items.iter().skip(2) {
        if matches!(item, Sexp::List(_)) {
            if let Some(current) = groups.last_mut() {
                current.push(item);
            }
        } else if text(item).as_deref() == Some("addsublayer") {
            groups.push(Vec::new());
        }
    }
    groups
}

/// One sub-layer entry (`stackup_build.py:121-142`).
fn sublayer_entry(
    group: &[&Sexp],
    name: &str,
    sublayer: u64,
    kind: &'static str,
    layer_type: Option<&str>,
) -> Result<Layer, ProjectionError> {
    let mut entry = Layer {
        name: name.to_owned(),
        sublayer,
        kind,
        type_: layer_type.map(str::to_owned),
        thickness_nm: None,
        material: None,
        epsilon_r: None,
        loss_tangent: None,
        color: None,
    };
    if let Some(raw) = value(group.iter().copied(), "thickness")
        && !matches!(raw, Sexp::List(_))
    {
        // `(thickness <mm> locked)`: the value is the thickness.
        let amount = nm(as_f64(raw)?);
        if amount > 0 {
            entry.thickness_nm = Some(non_negative(amount, "thickness")?);
        }
    }
    if let Some(material) = value(group.iter().copied(), "material").and_then(text) {
        entry.material = Some(material);
    }
    if let Some(raw) = value(group.iter().copied(), "epsilon_r")
        && !matches!(raw, Sexp::List(_))
    {
        entry.epsilon_r = Some(as_f64(raw)?);
    }
    if let Some(raw) = value(group.iter().copied(), "loss_tangent")
        && !matches!(raw, Sexp::List(_))
    {
        entry.loss_tangent = Some(as_f64(raw)?);
    }
    if let Some(color) = value(group.iter().copied(), "color").and_then(text) {
        entry.color = Some(color);
    }
    Ok(entry)
}
