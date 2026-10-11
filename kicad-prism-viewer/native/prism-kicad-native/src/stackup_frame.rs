//! The stackup frame: where each physical layer sits and which face is drawn.
//!
//! The Python lane implements the same rules in
//! `pipeline/topology_compiler/stackup_frame.py`; both are held to one golden,
//! `src/testdata/stackup-frame.json`.
//!
//! The *centred* frame places the physical stack top first, centred on z = 0.
//! KiCad's *board* frame shifts it (never scales it) so the bottom copper's
//! inner face sits at 0: KiCad's board body spans the inner faces of the outer
//! copper and its outer copper sits on those faces. A layer is drawn by its
//! outward face: the top face above the board centre, the bottom face below.

/// A layer's role from its name, then its declared type.
pub fn stackup_role(name: &str, type_name: &str) -> String {
    let role = if name == "Board" {
        "dielectric".to_owned()
    } else if name == "Edge.Cuts" {
        "outline".to_owned()
    } else if name.ends_with(".Cu") {
        "copper".to_owned()
    } else if name.ends_with(".Mask") {
        "soldermask".to_owned()
    } else if name.ends_with(".Paste") {
        "paste".to_owned()
    } else if name.ends_with(".SilkS") {
        "silkscreen".to_owned()
    } else if name.ends_with(".Fab") {
        "fabrication".to_owned()
    } else if !type_name.is_empty() {
        type_name.to_owned()
    } else {
        "drawing".to_owned()
    };
    let lower = role.to_lowercase();
    match lower.as_str() {
        "solderpaste" => "paste".to_owned(),
        "core" | "prepreg" => "dielectric".to_owned(),
        _ => lower,
    }
}

/// Centre z of each layer of a physical stack, top first, centred on 0.
pub fn centred_layer_z(thicknesses: &[f64]) -> Vec<f64> {
    let values = thicknesses
        .iter()
        .map(|value| value.max(0.0))
        .collect::<Vec<_>>();
    let mut cursor = compensated_sum(&values) / 2.0;
    values
        .iter()
        .map(|thickness| {
            cursor -= thickness / 2.0;
            let centre = cursor;
            cursor -= thickness / 2.0;
            centre
        })
        .collect()
}

/// Neumaier-compensated sum, as Python's `sum()` adds floats since 3.12, so
/// both lanes put a stack's centre at the same bit pattern.
pub fn compensated_sum(values: &[f64]) -> f64 {
    let mut total = 0.0_f64;
    let mut compensation = 0.0_f64;
    for &value in values {
        let next = total + value;
        if total.abs() >= value.abs() {
            compensation += (total - next) + value;
        } else {
            compensation += (value - next) + total;
        }
        total = next;
    }
    if compensation != 0.0 && compensation.is_finite() {
        total += compensation;
    }
    total
}

/// `(offset, body_thickness)` for copper layers given as `(centred z, thickness)`.
///
/// Centred z plus `offset` is KiCad's board frame. `None` with fewer than two
/// copper layers. `body_thickness` is the gap between the outer copper layers'
/// inner faces; callers decide what a gap of zero or less means.
pub fn board_frame(copper: &[(f64, f64)]) -> Option<(f64, f64)> {
    if copper.len() < 2 {
        return None;
    }
    let bottom = copper.iter().min_by(|a, b| a.0.total_cmp(&b.0))?;
    let top = copper.iter().max_by(|a, b| a.0.total_cmp(&b.0))?;
    let bottom_inner = bottom.0 + bottom.1 / 2.0;
    let top_inner = top.0 - top.1 / 2.0;
    Some((-bottom_inner, top_inner - bottom_inner))
}

/// +1 to draw a layer's top face, -1 for its bottom face.
pub fn outward_sign(centred_z_mm: f64) -> i32 {
    if centred_z_mm >= 0.0 { 1 } else { -1 }
}

pub fn outward_face_z(z_mm: f64, thickness_mm: f64, sign: i32) -> f64 {
    z_mm + f64::from(sign) * thickness_mm / 2.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    /// The frame of one stackup, in the golden's shape.
    fn frame(stackup: &[Value]) -> Vec<Value> {
        let thicknesses = stackup
            .iter()
            .map(|layer| layer["thicknessMm"].as_f64().unwrap_or(0.0).max(0.0))
            .collect::<Vec<_>>();
        let centres = centred_layer_z(&thicknesses);
        let roles = stackup
            .iter()
            .map(|layer| {
                stackup_role(
                    layer["name"].as_str().unwrap_or(""),
                    layer["type"].as_str().unwrap_or(""),
                )
            })
            .collect::<Vec<_>>();
        let copper = centres
            .iter()
            .zip(&thicknesses)
            .zip(&roles)
            .filter(|(_, role)| role.as_str() == "copper")
            .map(|((centre, thickness), _)| (*centre, *thickness))
            .collect::<Vec<_>>();
        let offset = board_frame(&copper)
            .filter(|(_, body)| *body > 0.0)
            .map_or(0.0, |(offset, _)| offset);
        stackup
            .iter()
            .enumerate()
            .map(|(index, layer)| {
                let runtime = centres[index] + offset;
                let sign = outward_sign(centres[index]);
                json!({
                    "name": layer["name"],
                    "role": roles[index],
                    "zMm": centres[index],
                    "runtimeZMm": runtime,
                    "surfaceSign": sign,
                    "faceZMm": outward_face_z(runtime, thicknesses[index], sign),
                })
            })
            .collect()
    }

    #[test]
    fn stackup_frames_match_the_shared_golden() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("src/testdata/stackup-frame.json");
        let mut golden: Value =
            serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        let update = std::env::var_os("PRISM_UPDATE_GOLDEN").is_some();
        for case in golden["cases"].as_array_mut().unwrap() {
            let computed = frame(case["stackup"].as_array().unwrap());
            if update {
                case["frame"] = Value::from(computed);
                continue;
            }
            assert_eq!(
                Value::from(computed),
                case["frame"],
                "{}",
                case["name"].as_str().unwrap_or("")
            );
        }
        if update {
            let mut text = serde_json::to_string_pretty(&golden).unwrap();
            text.push('\n');
            std::fs::write(&path, text).unwrap();
        }
    }

    #[test]
    fn roles_follow_names_then_types() {
        assert_eq!(stackup_role("F.Cu", "signal"), "copper");
        assert_eq!(stackup_role("dielectric 1", "core"), "dielectric");
        assert_eq!(stackup_role("dielectric 2", "PrePreg"), "dielectric");
        assert_eq!(stackup_role("F.Mask", "Top Solder Mask"), "soldermask");
        assert_eq!(stackup_role("B.Paste", "Bottom Solder Paste"), "paste");
        assert_eq!(stackup_role("F.SilkS", "Top Silk Screen"), "silkscreen");
        assert_eq!(stackup_role("odd", "SolderPaste"), "paste");
        assert_eq!(stackup_role("odd", ""), "drawing");
    }
}
