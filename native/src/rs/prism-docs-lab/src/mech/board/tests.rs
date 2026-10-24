use super::*;

fn bounds(min_x: f64, min_y: f64, max_x: f64, max_y: f64) -> Bounds {
    Bounds {
        min_x,
        min_y,
        max_x,
        max_y,
    }
}

#[test]
fn an_overhang_reports_the_edge_and_distance() {
    let board = bounds(0.0, 0.0, 40.0, 30.0);
    let part = bounds(38.0, 10.0, 44.5, 20.0);
    let overhang = overhang(part, board).expect("an overhang");
    assert_eq!(overhang.edge, Edge::Right);
    assert!((overhang.distance - 4.5).abs() < 1e-9);
    assert!((overhang.along - 15.0).abs() < 1e-9);
    assert!((overhang.extreme - 44.5).abs() < 1e-9);
}

#[test]
fn a_part_inside_the_board_does_not_overhang() {
    let board = bounds(0.0, 0.0, 40.0, 30.0);
    assert!(overhang(bounds(1.0, 1.0, 39.0, 29.0), board).is_none());
}

#[test]
fn the_largest_of_several_overhangs_wins() {
    let board = bounds(0.0, 0.0, 40.0, 30.0);
    let overhang = overhang(bounds(-3.0, -1.0, 40.0, 30.0), board).expect("an overhang");
    assert_eq!(overhang.edge, Edge::Left);
    assert!((overhang.distance - 3.0).abs() < 1e-9);
}

#[test]
fn mounting_holes_follow_the_reference_and_library_rules() {
    assert!(is_mounting_reference("H1", ""));
    assert!(is_mounting_reference("MH12", ""));
    assert!(is_mounting_reference(
        "?",
        "MountingHole:MountingHole_2.2mm"
    ));
    assert!(!is_mounting_reference("H", ""));
    assert!(!is_mounting_reference("H4A", ""));
    assert!(!is_mounting_reference("R15", ""));
}

fn test_hole(footprint: Option<usize>, width: f64, plated: bool) -> HoleRow {
    HoleRow {
        id: "H01".to_owned(),
        at: Point { x: 0.0, y: 0.0 },
        width,
        height: width,
        angle: 0.0,
        plated,
        slot: false,
        via: false,
        mounting: false,
        footprint,
        used_by: "?".to_owned(),
        net: String::new(),
    }
}

fn test_part(reference: &str, mechanical: bool) -> Part {
    Part {
        index: 0,
        reference: reference.to_owned(),
        library: String::new(),
        side: Side::Top,
        mechanical,
        at: Point { x: 0.0, y: 0.0 },
        angle: 0.0,
        body: Body::Envelope(Vec::new()),
        body_bounds: Bounds::empty(),
        courtyard: None,
        pad_bounds: None,
        overhang: None,
        model: None,
        fallback_height: None,
        height: None,
        height_source: HeightSource::Unknown,
        height_note: String::new(),
        front_lines: Vec::new(),
        side_lines: Vec::new(),
    }
}

#[test]
fn the_largest_hole_of_a_mounting_footprint_is_the_mounting_hole() {
    let mut rows = vec![
        test_hole(Some(0), 0.3, true),
        test_hole(Some(0), 2.2, false),
    ];
    let parts = vec![test_part("H1", true)];
    mark_mounting(&mut rows, &parts);
    assert!(!rows[0].mounting);
    assert!(rows[1].mounting);
}

#[test]
fn an_npth_hole_of_a_netted_footprint_is_a_locating_peg() {
    let mut rows = vec![test_hole(Some(0), 2.37, false), test_hole(None, 2.0, false)];
    let parts = vec![test_part("J10", false)];
    mark_mounting(&mut rows, &parts);
    assert!(!rows[0].mounting);
    assert!(rows[1].mounting, "a board-level NPTH is a mounting hole");
}

#[test]
fn an_authored_z_offset_is_a_stand_in_height() {
    assert_eq!(offset_height(0.0), None);
    let height = offset_height(-1.25).expect("a height");
    assert_eq!(height.below, 1.25);
    assert_eq!(height.above, 0.0);
}
