//! A review change and its visual targets: what the object and connectivity
//! tabs produce, what [`super::project_diff`] turns into ecad-viewer's native
//! changes, and what the targets module writes as the change's
//! `details.targets` (field map, "Targets").

use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;

/// One change of the Schematic or PCB tab, with the objects ecad-viewer
/// highlights for it.
#[derive(Clone, Debug)]
pub struct ReviewChange {
    /// The change as the result document carries it.
    pub change: dc::DesignCompareChange,
    /// The objects to highlight, in review order; empty for a review-only
    /// change.
    pub visual_targets: Vec<VisualTarget>,
}

/// The revision pane a visual target is painted in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VisualSide {
    /// The base revision.
    Reference,
    /// The head revision.
    Comparison,
}

/// What the change does to a visual target's object.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum VisualStatus {
    /// Only in the head revision.
    Added,
    /// Only in the base revision.
    Removed,
    /// In both, and different.
    Modified,
}

/// How a visual target is drawn (today's `visualTargets[].role`,
/// `frontend/src/components/design-comparison/types.ts:172-197`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(
    missing_docs,
    reason = "one variant per role name of the frontend's list"
)]
pub enum VisualRole {
    Component,
    Wire,
    Bus,
    BusEntry,
    Label,
    Junction,
    Terminal,
    Sheet,
    SheetPin,
    Symbol,
    NoConnect,
    Graphic,
    Footprint,
    Pad,
    Track,
    Arc,
    Via,
    Zone,
    FootprintGraphic,
    FootprintText,
    Image,
    Table,
    Group,
    NetClass,
    NetClassAssignment,
    /// A native kind with no role of its own; the target keeps its `kind`.
    Other,
}

/// One object ecad-viewer highlights for a change.
#[derive(Clone, Debug)]
pub struct VisualTarget {
    /// The pane.
    pub side: VisualSide,
    /// What happens to the object.
    pub status: VisualStatus,
    /// The object's native identity in that revision.
    pub source_id: String,
    /// The parent object's UUID. `None` for a top-level object.
    pub parent_source_id: Option<String>,
    /// The object's kind as the board-objects member names it.
    pub kind: Option<String>,
    /// The document, relative to the project directory.
    pub document_path: Option<String>,
    /// The sheet instance path of a schematic object. `None` on the board.
    pub sheet_path: Option<String>,
    /// The object's position.
    pub at: Option<dc::PointNm>,
    /// How the object is drawn.
    pub role: VisualRole,
    /// The component reference, when the object belongs to one.
    pub reference: Option<String>,
    /// The pin number of a terminal target.
    pub pin: Option<String>,
}
