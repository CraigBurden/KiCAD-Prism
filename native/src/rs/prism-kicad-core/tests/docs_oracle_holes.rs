//! Every drill centre `PcbHole::board_center` gives for the documentation-oracle
//! board matches KiCad 10.0.6's own drill files for it.
//!
//! The board (`native/parity/docs-oracle/board`) puts stock and custom
//! footprints at awkward angles on both sides, with drill offsets, oval slots
//! and pads turned inside their footprints. `export.sh` wrote the Excellon
//! files beside it; they place holes with y up, so y is negated here.

use std::path::PathBuf;

use prism_kicad_core::{PcbHoleShape, PcbLimits, PcbPoint, PcbView};

fn oracle(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../parity/docs-oracle");
    std::fs::read_to_string(root.join(path)).unwrap_or_else(|error| panic!("{path}: {error}"))
}

/// Round holes as points and slots as their midpoints, board frame (y down).
fn excellon_centres(text: &str) -> Vec<PcbPoint> {
    let coordinate = |line: &str| -> Option<PcbPoint> {
        let rest = line.trim_start_matches("G00").trim_start_matches("G01");
        let rest = rest.strip_prefix('X')?;
        let (x, y) = rest.split_once('Y')?;
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

#[test]
fn every_drill_centre_matches_kicads_drill_files() {
    let source = oracle("board/oracle.kicad_pcb");
    let view = PcbView::parse(&source, PcbLimits::default()).expect("the oracle board parses");
    let transforms: Vec<_> = view
        .footprint_transforms()
        .collect::<Result<_, _>>()
        .expect("footprint transforms");
    let mut expected = excellon_centres(&oracle("kicad/oracle-PTH.drl"));
    expected.extend(excellon_centres(&oracle("kicad/oracle-NPTH.drl")));

    let mut ours = Vec::new();
    let mut slots = 0;
    for hole in view.holes() {
        let hole = hole.expect("a hole");
        let (at, angle) = match hole.footprint_index {
            Some(index) => {
                let transform = &transforms[index];
                (
                    PcbPoint {
                        x: transform.x,
                        y: transform.y,
                    },
                    transform.angle,
                )
            }
            None => (PcbPoint { x: 0.0, y: 0.0 }, 0.0),
        };
        if hole.shape == PcbHoleShape::Oval && (hole.width - hole.height).abs() > 1e-9 {
            slots += 1;
        }
        ours.push(hole.board_center(at, angle));
    }
    assert!(slots > 0, "the oracle board has slots");
    assert_eq!(ours.len(), expected.len(), "hole count");

    // Excellon files group hits by tool, so match each of ours to the nearest
    // unused KiCad hit; every one must be within KiCad's 1 µm output precision.
    let mut unused = expected;
    let mut worst = 0.0_f64;
    for (index, centre) in ours.iter().enumerate() {
        let (nearest, distance) = unused
            .iter()
            .enumerate()
            .map(|(at, hit)| (at, (hit.x - centre.x).hypot(hit.y - centre.y)))
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .expect("a KiCad hit left");
        assert!(
            distance < 0.002,
            "hole {index} at ({:.4}, {:.4}) is {distance:.4} mm from KiCad's nearest hit",
            centre.x,
            centre.y
        );
        worst = worst.max(distance);
        unused.swap_remove(nearest);
    }
    assert!(worst < 0.002);
}

/// Gerber flashes (`D03`) as board points: format 4.6 mm, y up.
fn gerber_flashes(text: &str) -> Vec<PcbPoint> {
    text.lines()
        .filter_map(|line| line.strip_suffix("D03*"))
        .filter_map(|line| {
            let rest = line.strip_prefix('X')?;
            let (x, y) = rest.split_once('Y')?;
            Some(PcbPoint {
                x: x.parse::<f64>().ok()? / 1e6,
                y: -y.parse::<f64>().ok()? / 1e6,
            })
        })
        .collect()
}

#[test]
fn every_flashed_pad_is_at_a_copper_centre() {
    let source = oracle("board/oracle.kicad_pcb");
    let view = PcbView::parse(&source, PcbLimits::default()).expect("the oracle board parses");
    let transforms: Vec<_> = view
        .footprint_transforms()
        .collect::<Result<_, _>>()
        .expect("footprint transforms");
    let mut centres = Vec::new();
    let mut offset_pads = Vec::new();
    for pad in view.pads() {
        let pad = pad.expect("a pad");
        let transform = &transforms[pad.footprint_index];
        let centre = pad.copper_center(
            PcbPoint {
                x: transform.x,
                y: transform.y,
            },
            transform.angle,
        );
        if pad
            .drill
            .as_ref()
            .is_some_and(|drill| drill.offset.x != 0.0 || drill.offset.y != 0.0)
        {
            offset_pads.push(centre);
        }
        centres.push(centre);
    }
    assert!(!offset_pads.is_empty(), "the oracle board has offset pads");

    let mut flashes = gerber_flashes(&oracle("kicad/oracle-F_Cu.gbr"));
    flashes.extend(gerber_flashes(&oracle("kicad/oracle-B_Cu.gbr")));
    assert!(!flashes.is_empty());
    let near = |point: &PcbPoint, set: &[PcbPoint]| {
        set.iter()
            .map(|other| (other.x - point.x).hypot(other.y - point.y))
            .fold(f64::INFINITY, f64::min)
    };
    for flash in &flashes {
        let distance = near(flash, &centres);
        assert!(
            distance < 0.002,
            "KiCad flashes a pad at ({:.4}, {:.4}) but no copper centre is within {distance:.4} mm",
            flash.x,
            flash.y
        );
    }
    // Every offset pad KiCad flashed is one of ours (it would not be if the
    // offset were ignored or turned the wrong way).
    let flashed_offsets = offset_pads
        .iter()
        .filter(|centre| near(centre, &flashes) < 0.002)
        .count();
    assert!(flashed_offsets > 0, "no offset pad was flashed");
}
