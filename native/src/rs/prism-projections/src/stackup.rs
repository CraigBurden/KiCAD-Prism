//! `projections/stackup.json` (`prism.stackup.a0`). WP-P3's producer: a
//! faithful Rust port of the golden producer
//! `native/parity/prism_parity/capture/stackup_build.py`, which applies the
//! producer rules of `contracts/prism/field-maps/stackup.md` (1–8) to the
//! board's S-expression tree. The contract's root is
//! [`StackupA0`](prism_kicad_contracts::generated::prism_stackup_a0::StackupA0).
//!
//! The producer reads the board's own tree (never the core's typed `PcbView`),
//! because the golden did: the layer table, the stackup, the vias and the
//! `(general (thickness …))` form are all read straight from the tokens. The
//! tree helpers below mirror `stackup_build.py`'s, so a bare token and a quoted
//! one give the same string kicad_monkey's tokenizer produced.
//!
//! A project without a board gets the empty form (`stackup_build.py:empty_form`)
//! (bundle-format.md §2.1); the contract has no explicit empty form.
//!
//! # Warnings
//!
//! `stackup-unknown-token` (a `type`, layer-type or `edge_connector` token
//! outside the KiCad set; `stackup_build.py:113,197,217`) and
//! `stackup-copper-mismatch` (a stackup whose copper differs from the layer
//! table's; `stackup_build.py:226`) go to `stages.parse.warnings`. Every
//! message names the board by its repository path (`lib.rs`).

use crate::{Produced, ProducerWarning, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;
use prism_kicad_core::Sexp;
use serde_json::{Map, Value, json};
use std::collections::BTreeMap;

/// The member's schema id.
pub const SCHEMA: &str = "prism.stackup.a0";
const NAME: &str = "projections/stackup.json";

/// KiCad's 1.6 mm default board thickness (`stackup_build.py:32`, fork
/// `extended.rs:10,159-160`).
const DEFAULT_THICKNESS_NM: i64 = 1_600_000;

/// `STACKUP_TYPES` (`stackup_build.py:25-28`): the KiCad stackup `type` set.
const STACKUP_TYPES: [&str; 9] = [
    "Top Silk Screen",
    "Top Solder Paste",
    "Top Solder Mask",
    "copper",
    "core",
    "prepreg",
    "Bottom Solder Mask",
    "Bottom Solder Paste",
    "Bottom Silk Screen",
];

/// `BOARD_LAYER_TYPES` (`stackup_build.py:29`): the KiCad layer-table types.
const BOARD_LAYER_TYPES: [&str; 8] = [
    "signal",
    "power",
    "mixed",
    "jumper",
    "auxiliary",
    "front",
    "back",
    "user",
];

/// `VIA_TYPES` (`stackup_build.py:30`): header-token priority, first match wins.
const VIA_TYPES: [&str; 3] = ["blind", "buried", "micro"];

/// `EDGE_CONNECTORS` (`stackup_build.py:31`).
const EDGE_CONNECTORS: [&str; 2] = ["yes", "bevelled"];

/// Build `projections/stackup.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<StackupA0>, ProjectionError> {
    let (value, warnings) = match input.board {
        Some(board) => build(board.text, board.path)?,
        None => (empty_form(), Vec::new()),
    };
    let mut produced = document(NAME, value)?;
    produced.warnings = warnings;
    Ok(produced)
}

// ------------------------------------------------------------- tree helpers
//
// Ports of the prototype's helpers (`stackup_build.py:41-65`). All operate on
// the fork's owned [`Sexp`] tree; a form is any [`Sexp::List`].

/// `is_form` (`stackup_build.py:41-42`): a non-empty list whose head token is
/// `head`.
fn is_form(item: &Sexp, head: &str) -> bool {
    match item {
        Sexp::List(items) => matches!(
            items.first(),
            Some(Sexp::Atom(value) | Sexp::Quoted(value)) if value.as_str() == head
        ),
        _ => false,
    }
}

/// The elements of a list form, or an empty slice for a scalar (`form[1:]`,
/// which is what every helper scans).
fn form_children(item: &Sexp) -> &[Sexp] {
    match item {
        Sexp::List(items) => items,
        _ => &[],
    }
}

/// `child` (`stackup_build.py:45-51`): the first child form headed `head`.
fn child<'a, I>(items: I, head: &str) -> Option<&'a Sexp>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    items.into_iter().find(|item| is_form(item, head))
}

/// `value` (`stackup_build.py:54-56`): the second element of the first child
/// form headed `head`.
fn value<'a, I>(items: I, head: &str) -> Option<&'a Sexp>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    child(items, head).and_then(second)
}

/// The second element of a form (`found[1]`).
fn second(form: &Sexp) -> Option<&Sexp> {
    match form {
        Sexp::List(items) => items.get(1),
        _ => None,
    }
}

/// A token as a string; `None` for a form. Numbers are only reachable on a
/// malformed file, where a KiCad token here is an atom or a quoted string.
fn py_str(raw: &Sexp) -> Option<String> {
    match raw {
        Sexp::List(_) => None,
        Sexp::Atom(value) | Sexp::Quoted(value) => Some(value.clone()),
        Sexp::Integer(value) => Some(value.to_string()),
        Sexp::Float(value) => Some(value.to_string()),
    }
}

/// `text` (`stackup_build.py:59-65`): a token as a string, `None` for a form
/// or an empty token (rule 4: empty strings are absent).
fn text(raw: &Sexp) -> Option<String> {
    py_str(raw).filter(|value| !value.is_empty())
}

/// `nm` (`stackup_build.py:35-38`): conventions.md §6, round half away from
/// zero of the binary64 product mm × 1e6. `f64::round` rounds ties away from
/// zero, which is Python's `ROUND_HALF_UP` on the exact product.
fn nm(value_mm: f64) -> i64 {
    (value_mm * 1e6).round() as i64
}

/// The numeric value of a token (`float(value_mm)`).
fn as_f64(raw: &Sexp) -> Result<f64, ProjectionError> {
    match raw {
        Sexp::Float(value) => Ok(*value),
        Sexp::Integer(value) => Ok(*value as f64),
        Sexp::Atom(value) | Sexp::Quoted(value) => value
            .parse::<f64>()
            .map_err(|_| ProjectionError::new(format!("{NAME}: {value:?} is not a number"))),
        Sexp::List(_) => Err(ProjectionError::new(format!(
            "{NAME}: a list is not a number"
        ))),
    }
}

/// The integer value of a token (`int(row[0])`).
fn as_u64(raw: &Sexp) -> Result<u64, ProjectionError> {
    match raw {
        Sexp::Integer(value) => non_negative(*value, "ordinal"),
        Sexp::Float(value) => non_negative(*value as i64, "ordinal"),
        Sexp::Atom(value) | Sexp::Quoted(value) => value
            .parse::<u64>()
            .map_err(|_| ProjectionError::new(format!("{NAME}: {value:?} is not an ordinal"))),
        Sexp::List(_) => Err(ProjectionError::new(format!(
            "{NAME}: a list is not an ordinal"
        ))),
    }
}

/// A nanometre value that must be non-negative (`NonNegativeNanometres`).
fn non_negative(value: i64, what: &str) -> Result<u64, ProjectionError> {
    u64::try_from(value)
        .map_err(|_| ProjectionError::new(format!("{NAME}: {what} {value} nm is negative")))
}

/// `kind_of` (`stackup_build.py:68-81`): rule 3, the entry's kind from its
/// name alone.
fn kind_of(name: &str) -> &'static str {
    if name.ends_with(".Cu") {
        "copper"
    } else if name == "F.Mask" || name == "B.Mask" {
        "soldermask"
    } else if name == "F.Paste" || name == "B.Paste" {
        "paste"
    } else if name == "F.SilkS" || name == "B.SilkS" {
        "silkscreen"
    } else if name.starts_with("dielectric") {
        "dielectric"
    } else {
        "other"
    }
}

/// `_yes` (`stackup_build.py:146-147`): the child's text is exactly `yes`.
fn yes<'a, I>(items: I, head: &str) -> bool
where
    I: IntoIterator<Item = &'a Sexp>,
{
    value(items, head).and_then(text).as_deref() == Some("yes")
}

/// Python `repr` of a string token, for the warning messages the prototype
/// formats with `{name!r}`.
fn py_repr(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('\'');
    for character in value.chars() {
        match character {
            '\\' => out.push_str("\\\\"),
            '\'' => out.push_str("\\'"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(character),
        }
    }
    out.push('\'');
    out
}

/// Python `repr` of a list of strings (`f"{copper}"`).
fn py_list_repr(values: &[String]) -> String {
    let parts: Vec<String> = values.iter().map(|value| py_repr(value)).collect();
    format!("[{}]", parts.join(", "))
}

/// A producer warning naming the board by its repository path.
fn warning(board_path: &str, code: &str, message: String) -> ProducerWarning {
    ProducerWarning {
        code: code.to_owned(),
        message: format!("{board_path}: {message}"),
    }
}

// ----------------------------------------------------------------- records

/// One entry of `layers` (`stackup_build.py:106-143`, one per sub-layer).
struct Layer {
    name: String,
    sublayer: u64,
    kind: &'static str,
    type_: Option<String>,
    thickness_nm: Option<u64>,
    material: Option<String>,
    epsilon_r: Option<f64>,
    loss_tangent: Option<f64>,
    color: Option<String>,
}

impl Layer {
    fn to_value(&self) -> Value {
        let mut map = Map::new();
        map.insert("name".to_owned(), json!(self.name));
        map.insert("sublayer".to_owned(), json!(self.sublayer));
        map.insert("kind".to_owned(), json!(self.kind));
        if let Some(layer_type) = &self.type_ {
            map.insert("type".to_owned(), json!(layer_type));
        }
        if let Some(thickness) = self.thickness_nm {
            map.insert("thicknessNm".to_owned(), json!(thickness));
        }
        if let Some(material) = &self.material {
            map.insert("material".to_owned(), json!(material));
        }
        if let Some(epsilon_r) = self.epsilon_r {
            map.insert("epsilonR".to_owned(), json!(epsilon_r));
        }
        if let Some(loss_tangent) = self.loss_tangent {
            map.insert("lossTangent".to_owned(), json!(loss_tangent));
        }
        if let Some(color) = &self.color {
            map.insert("color".to_owned(), json!(color));
        }
        Value::Object(map)
    }
}

/// The stackup's entries and board-level settings (`stackup_build.py:202-220`).
struct Stackup {
    layers: Vec<Layer>,
    settings: Map<String, Value>,
}

/// A back drill or tertiary drill (`stackup_build.py:150-164`).
#[derive(Clone, Debug, Default, PartialEq, Eq, PartialOrd, Ord)]
struct Drill {
    size_nm: Option<u64>,
    start_layer: Option<String>,
    stop_layer: Option<String>,
}

/// The grouping key of a via (`stackup_build.py:255`): technology, span and
/// the two drills. `BTreeMap` keeps determinism; the sort that follows is
/// total, so the map's order never reaches the output.
#[derive(Clone, Debug, PartialEq, Eq, PartialOrd, Ord)]
struct ViaKey {
    via_type: String,
    start: Option<String>,
    stop: Option<String>,
    backdrill: Option<Drill>,
    tertiary: Option<Drill>,
}

/// `_drill_key` (`stackup_build.py:167-170`): the drill comparison tuple.
#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct DrillKey(u8, i64, String, String);

impl DrillKey {
    fn of(drill: Option<&Drill>) -> Self {
        match drill {
            None => Self(0, -1, String::new(), String::new()),
            Some(drill) => Self(
                1,
                drill.size_nm.map_or(-1, |size| size as i64),
                drill.start_layer.clone().unwrap_or_default(),
                drill.stop_layer.clone().unwrap_or_default(),
            ),
        }
    }
}

/// The via sort key (`stackup_build.py:279-286`).
#[derive(PartialEq, Eq, PartialOrd, Ord)]
struct SpanKey {
    start_index: usize,
    stop_index: usize,
    via_type: String,
    start: String,
    stop: String,
    backdrill: DrillKey,
    tertiary: DrillKey,
}

/// `empty_form` (`stackup_build.py:84-103`): the document for a project
/// without a board.
fn empty_form() -> Value {
    json!({
        "schema": SCHEMA,
        "present": false,
        "boardThicknessNm": DEFAULT_THICKNESS_NM,
        "layers": [],
        "copperLayers": [],
        "maskColors": {},
        "viaSpans": [],
        "boardLayers": [],
    })
}

/// `build` (`stackup_build.py:173-298`): `(document, warnings)` for one
/// `.kicad_pcb` text.
fn build(
    board_text: &str,
    board_path: &str,
) -> Result<(Value, Vec<ProducerWarning>), ProjectionError> {
    let root = prism_kicad_core::parse(board_text).map_err(|error| {
        ProjectionError::new(format!("{NAME}: the board does not parse: {error}"))
    })?;
    if !is_form(&root, "kicad_pcb") {
        return Err(ProjectionError::new(format!("{NAME}: not a kicad_pcb")));
    }
    let root_items = form_children(&root);
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

/// The assembled `StackupA0` document (`stackup_build.py:288-298`).
struct Document {
    present: bool,
    board_thickness_nm: u64,
    stack_thickness_nm: Option<u64>,
    layers: Vec<Value>,
    copper_layers: Vec<String>,
    settings: Option<Map<String, Value>>,
    mask_colors: Map<String, Value>,
    via_spans: Vec<Value>,
    board_layers: Vec<Value>,
}

impl Document {
    fn to_value(&self) -> Value {
        let mut doc = Map::new();
        doc.insert("schema".to_owned(), json!(SCHEMA));
        doc.insert("present".to_owned(), json!(self.present));
        doc.insert(
            "boardThicknessNm".to_owned(),
            json!(self.board_thickness_nm),
        );
        if let Some(thickness) = self.stack_thickness_nm {
            doc.insert("stackThicknessNm".to_owned(), json!(thickness));
        }
        doc.insert("layers".to_owned(), Value::Array(self.layers.clone()));
        doc.insert("copperLayers".to_owned(), json!(self.copper_layers));
        if let Some(settings) = &self.settings {
            doc.insert("settings".to_owned(), Value::Object(settings.clone()));
        }
        doc.insert(
            "maskColors".to_owned(),
            Value::Object(self.mask_colors.clone()),
        );
        doc.insert("viaSpans".to_owned(), Value::Array(self.via_spans.clone()));
        doc.insert(
            "boardLayers".to_owned(),
            Value::Array(self.board_layers.clone()),
        );
        Value::Object(doc)
    }
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

/// `copperLayers` (`stackup_build.py:222-228`, rule 7).
fn copper_layers(
    present: bool,
    layers: &[Layer],
    table_copper: &[String],
    warnings: &mut Vec<ProducerWarning>,
    board_path: &str,
) -> Vec<String> {
    if !present {
        return table_copper.to_vec();
    }
    let copper: Vec<String> = layers
        .iter()
        .filter(|layer| layer.kind == "copper")
        .map(|layer| layer.name.clone())
        .collect();
    if copper != table_copper {
        warnings.push(warning(
            board_path,
            "stackup-copper-mismatch",
            format!(
                "stackup copper {} differs from the layer table's {}",
                py_list_repr(&copper),
                py_list_repr(table_copper)
            ),
        ));
    }
    copper
}

/// `stackThicknessNm` (`stackup_build.py:230-235`, rule 8).
fn stack_thickness(present: bool, layers: &[Layer]) -> Option<u64> {
    if !present {
        return None;
    }
    let physical: Vec<&Layer> = layers
        .iter()
        .filter(|layer| matches!(layer.kind, "copper" | "dielectric" | "soldermask"))
        .collect();
    if physical.is_empty() {
        return None;
    }
    sum_thickness(&physical)
}

/// `maskColors` (`stackup_build.py:237-241`).
fn mask_colors(layers: &[Layer]) -> Map<String, Value> {
    let mut mask = Map::new();
    for (side, name) in [("front", "F.Mask"), ("back", "B.Mask")] {
        let entry = layers
            .iter()
            .find(|layer| layer.name == name && layer.sublayer == 0);
        if let Some(color) = entry.and_then(|entry| entry.color.as_ref()) {
            mask.insert(side.to_owned(), json!(color));
        }
    }
    mask
}

/// `viaSpans` (`stackup_build.py:243-286`, rule 6): every top-level `(via …)`
/// grouped, resolved against `copper` and sorted.
fn via_spans(root_items: &[Sexp], copper: &[String]) -> Result<Vec<Value>, ProjectionError> {
    let mut groups: BTreeMap<ViaKey, u64> = BTreeMap::new();
    for via in root_items.iter().skip(1) {
        if !is_form(via, "via") {
            continue;
        }
        let key = via_key(form_children(via))?;
        *groups.entry(key).or_insert(0) += 1;
    }
    let mut spans: Vec<(&ViaKey, u64)> = groups.iter().map(|(key, count)| (key, *count)).collect();
    spans.sort_by_key(|(key, _)| span_key(key, copper));
    Ok(spans
        .into_iter()
        .map(|(key, count)| via_span_value(key, count, copper))
        .collect())
}

/// The grouping key of one via (`stackup_build.py:247-255`).
fn via_key(via_items: &[Sexp]) -> Result<ViaKey, ProjectionError> {
    let header: Vec<String> = via_items
        .iter()
        .skip(1)
        .filter(|item| !matches!(item, Sexp::List(_)))
        .filter_map(py_str)
        .collect();
    let via_type = VIA_TYPES
        .iter()
        .find(|name| header.iter().any(|token| token == *name))
        .copied()
        .unwrap_or("through");
    let names: Vec<String> = child(via_items.iter(), "layers")
        .map(|form| {
            form_children(form)
                .iter()
                .skip(1)
                .filter_map(py_str)
                .collect()
        })
        .unwrap_or_default();
    let start = names.first().filter(|name| !name.is_empty()).cloned();
    let stop = names.get(1).filter(|name| !name.is_empty()).cloned();
    Ok(ViaKey {
        via_type: via_type.to_owned(),
        start,
        stop,
        backdrill: drill(via_items.iter(), "backdrill")?,
        tertiary: drill(via_items.iter(), "tertiary_drill")?,
    })
}

/// One `viaSpans` record (`stackup_build.py:262-274`).
fn via_span_value(key: &ViaKey, count: u64, copper: &[String]) -> Value {
    let mut record = Map::new();
    record.insert("viaType".to_owned(), json!(key.via_type));
    if let Some(start) = &key.start {
        record.insert("startLayer".to_owned(), json!(start));
    }
    if let Some(stop) = &key.stop {
        record.insert("stopLayer".to_owned(), json!(stop));
    }
    record.insert("spanLayers".to_owned(), json!(span_layers(key, copper)));
    if let Some(backdrill) = &key.backdrill {
        record.insert("backdrill".to_owned(), drill_value(backdrill));
    }
    if let Some(tertiary) = &key.tertiary {
        record.insert("tertiaryDrill".to_owned(), drill_value(tertiary));
    }
    record.insert("count".to_owned(), json!(count));
    Value::Object(record)
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

/// `_drill` (`stackup_build.py:150-164`): a back or tertiary drill, `None`
/// when neither a size nor a two-name `(layers …)` is written.
fn drill<'a, I>(items: I, head: &str) -> Result<Option<Drill>, ProjectionError>
where
    I: IntoIterator<Item = &'a Sexp>,
{
    let Some(form) = child(items, head) else {
        return Ok(None);
    };
    let cells = form_children(form);
    let mut result = Drill::default();
    if let Some(size) = value(cells.iter(), "size")
        && !matches!(size, Sexp::List(_))
    {
        result.size_nm = Some(non_negative(nm(as_f64(size)?), "drill size")?);
    }
    if let Some(layers) = child(cells.iter(), "layers") {
        let layer_cells = form_children(layers);
        if layer_cells.len() >= 3 {
            if let Some(start) = text(&layer_cells[1]) {
                result.start_layer = Some(start);
            }
            if let Some(stop) = text(&layer_cells[2]) {
                result.stop_layer = Some(stop);
            }
        }
    }
    if result.size_nm.is_none() && result.start_layer.is_none() && result.stop_layer.is_none() {
        Ok(None)
    } else {
        Ok(Some(result))
    }
}

/// The index of a layer name in `copper`, or `len(copper)` when absent
/// (`index_of`, `stackup_build.py:276-277`).
fn index_of(copper: &[String], name: Option<&str>) -> usize {
    match name {
        Some(name) => copper
            .iter()
            .position(|layer| layer == name)
            .unwrap_or(copper.len()),
        None => copper.len(),
    }
}

/// The `viaSpans` sort key (`stackup_build.py:279-286`).
fn span_key(key: &ViaKey, copper: &[String]) -> SpanKey {
    SpanKey {
        start_index: index_of(copper, key.start.as_deref()),
        stop_index: index_of(copper, key.stop.as_deref()),
        via_type: key.via_type.clone(),
        start: key.start.clone().unwrap_or_default(),
        stop: key.stop.clone().unwrap_or_default(),
        backdrill: DrillKey::of(key.backdrill.as_ref()),
        tertiary: DrillKey::of(key.tertiary.as_ref()),
    }
}

/// `spanLayers` (`stackup_build.py:257-261`): the copper layers from
/// `startLayer` to `stopLayer` inclusive, whatever their order; empty when
/// either is absent or not in `copper`.
fn span_layers(key: &ViaKey, copper: &[String]) -> Vec<String> {
    let (Some(start), Some(stop)) = (key.start.as_deref(), key.stop.as_deref()) else {
        return Vec::new();
    };
    let (Some(first), Some(last)) = (
        copper.iter().position(|layer| layer == start),
        copper.iter().position(|layer| layer == stop),
    ) else {
        return Vec::new();
    };
    let (low, high) = if first <= last {
        (first, last)
    } else {
        (last, first)
    };
    copper[low..=high].to_vec()
}

/// The JSON of one drill (`stackup_build.py:150-164`).
fn drill_value(drill: &Drill) -> Value {
    let mut map = Map::new();
    if let Some(size) = drill.size_nm {
        map.insert("sizeNm".to_owned(), json!(size));
    }
    if let Some(start) = &drill.start_layer {
        map.insert("startLayer".to_owned(), json!(start));
    }
    if let Some(stop) = &drill.stop_layer {
        map.insert("stopLayer".to_owned(), json!(stop));
    }
    Value::Object(map)
}

/// The exact integer sum of `thicknessNm` over `physical`, or `None` when any
/// entry has none (`stackup_build.py:230-235`, rule 8).
fn sum_thickness(physical: &[&Layer]) -> Option<u64> {
    let mut total = 0u64;
    for layer in physical {
        total = total.checked_add(layer.thickness_nm?)?;
    }
    Some(total)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a document from a board body wrapped in `(kicad_pcb …)`.
    fn build_board(body: &str) -> (Value, Vec<ProducerWarning>) {
        let text = format!("(kicad_pcb {body})");
        let (value, warnings) = build(&text, "boards/demo.kicad_pcb").expect("the board builds");
        serde_json::from_value::<StackupA0>(value.clone()).expect("the document decodes");
        (value, warnings)
    }

    fn warning_codes(warnings: &[ProducerWarning]) -> Vec<&str> {
        warnings
            .iter()
            .map(|warning| warning.code.as_str())
            .collect()
    }

    #[test]
    fn nm_rounds_half_away_from_zero() {
        assert_eq!(nm(1.6), 1_600_000);
        assert_eq!(nm(0.0152), 15_200);
        assert_eq!(nm(1.5584), 1_558_400);
        assert_eq!(nm(0.0), 0);
        // Exact half-way products round away from zero, as Python's
        // ROUND_HALF_UP on the exact binary64 product does.
        assert_eq!(1.5e-06 * 1e6, 1.5);
        assert_eq!(nm(1.5e-06), 2);
        assert_eq!(0.9999995 * 1e6, 999_999.5);
        assert_eq!(nm(0.9999995), 1_000_000);
        assert_eq!(nm(-2.5), -2_500_000);
    }

    #[test]
    fn a_project_without_a_board_gets_the_empty_form() {
        let value = empty_form();
        assert_eq!(value["present"], false);
        assert_eq!(value["boardThicknessNm"], DEFAULT_THICKNESS_NM);
        assert_eq!(value["layers"], json!([]));
        assert_eq!(value["copperLayers"], json!([]));
        assert_eq!(value["maskColors"], json!({}));
        assert_eq!(value["viaSpans"], json!([]));
        assert_eq!(value["boardLayers"], json!([]));
        assert!(value.get("stackThicknessNm").is_none());
        assert!(value.get("settings").is_none());
        serde_json::from_value::<StackupA0>(value).expect("the empty form decodes");
    }

    #[test]
    fn addsublayer_splits_one_dielectric_into_entries() {
        let (value, warnings) = build_board(
            r#"
            (general (thickness 1.0))
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1"
                    (type "prepreg")
                    (thickness 0.3)
                    (material "FR4")
                    (epsilon_r 4.6)
                    (loss_tangent 0.02)
                    addsublayer
                    (thickness 0.25)
                    (material "FR4-HiTg")
                    (epsilon_r 4.4)
                    (loss_tangent 0.015)
                    (color "FR4 natural")
                )
                (layer "B.Cu" (type "copper") (thickness 0.035))
                (copper_finish "None")
                (dielectric_constraints no)
            ))
            "#,
        );
        assert_eq!(warning_codes(&warnings), Vec::<&str>::new());
        assert_eq!(
            value["layers"],
            json!([
                {"name": "F.Cu", "sublayer": 0, "kind": "copper",
                 "type": "copper", "thicknessNm": 35_000},
                {"name": "dielectric 1", "sublayer": 0, "kind": "dielectric",
                 "type": "prepreg", "thicknessNm": 300_000,
                 "material": "FR4", "epsilonR": 4.6, "lossTangent": 0.02},
                {"name": "dielectric 1", "sublayer": 1, "kind": "dielectric",
                 "type": "prepreg", "thicknessNm": 250_000,
                 "material": "FR4-HiTg", "epsilonR": 4.4, "lossTangent": 0.015,
                 "color": "FR4 natural"},
                {"name": "B.Cu", "sublayer": 0, "kind": "copper",
                 "type": "copper", "thicknessNm": 35_000},
            ])
        );
        assert_eq!(value["stackThicknessNm"], 620_000);
    }

    #[test]
    fn an_unknown_type_token_is_omitted_with_a_warning() {
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (1 "F.Mask" obsolete))
            (setup (stackup
                (layer "F.Cu" (type "unobtainium") (thickness 0.035))
                (edge_connector zigzag)
            ))
            "#,
        );
        // The stackup layer type is dropped, so `type` is absent on the entry.
        assert!(value["layers"][0].get("type").is_none());
        // The layer-table type is dropped too.
        assert!(value["boardLayers"][1].get("type").is_none());
        assert_eq!(
            warning_codes(&warnings),
            vec![
                "stackup-unknown-token",
                "stackup-unknown-token",
                "stackup-unknown-token",
            ]
        );
        assert!(warnings[0].message.contains("obsolete"));
        assert!(warnings[1].message.contains("unobtainium"));
        assert!(warnings[2].message.contains("zigzag"));
        // `edge_connector` outside the set becomes `none`.
        assert_eq!(value["settings"]["edgeConnector"], "none");
    }

    #[test]
    fn a_stackup_copper_mismatch_warns_but_drives_copper_layers() {
        // A matching stackup: no warning.
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1" (type "core") (thickness 0.5))
                (layer "B.Cu" (type "copper") (thickness 0.035))
            ))
            "#,
        );
        assert!(warnings.is_empty());
        assert_eq!(value["copperLayers"], json!(["F.Cu", "B.Cu"]));

        // A stackup missing a table copper layer: the stackup still drives
        // `copperLayers`, and the mismatch is warned.
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1" (type "core") (thickness 0.5))
            ))
            "#,
        );
        assert_eq!(warning_codes(&warnings), vec!["stackup-copper-mismatch"]);
        assert!(
            warnings[0].message.contains(
                "stackup copper ['F.Cu'] differs from the layer table's ['F.Cu', 'B.Cu']"
            )
        );
        assert_eq!(value["copperLayers"], json!(["F.Cu"]));
    }

    #[test]
    fn each_via_type_is_recognised() {
        let (value, _) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (via blind (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via buried (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via micro (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            "#,
        );
        let spans = value["viaSpans"].as_array().expect("viaSpans");
        let types: Vec<&str> = spans
            .iter()
            .map(|span| span["viaType"].as_str().expect("viaType"))
            .collect();
        assert_eq!(types, vec!["blind", "buried", "micro", "through"]);
    }

    #[test]
    fn each_edge_connector_value_is_recognised() {
        for token in ["yes", "bevelled"] {
            let (value, warnings) = build_board(&format!(
                "(layers (0 \"F.Cu\" signal))\n(setup (stackup \
                 (layer \"F.Cu\" (type \"copper\")) (edge_connector {token})))"
            ));
            assert!(warnings.is_empty());
            assert_eq!(value["settings"]["edgeConnector"], token);
        }
        let (value, warnings) = build_board(
            "(layers (0 \"F.Cu\" signal))\n(setup (stackup (layer \"F.Cu\" (type \"copper\"))))",
        );
        assert!(warnings.is_empty());
        assert_eq!(value["settings"]["edgeConnector"], "none");
    }

    #[test]
    fn a_drill_needs_a_size_or_a_two_name_layers_form() {
        let (value, _) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (via (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu")
                (backdrill (size 0.6) (layers "F.Cu" "In1.Cu"))
                (tertiary_drill (layers "F.Cu" "B.Cu")))
            "#,
        );
        let span = &value["viaSpans"][0];
        assert_eq!(span["backdrill"]["sizeNm"], 600_000);
        assert_eq!(span["backdrill"]["startLayer"], "F.Cu");
        assert_eq!(span["backdrill"]["stopLayer"], "In1.Cu");
        assert_eq!(span["tertiaryDrill"]["startLayer"], "F.Cu");
        assert!(span["tertiaryDrill"].get("sizeNm").is_none());
    }
}
