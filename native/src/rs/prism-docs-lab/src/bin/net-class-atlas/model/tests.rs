use super::*;

fn point(x: f64, y: f64) -> Point {
    Point { x, y }
}

fn row(name: &str, length_mm: f64, power: bool) -> NetRow {
    NetRow {
        name: name.to_owned(),
        length_mm,
        vias: 0,
        layers: vec!["F.Cu".to_owned()],
        zone_layers: false,
        via_spans: Vec::new(),
        pads: 1,
        power,
    }
}

fn empty_drawing() -> Drawing {
    let mut bounds = Bounds::empty();
    for corner in [point(0.0, 0.0), point(40.0, 30.0)] {
        bounds.include(corner);
    }
    Drawing {
        outline: vec![
            point(0.0, 0.0),
            point(40.0, 0.0),
            point(40.0, 30.0),
            point(0.0, 30.0),
        ],
        cutouts: Vec::new(),
        bounds,
        traces: Vec::new(),
        vias: Vec::new(),
        zones: Vec::new(),
        footprints: Vec::new(),
    }
}

#[test]
fn power_names_and_pin_shares_group_together() {
    let mut rows: Vec<NetRow> = [
        "GND",
        "AGND",
        "DGND",
        "GND_SENSE",
        "VCCRAM",
        "VBUS_SENSE",
        "+3V3",
    ]
    .into_iter()
    .map(|name| row(name, 1.0, is_power_name(name)))
    .collect();
    // A net whose name says nothing but whose terminals are mostly power
    // pins is flagged by `net_inputs`; grouping trusts that flag.
    rows.push(row("/Type C/VCONN", 2.0, true));
    rows.extend((0..40).map(|index| {
        row(
            &format!("/Sheet/N{index}"),
            index as f64 + 1.0,
            is_power_name("N"),
        )
    }));
    let groups = split_groups(rows, &empty_drawing());
    assert_eq!(groups[0].name, "Power and ground");
    assert_eq!(groups[0].nets.len(), 8);
    assert!(
        groups[0]
            .nets
            .iter()
            .all(|net| net.power || net.name == "/Type C/VCONN")
    );
}

#[test]
fn a_split_class_groups_by_schematic_sheet_then_other() {
    let rows = vec![
        row("/Debugger/TCK", 4.0, false),
        row("/Debugger/TMS", 3.0, false),
        row("/FPGA Bank 8 and Configuration Flash/CS", 9.0, false),
        row("/FPGA Bank 8 and Configuration Flash/DONE", 1.0, false),
        row("LOCAL", 8.0, false),
    ];
    let groups = split_groups(rows, &empty_drawing());
    let names: Vec<&str> = groups.iter().map(|group| group.name.as_str()).collect();
    assert_eq!(
        names,
        [
            "/FPGA Bank 8 and Configuration Flash/",
            "/Debugger/",
            "Other"
        ],
        "sheets are longest first and Other is last"
    );
    assert_eq!(groups[0].nets.len(), 2);
    assert_eq!(groups[1].nets.len(), 2);
    assert_eq!(groups[2].nets.len(), 1);
}

#[test]
fn a_sheet_path_is_everything_before_the_leaf() {
    assert_eq!(sheet_path("/Debugger/TCK").as_deref(), Some("/Debugger/"));
    assert_eq!(sheet_path("/A/B/N").as_deref(), Some("/A/B/"));
    assert_eq!(sheet_path("/N"), None);
    assert_eq!(sheet_path("GND"), None);
}

#[test]
fn small_classes_stay_one_drawing() {
    let drawing = empty_drawing();
    let copper = copper();
    let nets = vec![
        NetInput {
            name: "A".to_owned(),
            class: "Thin".to_owned(),
            length_mm: 2.0,
            vias: 0,
            power: false,
        },
        NetInput {
            name: "B".to_owned(),
            class: "Thin".to_owned(),
            length_mm: 1.0,
            vias: 0,
            power: false,
        },
    ];
    let section = section("Thin".to_owned(), nets, &drawing, &copper).expect("a section");
    assert!(!section.split);
    assert_eq!(section.groups.len(), 1);
    assert_eq!(section.groups[0].name, "");
}

/// The copper stack order the layer column reads.
fn copper() -> Vec<String> {
    ["F.Cu", "In1.Cu", "In2.Cu", "B.Cu"]
        .into_iter()
        .map(str::to_owned)
        .collect()
}

fn trace(net: &str, layer: &str, from: f64, to: f64) -> Trace {
    Trace {
        net: net.to_owned(),
        layer: layer.to_owned(),
        width: 0.2,
        points: vec![point(from, 5.0), point(to, 5.0)],
    }
}

/// A through via's `usedLayers` names every copper layer it passes, which is
/// not what the net is routed on: the column must read the tracks instead.
#[test]
fn a_net_lists_the_layers_its_tracks_use_and_its_vias_spans() {
    let mut drawing = empty_drawing();
    drawing.traces = vec![trace("N", "F.Cu", 1.0, 5.0), trace("N", "B.Cu", 5.0, 9.0)];
    drawing.vias = vec![Via {
        net: "N".to_owned(),
        at: point(5.0, 5.0),
        size: 0.6,
        drill: 0.3,
        layers: vec!["F.Cu".to_owned(), "B.Cu".to_owned()],
    }];
    let nets = vec![NetInput {
        name: "N".to_owned(),
        class: "Default".to_owned(),
        length_mm: 8.0,
        vias: 1,
        power: false,
    }];
    let section = section("Default".to_owned(), nets, &drawing, &copper()).expect("a section");
    let row = &section.groups[0].nets[0];
    assert_eq!(row.layers, ["F.Cu", "B.Cu"]);
    assert!(!row.zone_layers);
    assert_eq!(row.vias, 1, "the via count is unchanged");
    assert_eq!(
        row.via_spans,
        [ViaSpan {
            from: "F.Cu".to_owned(),
            to: "B.Cu".to_owned(),
            count: 1,
        }]
    );
}

#[test]
fn a_net_with_only_a_zone_lists_the_zone_layer() {
    let mut drawing = empty_drawing();
    drawing.zones = vec![Zone {
        net: "GND".to_owned(),
        layer: "B.Cu".to_owned(),
        rings: vec![vec![
            point(0.0, 0.0),
            point(4.0, 0.0),
            point(4.0, 4.0),
            point(0.0, 4.0),
        ]],
        filled: true,
    }];
    // A pad keeps the row in the table: a net with nothing but a zone has no
    // routing to report and the class drops it.
    drawing.footprints = vec![Footprint {
        index: 0,
        reference: "C1".to_owned(),
        side: Side::Top,
        x: 2.0,
        y: 2.0,
        angle: 0.0,
        pads: vec![Pad {
            net: "GND".to_owned(),
            layers: vec!["B.Cu".to_owned()],
            x: 0.0,
            y: 0.0,
            angle: 0.0,
            shape: PadShape::Rect {
                width: 1.0,
                height: 1.0,
            },
        }],
        body: Body::Envelope(Vec::new()),
        body_bounds: Bounds::empty(),
        nets: BTreeSet::from(["GND".to_owned()]),
    }];
    let nets = vec![NetInput {
        name: "GND".to_owned(),
        class: "Default".to_owned(),
        length_mm: 0.0,
        vias: 0,
        power: true,
    }];
    let section = section("Default".to_owned(), nets, &drawing, &copper()).expect("a section");
    let row = &section.groups[0].nets[0];
    assert_eq!(row.layers, ["B.Cu"]);
    assert!(row.zone_layers, "a zone layer is marked as such");
    assert!(row.via_spans.is_empty());
}

#[test]
fn zone_fills_open_only_when_they_cover_less_than_a_quarter() {
    let mut drawing = empty_drawing();
    drawing.zones = vec![Zone {
        net: "GND".to_owned(),
        layer: "F.Cu".to_owned(),
        rings: vec![vec![
            point(0.0, 0.0),
            point(10.0, 0.0),
            point(10.0, 10.0),
            point(0.0, 10.0),
        ]],
        filled: true,
    }];
    let small = net_group(String::new(), vec![row("GND", 0.0, true)], &drawing);
    assert!(small.has_fill);
    assert!(small.fill_ratio < 0.25);
    assert!(small.zones_default());

    drawing.zones[0].rings = vec![drawing.outline.clone()];
    let large = net_group(String::new(), vec![row("GND", 0.0, true)], &drawing);
    assert!((large.fill_ratio - 1.0).abs() < 0.000_1);
    assert!(!large.zones_default());
}

#[test]
fn a_polygon_area_is_square_millimetres() {
    let ring = [
        point(0.0, 0.0),
        point(4.0, 0.0),
        point(4.0, 3.0),
        point(0.0, 3.0),
    ];
    assert!((polygon_area(&ring) - 12.0).abs() < 1.0e-9);
    assert_eq!(polygon_area(&ring[..2]), 0.0);
}
