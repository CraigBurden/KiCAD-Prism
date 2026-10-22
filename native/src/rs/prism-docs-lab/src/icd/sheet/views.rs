//! The four views of a part: the projection, its pads, its board edge and its
//! dimension lines.

use super::*;
use crate::html::millimetres;
use crate::theme::Palette;
use prism_artwork::artwork::geometry::{Bounds, Point};
use prism_artwork::artwork::svg::{number, ring_path};

use super::super::board::Connector;
use super::super::footprint::PadShape;
use super::super::hlr::{MatingFace, ProjectedArc, ProjectedView, ViewRole};
use super::super::pins::natural_cmp;

pub(super) fn cells(svg: &mut String, context: &SheetContext<'_>) {
    let palette = context.theme.palette();
    let roles = [
        ViewRole::Top,
        ViewRole::Front,
        ViewRole::Side,
        ViewRole::Iso,
    ];
    for (index, role) in roles.iter().enumerate() {
        let x = 14.0 + index as f64 * 100.0;
        view_cell(
            svg,
            context,
            *role,
            Cell {
                x,
                y: 32.0,
                width: 96.0,
                height: 108.0,
            },
            &palette,
        );
    }
}

/// One of the four view cells: where it sits and how big it is, millimetres.
struct Cell {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

fn view_cell(
    svg: &mut String,
    context: &SheetContext<'_>,
    role: ViewRole,
    cell: Cell,
    palette: &Palette,
) {
    let connector = context.connector;
    let area = cell_area(cell.x, cell.y, cell.width, cell.height);
    caption(
        svg,
        &view_caption(role, connector),
        cell.x,
        cell.y,
        cell.width,
        &view_scale_text(connector, role, area),
        palette,
    );
    let clip = format!(
        "clip-{}-{}-{}",
        connector.reference,
        context.page,
        role.as_str()
    );
    let _ = writeln!(
        svg,
        "<clipPath id=\"{clip}\"><rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\"/></clipPath>",
        number(area.min_x),
        number(area.min_y),
        number(area.width()),
        number(area.height())
    );
    let _ = writeln!(svg, "<g clip-path=\"url(#{clip})\">");
    draw_view(svg, connector, role, area, palette);
    svg.push_str("</g>\n");
}

fn cell_area(x: f64, y: f64, width: f64, height: f64) -> Bounds {
    Bounds {
        min_x: x + 2.0,
        min_y: y + 7.0,
        max_x: x + width - 2.0,
        max_y: y + height - 2.0,
    }
}

fn view_caption(role: ViewRole, connector: &Connector) -> String {
    match (role, &connector.views) {
        (ViewRole::Front, Some(views)) if views.mating != MatingFace::Top => {
            format!("FRONT \u{2014} MATING FACE ({})", views.mating.label())
        }
        (ViewRole::Top, None) => "TOP \u{2014} FOOTPRINT".to_owned(),
        _ => role.caption().to_owned(),
    }
}

fn view_scale_text(connector: &Connector, role: ViewRole, area: Bounds) -> String {
    match (&connector.views, role) {
        (Some(_), _) | (None, ViewRole::Top) => scale_label(connector_scale(connector, area)),
        (None, _) => String::new(),
    }
}

fn caption(
    svg: &mut String,
    text: &str,
    x: f64,
    y: f64,
    width: f64,
    scale: &str,
    palette: &Palette,
) {
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" font-weight=\"600\" \
letter-spacing=\"0.18\" fill=\"{}\">{}</text>",
        number(x + 1.0),
        number(y + 3.6),
        SANS,
        number(TINY),
        palette.muted,
        escape(text)
    );
    if !scale.is_empty() {
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"end\">{}</text>",
            number(x + width - 1.0),
            number(y + 3.6),
            MONO,
            number(TINY),
            palette.muted,
            escape(scale)
        );
    }
    let _ = writeln!(
        svg,
        "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"0.2\"/>",
        number(x),
        number(y + 5.4),
        number(x + width),
        number(y + 5.4),
        palette.rule
    );
}

fn draw_view(
    svg: &mut String,
    connector: &Connector,
    role: ViewRole,
    area: Bounds,
    palette: &Palette,
) {
    match (&connector.views, role) {
        (Some(views), _) => model_view(svg, views.view(role), area, role, connector, palette),
        (None, ViewRole::Top) => footprint_view(svg, connector, area, palette),
        (None, _) => {
            let _ = writeln!(
                svg,
                "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"middle\">No 3D model \u{2014} footprint view only</text>",
                number((area.min_x + area.max_x) / 2.0),
                number((area.min_y + area.max_y) / 2.0),
                SANS,
                number(SMALL),
                palette.muted
            );
        }
    }
}

/// The one scale every view of a connector is drawn at.
///
/// Each view used to pick its own ratio, so a part's side view could be 12:1
/// beside a 3:1 top view. One ratio, the largest at which every view fits its
/// cell, keeps sizes comparable across the sheet. A connector drawn from its
/// footprint alone has only the top view.
fn connector_scale(connector: &Connector, area: Bounds) -> f64 {
    let fit = match &connector.views {
        Some(views) => [
            ViewRole::Top,
            ViewRole::Front,
            ViewRole::Side,
            ViewRole::Iso,
        ]
        .iter()
        .map(|role| view_fit(views.view(*role), area))
        .fold(f64::INFINITY, f64::min),
        None => {
            let bounds = footprint_bounds(connector);
            let fit_x = (area.width() - 10.0) / bounds.width().max(0.001);
            let fit_y = (area.height() - 12.0) / bounds.height().max(0.001);
            fit_x.min(fit_y)
        }
    };
    nice_scale(fit)
}

/// The largest factor at which one projected view fits inside `area`.
fn view_fit(view: &ProjectedView, area: Bounds) -> f64 {
    let fit_x = (area.width() - 12.0) / view.bounds.width().max(0.001);
    let fit_y = (area.height() - 14.0) / view.bounds.height().max(0.001);
    fit_x.min(fit_y)
}

const NICE_SCALES: [f64; 16] = [
    1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 6.0, 8.0, 10.0, 12.0, 15.0, 20.0, 25.0, 30.0, 40.0,
];

fn nice_scale(fit: f64) -> f64 {
    if !fit.is_finite() || fit <= 0.0 {
        return 1.0;
    }
    if fit < 1.0 {
        return fit;
    }
    NICE_SCALES
        .iter()
        .rev()
        .find(|scale| **scale <= fit)
        .copied()
        .unwrap_or(1.0)
}

fn scale_label(factor: f64) -> String {
    if factor >= 1.0 {
        format!("{}:1", trim(factor))
    } else {
        format!("1:{}", trim(1.0 / factor))
    }
}

fn trim(value: f64) -> String {
    let text = format!("{value:.2}");
    let trimmed = text.trim_end_matches('0').trim_end_matches('.');
    if trimmed.is_empty() || trimmed == "-0" {
        "0".to_owned()
    } else {
        trimmed.to_owned()
    }
}

/// A projected view: outline in ink, detail in muted, dimensioned.
fn model_view(
    svg: &mut String,
    view: &ProjectedView,
    area: Bounds,
    role: ViewRole,
    connector: &Connector,
    palette: &Palette,
) {
    let scale = connector_scale(connector, area);
    let bounds = view.bounds;
    let center_x = (area.min_x + area.max_x) / 2.0;
    let center_y = (area.min_y + area.max_y) / 2.0;
    let center_u = (bounds.min_x + bounds.max_x) / 2.0;
    let center_v = (bounds.min_y + bounds.max_y) / 2.0;
    let mirror = connector
        .views
        .as_ref()
        .map(|views| views.mirror_u)
        .unwrap_or(false);
    let to_sheet = |point: Point| Point {
        x: center_x + (point.x - center_u) * scale,
        y: if role == ViewRole::Top {
            center_y + (point.y - center_v) * scale
        } else {
            center_y - (point.y - center_v) * scale
        },
    };
    // The projection's v axis is the negative of the footprint file's y
    // (KiCad writes footprint-local y upwards), so a pad at file y maps to
    // v = -y. Drawing v downwards then shows the part top-side up.
    let to_file = |point: Point| Point {
        x: center_x + (if mirror { -point.x } else { point.x } - center_u) * scale,
        y: center_y - (point.y + center_v) * scale,
    };
    if role == ViewRole::Top {
        board_edge(svg, connector, &to_file, palette);
        pad_shapes(svg, connector, &to_file, scale, palette);
    }
    edge_paths(svg, view, &to_sheet, palette);
    if role == ViewRole::Top {
        pin_numbers(svg, connector, &to_file, scale, palette);
    }
    if role == ViewRole::Front || role == ViewRole::Side {
        let half_width = view.bounds.width() * scale / 2.0;
        let half_height = view.bounds.height() * scale / 2.0;
        let extent = Bounds {
            min_x: center_x - half_width,
            min_y: center_y - half_height,
            max_x: center_x + half_width,
            max_y: center_y + half_height,
        };
        let (horizontal, vertical) = dimension_labels(connector, role);
        dimension_horizontal(svg, extent, area, horizontal, palette);
        dimension_vertical(svg, extent, area, vertical, palette);
    }
}

/// The silhouette in ink and the visible detail in muted grey, no hidden lines.
fn edge_paths(
    svg: &mut String,
    view: &ProjectedView,
    to_sheet: &impl Fn(Point) -> Point,
    palette: &Palette,
) {
    svg.push_str("<g fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">");
    let outline = segments_path(&view.outline_segments, &view.outline_arcs, to_sheet);
    if !outline.is_empty() {
        let _ = write!(
            svg,
            "<path d=\"{outline}\" stroke=\"{}\" stroke-width=\"0.35\"/>",
            palette.ink
        );
    }
    let detail = segments_path(&view.detail_segments, &view.detail_arcs, to_sheet);
    if !detail.is_empty() {
        let _ = write!(
            svg,
            "<path d=\"{detail}\" stroke=\"{}\" stroke-width=\"0.18\"/>",
            palette.muted
        );
    }
    svg.push_str("</g>\n");
}

fn segments_path(
    segments: &[[f64; 4]],
    arcs: &[ProjectedArc],
    to_sheet: &impl Fn(Point) -> Point,
) -> String {
    let mut path = String::new();
    for segment in segments {
        let start = to_sheet(Point {
            x: segment[0],
            y: segment[1],
        });
        let end = to_sheet(Point {
            x: segment[2],
            y: segment[3],
        });
        let _ = write!(
            path,
            "M{} {} L{} {} ",
            number(start.x),
            number(start.y),
            number(end.x),
            number(end.y)
        );
    }
    for arc in arcs {
        let points: Vec<Point> = arc.points().into_iter().map(to_sheet).collect();
        push_polyline(&mut path, &points);
    }
    path
}

/// The two dimension texts a front or side view carries.
fn dimension_labels(connector: &Connector, role: ViewRole) -> (String, String) {
    let size = connector
        .views
        .as_ref()
        .map(|views| views.bounds.size())
        .unwrap_or([0.0; 3]);
    let mating = connector
        .views
        .as_ref()
        .map(|views| views.mating)
        .unwrap_or(MatingFace::Top);
    let along_x = matches!(
        mating,
        MatingFace::PosY | MatingFace::NegY | MatingFace::Top
    );
    let horizontal = match (role, along_x) {
        (ViewRole::Front, true) => size[0],
        (ViewRole::Front, false) => size[1],
        (ViewRole::Side, true) => size[1],
        _ => size[0],
    };
    (millimetres(horizontal), millimetres(size[2]))
}

fn dimension_horizontal(
    svg: &mut String,
    extent: Bounds,
    area: Bounds,
    label: String,
    palette: &Palette,
) {
    let y = (extent.max_y + 5.0).min(area.max_y - 2.0);
    let left = extent.min_x;
    let right = extent.max_x;
    let _ = writeln!(
        svg,
        "<g stroke=\"{}\" stroke-width=\"0.15\"><line x1=\"{}\" y1=\"{}\" x2=\"{}\" \
y2=\"{}\"/><line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\"/><line x1=\"{}\" y1=\"{}\" \
x2=\"{}\" y2=\"{}\"/></g>",
        palette.ink,
        number(left),
        number(y),
        number(right),
        number(y),
        number(left),
        number(y - 1.0),
        number(left),
        number(y + 1.0),
        number(right),
        number(y - 1.0),
        number(right),
        number(y + 1.0)
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"middle\">{}</text>",
        number((left + right) / 2.0),
        number(y - 1.2),
        MONO,
        number(SMALL),
        palette.ink,
        escape(&format!("{label} mm"))
    );
}

fn dimension_vertical(
    svg: &mut String,
    extent: Bounds,
    area: Bounds,
    label: String,
    palette: &Palette,
) {
    let x = (extent.max_x + 5.0).min(area.max_x - 2.0);
    let top = extent.min_y;
    let bottom = extent.max_y;
    let _ = writeln!(
        svg,
        "<g stroke=\"{}\" stroke-width=\"0.15\"><line x1=\"{}\" y1=\"{}\" x2=\"{}\" \
y2=\"{}\"/><line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\"/><line x1=\"{}\" y1=\"{}\" \
x2=\"{}\" y2=\"{}\"/></g>",
        palette.ink,
        number(x),
        number(top),
        number(x),
        number(bottom),
        number(x - 1.0),
        number(top),
        number(x + 1.0),
        number(top),
        number(x - 1.0),
        number(bottom),
        number(x + 1.0),
        number(bottom)
    );
    let _ = writeln!(
        svg,
        "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"{}\" fill=\"{}\" \
text-anchor=\"middle\" transform=\"rotate(-90 {} {})\">{}</text>",
        number(x - 1.2),
        number((top + bottom) / 2.0),
        MONO,
        number(SMALL),
        palette.ink,
        number(x - 1.2),
        number((top + bottom) / 2.0),
        escape(&format!("{label} mm"))
    );
}

fn push_polyline(path: &mut String, points: &[Point]) {
    for (index, point) in points.iter().enumerate() {
        let command = if index == 0 { 'M' } else { 'L' };
        let _ = write!(path, "{command}{} {} ", number(point.x), number(point.y));
    }
}

// -------------------------------------------------------------------- pads

/// The pads in their real shape, with pin numbers and the pin-1 mark.
/// The pads in their real shape and the pin-1 mark.
fn pad_shapes(
    svg: &mut String,
    connector: &Connector,
    to_sheet: &impl Fn(Point) -> Point,
    scale: f64,
    palette: &Palette,
) {
    let _ = writeln!(
        svg,
        "<g fill=\"{}\" stroke=\"{}\" stroke-width=\"{}\">",
        palette.pad,
        palette.ink,
        number(0.1 / scale.max(0.001))
    );
    for pad in &connector.pads {
        let anchor = to_sheet(Point { x: pad.x, y: pad.y });
        // A mechanical pad is a mounting feature, not a pin: it prints paler
        // so it does not swamp the outline it sits under.
        let opacity = if pad.number.is_empty() { 0.35 } else { 0.85 };
        let _ = write!(
            svg,
            "<g transform=\"translate({} {}) rotate({}) scale({})\" \
fill-opacity=\"{opacity}\">",
            number(anchor.x),
            number(anchor.y),
            number(-pad.angle),
            number(scale)
        );
        pad_shape(svg, &pad.shape);
        svg.push_str("</g>");
    }
    svg.push_str("</g>\n");
    let first = connector
        .pads
        .iter()
        .find(|pad| pad.number == "1")
        .or_else(|| {
            connector
                .pads
                .iter()
                .filter(|pad| !pad.number.is_empty())
                .min_by(|left, right| natural_cmp(&left.number, &right.number))
        });
    if let Some(pad) = first {
        let anchor = to_sheet(Point { x: pad.x, y: pad.y });
        let below = anchor.y + pad.bounds().height() * scale / 2.0 + 3.2;
        let _ = writeln!(
            svg,
            "<path d=\"M{} {} L{} {} L{} {} Z\" fill=\"{}\" stroke=\"none\"/>",
            number(anchor.x),
            number(below),
            number(anchor.x - 1.2),
            number(below - 2.0),
            number(anchor.x + 1.2),
            number(below - 2.0),
            palette.ink
        );
    }
}

/// The pin numbers, on top of the outline.
fn pin_numbers(
    svg: &mut String,
    connector: &Connector,
    to_sheet: &impl Fn(Point) -> Point,
    scale: f64,
    palette: &Palette,
) {
    for pad in &connector.pads {
        if pad.number.is_empty() {
            continue;
        }
        let anchor = to_sheet(Point { x: pad.x, y: pad.y });
        // A fine-pitch row has no room for upright numbers, so they run along
        // the pad, where the pitch is the pad's width.
        let dense = pad.bounds().width() * scale < 3.0;
        let turn = if dense {
            format!(
                " transform=\"rotate(-90 {} {})\"",
                number(anchor.x),
                number(anchor.y)
            )
        } else {
            String::new()
        };
        let _ = writeln!(
            svg,
            "<text x=\"{}\" y=\"{}\" font-family=\"{}\" font-size=\"1.5\" fill=\"{}\" \
text-anchor=\"middle\" dominant-baseline=\"central\"{turn}>{}</text>",
            number(anchor.x),
            number(anchor.y),
            MONO,
            palette.ink,
            escape(&pad.number)
        );
    }
}

fn pad_shape(svg: &mut String, shape: &PadShape) {
    match shape {
        PadShape::Circle { diameter } => {
            let _ = write!(svg, "<circle r=\"{}\"/>", number(diameter / 2.0));
        }
        PadShape::Rect { width, height } => rect(svg, *width, *height, 0.0),
        PadShape::RoundRect {
            width,
            height,
            radius,
        } => rect(svg, *width, *height, *radius),
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
        number(height)
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

fn board_edge(
    svg: &mut String,
    connector: &Connector,
    to_sheet: &impl Fn(Point) -> Point,
    palette: &Palette,
) {
    let mut rings = Vec::new();
    for ring in &connector.board_local {
        let points: Vec<Point> = ring.iter().map(|point| to_sheet(*point)).collect();
        if points.len() >= 3 {
            rings.push(points);
        }
    }
    if rings.is_empty() {
        return;
    }
    let _ = writeln!(
        svg,
        "<path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.35\" \
stroke-dasharray=\"3 1.6\"/>",
        prism_artwork::artwork::svg::rings_path(&rings),
        palette.muted
    );
}

// ---------------------------------------------------------------- fallback

fn footprint_bounds(connector: &Connector) -> Bounds {
    let mut bounds = super::super::footprint::pads_bounds(&connector.pads);
    for graphic in &connector.graphics {
        for point in &graphic.points {
            bounds.include(*point);
        }
    }
    if bounds.is_empty() {
        bounds = Bounds::around(Point { x: 0.0, y: 0.0 }, 5.0, 5.0);
    }
    bounds
}

fn footprint_view(svg: &mut String, connector: &Connector, area: Bounds, palette: &Palette) {
    let bounds = footprint_bounds(connector);
    let scale = connector_scale(connector, area);
    let center_x = (area.min_x + area.max_x) / 2.0;
    let center_y = (area.min_y + area.max_y) / 2.0;
    let to_sheet = |point: Point| Point {
        x: center_x + (point.x - (bounds.min_x + bounds.max_x) / 2.0) * scale,
        y: center_y - (point.y - (bounds.min_y + bounds.max_y) / 2.0) * scale,
    };
    board_edge(svg, connector, &to_sheet, palette);
    pad_shapes(svg, connector, &to_sheet, scale, palette);
    let mut path = String::new();
    let mut filled = String::new();
    for graphic in &connector.graphics {
        let points: Vec<Point> = graphic
            .points
            .iter()
            .map(|point| to_sheet(*point))
            .collect();
        if graphic.closed && graphic.fill {
            let _ = write!(filled, "{} ", ring_path(&points));
        }
        if graphic.closed {
            let _ = write!(path, "{} ", ring_path(&points));
        } else {
            push_polyline(&mut path, &points);
        }
    }
    if !filled.is_empty() {
        let _ = writeln!(
            svg,
            "<path d=\"{filled}\" fill=\"{}\" stroke=\"none\"/>",
            palette.header
        );
    }
    if !path.is_empty() {
        let _ = writeln!(
            svg,
            "<path d=\"{path}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.25\" \
stroke-linejoin=\"round\"/>",
            palette.ink
        );
    }
    pin_numbers(svg, connector, &to_sheet, scale, palette);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scales_snap_to_a_nice_factor_and_state_it() {
        assert_eq!(nice_scale(3.4), 3.0);
        assert_eq!(nice_scale(1.0), 1.0);
        assert_eq!(nice_scale(0.5), 0.5);
        assert_eq!(scale_label(2.0), "2:1");
        assert_eq!(scale_label(0.5), "1:2");
    }
}
