//! The Stackup tab (`/stackup`): both revisions' stackup forms and settings
//! (`field-maps/stackup.md` DC rules: sub-layers folded to forms) and whether
//! they differ (`backend/app/services/design_compare_artifacts.py` `_diff_stackup`).
//!
//! Each side is the C2-a adapter
//! (`backend/app/services/design_compare_bundle_inputs.py` `stackup`): the
//! member's sub-layers fold back to one form per `(layer …)`, each field the
//! first value written across the group ("Fold to forms"), and DC's rules give
//! the row shape and the two settings keys. The output field rules are
//! `field-maps/design-compare.md` "Stackup": absent replaces `""`, `null` and a
//! zero thickness.

use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use prism_kicad_contracts::generated::prism_stackup_a0::{
    StackupA0, StackupLayer, StackupLayerColor, StackupLayerMaterial, StackupLayerType,
    StackupPositiveNanometres,
};

pub(super) fn build(base: &StackupA0, head: &StackupA0) -> dc::DesignCompareStackup {
    let base = side(base);
    let head = side(head);
    dc::DesignCompareStackup {
        present: base.present || head.present,
        changed: !same_layers(&base.layers, &head.layers)
            || !same_settings(&base.settings, &head.settings),
        base: base.layers,
        head: head.layers,
        base_settings: base.settings,
        head_settings: head.settings,
    }
}

/// One revision's side of the tab: the folded forms and the settings.
struct Side {
    /// `present && layers.length > 0` (`stackup.md` DC rules).
    present: bool,
    layers: Vec<dc::DesignCompareStackupLayer>,
    settings: dc::DesignCompareStackupSettings,
}

/// `stackup(member)`: the adapter's early return, then the folded forms.
fn side(member: &StackupA0) -> Side {
    if !member.present {
        return Side {
            present: false,
            layers: Vec::new(),
            settings: dc::DesignCompareStackupSettings::default(),
        };
    }
    let layers: Vec<_> = forms(member).iter().map(Form::layer).collect();
    Side {
        present: !layers.is_empty(),
        layers,
        settings: settings(member),
    }
}

/// The DC adapter's settings: `copperFinish ?? None` and
/// `dielectricConstraints`, the member's value.
fn settings(member: &StackupA0) -> dc::DesignCompareStackupSettings {
    match member.settings.as_ref() {
        Some(settings) => dc::DesignCompareStackupSettings {
            copper_finish: settings.copper_finish.as_ref().map(text),
            dielectric_constraints: Some(settings.dielectric_constraints),
        },
        None => dc::DesignCompareStackupSettings::default(),
    }
}

/// One `(layer …)` form: the first-written value of each per-sub-layer field.
struct Form {
    name: String,
    type_: Option<StackupLayerType>,
    thickness_nm: Option<StackupPositiveNanometres>,
    material: Option<StackupLayerMaterial>,
    color: Option<StackupLayerColor>,
    epsilon_r: Option<f64>,
    loss_tangent: Option<f64>,
}

impl Form {
    fn of(layer: &StackupLayer) -> Self {
        Self {
            name: text(&layer.name),
            type_: layer.type_,
            thickness_nm: layer.thickness_nm.clone(),
            material: layer.material.clone(),
            color: layer.color.clone(),
            epsilon_r: layer.epsilon_r,
            loss_tangent: layer.loss_tangent,
        }
    }

    /// Continue this form with a sub-layer: its fields fill only where the
    /// form has none yet ("Fold to forms").
    fn extend(&mut self, layer: &StackupLayer) {
        fill(&mut self.thickness_nm, &layer.thickness_nm);
        fill(&mut self.material, &layer.material);
        fill(&mut self.color, &layer.color);
        fill(&mut self.epsilon_r, &layer.epsilon_r);
        fill(&mut self.loss_tangent, &layer.loss_tangent);
    }

    /// The DC row (`stackup.md` DC rules): a written type, material, colour,
    /// εr, tan δ and thickness; an absent one is omitted.
    fn layer(&self) -> dc::DesignCompareStackupLayer {
        dc::DesignCompareStackupLayer {
            name: self.name.clone(),
            type_: self.type_.map(|value| value.to_string()),
            thickness_nm: self.thickness_nm.as_ref().map(nanometres),
            material: self.material.as_ref().map(text),
            color: self.color.as_ref().map(text),
            epsilon_r: self.epsilon_r,
            loss_tangent: self.loss_tangent,
        }
    }
}

/// One entry per `(layer …)` form: a `sublayer: 0` starts one, a higher
/// sub-layer continues the form it follows (`stackup.md` "Fold to forms").
fn forms(member: &StackupA0) -> Vec<Form> {
    let mut forms: Vec<Form> = Vec::new();
    for layer in &member.layers {
        if layer.sublayer.0 == 0 || forms.is_empty() {
            forms.push(Form::of(layer));
        } else if let Some(current) = forms.last_mut() {
            current.extend(layer);
        }
    }
    forms
}

/// Fill `current` from `value` only when it has no value yet.
fn fill<T: Clone>(current: &mut Option<T>, value: &Option<T>) {
    if current.is_none() {
        *current = value.clone();
    }
}

/// A written thickness, absent when the member omits it (never 0; "How a
/// golden" folds a zero to absent, `stackup.md` D3).
fn nanometres(thickness: &StackupPositiveNanometres) -> dc::Nanometres {
    dc::Nanometres(thickness.0.get() as i64)
}

/// A member string field as the plain string the tab carries.
fn text<T: Clone>(value: &T) -> String
where
    String: From<T>,
{
    String::from(value.clone())
}

fn same_layers(
    base: &[dc::DesignCompareStackupLayer],
    head: &[dc::DesignCompareStackupLayer],
) -> bool {
    base.len() == head.len()
        && base
            .iter()
            .zip(head)
            .all(|(left, right)| same_layer(left, right))
}

fn same_layer(left: &dc::DesignCompareStackupLayer, right: &dc::DesignCompareStackupLayer) -> bool {
    left.name == right.name
        && left.type_ == right.type_
        && left.material == right.material
        && left.color == right.color
        && left.epsilon_r == right.epsilon_r
        && left.loss_tangent == right.loss_tangent
        && left.thickness_nm.as_ref().map(|value| value.0)
            == right.thickness_nm.as_ref().map(|value| value.0)
}

fn same_settings(
    base: &dc::DesignCompareStackupSettings,
    head: &dc::DesignCompareStackupSettings,
) -> bool {
    base.copper_finish == head.copper_finish
        && base.dielectric_constraints == head.dielectric_constraints
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn stackup(document: serde_json::Value) -> StackupA0 {
        serde_json::from_value(document).expect("a stackup member")
    }

    /// The member's own fields, for a board with a stackup.
    fn member(layers: serde_json::Value, copper: serde_json::Value) -> StackupA0 {
        stackup(json!({
            "schema": "prism.stackup.a0",
            "present": true,
            "boardThicknessNm": 1_600_000,
            "layers": layers,
            "copperLayers": copper,
            "settings": {
                "copperFinish": "ENIG",
                "dielectricConstraints": true,
                "edgeConnector": "none",
                "castellatedPads": false,
                "edgePlating": false,
            },
            "maskColors": {},
            "viaSpans": [],
            "boardLayers": [],
        }))
    }

    fn value(document: &dc::DesignCompareStackup) -> serde_json::Value {
        serde_json::to_value(document).expect("a stackup tab")
    }

    #[test]
    fn an_absent_stackup_is_empty_and_unchanged() {
        let absent = stackup(json!({
            "schema": "prism.stackup.a0",
            "present": false,
            "boardThicknessNm": 1_600_000,
            "layers": [],
            "copperLayers": [],
            "maskColors": {},
            "viaSpans": [],
            "boardLayers": [],
        }));
        let tab = build(&absent, &absent);
        assert_eq!(
            value(&tab),
            json!({
                "present": false,
                "changed": false,
                "base": [],
                "head": [],
                "baseSettings": {},
                "headSettings": {},
            })
        );
    }

    /// Sub-layers fold to one form, the first value written of each per-
    /// sub-layer field, and a sub-layer's colour fills the form that has none
    /// (`stackup.md` "Fold to forms", D1).
    #[test]
    fn sub_layers_fold_to_one_form() {
        let base = member(
            json!([
                {"name": "dielectric 1", "sublayer": 0, "kind": "dielectric",
                 "type": "core", "thicknessNm": 300_000, "material": "FR4",
                 "epsilonR": 4.6, "lossTangent": 0.02},
                {"name": "dielectric 1", "sublayer": 1, "kind": "dielectric",
                 "type": "core", "thicknessNm": 250_000, "material": "FR4-HiTg",
                 "epsilonR": 4.4, "lossTangent": 0.015, "color": "FR4 natural"},
            ]),
            json!(["F.Cu", "B.Cu"]),
        );
        let tab = build(&base, &base);
        assert_eq!(
            value(&tab)["base"],
            json!([{
                "name": "dielectric 1",
                "type": "core",
                "thicknessNm": 300_000,
                "material": "FR4",
                "color": "FR4 natural",
                "epsilonR": 4.6,
                "lossTangent": 0.02,
            }])
        );
    }

    /// A written `(thickness 0)` is absent here (`stackup.md` D3) and an
    /// absent `(dielectric_constraints …)` reads as `false` (D4).
    #[test]
    fn zero_thickness_and_absent_constraints_match_the_map() {
        let base = member(
            json!([
                {"name": "B.Mask", "sublayer": 0, "kind": "soldermask",
                 "color": "Green"},
            ]),
            json!(["F.Cu", "B.Cu"]),
        );
        let mut base = base;
        base.settings
            .as_mut()
            .expect("settings")
            .dielectric_constraints = false;
        let tab = build(&base, &base);
        assert_eq!(
            value(&tab)["base"],
            json!([{"name": "B.Mask", "color": "Green"}])
        );
        assert_eq!(
            value(&tab)["baseSettings"],
            json!({
                "copperFinish": "ENIG",
                "dielectricConstraints": false,
            })
        );
    }

    /// `changed` compares the two sides' forms and settings
    /// (`_diff_stackup`, `design_compare_artifacts.py:94-98`).
    #[test]
    fn a_different_form_changes_the_tab() {
        let base = member(
            json!([{"name": "F.Cu", "sublayer": 0, "kind": "copper", "type": "copper",
                    "thicknessNm": 35_000}]),
            json!(["F.Cu"]),
        );
        let head = member(
            json!([{"name": "F.Cu", "sublayer": 0, "kind": "copper", "type": "copper",
                    "thicknessNm": 70_000}]),
            json!(["F.Cu"]),
        );
        let tab = build(&base, &head);
        assert!(tab.present && tab.changed);
    }
}
