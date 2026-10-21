//! `--paper-scale`: draw at a known paper ratio instead of board millimetres.
//!
//! Every length in an `ArtworkConfigA0` is a board millimetre: a 0.25 mm body
//! outline and a 2.5 mm maximum designator are what the drawing needs at 1:1.
//! Placed at 5:1 they print 1.25 mm and 12.5 mm, which is not what the drawing
//! asked for. When the caller knows the ratio the sheet will use, dividing the
//! config's lengths by it before drawing makes them print at their configured
//! size on paper. Geometry, canvas and the designator fitting region stay in
//! board millimetres: only the ink weights, type limits and hatch spacing
//! change.
//!
//! This module is the one place that division happens, so the config stays the
//! single description of a drawing at 1:1.

use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkAssemblyDesignatorStyle, ArtworkBoardCutoutStyle, ArtworkBoardOutlineStyle,
    ArtworkComponentOverride, ArtworkConfigA0, ArtworkDnp, ArtworkDnpStyle, ArtworkHlrStyle,
    ArtworkPin1MarkerStyle, ArtworkStyles,
};

/// Divide a config length by `ratio` when it is present.
fn divide(value: &mut Option<f64>, ratio: f64) {
    if let Some(length) = value {
        *length /= ratio;
    }
}

fn scale_styles(styles: &mut ArtworkStyles, ratio: f64) {
    if let Some(style) = styles.board_outline.as_mut() {
        scale_board_outline(style, ratio);
    }
    if let Some(style) = styles.board_cutouts.as_mut() {
        scale_board_cutouts(style, ratio);
    }
    if let Some(style) = styles.assembly_hlr.as_mut() {
        scale_hlr(style, ratio);
    }
    if let Some(style) = styles.dnp.as_mut() {
        scale_dnp_style(style, ratio);
    }
    if let Some(style) = styles.assembly_designators.as_mut() {
        scale_designators(style, ratio);
    }
    if let Some(style) = styles.pin1_marker.as_mut() {
        scale_pin1(style, ratio);
    }
}

fn scale_board_outline(style: &mut ArtworkBoardOutlineStyle, ratio: f64) {
    divide(&mut style.line_width_mm, ratio);
}

fn scale_board_cutouts(style: &mut ArtworkBoardCutoutStyle, ratio: f64) {
    divide(&mut style.outline_width_mm, ratio);
}

fn scale_hlr(style: &mut ArtworkHlrStyle, ratio: f64) {
    divide(&mut style.line_width_mm, ratio);
}

fn scale_dnp_style(style: &mut ArtworkDnpStyle, ratio: f64) {
    divide(&mut style.hatch_line_width_mm, ratio);
    divide(&mut style.hatch_spacing_mm, ratio);
}

fn scale_designators(style: &mut ArtworkAssemblyDesignatorStyle, ratio: f64) {
    divide(&mut style.min_font_size_mm, ratio);
    divide(&mut style.max_font_size_mm, ratio);
}

fn scale_pin1(style: &mut ArtworkPin1MarkerStyle, ratio: f64) {
    divide(&mut style.dot_diameter_mm, ratio);
    divide(&mut style.min_dot_diameter_mm, ratio);
    divide(&mut style.max_dot_diameter_mm, ratio);
}

fn scale_dnp(dnp: &mut ArtworkDnp, ratio: f64) {
    dnp.hatch_line_width_mm /= ratio;
    dnp.hatch_spacing_mm /= ratio;
}

fn scale_component(component: &mut ArtworkComponentOverride, ratio: f64) {
    if let Some(style) = component.assembly_hlr.as_mut() {
        scale_hlr(style, ratio);
    }
    if let Some(style) = component.assembly_designators.as_mut() {
        scale_designators(style, ratio);
    }
}

/// The config as it is drawn at `ratio` sheet millimetres per board millimetre.
///
/// `ratio` must be positive and finite; the CLI checks that before any work, so
/// this function does not guess what a bad ratio means.
pub(crate) fn scaled(config: &ArtworkConfigA0, ratio: f64) -> ArtworkConfigA0 {
    let mut config = config.clone();
    scale_styles(&mut config.global.styles, ratio);
    scale_dnp(&mut config.dnp, ratio);
    for view in &mut config.views {
        scale_styles(&mut view.styles, ratio);
    }
    for component in config.components.0.values_mut() {
        scale_component(component, ratio);
    }
    config
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> ArtworkConfigA0 {
        serde_json::from_str(include_str!("../../configs/assembly.json")).unwrap()
    }

    #[test]
    fn every_configured_length_is_divided() {
        let source = config();
        let ratio = 5.0;
        let scaled = scaled(&source, ratio);

        let global = &scaled.global.styles;
        assert_eq!(
            global.board_outline.as_ref().unwrap().line_width_mm,
            source
                .global
                .styles
                .board_outline
                .as_ref()
                .unwrap()
                .line_width_mm
                .map(|value| value / ratio)
        );
        assert_eq!(
            global.assembly_hlr.as_ref().unwrap().line_width_mm,
            source
                .global
                .styles
                .assembly_hlr
                .as_ref()
                .unwrap()
                .line_width_mm
                .map(|value| value / ratio)
        );
        assert_eq!(
            global
                .assembly_designators
                .as_ref()
                .unwrap()
                .max_font_size_mm,
            source
                .global
                .styles
                .assembly_designators
                .as_ref()
                .unwrap()
                .max_font_size_mm
                .map(|value| value / ratio)
        );
        assert_eq!(
            global
                .assembly_designators
                .as_ref()
                .unwrap()
                .min_font_size_mm,
            source
                .global
                .styles
                .assembly_designators
                .as_ref()
                .unwrap()
                .min_font_size_mm
                .map(|value| value / ratio)
        );
        assert_eq!(
            global.pin1_marker.as_ref().unwrap().dot_diameter_mm,
            source
                .global
                .styles
                .pin1_marker
                .as_ref()
                .unwrap()
                .dot_diameter_mm
                .map(|value| value / ratio)
        );
        assert_eq!(
            scaled.dnp.hatch_line_width_mm,
            source.dnp.hatch_line_width_mm / ratio
        );
        assert_eq!(
            scaled.dnp.hatch_spacing_mm,
            source.dnp.hatch_spacing_mm / ratio
        );
        for (after, before) in scaled.views.iter().zip(&source.views) {
            let after_style = after.styles.assembly_designators.as_ref().unwrap();
            let before_style = before.styles.assembly_designators.as_ref().unwrap();
            assert_eq!(
                after_style.max_font_size_mm,
                before_style.max_font_size_mm.map(|value| value / ratio)
            );
        }
    }

    #[test]
    fn dnp_hatch_spacing_is_a_paper_length() {
        let source = config();
        let scaled = scaled(&source, 2.5);
        assert_eq!(
            scaled.dnp.hatch_spacing_mm,
            source.dnp.hatch_spacing_mm / 2.5
        );
    }

    #[test]
    fn geometry_and_non_length_settings_are_untouched() {
        let source = config();
        let scaled = scaled(&source, 2.0);
        assert_eq!(
            scaled.global.canvas.margin_mm,
            source.global.canvas.margin_mm
        );
        assert_eq!(scaled.global.svg_scale, source.global.svg_scale);
        assert_eq!(scaled.dnp.hatch, source.dnp.hatch);
        assert_eq!(scaled.dnp.hatch_angle_deg.0, source.dnp.hatch_angle_deg.0);
        assert_eq!(
            scaled
                .global
                .styles
                .pin1_marker
                .as_ref()
                .unwrap()
                .pad_diameter_ratio,
            source
                .global
                .styles
                .pin1_marker
                .as_ref()
                .unwrap()
                .pad_diameter_ratio
        );
        assert_eq!(
            scaled
                .views
                .iter()
                .map(|view| view.name.clone())
                .collect::<Vec<_>>(),
            source
                .views
                .iter()
                .map(|view| view.name.clone())
                .collect::<Vec<_>>()
        );
    }

    #[test]
    fn a_ratio_of_one_changes_nothing() {
        let source = config();
        assert_eq!(
            serde_json::to_value(scaled(&source, 1.0)).unwrap(),
            serde_json::to_value(&source).unwrap()
        );
    }

    #[test]
    fn a_component_override_is_divided_too() {
        let mut source = config();
        let component = ArtworkComponentOverride {
            assembly_hlr: Some(ArtworkHlrStyle {
                line_width_mm: Some(0.3),
                ..Default::default()
            }),
            assembly_designators: Some(ArtworkAssemblyDesignatorStyle {
                max_font_size_mm: Some(2.0),
                ..Default::default()
            }),
            ..Default::default()
        };
        source.components.0.insert("U1".to_owned(), component);

        let scaled = scaled(&source, 4.0);
        let component = scaled.components.0.get("U1").unwrap();
        assert_eq!(
            component.assembly_hlr.as_ref().unwrap().line_width_mm,
            Some(0.075)
        );
        assert_eq!(
            component
                .assembly_designators
                .as_ref()
                .unwrap()
                .max_font_size_mm,
            Some(0.5)
        );
    }
}
