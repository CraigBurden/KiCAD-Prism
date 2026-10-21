//! The designator pass: selector gating, body-region fallbacks and the
//! Autodoc fit. Split from `render` so the compositing file stays small.

use std::collections::BTreeMap;

use geo::BoundingRect;
use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkAssemblyDesignatorStyle, ArtworkConfigA0, ArtworkSelectorOverride, ArtworkView,
};

use super::super::designator::{
    self, DesignatorFitSession, region_from_rings, text_box, text_box_fits_region,
};
use super::super::geometry::{self, Point};
use super::super::svg::{escape, number};
use super::super::{ArtworkInput, BoardData, FootSide, FootprintInfo};
use super::RenderState;

pub(super) fn render_designators(
    input: &ArtworkInput<'_>,
    data: &BoardData,
    view: &ArtworkView,
    token: &str,
    selected: &[usize],
    svg: &mut String,
    state: &mut RenderState,
) {
    if input.config.global.styles.assembly_designators.is_none() {
        return;
    }
    let style = designator_style(input.config, &view.styles, None);
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
    let mut session = DesignatorFitSession::default();
    for index in selected {
        let footprint = &data.footprints[*index];
        if footprint.side != side {
            continue;
        }
        let Some(designator) = footprint.reference.as_deref() else {
            continue;
        };
        let component =
            designator_style(input.config, &view.styles, footprint.reference.as_deref());
        if !component.enabled {
            continue;
        }
        let Some(region) = footprint_region(footprint, data) else {
            continue;
        };
        if place_designator(
            svg,
            footprint,
            designator,
            &region,
            &component,
            &mut session,
        ) {
            state.designators_placed += 1;
        }
    }
    svg.push_str("</g>\n");
}

/// Fit one designator inside `region` and write its `<text>`; false only when
/// no text box fits the region at any size.
fn place_designator(
    svg: &mut String,
    footprint: &FootprintInfo,
    designator: &str,
    region: &geo::MultiPolygon<f64>,
    component: &DesignatorStyle,
    session: &mut DesignatorFitSession,
) -> bool {
    let rotations = component.rotations(region);
    let Some(fit) = session.fit(
        designator,
        region,
        component.fill_ratio,
        component.max_font,
        &rotations,
    ) else {
        return false;
    };
    let font_size = font_size_for(region, designator, fit, component.min_font);
    let color = if footprint.dnp {
        component.dnp_color.clone()
    } else {
        component.color.clone()
    };
    let corners = text_box(designator, fit.center, font_size, fit.rotation_deg);
    let (min_x, min_y, max_x, max_y) = corner_bounds(corners);
    let transform = if fit.rotation_deg.abs() > 1.0e-9 {
        format!(
            " transform=\"rotate({} {} {})\"",
            number(fit.rotation_deg),
            number(fit.center.x),
            number(fit.center.y)
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
        number(fit.center.x),
        number(fit.center.y),
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
        number(fit.rotation_deg),
        if footprint.hlr.is_some() { "outline" } else { "fallback" },
        footprint.dnp,
        escape(designator),
    ));
    true
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

fn footprint_region(footprint: &FootprintInfo, data: &BoardData) -> Option<geo::MultiPolygon<f64>> {
    if let Some(index) = footprint.hlr
        && let Some(outline) = &data.hlr[index].outline
        && let Some(rings) = geometry::hlr_region(outline)
        && let Some(region) = region_from_rings(&rings)
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
) -> f64 {
    if fit.font_size_mm >= min_font {
        return fit.font_size_mm;
    }
    let minimum = designator::DesignatorFit {
        font_size_mm: min_font,
        ..fit
    };
    if text_box_fits_region(region, designator, minimum) {
        min_font
    } else {
        fit.font_size_mm
    }
}

pub(super) struct DesignatorStyle {
    enabled: bool,
    color: String,
    dnp_color: String,
    fill_ratio: f64,
    min_font: f64,
    max_font: f64,
    threshold: f64,
    direction: f64,
    opacity: f64,
    font_family: String,
    font_weight: Option<String>,
    selectors: BTreeMap<String, ArtworkSelectorOverride>,
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
