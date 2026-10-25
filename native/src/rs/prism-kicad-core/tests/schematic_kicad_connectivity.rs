//! Connectivity rules checked against KiCad 10.0.6's netlist
//! (`eeschema/connection_graph.cpp`), one synthetic design per rule.

use prism_kicad_contracts::generated::source_bundle_manifest::{
    SourceBundleManifestA0, SourceBundleSource, SourceKind,
};
use prism_kicad_core::{
    SchematicBundleIndex, SchematicBundleLimits, SchematicDesignNet, SourceBundle,
    SourceBundleLimits, build_schematic_scalar_design_nets,
};

const PART: &str = r#"(symbol "Demo:Part"
      (symbol "Demo:Part_1_1"
        (pin passive line (at 0 0 0) (name "P") (number "1"))))"#;

/// KiCad joins same-sheet subgraphs whose drivers share a name ignoring the sheet
/// path, so a local label meets a global label of the same text.
#[test]
fn a_local_and_a_global_label_of_one_name_on_one_sheet_join() {
    let root = format!(
        r#"(kicad_sch (uuid root)
          (lib_symbols {PART})
          (global_label "SIG" (shape input) (at 0 0 0) (uuid global))
          (label "SIG" (at 20 0 0) (uuid local))
          {}
          {})"#,
        part("U1", 0.0, 0.0, "u1"),
        part("U2", 20.0, 0.0, "u2"),
    );
    let design = design(&[("root.kicad_sch", root)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
    assert_eq!(net_of(&design, "U1.1").name, "SIG");
}

/// A no-connect pin never carries a connection (`SCH_PIN::ConnectionPropagatesTo`),
/// so no-connect pins stacked on one point stay apart.
#[test]
fn stacked_no_connect_pins_stay_apart() {
    let root = r#"(kicad_sch (uuid root)
      (lib_symbols
        (symbol "Demo:NC"
          (symbol "Demo:NC_1_1"
            (pin no_connect line (at 0 0 0) (name "NC") (number "1"))
            (pin no_connect line (at 0 0 0) (name "NC") (number "2"))
            (pin passive line (at 0 5 0) (name "P") (number "3")))))
      (symbol (lib_id "Demo:NC") (at 0 0 0) (uuid nc)
        (property "Reference" "U1") (property "Value" "NC")))"#;
    let design = design(&[("root.kicad_sch", root.to_owned())]);
    assert_ne!(net_of(&design, "U1.1"), net_of(&design, "U1.2"));
}

/// Buses that carry the same global label are one bus on every sheet.
#[test]
fn members_of_one_global_bus_join_across_sheets() {
    let bus = |reference: &str, uuid: &str| {
        format!(
            r#"(bus (pts (xy 0 20) (xy 10 20)) (uuid {uuid}-bus))
          (global_label "B[0..1]" (shape bidirectional) (at 0 20 0) (uuid {uuid}-name))
          (bus_entry (at 2 20) (size 0 -5) (uuid {uuid}-entry))
          (wire (pts (xy 2 15) (xy 2 10)) (uuid {uuid}-wire))
          (label "B0" (at 2 10 0) (uuid {uuid}-member))
          {}"#,
            part(reference, 2.0, 10.0, uuid)
        )
    };
    let root = format!(
        r#"(kicad_sch (uuid root)
          (lib_symbols {PART})
          {}
          (sheet (at 40 40) (size 10 10) (uuid sheet)
            (property "Sheetname" "Child") (property "Sheetfile" "child.kicad_sch")))"#,
        bus("U1", "root")
    );
    let child = format!(
        "(kicad_sch (uuid child) (lib_symbols {PART}) {})",
        bus("U2", "child")
    );
    let design = design(&[("root.kicad_sch", root), ("child.kicad_sch", child)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
}

/// KiCad finds a placed symbol's library symbol by its exact `lib_id`; a sheet that
/// also embeds `Local:VCC` (a local power port) keeps `power:VCC` global.
#[test]
fn a_power_port_resolves_its_own_library_symbol_before_a_base_name_match() {
    let power = |reference: &str, x: f64, uuid: &str| {
        format!(
            r#"(symbol (lib_id "power:VCC") (at {x} 0 0) (uuid {uuid})
            (property "Reference" "{reference}") (property "Value" "VX"))"#
        )
    };
    let libraries = format!(
        r#"(lib_symbols
          (symbol "Local:VCC" (power local)
            (symbol "Local:VCC_1_1" (pin power_in line (at 0 0 0) (name "VCC") (number "1"))))
          (symbol "power:VCC" (power global)
            (symbol "power:VCC_1_1" (pin power_in line (at 0 0 0) (name "VCC") (number "1"))))
          {PART})"#
    );
    let root = format!(
        r#"(kicad_sch (uuid root) {libraries}
          {} {}
          (sheet (at 40 40) (size 10 10) (uuid sheet)
            (property "Sheetname" "Child") (property "Sheetfile" "child.kicad_sch")))"#,
        power("#PWR01", 0.0, "pwr-root"),
        part("U1", 0.0, 0.0, "u1")
    );
    let child = format!(
        "(kicad_sch (uuid child) {libraries} {} {})",
        power("#PWR02", 0.0, "pwr-child"),
        part("U2", 0.0, 0.0, "u2")
    );
    let design = design(&[("root.kicad_sch", root), ("child.kicad_sch", child)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
    assert_eq!(net_of(&design, "U1.1").name, "VX");
}

/// A sheet whose bus reaches its members by label name and a sheet with one bus
/// stub per member, each under its own hierarchical label, share a parent bus that
/// runs through sheet A's pin rather than ending on it (KiCad 10.0.6 still connects
/// that pin): each member is one net across both sheets.
#[test]
fn bus_members_join_through_one_stub_per_member() {
    let root = r#"(kicad_sch (uuid root)
      (sheet (at 0 0) (size 20 20) (uuid sheet-a)
        (property "Sheetname" "A") (property "Sheetfile" "a.kicad_sch")
        (pin "S[1..2]" output (at 20 10 0) (uuid pin-a)))
      (sheet (at 40 0) (size 20 20) (uuid sheet-b)
        (property "Sheetname" "B") (property "Sheetfile" "b.kicad_sch")
        (pin "S[1..2]" input (at 40 10 180) (uuid pin-b)))
      (bus (pts (xy 18 10) (xy 40 10)) (uuid root-bus)))"#;
    let a = format!(
        r#"(kicad_sch (uuid a) (lib_symbols {PART})
          (hierarchical_label "S[1..2]" (shape output) (at 0 0 0) (uuid a-port))
          (wire (pts (xy 20 20) (xy 30 20)) (uuid a-wire-1))
          (label "S1" (at 20 20 0) (uuid a-label-1))
          (wire (pts (xy 20 40) (xy 30 40)) (uuid a-wire-2))
          (label "S2" (at 20 40 0) (uuid a-label-2))
          {} {})"#,
        part("U1", 30.0, 20.0, "u1"),
        part("U2", 30.0, 40.0, "u2")
    );
    let stub = |member: u32, y: f64| {
        format!(
            r#"(hierarchical_label "S[1..2]" (shape input) (at 0 {y} 0) (uuid b-port-{member}))
          (bus (pts (xy 0 {y}) (xy 4 {y})) (uuid b-bus-{member}))
          (bus_entry (at 4 {y}) (size 2 2) (uuid b-entry-{member}))
          (wire (pts (xy 6 {y2}) (xy 20 {y2})) (uuid b-wire-{member}))
          (label "S{member}" (at 10 {y2} 0) (uuid b-label-{member}))
          {}"#,
            part(
                &format!("U{}", member + 2),
                20.0,
                y + 2.0,
                &format!("b{member}")
            ),
            y2 = y + 2.0
        )
    };
    let b = format!(
        "(kicad_sch (uuid b) (lib_symbols {PART}) {} {})",
        stub(1, 0.0),
        stub(2, 20.0)
    );
    let design = design(&[
        ("root.kicad_sch", root.to_owned()),
        ("a.kicad_sch", a),
        ("b.kicad_sch", b),
    ]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U3.1"));
    assert_eq!(net_of(&design, "U2.1"), net_of(&design, "U4.1"));
}

/// KiCad names a net whose only driver is one pin `unconnected-(…)` whatever the
/// pin's type, and keeps a `~` pin name in files from 20250318 on; older files mean
/// no name by it.
#[test]
fn lone_pins_are_unconnected_and_tilde_names_follow_the_file_version() {
    let sheet = |version: &str| {
        format!(
            r#"(kicad_sch (version {version}) (uuid root)
          (lib_symbols
            (symbol "Demo:IO"
              (symbol "Demo:IO_1_1"
                (pin bidirectional line (at 0 0 0) (name "IO") (number "5"))
                (pin passive line (at 10 0 0) (name "~") (number "6")))))
          (wire (pts (xy 0 0) (xy 0 5)) (uuid stub))
          (symbol (lib_id "Demo:IO") (at 0 0 0) (uuid u1)
            (property "Reference" "U1") (property "Value" "IO")))"#
        )
    };
    let current = design(&[("root.kicad_sch", sheet("20260306"))]);
    assert_eq!(net_of(&current, "U1.5").name, "unconnected-(U1-IO-Pad5)");
    assert_eq!(net_of(&current, "U1.6").name, "unconnected-(U1-~-Pad6)");
    let legacy = design(&[("root.kicad_sch", sheet("20240101"))]);
    assert_eq!(net_of(&legacy, "U1.6").name, "unconnected-(U1-Pad6)");
}

/// A unit's display name (`(unit_name …)`, KiCad 10) replaces its A/B/C suffix in
/// net names (`SCH_SYMBOL::SubReference`); a unit without one keeps the letter.
#[test]
fn unit_display_names_replace_the_unit_letter() {
    let root = r#"(kicad_sch (version 20260306) (uuid root)
      (lib_symbols
        (symbol "Demo:Dual"
          (symbol "Demo:Dual_1_1"
            (unit_name "POWER")
            (pin passive line (at 0 0 0) (name "VIN") (number "1")))
          (symbol "Demo:Dual_2_1"
            (pin passive line (at 0 0 0) (name "IO") (number "2")))))
      (symbol (lib_id "Demo:Dual") (at 0 0 0) (unit 1) (uuid unit-a)
        (property "Reference" "U1") (property "Value" "Dual"))
      (symbol (lib_id "Demo:Dual") (at 20 0 0) (unit 2) (uuid unit-b)
        (property "Reference" "U1") (property "Value" "Dual")))"#;
    let design = design(&[("root.kicad_sch", root.to_owned())]);
    assert_eq!(
        net_of(&design, "U1.1").name,
        "unconnected-(U1POWER-VIN-Pad1)"
    );
    assert_eq!(net_of(&design, "U1.2").name, "unconnected-(U1B-IO-Pad2)");
}

/// Global names do not depend on the sheet, so KiCad ranks them by priority and then
/// name, not by how deep the sheet is.
#[test]
fn equal_global_labels_name_their_net_alphabetically_whatever_the_sheet() {
    let root = format!(
        r#"(kicad_sch (uuid root) (lib_symbols {PART})
          (global_label "B_NET" (shape input) (at 0 0 0) (uuid root-b))
          {}
          (sheet (at 40 40) (size 10 10) (uuid sheet)
            (property "Sheetname" "Child") (property "Sheetfile" "child.kicad_sch")))"#,
        part("U1", 0.0, 0.0, "u1")
    );
    let child = format!(
        r#"(kicad_sch (uuid child) (lib_symbols {PART})
          (wire (pts (xy 0 0) (xy 10 0)) (uuid child-wire))
          (global_label "B_NET" (shape input) (at 0 0 0) (uuid child-b))
          (global_label "A_NET" (shape input) (at 10 0 0) (uuid child-a))
          {})"#,
        part("U2", 0.0, 0.0, "u2")
    );
    let design = design(&[("root.kicad_sch", root), ("child.kicad_sch", child)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
    assert_eq!(net_of(&design, "U1.1").name, "A_NET");
}

/// KiCad names a label's net from its unescaped text, escaped again
/// (`SCH_LABEL_BASE`, `EscapeString(…, CTX_NETNAME)`): `A/B` and `A{slash}B`
/// are one name.
#[test]
fn a_raw_slash_and_an_escaped_slash_name_one_net() {
    let root = format!(
        r#"(kicad_sch (uuid root) (lib_symbols {PART})
          (label "VPP{{slash}}MCLR" (at 0 0 0) (uuid escaped))
          (label "VPP/MCLR" (at 20 0 0) (uuid raw))
          {}
          {})"#,
        part("U1", 0.0, 0.0, "u1"),
        part("U2", 20.0, 0.0, "u2"),
    );
    let design = design(&[("root.kicad_sch", root)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
    assert_eq!(net_of(&design, "U1.1").name, "/VPP{slash}MCLR");
}

/// A sheet pin and its hierarchical label written with KiCad's `{slash}` escape
/// still bind: both name the connection by their unescaped text.
#[test]
fn an_escaped_sheet_pin_binds_its_hierarchical_label() {
    let root = format!(
        r#"(kicad_sch (uuid root) (lib_symbols {PART})
          {}
          (wire (pts (xy 0 0) (xy 40 0)) (uuid root-wire))
          (sheet (at 40 -5) (size 10 10) (uuid sheet)
            (property "Sheetname" "Child") (property "Sheetfile" "child.kicad_sch")
            (pin "P0{{slash}}A" input (at 40 0 180) (uuid sheet-pin))))"#,
        part("U1", 0.0, 0.0, "u1")
    );
    let child = format!(
        r#"(kicad_sch (uuid child) (lib_symbols {PART})
          (hierarchical_label "P0{{slash}}A" (shape input) (at 0 0 0) (uuid child-port))
          {})"#,
        part("U2", 0.0, 0.0, "u2")
    );
    let design = design(&[("root.kicad_sch", root), ("child.kicad_sch", child)]);
    assert_eq!(net_of(&design, "U1.1"), net_of(&design, "U2.1"));
}

fn part(reference: &str, x: f64, y: f64, uuid: &str) -> String {
    format!(
        r#"(symbol (lib_id "Demo:Part") (at {x} {y} 0) (uuid {uuid}-part)
          (property "Reference" "{reference}") (property "Value" "Part"))"#
    )
}

fn net_of<'a>(
    design: &'a prism_kicad_core::SchematicScalarDesignNetlist,
    terminal: &str,
) -> &'a SchematicDesignNet {
    design
        .nets
        .iter()
        .find(|net| {
            net.terminals
                .iter()
                .any(|t| format!("{}.{}", t.designator, t.pin) == terminal)
        })
        .unwrap_or_else(|| panic!("{terminal} is on a net"))
}

fn design(sheets: &[(&str, String)]) -> prism_kicad_core::SchematicScalarDesignNetlist {
    let mut buffers = vec![b"{}".to_vec()];
    let mut sources = vec![descriptor(
        "design/demo.kicad_pro",
        SourceKind::Project,
        0,
        &buffers[0],
    )];
    for (slot, (name, text)) in sheets.iter().enumerate() {
        let slot = u32::try_from(slot + 1).expect("few sheets");
        sources.push(descriptor(
            &format!("design/{name}"),
            SourceKind::Schematic,
            slot,
            text.as_bytes(),
        ));
        buffers.push(text.as_bytes().to_vec());
    }
    let bundle = SourceBundle::from_manifest(
        SourceBundleManifestA0 {
            project_path: Some("design/demo.kicad_pro".to_owned()),
            root_schematic_path: "design/root.kicad_sch".to_owned(),
            schema: "kicad_monkey.source_bundle_manifest.a0".to_owned(),
            sources,
            type_: "kicad_monkey.source_bundle_manifest".to_owned(),
            version: "a0".to_owned(),
        },
        buffers,
        SourceBundleLimits::default(),
    )
    .expect("source bundle");
    let index = SchematicBundleIndex::build(&bundle, SchematicBundleLimits::default())
        .expect("schematic index");
    build_schematic_scalar_design_nets(&index, 1, Default::default()).expect("design nets")
}

fn descriptor(path: &str, kind: SourceKind, slot: u32, bytes: &[u8]) -> SourceBundleSource {
    SourceBundleSource {
        kind,
        path: path.to_owned(),
        slot: slot.into(),
        source_bytes: bytes.len().to_string().into(),
    }
}
