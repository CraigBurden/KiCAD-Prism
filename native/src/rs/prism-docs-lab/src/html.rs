//! The deterministic HTML page shell: escaping, fixed-precision numbers and
//! one self-contained document.
//!
//! Escaping and number formatting are `prism-artwork`'s, so a prototype
//! writes the same bytes as the artwork views for the same geometry. Nothing
//! here reads the clock or the environment: the same inputs give the same
//! page.

pub use prism_artwork::artwork::svg::{escape, number};

use crate::LAB_CSS;
use crate::theme::{self, Theme};

/// A length in millimetres at two decimals (`17.78`), for tables and captions.
/// KiCad's overbar markup `~{TEXT}` as text with a combining overline over
/// each character, the way the net reads on the schematic. Other text is
/// returned unchanged; escaping is the caller's job.
pub fn overbar(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut rest = text;
    while let Some(start) = rest.find("~{") {
        let Some(end) = rest[start + 2..].find('}') else {
            break;
        };
        out.push_str(&rest[..start]);
        for character in rest[start + 2..start + 2 + end].chars() {
            out.push(character);
            out.push('\u{0305}');
        }
        rest = &rest[start + 3 + end..];
    }
    out.push_str(rest);
    out
}

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
///
/// In the light theme the stylesheets are written exactly as they are authored;
/// dark and blueprint pages put the palette's custom properties in front of
/// them and refer to those properties instead of the light literals.
pub fn document(
    title: &str,
    body_attributes: &str,
    css: &str,
    body: &str,
    script: &str,
    theme: Theme,
) -> String {
    let style = styles(theme, css);
    format!(
        "<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n\
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n\
<title>{title}</title>\n<style>\n{style}\n</style>\n</head>\n\
<body{attributes}>\n{body}\n<script>\n{script}\n</script>\n</body>\n</html>\n",
        title = escape(title),
        attributes = if body_attributes.is_empty() {
            String::new()
        } else {
            format!(" {body_attributes}")
        },
        style = style,
        body = body,
        script = script,
    )
}

/// The `<style>` element's contents: the shared look and the prototype's
/// rules, behind the theme's custom properties when it has any.
fn styles(theme: Theme, css: &str) -> String {
    let properties = theme::custom_properties(theme);
    if properties.is_empty() {
        return format!("{LAB_CSS}\n{css}");
    }
    format!(
        "{properties}\n{}\n{}\n{}",
        theme::stylesheet(LAB_CSS, theme),
        theme::stylesheet(css, theme),
        // A dark or blueprint page only keeps its background in a PDF if the
        // printer is asked for the exact colours; light prints on white paper.
        "@media print { html, body { -webkit-print-color-adjust: exact; \
print-color-adjust: exact; } }",
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
            Theme::Light,
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
        let page = document("x", "", "", "", "", Theme::Light);
        assert!(page.contains("#1d1d1f"));
        assert!(page.contains(".atlas-table"));
    }

    #[test]
    fn a_themed_shell_declares_its_properties() {
        let light = document("x", "", ".x{color:#ffffff}", "", "", Theme::Light);
        assert!(light.contains(".x{color:#ffffff}"));
        for theme in [Theme::Dark, Theme::Blueprint] {
            let page = document("x", "", ".x{color:#ffffff}", "", "", theme);
            assert!(page.contains(":root {"), "{page}");
            assert!(page.contains(&format!("--paper: {};", theme.palette().paper)));
            assert!(!page.contains(".x{color:#ffffff}"), "{page}");
            assert!(page.contains(".x{color:var(--paper)}"), "{page}");
        }
    }
}

#[cfg(test)]
mod overbar_tests {
    #[test]
    fn kicad_overbar_markup_becomes_an_overline() {
        assert_eq!(
            super::overbar("eMMC_~{RST}"),
            "eMMC_R\u{0305}S\u{0305}T\u{0305}"
        );
        assert_eq!(super::overbar("GND"), "GND");
        assert_eq!(super::overbar("A~{B"), "A~{B");
    }
}
