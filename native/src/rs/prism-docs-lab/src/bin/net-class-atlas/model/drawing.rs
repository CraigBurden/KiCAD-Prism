//! The board-wide drawable facts: traces, vias, zones and footprint bodies,
//! all in board millimetres.

use super::*;

// ---------------------------------------------------------------- drawing

impl Drawing {
    /// Build the drawable board from the parsed board and the projections.
    pub(super) fn build(
        view: &PcbView<'_>,
        board: &geometry::BoardGeometry,
        placements: Option<&PlacementsA1>,
        hlr: Option<&AssemblyHlrA0>,
    ) -> Result<Self, LabError> {
        let footprints = view
            .footprints()
            .collect::<Result<Vec<PcbFootprint>, _>>()
            .map_err(|error| LabError::new(format!("a footprint does not decode: {error}")))?;
        let mut pads: Vec<Vec<Pad>> = (0..footprints.len()).map(|_| Vec::new()).collect();
        for pad in view.pads() {
            let pad =
                pad.map_err(|error| LabError::new(format!("a pad does not decode: {error}")))?;
            if let Some(slot) = pads.get_mut(pad.footprint_index) {
                let footprint_angle = footprints
                    .get(pad.footprint_index)
                    .and_then(|footprint| footprint.angle)
                    .unwrap_or(0.0);
                slot.push(pad_facts(&pad, footprint_angle));
            }
        }
        Ok(Self {
            outline: board.outer.clone(),
            cutouts: board.cutouts.clone(),
            bounds: board_bounds(board),
            traces: traces(view)?,
            vias: vias(view)?,
            zones: zones(view)?,
            footprints: footprints_facts(&footprints, pads, board, placements, hlr),
        })
    }

    /// The extent every drawing must frame: the board's own box unioned with
    /// every body and pad it draws, so a part that overhangs the perimeter (a
    /// side button, a header) is drawn whole instead of clipped at the edge.
    ///
    /// The page adds its margin to this; the drawing never invents a frame of
    /// its own, or a group whose parts sit outside the outline would be cut.
    pub fn frame(&self) -> Bounds {
        let mut frame = self.bounds;
        for footprint in &self.footprints {
            frame.include_bounds(footprint.body_bounds);
            for pad in &footprint.pads {
                frame.include_bounds(pad_bounds(footprint, pad));
            }
        }
        frame
    }
}

/// A pad's extent in board millimetres: its pad-local box, turned with the
/// footprint and offset to the pad's anchor.
///
/// The drawing places pads with `translate(anchor) rotate(-angle)` and one more
/// `rotate(-pad angle)` inside it, so the pad's box turns through the sum of
/// the two angles. Only the axis-aligned envelope is needed here.
pub fn pad_bounds(footprint: &Footprint, pad: &Pad) -> Bounds {
    let (half_width, half_height) = pad_extent(&pad.shape);
    let (sin, cos) = footprint.angle.to_radians().sin_cos();
    let center = Point {
        x: footprint.x + pad.x * cos + pad.y * sin,
        y: footprint.y - pad.x * sin + pad.y * cos,
    };
    let (sin, cos) = (footprint.angle + pad.angle).to_radians().sin_cos();
    Bounds::around(
        center,
        half_width * cos.abs() + half_height * sin.abs(),
        half_width * sin.abs() + half_height * cos.abs(),
    )
}

/// A pad shape's half extents around its anchor, in pad-local millimetres.
fn pad_extent(shape: &PadShape) -> (f64, f64) {
    match shape {
        PadShape::Circle { diameter } => (diameter / 2.0, diameter / 2.0),
        PadShape::Rect { width, height }
        | PadShape::RoundRect { width, height, .. }
        | PadShape::Oval { width, height } => (width / 2.0, height / 2.0),
        PadShape::Outline { rings } => {
            let mut half = (0.0_f64, 0.0_f64);
            for point in rings.iter().flatten() {
                half.0 = half.0.max(point.x.abs());
                half.1 = half.1.max(point.y.abs());
            }
            half
        }
    }
}

/// The viewBox extent: the board-level `Edge.Cuts` box, else the perimeter's.
fn board_bounds(board: &geometry::BoardGeometry) -> Bounds {
    if !board.outline_bounds.is_empty() {
        return board.outline_bounds;
    }
    let mut bounds = Bounds::empty();
    for point in &board.outer {
        bounds.include(*point);
    }
    bounds
}

fn traces(view: &PcbView<'_>) -> Result<Vec<Trace>, LabError> {
    let mut traces = Vec::new();
    for segment in view.segments() {
        let segment =
            segment.map_err(|error| LabError::new(format!("a track does not decode: {error}")))?;
        let Some(layer) = copper_layer(segment.layer.as_deref(), segment.layers.as_deref()) else {
            continue;
        };
        let Some(net) = segment.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        traces.push(Trace {
            net,
            layer,
            width: segment.width.unwrap_or(DEFAULT_TRACE_WIDTH).abs(),
            points: vec![
                Point {
                    x: segment.start_x,
                    y: segment.start_y,
                },
                Point {
                    x: segment.end_x,
                    y: segment.end_y,
                },
            ],
        });
    }
    for arc in view.arcs() {
        let arc =
            arc.map_err(|error| LabError::new(format!("a routing arc does not decode: {error}")))?;
        let Some(layer) = copper_layer(arc.layer.as_deref(), arc.layers.as_deref()) else {
            continue;
        };
        let Some(net) = arc.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        traces.push(Trace {
            net,
            layer,
            width: arc.width.unwrap_or(DEFAULT_TRACE_WIDTH).abs(),
            points: geometry::sample_arc(
                Point {
                    x: arc.start.x,
                    y: arc.start.y,
                },
                Point {
                    x: arc.mid.x,
                    y: arc.mid.y,
                },
                Point {
                    x: arc.end.x,
                    y: arc.end.y,
                },
            ),
        });
    }
    Ok(traces)
}

fn vias(view: &PcbView<'_>) -> Result<Vec<Via>, LabError> {
    let mut vias = Vec::new();
    for via in view.vias() {
        let via = via.map_err(|error| LabError::new(format!("a via does not decode: {error}")))?;
        let Some(net) = via.net.name.clone().filter(|name| !name.is_empty()) else {
            continue;
        };
        vias.push(Via {
            net,
            at: Point {
                x: via.at_x,
                y: via.at_y,
            },
            size: via.size,
            drill: via.drill,
            layers: via
                .layers
                .iter()
                .filter(|layer| palette::copper_color(layer).is_some())
                .cloned()
                .collect(),
        });
    }
    Ok(vias)
}

/// The copper layer a routed object is on: its `(layer …)`, else the first
/// copper entry of its plural `(layers …)`.
fn copper_layer(layer: Option<&str>, layers: Option<&[String]>) -> Option<String> {
    if let Some(layer) = layer.filter(|layer| palette::copper_color(layer).is_some()) {
        return Some(layer.to_owned());
    }
    layers?
        .iter()
        .find(|layer| palette::copper_color(layer).is_some())
        .cloned()
}

fn zones(view: &PcbView<'_>) -> Result<Vec<Zone>, LabError> {
    let mut zones = Vec::new();
    for zone in view.zones() {
        let zone =
            zone.map_err(|error| LabError::new(format!("a zone does not decode: {error}")))?;
        let Some(net) = zone
            .net
            .name
            .clone()
            .or_else(|| zone.net_name.clone())
            .filter(|name| !name.is_empty())
        else {
            continue;
        };
        if !zone.filled_polygons.is_empty() {
            for polygon in &zone.filled_polygons {
                if palette::copper_color(&polygon.layer).is_none() || polygon.points.len() < 3 {
                    continue;
                }
                zones.push(Zone {
                    net: net.clone(),
                    layer: polygon.layer.clone(),
                    rings: vec![
                        polygon
                            .points
                            .iter()
                            .map(|point| Point::from(*point))
                            .collect(),
                    ],
                    filled: true,
                });
            }
            continue;
        }
        for layer in zone
            .layers
            .iter()
            .filter(|layer| palette::copper_color(layer).is_some())
        {
            for polygon in &zone.polygons {
                let ring = zone_ring(polygon);
                if ring.len() >= 3 {
                    zones.push(Zone {
                        net: net.clone(),
                        layer: layer.clone(),
                        rings: vec![ring],
                        filled: false,
                    });
                }
            }
        }
    }
    Ok(zones)
}

/// An authored zone outline as one ring, arcs sampled through their midpoints.
fn zone_ring(polygon: &PcbZonePolygon) -> Vec<Point> {
    let count = polygon.points.len();
    let arcs: BTreeMap<usize, Point> = polygon
        .arcs
        .iter()
        .map(|arc| (arc.start_index, Point::from(arc.mid)))
        .collect();
    let mut ring = Vec::with_capacity(count);
    for (index, point) in polygon.points.iter().enumerate() {
        let start = Point::from(*point);
        ring.push(start);
        let Some(mid) = arcs.get(&index) else {
            continue;
        };
        let end = Point::from(polygon.points[(index + 1) % count]);
        let sampled = geometry::sample_arc(start, *mid, end);
        if sampled.len() > 2 {
            ring.extend_from_slice(&sampled[1..sampled.len() - 1]);
        }
    }
    ring
}

fn footprints_facts(
    footprints: &[PcbFootprint],
    pads: Vec<Vec<Pad>>,
    board: &geometry::BoardGeometry,
    placements: Option<&PlacementsA1>,
    hlr: Option<&AssemblyHlrA0>,
) -> Vec<Footprint> {
    let placed: BTreeMap<&str, &PlacementsFootprint> = placements
        .map(|placements| {
            placements
                .footprints
                .iter()
                .map(|footprint| (footprint.uuid.0.as_str(), footprint))
                .collect()
        })
        .unwrap_or_default();
    let bodies: BTreeMap<
        &str,
        &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint,
    > = hlr
        .map(|hlr| {
            hlr.footprints
                .iter()
                .map(|footprint| (footprint.uuid.0.as_str(), footprint))
                .collect()
        })
        .unwrap_or_default();
    footprints
        .iter()
        .enumerate()
        .map(|(index, footprint)| {
            let uuid = footprint.uuid.clone().unwrap_or_default();
            let placement = placed.get(uuid.as_str()).copied();
            let body = bodies.get(uuid.as_str()).copied();
            let mut result = Footprint {
                index,
                reference: reference(footprint, placement),
                side: side(footprint, placement),
                x: footprint.at_x.unwrap_or(0.0),
                y: footprint.at_y.unwrap_or(0.0),
                angle: footprint.angle.unwrap_or(0.0),
                pads: pads.get(index).cloned().unwrap_or_default(),
                body: Body::Envelope(Vec::new()),
                body_bounds: Bounds::empty(),
                nets: BTreeSet::new(),
            };
            result.body = body_of(&result, placement, body, board);
            result.body_bounds = body_bounds(&result.body);
            result.nets = result
                .pads
                .iter()
                .map(|pad| pad.net.clone())
                .filter(|net| !net.is_empty())
                .collect();
            result
        })
        .collect()
}

fn reference(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> String {
    placement
        .and_then(|placement| placement.reference.as_ref())
        .map(|reference| reference.as_str().to_owned())
        .or_else(|| footprint.reference.clone())
        .filter(|reference| !reference.is_empty())
        .unwrap_or_else(|| "?".to_owned())
}

fn side(footprint: &PcbFootprint, placement: Option<&PlacementsFootprint>) -> Side {
    match placement.map(|placement| placement.side) {
        Some(PlacementSide::Back) => Side::Bottom,
        Some(PlacementSide::Front) => Side::Top,
        None => match footprint.layer.as_deref() {
            Some(layer) if layer.starts_with("B.") => Side::Bottom,
            _ => Side::Top,
        },
    }
}

/// The body to draw: the HLR outline, else the courtyard, else the pads'
/// envelope.
fn body_of(
    footprint: &Footprint,
    placement: Option<&PlacementsFootprint>,
    hlr: Option<&prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint>,
    board: &geometry::BoardGeometry,
) -> Body {
    if let Some(outline) = hlr
        .and_then(|hlr| hlr.outline.as_ref())
        .filter(|outline| !outline.segments.is_empty() || !outline.arcs.is_empty())
    {
        return Body::Edges(outline.clone());
    }
    if let Some(courtyard) = placement.and_then(|placement| placement.courtyard_bounds.as_ref()) {
        return Body::Envelope(courtyard_ring(footprint, courtyard));
    }
    match board.pad_envelopes.get(&footprint.index) {
        Some(bounds) => Body::Envelope(bounds.ring()),
        None => Body::Envelope(Vec::new()),
    }
}

/// A courtyard box (footprint-local nanometres) as a board-frame ring.
fn courtyard_ring(
    footprint: &Footprint,
    courtyard: &prism_kicad_contracts::generated::prism_placements_a1::PlacementsBounds,
) -> Vec<Point> {
    let corners = [
        (courtyard.min_nm.x_nm.0, courtyard.min_nm.y_nm.0),
        (courtyard.max_nm.x_nm.0, courtyard.min_nm.y_nm.0),
        (courtyard.max_nm.x_nm.0, courtyard.max_nm.y_nm.0),
        (courtyard.min_nm.x_nm.0, courtyard.max_nm.y_nm.0),
    ];
    let (sin, cos) = footprint.angle.to_radians().sin_cos();
    corners
        .into_iter()
        .map(|(x, y)| {
            let x = x as f64 / 1_000_000.0;
            let y = y as f64 / 1_000_000.0;
            Point {
                x: footprint.x + x * cos + y * sin,
                y: footprint.y - x * sin + y * cos,
            }
        })
        .collect()
}

/// The extent of a body, for placing its designator.
pub fn body_bounds(body: &Body) -> Bounds {
    let mut bounds = Bounds::empty();
    match body {
        Body::Envelope(ring) => {
            for point in ring {
                bounds.include(*point);
            }
        }
        Body::Edges(edges) => {
            for segment in &edges.segments {
                for point in [&segment.start_nm, &segment.end_nm] {
                    bounds.include(nm(point.x_nm.0, point.y_nm.0));
                }
            }
            for arc in &edges.arcs {
                for point in geometry::arc_points(arc) {
                    bounds.include(point);
                }
            }
        }
    }
    bounds
}

fn nm(x: i64, y: i64) -> Point {
    Point {
        x: x as f64 / 1_000_000.0,
        y: y as f64 / 1_000_000.0,
    }
}
