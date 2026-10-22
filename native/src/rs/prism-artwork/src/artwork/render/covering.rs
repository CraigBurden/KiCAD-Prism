//! Covering parts: a body outline that hides other parts is drawn as a dashed
//! outline on top instead of its full hidden-line body, and its designator goes
//! just outside the body instead of inside it.
//!
//! Coverage is decided per side, among the view's selected footprints. A part
//! covers another when its HLR outline region contains the other's body
//! region's bounding-box centre, or when it covers at least half of the
//! other's body region. Only a real HLR outline can cover: a pad or hole
//! envelope does not stand in for a body. Footprints are visited in the
//! `selected` order and the result is a `BTreeSet`, so rendering is independent
//! of hash ordering.

use std::collections::{BTreeMap, BTreeSet};

use geo::{Area, BooleanOps, BoundingRect, Contains, MultiPolygon, Point as GeoPoint, Rect};
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
    let center = GeoPoint::new(
        (body_bounds.min().x + body_bounds.max().x) / 2.0,
        (body_bounds.min().y + body_bounds.max().y) / 2.0,
    );
    if outline.contains(&center) {
        return true;
    }
    if !rectangles_overlap(bounds, *body_bounds) {
        return false;
    }
    let body_area = body.unsigned_area();
    body_area > 0.0 && outline.intersection(body).unsigned_area() >= body_area * 0.5
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

/// Plan every covering part's designator just above its body's bounding box,
/// centred horizontally, or below it when the above position leaves the canvas.
pub(super) fn plan_labels(
    config: &ArtworkConfigA0,
    styles: &ArtworkStyles,
    data: &BoardData,
    covering: &BTreeSet<usize>,
    canvas: Bounds,
    paper_scale: f64,
) -> BTreeMap<usize, CoveringLabel> {
    let clearance = DESIGNATOR_CLEARANCE_MM / paper_scale.max(f64::MIN_POSITIVE);
    let mut labels = BTreeMap::new();
    for &index in covering {
        let footprint = &data.footprints[index];
        let Some(designator) = footprint.reference.as_deref() else {
            continue;
        };
        let Some(region) = outline_region(footprint, data) else {
            continue;
        };
        let Some(region_bounds) = region.bounding_rect() else {
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
        let center = Point {
            x: (region_bounds.min().x + region_bounds.max().x) / 2.0,
            y: region_bounds.min().y - clearance - half_height,
        };
        let above = Bounds::around(center, half_width, half_height);
        let (center, bounds) = if canvas.contains_bounds(above) {
            (center, above)
        } else {
            let center = Point {
                y: region_bounds.max().y + clearance + half_height,
                ..center
            };
            (center, Bounds::around(center, half_width, half_height))
        };
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
