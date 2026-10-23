//! The artwork's board geometry for the documentation-oracle board against
//! KiCad 10.0.6's own outputs for it (`native/parity/docs-oracle`).
//!
//! The board outline and cutouts the drawings use are checked against KiCad's
//! Edge.Cuts Gerber, and each footprint's pad extent (the body the drawings
//! fall back to without a 3D model) against the union of KiCad's pad outlines
//! (`kicad/pad-outlines.json`, written by `ipc_finish.py`).

use std::collections::BTreeMap;
use std::path::PathBuf;

use prism_artwork::artwork::geometry::{Bounds, Point, board_geometry};
use prism_kicad_core::{PcbLimits, PcbView};

/// KiCad writes coordinates to 1 µm.
const EDGE: f64 = 0.002;
/// KiCad approximates a pad's arcs with chords up to about 5 µm inside them.
const OUTLINE: f64 = 0.006;

fn oracle(path: &str) -> String {
    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../parity/docs-oracle");
    std::fs::read_to_string(root.join(path)).unwrap_or_else(|error| panic!("{path}: {error}"))
}

fn board() -> String {
    oracle("board/oracle.kicad_pcb")
}

/// One drawn Edge.Cuts stroke, board frame (y down): its ends and its extent.
struct Stroke {
    ends: [Point; 2],
    bounds: Bounds,
}

/// The extent of the arc around `centre` from `start` to `end`, clockwise when
/// `clockwise` (Gerber frame, y up), including the axis points it passes.
fn arc_bounds(centre: Point, start: Point, end: Point, clockwise: bool) -> Bounds {
    let radius = (start.x - centre.x).hypot(start.y - centre.y);
    let angle = |p: Point| {
        (p.y - centre.y)
            .atan2(p.x - centre.x)
            .to_degrees()
            .rem_euclid(360.0)
    };
    let (from, to) = (angle(start), angle(end));
    // Counter-clockwise sweep from `a` to `b`; a full circle when they meet.
    let ccw = |a: f64, b: f64| {
        let sweep = (b - a).rem_euclid(360.0);
        if sweep < 1e-9 { 360.0 } else { sweep }
    };
    let (base, sweep) = if clockwise {
        (to, ccw(to, from))
    } else {
        (from, ccw(from, to))
    };
    let mut bounds = Bounds::empty();
    bounds.include(start);
    bounds.include(end);
    for axis in [0.0_f64, 90.0, 180.0, 270.0] {
        if (axis - base).rem_euclid(360.0) <= sweep {
            let (sin, cos) = axis.to_radians().sin_cos();
            bounds.include(Point {
                x: centre.x + radius * cos,
                y: centre.y + radius * sin,
            });
        }
    }
    bounds
}

fn flip(bounds: Bounds) -> Bounds {
    Bounds {
        min_x: bounds.min_x,
        min_y: -bounds.max_y,
        max_x: bounds.max_x,
        max_y: -bounds.min_y,
    }
}

/// The strokes of KiCad's Edge.Cuts Gerber (format 4.6 mm).
fn edge_strokes(text: &str) -> Vec<Stroke> {
    let value = |line: &str, key: char| -> Option<f64> {
        let start = line.find(key)? + 1;
        let digits: String = line[start..]
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '-')
            .collect();
        Some(digits.parse::<f64>().ok()? / 1e6)
    };
    let mut strokes = Vec::new();
    let mut current = Point { x: 0.0, y: 0.0 };
    let mut mode = "G01";
    for line in text.lines().map(str::trim) {
        if let Some(code) = ["G01", "G02", "G03"]
            .iter()
            .find(|code| line.starts_with(**code))
        {
            mode = code;
        }
        let Some(rest) = line.strip_prefix('X') else {
            continue;
        };
        let to = Point {
            x: value(line, 'X').expect("x"),
            y: value(line, 'Y').expect("y"),
        };
        if rest.ends_with("D01*") {
            let bounds = if mode == "G01" {
                let mut bounds = Bounds::empty();
                bounds.include(current);
                bounds.include(to);
                bounds
            } else {
                let centre = Point {
                    x: current.x + value(line, 'I').unwrap_or(0.0),
                    y: current.y + value(line, 'J').unwrap_or(0.0),
                };
                arc_bounds(centre, current, to, mode == "G02")
            };
            let board = |p: Point| Point { x: p.x, y: -p.y };
            strokes.push(Stroke {
                ends: [board(current), board(to)],
                bounds: flip(bounds),
            });
        }
        current = to;
    }
    strokes
}

/// Strokes joined end to end, as one extent per closed contour.
fn contours(strokes: &[Stroke]) -> Vec<Bounds> {
    let key = |p: Point| ((p.x * 1e3).round() as i64, (p.y * 1e3).round() as i64);
    let mut parent: Vec<usize> = (0..strokes.len()).collect();
    fn root(parent: &mut [usize], mut at: usize) -> usize {
        while parent[at] != at {
            parent[at] = parent[parent[at]];
            at = parent[at];
        }
        at
    }
    let mut owner: BTreeMap<(i64, i64), usize> = BTreeMap::new();
    for (index, stroke) in strokes.iter().enumerate() {
        for end in stroke.ends {
            if let Some(&other) = owner.get(&key(end)) {
                let (a, b) = (root(&mut parent, index), root(&mut parent, other));
                parent[a] = b;
            } else {
                owner.insert(key(end), index);
            }
        }
    }
    let mut groups: BTreeMap<usize, Bounds> = BTreeMap::new();
    for (index, stroke) in strokes.iter().enumerate() {
        let group = root(&mut parent, index);
        groups
            .entry(group)
            .or_insert_with(Bounds::empty)
            .include_bounds(stroke.bounds);
    }
    groups.into_values().collect()
}

fn assert_bounds(label: &str, prism: Bounds, kicad: Bounds, tolerance: f64) {
    for (side, ours, theirs) in [
        ("min x", prism.min_x, kicad.min_x),
        ("min y", prism.min_y, kicad.min_y),
        ("max x", prism.max_x, kicad.max_x),
        ("max y", prism.max_y, kicad.max_y),
    ] {
        assert!(
            (ours - theirs).abs() < tolerance,
            "{label}: {side} is {ours:.4} in Prism, {theirs:.4} in KiCad"
        );
    }
}

#[test]
fn the_board_outline_and_cutouts_match_kicads_edge_cuts() {
    let source = board();
    let view = PcbView::parse(&source, PcbLimits::default()).expect("the oracle board parses");
    let geometry = board_geometry(&view).expect("board geometry");
    let mut kicad = contours(&edge_strokes(&oracle("kicad/oracle-Edge_Cuts.gbr")));
    kicad.sort_by(|a, b| (b.width() * b.height()).total_cmp(&(a.width() * a.height())));
    assert_eq!(
        kicad.len(),
        3,
        "KiCad's Edge.Cuts: the outline and two cutouts"
    );

    assert_bounds("outline", Bounds::of_ring(&geometry.outer), kicad[0], EDGE);
    assert_bounds(
        "outline (line centres)",
        geometry.outline_bounds,
        kicad[0],
        EDGE,
    );
    assert_eq!(geometry.cutouts.len(), 2, "Prism's cutouts");
    for cutout in &kicad[1..] {
        let ours = geometry
            .cutouts
            .iter()
            .map(|ring| Bounds::of_ring(ring))
            .min_by(|a, b| {
                let gap =
                    |x: &Bounds| (x.min_x - cutout.min_x).abs() + (x.min_y - cutout.min_y).abs();
                gap(a).total_cmp(&gap(b))
            })
            .expect("a cutout");
        assert_bounds("cutout", ours, *cutout, EDGE);
    }
}

#[test]
fn every_footprint_pad_extent_is_kicads_pad_copper() {
    let source = board();
    let view = PcbView::parse(&source, PcbLimits::default()).expect("the oracle board parses");
    let geometry = board_geometry(&view).expect("board geometry");
    let references: Vec<String> = view
        .footprints()
        .map(|footprint| {
            footprint
                .expect("a footprint")
                .reference
                .unwrap_or_default()
        })
        .collect();

    let json: serde_json::Value =
        serde_json::from_str(&oracle("kicad/pad-outlines.json")).expect("pad-outlines.json");
    let mut kicad: BTreeMap<String, Bounds> = BTreeMap::new();
    for record in json["pads"].as_array().expect("pads") {
        let corner = |index: usize| record["box"][index].as_f64().expect("a box");
        let bounds = kicad
            .entry(record["reference"].as_str().expect("reference").to_owned())
            .or_insert_with(Bounds::empty);
        bounds.include(Point {
            x: corner(0),
            y: corner(1),
        });
        bounds.include(Point {
            x: corner(2),
            y: corner(3),
        });
    }

    assert_eq!(
        geometry.pad_envelopes.len(),
        kicad.len(),
        "footprints with pads"
    );
    for (index, envelope) in &geometry.pad_envelopes {
        let reference = &references[*index];
        let theirs = kicad
            .get(reference)
            .unwrap_or_else(|| panic!("{reference} has no pads in KiCad's outlines"));
        assert_bounds(
            &format!("{reference} pad extent"),
            *envelope,
            *theirs,
            OUTLINE,
        );
    }
}

/// A rectangle whose sides miss their corners by `gap` mm at two joints.
fn gapped_rectangle(gap: f64) -> String {
    let line = |x1: f64, y1: f64, x2: f64, y2: f64, id: u32| {
        format!(
            "(gr_line (start {x1} {y1}) (end {x2} {y2}) (stroke (width 0.05) (type default)) \
             (layer \"Edge.Cuts\") (uuid \"00000000-0000-0000-0000-00000000000{id}\"))"
        )
    };
    format!(
        "(kicad_pcb (version 20240108) (generator \"pcbnew\") (generator_version \"8.0\") \
         (general (thickness 1.6)) (paper \"A4\") (layers (0 \"F.Cu\" signal) (31 \"B.Cu\" signal) \
         (44 \"Edge.Cuts\" user)) {} {} {} {})",
        line(0.0, 0.0, 50.0 + gap, 0.0, 1),
        line(50.0, 0.0, 50.0, 30.0, 2),
        line(50.0, 30.0, 0.0, 30.0 + gap, 3),
        line(0.0, 30.0, 0.0, 0.0, 4),
    )
}

#[test]
fn an_outline_kicad_closes_within_its_chaining_epsilon_closes_here() {
    // EDA-04903's outline has two 25 nm gaps; KiCad accepts it, and the
    // exact-nanometre join this crate used to do refused the board.
    for gap in [0.000_025, 0.009] {
        let source = gapped_rectangle(gap);
        let view = PcbView::parse(&source, PcbLimits::default()).expect("the board parses");
        let geometry = board_geometry(&view).expect("board geometry");
        let bounds = Bounds::of_ring(&geometry.outer);
        assert!(
            (bounds.width() - 50.0).abs() < 0.02 && (bounds.height() - 30.0).abs() < 0.02,
            "a {gap} mm gap closes into the 50 x 30 outline, got {bounds:?}"
        );
    }
    let source = gapped_rectangle(0.011);
    let view = PcbView::parse(&source, PcbLimits::default()).expect("the board parses");
    let geometry = board_geometry(&view).expect("board geometry");
    assert!(
        geometry.outer.is_empty(),
        "an 11 µm gap is open in KiCad too"
    );
}
