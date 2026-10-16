//! Today's `_round` and `_natural` (interface_extractor.py:168-170, :89-92).

use std::cmp::Ordering;

/// `round(float(value), 4) + 0.0`: the exact binary value rounded to four
/// decimals, ties to even, negative zero folded (field-maps/system-interface.md,
/// "`_round` in Rust"). Rust's fixed-precision formatting rounds the exact
/// value with ties to even, as `_Py_dg_dtoa` mode 3 does.
pub(super) fn round4(value: f64) -> f64 {
    if !value.is_finite() {
        return value;
    }
    format!("{value:.4}").parse::<f64>().unwrap_or(value) + 0.0
}

/// `_natural` (interface_extractor.py:89-92) as an ordering: `(head, n, s)`,
/// where `head` is `s` without its trailing ASCII digits and `n` their integer
/// value, or −1 without digits. `n` compares without overflow (conventions.md
/// §9): by the digit string's length without leading zeros, then by its text.
pub(super) fn natural_cmp(left: &str, right: &str) -> Ordering {
    let (left_head, left_digits) = split_digits(left);
    let (right_head, right_digits) = split_digits(right);
    left_head
        .cmp(right_head)
        .then_with(|| compare_number(left_digits, right_digits))
        .then_with(|| left.cmp(right))
}

fn split_digits(text: &str) -> (&str, Option<&str>) {
    let head = text.trim_end_matches(|character: char| character.is_ascii_digit());
    let digits = &text[head.len()..];
    (head, (!digits.is_empty()).then_some(digits))
}

fn compare_number(left: Option<&str>, right: Option<&str>) -> Ordering {
    match (left, right) {
        (None, None) => Ordering::Equal,
        (None, Some(_)) => Ordering::Less,
        (Some(_), None) => Ordering::Greater,
        (Some(left), Some(right)) => {
            let left = left.trim_start_matches('0');
            let right = right.trim_start_matches('0');
            left.len().cmp(&right.len()).then_with(|| left.cmp(right))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{natural_cmp, round4};

    #[test]
    fn round4_matches_python() {
        // The field map's vectors (Python 3.12, `round(v, 4) + 0.0`).
        let cases: [(f64, f64); 9] = [
            (0.03125, 0.0312),
            (0.09375, 0.0938),
            (100.03125, 100.0312),
            (-0.03125, -0.0312),
            (1.00005, 1.0001),
            (123.45675, 123.4567),
            (-0.00005, -0.0001),
            (-0.00004, 0.0),
            (2.675, 2.675),
        ];
        for (input, expected) in cases {
            let rounded = round4(input);
            assert_eq!(rounded.to_bits(), expected.to_bits(), "{input}");
        }
        assert!(round4(-0.0).is_sign_positive());
    }

    #[test]
    fn natural_order_matches_python() {
        // sorted(xs, key=_natural)
        let mut pads = ["10", "2", "A10", "A2", "", "B", "A02", "A", "1", "~"];
        pads.sort_by(|left, right| natural_cmp(left, right));
        assert_eq!(
            pads,
            ["", "1", "2", "10", "A", "A02", "A2", "A10", "B", "~"]
        );
    }
}
