//! The paths `compare` reads, made project-relative; a root project is unchanged.

use super::members;
use prism_kicad_contracts::generated::prism_occurrences_a0::OccurrencesA0;
use prism_kicad_contracts::generated::prism_semantic_index_a2::{
    SemanticIndexA2, SemanticIndexBus,
};
use serde_json::json;

fn index(page: &str, parent: &str) -> SemanticIndexA2 {
    serde_json::from_value(json!({
        "schema": "prism.semantic_index.a2",
        "designKey": "0".repeat(64),
        "components": [{
            "componentUid": "cmp:R1", "reference": "R1", "value": "10k", "footprint": "", "libraryRef": "Device:R",
            "fields": {},
            "schematicRefs": [{"sheetInstancePath": "/", "page": page, "symbolUuid": "00000000-0000-0000-0000-000000000001"}],
            "pcbRefs": [], "webgpuRefs": []
        }],
        "nets": [{
            "netUid": "net:vcc", "name": "VCC", "netClass": "Default", "aliases": [],
            "schematicRefs": [
                {"sheetInstancePath": "/root", "sheetPath": "/", "page": page, "wireUuids": [], "labelUuids": [],
                 "junctionUuids": [], "pinUuids": [], "labelInstanceCount": 0},
                {"sheetInstancePath": "/root", "sheetPath": "/", "wireUuids": [], "labelUuids": [],
                 "junctionUuids": [], "pinUuids": [], "labelInstanceCount": 0}
            ],
            "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
            "webgpuRefs": []
        }],
        "terminals": [],
        "sheetInstances": [{
            "sheetInstanceUid": "sheet:1", "sheetInstancePath": "/root/1", "sheetPath": "/child/",
            "page": page, "parentSheetInstancePath": "/root", "sheetSymbolUuid": null,
            "sheetName": "Child", "isTopLevel": false, "parentPage": parent
        }],
        "buses": [{
            "kind": "bus", "busUid": "bus:1", "sourceUuid": "b1", "sheetInstancePath": "/root",
            "sheetPath": "/", "page": page, "points": [[1.0, 2.0], [3.0, 4.0]], "at": null, "size": null
        }],
        "indexes": {
            "componentByReference": {}, "componentBySchematicUuid": {},
            "componentByPcbFootprintUuid": {}, "terminalBySchematicPinUuid": {},
            "terminalByPcbPadUuid": {}, "terminalByReferencePin": {},
            "netByName": {}, "netByNetCode": {}, "netBySchematicUuid": {},
            "netByPcbUuid": {}, "sheetInstanceByPath": {}, "busByUid": {}
        },
        "assembly": {
            "schema": "prism.assembly_state_a0",
            "catalog": [], "footprintInventory": [],
            "default": {"occurrences": {}, "components": {}, "footprints": {}},
            "variants": [], "diagnostics": []
        }
    }))
    .expect("a valid semantic index")
}

fn occurrences(page: &str) -> OccurrencesA0 {
    serde_json::from_value(json!({
        "schema": "prism.occurrences.a0",
        "sheets": [],
        "symbols": [{
            "kiidPath": "/root/s1", "sheetPath": "/root", "symbolUuid": "s1", "documentPath": page,
            "libId": "Device:R", "reference": "R1", "instanceMatched": true, "unit": 1, "dnp": false,
            "excludeFromBom": false, "excludeFromBoard": false, "excludeFromSim": false,
            "excludeFromPosFiles": false, "properties": {}, "bomFields": {}, "variants": []
        }],
        "footprints": [],
        "references": [], "variantDeclarations": []
    }))
    .expect("valid occurrences")
}

/// Every path the test documents carry, in a fixed order.
fn paths(index: &SemanticIndexA2, occurrences: &OccurrencesA0) -> Vec<String> {
    let mut out = vec![index.components[0].schematic_refs[0].page.clone()];
    out.extend(
        index.nets[0]
            .schematic_refs
            .iter()
            .map(|r| format!("{:?}", r.page.as_ref().map(|p| p.0.as_str()))),
    );
    let sheet = &index.sheet_instances[0];
    out.push(sheet.page.0.clone());
    out.push(format!(
        "{:?}",
        sheet.parent_page.as_ref().map(|p| p.0.as_str())
    ));
    let SemanticIndexBus::Wire(wire) = &index.buses[0] else {
        panic!("a bus wire")
    };
    out.push(wire.page.0.clone());
    out.push(occurrences.symbols[0].document_path.0.clone());
    out
}

#[test]
fn a_subdirectory_project_reads_project_relative_pages() {
    let mut semantic = index(
        "hw/board/sheets/child.kicad_sch",
        "hw/board/board.kicad_sch",
    );
    let mut occ = occurrences("hw/board/board.kicad_sch");
    members("hw/board/board.kicad_pro", &mut semantic, &mut occ);
    assert_eq!(
        paths(&semantic, &occ),
        [
            "sheets/child.kicad_sch",
            "Some(\"sheets/child.kicad_sch\")",
            "None",
            "sheets/child.kicad_sch",
            "Some(\"board.kicad_sch\")",
            "sheets/child.kicad_sch",
            "board.kicad_sch",
        ]
    );
}

#[test]
fn a_root_project_is_unchanged() {
    let mut semantic = index("sheets/child.kicad_sch", "board.kicad_sch");
    let mut occ = occurrences("board.kicad_sch");
    let before = paths(&semantic, &occ);
    members("board.kicad_pro", &mut semantic, &mut occ);
    assert_eq!(paths(&semantic, &occ), before);
}
