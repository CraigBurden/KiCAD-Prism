//! The ICD's facts: the parsed board, the bundle's semantic index and
//! placements, and one [`Connector`] per selected footprint.
//!
//! Everything here is a plain value, so a sheet can be rendered twice from the
//! same model and give the same bytes.

use std::collections::{BTreeMap, BTreeSet};
use std::path::PathBuf;
use std::sync::Arc;

use prism_artwork::artwork::geometry::{self, Bounds, Point};
use prism_kicad_contracts::generated::prism_placements_a1::{
    PlacementsA1, PlacementsFootprint, Side as PlacementSide,
};
use prism_kicad_contracts::generated::prism_semantic_index_a2::{
    RecordString, SemanticIndexA2, SemanticIndexComponent, SemanticIndexTerminal,
};
use prism_kicad_core::{PcbFootprint, PcbLimits, PcbModelReference, PcbPad, PcbView};

use crate::bundle::{Bundle, LabError};
use crate::html::millimetres;

use super::footprint::{Graphic, PadFact, body_ring, graphics, pad_fact, pads_bounds, to_local};
use super::hlr::{
    self, Cache, MatingFace, ModelBounds, ModelPose, ModelSource, Pose, ProjectedView, Session,
    ViewRole, local_pose,
};
use super::pins::{connects_to, is_power_net, natural_cmp, net_leaf, net_text, pin_type_label};
use super::sheet;

/// `projections/semantic-index.json`: components, terminals and net classes.
pub const SEMANTIC_INDEX: &str = "projections/semantic-index.json";
/// `projections/placements.json`: sides, positions and courtyards.
pub const PLACEMENTS: &str = "projections/placements.json";
const DESCRIPTION: [&str; 1] = ["Description"];
const MANUFACTURER: [&str; 2] = ["Manufacturer", "Manufacturer Name"];
const PART_NUMBER: [&str; 3] = ["Manufacturer Part Number", "MPN", "Part Number"];
const SUBSTITUTIONS: [&str; 4] = [
    "Substitutions",
    "Substitution",
    "Alternates",
    "Second Source",
];

/// Which side of the board a connector sits on.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Side {
    /// The front.
    Front,
    /// The back.
    Back,
}

impl Side {
    /// `Front` or `Back`.
    pub fn label(self) -> &'static str {
        match self {
            Self::Front => "Front",
            Self::Back => "Back",
        }
    }

    /// True for a back-side part.
    pub fn is_back(self) -> bool {
        self == Self::Back
    }
}

/// How a connector's 3D model fared.
#[derive(Clone, Debug)]
pub enum ModelState {
    /// The STEP model was projected.
    Step {
        /// The model path as the board writes it.
        reference: String,
        /// The model's SHA-256.
        sha256: String,
    },
    /// The footprint names models, but none is a STEP file.
    NotStep {
        /// The first model's path.
        reference: String,
    },
    /// No model is named, or the bundle cannot supply its bytes.
    Unavailable {
        /// The model path when one is named.
        reference: Option<String>,
    },
    /// Geometer could not project the model.
    ProjectionFailed {
        /// The model path.
        reference: String,
        /// Why the projection failed.
        message: String,
    },
}

impl ModelState {
    /// The reason a sheet records when the connector has no views.
    pub fn reason(&self) -> Option<&'static str> {
        match self {
            Self::Step { .. } => None,
            Self::NotStep { .. } => Some("model-not-step"),
            Self::Unavailable { .. } => Some("model-unavailable"),
            Self::ProjectionFailed { .. } => Some("projection-failed"),
        }
    }

    /// The model path, when the footprint names one.
    pub fn reference(&self) -> Option<&str> {
        match self {
            Self::Step { reference, .. }
            | Self::NotStep { reference }
            | Self::ProjectionFailed { reference, .. } => Some(reference),
            Self::Unavailable { reference } => reference.as_deref(),
        }
    }

    /// The identification table's value for the 3D model row.
    pub fn summary(&self) -> String {
        match self {
            Self::Step { reference, .. } => reference.clone(),
            Self::NotStep { reference } => format!("{reference} (model-not-step)"),
            Self::Unavailable { reference } => match reference {
                Some(reference) => format!("{reference} (model-unavailable)"),
                None => "model-unavailable".to_owned(),
            },
            Self::ProjectionFailed { reference, .. } => format!("{reference} (projection-failed)"),
        }
    }
}

/// The four views of a connector's model.
#[derive(Clone, Debug)]
pub struct Views {
    /// Looking down the board normal.
    pub top: ProjectedView,
    /// The mating face.
    pub front: ProjectedView,
    /// The side.
    pub side: ProjectedView,
    /// The isometric view.
    pub iso: ProjectedView,
    /// The model's overall bounds.
    pub bounds: ModelBounds,
    /// Which way the mating face points.
    pub mating: MatingFace,
    /// True when the part is seen from below, so u is mirrored.
    pub mirror_u: bool,
}

impl Views {
    /// The view for `role`.
    pub fn view(&self, role: ViewRole) -> &ProjectedView {
        match role {
            ViewRole::Top => &self.top,
            ViewRole::Front => &self.front,
            ViewRole::Side => &self.side,
            ViewRole::Iso => &self.iso,
        }
    }
}

/// One pinout row.
#[derive(Clone, Debug)]
pub struct PinRow {
    /// The pin number, `—` for an unnumbered pad.
    pub number: String,
    /// The schematic pin's name.
    pub pin_name: String,
    /// The electrical type's label.
    pub pin_type: String,
    /// The net's leaf name.
    pub net: String,
    /// The full hierarchical net name.
    pub net_full: String,
    /// The net's class.
    pub net_class: String,
    /// The other references on the net.
    pub connects: String,
    /// True on a power or ground row.
    pub power: bool,
    /// True when no schematic terminal names this pad.
    pub mechanical: bool,
    /// How many pads share the row.
    pub pads: usize,
}

/// One connector and everything its sheets print.
pub struct Connector {
    /// The reference designator.
    pub reference: String,
    /// The component's value.
    pub value: String,
    /// The identification table's rows, in print order.
    pub fields: Vec<(String, String)>,
    /// The pinout rows.
    pub pins: Vec<PinRow>,
    /// The pads in their real shape, for the top view.
    pub pads: Vec<PadFact>,
    /// Every pad, including merged duplicates.
    pub pad_count: usize,
    /// Distinct nets the pads reach.
    pub net_count: usize,
    /// Rows on a power or ground net.
    pub power_rows: usize,
    /// The courtyard ring in board coordinates, for the locator.
    pub body: Vec<Point>,
    /// The board's outline and cutouts in the footprint's frame.
    pub board_local: Vec<Vec<Point>>,
    /// The fallback outline in the footprint's frame.
    pub graphics: Vec<Graphic>,
    /// The anchor in board coordinates.
    pub at: Point,
    /// The rotation in degrees.
    pub angle: f64,
    /// The side it sits on.
    pub side: Side,
    /// How the 3D model fared.
    pub model: ModelState,
    /// The four views, when the model was projected.
    pub views: Option<Views>,
    /// The sheets this connector needs.
    pub pages: usize,
}

/// The board's perimeter, for the locator.
pub struct BoardShape {
    /// The outer ring.
    pub outline: Vec<Point>,
    /// Closed rings inside the perimeter.
    pub cutouts: Vec<Vec<Point>>,
    /// The board's extent.
    pub bounds: Bounds,
}

/// The whole document.
pub struct Icd {
    /// The board's file name without its extension.
    pub board_name: String,
    /// The board's repository path.
    pub board_file: String,
    /// The bundle's revision key when it has one, else the semantic index's
    /// design key.
    pub identity: String,
    /// `revision key` or `design key`, naming `identity`.
    pub identity_label: &'static str,
    /// The connectors, in natural reference order.
    pub connectors: Vec<Connector>,
    /// The board as the locator draws it.
    pub board: Arc<BoardShape>,
    /// The document's sheet count.
    pub sheets: usize,
    /// Connectors whose model was projected.
    pub with_views: usize,
    /// Connectors drawn from their footprint.
    pub footprint_only: usize,
    /// The Geometer release, when a session ran.
    pub geometer: Option<String>,
}

/// What `load` selects and how it resolves models.
pub struct LoadOptions {
    /// Reference prefixes that mark a connector (`J`, `P`, `CN`, `X`).
    pub prefixes: Vec<String>,
    /// Exact references to take instead of the prefixes.
    pub refs: Vec<String>,
    /// Prefixes that look like a connector's but are not: `JP` is KiCad's
    /// solder-jumper prefix and would otherwise match `J`.
    pub exclude_prefixes: Vec<String>,
    /// Exact references to leave out of a prefix selection.
    pub exclude_refs: Vec<String>,
    /// `--model-dir VAR=DIR`.
    pub model_dirs: BTreeMap<String, PathBuf>,
}

impl LoadOptions {
    /// True when `reference` is one of the sheet's connectors.
    fn selects(&self, reference: &str) -> bool {
        if !self.refs.is_empty() {
            return self.refs.iter().any(|wanted| wanted == reference);
        }
        if self
            .exclude_refs
            .iter()
            .any(|excluded| excluded == reference)
            || self
                .exclude_prefixes
                .iter()
                .any(|prefix| reference.starts_with(prefix.as_str()))
        {
            return false;
        }
        self.prefixes
            .iter()
            .any(|prefix| reference.starts_with(prefix.as_str()))
    }
}

/// Read the bundle's board, projections and models into an [`Icd`].
pub fn load(
    bundle: &Bundle,
    options: &LoadOptions,
    session: Option<&Session>,
    cache: &mut Cache,
) -> Result<Icd, LabError> {
    let text = bundle.board_text()?;
    let view = PcbView::parse(&text, PcbLimits::default())
        .map_err(|error| LabError::new(format!("the board does not parse: {error}")))?;
    let board_geometry = geometry::board_geometry(&view)
        .map_err(|error| LabError::new(format!("the board geometry could not be read: {error}")))?;
    if board_geometry.outer.is_empty() {
        return Err(LabError::new("the board has no closed Edge.Cuts outline"));
    }
    let semantic: SemanticIndexA2 = bundle.required_json(SEMANTIC_INDEX)?;
    let placements: Option<PlacementsA1> = bundle.json(PLACEMENTS)?;
    let board = Arc::new(BoardShape {
        outline: board_geometry.outer.clone(),
        cutouts: board_geometry.cutouts.clone(),
        bounds: board_bounds(&board_geometry),
    });
    let facts = Facts::new(
        &view,
        &board,
        &semantic,
        placements.as_ref(),
        bundle,
        options,
    );
    let connectors = facts.connectors(session, cache)?;
    if connectors.is_empty() {
        return Err(LabError::new(
            "no footprint matches the requested references or prefixes",
        ));
    }
    let sheets: usize = connectors.iter().map(|connector| connector.pages).sum();
    let with_views = connectors
        .iter()
        .filter(|connector| connector.views.is_some())
        .count();
    let (identity_label, identity) = identity(bundle, &semantic);
    Ok(Icd {
        board_name: bundle.board_name()?,
        board_file: bundle.board_file()?,
        identity,
        identity_label,
        footprint_only: connectors.len() - with_views,
        connectors,
        board,
        sheets,
        with_views,
        geometer: session.map(|session| session.release().to_owned()),
    })
}

fn board_bounds(board: &geometry::BoardGeometry) -> Bounds {
    if !board.outline_bounds.is_empty() {
        return board.outline_bounds;
    }
    Bounds::of_ring(&board.outer)
}

fn identity(bundle: &Bundle, semantic: &SemanticIndexA2) -> (&'static str, String) {
    match &bundle.manifest().revision_key {
        Some(key) => ("revision key", short(&key.0)),
        None => ("design key", short(&semantic.design_key.0)),
    }
}

fn short(digest: &str) -> String {
    digest.chars().take(12).collect()
}

/// One footprint, its placement and the members the board parsed for it.
struct FootprintRow<'a> {
    index: usize,
    footprint: &'a PcbFootprint,
    placement: Option<&'a PlacementsFootprint>,
    reference: String,
    pads: &'a [PcbPad],
    models: &'a [PcbModelReference],
}

/// The bundle's cross-references the sheet needs.
struct Facts<'a> {
    view: &'a PcbView<'a>,
    board: &'a BoardShape,
    bundle: &'a Bundle,
    options: &'a LoadOptions,
    thickness: f64,
    classes: BTreeMap<&'a str, &'a str>,
    terminals: BTreeMap<(&'a str, &'a str), &'a SemanticIndexTerminal>,
    components: BTreeMap<&'a str, &'a SemanticIndexComponent>,
    by_net: BTreeMap<String, Vec<String>>,
    placed: BTreeMap<&'a str, &'a PlacementsFootprint>,
}

impl<'a> Facts<'a> {
    fn new(
        view: &'a PcbView<'a>,
        board: &'a BoardShape,
        semantic: &'a SemanticIndexA2,
        placements: Option<&'a PlacementsA1>,
        bundle: &'a Bundle,
        options: &'a LoadOptions,
    ) -> Self {
        let mut classes = BTreeMap::new();
        for net in &semantic.nets {
            classes.insert(net.name.as_str(), net.net_class.as_str());
        }
        let mut terminals = BTreeMap::new();
        let mut by_net: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for terminal in &semantic.terminals {
            terminals.insert(
                (terminal.reference.as_str(), terminal.pin.as_str()),
                terminal,
            );
            if let Some(net) = &terminal.net_name {
                by_net
                    .entry(net.as_str().to_owned())
                    .or_default()
                    .push(terminal.reference.as_str().to_owned());
            }
        }
        let mut components = BTreeMap::new();
        for component in &semantic.components {
            components.insert(component.reference.as_str(), component);
        }
        let placed: BTreeMap<&'a str, &'a PlacementsFootprint> = placements
            .map(|placements| {
                placements
                    .footprints
                    .iter()
                    .map(|footprint| (footprint.uuid.0.as_str(), footprint))
                    .collect()
            })
            .unwrap_or_default();
        Self {
            view,
            board,
            bundle,
            options,
            thickness: hlr::board_thickness(view),
            classes,
            terminals,
            components,
            by_net,
            placed,
        }
    }

    /// Every selected connector, in natural reference order.
    fn connectors(
        &self,
        session: Option<&Session>,
        cache: &mut Cache,
    ) -> Result<Vec<Connector>, LabError> {
        let footprints = self
            .view
            .footprints()
            .collect::<Result<Vec<PcbFootprint>, _>>()
            .map_err(|error| LabError::new(format!("a footprint does not decode: {error}")))?;
        let pads = self.pads(footprints.len())?;
        let models = self.models()?;
        let mut connectors = Vec::new();
        for (index, footprint) in footprints.iter().enumerate() {
            let placement = footprint
                .uuid
                .as_deref()
                .and_then(|uuid| self.placed.get(uuid).copied());
            let reference = reference_of(footprint, placement);
            if !self.options.selects(&reference) {
                continue;
            }
            let row = FootprintRow {
                index,
                footprint,
                placement,
                reference,
                pads: pads.get(index).map(Vec::as_slice).unwrap_or_default(),
                models: models.get(&index).map(Vec::as_slice).unwrap_or_default(),
            };
            connectors.push(self.connector(&row, session, cache)?);
        }
        connectors.sort_by(|left, right| natural_cmp(&left.reference, &right.reference));
        Ok(connectors)
    }

    fn pads(&self, count: usize) -> Result<Vec<Vec<PcbPad>>, LabError> {
        let mut pads: Vec<Vec<PcbPad>> = (0..count).map(|_| Vec::new()).collect();
        for pad in self.view.pads() {
            let pad =
                pad.map_err(|error| LabError::new(format!("a pad does not decode: {error}")))?;
            if let Some(slot) = pads.get_mut(pad.footprint_index) {
                slot.push(pad);
            }
        }
        Ok(pads)
    }

    fn models(&self) -> Result<BTreeMap<usize, Vec<PcbModelReference>>, LabError> {
        let mut models: BTreeMap<usize, Vec<PcbModelReference>> = BTreeMap::new();
        for model in self.view.models() {
            let model = model
                .map_err(|error| LabError::new(format!("a model does not decode: {error}")))?;
            models.entry(model.footprint_index).or_default().push(model);
        }
        Ok(models)
    }

    fn connector(
        &self,
        row: &FootprintRow<'_>,
        session: Option<&Session>,
        cache: &mut Cache,
    ) -> Result<Connector, LabError> {
        let footprint_angle = row.footprint.angle.unwrap_or_default();
        let pads: Vec<PadFact> = row
            .pads
            .iter()
            .map(|pad| pad_fact(pad, footprint_angle))
            .collect();
        let side = side_of(row.footprint, row.placement);
        let at = Point {
            x: row
                .placement
                .map(|placement| placement.position_nm.x_nm.0 as f64 / 1_000_000.0)
                .unwrap_or_else(|| row.footprint.at_x.unwrap_or_default()),
            y: row
                .placement
                .map(|placement| placement.position_nm.y_nm.0 as f64 / 1_000_000.0)
                .unwrap_or_else(|| row.footprint.at_y.unwrap_or_default()),
        };
        let angle = row
            .placement
            .map(|placement| placement.rotation_deg.0)
            .unwrap_or_else(|| row.footprint.angle.unwrap_or_default());
        let pins = self.pin_rows(&row.reference, &pads);
        let page_count = pages(pins.len());
        let (model, views) = self.model(row, &pads, side, session, cache);
        let component = self.components.get(row.reference.as_str()).copied();
        let fields = self.identification(row, component, side, at, angle, &model);
        let body = body_ring(
            row.footprint,
            row.placement
                .and_then(|placement| placement.courtyard_bounds.as_ref()),
            &pads,
        );
        let mut board_local = vec![to_local(&self.board.outline, at, angle)];
        board_local.extend(
            self.board
                .cutouts
                .iter()
                .map(|ring| to_local(ring, at, angle)),
        );
        let fallback = if views.is_some() {
            Vec::new()
        } else {
            graphics(self.view, row.index, side.is_back())
        };
        let pad_count = pads.len();
        let net_count = pads
            .iter()
            .map(|pad| pad.net.as_str())
            .filter(|net| !net.is_empty())
            .collect::<BTreeSet<_>>()
            .len();
        let power_rows = pins.iter().filter(|pin| pin.power).count();
        Ok(Connector {
            reference: row.reference.clone(),
            value: component
                .map(|component| component.value.clone())
                .filter(|value| !value.is_empty())
                .or_else(|| row.footprint.value.clone())
                .unwrap_or_default(),
            fields,
            pins,
            pads,
            pad_count,
            net_count,
            power_rows,
            body,
            board_local,
            graphics: fallback,
            at,
            angle,
            side,
            model,
            views,
            pages: page_count,
        })
    }

    fn identification(
        &self,
        row: &FootprintRow<'_>,
        component: Option<&SemanticIndexComponent>,
        side: Side,
        at: Point,
        angle: f64,
        model: &ModelState,
    ) -> Vec<(String, String)> {
        let mut rows = vec![("Reference".to_owned(), row.reference.clone())];
        let value = component
            .map(|component| component.value.clone())
            .filter(|value| !value.is_empty())
            .or_else(|| row.footprint.value.clone())
            .unwrap_or_default();
        if !value.is_empty() {
            rows.push(("Value".to_owned(), value));
        }
        for (label, keys) in [
            ("Description", DESCRIPTION.as_slice()),
            ("Manufacturer", MANUFACTURER.as_slice()),
            ("Part number", PART_NUMBER.as_slice()),
            ("Substitutions", SUBSTITUTIONS.as_slice()),
        ] {
            if let Some(found) = component.and_then(|component| field(&component.fields, keys)) {
                rows.push((label.to_owned(), found.to_owned()));
            }
        }
        let footprint_name = component
            .map(|component| component.footprint.as_str())
            .filter(|name| !name.is_empty())
            .unwrap_or(row.footprint.library_link.as_str());
        if !footprint_name.is_empty() {
            rows.push(("Footprint".to_owned(), footprint_name.to_owned()));
        }
        rows.push(("Side".to_owned(), side.label().to_owned()));
        rows.push((
            "Position".to_owned(),
            format!(
                "x {} mm \u{00b7} y {} mm",
                millimetres(at.x),
                millimetres(at.y)
            ),
        ));
        rows.push((
            "Rotation".to_owned(),
            format!("{} \u{00b0}", trim_number(angle)),
        ));
        rows.push((
            "DNP".to_owned(),
            if row
                .placement
                .map(|placement| placement.dnp)
                .unwrap_or_else(|| {
                    row.footprint
                        .attributes
                        .iter()
                        .any(|attribute| attribute == "dnp")
                })
            {
                "Yes".to_owned()
            } else {
                "No".to_owned()
            },
        ));
        rows.push(("3D model".to_owned(), model.summary()));
        rows
    }

    fn pin_rows(&self, reference: &str, pads: &[PadFact]) -> Vec<PinRow> {
        let mut groups: BTreeMap<String, Vec<&PadFact>> = BTreeMap::new();
        let mut unnumbered: Vec<&PadFact> = Vec::new();
        for pad in pads {
            if pad.number.is_empty() {
                unnumbered.push(pad);
            } else {
                groups.entry(pad.number.clone()).or_default().push(pad);
            }
        }
        let mut rows = Vec::new();
        let mut mechanical = Vec::new();
        for (number, group) in &groups {
            let terminal = self.terminals.get(&(reference, number.as_str())).copied();
            let row = self.pin_row(reference, number, group, terminal);
            if row.mechanical {
                mechanical.push(row);
            } else {
                rows.push(row);
            }
        }
        rows.sort_by(|left, right| natural_cmp(&left.number, &right.number));
        for pad in unnumbered {
            let terminal = self
                .terminals
                .get(&(reference, pad.number.as_str()))
                .copied();
            let mut row = self.pin_row(reference, "", &[pad], terminal);
            row.mechanical = true;
            row.pin_name = "mechanical".to_owned();
            row.pin_type = "mechanical".to_owned();
            row.number = "\u{2014}".to_owned();
            mechanical.push(row);
        }
        mechanical.sort_by(|left, right| {
            left.net_full
                .cmp(&right.net_full)
                .then_with(|| natural_cmp(&left.number, &right.number))
        });
        rows.extend(mechanical);
        rows
    }

    fn pin_row(
        &self,
        reference: &str,
        number: &str,
        group: &[&PadFact],
        terminal: Option<&SemanticIndexTerminal>,
    ) -> PinRow {
        let pad = group.first().copied();
        let board_net = pad.map(|pad| pad.net.clone()).unwrap_or_default();
        let terminal_net = terminal
            .and_then(|terminal| terminal.net_name.as_ref())
            .map(|net| net.as_str().to_owned())
            .filter(|net| !net.is_empty());
        let net_full = terminal_net.unwrap_or(board_net);
        let net_class = self
            .classes
            .get(net_full.as_str())
            .map(|class| (*class).to_owned())
            .unwrap_or_default();
        let pin_type = terminal
            .and_then(|terminal| terminal.pin_type.as_ref())
            .map(ToString::to_string);
        let connects = if net_full.is_empty() {
            String::new()
        } else {
            connects_to(&net_full, reference, &self.by_net, 6)
        };
        let power =
            !net_full.is_empty() && is_power_net(&net_full, &net_class, pin_type.as_deref());
        let net = if net_full.is_empty() {
            "NC".to_owned()
        } else {
            net_text(net_leaf(&net_full))
        };
        PinRow {
            number: number.to_owned(),
            pin_name: terminal
                .and_then(|terminal| terminal.pin_name.clone())
                .unwrap_or_default(),
            pin_type: pin_type_label(pin_type.as_deref()).to_owned(),
            net,
            net_full,
            net_class,
            connects,
            power,
            mechanical: terminal.is_none(),
            pads: group.len(),
        }
    }

    fn model(
        &self,
        row: &FootprintRow<'_>,
        pads: &[PadFact],
        side: Side,
        session: Option<&Session>,
        cache: &mut Cache,
    ) -> (ModelState, Option<Views>) {
        let Some(model) = row.models.iter().find(|model| hlr::is_step(&model.path)) else {
            return match row.models.first() {
                Some(model) => (
                    ModelState::NotStep {
                        reference: model.path.clone(),
                    },
                    None,
                ),
                None => (ModelState::Unavailable { reference: None }, None),
            };
        };
        let Some(bytes) = self.step_bytes(row.index, &model.path) else {
            return (
                ModelState::Unavailable {
                    reference: Some(model.path.clone()),
                },
                None,
            );
        };
        let sha256 = hlr::sha256_hex(&bytes);
        let pose = local_pose(
            &ModelPose {
                offset: model.offset,
                rotate: model.rotate,
                scale: model.scale,
            },
            side.is_back(),
            self.thickness,
        );
        let state = ModelState::Step {
            reference: model.path.clone(),
            sha256: sha256.clone(),
        };
        let Some(session) = session else {
            return (
                ModelState::ProjectionFailed {
                    reference: model.path.clone(),
                    message: "no Geometer runtime".to_owned(),
                },
                None,
            );
        };
        match self.views(session, cache, &bytes, &sha256, &pose, pads) {
            Ok(views) => (state, Some(views)),
            Err(error) => (
                ModelState::ProjectionFailed {
                    reference: model.path.clone(),
                    message: error.message,
                },
                None,
            ),
        }
    }

    fn step_bytes(&self, index: usize, reference: &str) -> Option<Vec<u8>> {
        let board_file = self.bundle.board_file().ok()?;
        let board_dir = parent(&board_file);
        let project_dir = parent(&self.bundle.manifest().config.project_file.0);
        let source = ModelSource {
            view: self.view,
            footprint_index: index,
            board_dir: &board_dir,
            project_dir: &project_dir,
            bundle: self.bundle,
            model_dirs: &self.options.model_dirs,
        };
        hlr::step_bytes(&source, reference)
    }

    fn views(
        &self,
        session: &Session,
        cache: &mut Cache,
        bytes: &[u8],
        sha256: &str,
        pose: &Pose,
        pads: &[PadFact],
    ) -> Result<Views, LabError> {
        let bounds = cache.bounds(session, bytes, sha256, pose)?;
        // The projection's v axis is the negative of the footprint file's y
        // (KiCad writes footprint-local y upwards), so the heuristic compares
        // the pads with the model in the file's frame.
        let file_bounds = ModelBounds {
            min: [bounds.min[0], -bounds.max[1], bounds.min[2]],
            max: [bounds.max[0], -bounds.min[1], bounds.max[2]],
        };
        let mating = hlr::mating_face(&file_bounds, pads_bounds(pads));
        let plan = views_plan(mating);
        let projected = cache.views(session, bytes, sha256, pose, &plan)?;
        let take = |role: ViewRole| {
            projected.get(&role).cloned().ok_or_else(|| {
                LabError::new(format!("Geometer returned no {} view", role.as_str()))
            })
        };
        Ok(Views {
            top: take(ViewRole::Top)?,
            front: take(ViewRole::Front)?,
            side: take(ViewRole::Side)?,
            iso: take(ViewRole::Iso)?,
            bounds,
            mating,
            mirror_u: pose.mirror_u,
        })
    }
}

/// The four view directions a sheet asks for.
pub fn views_plan(mating: MatingFace) -> Vec<(ViewRole, [f64; 3], [f64; 3])> {
    let (front_direction, front_up) = mating.front();
    let (side_direction, side_up) = mating.side();
    let iso = 1.0 / 3.0_f64.sqrt();
    vec![
        (ViewRole::Top, [0.0, 0.0, 1.0], [0.0, 1.0, 0.0]),
        (ViewRole::Front, to_world(front_direction), front_up),
        (ViewRole::Side, to_world(side_direction), side_up),
        (ViewRole::Iso, [iso, -iso, iso], [0.0, 0.0, 1.0]),
    ]
}

/// A footprint-frame direction as Geometer's world direction: the projection
/// looks along `-y` where the footprint file writes `+y`.
fn to_world(direction: [f64; 3]) -> [f64; 3] {
    [direction[0], -direction[1], direction[2]]
}

fn parent(path: &str) -> String {
    path.rsplit_once('/')
        .map(|(directory, _)| directory.to_owned())
        .unwrap_or_default()
}

fn field<'a>(fields: &'a RecordString, keys: &[&str]) -> Option<&'a str> {
    keys.iter().find_map(|key| {
        fields
            .get(*key)
            .map(String::as_str)
            .filter(|value| !value.trim().is_empty())
    })
}

fn reference_of(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> String {
    placement
        .and_then(|placement| placement.reference.as_ref())
        .map(|reference| reference.as_str().to_owned())
        .or_else(|| footprint.reference.clone())
        .filter(|reference| !reference.is_empty())
        .unwrap_or_else(|| "?".to_owned())
}

fn side_of(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> Side {
    match placement.map(|placement| placement.side) {
        Some(PlacementSide::Back) => Side::Back,
        Some(PlacementSide::Front) => Side::Front,
        None => match footprint.layer.as_deref() {
            Some(layer) if layer.starts_with("B.") => Side::Back,
            _ => Side::Front,
        },
    }
}

/// A number without trailing zeros (`-90`, `12.5`).
fn trim_number(value: f64) -> String {
    let text = format!("{value:.3}");
    let trimmed = text.trim_end_matches('0').trim_end_matches('.');
    if trimmed == "-0" {
        "0".to_owned()
    } else {
        trimmed.to_owned()
    }
}

/// The sheets one pinout needs.
pub fn pages(pins: usize) -> usize {
    if pins <= sheet::ROWS_FIRST {
        return 1;
    }
    1 + (pins - sheet::ROWS_FIRST).div_ceil(sheet::ROWS_CONTINUATION)
}

#[cfg(test)]
mod tests;
