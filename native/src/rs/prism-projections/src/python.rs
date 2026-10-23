//! Python's `str()` of a parsed token, for the producers ported from Python
//! prototypes over kicad_monkey's tokenizer, which yields `str`, `int` and
//! `float` atoms (`1.0` and `1e3` are floats, `007` the int 7).

use prism_kicad_core::Sexp;

/// `str(token)` for an atom; `None` for a form.
pub(crate) fn token(value: &Sexp) -> Option<String> {
    match value {
        Sexp::Atom(text) | Sexp::Quoted(text) => Some(text.to_string()),
        Sexp::Integer(integer) => Some(integer.to_string()),
        Sexp::Float(number) => Some(float(*number)),
        Sexp::List(_) => None,
    }
}

/// Python's `str(float)` (`repr`, the shortest round-trip digits): fixed
/// notation with at least one fractional digit when the decimal exponent is in
/// `-4..16`, otherwise `d[.ddd]e±XX` with at least two exponent digits.
pub(crate) fn float(value: f64) -> String {
    if !value.is_finite() {
        return if value.is_nan() {
            "nan".to_owned()
        } else if value > 0.0 {
            "inf".to_owned()
        } else {
            "-inf".to_owned()
        };
    }
    // `{:e}` gives the shortest round-trip digits: `-1.5e3`, `1e-5`, `0e0`.
    let scientific = format!("{value:e}");
    let (mantissa, exponent) = scientific.split_once('e').unwrap_or((&scientific, "0"));
    let exponent: i32 = exponent.parse().unwrap_or(0);
    let (sign, mantissa) = mantissa
        .strip_prefix('-')
        .map_or(("", mantissa), |rest| ("-", rest));
    let digits: String = mantissa.chars().filter(char::is_ascii_digit).collect();
    if (-4..16).contains(&exponent) {
        let point = exponent + 1;
        let (whole, fraction) = if point <= 0 {
            let zeros = "0".repeat(usize::try_from(-point).unwrap_or(0));
            ("0".to_owned(), format!("{zeros}{digits}"))
        } else {
            let point = usize::try_from(point).unwrap_or(0);
            if digits.len() <= point {
                (format!("{digits:0<point$}"), String::new())
            } else {
                (digits[..point].to_owned(), digits[point..].to_owned())
            }
        };
        let fraction = if fraction.is_empty() {
            "0".to_owned()
        } else {
            fraction
        };
        format!("{sign}{whole}.{fraction}")
    } else {
        let mantissa = if digits.len() > 1 {
            format!("{}.{}", &digits[..1], &digits[1..])
        } else {
            digits
        };
        let exponent_sign = if exponent < 0 { '-' } else { '+' };
        format!(
            "{sign}{mantissa}e{exponent_sign}{:02}",
            exponent.unsigned_abs()
        )
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn floats_print_as_python_str() {
        let cases = [
            (1.0, "1.0"),
            (1000.0, "1000.0"),
            (1.5, "1.5"),
            (-0.5, "-0.5"),
            (0.0, "0.0"),
            (-0.0, "-0.0"),
            (0.0001, "0.0001"),
            (0.00001, "1e-05"),
            (1.25e-7, "1.25e-07"),
            (1e15, "1000000000000000.0"),
            (1e16, "1e+16"),
            (1.5e300, "1.5e+300"),
            (0.1, "0.1"),
            (123.456, "123.456"),
        ];
        for (value, text) in cases {
            assert_eq!(super::float(value), text, "{value:e}");
        }
    }
}
