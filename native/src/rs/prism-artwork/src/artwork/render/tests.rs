//! Unit tests for selection, the canvas and designator fitting.

use std::collections::BTreeMap;

use super::designators::{designator_style, selected_by_designators, selector_matches};
use super::*;
use prism_kicad_contracts::generated::prism_artwork_config_a0::ArtworkConfigA0;

fn config() -> ArtworkConfigA0 {
    serde_json::from_str(include_str!("../../../configs/assembly.json")).unwrap()
}

#[test]
fn the_assembly_config_selects_every_designator() {
    let config = config();
    let style = designator_style(&config, &config.views[0].styles, None);
    assert!(selected_by_designators(Some("R1"), &style));
}

#[test]
fn the_testpoint_config_selects_only_testpoints() {
    let config: ArtworkConfigA0 =
        serde_json::from_str(include_str!("../../../configs/testpoints.json")).unwrap();
    let style = designator_style(&config, &config.views[0].styles, None);
    assert!(selected_by_designators(Some("TP1"), &style));
    assert!(!selected_by_designators(Some("R1"), &style));
    assert!(!selected_by_designators(None, &style));
}

#[test]
fn the_canvas_is_the_board_outline_plus_the_configured_margin() {
    let config = config();
    let data = BoardData {
        geometry: BoardGeometry {
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
        },
        footprints: Vec::new(),
        hlr: Vec::new(),
    };
    let views = vec!["assembly_top_view".to_owned()];
    let input = ArtworkInput {
            board: "",
            document_path: "board.kicad_pcb",
            config: &config,
            hlr: &prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrA0 {
                schema: "prism.assembly_hlr.a0".to_owned(),
                options:
                    prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrOptions {
                        projection_algorithm: None,
                        outline_algorithm:
                            prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrOutlineAlgorithm::HlrClose,
                        curve_mode:
                            prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrCurveMode::NativeArcs,
                        samples_per_curve:
                            prism_kicad_contracts::generated::prism_assembly_hlr_a0::Count(24),
                        round_digits:
                            prism_kicad_contracts::generated::prism_assembly_hlr_a0::Count(3),
                        include_visible: true,
                        include_outline: true,
                        union_polygons: true,
                        mesh_linear_deflection: None,
                        mesh_angular_deflection: None,
                        mesh_relative: None,
                        hlr_angle_tolerance: None,
                        edge_flags: None,
                    },
                runtime:
                    prism_kicad_contracts::generated::prism_assembly_hlr_a0::AssemblyHlrRuntime {
                        geometer_version: "2026.9.19".to_owned(),
                    },
                footprints: Vec::new(),
            },
            placements: &prism_kicad_contracts::generated::prism_placements_a1::PlacementsA1 {
                schema: "prism.placements.a1".to_owned(),
                footprints: Vec::new(),
                designators: Vec::new(),
                outline_bounds: None,
                aux_axis_origin: None,
            },
            occurrences: None,
            variant: None,
            views: &views,
        };
    let bounds = canvas_bounds(&input, &data, &[]);
    assert_eq!(bounds.min_x, -1.0);
    assert_eq!(bounds.min_y, -1.0);
    assert_eq!(bounds.max_x, 11.0);
    assert_eq!(bounds.max_y, 6.0);
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
