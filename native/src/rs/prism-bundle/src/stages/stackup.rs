//! KiCad's implicit stackup.
//!
//! A board whose file has no `(stackup ...)` block still has a stackup:
//! KiCad uses its default one, and Board Setup shows it (35 µm copper on
//! every layer, 10 µm solder mask, dielectrics sharing the rest of the
//! stated board thickness, and the silkscreen and paste layers the board's
//! layer table enables). The materializer reads only what the file
//! states, so such a board would reach an engine with no copper thickness.
//! Before materializing, the build writes the stackup KiCad would write
//! when that board's Board Setup is saved, and the manifest records a
//! `kicad-default-stackup` warning (sim-adr-0010: the value is what KiCad
//! states, and the bundle says where it came from).

/// KiCad's default copper thickness, millimetres.
pub const COPPER_MM: f64 = 0.035;
/// KiCad's default solder mask thickness, millimetres.
pub const MASK_MM: f64 = 0.01;
/// KiCad's default board thickness when `(general (thickness ...))` is absent.
pub const BOARD_MM: f64 = 1.6;

/// The board text with KiCad's default stackup written into `(setup ...)`,
/// or `None` when the board already states a stackup (or cannot take one).
#[must_use]
pub fn with_default_stackup(board: &str) -> Option<String> {
    if board.contains("(stackup") {
        return None;
    }
    let copper = copper_layers(board)?;
    if copper.len() < 2 {
        return None;
    }
    let total = board_thickness(board).unwrap_or(BOARD_MM);
    let gaps = copper.len() - 1;
    let dielectric = (total - COPPER_MM * copper.len() as f64 - 2.0 * MASK_MM) / gaps as f64;
    if dielectric.is_nan() || dielectric <= 0.0 {
        return None;
    }
    let technical = technical_layers(board);
    let mut block = String::from("\n\t\t(stackup\n");
    // KiCad's default stackup carries the board's silkscreen and paste layers
    // too (thickness unstated); without them the materializer drops both.
    push_technical(&mut block, &technical, &FRONT_TECHNICAL);
    block.push_str(&format!(
        "\t\t\t(layer \"F.Mask\" (type \"Top Solder Mask\") (thickness {MASK_MM}))\n"
    ));
    push_copper(&mut block, &copper, dielectric);
    block.push_str(&format!(
        "\t\t\t(layer \"B.Mask\" (type \"Bottom Solder Mask\") (thickness {MASK_MM}))\n"
    ));
    push_technical(&mut block, &technical, &BACK_TECHNICAL);
    block.push_str("\t\t\t(copper_finish \"None\")\n\t\t\t(dielectric_constraints no)\n\t\t)");
    let at = board.find("(setup")? + "(setup".len();
    Some(format!("{}{}{}", &board[..at], block, &board[at..]))
}

/// Silkscreen and paste above the front mask, outermost first.
const FRONT_TECHNICAL: [(&str, &str); 2] = [
    ("F.SilkS", "Top Silk Screen"),
    ("F.Paste", "Top Solder Paste"),
];
/// Paste and silkscreen below the back mask, innermost first.
const BACK_TECHNICAL: [(&str, &str); 2] = [
    ("B.Paste", "Bottom Solder Paste"),
    ("B.SilkS", "Bottom Silk Screen"),
];

/// The `layers` the board's layer table has, as stackup entries.
fn push_technical(block: &mut String, present: &[String], layers: &[(&str, &str)]) {
    for (name, kind) in layers {
        if present.iter().any(|layer| layer == name) {
            block.push_str(&format!("\t\t\t(layer \"{name}\" (type \"{kind}\"))\n"));
        }
    }
}

/// Copper layers front to back with a dielectric of `dielectric` mm between each pair.
fn push_copper(block: &mut String, copper: &[String], dielectric: f64) {
    let gaps = copper.len() - 1;
    for (index, name) in copper.iter().enumerate() {
        block.push_str(&format!(
            "\t\t\t(layer \"{name}\" (type \"copper\") (thickness {COPPER_MM}))\n"
        ));
        if index < gaps {
            // KiCad alternates prepreg and core outward from a central core.
            let kind = if gaps == 1 || index % 2 == 1 {
                "core"
            } else {
                "prepreg"
            };
            block.push_str(&format!(
                "\t\t\t(layer \"dielectric {}\" (type \"{kind}\") (thickness {}) (material \"FR4\") (epsilon_r 4.5) (loss_tangent 0.02))\n",
                index + 1,
                round_um(dielectric),
            ));
        }
    }
}

fn round_um(mm: f64) -> f64 {
    (mm * 1e6).round() / 1e6
}

/// Copper layer names of the board's layer table, front to back.
fn copper_layers(board: &str) -> Option<Vec<String>> {
    let table = top_level_block(board, "(layers")?;
    let mut inner: Vec<(u32, String)> = Vec::new();
    let (mut front, mut back) = (false, false);
    for name in table.split('"').skip(1).step_by(2) {
        match name {
            "F.Cu" => front = true,
            "B.Cu" => back = true,
            _ => {
                if let Some(number) = name
                    .strip_prefix("In")
                    .and_then(|rest| rest.strip_suffix(".Cu"))
                {
                    inner.push((number.parse().ok()?, name.to_owned()));
                }
            }
        }
    }
    if !(front && back) {
        return None;
    }
    inner.sort();
    let mut layers = vec!["F.Cu".to_owned()];
    layers.extend(inner.into_iter().map(|(_, name)| name));
    layers.push("B.Cu".to_owned());
    Some(layers)
}

/// The silkscreen and paste layers the board's layer table names, by their
/// canonical names (KiCad 6+ tables give the canonical name first).
fn technical_layers(board: &str) -> Vec<String> {
    let Some(table) = top_level_block(board, "(layers") else {
        return Vec::new();
    };
    table
        .split('"')
        .skip(1)
        .step_by(2)
        .filter(|name| matches!(*name, "F.SilkS" | "B.SilkS" | "F.Paste" | "B.Paste"))
        .map(str::to_owned)
        .collect()
}

/// `(general (thickness N))`, millimetres.
fn board_thickness(board: &str) -> Option<f64> {
    let general = top_level_block(board, "(general")?;
    let rest = &general[general.find("(thickness")? + "(thickness".len()..];
    rest.trim_start()
        .split(|c: char| c == ')' || c.is_whitespace())
        .next()?
        .parse()
        .ok()
}

/// The first `open ... )` block, matched by parentheses (quoted text skipped).
fn top_level_block<'a>(board: &'a str, open: &str) -> Option<&'a str> {
    let start = board.find(open)?;
    let mut depth = 0usize;
    let mut quoted = false;
    let mut escaped = false;
    for (offset, c) in board[start..].char_indices() {
        if quoted {
            match (escaped, c) {
                (true, _) => escaped = false,
                (false, '\\') => escaped = true,
                (false, '"') => quoted = false,
                _ => {}
            }
            continue;
        }
        match c {
            '"' => quoted = true,
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(&board[start..=start + offset]);
                }
            }
            _ => {}
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    const TWO_LAYER: &str = "(kicad_pcb (version 20260206)\n\t(general\n\t\t(thickness 1.6)\n\t)\n\t(layers\n\t\t(0 \"F.Cu\" signal)\n\t\t(2 \"B.Cu\" signal)\n\t\t(9 \"F.Adhes\" user \"F.Adhesive\")\n\t)\n\t(setup\n\t\t(pad_to_mask_clearance 0)\n\t)\n)\n";

    #[test]
    fn a_board_without_a_stackup_gets_kicads_default() {
        let text = with_default_stackup(TWO_LAYER).unwrap();
        assert!(text.contains("(layer \"F.Cu\" (type \"copper\") (thickness 0.035))"));
        assert!(text.contains("(layer \"B.Cu\" (type \"copper\") (thickness 0.035))"));
        // 1.6 - 2 x 0.035 copper - 2 x 0.01 mask
        assert!(
            text.contains("(layer \"dielectric 1\" (type \"core\") (thickness 1.51)"),
            "{text}"
        );
        assert!(text.find("(stackup").unwrap() > text.find("(setup").unwrap());
    }

    #[test]
    fn the_default_carries_the_boards_silkscreen_and_paste() {
        // As KiCad saves it: silkscreen, paste and mask outside the copper, front to back.
        let board = TWO_LAYER.replace(
            "(9 \"F.Adhes\" user \"F.Adhesive\")",
            "(13 \"F.Paste\" user)\n\t\t(15 \"B.Paste\" user)\n\t\t(5 \"F.SilkS\" user \"F.Silkscreen\")\n\t\t(7 \"B.SilkS\" user \"B.Silkscreen\")",
        );
        let text = with_default_stackup(&board).unwrap();
        let at = |name: &str| text.find(&format!("(layer \"{name}\"")).unwrap();
        assert!(
            text.contains("(layer \"F.SilkS\" (type \"Top Silk Screen\"))"),
            "{text}"
        );
        assert!(text.contains("(layer \"B.Paste\" (type \"Bottom Solder Paste\"))"));
        let order = [
            "F.SilkS",
            "F.Paste",
            "F.Mask",
            "F.Cu",
            "dielectric 1",
            "B.Cu",
            "B.Mask",
            "B.Paste",
            "B.SilkS",
        ];
        assert!(
            order.windows(2).all(|pair| at(pair[0]) < at(pair[1])),
            "{text}"
        );
        // A board without them gets none (TWO_LAYER enables neither).
        assert!(!with_default_stackup(TWO_LAYER).unwrap().contains("SilkS"));
    }

    #[test]
    fn inner_layers_follow_their_number_and_a_stated_stackup_is_kept() {
        let four = TWO_LAYER.replace(
            "(2 \"B.Cu\" signal)",
            "(2 \"B.Cu\" signal)\n\t\t(6 \"In2.Cu\" signal)\n\t\t(4 \"In1.Cu\" signal)",
        );
        let text = with_default_stackup(&four).unwrap();
        let at = |name: &str| text.find(&format!("(layer \"{name}\"")).unwrap();
        assert!(
            at("F.Cu") < at("In1.Cu") && at("In1.Cu") < at("In2.Cu") && at("In2.Cu") < at("B.Cu")
        );
        assert_eq!(with_default_stackup(&text), None);
    }
}
