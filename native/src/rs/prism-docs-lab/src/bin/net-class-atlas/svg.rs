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

use super::model::{Atlas, Body, Footprint, NetGroup, Pad, PadShape, SideChoice, Trace, Zone};
use prism_docs_lab::palette;
use prism_docs_lab::theme::{Palette, Theme};

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
/// Filled zones are a hint under the copper, never a wash over it.
const ZONE_FILL_OPACITY: f64 = 0.12;

/// One drawing and the designators its overlap rule hid.
pub struct RenderedDrawing {
    /// The inline SVG.
    pub svg: String,
    /// Designators skipped because their box hit an earlier one.
    pub hidden_designators: usize,
}

/// One `<defs>` sprite holding every footprint body in board millimetres.
///
/// Body geometry is already in the board frame (HLR models and the board
/// projection both write absolute coordinates), so one path per footprint can
/// be referenced by every group's drawing. This is what keeps a split class's
/// page from carrying the same outline twenty times, and it makes the frame
/// rule explicit: a body is never transformed a second time.
pub fn body_defs(atlas: &Atlas) -> String {
    let mut defs = String::new();
    defs.push_str(
        "<svg class=\"atlas-defs\" width=\"0\" height=\"0\" aria-hidden=\"true\" \
focusable=\"false\"><defs>\n",
    );
    for footprint in &atlas.drawing.footprints {
        if let Some(path) = body_path(&footprint.body) {
            let _ = writeln!(
                defs,
                "<path id=\"atlas-body-{}\" d=\"{}\"/>",
                footprint.index, path
            );
        }
    }
    defs.push_str("</defs></svg>\n");
    defs
}

/// Render `group`'s drawing of `atlas`'s board.
pub fn class_drawing(
    atlas: &Atlas,
    group: &NetGroup,
    side: SideChoice,
    theme: Theme,
) -> RenderedDrawing {
    let palette = theme.palette();
    let bounds = expanded(atlas.drawing.frame());
    let mut svg = String::new();
    let _ = writeln!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" class=\"atlas-drawing\" role=\"img\" \
viewBox=\"{} {} {} {}\" preserveAspectRatio=\"xMidYMid meet\" aria-label=\"{}\">",
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.width().max(0.001)),
        number(bounds.height().max(0.001)),
        escape(&atlas.board_name),
    );
    let _ = writeln!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{}\"/>",
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.width().max(0.001)),
        number(bounds.height().max(0.001)),
        palette.paper,
    );
    // Zone fills sit under every trace, not just their own layer's, so the
    // 12 % wash never tints a trace on another layer.
    for layer in atlas.copper.iter().rev() {
        let Some(color) = palette::copper_color(layer) else {
            continue;
        };
        let _ = writeln!(
            svg,
            "<g class=\"layer zones\" data-layer=\"{}\">",
            escape(layer)
        );
        layer_zones(&mut svg, atlas, group, layer, color);
        svg.push_str("</g>\n");
    }
    // Back to front, so F.Cu paints last and sits on top.
    for layer in atlas.copper.iter().rev() {
        let Some(color) = palette::copper_color(layer) else {
            continue;
        };
        let _ = writeln!(svg, "<g class=\"layer\" data-layer=\"{}\">", escape(layer));
        layer_traces(&mut svg, atlas, group, layer, color);
        svg.push_str("</g>\n");
    }
    let hidden_designators = footprints(&mut svg, atlas, group, side, &palette);
    vias(&mut svg, atlas, group, &palette);
    board_outline(&mut svg, atlas, &palette);
    svg.push_str("</svg>\n");
    RenderedDrawing {
        svg,
        hidden_designators,
    }
}

/// The drawing frame plus the margin.
fn expanded(bounds: Bounds) -> Bounds {
    Bounds {
        min_x: bounds.min_x - MARGIN_MM,
        min_y: bounds.min_y - MARGIN_MM,
        max_x: bounds.max_x + MARGIN_MM,
        max_y: bounds.max_y + MARGIN_MM,
    }
}

// ------------------------------------------------------------------- traces

fn layer_traces(svg: &mut String, atlas: &Atlas, group: &NetGroup, layer: &str, color: &str) {
    let traces: Vec<&Trace> = atlas
        .drawing
        .traces
        .iter()
        .filter(|trace| trace.layer == layer && group.net_names.contains(&trace.net))
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

fn layer_zones(svg: &mut String, atlas: &Atlas, group: &NetGroup, layer: &str, color: &str) {
    let zones: Vec<&Zone> = atlas
        .drawing
        .zones
        .iter()
        .filter(|zone| zone.layer == layer && group.net_names.contains(&zone.net))
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
            // One path carries both states: a faint fill while zones are on,
            // a dashed edge once they are off. The section's data-zones rule
            // swaps which one paints; the geometry is written once.
            let _ = writeln!(
                svg,
                "<g class=\"zone zone-fill\" data-net=\"{net}\"><title>{net}</title>\
<path d=\"{path}\" fill=\"{color}\" fill-opacity=\"{opacity}\" fill-rule=\"evenodd\" \
stroke=\"{color}\" stroke-width=\"0.12\" stroke-dasharray=\"0.8 0.5\" stroke-opacity=\"0.7\"/></g>",
                color = escape(color),
                opacity = number(ZONE_FILL_OPACITY),
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

fn footprints(
    svg: &mut String,
    atlas: &Atlas,
    group: &NetGroup,
    side: SideChoice,
    palette: &Palette,
) -> usize {
    let connected = &group.footprints;
    for footprint in &atlas.drawing.footprints {
        if !connected.contains(&footprint.index) {
            ghost(svg, footprint, palette);
        }
    }
    let mut designators = String::new();
    let mut placed: Vec<Bounds> = Vec::new();
    let mut hidden = 0;
    for footprint in &atlas.drawing.footprints {
        if connected.contains(&footprint.index) && side.full(footprint.side) {
            full(svg, footprint, group, atlas, palette);
            match designator_box(footprint) {
                Some(designator)
                    if placed.iter().any(|box_| box_.intersects(designator.bounds)) =>
                {
                    hidden += 1;
                }
                Some(designator) => {
                    designator_text(&mut designators, footprint, &designator, palette);
                    placed.push(designator.bounds);
                }
                None => {}
            }
        }
    }
    svg.push_str(&designators);
    hidden
}

/// The body is board-frame geometry, so it is written without the footprint's
/// transform; only the pads are footprint-local and get translated/rotated.
/// Applying the transform to the body as well is what once threw HLR outlines
/// and courtyard boxes far outside the board.
fn full(
    svg: &mut String,
    footprint: &Footprint,
    group: &NetGroup,
    atlas: &Atlas,
    palette: &Palette,
) {
    let _ = writeln!(
        svg,
        "<g class=\"fp fp-{}\" data-fp=\"{}\">",
        footprint.side.as_str(),
        footprint.index
    );
    body(svg, footprint, palette.ink, BODY_MM);
    let _ = writeln!(
        svg,
        "<g class=\"pads side-{}\" transform=\"translate({} {}) rotate({})\">",
        footprint.side.as_str(),
        number(footprint.x),
        number(footprint.y),
        number(-footprint.angle),
    );
    layer_pads(svg, footprint, group, atlas, palette);
    svg.push_str("</g>\n</g>\n");
}

fn layer_pads(
    svg: &mut String,
    footprint: &Footprint,
    group: &NetGroup,
    atlas: &Atlas,
    palette: &Palette,
) {
    for pad in &footprint.pads {
        let connected = !pad.net.is_empty() && group.net_names.contains(&pad.net);
        let color = if connected {
            pad_color(pad, &atlas.copper)
        } else {
            palette.pad
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
}

fn ghost(svg: &mut String, footprint: &Footprint, palette: &Palette) {
    let _ = write!(svg, "<g class=\"fp ghost fp-{}\">", footprint.side.as_str(),);
    body(svg, footprint, palette.rule, GHOST_MM);
    svg.push_str("</g>\n");
}

/// A footprint's body, referenced from the page's shared sprite. The sprite
/// carries board coordinates, so no transform is applied here.
fn body(svg: &mut String, footprint: &Footprint, color: &str, width: f64) {
    if body_path(&footprint.body).is_none() {
        return;
    }
    let _ = write!(
        svg,
        "<use href=\"#atlas-body-{}\" class=\"body\" fill=\"none\" stroke=\"{}\" \
stroke-width=\"{}\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/>",
        footprint.index,
        escape(color),
        number(width),
    );
}

/// The body's path data, or `None` when it has no drawable ring.
fn body_path(body: &Body) -> Option<String> {
    match body {
        Body::Envelope(ring) if ring.len() >= 3 => Some(ring_path(ring)),
        Body::Envelope(_) => None,
        Body::Edges(edges) => Some(edges_path(edges)),
    }
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
        PadShape::Outline { rings } => {
            // One path per ring: a custom pad's rings overlap, and one even-odd
            // path would cut holes where they do.
            for ring in rings {
                let _ = write!(
                    svg,
                    "<path d=\"{}\" stroke=\"none\"/>",
                    prism_artwork::artwork::svg::rings_path(std::slice::from_ref(ring))
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

/// A designator's anchor and the box its text occupies, in board millimetres.
struct Designator {
    anchor: Point,
    size: f64,
    bounds: Bounds,
}

/// The designator's box: upright above the body, in the page's sans face.
/// The width estimate is deliberately a little generous, so dense groups lose
/// a designator rather than print two on top of each other.
fn designator_box(footprint: &Footprint) -> Option<Designator> {
    if footprint.reference.is_empty() || footprint.reference == "?" {
        return None;
    }
    let size = designator_size(footprint);
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
    let width = footprint.reference.chars().count() as f64 * size * 0.62;
    Some(Designator {
        anchor,
        size,
        bounds: Bounds {
            min_x: anchor.x - width / 2.0,
            min_y: anchor.y - size,
            max_x: anchor.x + width / 2.0,
            max_y: anchor.y + size * 0.2,
        },
    })
}

fn designator_text(
    svg: &mut String,
    footprint: &Footprint,
    designator: &Designator,
    palette: &Palette,
) {
    let _ = writeln!(
        svg,
        "<text class=\"des side-{}\" x=\"{}\" y=\"{}\" font-family=\"Geist, Inter, \
system-ui, sans-serif\" font-size=\"{}\" font-weight=\"500\" fill=\"{}\" \
text-anchor=\"middle\">{}</text>",
        footprint.side.as_str(),
        number(designator.anchor.x),
        number(designator.anchor.y),
        number(designator.size),
        palette.ink,
        escape(&footprint.reference),
    );
}

// --------------------------------------------------------------------- vias

fn vias(svg: &mut String, atlas: &Atlas, group: &NetGroup, palette: &Palette) {
    svg.push_str("<g class=\"vias\">\n");
    for via in &atlas.drawing.vias {
        if !group.net_names.contains(&via.net) {
            continue;
        }
        let _ = writeln!(
            svg,
            "<g class=\"via\" data-net=\"{}\"><title>{}</title>\
<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\"/>\
<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\"/></g>",
            escape(&via.net),
            escape(&via.net),
            number(via.at.x),
            number(via.at.y),
            number(via.size / 2.0),
            palette.ink,
            number(via.at.x),
            number(via.at.y),
            number(via.drill / 2.0),
            palette.paper,
        );
    }
    svg.push_str("</g>\n");
}

// ------------------------------------------------------------------ outline

fn board_outline(svg: &mut String, atlas: &Atlas, palette: &Palette) {
    svg.push_str("<g class=\"outline\">");
    let _ = write!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\"/>",
        ring_path(&atlas.drawing.outline),
        palette.ink,
        number(OUTLINE_MM),
    );
    if !atlas.drawing.cutouts.is_empty() {
        let _ = write!(
            svg,
            "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\"/>",
            prism_artwork::artwork::svg::rings_path(&atlas.drawing.cutouts),
            palette.ink,
            number(OUTLINE_MM),
        );
    }
    svg.push_str("</g>\n");
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Atlas, Body, Drawing, Footprint, NetRow, Pad, PadShape, Side};
    use std::collections::BTreeSet;

    fn point(x: f64, y: f64) -> Point {
        Point { x, y }
    }

    fn atlas(traces: Vec<Trace>, footprints: Vec<Footprint>) -> Atlas {
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
                footprints,
            },
        }
    }

    fn group(net: &str, footprints: Vec<usize>) -> NetGroup {
        NetGroup {
            name: String::new(),
            length_mm: 1.0,
            nets: vec![NetRow {
                name: net.to_owned(),
                length_mm: 1.0,
                vias: 0,
                layers: vec!["In2.Cu".to_owned()],
                zone_layers: false,
                via_spans: Vec::new(),
                pads: 0,
                power: false,
            }],
            net_names: BTreeSet::from([net.to_owned()]),
            footprints,
            tracks: 1,
            vias: 0,
            pads: 0,
            fill_ratio: 0.0,
            has_fill: false,
        }
    }

    fn footprint(index: usize, reference: &str, x: f64, y: f64, net: &str) -> Footprint {
        let ring = vec![
            point(x - 2.0, y - 1.5),
            point(x + 2.0, y - 1.5),
            point(x + 2.0, y + 1.5),
            point(x - 2.0, y + 1.5),
        ];
        let mut body_bounds = Bounds::empty();
        for corner in &ring {
            body_bounds.include(*corner);
        }
        Footprint {
            index,
            reference: reference.to_owned(),
            side: Side::Top,
            x,
            y,
            angle: 0.0,
            pads: vec![Pad {
                net: net.to_owned(),
                layers: vec!["F.Cu".to_owned()],
                x: 0.0,
                y: 0.0,
                angle: 0.0,
                shape: PadShape::Rect {
                    width: 0.6,
                    height: 0.4,
                },
            }],
            body: Body::Envelope(ring),
            body_bounds,
            nets: BTreeSet::from([net.to_owned()]),
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
        let drawing = class_drawing(
            &atlas(vec![trace], Vec::new()),
            &group("N", Vec::new()),
            SideChoice::Top,
            Theme::Light,
        );
        assert!(
            drawing.svg.contains("data-layer=\"In2.Cu\""),
            "{}",
            drawing.svg
        );
        assert!(
            drawing.svg.contains("stroke=\"#CE7D2C\""),
            "{}",
            drawing.svg
        );
        assert!(
            drawing.svg.contains("stroke-width=\"0.2\""),
            "{}",
            drawing.svg
        );
    }

    #[test]
    fn the_drawing_is_deterministic() {
        let trace = Trace {
            net: "N".to_owned(),
            layer: "F.Cu".to_owned(),
            width: 0.3,
            points: vec![point(1.0, 1.0), point(5.0, 1.0)],
        };
        let atlas = atlas(vec![trace], Vec::new());
        let group = group("N", Vec::new());
        let first = class_drawing(&atlas, &group, SideChoice::Both, Theme::Light);
        let second = class_drawing(&atlas, &group, SideChoice::Both, Theme::Light);
        assert_eq!(first.svg, second.svg);
    }

    #[test]
    fn only_the_groups_nets_are_drawn() {
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
        let drawing = class_drawing(
            &atlas(traces, Vec::new()),
            &group("A", Vec::new()),
            SideChoice::Top,
            Theme::Light,
        );
        assert!(drawing.svg.contains("data-net=\"A\""));
        assert!(!drawing.svg.contains("data-net=\"B\""));
    }

    /// The old drawing wrapped a footprint body in `translate(anchor)`, so a
    /// body already in board millimetres landed at roughly twice its position.
    /// The sprite must keep board coordinates and the drawing must reference
    /// it, while only the pad group carries the footprint transform.
    #[test]
    fn bodies_stay_in_the_board_frame() {
        let footprint = footprint(0, "J1", 10.0, 10.0, "N");
        let atlas = atlas(Vec::new(), vec![footprint]);
        let defs = body_defs(&atlas);
        let start = defs.find("id=\"atlas-body-0\"").expect("a body path");
        let path = &defs[start..defs[start..].find("/>").expect("path end") + start];
        let numbers: Vec<f64> = path
            .split(|character: char| !character.is_ascii_digit() && character != '.')
            .filter(|part| !part.is_empty())
            .filter_map(|part| part.parse().ok())
            .collect();
        assert!(
            numbers.iter().all(|value| (0.0..=40.0).contains(value)),
            "body path left the board: {path}"
        );
        let drawing = class_drawing(&atlas, &group("N", vec![0]), SideChoice::Top, Theme::Light);
        assert!(
            drawing.svg.contains("href=\"#atlas-body-0\""),
            "{}",
            drawing.svg
        );
        assert!(
            drawing
                .svg
                .contains("<g class=\"pads side-top\" transform=\"translate(10 10) rotate(0)\">"),
            "{}",
            drawing.svg
        );
        assert!(
            !drawing
                .svg
                .contains("transform=\"translate(10 10) rotate(0)\"><use"),
            "a body must not be transformed twice: {}",
            drawing.svg
        );
    }

    #[test]
    fn overlapping_designators_are_counted_not_drawn() {
        let first = footprint(0, "R1", 10.0, 10.0, "N");
        let second = footprint(1, "R2", 10.4, 10.0, "N");
        let atlas = atlas(Vec::new(), vec![first, second]);
        let drawing = class_drawing(
            &atlas,
            &group("N", vec![0, 1]),
            SideChoice::Top,
            Theme::Light,
        );
        assert_eq!(drawing.hidden_designators, 1, "{}", drawing.svg);
        assert_eq!(drawing.svg.matches("class=\"des").count(), 1);
    }

    /// The frame used to be the board's `Edge.Cuts` box plus a margin, so a
    /// part that overhangs the perimeter (a side button, a header) was cut at
    /// the frame and left a stub at the edge. Every drawn element's extent now
    /// has to sit inside the viewBox.
    #[test]
    fn the_view_box_frames_every_drawn_element() {
        // SW1 sits past the right edge: its body spans x 39..43 on a board
        // that ends at 40, and its pad anchor hangs further out again.
        let mut button = footprint(0, "SW1", 41.0, 15.0, "N");
        button.pads[0].x = 5.0;
        let mut sample = atlas(Vec::new(), vec![button]);
        sample.drawing.vias = vec![crate::model::Via {
            net: "N".to_owned(),
            at: point(39.0, 15.0),
            size: 0.6,
            drill: 0.3,
            layers: vec!["F.Cu".to_owned(), "B.Cu".to_owned()],
        }];
        let drawing = class_drawing(&sample, &group("N", vec![0]), SideChoice::Top, Theme::Light);

        let view_box = view_box(&drawing.svg);
        for bounds in drawn_bounds(&sample) {
            assert!(
                view_box.contains_bounds(bounds),
                "viewBox {view_box:?} does not frame {bounds:?}"
            );
        }
        // The old frame stopped at the board plus the 2 mm margin.
        assert!(
            view_box.max_x > 40.0 + MARGIN_MM,
            "the overhanging body is not framed: {view_box:?}"
        );
    }

    /// The drawing's viewBox as an extent.
    fn view_box(svg: &str) -> Bounds {
        let values: Vec<f64> = svg
            .split("viewBox=\"")
            .nth(1)
            .expect("a viewBox")
            .split('"')
            .next()
            .expect("a viewBox value")
            .split_whitespace()
            .map(|value| value.parse().expect("a number"))
            .collect();
        Bounds {
            min_x: values[0],
            min_y: values[1],
            max_x: values[0] + values[2],
            max_y: values[1] + values[3],
        }
    }

    /// The extent of everything the drawing paints: bodies, pads, traces,
    /// vias and zone rings.
    fn drawn_bounds(atlas: &Atlas) -> Vec<Bounds> {
        let mut bounds = Vec::new();
        for footprint in &atlas.drawing.footprints {
            bounds.push(footprint.body_bounds);
            for pad in &footprint.pads {
                bounds.push(crate::model::pad_bounds(footprint, pad));
            }
        }
        for trace in &atlas.drawing.traces {
            let half = trace.width / 2.0;
            for point in &trace.points {
                bounds.push(Bounds::around(*point, half, half));
            }
        }
        for via in &atlas.drawing.vias {
            bounds.push(Bounds::around(via.at, via.size / 2.0, via.size / 2.0));
        }
        for zone in &atlas.drawing.zones {
            for ring in &zone.rings {
                bounds.push(Bounds::of_ring(ring));
            }
        }
        bounds
    }
}
