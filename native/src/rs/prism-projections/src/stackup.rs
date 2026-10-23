//! `projections/stackup.json` (`prism.stackup.a0`). WP-P3's producer: a
//! faithful Rust port of the golden producer
//! `native/parity/prism_parity/capture/stackup_build.py`, which applies the
//! producer rules of `contracts/prism/field-maps/stackup.md` (1–8) to the
//! board's S-expression tree. The contract's root is
//! [`StackupA0`](prism_kicad_contracts::generated::prism_stackup_a0::StackupA0).
//!
//! The producer reads the board's own tokens (never the core's typed
//! `PcbView`), because the golden did: the layer table, the stackup, the vias
//! and the `(general (thickness …))` form are all read straight from the
//! tokens. [`spans`] takes just those four top-level forms from the shared
//! board view's indexed source spans and parses them into a small
//! `(kicad_pcb …)` root, so this member never builds the whole board tree
//! ([`crate::BoardModel::tree`]) that the other tree readers pay ~340 MiB
//! for; the tokens are identical because both go through
//! `prism_kicad_core::parse`. The tree helpers of [`tree`] mirror
//! `stackup_build.py`'s, so a bare token and a quoted one give the same string
//! kicad_monkey's tokenizer produced.
//!
//! A project without a board gets the empty form (`stackup_build.py:empty_form`)
//! (bundle-format.md §2.1); the contract has no explicit empty form.
//!
//! The implementation is grouped by concern: [`tree`] holds the token and
//! diagnostic helpers, [`records`] the records and the empty form, [`read`]
//! the reader of one `.kicad_pcb`, [`spans`] the board forms that reader
//! takes from the view, [`summary`] the derived aggregates and [`via`] the via
//! spans.
//!
//! # Warnings
//!
//! `stackup-unknown-token` (a `type`, layer-type or `edge_connector` token
//! outside the KiCad set; `stackup_build.py:113,197,217`) and
//! `stackup-copper-mismatch` (a stackup whose copper differs from the layer
//! table's; `stackup_build.py:226`) go to `stages.parse.warnings`. Every
//! message names the board by its repository path (`lib.rs`).

mod read;
mod records;
mod spans;
mod summary;
mod tree;
mod via;

use crate::{Produced, ProjectionError, ProjectionInput, document};
use prism_kicad_contracts::generated::prism_stackup_a0::StackupA0;

/// The member's schema id.
pub const SCHEMA: &str = "prism.stackup.a0";
const NAME: &str = "projections/stackup.json";

/// KiCad's 1.6 mm default board thickness (`stackup_build.py:32`, fork
/// `extended.rs:10,159-160`).
const DEFAULT_THICKNESS_NM: i64 = 1_600_000;

/// `STACKUP_TYPES` (`stackup_build.py:25-28`): the KiCad stackup `type` set.
const STACKUP_TYPES: [&str; 9] = [
    "Top Silk Screen",
    "Top Solder Paste",
    "Top Solder Mask",
    "copper",
    "core",
    "prepreg",
    "Bottom Solder Mask",
    "Bottom Solder Paste",
    "Bottom Silk Screen",
];

/// `BOARD_LAYER_TYPES` (`stackup_build.py:29`): the KiCad layer-table types.
const BOARD_LAYER_TYPES: [&str; 8] = [
    "signal",
    "power",
    "mixed",
    "jumper",
    "auxiliary",
    "front",
    "back",
    "user",
];

/// `VIA_TYPES` (`stackup_build.py:30`): header-token priority, first match wins.
const VIA_TYPES: [&str; 3] = ["blind", "buried", "micro"];

/// `EDGE_CONNECTORS` (`stackup_build.py:31`).
const EDGE_CONNECTORS: [&str; 2] = ["yes", "bevelled"];

/// Build `projections/stackup.json` from the single parse of the revision.
pub fn produce(input: &ProjectionInput<'_>) -> Result<Produced<StackupA0>, ProjectionError> {
    let (value, warnings) = match input.board {
        Some(board) => read::build(&spans::root(board, &spans::BUILD_HEADS)?, board.path)?,
        None => (records::empty_form(), Vec::new()),
    };
    let mut produced = document(NAME, value)?;
    produced.warnings = warnings;
    Ok(produced)
}

/// R6's copper order for `route_metrics`: the stackup member's `copperLayers`
/// (`stackup_build.py:222-228`, rule 7) from the board's layer and stackup
/// forms, without building the whole member (or the whole board tree). The
/// rule lives once, in [`read::copper_order`].
pub(crate) fn copper_layers(board: &crate::BoardModel<'_>) -> Result<Vec<String>, ProjectionError> {
    read::copper_order(&spans::root(board, &spans::COPPER_HEADS)?, board.path)
}

#[cfg(test)]
mod tests {
    use super::read::build;
    use super::records::empty_form;
    use super::tree::nm;
    use super::*;
    use crate::ProducerWarning;
    use serde_json::{Value, json};

    /// Build a document from a board body wrapped in `(kicad_pcb …)`.
    fn build_board(body: &str) -> (Value, Vec<ProducerWarning>) {
        let text = format!("(kicad_pcb {body})");
        let root = prism_kicad_core::parse(&text).expect("the board parses");
        let (value, warnings) = build(&root, "boards/demo.kicad_pcb").expect("the board builds");
        serde_json::from_value::<StackupA0>(value.clone()).expect("the document decodes");
        (value, warnings)
    }

    fn warning_codes(warnings: &[ProducerWarning]) -> Vec<&str> {
        warnings
            .iter()
            .map(|warning| warning.code.as_str())
            .collect()
    }

    #[test]
    fn nm_rounds_half_away_from_zero() {
        assert_eq!(nm(1.6), 1_600_000);
        assert_eq!(nm(0.0152), 15_200);
        assert_eq!(nm(1.5584), 1_558_400);
        assert_eq!(nm(0.0), 0);
        // Exact half-way products round away from zero, as Python's
        // ROUND_HALF_UP on the exact binary64 product does.
        assert_eq!(1.5e-06 * 1e6, 1.5);
        assert_eq!(nm(1.5e-06), 2);
        assert_eq!(0.9999995 * 1e6, 999_999.5);
        assert_eq!(nm(0.9999995), 1_000_000);
        assert_eq!(nm(-2.5), -2_500_000);
    }

    #[test]
    fn a_project_without_a_board_gets_the_empty_form() {
        let value = empty_form();
        assert_eq!(value["present"], false);
        assert_eq!(value["boardThicknessNm"], DEFAULT_THICKNESS_NM);
        assert_eq!(value["layers"], json!([]));
        assert_eq!(value["copperLayers"], json!([]));
        assert_eq!(value["maskColors"], json!({}));
        assert_eq!(value["viaSpans"], json!([]));
        assert_eq!(value["boardLayers"], json!([]));
        assert!(value.get("stackThicknessNm").is_none());
        assert!(value.get("settings").is_none());
        serde_json::from_value::<StackupA0>(value).expect("the empty form decodes");
    }

    #[test]
    fn addsublayer_splits_one_dielectric_into_entries() {
        let (value, warnings) = build_board(
            r#"
            (general (thickness 1.0))
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1"
                    (type "prepreg")
                    (thickness 0.3)
                    (material "FR4")
                    (epsilon_r 4.6)
                    (loss_tangent 0.02)
                    addsublayer
                    (thickness 0.25)
                    (material "FR4-HiTg")
                    (epsilon_r 4.4)
                    (loss_tangent 0.015)
                    (color "FR4 natural")
                )
                (layer "B.Cu" (type "copper") (thickness 0.035))
                (copper_finish "None")
                (dielectric_constraints no)
            ))
            "#,
        );
        assert_eq!(warning_codes(&warnings), Vec::<&str>::new());
        assert_eq!(
            value["layers"],
            json!([
                {"name": "F.Cu", "sublayer": 0, "kind": "copper",
                 "type": "copper", "thicknessNm": 35_000},
                {"name": "dielectric 1", "sublayer": 0, "kind": "dielectric",
                 "type": "prepreg", "thicknessNm": 300_000,
                 "material": "FR4", "epsilonR": 4.6, "lossTangent": 0.02},
                {"name": "dielectric 1", "sublayer": 1, "kind": "dielectric",
                 "type": "prepreg", "thicknessNm": 250_000,
                 "material": "FR4-HiTg", "epsilonR": 4.4, "lossTangent": 0.015,
                 "color": "FR4 natural"},
                {"name": "B.Cu", "sublayer": 0, "kind": "copper",
                 "type": "copper", "thicknessNm": 35_000},
            ])
        );
        assert_eq!(value["stackThicknessNm"], 620_000);
    }

    #[test]
    fn an_unknown_type_token_is_omitted_with_a_warning() {
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (1 "F.Mask" obsolete))
            (setup (stackup
                (layer "F.Cu" (type "unobtainium") (thickness 0.035))
                (edge_connector zigzag)
            ))
            "#,
        );
        // The stackup layer type is dropped, so `type` is absent on the entry.
        assert!(value["layers"][0].get("type").is_none());
        // The layer-table type is dropped too.
        assert!(value["boardLayers"][1].get("type").is_none());
        assert_eq!(
            warning_codes(&warnings),
            vec![
                "stackup-unknown-token",
                "stackup-unknown-token",
                "stackup-unknown-token",
            ]
        );
        assert!(warnings[0].message.contains("obsolete"));
        assert!(warnings[1].message.contains("unobtainium"));
        assert!(warnings[2].message.contains("zigzag"));
        // `edge_connector` outside the set becomes `none`.
        assert_eq!(value["settings"]["edgeConnector"], "none");
    }

    #[test]
    fn a_stackup_copper_mismatch_warns_but_drives_copper_layers() {
        // A matching stackup: no warning.
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1" (type "core") (thickness 0.5))
                (layer "B.Cu" (type "copper") (thickness 0.035))
            ))
            "#,
        );
        assert!(warnings.is_empty());
        assert_eq!(value["copperLayers"], json!(["F.Cu", "B.Cu"]));

        // A stackup missing a table copper layer: the stackup still drives
        // `copperLayers`, and the mismatch is warned.
        let (value, warnings) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (setup (stackup
                (layer "F.Cu" (type "copper") (thickness 0.035))
                (layer "dielectric 1" (type "core") (thickness 0.5))
            ))
            "#,
        );
        assert_eq!(warning_codes(&warnings), vec!["stackup-copper-mismatch"]);
        assert!(
            warnings[0].message.contains(
                "stackup copper ['F.Cu'] differs from the layer table's ['F.Cu', 'B.Cu']"
            )
        );
        assert_eq!(value["copperLayers"], json!(["F.Cu"]));
    }

    #[test]
    fn the_shared_copper_order_matches_the_document() {
        let text = "(kicad_pcb (layers (0 \"F.Cu\" signal) (2 \"B.Cu\" signal)) \
            (setup (stackup (layer \"F.Cu\" (type \"copper\")) \
            (layer \"dielectric 1\" (type \"core\")) \
            (layer \"B.Cu\" (type \"copper\")))))";
        let view = prism_kicad_core::PcbView::parse(text, prism_kicad_core::PcbLimits::default())
            .expect("the board parses");
        let board = crate::BoardModel::new("boards/demo.kicad_pcb", text, &view);
        assert_eq!(
            copper_layers(&board).expect("the copper order"),
            vec!["F.Cu".to_owned(), "B.Cu".to_owned()]
        );
    }

    #[test]
    fn the_reduced_root_holds_only_the_forms_the_reader_takes() {
        // The reader takes `general`, `layers`, `setup` and top-level vias; a
        // net, a segment and a footprint's own via are not read, so the
        // `(kicad_pcb …)` root `spans::root` parses holds none of them.
        let text = r#"
            (kicad_pcb
                (general (thickness 1.2))
                (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
                (net 0 "")
                (setup (stackup (layer "F.Cu" (type "copper"))
                                (layer "dielectric 1" (type "core"))
                                (layer "B.Cu" (type "copper"))))
                (segment (start 0 0) (end 1 0) (width 0.2) (layer "F.Cu") (net 0))
                (via (at 0 0) (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
                (footprint "X"
                    (via (at 0 0) (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu")))
            )"#;
        let view = prism_kicad_core::PcbView::parse(text, prism_kicad_core::PcbLimits::default())
            .expect("the board parses");
        let board = crate::BoardModel::new("boards/demo.kicad_pcb", text, &view);
        let root = super::spans::root(&board, &super::spans::BUILD_HEADS)
            .expect("the reduced root parses");
        let heads: Vec<&str> = super::tree::form_children(&root)
            .iter()
            .skip(1)
            .filter_map(|item| match item {
                prism_kicad_core::Sexp::List(items) => items.first().and_then(|head| match head {
                    prism_kicad_core::Sexp::Atom(head) => Some(&**head),
                    _ => None,
                }),
                _ => None,
            })
            .collect();
        assert_eq!(heads, ["general", "layers", "setup", "via"]);
        // The one top-level via, its footprint's copy excluded.
        let (value, _) = build(&root, "boards/demo.kicad_pcb").expect("the board builds");
        assert_eq!(value["copperLayers"], json!(["F.Cu", "B.Cu"]));
        assert_eq!(value["viaSpans"][0]["count"], 1);
        assert_eq!(value["boardThicknessNm"], 1_200_000);
    }

    #[test]
    fn each_via_type_is_recognised() {
        let (value, _) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (via blind (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via buried (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via micro (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            (via (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu"))
            "#,
        );
        let spans = value["viaSpans"].as_array().expect("viaSpans");
        let types: Vec<&str> = spans
            .iter()
            .map(|span| span["viaType"].as_str().expect("viaType"))
            .collect();
        assert_eq!(types, vec!["blind", "buried", "micro", "through"]);
    }

    #[test]
    fn each_edge_connector_value_is_recognised() {
        for token in ["yes", "bevelled"] {
            let (value, warnings) = build_board(&format!(
                "(layers (0 \"F.Cu\" signal))\n(setup (stackup \
                 (layer \"F.Cu\" (type \"copper\")) (edge_connector {token})))"
            ));
            assert!(warnings.is_empty());
            assert_eq!(value["settings"]["edgeConnector"], token);
        }
        let (value, warnings) = build_board(
            "(layers (0 \"F.Cu\" signal))\n(setup (stackup (layer \"F.Cu\" (type \"copper\"))))",
        );
        assert!(warnings.is_empty());
        assert_eq!(value["settings"]["edgeConnector"], "none");
    }

    #[test]
    fn a_drill_needs_a_size_or_a_two_name_layers_form() {
        let (value, _) = build_board(
            r#"
            (layers (0 "F.Cu" signal) (2 "B.Cu" signal))
            (via (size 0.4) (drill 0.2) (layers "F.Cu" "B.Cu")
                (backdrill (size 0.6) (layers "F.Cu" "In1.Cu"))
                (tertiary_drill (layers "F.Cu" "B.Cu")))
            "#,
        );
        let span = &value["viaSpans"][0];
        assert_eq!(span["backdrill"]["sizeNm"], 600_000);
        assert_eq!(span["backdrill"]["startLayer"], "F.Cu");
        assert_eq!(span["backdrill"]["stopLayer"], "In1.Cu");
        assert_eq!(span["tertiaryDrill"]["startLayer"], "F.Cu");
        assert!(span["tertiaryDrill"].get("sizeNm").is_none());
    }
}
