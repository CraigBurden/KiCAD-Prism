//! Harness wiring (`docs/system-builder/CONTRACTS.md` §8.5): each link's
//! explicit wires, then sub-port order or equal net names; the shared pins
//! that become proposed splices; and every explicit wire as a net edge.

use crate::build::pin_node;
use crate::context::{Context, first_net, pin, power};
use crate::input::{End, Harness, InterfaceComponent, Link, Terminal};
use crate::natural;
use crate::nets::{Edge, Node};
use crate::output::{LinkOut, SpliceOut, WireOut};
use std::collections::{BTreeMap, BTreeSet};

/// What wiring produces besides net edges.
pub struct Wired {
    /// Link wirings, by harness then link.
    pub links: Vec<LinkOut>,
    /// Proposed splices.
    pub splices: Vec<SpliceOut>,
}

/// Wire every link of every harness; push the net edges onto `edges`.
pub fn wire(cx: &mut Context<'_>, edges: &mut Vec<Edge>) -> Wired {
    let mut wired = Wired {
        links: Vec::new(),
        splices: Vec::new(),
    };
    for harness in &cx.doc.harnesses {
        for end in harness.ends.iter().filter(|end| end.site.is_none()) {
            let message = format!("{}: an end has no connector yet", harness.label);
            cx.findings.add(
                "harness-end-unattached",
                format!("end:{}", end.id),
                message,
                &[&harness.id, &end.id],
            );
        }
        let mut uses: Uses = BTreeMap::new();
        for link in &harness.links {
            let out = wire_link(cx, harness, link);
            record_wires(harness, link, &out, edges, &mut uses);
            wired.links.push(out);
        }
        explicit_edges(harness, edges);
        propose_splices(cx, harness, uses, &mut wired.splices);
    }
    wired
        .links
        .sort_by(|a, b| a.harness.cmp(&b.harness).then_with(|| a.link.cmp(&b.link)));
    wired.splices.sort_by(|a, b| {
        a.harness
            .cmp(&b.harness)
            .then_with(|| a.end.cmp(&b.end))
            .then_with(|| natural::cmp(&a.pad, &b.pad))
    });
    wired
}

/// Which links use each `(end, pad)`, for proposing splices.
type Uses = BTreeMap<(String, String), BTreeSet<String>>;

/// A link's wires as graph edges, and which end pads they use.
fn record_wires(
    harness: &Harness,
    link: &Link,
    out: &LinkOut,
    edges: &mut Vec<Edge>,
    uses: &mut Uses,
) {
    for wire in &out.wires {
        edges.push((
            pin_node(&link.a.occurrence, &link.a.connector, &wire.a),
            pin_node(&link.b.occurrence, &link.b.connector, &wire.b),
        ));
        for (endpoint, pad) in [(&link.a, &wire.a), (&link.b, &wire.b)] {
            if let Some(end) = end_at(harness, &endpoint.occurrence, &endpoint.connector) {
                uses.entry((end.id.clone(), pad.clone()))
                    .or_default()
                    .insert(link.id.clone());
            }
        }
    }
}

fn end_at<'h>(harness: &'h Harness, occurrence: &str, connector: &str) -> Option<&'h End> {
    harness.ends.iter().find(|end| {
        end.site
            .as_ref()
            .is_some_and(|site| site.occurrence == occurrence && site.connector == connector)
    })
}

/// The board pad a cavity of an end lands on.
fn cavity_pad(end: &End, cavity: &str) -> String {
    end.pin_map
        .iter()
        .find(|pair| pair.cavity == cavity)
        .map_or_else(|| cavity.to_owned(), |pair| pair.pad.clone())
}

fn contact<'h>(harness: &'h Harness, terminal: &Terminal) -> Option<(&'h End, String)> {
    if terminal.kind != "contact" {
        return None;
    }
    let end = harness
        .ends
        .iter()
        .find(|end| Some(&end.id) == terminal.end.as_ref())?;
    Some((end, cavity_pad(end, terminal.cavity.as_deref()?)))
}

/// The pads of one mating site that the harness's explicit wires reach.
fn wired_pads(harness: &Harness, occurrence: &str, connector: &str) -> BTreeSet<String> {
    harness
        .wires
        .iter()
        .flat_map(|wire| [&wire.from, &wire.to])
        .filter_map(|terminal| contact(harness, terminal))
        .filter(|(end, _)| {
            end.site
                .as_ref()
                .is_some_and(|site| site.occurrence == occurrence && site.connector == connector)
        })
        .map(|(_, pad)| pad)
        .collect()
}

struct SideOf<'a> {
    component: &'a InterfaceComponent,
    pins: Vec<String>,
    sub_port: bool,
}

fn explicit_pairs(harness: &Harness, link: &Link) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    for wire in harness
        .wires
        .iter()
        .filter(|wire| wire.link.as_ref() == Some(&link.id))
    {
        let (Some((end_x, pad_x)), Some((end_y, pad_y))) =
            (contact(harness, &wire.from), contact(harness, &wire.to))
        else {
            continue;
        };
        let on_a = |end: &End| {
            end.site.as_ref().is_some_and(|site| {
                site.occurrence == link.a.occurrence && site.connector == link.a.connector
            })
        };
        if on_a(end_x) {
            pairs.push((pad_x, pad_y));
        } else if on_a(end_y) {
            pairs.push((pad_y, pad_x));
        }
    }
    pairs
}

fn wire_link(cx: &mut Context<'_>, harness: &Harness, link: &Link) -> LinkOut {
    let objects = [harness.id.as_str(), link.id.as_str()];
    let mut out = LinkOut {
        harness: harness.id.clone(),
        link: link.id.clone(),
        wires: Vec::new(),
        unmapped_a: Vec::new(),
        unmapped_b: Vec::new(),
    };
    let a = cx.endpoint_pins(&link.a, &objects);
    let b = cx.endpoint_pins(&link.b, &objects);
    let (Some((component_a, pins_a)), Some((component_b, pins_b))) = (a, b) else {
        return out;
    };
    let side_a = SideOf {
        component: component_a,
        pins: pins_a,
        sub_port: link.a.sub_port.is_some(),
    };
    let side_b = SideOf {
        component: component_b,
        pins: pins_b,
        sub_port: link.b.sub_port.is_some(),
    };
    let explicit = explicit_pairs(harness, link);
    let explicit_a: Vec<String> = explicit.iter().map(|pair| pair.0.clone()).collect();
    let explicit_b: Vec<String> = explicit.iter().map(|pair| pair.1.clone()).collect();
    cx.existing_pads(&link.a.occurrence, component_a, &explicit_a, &objects);
    cx.existing_pads(&link.b.occurrence, component_b, &explicit_b, &objects);
    let cleared: BTreeSet<&String> = link.unmapped.iter().collect();
    // A pin an explicit wire reaches is wired by it, whatever the wire's far end.
    let taken_a = wired_pads(harness, &link.a.occurrence, &link.a.connector);
    let taken_b = wired_pads(harness, &link.b.occurrence, &link.b.connector);
    let mut plan = Plan {
        wires: explicit
            .into_iter()
            .map(|(a, b)| (a, b, "explicit"))
            .collect(),
        left_a: side_a
            .pins
            .iter()
            .filter(|pad| {
                !explicit_a.contains(pad) && !cleared.contains(pad) && !taken_a.contains(*pad)
            })
            .cloned()
            .collect(),
        left_b: side_b
            .pins
            .iter()
            .filter(|pad| !explicit_b.contains(pad) && !taken_b.contains(*pad))
            .cloned()
            .collect(),
        extra: false,
    };
    if side_a.sub_port && side_b.sub_port && side_a.pins.len() == side_b.pins.len() {
        let pairs: Vec<(String, String)> =
            plan.left_a.drain(..).zip(plan.left_b.drain(..)).collect();
        plan.wires
            .extend(pairs.into_iter().map(|(a, b)| (a, b, "sub-port-order")));
    } else {
        by_net_name(&side_a, &side_b, &mut plan);
    }
    finish_link(cx, (&side_a, &side_b), plan, &cleared, &mut out, &objects);
    out
}

/// One link's wiring while it is worked out.
struct Plan {
    wires: Vec<(String, String, &'static str)>,
    left_a: Vec<String>,
    left_b: Vec<String>,
    /// Whether a net had more pins on one side than the other.
    extra: bool,
}

fn net_groups(side: &SideOf<'_>, pads: &[String]) -> BTreeMap<String, Vec<String>> {
    let mut groups: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for pad in pads {
        if let Some(net) = pin(side.component, pad).and_then(first_net) {
            groups.entry(net.to_owned()).or_default().push(pad.clone());
        }
    }
    groups
}

fn by_net_name(side_a: &SideOf<'_>, side_b: &SideOf<'_>, plan: &mut Plan) {
    let groups_b = net_groups(side_b, &plan.left_b);
    let mut paired_a = BTreeSet::new();
    let mut paired_b = BTreeSet::new();
    for (net, mut pads_a) in net_groups(side_a, &plan.left_a) {
        let Some(mut pads_b) = groups_b.get(&net).cloned() else {
            continue;
        };
        natural::sort(&mut pads_a);
        natural::sort(&mut pads_b);
        plan.extra |= pads_a.len() != pads_b.len();
        for (a, b) in pads_a.into_iter().zip(pads_b) {
            paired_a.insert(a.clone());
            paired_b.insert(b.clone());
            plan.wires.push((a, b, "net-name"));
        }
    }
    plan.left_a.retain(|pad| !paired_a.contains(pad));
    plan.left_b.retain(|pad| !paired_b.contains(pad));
}

fn finish_link(
    cx: &mut Context<'_>,
    (side_a, side_b): (&SideOf<'_>, &SideOf<'_>),
    mut plan: Plan,
    cleared: &BTreeSet<&String>,
    out: &mut LinkOut,
    objects: &[&str],
) {
    let subject = format!("link:{}", out.link);
    if plan.extra {
        let message =
            "Some nets have more pins on one side than the other; splices are offered".to_owned();
        cx.findings
            .add("duplicate-net-extra", subject.clone(), message, objects);
    }
    let unmapped = plan.left_a.len() + plan.left_b.len();
    if unmapped > 0 {
        cx.findings.add(
            "link-pins-unmapped",
            subject.clone(),
            format!("{unmapped} pins are not wired"),
            objects,
        );
    }
    plan.left_a.extend(cleared.iter().map(|pad| (*pad).clone()));
    natural::sort(&mut plan.left_a);
    plan.left_a.dedup();
    plan.wires.sort_by(|x, y| natural::cmp(&x.0, &y.0));
    let is_power = |side: &SideOf<'_>, pad: &str| pin(side.component, pad).is_some_and(power);
    out.wires = plan
        .wires
        .into_iter()
        .map(|(a, b, rule)| {
            let suggested = is_power(side_a, &a) || is_power(side_b, &b);
            WireOut {
                a,
                b,
                rule,
                suggested,
            }
        })
        .collect();
    if out.wires.iter().any(|wire| wire.suggested) {
        let message = "Power and ground joins are suggested until confirmed".to_owned();
        cx.findings
            .add("power-join-suggested", subject, message, objects);
    }
    out.unmapped_a = plan.left_a;
    out.unmapped_b = plan.left_b;
}

fn terminal_node(harness: &Harness, terminal: &Terminal) -> Option<Node> {
    match terminal.kind.as_str() {
        "splice" => Some(Node::Splice(format!(
            "{}/{}",
            harness.id,
            terminal.splice.as_deref()?
        ))),
        "contact" => {
            let (end, pad) = contact(harness, terminal)?;
            let site = end.site.as_ref()?;
            Some(pin_node(&site.occurrence, &site.connector, &pad))
        }
        _ => None,
    }
}

fn explicit_edges(harness: &Harness, edges: &mut Vec<Edge>) {
    for wire in &harness.wires {
        if let (Some(x), Some(y)) = (
            terminal_node(harness, &wire.from),
            terminal_node(harness, &wire.to),
        ) {
            edges.push((x, y));
        }
    }
}

fn spliced(harness: &Harness, end: &str, pad: &str) -> bool {
    harness.wires.iter().any(|wire| {
        let ends = [(&wire.from, &wire.to), (&wire.to, &wire.from)];
        ends.iter().any(|(here, there)| {
            contact(harness, here).is_some_and(|(e, p)| e.id == end && p == pad)
                && there.kind == "splice"
                && harness
                    .splices
                    .iter()
                    .any(|splice| Some(&splice.id) == there.splice.as_ref() && splice.confirmed)
        })
    })
}

fn propose_splices(
    cx: &mut Context<'_>,
    harness: &Harness,
    uses: BTreeMap<(String, String), BTreeSet<String>>,
    splices: &mut Vec<SpliceOut>,
) {
    for ((end, pad), links) in uses {
        if links.len() < 2 || spliced(harness, &end, &pad) {
            continue;
        }
        let subject = format!("splice:{}/{end}/{pad}", harness.id);
        let message = format!(
            "{}: pin {pad} is wired to {} destinations with no confirmed splice",
            harness.label,
            links.len()
        );
        let mut objects: Vec<&str> = vec![&harness.id, &end];
        objects.extend(links.iter().map(String::as_str));
        cx.findings
            .add("splice-proposed", subject, message, &objects);
        splices.push(SpliceOut {
            harness: harness.id.clone(),
            end,
            pad,
            links: links.into_iter().collect(),
        });
    }
}
