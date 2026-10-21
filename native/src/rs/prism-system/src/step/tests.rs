use super::*;
use crate::input::{
    Board, BodyConnector, Document, Members, Occurrence, PartFacts, PartRef, PoseIn, QuaternionIn,
    SemanticFacts, Source, SystemInterface, VectorNm,
};
use crate::placement::poses::Bounds;

const EMPTY: &str = "ISO-10303-21;HEADER;FILE_DESCRIPTION((''),'2;1');FILE_NAME('x','',(''),(''),'','','');FILE_SCHEMA(('AUTOMOTIVE_DESIGN'));ENDSEC;DATA;ENDSEC;END-ISO-10303-21;";

fn document() -> Document {
    Document {
        name: "System".to_owned(),
        occurrences: vec![Occurrence {
            id: "occ".to_owned(),
            label: "Board".to_owned(),
            source: Source {
                kind: "board".to_owned(),
                project_id: Some("prj_1".to_owned()),
                component_id: None,
                revision_id: None,
            },
            pose: None,
            positioning_mate: None,
        }],
        ..Document::default()
    }
}

fn board_members() -> Members {
    let mut members = Members::default();
    members.boards.insert(
        "occ".to_owned(),
        Board {
            revision_key: String::new(),
            bundle_key: String::new(),
            interface: SystemInterface {
                board_thickness_mm: Some(1.6),
                board_outline_mm: None,
                components: Vec::new(),
            },
            semantic: SemanticFacts::default(),
        },
    );
    members
}

fn board_model() -> BoardModel {
    BoardModel {
        step: Arc::new(prism_step::p21::parse(EMPTY).expect("the fixture parses")),
        path: PathBuf::from("board.step"),
        thickness_mm: 1.6,
    }
}

#[test]
fn the_board_model_is_lifted_by_half_its_thickness() {
    let models = ModelManifest {
        boards: BTreeMap::from([("occ".to_owned(), board_model())]),
        parts: BTreeMap::new(),
    };
    let (assembly, missing) = step_assembly(&document(), &board_members(), &models);
    assert!(missing.is_empty());
    assert_eq!(assembly.name, "System");
    assert_eq!(assembly.products.len(), 2, "the root and the occurrence");
    let (child, placement, name) = &assembly.products[0].children[0];
    assert_eq!((*child, name.as_str()), (1, "Board"));
    assert!((placement[3][2] + 0.8).abs() < 1e-12, "{placement:?}");
}

#[test]
fn a_model_the_manifest_lacks_is_listed() {
    let models = ModelManifest::default();
    let (assembly, missing) = step_assembly(&document(), &board_members(), &models);
    assert_eq!(missing, vec!["Board"]);
    assert_eq!(assembly.products.len(), 2);
    assert!(matches!(assembly.products[1].content, Content::Empty));
    assert_eq!(
        assembly.products[0].children[0].2, "Board",
        "the occurrence product is still named"
    );
}

fn body_identity() -> PoseIn {
    PoseIn {
        translation: VectorNm {
            x_nm: 0,
            y_nm: 0,
            z_nm: 0,
        },
        rotation: QuaternionIn {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            w: 1.0,
        },
    }
}

fn body_document() -> Document {
    Document {
        name: "Body system".to_owned(),
        occurrences: vec![Occurrence {
            id: "occ_body".to_owned(),
            label: "Enclosure".to_owned(),
            source: Source {
                kind: "body".to_owned(),
                project_id: None,
                component_id: Some("cmp_body".to_owned()),
                revision_id: None,
            },
            pose: None,
            positioning_mate: None,
        }],
        body_connectors: vec![BodyConnector {
            id: "bc1".to_owned(),
            occurrence: "occ_body".to_owned(),
            refdes: "J9".to_owned(),
            part: PartRef {
                component_id: "cmp_conn".to_owned(),
                revision_id: None,
            },
            frame: body_identity(),
            quarter_turns: 0,
        }],
        ..Document::default()
    }
}

fn body_members() -> Members {
    let mut members = Members::default();
    members.parts.insert(
        "cmp_body".to_owned(),
        PartFacts {
            component_id: "cmp_body".to_owned(),
            revision_id: "r1".to_owned(),
            name: "Enclosure".to_owned(),
            model_bounds: Some(Bounds {
                min_mm: [0.0, 0.0, 0.0],
                max_mm: [10.0, 20.0, 30.0],
            }),
            ..PartFacts::default()
        },
    );
    members.parts.insert(
        "cmp_conn".to_owned(),
        PartFacts {
            component_id: "cmp_conn".to_owned(),
            revision_id: "r1".to_owned(),
            name: "Header".to_owned(),
            ..PartFacts::default()
        },
    );
    members
}

fn body_models() -> ModelManifest {
    let mut alignment = IDENTITY;
    alignment[3] = [1.0, 2.0, 3.0, 1.0];
    ModelManifest {
        boards: BTreeMap::new(),
        parts: BTreeMap::from([
            (
                "cmp_body".to_owned(),
                PartModel {
                    step: Arc::new(prism_step::p21::parse(EMPTY).expect("the fixture parses")),
                    path: PathBuf::from("body.step"),
                    alignment: IDENTITY,
                },
            ),
            (
                "cmp_conn".to_owned(),
                PartModel {
                    step: Arc::new(prism_step::p21::parse(EMPTY).expect("the fixture parses")),
                    path: PathBuf::from("connector.step"),
                    alignment,
                },
            ),
        ]),
    }
}

#[test]
fn a_body_holds_its_model_and_its_connectors_at_their_mounts() {
    let (assembly, missing) = step_assembly(&body_document(), &body_members(), &body_models());
    assert!(missing.is_empty(), "{missing:?}");
    assert_eq!(
        assembly.products.len(),
        4,
        "the root, the body, its model and its connector"
    );
    let body = assembly
        .products
        .iter()
        .find(|product| product.name == "Enclosure")
        .expect("the body product");
    assert_eq!(body.children.len(), 2);
    let connector = assembly
        .products
        .iter()
        .find(|product| product.name == "Enclosure J9")
        .expect("the connector product");
    assert!(matches!(connector.content, Content::Foreign(_)));
    let (_, placement, _) = &body.children[1];
    assert_eq!(placement[3], [1.0, 2.0, 3.0, 1.0], "{placement:?}");
}

#[test]
fn placements_compose_right_to_left() {
    let moved = translation([10.0, 0.0, 0.0]);
    // A quarter turn about z, column-major.
    let turned = matrix_from_flat([
        0.0, 1.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
    ]);
    let combined = multiply(&moved, &turned);
    // The rotation is applied first, then the translation.
    assert_eq!(combined[3], [10.0, 0.0, 0.0, 1.0]);
    assert!((combined[0][1] - 1.0).abs() < 1e-12);
}

fn part_model() -> PartModel {
    PartModel {
        step: Arc::new(prism_step::p21::parse(EMPTY).expect("the fixture parses")),
        path: PathBuf::from("part.step"),
        alignment: IDENTITY,
    }
}

#[test]
fn an_entry_is_built_from_its_placed_contents() {
    let payload = serde_json::json!({
        "source": { "systemBundleKey": "k" },
        "document": {
            "occurrences": [
                { "id": "c_board", "label": "Logic", "source": { "kind": "board", "projectId": "prj_9" } },
                { "id": "c_body", "label": "Case", "source": { "kind": "body", "componentId": "cmp_case", "revisionId": "rev_1" } }
            ],
            "bodyConnectors": [
                { "occurrence": "c_body", "refdes": "J1", "part": { "componentId": "cmp_jack" } }
            ]
        },
        "bundle": { "placement": {
            "occurrences": [
                { "occurrence": "c_board", "pose": { "translation": { "xNm": 0, "yNm": 0, "zNm": 5_000_000 }, "rotation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
                  "bounds": { "min": { "xNm": 0, "yNm": 0, "zNm": -800_000 }, "max": { "xNm": 10, "yNm": 10, "zNm": 800_000 } } },
                { "occurrence": "c_body", "pose": { "translation": { "xNm": 0, "yNm": 0, "zNm": 0 }, "rotation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
                  "bounds": { "min": { "xNm": 0, "yNm": 0, "zNm": 0 }, "max": { "xNm": 1, "yNm": 1, "zNm": 1 } } }
            ],
            "exports": [
                { "export": "exp_1", "mount": { "translation": { "xNm": 2_000_000, "yNm": 0, "zNm": 0 }, "rotation": { "x": 0.0, "y": 0.0, "z": 0.0, "w": 1.0 } },
                  "geometry": null, "matesTop": true }
            ]
        } },
        "interface": { "exports": [
            { "id": "exp_1", "name": "PWR_IN", "occurrence": "c_body", "connector": "J1", "pins": [] }
        ] }
    });
    let (_board, facts) = crate::entry::board(&payload, "released");
    assert_eq!(facts.contents.len(), 2);
    assert!((facts.contents[0].thickness_mm - 1.6).abs() < 1e-9);
    assert_eq!(facts.contents[1].part.as_deref(), Some("cmp_case@rev_1"));

    let document = Document {
        name: "System".to_owned(),
        occurrences: vec![Occurrence {
            id: "occ_e".to_owned(),
            label: "Unit".to_owned(),
            source: Source {
                kind: "entry".to_owned(),
                project_id: None,
                component_id: Some("cmp_unit".to_owned()),
                revision_id: None,
            },
            pose: None,
            positioning_mate: None,
        }],
        ..Document::default()
    };
    let mut members = Members::default();
    members.entries.insert("occ_e".to_owned(), facts);
    let models = ModelManifest {
        boards: BTreeMap::from([("occ_e/c_board".to_owned(), board_model())]),
        parts: BTreeMap::from([("cmp_case@rev_1".to_owned(), part_model())]),
    };
    let (assembly, missing) = step_assembly(&document, &members, &models);
    let names: Vec<&str> = assembly
        .products
        .iter()
        .map(|product| product.name.as_str())
        .collect();
    assert!(names.contains(&"Unit · Logic"), "{names:?}");
    assert!(names.contains(&"Unit · Case"), "{names:?}");
    // The exported connector's part is not in the manifest: listed, not dropped silently.
    assert_eq!(missing, vec!["Unit · PWR_IN"]);
}
