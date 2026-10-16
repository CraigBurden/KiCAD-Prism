//! Units and number text: nanometres (`conventions.md` §6), the centroid rule
//! (`ecad-parse.mjs:310-326`) and ECMAScript number/JSON text for review
//! values (`ecad-parse.mjs:222-257`, `:328-362`).

use serde_json::{Map, Number, Value};

/// Millimetres to integer nanometres: round half away from zero of the double
/// product (`conventions.md` §6; `capture/board_objects.py:163-166`).
#[must_use]
pub fn mm_to_nm(value_mm: f64) -> i64 {
    (value_mm * 1e6).round() as i64
}

/// ECMAScript `Math.round` (round half toward +∞, `ecad-parse.mjs:322-326`).
#[must_use]
pub fn js_round(value: f64) -> f64 {
    let floor = value.floor();
    if value - floor < 0.5 {
        floor
    } else {
        floor + 1.0
    }
}

/// `round6` (`ecad-parse.mjs:322-326`): KiCad's six-decimal boundary.
#[must_use]
pub fn round6(value: f64) -> f64 {
    js_round(value * 1e6) / 1e6
}

/// The centroid of the listed points in millimetres, or `None` when no point
/// has numeric `x` and `y` (`ecad-parse.mjs:310-320`): the mean of the usable
/// coordinates, rounded with `round6`.
#[must_use]
pub fn centroid(points: &[(Option<f64>, Option<f64>)]) -> Option<(f64, f64)> {
    let mut count = 0usize;
    let mut sum_x = 0.0f64;
    let mut sum_y = 0.0f64;
    for (x, y) in points {
        if let (Some(x), Some(y)) = (x, y) {
            sum_x += x;
            sum_y += y;
            count += 1;
        }
    }
    if count == 0 {
        return None;
    }
    let length = count as f64;
    Some((round6(sum_x / length), round6(sum_y / length)))
}

/// The centroid's integer nanometres (`conventions.md` §6; the value is
/// already `k / 1e6`, so this recovers `k`, `capture/board_objects.py:559-566`).
#[must_use]
pub fn centroid_nm(points: &[(Option<f64>, Option<f64>)]) -> Option<(i64, i64)> {
    centroid(points).map(|(x, y)| (mm_to_nm(x), mm_to_nm(y)))
}

/// ECMAScript `String(number)` for the magnitudes KiCad writes: Rust's `{}`
/// agrees in `[1e-6, 1e21)` and `-0` prints as `0` (`ecad-parse.mjs:338-362`).
#[must_use]
pub fn es_number(value: f64) -> String {
    if value == 0.0 {
        return "0".to_owned();
    }
    format!("{value}")
}

/// Serialize a JSON value as ECMAScript `JSON.stringify` does: object keys in
/// their (already canonical) order, numbers as `String(number)`, strings with
/// the ECMAScript escapes (`ecad-parse.mjs:252-257`).
#[must_use]
pub fn json_text(value: &Value) -> String {
    let mut out = String::new();
    write_json(value, &mut out);
    out
}

fn write_json(value: &Value, out: &mut String) {
    match value {
        Value::Null => out.push_str("null"),
        Value::Bool(flag) => out.push_str(if *flag { "true" } else { "false" }),
        Value::Number(number) => out.push_str(&es_number(number.as_f64().unwrap_or(0.0))),
        Value::String(text) => write_json_string(text, out),
        Value::Array(items) => write_array(items, out),
        Value::Object(map) => write_object(map, out),
    }
}

fn write_array(items: &[Value], out: &mut String) {
    out.push('[');
    for (index, item) in items.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        write_json(item, out);
    }
    out.push(']');
}

fn write_object(map: &Map<String, Value>, out: &mut String) {
    out.push('{');
    for (index, (key, item)) in map.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        write_json_string(key, out);
        out.push(':');
        write_json(item, out);
    }
    out.push('}');
}

/// ECMAScript `JSON.stringify` of a string (`ecad-parse.mjs:252-257`).
#[must_use]
pub fn json_string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    write_json_string(text, &mut out);
    out
}

fn write_json_string(text: &str, out: &mut String) {
    out.push('"');
    for character in text.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\u{0008}' => out.push_str("\\b"),
            '\u{000c}' => out.push_str("\\f"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            character if (character as u32) < 0x20 => {
                out.push_str("\\u00");
                let code = character as u32;
                out.push(char::from_digit(code >> 4, 16).unwrap_or('0'));
                out.push(char::from_digit(code & 0xf, 16).unwrap_or('0'));
            }
            character => out.push(character),
        }
    }
    out.push('"');
}

/// `canonical(value)` (`ecad-parse.mjs:222-250`): sorted keys, identity and
/// generated keys dropped, numbers rounded to six decimals with `-0` → `0`.
#[must_use]
pub fn canonical(value: &Value) -> Value {
    match value {
        Value::Array(items) => Value::Array(items.iter().map(canonical).collect()),
        Value::Object(map) => {
            let mut entries: Vec<(&String, &Value)> = map.iter().collect();
            entries.sort_by(|left, right| left.0.cmp(right.0));
            let mut out = Map::new();
            for (key, child) in entries {
                if key == "uuid"
                    || key == "tstamp"
                    || key == "fields_autoplaced"
                    || key == "filled_polygons"
                    || key == "render_cache"
                {
                    continue;
                }
                out.insert(key.clone(), canonical(child));
            }
            Value::Object(out)
        }
        Value::Number(number) => canonical_number(number),
        _ => value.clone(),
    }
}

fn canonical_number(number: &Number) -> Value {
    let Some(value) = number.as_f64() else {
        return Value::Number(number.clone());
    };
    let normalized = if value == 0.0 { 0.0 } else { value };
    if !normalized.is_finite() {
        return Value::Number(number.clone());
    }
    let rounded = round6(normalized);
    if rounded == 0.0 {
        return Value::Number(Number::from_f64(0.0).unwrap_or_else(|| Number::from(0)));
    }
    Number::from_f64(rounded).map_or(Value::Null, Value::Number)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn millimetres_round_half_away_from_zero() {
        assert_eq!(mm_to_nm(1.0), 1_000_000);
        assert_eq!(mm_to_nm(0.5), 500_000);
        assert_eq!(mm_to_nm(-0.5), -500_000);
        assert_eq!(mm_to_nm(1.234_567), 1_234_567);
        assert_eq!(mm_to_nm(-1.234_567_5), -1_234_568);
    }

    #[test]
    fn the_centroid_rounds_half_toward_positive_infinity() {
        // 0.0000005 mm -> 0.5 nm -> 1 nm (ECMAScript Math.round).
        assert_eq!(centroid_nm(&[(Some(5e-7), Some(0.0))]), Some((1, 0)));
        // -0.0000005 mm -> -0.5 nm -> 0 nm.
        assert_eq!(centroid_nm(&[(Some(-5e-7), Some(0.0))]), Some((0, 0)));
        assert_eq!(centroid_nm(&[(None, None)]), None);
    }

    #[test]
    fn canonical_drops_identity_and_rounds_numbers() {
        let value = json!({"b": 0.09999999999999999, "uuid": "x", "a": -0.0});
        assert_eq!(canonical(&value), json!({"a": 0.0, "b": 0.1}));
    }

    #[test]
    fn json_text_has_the_ecmascript_escapes() {
        assert_eq!(json_string("a\"b\\c\nd"), "\"a\\\"b\\\\c\\nd\"");
        assert_eq!(
            json_text(&json!({"a": 1.0, "b": true})),
            "{\"a\":1,\"b\":true}"
        );
    }
}
