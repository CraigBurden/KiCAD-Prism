//! The atlas's facts: one parsed board, the bundle's projections, and the
//! per-net-class grouping the page draws.
//!
//! Everything here is a plain value: no bundle handle, no borrow of the board
//! text. The page can therefore be rendered twice from the same model and give
//! the same bytes.

use std::collections::{BTreeMap, BTreeSet};

use prism_artwork::artwork::geometry::{self, Bounds, Point};
use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{AssemblyHlrA0, AssemblyHlrEdges};
use prism_kicad_contracts::generated::prism_placements_a1::{
    PlacementsA1, PlacementsFootprint, Side as PlacementSide,
};
use prism_kicad_contracts::generated::prism_route_metrics_a0::RouteMetricsA0;
use prism_kicad_contracts::generated::prism_semantic_index_a2::SemanticIndexA2;
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;
use prism_kicad_core::{PcbFootprint, PcbLimits, PcbView, PcbZonePolygon};

use prism_docs_lab::bundle::{Bundle, LabError};
use prism_docs_lab::palette;

use crate::pads::pad_facts;

/// `projections/stackup.json`: the copper order, front to back.
pub const STACKUP: &str = "projections/stackup.json";
/// `projections/semantic-index.json`: each net's `netClass`.
pub const SEMANTIC_INDEX: &str = "projections/semantic-index.json";
/// `projections/route-metrics.json`: per-net length, vias and used layers.
pub const ROUTE_METRICS: &str = "projections/route-metrics.json";
/// `projections/placements.json`: sides and courtyards.
pub const PLACEMENTS: &str = "projections/placements.json";
/// `models/assembly-hlr.json`: each footprint's body outline.
pub const ASSEMBLY_HLR: &str = "models/assembly-hlr.json";

/// The class board-only nets land in when the semantic index has no net class.
pub const UNASSIGNED: &str = "Unassigned";
/// The trace width used when a segment authors none, KiCad's default.
const DEFAULT_TRACE_WIDTH: f64 = 0.25;

/// Which side's footprints a drawing shows in full.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    /// Front footprints.
    Top,
    /// Back footprints.
    Bottom,
}

impl Side {
    /// `top` or `bottom`, for markup.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Top => "top",
            Self::Bottom => "bottom",
        }
    }
}

/// Which footprints a page draws in full.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SideChoice {
    /// Front footprints only.
    Top,
    /// Back footprints only.
    Bottom,
    /// One side at a time, chosen on the page.
    Both,
}

impl SideChoice {
    /// Parse `top`, `bottom` or `both`.
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "top" => Some(Self::Top),
            "bottom" => Some(Self::Bottom),
            "both" => Some(Self::Both),
            _ => None,
        }
    }

    /// The side the page opens on.
    pub fn initial(self) -> Side {
        match self {
            Self::Top | Self::Both => Side::Top,
            Self::Bottom => Side::Bottom,
        }
    }

    /// True when `side`'s footprints are drawn in full.
    pub fn full(self, side: Side) -> bool {
        self == Self::Both || self.initial() == side
    }

    /// True when the page offers the side switch.
    pub fn offers_switch(self) -> bool {
        self == Self::Both
    }

    /// `top`, `bottom` or `both`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Top => "top",
            Self::Bottom => "bottom",
            Self::Both => "both",
        }
    }
}

/// The board plus everything the page needs from the projections.
pub struct Atlas {
    /// The board's file name without its extension.
    pub board_name: String,
    /// The board's repository path.
    pub board_file: String,
    /// What identifies this design: the bundle's revision key when it has one,
    /// else the semantic index's design key.
    pub identity: String,
    /// `revision key` or `design key`, naming `identity`.
    pub identity_label: &'static str,
    /// Copper layers in stack order, front to back.
    pub copper: Vec<String>,
    /// Every track segment and routing arc on the board.
    pub tracks: usize,
    /// Every via on the board.
    pub vias: usize,
    /// The classes, most routed length first, `Default` last.
    pub classes: Vec<ClassSection>,
    /// The board as the drawings see it.
    pub drawing: Drawing,
}

/// One net class and the facts its section reports.
pub struct ClassSection {
    /// The class name as the netlist writes it.
    pub name: String,
    /// Routed length over the class's nets, in millimetres.
    pub length_mm: f64,
    /// The class's nets, longest first.
    pub nets: Vec<NetRow>,
    /// The class's net names, for filtering the drawing.
    pub net_names: BTreeSet<String>,
    /// Indices into [`Drawing::footprints`] of the footprints the class reaches.
    pub footprints: Vec<usize>,
    /// Track segments and arcs on the class's nets.
    pub tracks: usize,
    /// Vias on the class's nets.
    pub vias: usize,
    /// Pads on the class's nets.
    pub pads: usize,
}

/// One table row: a net of the class.
pub struct NetRow {
    /// KiCad's full net name.
    pub name: String,
    /// Routed centerline length in millimetres.
    pub length_mm: f64,
    /// Number of vias on the net.
    pub vias: usize,
    /// Copper layers the net is routed on, in the projection's order.
    pub layers: Vec<String>,
    /// Number of pads on the net.
    pub pads: usize,
}

/// One net's facts before they are grouped into classes.
pub struct NetInput {
    /// KiCad's full net name.
    pub name: String,
    /// The net's class, empty when the net has none.
    pub class: String,
    /// Routed length in millimetres.
    pub length_mm: f64,
    /// Number of vias.
    pub vias: usize,
    /// Copper layers used.
    pub layers: Vec<String>,
}

/// The board-wide drawable facts, in millimetres and board frame (+y down).
pub struct Drawing {
    /// The board perimeter.
    pub outline: Vec<Point>,
    /// Closed rings inside the perimeter.
    pub cutouts: Vec<Vec<Point>>,
    /// The board-level `Edge.Cuts` extent.
    pub bounds: Bounds,
    /// Every routed segment and arc, as a polyline.
    pub traces: Vec<Trace>,
    /// Every via.
    pub vias: Vec<Via>,
    /// Every filled zone polygon, and every zone outline without a fill.
    pub zones: Vec<Zone>,
    /// Every footprint.
    pub footprints: Vec<Footprint>,
}

/// One routed polyline on one copper layer.
pub struct Trace {
    /// The net's full name; never empty.
    pub net: String,
    /// The copper layer.
    pub layer: String,
    /// The authored width in millimetres.
    pub width: f64,
    /// The centerline, two points for a segment and many for an arc.
    pub points: Vec<Point>,
}

/// One via.
pub struct Via {
    /// The net's full name; never empty.
    pub net: String,
    /// The center.
    pub at: Point,
    /// The outer diameter.
    pub size: f64,
    /// The drill diameter.
    pub drill: f64,
}

/// One zone's filled polygon, or one unfilled zone outline, on one layer.
pub struct Zone {
    /// The net's full name; never empty.
    pub net: String,
    /// The copper layer.
    pub layer: String,
    /// The polygon rings; several only when filled rings were merged.
    pub rings: Vec<Vec<Point>>,
    /// True for a fill the board carries, false for an authored outline.
    pub filled: bool,
}

/// One footprint, its body and its pads.
pub struct Footprint {
    /// Board order.
    pub index: usize,
    /// Reference designator, or `?` when the board has none.
    pub reference: String,
    /// The side it sits on.
    pub side: Side,
    /// Board anchor x.
    pub x: f64,
    /// Board anchor y.
    pub y: f64,
    /// Orientation in degrees, KiCad's counter-clockwise board angle.
    pub angle: f64,
    /// The pads, in file order.
    pub pads: Vec<Pad>,
    /// The body outline.
    pub body: Body,
    /// The body outline's extent, for the designator.
    pub body_bounds: Bounds,
    /// Nets its pads connect to, without repeats and without the empty net.
    pub nets: BTreeSet<String>,
}

/// A footprint's body, in board coordinates.
pub enum Body {
    /// Silhouette and visible-detail edges from `models/assembly-hlr.json`.
    Edges(AssemblyHlrEdges),
    /// A fallback ring: the courtyard, else the pad envelope.
    Envelope(Vec<Point>),
}

/// One pad, in the footprint's frame.
#[derive(Clone)]
pub struct Pad {
    /// The net's full name; empty for a mechanical pad.
    pub net: String,
    /// The pad's layers as authored.
    pub layers: Vec<String>,
    /// Footprint-local anchor x.
    pub x: f64,
    /// Footprint-local anchor y.
    pub y: f64,
    /// The pad's own rotation in degrees.
    pub angle: f64,
    /// The pad's shape.
    pub shape: PadShape,
}

/// A pad's shape, centred on the pad anchor.
#[derive(Clone)]
pub enum PadShape {
    /// A round pad.
    Circle {
        /// Diameter.
        diameter: f64,
    },
    /// A rectangular pad.
    Rect {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
    },
    /// A rounded rectangle.
    RoundRect {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
        /// Corner radius.
        radius: f64,
    },
    /// An oval (a rectangle with semicircular ends).
    Oval {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
    },
    /// A custom pad: its anchor shape plus the authored primitives.
    Custom {
        /// Anchor width.
        width: f64,
        /// Anchor height.
        height: f64,
        /// True when the anchor is a circle rather than a rectangle.
        anchor_circle: bool,
        /// Primitive rings in pad-local coordinates.
        rings: Vec<Vec<Point>>,
    },
}

// --------------------------------------------------------------------- load

/// Read the bundle's board and projections into an [`Atlas`].
pub fn load(bundle: &Bundle) -> Result<Atlas, LabError> {
    let text = bundle.board_text()?;
    let view = PcbView::parse(&text, PcbLimits::default())
        .map_err(|error| LabError::new(format!("the board does not parse: {error}")))?;
    let board = geometry::board_geometry(&view)
        .map_err(|error| LabError::new(format!("the board geometry could not be read: {error}")))?;
    if board.outer.is_empty() {
        return Err(LabError::new("the board has no closed Edge.Cuts outline"));
    }
    let stackup: StackupA0 = bundle.required_json(STACKUP)?;
    let semantic: SemanticIndexA2 = bundle.required_json(SEMANTIC_INDEX)?;
    let metrics: RouteMetricsA0 = bundle.required_json(ROUTE_METRICS)?;
    let placements: Option<PlacementsA1> = bundle.json(PLACEMENTS)?;
    let hlr: Option<AssemblyHlrA0> = bundle.json(ASSEMBLY_HLR)?;
    let drawing = Drawing::build(&view, &board, placements.as_ref(), hlr.as_ref())?;
    let classes = sections(net_inputs(&semantic, &metrics), &drawing);
    let identity = identity(bundle, &semantic);
    Ok(Atlas {
        board_name: bundle.board_name()?,
        board_file: bundle.board_file()?,
        identity_label: identity.0,
        identity: identity.1,
        copper: copper_order(&stackup, &view),
        tracks: drawing.traces.len(),
        vias: drawing.vias.len(),
        classes,
        drawing,
    })
}

/// The identity the masthead shows: the revision key the bundle was built for
/// when the manifest records one, else the semantic index's design key.
fn identity(bundle: &Bundle, semantic: &SemanticIndexA2) -> (&'static str, String) {
    match &bundle.manifest().revision_key {
        Some(key) => ("revision key", short(&key.0)),
        None => ("design key", short(&semantic.design_key.0)),
    }
}

/// The first twelve characters of a hex digest.
fn short(digest: &str) -> String {
    digest.chars().take(12).collect()
}

/// The stackup's copper order, front to back, falling back to the board's
/// layer table when the stackup projection names none.
fn copper_order(stackup: &StackupA0, view: &PcbView<'_>) -> Vec<String> {
    let from_stackup = palette::copper_layers(
        &stackup
            .copper_layers
            .iter()
            .map(|layer| layer.as_str().to_owned())
            .collect::<Vec<_>>(),
    );
    if !from_stackup.is_empty() {
        return from_stackup;
    }
    let mut layers = Vec::new();
    for layer in view.layers().flatten() {
        let name = layer.name.clone();
        if palette::copper_color(&name).is_some() {
            layers.push(name);
        }
    }
    layers
}

// ------------------------------------------------------------- net inputs

/// Every net the board carries, from the projections and the board's pads.
fn net_inputs(semantic: &SemanticIndexA2, metrics: &RouteMetricsA0) -> Vec<NetInput> {
    let mut nets: BTreeMap<String, NetInput> = BTreeMap::new();
    for net in &semantic.nets {
        nets.insert(
            net.name.as_str().to_owned(),
            NetInput {
                name: net.name.as_str().to_owned(),
                class: class_name(&net.net_class),
                length_mm: 0.0,
                vias: 0,
                layers: Vec::new(),
            },
        );
    }
    for net in &metrics.nets {
        let name = net.net_name.as_str().to_owned();
        let class = nets
            .get(&name)
            .map(|net| net.class.clone())
            .unwrap_or_else(|| UNASSIGNED.to_owned());
        nets.insert(
            name.clone(),
            NetInput {
                name,
                class,
                length_mm: net.route_length_nm.0 as f64 / 1_000_000.0,
                vias: net.via_count.0 as usize,
                layers: net
                    .used_layers
                    .iter()
                    .map(|layer| layer.as_str().to_owned())
                    .collect(),
            },
        );
    }
    nets.into_values().collect()
}

/// A net class as the page names it: the netlist's name, or `Unassigned`.
fn class_name(raw: &str) -> String {
    if raw.trim().is_empty() {
        UNASSIGNED.to_owned()
    } else {
        raw.to_owned()
    }
}

// --------------------------------------------------------------- sections

/// Group `nets` into the page's sections, keeping only nets the board carries.
///
/// A net is on the board when a pad, a trace, a via or a zone names it: a
/// schematic-only net would otherwise fill a table with zeroes.
pub fn sections(nets: Vec<NetInput>, drawing: &Drawing) -> Vec<ClassSection> {
    let board_nets = board_nets(drawing);
    let mut classes: BTreeMap<String, Vec<NetInput>> = BTreeMap::new();
    for net in nets {
        if board_nets.contains(&net.name) {
            classes.entry(net.class.clone()).or_default().push(net);
        }
    }
    let mut sections: Vec<ClassSection> = classes
        .into_iter()
        .filter_map(|(name, nets)| section(name, nets, drawing))
        .collect();
    sections.sort_by(|left, right| {
        default_last(left)
            .cmp(&default_last(right))
            .then(right.length_mm.total_cmp(&left.length_mm))
            .then(left.name.cmp(&right.name))
    });
    sections
}

fn default_last(section: &ClassSection) -> bool {
    section.name.eq_ignore_ascii_case("Default")
}

/// One class's section, or `None` when none of its nets has pads or routing.
fn section(name: String, nets: Vec<NetInput>, drawing: &Drawing) -> Option<ClassSection> {
    let mut rows: Vec<NetRow> = nets
        .into_iter()
        .map(|net| NetRow {
            name: net.name,
            length_mm: net.length_mm,
            vias: net.vias,
            layers: net.layers,
            pads: 0,
        })
        .collect();
    for footprint in &drawing.footprints {
        for pad in &footprint.pads {
            if let Some(row) = rows.iter_mut().find(|row| row.name == pad.net) {
                row.pads += 1;
            }
        }
    }
    let net_names: BTreeSet<String> = rows.iter().map(|row| row.name.clone()).collect();
    let tracks = drawing
        .traces
        .iter()
        .filter(|trace| net_names.contains(&trace.net))
        .count();
    let vias = drawing
        .vias
        .iter()
        .filter(|via| net_names.contains(&via.net))
        .count();
    let pads = rows.iter().map(|row| row.pads).sum();
    let zoned = drawing
        .zones
        .iter()
        .any(|zone| net_names.contains(&zone.net));
    if tracks == 0 && vias == 0 && pads == 0 && !zoned {
        return None;
    }
    rows.retain(|row| row.pads > 0 || row.length_mm > 0.0 || row.vias > 0);
    rows.sort_by(|left, right| {
        right
            .length_mm
            .total_cmp(&left.length_mm)
            .then(left.name.cmp(&right.name))
    });
    let length_mm = rows.iter().map(|row| row.length_mm).sum();
    let footprints = drawing
        .footprints
        .iter()
        .filter(|footprint| footprint.nets.iter().any(|net| net_names.contains(net)))
        .map(|footprint| footprint.index)
        .collect();
    Some(ClassSection {
        name,
        length_mm,
        nets: rows,
        net_names,
        footprints,
        tracks,
        vias,
        pads,
    })
}

/// Every net the board carries.
fn board_nets(drawing: &Drawing) -> BTreeSet<String> {
    let mut nets = BTreeSet::new();
    nets.extend(drawing.traces.iter().map(|trace| trace.net.clone()));
    nets.extend(drawing.vias.iter().map(|via| via.net.clone()));
    nets.extend(drawing.zones.iter().map(|zone| zone.net.clone()));
    for footprint in &drawing.footprints {
        nets.extend(footprint.nets.iter().cloned());
    }
    nets
}

// ---------------------------------------------------------------- drawing

impl Drawing {
    /// Build the drawable board from the parsed board and the projections.
    fn build(
        view: &PcbView<'_>,
        board: &geometry::BoardGeometry,
        placements: Option<&PlacementsA1>,
        hlr: Option<&AssemblyHlrA0>,
    ) -> Result<Self, LabError> {
        let footprints = view
            .footprints()
            .collect::<Result<Vec<PcbFootprint>, _>>()
            .map_err(|error| LabError::new(format!("a footprint does not decode: {error}")))?;
        let mut pads: Vec<Vec<Pad>> = (0..footprints.len()).map(|_| Vec::new()).collect();
        for pad in view.pads() {
            let pad =
                pad.map_err(|error| LabError::new(format!("a pad does not decode: {error}")))?;
            if let Some(slot) = pads.get_mut(pad.footprint_index) {
                slot.push(pad_facts(&pad));
            }
        }
        Ok(Self {
            outline: board.outer.clone(),
            cutouts: board.cutouts.clone(),
            bounds: board_bounds(board),
            traces: traces(view)?,
            vias: vias(view)?,
            zones: zones(view)?,
            footprints: footprints_facts(&footprints, pads, board, placements, hlr),
        })
    }
}

/// The viewBox extent: the board-level `Edge.Cuts` box, else the perimeter's.
fn board_bounds(board: &geometry::BoardGeometry) -> Bounds {
    if !board.outline_bounds.is_empty() {
        return board.outline_bounds;
    }
    let mut bounds = Bounds::empty();
    for point in &board.outer {
        bounds.include(*point);
    }
    bounds
}

fn traces(view: &PcbView<'_>) -> Result<Vec<Trace>, LabError> {
    let mut traces = Vec::new();
    for segment in view.segments() {
        let segment =
            segment.map_err(|error| LabError::new(format!("a track does not decode: {error}")))?;
        let Some(layer) = copper_layer(segment.layer.as_deref(), segment.layers.as_deref()) else {
            continue;
        };
        let Some(net) = segment.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        traces.push(Trace {
            net,
            layer,
            width: segment.width.unwrap_or(DEFAULT_TRACE_WIDTH).abs(),
            points: vec![
                Point {
                    x: segment.start_x,
                    y: segment.start_y,
                },
                Point {
                    x: segment.end_x,
                    y: segment.end_y,
                },
            ],
        });
    }
    for arc in view.arcs() {
        let arc =
            arc.map_err(|error| LabError::new(format!("a routing arc does not decode: {error}")))?;
        let Some(layer) = copper_layer(arc.layer.as_deref(), arc.layers.as_deref()) else {
            continue;
        };
        let Some(net) = arc.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        traces.push(Trace {
            net,
            layer,
            width: arc.width.unwrap_or(DEFAULT_TRACE_WIDTH).abs(),
            points: geometry::sample_arc(
                Point {
                    x: arc.start.x,
                    y: arc.start.y,
                },
                Point {
                    x: arc.mid.x,
                    y: arc.mid.y,
                },
                Point {
                    x: arc.end.x,
                    y: arc.end.y,
                },
            ),
        });
    }
    Ok(traces)
}

fn vias(view: &PcbView<'_>) -> Result<Vec<Via>, LabError> {
    let mut vias = Vec::new();
    for via in view.vias() {
        let via = via.map_err(|error| LabError::new(format!("a via does not decode: {error}")))?;
        let Some(net) = via.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        vias.push(Via {
            net,
            at: Point {
                x: via.at_x,
                y: via.at_y,
            },
            size: via.size,
            drill: via.drill,
        });
    }
    Ok(vias)
}

/// The copper layer a routed object is on: its `(layer …)`, else the first
/// copper entry of its plural `(layers …)`.
fn copper_layer(layer: Option<&str>, layers: Option<&[String]>) -> Option<String> {
    if let Some(layer) = layer.filter(|layer| palette::copper_color(layer).is_some()) {
        return Some(layer.to_owned());
    }
    layers?
        .iter()
        .find(|layer| palette::copper_color(layer).is_some())
        .cloned()
}

fn zones(view: &PcbView<'_>) -> Result<Vec<Zone>, LabError> {
    let mut zones = Vec::new();
    for zone in view.zones() {
        let zone =
            zone.map_err(|error| LabError::new(format!("a zone does not decode: {error}")))?;
        let Some(net) = zone
            .net
            .name
            .clone()
            .or_else(|| zone.net_name.clone())
            .filter(|name| !name.is_empty())
        else {
            continue;
        };
        if !zone.filled_polygons.is_empty() {
            for polygon in &zone.filled_polygons {
                if palette::copper_color(&polygon.layer).is_none() || polygon.points.len() < 3 {
                    continue;
                }
                zones.push(Zone {
                    net: net.clone(),
                    layer: polygon.layer.clone(),
                    rings: vec![
                        polygon
                            .points
                            .iter()
                            .map(|point| Point::from(*point))
                            .collect(),
                    ],
                    filled: true,
                });
            }
            continue;
        }
        for layer in zone
            .layers
            .iter()
            .filter(|layer| palette::copper_color(layer).is_some())
        {
            for polygon in &zone.polygons {
                let ring = zone_ring(polygon);
                if ring.len() >= 3 {
                    zones.push(Zone {
                        net: net.clone(),
                        layer: layer.clone(),
                        rings: vec![ring],
                        filled: false,
                    });
                }
            }
        }
    }
    Ok(zones)
}

/// An authored zone outline as one ring, arcs sampled through their midpoints.
fn zone_ring(polygon: &PcbZonePolygon) -> Vec<Point> {
    let count = polygon.points.len();
    let arcs: BTreeMap<usize, Point> = polygon
        .arcs
        .iter()
        .map(|arc| (arc.start_index, Point::from(arc.mid)))
        .collect();
    let mut ring = Vec::with_capacity(count);
    for (index, point) in polygon.points.iter().enumerate() {
        let start = Point::from(*point);
        ring.push(start);
        let Some(mid) = arcs.get(&index) else {
            continue;
        };
        let end = Point::from(polygon.points[(index + 1) % count]);
        let sampled = geometry::sample_arc(start, *mid, end);
        if sampled.len() > 2 {
            ring.extend_from_slice(&sampled[1..sampled.len() - 1]);
        }
    }
    ring
}

fn footprints_facts(
    footprints: &[PcbFootprint],
    pads: Vec<Vec<Pad>>,
    board: &geometry::BoardGeometry,
    placements: Option<&PlacementsA1>,
    hlr: Option<&AssemblyHlrA0>,
) -> Vec<Footprint> {
    let placed: BTreeMap<&str, &PlacementsFootprint> = placements
        .map(|placements| {
            placements
                .footprints
                .iter()
                .map(|footprint| (footprint.uuid.0.as_str(), footprint))
                .collect()
        })
        .unwrap_or_default();
    let bodies: BTreeMap<
        &str,
        &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint,
    > = hlr
        .map(|hlr| {
            hlr.footprints
                .iter()
                .map(|footprint| (footprint.uuid.0.as_str(), footprint))
                .collect()
        })
        .unwrap_or_default();
    footprints
        .iter()
        .enumerate()
        .map(|(index, footprint)| {
            let uuid = footprint.uuid.clone().unwrap_or_default();
            let placement = placed.get(uuid.as_str()).copied();
            let body = bodies.get(uuid.as_str()).copied();
            let mut result = Footprint {
                index,
                reference: reference(footprint, placement),
                side: side(footprint, placement),
                x: footprint.at_x.unwrap_or(0.0),
                y: footprint.at_y.unwrap_or(0.0),
                angle: footprint.angle.unwrap_or(0.0),
                pads: pads.get(index).cloned().unwrap_or_default(),
                body: Body::Envelope(Vec::new()),
                body_bounds: Bounds::empty(),
                nets: BTreeSet::new(),
            };
            result.body = body_of(&result, placement, body, board);
            result.body_bounds = body_bounds(&result.body);
            result.nets = result
                .pads
                .iter()
                .map(|pad| pad.net.clone())
                .filter(|net| !net.is_empty())
                .collect();
            result
        })
        .collect()
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

/// The body to draw: the HLR outline, else the courtyard, else the pads'
/// envelope.
fn body_of(
    footprint: &Footprint,
    placement: Option<&PlacementsFootprint>,
    hlr: Option<&prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint>,
    board: &geometry::BoardGeometry,
) -> Body {
    if let Some(outline) = hlr
        .and_then(|hlr| hlr.outline.as_ref())
        .filter(|outline| !outline.segments.is_empty() || !outline.arcs.is_empty())
    {
        return Body::Edges(outline.clone());
    }
    if let Some(courtyard) = placement.and_then(|placement| placement.courtyard_bounds.as_ref()) {
        return Body::Envelope(courtyard_ring(footprint, courtyard));
    }
    match board.pad_envelopes.get(&footprint.index) {
        Some(bounds) => Body::Envelope(bounds.ring()),
        None => Body::Envelope(Vec::new()),
    }
}

/// A courtyard box (footprint-local nanometres) as a board-frame ring.
fn courtyard_ring(
    footprint: &Footprint,
    courtyard: &prism_kicad_contracts::generated::prism_placements_a1::PlacementsBounds,
) -> Vec<Point> {
    let corners = [
        (courtyard.min_nm.x_nm.0, courtyard.min_nm.y_nm.0),
        (courtyard.max_nm.x_nm.0, courtyard.min_nm.y_nm.0),
        (courtyard.max_nm.x_nm.0, courtyard.max_nm.y_nm.0),
        (courtyard.min_nm.x_nm.0, courtyard.max_nm.y_nm.0),
    ];
    let (sin, cos) = footprint.angle.to_radians().sin_cos();
    corners
        .into_iter()
        .map(|(x, y)| {
            let x = x as f64 / 1_000_000.0;
            let y = y as f64 / 1_000_000.0;
            Point {
                x: footprint.x + x * cos + y * sin,
                y: footprint.y - x * sin + y * cos,
            }
        })
        .collect()
}

/// The extent of a body, for placing its designator.
pub fn body_bounds(body: &Body) -> Bounds {
    let mut bounds = Bounds::empty();
    match body {
        Body::Envelope(ring) => {
            for point in ring {
                bounds.include(*point);
            }
        }
        Body::Edges(edges) => {
            for segment in &edges.segments {
                for point in [&segment.start_nm, &segment.end_nm] {
                    bounds.include(nm(point.x_nm.0, point.y_nm.0));
                }
            }
            for arc in &edges.arcs {
                for point in geometry::arc_points(arc) {
                    bounds.include(point);
                }
            }
        }
    }
    bounds
}

fn nm(x: i64, y: i64) -> Point {
    Point {
        x: x as f64 / 1_000_000.0,
        y: y as f64 / 1_000_000.0,
    }
}
