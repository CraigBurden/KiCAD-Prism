//! Sub-port suggestions read from the bundle (`docs/system-builder/CONTRACTS.md` §8.6).

use crate::build::{Named, shown};
use crate::context::{Context, first_net, leaf, pads, pin, power};
use crate::input::{Board, InterfaceComponent};
use crate::natural;
use crate::output::SuggestionOut;
use std::collections::{BTreeMap, BTreeSet};

/// Every suggestion not dismissed and not already accepted, sorted by occurrence, connector and key.
pub fn suggest(cx: &Context<'_>, named: &Named) -> Vec<SuggestionOut> {
    let dismissed: BTreeSet<(&str, &str, &str)> = cx
        .doc
        .dismissed_suggestions
        .iter()
        .map(|item| {
            (
                item.occurrence.as_str(),
                item.connector.as_str(),
                item.key.as_str(),
            )
        })
        .collect();
    let accepted: BTreeSet<(&str, &str, &str)> = cx
        .doc
        .sub_ports
        .iter()
        .filter_map(|sub_port| {
            Some((
                sub_port.occurrence.as_str(),
                sub_port.connector.as_str(),
                sub_port.suggestion.as_deref()?,
            ))
        })
        .collect();
    let mut out = Vec::new();
    for (occurrence, board) in &cx.members.boards {
        for component in board
            .interface
            .components
            .iter()
            .filter(|c| shown(c, occurrence, named))
        {
            for suggestion in for_connector(occurrence, board, component) {
                let key = (
                    occurrence.as_str(),
                    component.reference.as_str(),
                    suggestion.key.as_str(),
                );
                if !dismissed.contains(&key) && !accepted.contains(&key) {
                    out.push(suggestion);
                }
            }
        }
    }
    out.sort_by(|a, b| {
        a.occurrence
            .cmp(&b.occurrence)
            .then_with(|| a.connector.cmp(&b.connector))
            .then_with(|| a.key.cmp(&b.key))
    });
    out
}

fn for_connector(
    occurrence: &str,
    board: &Board,
    component: &InterfaceComponent,
) -> Vec<SuggestionOut> {
    let nets: Vec<(String, String)> = pads(component)
        .into_iter()
        .filter_map(|pad| {
            let net = pin(component, &pad).and_then(first_net)?.to_owned();
            Some((pad, net))
        })
        .collect();
    let make = |key: String, name: String, source: &'static str, mut pins: Vec<String>| {
        natural::sort(&mut pins);
        pins.dedup();
        (pins.len() >= 2).then(|| SuggestionOut {
            occurrence: occurrence.to_owned(),
            connector: component.reference.clone(),
            key,
            name,
            source,
            pins,
        })
    };
    let mut out = Vec::new();
    for alias in &board.semantic.bus_aliases {
        let members: BTreeSet<&str> = alias.members.iter().map(String::as_str).collect();
        let pins = nets
            .iter()
            .filter(|(_, net)| members.contains(leaf(net)))
            .map(|(pad, _)| pad.clone())
            .collect();
        out.extend(make(
            format!("bus:{}", alias.name),
            alias.name.clone(),
            "bus-alias",
            pins,
        ));
    }
    let mut sheets: BTreeMap<&str, Vec<String>> = BTreeMap::new();
    for (pad, net) in &nets {
        if let Some(only) = board
            .semantic
            .net_sheets
            .get(net)
            .filter(|set| set.len() == 1)
            .and_then(|set| set.first())
        {
            sheets.entry(only.as_str()).or_default().push(pad.clone());
        }
    }
    if sheets.len() > 1 {
        for (sheet, pins) in sheets {
            let name = sheet
                .trim_matches('/')
                .rsplit('/')
                .next()
                .unwrap_or(sheet)
                .to_owned();
            out.extend(make(
                format!("sheet:{sheet}"),
                if name.is_empty() {
                    "Root".to_owned()
                } else {
                    name
                },
                "sheet",
                pins,
            ));
        }
    }
    let powered = |pad: &str| pin(component, pad).is_some_and(power);
    for (prefix, pins) in families(&nets, &powered) {
        out.extend(make(format!("family:{prefix}"), prefix, "family", pins));
    }
    let power_pins = nets
        .iter()
        .map(|(pad, _)| pad.clone())
        .filter(|pad| powered(pad))
        .collect();
    out.extend(make(
        "power".to_owned(),
        "Power".to_owned(),
        "power",
        power_pins,
    ));
    out
}

/// Net-name families: a prefix before the last `_`, or a stem whose names
/// differ only in a trailing `+`/`-` or `P`/`N`. Power and ground pins are left
/// to the power suggestion.
fn families(
    nets: &[(String, String)],
    powered: &dyn Fn(&str) -> bool,
) -> BTreeMap<String, Vec<String>> {
    let leaves: BTreeSet<&str> = nets.iter().map(|(_, net)| leaf(net)).collect();
    let mut groups: BTreeMap<String, Vec<(String, &str)>> = BTreeMap::new();
    for (pad, net) in nets.iter().filter(|(pad, _)| !powered(pad)) {
        let name = leaf(net);
        let stem = if let Some((prefix, _)) = name.rsplit_once('_') {
            Some(prefix)
        } else if let Some(stem) = name.strip_suffix('+').or_else(|| name.strip_suffix('-')) {
            Some(stem)
        } else {
            name.strip_suffix('P')
                .filter(|stem| leaves.contains(format!("{stem}N").as_str()))
                .or_else(|| {
                    name.strip_suffix('N')
                        .filter(|stem| leaves.contains(format!("{stem}P").as_str()))
                })
        };
        if let Some(stem) = stem.filter(|stem| !stem.is_empty()) {
            groups
                .entry(stem.to_owned())
                .or_default()
                .push((pad.clone(), name));
        }
    }
    // A family is two or more different nets; one net on many pins is not one.
    groups
        .into_iter()
        .filter(|(_, pins)| {
            pins.iter()
                .map(|(_, name)| *name)
                .collect::<BTreeSet<_>>()
                .len()
                >= 2
        })
        .map(|(stem, pins)| (stem, pins.into_iter().map(|(pad, _)| pad).collect()))
        .collect()
}
