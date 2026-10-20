//! `system build --parts` (`CONTRACTS.md` §8.10): the catalog parts a system
//! document references, read into what the build needs: each part's symbol
//! pins, its footprint's pads (in the footprint's frame, +y up) and its model
//! box. The staged files sit beside the parts file; a path naming `..` is
//! refused. Each file's SHA-256 must match the one the parts file states.

use crate::cmd_system::{canonical_json, read_input};
use prism_bundle::{Failure, Limits, Outcome, generator, schema};
use prism_kicad_core::{
    FootprintLimits, FootprintView, PcbGraphic, PcbGraphicKind, PcbPoint, SchematicBundleLimits,
};
use prism_system::input::{HarnessFacts, PartFacts, PartMate, PartPin};
use prism_system::placement::frames::{Courtyard, PadGeometry};
use prism_system::placement::poses::Bounds;
use serde::Deserialize;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Component, Path};

const PARTS_SCHEMA: &str = "prism.system_parts.a0";
const NM_PER_MM: f64 = 1_000_000.0;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartsFile {
    parts: Vec<PartEntry>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PartEntry {
    #[serde(rename = "ref")]
    reference: String,
    component_id: String,
    revision_id: String,
    name: String,
    #[serde(default)]
    mpn: Option<String>,
    #[serde(default)]
    symbol: Option<SymbolEntry>,
    #[serde(default)]
    footprint: Option<FileEntry>,
    #[serde(default)]
    model: Option<ModelEntry>,
    #[serde(default)]
    harness: Option<HarnessFacts>,
    #[serde(default)]
    mates_with: Vec<PartMate>,
}

#[derive(Deserialize)]
struct FileEntry {
    path: String,
    sha256: String,
}

#[derive(Deserialize)]
struct SymbolEntry {
    path: String,
    sha256: String,
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct VectorNm {
    x_nm: i64,
    y_nm: i64,
    z_nm: i64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ModelEntry {
    bounds_min: VectorNm,
    bounds_max: VectorNm,
}

fn parts_invalid(detail: String) -> Failure {
    Failure::input("input-invalid", format!("--parts {detail}"))
}

/// The parts `--parts` names, by reference, and the digest of the file's
/// canonical form for the system bundle key; empty and `None` without `--parts`.
pub fn read_parts(
    path: Option<&str>,
    limits: &Limits,
) -> Outcome<(BTreeMap<String, PartFacts>, Option<String>)> {
    let Some(path) = path else {
        return Ok((BTreeMap::new(), None));
    };
    let path = Path::new(path);
    let bytes = read_input(path, "parts", limits)?;
    let value: Value = serde_json::from_slice(&bytes)
        .map_err(|error| parts_invalid(format!("is not JSON: {error}")))?;
    schema::validate(PARTS_SCHEMA, &value).map_err(|violation| {
        parts_invalid(format!("breaks {PARTS_SCHEMA}: {}", violation.message))
    })?;
    let file: PartsFile = serde_json::from_value(value.clone())
        .map_err(|error| parts_invalid(format!("does not fit its contract: {error}")))?;
    let base = path.parent().unwrap_or(Path::new("."));
    let mut parts = BTreeMap::new();
    for entry in file.parts {
        let facts = part_facts(&entry, base, limits)?;
        parts.insert(entry.reference.clone(), facts);
    }
    let digest = generator::sha256_hex(&canonical_json(&value));
    Ok((parts, Some(digest)))
}

fn part_facts(entry: &PartEntry, base: &Path, limits: &Limits) -> Outcome<PartFacts> {
    let pins = match &entry.symbol {
        Some(symbol) => {
            let text = staged(base, &symbol.path, &symbol.sha256, &entry.reference, limits)?;
            symbol_pins(&text, &symbol.path, &symbol.name)
                .map_err(|detail| parts_invalid(format!("{}: symbol {detail}", entry.reference)))?
        }
        None => Vec::new(),
    };
    let footprint = match &entry.footprint {
        Some(footprint) => {
            let text = staged(
                base,
                &footprint.path,
                &footprint.sha256,
                &entry.reference,
                limits,
            )?;
            footprint_facts(&text).map_err(|detail| {
                parts_invalid(format!("{}: footprint {detail}", entry.reference))
            })?
        }
        None => FootprintFacts::default(),
    };
    let mm = |v: &VectorNm| [v.x_nm, v.y_nm, v.z_nm].map(|nm| nm as f64 / NM_PER_MM);
    Ok(PartFacts {
        component_id: entry.component_id.clone(),
        revision_id: entry.revision_id.clone(),
        name: entry.name.clone(),
        mpn: entry.mpn.clone().filter(|mpn| !mpn.is_empty()),
        pins,
        pads: footprint.pads,
        footprint_name: footprint.name,
        courtyard: footprint.courtyard,
        model_bounds: entry.model.as_ref().map(|model| Bounds {
            min_mm: mm(&model.bounds_min),
            max_mm: mm(&model.bounds_max),
        }),
        harness: entry.harness.clone(),
        mates_with: entry.mates_with.clone(),
    })
}

/// A staged file's text, its path kept inside the parts file's directory and its digest checked.
fn staged(
    base: &Path,
    relative: &str,
    sha256: &str,
    reference: &str,
    limits: &Limits,
) -> Outcome<String> {
    let relative = Path::new(relative);
    if relative
        .components()
        .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(parts_invalid(format!(
            "{reference}: {} leaves the parts directory",
            relative.display()
        )));
    }
    let bytes = read_input(&base.join(relative), "parts", limits)?;
    if generator::sha256_hex(&bytes) != sha256 {
        return Err(parts_invalid(format!(
            "{reference}: {} does not match its sha256",
            relative.display()
        )));
    }
    String::from_utf8(bytes)
        .map_err(|_| parts_invalid(format!("{reference}: {} is not UTF-8", relative.display())))
}

/// The symbol's pins, one per number, in the order they appear.
fn symbol_pins(text: &str, path: &str, name: &str) -> Result<Vec<PartPin>, String> {
    let symbols = prism_kicad_core::parse_symbol_library_symbols(
        text,
        path,
        SchematicBundleLimits::default(),
    )
    .map_err(|error| error.to_string())?;
    let symbol = symbols
        .iter()
        .find(|symbol| symbol.name == name)
        .ok_or_else(|| format!("{path} has no symbol {name:?}"))?;
    Ok(symbol
        .unique_pins()
        .into_iter()
        .filter(|pin| !pin.number.is_empty())
        .map(|pin| PartPin {
            number: pin.number.clone(),
            name: if pin.name == "~" {
                String::new()
            } else {
                pin.name.clone()
            },
            electrical_type: pin.electrical_type.clone(),
        })
        .collect())
}

/// What the mating-axis inference and the mapping read of a footprint.
#[derive(Default)]
struct FootprintFacts {
    pads: Vec<PadGeometry>,
    name: Option<String>,
    courtyard: Option<Courtyard>,
}

/// The footprint's pads, name and courtyard in its own frame, +y up (KiCad's
/// y points down). A pad turned a quarter has its sides swapped, as the
/// mapping reads sizes unturned. The courtyard is the box of the F/B.CrtYd
/// items' points, as the system-interface projection takes it for a board's
/// footprints.
fn footprint_facts(text: &str) -> Result<FootprintFacts, String> {
    let view = FootprintView::parse(text, FootprintLimits::default())
        .map_err(|error| error.to_string())?;
    let name = view
        .name()
        .ok()
        .map(|name| name.into_owned())
        .filter(|name| !name.is_empty());
    let mut points: Vec<(f64, f64)> = Vec::new();
    for graphic in view.graphics() {
        let graphic = graphic.map_err(|error| error.to_string())?;
        if graphic
            .layer
            .as_deref()
            .is_some_and(|layer| layer.contains("CrtYd"))
        {
            courtyard_points(&graphic, &mut points);
        }
    }
    let courtyard = points.split_first().map(|(first, rest)| {
        let (mut min, mut max) = ([first.0, -first.1], [first.0, -first.1]);
        for (x, y) in rest {
            min = [min[0].min(*x), min[1].min(-*y)];
            max = [max[0].max(*x), max[1].max(-*y)];
        }
        Courtyard {
            min_mm: min,
            max_mm: max,
        }
    });
    Ok(FootprintFacts {
        pads: footprint_pads(&view)?,
        name,
        courtyard,
    })
}

/// One courtyard item's footprint-local points (KiCad y down): lines and
/// rectangles both ends, circles their centre ± radius, arcs start, mid and
/// end, polygons every point.
fn courtyard_points(graphic: &PcbGraphic, points: &mut Vec<(f64, f64)>) {
    let at = |point: Option<PcbPoint>| point.map_or((0.0, 0.0), |point| (point.x, point.y));
    match graphic.kind {
        PcbGraphicKind::Line | PcbGraphicKind::Rect => {
            points.extend([at(graphic.start), at(graphic.end)])
        }
        PcbGraphicKind::Circle => {
            let (cx, cy) = at(graphic.center);
            let (ex, ey) = at(graphic.end);
            let radius = (ex - cx).hypot(ey - cy);
            points.extend([(cx - radius, cy - radius), (cx + radius, cy + radius)]);
        }
        PcbGraphicKind::Arc => points.extend([at(graphic.start), at(graphic.mid), at(graphic.end)]),
        PcbGraphicKind::Poly => {
            points.extend(graphic.points.iter().map(|point| (point.x, point.y)))
        }
        _ => {}
    }
}

fn footprint_pads(view: &FootprintView<'_>) -> Result<Vec<PadGeometry>, String> {
    let mut pads = Vec::new();
    for pad in view.pads() {
        let pad = pad.map_err(|error| error.to_string())?;
        let quarter = ((pad.angle.rem_euclid(180.0)) - 90.0).abs() < 1.0;
        let size = if quarter {
            [pad.size_y, pad.size_x]
        } else {
            [pad.size_x, pad.size_y]
        };
        pads.push(PadGeometry {
            pad: pad.number.clone(),
            position_mm: [pad.at_x, -pad.at_y],
            size_mm: Some(size),
            shape: Some(pad.shape.clone()),
            tht: Some(pad.kind == "thru_hole" || pad.kind == "np_thru_hole"),
        });
    }
    Ok(pads)
}
