//! ECMAScript numeric rules the reference diff relies on.
//!
//! Each function cites the line of
//! `backend/design-compare-parser/ecad-diff.mjs` it ports. T3 (number text)
//! and T5 (UTF-16 order) are parity traps of amendment C2 §6.

use std::cmp::Ordering;

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
