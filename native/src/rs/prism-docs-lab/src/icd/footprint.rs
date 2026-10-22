//! Footprint geometry a sheet draws: pads in their real shape, the fallback
//! F.Fab/F.SilkS outline, the courtyard ring and the board edge as one
//! footprint sees it.

use prism_artwork::artwork::geometry::{self, Bounds, Point};
use prism_kicad_contracts::generated::prism_placements_a1::PlacementsBounds;
use prism_kicad_core::{
    PcbFootprint, PcbGraphic, PcbGraphicKind, PcbPad, PcbPolygonPoint, PcbView,
};

/// A pad's shape, centred on the pad anchor.
#[derive(Clone, Debug)]
pub enum PadShape {
    /// A round pad.
    Circle {
        /// Diameter.
        diameter: f64,
    },
    /// A rectangular pad.
    Rect {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
    },
    /// A rounded rectangle.
    RoundRect {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
        /// Corner radius.
        radius: f64,
    },
    /// An oval (a rectangle with semicircular ends).
    Oval {
        /// Full width.
        width: f64,
        /// Full height.
        height: f64,
    },
    /// Any other pad (custom, chamfered, trapezoid) as KiCad shapes its copper
    /// (`PcbPad::local_copper_rings`): closed rings in the pad's own frame,
    /// around the copper centre.
    Outline {
        /// The copper's rings; a custom pad's overlap, and their union is the pad.
        rings: Vec<Vec<Point>>,
    },
}

/// One pad, in the footprint's frame.
#[derive(Clone, Debug)]
pub struct PadFact {
    /// The pad's number; empty for a mechanical pad.
    pub number: String,
    /// The pad's kind as the board writes it (`smd`, `thru_hole`, …).
    pub kind: String,
    /// The net the pad carries; empty when it is unconnected.
    pub net: String,
    /// Footprint-local anchor x.
    pub x: f64,
    /// Footprint-local anchor y.
    pub y: f64,
    /// The pad's rotation relative to its footprint, in degrees.
    pub angle: f64,
    /// The pad's shape.
    pub shape: PadShape,
}

impl PadFact {
    /// The pad's extent in the footprint's frame.
    pub fn bounds(&self) -> Bounds {
        let (half_x, half_y) = match &self.shape {
            PadShape::Circle { diameter } => (*diameter / 2.0, *diameter / 2.0),
            PadShape::Rect { width, height }
            | PadShape::RoundRect { width, height, .. }
            | PadShape::Oval { width, height } => (*width / 2.0, *height / 2.0),
            PadShape::Outline { rings } => {
                let mut half = (0.0_f64, 0.0_f64);
                for point in rings.iter().flatten() {
                    half.0 = half.0.max(point.x.abs());
                    half.1 = half.1.max(point.y.abs());
                }
                half
            }
        };
        // A rotated pad's extent is its circumscribed box.
        let radius = (half_x * half_x + half_y * half_y).sqrt();
        let (half_x, half_y) = if self.angle.abs() < 1e-9 {
            (half_x, half_y)
        } else {
            (radius, radius)
        };
        let mut bounds = Bounds::empty();
        bounds.include(Point {
            x: self.x - half_x,
            y: self.y - half_y,
        });
        bounds.include(Point {
            x: self.x + half_x,
            y: self.y + half_y,
        });
        bounds
    }
}

/// One parsed pad as a drawable fact.
///
/// A board file stores a pad's angle in the board frame, already including its
/// footprint's rotation; the connector is drawn in its footprint's own frame, so
/// the footprint's angle comes off here.
pub fn pad_fact(pad: &PcbPad, footprint_angle: f64) -> PadFact {
    let angle = pad.angle - footprint_angle;
    let (x, y) = copper_center(pad, angle);
    PadFact {
        number: pad.number.clone(),
        kind: pad.kind.clone(),
        net: pad.net.name.clone().unwrap_or_default(),
        x,
        y,
        angle,
        shape: pad_shape(pad),
    }
}

/// The pad's copper centre in the footprint's frame: its position plus the
/// drill-relative `(offset …)`, turned by the pad's angle within the footprint
/// (KiCad moves the copper by the offset, never the hole).
fn copper_center(pad: &PcbPad, relative_angle: f64) -> (f64, f64) {
    let offset = pad
        .drill
        .as_ref()
        .map_or(prism_kicad_core::PcbPoint { x: 0.0, y: 0.0 }, |drill| {
            drill.offset
        });
    let turned = prism_kicad_core::kicad_rotate(offset, relative_angle);
    (pad.at_x + turned.x, pad.at_y + turned.y)
}

fn pad_shape(pad: &PcbPad) -> PadShape {
    let width = pad.size_x.abs();
    let height = pad.size_y.abs();
    let chamfered = pad.chamfer_ratio.unwrap_or(0.0) > 0.0 && !pad.chamfer_corners.is_empty();
    match pad.shape.as_str() {
        "circle" => PadShape::Circle {
            diameter: width.min(height),
        },
        "oval" => PadShape::Oval { width, height },
        "rect" => PadShape::Rect { width, height },
        "roundrect" if !chamfered => PadShape::RoundRect {
            width,
            height,
            radius: pad.roundrect_rratio.unwrap_or(0.25) * width.min(height),
        },
        _ => PadShape::Outline {
            rings: pad
                .local_copper_rings()
                .into_iter()
                .map(|ring| ring.into_iter().map(Point::from).collect())
                .collect(),
        },
    }
}

fn polygon_ring(points: &[PcbPolygonPoint]) -> Vec<Point> {
    let mut ring = Vec::new();
    for point in points {
        match point {
            PcbPolygonPoint::Xy(point) => ring.push(Point::from(*point)),
            PcbPolygonPoint::Arc { start, mid, end } => {
                let arc =
                    geometry::sample_arc(Point::from(*start), Point::from(*mid), Point::from(*end));
                let skip = usize::from(
                    ring.last()
                        .is_some_and(|last| last.x == arc[0].x && last.y == arc[0].y),
                );
                ring.extend_from_slice(&arc[skip..]);
            }
        }
    }
    ring
}

fn rect_ring(start: prism_kicad_core::PcbPoint, end: prism_kicad_core::PcbPoint) -> Vec<Point> {
    vec![
        Point {
            x: start.x,
            y: start.y,
        },
        Point {
            x: end.x,
            y: start.y,
        },
        Point { x: end.x, y: end.y },
        Point {
            x: start.x,
            y: end.y,
        },
    ]
}

fn circle_ring(center: prism_kicad_core::PcbPoint, end: prism_kicad_core::PcbPoint) -> Vec<Point> {
    const STEPS: usize = 48;
    let radius = ((end.x - center.x).powi(2) + (end.y - center.y).powi(2)).sqrt();
    (0..STEPS)
        .map(|index| {
            let angle = 2.0 * std::f64::consts::PI * index as f64 / STEPS as f64;
            Point {
                x: center.x + angle.cos() * radius,
                y: center.y + angle.sin() * radius,
            }
        })
        .collect()
}

/// The pads' common extent in the footprint's frame.
pub fn pads_bounds(pads: &[PadFact]) -> Bounds {
    let mut bounds = Bounds::empty();
    for pad in pads {
        bounds.include_bounds(pad.bounds());
    }
    bounds
}

/// One fallback outline path in the footprint's frame.
#[derive(Clone, Debug)]
pub struct Graphic {
    /// The path's points.
    pub points: Vec<Point>,
    /// True when the path closes on itself.
    pub closed: bool,
    /// True when the source fills the path.
    pub fill: bool,
}

/// The footprint's own `F.Fab`/`F.SilkS` (or `B.*`) outline, in its frame.
pub fn graphics(view: &PcbView<'_>, footprint_index: usize, back: bool) -> Vec<Graphic> {
    let wanted = if back {
        ["B.Fab", "B.SilkS"]
    } else {
        ["F.Fab", "F.SilkS"]
    };
    let mut out = Vec::new();
    for graphic in view.footprint_graphics().filter_map(Result::ok) {
        if graphic.footprint_index != footprint_index {
            continue;
        }
        let Some(layer) = graphic.graphic.layer.as_deref() else {
            continue;
        };
        if !wanted.contains(&layer) {
            continue;
        }
        if let Some(shape) = graphic_shape(&graphic.graphic) {
            out.push(shape);
        }
    }
    out
}

fn graphic_shape(graphic: &PcbGraphic) -> Option<Graphic> {
    let solid = graphic.fill.as_deref() == Some("solid");
    match graphic.kind {
        PcbGraphicKind::Line => {
            let (start, end) = (graphic.start?, graphic.end?);
            Some(Graphic {
                points: vec![Point::from(start), Point::from(end)],
                closed: false,
                fill: false,
            })
        }
        PcbGraphicKind::Rect => {
            let (start, end) = (graphic.start?, graphic.end?);
            Some(Graphic {
                points: rect_ring(start, end),
                closed: true,
                fill: solid,
            })
        }
        PcbGraphicKind::Circle => {
            let (center, end) = (graphic.center?, graphic.end?);
            Some(Graphic {
                points: circle_ring(center, end),
                closed: true,
                fill: solid,
            })
        }
        PcbGraphicKind::Arc => {
            let (start, mid, end) = (graphic.start?, graphic.mid?, graphic.end?);
            Some(Graphic {
                points: geometry::sample_arc(
                    Point::from(start),
                    Point::from(mid),
                    Point::from(end),
                ),
                closed: false,
                fill: false,
            })
        }
        PcbGraphicKind::Poly => {
            let points = polygon_ring(&graphic.polygon_points);
            (points.len() >= 3).then_some(Graphic {
                points,
                closed: true,
                fill: solid,
            })
        }
        PcbGraphicKind::Curve | PcbGraphicKind::Text | PcbGraphicKind::TextBox => None,
    }
}

/// The footprint's courtyard as a board-frame ring, else the pads' envelope,
/// else a small square at the anchor.
pub fn body_ring(
    footprint: &PcbFootprint,
    courtyard: Option<&PlacementsBounds>,
    pads: &[PadFact],
) -> Vec<Point> {
    let at = Point {
        x: footprint.at_x.unwrap_or_default(),
        y: footprint.at_y.unwrap_or_default(),
    };
    let angle = footprint.angle.unwrap_or_default();
    if let Some(courtyard) = courtyard {
        let ring = [
            (courtyard.min_nm.x_nm.0, courtyard.min_nm.y_nm.0),
            (courtyard.max_nm.x_nm.0, courtyard.min_nm.y_nm.0),
            (courtyard.max_nm.x_nm.0, courtyard.max_nm.y_nm.0),
            (courtyard.min_nm.x_nm.0, courtyard.max_nm.y_nm.0),
        ]
        .into_iter()
        .map(|(x, y)| Point {
            x: x as f64 / 1_000_000.0,
            y: y as f64 / 1_000_000.0,
        })
        .collect::<Vec<_>>();
        return to_board(&ring, at, angle);
    }
    let envelope = pads_bounds(pads);
    if !envelope.is_empty() {
        return to_board(&envelope.ring(), at, angle);
    }
    let square = Bounds::around(at, 1.0, 1.0).ring();
    to_board(&square, at, angle)
}

/// A footprint-local ring in KiCad's board frame.
pub fn to_board(ring: &[Point], at: Point, angle: f64) -> Vec<Point> {
    let (sine, cosine) = angle.to_radians().sin_cos();
    ring.iter()
        .map(|point| Point {
            x: at.x + point.x * cosine - point.y * sine,
            y: at.y - point.x * sine - point.y * cosine,
        })
        .collect()
}

/// A board-frame ring in one footprint's frame.
pub fn to_local(ring: &[Point], at: Point, angle: f64) -> Vec<Point> {
    let (sine, cosine) = angle.to_radians().sin_cos();
    ring.iter()
        .map(|point| {
            let dx = point.x - at.x;
            let dy = point.y - at.y;
            Point {
                x: dx * cosine - dy * sine,
                y: -dx * sine - dy * cosine,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn pad(x: f64, y: f64) -> PadFact {
        PadFact {
            number: "1".to_owned(),
            kind: "smd".to_owned(),
            net: "N".to_owned(),
            x,
            y,
            angle: 0.0,
            shape: PadShape::Rect {
                width: 1.0,
                height: 2.0,
            },
        }
    }

    #[test]
    fn a_pads_bounds_is_its_anchored_shape() {
        let bounds = pads_bounds(&[pad(0.0, 0.0)]);
        assert_eq!(bounds.min_x, -0.5);
        assert_eq!(bounds.max_y, 1.0);
    }

    #[test]
    fn a_rotated_pad_grows_to_its_circumscribed_box() {
        let mut rotated = pad(0.0, 0.0);
        rotated.angle = 45.0;
        let bounds = pads_bounds(&[rotated]);
        assert!((bounds.width() - 2.0 * 1.118_033_988_75).abs() < 1e-9);
    }

    #[test]
    fn a_board_ring_round_trips_through_a_footprint_frame() {
        let at = Point { x: 10.0, y: 20.0 };
        let ring = Bounds::around(at, 2.0, 3.0).ring();
        let local = to_local(&ring, at, -90.0);
        let back = to_board(&local, at, -90.0);
        for (left, right) in ring.iter().zip(back.iter()) {
            assert!((left.x - right.x).abs() < 1e-9);
            assert!((left.y - right.y).abs() < 1e-9);
        }
    }

    #[test]
    fn a_rotated_footprints_pad_angle_is_relative_to_the_footprint() {
        // An XAL6060 inductor placed at -90 degrees: the board file stores its
        // pads at 270, which already includes the footprint's rotation.
        let text = r#"(kicad_pcb (version 20240108) (generator "pcbnew")
  (footprint "Inductor_SMD:L_Coilcraft_XAL6060-XXX" (layer "F.Cu") (at 40 60 -90)
    (pad "1" smd roundrect (at -2.02 0 270) (size 1.43 5.5) (layers "F.Cu"))
    (pad "2" smd roundrect (at 2.02 0 270) (size 1.43 5.5) (layers "F.Cu"))))"#;
        let view = PcbView::parse(text, prism_kicad_core::PcbLimits::default()).expect("parses");
        let footprint = view
            .footprints()
            .next()
            .expect("one footprint")
            .expect("decodes");
        let angle = footprint.angle.unwrap_or_default();
        for parsed in view.pads() {
            let fact = pad_fact(&parsed.expect("decodes"), angle);
            assert!(
                (fact.angle.rem_euclid(360.0)).abs() < 1e-9,
                "relative angle {}",
                fact.angle
            );
        }
    }
}
