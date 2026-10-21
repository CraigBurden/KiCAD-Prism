//! Board geometry for the artwork views: the closed `Edge.Cuts` profile, the
//! board-level canvas extent, the drills and slots, and footprint envelopes.
//!
//! The region assembly follows the harvested Cruncher Rust work
//! (`kicad-cruncher-cli/src/pcb_svg/virtual_layers.rs`, `board_regions` and
//! `assemble_regions`): segments and arcs are chained by endpoint, the
//! largest closed ring is the board outline and the others inside it are
//! cutouts. Coordinates here are millimetres; the contract stores nanometres
//! and every call site converts once.

use std::collections::BTreeMap;

use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
    AssemblyHlrArc, AssemblyHlrEdges, AssemblyHlrSegment,
};
use prism_kicad_core::{
    Error, PcbFootprint, PcbGraphic, PcbGraphicKind, PcbHole, PcbHoleOwner, PcbPad, PcbPoint,
    PcbPolygonPoint, PcbProfileOwner, PcbView,
};

/// A point in millimetres, board frame (+x right, +y down).
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Point {
    pub x: f64,
    pub y: f64,
}

impl From<PcbPoint> for Point {
    fn from(value: PcbPoint) -> Self {
        Self {
            x: value.x,
            y: value.y,
        }
    }
}

/// An axis-aligned extent in millimetres.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct Bounds {
    pub min_x: f64,
    pub min_y: f64,
    pub max_x: f64,
    pub max_y: f64,
}

impl Bounds {
    pub fn empty() -> Self {
        Self {
            min_x: f64::INFINITY,
            min_y: f64::INFINITY,
            max_x: f64::NEG_INFINITY,
            max_y: f64::NEG_INFINITY,
        }
    }

    pub fn is_empty(self) -> bool {
        self.min_x > self.max_x || self.min_y > self.max_y
    }

    pub fn include(&mut self, point: Point) {
        self.min_x = self.min_x.min(point.x);
        self.min_y = self.min_y.min(point.y);
        self.max_x = self.max_x.max(point.x);
        self.max_y = self.max_y.max(point.y);
    }

    pub fn include_bounds(&mut self, other: Bounds) {
        if other.is_empty() {
            return;
        }
        self.include(Point {
            x: other.min_x,
            y: other.min_y,
        });
        self.include(Point {
            x: other.max_x,
            y: other.max_y,
        });
    }

    pub fn width(self) -> f64 {
        (self.max_x - self.min_x).max(0.0)
    }

    pub fn height(self) -> f64 {
        (self.max_y - self.min_y).max(0.0)
    }

    /// The four corners as a ring.
    pub fn ring(self) -> Vec<Point> {
        vec![
            Point {
                x: self.min_x,
                y: self.min_y,
            },
            Point {
                x: self.max_x,
                y: self.min_y,
            },
            Point {
                x: self.max_x,
                y: self.max_y,
            },
            Point {
                x: self.min_x,
                y: self.max_y,
            },
        ]
    }

    /// The extent of a ring of points.
    pub fn of_ring(points: &[Point]) -> Self {
        let mut bounds = Self::empty();
        for point in points {
            bounds.include(*point);
        }
        bounds
    }

    /// The extent of a centre and its half extents.
    pub fn around(center: Point, half_x: f64, half_y: f64) -> Self {
        Self {
            min_x: center.x - half_x,
            min_y: center.y - half_y,
            max_x: center.x + half_x,
            max_y: center.y + half_y,
        }
    }

    /// True when both extents share interior area.
    pub fn intersects(self, other: Self) -> bool {
        const EPSILON: f64 = 1.0e-9;
        self.min_x < other.max_x - EPSILON
            && other.min_x < self.max_x - EPSILON
            && self.min_y < other.max_y - EPSILON
            && other.min_y < self.max_y - EPSILON
    }

    /// True when `other` lies inside this extent.
    pub fn contains_bounds(self, other: Self) -> bool {
        const EPSILON: f64 = 1.0e-9;
        self.min_x <= other.min_x + EPSILON
            && self.min_y <= other.min_y + EPSILON
            && self.max_x >= other.max_x - EPSILON
            && self.max_y >= other.max_y - EPSILON
    }

    /// The extent mirrored about the vertical axis, `x -> -x`.
    pub fn mirrored(self) -> Self {
        Self {
            min_x: -self.max_x,
            min_y: self.min_y,
            max_x: -self.min_x,
            max_y: self.max_y,
        }
    }
}

/// One drill or slot hole in board coordinates.
#[derive(Clone, Copy, Debug)]
pub(crate) struct Hole {
    pub center: Point,
    pub width: f64,
    pub height: f64,
    pub angle: f64,
    pub plated: bool,
}

impl Hole {
    pub fn is_slot(self) -> bool {
        (self.width - self.height).abs() > 1e-9
    }

    pub fn bounds(self) -> Bounds {
        let half = self.width.max(self.height) / 2.0;
        Bounds {
            min_x: self.center.x - half,
            min_y: self.center.y - half,
            max_x: self.center.x + half,
            max_y: self.center.y + half,
        }
    }
}

/// The parsed board's artwork geometry.
pub(crate) struct BoardGeometry {
    /// The largest closed ring: the board perimeter.
    pub outer: Vec<Point>,
    /// Closed rings inside the perimeter: board cutouts.
    pub cutouts: Vec<Vec<Point>>,
    /// The board-level `Edge.Cuts` extent, line centres only.
    pub outline_bounds: Bounds,
    pub drills: Vec<Hole>,
    pub slots: Vec<Hole>,
    /// Per footprint index: the closed pad extent (board frame).
    pub pad_envelopes: BTreeMap<usize, Bounds>,
    /// Per footprint index: the closed hole extent (board frame).
    pub hole_envelopes: BTreeMap<usize, Bounds>,
}

/// Build the geometry the views share, from one parsed board.
pub(crate) fn board_geometry(view: &PcbView<'_>) -> Result<BoardGeometry, Error> {
    let footprints: Vec<PcbFootprint> = view.footprints().collect::<Result<_, _>>()?;
    let pads: Vec<PcbPad> = view.pads().collect::<Result<_, _>>()?;
    let holes: Vec<PcbHole> = view.holes().collect::<Result<_, _>>()?;

    let mut segments = Vec::new();
    let mut closed = Vec::new();
    let mut outline_bounds = Bounds::empty();
    for primitive in view.profile_primitives() {
        let primitive = primitive?;
        if primitive.owner != PcbProfileOwner::Board {
            continue;
        }
        append_graphic(&primitive.graphic, &mut segments, &mut closed);
        include_graphic_bounds(&primitive.graphic, &mut outline_bounds);
    }
    closed.extend(assemble_rings(&segments));
    closed.retain(|ring| polygon_area(ring).abs() > 1e-6);
    let outer_index = closed
        .iter()
        .enumerate()
        .max_by(|(_, left), (_, right)| {
            polygon_area(left)
                .abs()
                .total_cmp(&polygon_area(right).abs())
        })
        .map(|(index, _)| index);
    let outer = outer_index.map_or_else(Vec::new, |index| closed[index].clone());
    let cutouts = closed
        .into_iter()
        .enumerate()
        .filter(|(index, ring)| {
            Some(*index) != outer_index
                && outer_index.is_some()
                && polygon_area(ring).abs() < polygon_area(&outer).abs() * 0.95
                && point_in_polygon(ring_centroid(ring), &outer)
        })
        .map(|(_, ring)| ring)
        .collect();

    let transforms: Vec<FootprintTransform> =
        footprints.iter().map(FootprintTransform::of).collect();
    let (drills, slots, hole_envelopes) = collect_holes(&holes, &transforms);
    let pad_envelopes = collect_pad_envelopes(&pads, &transforms);

    Ok(BoardGeometry {
        outer,
        cutouts,
        outline_bounds,
        drills,
        slots,
        pad_envelopes,
        hole_envelopes,
    })
}

fn collect_holes(
    holes: &[PcbHole],
    transforms: &[FootprintTransform],
) -> (Vec<Hole>, Vec<Hole>, BTreeMap<usize, Bounds>) {
    let mut drills = Vec::new();
    let mut slots = Vec::new();
    let mut envelopes: BTreeMap<usize, Bounds> = BTreeMap::new();
    for hole in holes {
        let center = match hole.owner {
            PcbHoleOwner::Pad => {
                let Some(index) = hole.footprint_index else {
                    continue;
                };
                let Some(transform) = transforms.get(index) else {
                    continue;
                };
                let offset = rotate(
                    Point {
                        x: hole.offset.x,
                        y: hole.offset.y,
                    },
                    hole.angle,
                );
                transform.apply(Point {
                    x: hole.center.x + offset.x,
                    y: hole.center.y + offset.y,
                })
            }
            PcbHoleOwner::Via => Point::from(hole.center),
        };
        let rendered = Hole {
            center,
            width: hole.width,
            height: hole.height,
            angle: if hole.owner == PcbHoleOwner::Pad {
                hole.angle
            } else {
                0.0
            },
            plated: hole.plated,
        };
        if let Some(index) = hole.footprint_index {
            envelopes
                .entry(index)
                .and_modify(|bounds| bounds.include_bounds(rendered.bounds()))
                .or_insert_with(|| rendered.bounds());
        }
        if rendered.is_slot() {
            slots.push(rendered);
        } else {
            drills.push(rendered);
        }
    }
    (drills, slots, envelopes)
}

fn collect_pad_envelopes(
    pads: &[PcbPad],
    transforms: &[FootprintTransform],
) -> BTreeMap<usize, Bounds> {
    let mut envelopes: BTreeMap<usize, Bounds> = BTreeMap::new();
    for pad in pads {
        let Some(transform) = transforms.get(pad.footprint_index) else {
            continue;
        };
        let anchor = transform.apply(Point {
            x: pad.at_x,
            y: pad.at_y,
        });
        let angle = pad.angle + transform.angle;
        let (sin, cos) = angle.to_radians().sin_cos();
        let half_x = pad.size_x.abs() / 2.0;
        let half_y = pad.size_y.abs() / 2.0;
        let mut bounds = Bounds::empty();
        for (local_x, local_y) in [
            (-half_x, -half_y),
            (half_x, -half_y),
            (half_x, half_y),
            (-half_x, half_y),
        ] {
            bounds.include(Point {
                x: anchor.x + local_x * cos - local_y * sin,
                y: anchor.y + local_x * sin + local_y * cos,
            });
        }
        envelopes
            .entry(pad.footprint_index)
            .and_modify(|existing| existing.include_bounds(bounds))
            .or_insert(bounds);
    }
    envelopes
}

/// A footprint's placement, for converting local geometry to the board frame.
#[derive(Clone, Copy, Debug)]
struct FootprintTransform {
    x: f64,
    y: f64,
    angle: f64,
}

impl FootprintTransform {
    fn of(footprint: &PcbFootprint) -> Self {
        Self {
            x: footprint.at_x.unwrap_or(0.0),
            y: footprint.at_y.unwrap_or(0.0),
            angle: footprint.angle.unwrap_or(0.0),
        }
    }

    /// KiCad's footprint placement formula (placements-a1 `rotationDeg`).
    fn apply(self, local: Point) -> Point {
        let (sin, cos) = self.angle.to_radians().sin_cos();
        Point {
            x: self.x + local.x * cos + local.y * sin,
            y: self.y - local.x * sin + local.y * cos,
        }
    }
}

fn rotate(point: Point, angle_degrees: f64) -> Point {
    let (sin, cos) = angle_degrees.to_radians().sin_cos();
    Point {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos,
    }
}

fn include_graphic_bounds(graphic: &PcbGraphic, bounds: &mut Bounds) {
    for point in graphic_points(graphic) {
        bounds.include(point);
    }
}

fn graphic_points(graphic: &PcbGraphic) -> Vec<Point> {
    match graphic.kind {
        PcbGraphicKind::Line | PcbGraphicKind::Rect => [graphic.start, graphic.end]
            .into_iter()
            .flatten()
            .map(Point::from)
            .collect(),
        PcbGraphicKind::Arc => [graphic.start, graphic.mid, graphic.end]
            .into_iter()
            .flatten()
            .map(Point::from)
            .collect(),
        PcbGraphicKind::Circle => {
            let center = graphic.center.or(graphic.start);
            let end = graphic.end;
            match (center, end) {
                (Some(center), Some(end)) => {
                    let center = Point::from(center);
                    let edge = Point::from(end);
                    let radius = distance(center, edge);
                    vec![
                        Point {
                            x: center.x - radius,
                            y: center.y - radius,
                        },
                        Point {
                            x: center.x + radius,
                            y: center.y + radius,
                        },
                    ]
                }
                (Some(center), None) => vec![Point::from(center)],
                _ => Vec::new(),
            }
        }
        PcbGraphicKind::Poly => graphic
            .polygon_points
            .iter()
            .flat_map(|point| match point {
                PcbPolygonPoint::Xy(point) => vec![Point::from(*point)],
                PcbPolygonPoint::Arc { start, mid, end } => {
                    let start = Point::from(*start);
                    let mid = Point::from(*mid);
                    let end = Point::from(*end);
                    let mut sampled = sample_arc(start, mid, end);
                    sampled.push(end);
                    sampled
                }
            })
            .collect(),
        PcbGraphicKind::Curve => graphic.points.iter().copied().map(Point::from).collect(),
        PcbGraphicKind::Text | PcbGraphicKind::TextBox => Vec::new(),
    }
}

fn append_graphic(
    graphic: &PcbGraphic,
    segments: &mut Vec<Vec<Point>>,
    closed: &mut Vec<Vec<Point>>,
) {
    match graphic.kind {
        PcbGraphicKind::Line => append_line(graphic, segments),
        PcbGraphicKind::Arc => append_arc(graphic, segments),
        PcbGraphicKind::Curve => append_curve(graphic, segments),
        PcbGraphicKind::Rect => append_rect(graphic, closed),
        PcbGraphicKind::Circle => append_circle(graphic, closed),
        PcbGraphicKind::Poly => append_poly(graphic, closed),
        PcbGraphicKind::Text | PcbGraphicKind::TextBox => {}
    }
}

fn append_line(graphic: &PcbGraphic, segments: &mut Vec<Vec<Point>>) {
    if let (Some(start), Some(end)) = (graphic.start, graphic.end) {
        segments.push(vec![Point::from(start), Point::from(end)]);
    }
}

fn append_arc(graphic: &PcbGraphic, segments: &mut Vec<Vec<Point>>) {
    if let (Some(start), Some(mid), Some(end)) = (graphic.start, graphic.mid, graphic.end) {
        segments.push(sample_arc(
            Point::from(start),
            Point::from(mid),
            Point::from(end),
        ));
    }
}

fn append_curve(graphic: &PcbGraphic, segments: &mut Vec<Vec<Point>>) {
    if graphic.points.len() == 4 {
        segments.push(sample_curve(
            graphic.points.iter().copied().map(Point::from).collect(),
        ));
    }
}

fn append_rect(graphic: &PcbGraphic, closed: &mut Vec<Vec<Point>>) {
    if let (Some(start), Some(end)) = (graphic.start, graphic.end) {
        let start = Point::from(start);
        let end = Point::from(end);
        closed.push(vec![
            start,
            Point {
                x: end.x,
                y: start.y,
            },
            end,
            Point {
                x: start.x,
                y: end.y,
            },
        ]);
    }
}

fn append_circle(graphic: &PcbGraphic, closed: &mut Vec<Vec<Point>>) {
    if let (Some(center), Some(end)) = (graphic.center.or(graphic.start), graphic.end) {
        let center = Point::from(center);
        let radius = distance(center, Point::from(end));
        if radius > 0.0 {
            closed.push(circle_ring(center, radius));
        }
    }
}

fn append_poly(graphic: &PcbGraphic, closed: &mut Vec<Vec<Point>>) {
    let points = polygon_points(&graphic.polygon_points);
    if points.len() >= 3 {
        closed.push(points);
    }
}

fn polygon_points(authored: &[PcbPolygonPoint]) -> Vec<Point> {
    let mut result = Vec::new();
    for point in authored {
        match point {
            PcbPolygonPoint::Xy(point) => result.push(Point::from(*point)),
            PcbPolygonPoint::Arc { start, mid, end } => {
                let arc = sample_arc(Point::from(*start), Point::from(*mid), Point::from(*end));
                if result
                    .last()
                    .is_some_and(|last| point_key(*last) == point_key(arc[0]))
                {
                    result.extend_from_slice(&arc[1..]);
                } else {
                    result.extend(arc);
                }
            }
        }
    }
    result
}

pub(crate) fn circle_ring(center: Point, radius: f64) -> Vec<Point> {
    const COUNT: usize = 64;
    (0..COUNT)
        .map(|index| {
            let angle = 2.0 * std::f64::consts::PI * index as f64 / COUNT as f64;
            Point {
                x: center.x + angle.cos() * radius,
                y: center.y + angle.sin() * radius,
            }
        })
        .collect()
}

fn point_key(point: Point) -> (i64, i64) {
    (
        (point.x * 1_000_000.0).round() as i64,
        (point.y * 1_000_000.0).round() as i64,
    )
}

fn assemble_rings(segments: &[Vec<Point>]) -> Vec<Vec<Point>> {
    let mut adjacency = BTreeMap::<(i64, i64), Vec<usize>>::new();
    for (index, segment) in segments.iter().enumerate() {
        if segment.len() < 2 {
            continue;
        }
        adjacency
            .entry(point_key(segment[0]))
            .or_default()
            .push(index);
        adjacency
            .entry(point_key(*segment.last().expect("segment has points")))
            .or_default()
            .push(index);
    }
    let mut visited = vec![false; segments.len()];
    let mut result = Vec::new();
    for start_index in 0..segments.len() {
        if visited[start_index] || segments[start_index].len() < 2 {
            continue;
        }
        let start = &segments[start_index];
        let start_key = point_key(start[0]);
        let mut points = start.clone();
        let mut current = point_key(*start.last().expect("segment has points"));
        visited[start_index] = true;
        while current != start_key {
            let Some(next_index) = adjacency
                .get(&current)
                .and_then(|values| values.iter().copied().find(|index| !visited[*index]))
            else {
                break;
            };
            let next = &segments[next_index];
            let oriented = if point_key(next[0]) == current {
                next.clone()
            } else {
                let mut reversed = next.clone();
                reversed.reverse();
                reversed
            };
            points.extend_from_slice(&oriented[1..]);
            current = point_key(*oriented.last().expect("segment has points"));
            visited[next_index] = true;
        }
        if current == start_key && points.len() >= 3 {
            result.push(points);
        }
    }
    result
}

fn polygon_area(points: &[Point]) -> f64 {
    let mut sum = 0.0;
    for index in 0..points.len() {
        let current = points[index];
        let next = points[(index + 1) % points.len()];
        sum += current.x * next.y - next.x * current.y;
    }
    sum / 2.0
}

fn ring_centroid(points: &[Point]) -> Point {
    let count = points.len().max(1) as f64;
    Point {
        x: points.iter().map(|point| point.x).sum::<f64>() / count,
        y: points.iter().map(|point| point.y).sum::<f64>() / count,
    }
}

fn point_in_polygon(point: Point, polygon: &[Point]) -> bool {
    let mut inside = false;
    let mut previous = *polygon.last().unwrap_or(&point);
    for current in polygon {
        if (current.y > point.y) != (previous.y > point.y) {
            let x = (previous.x - current.x) * (point.y - current.y) / (previous.y - current.y)
                + current.x;
            if point.x < x {
                inside = !inside;
            }
        }
        previous = *current;
    }
    inside
}

pub(crate) fn distance(left: Point, right: Point) -> f64 {
    ((left.x - right.x).powi(2) + (left.y - right.y).powi(2)).sqrt()
}

pub(crate) fn sample_arc(start: Point, mid: Point, end: Point) -> Vec<Point> {
    let Some((center, radius)) = circle_from_three_points(start, mid, end) else {
        return vec![start, mid, end];
    };
    let start_angle = (start.y - center.y).atan2(start.x - center.x);
    let mid_angle = (mid.y - center.y).atan2(mid.x - center.x);
    let end_angle = (end.y - center.y).atan2(end.x - center.x);
    let ccw = positive_angle(end_angle - start_angle);
    let mid_delta = positive_angle(mid_angle - start_angle);
    let sweep = if mid_delta <= ccw {
        ccw
    } else {
        -(2.0 * std::f64::consts::PI - ccw)
    };
    let count = sample_count(sweep.abs() * radius, 1.0, 7);
    (0..count)
        .map(|index| {
            let angle = start_angle + sweep * index as f64 / (count - 1) as f64;
            Point {
                x: center.x + angle.cos() * radius,
                y: center.y + angle.sin() * radius,
            }
        })
        .collect()
}

fn sample_curve(points: Vec<Point>) -> Vec<Point> {
    let [p0, p1, p2, p3] = points.as_slice() else {
        return points;
    };
    let count = sample_count(
        distance(*p0, *p1) + distance(*p1, *p2) + distance(*p2, *p3),
        0.5,
        9,
    );
    (0..count)
        .map(|index| {
            let t = index as f64 / (count - 1) as f64;
            let opposite = 1.0 - t;
            Point {
                x: opposite.powi(3) * p0.x
                    + 3.0 * opposite.powi(2) * t * p1.x
                    + 3.0 * opposite * t.powi(2) * p2.x
                    + t.powi(3) * p3.x,
                y: opposite.powi(3) * p0.y
                    + 3.0 * opposite.powi(2) * t * p1.y
                    + 3.0 * opposite * t.powi(2) * p2.y
                    + t.powi(3) * p3.y,
            }
        })
        .collect()
}

fn sample_count(length: f64, max_segment: f64, minimum: usize) -> usize {
    minimum
        .max((length / max_segment.max(1.0e-6)).ceil() as usize + 1)
        .min(2049)
}

fn circle_from_three_points(first: Point, second: Point, third: Point) -> Option<(Point, f64)> {
    let determinant = 2.0
        * (first.x * (second.y - third.y)
            + second.x * (third.y - first.y)
            + third.x * (first.y - second.y));
    if determinant.abs() < 1.0e-12 {
        return None;
    }
    let first_norm = first.x * first.x + first.y * first.y;
    let second_norm = second.x * second.x + second.y * second.y;
    let third_norm = third.x * third.x + third.y * third.y;
    let center = Point {
        x: (first_norm * (second.y - third.y)
            + second_norm * (third.y - first.y)
            + third_norm * (first.y - second.y))
            / determinant,
        y: (first_norm * (third.x - second.x)
            + second_norm * (first.x - third.x)
            + third_norm * (second.x - first.x))
            / determinant,
    };
    Some((center, distance(first, center)))
}

fn positive_angle(angle: f64) -> f64 {
    angle.rem_euclid(2.0 * std::f64::consts::PI)
}

// ------------------------------------------------------- assembly HLR regions

/// Sample a projected HLR edge set into closed rings (millimetres), or a
/// convex extent when the edges do not close.
pub(crate) fn hlr_region(edges: &AssemblyHlrEdges) -> Option<Vec<Vec<Point>>> {
    let mut segments = Vec::new();
    for segment in &edges.segments {
        segments.push(segment_points(segment));
    }
    for arc in &edges.arcs {
        segments.push(arc_points(arc));
    }
    segments.retain(|segment| segment.len() >= 2);
    let rings = assemble_rings(&segments);
    if !rings.is_empty() {
        return Some(rings);
    }
    let mut points: Vec<Point> = segments.into_iter().flatten().collect();
    points.sort_by(|left, right| left.x.total_cmp(&right.x).then(left.y.total_cmp(&right.y)));
    points.dedup_by(|left, right| distance(*left, *right) <= 1e-9);
    (points.len() >= 3).then_some(vec![convex_hull(points)])
}

fn segment_points(segment: &AssemblyHlrSegment) -> Vec<Point> {
    vec![
        Point {
            x: nm(segment.start_nm.x_nm.0 as f64),
            y: nm(segment.start_nm.y_nm.0 as f64),
        },
        Point {
            x: nm(segment.end_nm.x_nm.0 as f64),
            y: nm(segment.end_nm.y_nm.0 as f64),
        },
    ]
}

pub(crate) fn arc_points(arc: &AssemblyHlrArc) -> Vec<Point> {
    let center = Point {
        x: nm(arc.center_nm.x_nm.0 as f64),
        y: nm(arc.center_nm.y_nm.0 as f64),
    };
    let start = Point {
        x: nm(arc.start_nm.x_nm.0 as f64),
        y: nm(arc.start_nm.y_nm.0 as f64),
    };
    let radius = nm(arc.radius_nm.0 as f64);
    if arc.full_circle {
        return circle_ring(center, radius);
    }
    let start_angle = (start.y - center.y).atan2(start.x - center.x);
    let extent = arc.extent_deg.0.to_radians() * if arc.ccw { 1.0 } else { -1.0 };
    let steps = (extent.abs() / (std::f64::consts::PI / 24.0))
        .ceil()
        .max(2.0) as usize;
    (0..=steps)
        .map(|index| {
            let angle = start_angle + extent * index as f64 / steps as f64;
            Point {
                x: center.x + angle.cos() * radius,
                y: center.y + angle.sin() * radius,
            }
        })
        .collect()
}

fn nm(value: f64) -> f64 {
    value / 1_000_000.0
}

fn convex_hull(mut points: Vec<Point>) -> Vec<Point> {
    if points.len() < 3 {
        return points;
    }
    points.sort_by(|left, right| left.x.total_cmp(&right.x).then(left.y.total_cmp(&right.y)));
    let mut hull: Vec<Point> = Vec::new();
    for point in &points {
        while hull.len() >= 2 && cross(hull[hull.len() - 2], hull[hull.len() - 1], *point) <= 0.0 {
            hull.pop();
        }
        hull.push(*point);
    }
    let lower = hull.len() + 1;
    for point in points.iter().rev() {
        while hull.len() >= lower
            && cross(hull[hull.len() - 2], hull[hull.len() - 1], *point) <= 0.0
        {
            hull.pop();
        }
        hull.push(*point);
    }
    hull.pop();
    hull
}

fn cross(origin: Point, left: Point, right: Point) -> f64 {
    (left.x - origin.x) * (right.y - origin.y) - (left.y - origin.y) * (right.x - origin.x)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_segments_close_into_one_ring_with_the_authored_area() {
        let corners = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 100.0, y: 0.0 },
            Point { x: 100.0, y: 50.0 },
            Point { x: 0.0, y: 50.0 },
        ];
        let segments: Vec<Vec<Point>> = (0..4)
            .map(|index| vec![corners[index], corners[(index + 1) % 4]])
            .collect();
        let rings = assemble_rings(&segments);
        assert_eq!(rings.len(), 1);
        assert_eq!(polygon_area(&rings[0]).abs(), 5_000.0);
        let mut bounds = Bounds::empty();
        for point in &corners {
            bounds.include(*point);
        }
        assert_eq!(bounds.width(), 100.0);
    }

    #[test]
    fn a_full_circle_arc_samples_its_ring() {
        let arc = AssemblyHlrArc {
            start_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::PointNm {
                x_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(
                    1_000_000,
                ),
                y_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(0),
            },
            end_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::PointNm {
                x_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(
                    1_000_000,
                ),
                y_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(0),
            },
            center_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::PointNm {
                x_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(0),
                y_nm: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Nanometres(0),
            },
            radius_nm:
                prism_kicad_contracts::generated::prism_assembly_hlr_a0::NonNegativeNanometres(
                    1_000_000,
                ),
            extent_deg: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Degrees(360.0),
            ccw: true,
            full_circle: true,
        };
        let points = arc_points(&arc);
        assert_eq!(points.len(), 64);
        assert!((distance(points[0], Point { x: 0.0, y: 0.0 }) - 1.0).abs() < 1e-9);
    }
}
