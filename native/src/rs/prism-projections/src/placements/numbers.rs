//! Number and identifier conversion for `placements`.
//!
//! Ports `placements_build.py:44-70` (the `kiround`, `nm`, `fold` and
//! `degrees` helpers) and `:31` (the canonical uuid pattern). Conventions
//! §6 fixes the nanometre rounding: the binary64 product millimetres × 1e6,
//! rounded half away from zero, with `-0` written as `0`.

/// Round half away from zero, KiCad's `KiROUND` (`placements_build.py:47-50`).
///
/// `f64::round` is defined to round half-way cases away from zero, the same
/// rule the Python producer spells `copysign(floor(abs(value) + 0.5), value)`.
pub(crate) fn kiround(value: f64) -> i64 {
    // `copysign(floor(|v| + 0.5), v)` literally: the addition can round up
    // (0.49999999999999994 + 0.5 == 1.0), where `f64::round` would not.
    (value.abs() + 0.5).floor().copysign(value) as i64
}

/// Millimetres to integer nanometres, conventions §6 (`placements_build.py:53-56`).
pub(crate) fn nm(value_mm: f64) -> i64 {
    kiround(value_mm * 1e6)
}

/// A number as written with `-0` folded to `0` (`placements_build.py:59-65`).
///
/// The Python returns a Python `int` for an integer-valued number; both
/// spellings compare equal as IEEE-754 doubles (conventions §14), and the
/// contract's field type is `float64`, so the fold only has to remove `-0`.
pub(crate) fn fold(value: f64) -> f64 {
    if value == 0.0 { 0.0 } else { value }
}

/// Degrees as written with `-0` folded to `0` (`placements_build.py:68-70`).
pub(crate) fn degrees(value: f64) -> f64 {
    if value == 0.0 { 0.0 } else { value }
}

/// The canonical lowercase KiCad uuid, `^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$`
/// (`placements_build.py:31`).
pub(crate) fn is_canonical_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }
    for (index, byte) in bytes.iter().enumerate() {
        if matches!(index, 8 | 13 | 18 | 23) {
            if *byte != b'-' {
                return false;
            }
        } else if !(byte.is_ascii_digit() || matches!(byte, b'a'..=b'f')) {
            return false;
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nm_rounds_half_away_from_zero() {
        assert_eq!(nm(1.0), 1_000_000);
        assert_eq!(nm(-1.0), -1_000_000);
        assert_eq!(nm(0.5), 500_000);
        assert_eq!(nm(-0.5), -500_000);
        assert_eq!(nm(0.000_000_5), 1);
        assert_eq!(nm(-0.000_000_5), -1);
        assert_eq!(nm(0.0), 0);
        assert_eq!(nm(-0.0), 0);
    }

    #[test]
    fn kiround_keeps_the_addition_rounding() {
        assert_eq!(kiround(0.499_999_999_999_999_94), 1);
        assert_eq!(kiround(-0.499_999_999_999_999_94), -1);
        assert_eq!(kiround(2.5), 3);
        assert_eq!(kiround(-2.5), -3);
    }

    #[test]
    fn fold_and_degrees_fold_negative_zero() {
        assert_eq!(fold(-0.0).to_bits(), 0.0_f64.to_bits());
        assert_eq!(degrees(-0.0).to_bits(), 0.0_f64.to_bits());
        assert_eq!(fold(180.0), 180.0);
        assert_eq!(fold(0.5), 0.5);
    }

    #[test]
    fn canonical_uuid_matches_only_the_written_form() {
        assert!(is_canonical_uuid("138d6a8e-0bd6-522a-bad6-1999b8c03a4f"));
        assert!(!is_canonical_uuid(""));
        assert!(!is_canonical_uuid("138d6a8e-0bd6-522a-bad6-1999b8c03a4"));
        assert!(!is_canonical_uuid("138D6A8E-0BD6-522A-BAD6-1999B8C03A4F"));
        assert!(!is_canonical_uuid("138d6a8e_0bd6_522a_bad6_1999b8c03a4f"));
        assert!(!is_canonical_uuid("g38d6a8e-0bd6-522a-bad6-1999b8c03a4f"));
    }
}
