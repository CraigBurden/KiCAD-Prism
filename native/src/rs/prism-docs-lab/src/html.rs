//! The deterministic HTML page shell: escaping, fixed-precision numbers and
//! one self-contained document.
//!
//! Escaping and number formatting are `prism-artwork`'s, so a prototype
//! writes the same bytes as the artwork views for the same geometry. Nothing
//! here reads the clock or the environment: the same inputs give the same
//! page.

pub use prism_artwork::artwork::svg::{escape, number};

use crate::LAB_CSS;

/// A length in millimetres at two decimals (`17.78`), for tables and captions.
pub fn millimetres(value: f64) -> String {
    let value = if value.abs() < 0.000_000_5 {
        0.0
    } else {
        value
    };
    let text = format!("{value:.2}");
    if text == "-0.00" {
        "0.00".to_owned()
    } else {
        text
    }
}

/// A nanometre count as millimetres at two decimals.
pub fn millimetres_from_nm(value: u64) -> String {
    millimetres(value as f64 / 1_000_000.0)
}

/// One self-contained page: inline CSS (the lab's look plus `css`), `body`
/// and one inline script. `body_attributes` are written on `<body>` (the side
/// a drawing opens on). No external request is made when it loads.
pub fn document(title: &str, body_attributes: &str, css: &str, body: &str, script: &str) -> String {
    format!(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n\
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
<title>{title}</title>\n<style>\n{LAB_CSS}\n{css}\n</style>\n</head>\n\
<body{attributes}>\n{body}\n<script>\n{script}\n</script>\n</body>\n</html>\n",
        title = escape(title),
        attributes = if body_attributes.is_empty() {
            String::new()
        } else {
            format!(" {body_attributes}")
        },
        css = css,
        body = body,
        script = script,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lengths_are_fixed_precision_without_negative_zero() {
        assert_eq!(millimetres(17.781_234), "17.78");
        assert_eq!(millimetres(-0.0), "0.00");
        assert_eq!(millimetres(-0.000_000_4), "0.00");
        assert_eq!(millimetres_from_nm(17_780_000), "17.78");
    }

    #[test]
    fn a_document_is_self_contained_and_escaped() {
        let page = document(
            "a & b",
            "data-side=\"top\"",
            ".x{color:red}",
            "<p>hi</p>",
            "void 0;",
        );
        assert!(page.starts_with("<!doctype html>"));
        assert!(page.contains("<title>a &amp; b</title>"));
        assert!(page.contains("<style>\n"));
        assert!(page.contains(".x{color:red}"));
        assert!(page.contains("<p>hi</p>"));
        assert!(page.contains("<script>\nvoid 0;\n</script>"));
        assert!(!page.contains("http://"));
        assert!(!page.contains("https://"));
    }

    #[test]
    fn the_shell_carries_the_shared_look() {
        let page = document("x", "", "", "", "");
        assert!(page.contains("#1d1d1f"));
        assert!(page.contains(".atlas-table"));
    }
}
