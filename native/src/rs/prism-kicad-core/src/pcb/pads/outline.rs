//! A pad's copper outline, shaped as KiCad shapes it, sampled as closed rings.
//!
//! The shapes follow KiCad's behaviour, checked against KiCad 10.0.6's own pad
//! outlines for the documentation-oracle board (`tests/docs_oracle.rs`):
//! a circle's radius is half its x size; a round-rect's radius is its ratio of
//! the shorter side (0.25 when the file omits it); chamfered corners are cut by
//! their ratio of the shorter side and stay sharp while the other corners keep
//! the rounding; a trapezoid's `rect_delta` x makes the left side taller and
//! the right side shorter, its y makes the bottom wider and the top narrower;
//! a custom pad is its anchor (a circle or a rectangle of the pad's size) and
//! every primitive, a stroked primitive grown by half its width.

use super::*;

/// The largest gap between a sampled arc and the true curve, mm. KiCad's own
/// outlines use about 5 µm, inside the curve; this stays well under that.
const ARC_ERROR: f64 = 0.001;

impl PcbPad {
    /// The pad's copper as closed rings in board coordinates, placed by its
    /// footprint (`footprint_at`, `footprint_angle`): [`Self::copper_rings`]
    /// moved to the pad's board position.
    pub fn copper_outline(
        &self,
        footprint_at: PcbPoint,
        footprint_angle: f64,
    ) -> Vec<Vec<PcbPoint>> {
        let position = kicad_rotate(
            PcbPoint {
                x: self.at_x,
                y: self.at_y,
            },
            footprint_angle,
        );
        let origin = PcbPoint {
            x: footprint_at.x + position.x,
            y: footprint_at.y + position.y,
        };
        self.copper_rings()
            .into_iter()
            .map(|ring| {
                ring.into_iter()
                    .map(|point| PcbPoint {
                        x: origin.x + point.x,
                        y: origin.y + point.y,
                    })
                    .collect()
            })
            .collect()
    }

    /// The pad's copper as closed rings in the board frame, relative to the
    /// pad's position: turned by the pad's board-frame angle and moved by a
    /// drill offset, as KiCad moves the copper ([`Self::copper_center`]).
    ///
    /// Every shape but `custom` is one ring. A custom pad is its anchor plus one
    /// or more rings per primitive; the rings overlap, so their union (drawn
    /// filled, or the union of their bounding boxes) is the copper.
    pub fn copper_rings(&self) -> Vec<Vec<PcbPoint>> {
        let offset = self
            .drill
            .as_ref()
            .map_or(PcbPoint { x: 0.0, y: 0.0 }, |drill| drill.offset);
        self.local_copper_rings()
            .into_iter()
            .map(|ring| {
                ring.into_iter()
                    .map(|point| {
                        kicad_rotate(
                            PcbPoint {
                                x: point.x + offset.x,
                                y: point.y + offset.y,
                            },
                            self.angle,
                        )
                    })
                    .collect()
            })
            .filter(|ring: &Vec<PcbPoint>| ring.len() >= 3)
            .collect()
    }

    /// The pad's copper as closed rings in the pad's own frame (before its
    /// angle), around the copper's centre (the pad position moved by any drill
    /// offset): what a drawing that places and turns each pad itself needs.
    pub fn local_copper_rings(&self) -> Vec<Vec<PcbPoint>> {
        let width = self.size_x.abs();
        let height = self.size_y.abs();
        if width <= 0.0 || height <= 0.0 {
            return Vec::new();
        }
        let shorter = width.min(height);
        match self.shape.as_str() {
            "circle" => vec![circle(ORIGIN, width / 2.0)],
            "oval" => vec![rounded_rect(width, height, shorter / 2.0, 0.0, &[])],
            "roundrect" | "chamfered_rect" => {
                let radius = self.roundrect_rratio.unwrap_or(0.25).clamp(0.0, 0.5) * shorter;
                let chamfer = self.chamfer_ratio.unwrap_or(0.0).clamp(0.0, 0.5) * shorter;
                vec![rounded_rect(
                    width,
                    height,
                    radius,
                    chamfer,
                    &self.chamfer_corners,
                )]
            }
            "trapezoid" => vec![trapezoid(
                width,
                height,
                self.rect_delta_x.unwrap_or(0.0),
                self.rect_delta_y.unwrap_or(0.0),
            )],
            "custom" => {
                let anchor = match self
                    .custom_options
                    .as_ref()
                    .and_then(|o| o.anchor.as_deref())
                {
                    Some("circle") => circle(ORIGIN, width / 2.0),
                    _ => rounded_rect(width, height, 0.0, 0.0, &[]),
                };
                std::iter::once(anchor)
                    .chain(self.custom_primitives.iter().flat_map(primitive_rings))
                    .collect()
            }
            _ => vec![rounded_rect(width, height, 0.0, 0.0, &[])],
        }
    }
}

const ORIGIN: PcbPoint = PcbPoint { x: 0.0, y: 0.0 };

fn point(x: f64, y: f64) -> PcbPoint {
    PcbPoint { x, y }
}

/// Points along an arc around `center`, from `start` degrees through `sweep`
/// degrees (y down, so positive sweeps run clockwise on screen), both ends
/// included.
fn arc_points(center: PcbPoint, radius: f64, start: f64, sweep: f64) -> Vec<PcbPoint> {
    if radius <= ARC_ERROR {
        return vec![center];
    }
    let step = 2.0 * (1.0 - ARC_ERROR / radius).acos().to_degrees();
    let count = (sweep.abs() / step).ceil().max(1.0) as usize;
    (0..=count)
        .map(|index| {
            let angle = (start + sweep * index as f64 / count as f64).to_radians();
            point(
                center.x + radius * angle.cos(),
                center.y + radius * angle.sin(),
            )
        })
        .collect()
}

fn circle(center: PcbPoint, radius: f64) -> Vec<PcbPoint> {
    let mut ring = arc_points(center, radius, 0.0, 360.0);
    ring.pop();
    ring
}

/// A `width` × `height` rectangle around the origin whose corners are rounded
/// by `radius`, except the `chamfered` ones, which are cut by `chamfer` and stay
/// sharp. Corners are KiCad's names: `top_left`, `top_right`, `bottom_left`,
/// `bottom_right` (top is -y).
fn rounded_rect(
    width: f64,
    height: f64,
    radius: f64,
    chamfer: f64,
    chamfered: &[String],
) -> Vec<PcbPoint> {
    let (half_w, half_h) = (width / 2.0, height / 2.0);
    // Clockwise on screen from the top-left corner; each corner with the
    // direction of its two edges' outward normals (as start angles, y down).
    let corners = [
        ("top_left", point(-half_w, -half_h), 180.0),
        ("top_right", point(half_w, -half_h), 270.0),
        ("bottom_right", point(half_w, half_h), 0.0),
        ("bottom_left", point(-half_w, half_h), 90.0),
    ];
    let mut ring = Vec::new();
    for (name, corner, start) in corners {
        let inward_x = -corner.x.signum();
        let inward_y = -corner.y.signum();
        if chamfer > 0.0 && chamfered.iter().any(|c| c == name) {
            // The cut runs from the edge entering this corner to the one leaving.
            let (first, second) = if start == 180.0 || start == 0.0 {
                (
                    point(corner.x, corner.y + inward_y * chamfer),
                    point(corner.x + inward_x * chamfer, corner.y),
                )
            } else {
                (
                    point(corner.x + inward_x * chamfer, corner.y),
                    point(corner.x, corner.y + inward_y * chamfer),
                )
            };
            ring.extend([first, second]);
        } else if radius > 0.0 {
            let center = point(corner.x + inward_x * radius, corner.y + inward_y * radius);
            ring.extend(arc_points(center, radius, start, 90.0));
        } else {
            ring.push(corner);
        }
    }
    ring
}

/// KiCad's trapezoid: `delta_x` makes the left side taller and the right side
/// shorter, `delta_y` makes the bottom wider and the top narrower.
fn trapezoid(width: f64, height: f64, delta_x: f64, delta_y: f64) -> Vec<PcbPoint> {
    vec![
        point(-(width - delta_y) / 2.0, -(height + delta_x) / 2.0),
        point((width - delta_y) / 2.0, -(height - delta_x) / 2.0),
        point((width + delta_y) / 2.0, (height - delta_x) / 2.0),
        point(-(width + delta_y) / 2.0, (height + delta_x) / 2.0),
    ]
}

/// The circle through three points, as (centre, radius); `None` when they lie
/// on a line.
fn circle_through(a: PcbPoint, b: PcbPoint, c: PcbPoint) -> Option<(PcbPoint, f64)> {
    let d = 2.0 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    if d.abs() < 1e-12 {
        return None;
    }
    let (a2, b2, c2) = (
        a.x * a.x + a.y * a.y,
        b.x * b.x + b.y * b.y,
        c.x * c.x + c.y * c.y,
    );
    let center = point(
        (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
        (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
    );
    Some((center, (a.x - center.x).hypot(a.y - center.y)))
}

/// An arc from `start` through `mid` to `end`, sampled; a straight line when the
/// three points are collinear.
fn arc_path(start: PcbPoint, mid: PcbPoint, end: PcbPoint) -> Vec<PcbPoint> {
    let Some((center, radius)) = circle_through(start, mid, end) else {
        return vec![start, end];
    };
    let angle = |p: PcbPoint| (p.y - center.y).atan2(p.x - center.x).to_degrees();
    let (a0, a1, a2) = (angle(start), angle(mid), angle(end));
    let turn = |from: f64, to: f64| (to - from).rem_euclid(360.0);
    // Sweep the way that passes the midpoint.
    let sweep = if turn(a0, a1) <= turn(a0, a2) {
        turn(a0, a2)
    } else {
        turn(a0, a2) - 360.0
    };
    arc_points(center, radius, a0, sweep)
}

/// A stroke of `width` along a straight segment, with round ends.
fn capsule(start: PcbPoint, end: PcbPoint, width: f64) -> Vec<PcbPoint> {
    let radius = width / 2.0;
    let heading = (end.y - start.y).atan2(end.x - start.x).to_degrees();
    let mut ring = arc_points(end, radius, heading - 90.0, 180.0);
    ring.extend(arc_points(start, radius, heading + 90.0, 180.0));
    ring
}

/// A stroke of `width` along a sampled path: one capsule per segment.
fn stroke(path: &[PcbPoint], width: f64) -> Vec<Vec<PcbPoint>> {
    if width <= 0.0 {
        return Vec::new();
    }
    path.windows(2)
        .map(|pair| capsule(pair[0], pair[1], width))
        .collect()
}

fn polygon_path(points: &[PcbPolygonPoint]) -> Vec<PcbPoint> {
    let mut path = Vec::new();
    for item in points {
        match *item {
            PcbPolygonPoint::Xy(xy) => path.push(xy),
            PcbPolygonPoint::Arc { start, mid, end } => path.extend(arc_path(start, mid, end)),
        }
    }
    path
}

fn closed(mut path: Vec<PcbPoint>) -> Vec<PcbPoint> {
    if let Some(&first) = path.first() {
        path.push(first);
    }
    path
}

fn cubic(points: &[PcbPoint; 4]) -> Vec<PcbPoint> {
    const STEPS: usize = 32;
    (0..=STEPS)
        .map(|index| {
            let t = index as f64 / STEPS as f64;
            let u = 1.0 - t;
            let weights = [u * u * u, 3.0 * u * u * t, 3.0 * u * t * t, t * t * t];
            let mut out = ORIGIN;
            for (weight, p) in weights.iter().zip(points) {
                out.x += weight * p.x;
                out.y += weight * p.y;
            }
            out
        })
        .collect()
}

/// One custom-pad primitive's copper: its filled area, and its stroke grown by
/// half the width. Bounding-box and vector proxies are not copper.
fn primitive_rings(primitive: &PcbPadCustomPrimitive) -> Vec<Vec<PcbPoint>> {
    let width = primitive.width.unwrap_or(0.0).max(0.0);
    let filled = matches!(primitive.fill.as_deref(), Some("yes" | "solid"));
    let Some(geometry) = primitive.geometry.as_ref() else {
        return Vec::new();
    };
    match geometry {
        PcbPadPrimitiveGeometry::Line { start, end } => stroke(&[*start, *end], width),
        PcbPadPrimitiveGeometry::Arc { start, mid, end } => {
            stroke(&arc_path(*start, *mid, *end), width)
        }
        PcbPadPrimitiveGeometry::Curve { points } => stroke(&cubic(points), width),
        PcbPadPrimitiveGeometry::Circle { center, end } => {
            let radius = (end.x - center.x).hypot(end.y - center.y);
            if filled {
                vec![circle(*center, radius + width / 2.0)]
            } else {
                stroke(&closed(circle(*center, radius)), width)
            }
        }
        PcbPadPrimitiveGeometry::Rect { start, end, .. } => {
            let path = vec![*start, point(end.x, start.y), *end, point(start.x, end.y)];
            let mut rings = stroke(&closed(path.clone()), width);
            if filled {
                rings.insert(0, path);
            }
            rings
        }
        PcbPadPrimitiveGeometry::Polygon { points } => {
            let path = polygon_path(points);
            let mut rings = stroke(&closed(path.clone()), width);
            // A pad polygon is copper inside, whatever its fill flag says.
            rings.insert(0, path);
            rings
        }
        PcbPadPrimitiveGeometry::BoundingBoxProxy { .. }
        | PcbPadPrimitiveGeometry::VectorProxy { .. } => Vec::new(),
    }
}
