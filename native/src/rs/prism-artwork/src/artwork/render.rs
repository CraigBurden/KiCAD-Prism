//! The SVG compositing of `prism-kicad artwork`: one function per layer token,
//! the designator fitting pass and the canvas policy. Kept apart from
//! `artwork::mod` so each file stays small enough to review.

mod designators;

use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkCanvasBounds, ArtworkConfigA0, ArtworkHlrStyle, ArtworkPin1MarkerStyle, ArtworkView,
};

use super::geometry::{self, BoardGeometry, Bounds, Point};
use super::svg::{escape, number, ring_path, rings_path};
use super::{
    ArtworkInput, ArtworkViewError, BoardData, FootSide, FootprintInfo, PadInfo, RenderedView,
};
use designators::{
    component_override, designator_style, render_designators, selected_by_designators,
    selector_matches,
};

pub(super) fn render_view(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
) -> Result<RenderedView, ArtworkViewError> {
    let styles = &view.styles;
    let designator_style = designator_style(input.config, styles, None);
    let selected: Vec<usize> = data
        .footprints
        .iter()
        .enumerate()
        .filter(|(_, footprint)| {
            selected_by_designators(footprint.reference.as_deref(), &designator_style)
        })
        .map(|(index, _)| index)
        .collect();
    let canvas = canvas_bounds(input, data, &selected);
    let mut svg = String::new();
    let scale = input.config.global.svg_scale.max(1.0e-9);
    let width = canvas.width().max(0.001) * scale;
    let height = canvas.height().max(0.001) * scale;
    svg.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    svg.push_str(&format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{}{}\" height=\"{}{}\" viewBox=\"0 0 {} {}\" role=\"img\">\n",
        number(canvas.width().max(0.001)),
        input.config.global.svg_size_unit,
        number(canvas.height().max(0.001)),
        input.config.global.svg_size_unit,
        number(width),
        number(height),
    ));
    svg.push_str(&format!(
        "<rect x=\"0\" y=\"0\" width=\"{}\" height=\"{}\" fill=\"#FFFFFF\"/>\n",
        number(width),
        number(height),
    ));
    svg.push_str(&format!(
        "<g id=\"{}\" transform=\"translate({} {}) scale({})\">\n",
        escape(&view.group_id),
        number(-canvas.min_x * scale),
        number(-canvas.min_y * scale),
        number(scale),
    ));
    let mut state = RenderState::default();
    for token in &view.layers {
        render_token(input, data, view, token, &selected, &mut svg, &mut state);
    }
    svg.push_str("</g>\n</svg>\n");

    let mut without_outline: Vec<String> = state.without_outline.clone();
    without_outline.sort();
    without_outline.dedup();
    Ok(RenderedView {
        name: view.name.clone(),
        svg,
        footprints_drawn: state.footprints_drawn as u64,
        designators_placed: state.designators_placed as u64,
        footprints_without_outline: without_outline,
    })
}

#[derive(Default)]
struct RenderState {
    footprints_drawn: usize,
    designators_placed: usize,
    without_outline: Vec<String>,
    drawn_footprints: Vec<usize>,
}

fn render_token(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    token: &str,
    selected: &[usize],
    svg: &mut String,
    state: &mut RenderState,
) {
    match token {
        "BOARD_OUTLINE" => render_outline(input, data, view, svg),
        "BOARD_CUTOUTS" => render_cutouts(input, data, view, svg),
        "DRILLS" | "SLOTS" => render_holes(input, data, view, token, svg),
        "PIN1_TOP" | "PIN1_BOTTOM" => render_pin1(input, data, view, token, selected, svg),
        "ASSEMBLY_HLR_TOP" | "ASSEMBLY_HLR_BOTTOM" => {
            render_hlr(input, data, view, token, selected, svg, state)
        }
        "ASSEMBLY_DESIGNATORS_TOP" | "ASSEMBLY_DESIGNATORS_BOTTOM" => {
            render_designators(input, data, view, token, selected, svg, state)
        }
        _ => {}
    }
}

// ------------------------------------------------------------------ outline

fn render_outline(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    svg: &mut String,
) {
    let Some(style) = merged_outline(input.config, view) else {
        return;
    };
    if !style.0 {
        return;
    }
    svg.push_str(&format!(
        "<g id=\"layer-BOARD_OUTLINE\" data-layer-token=\"BOARD_OUTLINE\"><path d=\"{}\" fill=\"none\" stroke=\"{}\" stroke-width=\"{}\"/></g>\n",
        ring_path(&data.geometry.outer),
        escape(&style.1),
        number(style.2),
    ));
}

fn merged_outline(config: &ArtworkConfigA0, view: &ArtworkView) -> Option<(bool, String, f64)> {
    let global = config.global.styles.board_outline.as_ref()?;
    let local = view.styles.board_outline.as_ref();
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    let color = local
        .and_then(|style| style.color.clone())
        .or_else(|| global.color.clone())
        .unwrap_or_else(|| "#000000".to_owned());
    let width = local
        .and_then(|style| style.line_width_mm)
        .or(global.line_width_mm)
        .unwrap_or(0.15);
    Some((enabled, color, width))
}

fn render_cutouts(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    svg: &mut String,
) {
    let Some(global) = input.config.global.styles.board_cutouts.as_ref() else {
        return;
    };
    let local = view.styles.board_cutouts.as_ref();
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    if !enabled || data.geometry.cutouts.is_empty() {
        return;
    }
    let color = local
        .and_then(|style| style.color.clone())
        .or_else(|| global.color.clone())
        .unwrap_or_else(|| "#000000".to_owned());
    let width = local
        .and_then(|style| style.outline_width_mm)
        .or(global.outline_width_mm)
        .unwrap_or(0.15);
    let hatch = local
        .and_then(|style| style.hatch)
        .or(global.hatch)
        .unwrap_or(false);
    let path = rings_path(&data.geometry.cutouts);
    let fill = if hatch {
        format!("url(#{}-hatch)", escape(&view.group_id))
    } else {
        "none".to_owned()
    };
    if hatch {
        svg.push_str(&format!(
            "<defs><pattern id=\"{}-hatch\" patternUnits=\"userSpaceOnUse\" width=\"{}\" height=\"{}\" patternTransform=\"rotate(45)\"><path d=\"M0 0L0 {}\" fill=\"none\" stroke=\"{}\" stroke-width=\"0.08\"/></pattern></defs>",
            escape(&view.group_id),
            number(1.5),
            number(1.5),
            number(1.5),
            escape(&color),
        ));
    }
    svg.push_str(&format!(
        "<g id=\"layer-BOARD_CUTOUTS\" data-layer-token=\"BOARD_CUTOUTS\"><path d=\"{path}\" fill-rule=\"evenodd\" fill=\"{fill}\" stroke=\"{}\" stroke-width=\"{}\"/></g>\n",
        escape(&color),
        number(width),
    ));
}

// -------------------------------------------------------------------- holes

fn render_holes(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    token: &str,
    svg: &mut String,
) {
    let holes = if token == "DRILLS" {
        &data.geometry.drills
    } else {
        &data.geometry.slots
    };
    let Some(global) = (if token == "DRILLS" {
        input.config.global.styles.drills.as_ref()
    } else {
        input.config.global.styles.slots.as_ref()
    }) else {
        return;
    };
    let local = if token == "DRILLS" {
        view.styles.drills.as_ref()
    } else {
        view.styles.slots.as_ref()
    };
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    if !enabled || holes.is_empty() {
        return;
    }
    let plated = local
        .and_then(|style| style.plated_color.clone())
        .or_else(|| global.plated_color.clone())
        .unwrap_or_else(|| "#FFFFFF".to_owned());
    let non_plated = local
        .and_then(|style| style.non_plated_color.clone())
        .or_else(|| global.non_plated_color.clone())
        .unwrap_or_else(|| "#FFFFFF".to_owned());
    svg.push_str(&format!(
        "<g id=\"layer-{token}\" data-layer-token=\"{token}\">"
    ));
    for hole in holes {
        let color = if hole.plated { &plated } else { &non_plated };
        if hole.is_slot() {
            let half = (hole.width.max(hole.height) - hole.width.min(hole.height)) / 2.0;
            let (sin, cos) = hole.angle.to_radians().sin_cos();
            let dx = half * cos;
            let dy = half * sin;
            svg.push_str(&format!(
                "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"{}\" stroke-linecap=\"round\"/>",
                number(hole.center.x - dx),
                number(hole.center.y - dy),
                number(hole.center.x + dx),
                number(hole.center.y + dy),
                escape(color),
                number(hole.width.min(hole.height)),
            ));
        } else {
            svg.push_str(&format!(
                "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\"/>",
                number(hole.center.x),
                number(hole.center.y),
                number(hole.width / 2.0),
                escape(color),
            ));
        }
    }
    svg.push_str("</g>\n");
}

// -------------------------------------------------------------------- pin 1

fn render_pin1(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    token: &str,
    selected: &[usize],
    svg: &mut String,
) {
    let Some(global) = input.config.global.styles.pin1_marker.as_ref() else {
        return;
    };
    let local = view.styles.pin1_marker.as_ref();
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    if !enabled {
        return;
    }
    let style = Pin1Style::merge(global, local);
    let side = if token == "PIN1_BOTTOM" {
        FootSide::Bottom
    } else {
        FootSide::Top
    };
    svg.push_str(&format!(
        "<g id=\"layer-{token}\" data-layer-token=\"{token}\">"
    ));
    for index in selected {
        let footprint = &data.footprints[*index];
        if footprint.side != side {
            continue;
        }
        let Some(override_) = component_override(input.config, footprint.reference.as_deref())
        else {
            if pin1_excluded(input, footprint) {
                continue;
            }
            let Some(pad) = pick_pin1_pad(&footprint.pads, None) else {
                continue;
            };
            let diameter = pin1_diameter(&style, pad);
            push_pin1(svg, footprint, pad, diameter, &style.color, token);
            continue;
        };
        if override_.pin1_enabled == Some(false) {
            continue;
        }
        if override_.pin1_enabled != Some(true) && pin1_excluded(input, footprint) {
            continue;
        }
        let Some(pad) = pick_pin1_pad(&footprint.pads, override_.pin1_pad.as_deref()) else {
            continue;
        };
        let diameter = pin1_diameter(&style, pad);
        push_pin1(svg, footprint, pad, diameter, &style.color, token);
    }
    svg.push_str("</g>\n");
}

struct Pin1Style {
    color: String,
    dot: f64,
    ratio: f64,
    minimum: f64,
    maximum: f64,
}

impl Pin1Style {
    fn merge(global: &ArtworkPin1MarkerStyle, local: Option<&ArtworkPin1MarkerStyle>) -> Self {
        Self {
            color: local
                .and_then(|style| style.color.clone())
                .or_else(|| global.color.clone())
                .unwrap_or_else(|| "#000000".to_owned()),
            dot: local
                .and_then(|style| style.dot_diameter_mm)
                .or(global.dot_diameter_mm)
                .unwrap_or(0.55),
            ratio: local
                .and_then(|style| style.pad_diameter_ratio)
                .or(global.pad_diameter_ratio)
                .unwrap_or(0.6),
            minimum: local
                .and_then(|style| style.min_dot_diameter_mm)
                .or(global.min_dot_diameter_mm)
                .unwrap_or(0.25),
            maximum: local
                .and_then(|style| style.max_dot_diameter_mm)
                .or(global.max_dot_diameter_mm)
                .unwrap_or(1.0),
        }
    }
}

fn pin1_excluded(input: &ArtworkInput<'_>, footprint: &FootprintInfo) -> bool {
    if input.config.pin1.exclude_single_pin && footprint.pads.len() <= 1 {
        return true;
    }
    let designator = footprint.reference.as_deref().unwrap_or_default();
    input
        .config
        .pin1
        .exclude_designators
        .iter()
        .any(|selector| selector_matches(designator, selector))
}

fn pick_pin1_pad<'a>(pads: &'a [PadInfo], override_pin: Option<&str>) -> Option<&'a PadInfo> {
    if let Some(name) = override_pin
        && let Some(pad) = pad_by_name(pads, name)
    {
        return Some(pad);
    }
    pad_by_name(pads, "1")
        .or_else(|| pad_by_name(pads, "A1"))
        .or_else(|| grid_pin1_pad(pads))
        .or_else(|| pads.first())
}

fn pad_by_name<'a>(pads: &'a [PadInfo], name: &str) -> Option<&'a PadInfo> {
    let wanted = name.trim().to_ascii_uppercase();
    pads.iter()
        .find(|pad| pad.number.trim().to_ascii_uppercase() == wanted)
}

fn grid_pin1_pad(pads: &[PadInfo]) -> Option<&PadInfo> {
    let mut grid: Vec<(u64, &str, &PadInfo)> = pads
        .iter()
        .filter_map(|pad| {
            let number = pad.number.trim();
            let split = number
                .find(|character: char| character.is_ascii_digit())
                .unwrap_or(number.len());
            let (prefix, digits) = number.split_at(split);
            let value: u64 = digits.parse().ok()?;
            (!prefix.is_empty()).then_some((value, prefix, pad))
        })
        .collect();
    grid.sort_by(|left, right| left.0.cmp(&right.0).then(left.1.cmp(right.1)));
    grid.first().map(|(_, _, pad)| *pad)
}

fn pin1_diameter(style: &Pin1Style, pad: &PadInfo) -> f64 {
    let base = if style.ratio > 0.0 {
        let positive: Vec<f64> = [pad.size_x.abs(), pad.size_y.abs()]
            .into_iter()
            .filter(|value| *value > 0.0)
            .collect();
        positive.iter().copied().fold(f64::INFINITY, f64::min) * style.ratio
    } else {
        style.dot
    };
    let base = if base.is_finite() { base } else { style.dot };
    let mut diameter = base.max(style.minimum);
    if style.maximum > 0.0 {
        diameter = diameter.min(style.maximum);
    }
    diameter
}

fn push_pin1(
    svg: &mut String,
    footprint: &FootprintInfo,
    pad: &PadInfo,
    diameter: f64,
    color: &str,
    token: &str,
) {
    let anchor = footprint.pad_position(pad);
    let x = anchor.x;
    let y = anchor.y;
    svg.push_str(&format!(
        "<circle cx=\"{}\" cy=\"{}\" r=\"{}\" fill=\"{}\" stroke=\"{}\" stroke-width=\"0\" data-primitive=\"pin1-marker\" data-component=\"{}\" data-pad-number=\"{}\" data-dot-diameter-mm=\"{}\" data-layer-token=\"{}\"/>",
        number(x),
        number(y),
        number(diameter / 2.0),
        escape(color),
        escape(color),
        escape(footprint.reference.as_deref().unwrap_or_default()),
        escape(&pad.number),
        number(diameter),
        token,
    ));
}

impl FootprintInfo {
    fn pad_position(&self, pad: &PadInfo) -> Point {
        let (sin, cos) = self.angle.to_radians().sin_cos();
        Point {
            x: self.at_x + pad.x * cos + pad.y * sin,
            y: self.at_y - pad.x * sin + pad.y * cos,
        }
    }
}

// ---------------------------------------------------------------------- HLR

fn render_hlr(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    token: &str,
    selected: &[usize],
    svg: &mut String,
    state: &mut RenderState,
) {
    let Some(global) = input.config.global.styles.assembly_hlr.as_ref() else {
        return;
    };
    let local = view.styles.assembly_hlr.as_ref();
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    if !enabled {
        return;
    }
    let style = HlrStyle::merge(global, local);
    let side = if token.ends_with("BOTTOM") {
        FootSide::Bottom
    } else {
        FootSide::Top
    };
    svg.push_str(&format!(
        "<g id=\"layer-{token}\" data-layer-token=\"{token}\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\">"
    ));
    for index in selected {
        let footprint = &data.footprints[*index];
        if footprint.side == side {
            render_footprint_hlr(input, data, footprint, &style, svg, state);
        }
    }
    svg.push_str("</g>\n");
}

fn render_footprint_hlr(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    footprint: &FootprintInfo,
    style: &HlrStyle,
    svg: &mut String,
    state: &mut RenderState,
) {
    let component = component_hlr_style(input.config, style, footprint);
    if let Some(hlr_index) = footprint.hlr {
        let body = &data.hlr[hlr_index];
        let outline = body.outline.as_ref().filter(|_| component.include_outline);
        let detail = body.detail.as_ref().filter(|_| component.include_visible);
        if outline.is_some() || detail.is_some() {
            push_body_group(svg, footprint, "outline");
            if let Some(outline) = outline {
                draw_edges(svg, outline, &component);
            }
            if let Some(detail) = detail {
                draw_edges(svg, detail, &component);
            }
            svg.push_str("</g>");
            if body.outline.is_none() {
                without_outline(input, footprint, state);
            }
            count_drawn(state, footprint.index);
            return;
        }
    }
    without_outline(input, footprint, state);
    draw_fallback_body(svg, data, footprint, &component, state);
}

fn without_outline(input: &ArtworkInput<'_>, footprint: &FootprintInfo, state: &mut RenderState) {
    state
        .without_outline
        .push(format!("{}#{}", input.document_path, footprint.uuid));
}

fn draw_fallback_body(
    svg: &mut String,
    data: &BoardData,
    footprint: &FootprintInfo,
    component: &HlrStyle,
    state: &mut RenderState,
) {
    let Some(ring) = fallback_ring(footprint, &data.geometry) else {
        return;
    };
    push_body_group(svg, footprint, "envelope");
    svg.push_str(&format!(
        "<path d=\"{}\" stroke=\"{}\" stroke-width=\"{}\" opacity=\"{}\"/>",
        ring_path(&ring),
        escape(&component.color),
        number(component.width),
        number(component.opacity),
    ));
    svg.push_str("</g>");
    count_drawn(state, footprint.index);
}

fn component_hlr_style(
    config: &ArtworkConfigA0,
    style: &HlrStyle,
    footprint: &FootprintInfo,
) -> HlrStyle {
    let override_style = component_override(config, footprint.reference.as_deref())
        .and_then(|override_| override_.assembly_hlr.as_ref());
    style.with(override_style)
}

fn push_body_group(svg: &mut String, footprint: &FootprintInfo, kind: &str) {
    svg.push_str(&format!(
        "<g data-component=\"{}\" data-footprint-uuid=\"{}\" data-bounds-kind=\"{}\" stroke=\"#000000\" fill=\"none\">",
        escape(footprint.reference.as_deref().unwrap_or_default()),
        escape(&footprint.uuid),
        kind,
    ));
}

fn count_drawn(state: &mut RenderState, index: usize) {
    if !state.drawn_footprints.contains(&index) {
        state.drawn_footprints.push(index);
        state.footprints_drawn += 1;
    }
}

struct HlrStyle {
    color: String,
    width: f64,
    opacity: f64,
    include_visible: bool,
    include_outline: bool,
}

impl HlrStyle {
    fn merge(global: &ArtworkHlrStyle, local: Option<&ArtworkHlrStyle>) -> Self {
        Self {
            color: local
                .and_then(|style| style.color.clone())
                .or_else(|| global.color.clone())
                .unwrap_or_else(|| "#000000".to_owned()),
            width: local
                .and_then(|style| style.line_width_mm)
                .or(global.line_width_mm)
                .unwrap_or(0.12),
            opacity: local
                .and_then(|style| style.opacity)
                .or(global.opacity)
                .unwrap_or(1.0),
            include_visible: local
                .and_then(|style| style.include_visible)
                .or(global.include_visible)
                .unwrap_or(true),
            include_outline: local
                .and_then(|style| style.include_outline)
                .or(global.include_outline)
                .unwrap_or(true),
        }
    }

    fn with(&self, local: Option<&ArtworkHlrStyle>) -> Self {
        let Some(local) = local else {
            return Self {
                color: self.color.clone(),
                width: self.width,
                opacity: self.opacity,
                include_visible: self.include_visible,
                include_outline: self.include_outline,
            };
        };
        Self {
            color: local.color.clone().unwrap_or_else(|| self.color.clone()),
            width: local.line_width_mm.unwrap_or(self.width),
            opacity: local.opacity.unwrap_or(self.opacity),
            include_visible: local.include_visible.unwrap_or(self.include_visible),
            include_outline: local.include_outline.unwrap_or(self.include_outline),
        }
    }
}

fn draw_edges(
    svg: &mut String,
    edges: &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrEdges,
    style: &HlrStyle,
) {
    let mut path = String::new();
    for segment in &edges.segments {
        let start = point_nm(segment.start_nm.x_nm.0, segment.start_nm.y_nm.0);
        let end = point_nm(segment.end_nm.x_nm.0, segment.end_nm.y_nm.0);
        path.push_str(&format!(
            "M{} {} L{} {} ",
            number(start.x),
            number(start.y),
            number(end.x),
            number(end.y)
        ));
    }
    for arc in &edges.arcs {
        for point in geometry::arc_points(arc) {
            path.push_str(&format!("L{} {} ", number(point.x), number(point.y)));
        }
    }
    if path.is_empty() {
        return;
    }
    svg.push_str(&format!(
        "<path d=\"{}\" stroke=\"{}\" stroke-width=\"{}\" opacity=\"{}\"/>",
        path.trim_end(),
        escape(&style.color),
        number(style.width),
        number(style.opacity),
    ));
}

fn point_nm(x: i64, y: i64) -> Point {
    Point {
        x: x as f64 / 1_000_000.0,
        y: y as f64 / 1_000_000.0,
    }
}

fn fallback_ring(footprint: &FootprintInfo, geometry: &BoardGeometry) -> Option<Vec<Point>> {
    footprint
        .hole_bounds
        .or_else(|| geometry.hole_envelopes.get(&footprint.index).copied())
        .or(footprint.pad_bounds)
        .or_else(|| geometry.pad_envelopes.get(&footprint.index).copied())
        .map(Bounds::ring)
}

// --------------------------------------------------------------- designators

// ------------------------------------------------------------------- canvas

fn canvas_bounds(input: &ArtworkInput<'_>, data: &BoardData, selected: &[usize]) -> Bounds {
    let margin = input.config.global.canvas.margin_mm.abs();
    let mut bounds = match input.config.global.canvas.bounds {
        ArtworkCanvasBounds::BoardOutline => data.geometry.outline_bounds,
        ArtworkCanvasBounds::AllGeometry => all_geometry_bounds(data, selected),
    };
    if bounds.is_empty() {
        bounds = Bounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 1.0,
            max_y: 1.0,
        };
    }
    bounds.min_x -= margin;
    bounds.min_y -= margin;
    bounds.max_x += margin;
    bounds.max_y += margin;
    bounds
}

fn all_geometry_bounds(data: &BoardData, selected: &[usize]) -> Bounds {
    let mut bounds = data.geometry.outline_bounds;
    for hole in data.geometry.drills.iter().chain(&data.geometry.slots) {
        bounds.include_bounds(hole.bounds());
    }
    for index in selected {
        if let Some(hlr_index) = data.footprints[*index].hlr {
            let body = &data.hlr[hlr_index];
            for edges in [body.outline.as_ref(), body.detail.as_ref()]
                .into_iter()
                .flatten()
            {
                include_edges_bounds(edges, &mut bounds);
            }
        }
    }
    bounds
}

fn include_edges_bounds(
    edges: &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrEdges,
    bounds: &mut Bounds,
) {
    for segment in &edges.segments {
        bounds.include(point_nm(segment.start_nm.x_nm.0, segment.start_nm.y_nm.0));
        bounds.include(point_nm(segment.end_nm.x_nm.0, segment.end_nm.y_nm.0));
    }
    for arc in &edges.arcs {
        for point in geometry::arc_points(arc) {
            bounds.include(point);
        }
    }
}

#[cfg(test)]
mod tests;
