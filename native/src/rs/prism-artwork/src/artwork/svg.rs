//! Deterministic SVG text: escaping, fixed precision and path building.
//!
//! Public for consumers outside the artwork views: numbers and escaping are
//! what make a drawing's bytes reproducible.

use std::fmt::Write;

use super::geometry::Point;

/// Format a millimetre value with at most six decimals (one nanometre) and no
/// negative zero, so the same geometry always serializes to the same bytes.
pub fn number(value: f64) -> String {
    let value = if value.abs() < 0.000_000_5 {
        0.0
    } else {
        value
    };
    let formatted = format!("{value:.6}");
    let trimmed = formatted.trim_end_matches('0').trim_end_matches('.');
    if trimmed == "-0" {
        "0".to_owned()
    } else {
        trimmed.to_owned()
    }
}

/// Escape text for an XML text node or a double-quoted attribute value.
pub fn escape(value: &str) -> String {
    let mut result = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '&' => result.push_str("&amp;"),
            '<' => result.push_str("&lt;"),
            '>' => result.push_str("&gt;"),
            '"' => result.push_str("&quot;"),
            '\'' => result.push_str("&apos;"),
            _ => result.push(character),
        }
    }
    result
}

/// A closed ring as an SVG path command list (no leading `M`, no `Z`).
pub fn ring_path(ring: &[Point]) -> String {
    let mut path = String::new();
    for (index, point) in ring.iter().enumerate() {
        let command = if index == 0 { 'M' } else { 'L' };
        let _ = write!(path, "{command}{} {}", number(point.x), number(point.y));
        if index + 1 < ring.len() {
            path.push(' ');
        }
    }
    path.push_str(" Z");
    path
}

/// Several rings as one even-odd path.
pub fn rings_path(rings: &[Vec<Point>]) -> String {
    rings
        .iter()
        .map(|ring| ring_path(ring))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_use_fixed_precision_without_negative_zero() {
        assert_eq!(number(12.0), "12");
        assert_eq!(number(-0.0), "0");
        assert_eq!(number(1.234_567_891), "1.234568");
        assert_eq!(number(-0.000_000_4), "0");
    }

    #[test]
    fn escaping_covers_markup_characters() {
        assert_eq!(
            escape("a&b<c>\"d\"'"),
            "a&amp;b&lt;c&gt;&quot;d&quot;&apos;"
        );
    }

    #[test]
    fn a_ring_closes() {
        let ring = [
            Point { x: 0.0, y: 0.0 },
            Point { x: 1.0, y: 0.0 },
            Point { x: 1.0, y: 1.0 },
        ];
        assert_eq!(ring_path(&ring), "M0 0 L1 0 L1 1 Z");
    }
}
