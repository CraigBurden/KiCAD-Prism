//! `projections/placements.json` (`prism.placements.a1`). Filled by WP-P3; a
//! faithful Rust port of the golden producer
//! `native/parity/prism_parity/capture/placements_build.py` (field map
//! `contracts/prism/field-maps/placements.md`, rules R1-R13, decisions
//! "Placements" 1-5 and "Occurrences" 1). a1 adds `auxAxisOrigin`, the board's
//! auxiliary axis origin, read from the core's parsed board setup.
//!
//! The board's top-level forms come from the fork parser's spans
//! (`prism_kicad_core::sexpr_projection`); each form is decoded with the fork
//! S-expression parser (`prism_kicad_core::sexpr`) so the tree helpers in
//! `tree` see the same atoms and numbers as kicad_monkey's tokenizer. A
//! project without a board gets the contract's empty form (bundle-format.md
//! §2.1).

mod geometry;
mod numbers;
mod tree;

use crate::{Produced, ProducerWarning, ProjectionError, ProjectionInput, document};
use geometry::{graphic_points, point_bounds, rotate_point};
use numbers::{degrees, fold, is_canonical_uuid, nm};
use prism_kicad_contracts::generated::prism_placements_a1::{
    ByteCount, Degrees, KiCadUuid, LibId, Nanometres, NonNegativeNanometres, PadNumber,
    PlacementsA1, PlacementsBounds, PlacementsFootprint, PlacementsFormLength, PlacementsModel,
    PlacementsModelOffset, PlacementsModelPath, PlacementsModelRotation, PlacementsModelScale,
    PlacementsPad, PlacementsPadShape, PlacementsPadSize, PlacementsPadType, PlacementsSourceSpan,
    PointNm, Refdes, Side,
};
use prism_kicad_core::sexpr::{Error as SexprError, Sexp};
use prism_kicad_core::sexpr_projection::{FormSpan, Selector, parse_form, scan_form_spans};
use serde_json::json;
use std::collections::BTreeSet;

/// The member's schema id (`placements_build.py:30`).
pub const SCHEMA: &str = "prism.placements.a1";
const NAME: &str = "projections/placements.json";

/// The footprint courtyard layers (`placements_build.py:34`).
const COURTYARD_LAYERS: [&str; 2] = ["F.CrtYd", "B.CrtYd"];
/// The board-level graphics (R12) and their characteristic-point kind
/// (`placements_build.py:36`).
const GR_GRAPHICS: [(&str, &str); 6] = [
    ("gr_line", "line"),
    ("gr_rect", "rect"),
    ("gr_circle", "circle"),
    ("gr_arc", "arc"),
    ("gr_poly", "poly"),
    ("gr_curve", "curve"),
];
/// The footprint graphics (R8) and their characteristic-point kind
/// (`placements_build.py:35`).
const FP_GRAPHICS: [(&str, &str); 6] = [
    ("fp_line", "line"),
    ("fp_rect", "rect"),
    ("fp_circle", "circle"),
    ("fp_arc", "arc"),
    ("fp_poly", "poly"),
    ("fp_curve", "curve"),
];

/// Build `projections/placements.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<PlacementsA1>, ProjectionError> {
    let Some(board) = input.board else {
        return document(
            NAME,
            json!({"schema": SCHEMA, "footprints": [], "designators": []}),
        );
    };
    let aux_axis_origin = aux_axis_origin(board.view)?;
    let (document, warnings) = build(board.text, aux_axis_origin)?;
    Ok(Produced { document, warnings })
}

/// The board's auxiliary axis origin, in nanometres, when it sets one
/// (`prism-kicad-core/src/pcb/setup.rs`; C3 §3.3).
fn aux_axis_origin(
    view: &prism_kicad_core::PcbView<'_>,
) -> Result<Option<PointNm>, ProjectionError> {
    let setup = view.setup().map_err(|error| {
        ProjectionError::new(format!(
            "placements: the board setup does not parse: {error}"
        ))
    })?;
    Ok(setup
        .filter(|setup| setup.has_aux_axis_origin)
        .map(|setup| point((nm(setup.aux_axis_origin.x), nm(setup.aux_axis_origin.y)))))
}

/// R1-R13 for one `.kicad_pcb` text (`placements_build.py:298-367`).
fn build(
    text: &str,
    aux_axis_origin: Option<PointNm>,
) -> Result<(PlacementsA1, Vec<ProducerWarning>), ProjectionError> {
    if !is_kicad_pcb(text)? {
        return Err(ProjectionError::new(
            "placements: the board is not a kicad_pcb",
        ));
    }
    let selector = Selector {
        heads: Some(
            GR_GRAPHICS
                .iter()
                .map(|(head, _)| (*head).to_string())
                .chain(std::iter::once("footprint".to_string()))
                .collect(),
        ),
        min_depth: Some(1),
        max_depth: Some(1),
        ..Selector::default()
    };
    let spans = scan_form_spans(text, &selector).map_err(board_error)?;
    let mut warnings = Vec::new();
    let mut footprints = Vec::new();
    let mut seen = BTreeSet::new();
    let mut references = BTreeSet::new();
    let mut outline_points = Vec::new();
    for span in &spans {
        let head = span.head.as_deref().unwrap_or_default();
        let form = parse_form(text, span).map_err(board_error)?;
        if let Some(kind) = graphic_kind(head) {
            if tree::layer_of(&form).as_deref() == Some("Edge.Cuts") {
                outline_points.extend(graphic_points(&form, kind));
            }
            continue;
        }
        if head != "footprint" {
            continue;
        }
        let uuid = uuid_of(&form);
        if !is_canonical_uuid(&uuid) || !seen.insert(uuid.clone()) {
            warnings.push(ProducerWarning {
                code: "placements-footprint-skipped".to_string(),
                message: format!(
                    "footprint at byte {}: uuid {}",
                    span.range.start,
                    tree::py_repr_str(&uuid)
                ),
            });
            continue;
        }
        let footprint = build_footprint(&form, uuid, span)?;
        if let Some(reference) = &footprint.reference {
            references.insert(reference.to_string());
        }
        footprints.push(footprint);
    }
    let designators = references
        .into_iter()
        .map(|value| Refdes::try_from(value).map_err(|_| empty_refdes_error()))
        .collect::<Result<Vec<_>, _>>()?;
    Ok((
        PlacementsA1 {
            schema: SCHEMA.to_string(),
            footprints,
            designators,
            outline_bounds: bounds_points(&outline_points),
            aux_axis_origin,
        },
        warnings,
    ))
}

/// One `(footprint …)` form, R2-R11 (`placements_build.py:328-358`).
fn build_footprint(
    form: &Sexp,
    uuid: String,
    span: &FormSpan,
) -> Result<PlacementsFootprint, ProjectionError> {
    let reference = reference_of(form)
        .map(|value| Refdes::try_from(value).map_err(|_| empty_refdes_error()))
        .transpose()?;
    let lib_text = scalar_child(form, 1);
    let lib_id = if lib_text.is_empty() {
        None
    } else {
        Some(LibId::try_from(lib_text).map_err(|_| empty_lib_id_error())?)
    };
    let layer = tree::layer_of(form).unwrap_or_default();
    let side = if layer.starts_with("B.") {
        Side::Back
    } else {
        Side::Front
    };
    let at = tree::child(Some(form), "at");
    let (ax, ay) = tree::xy(at).unwrap_or((0.0, 0.0));
    let rotation = match at.and_then(tree::as_list) {
        Some(values) if values.len() > 3 => degrees(tree::number(&values[3], 0.0)),
        _ => 0.0,
    };
    let fp_at = (nm(ax), nm(ay));
    let tokens = attr_tokens(tree::child(Some(form), "attr"));
    let length = span.range.end.saturating_sub(span.range.start);
    Ok(PlacementsFootprint {
        uuid: KiCadUuid::from(uuid),
        reference,
        lib_id,
        side,
        position_nm: point(fp_at),
        rotation_deg: Degrees::from(fold(rotation)),
        dnp: tokens.contains("dnp"),
        exclude_from_pos_files: tokens.contains("exclude_from_pos_files"),
        courtyard_bounds: bounds_points(&courtyard_points(form)),
        pads: build_pads(fp_at, rotation, form)?,
        models: build_models(form)?,
        source_span: PlacementsSourceSpan {
            offset_bytes: ByteCount::from(span.range.start as u64),
            length_bytes: PlacementsFormLength::from(length as i64),
        },
    })
}

/// The footprint's first `(property "Reference" …)` value, or `None`
/// (`placements_build.py:245-250`).
fn reference_of(form: &Sexp) -> Option<String> {
    for property in tree::children(form, "property") {
        let values = tree::as_list(property).unwrap_or_default();
        if values.len() > 1 && tree::py_str(&values[1]) == "Reference" {
            let value = match values.get(2) {
                Some(item) if !matches!(item, Sexp::List(_)) => tree::py_str(item),
                _ => String::new(),
            };
            return (!value.is_empty()).then_some(value);
        }
    }
    None
}

/// The footprint's `(attr …)` tokens (`placements_build.py:343-346`).
fn attr_tokens(attr: Option<&Sexp>) -> BTreeSet<String> {
    let mut tokens = BTreeSet::new();
    if let Some(values) = attr.and_then(tree::as_list) {
        for token in values.get(1..).unwrap_or_default() {
            if !matches!(token, Sexp::List(_)) {
                tokens.insert(tree::py_str(token));
            }
        }
    }
    tokens
}

/// R8: every courtyard graphic's characteristic points, footprint-local
/// (`placements_build.py:347-350`).
fn courtyard_points(form: &Sexp) -> Vec<(f64, f64)> {
    let mut points = Vec::new();
    for graphic in tree::as_list(form)
        .and_then(|values| values.get(1..))
        .unwrap_or_default()
    {
        let head = tree::head(graphic);
        let kind = head.as_deref().and_then(fp_kind);
        if let Some(kind) = kind {
            let layer = tree::layer_of(graphic);
            if layer
                .as_deref()
                .is_some_and(|layer| COURTYARD_LAYERS.contains(&layer))
            {
                points.extend(graphic_points(graphic, kind));
            }
        }
    }
    points
}

/// R9: the footprint's pads, in file order (`placements_build.py:354`).
fn build_pads(
    fp_at: (i64, i64),
    rotation: f64,
    form: &Sexp,
) -> Result<Vec<PlacementsPad>, ProjectionError> {
    tree::children(form, "pad")
        .into_iter()
        .map(|pad| build_pad(fp_at, rotation, pad))
        .collect()
}

/// One `(pad …)` form (`placements_build.py:253-268`).
fn build_pad(
    fp_at: (i64, i64),
    rotation: f64,
    form: &Sexp,
) -> Result<PlacementsPad, ProjectionError> {
    let number = scalar_child(form, 1);
    let type_text = scalar_child(form, 2);
    let shape_text = scalar_child(form, 3);
    let Some(pad_type) = pad_type(&type_text) else {
        return Err(pad_rejected(&number, &type_text, &shape_text));
    };
    let Some(shape) = pad_shape(&shape_text) else {
        return Err(pad_rejected(&number, &type_text, &shape_text));
    };
    let local = tree::xy(tree::child(Some(form), "at")).unwrap_or((0.0, 0.0));
    let (rx, ry) = rotate_point(nm(local.0), nm(local.1), rotation);
    let size = tree::xy(tree::child(Some(form), "size")).unwrap_or((0.0, 0.0));
    Ok(PlacementsPad {
        number: PadNumber::from(number),
        type_: pad_type,
        shape,
        position_nm: point((fp_at.0 + rx, fp_at.1 + ry)),
        size: PlacementsPadSize {
            x_nm: nonneg(size.0)?,
            y_nm: nonneg(size.1)?,
        },
    })
}

/// R10: the footprint's models, in file order, empty paths skipped
/// (`placements_build.py:355`).
fn build_models(form: &Sexp) -> Result<Vec<PlacementsModel>, ProjectionError> {
    let mut models = Vec::new();
    for model in tree::children(form, "model") {
        if let Some(built) = build_model(model)? {
            models.push(built);
        }
    }
    Ok(models)
}

/// One `(model …)` form (`placements_build.py:271-295`).
fn build_model(form: &Sexp) -> Result<Option<PlacementsModel>, ProjectionError> {
    let path = scalar_child(form, 1);
    if path.is_empty() {
        return Ok(None);
    }
    let mut hidden = false;
    for item in tree::as_list(form)
        .and_then(|values| values.get(2..))
        .unwrap_or_default()
    {
        if tree::is_form(item, Some("hide")) {
            let values = tree::as_list(item).unwrap_or_default();
            hidden = values.len() < 2 || tree::py_str(&values[1]) != "no";
        } else if !matches!(item, Sexp::List(_)) && tree::py_str(item) == "hide" {
            hidden = true;
        }
    }
    let offset = if let Some(offset) = tree::child(Some(form), "offset") {
        tree::xyz(Some(offset), 0.0)
    } else if let Some(at) = tree::child(Some(form), "at") {
        let values = tree::xyz(Some(at), 0.0);
        [values[0] * 25.4, values[1] * 25.4, values[2] * 25.4]
    } else {
        [0.0; 3]
    };
    let rotation = tree::xyz(tree::child(Some(form), "rotate"), 0.0);
    let scale = tree::xyz(tree::child(Some(form), "scale"), 1.0);
    Ok(Some(PlacementsModel {
        path: PlacementsModelPath::try_from(path).map_err(|_| empty_model_path_error())?,
        hidden,
        offset: PlacementsModelOffset {
            x_nm: Nanometres::from(nm(offset[0])),
            y_nm: Nanometres::from(nm(offset[1])),
            z_nm: Nanometres::from(nm(offset[2])),
        },
        rotation: PlacementsModelRotation {
            x_deg: Degrees::from(fold(rotation[0])),
            y_deg: Degrees::from(fold(rotation[1])),
            z_deg: Degrees::from(fold(rotation[2])),
        },
        scale: PlacementsModelScale {
            x: fold(scale[0]),
            y: fold(scale[1]),
            z: fold(scale[2]),
        },
    }))
}

/// R13/the actor: the box of `points` in nanometres, or `None`
/// (`placements_build.py:179-185`).
fn bounds_points(points: &[(f64, f64)]) -> Option<PlacementsBounds> {
    let (min, max) = point_bounds(points)?;
    Some(PlacementsBounds {
        min_nm: point((nm(min.0), nm(min.1))),
        max_nm: point((nm(max.0), nm(max.1))),
    })
}

/// A `PointNm` from integer nanometres.
fn point(value: (i64, i64)) -> PointNm {
    PointNm {
        x_nm: Nanometres::from(value.0),
        y_nm: Nanometres::from(value.1),
    }
}

/// The value at `index` of a form when it is not a list, else `""`
/// (`placements_build.py:254-256`, `:272`, `:332`).
fn scalar_child(form: &Sexp, index: usize) -> String {
    match tree::as_list(form).and_then(|values| values.get(index)) {
        Some(item) if !matches!(item, Sexp::List(_)) => tree::py_str(item),
        _ => String::new(),
    }
}

/// The footprint's `(uuid …)`, or `""` (`placements_build.py:322-323`). KiCad 6 and 7
/// boards write `(tstamp …)` instead, which KiCad 10 still reads as the uuid
/// (`PCB_IO_KICAD_SEXPR_PARSER::parseFOOTPRINT_unchecked`).
fn uuid_of(form: &Sexp) -> String {
    ["uuid", "tstamp"]
        .into_iter()
        .find_map(
            |head| match tree::child(Some(form), head).and_then(tree::as_list) {
                Some(values) if values.len() > 1 => Some(tree::py_str(&values[1])),
                _ => None,
            },
        )
        .unwrap_or_default()
}

/// A `NonNegativeNanometres` from millimetres.
fn nonneg(value_mm: f64) -> Result<NonNegativeNanometres, ProjectionError> {
    u64::try_from(nm(value_mm))
        .map(NonNegativeNanometres::from)
        .map_err(|_| ProjectionError::new("placements: a pad size is negative"))
}

/// Whether the text's root form is `(kicad_pcb …)` (`placements_build.py:304-305`).
fn is_kicad_pcb(text: &str) -> Result<bool, ProjectionError> {
    let selector = Selector {
        heads: Some(std::iter::once("kicad_pcb".to_string()).collect()),
        min_depth: Some(0),
        max_depth: Some(0),
        ..Selector::default()
    };
    Ok(!scan_form_spans(text, &selector)
        .map_err(board_error)?
        .is_empty())
}

/// The pad type enum for a token, or `None` (`placements_build.py:32`, `:257`).
fn pad_type(token: &str) -> Option<PlacementsPadType> {
    match token {
        "thru_hole" => Some(PlacementsPadType::ThruHole),
        "smd" => Some(PlacementsPadType::Smd),
        "connect" => Some(PlacementsPadType::Connect),
        "np_thru_hole" => Some(PlacementsPadType::NpThruHole),
        _ => None,
    }
}

/// The pad shape enum for a token, or `None` (`placements_build.py:33`, `:257`).
fn pad_shape(token: &str) -> Option<PlacementsPadShape> {
    match token {
        "circle" => Some(PlacementsPadShape::Circle),
        "rect" => Some(PlacementsPadShape::Rect),
        "oval" => Some(PlacementsPadShape::Oval),
        "trapezoid" => Some(PlacementsPadShape::Trapezoid),
        "roundrect" => Some(PlacementsPadShape::Roundrect),
        "custom" => Some(PlacementsPadShape::Custom),
        _ => None,
    }
}

/// The characteristic-point kind of a board-level graphic head (R12).
fn graphic_kind(head: &str) -> Option<&'static str> {
    GR_GRAPHICS
        .iter()
        .find(|(name, _)| *name == head)
        .map(|(_, kind)| *kind)
}

/// The characteristic-point kind of a footprint graphic head (R8).
fn fp_kind(head: &str) -> Option<&'static str> {
    FP_GRAPHICS
        .iter()
        .find(|(name, _)| *name == head)
        .map(|(_, kind)| *kind)
}

/// `PlacementsError` for a pad KiCad rejects (`placements_build.py:257-258`).
fn pad_rejected(number: &str, pad_type: &str, shape: &str) -> ProjectionError {
    ProjectionError::new(format!(
        "placements: pad {}: type {} / shape {} is one KiCad rejects",
        tree::py_repr_str(number),
        tree::py_repr_str(pad_type),
        tree::py_repr_str(shape)
    ))
}

/// A parse failure of the board (`placements_build.py:301-305`).
fn board_error(error: SexprError) -> ProjectionError {
    ProjectionError::new(format!("placements: the board does not parse: {error}"))
}

fn empty_refdes_error() -> ProjectionError {
    ProjectionError::new("placements: a reference is empty")
}

fn empty_lib_id_error() -> ProjectionError {
    ProjectionError::new("placements: a library link is empty")
}

fn empty_model_path_error() -> ProjectionError {
    ProjectionError::new("placements: a model path is empty")
}

#[cfg(test)]
mod tests {
    use super::*;

    const BOARD: &str = concat!(
        "(kicad_pcb\n",
        "  (footprint \"Test:Foo\"\n",
        "    (layer \"F.Cu\")\n",
        "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
        "    (at 10 20 0)\n",
        "    (attr smd dnp)\n",
        "    (property \"Reference\" \"R1\")\n",
        "    (pad \"1\" smd rect (at 0 0) (size 1 2))\n",
        "    (fp_line (start -1 -1) (end 1 1) (layer \"F.CrtYd\"))\n",
        "    (model \"foo.step\" (offset (xyz 1 2 3)) (rotate (xyz 0 0 90)) (scale (xyz 1 1 1)))\n",
        "  )\n",
        ")\n",
    );

    #[test]
    fn the_empty_form_decodes() {
        crate::test_support::with_bare_project(|input| {
            let produced = super::produce(input).unwrap();
            let value = serde_json::to_value(&produced.document).unwrap();
            assert_eq!(value["schema"], super::SCHEMA);
        });
    }

    /// KiCad 6 and 7 write `(tstamp …)` where later versions write `(uuid …)`.
    #[test]
    fn a_footprint_identified_by_tstamp_is_placed() {
        let text = BOARD.replace("(uuid ", "(tstamp ");
        let (document, _) = build(&text, None).expect("board builds");
        assert_eq!(document.footprints.len(), 1);
        assert_eq!(
            document.footprints[0].uuid.0,
            "00000000-0000-0000-0000-000000000001"
        );
    }

    #[test]
    fn a_board_with_a_board_level_edge_cuts_outline() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (gr_line (start 0 0) (end 100 0) (layer \"Edge.Cuts\"))\n",
            "  (gr_line (start 100 0) (end 100 50) (layer \"Edge.Cuts\"))\n",
            "  (gr_line (start 100 50) (end 0 50) (layer \"Edge.Cuts\"))\n",
            "  (gr_circle (center 200 200) (end 210 200) (layer \"Edge.Cuts\"))\n",
            ")\n",
        );
        let (document, _) = build(text, None).expect("board builds");
        let bounds = document.outline_bounds.expect("outline present");
        assert_eq!(bounds.min_nm.x_nm.0, 0);
        assert_eq!(bounds.min_nm.y_nm.0, 0);
        assert_eq!(bounds.max_nm.x_nm.0, 210_000_000);
        assert_eq!(bounds.max_nm.y_nm.0, 210_000_000);
    }

    #[test]
    fn a_footprint_without_a_courtyard_has_no_bounds() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (footprint \"Test:Foo\"\n",
            "    (layer \"F.Cu\")\n",
            "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
            "    (at 1 2)\n",
            "    (property \"Reference\" \"R1\")\n",
            "    (pad \"1\" smd rect (at 0 0) (size 1 2))\n",
            "  )\n",
            ")\n",
        );
        let (document, warnings) = build(text, None).expect("board builds");
        assert!(warnings.is_empty());
        assert_eq!(document.footprints.len(), 1);
        assert!(document.footprints[0].courtyard_bounds.is_none());
    }

    #[test]
    fn the_ported_board_builds_identity_and_placement() {
        let (document, warnings) = build(BOARD, None).expect("board builds");
        assert!(warnings.is_empty());
        assert_eq!(document.schema, SCHEMA);
        assert_eq!(document.designators.len(), 1);
        let footprint = &document.footprints[0];
        assert_eq!(footprint.uuid.0, "00000000-0000-0000-0000-000000000001");
        assert_eq!(
            footprint.reference.as_ref().map(|r| r.to_string()),
            Some("R1".to_string())
        );
        assert_eq!(
            footprint.lib_id.as_ref().map(|l| l.to_string()),
            Some("Test:Foo".to_string())
        );
        assert_eq!(footprint.side, Side::Front);
        assert_eq!(footprint.position_nm.x_nm.0, 10_000_000);
        assert_eq!(footprint.position_nm.y_nm.0, 20_000_000);
        assert_eq!(footprint.rotation_deg.0, 0.0);
        assert!(footprint.dnp);
        assert!(!footprint.exclude_from_pos_files);
    }

    #[test]
    fn the_ported_board_builds_geometry_models_and_span() {
        let (document, _) = build(BOARD, None).expect("board builds");
        let footprint = &document.footprints[0];
        assert_eq!(footprint.pads.len(), 1);
        assert_eq!(footprint.pads[0].number.0, "1");
        assert_eq!(footprint.models.len(), 1);
        assert_eq!(footprint.models[0].path.as_str(), "foo.step");
        assert!(!footprint.models[0].hidden);
        assert_eq!(footprint.models[0].offset.x_nm.0, 1_000_000);
        assert_eq!(footprint.models[0].rotation.z_deg.0, 90.0);
        assert_eq!(footprint.models[0].scale.x, 1.0);
        assert_eq!(
            footprint.courtyard_bounds.as_ref().unwrap().min_nm.x_nm.0,
            -1_000_000
        );
        assert_eq!(
            footprint.source_span.offset_bytes.0,
            BOARD.find("(footprint").unwrap() as u64
        );
        assert!(footprint.source_span.length_bytes.0 > 0);
    }

    #[test]
    fn a_non_board_expression_is_rejected() {
        let error = build("(not_a_board)", None).expect_err("not a board");
        assert!(error.message.contains("kicad_pcb"), "{}", error.message);
    }

    #[test]
    fn a_pad_with_an_unknown_type_is_rejected() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (footprint \"Test:Foo\"\n",
            "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
            "    (pad \"1\" weird rect (at 0 0) (size 1 2))\n",
            "  )\n",
            ")\n",
        );
        let error = build(text, None).expect_err("bad pad type");
        assert!(error.message.contains("weird"), "{}", error.message);
    }

    #[test]
    fn a_pad_with_an_unknown_shape_is_rejected() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (footprint \"Test:Foo\"\n",
            "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
            "    (pad \"1\" smd hexagon (at 0 0) (size 1 2))\n",
            "  )\n",
            ")\n",
        );
        let error = build(text, None).expect_err("bad pad shape");
        assert!(error.message.contains("hexagon"), "{}", error.message);
    }

    #[test]
    fn a_footprint_without_a_canonical_uuid_is_skipped_with_a_warning() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (footprint \"Test:Foo\"\n",
            "    (uuid \"legacy-tstamp\")\n",
            "  )\n",
            ")\n",
        );
        let (document, warnings) = build(text, None).expect("board builds");
        assert!(document.footprints.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "placements-footprint-skipped");
    }

    #[test]
    fn a_board_with_an_aux_axis_origin_records_it() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (setup (aux_axis_origin 25.4 -3.5))\n",
            "  (footprint \"Test:Foo\"\n",
            "    (layer \"F.Cu\")\n",
            "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
            "    (at 1 2)\n",
            "    (property \"Reference\" \"R1\")\n",
            "  )\n",
            ")\n",
        );
        let view = prism_kicad_core::PcbView::parse(text, prism_kicad_core::PcbLimits::default())
            .expect("board parses");
        let aux = super::aux_axis_origin(&view).expect("setup reads");
        let (document, _) = build(text, aux).expect("board builds");
        let origin = document.aux_axis_origin.expect("origin present");
        assert_eq!(origin.x_nm.0, 25_400_000);
        assert_eq!(origin.y_nm.0, -3_500_000);
    }

    #[test]
    fn a_board_without_an_aux_axis_origin_has_none() {
        let text = concat!(
            "(kicad_pcb\n",
            "  (setup (pad_to_mask_clearance 0))\n",
            "  (footprint \"Test:Foo\"\n",
            "    (layer \"F.Cu\")\n",
            "    (uuid \"00000000-0000-0000-0000-000000000001\")\n",
            "    (at 1 2)\n",
            "    (property \"Reference\" \"R1\")\n",
            "  )\n",
            ")\n",
        );
        let view = prism_kicad_core::PcbView::parse(text, prism_kicad_core::PcbLimits::default())
            .expect("board parses");
        assert!(
            super::aux_axis_origin(&view)
                .expect("setup reads")
                .is_none()
        );
        let (document, _) = build(text, None).expect("board builds");
        assert!(document.aux_axis_origin.is_none());
    }
}
