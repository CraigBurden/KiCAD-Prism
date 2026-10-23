//! Testpoint callout placement: a readable label outside the pad.
//!
//! A testpoint's pad is about one millimetre across, so a designator fitted
//! inside it is unreadable. A callout view draws the label at the view's
//! minimum font instead, outside the pad, and joins the two with a leader
//! line. Placement is deterministic: eight directions, radii growing by
//! `0.6 mm` from the pad radius, the first candidate whose text box clears
//! every placed label, every selected pad and the canvas wins. When none is
//! free the first candidate is used and the placement is counted as
//! overlapping. Footprints are processed in designator natural order, so
//! `TP2` is placed before `TP10`.

use std::cmp::Ordering;
use std::collections::BTreeMap;

use super::super::BoardData;
use super::super::designator::text_box;
use super::super::geometry::{Bounds, Point};
use super::ViewSides;

/// The radius increment between candidate rings, in millimetres.
const RADIUS_STEP_MM: f64 = 0.6;
/// The largest ring index, six millimetres out.
const RADIUS_RINGS: usize = 10;
/// The eight candidate directions, in the order the spec names them.
const DIRECTIONS: [(f64, f64); 8] = [
    (1.0, 0.0),
    (FRAC, -FRAC),
    (0.0, -1.0),
    (-FRAC, -FRAC),
    (-1.0, 0.0),
    (-FRAC, FRAC),
    (0.0, 1.0),
    (FRAC, FRAC),
];
const FRAC: f64 = std::f64::consts::FRAC_1_SQRT_2;

/// Where one callout label and its leader go, in board millimetres.
#[derive(Clone, Debug)]
pub(super) struct CalloutPlacement {
    /// The text's centre.
    pub center: Point,
    /// The text box's extent, for the leader and the canvas.
    pub bounds: Bounds,
    /// The label box edge the leader starts at.
    pub leader_from: Point,
    /// The pad edge the leader ends at.
    pub leader_to: Point,
    /// The label's font size: the view's minimum font.
    pub font_size_mm: f64,
    /// True when no free candidate was found and the first was used anyway.
    pub overlapping: bool,
}

/// Place every callout label of one view, keyed by footprint index.
pub(super) fn plan(
    data: &BoardData,
    selected: &[usize],
    sides: ViewSides,
    font_size_mm: f64,
    canvas: Bounds,
    paper_scale: f64,
) -> BTreeMap<usize, CalloutPlacement> {
    let mut order: Vec<(String, usize)> = selected
        .iter()
        .copied()
        .filter(|index| sides.includes(data.footprints[*index].side))
        .filter_map(|index| {
            let footprint = &data.footprints[index];
            let reference = footprint.reference.clone()?;
            Some((reference, index))
        })
        .collect();
    order.sort_by(|left, right| natural_cmp(&left.0, &right.0).then_with(|| left.1.cmp(&right.1)));

    let pad_bounds: Vec<(usize, Bounds)> = order
        .iter()
        .filter_map(|(_, index)| {
            data.footprints[*index]
                .pads_bounds()
                .map(|bounds| (*index, bounds))
        })
        .collect();

    let mut placements: BTreeMap<usize, CalloutPlacement> = BTreeMap::new();
    for (reference, index) in &order {
        let Some((_, pad)) = pad_bounds.iter().find(|(owner, _)| owner == index) else {
            continue;
        };
        let corners = text_box(reference, Point { x: 0.0, y: 0.0 }, font_size_mm, 0.0);
        let half_width = corners[1].x.abs();
        let half_height = corners[2].y.abs();
        let placed: Vec<Bounds> = placements
            .values()
            .map(|placement| placement.bounds)
            .collect();
        let step = RADIUS_STEP_MM / paper_scale.max(f64::MIN_POSITIVE);
        let chosen = search(
            *pad,
            half_width,
            half_height,
            &Search {
                canvas,
                placed: &placed,
                pads: &pad_bounds,
                owner: *index,
                step,
            },
        );
        let overlapping = chosen.is_none();
        let (center, bounds, dx, dy) =
            chosen.unwrap_or_else(|| first_candidate(*pad, half_width, half_height, step));
        let pad_center = Point {
            x: (pad.min_x + pad.max_x) / 2.0,
            y: (pad.min_y + pad.max_y) / 2.0,
        };
        let pad_radius = pad.width().max(pad.height()) / 2.0;
        let edge = box_edge_distance(dx, dy, half_width, half_height);
        placements.insert(
            *index,
            CalloutPlacement {
                center,
                bounds,
                leader_from: Point {
                    x: center.x - dx * edge,
                    y: center.y - dy * edge,
                },
                leader_to: Point {
                    x: pad_center.x + dx * pad_radius,
                    y: pad_center.y + dy * pad_radius,
                },
                font_size_mm,
                overlapping,
            },
        );
    }
    placements
}

/// The candidate: label centre, its box, and the direction from the pad.
type Candidate = (Point, Bounds, f64, f64);

/// What a candidate has to clear: the canvas, already-placed labels and the
/// other selected pads, plus the radius gap between rings.
struct Search<'a> {
    canvas: Bounds,
    placed: &'a [Bounds],
    pads: &'a [(usize, Bounds)],
    owner: usize,
    step: f64,
}

/// The first free candidate, or `None` when every one is taken.
fn search(
    pad: Bounds,
    half_width: f64,
    half_height: f64,
    context: &Search<'_>,
) -> Option<Candidate> {
    let center = Point {
        x: (pad.min_x + pad.max_x) / 2.0,
        y: (pad.min_y + pad.max_y) / 2.0,
    };
    let radius = pad.width().max(pad.height()) / 2.0;
    for ring in 1..=RADIUS_RINGS {
        for (dx, dy) in DIRECTIONS {
            let support = dx.abs() * half_width + dy.abs() * half_height;
            let offset = radius + context.step * ring as f64 + support;
            let label = Point {
                x: center.x + dx * offset,
                y: center.y + dy * offset,
            };
            let bounds = Bounds::around(label, half_width, half_height);
            if !context.canvas.contains_bounds(bounds)
                || context.placed.iter().any(|other| other.intersects(bounds))
                || context
                    .pads
                    .iter()
                    .any(|(other, extent)| *other != context.owner && extent.intersects(bounds))
            {
                continue;
            }
            return Some((label, bounds, dx, dy));
        }
    }
    None
}

/// The first candidate direction at the nearest ring, used when none is free.
fn first_candidate(pad: Bounds, half_width: f64, half_height: f64, step: f64) -> Candidate {
    let center = Point {
        x: (pad.min_x + pad.max_x) / 2.0,
        y: (pad.min_y + pad.max_y) / 2.0,
    };
    let radius = pad.width().max(pad.height()) / 2.0;
    let (dx, dy) = DIRECTIONS[0];
    let support = dx.abs() * half_width + dy.abs() * half_height;
    let offset = radius + step + support;
    let label = Point {
        x: center.x + dx * offset,
        y: center.y + dy * offset,
    };
    (
        label,
        Bounds::around(label, half_width, half_height),
        dx,
        dy,
    )
}

/// How far the text box reaches from its centre along `direction`, so the
/// leader starts on the box edge rather than at the corner's support plane.
pub(super) fn box_edge_distance(dx: f64, dy: f64, half_width: f64, half_height: f64) -> f64 {
    let mut distance = f64::INFINITY;
    if dx.abs() > 1.0e-12 {
        distance = distance.min(half_width / dx.abs());
    }
    if dy.abs() > 1.0e-12 {
        distance = distance.min(half_height / dy.abs());
    }
    if distance.is_finite() { distance } else { 0.0 }
}

/// Compare two designators the way a person reads them: digit runs by value.
pub(super) fn natural_cmp(left: &str, right: &str) -> Ordering {
    let mut left = left.trim().chars().peekable();
    let mut right = right.trim().chars().peekable();
    loop {
        match (left.peek().copied(), right.peek().copied()) {
            (None, None) => return Ordering::Equal,
            (None, Some(_)) => return Ordering::Less,
            (Some(_), None) => return Ordering::Greater,
            (Some(a), Some(b)) if a.is_ascii_digit() && b.is_ascii_digit() => {
                let left_value: String = left.by_ref().take_while(char::is_ascii_digit).collect();
                let right_value: String = right.by_ref().take_while(char::is_ascii_digit).collect();
                let left_value: u128 = left_value.parse().unwrap_or(0);
                let right_value: u128 = right_value.parse().unwrap_or(0);
                match left_value.cmp(&right_value) {
                    Ordering::Equal => {}
                    other => return other,
                }
            }
            (Some(a), Some(b)) => {
                left.next();
                right.next();
                match a.cmp(&b) {
                    Ordering::Equal => {}
                    other => return other,
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_leader_starts_on_the_box_edge_for_a_diagonal_direction() {
        let distance = box_edge_distance(FRAC, -FRAC, 1.24, 0.5);
        assert!((distance - 0.5 / FRAC).abs() < 1.0e-9);
        assert!((distance * FRAC - 0.5).abs() < 1.0e-9);
    }

    #[test]
    fn natural_order_reads_digits_by_value() {
        let mut names = vec!["TP10", "TP2", "TP1", "TP100"];
        names.sort_by(|left, right| natural_cmp(left, right));
        assert_eq!(names, vec!["TP1", "TP2", "TP10", "TP100"]);
    }
}
