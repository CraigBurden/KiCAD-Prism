//! Covering parts: a body outline that hides other parts is drawn as a dashed
//! outline on top instead of its full hidden-line body, and its designator goes
//! just outside the body instead of inside it.
//!
//! Coverage is decided per side, among the view's selected footprints. A part
//! covers another when its HLR outline region overlaps at least half of the
//! other's body region and is the larger of the two. A centre-in-outline test
//! is not used: an L-shaped heatsink's bounding-box centre falls inside the
//! chip it sits on, which would make the chip "cover" the heatsink. Only a
//! real HLR outline can cover: a pad or hole envelope does not stand in for a
//! body. Footprints are visited in the
//! `selected` order and the result is a `BTreeSet`, so rendering is independent
//! of hash ordering.

use std::collections::{BTreeMap, BTreeSet};

use geo::{Area, BooleanOps, BoundingRect, Coord, Intersects, MultiPolygon, Polygon, Rect};
use prism_kicad_contracts::generated::prism_artwork_config_a0::{ArtworkConfigA0, ArtworkStyles};

use super::super::designator::{region_from_rings, text_box};
use super::super::geometry::{self, Bounds, Point};
use super::super::{BoardData, FootSide, FootprintInfo};
use super::designators::{DESIGNATOR_CLEARANCE_MM, designator_style};

/// The dashed outline's dash length, in paper millimetres.
pub(super) const DASH_MM: f64 = 1.2;
/// The dashed outline's gap length, in paper millimetres.
pub(super) const GAP_MM: f64 = 0.8;

/// A covering footprint's planned designator: its centre, text box and font,
/// all in the board frame (the view mirrors them when it draws).
pub(super) struct CoveringLabel {
    pub center: Point,
    pub bounds: Bounds,
    pub font_size_mm: f64,
}

/// The selected footprints that cover at least one other selected footprint on
/// the same side, in footprint-index order.
pub(super) fn covering_parts(
    data: &BoardData,
    selected: &[usize],
    callout: bool,
) -> BTreeSet<usize> {
    let mut sides: [Vec<Part>; 2] = [Vec::new(), Vec::new()];
    for &index in selected {
        let footprint = &data.footprints[index];
        let outline = outline_region(footprint, data);
        let bounds = outline.as_ref().and_then(MultiPolygon::bounding_rect);
        let body = body_region(footprint, data, callout);
        let part = Part {
            index,
            outline,
            bounds,
            body,
        };
        sides[match footprint.side {
            FootSide::Top => 0,
            FootSide::Bottom => 1,
        }]
        .push(part);
    }

    let mut covering = BTreeSet::new();
    for parts in &sides {
        for part in parts {
            let (Some(outline), Some(bounds)) = (&part.outline, part.bounds) else {
                continue;
            };
            for other in parts {
                if part.index == other.index {
                    continue;
                }
                let Some(body) = &other.body else {
                    continue;
                };
                let Some(other_bounds) = body.bounding_rect() else {
                    continue;
                };
                if covers(outline, bounds, body, &other_bounds) {
                    covering.insert(part.index);
                    break;
                }
            }
        }
    }
    covering
}

/// One selected footprint's candidate regions.
struct Part {
    index: usize,
    /// The HLR outline region: the only region that may cover.
    outline: Option<MultiPolygon<f64>>,
    /// The outline's extent, to skip disjoint pairs cheaply.
    bounds: Option<Rect<f64>>,
    /// The body region the part would cover, of any kind.
    body: Option<MultiPolygon<f64>>,
}

fn covers(
    outline: &MultiPolygon<f64>,
    bounds: Rect<f64>,
    body: &MultiPolygon<f64>,
    body_bounds: &Rect<f64>,
) -> bool {
    if !rectangles_overlap(bounds, *body_bounds) {
        return false;
    }
    let body_area = body.unsigned_area();
    body_area > 0.0
        && outline.unsigned_area() > body_area
        && outline.intersection(body).unsigned_area() >= body_area * 0.5
}

fn rectangles_overlap(left: Rect<f64>, right: Rect<f64>) -> bool {
    left.min().x <= right.max().x
        && right.min().x <= left.max().x
        && left.min().y <= right.max().y
        && right.min().y <= left.max().y
}

/// The part's body region excluding its detail edges: the HLR outline, else the
/// pad/hole envelope (or, in a callout view, the real pads).
fn body_region(
    footprint: &FootprintInfo,
    data: &BoardData,
    callout: bool,
) -> Option<MultiPolygon<f64>> {
    let rings = super::body_rings(footprint, data, callout)?;
    region_from_rings(&rings)
}

/// The HLR outline region only: `None` when the part has no projected outline.
fn outline_region(footprint: &FootprintInfo, data: &BoardData) -> Option<MultiPolygon<f64>> {
    let body = &data.hlr[footprint.hlr?];
    let rings = geometry::hlr_region(body.outline.as_ref()?)?;
    region_from_rings(&rings)
}

/// What a covering label must stay clear of: the view's selected footprints,
/// whether it is a callout view, the provisional canvas and the paper scale.
#[derive(Clone, Copy)]
pub(super) struct LabelScene<'a> {
    pub selected: &'a [usize],
    pub callout: bool,
    pub canvas: Bounds,
    pub paper_scale: f64,
}

/// Plan every covering part's designator just outside its outline, where it
/// collides with no other body, no other planned label and stays on the canvas.
///
/// Candidates hug the outline: beside every stretch of its exterior, offset
/// outward by the clearance, and around its bounding box. The choice is the
/// fewest collisions, then a spot on the canvas, then the highest, then the
/// nearest the body's centre line, so the result does not depend on ring
/// orientation. A label may leave the provisional canvas when nothing on it is
/// free: the canvas then grows to hold it. When every candidate collides, the
/// one with the fewest collisions is used rather than dropping the label.
pub(super) fn plan_labels(
    config: &ArtworkConfigA0,
    styles: &ArtworkStyles,
    data: &BoardData,
    scene: &LabelScene<'_>,
    covering: &BTreeSet<usize>,
) -> BTreeMap<usize, CoveringLabel> {
    let LabelScene {
        selected,
        callout,
        canvas,
        paper_scale,
    } = *scene;
    let clearance = DESIGNATOR_CLEARANCE_MM / paper_scale.max(f64::MIN_POSITIVE);
    let mut labels = BTreeMap::new();
    let mut placed: Vec<Bounds> = Vec::new();
    for &index in covering {
        let footprint = &data.footprints[index];
        let Some(designator) = footprint.reference.as_deref() else {
            continue;
        };
        let Some(region) = outline_region(footprint, data) else {
            continue;
        };
        let component = designator_style(config, styles, Some(designator));
        if !component.enabled {
            continue;
        }
        let font_size = component.max_font;
        let corners = text_box(designator, Point { x: 0.0, y: 0.0 }, font_size, 0.0);
        let half_width = corners[1].x.abs();
        let half_height = corners[2].y.abs();
        let obstacles: Vec<MultiPolygon<f64>> = selected
            .iter()
            .filter(|other| **other != index)
            .map(|other| &data.footprints[*other])
            .filter(|other| other.side == footprint.side)
            .filter_map(|other| body_region(other, data, callout))
            .collect();
        let candidates = label_candidates(&region, half_width, half_height, clearance);
        let middle_x = region
            .bounding_rect()
            .map_or(0.0, |bounds| (bounds.min().x + bounds.max().x) / 2.0);
        // Fewest collisions, then on the canvas, then highest, then nearest the
        // body's centre line: a free spot above the middle when there is one.
        let mut best: Option<((usize, bool, f64, f64), Point)> = None;
        for center in candidates {
            let bounds = Bounds::around(center, half_width, half_height);
            let rect = rect_polygon(bounds);
            if region.intersects(&rect) {
                continue;
            }
            let collisions = obstacles
                .iter()
                .filter(|body| body.intersects(&rect))
                .count()
                + placed
                    .iter()
                    .filter(|label| label.intersects(bounds))
                    .count();
            let key = (
                collisions,
                !canvas.contains_bounds(bounds),
                center.y,
                (center.x - middle_x).abs(),
            );
            let better = best.as_ref().is_none_or(|(current, _)| {
                key.0
                    .cmp(&current.0)
                    .then(key.1.cmp(&current.1))
                    .then(key.2.total_cmp(&current.2))
                    .then(key.3.total_cmp(&current.3))
                    .is_lt()
            });
            if better {
                best = Some((key, center));
            }
        }
        let Some((_, center)) = best else {
            continue;
        };
        let bounds = Bounds::around(center, half_width, half_height);
        placed.push(bounds);
        labels.insert(
            index,
            CoveringLabel {
                center,
                bounds,
                font_size_mm: font_size,
            },
        );
    }
    labels
}

/// Label centres just outside `region`: beside every exterior edge (sampled
/// along long edges) and above, below, left and right of its bounding box.
fn label_candidates(
    region: &MultiPolygon<f64>,
    half_width: f64,
    half_height: f64,
    clearance: f64,
) -> Vec<Point> {
    let mut candidates = Vec::new();
    let step = (half_width / 2.0).max(0.25);
    for polygon in &region.0 {
        let ring: Vec<Coord<f64>> = polygon.exterior().coords().copied().collect();
        for pair in ring.windows(2) {
            let (a, b) = (pair[0], pair[1]);
            let (dx, dy) = (b.x - a.x, b.y - a.y);
            let length = dx.hypot(dy);
            if length < 1e-9 {
                continue;
            }
            let normal = (dy / length, -dx / length);
            let samples = (length / step).floor().max(0.0) as usize;
            for sample in 0..=samples {
                let t = (sample as f64 + 0.5) / (samples as f64 + 1.0);
                let on_edge = Coord {
                    x: a.x + dx * t,
                    y: a.y + dy * t,
                };
                for sign in [1.0, -1.0] {
                    let (nx, ny) = (normal.0 * sign, normal.1 * sign);
                    let reach = clearance + half_width * nx.abs() + half_height * ny.abs();
                    candidates.push(Point {
                        x: on_edge.x + nx * reach,
                        y: on_edge.y + ny * reach,
                    });
                }
            }
        }
    }
    if let Some(bounds) = region.bounding_rect() {
        let (min, max) = (bounds.min(), bounds.max());
        let middle = Point {
            x: (min.x + max.x) / 2.0,
            y: (min.y + max.y) / 2.0,
        };
        let above = min.y - clearance - half_height;
        let below = max.y + clearance + half_height;
        let left = min.x - clearance - half_width;
        let right = max.x + clearance + half_width;
        // Above and below: centred, flush with either side, and past either
        // corner; beside: centred and flush with the top or bottom.
        for x in [
            middle.x,
            min.x + half_width,
            max.x - half_width,
            left,
            right,
        ] {
            candidates.push(Point { x, y: above });
            candidates.push(Point { x, y: below });
        }
        for y in [middle.y, min.y + half_height, max.y - half_height] {
            candidates.push(Point { x: left, y });
            candidates.push(Point { x: right, y });
        }
    }
    candidates
}

fn rect_polygon(bounds: Bounds) -> Polygon<f64> {
    Rect::new(
        Coord {
            x: bounds.min_x,
            y: bounds.min_y,
        },
        Coord {
            x: bounds.max_x,
            y: bounds.max_y,
        },
    )
    .to_polygon()
}
