//! The mechanical facts of one bundle: the board perimeter, every drill and
//! slot, every footprint's body and the placements the sheet dimensions from.
//!
//! This module reads only what the bundle carries. Steps that need Geometer
//! (model bounds and the elevation silhouettes) live in [`super::geometer`];
//! a [`Board`] here is therefore complete without a Geometer runtime, with
//! every part's height left as `None`.

use std::collections::BTreeMap;

use prism_artwork::artwork::geometry::{self, Bounds, Point};
use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
    AssemblyHlrA0, AssemblyHlrEdges, AssemblyHlrFootprint,
};
use prism_kicad_contracts::generated::prism_placements_a1::{
    PlacementsA1, PlacementsFootprint, Side as PlacementSide,
};
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;
use prism_kicad_core::{
    PcbFootprint, PcbHole, PcbHoleOwner, PcbLimits, PcbModelReference, PcbPad, PcbView,
};

use crate::bundle::{Bundle, LabError};

/// `projections/placements.json`: sides, courtyards and the aux axis origin.
pub const PLACEMENTS: &str = "projections/placements.json";
/// `models/assembly-hlr.json`: each footprint's projected body outline.
pub const ASSEMBLY_HLR: &str = "models/assembly-hlr.json";
/// `projections/stackup.json`: the board thickness.
pub const STACKUP: &str = "projections/stackup.json";
/// KiCad's default board thickness when the bundle records none.
pub const DEFAULT_THICKNESS_MM: f64 = 1.6;

/// Which side of the board a footprint sits on.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Ord, PartialOrd)]
pub enum Side {
    /// Front.
    Top,
    /// Back.
    Bottom,
}

impl Side {
    /// `front` or `back`, as the tables print it.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Top => "front",
            Self::Bottom => "back",
        }
    }

    /// The short form the drawing legends use.
    pub fn short(self) -> &'static str {
        match self {
            Self::Top => "TOP",
            Self::Bottom => "BOT",
        }
    }
}

/// A footprint body as the top view draws it.
pub enum Body {
    /// Closed polylines from `models/assembly-hlr.json`, in board millimetres.
    Outline(Vec<Vec<Point>>),
    /// A fallback ring (courtyard or pad envelope), drawn dashed.
    Envelope(Vec<Point>),
}

impl Body {
    /// Every point of the body, for its extent.
    pub fn points(&self) -> Vec<Point> {
        match self {
            Self::Outline(lines) => lines.iter().flatten().copied().collect(),
            Self::Envelope(ring) => ring.clone(),
        }
    }
}

/// The board edge a part overhangs.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Edge {
    /// The `x = min` edge.
    Left,
    /// The `x = max` edge.
    Right,
    /// The `y = min` edge.
    Top,
    /// The `y = max` edge.
    Bottom,
}

impl Edge {
    /// `left`, `right`, `top` or `bottom`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Left => "left",
            Self::Right => "right",
            Self::Top => "top",
            Self::Bottom => "bottom",
        }
    }
}

/// How far a part reaches past the board's bounding rectangle.
pub struct Overhang {
    /// The edge it crosses.
    pub edge: Edge,
    /// The distance past the edge, millimetres.
    pub distance: f64,
    /// The body coordinate along the edge (its centre), board millimetres.
    pub along: f64,
    /// The body's extreme coordinate across the edge, board millimetres.
    pub extreme: f64,
}

/// The model reference a part's heights come from.
#[derive(Clone)]
pub struct ModelInput {
    /// The reference as the board writes it.
    pub path: String,
    /// `(offset x y z)`, millimetres.
    pub offset: [f64; 3],
    /// `(rotate x y z)`, degrees.
    pub rotate: [f64; 3],
    /// `(scale x y z)`.
    pub scale: [f64; 3],
}

/// A known height above and below the board's surfaces.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Height {
    /// Above the top surface, millimetres.
    pub above: f64,
    /// Below the bottom surface, millimetres.
    pub below: f64,
}

/// Where a part's height came from.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum HeightSource {
    /// Geometer's model bounds of the STEP model.
    ModelBounds,
    /// The model's authored Z offset, used as a stand-in depth.
    ModelOffset,
    /// No usable source.
    Unknown,
}

impl HeightSource {
    /// The short label the height table prints.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ModelBounds => "bounds",
            Self::ModelOffset => "offset",
            Self::Unknown => "unknown",
        }
    }
}

/// One footprint as the sheet sees it.
pub struct Part {
    /// The footprint's index in the board's file order.
    pub index: usize,
    /// Reference designator, or `?`.
    pub reference: String,
    /// Library id, for the mounting-hole rule.
    pub library: String,
    /// Board side.
    pub side: Side,
    /// True when every pad has no net: a mechanical part, not a circuit one.
    pub mechanical: bool,
    /// Anchor, board millimetres.
    pub at: Point,
    /// Board angle, degrees.
    pub angle: f64,
    /// The top-view body.
    pub body: Body,
    /// The body's extent, board millimetres.
    pub body_bounds: Bounds,
    /// The courtyard extent in the board frame, when placements give one.
    pub courtyard: Option<Bounds>,
    /// The pad envelope in the board frame, when the board has pads.
    pub pad_bounds: Option<Bounds>,
    /// The overhang, when the body crosses the board's bounding rectangle.
    pub overhang: Option<Overhang>,
    /// The STEP model, when the footprint names one.
    pub model: Option<ModelInput>,
    /// A stand-in height from a non-STEP model's Z offset, when it has one.
    pub fallback_height: Option<Height>,
    /// Height above and below the surfaces, once Geometer has measured it.
    pub height: Option<Height>,
    /// Where the height came from.
    pub height_source: HeightSource,
    /// Why the height is unknown, when it is.
    pub height_note: String,
    /// Front-elevation silhouette polylines, view millimetres `(u, v)`.
    pub front_lines: Vec<Vec<Point>>,
    /// Right-side silhouette polylines, view millimetres `(u, v)`.
    pub side_lines: Vec<Vec<Point>>,
}

impl Part {
    /// The tallest extent of the part, for the elevation's vertical fit.
    pub fn height_span(&self) -> f64 {
        self.height
            .map_or(0.0, |height| height.above + height.below)
    }
}

/// One drill or slot.
pub struct HoleRow {
    /// Stable id, `H01`… in table order.
    pub id: String,
    /// Centre, board millimetres.
    pub at: Point,
    /// Drill width.
    pub width: f64,
    /// Drill height (equal to the width for a round hole).
    pub height: f64,
    /// The slot's rotation, degrees.
    pub angle: f64,
    /// True when the barrel is plated.
    pub plated: bool,
    /// True when the hole is a slot.
    pub slot: bool,
    /// True when the drill belongs to a via.
    pub via: bool,
    /// True when it is a mounting hole.
    pub mounting: bool,
    /// The footprint that owns it, when one does.
    pub footprint: Option<usize>,
    /// `R15.1`, `via GND` or `H1`.
    pub used_by: String,
    /// The pad's net, or the via's.
    pub net: String,
}

impl HoleRow {
    /// The tabulated diameter: `Ø` for a round hole, `w × h` for a slot.
    pub fn diameter(&self) -> String {
        if self.slot {
            format!(
                "{} × {}",
                crate::html::millimetres(self.width),
                crate::html::millimetres(self.height)
            )
        } else {
            format!("Ø{}", crate::html::millimetres(self.width))
        }
    }
}

/// The dimension origin: the board's lower-left corner or its aux axis.
#[derive(Clone, Copy, Debug)]
pub struct Origin {
    /// Board millimetres.
    pub at: Point,
    /// True when `placements.auxAxisOrigin` supplied it.
    pub from_aux_axis: bool,
}

impl Origin {
    /// The line the notes block prints.
    pub fn label(self) -> String {
        if self.from_aux_axis {
            format!(
                "AUX AXIS ORIGIN ({}, {})",
                crate::html::millimetres(self.at.x),
                crate::html::millimetres(self.at.y)
            )
        } else {
            "BOARD LOWER-LEFT CORNER".to_owned()
        }
    }
}

/// Everything the sheet needs that does not need Geometer.
pub struct Board {
    /// File stem of the board.
    pub name: String,
    /// Repository path of the board.
    pub file: String,
    /// Board thickness, millimetres.
    pub thickness: f64,
    /// The board perimeter.
    pub outline: Vec<Point>,
    /// Closed rings inside the perimeter.
    pub cutouts: Vec<Vec<Point>>,
    /// The perimeter's extent.
    pub bounds: Bounds,
    /// Where ordinate dimensions start.
    pub origin: Origin,
    /// Footprints, sorted by reference.
    pub parts: Vec<Part>,
    /// Every drill and slot, sorted by position.
    pub holes: Vec<HoleRow>,
}

impl Board {
    /// Read the bundle's board, placements, stackup and assembly outlines.
    pub fn load(bundle: &Bundle) -> Result<Self, LabError> {
        let text = bundle.board_text()?;
        let view = PcbView::parse(&text, PcbLimits::default())
            .map_err(|error| LabError::new(format!("the board does not parse: {error}")))?;
        let board = geometry::board_geometry(&view)
            .map_err(|error| LabError::new(format!("the board geometry failed: {error}")))?;
        if board.outer.is_empty() {
            return Err(LabError::new("the board has no closed Edge.Cuts outline"));
        }
        let placements: Option<PlacementsA1> = bundle.json(PLACEMENTS)?;
        let hlr: Option<AssemblyHlrA0> = bundle.json(ASSEMBLY_HLR)?;
        let stackup: Option<StackupA0> = bundle.json(STACKUP)?;
        let bounds = outline_bounds(&board);
        let origin = origin(placements.as_ref(), bounds);
        let pads = pads(&view)?;
        let models = models(&view)?;
        let mut parts = parts(
            &view,
            &board,
            placements.as_ref(),
            hlr.as_ref(),
            &models,
            &pads,
            bounds,
        )?;
        parts.sort_by(|left, right| {
            left.reference
                .cmp(&right.reference)
                .then(left.side.cmp(&right.side))
        });
        let holes = holes(&view, &pads, &parts)?;
        Ok(Self {
            name: bundle.board_name()?,
            file: bundle.board_file()?,
            thickness: stackup.as_ref().map_or(DEFAULT_THICKNESS_MM, |stackup| {
                stackup.board_thickness_nm.0 as f64 / 1_000_000.0
            }),
            outline: board.outer.clone(),
            cutouts: board.cutouts.clone(),
            bounds,
            origin,
            parts,
            holes,
        })
    }

    /// The tallest known height above the top surface.
    pub fn tallest_above(&self) -> f64 {
        self.parts
            .iter()
            .filter_map(|part| part.height.map(|height| height.above))
            .fold(0.0, f64::max)
    }

    /// The deepest known height below the bottom surface.
    pub fn deepest_below(&self) -> f64 {
        self.parts
            .iter()
            .filter_map(|part| part.height.map(|height| height.below))
            .fold(0.0, f64::max)
    }

    /// The part whose top silhouette sets the maximum above the surface.
    pub fn tallest_part(&self) -> Option<&Part> {
        self.parts
            .iter()
            .filter(|part| part.height.is_some())
            .max_by(|left, right| {
                let left_height = left.height.map_or(0.0, |height| height.above);
                let right_height = right.height.map_or(0.0, |height| height.above);
                left_height
                    .total_cmp(&right_height)
                    .then(right.reference.cmp(&left.reference))
            })
    }

    /// The part whose bottom silhouette sets the maximum below the surface.
    pub fn deepest_part(&self) -> Option<&Part> {
        self.parts
            .iter()
            .filter(|part| part.height.is_some())
            .max_by(|left, right| {
                let left_height = left.height.map_or(0.0, |height| height.below);
                let right_height = right.height.map_or(0.0, |height| height.below);
                left_height
                    .total_cmp(&right_height)
                    .then(right.reference.cmp(&left.reference))
            })
    }

    /// Parts whose height is unknown, by reference.
    pub fn unknown_heights(&self) -> Vec<&str> {
        self.parts
            .iter()
            .filter(|part| part.height.is_none())
            .map(|part| part.reference.as_str())
            .collect()
    }
}

fn outline_bounds(board: &geometry::BoardGeometry) -> Bounds {
    if !board.outline_bounds.is_empty() {
        return board.outline_bounds;
    }
    Bounds::of_ring(&board.outer)
}

fn origin(placements: Option<&PlacementsA1>, bounds: Bounds) -> Origin {
    match placements.and_then(|placements| placements.aux_axis_origin.as_ref()) {
        Some(point) => Origin {
            at: Point {
                x: point.x_nm.0 as f64 / 1_000_000.0,
                y: point.y_nm.0 as f64 / 1_000_000.0,
            },
            from_aux_axis: true,
        },
        None => Origin {
            at: Point {
                x: bounds.min_x,
                y: bounds.max_y,
            },
            from_aux_axis: false,
        },
    }
}

fn pads(view: &PcbView<'_>) -> Result<Vec<PcbPad>, LabError> {
    view.pads()
        .collect::<Result<Vec<_>, _>>()
        .map_err(|error| LabError::new(format!("a pad does not decode: {error}")))
}

fn models(view: &PcbView<'_>) -> Result<BTreeMap<usize, Vec<PcbModelReference>>, LabError> {
    let mut models: BTreeMap<usize, Vec<PcbModelReference>> = BTreeMap::new();
    for model in view.models() {
        let model =
            model.map_err(|error| LabError::new(format!("a model does not decode: {error}")))?;
        models.entry(model.footprint_index).or_default().push(model);
    }
    Ok(models)
}

fn parts(
    view: &PcbView<'_>,
    board: &geometry::BoardGeometry,
    placements: Option<&PlacementsA1>,
    hlr: Option<&AssemblyHlrA0>,
    models: &BTreeMap<usize, Vec<PcbModelReference>>,
    pads: &[PcbPad],
    board_bounds: Bounds,
) -> Result<Vec<Part>, LabError> {
    let placed: BTreeMap<&str, &PlacementsFootprint> = placements.map_or_else(BTreeMap::new, |p| {
        p.footprints
            .iter()
            .map(|footprint| (footprint.uuid.0.as_str(), footprint))
            .collect()
    });
    let bodies: BTreeMap<&str, &AssemblyHlrFootprint> = hlr.map_or_else(BTreeMap::new, |hlr| {
        hlr.footprints
            .iter()
            .map(|footprint| (footprint.uuid.0.as_str(), footprint))
            .collect()
    });
    let mut pad_counts: BTreeMap<usize, usize> = BTreeMap::new();
    for pad in pads {
        *pad_counts.entry(pad.footprint_index).or_default() += 1;
    }
    view.footprints()
        .enumerate()
        .map(|(index, footprint)| {
            let footprint = footprint
                .map_err(|error| LabError::new(format!("a footprint does not decode: {error}")))?;
            let uuid = footprint.uuid.clone().unwrap_or_default();
            let placement = placed.get(uuid.as_str()).copied();
            let hlr = bodies.get(uuid.as_str()).copied();
            let mut part = part(
                &footprint,
                index,
                placement,
                hlr,
                models.get(&index),
                board,
                board_bounds,
            )?;
            part.mechanical = pads
                .iter()
                .filter(|pad| pad.footprint_index == index)
                .all(|pad| pad.net.name.as_deref().unwrap_or("").is_empty());
            Ok(part)
        })
        .collect()
}

fn part(
    footprint: &PcbFootprint,
    index: usize,
    placement: Option<&PlacementsFootprint>,
    hlr: Option<&AssemblyHlrFootprint>,
    models: Option<&Vec<PcbModelReference>>,
    board: &geometry::BoardGeometry,
    board_bounds: Bounds,
) -> Result<Part, LabError> {
    let placed = placement.map(|placement| {
        (
            Point {
                x: placement.position_nm.x_nm.0 as f64 / 1_000_000.0,
                y: placement.position_nm.y_nm.0 as f64 / 1_000_000.0,
            },
            placement.rotation_deg.0,
        )
    });
    let at = placed.map_or_else(
        || Point {
            x: footprint.at_x.unwrap_or(0.0),
            y: footprint.at_y.unwrap_or(0.0),
        },
        |(at, _)| at,
    );
    let angle = placed.map_or_else(|| footprint.angle.unwrap_or(0.0), |(_, angle)| angle);
    let body = body_of(footprint, index, hlr, placement, board);
    let body_bounds = Bounds::of_ring(&body.points());
    let courtyard = placement
        .and_then(|placement| placement.courtyard_bounds.as_ref())
        .map(|bounds| courtyard_bounds(bounds, at, angle));
    let pad_bounds = board.pad_envelopes.get(&index).copied();
    let extent = if body_bounds.is_empty() {
        pad_bounds
    } else {
        Some(body_bounds)
    };
    let overhang = extent.and_then(|extent| overhang(extent, board_bounds));
    let model = models.and_then(|models| step_model(models));
    let fallback_height = model
        .is_none()
        .then(|| models.and_then(|models| models.first()))
        .flatten()
        .and_then(|model| offset_height(model.offset[2]));
    Ok(Part {
        index,
        reference: reference(footprint, placement),
        library: footprint.library_link.clone(),
        side: side(footprint, placement),
        mechanical: false,
        at,
        angle,
        body,
        body_bounds,
        courtyard,
        pad_bounds,
        overhang,
        model,
        fallback_height,
        height: None,
        height_source: HeightSource::Unknown,
        height_note: "not measured".to_owned(),
        front_lines: Vec::new(),
        side_lines: Vec::new(),
    })
}

fn reference(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> String {
    placement
        .and_then(|placement| placement.reference.as_ref())
        .map(|reference| reference.as_str().to_owned())
        .or_else(|| footprint.reference.clone())
        .filter(|reference| !reference.is_empty())
        .unwrap_or_else(|| "?".to_owned())
}

fn side(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> Side {
    match placement.map(|placement| placement.side) {
        Some(PlacementSide::Back) => Side::Bottom,
        Some(PlacementSide::Front) => Side::Top,
        None => match footprint.layer.as_deref() {
            Some(layer) if layer.starts_with("B.") => Side::Bottom,
            _ => Side::Top,
        },
    }
}

/// A non-negative height from a model's authored Z offset, when it is real.
fn offset_height(z: f64) -> Option<Height> {
    (z.abs() > 0.01).then(|| Height {
        above: z.max(0.0),
        below: (-z).max(0.0),
    })
}

fn step_model(models: &[PcbModelReference]) -> Option<ModelInput> {
    models
        .iter()
        .find(|model| is_step(&model.path))
        .map(|model| ModelInput {
            path: model.path.clone(),
            offset: model.offset,
            rotate: model.rotate,
            scale: model.scale,
        })
}

fn is_step(path: &str) -> bool {
    let lowered = path.to_ascii_lowercase();
    lowered.ends_with(".step") || lowered.ends_with(".stp")
}

fn body_of(
    footprint: &PcbFootprint,
    index: usize,
    hlr: Option<&AssemblyHlrFootprint>,
    placement: Option<&PlacementsFootprint>,
    board: &geometry::BoardGeometry,
) -> Body {
    if let Some(edges) = hlr.and_then(|hlr| hlr.outline.as_ref()) {
        let lines = edges_polylines(edges);
        if !lines.is_empty() {
            return Body::Outline(lines);
        }
    }
    if let Some(bounds) = placement.and_then(|placement| placement.courtyard_bounds.as_ref()) {
        let at = Point {
            x: footprint.at_x.unwrap_or(0.0),
            y: footprint.at_y.unwrap_or(0.0),
        };
        let angle = footprint.angle.unwrap_or(0.0);
        return Body::Envelope(courtyard_ring(bounds, at, angle));
    }
    match board.pad_envelopes.get(&index) {
        Some(bounds) => Body::Envelope(bounds.ring()),
        None => Body::Envelope(Vec::new()),
    }
}

/// The projected outline as polylines in board millimetres.
fn edges_polylines(edges: &AssemblyHlrEdges) -> Vec<Vec<Point>> {
    let mut lines = Vec::new();
    for segment in &edges.segments {
        lines.push(vec![
            nm(segment.start_nm.x_nm.0, segment.start_nm.y_nm.0),
            nm(segment.end_nm.x_nm.0, segment.end_nm.y_nm.0),
        ]);
    }
    for arc in &edges.arcs {
        let points = geometry::arc_points(arc);
        if points.len() >= 2 {
            lines.push(points);
        }
    }
    lines
}

fn nm(x: i64, y: i64) -> Point {
    Point {
        x: x as f64 / 1_000_000.0,
        y: y as f64 / 1_000_000.0,
    }
}

/// A footprint-local nanometre box as a board-frame extent.
fn courtyard_bounds(
    bounds: &prism_kicad_contracts::generated::prism_placements_a1::PlacementsBounds,
    at: Point,
    angle: f64,
) -> Bounds {
    Bounds::of_ring(&courtyard_ring(bounds, at, angle))
}

fn courtyard_ring(
    bounds: &prism_kicad_contracts::generated::prism_placements_a1::PlacementsBounds,
    at: Point,
    angle: f64,
) -> Vec<Point> {
    let corners = [
        (bounds.min_nm.x_nm.0, bounds.min_nm.y_nm.0),
        (bounds.max_nm.x_nm.0, bounds.min_nm.y_nm.0),
        (bounds.max_nm.x_nm.0, bounds.max_nm.y_nm.0),
        (bounds.min_nm.x_nm.0, bounds.max_nm.y_nm.0),
    ];
    let (sin, cos) = angle.to_radians().sin_cos();
    corners
        .into_iter()
        .map(|(x, y)| {
            let local = Point {
                x: x as f64 / 1_000_000.0,
                y: y as f64 / 1_000_000.0,
            };
            Point {
                x: at.x + local.x * cos + local.y * sin,
                y: at.y - local.x * sin + local.y * cos,
            }
        })
        .collect()
}

/// The largest distance `extent` reaches past `board`, and on which edge.
pub fn overhang(extent: Bounds, board: Bounds) -> Option<Overhang> {
    let candidates = [
        (
            Edge::Left,
            board.min_x - extent.min_x,
            (extent.min_y + extent.max_y) / 2.0,
            extent.min_x,
        ),
        (
            Edge::Right,
            extent.max_x - board.max_x,
            (extent.min_y + extent.max_y) / 2.0,
            extent.max_x,
        ),
        (
            Edge::Top,
            board.min_y - extent.min_y,
            (extent.min_x + extent.max_x) / 2.0,
            extent.min_y,
        ),
        (
            Edge::Bottom,
            extent.max_y - board.max_y,
            (extent.min_x + extent.max_x) / 2.0,
            extent.max_y,
        ),
    ];
    candidates
        .into_iter()
        .filter(|(_, distance, _, _)| *distance > 0.01)
        .max_by(|left, right| left.1.total_cmp(&right.1))
        .map(|(edge, distance, along, extreme)| Overhang {
            edge,
            distance,
            along,
            extreme,
        })
}

fn holes(view: &PcbView<'_>, pads: &[PcbPad], parts: &[Part]) -> Result<Vec<HoleRow>, LabError> {
    let footprints: Vec<PcbFootprint> = view
        .footprints()
        .collect::<Result<_, _>>()
        .map_err(|error| LabError::new(format!("a footprint does not decode: {error}")))?;
    let vias: Vec<prism_kicad_core::PcbVia> = view
        .vias()
        .collect::<Result<_, _>>()
        .map_err(|error| LabError::new(format!("a via does not decode: {error}")))?;
    let mut rows = Vec::new();
    for hole in view.holes() {
        let hole =
            hole.map_err(|error| LabError::new(format!("a hole does not decode: {error}")))?;
        rows.push(hole_row(&hole, &footprints, parts, pads, &vias));
    }
    rows.sort_by(|left, right| {
        left.at
            .y
            .total_cmp(&right.at.y)
            .then(left.at.x.total_cmp(&right.at.x))
            .then(left.width.total_cmp(&right.width))
    });
    for (index, row) in rows.iter_mut().enumerate() {
        row.id = format!("H{:02}", index + 1);
    }
    mark_mounting(&mut rows, parts);
    Ok(rows)
}

fn hole_row(
    hole: &PcbHole,
    footprints: &[PcbFootprint],
    parts: &[Part],
    pads: &[PcbPad],
    vias: &[prism_kicad_core::PcbVia],
) -> HoleRow {
    let (at, footprint, used_by, net) = hole_owner(hole, footprints, parts, pads, vias);
    HoleRow {
        id: String::new(),
        at,
        width: hole.width,
        height: hole.height,
        angle: hole.angle,
        plated: hole.plated,
        slot: (hole.width - hole.height).abs() > 1e-9,
        via: hole.owner == PcbHoleOwner::Via,
        mounting: false,
        footprint,
        used_by,
        net,
    }
}

fn hole_owner(
    hole: &PcbHole,
    footprints: &[PcbFootprint],
    parts: &[Part],
    pads: &[PcbPad],
    vias: &[prism_kicad_core::PcbVia],
) -> (Point, Option<usize>, String, String) {
    match hole.owner {
        PcbHoleOwner::Pad => {
            let footprint = hole.footprint_index;
            let pad = pads.get(hole.owner_index);
            let at = match footprint.and_then(|index| footprints.get(index)) {
                Some(footprint) => pad_hole_center(hole, footprint),
                None => Point {
                    x: hole.center.x,
                    y: hole.center.y,
                },
            };
            let reference = footprint
                .and_then(|index| parts.iter().find(|part| part.index == index))
                .map_or_else(|| "?".to_owned(), |part| part.reference.clone());
            let number = pad.map_or_else(String::new, |pad| pad.number.clone());
            let used_by = if number.is_empty() {
                reference
            } else {
                format!("{reference}.{number}")
            };
            let net = pad.map_or_else(String::new, |pad| net_name(&pad.net.name));
            (at, footprint, used_by, net)
        }
        PcbHoleOwner::Via => {
            let via = vias.get(hole.owner_index);
            let net = via.map_or_else(String::new, |via| net_name(&via.net.name));
            let used_by = if net.is_empty() {
                "via".to_owned()
            } else {
                format!("via {net}")
            };
            (
                Point {
                    x: hole.center.x,
                    y: hole.center.y,
                },
                None,
                used_by,
                net,
            )
        }
    }
}

fn net_name(name: &Option<String>) -> String {
    name.clone().unwrap_or_default()
}

fn pad_hole_center(hole: &PcbHole, footprint: &PcbFootprint) -> Point {
    let center = hole.board_center(
        prism_kicad_core::PcbPoint {
            x: footprint.at_x.unwrap_or(0.0),
            y: footprint.at_y.unwrap_or(0.0),
        },
        footprint.angle.unwrap_or(0.0),
    );
    Point {
        x: center.x,
        y: center.y,
    }
}

/// A reference that names a mounting hole by KiCad's own convention.
pub fn is_mounting_reference(reference: &str, library: &str) -> bool {
    if library.to_ascii_lowercase().contains("mountinghole") {
        return true;
    }
    let reference = reference.trim();
    reference.starts_with("MH")
        || (reference.starts_with('H')
            && reference[1..]
                .chars()
                .all(|character| character.is_ascii_digit())
            && reference.len() > 1)
}

fn mark_mounting(rows: &mut [HoleRow], parts: &[Part]) {
    let mut largest: BTreeMap<usize, (usize, f64)> = BTreeMap::new();
    for (index, row) in rows.iter().enumerate() {
        let Some(footprint) = row.footprint else {
            continue;
        };
        let size = row.width.max(row.height);
        largest
            .entry(footprint)
            .and_modify(|slot| {
                if size > slot.1 {
                    *slot = (index, size);
                }
            })
            .or_insert((index, size));
    }
    for (index, row) in rows.iter_mut().enumerate() {
        let by_footprint = row.footprint.is_some_and(|footprint| {
            parts
                .iter()
                .find(|part| part.index == footprint)
                .is_some_and(|part| {
                    is_mounting_reference(&part.reference, &part.library)
                        && largest.get(&footprint).map(|slot| slot.0) == Some(index)
                })
        });
        let npth_mechanical = row.footprint.is_none_or(|footprint| {
            parts
                .iter()
                .find(|part| part.index == footprint)
                .is_some_and(|part| part.mechanical)
        });
        let npth = !row.plated && !row.via && row.width.max(row.height) >= 1.0;
        row.mounting = by_footprint || (npth && npth_mechanical);
    }
}

#[cfg(test)]
mod tests;
