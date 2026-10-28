//! Merged board nets put back as their schematic nets; other nets unchanged.

use super::split;
use crate::semantic_index::stable_uid;
use prism_kicad_contracts::generated::prism_semantic_index_a2::SemanticIndexA2;
use serde_json::{Value, json};

fn reference(pins: &[&str]) -> Value {
    json!({
        "sheetInstancePath": "/root", "sheetPath": "/", "page": "root.kicad_sch",
        "wireUuids": [], "labelUuids": [], "junctionUuids": [], "pinUuids": pins,
        "labelInstanceCount": 1
    })
}

fn net(name: &str, aliases: Value, refs: Value) -> Value {
    json!({
        "netUid": stable_uid("net", &[name]), "name": name, "netClass": "Default", "aliases": aliases,
        "schematicRefs": refs,
        "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
        "webgpuRefs": []
    })
}

fn terminal(reference: &str, schematic_name: &str, board_name: &str, pin: &str) -> Value {
    json!({
        "terminalUid": format!("term:{reference}"), "componentUid": format!("cmp:{reference}"),
        "reference": reference, "pin": "1", "netUid": stable_uid("net", &[board_name]),
        "netName": board_name, "schematicNetName": schematic_name, "schematicPinUuid": pin
    })
}

fn index(nets: Value, terminals: Value) -> SemanticIndexA2 {
    serde_json::from_value(json!({
        "schema": "prism.semantic_index.a2", "designKey": "0".repeat(64),
        "components": [], "nets": nets, "terminals": terminals, "sheetInstances": [], "buses": [],
        "indexes": {
            "componentByReference": {}, "componentBySchematicUuid": {},
            "componentByPcbFootprintUuid": {}, "terminalBySchematicPinUuid": {},
            "terminalByPcbPadUuid": {}, "terminalByReferencePin": {},
            "netByName": {}, "netByNetCode": {}, "netBySchematicUuid": {},
            "netByPcbUuid": {}, "sheetInstanceByPath": {}, "busByUid": {}
        },
        "assembly": {
            "schema": "prism.assembly_state_a0", "catalog": [], "footprintInventory": [],
            "default": {"occurrences": {}, "components": {}, "footprints": {}},
            "variants": [], "diagnostics": []
        }
    }))
    .expect("a valid semantic index")
}

/// `(name, uid, aliases, the first pin of each ref)` per net.
fn shape(index: &SemanticIndexA2) -> Vec<(String, String, Vec<String>, Vec<String>)> {
    index
        .nets
        .iter()
        .map(|net| {
            (
                net.name.as_str().to_owned(),
                net.net_uid.as_str().to_owned(),
                net.aliases
                    .iter()
                    .flatten()
                    .map(|a| a.as_str().to_owned())
                    .collect(),
                net.schematic_refs
                    .iter()
                    .map(|r| {
                        r.pin_uuids
                            .first()
                            .map_or("-".to_owned(), |p| p.as_str().to_owned())
                    })
                    .collect(),
            )
        })
        .collect()
}

#[test]
fn a_merged_board_net_is_put_back_as_its_schematic_nets() {
    // "BOARD" absorbed S1 (alias x1) and then S2; the pinless ref came with S1.
    let mut semantic = index(
        json!([
            net("S0", json!([]), json!([reference(&["p0"])])),
            net(
                "BOARD",
                json!(["S1", "x1", "S2"]),
                json!([reference(&["p1"]), reference(&[]), reference(&["p2"])])
            ),
        ]),
        json!([
            terminal("R0", "S0", "S0", "p0"),
            terminal("R1", "S1", "BOARD", "p1"),
            terminal("R2", "S2", "BOARD", "p2")
        ]),
    );
    split(&mut semantic);
    let uid = |name: &str| stable_uid("net", &[name]);
    assert_eq!(
        shape(&semantic),
        [
            ("S0".to_owned(), uid("S0"), vec![], vec!["p0".to_owned()]),
            (
                "S1".to_owned(),
                uid("S1"),
                vec!["x1".to_owned()],
                vec!["p1".to_owned(), "-".to_owned()]
            ),
            ("S2".to_owned(), uid("S2"), vec![], vec!["p2".to_owned()]),
        ]
    );
}

#[test]
fn an_index_without_merged_nets_is_unchanged() {
    let mut semantic = index(
        json!([net("S0", json!(["alt"]), json!([reference(&["p0"])]))]),
        json!([terminal("R0", "S0", "S0", "p0")]),
    );
    let before = shape(&semantic);
    split(&mut semantic);
    assert_eq!(shape(&semantic), before);
}
