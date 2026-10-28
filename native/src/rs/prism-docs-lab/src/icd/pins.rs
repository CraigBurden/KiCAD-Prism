//! The pinout's derived facts: natural pin order, the power/ground test, the
//! connects-to summary and the electrical type's label.
//!
//! Every function here is a plain value: no board, no bundle, so the rules can
//! be tested on small synthetic inputs.

use std::cmp::Ordering;
use std::collections::BTreeMap;

/// Compare two pin numbers naturally: digit runs compare as numbers, so
/// `2 < 10` and `A2 < A10`.
pub fn natural_cmp(left: &str, right: &str) -> Ordering {
    let left = left.as_bytes();
    let right = right.as_bytes();
    let mut i = 0;
    let mut j = 0;
    while i < left.len() && j < right.len() {
        if left[i].is_ascii_digit() && right[j].is_ascii_digit() {
            let (next_left, next_right, order) = compare_digits(left, right, i, j);
            i = next_left;
            j = next_right;
            if order != Ordering::Equal {
                return order;
            }
            continue;
        }
        let order = left[i]
            .to_ascii_lowercase()
            .cmp(&right[j].to_ascii_lowercase());
        if order != Ordering::Equal {
            return order;
        }
        i += 1;
        j += 1;
    }
    left.len().cmp(&right.len())
}

/// Compare the digit runs at `i` and `j`, returning both ends and the order.
fn compare_digits(left: &[u8], right: &[u8], i: usize, j: usize) -> (usize, usize, Ordering) {
    let start_left = i;
    let start_right = j;
    let mut end_left = i;
    while end_left < left.len() && left[end_left].is_ascii_digit() {
        end_left += 1;
    }
    let mut end_right = j;
    while end_right < right.len() && right[end_right].is_ascii_digit() {
        end_right += 1;
    }
    let number_left = trim_zeros(&left[start_left..end_left]);
    let number_right = trim_zeros(&right[start_right..end_right]);
    let order = number_left
        .len()
        .cmp(&number_right.len())
        .then_with(|| number_left.cmp(number_right));
    (end_left, end_right, order)
}

fn trim_zeros(digits: &[u8]) -> &[u8] {
    let mut start = 0;
    while start + 1 < digits.len() && digits[start] == b'0' {
        start += 1;
    }
    &digits[start..]
}

/// The leaf of a hierarchical net name: `/A/B/D+` is `D+`.
pub fn net_leaf(name: &str) -> &str {
    name.rsplit('/').next().unwrap_or(name)
}

/// KiCad escapes `/`, `{`, `}` and a space in net names; undo the common ones.
pub fn net_text(name: &str) -> String {
    name.replace("{slash}", "/")
        .replace("{space}", " ")
        .replace("{comma}", ",")
        .replace("{colon}", ":")
        .replace("{dollar}", "$")
        .replace("{tilde}", "~")
}

/// The label a pinout prints for a schematic pin type.
pub fn pin_type_label(raw: Option<&str>) -> &'static str {
    const LABELS: [(&str, &str); 11] = [
        ("INPUT", "In"),
        ("OUTPUT", "Out"),
        ("BIDIRECTIONAL", "Bidir"),
        ("TRI_STATE", "Tri-state"),
        ("PASSIVE", "Passive"),
        ("FREE", "Free"),
        ("POWER_IN", "Power in"),
        ("POWER_OUT", "Power out"),
        ("OPEN_COLLECTOR", "Open collector"),
        ("OPEN_EMITTER", "Open emitter"),
        ("NO_CONNECT", "NC"),
    ];
    let Some(raw) = raw else {
        return "\u{2014}";
    };
    LABELS
        .iter()
        .find(|(name, _)| *name == raw)
        .map_or("\u{2014}", |(_, label)| *label)
}

/// True when a row is on a power or ground net, or carries a power pin.
///
/// The test is the net class, then the pin type, then the net's leaf name:
/// grounds (`GND`, `AGND`, …), supply names (`VCC`, `VBUS`, `+3V3`, `3V3`,
/// `VDD`, …) and rails written `+5V`/`-12V`.
pub fn is_power_net(name: &str, class: &str, pin_type: Option<&str>) -> bool {
    if matches!(pin_type, Some("POWER_IN" | "POWER_OUT")) {
        return true;
    }
    if class.to_ascii_lowercase().contains("power") {
        return true;
    }
    let upper = net_leaf(name).to_ascii_uppercase();
    if upper.is_empty() {
        return false;
    }
    const SUPPLY: [&str; 14] = [
        "GND", "VBUS", "VBAT", "VSYS", "VCC", "VDD", "VSS", "VEE", "VIN", "VOUT", "VREF", "AVDD",
        "DVDD", "PWR",
    ];
    if SUPPLY.iter().any(|token| upper.contains(token)) {
        return true;
    }
    if let Some(rest) = upper.strip_prefix('+').or_else(|| upper.strip_prefix('-'))
        && rest.starts_with(|character: char| character.is_ascii_digit())
    {
        return true;
    }
    if upper.starts_with('V')
        && upper
            .get(1..)
            .is_some_and(|rest| rest.starts_with(|character: char| character.is_ascii_digit()))
    {
        return true;
    }
    let digits = upper
        .chars()
        .take_while(char::is_ascii_digit)
        .collect::<String>();
    !digits.is_empty()
        && upper[digits.len()..]
            .strip_prefix('V')
            .is_some_and(|rest| rest.chars().all(|character| character.is_ascii_digit()))
}

/// The "connects to" cell: the other references on the net, at most `limit`,
/// then `+n`. The connector itself never appears.
pub fn connects_to(
    net: &str,
    self_ref: &str,
    by_net: &BTreeMap<String, Vec<String>>,
    limit: usize,
) -> String {
    let Some(references) = by_net.get(net) else {
        return String::new();
    };
    let mut others: Vec<&str> = references
        .iter()
        .map(String::as_str)
        .filter(|reference| *reference != self_ref)
        .collect();
    others.sort_by(|left, right| natural_cmp(left, right));
    others.dedup();
    if others.is_empty() {
        return String::new();
    }
    let shown = others
        .iter()
        .take(limit)
        .copied()
        .collect::<Vec<_>>()
        .join(", ");
    if others.len() > limit {
        format!("{shown} +{}", others.len() - limit)
    } else {
        shown
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sorted(values: &[&str]) -> Vec<String> {
        let mut values: Vec<String> = values.iter().map(|value| (*value).to_owned()).collect();
        values.sort_by(|left, right| natural_cmp(left, right));
        values
    }

    #[test]
    fn pins_sort_naturally_by_number_then_letter() {
        assert_eq!(
            sorted(&["B1", "A10", "2", "10", "1", "A2", "A1", "B12"]),
            ["1", "2", "10", "A1", "A2", "A10", "B1", "B12"]
        );
        assert_eq!(sorted(&["MP", "1"]), ["1", "MP"]);
    }

    #[test]
    fn grounds_and_rails_are_power_rows() {
        assert!(is_power_net("GND", "Default", None));
        assert!(is_power_net("/TARGET Port/TARGET_A_VBUS", "Default", None));
        assert!(is_power_net("+3V3", "Default", None));
        assert!(is_power_net("3V3", "Default", None));
        assert!(is_power_net("VCC_USB_PD_OUT", "Default", None));
        assert!(is_power_net("Net-(D1-A)", "Power", None));
        assert!(is_power_net("Net-(D1-A)", "Default", Some("POWER_IN")));
    }

    #[test]
    fn a_signal_net_is_not_a_power_row() {
        assert!(!is_power_net(
            "TARGET_A_D+",
            "Default",
            Some("BIDIRECTIONAL")
        ));
        assert!(!is_power_net("/Expansion Interfaces/A1", "Default", None));
        assert!(!is_power_net("Net-(D1-A)", "Default", Some("PASSIVE")));
    }

    #[test]
    fn connects_to_excludes_the_connector_and_truncates() {
        let by_net = BTreeMap::from([(
            "GND".to_owned(),
            vec![
                "J1".to_owned(),
                "R10".to_owned(),
                "R2".to_owned(),
                "C1".to_owned(),
                "C2".to_owned(),
                "C3".to_owned(),
                "C4".to_owned(),
                "C5".to_owned(),
                "C6".to_owned(),
            ],
        )]);
        assert_eq!(
            connects_to("GND", "J1", &by_net, 6),
            "C1, C2, C3, C4, C5, C6 +2"
        );
        assert!(!connects_to("GND", "J1", &by_net, 6).contains("J1"));
        assert_eq!(connects_to("SIG", "J1", &by_net, 6), "");
    }

    #[test]
    fn net_names_keep_their_leaf_and_decode_escapes() {
        assert_eq!(net_leaf("/A/B/D+"), "D+");
        assert_eq!(
            net_text("unconnected-(J6-SWO{slash}TDO-Pad6)"),
            "unconnected-(J6-SWO/TDO-Pad6)"
        );
    }
}
