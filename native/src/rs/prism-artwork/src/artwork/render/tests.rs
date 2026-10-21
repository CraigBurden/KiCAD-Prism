//! Unit tests for selection, the canvas, the DNP hatch, callout placement and
//! the mirrored bottom view.

use std::collections::BTreeMap;

use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkCanvasBounds, ArtworkConfigA0,
};

use super::callouts::{self, CalloutPlacement};
use super::designators::{
    designator_style, font_size_for, selected_by_designators, selector_matches,
};
use super::*;

fn config() -> ArtworkConfigA0 {
    serde_json::from_str(include_str!("../../../configs/assembly.json")).unwrap()
}

fn testpoint_config() -> ArtworkConfigA0 {
    serde_json::from_str(include_str!("../../../configs/testpoints.json")).unwrap()
}

fn empty_hlr() -> prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrA0 {
    prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrA0 {
        schema: "prism.assembly_hlr.a0".to_owned(),
        options: prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrOptions {
            projection_algorithm: None,
            outline_algorithm:
                prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrOutlineAlgorithm::HlrClose,
            curve_mode:
                prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrCurveMode::NativeArcs,
            samples_per_curve: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Count(24),
            round_digits: prism_kicad_contracts::generated::prism_assembly_hlr_a0::Count(3),
            include_visible: true,
            include_outline: true,
            union_polygons: true,
            mesh_linear_deflection: None,
            mesh_angular_deflection: None,
            mesh_relative: None,
            hlr_angle_tolerance: None,
            edge_flags: None,
        },
        runtime: prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrRuntime {
            geometer_version: "2026.9.19".to_owned(),
        },
        footprints: Vec::new(),
    }
}

fn placements() -> prism_kicad_contracts::generated::prism_placements_a1::PlacementsA1 {
    prism_kicad_contracts::generated::prism_placements_a1::PlacementsA1 {
        schema: "prism.placements.a1".to_owned(),
        footprints: Vec::new(),
        designators: Vec::new(),
        outline_bounds: None,
        aux_axis_origin: None,
    }
}

fn square_board() -> BoardGeometry {
    BoardGeometry {
        outer: vec![
            Point { x: 0.0, y: 0.0 },
            Point { x: 10.0, y: 0.0 },
            Point { x: 10.0, y: 5.0 },
            Point { x: 0.0, y: 5.0 },
        ],
        cutouts: Vec::new(),
        outline_bounds: Bounds {
            min_x: 0.0,
            min_y: 0.0,
            max_x: 10.0,
            max_y: 5.0,
        },
        drills: Vec::new(),
        slots: Vec::new(),
        pad_envelopes: BTreeMap::new(),
        hole_envelopes: BTreeMap::new(),
    }
}

fn pad(x: f64, y: f64, size: f64) -> PadInfo {
    PadInfo {
        number: "1".to_owned(),
        x,
        y,
        size_x: size,
        size_y: size,
        shape: "circle".to_owned(),
        angle: 0.0,
        roundrect_ratio: None,
    }
}

fn footprint(
    index: usize,
    reference: &str,
    side: FootSide,
    dnp: bool,
    at: (f64, f64),
) -> FootprintInfo {
    FootprintInfo {
        index,
        uuid: format!("uuid-{reference}"),
        reference: Some(reference.to_owned()),
        side,
        dnp,
        at_x: at.0,
        at_y: at.1,
        angle: 0.0,
        pads: vec![pad(0.0, 0.0, 1.0)],
        hole_bounds: None,
        pad_bounds: Some(Bounds {
            min_x: at.0 - 0.5,
            min_y: at.1 - 0.5,
            max_x: at.0 + 0.5,
            max_y: at.1 + 0.5,
        }),
        hlr: None,
    }
}

fn board_data(footprints: Vec<FootprintInfo>) -> BoardData {
    BoardData {
        geometry: square_board(),
        footprints,
        hlr: Vec::new(),
    }
}

fn render<'a>(
    config: &'a ArtworkConfigA0,
    hlr: &'a prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrA0,
    placements: &'a prism_kicad_contracts::generated::prism_placements_a1::PlacementsA1,
    data: &BoardData,
    view_name: &str,
) -> RenderedView {
    let view = config
        .views
        .iter()
        .find(|view| view.name == view_name)
        .expect("the config has the view");
    let input = ArtworkInput {
        board: "",
        document_path: "board.kicad_pcb",
        config,
        hlr,
        placements,
        occurrences: None,
        variant: None,
        views: &[],
        paper_scale: None,
    };
    render_view(&input, data, view).expect("the view renders")
}

fn bounds_for(
    config: &ArtworkConfigA0,
    data: &BoardData,
    selected: &[usize],
    sides: ViewSides,
    callout: bool,
    labels: &BTreeMap<usize, CalloutPlacement>,
) -> Bounds {
    let hlr = empty_hlr();
    let placements = placements();
    let input = ArtworkInput {
        board: "",
        document_path: "board.kicad_pcb",
        config,
        hlr: &hlr,
        placements: &placements,
        occurrences: None,
        variant: None,
        views: &[],
        paper_scale: None,
    };
    canvas_bounds(&input, data, selected, sides, callout, labels)
}

// ------------------------------------------------------------------ canvas

#[test]
fn the_assembly_config_selects_every_designator() {
    let config = config();
    let style = designator_style(&config, &config.views[0].styles, None);
    assert!(selected_by_designators(Some("R1"), &style));
}

#[test]
fn the_testpoint_config_selects_only_testpoints() {
    let config = testpoint_config();
    let style = designator_style(&config, &config.views[0].styles, None);
    assert!(selected_by_designators(Some("TP1"), &style));
    assert!(!selected_by_designators(Some("R1"), &style));
    assert!(!selected_by_designators(None, &style));
    assert!(style.callout, "testpoint views label with callouts");
}

#[test]
fn the_canvas_is_the_board_outline_plus_the_configured_margin() {
    let config = config();
    let data = board_data(Vec::new());
    let bounds = bounds_for(
        &config,
        &data,
        &[],
        ViewSides {
            top: true,
            bottom: true,
        },
        false,
        &BTreeMap::new(),
    );
    assert_eq!(bounds.min_x, -1.0);
    assert_eq!(bounds.min_y, -1.0);
    assert_eq!(bounds.max_x, 11.0);
    assert_eq!(bounds.max_y, 6.0);
}

#[test]
fn board_and_bodies_holds_a_body_that_overhangs_the_outline() {
    let mut config = config();
    config.global.canvas.bounds = ArtworkCanvasBounds::BoardAndBodies;
    let mut overhanging = footprint(0, "J1", FootSide::Top, false, (13.0, 2.5));
    overhanging.pad_bounds = Some(Bounds {
        min_x: 12.5,
        min_y: 2.0,
        max_x: 13.5,
        max_y: 3.0,
    });
    let data = board_data(vec![overhanging]);
    let sides = ViewSides {
        top: true,
        bottom: false,
    };
    let bounds = bounds_for(&config, &data, &[0], sides, false, &BTreeMap::new());
    assert!(
        bounds.max_x >= 13.5 + config.global.canvas.margin_mm,
        "the overhanging body is inside the canvas: {bounds:?}"
    );
    let mut plain = config.clone();
    plain.global.canvas.bounds = ArtworkCanvasBounds::BoardOutline;
    let outline = bounds_for(&plain, &data, &[0], sides, false, &BTreeMap::new());
    assert!(outline.max_x < bounds.max_x);
}

#[test]
fn a_callout_labels_box_is_inside_the_board_and_bodies_canvas() {
    let config = testpoint_config();
    let data = board_data(vec![footprint(0, "TP1", FootSide::Top, false, (9.5, 4.5))]);
    let sides = ViewSides {
        top: true,
        bottom: false,
    };
    let style = designator_style(&config, &config.views[0].styles, None);
    let provisional = bounds_for(&config, &data, &[0], sides, true, &BTreeMap::new());
    let planned = callouts::plan(&data, &[0], sides, style.min_font, provisional, 1.0);
    let bounds = bounds_for(&config, &data, &[0], sides, true, &planned);
    let label = planned.get(&0).expect("a callout was planned").bounds;
    assert!(bounds.contains_bounds(label));
}

// --------------------------------------------------------------------- DNP

#[test]
fn a_dnp_hatch_is_emitted_only_for_dnp_parts() {
    let config = config();
    let data = board_data(vec![
        footprint(0, "R1", FootSide::Top, false, (2.0, 2.0)),
        footprint(1, "R2", FootSide::Top, true, (6.0, 2.0)),
    ]);
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    assert_eq!(rendered.dnp_footprints_hatched, 1);
    assert_eq!(rendered.svg.matches("<g data-dnp=\"true\"").count(), 1);
    assert!(rendered.svg.contains("-dnp-hatch"));
    assert!(rendered.svg.contains("data-footprint-uuid=\"uuid-R2\""));
}

#[test]
fn a_dnp_hatch_is_not_emitted_when_the_style_disables_it() {
    let mut config = config();
    config.dnp.hatch = false;
    let data = board_data(vec![footprint(0, "R2", FootSide::Top, true, (6.0, 2.0))]);
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    assert_eq!(rendered.dnp_footprints_hatched, 0);
    assert!(!rendered.svg.contains("<g data-dnp=\"true\""));
    assert!(!rendered.svg.contains("-dnp-hatch"));
}

// ---------------------------------------------------------------- callouts

fn planned_callouts(data: &BoardData, font: f64) -> BTreeMap<usize, CalloutPlacement> {
    let selected: Vec<usize> = (0..data.footprints.len()).collect();
    callouts::plan(
        data,
        &selected,
        ViewSides {
            top: true,
            bottom: false,
        },
        font,
        Bounds {
            min_x: -20.0,
            min_y: -20.0,
            max_x: 20.0,
            max_y: 20.0,
        },
        1.0,
    )
}

#[test]
fn callouts_are_deterministic_and_do_not_overlap_each_other() {
    let data = board_data(vec![
        footprint(0, "TP1", FootSide::Top, false, (5.0, 5.0)),
        footprint(1, "TP2", FootSide::Top, false, (5.2, 5.0)),
        footprint(2, "TP10", FootSide::Top, false, (5.4, 5.0)),
    ]);
    let first = planned_callouts(&data, 1.0);
    let second = planned_callouts(&data, 1.0);
    assert_eq!(first.len(), 3);
    for index in 0..3 {
        let left = &first[&index];
        let right = &second[&index];
        assert_eq!(left.center, right.center);
        assert_eq!(left.bounds, right.bounds);
    }
    let boxes: Vec<Bounds> = first.values().map(|entry| entry.bounds).collect();
    for (index, left) in boxes.iter().enumerate() {
        for right in boxes.iter().skip(index + 1) {
            assert!(!left.intersects(*right), "{left:?} overlaps {right:?}");
        }
    }
    assert!(first.values().all(|entry| !entry.overlapping));
}

#[test]
fn a_callout_label_clears_the_pads_of_other_testpoints() {
    let mut config = testpoint_config();
    config.global.canvas.bounds = ArtworkCanvasBounds::BoardAndBodies;
    // Two pads 1.2 mm apart: the east label of the first would run across the
    // second pad, so it has to move out.
    let data = board_data(vec![
        footprint(0, "TP1", FootSide::Top, false, (5.0, 5.0)),
        footprint(1, "TP2", FootSide::Top, false, (6.2, 5.0)),
    ]);
    let planned = planned_callouts(&data, 1.0);
    let label = planned[&0].bounds;
    let other_pad = data.footprints[1].pads_bounds().unwrap();
    assert!(!label.intersects(other_pad));
    assert!(planned[&0].leader_from.x != planned[&0].leader_to.x);
}

#[test]
fn designators_keep_natural_order() {
    use super::callouts::natural_cmp;
    let mut names = vec!["TP10", "TP2", "TP1", "TP100"];
    names.sort_by(|left, right| natural_cmp(left, right));
    assert_eq!(names, vec!["TP1", "TP2", "TP10", "TP100"]);
}

// ---------------------------------------------------------------- mirroring

fn designator_x(svg: &str) -> f64 {
    let start = svg.find("<text ").expect("a designator is drawn");
    let rest = &svg[start..];
    let x_start = rest.find("x=\"").expect("the text has an x") + 3;
    let x_end = rest[x_start..].find('"').unwrap() + x_start;
    rest[x_start..x_end].parse().expect("x is a number")
}

#[test]
fn a_mirrored_bottom_view_maps_x_and_keeps_the_glyphs_upright() {
    let mut config = config();
    let data = board_data(vec![footprint(
        0,
        "R1",
        FootSide::Bottom,
        false,
        (4.0, 2.5),
    )]);
    let hlr = empty_hlr();
    let placements = placements();
    let plain = render(&config, &hlr, &placements, &data, "assembly_bottom_view");
    config.global.mirror_bottom_view = false;
    let unmirrored = render(&config, &hlr, &placements, &data, "assembly_bottom_view");
    assert!(
        plain
            .svg
            .contains("data-view-direction=\"bottom-mirrored\"")
    );
    assert!(unmirrored.svg.contains("data-view-direction=\"top\""));
    let mirrored_x = designator_x(&plain.svg);
    let plain_x = designator_x(&unmirrored.svg);
    assert!(
        (mirrored_x + plain_x).abs() < 1.0e-6,
        "{mirrored_x} vs {plain_x}"
    );
    let text = &plain.svg[plain.svg.find("<text ").unwrap()..];
    let text = &text[..text.find("</text>").unwrap()];
    assert!(!text.contains("scale(-1"), "the glyphs are not mirrored");
}

#[test]
fn selector_grammar_matches_cruncher() {
    assert!(selector_matches("TP12", "TP*"));
    assert!(selector_matches("tp12", "TP*"));
    assert!(selector_matches("R5", "R"));
    assert!(selector_matches("R5", "R1-R9"));
    assert!(!selector_matches("R12", "R1-R9"));
    assert!(selector_matches("J1", "J1"));
    assert!(!selector_matches("J1", "X*"));
}

#[test]
fn a_body_too_small_for_the_minimum_font_keeps_a_smaller_label() {
    use super::super::designator::{DesignatorFitSession, region_from_rings, text_box_fits_region};
    let square = |side: f64| {
        region_from_rings(&[vec![
            Point { x: 0.0, y: 0.0 },
            Point { x: side, y: 0.0 },
            Point { x: side, y: side },
            Point { x: 0.0, y: side },
        ]])
        .unwrap()
    };
    let mut session = DesignatorFitSession::default();
    let small = square(1.0);
    let fit = session.fit("TP12", &small, 0.8, 2.5, &[0.0]).unwrap();
    let font = font_size_for(&small, "TP12", fit, 1.0);
    assert!(font < 1.0 && font > 0.0, "{font}");
    assert!(text_box_fits_region(
        &small,
        "TP12",
        super::super::designator::DesignatorFit {
            font_size_mm: font,
            ..fit
        }
    ));
    let large = square(20.0);
    let fit = session.fit("TP12", &large, 0.8, 2.5, &[0.0]).unwrap();
    assert_eq!(font_size_for(&large, "TP12", fit, 1.0), fit.font_size_mm);
}
