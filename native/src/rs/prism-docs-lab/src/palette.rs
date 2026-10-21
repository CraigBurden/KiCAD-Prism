//! KiCad's default copper colours.
//!
//! The copper colours are KiCad 10's `pcbnew` defaults: `F.Cu` red, `B.Cu`
//! blue and the inner layers In1…In30 from a six-colour table that repeats.
//! Drawings colour every trace, pad and filled zone from here so a board on
//! the page reads the way it reads in the board editor. Copper is not themed:
//! the layer colours carry the layer, and KiCad's set already reads on light,
//! dark and blueprint pages alike. Everything that is *not* copper comes from
//! [`crate::theme`].

/// `F.Cu`, KiCad's default front copper.
pub const F_CU: &str = "#C83434";
/// `B.Cu`, KiCad's default back copper.
pub const B_CU: &str = "#4D7FC4";
/// `In1.Cu`…`In6.Cu`, repeated for `In7.Cu` onwards.
pub const INNER: [&str; 6] = [
    "#7FC87F", "#CE7D2C", "#4FCBCB", "#DB628B", "#A7A5C6", "#28CCD9",
];

/// The colour of copper layer `layer`, or `None` for any other layer.
///
/// Accepts the canonical names (`F.Cu`, `B.Cu`, `In<n>.Cu`) only: the board's
/// own layer table and the stackup projection both write those.
pub fn copper_color(layer: &str) -> Option<&'static str> {
    match layer {
        "F.Cu" => Some(F_CU),
        "B.Cu" => Some(B_CU),
        _ => inner_layer(layer).map(|number| INNER[(number - 1) % INNER.len()]),
    }
}

/// The `n` of an `In<n>.Cu` layer, 1-based, or `None`.
pub fn inner_layer(layer: &str) -> Option<usize> {
    let number = layer.strip_prefix("In")?.strip_suffix(".Cu")?;
    number.parse::<usize>().ok().filter(|number| *number > 0)
}

/// The copper layers of `layers`, in the order given (the stackup's order).
pub fn copper_layers(layers: &[String]) -> Vec<String> {
    layers
        .iter()
        .filter(|layer| copper_color(layer).is_some())
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_copper_layer_has_kicads_default_colour() {
        assert_eq!(copper_color("F.Cu"), Some("#C83434"));
        assert_eq!(copper_color("B.Cu"), Some("#4D7FC4"));
        assert_eq!(copper_color("In1.Cu"), Some("#7FC87F"));
        assert_eq!(copper_color("In2.Cu"), Some("#CE7D2C"));
        assert_eq!(copper_color("In3.Cu"), Some("#4FCBCB"));
        assert_eq!(copper_color("In4.Cu"), Some("#DB628B"));
        assert_eq!(copper_color("In5.Cu"), Some("#A7A5C6"));
        assert_eq!(copper_color("In6.Cu"), Some("#28CCD9"));
    }

    #[test]
    fn the_inner_table_repeats_from_in7() {
        assert_eq!(copper_color("In7.Cu"), Some("#7FC87F"));
        assert_eq!(copper_color("In12.Cu"), Some("#28CCD9"));
    }

    #[test]
    fn non_copper_layers_have_no_colour() {
        for layer in ["F.SilkS", "Edge.Cuts", "In0.Cu", "In.Cu", "Inx.Cu", ""] {
            assert_eq!(copper_color(layer), None, "{layer:?}");
        }
    }

    #[test]
    fn copper_layers_keep_the_stackup_order() {
        let stack = [
            "F.Cu".to_owned(),
            "In1.Cu".to_owned(),
            "F.SilkS".to_owned(),
            "B.Cu".to_owned(),
        ];
        assert_eq!(copper_layers(&stack), ["F.Cu", "In1.Cu", "B.Cu"]);
    }
}
