//! ECMAScript numeric rules the reference diff relies on.
//!
//! Each function cites the line of
//! `backend/design-compare-parser/ecad-diff.mjs` it ports. T1 (rounding) and
//! T2 (`Math.hypot`) are parity traps of amendment C2 §6.

use std::cmp::Ordering;

/// `Math.round(value * 1e6) / 1e6` (`ecad-diff.mjs:334-336`).
pub fn round6(value: f64) -> f64 {
    round_half_up(value * 1e6) / 1e6
}

/// `Math.round`: a half goes toward positive infinity, not away from zero
/// (`(x + 0.5).floor()` semantics; parity trap T1). `f64::round` would give
/// `-3` for `-2.5`, where JavaScript gives `-2`.
pub fn round_half_up(value: f64) -> f64 {
    (value + 0.5).floor()
}

/// `Math.hypot(dx, dy)` for two arguments (`ecad-diff.mjs:331`; parity trap
/// T2): the ECMAScript scaling algorithm, so the `round6` that follows sees
/// the same double as V8. `f64::hypot` (libm) can differ in the last bit.
pub fn hypot2(x: f64, y: f64) -> f64 {
    let max = x.abs().max(y.abs());
    if max.is_nan() {
        return f64::NAN;
    }
    if max.is_infinite() {
        return f64::INFINITY;
    }
    if max == 0.0 {
        return 0.0;
    }
    let scaled = |value: f64| (value / max) * (value / max);
    max * (scaled(x) + scaled(y)).sqrt()
}

/// ECMAScript `Number::toString` for a millimetre coordinate (parity trap T3,
/// `ecad-diff.mjs:284`): `25`, not `25.0`, and `-0` becomes `0`.
///
/// KiCad coordinates are `nm / 1e6`, so every value lies in `[1e-6, ~1e5)`
/// where ECMAScript and Rust's shortest round-trip formatting agree, apart
/// from the `-0` above (both use exponent notation outside that range, and
/// KiCad never reaches it).
pub fn ecma_number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_owned();
    }
    format!("{value}")
}

/// `at.join(", ")` with ECMAScript number formatting (`ecad-diff.mjs:284`).
pub fn position_text(at: [f64; 2]) -> String {
    format!("{}, {}", ecma_number(at[0]), ecma_number(at[1]))
}

/// JavaScript's default `.sort()` order: UTF-16 code units (parity trap T5).
/// Rust's `str::cmp` is code-point order, which differs only above `U+FFFF`.
pub fn utf16_cmp(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn t1_rounding_goes_toward_positive_infinity() {
        // `Math.round` (ecad-diff.mjs:334), not `f64::round`.
        assert_eq!(round_half_up(2.5), 3.0);
        assert_eq!(round_half_up(-2.5), -2.0);
        assert_eq!(round_half_up(0.5), 1.0);
        assert_eq!(round_half_up(-0.5), 0.0);
        assert_eq!(round6(1.2345678), 1.234568);
    }

    #[test]
    fn t2_hypot_matches_the_ecmascript_algorithm() {
        assert_eq!(hypot2(3.0, 4.0), 5.0);
        assert_eq!(hypot2(0.0, 0.0), 0.0);
        assert_eq!(hypot2(-20.0, 0.0), 20.0);
        assert_eq!(hypot2(1.0, 1.0), std::f64::consts::SQRT_2);
        assert_eq!(hypot2(f64::INFINITY, 1.0), f64::INFINITY);
        assert!(hypot2(f64::NAN, 1.0).is_nan());
        // The reference computes `round6(Math.hypot(dx, dy))`.
        assert_eq!(round6(hypot2(3.0, 4.0)), 5.0);
    }

    #[test]
    fn t3_number_text_is_ecmascript() {
        assert_eq!(ecma_number(25.0), "25");
        assert_eq!(ecma_number(-0.0), "0");
        assert_eq!(ecma_number(40.64), "40.64");
        assert_eq!(ecma_number(0.000001), "0.000001");
        assert_eq!(position_text([0.0, 40.64]), "0, 40.64");
        assert_eq!(position_text([-0.0, 0.0]), "0, 0");
    }

    #[test]
    fn t5_utf16_order_differs_from_code_point_above_bmp() {
        // U+10000 (`\u{10000}`) is D800 DC00 in UTF-16; U+FFFF is FFFF.
        // Code-point order says U+FFFF < U+10000; UTF-16 says U+10000 first.
        let supplementary = "\u{10000}";
        let bmp = "\u{ffff}";
        assert_eq!(utf16_cmp(supplementary, bmp), Ordering::Less);
        assert_eq!(bmp.cmp(supplementary), Ordering::Less);
    }
}
