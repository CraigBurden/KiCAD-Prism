//! The components and diagnostics, a port of `_occurrences`,
//! `_schematic_pins`, `_power_net_names`, `_mpn`, `_field_map` and the
//! component loop of `extract_interface` (interface_extractor.py:95-145,
//! :324-350, :386-463).
//!
//! The build reads the typed schematic netlist once (`schematic.facts`), groups
//! the occurrences by reference, and joins the board's facts when there is a
//! board. DNP is the design-variant resolver's default assembly state
//! (`default_dnp`, the semantic index's `assembly` default components).

mod occurrences;
mod pins;
mod power;

use super::board::BoardFacts;
use super::detection::classify;
use super::numbers::natural_cmp;
use crate::{ProjectionError, ProjectionInput, SchematicModel};
use pins::PinEntry;
use prism_kicad_core::{KiCadNetlist, KiCadNetlistComponent};
use serde_json::{Value, json};
use std::cmp::Ordering;
use std::collections::{BTreeMap, BTreeSet, HashMap};

/// `_MPN_FIELDS` (interface_extractor.py:339): the field names `_mpn` tries, in
/// order, after `strip().lower()`.
const MPN_FIELDS: [&str; 6] = [
    "mpn",
    "manufacturer_part_number",
    "manufacturer part number",
    "mfr_pn",
    "mfr. no.",
    "mfr no",
];

/// `components` in natural reference order and `diagnostics` sorted by
/// `(code, portKey, pad or "")`, joined with the board's facts when there is a
/// board.
pub(super) fn project(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
    board: Option<&BoardFacts>,
) -> Result<(Vec<Value>, Vec<Value>), ProjectionError> {
    let netlist = schematic.facts.netlist();
    let netlist_components = netlist_components(netlist);
    let pins_by_pad = pins::schematic_pins(netlist);
    let power_nets = power::power_net_names(schematic.index);
    let mut references = occurrences::occurrences(schematic.index);
    // `for reference in sorted(occurrences, key=_natural)` (:391).
    references.sort_by(|left, right| natural_cmp(&left.0, &right.0));
    let default_dnp = default_dnp(input, schematic)?;
    // `_field_map` of a component that has none is `{}`; classify and `_mpn`
    // then see no fields.
    let no_fields = BTreeMap::new();

    let mut components: Vec<Value> = Vec::new();
    let mut diagnostics: Vec<Diagnostic> = Vec::new();
    for (reference, mut units) in references {
        // `sorted(occurrences[reference], key=lambda item: (unit, key))` (:392):
        // the lowest unit, ties broken by key, gives the port key and `lib_id`.
        units.sort_by(|left, right| {
            left.unit
                .cmp(&right.unit)
                .then_with(|| left.key.cmp(&right.key))
        });
        let Some(first) = units.first() else {
            continue;
        };
        let port_key = first.key.clone();
        let lib_id = first.lib_id.clone();
        // `pads = schematic_pins.get(reference, {})`; `if not pads: continue`
        // (:393-395): no electrical pin means not a component.
        let Some(pads) = pins_by_pad.get(&reference) else {
            continue;
        };
        if pads.is_empty() {
            continue;
        }
        let netlist_component = netlist_components.get(reference.as_str()).copied();
        let fields = netlist_component.map_or(&no_fields, |component| &component.fields);
        let footprint = netlist_component.map_or("", |component| component.footprint.as_str());
        let (candidate, reason) = classify(&reference, &lib_id, footprint, fields);
        // `annotated = "?" not in reference` (:402-410).
        if reference.contains('?') {
            diagnostics.push(unannotated_diagnostic(&reference, &port_key, candidate));
        }
        let component_pins = build_pins(
            &reference,
            pads,
            board,
            &power_nets,
            &port_key,
            &mut diagnostics,
        );
        // `memberKeys = sorted(key for _unit, key, _symbol in units)` (:437),
        // each once: units copied with their symbol share its UUID and so its
        // KIID path, which KiCad keeps (`ReplaceDuplicateTimeStamps` runs only
        // on legacy files).
        let mut member_keys: Vec<&String> = units.iter().map(|unit| &unit.key).collect();
        member_keys.sort_unstable();
        member_keys.dedup();
        let component_geometry = geometry(board, &reference);
        let component_dnp = is_dnp(&default_dnp, &reference);
        components.push(json!({
            "portKey": port_key,
            "memberKeys": member_keys,
            "reference": reference,
            "libId": lib_id,
            "footprint": footprint,
            "value": netlist_component.map_or("", |component| component.value.as_str()),
            // v7 (CONTRACTS_P2 §18): matches the connector to a catalog part.
            "mpn": netlist_component.and_then(|component| mpn(&component.fields)),
            "dnp": component_dnp,
            "candidate": candidate,
            "candidateReason": reason,
            "pins": component_pins,
            "geometry": component_geometry,
        }));
    }

    // `sorted(diagnostics, key=(code, portKey or "", pad or ""))` (:461-463).
    diagnostics.sort_by(diagnostic_key);
    Ok((
        components,
        diagnostics
            .into_iter()
            .map(Diagnostic::into_value)
            .collect(),
    ))
}

/// `components_by_reference` (interface_extractor.py:372-375): a dict
/// comprehension, so the *last* netlist component with a reference wins.
fn netlist_components(netlist: &KiCadNetlist) -> HashMap<&str, &KiCadNetlistComponent> {
    let mut by_reference: HashMap<&str, &KiCadNetlistComponent> = HashMap::new();
    for component in &netlist.components {
        by_reference.insert(component.reference.as_str(), component);
    }
    by_reference
}

/// `sorted(diagnostics, key=(code, portKey or "", pad or ""))`
/// (interface_extractor.py:461-463).
fn diagnostic_key(left: &Diagnostic, right: &Diagnostic) -> Ordering {
    left.code
        .cmp(right.code)
        .then_with(|| left.port_key.cmp(&right.port_key))
        .then_with(|| {
            left.pad
                .as_deref()
                .unwrap_or("")
                .cmp(right.pad.as_deref().unwrap_or(""))
        })
}

/// `for pad in sorted(pads, key=_natural)` (interface_extractor.py:413-432): one
/// pin per distinct schematic pad number, in natural order, appending the
/// `pin_net_ambiguous` diagnostics.
fn build_pins(
    reference: &str,
    pads: &HashMap<String, PinEntry>,
    board: Option<&BoardFacts>,
    power_nets: &BTreeSet<String>,
    port_key: &str,
    diagnostics: &mut Vec<Diagnostic>,
) -> Vec<Value> {
    let mut pad_entries: Vec<(&String, &PinEntry)> = pads.iter().collect();
    pad_entries.sort_by(|left, right| natural_cmp(left.0, right.0));
    let mut pins: Vec<Value> = Vec::with_capacity(pad_entries.len());
    for (pad, entry) in pad_entries {
        let nets = pins::normalized_nets(&entry.nets);
        if nets.len() > 1 {
            diagnostics.push(ambiguous_diagnostic(reference, pad, port_key, nets.len()));
        }
        // `board_pads.get(reference, {}).get(pad) if board is not None else
        // None` (:421): null without a board, without a footprint with this
        // reference, or without a pad with this number.
        let board_nets = board
            .and_then(|facts| facts.pad_nets.get(reference))
            .and_then(|by_pad| by_pad.get(pad));
        let pcb_nets = board_nets.map_or(Value::Null, |names| {
            Value::Array(
                pins::normalized_nets(names)
                    .into_iter()
                    .map(Value::String)
                    .collect(),
            )
        });
        pins.push(json!({
            "pad": pad,
            "nets": nets,
            // `normalized_nets(board_nets) if board_nets is not None else None`.
            "pcbNets": pcb_nets,
            // `sorted(entry["names"]) or None` (:427-428).
            "pinNames": optional_set(&entry.names),
            "pinTypes": optional_set(&entry.types),
            // CONTRACTS_P2 §8.4 (v5): the pin's net is driven by a power
            // symbol (:429-430).
            "powerNet": nets.iter().any(|net| power_nets.contains(net)),
        }));
    }
    pins
}

/// One diagnostic before its final sort (`interface_extractor.py:402-420`).
struct Diagnostic {
    code: &'static str,
    port_key: String,
    pad: Option<String>,
    detail: String,
}

impl Diagnostic {
    fn into_value(self) -> Value {
        json!({
            "code": self.code,
            "portKey": self.port_key,
            "pad": self.pad,
            "detail": self.detail,
        })
    }
}

/// `{"code": "unannotated_connector" | "unannotated_component", …,
/// "detail": f"{reference} is not annotated"}` (interface_extractor.py:404-410).
fn unannotated_diagnostic(reference: &str, port_key: &str, candidate: bool) -> Diagnostic {
    Diagnostic {
        code: if candidate {
            "unannotated_connector"
        } else {
            "unannotated_component"
        },
        port_key: port_key.to_owned(),
        pad: None,
        detail: format!("{reference} is not annotated"),
    }
}

/// `{"code": "pin_net_ambiguous", …,
/// "detail": f"{reference}.{pad} carries {count} schematic nets"}`
/// (interface_extractor.py:416-420).
fn ambiguous_diagnostic(reference: &str, pad: &str, port_key: &str, count: usize) -> Diagnostic {
    Diagnostic {
        code: "pin_net_ambiguous",
        port_key: port_key.to_owned(),
        pad: Some(pad.to_owned()),
        detail: format!("{reference}.{pad} carries {count} schematic nets"),
    }
}

/// `sorted(names) or None`: `null` for an empty set, else the sorted names.
fn optional_set(names: &BTreeSet<String>) -> Value {
    if names.is_empty() {
        Value::Null
    } else {
        json!(names)
    }
}

/// `geometry.get(reference)` (`interface_extractor.py:448`).
fn geometry(board: Option<&BoardFacts>, reference: &str) -> Value {
    board
        .and_then(|facts| facts.geometry.get(reference))
        .cloned()
        .unwrap_or(Value::Null)
}

/// `_mpn(fields)` (interface_extractor.py:342-345): the first non-empty
/// MPN-style field by `strip().lower()`ed name, in `_MPN_FIELDS` order.
fn mpn(fields: &BTreeMap<String, String>) -> Option<String> {
    let by_name: BTreeMap<String, String> = fields
        .iter()
        .map(|(name, value)| (name.trim().to_lowercase(), value.trim().to_owned()))
        .collect();
    MPN_FIELDS.iter().find_map(|name| {
        by_name
            .get(*name)
            .filter(|value| !value.is_empty())
            .cloned()
    })
}

/// The resolver skips every reference ending in `?`
/// (`_valid_reference`, semantic_index_variants.py:115-122), so today's default
/// `components` map never has one; keep that invariant explicit here.
fn is_dnp(default_dnp: &BTreeSet<String>, reference: &str) -> bool {
    !reference.contains('?') && default_dnp.contains(reference)
}

/// The references whose default assembly state is DNP: today's
/// `build_assembly_state(...)["default"]["components"]`, keyed by reference
/// before the semantic index's key translation (interface_extractor.py:386-387,
/// :444).
fn default_dnp(
    input: &ProjectionInput<'_>,
    schematic: &SchematicModel<'_>,
) -> Result<BTreeSet<String>, ProjectionError> {
    let components = crate::semantic_index::default_components(input, schematic)?;
    Ok(components
        .into_iter()
        .filter(|(_, state)| state.get("dnp").and_then(Value::as_bool) == Some(true))
        .map(|(reference, _)| reference)
        .collect())
}

#[cfg(test)]
mod tests {
    use super::{ambiguous_diagnostic, is_dnp, mpn, unannotated_diagnostic};
    use std::collections::{BTreeMap, BTreeSet};

    fn fields(rows: &[(&str, &str)]) -> BTreeMap<String, String> {
        rows.iter()
            .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
            .collect()
    }

    #[test]
    fn mpn_picks_the_first_field_in_rule_order() {
        // `_MPN_FIELDS` order (interface_extractor.py:339-345): `mpn` before
        // `manufacturer part number` before `mfr. no.`.
        let candidate = fields(&[
            ("mfr. no.", "C"),
            ("Manufacturer Part Number", "B"),
            ("MPN", "A"),
        ]);
        assert_eq!(mpn(&candidate).as_deref(), Some("A"));

        // Names are `strip().lower()`ed and values stripped.
        assert_eq!(mpn(&fields(&[(" mpn ", "  A1  ")])).as_deref(), Some("A1"));
        // An empty first field falls through to the next.
        assert_eq!(
            mpn(&fields(&[("MPN", "  "), ("mfr. no.", "M")])).as_deref(),
            Some("M")
        );
        // `mfr. no.` precedes `mfr no`.
        assert_eq!(
            mpn(&fields(&[("mfr no", "N"), ("mfr. no.", "M")])).as_deref(),
            Some("M")
        );
        // No MPN-style field → null.
        assert_eq!(mpn(&BTreeMap::new()), None);
        assert_eq!(mpn(&fields(&[("Value", "10k")])), None);
    }

    #[test]
    fn the_diagnostic_texts_are_todays() {
        // `f"{reference} is not annotated"` (interface_extractor.py:406, :409).
        let annotated = unannotated_diagnostic("J?", "/root/j", true);
        assert_eq!(annotated.code, "unannotated_connector");
        assert_eq!(annotated.detail, "J? is not annotated");
        assert_eq!(annotated.pad, None);
        let component = unannotated_diagnostic("R?", "/root/r", false);
        assert_eq!(component.code, "unannotated_component");
        assert_eq!(component.detail, "R? is not annotated");

        // `f"{reference}.{pad} carries {len(nets)} schematic nets"` (:419).
        let ambiguous = ambiguous_diagnostic("J1", "A4", "/root/j", 2);
        assert_eq!(ambiguous.code, "pin_net_ambiguous");
        assert_eq!(ambiguous.detail, "J1.A4 carries 2 schematic nets");
        assert_eq!(ambiguous.pad.as_deref(), Some("A4"));
    }

    #[test]
    fn dnp_is_false_for_an_unannotated_reference() {
        // A `?` reference is never in the resolver's default assembly
        // (semantic_index_variants.py:115-122), and the guard keeps that even
        // if the set were poisoned.
        let mut poisoned = BTreeSet::new();
        poisoned.insert("R?".to_owned());
        poisoned.insert("J?".to_owned());
        assert!(!is_dnp(&poisoned, "R?"));
        assert!(!is_dnp(&poisoned, "J?"));
        assert!(!is_dnp(&BTreeSet::new(), "R6"));

        let mut default = BTreeSet::new();
        default.insert("R6".to_owned());
        assert!(is_dnp(&default, "R6"));
    }
}
