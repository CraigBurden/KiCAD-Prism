//! The findings catalogue (`docs/system-builder/CONTRACTS.md` §9): each code
//! has a fixed severity; waivers match by code and subject.

use crate::input::Waiver;
use crate::output::FindingOut;
use std::collections::BTreeSet;

/// Every code with its severity, in the contract's order.
pub const CATALOGUE: [(&str, &str); 25] = [
    ("occurrence-pending", "info"),
    ("occurrence-absent", "error"),
    ("occurrence-unsupported", "info"),
    ("connector-missing", "error"),
    ("not-a-connector", "warning"),
    ("pin-missing", "error"),
    ("mate-manual-override", "warning"),
    ("mate-unresolved", "error"),
    ("mate-pins-unmapped", "warning"),
    ("link-pins-unmapped", "warning"),
    ("duplicate-net-extra", "warning"),
    ("power-join-suggested", "info"),
    ("splice-proposed", "warning"),
    ("harness-end-unattached", "info"),
    ("net-name-conflict", "warning"),
    ("power-net-conflict", "warning"),
    ("board-sub-port-missing", "error"),
    ("board-sub-port-deleted", "error"),
    ("board-sub-port-changed", "warning"),
    ("entry-unreleased", "error"),
    ("entry-archived", "warning"),
    ("export-missing", "error"),
    ("mate-misaligned", "warning"),
    ("pose-ignored", "info"),
    ("positioning-mate-ignored", "warning"),
];

fn severity(code: &str) -> &'static str {
    CATALOGUE
        .iter()
        .find(|(known, _)| *known == code)
        .map_or("error", |(_, severity)| severity)
}

/// The findings a build collects.
#[derive(Debug, Default)]
pub struct Findings {
    items: Vec<FindingOut>,
    seen: BTreeSet<(&'static str, String)>,
}

impl Findings {
    /// Record a finding once per code and subject; `objects` are document ids.
    pub fn add(&mut self, code: &'static str, subject: String, message: String, objects: &[&str]) {
        if !self.seen.insert((code, subject.clone())) {
            return;
        }
        let mut objects: Vec<String> = objects.iter().map(|id| (*id).to_owned()).collect();
        objects.sort();
        objects.dedup();
        self.items.push(FindingOut {
            code,
            severity: severity(code),
            subject,
            message,
            objects,
            waived: false,
        });
    }

    /// The findings, waivers applied, sorted by code then subject.
    pub fn finish(mut self, waivers: &[Waiver]) -> Vec<FindingOut> {
        for item in &mut self.items {
            item.waived = item.severity != "info"
                && waivers
                    .iter()
                    .any(|waiver| waiver.code == item.code && waiver.subject == item.subject);
        }
        self.items
            .sort_by(|a, b| a.code.cmp(b.code).then_with(|| a.subject.cmp(&b.subject)));
        self.items
    }
}
