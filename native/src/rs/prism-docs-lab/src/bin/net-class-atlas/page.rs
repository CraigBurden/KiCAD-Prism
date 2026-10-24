//! The atlas page: a masthead with the board's counts and layer legend, one
//! section per net class, and the nets' table. One self-contained document.

use std::fmt::Write;

use super::model::{Atlas, ClassSection, NetGroup, NetRow, SideChoice, ViaSpan};
use super::svg;
use prism_docs_lab::html;
use prism_docs_lab::palette;
use prism_docs_lab::theme::Theme;

/// The atlas's own rules, after the lab's shared look.
pub const CSS: &str = include_str!("atlas.css");
/// The atlas's interactions: layer toggles, net focus, zones and the side
/// switch.
pub const JS: &str = include_str!("atlas.js");

/// Render the whole atlas for `atlas`'s board.
pub fn render(atlas: &Atlas, side: SideChoice, theme: Theme) -> String {
    let mut body = String::new();
    body.push_str("<div class=\"lab\">\n");
    masthead(&mut body, atlas, side);
    body.push_str(&svg::body_defs(atlas));
    for (index, section) in atlas.classes.iter().enumerate() {
        class_section(&mut body, atlas, section, side, index, theme);
    }
    footnote(&mut body, atlas);
    body.push_str("</div>\n");
    let title = format!("{} — net-class atlas", atlas.board_name);
    let attributes = format!("data-side=\"{}\"", side.initial().as_str());
    html::document(&title, &attributes, CSS, &body, JS, theme)
}

// ----------------------------------------------------------------- masthead

fn masthead(body: &mut String, atlas: &Atlas, side: SideChoice) {
    body.push_str("<header class=\"masthead\">\n");
    body.push_str("<p class=\"eyebrow\">Prism docs lab · prototype</p>\n");
    let _ = writeln!(
        body,
        "<h1>{} <span class=\"light\">net-class atlas</span></h1>",
        html::escape(&atlas.board_name),
    );
    body.push_str(
        "<p class=\"subtitle\">Each net class the design names, drawn on the board it routes: \
its traces, arcs and vias in KiCad's copper colours, its zone fills, and the footprints its \
nets reach. A hand-run prototype, not part of Release Studio.</p>\n",
    );
    body.push_str("<dl class=\"meta\">\n");
    meta(body, "Board", &atlas.board_file);
    meta(body, atlas.identity_label, &atlas.identity);
    meta(body, "Footprints in full", side_label(side));
    body.push_str("</dl>\n");
    let nets: usize = atlas.classes.iter().map(|section| section.net_count).sum();
    let groups: usize = atlas
        .classes
        .iter()
        .map(|section| section.groups.len())
        .sum();
    body.push_str("<div class=\"stats\">\n");
    stat(body, atlas.classes.len(), "Net classes");
    stat(body, nets, "Nets");
    stat(body, groups, "Groups");
    stat(body, atlas.tracks, "Tracks");
    stat(body, atlas.vias, "Vias");
    body.push_str("</div>\n");
    controls(body, atlas, side);
    body.push_str("</header>\n");
}

fn side_label(side: SideChoice) -> &'static str {
    if side.offers_switch() {
        "top and bottom (switch)"
    } else {
        side.initial().as_str()
    }
}

fn meta(body: &mut String, label: &str, value: &str) {
    let _ = writeln!(
        body,
        "<div><dt>{}</dt><dd>{}</dd></div>",
        html::escape(label),
        html::escape(value),
    );
}

fn stat(body: &mut String, value: usize, label: &str) {
    let _ = writeln!(
        body,
        "<div class=\"stat\"><span class=\"value\">{value}</span>\
<span class=\"label\">{}</span></div>",
        html::escape(label),
    );
}

/// The layer legend, which is also the layer toggle: one checkbox per copper
/// layer, in stack order.
fn controls(body: &mut String, atlas: &Atlas, side: SideChoice) {
    body.push_str(
        "<div class=\"controls\">\n<span class=\"controls-label\">Copper layers</span>\n",
    );
    for layer in &atlas.copper {
        let Some(color) = palette::copper_color(layer) else {
            continue;
        };
        let _ = writeln!(
            body,
            "<label class=\"layer-toggle\"><input type=\"checkbox\" data-layer-toggle \
value=\"{layer}\" checked><span class=\"swatch\" style=\"background:{color}\"></span>\
{layer}</label>",
            layer = html::escape(layer),
            color = html::escape(color),
        );
    }
    if side.offers_switch() {
        body.push_str("<div class=\"side-switch\" role=\"group\" aria-label=\"Footprints\">\n");
        for option in [SideChoice::Top, SideChoice::Bottom] {
            let _ = writeln!(
                body,
                "<button type=\"button\" data-side-option=\"{}\" aria-pressed=\"{}\">{}</button>",
                option.as_str(),
                option.initial() == side.initial(),
                if option == SideChoice::Top {
                    "Top"
                } else {
                    "Bottom"
                },
            );
        }
        body.push_str("</div>\n");
    }
    body.push_str("</div>\n");
}

// ------------------------------------------------------------------ section

fn class_section(
    body: &mut String,
    atlas: &Atlas,
    section: &ClassSection,
    side: SideChoice,
    index: usize,
    theme: Theme,
) {
    let _ = writeln!(
        body,
        "<section class=\"net-class\" id=\"class-{index}-{}\">",
        slug(&section.name),
    );
    body.push_str("<div class=\"class-head\">\n");
    let _ = writeln!(body, "<h2>{}</h2>", html::escape(&section.name));
    let groups = if section.split {
        format!(" · {}", count(section.groups.len(), "group"))
    } else {
        String::new()
    };
    let _ = writeln!(
        body,
        "<p class=\"class-meta\">{} · {} · {} · {} · {} mm routed{groups}</p>",
        count(section.net_count, "net"),
        count(section.tracks, "track"),
        count(section.vias, "via"),
        count(section.pads, "pad"),
        html::millimetres(section.length_mm),
    );
    body.push_str("</div>\n");
    for (group_index, group) in section.groups.iter().enumerate() {
        group_section(
            body,
            atlas,
            section,
            group,
            side,
            Position {
                class: index,
                group: group_index,
            },
            theme,
        );
    }
    body.push_str("</section>\n");
}

/// A group's place on the page, for the ids its section and figure carry.
#[derive(Clone, Copy)]
struct Position {
    class: usize,
    group: usize,
}

fn group_section(
    body: &mut String,
    atlas: &Atlas,
    section: &ClassSection,
    group: &NetGroup,
    side: SideChoice,
    position: Position,
    theme: Theme,
) {
    let (index, group_index) = (position.class, position.group);
    let drawing = svg::class_drawing(atlas, group, side, theme);
    let zones = if group.zones_default() { "on" } else { "off" };
    let _ = writeln!(
        body,
        "<section class=\"net-group\" id=\"class-{index}-{}-group-{group_index}\" data-zones=\"{zones}\">",
        slug(&section.name),
    );
    body.push_str("<div class=\"group-head\">\n");
    if section.split {
        let _ = writeln!(body, "<h3>{}</h3>", html::escape(&group.name));
    }
    let fill = if group.has_fill {
        format!(" · {:.0} % filled", group.fill_ratio * 100.0)
    } else {
        String::new()
    };
    let hidden = if drawing.hidden_designators > 0 {
        format!(
            " · {} designator{} hidden",
            drawing.hidden_designators,
            if drawing.hidden_designators == 1 {
                ""
            } else {
                "s"
            }
        )
    } else {
        String::new()
    };
    if section.split {
        let _ = writeln!(
            body,
            "<p class=\"group-meta\">{} · {} · {} · {} · {} mm routed{fill}{hidden}</p>",
            count(group.nets.len(), "net"),
            count(group.tracks, "track"),
            count(group.vias, "via"),
            count(group.pads, "pad"),
            html::millimetres(group.length_mm),
        );
    } else if !hidden.is_empty() {
        let _ = writeln!(
            body,
            "<p class=\"group-meta\">{} designator{} hidden</p>",
            drawing.hidden_designators,
            if drawing.hidden_designators == 1 {
                ""
            } else {
                "s"
            },
        );
    }
    if group.has_fill {
        let _ = writeln!(
            body,
            "<label class=\"zone-toggle\"><input type=\"checkbox\" data-zones-toggle{}> Zones</label>",
            if group.zones_default() {
                " checked"
            } else {
                ""
            },
        );
    }
    body.push_str("</div>\n");
    let _ = writeln!(
        body,
        "<figure class=\"figure\">\n{}\
<figcaption class=\"caption\">Traces, vias and zone fills of this group's nets, back layer to \
front; pads are filled for these nets. Every other footprint is an outline. Hover a trace for \
its net, click it or a row below to isolate the net.</figcaption>\n</figure>",
        drawing.svg,
    );
    table(body, group, theme);
    body.push_str("</section>\n");
}

fn table(body: &mut String, group: &NetGroup, theme: Theme) {
    let caption = format!("{}, longest first", count(group.nets.len(), "net"));
    let _ = writeln!(
        body,
        "<div class=\"atlas-table-wrap\"><table class=\"atlas-table\">\n\
<caption>{caption}</caption>\n\
<thead><tr><th scope=\"col\">Net</th><th scope=\"col\" class=\"num\">Length (mm)</th>\
<th scope=\"col\" class=\"num\">Vias</th><th scope=\"col\">Layers</th>\
<th scope=\"col\" class=\"num\">Pads</th></tr></thead>\n<tbody>",
    );
    for net in &group.nets {
        row(body, net, theme);
    }
    body.push_str("</tbody>\n</table></div>\n");
}

fn row(body: &mut String, net: &NetRow, theme: Theme) {
    let spans = via_spans(&net.via_spans);
    let _ = writeln!(
        body,
        "<tr class=\"net-row\" data-net-row=\"{}\"><td class=\"net-name\" title=\"{}\">{}</td>\
<td class=\"num\">{}</td><td class=\"num\"{}>{}</td><td><span class=\"layers\">{}</span></td>\
<td class=\"num\">{}</td></tr>",
        html::escape(&net.name),
        html::escape(&net.name),
        html::escape(&html::overbar(leaf(&net.name))),
        html::millimetres(net.length_mm),
        if spans.is_empty() {
            String::new()
        } else {
            format!(" title=\"{}\"", html::escape(&spans))
        },
        net.vias,
        layers(&net.layers, net.zone_layers, theme),
        net.pads,
    );
}

/// A net's via spans as the via cell's tooltip: `F.Cu→B.Cu ×1`, `F.Cu→In2.Cu
/// ×3, F.Cu→B.Cu ×1`.
fn via_spans(spans: &[ViaSpan]) -> String {
    spans
        .iter()
        .map(|span| {
            let layers = if span.from == span.to {
                span.from.clone()
            } else {
                format!("{}→{}", span.from, span.to)
            };
            format!("{layers} ×{}", span.count)
        })
        .collect::<Vec<_>>()
        .join(", ")
}

/// The layer chips. A net with no tracks of its own lists the layers its zones
/// fill, each marked `(zone)` so the column never claims a track it has not.
fn layers(layers: &[String], zone_layers: bool, theme: Theme) -> String {
    if layers.is_empty() {
        return "<span class=\"chip\">—</span>".to_owned();
    }
    let note = if zone_layers { " (zone)" } else { "" };
    layers
        .iter()
        .map(|layer| {
            let color = palette::copper_color(layer).unwrap_or_else(|| theme.palette().muted);
            format!(
                "<span class=\"chip\"><span class=\"swatch\" style=\"background:{}\"></span>{}{note}</span>",
                html::escape(color),
                html::escape(layer),
            )
        })
        .collect::<Vec<_>>()
        .join("")
}

/// `1 net`, `2 nets`: a count and its noun, for the page's sentences.
fn count(value: usize, noun: &str) -> String {
    if value == 1 {
        format!("1 {noun}")
    } else {
        format!("{value} {noun}s")
    }
}

/// The net's leaf name: the last non-empty path segment.
fn leaf(name: &str) -> &str {
    name.rsplit('/')
        .find(|part| !part.is_empty())
        .unwrap_or(name)
}

/// A class name as an id fragment: lowercase letters and digits, runs of
/// anything else as one hyphen.
fn slug(name: &str) -> String {
    let mut slug = String::with_capacity(name.len());
    let mut gap = false;
    for character in name.chars() {
        if character.is_ascii_alphanumeric() {
            if gap && !slug.is_empty() {
                slug.push('-');
            }
            gap = false;
            slug.push(character.to_ascii_lowercase());
        } else {
            gap = true;
        }
    }
    if slug.is_empty() {
        "class".to_owned()
    } else {
        slug
    }
}

fn footnote(body: &mut String, atlas: &Atlas) {
    let _ = writeln!(
        body,
        "<p class=\"footnote\">Read from the bundle only: the board \
(<code>{}</code>), <code>semantic-index.json</code> for each net's class and pin types, \
<code>route-metrics.json</code> for length and vias, \
<code>stackup.json</code> for the layer order, <code>placements.json</code> for sides and \
courtyards and <code>assembly-hlr.json</code> for body outlines. A net's layers are the \
copper its tracks and arcs run on, front to back, never every layer a through via crosses; \
hover its via count for the spans its vias join. A net with only a zone lists that zone's \
layer, marked <code>(zone)</code>. A class of more than 40 nets \
is split into power and ground, one group per schematic sheet, then the rest. Lengths are \
routed centerlines and exclude pads and zones; zone fills open at 12 % unless they cover a \
quarter of the board, and a group with fills off draws its zones as dashed outlines.</p>",
        html::escape(&atlas.board_file),
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Body, Drawing, Footprint, NetRow, Pad, PadShape, Side, SideChoice};
    use prism_artwork::artwork::geometry::{Bounds, Point};
    use std::collections::BTreeSet;

    fn sample() -> Atlas {
        let mut bounds = Bounds::empty();
        for corner in [Point { x: 0.0, y: 0.0 }, Point { x: 50.0, y: 40.0 }] {
            bounds.include(corner);
        }
        let net = "/Power/+3V3".to_owned();
        let footprint = Footprint {
            index: 0,
            reference: "U1".to_owned(),
            side: Side::Top,
            x: 10.0,
            y: 12.0,
            angle: 0.0,
            pads: vec![Pad {
                net: net.clone(),
                layers: vec!["F.Cu".to_owned()],
                x: 0.0,
                y: 0.0,
                angle: 0.0,
                shape: PadShape::Rect {
                    width: 1.0,
                    height: 0.6,
                },
            }],
            body: Body::Envelope(vec![
                Point { x: 8.0, y: 10.0 },
                Point { x: 12.0, y: 10.0 },
                Point { x: 12.0, y: 14.0 },
                Point { x: 8.0, y: 14.0 },
            ]),
            body_bounds: bounds,
            nets: BTreeSet::from([net.clone()]),
        };
        Atlas {
            board_name: "sample".to_owned(),
            board_file: "sample.kicad_pcb".to_owned(),
            identity: "0123456789ab".to_owned(),
            identity_label: "design key",
            copper: vec!["F.Cu".to_owned(), "B.Cu".to_owned()],
            tracks: 1,
            vias: 0,
            classes: vec![ClassSection {
                name: "Default".to_owned(),
                length_mm: 12.5,
                net_count: 1,
                groups: vec![NetGroup {
                    name: String::new(),
                    length_mm: 12.5,
                    nets: vec![NetRow {
                        name: net.clone(),
                        length_mm: 12.5,
                        vias: 0,
                        layers: vec!["F.Cu".to_owned()],
                        zone_layers: false,
                        via_spans: Vec::new(),
                        pads: 1,
                        power: true,
                    }],
                    net_names: BTreeSet::from([net]),
                    footprints: vec![0],
                    tracks: 1,
                    vias: 0,
                    pads: 1,
                    fill_ratio: 0.0,
                    has_fill: false,
                }],
                split: false,
                tracks: 1,
                vias: 0,
                pads: 1,
            }],
            drawing: Drawing {
                outline: vec![
                    Point { x: 0.0, y: 0.0 },
                    Point { x: 50.0, y: 0.0 },
                    Point { x: 50.0, y: 40.0 },
                    Point { x: 0.0, y: 40.0 },
                ],
                cutouts: Vec::new(),
                bounds,
                traces: Vec::new(),
                vias: Vec::new(),
                zones: Vec::new(),
                footprints: vec![footprint],
            },
        }
    }

    #[test]
    fn the_page_is_deterministic() {
        let atlas = sample();
        let first = render(&atlas, SideChoice::Both, Theme::Light);
        let second = render(&atlas, SideChoice::Both, Theme::Light);
        assert_eq!(first, second);
        assert!(first.contains("sample — net-class atlas"));
        assert!(first.contains("+3V3"), "the leaf name is shown");
        assert!(
            first.contains("title=\"/Power/+3V3\""),
            "the path is a tooltip"
        );
        assert!(first.contains("U1"));
    }

    #[test]
    fn the_side_switch_is_offered_only_for_both() {
        let atlas = sample();
        let both = render(&atlas, SideChoice::Both, Theme::Light);
        assert!(both.contains("<button type=\"button\" data-side-option=\"bottom\""));
        let top = render(&atlas, SideChoice::Top, Theme::Light);
        assert!(!top.contains("<button type=\"button\" data-side-option"));
    }

    #[test]
    fn ids_are_slugs() {
        assert_eq!(slug("Default"), "default");
        assert_eq!(slug("Power / High"), "power-high");
        assert_eq!(slug("——"), "class");
    }
}
