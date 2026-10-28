//! The look a prototype is rendered in: light, dark or blueprint.
//!
//! One palette of named roles is the only place a colour is chosen. `Light`
//! holds the values the pages have always printed, so `--theme light` and no
//! flag write the same bytes as before the themes existed. Copper colours stay
//! in [`crate::palette`]: they belong to KiCad's layers, not to the page.
//!
//! The HTML pages keep their stylesheets as written and, for the two new
//! themes, map the light literals onto `:root` custom properties, so one
//! stylesheet serves every theme without a second copy of its rules.

use std::fmt;
use std::str::FromStr;

use crate::LabError;

/// The three looks a prototype can be written in.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Theme {
    /// Ink on a white page; the default and the look the pages were designed in.
    #[default]
    Light,
    /// Light ink on a near-black page, for screens and shared links.
    Dark,
    /// White ink on Prussian blue, the drafting-sheet look.
    Blueprint,
}

impl Theme {
    /// Every theme, light first.
    pub const ALL: [Self; 3] = [Self::Light, Self::Dark, Self::Blueprint];

    /// The theme's flag value.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Light => "light",
            Self::Dark => "dark",
            Self::Blueprint => "blueprint",
        }
    }

    /// The colours this theme prints with.
    pub fn palette(self) -> Palette {
        Palette::of(self)
    }
}

impl fmt::Display for Theme {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl FromStr for Theme {
    type Err = LabError;

    fn from_str(raw: &str) -> Result<Self, Self::Err> {
        match raw {
            "light" => Ok(Self::Light),
            "dark" => Ok(Self::Dark),
            "blueprint" => Ok(Self::Blueprint),
            other => Err(LabError::new(format!(
                "a theme is `light`, `dark` or `blueprint`, not {other:?}"
            ))),
        }
    }
}

/// The named roles a page paints with.
///
/// A role says what a colour means, not which colour it is: `rule` is a table
/// rule or a frame tick, `alert` is the one colour used to point at something
/// wrong. Every drawing picks a role, so a theme only has to fill this in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Palette {
    /// The page or sheet background.
    pub paper: &'static str,
    /// Outlines and text.
    pub ink: &'static str,
    /// Captions and secondary text.
    pub muted: &'static str,
    /// Table rules, frame ticks and ghost outlines.
    pub rule: &'static str,
    /// A table header band.
    pub header: &'static str,
    /// The alternate row tint.
    pub stripe: &'static str,
    /// Pad fills and knock-outs inside a pad.
    pub pad: &'static str,
    /// Component body outlines: the mechanical sheet, the atlas's other parts.
    pub body: &'static str,
    /// The one meaning colour: over-limit, DNP.
    pub alert: &'static str,
    /// Alert text, for when a mark needs to read as a word.
    pub alert_text: &'static str,
    /// The sheet frame and the title block's border.
    pub frame: &'static str,
    /// The page colour behind a sheet on screen.
    pub mat: &'static str,
}

impl Palette {
    /// The palette of `theme`.
    pub const fn of(theme: Theme) -> Self {
        match theme {
            Theme::Light => Self {
                paper: "#ffffff",
                ink: "#1d1d1f",
                muted: "#6b6b70",
                rule: "#c4c8cf",
                header: "#eef0f3",
                stripe: "#f7f8fa",
                pad: "#c4c8cf",
                body: "#9a9aa0",
                alert: "#B00020",
                alert_text: "#B00020",
                frame: "#1d1d1f",
                mat: "#e6e8ec",
            },
            Theme::Dark => Self {
                paper: "#141416",
                ink: "#e6e6e8",
                muted: "#9a9aa2",
                rule: "#3a3b40",
                header: "#22232a",
                stripe: "#1b1c21",
                pad: "#5a5d66",
                body: "#7c7f88",
                alert: "#ff6b7a",
                alert_text: "#ff6b7a",
                frame: "#e6e6e8",
                mat: "#0a0a0c",
            },
            Theme::Blueprint => Self {
                paper: "#123a6b",
                ink: "#f2f6fb",
                muted: "#a9c1df",
                rule: "#3e6496",
                header: "#1a4a82",
                stripe: "#164477",
                pad: "#5d86b8",
                body: "#c9d8ea",
                alert: "#ffb547",
                alert_text: "#ffb547",
                frame: "#f2f6fb",
                mat: "#0b2444",
            },
        }
    }
}

/// The page's custom properties, or nothing for light.
///
/// Light's stylesheets are emitted exactly as they were written, so its page
/// keeps its historical bytes; the other themes declare their roles on
/// `:root` and [`stylesheet`] refers to them.
pub fn custom_properties(theme: Theme) -> String {
    if theme == Theme::Light {
        return String::new();
    }
    let palette = theme.palette();
    format!(
        ":root {{\n\
  color-scheme: dark;\n\
  --paper: {paper};\n\
  --ink: {ink};\n\
  --muted: {muted};\n\
  --rule: {rule};\n\
  --header: {header};\n\
  --stripe: {stripe};\n\
  --pad: {pad};\n\
  --body: {body};\n\
  --alert: {alert};\n\
  --alert-text: {alert_text};\n\
  --frame: {frame};\n\
  --mat: {mat};\n\
}}\n",
        paper = palette.paper,
        ink = palette.ink,
        muted = palette.muted,
        rule = palette.rule,
        header = palette.header,
        stripe = palette.stripe,
        pad = palette.pad,
        body = palette.body,
        alert = palette.alert,
        alert_text = palette.alert_text,
        frame = palette.frame,
        mat = palette.mat,
    )
}

/// The light literals a stylesheet is written with, and the role each one is.
///
/// The shared sheet and the prototypes keep their light values; a dark or
/// blueprint page swaps each literal for the role's custom property.
const LITERALS: [(&str, &str); 9] = [
    ("#1d1d1f", "ink"),
    ("#6b6b70", "muted"),
    ("#c4c8cf", "rule"),
    ("#eef0f3", "header"),
    ("#f7f8fa", "stripe"),
    ("#dfe2e7", "rule"),
    ("#e6e8ec", "rule"),
    ("#e8eaee", "rule"),
    ("#ffffff", "paper"),
];

/// `css` as `theme` prints it.
///
/// Light is returned untouched, byte for byte. The other themes keep the same
/// rules but read their colours from the properties [`custom_properties`]
/// writes.
pub fn stylesheet(css: &str, theme: Theme) -> String {
    if theme == Theme::Light {
        return css.to_owned();
    }
    let mut themed = css.to_owned();
    for (literal, role) in LITERALS {
        themed = themed.replace(literal, &format!("var(--{role})"));
    }
    themed
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Relative luminance of an `#rrggbb` colour, the WCAG 2.x definition.
    fn luminance(hex: &str) -> f64 {
        let value = hex.trim_start_matches('#');
        assert_eq!(value.len(), 6, "{hex} is not #rrggbb");
        let channel = |start: usize| {
            let byte =
                u8::from_str_radix(&value[start..start + 2], 16).expect("hex") as f64 / 255.0;
            if byte <= 0.040_45 {
                byte / 12.92
            } else {
                ((byte + 0.055) / 1.055).powf(2.4)
            }
        };
        0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)
    }

    /// The WCAG contrast ratio between two colours.
    fn contrast(first: &str, second: &str) -> f64 {
        let (lighter, darker) = {
            let a = luminance(first);
            let b = luminance(second);
            if a >= b { (a, b) } else { (b, a) }
        };
        (lighter + 0.05) / (darker + 0.05)
    }

    #[test]
    fn light_is_the_historical_page() {
        let palette = Theme::Light.palette();
        assert_eq!(palette.paper, "#ffffff");
        assert_eq!(palette.ink, "#1d1d1f");
        assert_eq!(palette.muted, "#6b6b70");
        assert_eq!(palette.rule, "#c4c8cf");
        assert_eq!(palette.header, "#eef0f3");
        assert_eq!(palette.stripe, "#f7f8fa");
        assert_eq!(palette.pad, "#c4c8cf");
        assert_eq!(palette.body, "#9a9aa0");
        assert_eq!(palette.alert, "#B00020");
        assert_eq!(palette.frame, "#1d1d1f");
    }

    #[test]
    fn every_theme_text_role_reads_on_its_backgrounds() {
        for theme in Theme::ALL {
            let palette = theme.palette();
            for background in [palette.paper, palette.header, palette.stripe] {
                for (role, colour) in [
                    ("ink", palette.ink),
                    ("muted", palette.muted),
                    ("alert", palette.alert),
                    ("alert_text", palette.alert_text),
                ] {
                    let ratio = contrast(colour, background);
                    assert!(
                        ratio >= 4.5,
                        "{theme} {role} {colour} on {background}: {ratio:.2}:1"
                    );
                }
            }
        }
    }

    /// The two new themes must keep an outline legible as a shape. Light's
    /// body grey is 2.80:1 and its rule 1.70:1; both are frozen by the
    /// byte-identical light page, so they are not held to the same floor.
    #[test]
    fn new_theme_outlines_reach_the_graphic_floor() {
        for theme in [Theme::Dark, Theme::Blueprint] {
            let palette = theme.palette();
            for (role, colour) in [("ink", palette.ink), ("body", palette.body)] {
                let ratio = contrast(colour, palette.paper);
                assert!(ratio >= 3.0, "{theme} {role} {colour}: {ratio:.2}:1");
            }
        }
    }

    /// A rule is a hairline: at 3:1 it would read as a second drawing.
    #[test]
    fn rules_stay_hairlines_below_the_graphic_floor() {
        for theme in Theme::ALL {
            let palette = theme.palette();
            let ratio = contrast(palette.rule, palette.paper);
            assert!(ratio < 3.0, "{theme} rule {ratio:.2}:1");
            assert!(ratio >= 1.5, "{theme} rule {ratio:.2}:1");
        }
    }

    #[test]
    fn a_theme_parses_and_prints_its_flag() {
        for theme in Theme::ALL {
            assert_eq!(theme.as_str().parse::<Theme>(), Ok(theme));
            assert_eq!(theme.to_string(), theme.as_str());
        }
        assert!("sepia".parse::<Theme>().is_err());
        assert_eq!(Theme::default(), Theme::Light);
    }

    #[test]
    fn light_stylesheets_are_untouched_and_others_use_properties() {
        let css = "body { background: #ffffff; color: #1d1d1f; border: 1px solid #dfe2e7; }";
        assert_eq!(stylesheet(css, Theme::Light), css);
        assert!(custom_properties(Theme::Light).is_empty());
        let dark = stylesheet(css, Theme::Dark);
        assert!(!dark.contains("#ffffff"), "{dark}");
        assert!(dark.contains("var(--paper)"), "{dark}");
        assert!(dark.contains("var(--ink)"), "{dark}");
        assert!(dark.contains("var(--rule)"), "{dark}");
        assert!(custom_properties(Theme::Dark).contains("--paper: #141416;"));
    }
}
