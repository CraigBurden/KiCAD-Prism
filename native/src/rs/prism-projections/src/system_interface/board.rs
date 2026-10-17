//! The board's facts the components join onto: pad nets and footprint
//! geometry, a port of `_board_pad_nets`, `_reference`, `_footprint_geometry`,
//! `_courtyard_points`, `_model` and `_board_geometry`
//! (interface_extractor.py:148-262).
//!
//! The scan is one pass per core collection (`footprints`, `footprint_properties`,
//! `pads`, `footprint_graphics`, `models`). Each collection's items carry the
//! `footprint_index` of their owning footprint, so the pass groups them into a
//! `Vec<Footprint>` indexed by that value instead of rescanning per reference.

mod geometry;

use crate::{BoardModel, ProjectionError};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

/// What the component loop reads from the board.
#[derive(Debug, Default)]
pub(super) struct BoardFacts {
    /// `_board_pad_nets`: `Reference` property → pad number → the net names of
    /// every pad with that number on every footprint with that reference (`""`
    /// for a pad without a net); pads without a number are left out.
    pub pad_nets: BTreeMap<String, BTreeMap<String, BTreeSet<String>>>,
    /// `_board_geometry`: `Reference` property → the `geometry` object of the
    /// first footprint in file order with that reference, numbers already
    /// `_round`ed.
    pub geometry: BTreeMap<String, Value>,
}

/// One footprint, reduced to the fields `_board_pad_nets` and
/// `_footprint_geometry` read. Field order matches the core decode, and every
/// string borrows the view's decoded footprint.
struct Footprint<'v> {
    /// The first `Reference` property, as `_reference` returns it
    /// (interface_extractor.py:173-177); `None` when the footprint has none.
    reference: Option<&'v str>,
    /// The last `Reference` property, as `_board_pad_nets` keeps it
    /// (interface_extractor.py:152-156); `None` when the footprint has none.
    last_reference: Option<&'v str>,
    library_link: &'v str,
    layer: Option<&'v str>,
    at_x: f64,
    at_y: f64,
    angle: f64,
    pads: Vec<Pad<'v>>,
    /// Footprint-local `(x, y)` of every F/B.CrtYd graphic
    /// (`_courtyard_points`, interface_extractor.py:180-196).
    courtyard: Vec<(f64, f64)>,
    /// The first 3D model in file order (`_model`, interface_extractor.py:199-210).
    model: Option<Model>,
}

/// One pad, reduced to the fields the two readers use.
struct Pad<'v> {
    number: &'v str,
    /// `pad.net.name`, `""` without a net (`_board_pad_nets`, :158-164).
    net: &'v str,
    at_x: f64,
    at_y: f64,
    size_x: f64,
    size_y: f64,
    /// The core's `pad_type` token (`thru_hole`, `smd`, …).
    kind: &'v str,
    /// The core's `shape` token (`circle`, `rect`, …).
    shape: &'v str,
}

/// One 3D-model reference (`kicad_model.py:22-56`).
struct Model {
    path: String,
    offset: [f64; 3],
    rotate: [f64; 3],
    scale: [f64; 3],
}

/// Read the board's pad nets and footprint geometry in one pass.
pub(super) fn scan(board: &BoardModel<'_>) -> Result<BoardFacts, ProjectionError> {
    let view = board.view;

    // One slot per footprint, in file order; every index matches
    // `footprint_index` (pcb/indexing.rs:286).
    let mut footprints: Vec<Footprint<'_>> = Vec::with_capacity(view.counts().footprints);
    for footprint in view.decoded_footprints() {
        let footprint = footprint
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        footprints.push(Footprint {
            reference: footprint.reference.as_deref(),
            last_reference: None,
            library_link: &footprint.library_link,
            layer: footprint.layer.as_deref(),
            at_x: footprint.at_x.unwrap_or(0.0),
            at_y: footprint.at_y.unwrap_or(0.0),
            angle: footprint.angle.unwrap_or(0.0),
            pads: Vec::new(),
            courtyard: Vec::new(),
            model: None,
        });
    }
    collect_references(view, &mut footprints)?;
    collect_pads(view, &mut footprints)?;
    collect_courtyards(view, &mut footprints)?;
    collect_models(view, &mut footprints)?;
    Ok(build_facts(&footprints))
}

/// The last `Reference` property per footprint, in source order
/// (interface_extractor.py:152-156).
fn collect_references<'v>(
    view: &'v prism_kicad_core::PcbView<'_>,
    footprints: &mut [Footprint<'v>],
) -> Result<(), ProjectionError> {
    for property in view.decoded_footprint_properties() {
        let property = property
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        if property.name != "Reference" {
            continue;
        }
        if let Some(footprint) = footprints.get_mut(property.footprint_index) {
            footprint.last_reference = Some(property.value.as_str());
        }
    }
    Ok(())
}

/// Pad nets, grouped by footprint (`_board_pad_nets`, :151-165). The core
/// resolves a net name from the board table when a pad spells only an ordinal;
/// every fixture spells the name, so this equals Python's raw name.
fn collect_pads<'v>(
    view: &'v prism_kicad_core::PcbView<'_>,
    footprints: &mut [Footprint<'v>],
) -> Result<(), ProjectionError> {
    for pad in view.decoded_pads() {
        let pad = pad.as_ref().map_err(|error| board_error(error.clone()))?;
        if let Some(footprint) = footprints.get_mut(pad.footprint_index) {
            footprint.pads.push(Pad {
                number: pad.number.as_str(),
                net: pad.net.name.as_deref().unwrap_or_default(),
                at_x: pad.at_x,
                at_y: pad.at_y,
                size_x: pad.size_x,
                size_y: pad.size_y,
                kind: pad.kind.as_str(),
                shape: pad.shape.as_str(),
            });
        }
    }
    Ok(())
}

/// Courtyard points, from each graphic's own layer (`_courtyard_points`,
/// :180-196); only F/B.CrtYd items contribute.
fn collect_courtyards(
    view: &prism_kicad_core::PcbView<'_>,
    footprints: &mut [Footprint<'_>],
) -> Result<(), ProjectionError> {
    for graphic in view.decoded_footprint_graphics() {
        let graphic = graphic
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        let is_courtyard = graphic
            .graphic
            .layer
            .as_deref()
            .unwrap_or("")
            .contains("CrtYd");
        if !is_courtyard {
            continue;
        }
        if let Some(footprint) = footprints.get_mut(graphic.footprint_index) {
            geometry::courtyard_points(&graphic.graphic, &mut footprint.courtyard);
        }
    }
    Ok(())
}

/// The first model per footprint, in file order (`_model`, :199-210).
fn collect_models(
    view: &prism_kicad_core::PcbView<'_>,
    footprints: &mut [Footprint<'_>],
) -> Result<(), ProjectionError> {
    for model in view.models() {
        let model = model.map_err(board_error)?;
        if let Some(footprint) = footprints.get_mut(model.footprint_index)
            && footprint.model.is_none()
        {
            footprint.model = Some(Model {
                path: model.path,
                offset: model.offset,
                rotate: model.rotate,
                scale: model.scale,
            });
        }
    }
    Ok(())
}

/// Join the reduced footprints into the two fact maps.
fn build_facts(footprints: &[Footprint<'_>]) -> BoardFacts {
    let mut facts = BoardFacts::default();
    for footprint in footprints {
        // `_board_pad_nets`: every footprint whose last `Reference` property is
        // non-empty, every pad with a non-empty number (:151-165).
        if let Some(reference) = footprint
            .last_reference
            .filter(|reference| !reference.is_empty())
        {
            let entry = facts.pad_nets.entry(reference.to_owned()).or_default();
            for pad in &footprint.pads {
                if pad.number.is_empty() {
                    continue;
                }
                entry
                    .entry(pad.number.to_owned())
                    .or_default()
                    .insert(pad.net.to_owned());
            }
        }
        // `_board_geometry`: the first footprint per reference wins
        // (:255-262).
        if let Some(reference) = footprint
            .reference
            .filter(|reference| !reference.is_empty())
        {
            facts
                .geometry
                .entry(reference.to_owned())
                .or_insert_with(|| geometry::footprint_geometry(footprint));
        }
    }
    facts
}

/// A core read failure as a `ProjectionError` naming this member.
fn board_error(error: prism_kicad_core::Error) -> ProjectionError {
    ProjectionError::new(format!("{}: {error}", super::NAME))
}

#[cfg(test)]
mod tests;
