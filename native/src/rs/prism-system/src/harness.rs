//! Harness wire lists and part checks (`docs/system-builder/CONTRACTS.md`
//! §16.3–§16.4): each block's ends with the cavities in use, every conductor
//! (explicit wires, then the links' default wires), and the checks that read
//! the harness parts from `--parts`.

use crate::context::Context;
use crate::input::{Cable, End, Harness, HarnessFacts, PartFacts, PartRef, Terminal, Wire};
use crate::natural;
use crate::output::{
    CavityOut, HarnessEndOut, HarnessOut, HarnessWireOut, LinkOut, NetOut, TerminalOut,
};
use std::collections::{BTreeMap, BTreeSet};

/// `(occurrence, connector, pad)` → system net id.
type NetOf = BTreeMap<(String, String, String), String>;

/// The wire list of every harness block, in document order; records §16.4's findings.
pub fn resolve(cx: &mut Context<'_>, links: &[LinkOut], nets: &[NetOut]) -> Vec<HarnessOut> {
    let mut net_of = NetOf::new();
    for net in nets {
        for pin in &net.pins {
            let key = (
                pin.occurrence.clone(),
                pin.connector.clone(),
                pin.pad.clone(),
            );
            net_of.insert(key, net.id.clone());
        }
    }
    let doc = cx.doc;
    doc.harnesses
        .iter()
        .map(|harness| harness_out(cx, harness, links, &net_of))
        .collect()
}

fn harness_out(
    cx: &mut Context<'_>,
    harness: &Harness,
    links: &[LinkOut],
    net_of: &NetOf,
) -> HarnessOut {
    let mut wires: Vec<HarnessWireOut> = harness
        .wires
        .iter()
        .map(|wire| explicit_wire(cx, harness, wire, net_of))
        .collect();
    for link in harness.links.iter() {
        let Some(out) = links
            .iter()
            .find(|out| out.harness == harness.id && out.link == link.id)
        else {
            continue;
        };
        let end_a = end_at(harness, &link.a.occurrence, &link.a.connector);
        let end_b = end_at(harness, &link.b.occurrence, &link.b.connector);
        for wire in out.wires.iter().filter(|wire| wire.rule != "explicit") {
            let key = (
                link.a.occurrence.clone(),
                link.a.connector.clone(),
                wire.a.clone(),
            );
            wires.push(HarnessWireOut {
                id: format!("{}:{}", link.id, wire.a),
                origin: "default",
                link: Some(link.id.clone()),
                from: contact_at(end_a, &wire.a),
                to: contact_at(end_b, &wire.b),
                gauge_awg: None,
                colour: None,
                label: None,
                cable: None,
                conductor: None,
                net: net_of.get(&key).cloned(),
                suggested: wire.suggested,
            });
        }
    }
    let ends = harness
        .ends
        .iter()
        .map(|end| end_out(cx, harness, end, &wires, net_of))
        .collect();
    check_cables(cx, harness);
    check_gauges(cx, harness, &wires);
    HarnessOut {
        harness: harness.id.clone(),
        ends,
        wires,
    }
}

fn end_at<'h>(harness: &'h Harness, occurrence: &str, connector: &str) -> Option<&'h End> {
    harness.ends.iter().find(|end| {
        end.site
            .as_ref()
            .is_some_and(|site| site.occurrence == occurrence && site.connector == connector)
    })
}

/// The board pad a cavity lands on: `pinMap`, else the same name.
fn cavity_pad(end: &End, cavity: &str) -> String {
    end.pin_map
        .iter()
        .find(|pair| pair.cavity == cavity)
        .map_or_else(|| cavity.to_owned(), |pair| pair.pad.clone())
}

/// The cavity a board pad sits in: `pinMap` read backwards, else the same name.
fn pad_cavity(end: &End, pad: &str) -> String {
    end.pin_map
        .iter()
        .find(|pair| pair.pad == pad)
        .map_or_else(|| pad.to_owned(), |pair| pair.cavity.clone())
}

fn contact_at(end: Option<&End>, pad: &str) -> TerminalOut {
    TerminalOut {
        kind: "contact",
        end: end.map(|end| end.id.clone()),
        cavity: Some(end.map_or_else(|| pad.to_owned(), |end| pad_cavity(end, pad))),
        pad: Some(pad.to_owned()),
        splice: None,
        loose_end: None,
    }
}

/// A terminal as written, with its pad; `None` when it names nothing the harness has.
fn terminal_out(harness: &Harness, terminal: &Terminal) -> Option<TerminalOut> {
    let mut out = TerminalOut {
        kind: "contact",
        end: None,
        cavity: None,
        pad: None,
        splice: None,
        loose_end: None,
    };
    match terminal.kind.as_str() {
        "contact" => {
            let end = harness
                .ends
                .iter()
                .find(|end| Some(&end.id) == terminal.end.as_ref())?;
            let cavity = terminal
                .cavity
                .clone()
                .filter(|cavity| !cavity.is_empty())?;
            if end.site.is_some() {
                out.pad = Some(cavity_pad(end, &cavity));
            }
            out.end = Some(end.id.clone());
            out.cavity = Some(cavity);
        }
        "splice" => {
            let splice = terminal.splice.as_ref()?;
            harness.splices.iter().find(|item| &item.id == splice)?;
            out.kind = "splice";
            out.splice = Some(splice.clone());
        }
        "loose" => {
            let loose = terminal.loose_end.as_ref()?;
            harness.loose_ends.iter().find(|item| &item.id == loose)?;
            out.kind = "loose";
            out.loose_end = Some(loose.clone());
        }
        _ => return None,
    }
    Some(out)
}

fn explicit_wire(
    cx: &mut Context<'_>,
    harness: &Harness,
    wire: &Wire,
    net_of: &NetOf,
) -> HarnessWireOut {
    let from = terminal_out(harness, &wire.from);
    let to = terminal_out(harness, &wire.to);
    if from.is_none() || to.is_none() {
        let message = format!(
            "{}: wire {} names an end, cavity, splice or loose end the harness lacks",
            harness.label, wire.id
        );
        cx.findings.add(
            "wire-terminal-invalid",
            format!("wire:{}", wire.id),
            message,
            &[&harness.id, &wire.id],
        );
    }
    let as_written = |terminal: &Terminal| TerminalOut {
        kind: match terminal.kind.as_str() {
            "splice" => "splice",
            "loose" => "loose",
            _ => "contact",
        },
        end: terminal.end.clone(),
        cavity: terminal.cavity.clone(),
        pad: None,
        splice: terminal.splice.clone(),
        loose_end: terminal.loose_end.clone(),
    };
    let from = from.unwrap_or_else(|| as_written(&wire.from));
    let to = to.unwrap_or_else(|| as_written(&wire.to));
    let net = [&from, &to]
        .into_iter()
        .filter_map(|terminal| site_pin(harness, terminal))
        .find_map(|key| net_of.get(&key).cloned());
    let (cable, conductor) = carrier(&harness.cables, &wire.id).unzip();
    HarnessWireOut {
        id: wire.id.clone(),
        origin: "explicit",
        link: wire.link.clone(),
        from,
        to,
        gauge_awg: wire.gauge_awg.clone().filter(|gauge| !gauge.is_empty()),
        colour: wire.colour.clone().filter(|colour| !colour.is_empty()),
        label: wire.label.clone().filter(|label| !label.is_empty()),
        cable,
        conductor,
        net,
        // A wire the user drew or confirmed is not a suggestion (§8.5).
        suggested: false,
    }
}

/// The cable and conductor that carry a wire.
fn carrier(cables: &[Cable], wire: &str) -> Option<(String, String)> {
    cables.iter().find_map(|cable| {
        cable
            .conductors
            .iter()
            .find(|conductor| conductor.wire.as_deref() == Some(wire))
            .map(|conductor| (cable.id.clone(), conductor.name.clone()))
    })
}

/// The board pin a contact terminal lands on.
fn site_pin(harness: &Harness, terminal: &TerminalOut) -> Option<(String, String, String)> {
    let end = harness
        .ends
        .iter()
        .find(|end| Some(&end.id) == terminal.end.as_ref())?;
    let site = end.site.as_ref()?;
    Some((
        site.occurrence.clone(),
        site.connector.clone(),
        terminal.pad.clone()?,
    ))
}

// ------------------------------------------------------------------- ends

/// A referenced part and its resolved key, or `None` (and the finding) when
/// the catalog lacks it.
fn part<'p>(
    cx: &mut Context<'p>,
    reference: &PartRef,
    subject: String,
    what: &str,
    objects: &[&str],
) -> Option<&'p PartFacts> {
    let members = cx.members;
    let found = members.parts.get(&reference.key());
    if found.is_none() {
        let message = match reference.revision_id {
            Some(_) => format!("{what} part {} is not in the catalog", reference.key()),
            None => format!(
                "{what} part {} is not in the catalog or has no released revision",
                reference.key()
            ),
        };
        cx.findings
            .add("harness-part-missing", subject, message, objects);
    }
    found
}

fn resolved(facts: &PartFacts) -> String {
    format!("{}@{}", facts.component_id, facts.revision_id)
}

fn end_out(
    cx: &mut Context<'_>,
    harness: &Harness,
    end: &End,
    wires: &[HarnessWireOut],
    net_of: &NetOf,
) -> HarnessEndOut {
    let subject = format!("end:{}", end.id);
    let objects = [harness.id.as_str(), end.id.as_str()];
    let mut used: BTreeSet<String> = BTreeSet::new();
    for wire in wires {
        for terminal in [&wire.from, &wire.to] {
            if terminal.end.as_ref() == Some(&end.id) {
                used.extend(terminal.cavity.clone());
            }
        }
    }
    let mut used: Vec<String> = used.into_iter().collect();
    natural::sort(&mut used);
    let mut contacts: BTreeMap<String, &PartFacts> = BTreeMap::new();
    for (cavity, reference) in &end.contacts {
        if let Some(facts) = part(cx, reference, subject.clone(), "Contact", &objects) {
            contacts.insert(cavity.clone(), facts);
        }
    }
    let housing = end
        .housing
        .as_ref()
        .and_then(|reference| part(cx, reference, subject.clone(), "Housing", &objects));
    if let Some(housing) = housing {
        check_housing(cx, harness, end, housing, &used, &contacts);
    }
    let cavities = used
        .iter()
        .map(|cavity| {
            let pad = cavity_pad(end, cavity);
            let net = end.site.as_ref().and_then(|site| {
                let key = (site.occurrence.clone(), site.connector.clone(), pad.clone());
                net_of.get(&key).cloned()
            });
            CavityOut {
                cavity: cavity.clone(),
                pad,
                net,
                contact: contacts.get(cavity).map(|facts| resolved(facts)),
            }
        })
        .collect();
    HarnessEndOut {
        end: end.id.clone(),
        occurrence: end.site.as_ref().map(|site| site.occurrence.clone()),
        connector: end.site.as_ref().map(|site| site.connector.clone()),
        housing: housing.map(resolved),
        cavities,
    }
}

fn squeezed(text: &str) -> String {
    text.chars()
        .filter(|c| !c.is_whitespace())
        .flat_map(char::to_uppercase)
        .collect()
}

fn check_housing(
    cx: &mut Context<'_>,
    harness: &Harness,
    end: &End,
    housing: &PartFacts,
    used: &[String],
    contacts: &BTreeMap<String, &PartFacts>,
) {
    let subject = format!("end:{}", end.id);
    let objects = [harness.id.as_str(), end.id.as_str()];
    let facts = housing.harness.clone().unwrap_or_default();
    if let Some(site) = &end.site
        && let Some(message) = not_mating(cx, &site.occurrence, &site.connector, housing)
    {
        cx.findings
            .add("housing-not-mating", subject.clone(), message, &objects);
    }
    if let Some(cavities) = facts.cavities {
        let mapped = end.pin_map.iter().map(|pair| &pair.cavity);
        let over = used
            .iter()
            .chain(mapped)
            .filter_map(|cavity| cavity.parse::<u32>().ok())
            .filter(|number| *number > cavities)
            .max();
        if let Some(over) = over {
            let message = format!(
                "{}: cavity {over} is used but the housing {} has {cavities}",
                harness.label, housing.name
            );
            cx.findings
                .add("housing-cavities-short", subject.clone(), message, &objects);
        }
    }
    if let Some(family) = facts.contact_family.as_deref() {
        let odd = contacts.iter().find(|(_, contact)| {
            contact
                .harness
                .as_ref()
                .and_then(|facts| facts.contact_family.as_deref())
                .is_some_and(|other| !other.eq_ignore_ascii_case(family))
        });
        if let Some((cavity, contact)) = odd {
            let message = format!(
                "{}: the contact {} in cavity {cavity} is not of the housing's family {family}",
                harness.label, contact.name
            );
            cx.findings
                .add("contact-family-mismatch", subject, message, &objects);
        }
    }
}

/// Why the housing does not mate with the site's connector, or `None` when it
/// does or when that cannot be told (a board connector without an MPN).
fn not_mating(
    cx: &Context<'_>,
    occurrence: &str,
    connector: &str,
    housing: &PartFacts,
) -> Option<String> {
    let body_part = cx
        .doc
        .body_connectors
        .iter()
        .find(|item| item.occurrence == occurrence && item.refdes == connector)
        .map(|item| item.part.component_id.clone());
    let mates = if let Some(component) = body_part {
        housing
            .mates_with
            .iter()
            .any(|mate| mate.component_id == component)
    } else {
        let mpn = cx
            .board(occurrence)
            .and_then(|board| board.component(connector))
            .and_then(|component| component.mpn.as_deref())
            .map(squeezed)
            .filter(|mpn| !mpn.is_empty())?;
        housing
            .mates_with
            .iter()
            .filter_map(|mate| mate.mpn.as_deref())
            .any(|other| squeezed(other) == mpn)
    };
    (!mates).then(|| {
        format!(
            "The housing {} does not list {} {connector} in mates with",
            housing.name,
            cx.label(occurrence)
        )
    })
}

// --------------------------------------------------------- wires and cables

/// An AWG size as a number, thicker sizes smaller: `"0"` is 0, `"00"` and
/// `"2/0"` are -1, `"000"` and `"3/0"` are -2.
fn awg(text: &str) -> Option<i32> {
    let text = text.trim();
    if let Some(aughts) = text.strip_suffix("/0") {
        return aughts.parse::<i32>().ok().map(|n| 1 - n);
    }
    if !text.is_empty() && text.chars().all(|c| c == '0') {
        return Some(1 - text.len() as i32);
    }
    text.parse::<i32>().ok()
}

fn in_range(facts: &HarnessFacts, gauge: i32) -> Option<bool> {
    let low = awg(facts.gauge_min_awg.as_deref()?)?;
    let high = awg(facts.gauge_max_awg.as_deref()?)?;
    Some((low.min(high)..=low.max(high)).contains(&gauge))
}

fn check_gauges(cx: &mut Context<'_>, harness: &Harness, wires: &[HarnessWireOut]) {
    let members = cx.members;
    let mut unknown = 0;
    for wire in wires {
        let Some(gauge) = wire.gauge_awg.as_deref().and_then(awg) else {
            unknown += 1;
            continue;
        };
        for terminal in [&wire.from, &wire.to] {
            let contact = harness
                .ends
                .iter()
                .find(|end| Some(&end.id) == terminal.end.as_ref())
                .zip(terminal.cavity.as_ref())
                .and_then(|(end, cavity)| end.contacts.get(cavity))
                .and_then(|reference| members.parts.get(&reference.key()));
            let Some(contact) = contact else { continue };
            let fits = contact
                .harness
                .as_ref()
                .and_then(|facts| in_range(facts, gauge));
            if fits == Some(false) {
                let gauge_text = wire.gauge_awg.clone().unwrap_or_default();
                let message = format!(
                    "{}: wire {} is {gauge_text} AWG, outside the contact {}'s range",
                    harness.label, wire.id, contact.name
                );
                cx.findings.add(
                    "contact-gauge-mismatch",
                    format!("wire:{}", wire.id),
                    message,
                    &[&harness.id],
                );
                break;
            }
        }
    }
    if unknown > 0 {
        let message = if unknown == 1 {
            format!("{}: 1 wire has no gauge", harness.label)
        } else {
            format!("{}: {unknown} wires have no gauge", harness.label)
        };
        cx.findings.add(
            "wire-gauge-unknown",
            format!("harness:{}", harness.id),
            message,
            &[&harness.id],
        );
    }
}

fn check_cables(cx: &mut Context<'_>, harness: &Harness) {
    for cable in &harness.cables {
        let subject = format!("cable:{}", cable.id);
        let objects = [harness.id.as_str(), cable.id.as_str()];
        let Some(reference) = &cable.part else {
            continue;
        };
        let Some(facts) = part(cx, reference, subject.clone(), "Cable", &objects) else {
            continue;
        };
        let expected = facts.harness.as_ref().and_then(|facts| facts.conductors);
        if let Some(expected) = expected {
            let listed = cable.conductors.len();
            if listed != expected as usize {
                let message = format!(
                    "{}: the cable lists {listed} conductors but its part {} has {expected}",
                    harness.label, facts.name
                );
                cx.findings
                    .add("cable-conductors-mismatch", subject, message, &objects);
            }
        }
    }
    for covering in &harness.coverings {
        if let Some(reference) = &covering.part {
            let subject = format!("covering:{}", covering.id);
            let objects = [harness.id.as_str(), covering.id.as_str()];
            part(cx, reference, subject, "Covering", &objects);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::awg;

    #[test]
    fn awg_orders_thicker_sizes_lower() {
        assert_eq!(awg("24"), Some(24));
        assert_eq!(awg("0"), Some(0));
        assert_eq!(awg("00"), Some(-1));
        assert_eq!(awg("2/0"), Some(-1));
        assert_eq!(awg("000"), Some(-2));
        assert_eq!(awg("x"), None);
    }
}
