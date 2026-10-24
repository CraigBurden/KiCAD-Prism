//! The stackup producer's records and the empty form.
//!
//! Ports the `layers` sub-layer records of `stackup_build.py:106-143`
//! ([`Layer`]), the stackup's entries and board-level settings of `:202-220`
//! ([`Stackup`]), the assembled document of `:288-298` ([`Document`]) and the
//! project-without-a-board form of `:84-103` ([`empty_form`]).

use super::{DEFAULT_THICKNESS_NM, SCHEMA};
use serde_json::{Map, Value, json};

/// One entry of `layers` (`stackup_build.py:106-143`, one per sub-layer).
pub(super) struct Layer {
    pub(super) name: String,
    pub(super) sublayer: u64,
    pub(super) kind: &'static str,
    pub(super) type_: Option<String>,
    pub(super) thickness_nm: Option<u64>,
    pub(super) material: Option<String>,
    pub(super) epsilon_r: Option<f64>,
    pub(super) loss_tangent: Option<f64>,
    pub(super) color: Option<String>,
}

impl Layer {
    pub(super) fn to_value(&self) -> Value {
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
pub(super) struct Stackup {
    pub(super) layers: Vec<Layer>,
    pub(super) settings: Map<String, Value>,
}

/// The assembled `StackupA0` document (`stackup_build.py:288-298`).
pub(super) struct Document {
    pub(super) present: bool,
    pub(super) board_thickness_nm: u64,
    pub(super) stack_thickness_nm: Option<u64>,
    pub(super) layers: Vec<Value>,
    pub(super) copper_layers: Vec<String>,
    pub(super) settings: Option<Map<String, Value>>,
    pub(super) mask_colors: Map<String, Value>,
    pub(super) via_spans: Vec<Value>,
    pub(super) board_layers: Vec<Value>,
}

impl Document {
    pub(super) fn to_value(&self) -> Value {
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

/// `empty_form` (`stackup_build.py:84-103`): the document for a project
/// without a board.
pub(super) fn empty_form() -> Value {
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
