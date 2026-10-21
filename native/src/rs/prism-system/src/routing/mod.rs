//! Harness routes in 3D (stage 4c, CONTRACTS §16.6): each end's housing posed
//! on its connector, the route tree, a curve per segment through its
//! waypoints, wire lengths, and the bend and clearance checks. The maths is
//! the ported v1 harness maths in [`crate::placement`]; this module feeds it
//! the v2 document and writes the bundle's `route`.

mod tree;

use std::collections::{BTreeMap, BTreeSet};

use crate::arrangement::{Arranged, harness_end_pose};
use crate::context::Context;
use crate::input::{Document, Harness};
use crate::output::{
    ClearanceOut, HarnessOut, HarnessRouteOut, RouteEndOut, RouteSegmentOut, RouteWireOut,
    TightBendOut, UnitVectorOut, VectorNmOut,
};
use crate::placement::harness_checks::{Board, collisions};
use crate::placement::harness_curves::{CurveEnd, harness_curves};
use crate::placement::harness_ends::EndPose;
use crate::placement::harness_route::{Route, RoutedCurve, RoutedEnd};
use crate::placement::harness_spec::{
    BOARD_COLLISION_MARGIN_MM, LENGTH_ALLOWANCE, LENGTH_MISMATCH_TOLERANCE,
};
use crate::placement::harness_topology::TopologyEnd;
use crate::placement::poses::matrix;

/// Waypoints per segment id, in order.
type SegmentPoints = BTreeMap<String, Vec<[f64; 3]>>;

fn nm(mm: f64) -> i64 {
    (mm * 1e6).round() as i64
}

fn vector(p: [f64; 3]) -> VectorNmOut {
    VectorNmOut {
        x_nm: nm(p[0]),
        y_nm: nm(p[1]),
        z_nm: nm(p[2]),
    }
}

/// Route every harness with two or more posed ends; adds the §16.6 findings.
pub fn route_all(
    cx: &mut Context<'_>,
    doc: &Document,
    arranged: &Arranged,
    harnesses: &mut [HarnessOut],
) {
    for out in harnesses.iter_mut() {
        let Some(harness) = doc.harnesses.iter().find(|item| item.id == out.harness) else {
            continue;
        };
        out.route = route_one(cx, harness, arranged, out);
    }
}

/// The posed ends, in document order; findings for the ones that cannot be.
fn posed_ends(
    cx: &mut Context<'_>,
    harness: &Harness,
    arranged: &Arranged,
) -> Vec<(String, RoutedEnd)> {
    let mut posed = Vec::new();
    for end in &harness.ends {
        let Some(site) = &end.site else { continue };
        let boot_mm = end.boot_length_nm.map(|length| length as f64 / 1e6);
        match harness_end_pose(cx, arranged, &site.occurrence, &site.connector, boot_mm) {
            Some(pose) => posed.push((
                end.id.clone(),
                RoutedEnd {
                    pose,
                    occurrence: site.occurrence.clone(),
                },
            )),
            None => cx.findings.add(
                "harness-end-unplaced",
                format!("end:{}/{}", harness.id, end.id),
                format!(
                    "{}: {} has no place in 3D yet, so its wires are not routed",
                    harness.label, site.connector
                ),
                &[&harness.id, &end.id],
            ),
        }
    }
    posed
}

fn route_one(
    cx: &mut Context<'_>,
    harness: &Harness,
    arranged: &Arranged,
    out: &mut HarnessOut,
) -> Option<HarnessRouteOut> {
    let posed = posed_ends(cx, harness, arranged);
    if posed.len() < 2 {
        return None;
    }
    let topology_ends: Vec<TopologyEnd> = posed
        .iter()
        .map(|(id, end)| TopologyEnd {
            id: id.clone(),
            leg_mm: end.pose.leg_mm,
            outward: end.pose.outward,
        })
        .collect();
    let wire_ends = tree::wire_ends(&out.wires);
    let tree = tree::build(harness, &topology_ends, &wire_ends);
    if tree.invalid {
        cx.findings.add(
            "harness-topology-invalid",
            format!("harness:{}", harness.id),
            format!("{}: the stored segments do not join every placed end as one tree; the derived route is drawn", harness.label),
            &[&harness.id],
        );
    }
    let edges_of = tree::wire_edges(&tree, harness, &wire_ends);
    let segments = tree::segments(&tree, &out.wires, &edges_of);
    let topology = tree::topology_of(&tree, segments);
    let (waypoints, pinned) = waypoints(cx, harness, &tree);
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
    let curves = harness_curves(&curve_ends, &topology, &waypoints, &pinned);
    let routed = Route {
        ends: posed.iter().cloned().collect(),
        curves: curves
            .into_iter()
            .zip(&topology.segments)
            .map(|(curve, segment)| RoutedCurve {
                segment_id: curve.segment_id,
                curve: curve.curve,
                from: segment.from.clone(),
                to: segment.to.clone(),
                wires: segment.wires.clone(),
                diameter_mm: segment.diameter_mm,
                assumed_gauge: segment.assumed_gauge,
            })
            .collect(),
        tree: topology,
        unused: Vec::new(),
        unplaced: Vec::new(),
        wires: Vec::new(),
    };
    let clearances = check(cx, harness, arranged, &routed);
    let lengths = lengths(cx, harness, &routed, &edges_of, &wire_ends, out);
    Some(HarnessRouteOut {
        derived: tree.derived,
        ends: posed
            .iter()
            .map(|(id, end)| end_out(id, &end.pose))
            .collect(),
        segments: routed
            .curves
            .iter()
            .map(|curve| {
                let near = clearances
                    .get(&curve.segment_id)
                    .cloned()
                    .unwrap_or_default();
                segment_out(curve, tree.derived, near)
            })
            .collect(),
        wires: lengths,
    })
}

/// The stored tree's waypoints per segment, by `order`; findings for those off the tree.
fn waypoints(
    cx: &mut Context<'_>,
    harness: &Harness,
    tree: &tree::Tree,
) -> (SegmentPoints, BTreeMap<String, Vec<bool>>) {
    let drawn: BTreeSet<&str> = if tree.derived {
        BTreeSet::new()
    } else {
        tree.edges.iter().map(|(id, _, _)| id.as_str()).collect()
    };
    let mut ordered: Vec<&crate::input::Waypoint> = harness.waypoints.iter().collect();
    ordered.sort_by(|a, b| a.order.cmp(&b.order).then_with(|| a.id.cmp(&b.id)));
    let mut points: SegmentPoints = BTreeMap::new();
    let mut pinned: BTreeMap<String, Vec<bool>> = BTreeMap::new();
    for waypoint in ordered {
        if !drawn.contains(waypoint.segment.as_str()) {
            cx.findings.add(
                "harness-waypoint-unused",
                format!("waypoint:{}/{}", harness.id, waypoint.id),
                format!(
                    "{}: a waypoint's segment is not in the drawn route",
                    harness.label
                ),
                &[&harness.id, &waypoint.id],
            );
            continue;
        }
        let at = &waypoint.position;
        points
            .entry(waypoint.segment.clone())
            .or_default()
            .push([at.x_nm, at.y_nm, at.z_nm].map(|v| v as f64 / 1e6));
        // Stored waypoints are pinned: relaxation never moves them (§16.6).
        pinned
            .entry(waypoint.segment.clone())
            .or_default()
            .push(true);
    }
    (points, pinned)
}

/// Tight bends and clearance to boards and bodies; the clearance hits per segment.
fn check(
    cx: &mut Context<'_>,
    harness: &Harness,
    arranged: &Arranged,
    routed: &Route,
) -> BTreeMap<String, Vec<ClearanceOut>> {
    for curve in &routed.curves {
        if let Some(bend) = &curve.curve.tight_bend {
            cx.findings.add(
                "harness-bend-tight",
                format!("segment:{}/{}", harness.id, curve.segment_id),
                format!(
                    "{}: a bend of radius {:.1} mm, tighter than the {:.1} mm its {:.2} mm bundle allows",
                    harness.label, bend.radius_mm, curve.curve.min_radius_allowed_mm, curve.diameter_mm
                ),
                &[&harness.id],
            );
        }
    }
    let boards: Vec<Board> = arranged
        .poses
        .iter()
        .filter_map(|(id, pose)| {
            let bounds = arranged.bounds.get(id)?;
            Some(Board {
                id: id.clone(),
                matrix: matrix(pose),
                min_mm: bounds.min_mm,
                max_mm: bounds.max_mm,
            })
        })
        .collect();
    let mut out: BTreeMap<String, Vec<ClearanceOut>> = BTreeMap::new();
    for hit in collisions(routed, &boards) {
        let label = arranged
            .labels
            .get(&hit.board)
            .cloned()
            .unwrap_or_else(|| hit.board.clone());
        cx.findings.add(
            "harness-clearance",
            format!("segment:{}/{}/{}", harness.id, hit.segment_id, hit.board),
            format!(
                "{}: the bundle passes {:.1} mm from {label}; it needs {:.1} mm",
                harness.label,
                (hit.distance_mm - BOARD_COLLISION_MARGIN_MM).max(0.0),
                hit.radius_mm + BOARD_COLLISION_MARGIN_MM
            ),
            &[&harness.id, &hit.board],
        );
        out.entry(hit.segment_id.clone())
            .or_default()
            .push(ClearanceOut {
                occurrence: hit.board.clone(),
                at: vector(hit.at_mm),
                distance_nm: nm((hit.distance_mm - BOARD_COLLISION_MARGIN_MM).max(0.0)),
                needed_nm: nm(hit.radius_mm + BOARD_COLLISION_MARGIN_MM),
            });
    }
    out
}

/// Each wire's route length; writes `routeLengthNm` on the wire list.
fn lengths(
    cx: &mut Context<'_>,
    harness: &Harness,
    routed: &Route,
    edges_of: &BTreeMap<String, BTreeSet<usize>>,
    wire_ends: &[tree::WireEnds],
    out: &mut HarnessOut,
) -> Vec<RouteWireOut> {
    let mut unrouted = 0;
    let mut result = Vec::new();
    for (wire, ends) in out.wires.iter_mut().zip(wire_ends) {
        let posed = ends.ends.iter().all(|end| routed.ends.contains_key(end));
        let length = (ends.direct && posed && ends.ends.len() == 2)
            .then(|| edges_of.get(&wire.id))
            .flatten()
            .map(|edges| {
                let arc: f64 = edges
                    .iter()
                    .map(|&i| routed.curves[i].curve.length_mm)
                    .sum();
                let depth: f64 = ends
                    .ends
                    .iter()
                    .map(|end| routed.ends[end].pose.depth_mm)
                    .sum();
                nm((arc + depth) * (1.0 + LENGTH_ALLOWANCE))
            });
        if length.is_none() {
            unrouted += 1;
        }
        wire.route_length_nm = length;
        if let (Some(route), Some(typed)) = (length, typed_length(harness, &wire.id)) {
            let ratio = (typed as f64 - route as f64).abs() / route as f64;
            if ratio > LENGTH_MISMATCH_TOLERANCE {
                cx.findings.add(
                    "wire-length-mismatch",
                    format!("wire:{}", wire.id),
                    format!(
                        "{}: wire {} is set to {:.0} mm but its route needs {:.0} mm",
                        harness.label,
                        wire.label.as_deref().unwrap_or(&wire.id),
                        typed as f64 / 1e6,
                        route as f64 / 1e6
                    ),
                    &[&harness.id, &wire.id],
                );
            }
        }
        result.push(RouteWireOut {
            wire: wire.id.clone(),
            length_nm: length,
        });
    }
    if unrouted > 0 {
        let noun = if unrouted == 1 {
            "wire has"
        } else {
            "wires have"
        };
        cx.findings.add(
            "wire-length-unrouted",
            format!("harness:{}", harness.id),
            format!(
                "{}: {unrouted} {noun} no route length (a splice, loose end or unplaced end)",
                harness.label
            ),
            &[&harness.id],
        );
    }
    result
}

fn typed_length(harness: &Harness, wire: &str) -> Option<i64> {
    harness.wires.iter().find(|item| item.id == wire)?.length_nm
}

fn end_out(id: &str, pose: &EndPose) -> RouteEndOut {
    RouteEndOut {
        end: id.to_owned(),
        exit: vector(pose.exit_mm),
        outward: UnitVectorOut {
            x: pose.outward[0],
            y: pose.outward[1],
            z: pose.outward[2],
        },
        leg: vector(pose.leg_mm),
    }
}

fn segment_out(
    curve: &RoutedCurve,
    derived: bool,
    clearances: Vec<ClearanceOut>,
) -> RouteSegmentOut {
    RouteSegmentOut {
        id: curve.segment_id.clone(),
        derived,
        from: curve.from.clone(),
        to: curve.to.clone(),
        wires: curve.wires.clone(),
        diameter_nm: nm(curve.diameter_mm),
        assumed_gauge: curve.assumed_gauge,
        samples_nm: curve
            .curve
            .samples_mm
            .iter()
            .flat_map(|p| p.map(nm))
            .collect(),
        length_nm: nm(curve.curve.length_mm),
        min_radius_nm: curve.curve.min_radius_mm.map(nm),
        min_radius_allowed_nm: nm(curve.curve.min_radius_allowed_mm),
        tight_bend: curve.curve.tight_bend.as_ref().map(|bend| TightBendOut {
            at: vector(bend.at_mm),
            radius_nm: nm(bend.radius_mm),
        }),
        clearances,
    }
}
