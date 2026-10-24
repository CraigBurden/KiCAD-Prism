//! The assembly body passes: the normal HLR body, the covering body drawn as a
//! dashed outline on top, and the pad/hole fallback. Split from `render` so the
//! compositing file stays below the crate's size ratchet.

use prism_kicad_contracts::generated::prism_artwork_config_a0::{ArtworkConfigA0, ArtworkHlrStyle};

use super::super::geometry::{self, BoardGeometry, Bounds, Point};
use super::super::svg::{escape, number, ring_path};
use super::super::{ArtworkInput, FootSide, FootprintInfo};
use super::designators::component_override;
use super::{RenderState, ViewRender, covering, layer_transform};

// ---------------------------------------------------------------------- HLR

pub(super) fn render_hlr(
    context: &ViewRender<'_>,
    token: &str,
    svg: &mut String,
    state: &mut RenderState,
) {
    let Some(global) = context.input.config.global.styles.assembly_hlr.as_ref() else {
        return;
    };
    let local = context.view.styles.assembly_hlr.as_ref();
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
        "<g id=\"layer-{token}\" data-layer-token=\"{token}\" fill=\"none\" stroke-linecap=\"round\" stroke-linejoin=\"round\"{}>",
        layer_transform(context.mirror)
    ));
    for index in context.selected {
        let footprint = &context.data.footprints[*index];
        if footprint.side == side && !context.covering.contains(&footprint.index) {
            render_footprint_hlr(context, footprint, &style, svg, state);
        }
    }
    // Covering bodies come after every other body on this side, so their
    // dashed outline sits on top of the parts they hide.
    for index in context.selected {
        let footprint = &context.data.footprints[*index];
        if footprint.side == side && context.covering.contains(&footprint.index) {
            render_covering_hlr(context, footprint, &style, svg, state);
        }
    }
    svg.push_str("</g>\n");
}

fn render_footprint_hlr(
    context: &ViewRender<'_>,
    footprint: &FootprintInfo,
    style: &HlrStyle,
    svg: &mut String,
    state: &mut RenderState,
) {
    let component = component_hlr_style(context.input.config, style, footprint);
    if let Some(hlr_index) = footprint.hlr {
        let body = &context.data.hlr[hlr_index];
        let outline = body.outline.as_ref().filter(|_| component.include_outline);
        let detail = body.detail.as_ref().filter(|_| component.include_visible);
        if outline.is_some() || detail.is_some() {
            push_body_group(svg, footprint, "outline", None);
            if let Some(outline) = outline {
                draw_edges(svg, outline, &component);
            }
            if let Some(detail) = detail {
                draw_edges(svg, detail, &component);
            }
            svg.push_str("</g>");
            if body.outline.is_none() {
                without_outline(context.input, footprint, state);
            }
            count_drawn(state, footprint.index);
            return;
        }
    }
    without_outline(context.input, footprint, state);
    draw_fallback_body(context, footprint, &component, svg, state);
}

/// A covering part's body pass: outline edges only, dashed, unfilled, on top.
/// Detail edges are omitted so the parts beneath stay readable.
fn render_covering_hlr(
    context: &ViewRender<'_>,
    footprint: &FootprintInfo,
    style: &HlrStyle,
    svg: &mut String,
    state: &mut RenderState,
) {
    let component = component_hlr_style(context.input.config, style, footprint);
    if let Some(hlr_index) = footprint.hlr {
        let body = &context.data.hlr[hlr_index];
        if component.include_outline
            && let Some(outline) = body.outline.as_ref()
        {
            let scale = context.paper_scale.max(f64::MIN_POSITIVE);
            let dash = format!(
                "{} {}",
                number(covering::DASH_MM / scale),
                number(covering::GAP_MM / scale)
            );
            push_body_group(svg, footprint, "covering", Some(&dash));
            draw_edges(svg, outline, &component);
            svg.push_str("</g>");
        }
    }
    count_drawn(state, footprint.index);
}

fn without_outline(input: &ArtworkInput<'_>, footprint: &FootprintInfo, state: &mut RenderState) {
    state
        .without_outline
        .push(format!("{}#{}", input.document_path, footprint.uuid));
}

fn draw_fallback_body(
    context: &ViewRender<'_>,
    footprint: &FootprintInfo,
    component: &HlrStyle,
    svg: &mut String,
    state: &mut RenderState,
) {
    // A callout view draws the pad's real shape: a 1 mm circle or rectangle is
    // what the test engineer probes, not its square envelope.
    if context.callout {
        let rings = footprint.pad_rings();
        if !rings.is_empty() {
            push_body_group(svg, footprint, "pad", None);
            for ring in &rings {
                svg.push_str(&format!(
                    "<path d=\"{}\" stroke=\"{}\" stroke-width=\"{}\" opacity=\"{}\"/>",
                    ring_path(ring),
                    escape(&component.color),
                    number(component.width),
                    number(component.opacity),
                ));
            }
            svg.push_str("</g>");
            count_drawn(state, footprint.index);
            return;
        }
    }
    let Some(ring) = fallback_ring(footprint, &context.data.geometry) else {
        return;
    };
    push_body_group(svg, footprint, "envelope", None);
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

fn push_body_group(svg: &mut String, footprint: &FootprintInfo, kind: &str, dash: Option<&str>) {
    let dash = dash.map_or_else(String::new, |dash| format!(" stroke-dasharray=\"{dash}\""));
    svg.push_str(&format!(
        "<g data-component=\"{}\" data-footprint-uuid=\"{}\" data-bounds-kind=\"{}\" stroke=\"#000000\" fill=\"none\"{}>",
        escape(footprint.reference.as_deref().unwrap_or_default()),
        escape(&footprint.uuid),
        kind,
        dash,
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

pub(super) fn point_nm(x: i64, y: i64) -> Point {
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
