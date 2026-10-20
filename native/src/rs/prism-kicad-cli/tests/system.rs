//! `system build` (`docs/system-builder/CONTRACTS.md` §8.8, cli-spec.md
//! §5.11): the stage 1 acceptance on the fixture boards — split-and-splice,
//! B2B geometry and its manual override, nets through a board, references,
//! states — and every exit code of the checks.

mod support;
#[path = "support/system_1c.rs"]
mod system_1c;
#[path = "support/system_common.rs"]
mod system_common;

use prism_bundle::zip::ZipWriter;
use prism_bundle::{BundleReader, Limits, Work};
use serde_json::{Value, json};
use std::path::Path;
use support::{run, s, scratch};
use system_common::{
    Member, build, document, end, endpoint, finding, fixture_bundle, harness, key, link,
    mezzanine_bundle, mezzanine_mate, occurrence, output, sub_port, sub_port_endpoint,
    write_document,
};

fn wire<'a>(link: &'a Value, a: &str) -> Option<&'a Value> {
    link["wires"]
        .as_array()
        .unwrap()
        .iter()
        .find(|wire| wire["a"] == a)
}

// ----------------------------------------------------------------- three boards

/// J7's GND pin 1 is in both sub-ports: one link to the power board (net
/// names), one to the payload board (equal-size sub-ports). The two wires to
/// two sites make a proposed splice.
fn split_document() -> Value {
    let mut doc = document(
        "Split and splice",
        vec![
            occurrence("occ_obc", "OBC"),
            occurrence("occ_pow", "Power"),
            occurrence("occ_pay", "Payload"),
        ],
    );
    doc["subPorts"] = json!([
        sub_port("sub_a", "occ_obc", "J7", &["1", "3"]),
        sub_port("sub_b", "occ_obc", "J7", &["1", "7"]),
        sub_port("sub_c", "occ_pay", "J11", &["1", "2"]),
    ]);
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![
            end("end_obc", "occ_obc", "J7"),
            end("end_pow", "occ_pow", "J8"),
            end("end_pay", "occ_pay", "J11"),
        ],
        vec![
            link(
                "link_a",
                sub_port_endpoint("occ_obc", "J7", "sub_a"),
                endpoint("occ_pow", "J8"),
            ),
            link(
                "link_b",
                sub_port_endpoint("occ_obc", "J7", "sub_b"),
                sub_port_endpoint("occ_pay", "J11", "sub_c"),
            ),
        ],
    )]);
    doc
}

fn assert_split_links(bundle: &Value) {
    let links = bundle["links"].as_array().unwrap();
    let link_a = links.iter().find(|link| link["link"] == "link_a").unwrap();
    let link_b = links.iter().find(|link| link["link"] == "link_b").unwrap();
    // A whole connector on one side is not the equal-sub-port case: net names.
    let a = wire(link_a, "1").unwrap();
    assert_eq!((&a["b"], &a["rule"]), (&json!("2"), &json!("net-name")));
    assert_eq!(link_a["unmappedA"], json!(["3"]));
    // Two sub-ports of equal size map in order, whatever the net names.
    let b1 = wire(link_b, "1").unwrap();
    let b7 = wire(link_b, "7").unwrap();
    assert_eq!(
        (&b1["b"], &b1["rule"]),
        (&json!("1"), &json!("sub-port-order"))
    );
    assert_eq!(
        (&b7["b"], &b7["rule"]),
        (&json!("2"), &json!("sub-port-order"))
    );

    let splices = bundle["splices"].as_array().unwrap();
    assert_eq!(splices.len(), 1);
    assert_eq!(splices[0]["end"], "end_obc");
    assert_eq!(splices[0]["pad"], "1");
    assert_eq!(splices[0]["links"], json!(["link_a", "link_b"]));
    let splice = finding(bundle, "splice-proposed").expect("a splice-proposed warning");
    assert_eq!(splice["subject"], "splice:har_1/end_obc/1");
    assert_eq!(splice["severity"], "warning");
}

fn assert_shared_gnd_net(bundle: &Value) {
    let net = bundle["nets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|net| {
            net["pins"].as_array().unwrap().iter().any(|pin| {
                pin["occurrence"] == "occ_obc" && pin["connector"] == "J7" && pin["pad"] == "1"
            })
        })
        .expect("J7 pin 1's system net");
    assert_eq!(net["name"], "GND");
    for (occ, connector, pad) in [
        ("occ_obc", "J7", "1"),
        ("occ_pow", "J8", "2"),
        ("occ_pay", "J11", "1"),
    ] {
        assert!(
            net["pins"].as_array().unwrap().iter().any(|pin| {
                pin["occurrence"] == occ && pin["connector"] == connector && pin["pad"] == pad
            }),
            "{occ}/{connector}/{pad} is in J7 pin 1's net: {net}"
        );
    }
}

#[test]
fn three_board_split_and_splice() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let power = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let payload = fixture_bundle("sources/mini_payload/F0/mini_payload.kicad_pro", 0x33);
    let (k11, k22, k33) = (key(0x11), key(0x22), key(0x33));
    let path = write_document("split", &split_document());
    let members = [
        Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &k11,
        },
        Member {
            occurrence: "occ_pow",
            bundle: &power,
            key: &k22,
        },
        Member {
            occurrence: "occ_pay",
            bundle: &payload,
            key: &k33,
        },
    ];
    let (finished, out) = build("split", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    prism_bundle::schema::validate("prism.system_bundle.a0", &bundle).unwrap();
    for entry in bundle["occurrences"].as_array().unwrap() {
        assert_eq!(entry["state"], "ready");
    }
    assert_split_links(&bundle);
    assert_shared_gnd_net(&bundle);
    assert_eq!(finished.document["counts"]["ready_occurrences"], 3);
    assert_eq!(finished.document["counts"]["links"], 2);

    // The same inputs give byte-identical -o and stdout.
    let (again, out_again) = build("split-again", &path, &members, &[]);
    assert_eq!(again.code, 0, "{}", again.document);
    assert_eq!(again.stdout, finished.stdout);
    assert_eq!(
        std::fs::read(&out_again).unwrap(),
        std::fs::read(&out).unwrap()
    );
}

// -------------------------------------------------------------------- B2B mates

#[test]
fn b2b_geometry_maps_pad_n_to_pad_n() {
    let bundle = mezzanine_bundle("b2b", mezzanine_mate(0, None));
    let mate = &bundle["mates"][0];
    assert_eq!(mate["source"], "geometry");
    let pairs = mate["pairs"].as_array().unwrap();
    assert_eq!(pairs.len(), 120);
    assert!(
        pairs.iter().all(|pair| pair["a"] == pair["b"]),
        "quarter turns 0 maps pad n to pad n"
    );
    assert_eq!(mate["unmappedA"], json!([]));
    assert_eq!(mate["unmappedB"], json!([]));
}

#[test]
fn b2b_quarter_turns_change_the_mapping() {
    let bundle = mezzanine_bundle("b2b-turns", mezzanine_mate(2, None));
    let pairs = bundle["mates"][0]["pairs"].as_array().unwrap();
    assert_eq!(pairs.len(), 120);
    // Two quarter turns rotate B: A01 meets D30, D30 meets A01.
    assert_eq!(pairs[0], json!({"a": "A01", "b": "D30"}));
    assert_eq!(
        pairs
            .iter()
            .find(|pair| pair["a"] == "D30")
            .expect("D30's partner"),
        &json!({"a": "D30", "b": "A01"})
    );
    assert!(pairs.iter().any(|pair| pair["a"] != pair["b"]));
}

#[test]
fn b2b_manual_map_is_flagged() {
    let bundle = mezzanine_bundle(
        "b2b-manual",
        mezzanine_mate(
            0,
            Some(json!([{"a": "A01", "b": "A01"}, {"a": "A02", "b": "B01"}])),
        ),
    );
    assert_eq!(bundle["mates"][0]["source"], "manual");
    assert_eq!(
        bundle["mates"][0]["pairs"],
        json!([{"a": "A01", "b": "A01"}, {"a": "A02", "b": "B01"}])
    );
    let warning = finding(&bundle, "mate-manual-override").expect("a manual-override warning");
    assert_eq!(warning["severity"], "warning");
    assert_eq!(warning["subject"], "mate:mate_mezz");
}

// ------------------------------------------------------------- nets through a board

#[test]
fn a_system_net_traces_through_a_board() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let power = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let payload = fixture_bundle("sources/mini_payload/F0/mini_payload.kicad_pro", 0x33);
    let (k11, k22, k33) = (key(0x11), key(0x22), key(0x33));
    let mut doc = document(
        "Through",
        vec![
            occurrence("occ_obc", "OBC"),
            occurrence("occ_pow", "Power"),
            occurrence("occ_pay", "Payload"),
        ],
    );
    // GND enters on J2 and leaves on J6, both on the OBC.
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![],
        vec![
            link(
                "link_in",
                endpoint("occ_pow", "J1"),
                endpoint("occ_obc", "J2"),
            ),
            link(
                "link_out",
                endpoint("occ_obc", "J6"),
                endpoint("occ_pay", "J11"),
            ),
        ],
    )]);
    let path = write_document("through", &doc);
    let members = [
        Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &k11,
        },
        Member {
            occurrence: "occ_pow",
            bundle: &power,
            key: &k22,
        },
        Member {
            occurrence: "occ_pay",
            bundle: &payload,
            key: &k33,
        },
    ];
    let (finished, out) = build("through", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let net = bundle["nets"]
        .as_array()
        .unwrap()
        .iter()
        .find(|net| {
            net["pins"].as_array().unwrap().iter().any(|pin| {
                pin["occurrence"] == "occ_obc" && pin["connector"] == "J2" && pin["pad"] == "2"
            })
        })
        .expect("J2 pin 2's system net");
    assert_eq!(net["name"], "GND");
    for (occ, connector, pad) in [
        ("occ_pow", "J1", "2"),
        ("occ_obc", "J2", "2"),
        ("occ_obc", "J6", "2"),
        ("occ_pay", "J11", "2"),
    ] {
        assert!(
            net["pins"].as_array().unwrap().iter().any(|pin| {
                pin["occurrence"] == occ && pin["connector"] == connector && pin["pad"] == pad
            }),
            "{occ}/{connector}/{pad} is in the traced net: {net}"
        );
    }
    for link in bundle["links"].as_array().unwrap() {
        assert!(
            link["wires"]
                .as_array()
                .unwrap()
                .iter()
                .all(|wire| wire["rule"] == "net-name")
        );
    }
}

// --------------------------------------------------------------------- references

#[test]
fn references_report_missing_connectors_and_pins() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let power = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let (k11, k22) = (key(0x11), key(0x22));
    let mut doc = document(
        "References",
        vec![occurrence("occ_obc", "OBC"), occurrence("occ_pow", "Power")],
    );
    doc["subPorts"] = json!([sub_port("sub_bad", "occ_obc", "J7", &["1", "999"])]);
    doc["mates"] = json!([json!({
        "id": "mate_bad",
        "a": endpoint("occ_obc", "J99"),
        "b": endpoint("occ_pow", "J8"),
        "orientation": {"quarterTurns": 0, "flip": false},
        "rows": {},
    })]);
    doc["harnesses"] = json!([harness(
        "har_1",
        vec![],
        vec![link(
            "link_bad",
            sub_port_endpoint("occ_obc", "J7", "sub_bad"),
            endpoint("occ_pow", "J8"),
        )],
    )]);
    let path = write_document("references", &doc);
    let members = [
        Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &k11,
        },
        Member {
            occurrence: "occ_pow",
            bundle: &power,
            key: &k22,
        },
    ];
    let (finished, out) = build("references", &path, &members, &[]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let connector = bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|finding| finding["code"] == "connector-missing")
        .expect("connector-missing");
    assert_eq!(connector["severity"], "error");
    assert_eq!(connector["subject"], "connector:occ_obc/J99");
    let pin = bundle["findings"]
        .as_array()
        .unwrap()
        .iter()
        .find(|finding| finding["code"] == "pin-missing")
        .expect("pin-missing");
    assert_eq!(pin["severity"], "error");
    assert_eq!(pin["subject"], "pin:occ_obc/J7/999");
    assert_eq!(bundle["mates"][0]["source"], "unresolved");
}

// --------------------------------------------------------------- states and checks

/// Layout is presentation only (CONTRACTS §8.1): a moved symbol leaves the key,
/// the digest and the bundle as they were.
#[test]
fn layout_is_left_out_of_the_key() {
    let doc = document("Layout", vec![occurrence("occ_obc", "OBC")]);
    let mut laid_out = doc.clone();
    laid_out["layout"] = json!({
        "occ_obc": { "xNm": 25_400_000, "yNm": 12_700_000, "rotationDeg": 0, "mirror": false,
                     "size": { "widthNm": 50_800_000, "heightNm": 30_480_000 } }
    });
    let (plain, plain_out) = build(
        "layout-plain",
        &write_document("layout-plain", &doc),
        &[],
        &[],
    );
    let (moved, moved_out) = build(
        "layout-moved",
        &write_document("layout-moved", &laid_out),
        &[],
        &[],
    );
    assert_eq!(plain.code, 0, "{}", plain.document);
    assert_eq!(moved.code, 0, "{}", moved.document);
    assert_eq!(moved.stdout, plain.stdout);
    assert_eq!(
        std::fs::read(&moved_out).unwrap(),
        std::fs::read(&plain_out).unwrap()
    );
}

#[test]
fn states_pending_and_absent() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let k11 = key(0x11);
    let doc = document(
        "States",
        vec![
            occurrence("occ_obc", "OBC"),
            occurrence("occ_pay", "Payload"),
            occurrence("occ_pow", "Power"),
        ],
    );
    let path = write_document("states", &doc);
    let members = [Member {
        occurrence: "occ_obc",
        bundle: &obc,
        key: &k11,
    }];
    let (finished, out) = build("states", &path, &members, &["occ_pay"]);
    assert_eq!(finished.code, 0, "{}", finished.document);
    let bundle = output(&out);
    let state = |id: &str| {
        bundle["occurrences"]
            .as_array()
            .unwrap()
            .iter()
            .find(|entry| entry["occurrence"] == id)
            .unwrap()["state"]
            .clone()
    };
    assert_eq!(state("occ_obc"), "ready");
    assert_eq!(state("occ_pow"), "pending");
    assert_eq!(state("occ_pay"), "absent");
    let pending = finding(&bundle, "occurrence-pending").expect("occurrence-pending");
    assert_eq!(pending["severity"], "info");
    assert_eq!(pending["subject"], "occurrence:occ_pow");
    let absent = finding(&bundle, "occurrence-absent").expect("occurrence-absent");
    assert_eq!(absent["severity"], "error");
    assert_eq!(absent["subject"], "occurrence:occ_pay");
    assert_eq!(finished.document["counts"]["ready_occurrences"], 1);
    assert_eq!(finished.document["counts"]["pending_occurrences"], 1);
    assert_eq!(finished.document["counts"]["errors"], 1);
    let key = finished.document["system_bundle_key"].as_str().unwrap();
    assert_eq!(key.len(), 64);
    assert!(key.bytes().all(|byte| byte.is_ascii_hexdigit()));
}

// ------------------------------------------------------------------ exit codes

/// Rewrite `archive` with `edit` applied to its manifest JSON and members.
fn rewrite(archive: &Path, out: &Path, edit: impl FnOnce(&mut Value, &mut Vec<(String, Vec<u8>)>)) {
    let limits = Limits::defaults(Work::Verify);
    let reader = BundleReader::open(std::fs::read(archive).unwrap(), &limits).unwrap();
    let mut manifest = reader.manifest_read().value.clone();
    let mut members: Vec<(String, Vec<u8>)> = reader
        .manifest()
        .members
        .iter()
        .map(|member| {
            (
                member.path.0.clone(),
                reader.member(&member.path).unwrap().unwrap(),
            )
        })
        .collect();
    edit(&mut manifest, &mut members);
    let mut writer = ZipWriter::new(Vec::new(), &limits);
    let mut bytes = serde_json::to_vec(&manifest).unwrap();
    bytes.push(b'\n');
    writer.add("bundle.json", &bytes, &limits).unwrap();
    for (path, data) in &members {
        writer.add(path, data, &limits).unwrap();
    }
    std::fs::write(out, writer.finish(&limits).unwrap().0).unwrap();
}

fn assert_unchanged(finished: &support::Run, out: &Path, code: i32, code_field: &str) {
    assert_eq!(
        (finished.code, finished.code_field()),
        (code, code_field),
        "{}",
        finished.document
    );
    assert!(!out.exists(), "-o is untouched on every failure");
}

fn usage_case(document: &Path, out: &Path, tail: &[&str]) -> Vec<String> {
    let mut args: Vec<String> = ["system", "build", "--document"]
        .iter()
        .map(|part| (*part).to_owned())
        .collect();
    args.push(s(document).to_owned());
    args.push("-o".to_owned());
    args.push(s(out).to_owned());
    args.extend(tail.iter().map(|part| (*part).to_owned()));
    args
}

fn usage_cases(document: &Path, out: &Path, key: &str) -> Vec<Vec<String>> {
    let member = format!("occ_a={key}");
    let with_member = [
        "--member",
        "occ_a=a.prism",
        "--member-revision-key",
        member.as_str(),
    ];
    let mut both = with_member.to_vec();
    both.extend(["--absent", "occ_a"]);
    let mut bad_hex = with_member.to_vec();
    bad_hex[3] = "occ_a=xyz";
    vec![
        vec![
            "system".to_owned(),
            "build".to_owned(),
            "-o".to_owned(),
            s(out).to_owned(),
        ],
        vec![
            "system".to_owned(),
            "build".to_owned(),
            "--document".to_owned(),
            s(document).to_owned(),
        ],
        usage_case(document, out, &["--member", "occ_a=a.prism"]),
        usage_case(document, out, &["--member-revision-key", member.as_str()]),
        usage_case(
            document,
            out,
            &[
                "--member",
                "occ_a=a.prism",
                "--member",
                "occ_a=b.prism",
                "--member-revision-key",
                member.as_str(),
            ],
        ),
        usage_case(document, out, &both),
        usage_case(document, out, &["--member", "occ_a"]),
        usage_case(document, out, &bad_hex),
        usage_case(document, out, &["extra"]),
        // A missing value and a repeated single-valued option are usage too.
        usage_case(document, out, &["--absent"]),
        usage_case(document, out, &["--member-revision-key"]),
        vec![
            "system".to_owned(),
            "build".to_owned(),
            "--document".to_owned(),
            s(document).to_owned(),
            "--document".to_owned(),
            s(document).to_owned(),
            "-o".to_owned(),
            s(out).to_owned(),
        ],
    ]
}

#[test]
fn usage_errors_exit_two() {
    let doc = write_document("usage", &document("Usage", vec![]));
    let out = scratch("system-usage-out").join("bundle.json");
    for args in usage_cases(&doc, &out, &key(0x11)) {
        let argv: Vec<&str> = args.iter().map(String::as_str).collect();
        let finished = run(&argv);
        assert_eq!(finished.code, 2, "{args:?}: {}", finished.document);
        assert_eq!(finished.document["category"], "usage");
    }
}

#[test]
fn document_and_bundle_checks_exit_three() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let key = key(0x11);
    let doc = document("OBC", vec![occurrence("occ_obc", "OBC")]);
    let valid = write_document("checks-valid", &doc);

    let missing = scratch("system-missing-document").join("missing.json");
    let (finished, out) = build("missing-document", &missing, &[], &[]);
    assert_unchanged(&finished, &out, 3, "input-not-found");

    let invalid = write_document("checks-invalid", &json!({"schema": "prism.system.v2"}));
    let (finished, out) = build(
        "bad-document",
        &invalid,
        &[Member {
            occurrence: "occ_obc",
            bundle: &obc,
            key: &key,
        }],
        &[],
    );
    assert_unchanged(&finished, &out, 3, "document-invalid");

    let garbage = scratch("system-bad-bundle").join("garbage.prism");
    std::fs::write(&garbage, b"PK\x05\x06 not a bundle").unwrap();
    let (finished, out) = build(
        "bad-bundle",
        &valid,
        &[Member {
            occurrence: "occ_obc",
            bundle: &garbage,
            key: &key,
        }],
        &[],
    );
    assert_unchanged(&finished, &out, 3, "bundle-invalid");
    assert_eq!(finished.document["argument"], "member");
    assert!(
        finished.document["message"]
            .as_str()
            .unwrap()
            .contains("member:occ_obc"),
        "{}",
        finished.document
    );
}

#[test]
fn occurrence_generator_and_member_checks_exit_seven() {
    let obc = fixture_bundle("sources/mini_obc/F0/mini_obc.kicad_pro", 0x11);
    let obc_key = key(0x11);
    let mut doc = document("OBC", vec![occurrence("occ_obc", "OBC")]);
    let valid = write_document("checks-seven", &doc);
    let members = [Member {
        occurrence: "occ_obc",
        bundle: &obc,
        key: &obc_key,
    }];

    let (finished, out) = build("missing-occurrence", &valid, &members, &["occ_missing"]);
    assert_unchanged(&finished, &out, 7, "occurrence-mismatch");

    // A member naming an entry occurrence is not a board occurrence.
    doc["occurrences"] = json!([json!({
        "id": "occ_obc",
        "label": "OBC",
        "source": {"kind": "entry", "componentId": "cmp_1", "revisionId": "rev_1"},
    })]);
    let entry = write_document("checks-entry", &doc);
    let (finished, out) = build("entry-occurrence", &entry, &members, &[]);
    assert_unchanged(&finished, &out, 7, "occurrence-mismatch");

    let pow = fixture_bundle("sources/mini_power/F0/mini_power.kicad_pro", 0x22);
    let pow_key = key(0x22);
    let two = write_document(
        "checks-two",
        &document(
            "Two",
            vec![occurrence("occ_obc", "OBC"), occurrence("occ_pow", "Power")],
        ),
    );
    let foreign = scratch("system-foreign").join("foreign.prism");
    rewrite(&obc, &foreign, |manifest, _| {
        manifest["generator"]["crate_version"] = "9.9.9".into();
    });
    let (finished, out) = build(
        "generator",
        &two,
        &[
            Member {
                occurrence: "occ_obc",
                bundle: &foreign,
                key: &obc_key,
            },
            Member {
                occurrence: "occ_pow",
                bundle: &pow,
                key: &pow_key,
            },
        ],
        &[],
    );
    assert_unchanged(&finished, &out, 7, "generator-mismatch");

    let memberless = scratch("system-memberless").join("memberless.prism");
    rewrite(&obc, &memberless, |manifest, members| {
        if let Some(list) = manifest["members"].as_array_mut() {
            list.retain(|member| member["path"] != "projections/semantic-index.json");
        }
        members.retain(|(path, _)| path != "projections/semantic-index.json");
    });
    let (finished, out) = build(
        "member-not-found",
        &valid,
        &[Member {
            occurrence: "occ_obc",
            bundle: &memberless,
            key: &obc_key,
        }],
        &[],
    );
    assert_unchanged(&finished, &out, 7, "member-not-found");
    assert_eq!(finished.document["argument"], "member");
    assert!(
        finished.document["message"]
            .as_str()
            .unwrap()
            .contains("member:occ_obc"),
        "{}",
        finished.document
    );
}
