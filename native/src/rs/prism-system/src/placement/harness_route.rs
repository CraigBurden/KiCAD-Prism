//! One harness routed in the world, from the scene's data
//! (CONTRACTS_P2 §17.10, SB2-46).
//!
//! A scene harness (ends located on board occurrences with their connectors,
//! wires and nodes in the level's frame) and each occurrence's world matrix
//! give: the end poses (§17.6), the tree through the stored breakouts (§17.7)
//! and the curves through the stored waypoints (§17.8, §17.9). The browser
//! draws tubes from the same route; the server checks and measures it
//! ([`crate::placement::harness_checks`]).
//!
//! A faithful port of
//! `backend/app/services/systems/placement/harness_route.py`; the TypeScript
//! twin is `frontend/src/features/system-builder/placement/harness-route.ts`.

use crate::placement::frames::{ConnectorGeometry, StoredFrame, quaternion};
use crate::placement::harness_curves::{Curve, CurveEnd, SegmentCurve, harness_curves};
use crate::placement::harness_ends::{EndPose, Housing, board_end};
use crate::placement::harness_nodes::{HarnessNodeInput, breakouts, segment_waypoints};
use crate::placement::harness_topology::{
    HarnessSegment, Topology, TopologyEnd, TopologyWire, WireSide, topology,
};
use crate::placement::poses::{Pose, compose};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

/// A rigid column-major world matrix in mm.
pub type Matrix = [f64; 16];

/// The identity matrix.
const IDENTITY: Matrix = [
    1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
];

/// A scene end's connector.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneConnector {
    /// The connector's extractor v6 geometry.
    pub geometry: Option<ConnectorGeometry>,
    /// The board thickness.
    #[serde(default)]
    pub thickness_mm: Option<f64>,
    /// The stored mating record.
    #[serde(default)]
    pub stored: Option<StoredFrame>,
    /// A module's connector: its footprint's pose on the module (§5.6).
    #[serde(default)]
    pub in_occurrence: Option<Pose>,
}

/// One end in a scene harness.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneHarnessEnd {
    /// The end's id.
    pub id: String,
    /// Its order along the harness.
    pub ordinal: i64,
    /// The occurrence that carries its connector.
    #[serde(default)]
    pub occurrence: Option<String>,
    /// The connector, when the end has one.
    #[serde(default)]
    pub connector: Option<SceneConnector>,
    /// The end's part model (§18.2).
    #[serde(default)]
    pub housing: Option<Housing>,
}

/// A wire in a scene harness.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneWire {
    /// The wire's id.
    pub id: String,
    /// The start end's id.
    pub from: String,
    /// The end end's id.
    pub to: String,
    /// The gauge, as stored.
    #[serde(default)]
    pub gauge_awg: Option<Value>,
}

/// A harness in a scene.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneHarness {
    /// The harness's id.
    pub id: String,
    /// The level its nodes are stored in; `None` is the world.
    #[serde(default)]
    pub level: Option<String>,
    /// Its ends.
    pub ends: Vec<SceneHarnessEnd>,
    /// Its wires.
    pub wires: Vec<SceneWire>,
    /// Its breakouts and waypoints, in the level's frame.
    #[serde(default)]
    pub nodes: Option<Vec<HarnessNodeInput>>,
}

/// A posed end with the occurrence it was posed on.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutedEnd {
    /// The end's §17.6 pose.
    #[serde(flatten)]
    pub pose: EndPose,
    /// The occurrence it was posed on.
    pub occurrence: String,
}

/// One curve with the segment's wire set and bundle.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RoutedCurve {
    /// The segment's id.
    pub segment_id: String,
    /// The curve itself.
    #[serde(flatten)]
    pub curve: Curve,
    /// The segment's start node.
    pub from: String,
    /// The segment's end node.
    pub to: String,
    /// The wires the segment carries.
    pub wires: Vec<String>,
    /// The segment's bundle diameter.
    pub diameter_mm: f64,
    /// Whether any gauge was assumed.
    pub assumed_gauge: bool,
}

/// A wire's two end ids.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RouteWire {
    /// The wire's id.
    pub id: String,
    /// The start end's id.
    pub from: String,
    /// The end end's id.
    pub to: String,
}

/// A routed harness in world mm.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Route {
    /// Posed ends by id.
    pub ends: BTreeMap<String, RoutedEnd>,
    /// The harness tree.
    pub tree: Topology,
    /// The curves in tree order.
    pub curves: Vec<RoutedCurve>,
    /// Waypoints no segment takes.
    pub unused: Vec<String>,
    /// Wires touching an end without a pose.
    pub unplaced: Vec<String>,
    /// Every wire's two end ids.
    pub wires: Vec<RouteWire>,
}

/// A rigid column-major world matrix (mm) as a pose. Ports
/// `harness_route.py:matrix_pose`.
pub fn matrix_pose(m: &Matrix) -> Pose {
    Pose {
        translation_mm: [m[12], m[13], m[14]],
        rotation: quaternion([m[0], m[1], m[2]], [m[4], m[5], m[6]], [m[8], m[9], m[10]]),
    }
}

/// A point through a column-major matrix. Ports `harness_route.py:transform`.
pub fn transform(m: &Matrix, p: [f64; 3]) -> [f64; 3] {
    [0usize, 1, 2].map(|k| m[k] * p[0] + m[4 + k] * p[1] + m[8 + k] * p[2] + m[12 + k])
}

/// The harness in world mm, or `None` with fewer than two posed ends. Ports
/// `harness_route.py:route`.
///
/// Returns the posed ends, the tree, the curves with their segments' wire sets,
/// the unused waypoints, the unplaced wires and every wire's two end ids.
pub fn route<F>(harness: &SceneHarness, world_matrix_of: F) -> Option<Route>
where
    F: Fn(&str) -> Option<Matrix>,
{
    let posed = posed_ends(harness, &world_matrix_of);
    if posed.len() < 2 {
        return None;
    }
    let ends: Vec<TopologyEnd> = posed
        .iter()
        .map(|(id, end)| TopologyEnd {
            id: id.clone(),
            leg_mm: end.pose.leg_mm,
            outward: end.pose.outward,
        })
        .collect();
    let wires: Vec<TopologyWire> = harness
        .wires
        .iter()
        .map(|wire| TopologyWire {
            id: wire.id.clone(),
            from: WireSide {
                end: wire.from.clone(),
            },
            to: WireSide {
                end: wire.to.clone(),
            },
            gauge_awg: wire.gauge_awg.clone(),
        })
        .collect();
    let nodes = level_nodes(harness, &world_matrix_of);
    let tree = topology(&ends, &wires, &breakouts(&nodes));
    let split = segment_waypoints(&tree, &nodes);
    let curve_ends: BTreeMap<String, CurveEnd> = posed
        .iter()
        .map(|(id, end)| {
            (
                id.clone(),
                CurveEnd {
                    exit_mm: end.pose.exit_mm,
                    outward: end.pose.outward,
                    leg_mm: end.pose.leg_mm,
                },
            )
        })
        .collect();
    let curves = routed_curves(
        harness_curves(&curve_ends, &tree, &split.waypoints, &split.pinned),
        &tree,
    );
    let unplaced = tree.unplaced.clone();
    let route_wires = harness
        .wires
        .iter()
        .map(|wire| RouteWire {
            id: wire.id.clone(),
            from: wire.from.clone(),
            to: wire.to.clone(),
        })
        .collect();
    Some(Route {
        ends: posed.into_iter().collect(),
        tree,
        curves,
        unused: split.unused,
        unplaced,
        wires: route_wires,
    })
}

/// The ends with a pose, in ordinal order.
fn posed_ends<F>(harness: &SceneHarness, world_matrix_of: &F) -> Vec<(String, RoutedEnd)>
where
    F: Fn(&str) -> Option<Matrix>,
{
    let mut sorted: Vec<&SceneHarnessEnd> = harness.ends.iter().collect();
    sorted.sort_by_key(|end| end.ordinal);
    let mut posed = Vec::new();
    for end in sorted {
        let Some(connector) = end.connector.as_ref() else {
            continue;
        };
        let Some(occurrence) = end
            .occurrence
            .as_deref()
            .filter(|occurrence| !occurrence.is_empty())
        else {
            continue;
        };
        let Some(matrix) = world_matrix_of(occurrence) else {
            continue;
        };
        let mut board = matrix_pose(&matrix);
        if let Some(in_occurrence) = connector.in_occurrence.as_ref() {
            board = compose(&board, in_occurrence);
        }
        if let Some(pose) = board_end(
            &board,
            connector.geometry.as_ref(),
            connector.thickness_mm,
            connector.stored.as_ref(),
            0,
            end.housing.as_ref(),
            None,
        ) {
            posed.push((
                end.id.clone(),
                RoutedEnd {
                    pose,
                    occurrence: occurrence.to_owned(),
                },
            ));
        }
    }
    posed
}

/// The nodes in world mm (empty when the level has no matrix).
fn level_nodes<F>(harness: &SceneHarness, world_matrix_of: &F) -> Vec<HarnessNodeInput>
where
    F: Fn(&str) -> Option<Matrix>,
{
    let level = match harness.level.as_deref().filter(|level| !level.is_empty()) {
        Some(level) => world_matrix_of(level),
        None => Some(IDENTITY),
    };
    let Some(level) = level else {
        return Vec::new();
    };
    let mut nodes = harness.nodes.clone().unwrap_or_default();
    for node in &mut nodes {
        node.position_mm = transform(&level, node.position_mm);
    }
    nodes
}

/// The curve results with their segment's wire set and bundle.
fn routed_curves(curves: Vec<SegmentCurve>, tree: &Topology) -> Vec<RoutedCurve> {
    let by_id: BTreeMap<&str, &HarnessSegment> = tree
        .segments
        .iter()
        .map(|segment| (segment.id.as_str(), segment))
        .collect();
    let mut out = Vec::new();
    for curve in curves {
        let Some(segment) = by_id.get(curve.segment_id.as_str()) else {
            continue;
        };
        out.push(RoutedCurve {
            segment_id: curve.segment_id,
            curve: curve.curve,
            from: segment.from.clone(),
            to: segment.to.clone(),
            wires: segment.wires.clone(),
            diameter_mm: segment.diameter_mm,
            assumed_gauge: segment.assumed_gauge,
        });
    }
    out
}
