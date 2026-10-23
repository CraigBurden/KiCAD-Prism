//! Unit tests for selection, the canvas, the DNP hatch, callout placement and
//! the mirrored bottom view.

use std::collections::BTreeMap;

use prism_kicad_contracts::generated::prism_artwork_config_a0::{
    ArtworkCanvasBounds, ArtworkConfigA0,
};

use super::super::geometry::BoardGeometry;
use super::callouts::{self, CalloutPlacement};
use super::covering::CoveringLabel;
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
        rings: vec![geometry::circle_ring(Point { x: 0.0, y: 0.0 }, size / 2.0)],
    }
}

/// A `width` × `height` rectangle turned by `angle` (board frame, KiCad's
/// y-down rotation), as `PcbPad::copper_rings` gives it.
fn rect_ring(width: f64, height: f64, angle: f64) -> Vec<Point> {
    let (half_w, half_h) = (width / 2.0, height / 2.0);
    [
        (-half_w, -half_h),
        (half_w, -half_h),
        (half_w, half_h),
        (-half_w, half_h),
    ]
    .into_iter()
    .map(|(x, y)| {
        Point::from(prism_kicad_core::kicad_rotate(
            prism_kicad_core::PcbPoint { x, y },
            angle,
        ))
    })
    .collect()
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

fn board_data_with_hlr(
    footprints: Vec<FootprintInfo>,
    hlr: Vec<prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint>,
) -> BoardData {
    BoardData {
        geometry: square_board(),
        footprints,
        hlr,
    }
}

fn hlr_segment(
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
) -> prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrSegment {
    use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{Nanometres, PointNm};
    let nm = |value: f64| Nanometres((value * 1_000_000.0).round() as i64);
    prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrSegment {
        start_nm: PointNm {
            x_nm: nm(x1),
            y_nm: nm(y1),
        },
        end_nm: PointNm {
            x_nm: nm(x2),
            y_nm: nm(y2),
        },
    }
}

type HlrEdges = prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrEdges;

fn rectangle_edges(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> HlrEdges {
    HlrEdges {
        segments: vec![
            hlr_segment(min_x, min_y, max_x, min_y),
            hlr_segment(max_x, min_y, max_x, max_y),
            hlr_segment(max_x, max_y, min_x, max_y),
            hlr_segment(min_x, max_y, min_x, min_y),
        ],
        arcs: Vec::new(),
    }
}

fn line_edges(x1: f64, y1: f64, x2: f64, y2: f64) -> HlrEdges {
    HlrEdges {
        segments: vec![hlr_segment(x1, y1, x2, y2)],
        arcs: Vec::new(),
    }
}

fn hlr_body(
    reference: &str,
    outline: HlrEdges,
    detail: HlrEdges,
) -> prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint {
    use prism_kicad_contracts::generated::prism_assembly_hlr_a0::{
        KiCadUuid, RepoPath, Side as HlrSide,
    };
    prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrFootprint {
        document_path: RepoPath("board.kicad_pcb".to_owned()),
        uuid: KiCadUuid(format!("uuid-{reference}")),
        reference: Some(reference.parse().expect("a designator")),
        side: HlrSide::Front,
        step_model: None,
        pose: None,
        outline: Some(outline),
        detail: Some(detail),
        status: None,
    }
}

/// The `<text>` element of one footprint's designator.
fn designator_text<'a>(svg: &'a str, uuid: &str) -> &'a str {
    let needle = format!("data-footprint-uuid=\"{uuid}\"");
    let at = svg
        .match_indices("<text ")
        .filter_map(|(start, _)| {
            let end = start + svg[start..].find("</text>")?;
            svg[start..end].contains(&needle).then_some(start)
        })
        .next()
        .unwrap_or_else(|| panic!("{uuid} has a designator"));
    let end = at + svg[at..].find("</text>").unwrap() + "</text>".len();
    &svg[at..end]
}

fn number_attribute(element: &str, name: &str) -> f64 {
    let key = format!("{name}=\"");
    let start = element.find(&key).expect("the attribute is present") + key.len();
    let end = start + element[start..].find('"').unwrap();
    element[start..end]
        .parse()
        .expect("the attribute is a number")
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
    bounds_for_with_covering(
        config,
        data,
        selected,
        sides,
        callout,
        labels,
        &BTreeMap::new(),
    )
}

fn bounds_for_with_covering(
    config: &ArtworkConfigA0,
    data: &BoardData,
    selected: &[usize],
    sides: ViewSides,
    callout: bool,
    labels: &BTreeMap<usize, CalloutPlacement>,
    covering_labels: &BTreeMap<usize, CoveringLabel>,
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
    canvas_bounds(
        &input,
        data,
        selected,
        sides,
        callout,
        labels,
        covering_labels,
    )
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
    let fit = session.fit("TP12", &small, 0.8, 2.5, &[0.0], 0.0).unwrap();
    let font = font_size_for(&small, "TP12", fit, 1.0, 0.0);
    assert!(font < 1.0 && font > 0.0, "{font}");
    assert!(text_box_fits_region(
        &small,
        "TP12",
        super::super::designator::DesignatorFit {
            font_size_mm: font,
            ..fit
        },
        0.0
    ));
    let large = square(20.0);
    let fit = session.fit("TP12", &large, 0.8, 2.5, &[0.0], 0.0).unwrap();
    assert_eq!(
        font_size_for(&large, "TP12", fit, 1.0, 0.0),
        fit.font_size_mm
    );
}

#[test]
fn a_minimum_label_clears_a_thick_outline_and_its_clearance() {
    use super::super::designator::{
        DesignatorFitSession, region_from_rings, text_box, text_box_fits_region,
    };
    // "R1" is 2 × 0.62 = 1.24 em wide, and a 1.0 mm font box is 1.0 mm high.
    let half_width = 0.62;
    let half_height = 0.5;
    let half_stroke = 0.25;
    let clearance = 0.15;
    let inset = half_stroke + clearance;
    // Just big enough for the minimum label once the stroke and clearance are
    // subtracted on each side, plus a hair for binary-search rounding.
    let width = 2.0 * (half_width + inset) + 0.02;
    let height = 2.0 * (half_height + inset) + 0.02;
    let body = region_from_rings(&[vec![
        Point { x: 0.0, y: 0.0 },
        Point { x: width, y: 0.0 },
        Point {
            x: width,
            y: height,
        },
        Point { x: 0.0, y: height },
    ]])
    .unwrap();
    let mut session = DesignatorFitSession::default();
    let fit = session.fit("R1", &body, 0.8, 2.5, &[0.0], inset).unwrap();
    let font = font_size_for(&body, "R1", fit, 1.0, inset);
    assert_eq!(font, 1.0, "the minimum label still fits the inset body");
    assert!(text_box_fits_region(
        &body,
        "R1",
        super::super::designator::DesignatorFit {
            font_size_mm: font,
            ..fit
        },
        inset
    ));
    for corner in text_box("R1", fit.center, font, fit.rotation_deg) {
        assert!(
            corner.x >= inset - 1.0e-9
                && corner.x <= width - inset + 1.0e-9
                && corner.y >= inset - 1.0e-9
                && corner.y <= height - inset + 1.0e-9,
            "corner {corner:?} touches the body outline"
        );
    }
}

#[test]
fn a_rotated_footprints_pads_are_not_turned_twice() {
    // L_Coilcraft_XAL6060 placed at -90 degrees: the board file stores each
    // pad's angle in the board frame (270), which already includes the
    // footprint's rotation. The pads must cover about 5.5 x 5.47 mm, not a
    // 1.43 x 9.54 mm strip.
    let mut inductor = footprint(0, "L6", FootSide::Top, false, (40.0, 60.0));
    inductor.angle = -90.0;
    inductor.pads = [-2.02, 2.02]
        .into_iter()
        .map(|x| PadInfo {
            number: "1".to_owned(),
            x,
            y: 0.0,
            size_x: 1.43,
            size_y: 5.5,
            rings: vec![rect_ring(1.43, 5.5, 270.0)],
        })
        .collect();
    let bounds = inductor.pads_bounds().expect("the inductor has pads");
    assert!(
        (bounds.width() - 5.5).abs() < 1e-6,
        "width {}",
        bounds.width()
    );
    assert!(
        (bounds.height() - 5.47).abs() < 1e-6,
        "height {}",
        bounds.height()
    );
}

// ---------------------------------------------------------------- covering

/// A big HS1 over U20/U21: only HS1 covers, and it is drawn as a dashed
/// outline after the parts beneath it, with its designator outside its body.
fn covering_board() -> BoardData {
    let mut heatsink = footprint(0, "HS1", FootSide::Top, false, (5.0, 3.0));
    heatsink.pad_bounds = Some(Bounds {
        min_x: 3.5,
        min_y: 2.5,
        max_x: 6.5,
        max_y: 3.5,
    });
    heatsink.hlr = Some(0);
    let left = footprint(1, "U20", FootSide::Top, false, (4.0, 3.0));
    let right = footprint(2, "U21", FootSide::Top, false, (6.0, 3.0));
    board_data_with_hlr(
        vec![heatsink, left, right],
        vec![hlr_body(
            "HS1",
            rectangle_edges(3.0, 2.0, 7.0, 4.0),
            line_edges(4.5, 2.5, 4.5, 3.5),
        )],
    )
}

fn group_containing<'a>(svg: &'a str, attribute: &str) -> &'a str {
    let at = svg
        .find(attribute)
        .unwrap_or_else(|| panic!("{attribute} is in the SVG"));
    let start = svg[..at].rfind("<g ").expect("the attribute is in a group");
    let end = start + svg[start..].find("</g>").unwrap() + "</g>".len();
    &svg[start..end]
}

fn assert_part_beneath(svg: &str, reference: &str, covering_at: usize) {
    let at = svg
        .find(&format!("data-component=\"{reference}\""))
        .unwrap_or_else(|| panic!("{reference} is drawn"));
    assert!(at < covering_at, "{reference} is drawn before HS1");
    let group = group_containing(svg, &format!("data-component=\"{reference}\""));
    assert!(group.contains("data-bounds-kind=\"envelope\""));
    let text = designator_text(svg, &format!("uuid-{reference}"));
    assert!(text.contains("data-bounds-kind=\"fallback\""));
    assert!(text.contains(&format!("data-component=\"{reference}\"")));
}

#[test]
fn a_body_that_covers_others_is_a_dashed_outline_on_top() {
    let config = config();
    let data = covering_board();
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    let svg = &rendered.svg;

    let covering = group_containing(svg, "data-bounds-kind=\"covering\"");
    assert!(covering.contains("data-component=\"HS1\""));
    assert!(covering.contains("stroke-dasharray=\"1.2 0.8\""));
    assert!(covering.contains("fill=\"none\""));
    assert_eq!(
        covering.matches("<path ").count(),
        1,
        "only the outline is drawn: {covering}"
    );
    assert!(covering.contains("M3 2 L7 2"));
    assert!(
        !covering.contains("M4.5 2.5"),
        "the covering body draws no detail edges: {covering}"
    );

    let heatsink_at = svg.find("data-bounds-kind=\"covering\"").unwrap();
    assert_part_beneath(svg, "U20", heatsink_at);
    assert_part_beneath(svg, "U21", heatsink_at);

    let text = designator_text(svg, "uuid-HS1");
    assert!(text.contains("data-bounds-kind=\"covering\""));
    let top = number_attribute(text, "data-text-box-max-y");
    assert!(
        top <= 2.0,
        "the designator sits above the body, not inside it: {text}"
    );
    assert_eq!(rendered.footprints_drawn, 3);
    assert_eq!(rendered.designators_placed, 3);
    // The moved label is inside the canvas the view reports.
    assert!(
        number_attribute(svg, "data-canvas-min-y") <= number_attribute(text, "data-text-box-min-y")
    );
}

#[test]
fn parts_that_merely_touch_do_not_cover_each_other() {
    let config = config();
    let mut left = footprint(0, "U1", FootSide::Top, false, (2.0, 2.0));
    left.hlr = Some(0);
    let mut right = footprint(1, "U2", FootSide::Top, false, (3.5, 2.0));
    right.hlr = Some(1);
    let data = board_data_with_hlr(
        vec![left, right],
        vec![
            hlr_body(
                "U1",
                rectangle_edges(1.0, 1.0, 3.0, 3.0),
                line_edges(1.5, 1.5, 1.5, 2.5),
            ),
            hlr_body(
                "U2",
                rectangle_edges(2.5, 1.0, 4.5, 3.0),
                line_edges(3.5, 1.5, 3.5, 2.5),
            ),
        ],
    );
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    assert!(!rendered.svg.contains("data-bounds-kind=\"covering\""));
    assert_eq!(
        rendered
            .svg
            .matches("data-bounds-kind=\"outline\" stroke=")
            .count(),
        2
    );
}

#[test]
fn a_part_without_an_outline_never_covers() {
    let config = config();
    let mut package = footprint(0, "U1", FootSide::Top, false, (5.0, 3.0));
    package.pad_bounds = Some(Bounds {
        min_x: 3.0,
        min_y: 2.0,
        max_x: 7.0,
        max_y: 4.0,
    });
    let data = board_data(vec![
        package,
        footprint(1, "U20", FootSide::Top, false, (4.0, 3.0)),
        footprint(2, "U21", FootSide::Top, false, (6.0, 3.0)),
    ]);
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    assert!(!rendered.svg.contains("data-bounds-kind=\"covering\""));
    assert!(rendered.svg.contains("data-component=\"U1\""));
}

#[test]
fn a_mirrored_bottom_view_keeps_the_designator_outside_its_body() {
    let config = config();
    let mut heatsink = footprint(0, "HS1", FootSide::Bottom, false, (5.0, 3.0));
    heatsink.hlr = Some(0);
    let data = board_data_with_hlr(
        vec![
            heatsink,
            footprint(1, "U20", FootSide::Bottom, false, (4.0, 3.0)),
            footprint(2, "U21", FootSide::Bottom, false, (6.0, 3.0)),
        ],
        vec![hlr_body(
            "HS1",
            rectangle_edges(3.0, 2.0, 7.0, 4.0),
            line_edges(4.5, 2.5, 4.5, 3.5),
        )],
    );
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_bottom_view");
    assert!(
        rendered
            .svg
            .contains("data-view-direction=\"bottom-mirrored\"")
    );
    assert!(rendered.svg.contains("data-bounds-kind=\"covering\""));
    let text = designator_text(&rendered.svg, "uuid-HS1");
    assert!(number_attribute(text, "data-text-box-max-y") <= 2.0);
    assert_eq!(number_attribute(text, "x"), -5.0);
}

#[test]
fn a_designator_that_would_leave_the_canvas_goes_below_the_body() {
    let mut config = config();
    config.global.canvas.margin_mm = 0.05;
    let mut heatsink = footprint(0, "HS1", FootSide::Top, false, (5.0, 1.0));
    heatsink.hlr = Some(0);
    let data = board_data_with_hlr(
        vec![
            heatsink,
            footprint(1, "U20", FootSide::Top, false, (4.5, 1.0)),
            footprint(2, "U21", FootSide::Top, false, (5.5, 1.0)),
        ],
        vec![hlr_body(
            "HS1",
            rectangle_edges(3.0, 0.0, 7.0, 2.0),
            line_edges(4.5, 0.5, 4.5, 1.5),
        )],
    );
    let hlr = empty_hlr();
    let placements = placements();
    let rendered = render(&config, &hlr, &placements, &data, "assembly_top_view");
    let text = designator_text(&rendered.svg, "uuid-HS1");
    assert!(
        number_attribute(text, "data-text-box-min-y") >= 2.0,
        "the label moved below the body: {text}"
    );
}

#[test]
fn covering_rendering_is_deterministic() {
    let config = config();
    let data = covering_board();
    let hlr = empty_hlr();
    let placements = placements();
    let first = render(&config, &hlr, &placements, &data, "assembly_top_view");
    let second = render(&config, &hlr, &placements, &data, "assembly_top_view");
    assert_eq!(first.svg, second.svg);
}

#[test]
fn a_chip_under_an_l_shaped_heatsink_does_not_cover_it() {
    // The heatsink's bounding-box centre (4, 4) falls inside the chip; a
    // centre test would make the chip "cover" the heatsink as well (JTYU-OBC:
    // U20 under HS1 was drawn dashed).
    let config = config();
    let mut heatsink = footprint(0, "HS1", FootSide::Top, false, (4.0, 2.0));
    heatsink.hlr = Some(0);
    let mut chip = footprint(1, "U20", FootSide::Top, false, (4.0, 4.0));
    chip.hlr = Some(1);
    let l_shape = HlrEdges {
        segments: vec![
            hlr_segment(0.0, 0.0, 8.0, 0.0),
            hlr_segment(8.0, 0.0, 8.0, 8.0),
            hlr_segment(8.0, 8.0, 4.0, 8.0),
            hlr_segment(4.0, 8.0, 4.0, 4.0),
            hlr_segment(4.0, 4.0, 0.0, 4.0),
            hlr_segment(0.0, 4.0, 0.0, 0.0),
        ],
        arcs: Vec::new(),
    };
    let data = board_data_with_hlr(
        vec![heatsink, chip],
        vec![
            hlr_body("HS1", l_shape, line_edges(1.0, 1.0, 2.0, 1.0)),
            hlr_body(
                "U20",
                rectangle_edges(3.0, 3.0, 5.0, 5.0),
                line_edges(3.5, 3.5, 4.5, 3.5),
            ),
        ],
    );
    let rendered = render(
        &config,
        &empty_hlr(),
        &placements(),
        &data,
        "assembly_top_view",
    );
    let covering: Vec<_> = rendered
        .svg
        .match_indices("data-bounds-kind=\"covering\" stroke")
        .collect();
    assert_eq!(covering.len(), 1, "only the heatsink covers");
    assert!(
        group_containing(&rendered.svg, "data-bounds-kind=\"covering\" stroke").contains("HS1")
    );
}

#[test]
fn a_covering_label_avoids_a_neighbours_body() {
    // JTYU-OBC: HS1's label, centred above its outline, printed over SW6.
    let config = config();
    let mut data = covering_board();
    let mut switch = footprint(3, "SW6", FootSide::Top, false, (5.0, 1.2));
    switch.pad_bounds = Some(Bounds {
        min_x: 4.0,
        min_y: 0.6,
        max_x: 6.0,
        max_y: 1.8,
    });
    data.footprints.push(switch);
    let rendered = render(
        &config,
        &empty_hlr(),
        &placements(),
        &data,
        "assembly_top_view",
    );
    let text = designator_text(&rendered.svg, "uuid-HS1");
    let label = Bounds {
        min_x: number_attribute(text, "data-text-box-min-x"),
        min_y: number_attribute(text, "data-text-box-min-y"),
        max_x: number_attribute(text, "data-text-box-max-x"),
        max_y: number_attribute(text, "data-text-box-max-y"),
    };
    let switch_body = Bounds {
        min_x: 4.0,
        min_y: 0.6,
        max_x: 6.0,
        max_y: 1.8,
    };
    assert!(
        !label.intersects(switch_body),
        "HS1's label overlaps SW6: {text}"
    );
    let heatsink = Bounds {
        min_x: 3.0,
        min_y: 2.0,
        max_x: 7.0,
        max_y: 4.0,
    };
    assert!(
        !label.intersects(heatsink),
        "HS1's label is inside its own body: {text}"
    );
}
