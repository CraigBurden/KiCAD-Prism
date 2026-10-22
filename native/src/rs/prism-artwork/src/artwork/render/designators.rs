//! The designator pass: selector gating, DNP hatching, callout labels and the
//! Autodoc fit. Split from `render` so the compositing file stays small.

use std::collections::BTreeMap;

use geo::BoundingRect;
use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkAssemblyDesignatorStyle, ArtworkConfigA0, ArtworkSelectorOverride,
};

use super::super::designator::{
    self, DesignatorFitSession, region_from_rings, text_box, text_box_fits_region,
};
use super::super::geometry::{Bounds, Point};
use super::super::svg::{escape, number, rings_path};
use super::super::{BoardData, FootSide, FootprintInfo};
use super::callouts::CalloutPlacement;
use super::covering::CoveringLabel;
use super::{RenderState, ViewRender, body_rings, mirror_angle, mirror_x};

pub(super) fn render_designators(
    context: &ViewRender<'_>,
    token: &str,
    svg: &mut String,
    state: &mut RenderState,
) {
    if context
        .input
        .config
        .global
        .styles
        .assembly_designators
        .is_none()
    {
        return;
    }
    let view = context.view;
    let style = designator_style(context.input.config, &view.styles, None);
    if !style.enabled {
        return;
    }
    let side = if token.ends_with("BOTTOM") {
        FootSide::Bottom
    } else {
        FootSide::Top
    };
    svg.push_str(&format!(
        "<g id=\"layer-{token}\" data-layer-token=\"{token}\" font-family=\"{}\">",
        escape(&style.font_family)
    ));
    render_dnp_hatch(context, side, svg, state);
    if style.callout {
        render_callout_leaders(context, side, &style, svg);
    }
    let mut session = DesignatorFitSession::default();
    for index in context.selected {
        if render_footprint_designator(context, svg, *index, side, &style, &mut session) {
            state.designators_placed += 1;
        }
    }
    svg.push_str("</g>\n");
}

/// One footprint's designator: a planned callout label, or the fitted text.
fn render_footprint_designator(
    context: &ViewRender<'_>,
    svg: &mut String,
    index: usize,
    side: FootSide,
    style: &DesignatorStyle,
    session: &mut DesignatorFitSession,
) -> bool {
    let footprint = &context.data.footprints[index];
    if footprint.side != side {
        return false;
    }
    let Some(designator) = footprint.reference.as_deref() else {
        return false;
    };
    let component = designator_style(
        context.input.config,
        &context.view.styles,
        footprint.reference.as_deref(),
    );
    if !component.enabled {
        return false;
    }
    if let Some(label) = context.covering_labels.get(&footprint.index) {
        return place_covering(context, svg, footprint, designator, label, &component);
    }
    if style.callout
        && let Some(placement) = context.callouts.get(&footprint.index)
    {
        return place_callout(context, svg, footprint, designator, placement, &component);
    }
    let Some(region) = footprint_region(footprint, context.data, context.callout) else {
        return false;
    };
    place_designator(
        context, svg, footprint, designator, &region, &component, session,
    )
}

/// A DNP footprint's body region, hatched under its designator.
fn render_dnp_hatch(
    context: &ViewRender<'_>,
    side: FootSide,
    svg: &mut String,
    state: &mut RenderState,
) {
    if !context.dnp.hatch {
        return;
    }
    let fill = format!("url(#{}-dnp-hatch)", escape(&context.view.group_id));
    for index in context.selected {
        let footprint = &context.data.footprints[*index];
        if footprint.side != side || !footprint.dnp {
            continue;
        }
        let Some(rings) = body_rings(footprint, context.data, context.callout) else {
            continue;
        };
        svg.push_str(&format!(
            "<g data-dnp=\"true\" data-component=\"{}\" data-footprint-uuid=\"{}\"{}>",
            escape(footprint.reference.as_deref().unwrap_or_default()),
            escape(&footprint.uuid),
            super::layer_transform(context.mirror),
        ));
        svg.push_str(&format!(
            "<path d=\"{}\" fill=\"{}\" fill-rule=\"evenodd\" stroke=\"none\"/>",
            rings_path(&rings),
            fill,
        ));
        svg.push_str("</g>");
        state.dnp_footprints_hatched += 1;
    }
}

/// The leader lines of a callout view, drawn under the label text.
fn render_callout_leaders(
    context: &ViewRender<'_>,
    side: FootSide,
    style: &DesignatorStyle,
    svg: &mut String,
) {
    svg.push_str("<g data-callout-leaders=\"true\" stroke-linecap=\"round\">");
    for index in context.selected {
        let footprint = &context.data.footprints[*index];
        if footprint.side != side {
            continue;
        }
        let Some(placement) = context.callouts.get(&footprint.index) else {
            continue;
        };
        let color = if footprint.dnp {
            &style.dnp_color
        } else {
            &style.color
        };
        svg.push_str(&format!(
            "<line x1=\"{}\" y1=\"{}\" x2=\"{}\" y2=\"{}\" stroke=\"{}\" stroke-width=\"{}\" data-primitive=\"callout-leader\" data-component=\"{}\" data-footprint-uuid=\"{}\"/>",
            number(mirror_x(placement.leader_from.x, context.mirror)),
            number(placement.leader_from.y),
            number(mirror_x(placement.leader_to.x, context.mirror)),
            number(placement.leader_to.y),
            escape(color),
            number(LEADER_WIDTH_MM / context.paper_scale.max(f64::MIN_POSITIVE)),
            escape(footprint.reference.as_deref().unwrap_or_default()),
            escape(&footprint.uuid),
        ));
    }
    svg.push_str("</g>");
}

/// A leader line thinner than the body outline yet visible at 1:1.
const LEADER_WIDTH_MM: f64 = 0.1;

/// The gap the fitted text keeps from the body outline, in paper millimetres.
/// Like every configured length it divides by `--paper-scale`, so it prints at
/// this size whatever the drawing scale.
pub(super) const DESIGNATOR_CLEARANCE_MM: f64 = 0.15;

/// The insets a designator is fitted with, most to least strict: half the body
/// outline plus the clearance, then half the outline, then none. The fallbacks
/// keep a label on a body too thin for its outline, because a small label is
/// better than a missing one.
fn body_insets(context: &ViewRender<'_>, footprint: &FootprintInfo) -> [f64; 3] {
    let half_stroke = body_outline_width(context, footprint) / 2.0;
    let clearance = DESIGNATOR_CLEARANCE_MM / context.paper_scale.max(f64::MIN_POSITIVE);
    [half_stroke + clearance, half_stroke, 0.0]
}

/// The width the footprint's body outline is drawn with, in drawing
/// millimetres (already divided by `--paper-scale`). Zero when no body outline
/// is drawn, so the designator needs no extra inset.
fn body_outline_width(context: &ViewRender<'_>, footprint: &FootprintInfo) -> f64 {
    let Some(global) = context.input.config.global.styles.assembly_hlr.as_ref() else {
        return 0.0;
    };
    let local = context.view.styles.assembly_hlr.as_ref();
    let enabled = local
        .and_then(|style| style.enabled)
        .or(global.enabled)
        .unwrap_or(true);
    if !enabled {
        return 0.0;
    }
    let width = local
        .and_then(|style| style.line_width_mm)
        .or(global.line_width_mm)
        .unwrap_or(0.12);
    let include_outline = local
        .and_then(|style| style.include_outline)
        .or(global.include_outline)
        .unwrap_or(true);
    let component = component_override(context.input.config, footprint.reference.as_deref())
        .and_then(|override_| override_.assembly_hlr.as_ref());
    let width = component
        .and_then(|style| style.line_width_mm)
        .unwrap_or(width);
    let include_outline = component
        .and_then(|style| style.include_outline)
        .unwrap_or(include_outline);
    if include_outline { width.max(0.0) } else { 0.0 }
}

/// The first inset that admits a fit, with the inset that produced it.
fn fit_designator(
    session: &mut DesignatorFitSession,
    designator: &str,
    region: &geo::MultiPolygon<f64>,
    component: &DesignatorStyle,
    rotations: &[f64],
    insets: &[f64],
) -> Option<(designator::DesignatorFit, f64)> {
    insets.iter().find_map(|&inset| {
        session
            .fit(
                designator,
                region,
                component.fill_ratio,
                component.max_font,
                rotations,
                inset,
            )
            .map(|fit| (fit, inset))
    })
}

/// Fit one designator inside `region` and write its `<text>`; false only when
/// no text box fits the region at any size.
fn place_designator(
    context: &ViewRender<'_>,
    svg: &mut String,
    footprint: &FootprintInfo,
    designator: &str,
    region: &geo::MultiPolygon<f64>,
    component: &DesignatorStyle,
    session: &mut DesignatorFitSession,
) -> bool {
    let rotations = component.rotations(region);
    let insets = body_insets(context, footprint);
    let Some((fit, inset)) =
        fit_designator(session, designator, region, component, &rotations, &insets)
    else {
        return false;
    };
    let font_size = font_size_for(region, designator, fit, component.min_font, inset);
    let color = designator_color(footprint, component);
    let corners = text_box(designator, fit.center, font_size, fit.rotation_deg);
    let (min_x, min_y, max_x, max_y) = corner_bounds(corners);
    let center = Point {
        x: mirror_x(fit.center.x, context.mirror),
        y: fit.center.y,
    };
    let rotation = mirror_angle(fit.rotation_deg, context.mirror);
    let mirror = context.mirror;
    let (min_x, max_x) = if mirror {
        (-max_x, -min_x)
    } else {
        (min_x, max_x)
    };
    let transform = if rotation.abs() > 1.0e-9 {
        format!(
            " transform=\"rotate({} {} {})\"",
            number(rotation),
            number(center.x),
            number(center.y)
        )
    } else {
        String::new()
    };
    let weight = component
        .font_weight
        .as_deref()
        .map_or_else(String::new, |weight| {
            format!(" font-weight=\"{}\"", escape(weight))
        });
    svg.push_str(&format!(
        "<text x=\"{}\" y=\"{}\"{transform} font-size=\"{}\" text-anchor=\"middle\" dominant-baseline=\"central\" fill=\"{}\" opacity=\"{}\"{weight} data-primitive=\"assembly-designator\" data-component=\"{}\" data-footprint-uuid=\"{}\" data-font-size-mm=\"{}\" data-text-box-min-x=\"{}\" data-text-box-min-y=\"{}\" data-text-box-max-x=\"{}\" data-text-box-max-y=\"{}\" data-rotation-deg=\"{}\" data-bounds-kind=\"{}\" data-dnp=\"{}\" >{}</text>",
        number(center.x),
        number(center.y),
        number(font_size),
        escape(&color),
        number(component.opacity),
        escape(designator),
        escape(&footprint.uuid),
        number(font_size),
        number(min_x),
        number(min_y),
        number(max_x),
        number(max_y),
        number(rotation),
        if footprint.hlr.is_some() { "outline" } else { "fallback" },
        footprint.dnp,
        escape(designator),
    ));
    true
}

/// Place a covering part's label at the planned position just outside its
/// body, above the top edge unless the plan fell back below the bottom edge.
fn place_covering(
    context: &ViewRender<'_>,
    svg: &mut String,
    footprint: &FootprintInfo,
    designator: &str,
    label: &CoveringLabel,
    component: &DesignatorStyle,
) -> bool {
    let font_size = label.font_size_mm;
    let color = designator_color(footprint, component);
    let bounds = if context.mirror {
        label.bounds.mirrored()
    } else {
        label.bounds
    };
    let center = Point {
        x: mirror_x(label.center.x, context.mirror),
        y: label.center.y,
    };
    let weight = component
        .font_weight
        .as_deref()
        .map_or_else(String::new, |weight| {
            format!(" font-weight=\"{}\"", escape(weight))
        });
    svg.push_str(&format!(
        "<text x=\"{}\" y=\"{}\" font-size=\"{}\" text-anchor=\"middle\" dominant-baseline=\"central\" fill=\"{}\" opacity=\"{}\"{weight} data-primitive=\"assembly-designator\" data-component=\"{}\" data-footprint-uuid=\"{}\" data-font-size-mm=\"{}\" data-text-box-min-x=\"{}\" data-text-box-min-y=\"{}\" data-text-box-max-x=\"{}\" data-text-box-max-y=\"{}\" data-rotation-deg=\"0\" data-bounds-kind=\"covering\" data-dnp=\"{}\" >{}</text>",
        number(center.x),
        number(center.y),
        number(font_size),
        escape(&color),
        number(component.opacity),
        escape(designator),
        escape(&footprint.uuid),
        number(font_size),
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.max_x),
        number(bounds.max_y),
        footprint.dnp,
        escape(designator),
    ));
    true
}

/// Place a callout label at the planned position, outside the pad.
fn place_callout(
    context: &ViewRender<'_>,
    svg: &mut String,
    footprint: &FootprintInfo,
    designator: &str,
    placement: &CalloutPlacement,
    component: &DesignatorStyle,
) -> bool {
    let font_size = placement.font_size_mm;
    let color = designator_color(footprint, component);
    let bounds: Bounds = if context.mirror {
        placement.bounds.mirrored()
    } else {
        placement.bounds
    };
    let center = Point {
        x: mirror_x(placement.center.x, context.mirror),
        y: placement.center.y,
    };
    let weight = component
        .font_weight
        .as_deref()
        .map_or_else(String::new, |weight| {
            format!(" font-weight=\"{}\"", escape(weight))
        });
    svg.push_str(&format!(
        "<text x=\"{}\" y=\"{}\" font-size=\"{}\" text-anchor=\"middle\" dominant-baseline=\"central\" fill=\"{}\" opacity=\"{}\"{weight} data-primitive=\"assembly-designator\" data-callout=\"true\" data-overlapping=\"{}\" data-component=\"{}\" data-footprint-uuid=\"{}\" data-font-size-mm=\"{}\" data-text-box-min-x=\"{}\" data-text-box-min-y=\"{}\" data-text-box-max-x=\"{}\" data-text-box-max-y=\"{}\" data-rotation-deg=\"0\" data-bounds-kind=\"callout\" data-dnp=\"{}\" >{}</text>",
        number(center.x),
        number(center.y),
        number(font_size),
        escape(&color),
        number(component.opacity),
        placement.overlapping,
        escape(designator),
        escape(&footprint.uuid),
        number(font_size),
        number(bounds.min_x),
        number(bounds.min_y),
        number(bounds.max_x),
        number(bounds.max_y),
        footprint.dnp,
        escape(designator),
    ));
    true
}

fn designator_color(footprint: &FootprintInfo, component: &DesignatorStyle) -> String {
    if footprint.dnp {
        component.dnp_color.clone()
    } else {
        component.color.clone()
    }
}

fn corner_bounds(corners: [Point; 4]) -> (f64, f64, f64, f64) {
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    for corner in corners {
        min_x = min_x.min(corner.x);
        min_y = min_y.min(corner.y);
        max_x = max_x.max(corner.x);
        max_y = max_y.max(corner.y);
    }
    (min_x, min_y, max_x, max_y)
}

fn footprint_region(
    footprint: &FootprintInfo,
    data: &BoardData,
    callout: bool,
) -> Option<geo::MultiPolygon<f64>> {
    if let Some(region) =
        body_rings(footprint, data, callout).and_then(|rings| region_from_rings(&rings))
    {
        return Some(region);
    }
    let fallback = footprint.hole_bounds.or(footprint.pad_bounds)?.ring();
    region_from_rings(&[fallback])
}

/// The font for a fit: below `min_font`, the minimum when it still fits;
/// otherwise the largest size that fits, as today's Cruncher does
/// (`_assembly_designator_font_size`), so a small body keeps its label.
pub(super) fn font_size_for(
    region: &geo::MultiPolygon<f64>,
    designator: &str,
    fit: designator::DesignatorFit,
    min_font: f64,
    inset_mm: f64,
) -> f64 {
    if fit.font_size_mm >= min_font {
        return fit.font_size_mm;
    }
    let minimum = designator::DesignatorFit {
        font_size_mm: min_font,
        ..fit
    };
    if text_box_fits_region(region, designator, minimum, inset_mm) {
        min_font
    } else {
        fit.font_size_mm
    }
}

pub(super) struct DesignatorStyle {
    pub enabled: bool,
    pub color: String,
    pub dnp_color: String,
    fill_ratio: f64,
    pub min_font: f64,
    pub max_font: f64,
    threshold: f64,
    direction: f64,
    opacity: f64,
    font_family: String,
    font_weight: Option<String>,
    pub callout: bool,
    pub selectors: BTreeMap<String, ArtworkSelectorOverride>,
}

impl DesignatorStyle {
    fn rotations(&self, region: &geo::MultiPolygon<f64>) -> Vec<f64> {
        let Some(bounds) = region.bounding_rect() else {
            return vec![0.0];
        };
        let width = bounds.width();
        let height = bounds.height();
        if width > 0.0 && height / width > self.threshold {
            vec![0.0, self.direction]
        } else {
            vec![0.0]
        }
    }
}

pub(super) fn designator_style(
    config: &ArtworkConfigA0,
    view_styles: &prism_kicad_contracts::generated::prism_artwork_config_a0::ArtworkStyles,
    designator: Option<&str>,
) -> DesignatorStyle {
    let global = config.global.styles.assembly_designators.as_ref();
    let local = view_styles.assembly_designators.as_ref();
    let component = designator
        .and_then(|reference| config.components.0.get(reference))
        .and_then(|override_| override_.assembly_designators.as_ref());
    merge_designator(global, local, component, config)
}

fn merge_designator(
    global: Option<&ArtworkAssemblyDesignatorStyle>,
    local: Option<&ArtworkAssemblyDesignatorStyle>,
    component: Option<&ArtworkAssemblyDesignatorStyle>,
    config: &ArtworkConfigA0,
) -> DesignatorStyle {
    let pick_bool = |get: &dyn Fn(&ArtworkAssemblyDesignatorStyle) -> Option<bool>| {
        component
            .and_then(get)
            .or_else(|| local.and_then(get))
            .or_else(|| global.and_then(get))
    };
    let pick_f64 = |get: &dyn Fn(&ArtworkAssemblyDesignatorStyle) -> Option<f64>| {
        component
            .and_then(get)
            .or_else(|| local.and_then(get))
            .or_else(|| global.and_then(get))
    };
    let pick_string = |get: &dyn Fn(&ArtworkAssemblyDesignatorStyle) -> Option<String>| {
        component
            .and_then(get)
            .or_else(|| local.and_then(get))
            .or_else(|| global.and_then(get))
    };
    let selectors = component
        .and_then(|style| style.selector_overrides.as_ref())
        .or_else(|| local.and_then(|style| style.selector_overrides.as_ref()))
        .or_else(|| global.and_then(|style| style.selector_overrides.as_ref()))
        .map(|record| record.0.clone())
        .unwrap_or_default();
    let direction =
        pick_string(&|style| style.rotation_direction.clone()).unwrap_or_else(|| "ccw".to_owned());
    let direction = match direction.trim().to_ascii_lowercase().as_str() {
        "cw" | "clockwise" | "right" | "+90" | "90" => 90.0,
        _ => -90.0,
    };
    DesignatorStyle {
        enabled: pick_bool(&|style| style.enabled).unwrap_or(true),
        color: pick_string(&|style| style.color.clone())
            .unwrap_or_else(|| config.assembly.designator_color.clone()),
        dnp_color: config.assembly.dnp_designator_color.clone(),
        fill_ratio: pick_f64(&|style| style.box_fill_ratio).unwrap_or(0.8),
        min_font: pick_f64(&|style| style.min_font_size_mm).unwrap_or(0.5),
        max_font: pick_f64(&|style| style.max_font_size_mm).unwrap_or(2.5),
        threshold: pick_f64(&|style| style.rotation_aspect_threshold).unwrap_or(1.5),
        direction,
        opacity: pick_f64(&|style| style.opacity).unwrap_or(1.0),
        font_family: "Arial, sans-serif".to_owned(),
        font_weight: pick_string(&|style| style.font_weight.clone()),
        callout: pick_bool(&|style| style.callout).unwrap_or(false),
        selectors,
    }
}

pub(super) fn selected_by_designators(reference: Option<&str>, style: &DesignatorStyle) -> bool {
    if style.selectors.is_empty() {
        return true;
    }
    let reference = reference.unwrap_or_default();
    style
        .selectors
        .iter()
        .rfind(|(selector, _)| selector_matches(reference, selector))
        .is_some_and(|(_, override_)| override_.enabled)
}

pub(super) fn component_override<'a>(
    config: &'a ArtworkConfigA0,
    designator: Option<&str>,
) -> Option<&'a prism_kicad_contracts::generated::prism_artwork_config_a0::ArtworkComponentOverride>
{
    designator.and_then(|reference| config.components.0.get(reference))
}

/// Cruncher's selector grammar (`_designator_selector_matches`): a prefix
/// ending in `*`, a bare alphabetic prefix, a `R1-R9` range, or an exact name.
pub(super) fn selector_matches(designator: &str, selector: &str) -> bool {
    let upper = designator.trim().to_ascii_uppercase();
    let raw = selector.trim().to_ascii_uppercase();
    if raw.is_empty() {
        return false;
    }
    if let Some(prefix) = raw.strip_suffix('*') {
        return upper.starts_with(prefix);
    }
    if raw.chars().all(|character| character.is_ascii_alphabetic()) {
        return upper.starts_with(&raw);
    }
    if let Some((prefix, start, end)) = range_parts(&raw) {
        let Some((candidate_prefix, candidate_number)) = split_reference(&upper) else {
            return false;
        };
        if candidate_prefix != prefix {
            return false;
        }
        let low = start.min(end);
        let high = start.max(end);
        return (low..=high).contains(&candidate_number);
    }
    upper == raw
}

fn range_parts(raw: &str) -> Option<(String, u64, u64)> {
    let (left, right) = raw.split_once('-')?;
    let (prefix_a, start) = split_reference(left)?;
    let (prefix_b, end) = split_reference(right)?;
    (prefix_a == prefix_b).then_some((prefix_a, start, end))
}

fn split_reference(value: &str) -> Option<(String, u64)> {
    let split = value
        .find(|character: char| character.is_ascii_digit())
        .unwrap_or(value.len());
    if split == 0 || split == value.len() {
        return None;
    }
    let (prefix, digits) = value.split_at(split);
    digits
        .parse()
        .ok()
        .map(|number| (prefix.to_owned(), number))
}
