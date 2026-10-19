//! `system build` stage 1c (`docs/system-builder/CONTRACTS.md` §8.8, §10.5,
//! §12.2): board-level sub-ports and published entries, end to end on the
//! fixture boards.

use super::support::{self, Run};
use super::{
    Member, build, document, end, endpoint, finding, fixture_bundle, harness, key, link,
    occurrence, output, s, scratch, sub_port, sub_port_endpoint, write_document,
};
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

/// One `system build` published entry: the payload and the revision's stage.
struct EntrySpec<'a> {
    occurrence: &'a str,
    payload: &'a Path,
    stage: &'a str,
}

/// Run `system build` with the 1c inputs; `-o` is `<scratch>/bundle.json`.
fn build_1c(
    label: &str,
    document: &Path,
    members: &[Member<'_>],
    absent: &[&str],
    board_sub_ports: Option<&Path>,
    entries: &[EntrySpec<'_>],
) -> (Run, PathBuf) {
    let out = scratch(&format!("system-1c-{label}")).join("bundle.json");
    let mut args = vec![
        "system".to_owned(),
        "build".to_owned(),
        "--document".to_owned(),
        s(document).to_owned(),
    ];
    for member in members {
        args.push("--member".to_owned());
        args.push(format!("{}={}", member.occurrence, s(member.bundle)));
        args.push("--member-revision-key".to_owned());
        args.push(format!("{}={}", member.occurrence, member.key));
    }
    for occurrence in absent {
        args.push("--absent".to_owned());
        args.push((*occurrence).to_owned());
    }
    if let Some(path) = board_sub_ports {
        args.push("--board-sub-ports".to_owned());
        args.push(s(path).to_owned());
    }
    for entry in entries {
        args.push("--entry".to_owned());
        args.push(format!("{}={}", entry.occurrence, s(entry.payload)));
        args.push("--entry-stage".to_owned());
        args.push(format!("{}={}", entry.occurrence, entry.stage));
    }
    args.push("-o".to_owned());
    args.push(s(&out).to_owned());
    args.push("--quiet".to_owned());
    let argv: Vec<&str> = args.iter().map(String::as_str).collect();
    (support::run(&argv), out)
}

fn write_json(label: &str, name: &str, value: &Value) -> PathBuf {
    let dir = scratch(&format!("system-1c-file-{label}"));
    let path = dir.join(name);
    let mut text = if name.ends_with(".json") {
        serde_json::to_string_pretty(value).unwrap()
    } else {
        serde_json::to_string(value).unwrap()
    };
    text.push('\n');
    std::fs::write(&path, text).unwrap();
    path
}

fn board_sub_ports(definitions: Vec<Value>) -> Value {
    json!({"schema": "prism.board_sub_ports.a0", "subPorts": definitions})
}

fn definition(id: &str, project: &str, connector: &str, pins: &[&str], version: i32) -> Value {
    json!({
        "id": id,
        "projectId": project,
        "connector": connector,
        "name": id,
        "pins": pins,
        "version": version,
        "deleted": false,
        "previous": [],
    })
}

/// The project id `occurrence` gives its board (`occ_obc` and friends).
fn project_of(id: &str) -> String {
    format!("prj_{:012x}", id.bytes().map(u64::from).sum::<u64>())
}

fn board_sub_port_endpoint(occurrence: &str, connector: &str, id: &str, version: i32) -> Value {
    json!({
        "occurrence": occurrence,
        "connector": connector,
        "subPort": {"kind": "board", "id": id, "version": version},
    })
}

/// A two-board document whose `link_bsp` names the board-level sub-port.
fn board_sub_port_document() -> Value {
    let mut doc = document(
        "Board sub-port",
        vec![occurrence("occ_obc", "OBC"), occurrence("occ_pow", "Power")],
    );
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![],
        vec![link(
            "link_bsp",
            board_sub_port_endpoint("occ_obc", "J7", "bsp_j7", 1),
            endpoint("occ_pow", "J8"),
        )],
    )]);
    doc
}

fn board_sub_port_bundle(
    label: &str,
    definitions: Value,
) -> (Value, Run, PathBuf, PathBuf, PathBuf) {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let pow = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let doc = write_document(&format!("bsp-{label}"), &board_sub_port_document());
    let bsp = write_json(
        &format!("bsp-{label}"),
        "board-sub-ports.json",
        &definitions,
    );
    let members = [
        Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &k11,
        },
        Member {
            occurrence: "occ_pow",
            bundle: &pow,
            key: &k22,
        },
    ];
    let (finished, out) = build_1c(label, &doc, &members, &[], Some(&bsp), &[]);
    (output(&out), finished, out, bsp, doc)
}

#[test]
fn board_sub_port_pins_wire_the_link() {
    let definitions = board_sub_ports(vec![definition(
        "bsp_j7",
        &project_of("occ_obc"),
        "J7",
        &["1", "3"],
        1,
    )]);
    let (bundle, finished, _, _, _) = board_sub_port_bundle("pins", definitions);
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert!(finding(&bundle, "board-sub-port-missing").is_none());
    assert!(finding(&bundle, "board-sub-port-changed").is_none());
    let link = &bundle["links"][0];
    let wires = link["wires"].as_array().unwrap();
    // The definition's pins are the side: pin 1 is GND on both, pin 3 has no partner.
    assert_eq!(wires.len(), 1, "{link}");
    assert_eq!(wires[0]["a"], "1");
    assert_eq!(wires[0]["b"], "2");
    assert_eq!(wires[0]["rule"], "net-name");
    assert_eq!(link["unmappedA"], json!(["3"]));
}

#[test]
fn board_sub_port_without_input_is_missing() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let pow = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let doc = write_document("bsp-none", &board_sub_port_document());
    let members = [
        Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &k11,
        },
        Member {
            occurrence: "occ_pow",
            bundle: &pow,
            key: &k22,
        },
    ];
    let (finished, out) = build_1c("none", &doc, &members, &[], None, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let missing = finding(&bundle, "board-sub-port-missing").expect("board-sub-port-missing");
    assert_eq!(missing["severity"], "error");
    assert_eq!(missing["subject"], "sub-port:bsp_j7");
    assert_eq!(bundle["links"][0]["wires"], json!([]));
}

#[test]
fn board_sub_port_elsewhere_or_deleted_has_no_pins() {
    let elsewhere = board_sub_ports(vec![definition(
        "bsp_j7",
        "prj_000000000000",
        "J7",
        &["1", "3"],
        1,
    )]);
    let (bundle, finished, _, _, _) = board_sub_port_bundle("elsewhere", elsewhere);
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert_eq!(
        finding(&bundle, "board-sub-port-missing").unwrap()["subject"],
        "sub-port:bsp_j7"
    );
    assert_eq!(bundle["links"][0]["wires"], json!([]));

    let other_connector = board_sub_ports(vec![definition(
        "bsp_j7",
        &project_of("occ_obc"),
        "J2",
        &["1", "3"],
        1,
    )]);
    let (bundle, finished, _, _, _) = board_sub_port_bundle("connector", other_connector);
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert!(finding(&bundle, "board-sub-port-missing").is_some());

    let mut deleted = definition("bsp_j7", &project_of("occ_obc"), "J7", &["1", "3"], 2);
    deleted["deleted"] = json!(true);
    let (bundle, finished, _, _, _) =
        board_sub_port_bundle("deleted", board_sub_ports(vec![deleted]));
    assert_eq!(finished.code, 0, "{}", finished.document);
    let finding = finding(&bundle, "board-sub-port-deleted").expect("board-sub-port-deleted");
    assert_eq!(finding["severity"], "error");
    assert_eq!(finding["subject"], "sub-port:bsp_j7");
    assert_eq!(bundle["links"][0]["wires"], json!([]));
}

#[test]
fn board_sub_port_changed_lists_pins_but_a_rename_is_silent() {
    let mut changed = definition("bsp_j7", &project_of("occ_obc"), "J7", &["1", "3", "5"], 3);
    changed["name"] = json!("Payload power");
    changed["previous"] = json!([{"version": 1, "pins": ["1", "2", "3"]}]);
    let (bundle, finished, _, _, _) =
        board_sub_port_bundle("changed", board_sub_ports(vec![changed.clone()]));
    assert_eq!(finished.code, 0, "{}", finished.document);
    let changed_finding =
        finding(&bundle, "board-sub-port-changed").expect("board-sub-port-changed");
    assert_eq!(changed_finding["severity"], "warning");
    assert_eq!(changed_finding["subject"], "sub-port:bsp_j7");
    let message = changed_finding["message"].as_str().unwrap();
    assert!(message.contains("added 5"), "{message}");
    assert!(message.contains("removed 2"), "{message}");
    // The live pins wire the link, not version 1's.
    assert_eq!(bundle["links"][0]["unmappedA"], json!(["3", "5"]));

    // Version 3 with the same pins as version 1 is only a rename: no finding.
    let mut renamed = changed;
    renamed["pins"] = json!(["1", "2", "3"]);
    let (bundle, finished, _, _, _) =
        board_sub_port_bundle("renamed", board_sub_ports(vec![renamed]));
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert!(finding(&bundle, "board-sub-port-changed").is_none());
}

#[test]
fn board_sub_port_version_changes_the_key() {
    let first = board_sub_ports(vec![definition(
        "bsp_j7",
        &project_of("occ_obc"),
        "J7",
        &["1", "3"],
        1,
    )]);
    let second = board_sub_ports(vec![definition(
        "bsp_j7",
        &project_of("occ_obc"),
        "J7",
        &["1", "3"],
        2,
    )]);
    let (_, first_run, _, _, _) = board_sub_port_bundle("key-v1", first);
    let (_, second_run, _, _, _) = board_sub_port_bundle("key-v2", second);
    assert_eq!(first_run.code, 0, "{}", first_run.document);
    assert_eq!(second_run.code, 0, "{}", second_run.document);
    assert_ne!(
        first_run.document["system_bundle_key"],
        second_run.document["system_bundle_key"]
    );
}

// ------------------------------------------------------------------- entries

fn entry_occurrence(id: &str, label: &str) -> Value {
    json!({
        "id": id,
        "label": label,
        "source": {"kind": "entry", "componentId": "cmp_entry", "revisionId": "rev_entry"},
    })
}

/// The child system: one board with two exported sub-ports.
fn child_document() -> Value {
    let mut doc = document("Entry child", vec![occurrence("occ_obc", "OBC")]);
    doc["subPorts"] = json!([
        sub_port("sub_gnd", "occ_obc", "J7", &["1", "2"]),
        sub_port("sub_pwr", "occ_obc", "J2", &["1", "2"]),
    ]);
    doc["exports"] = json!([
        {
            "id": "exp_gnd",
            "name": "Ground",
            "site": sub_port_endpoint("occ_obc", "J7", "sub_gnd"),
            "pinNames": {"1": "GND_A"},
        },
        {
            "id": "exp_pwr",
            "name": "Power",
            "site": sub_port_endpoint("occ_obc", "J2", "sub_pwr"),
            "pinNames": {},
        },
    ]);
    doc
}

/// One export of `interface` (`CONTRACTS.md` §11.1), from the child document
/// and the child bundle it was built into.
fn interface_export(document: &Value, bundle: &Value, export: &Value) -> Value {
    let site = &export["site"];
    let occurrence = site["occurrence"].as_str().unwrap();
    let connector = site["connector"].as_str().unwrap();
    let board = bundle["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|entry| entry["occurrence"] == occurrence)
        .expect("the child bundle has the occurrence");
    let component = board["connectors"]
        .as_array()
        .unwrap()
        .iter()
        .find(|component| component["refdes"] == connector)
        .expect("the child bundle has the export's connector");
    let pads: Vec<String> = match site.get("subPort").and_then(|sub| sub["id"].as_str()) {
        Some(id) => document["subPorts"]
            .as_array()
            .unwrap()
            .iter()
            .find(|sub_port| sub_port["id"] == id)
            .expect("the document has the sub-port")["pins"]
            .as_array()
            .unwrap()
            .iter()
            .map(|pad| pad.as_str().unwrap().to_owned())
            .collect(),
        None => component["pins"]
            .as_array()
            .unwrap()
            .iter()
            .map(|pin| pin["pad"].as_str().unwrap().to_owned())
            .collect(),
    };
    let pins: Vec<Value> = pads
        .iter()
        .map(|pad| {
            let pin = component["pins"]
                .as_array()
                .unwrap()
                .iter()
                .find(|pin| pin["pad"] == pad.as_str())
                .expect("the export pin exists");
            let net = bundle["nets"]
                .as_array()
                .unwrap()
                .iter()
                .find(|net| {
                    net["pins"].as_array().unwrap().iter().any(|reference| {
                        reference["occurrence"] == occurrence
                            && reference["connector"] == connector
                            && reference["pad"] == pad.as_str()
                    })
                })
                .expect("the export pin is on a system net");
            let name = export["pinNames"][pad.as_str()]
                .as_str()
                .or_else(|| pin["pinName"].as_str())
                .unwrap_or(pad);
            json!({"pad": pad, "name": name, "net": net["id"], "signal": net["name"]})
        })
        .collect();
    let mut out = json!({
        "id": export["id"],
        "name": export["name"],
        "occurrence": occurrence,
        "connector": connector,
        "pins": pins,
    });
    if let Some(sub_port) = site.get("subPort") {
        out["subPort"] = sub_port.clone();
    }
    out
}

fn entry_payload(document: &Value, bundle: &Value, system_key: &str) -> Value {
    let exports: Vec<Value> = document["exports"]
        .as_array()
        .unwrap()
        .iter()
        .map(|export| interface_export(document, bundle, export))
        .collect();
    let payload = json!({
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": "sys_child",
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": system_key,
        },
        "document": document,
        "boardSubPorts": board_sub_ports(vec![]),
        "bundle": bundle,
        "interface": {"exports": exports},
    });
    prism_bundle::schema::validate("prism.system_entry.a0", &payload).unwrap();
    payload
}

/// Build the child system and write its `prism.system_entry.a0` payload.
fn child_entry(label: &str) -> (PathBuf, String) {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let k11 = key(0x11);
    let document = child_document();
    let path = write_document(&format!("entry-child-{label}"), &document);
    let members = [Member {
        occurrence: "occ_obc",
        bundle: &obc,
        key: &k11,
    }];
    let (finished, out) = build(&format!("entry-child-{label}"), &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let key = finished.document["system_bundle_key"].as_str().unwrap();
    let payload = entry_payload(&document, &bundle, key);
    let file = write_json(&format!("entry-payload-{label}"), "entry.json", &payload);
    (file, key.to_owned())
}

/// The parent: the entry and one power board, wired GND through the entry.
fn parent_document() -> Value {
    let mut doc = document(
        "Entry parent",
        vec![
            entry_occurrence("occ_entry", "Published child"),
            occurrence("occ_pow", "Power"),
        ],
    );
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![
            end("end_entry", "occ_entry", "exp_gnd"),
            end("end_pow", "occ_pow", "J8"),
        ],
        vec![link(
            "link_gnd",
            endpoint("occ_entry", "exp_gnd"),
            endpoint("occ_pow", "J8"),
        )],
    )]);
    doc["mates"] = json!([json!({
        "id": "mate_entry",
        "a": endpoint("occ_entry", "exp_pwr"),
        "b": endpoint("occ_pow", "J8"),
        "orientation": {"quarterTurns": 0, "flip": false},
        "rows": {},
    })]);
    doc["exports"] = json!([{
        "id": "exp_bad",
        "name": "Missing",
        "site": endpoint("occ_entry", "exp_missing"),
        "pinNames": {},
    }]);
    doc
}

fn parent_build(label: &str, entry: Option<(&Path, &str)>) -> (Value, Run, PathBuf, PathBuf) {
    let pow = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let k22 = key(0x22);
    let document = parent_document();
    let path = write_document(&format!("entry-parent-{label}"), &document);
    let members = [Member {
        occurrence: "occ_pow",
        bundle: &pow,
        key: &k22,
    }];
    let entries: Vec<EntrySpec<'_>> = entry
        .map(|(payload, stage)| EntrySpec {
            occurrence: "occ_entry",
            payload,
            stage,
        })
        .into_iter()
        .collect();
    let (finished, out) = build_1c(label, &path, &members, &[], None, &entries);
    let bundle = if finished.code == 0 {
        output(&out)
    } else {
        Value::Null
    };
    (bundle, finished, out, path)
}

fn entry_of(bundle: &Value) -> &Value {
    bundle["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|occurrence| occurrence["occurrence"] == "occ_entry")
        .unwrap()
}

fn assert_ready_entry(bundle: &Value, child_key: &str) {
    let entry = entry_of(bundle);
    assert_eq!(entry["state"], "ready");
    assert_eq!(entry["bundleKey"], child_key);
    assert!(entry.get("revisionKey").is_none(), "{entry}");
    let refdes: Vec<&str> = entry["connectors"]
        .as_array()
        .unwrap()
        .iter()
        .map(|connector| connector["refdes"].as_str().unwrap())
        .collect();
    assert_eq!(refdes, vec!["exp_gnd", "exp_pwr"]);
    assert_eq!(entry["connectors"][0]["value"], "Ground");
    assert_eq!(entry["connectors"][1]["value"], "Power");
    assert!(finding(bundle, "entry-unreleased").is_none());
    assert!(finding(bundle, "entry-archived").is_none());
    assert!(finding(bundle, "occurrence-pending").is_none());
}

fn assert_pin_in_net(net: &Value, occurrence: &str, connector: &str, pad: &str) {
    assert!(
        net["pins"].as_array().unwrap().iter().any(|pin| {
            pin["occurrence"] == occurrence && pin["connector"] == connector && pin["pad"] == pad
        }),
        "{occurrence}/{connector}/{pad} is in the entry's net: {net}"
    );
}

fn assert_entry_net(bundle: &Value) {
    // Two export pins on one child net are one parent net, through the link.
    let net = bundle["nets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|net| {
            net["pins"].as_array().unwrap().iter().any(|pin| {
                pin["occurrence"] == "occ_entry"
                    && pin["connector"] == "exp_gnd"
                    && pin["pad"] == "1"
            })
        })
        .expect("the entry pin's parent net");
    assert_pin_in_net(net, "occ_entry", "exp_gnd", "1");
    assert_pin_in_net(net, "occ_entry", "exp_gnd", "2");
    assert_pin_in_net(net, "occ_pow", "J8", "2");
}

fn assert_entry_findings(bundle: &Value) {
    let missing = finding(bundle, "export-missing").expect("export-missing");
    assert_eq!(missing["severity"], "error");
    assert_eq!(missing["subject"], "connector:occ_entry/exp_missing");
    let unresolved = finding(bundle, "mate-unresolved").expect("mate-unresolved");
    assert_eq!(unresolved["severity"], "error");
    assert_eq!(unresolved["subject"], "mate:mate_entry");
}

#[test]
fn entry_is_ready_with_its_exports_and_nets() {
    let (payload, child_key) = child_entry("ready");
    let (bundle, finished, out, _) = parent_build("ready", Some((&payload, "released")));
    assert_eq!(finished.code, 0, "{}", finished.document);
    assert_ready_entry(&bundle, &child_key);
    assert_entry_net(&bundle);
    assert_entry_findings(&bundle);

    // The same inputs give byte-identical -o and stdout.
    let (again, again_run, again_out, _) =
        parent_build("ready-again", Some((&payload, "released")));
    assert_eq!(again_run.code, 0, "{}", again_run.document);
    assert_eq!(again_run.stdout, finished.stdout);
    assert_eq!(
        std::fs::read(&again_out).unwrap(),
        std::fs::read(&out).unwrap()
    );
    assert_eq!(again["documentSha256"], bundle["documentSha256"]);
}

#[test]
fn entry_stage_findings_and_the_key() {
    let (payload, _) = child_entry("stages");
    let (bundle, finished, _, _) = parent_build("released", Some((&payload, "released")));
    assert_eq!(finished.code, 0, "{}", finished.document);
    let released_key = finished.document["system_bundle_key"].clone();

    let (bundle_in_progress, in_progress, _, _) =
        parent_build("in-progress", Some((&payload, "in_progress")));
    assert_eq!(in_progress.code, 0, "{}", in_progress.document);
    let unreleased = finding(&bundle_in_progress, "entry-unreleased").expect("entry-unreleased");
    assert_eq!(unreleased["severity"], "error");
    assert_eq!(unreleased["subject"], "occurrence:occ_entry");
    assert_ne!(
        in_progress.document["system_bundle_key"], released_key,
        "the stage is part of the key"
    );

    let (bundle_archived, archived, _, _) = parent_build("archived", Some((&payload, "archived")));
    assert_eq!(archived.code, 0, "{}", archived.document);
    let archived_finding = finding(&bundle_archived, "entry-archived").expect("entry-archived");
    assert_eq!(archived_finding["severity"], "warning");
    assert_eq!(archived_finding["subject"], "occurrence:occ_entry");
    assert!(finding(&bundle, "entry-archived").is_none());
    assert_ne!(archived.document["system_bundle_key"], released_key);
}

#[test]
fn entry_without_payload_is_absent() {
    let (bundle, finished, _, _) = parent_build("absent", None);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let entry = bundle["occurrences"]
        .as_array()
        .unwrap()
        .iter()
        .find(|occurrence| occurrence["occurrence"] == "occ_entry")
        .unwrap();
    assert_eq!(entry["state"], "absent");
    let absent_finding = finding(&bundle, "occurrence-absent").expect("occurrence-absent");
    assert_eq!(absent_finding["severity"], "error");
    assert_eq!(absent_finding["subject"], "occurrence:occ_entry");
    assert!(finding(&bundle, "occurrence-pending").is_none());
}

// ------------------------------------------------------------- inputs and keys

#[test]
fn entry_on_a_board_occurrence_exits_seven() {
    let (payload, _) = child_entry("mismatch");
    let doc = write_document(
        "entry-mismatch",
        &document("Board", vec![occurrence("occ_obc", "OBC")]),
    );
    let entries = [EntrySpec {
        occurrence: "occ_obc",
        payload: &payload,
        stage: "released",
    }];
    let (finished, out) = build_1c("mismatch", &doc, &[], &[], None, &entries);
    assert_eq!(finished.code, 7, "{}", finished.document);
    assert_eq!(finished.document["code"], "occurrence-mismatch");
    assert!(!out.exists());
}

#[test]
fn invalid_inputs_exit_three() {
    let (payload, _) = child_entry("invalid");
    let doc = write_document("invalid-inputs", &parent_document());

    let bad_bsp = write_json(
        "bad-bsp",
        "bad.json",
        &json!({"schema": "prism.board_sub_ports.a0"}),
    );
    let (finished, out) = build_1c("bad-bsp", &doc, &[], &[], Some(&bad_bsp), &[]);
    assert_eq!(finished.code, 3, "{}", finished.document);
    assert_eq!(finished.document["code"], "input-invalid");
    assert!(!out.exists());

    let bad_entry = write_json(
        "bad-entry",
        "bad.json",
        &json!({"schema": "prism.system_entry.a0"}),
    );
    let entries = [EntrySpec {
        occurrence: "occ_entry",
        payload: &bad_entry,
        stage: "released",
    }];
    let (finished, out) = build_1c("bad-entry", &doc, &[], &[], None, &entries);
    assert_eq!(finished.code, 3, "{}", finished.document);
    assert_eq!(finished.document["code"], "input-invalid");
    assert!(
        finished.document["message"]
            .as_str()
            .unwrap()
            .contains("entry:occ_entry"),
        "{}",
        finished.document
    );
    assert!(!out.exists());

    // A valid payload still needs an entry occurrence.
    let board = write_document(
        "valid-doc-board",
        &document("Board", vec![occurrence("occ_obc", "OBC")]),
    );
    let entries = [EntrySpec {
        occurrence: "occ_obc",
        payload: &payload,
        stage: "released",
    }];
    let (finished, _) = build_1c("bad-occ", &board, &[], &[], None, &entries);
    assert_eq!(finished.code, 7, "{}", finished.document);
}

/// The smallest committed example: one board, one exported pin.
fn example_document() -> Value {
    let mut doc = document(
        "Mini power interface",
        vec![occurrence("occ_power", "Power")],
    );
    doc["subPorts"] = json!([sub_port("sub_gnd", "occ_power", "J8", &["2"])]);
    doc["exports"] = json!([{
        "id": "exp_gnd",
        "name": "Ground",
        "site": sub_port_endpoint("occ_power", "J8", "sub_gnd"),
        "pinNames": {"2": "GND"},
    }]);
    doc
}

fn example_entry() -> PathBuf {
    let power = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let k22 = key(0x22);
    let document = example_document();
    let path = write_document("entry-example", &document);
    let members = [Member {
        occurrence: "occ_power",
        bundle: &power,
        key: &k22,
    }];
    let (finished, out) = build("entry-example", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let key = finished.document["system_bundle_key"].as_str().unwrap();
    let payload = entry_payload(&document, &output(&out), key);
    assert_eq!(
        payload["interface"]["exports"][0]["pins"][0]["signal"],
        "GND"
    );
    write_json("entry-example", "entry.json", &payload)
}

#[test]
fn example_entry_has_an_export_with_pins() {
    let path = example_entry();
    let payload: Value = serde_json::from_slice(&std::fs::read(path).unwrap()).unwrap();
    prism_bundle::schema::validate("prism.system_entry.a0", &payload).unwrap();
    let pin = &payload["interface"]["exports"][0]["pins"][0];
    assert_eq!(pin["pad"], "2");
    assert_eq!(pin["name"], "GND");
    assert_eq!(pin["signal"], "GND");
}

#[test]
fn new_argument_rules_exit_two() {
    let doc = write_document("arg-rules", &document("Usage", vec![]));
    let out = scratch("system-1c-usage").join("bundle.json");
    let base = || {
        vec![
            "system".to_owned(),
            "build".to_owned(),
            "--document".to_owned(),
            s(&doc).to_owned(),
            "-o".to_owned(),
            s(&out).to_owned(),
        ]
    };
    let cases: Vec<Vec<&str>> = vec![
        vec!["--entry", "occ_a=a.json"],
        vec!["--entry-stage", "occ_a=released"],
        vec!["--entry", "occ_a"],
        vec!["--entry-stage", "occ_a"],
        vec!["--entry", "occ_a=a.json", "--entry-stage", "occ_b=released"],
        vec!["--entry", "occ_a=a.json", "--entry-stage", "occ_a=RELEASED"],
        vec![
            "--entry",
            "occ_a=a.json",
            "--entry-stage",
            "occ_a=abcdefghijklmnopqrstuvwxyz0123456",
        ],
        vec![
            "--entry",
            "occ_a=a.json",
            "--entry-stage",
            "occ_a=released",
            "--entry",
            "occ_a=b.json",
        ],
        vec![
            "--entry",
            "occ_a=a.json",
            "--entry-stage",
            "occ_a=released",
            "--entry-stage",
            "occ_a=archived",
        ],
        vec![
            "--member",
            "occ_a=b.prism",
            "--member-revision-key",
            "occ_a=0000000000000000000000000000000000000000000000000000000000000000",
            "--entry",
            "occ_a=a.json",
            "--entry-stage",
            "occ_a=released",
        ],
        vec![
            "--absent",
            "occ_a",
            "--entry",
            "occ_a=a.json",
            "--entry-stage",
            "occ_a=released",
        ],
        vec!["--board-sub-ports", "a.json", "--board-sub-ports", "b.json"],
    ];
    for tail in cases {
        let mut args = base();
        args.extend(tail.iter().map(|part| (*part).to_owned()));
        let argv: Vec<&str> = args.iter().map(String::as_str).collect();
        let finished = support::run(&argv);
        assert_eq!(finished.code, 2, "{tail:?}: {}", finished.document);
        assert_eq!(finished.document["category"], "usage");
    }
}
