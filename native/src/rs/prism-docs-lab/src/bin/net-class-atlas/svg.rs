//! One net class's board drawing: traces, vias, zone fills, pads and bodies in
//! stack order, in a millimetre `viewBox` so the real widths show.
//!
//! Coordinates are board millimetres with +y down, which is exactly SVG's
//! frame, so nothing is flipped. A footprint's transform is
//! `translate(anchor) rotate(-angle)` (KiCad's counter-clockwise board angle in
//! a y-down frame) and a pad's is one more `rotate(-angle)` inside it.

use std::collections::BTreeMap;
use std::fmt::Write;

use prism_artwork::artwork::geometry::{Bounds, Point};
use prism_artwork::artwork::svg::{escape, number, ring_path};

use super::model::{Atlas, Body, ClassSection, Footprint, Pad, PadShape, SideChoice, Trace, Zone};
use prism_docs_lab::palette;

/// Margin around the board outline, millimetres.
const MARGIN_MM: f64 = 2.0;
/// The largest designator size in board millimetres.
const DESIGNATOR_MAX_MM: f64 = 1.2;
/// The smallest, for footprints too small to hold bigger text.
const DESIGNATOR_MIN_MM: f64 = 0.5;
/// Board outline and via ring stroke width.
const OUTLINE_MM: f64 = 0.15;
/// Body outline stroke width.
const BODY_MM: f64 = 0.1;
/// Ghost body outline stroke width.
const GHOST_MM: f64 = 0.08;

/// Render `section`'s drawing of `atlas`'s board.
pub fn class_drawing(atlas: &Atlas, section: &ClassSection, side: SideChoice) -> String {
    let bounds = expanded(atlas.drawing.bounds);
    let mut svg = String::new();
    let _ = writeln!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"atlas-drawing\" role=\"img\" \
viewBox=\"{} {} {} {}\" preserveAspectRatio=\"xMidYMid meet\" aria-label=\"{} tracks by layer\">",
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.width().max(0.001)),
        number(bounds.height().max(0.001)),
        escape(&section.name),
    );
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"#ffffff\"/>",
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.width().max(0.001)),
        number(bounds.height().max(0.001)),
    );
    // Back to front, so F.Cu paints last and sits on top.
    for layer in atlas.copper.iter().rev() {
        let Some(color) = palette::copper_color(layer) else {
            continue;
        };
        let _ = writeln!(svg, "<g class=\"layer\" data-layer=\"{}\">", escape(layer));
        layer_zones(&mut svg, atlas, section, layer, color);
        layer_traces(&mut svg, atlas, section, layer, color);
        svg.push_str("</g>\n");
    }
    footprints(&mut svg, atlas, section, side);
    vias(&mut svg, atlas, section);
    board_outline(&mut svg, atlas);
    svg.push_str("</svg>\n");
    svg
}

/// The board extent plus the drawing margin.
fn expanded(bounds: Bounds) -> Bounds {
    Bounds {
        min_x: bounds.min_x - MARGIN_MM,
        min_y: bounds.min_y - MARGIN_MM,
        max_x: bounds.max_x + MARGIN_MM,
        max_y: bounds.max_y + MARGIN_MM,
    }
}

// ------------------------------------------------------------------- traces

fn layer_traces(svg: &mut String, atlas: &Atlas, section: &ClassSection, layer: &str, color: &str) {
    let traces: Vec<&Trace> = atlas
        .drawing
        .traces
        .iter()
        .filter(|trace| trace.layer == layer && section.net_names.contains(&trace.net))
        .collect();
    let mut groups: BTreeMap<(String, u64), Vec<&Trace>> = BTreeMap::new();
    for trace in traces {
        groups
            .entry((trace.net.clone(), trace.width.to_bits()))
            .or_default()
            .push(trace);
    }
    for ((net, _), traces) in groups {
        let Some(width) = traces.first().map(|trace| trace.width) else {
            continue;
        };
        let mut path = String::new();
        for trace in &traces {
            push_polyline(&mut path, &trace.points);
        }
        let _ = writeln!(
            svg,
            "<g class=\"track\" data-net=\"{}\" data-layer=\"{}\"><title>{}</title>\
<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\" stroke-linecap=\"round\" \
stroke-linejoin=\"round\"/></g>",
            escape(&net),
            escape(layer),
            escape(&net),
            path,
            escape(color),
            number(width.max(0.01)),
        );
    }
}

fn push_polyline(path: &mut String, points: &[Point]) {
    for (index, point) in points.iter().enumerate() {
        let command = if index == 0 { 'M' } else { 'L' };
        let _ = write!(path, "{command}{} {} ", number(point.x), number(point.y));
    }
}

// -------------------------------------------------------------------- zones

fn layer_zones(svg: &mut String, atlas: &Atlas, section: &ClassSection, layer: &str, color: &str) {
    let zones: Vec<&Zone> = atlas
        .drawing
        .zones
        .iter()
        .filter(|zone| zone.layer == layer && section.net_names.contains(&zone.net))
        .collect();
    let mut groups: BTreeMap<(&str, bool), Vec<&Zone>> = BTreeMap::new();
    for zone in zones {
        groups
            .entry((zone.net.as_str(), zone.filled))
            .or_default()
            .push(zone);
    }
    for ((net, filled), zones) in groups {
        let rings: Vec<Vec<Point>> = zones
            .iter()
            .flat_map(|zone| zone.rings.iter().cloned())
            .collect();
        let path = prism_artwork::artwork::svg::rings_path(&rings);
        let net = escape(net);
        if filled {
            let _ = writeln!(
                svg,
                "<g class=\"zone\" data-net=\"{net}\"><title>{net}</title>\
<path d=\"{path}\" fill=\"{color}\" fill-opacity=\"0.25\" fill-rule=\"evenodd\" stroke=\"none\"/></g>",
                color = escape(color),
            );
        } else {
            let _ = writeln!(
                svg,
                "<g class=\"zone zone-outline\" data-net=\"{net}\"><title>{net}</title>\
<path d=\"{path}\" fill=\"none\" stroke=\"{color}\" stroke-width=\"0.12\" \
stroke-dasharray=\"0.8 0.5\" opacity=\"0.7\"/></g>",
                color = escape(color),
            );
        }
    }
}

// --------------------------------------------------------------- footprints

fn footprints(svg: &mut String, atlas: &Atlas, section: &ClassSection, side: SideChoice) {
    let connected: Vec<usize> = section.footprints.clone();
    for footprint in &atlas.drawing.footprints {
        if !connected.contains(&footprint.index) {
            ghost(svg, footprint);
        }
    }
    let mut designators = String::new();
    for footprint in &atlas.drawing.footprints {
        if connected.contains(&footprint.index) && side.full(footprint.side) {
            full(svg, footprint, section, atlas);
            designator(&mut designators, footprint);
        }
    }
    svg.push_str(&designators);
}

fn full(svg: &mut String, footprint: &Footprint, section: &ClassSection, atlas: &Atlas) {
    let _ = writeln!(
        svg,
        "<g class=\"fp fp-{}\" transform=\"translate({} {}) rotate({})\">",
        footprint.side.as_str(),
        number(footprint.x),
        number(footprint.y),
        number(-footprint.angle),
    );
    body_path(svg, &footprint.body, palette::INK, BODY_MM);
    layer_pads(svg, footprint, section, atlas);
    svg.push_str("</g>\n");
}

fn layer_pads(svg: &mut String, footprint: &Footprint, section: &ClassSection, atlas: &Atlas) {
    let _ = writeln!(svg, "<g class=\"pads side-{}\">", footprint.side.as_str());
    for pad in &footprint.pads {
        let connected = !pad.net.is_empty() && section.net_names.contains(&pad.net);
        let color = if connected {
            pad_color(pad, &atlas.copper)
        } else {
            palette::RULE
        };
        let _ = write!(
            svg,
            "<g class=\"pad\" data-net=\"{}\" data-layers=\"{}\" fill=\"{}\" \
transform=\"translate({} {}) rotate({})\"{}>",
            escape(&pad.net),
            escape(&pad_layers(pad)),
            escape(color),
            number(pad.x),
            number(pad.y),
            number(-pad.angle),
            if connected {
                " fill-opacity=\"0.6\""
            } else {
                ""
            },
        );
        pad_shape(svg, &pad.shape);
        svg.push_str("</g>");
    }
    svg.push_str("</g>\n");
}

fn ghost(svg: &mut String, footprint: &Footprint) {
    let _ = write!(svg, "<g class=\"fp ghost fp-{}\">", footprint.side.as_str(),);
    body_path(svg, &footprint.body, palette::RULE, GHOST_MM);
    svg.push_str("</g>\n");
}

/// The body as one stroked group. The stroke lives on the group, not the path,
/// so the stylesheet's side rules (a class selector) can override it.
fn body_path(svg: &mut String, body: &Body, color: &str, width: f64) {
    let path = match body {
        Body::Envelope(ring) if ring.len() >= 3 => ring_path(ring),
        Body::Envelope(_) => String::new(),
        Body::Edges(edges) => edges_path(edges),
    };
    if path.is_empty() {
        return;
    }
    let _ = write!(
        svg,
        "<g class=\"body\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\" \
stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"{}\"/></g>",
        escape(color),
        number(width),
        path,
    );
}

/// The HLR edges as one stroked path; arcs are sampled through their centre.
fn edges_path(
    edges: &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrEdges,
) -> String {
    let mut path = String::new();
    for segment in &edges.segments {
        let start = nm(segment.start_nm.x_nm.0, segment.start_nm.y_nm.0);
        let end = nm(segment.end_nm.x_nm.0, segment.end_nm.y_nm.0);
        let _ = write!(
            path,
            "M{} {} L{} {} ",
            number(start.x),
            number(start.y),
            number(end.x),
            number(end.y),
        );
    }
    for arc in &edges.arcs {
        push_polyline(
            &mut path,
            &prism_artwork::artwork::geometry::arc_points(arc),
        );
    }
    path
}

fn nm(x: i64, y: i64) -> Point {
    Point {
        x: x as f64 / 1_000_000.0,
        y: y as f64 / 1_000_000.0,
    }
}

/// The pad's colour: the first of its copper layers in stack order, else front
/// copper (a pad with no authored layer mask behaves as through-hole).
fn pad_color<'a>(pad: &Pad, copper: &'a [String]) -> &'a str {
    let layers = pad_layers_vec(pad);
    copper
        .iter()
        .find(|layer| layers.contains(layer))
        .and_then(|layer| palette::copper_color(layer))
        .unwrap_or(palette::F_CU)
}

/// The pad's copper layers for the toggle: authored copper, else both sides.
fn pad_layers_vec(pad: &Pad) -> Vec<String> {
    let copper = palette::copper_layers(&pad.layers);
    if copper.is_empty() {
        vec!["F.Cu".to_owned(), "B.Cu".to_owned()]
    } else {
        copper
    }
}

fn pad_layers(pad: &Pad) -> String {
    pad_layers_vec(pad).join(" ")
}

fn pad_shape(svg: &mut String, shape: &PadShape) {
    match shape {
        PadShape::Circle { diameter } => {
            let _ = write!(svg, "<circle r=\"{}\"/>", number(diameter / 2.0));
        }
        PadShape::Rect { width, height } => {
            rect(svg, *width, *height, 0.0);
        }
        PadShape::RoundRect {
            width,
            height,
            radius,
        } => {
            rect(svg, *width, *height, *radius);
        }
        PadShape::Oval { width, height } => {
            rect(svg, *width, *height, width.min(*height) / 2.0);
        }
        PadShape::Custom {
            width,
            height,
            anchor_circle,
            rings,
        } => {
            if *anchor_circle {
                let _ = write!(svg, "<circle r=\"{}\"/>", number(width.min(*height) / 2.0));
            } else {
                rect(svg, *width, *height, 0.0);
            }
            if !rings.is_empty() {
                let _ = write!(
                    svg,
                    "<path d=\"{}\" fill-rule=\"evenodd\" stroke=\"none\"/>",
                    prism_artwork::artwork::svg::rings_path(rings),
                );
            }
        }
    }
}

fn rect(svg: &mut String, width: f64, height: f64, radius: f64) {
    let _ = write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\"",
        number(-width / 2.0),
        number(-height / 2.0),
        number(width),
        number(height),
    );
    if radius > 0.0 {
        let _ = write!(
            svg,
            " rx=\"{}\"",
            number(radius.min(width.min(height) / 2.0))
        );
    }
    svg.push_str("/>");
}

/// The designator's size: a share of the body's height, so a 0603 and a BGA
/// both read, clamped so it stays legible and never dominates the drawing.
fn designator_size(footprint: &Footprint) -> f64 {
    if footprint.body_bounds.is_empty() {
        return DESIGNATOR_MIN_MM;
    }
    (0.45 * footprint.body_bounds.height()).clamp(DESIGNATOR_MIN_MM, DESIGNATOR_MAX_MM)
}

/// The designator, upright above the body, in the page's sans face.
fn designator(svg: &mut String, footprint: &Footprint) {
    let anchor = if footprint.body_bounds.is_empty() {
        Point {
            x: footprint.x,
            y: footprint.y,
        }
    } else {
        Point {
            x: (footprint.body_bounds.min_x + footprint.body_bounds.max_x) / 2.0,
            y: footprint.body_bounds.min_y - 0.35,
        }
    };
    let _ = writeln!(
        svg,
        "<text class=\"des side-{}\" x=\"{}\" y=\"{}\" font-family=\"Geist, Inter, \
system-ui, sans-serif\" font-size=\"{}\" font-weight=\"500\" fill=\"#1d1d1f\" \
text-anchor=\"middle\">{}</text>",
        footprint.side.as_str(),
        number(anchor.x),
        number(anchor.y),
        number(designator_size(footprint)),
        escape(&footprint.reference),
    );
}

// --------------------------------------------------------------------- vias

fn vias(svg: &mut String, atlas: &Atlas, section: &ClassSection) {
    svg.push_str("<g class=\"vias\">\n");
    for via in &atlas.drawing.vias {
        if !section.net_names.contains(&via.net) {
            continue;
        }
        let _ = writeln!(
            svg,
            "<g class=\"via\" data-net=\"{}\"><title>{}</title>\
<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"#1d1d1f\"/>\
<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"#ffffff\"/></g>",
            escape(&via.net),
            escape(&via.net),
            number(via.at.x),
            number(via.at.y),
            number(via.size / 2.0),
            number(via.at.x),
            number(via.at.y),
            number(via.drill / 2.0),
        );
    }
    svg.push_str("</g>\n");
}

// ------------------------------------------------------------------ outline

fn board_outline(svg: &mut String, atlas: &Atlas) {
    svg.push_str("<g class=\"outline\">");
    let _ = write!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\"/>",
        ring_path(&atlas.drawing.outline),
        palette::INK,
        number(OUTLINE_MM),
    );
    if !atlas.drawing.cutouts.is_empty() {
        let _ = write!(
            svg,
            "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\"/>",
            prism_artwork::artwork::svg::rings_path(&atlas.drawing.cutouts),
            palette::INK,
            number(OUTLINE_MM),
        );
    }
    svg.push_str("</g>\n");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Atlas, Drawing, NetRow};
    use std::collections::BTreeSet;

    fn point(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    fn atlas(traces: Vec<Trace>) -> Atlas {
        let mut bounds = Bounds::empty();
        for corner in [point(0.0, 0.0), point(40.0, 30.0)] {
            bounds.include(corner);
        }
        Atlas {
            board_name: "test".to_owned(),
            board_file: "test.kicad_pcb".to_owned(),
            identity: "0123456789ab".to_owned(),
            identity_label: "design key",
            copper: vec![
                "F.Cu".to_owned(),
                "In1.Cu".to_owned(),
                "In2.Cu".to_owned(),
                "B.Cu".to_owned(),
            ],
            tracks: traces.len(),
            vias: 0,
            classes: Vec::new(),
            drawing: Drawing {
                outline: vec![
                    point(0.0, 0.0),
                    point(40.0, 0.0),
                    point(40.0, 30.0),
                    point(0.0, 30.0),
                ],
                cutouts: Vec::new(),
                bounds,
                traces,
                vias: Vec::new(),
                zones: Vec::new(),
                footprints: Vec::new(),
            },
        }
    }

    fn section(net: &str) -> ClassSection {
        ClassSection {
            name: "Default".to_owned(),
            length_mm: 1.0,
            nets: vec![NetRow {
                name: net.to_owned(),
                length_mm: 1.0,
                vias: 0,
                layers: vec!["In2.Cu".to_owned()],
                pads: 0,
            }],
            net_names: BTreeSet::from([net.to_owned()]),
            footprints: Vec::new(),
            tracks: 1,
            vias: 0,
            pads: 0,
        }
    }

    #[test]
    fn a_trace_on_in2_takes_in2s_colour() {
        let trace = Trace {
            net: "N".to_owned(),
            layer: "In2.Cu".to_owned(),
            width: 0.2,
            points: vec![point(1.0, 1.0), point(5.0, 1.0)],
        };
        let svg = class_drawing(&atlas(vec![trace]), &section("N"), SideChoice::Top);
        assert!(svg.contains("data-layer=\"In2.Cu\""), "{svg}");
        assert!(svg.contains("stroke=\"#CE7D2C\""), "{svg}");
        assert!(svg.contains("stroke-width=\"0.2\""), "{svg}");
    }

    #[test]
    fn the_drawing_is_deterministic() {
        let trace = Trace {
            net: "N".to_owned(),
            layer: "F.Cu".to_owned(),
            width: 0.3,
            points: vec![point(1.0, 1.0), point(5.0, 1.0)],
        };
        let atlas = atlas(vec![trace]);
        let section = section("N");
        let first = class_drawing(&atlas, &section, SideChoice::Both);
        let second = class_drawing(&atlas, &section, SideChoice::Both);
        assert_eq!(first, second);
    }

    #[test]
    fn only_the_classes_nets_are_drawn() {
        let traces = vec![
            Trace {
                net: "A".to_owned(),
                layer: "F.Cu".to_owned(),
                width: 0.2,
                points: vec![point(1.0, 1.0), point(2.0, 1.0)],
            },
            Trace {
                net: "B".to_owned(),
                layer: "F.Cu".to_owned(),
                width: 0.2,
                points: vec![point(3.0, 1.0), point(4.0, 1.0)],
            },
        ];
        let svg = class_drawing(&atlas(traces), &section("A"), SideChoice::Top);
        assert!(svg.contains("data-net=\"A\""));
        assert!(!svg.contains("data-net=\"B\""));
    }
}
