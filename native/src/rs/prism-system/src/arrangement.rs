//! Where each occurrence sits in the system (CONTRACTS §8.9, ADR §2.6).
//!
//! The document's mates are solved as a spanning tree per mated group
//! ([`crate::placement::solve`], with the second System Builder's rules): the
//! root keeps its stored pose or takes its slot in the default row, and every
//! other mated occurrence is placed through its positioning mate, with that
//! mate's orientation, stack height and offset. Free occurrences keep their
//! stored pose or take the default row. Mates that do not position anything
//! are checked against the placed boards.

use crate::context::Context;
use crate::input::{Document, PoseIn};
use crate::natural;
use crate::output::{
    BoundsOut, PlacedMateOut, PlacedOccurrenceOut, PlacementSceneOut, PoseOut, QuaternionOut,
    VectorNmOut,
};
use crate::placement::frames::{Confidence, MatingAxis, StoredFrame, connector_frame, infer};
use crate::placement::mate::{HeightSource, MateEnd, Orientation};
use crate::placement::poses::{
    Bounds, IDENTITY, PlacedPose, Pose, PoseSource, canonical_rotation, compose,
};
use crate::placement::solve::{
    IgnoredReason, Mismatch, SolveEnd, SolveMate, SolveResult, SolveRules, solve,
};
use std::collections::{BTreeMap, BTreeSet};

const NM_PER_MM: f64 = 1_000_000.0;

fn mm(nm: i64) -> f64 {
    nm as f64 / NM_PER_MM
}

fn nm(mm: f64) -> i64 {
    (mm * NM_PER_MM).round() as i64
}

fn pose_in(pose: &PoseIn) -> Pose {
    Pose {
        translation_mm: [
            mm(pose.translation.x_nm),
            mm(pose.translation.y_nm),
            mm(pose.translation.z_nm),
        ],
        rotation: canonical_rotation([
            pose.rotation.x,
            pose.rotation.y,
            pose.rotation.z,
            pose.rotation.w,
        ]),
    }
}

fn vector_out(v: [f64; 3]) -> VectorNmOut {
    VectorNmOut {
        x_nm: nm(v[0]),
        y_nm: nm(v[1]),
        z_nm: nm(v[2]),
    }
}

fn pose_out(pose: &Pose) -> PoseOut {
    let [x, y, z, w] = canonical_rotation(pose.rotation);
    PoseOut {
        translation: vector_out(pose.translation_mm),
        rotation: QuaternionOut { x, y, z, w },
    }
}

/// A ready board's outline box across its thickness, in its own frame.
fn board_bounds(cx: &Context<'_>, occurrence: &str) -> Option<Bounds> {
    // A body's box is its part's model box (§8.10).
    if let Some(body) = cx.members.bodies.get(occurrence) {
        return body.bounds;
    }
    let board = cx.board(occurrence)?;
    let outline = board.interface.board_outline_mm.as_ref()?;
    let half = board.interface.board_thickness_mm.unwrap_or(1.6) / 2.0;
    Some(Bounds {
        min_mm: [outline.min_mm[0], outline.min_mm[1], -half],
        max_mm: [outline.max_mm[0], outline.max_mm[1], half],
    })
}

/// One end of a mate, when its connector's frame can be inferred well enough to place by.
/// A body connector's footprint sits in the body at its mount, and an unsure
/// inference mates out of its top face, as the mount assumed (§8.10).
fn solve_end(cx: &Context<'_>, occurrence: &str, connector: &str) -> Option<SolveEnd> {
    let board = cx.board(occurrence)?;
    let geometry = board.component(connector)?.geometry.clone()?;
    let mount = cx
        .members
        .bodies
        .get(occurrence)
        .and_then(|body| body.mounts.get(connector))
        .copied();
    let unsure = infer(Some(&geometry)).confidence == Confidence::Low;
    if geometry.pads.is_empty() || (unsure && mount.is_none()) {
        return None;
    }
    Some(SolveEnd {
        member: occurrence.to_owned(),
        reference: Some(connector.to_owned()),
        end: MateEnd {
            geometry,
            thickness_mm: board.interface.board_thickness_mm,
            stored: unsure.then_some(StoredFrame {
                axis: MatingAxis::Top,
                quarter_turns: None,
            }),
            body_mm: None,
        },
        in_member: mount,
    })
}

/// A connector's frame in the system frame.
fn world_frame(placed: &Pose, end: &SolveEnd) -> Option<PoseOut> {
    let frame = connector_frame(
        Some(&end.end.geometry),
        end.end.thickness_mm,
        end.end.stored.as_ref(),
    )?;
    let in_member = compose(placed, end.in_member.as_ref().unwrap_or(&IDENTITY));
    Some(pose_out(&compose(
        &in_member,
        &Pose {
            translation_mm: frame.origin_mm,
            rotation: frame.rotation,
        },
    )))
}

/// The solve's inputs, in item order.
struct SolveInputs {
    items: Vec<(String, Option<Bounds>)>,
    stored: BTreeMap<String, PlacedPose>,
    connections: Vec<(String, String)>,
    mates: Vec<SolveMate>,
    overrides: BTreeMap<String, String>,
}

/// Build the solve's items, stored poses, connections, mates and overrides.
fn solve_inputs(cx: &Context<'_>, doc: &Document) -> SolveInputs {
    let mut ordered: Vec<&crate::input::Occurrence> = doc.occurrences.iter().collect();
    ordered.sort_by(|a, b| natural::cmp(&a.label, &b.label).then_with(|| a.id.cmp(&b.id)));
    let items: Vec<(String, Option<Bounds>)> = ordered
        .iter()
        .map(|occurrence| (occurrence.id.clone(), board_bounds(cx, &occurrence.id)))
        .collect();
    let stored: BTreeMap<String, PlacedPose> = doc
        .occurrences
        .iter()
        .filter_map(|occurrence| {
            occurrence.pose.as_ref().map(|pose| {
                (
                    occurrence.id.clone(),
                    PlacedPose {
                        pose: pose_in(pose),
                        source: PoseSource::Manual,
                    },
                )
            })
        })
        .collect();
    let mut connections: Vec<(String, String)> = doc
        .mates
        .iter()
        .map(|mate| (mate.a.occurrence.clone(), mate.b.occurrence.clone()))
        .collect();
    for harness in &doc.harnesses {
        for link in &harness.links {
            connections.push((link.a.occurrence.clone(), link.b.occurrence.clone()));
        }
    }
    let mates: Vec<SolveMate> = doc
        .mates
        .iter()
        .filter_map(|mate| {
            let a = solve_end(cx, &mate.a.occurrence, &mate.a.connector)?;
            let b = solve_end(cx, &mate.b.occurrence, &mate.b.connector)?;
            Some(SolveMate {
                link_id: mate.id.clone(),
                rows: None,
                stack_height_mm: mate.stack_height_nm.map(mm),
                a,
                b,
                orientation: Orientation {
                    quarter_turns: mate.orientation.quarter_turns,
                    flip: mate.orientation.flip,
                    offset: mate.offset.as_ref().map(pose_in),
                },
            })
        })
        .collect();
    let overrides: BTreeMap<String, String> = doc
        .occurrences
        .iter()
        .filter_map(|occurrence| {
            occurrence
                .positioning_mate
                .as_ref()
                .map(|mate| (occurrence.id.clone(), mate.clone()))
        })
        .collect();
    SolveInputs {
        items,
        stored,
        connections,
        mates,
        overrides,
    }
}

/// Report stored poses that a driving mate ignores.
fn add_pose_findings(
    cx: &mut Context<'_>,
    doc: &Document,
    stored: &BTreeMap<String, PlacedPose>,
    solved: &SolveResult,
) {
    for (occurrence, driving) in &solved.driving {
        if !stored.contains_key(occurrence) {
            continue;
        }
        let label = doc
            .occurrences
            .iter()
            .find(|item| &item.id == occurrence)
            .map_or(occurrence.as_str(), |item| item.label.as_str());
        cx.findings.add(
            "pose-ignored",
            format!("occurrence:{occurrence}"),
            format!(
                "{label} is placed by mate {}; its stored pose is ignored",
                driving.link_id
            ),
            &[occurrence.as_str(), driving.link_id.as_str()],
        );
    }
}

/// Report the positioning overrides the solve did not use.
fn add_ignored_findings(cx: &mut Context<'_>, solved: &SolveResult) {
    for ignored in &solved.ignored_overrides {
        let why = match ignored.reason {
            IgnoredReason::NotAUsableMate => "is not a mate of this occurrence that can place it",
            IgnoredReason::Root => "would place its group's root",
            IgnoredReason::Unreachable => "is only reachable through the occurrence itself",
        };
        cx.findings.add(
            "positioning-mate-ignored",
            format!("occurrence:{}", ignored.member),
            format!(
                "The positioning mate {} {why}; the automatic choice is used",
                ignored.link_id
            ),
            &[ignored.member.as_str(), ignored.link_id.as_str()],
        );
    }
}

/// Report the mates that miss, returning them by mate id.
fn add_mismatch_findings<'a>(
    cx: &mut Context<'_>,
    doc: &Document,
    solved: &'a SolveResult,
) -> BTreeMap<String, &'a Mismatch> {
    let mut misses = BTreeMap::new();
    for mismatch in &solved.mismatches {
        let mate = doc.mates.iter().find(|item| item.id == mismatch.link_id);
        let name = mate.map_or(mismatch.link_id.clone(), |mate| {
            format!("{} ↔ {}", mate.a.connector, mate.b.connector)
        });
        cx.findings.add(
            "mate-misaligned",
            format!("mate:{}", mismatch.link_id),
            format!(
                "{name} misses by {:.2} mm across, {:.2} mm along, {:.1}°",
                mismatch.lateral_mm,
                mismatch.axial_mm.abs(),
                mismatch.angle_deg
            ),
            &[mismatch.link_id.as_str()],
        );
        misses.insert(mismatch.link_id.clone(), mismatch);
    }
    misses
}

/// Add the placement findings (§9), returning the misses by mate id.
fn add_findings<'a>(
    cx: &mut Context<'_>,
    doc: &Document,
    stored: &BTreeMap<String, PlacedPose>,
    solved: &'a SolveResult,
) -> BTreeMap<String, &'a Mismatch> {
    add_pose_findings(cx, doc, stored, solved);
    add_ignored_findings(cx, solved);
    add_mismatch_findings(cx, doc, solved)
}

/// The placed occurrences, sorted by id.
fn placed_occurrences(
    doc: &Document,
    items: &[(String, Option<Bounds>)],
    solved: &SolveResult,
) -> Vec<PlacedOccurrenceOut> {
    let roots: BTreeSet<&str> = solved.roots.iter().map(String::as_str).collect();
    let mut occurrences: Vec<PlacedOccurrenceOut> = doc
        .occurrences
        .iter()
        .filter_map(|occurrence| {
            let placed = solved.poses.get(&occurrence.id)?;
            let driving = solved.driving.get(&occurrence.id);
            Some(PlacedOccurrenceOut {
                occurrence: occurrence.id.clone(),
                pose: pose_out(&placed.pose),
                source: match placed.source {
                    PoseSource::Auto => "mate",
                    PoseSource::Manual => "stored",
                    PoseSource::Default => "default",
                },
                root: driving.is_none() || roots.contains(occurrence.id.as_str()),
                positioning_mate: driving.map(|entry| entry.link_id.clone()),
                bounds: items
                    .iter()
                    .find(|(id, _)| id == &occurrence.id)
                    .and_then(|(_, bounds)| *bounds)
                    .map(|bounds| BoundsOut {
                        min: vector_out(bounds.min_mm),
                        max: vector_out(bounds.max_mm),
                    }),
            })
        })
        .collect();
    occurrences.sort_by(|a, b| a.occurrence.cmp(&b.occurrence));
    occurrences
}

/// The placed mates, sorted by id.
fn placed_mates(
    doc: &Document,
    mates: &[SolveMate],
    solved: &SolveResult,
    misses: &BTreeMap<String, &Mismatch>,
) -> Vec<PlacedMateOut> {
    let driving_links: BTreeSet<&str> = solved
        .driving
        .values()
        .map(|entry| entry.link_id.as_str())
        .collect();
    let mut placed_mates: Vec<PlacedMateOut> = doc
        .mates
        .iter()
        .map(|mate| {
            let solved_mate = mates.iter().find(|item| item.link_id == mate.id);
            let result = solved.results.get(&mate.id);
            let frame = |end: Option<&SolveEnd>| {
                let end = end?;
                world_frame(&solved.poses.get(&end.member)?.pose, end)
            };
            let miss = misses.get(&mate.id);
            PlacedMateOut {
                mate: mate.id.clone(),
                driving: driving_links.contains(mate.id.as_str()),
                stack_height_nm: result.map(|result| nm(result.stack_height_mm)),
                height_source: result.map(|result| match result.height_source {
                    HeightSource::Link => "stack-height",
                    HeightSource::Clearance => "clearance",
                }),
                frame_a: frame(solved_mate.map(|item| &item.a)),
                frame_b: frame(solved_mate.map(|item| &item.b)),
                miss: miss.map(|miss| vector_out(miss.offset_mm)),
                miss_deg: miss.map(|miss| miss.angle_deg),
            }
        })
        .collect();
    placed_mates.sort_by(|a, b| a.mate.cmp(&b.mate));
    placed_mates
}

/// Place every occurrence; adds the placement findings (§9).
pub fn arrange(cx: &mut Context<'_>, doc: &Document) -> PlacementSceneOut {
    let inputs = solve_inputs(cx, doc);
    let solved = solve(
        &inputs.items,
        &inputs.stored,
        &inputs.connections,
        &inputs.mates,
        &inputs.overrides,
        SolveRules::V2,
    );
    let misses = add_findings(cx, doc, &inputs.stored, &solved);
    PlacementSceneOut {
        occurrences: placed_occurrences(doc, &inputs.items, &solved),
        mates: placed_mates(doc, &inputs.mates, &solved, &misses),
    }
}
