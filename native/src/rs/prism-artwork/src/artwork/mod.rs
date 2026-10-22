//! `prism-kicad artwork`: Release Studio's assembly and testpoint views
//! (ADR amendment C3 §3.2, cli-spec.md §5.7).
//!
//! The board is parsed once by the core; `models/assembly-hlr.json` supplies
//! each footprint's body outline and visible detail edges; placements and
//! occurrences supply designators, sides and the selected variant's DNP state.
//! Each `--view` composites the configured layer tokens into one deterministic
//! SVG. The rules are ported from Cruncher 2026.9.7's `pcb-svg`: the canvas
//! policy (`_cruncher_board_viewport`'s replacement, `global.canvas`), the
//! designator fallbacks (body, then hole envelope, then pad envelope) and the
//! pin-1 marker selection.
//!
//! One rule is Prism's own: a part whose HLR outline covers another part's body
//! is drawn after the other bodies as a dashed, unfilled outline, and its
//! designator moves just outside its body, so the parts beneath it stay
//! readable. Coverage is decided per side over the view's selected footprints.
//!
//! [`geometry`] and [`svg`] are public so other native consumers that draw a
//! board (the `prism-docs-lab` prototypes) share this crate's outline
//! assembly, arc sampling and deterministic SVG text instead of copying them.

mod designator;
pub mod geometry;
mod paper;
mod render;
pub mod svg;

use render::render_view;

use std::collections::BTreeMap;

use prism_kicad_contracts::generated::prism_artwork_config_a0::ArtworkConfigA0;
use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
    AssemblyHlrA0, AssemblyHlrFootprint,
};
use prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesA0;
use prism_kicad_contracts::generated::prism_placements_a1::{
    PlacementsA1, PlacementsFootprint, Side as PlacementSide,
};
use prism_kicad_core::{PcbFootprint, PcbLimits, PcbPad, PcbView};
use serde::Serialize;

use self::geometry::{BoardGeometry, Bounds, board_geometry};

/// What one requested view rendered.
#[derive(Clone, Debug, Serialize)]
pub struct RenderedView {
    /// The view's name.
    pub name: String,
    /// The SVG's bytes as UTF-8.
    pub svg: String,
    /// How many footprints the view drew a body region for.
    pub footprints_drawn: u64,
    /// How many reference designators it placed.
    pub designators_placed: u64,
    /// How many do-not-populate footprints it hatched.
    pub dnp_footprints_hatched: u64,
    /// `<documentPath>#<uuid>` of every selected footprint without an HLR
    /// outline, sorted in code point order.
    pub footprints_without_outline: Vec<String>,
}

/// The inputs of one `artwork` run.
#[derive(Clone, Copy)]
pub struct ArtworkInput<'a> {
    /// The board file's text, already selected (`refilled/` or `sources/`).
    pub board: &'a str,
    /// The board's repository path (`config.board`).
    pub document_path: &'a str,
    /// The composed views' configuration.
    pub config: &'a ArtworkConfigA0,
    /// `models/assembly-hlr.json`.
    pub hlr: &'a AssemblyHlrA0,
    /// `projections/placements.json`.
    pub placements: &'a PlacementsA1,
    /// `projections/occurrences.json`, for the selected variant's overrides.
    pub occurrences: Option<&'a OccurrencesA0>,
    /// The variant to apply, when one is selected.
    pub variant: Option<&'a str>,
    /// The requested view names.
    pub views: &'a [String],
    /// The sheet-to-board ratio to draw at (`--paper-scale`), when the caller
    /// knows it. Lengths in `config` are then divided by it so they print at
    /// their configured size on paper.
    pub paper_scale: Option<f64>,
}

/// Why an artwork run failed.
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ArtworkViewError {
    /// The configuration or the board cannot be drawn as given.
    InvalidInput(String),
    /// A requested view is not in the configuration.
    UnknownView(String),
    /// A defect.
    Internal(String),
}

impl ArtworkViewError {
    fn input(message: impl Into<String>) -> Self {
        Self::InvalidInput(message.into())
    }

    fn internal(message: impl Into<String>) -> Self {
        Self::Internal(message.into())
    }
}

impl std::fmt::Display for ArtworkViewError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput(message) | Self::UnknownView(message) | Self::Internal(message) => {
                formatter.write_str(message)
            }
        }
    }
}

impl std::error::Error for ArtworkViewError {}

/// Render every requested view.
pub fn render(input: &ArtworkInput<'_>) -> Result<Vec<RenderedView>, ArtworkViewError> {
    let scaled = input
        .paper_scale
        .map(|ratio| paper::scaled(input.config, ratio));
    let input = &match scaled.as_ref() {
        Some(config) => ArtworkInput { config, ..*input },
        None => *input,
    };
    let view = PcbView::parse(input.board, PcbLimits::default())
        .map_err(|error| ArtworkViewError::input(format!("the board does not parse: {error}")))?;
    let geometry = board_geometry(&view).map_err(|error| {
        ArtworkViewError::internal(format!("the board geometry could not be read: {error}"))
    })?;
    if geometry.outer.is_empty() {
        return Err(ArtworkViewError::input(
            "the board has no closed Edge.Cuts outline",
        ));
    }
    let footprints: Vec<PcbFootprint> =
        view.footprints()
            .collect::<Result<_, _>>()
            .map_err(|error| {
                ArtworkViewError::internal(format!("a footprint does not decode: {error}"))
            })?;
    let pads: Vec<PcbPad> = view
        .pads()
        .collect::<Result<_, _>>()
        .map_err(|error| ArtworkViewError::internal(format!("a pad does not decode: {error}")))?;
    let data = board_data(input, &geometry, &footprints, &pads);

    let mut names: Vec<&str> = input.views.iter().map(String::as_str).collect();
    names.sort_unstable();
    names.dedup();
    let mut rendered = Vec::with_capacity(names.len());
    for name in names {
        let Some(view_config) = input.config.views.iter().find(|view| view.name == name) else {
            return Err(ArtworkViewError::UnknownView(name.to_owned()));
        };
        rendered.push(render_view(input, &data, view_config)?);
    }
    Ok(rendered)
}

// ------------------------------------------------------------- board facts

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum FootSide {
    Top,
    Bottom,
}

struct PadInfo {
    number: String,
    x: f64,
    y: f64,
    /// The authored size; the pin-1 marker scales with its shorter side.
    size_x: f64,
    size_y: f64,
    /// The pad's copper as KiCad shapes it (`PcbPad::copper_rings`): closed
    /// rings in the board frame, relative to the pad's board position.
    rings: Vec<Vec<geometry::Point>>,
}

struct FootprintInfo {
    index: usize,
    uuid: String,
    reference: Option<String>,
    side: FootSide,
    dnp: bool,
    at_x: f64,
    at_y: f64,
    angle: f64,
    pads: Vec<PadInfo>,
    hole_bounds: Option<Bounds>,
    pad_bounds: Option<Bounds>,
    hlr: Option<usize>,
}

struct BoardData {
    geometry: BoardGeometry,
    footprints: Vec<FootprintInfo>,
    hlr: Vec<AssemblyHlrFootprint>,
}

impl FootprintInfo {
    /// A pad's centre in the board frame (KiCad's footprint placement).
    fn pad_position(&self, pad: &PadInfo) -> geometry::Point {
        let (sin, cos) = self.angle.to_radians().sin_cos();
        geometry::Point {
            x: self.at_x + pad.x * cos + pad.y * sin,
            y: self.at_y - pad.x * sin + pad.y * cos,
        }
    }

    /// Every pad ring the artwork draws for this footprint, board frame: the
    /// pad's copper rings at its board position.
    fn pad_rings(&self) -> Vec<Vec<geometry::Point>> {
        self.pads
            .iter()
            .flat_map(|pad| {
                let position = self.pad_position(pad);
                pad.rings.iter().map(move |ring| {
                    ring.iter()
                        .map(|point| geometry::Point {
                            x: position.x + point.x,
                            y: position.y + point.y,
                        })
                        .collect::<Vec<_>>()
                })
            })
            .filter(|ring| ring.len() >= 3)
            .collect()
    }

    /// The extent of the footprint's drawn pads.
    fn pads_bounds(&self) -> Option<Bounds> {
        let rings = self.pad_rings();
        if rings.is_empty() {
            return None;
        }
        let mut bounds = Bounds::empty();
        for ring in &rings {
            bounds.include_bounds(Bounds::of_ring(ring));
        }
        (!bounds.is_empty()).then_some(bounds)
    }
}

fn board_data(
    input: &ArtworkInput<'_>,
    geometry: &BoardGeometry,
    footprints: &[PcbFootprint],
    pads: &[PcbPad],
) -> BoardData {
    let placements: BTreeMap<&str, &PlacementsFootprint> = input
        .placements
        .footprints
        .iter()
        .map(|footprint| (footprint.uuid.0.as_str(), footprint))
        .collect();
    let mut hlr_by_uuid = BTreeMap::new();
    for (index, footprint) in input.hlr.footprints.iter().enumerate() {
        hlr_by_uuid.insert(footprint.uuid.0.clone(), index);
    }
    let mut pads_by_footprint: BTreeMap<usize, Vec<PadInfo>> = BTreeMap::new();
    for pad in pads {
        pads_by_footprint
            .entry(pad.footprint_index)
            .or_default()
            .push(PadInfo {
                number: pad.number.clone(),
                x: pad.at_x,
                y: pad.at_y,
                size_x: pad.size_x,
                size_y: pad.size_y,
                rings: pad
                    .copper_rings()
                    .into_iter()
                    .map(|ring| ring.into_iter().map(geometry::Point::from).collect())
                    .collect(),
            });
    }
    let variants = variant_states(input);
    let mut infos = Vec::with_capacity(footprints.len());
    for (index, footprint) in footprints.iter().enumerate() {
        let uuid = footprint.uuid.clone().unwrap_or_default();
        let placement = placements.get(uuid.as_str()).copied();
        let reference = placement
            .and_then(|placement| placement.reference.as_ref())
            .map(|reference| reference.as_str().to_owned())
            .or_else(|| footprint.reference.clone());
        let side = match placement.map(|placement| placement.side) {
            Some(PlacementSide::Back) => FootSide::Bottom,
            Some(PlacementSide::Front) => FootSide::Top,
            None => match footprint.layer.as_deref() {
                Some(layer) if layer.starts_with("B.") => FootSide::Bottom,
                _ => FootSide::Top,
            },
        };
        let base_dnp = placement.is_some_and(|placement| placement.dnp);
        let dnp = variants
            .get(uuid.as_str())
            .and_then(|record| record.dnp)
            .unwrap_or(base_dnp);
        infos.push(FootprintInfo {
            index,
            uuid,
            reference,
            side,
            dnp,
            at_x: footprint.at_x.unwrap_or(0.0),
            at_y: footprint.at_y.unwrap_or(0.0),
            angle: footprint.angle.unwrap_or(0.0),
            pads: pads_by_footprint.remove(&index).unwrap_or_default(),
            hole_bounds: geometry.hole_envelopes.get(&index).copied(),
            pad_bounds: geometry.pad_envelopes.get(&index).copied(),
            hlr: None,
        });
    }
    for info in &mut infos {
        info.hlr = hlr_by_uuid.get(&info.uuid).copied();
    }
    BoardData {
        geometry: BoardGeometry {
            outer: geometry.outer.clone(),
            cutouts: geometry.cutouts.clone(),
            outline_bounds: geometry.outline_bounds,
            drills: geometry.drills.clone(),
            slots: geometry.slots.clone(),
            pad_envelopes: geometry.pad_envelopes.clone(),
            hole_envelopes: geometry.hole_envelopes.clone(),
        },
        footprints: infos,
        hlr: input.hlr.footprints.clone(),
    }
}

/// The first variant record of each footprint whose name matches, ignoring
/// case (occurrences-a0's rule for footprints).
fn variant_states<'a>(
    input: &'a ArtworkInput<'_>,
) -> BTreeMap<
    &'a str,
    &'a prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesVariantRecord,
> {
    let mut result = BTreeMap::new();
    let Some(variant) = input.variant else {
        return result;
    };
    let Some(occurrences) = input.occurrences else {
        return result;
    };
    for footprint in &occurrences.footprints {
        if let Some(record) = footprint
            .variants
            .iter()
            .find(|record| record.name.eq_ignore_ascii_case(variant))
        {
            result.insert(footprint.uuid.0.as_str(), record);
        }
    }
    result
}

// ------------------------------------------------------------- view render

// -------------------------------------------------------------------- tests
