//! Source-neutral assembly-designator fitting.
//!
//! Harvested from the fork's Rust `pcb_svg/designator_layout.rs` (MIT,
//! kicad-cruncher-cli), itself a port of PCB Autodoc: build the body region as
//! a polygon, try the vertex centroid, an interior point and a 4×4 grid of
//! candidate centres, binary-search the largest font whose text box the
//! region covers, and cache fits by translated geometry. The advance ratio
//! (`0.62` per character) is the one Cruncher's Python uses
//! (`kicad_cruncher_cmd_pcb_svg.py`, `_assembly_designator_font_size`).

use std::collections::HashMap;

use geo::{
    Area, BooleanOps, BoundingRect, Buffer, Centroid, Coord, Covers, InteriorPoint, LineString,
    MultiPolygon, Point, Polygon, Rect, Translate,
};

use super::geometry::Point as MmPoint;

const TEXT_ADVANCE_PER_CHARACTER: f64 = 0.62;
const CENTER_GRID_DIVISIONS: usize = 4;
const BINARY_SEARCH_STEPS: usize = 12;

#[derive(Clone, Copy, Debug, PartialEq)]
pub(crate) struct DesignatorFit {
    pub center: MmPoint,
    pub font_size_mm: f64,
    pub rotation_deg: f64,
}

#[derive(Clone, Debug, Eq, Hash, PartialEq)]
struct FitKey {
    geometry: Vec<i64>,
    text_aspect: i64,
    rotations: Vec<i64>,
    fill_ratio: i64,
    maximum_font_size_mm: i64,
    /// The body inset the box must keep clear, in drawing millimetres.
    inset_mm: i64,
}

#[derive(Default)]
pub(crate) struct DesignatorFitSession {
    fits: HashMap<FitKey, Option<DesignatorFit>>,
    pub hits: usize,
    pub misses: usize,
}

impl DesignatorFitSession {
    /// Fit `designator` inside `region`, keeping the text box at least
    /// `inset_mm` from the region's boundary so it clears the body outline.
    pub fn fit(
        &mut self,
        designator: &str,
        region: &MultiPolygon<f64>,
        fill_ratio: f64,
        maximum_font_size_mm: f64,
        rotations: &[f64],
        inset_mm: f64,
    ) -> Option<DesignatorFit> {
        let bounds = region.bounding_rect()?;
        let anchor = [bounds.min().x, bounds.min().y];
        let relative = region.translate(-anchor[0], -anchor[1]);
        let rotations: Vec<f64> = if rotations.is_empty() {
            vec![0.0]
        } else {
            rotations.iter().copied().map(normalize_axis).collect()
        };
        let text_aspect = (designator.chars().count() as f64 * TEXT_ADVANCE_PER_CHARACTER).max(1.0);
        let inset_mm = inset_mm.max(0.0);
        let key = FitKey {
            geometry: geometry_key(&relative),
            text_aspect: quantize(text_aspect),
            rotations: rotations.iter().copied().map(quantize).collect(),
            fill_ratio: quantize(fill_ratio.clamp(0.05, 1.0)),
            maximum_font_size_mm: quantize(maximum_font_size_mm.max(0.0)),
            inset_mm: quantize(inset_mm),
        };
        let relative_fit = if let Some(cached) = self.fits.get(&key) {
            self.hits += 1;
            *cached
        } else {
            self.misses += 1;
            let fitted = fit_uncached(
                &relative,
                text_aspect,
                fill_ratio.clamp(0.05, 1.0),
                maximum_font_size_mm.max(0.0),
                &rotations,
                inset_mm,
            );
            self.fits.insert(key, fitted);
            fitted
        }?;
        Some(DesignatorFit {
            center: MmPoint {
                x: relative_fit.center.x + anchor[0],
                y: relative_fit.center.y + anchor[1],
            },
            ..relative_fit
        })
    }
}

pub(crate) fn normalize_axis(angle_degrees: f64) -> f64 {
    let normalized = (angle_degrees + 90.0).rem_euclid(180.0) - 90.0;
    if normalized.abs() <= 1.0e-12 {
        0.0
    } else {
        normalized
    }
}

/// Build the fitting region from closed rings with SVG's even-odd rule.
pub(crate) fn region_from_rings(rings: &[Vec<MmPoint>]) -> Option<MultiPolygon<f64>> {
    let mut region = MultiPolygon::new(Vec::new());
    for ring in rings {
        let polygon = ring_polygon(ring)?;
        region = if region.0.is_empty() {
            MultiPolygon::new(vec![polygon])
        } else {
            region.xor(&polygon)
        };
    }
    (!region.0.is_empty()).then_some(region)
}

/// A closed rectangular envelope, the hole and pad fallback regions.
pub(crate) fn ring_polygon(points: &[MmPoint]) -> Option<Polygon<f64>> {
    if points.len() < 3 {
        return None;
    }
    let mut coordinates = points
        .iter()
        .map(|point| Coord {
            x: point.x,
            y: point.y,
        })
        .collect::<Vec<_>>();
    if coordinates.first() != coordinates.last() {
        coordinates.push(coordinates[0]);
    }
    let polygon = Polygon::new(LineString::new(coordinates), Vec::new());
    (polygon.unsigned_area() > 1.0e-12).then_some(polygon)
}

/// The four corners of the text box a fit would draw, in the board frame.
pub(crate) fn text_box(
    designator: &str,
    center: MmPoint,
    font_size_mm: f64,
    rotation_deg: f64,
) -> [MmPoint; 4] {
    let half_width =
        designator.chars().count().max(1) as f64 * TEXT_ADVANCE_PER_CHARACTER * font_size_mm / 2.0;
    let half_height = font_size_mm / 2.0;
    let angle = rotation_deg.to_radians();
    let (sin, cos) = angle.sin_cos();
    [
        (-half_width, -half_height),
        (half_width, -half_height),
        (half_width, half_height),
        (-half_width, half_height),
    ]
    .map(|(x, y)| MmPoint {
        x: center.x + x * cos - y * sin,
        y: center.y + x * sin + y * cos,
    })
}

/// True when the fitted text box lies inside `region` with `inset_mm` to spare.
pub(crate) fn text_box_fits_region(
    region: &MultiPolygon<f64>,
    designator: &str,
    fit: DesignatorFit,
    inset_mm: f64,
) -> bool {
    let corners = text_box(designator, fit.center, fit.font_size_mm, fit.rotation_deg);
    let Some(rectangle) = ring_polygon(&corners) else {
        return false;
    };
    rectangle_fits_region(region, &rectangle, inset_mm)
}

/// True when every point of `rectangle` is at least `inset_mm` inside
/// `region`: the box is offset outwards by the inset and must still fit.
fn rectangle_fits_region(
    region: &MultiPolygon<f64>,
    rectangle: &Polygon<f64>,
    inset_mm: f64,
) -> bool {
    if inset_mm <= 0.0 {
        return region.covers(rectangle);
    }
    let inset = rectangle.buffer(inset_mm);
    !inset.0.is_empty() && region.covers(&inset)
}

/// The convex hull of projected HLR ring points, a forgiving region for open
/// edge sets.
fn fit_uncached(
    region: &MultiPolygon<f64>,
    text_aspect: f64,
    fill_ratio: f64,
    maximum_font_size_mm: f64,
    rotations: &[f64],
    inset_mm: f64,
) -> Option<DesignatorFit> {
    let centers = candidate_centers(region);
    let mut best = None;
    for &rotation in rotations {
        let (raw_font, center) =
            largest_font_at_candidates(region, &centers, text_aspect, rotation, inset_mm)?;
        let candidate = DesignatorFit {
            center,
            font_size_mm: maximum_font_size_mm.min(raw_font * fill_ratio),
            rotation_deg: rotation,
        };
        if candidate.font_size_mm <= 0.0 {
            continue;
        }
        if best.is_none_or(|current: DesignatorFit| {
            candidate.font_size_mm > current.font_size_mm + 1.0e-6
                || ((candidate.font_size_mm - current.font_size_mm).abs() <= 1.0e-6
                    && candidate.rotation_deg.abs() < current.rotation_deg.abs())
        }) {
            best = Some(candidate);
        }
    }
    best
}

fn candidate_centers(region: &MultiPolygon<f64>) -> Vec<MmPoint> {
    let Some(bounds) = region.bounding_rect() else {
        return Vec::new();
    };
    let mut candidates = Vec::new();
    if let Some(point) = region.centroid() {
        add_candidate(region, &mut candidates, point);
    }
    if let Some(point) = region.interior_point() {
        add_candidate(region, &mut candidates, point);
    }
    add_candidate(region, &mut candidates, rect_center(bounds));
    let mut parts = region.0.iter().collect::<Vec<_>>();
    parts.sort_by(|left, right| {
        polygon_bounds_key(left)
            .partial_cmp(&polygon_bounds_key(right))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    for part in parts {
        if let Some(point) = part.centroid() {
            add_candidate(region, &mut candidates, point);
        }
        if let Some(point) = part.interior_point() {
            add_candidate(region, &mut candidates, point);
        }
        if let Some(bounds) = part.bounding_rect() {
            add_candidate(region, &mut candidates, rect_center(bounds));
        }
    }
    for x_index in 1..CENTER_GRID_DIVISIONS {
        let x = bounds.min().x + bounds.width() * x_index as f64 / CENTER_GRID_DIVISIONS as f64;
        for y_index in 1..CENTER_GRID_DIVISIONS {
            let y =
                bounds.min().y + bounds.height() * y_index as f64 / CENTER_GRID_DIVISIONS as f64;
            add_candidate(region, &mut candidates, Point::new(x, y));
        }
    }
    candidates
}

fn add_candidate(region: &MultiPolygon<f64>, candidates: &mut Vec<MmPoint>, point: Point<f64>) {
    let candidate = MmPoint {
        x: point.x(),
        y: point.y(),
    };
    if region.covers(&point)
        && !candidates.iter().any(|existing| {
            (existing.x - candidate.x).abs() <= 1.0e-12
                && (existing.y - candidate.y).abs() <= 1.0e-12
        })
    {
        candidates.push(candidate);
    }
}

fn largest_font_at_candidates(
    region: &MultiPolygon<f64>,
    centers: &[MmPoint],
    text_aspect: f64,
    rotation_degrees: f64,
    inset_mm: f64,
) -> Option<(f64, MmPoint)> {
    let bounds = region.bounding_rect()?;
    let upper_bound = bounds.width().max(bounds.height());
    let mut best_font = 0.0;
    let mut best_center = *centers.first()?;
    for &center in centers {
        let mut low = 0.0;
        let mut high = upper_bound;
        for _ in 0..BINARY_SEARCH_STEPS {
            let font_size = (low + high) / 2.0;
            if text_box_fits(
                region,
                center,
                font_size,
                text_aspect,
                rotation_degrees,
                inset_mm,
            ) {
                low = font_size;
            } else {
                high = font_size;
            }
        }
        if low > best_font + 1.0e-9 {
            best_font = low;
            best_center = center;
        }
    }
    Some((best_font, best_center))
}

fn text_box_fits(
    region: &MultiPolygon<f64>,
    center: MmPoint,
    font_size: f64,
    text_aspect: f64,
    rotation_degrees: f64,
    inset_mm: f64,
) -> bool {
    let half_width = text_aspect * font_size / 2.0;
    let half_height = font_size / 2.0;
    let angle = rotation_degrees.to_radians();
    let (sin, cos) = angle.sin_cos();
    let corners = [
        (-half_width, -half_height),
        (half_width, -half_height),
        (half_width, half_height),
        (-half_width, half_height),
    ]
    .map(|(x, y)| MmPoint {
        x: center.x + x * cos - y * sin,
        y: center.y + x * sin + y * cos,
    });
    let Some(rectangle) = ring_polygon(&corners) else {
        return false;
    };
    rectangle_fits_region(region, &rectangle, inset_mm)
}

fn rect_center(bounds: Rect<f64>) -> Point<f64> {
    Point::new(
        (bounds.min().x + bounds.max().x) / 2.0,
        (bounds.min().y + bounds.max().y) / 2.0,
    )
}

fn polygon_bounds_key(polygon: &Polygon<f64>) -> [f64; 5] {
    let bounds = polygon
        .bounding_rect()
        .expect("non-empty fitted polygon has bounds");
    [
        bounds.min().x,
        bounds.min().y,
        bounds.max().x,
        bounds.max().y,
        polygon.unsigned_area(),
    ]
}

fn geometry_key(region: &MultiPolygon<f64>) -> Vec<i64> {
    let mut result = Vec::new();
    for polygon in &region.0 {
        append_ring_key(&mut result, polygon.exterior());
        result.push(i64::MIN);
        for interior in polygon.interiors() {
            append_ring_key(&mut result, interior);
            result.push(i64::MIN + 1);
        }
        result.push(i64::MAX);
    }
    result
}

fn append_ring_key(result: &mut Vec<i64>, ring: &LineString<f64>) {
    for coordinate in ring.coords() {
        result.push(quantize(coordinate.x));
        result.push(quantize(coordinate.y));
    }
}

fn quantize(value: f64) -> i64 {
    let scaled = (value * 1_000_000_000.0).round();
    if scaled == 0.0 { 0 } else { scaled as i64 }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rectangle(x: f64, y: f64, width: f64, height: f64) -> Vec<MmPoint> {
        vec![
            MmPoint { x, y },
            MmPoint { x: x + width, y },
            MmPoint {
                x: x + width,
                y: y + height,
            },
            MmPoint { x, y: y + height },
        ]
    }

    #[test]
    fn disconnected_body_fit_matches_autodoc_long_axis_and_cap_tie() {
        let region = region_from_rings(&[
            rectangle(0.0, 0.0, 1.0, 1.0),
            rectangle(10.0, 0.0, 1.0, 4.0),
        ])
        .unwrap();
        let mut session = DesignatorFitSession::default();
        let fit = session
            .fit("R100", &region, 0.8, 2.5, &[0.0, -90.0], 0.0)
            .unwrap();
        assert_eq!(fit.rotation_deg, -90.0);
        assert!(fit.center.x > 10.0 && fit.center.x < 11.0);
        assert!((fit.font_size_mm - 0.8).abs() < 0.01);
        let capped = session.fit("R100", &region, 0.8, 0.1, &[0.0], 0.0).unwrap();
        assert_eq!(capped.rotation_deg, 0.0);
    }

    #[test]
    fn a_fitted_box_lies_inside_its_region() {
        let region = region_from_rings(&[rectangle(0.0, 0.0, 4.0, 2.0)]).unwrap();
        let mut session = DesignatorFitSession::default();
        let fit = session
            .fit("TP12", &region, 0.8, 3.5, &[0.0, -90.0], 0.0)
            .unwrap();
        assert!(text_box_fits_region(&region, "TP12", fit, 0.0));
        assert!(fit.font_size_mm >= 0.5);
    }

    #[test]
    fn a_positive_inset_keeps_the_box_clear_of_the_boundary() {
        let region = region_from_rings(&[rectangle(0.0, 0.0, 4.0, 2.0)]).unwrap();
        let mut session = DesignatorFitSession::default();
        let fit = session.fit("R1", &region, 0.8, 2.5, &[0.0], 0.25).unwrap();
        assert!(text_box_fits_region(&region, "R1", fit, 0.25));
        for corner in text_box("R1", fit.center, fit.font_size_mm, fit.rotation_deg) {
            assert!(
                corner.x >= 0.25 - 1.0e-9
                    && corner.x <= 3.75 + 1.0e-9
                    && corner.y >= 0.25 - 1.0e-9
                    && corner.y <= 1.75 + 1.0e-9,
                "corner {corner:?} is not inside the inset body"
            );
        }
    }

    #[test]
    fn translated_geometry_reuses_one_fit() {
        let region = region_from_rings(&[rectangle(0.0, 0.0, 4.0, 2.0)]).unwrap();
        let translated = region.translate(17.0, -23.0);
        let mut session = DesignatorFitSession::default();
        let first = session.fit("J1", &region, 0.8, 2.5, &[0.0], 0.0).unwrap();
        let second = session
            .fit("J1", &translated, 0.8, 2.5, &[0.0], 0.0)
            .unwrap();
        assert!((second.center.x - (first.center.x + 17.0)).abs() < 1.0e-9);
        assert!((second.center.y - (first.center.y - 23.0)).abs() < 1.0e-9);
        assert_eq!(first.font_size_mm, second.font_size_mm);
        assert_eq!(session.hits, 1);
    }
}
