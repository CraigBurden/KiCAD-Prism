//! Prism's readings of the documentation-oracle board against KiCad 10.0.6's
//! own outputs for it (`native/parity/docs-oracle`, README.md there).
//!
//! The board puts stock and custom footprints at awkward angles on both sides,
//! with drill offsets, oval slots, pads turned inside their footprints, custom
//! pads with polygon, circle and arc primitives, chamfered, round-rect,
//! trapezoid and odd-angle oval pads, and every via span. `export.sh` wrote the
//! Excellon and Gerber files (y up, so y is negated here); `ipc_finish.py` had
//! KiCad dump each pad's outline on every copper layer
//! (`kicad/pad-outlines.json`, board frame, y down).

use std::path::PathBuf;

use prism_kicad_core::{PcbFootprint, PcbHoleShape, PcbLimits, PcbPad, PcbPoint, PcbView};

/// KiCad writes coordinates to 1 µm; centres must agree to within 2 µm.
const CENTRE: f64 = 0.002;
/// KiCad approximates a pad's arcs with chords up to about 5 µm inside the
/// curve, and Prism's samples sit up to 1 µm inside it.
const OUTLINE: f64 = 0.006;

fn oracle(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../parity/docs-oracle");
    std::fs::read_to_string(root.join(path)).unwrap_or_else(|error| panic!("{path}: {error}"))
}

fn distance(a: PcbPoint, b: PcbPoint) -> f64 {
    (a.x - b.x).hypot(a.y - b.y)
}

struct Board {
    footprints: Vec<PcbFootprint>,
    pads: Vec<PcbPad>,
    view_source: String,
}

impl Board {
    fn load() -> Self {
        let source = oracle("board/oracle.kicad_pcb");
        let view = PcbView::parse(&source, PcbLimits::default()).expect("the oracle board parses");
        let footprints = view
            .footprints()
            .collect::<Result<_, _>>()
            .expect("footprints");
        let pads = view.pads().collect::<Result<_, _>>().expect("pads");
        Self {
            footprints,
            pads,
            view_source: source,
        }
    }

    fn view(&self) -> PcbView<'_> {
        PcbView::parse(&self.view_source, PcbLimits::default()).expect("the oracle board parses")
    }

    fn placement(&self, footprint_index: usize) -> (PcbPoint, f64) {
        let footprint = &self.footprints[footprint_index];
        (
            PcbPoint {
                x: footprint.at_x.unwrap_or(0.0),
                y: footprint.at_y.unwrap_or(0.0),
            },
            footprint.angle.unwrap_or(0.0),
        )
    }

    fn reference(&self, footprint_index: usize) -> &str {
        self.footprints[footprint_index]
            .reference
            .as_deref()
            .unwrap_or("")
    }
}

/// Round holes as points and routed slots as their midpoints, board frame.
fn excellon_centres(text: &str) -> Vec<PcbPoint> {
    let coordinate = |line: &str| -> Option<PcbPoint> {
        let rest = line.trim_start_matches("G00").trim_start_matches("G01");
        let (x, y) = rest.strip_prefix('X')?.split_once('Y')?;
        Some(PcbPoint {
            x: x.parse().ok()?,
            y: -y.parse::<f64>().ok()?,
        })
    };
    let mut centres = Vec::new();
    let mut slot_start: Option<PcbPoint> = None;
    for line in text.lines().map(str::trim) {
        if line.starts_with("G00") {
            slot_start = coordinate(line);
        } else if line.starts_with("G01") {
            let (Some(start), Some(end)) = (slot_start.take(), coordinate(line)) else {
                panic!("a routed slot without both ends: {line}");
            };
            centres.push(PcbPoint {
                x: (start.x + end.x) / 2.0,
                y: (start.y + end.y) / 2.0,
            });
        } else if line.starts_with('X') {
            centres.push(coordinate(line).expect("a drill hit"));
        }
    }
    centres
}

/// Match each of ours to the nearest unused KiCad hit; every one must be within
/// `CENTRE`, and nothing may be left over on either side.
fn match_all(ours: &[PcbPoint], kicad: Vec<PcbPoint>, what: &str) {
    assert_eq!(ours.len(), kicad.len(), "{what}: count");
    let mut unused = kicad;
    for centre in ours {
        let (nearest, gap) = unused
            .iter()
            .enumerate()
            .map(|(index, hit)| (index, distance(*hit, *centre)))
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .expect("a KiCad hit left");
        assert!(
            gap < CENTRE,
            "{what}: ours at ({:.4}, {:.4}) is {gap:.4} mm from KiCad's nearest",
            centre.x,
            centre.y
        );
        unused.swap_remove(nearest);
    }
}

#[test]
fn every_drill_centre_matches_kicads_drill_files() {
    let board = Board::load();
    // One file per span: plated and unplated through holes, the blind and
    // micro vias (F.Cu-In1.Cu) and the buried via (In1.Cu-In2.Cu). Backdrills
    // are checked on their own below.
    let mut expected = Vec::new();
    for file in [
        "oracle-PTH.drl",
        "oracle-NPTH.drl",
        "oracle-front-in1.drl",
        "oracle-in1-in2.drl",
    ] {
        expected.extend(excellon_centres(&oracle(&format!("kicad/{file}"))));
    }
    let mut ours = Vec::new();
    let mut slots = 0;
    for hole in board.view().holes() {
        let hole = hole.expect("a hole");
        let (at, angle) = hole
            .footprint_index
            .map_or((PcbPoint { x: 0.0, y: 0.0 }, 0.0), |index| {
                board.placement(index)
            });
        if hole.shape == PcbHoleShape::Oval && (hole.width - hole.height).abs() > 1e-9 {
            slots += 1;
        }
        ours.push(hole.board_center(at, angle));
    }
    assert!(slots > 0, "the oracle board has slots");
    match_all(&ours, expected, "drill centres");
}

#[test]
fn every_backdrill_is_a_backdrilled_via() {
    let board = Board::load();
    let kicad = excellon_centres(&oracle("kicad/oracle_Backdrills_Drill_1_2.drl"));
    let ours: Vec<PcbPoint> = board
        .view()
        .vias()
        .map(|via| via.expect("a via"))
        .filter(|via| via.backdrill.is_some())
        .map(|via| PcbPoint {
            x: via.at_x,
            y: via.at_y,
        })
        .collect();
    assert!(!ours.is_empty(), "the oracle board has a backdrilled via");
    match_all(&ours, kicad, "backdrills");
}

/// Gerber flashes (`D03`) as board points: format 4.6 mm, y up.
fn gerber_flashes(text: &str) -> Vec<PcbPoint> {
    text.lines()
        .filter_map(|line| line.strip_suffix("D03*"))
        .filter_map(|line| {
            let (x, y) = line.strip_prefix('X')?.split_once('Y')?;
            Some(PcbPoint {
                x: x.parse::<f64>().ok()? / 1e6,
                y: -y.parse::<f64>().ok()? / 1e6,
            })
        })
        .collect()
}

#[test]
fn every_copper_flash_is_a_pad_or_via_centre() {
    let board = Board::load();
    let mut centres: Vec<PcbPoint> = board
        .pads
        .iter()
        .map(|pad| {
            let (at, angle) = board.placement(pad.footprint_index);
            pad.copper_center(at, angle)
        })
        .collect();
    centres.extend(board.view().vias().map(|via| {
        let via = via.expect("a via");
        PcbPoint {
            x: via.at_x,
            y: via.at_y,
        }
    }));
    let mut flashed_offset_pads = 0;
    for layer in ["F_Cu", "In1_Cu", "In2_Cu", "B_Cu"] {
        let flashes = gerber_flashes(&oracle(&format!("kicad/oracle-{layer}.gbr")));
        assert!(!flashes.is_empty(), "{layer} has flashes");
        for flash in &flashes {
            let gap = centres
                .iter()
                .map(|centre| distance(*centre, *flash))
                .fold(f64::INFINITY, f64::min);
            assert!(
                gap < CENTRE,
                "{layer}: KiCad flashes at ({:.4}, {:.4}); no pad or via centre is within {gap:.4} mm",
                flash.x,
                flash.y
            );
        }
        // A drill offset moves the copper: an offset pad is flashed at its
        // copper centre, never at its drill.
        flashed_offset_pads += board
            .pads
            .iter()
            .filter(|pad| {
                pad.drill
                    .as_ref()
                    .is_some_and(|drill| drill.offset != PcbPoint { x: 0.0, y: 0.0 })
            })
            .filter(|pad| {
                let (at, angle) = board.placement(pad.footprint_index);
                let centre = pad.copper_center(at, angle);
                flashes
                    .iter()
                    .any(|flash| distance(*flash, centre) < CENTRE)
            })
            .count();
    }
    assert!(flashed_offset_pads > 0, "no offset pad was flashed");
}

/// One pad outline from `kicad/pad-outlines.json`.
struct KicadOutline {
    reference: String,
    pad: String,
    layer: String,
    bounds: [f64; 4],
    area: f64,
}

fn kicad_outlines() -> Vec<KicadOutline> {
    let json: serde_json::Value =
        serde_json::from_str(&oracle("kicad/pad-outlines.json")).expect("pad-outlines.json");
    let number = |value: &serde_json::Value| value.as_f64().expect("a number");
    json["pads"]
        .as_array()
        .expect("pads")
        .iter()
        .map(|record| {
            let bounds = record["box"].as_array().expect("box");
            KicadOutline {
                reference: record["reference"].as_str().expect("reference").to_owned(),
                pad: record["pad"].as_str().expect("pad").to_owned(),
                layer: record["layer"].as_str().expect("layer").to_owned(),
                bounds: [
                    number(&bounds[0]),
                    number(&bounds[1]),
                    number(&bounds[2]),
                    number(&bounds[3]),
                ],
                area: number(&record["area"]),
            }
        })
        .collect()
}

fn bounds(rings: &[Vec<PcbPoint>]) -> [f64; 4] {
    let mut out = [
        f64::INFINITY,
        f64::INFINITY,
        f64::NEG_INFINITY,
        f64::NEG_INFINITY,
    ];
    for point in rings.iter().flatten() {
        out = [
            out[0].min(point.x),
            out[1].min(point.y),
            out[2].max(point.x),
            out[3].max(point.y),
        ];
    }
    out
}

fn area_and_perimeter(ring: &[PcbPoint]) -> (f64, f64) {
    let pairs = ring.iter().zip(ring.iter().cycle().skip(1));
    let (twice, perimeter) = pairs.fold((0.0, 0.0), |(twice, perimeter), (a, b)| {
        (twice + a.x * b.y - b.x * a.y, perimeter + distance(*a, *b))
    });
    ((twice / 2.0).abs(), perimeter)
}

#[test]
fn every_pad_outline_matches_kicads() {
    let board = Board::load();
    let outlines = kicad_outlines();
    assert!(
        outlines.len() > 1000,
        "the oracle has every pad on every copper layer"
    );
    let mut checked_shapes = std::collections::BTreeSet::new();
    for kicad in &outlines {
        let pad = board
            .pads
            .iter()
            .find(|pad| {
                board.reference(pad.footprint_index) == kicad.reference && pad.number == kicad.pad
            })
            .unwrap_or_else(|| {
                panic!(
                    "{} pad {} is not on Prism's board",
                    kicad.reference, kicad.pad
                )
            });
        let (at, angle) = board.placement(pad.footprint_index);
        let rings = pad.copper_outline(at, angle);
        let label = format!(
            "{} pad {} ({}) on {}",
            kicad.reference, kicad.pad, pad.shape, kicad.layer
        );
        let ours = bounds(&rings);
        for (side, (prism, kicad)) in ["min x", "min y", "max x", "max y"]
            .iter()
            .zip(ours.iter().zip(kicad.bounds))
        {
            assert!(
                (prism - kicad).abs() < OUTLINE,
                "{label}: {side} is {prism:.4} in Prism, {kicad:.4} in KiCad"
            );
        }
        // Overlapping custom-pad rings have no single area; every other pad's
        // must match KiCad's within its arc approximation.
        if let [ring] = rings.as_slice() {
            let (area, perimeter) = area_and_perimeter(ring);
            assert!(
                (area - kicad.area).abs() < OUTLINE * perimeter,
                "{label}: area {area:.5} mm² in Prism, {:.5} in KiCad",
                kicad.area
            );
        }
        checked_shapes.insert(pad.shape.clone());
    }
    for shape in ["circle", "rect", "oval", "roundrect", "trapezoid", "custom"] {
        assert!(checked_shapes.contains(shape), "no {shape} pad was checked");
    }
}
