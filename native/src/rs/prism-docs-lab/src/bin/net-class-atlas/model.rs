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
use prism_kicad_contracts::generated::prism_semantic_index_a2::{
    SemanticIndexA2, SemanticIndexPinType,
};
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;
use prism_kicad_core::{PcbFootprint, PcbLimits, PcbView, PcbZonePolygon};

use prism_docs_lab::bundle::{Bundle, LabError};
use prism_docs_lab::palette;

use crate::pads::pad_facts;

mod drawing;
#[cfg(test)]
mod tests;

/// The pad envelope the drawing frame is built from, for the drawing tests.
#[cfg(test)]
pub use drawing::pad_bounds;

/// `projections/stackup.json`: the copper order, front to back.
pub const STACKUP: &str = "projections/stackup.json";
/// `projections/semantic-index.json`: each net's `netClass`.
pub const SEMANTIC_INDEX: &str = "projections/semantic-index.json";
/// `projections/route-metrics.json`: per-net routed length and vias.
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
    /// The number of nets in the class.
    pub net_count: usize,
    /// The class's groups: one entry for a class of at most
    /// [`GROUP_LIMIT`] nets, one per group otherwise.
    pub groups: Vec<NetGroup>,
    /// True when the class was split into several drawings.
    pub split: bool,
    /// Track segments and arcs on the class's nets.
    pub tracks: usize,
    /// Vias on the class's nets.
    pub vias: usize,
    /// Pads on the class's nets.
    pub pads: usize,
}

/// One drawing and table inside a class: the whole class when it has few
/// nets, else the power nets, one schematic sheet's nets, or the rest.
pub struct NetGroup {
    /// The group's heading: `Power and ground`, a sheet path, `Other`, or
    /// empty for an unsplit class.
    pub name: String,
    /// Routed length over the group's nets, in millimetres.
    pub length_mm: f64,
    /// The group's nets, longest first.
    pub nets: Vec<NetRow>,
    /// The group's net names, for filtering its drawing.
    pub net_names: BTreeSet<String>,
    /// Indices into [`Drawing::footprints`] of the footprints the group
    /// reaches.
    pub footprints: Vec<usize>,
    /// Track segments and arcs on the group's nets.
    pub tracks: usize,
    /// Vias on the group's nets.
    pub vias: usize,
    /// Pads on the group's nets.
    pub pads: usize,
    /// Filled zone area as a share of the board's area.
    pub fill_ratio: f64,
    /// True when at least one of the group's zones carries a fill.
    pub has_fill: bool,
}

impl NetGroup {
    /// Zone fills open on the page when they cover less than a quarter of the
    /// board; a class that buries the drawing opens with fills off.
    pub fn zones_default(&self) -> bool {
        self.fill_ratio < 0.25
    }
}

/// A class with more nets than this is split into groups.
pub const GROUP_LIMIT: usize = 40;

/// One table row: a net of the class.
pub struct NetRow {
    /// KiCad's full net name.
    pub name: String,
    /// Routed centerline length in millimetres.
    pub length_mm: f64,
    /// Number of vias on the net.
    pub vias: usize,
    /// The copper layers the net's tracks and arcs are on, in stack order,
    /// front to back.
    pub layers: Vec<String>,
    /// True when `layers` names the net's zone layers because the net has no
    /// tracks: the page marks each one `(zone)`.
    pub zone_layers: bool,
    /// The net's vias, grouped by the copper layers they span.
    pub via_spans: Vec<ViaSpan>,
    /// Number of pads on the net.
    pub pads: usize,
    /// True when the net groups as power or ground.
    pub power: bool,
}

/// The copper layers one group of a net's vias connects.
///
/// A through via's authored span crosses every copper layer between its ends,
/// which is not what a reader wants to know about the net: the tracks say where
/// the net runs, the span says only how the via joins two of those layers.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ViaSpan {
    /// The span's first copper layer, in stack order.
    pub from: String,
    /// The span's last copper layer, in stack order.
    pub to: String,
    /// How many of the net's vias span exactly these layers.
    pub count: usize,
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
    /// True when the net is power or ground: its name says so, or most of its
    /// typed terminals are power pins.
    pub power: bool,
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
    /// The copper layers it connects, as authored; empty when the board names
    /// none, which KiCad reads as every copper layer.
    pub layers: Vec<String>,
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
    /// The pad's rotation relative to its footprint, in degrees.
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
    /// Any other pad (custom, chamfered, trapezoid) as KiCad shapes its copper
    /// (`PcbPad::local_copper_rings`): closed rings in the pad's own frame,
    /// around the copper centre.
    Outline {
        /// The copper's rings; a custom pad's overlap, and their union is the pad.
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
    let copper = copper_order(&stackup, &view);
    let classes = sections(net_inputs(&semantic, &metrics), &drawing, &copper);
    let identity = identity(bundle, &semantic);
    Ok(Atlas {
        board_name: bundle.board_name()?,
        board_file: bundle.board_file()?,
        identity_label: identity.0,
        identity: identity.1,
        copper,
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
    let power_pins = power_pin_shares(semantic);
    let mut nets: BTreeMap<String, NetInput> = BTreeMap::new();
    for net in &semantic.nets {
        let name = net.name.as_str().to_owned();
        nets.insert(
            name.clone(),
            NetInput {
                power: is_power_name(&name)
                    || power_pins
                        .get(&name)
                        .is_some_and(|(typed, power)| *typed > 0 && power * 2 > *typed),
                name,
                class: class_name(&net.net_class),
                length_mm: 0.0,
                vias: 0,
            },
        );
    }
    for net in &metrics.nets {
        let name = net.net_name.as_str().to_owned();
        let known = nets.get(&name);
        let class = known
            .map(|net| net.class.clone())
            .unwrap_or_else(|| UNASSIGNED.to_owned());
        let power = known.map_or_else(|| is_power_name(&name), |net| net.power);
        nets.insert(
            name.clone(),
            NetInput {
                name,
                class,
                length_mm: net.route_length_nm.0 as f64 / 1_000_000.0,
                vias: net.via_count.0 as usize,
                power,
            },
        );
    }
    nets.into_values().collect()
}

/// Per net, how many of its typed terminals are power pins, and how many
/// terminals carry a pin type at all.
fn power_pin_shares(semantic: &SemanticIndexA2) -> BTreeMap<String, (usize, usize)> {
    let mut shares: BTreeMap<String, (usize, usize)> = BTreeMap::new();
    for terminal in &semantic.terminals {
        let Some(net) = terminal.net_name.as_ref() else {
            continue;
        };
        let Some(pin_type) = terminal.pin_type.as_ref() else {
            continue;
        };
        let share = shares.entry(net.as_str().to_owned()).or_default();
        share.0 += 1;
        if matches!(
            pin_type,
            SemanticIndexPinType::PowerIn | SemanticIndexPinType::PowerOut
        ) {
            share.1 += 1;
        }
    }
    shares
}

/// True when a net's leaf name reads as power or ground: `GND`, `AGND`,
/// `DGND`, `VCC*`, `VDD*`, `VBUS*`, `V+`, `+3V3`/`+5V`, or `*_PWR`.
pub fn is_power_name(name: &str) -> bool {
    let leaf = name
        .rsplit('/')
        .find(|part| !part.is_empty())
        .unwrap_or(name)
        .to_ascii_uppercase();
    matches!(leaf.as_str(), "GND" | "AGND" | "DGND")
        || leaf.starts_with("GND")
        || leaf.starts_with("AGND")
        || leaf.starts_with("DGND")
        || leaf.starts_with("VCC")
        || leaf.starts_with("VDD")
        || leaf.starts_with("VBUS")
        || leaf.starts_with("V+")
        || leaf.starts_with('+')
        || leaf.ends_with("_PWR")
}

/// The schematic sheet path a net name starts with: `/Debugger/` for
/// `/Debugger/TCK`, `/A/B/` for `/A/B/N`, and `None` for a root-level or flat
/// name.
pub fn sheet_path(name: &str) -> Option<String> {
    let rest = name.strip_prefix('/')?;
    let slash = rest.rfind('/')?;
    Some(name[..slash + 2].to_owned())
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
/// schematic-only net would otherwise fill a table with zeroes. `copper` is the
/// stack order the layer column reads.
pub fn sections(nets: Vec<NetInput>, drawing: &Drawing, copper: &[String]) -> Vec<ClassSection> {
    let board_nets = board_nets(drawing);
    let mut classes: BTreeMap<String, Vec<NetInput>> = BTreeMap::new();
    for net in nets {
        if board_nets.contains(&net.name) {
            classes.entry(net.class.clone()).or_default().push(net);
        }
    }
    let mut sections: Vec<ClassSection> = classes
        .into_iter()
        .filter_map(|(name, nets)| section(name, nets, drawing, copper))
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
fn section(
    name: String,
    nets: Vec<NetInput>,
    drawing: &Drawing,
    copper: &[String],
) -> Option<ClassSection> {
    let rows = rows_with_pads(nets, drawing, copper);
    if !drawable(&rows, drawing) {
        return None;
    }
    let rows = kept_rows(rows);
    if rows.is_empty() {
        return None;
    }
    Some(build_section(name, rows, drawing))
}

/// The class's rows, with each net's pad count and layer use filled in.
fn rows_with_pads(nets: Vec<NetInput>, drawing: &Drawing, copper: &[String]) -> Vec<NetRow> {
    let layers = net_layers(drawing);
    let spans = net_via_spans(drawing, copper);
    let mut rows: Vec<NetRow> = nets
        .into_iter()
        .map(|net| {
            let used = layers.get(&net.name);
            let tracks = used
                .map(|used| stack_order(&used.tracks, copper))
                .unwrap_or_default();
            // A net with no tracks of its own shows the layers its zones fill,
            // marked as such, so the column never claims a track it has not.
            let zone_layers = tracks.is_empty();
            let layers = if zone_layers {
                used.map(|used| stack_order(&used.zones, copper))
                    .unwrap_or_default()
            } else {
                tracks
            };
            let via_spans = spans.get(&net.name).cloned().unwrap_or_default();
            NetRow {
                name: net.name,
                length_mm: net.length_mm,
                vias: net.vias,
                layers,
                zone_layers,
                via_spans,
                pads: 0,
                power: net.power,
            }
        })
        .collect();
    for footprint in &drawing.footprints {
        for pad in &footprint.pads {
            if let Some(row) = rows.iter_mut().find(|row| row.name == pad.net) {
                row.pads += 1;
            }
        }
    }
    rows
}

/// The copper layers each net's tracks, arcs and zones sit on.
#[derive(Default)]
struct NetLayers {
    /// Layers carrying a track segment or a routing arc.
    tracks: BTreeSet<String>,
    /// Layers carrying a zone fill or outline.
    zones: BTreeSet<String>,
}

fn net_layers(drawing: &Drawing) -> BTreeMap<String, NetLayers> {
    let mut layers: BTreeMap<String, NetLayers> = BTreeMap::new();
    for trace in &drawing.traces {
        layers
            .entry(trace.net.clone())
            .or_default()
            .tracks
            .insert(trace.layer.clone());
    }
    for zone in &drawing.zones {
        layers
            .entry(zone.net.clone())
            .or_default()
            .zones
            .insert(zone.layer.clone());
    }
    layers
}

/// `layers` in the stackup's order, front to back. A layer the stackup does
/// not name keeps a stable place after the ones it does.
fn stack_order(layers: &BTreeSet<String>, copper: &[String]) -> Vec<String> {
    let mut ordered: Vec<String> = copper
        .iter()
        .filter(|layer| layers.contains(layer.as_str()))
        .cloned()
        .collect();
    ordered.extend(
        layers
            .iter()
            .filter(|layer| !copper.contains(layer))
            .cloned(),
    );
    ordered
}

/// Each net's vias, grouped by the copper layers they span, front to back.
fn net_via_spans(drawing: &Drawing, copper: &[String]) -> BTreeMap<String, Vec<ViaSpan>> {
    let mut grouped: BTreeMap<String, BTreeMap<(String, String), usize>> = BTreeMap::new();
    for via in &drawing.vias {
        let Some((from, to)) = via_span(via, copper) else {
            continue;
        };
        *grouped
            .entry(via.net.clone())
            .or_default()
            .entry((from, to))
            .or_default() += 1;
    }
    grouped
        .into_iter()
        .map(|(net, spans)| {
            let spans = spans
                .into_iter()
                .map(|((from, to), count)| ViaSpan { from, to, count })
                .collect();
            (net, spans)
        })
        .collect()
}

/// The copper layers a via joins: its authored layers in stack order, or the
/// stack's ends when it names none (KiCad's through via).
fn via_span(via: &Via, copper: &[String]) -> Option<(String, String)> {
    let mut layers: Vec<&String> = copper
        .iter()
        .filter(|layer| via.layers.contains(layer))
        .collect();
    if layers.is_empty() {
        layers = copper.iter().collect();
    }
    match (layers.first(), layers.last()) {
        (Some(from), Some(to)) => Some(((*from).clone(), (*to).clone())),
        _ => None,
    }
}

/// True when the class has something to draw: routing, pads or a zone.
fn drawable(rows: &[NetRow], drawing: &Drawing) -> bool {
    if rows
        .iter()
        .any(|row| row.pads > 0 || row.length_mm > 0.0 || row.vias > 0)
    {
        return true;
    }
    let names: BTreeSet<&str> = rows.iter().map(|row| row.name.as_str()).collect();
    drawing
        .zones
        .iter()
        .any(|zone| names.contains(zone.net.as_str()))
}

/// Drop schematic-only nets, then sort the rest longest first.
fn kept_rows(rows: Vec<NetRow>) -> Vec<NetRow> {
    let mut rows: Vec<NetRow> = rows
        .into_iter()
        .filter(|row| row.pads > 0 || row.length_mm > 0.0 || row.vias > 0)
        .collect();
    rows.sort_by(|left, right| {
        right
            .length_mm
            .total_cmp(&left.length_mm)
            .then(left.name.cmp(&right.name))
    });
    rows
}

fn build_section(name: String, rows: Vec<NetRow>, drawing: &Drawing) -> ClassSection {
    let length_mm = rows.iter().map(|row| row.length_mm).sum();
    let net_count = rows.len();
    let split = rows.len() > GROUP_LIMIT;
    let groups = if split {
        split_groups(rows, drawing)
    } else {
        vec![net_group(String::new(), rows, drawing)]
    };
    let tracks = groups.iter().map(|group| group.tracks).sum();
    let vias = groups.iter().map(|group| group.vias).sum();
    let pads = groups.iter().map(|group| group.pads).sum();
    ClassSection {
        name,
        length_mm,
        net_count,
        groups,
        split,
        tracks,
        vias,
        pads,
    }
}

/// Split a class's rows into the power group, one group per schematic sheet,
/// and `Other`. Groups are ordered power first, then sheets by routed length,
/// then `Other`; each group keeps its nets longest first.
fn split_groups(rows: Vec<NetRow>, drawing: &Drawing) -> Vec<NetGroup> {
    let mut power = Vec::new();
    let mut sheets: BTreeMap<String, Vec<NetRow>> = BTreeMap::new();
    let mut other = Vec::new();
    for row in rows {
        if row.power {
            power.push(row);
        } else if let Some(sheet) = sheet_path(&row.name) {
            sheets.entry(sheet).or_default().push(row);
        } else {
            other.push(row);
        }
    }
    let mut groups = Vec::new();
    if !power.is_empty() {
        groups.push(net_group("Power and ground".to_owned(), power, drawing));
    }
    let mut sheet_groups: Vec<NetGroup> = sheets
        .into_iter()
        .map(|(sheet, rows)| net_group(sheet, rows, drawing))
        .collect();
    sheet_groups.sort_by(|left, right| {
        right
            .length_mm
            .total_cmp(&left.length_mm)
            .then(left.name.cmp(&right.name))
    });
    groups.extend(sheet_groups);
    if !other.is_empty() {
        groups.push(net_group("Other".to_owned(), other, drawing));
    }
    groups
}

/// One group's facts: its nets, the footprints they reach, their routing and
/// how much of the board its zone fills cover.
fn net_group(name: String, rows: Vec<NetRow>, drawing: &Drawing) -> NetGroup {
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
    let length_mm = rows.iter().map(|row| row.length_mm).sum();
    let footprints = drawing
        .footprints
        .iter()
        .filter(|footprint| footprint.nets.iter().any(|net| net_names.contains(net)))
        .map(|footprint| footprint.index)
        .collect();
    let fill_area: f64 = drawing
        .zones
        .iter()
        .filter(|zone| zone.filled && net_names.contains(&zone.net))
        .flat_map(|zone| zone.rings.iter())
        .map(|ring| polygon_area(ring).abs())
        .sum();
    let board_area = polygon_area(&drawing.outline)
        .abs()
        .max(drawing.bounds.width() * drawing.bounds.height());
    let fill_ratio = if board_area > 0.0 {
        (fill_area / board_area).clamp(0.0, 1.0)
    } else {
        0.0
    };
    let has_fill = drawing
        .zones
        .iter()
        .any(|zone| zone.filled && net_names.contains(&zone.net));
    NetGroup {
        name,
        length_mm,
        nets: rows,
        net_names,
        footprints,
        tracks,
        vias,
        pads,
        fill_ratio,
        has_fill,
    }
}

/// A ring's signed area in square millimetres (the shoelace formula).
pub fn polygon_area(ring: &[Point]) -> f64 {
    if ring.len() < 3 {
        return 0.0;
    }
    let mut sum = 0.0;
    for index in 0..ring.len() {
        let start = ring[index];
        let end = ring[(index + 1) % ring.len()];
        sum += start.x * end.y - end.x * start.y;
    }
    sum / 2.0
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
