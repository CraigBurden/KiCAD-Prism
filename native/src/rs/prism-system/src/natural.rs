//! Natural order (conventions.md §9): `R2 < R10 < RN1`, `1 < 2 < 10 < A1`.

use std::cmp::Ordering;

fn split(text: &str) -> (&str, &str) {
    let digits = text.len() - text.bytes().rev().take_while(u8::is_ascii_digit).count();
    (&text[..digits], &text[digits..])
}

fn digits_cmp(a: &str, b: &str) -> Ordering {
    match (a.is_empty(), b.is_empty()) {
        (true, true) => return Ordering::Equal,
        (true, false) => return Ordering::Less,
        (false, true) => return Ordering::Greater,
        (false, false) => {}
    }
    let a = a.trim_start_matches('0');
    let b = b.trim_start_matches('0');
    a.len().cmp(&b.len()).then_with(|| a.cmp(b))
}

/// Compare two pad numbers or references in natural order.
pub fn cmp(a: &str, b: &str) -> Ordering {
    let (prefix_a, digits_a) = split(a);
    let (prefix_b, digits_b) = split(b);
    prefix_a
        .cmp(prefix_b)
        .then_with(|| digits_cmp(digits_a, digits_b))
        .then_with(|| a.cmp(b))
}

/// Sort strings in natural order, in place.
pub fn sort(items: &mut [String]) {
    items.sort_by(|a, b| cmp(a, b));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn natural_order_matches_the_conventions() {
        let mut items: Vec<String> = [
            "RN1", "R10", "R2", "A1", "10", "2", "1", "", "R01", "R1", "U1A", "U10", "U2", "U1",
        ]
        .iter()
        .map(|item| (*item).to_owned())
        .collect();
        sort(&mut items);
        assert_eq!(
            items,
            [
                "", "1", "2", "10", "A1", "R01", "R1", "R2", "R10", "RN1", "U1", "U2", "U10", "U1A"
            ]
        );
    }
}
