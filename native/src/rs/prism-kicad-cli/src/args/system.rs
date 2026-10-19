//! `system build`'s repeated options: members, their revision keys, the absent
//! occurrences, board-level sub-ports and published entries
//! (`docs/system-builder/CONTRACTS.md` §8.8, §10.5, §12.2).

use super::{Outcome, Raw, SystemEntryArg, SystemMemberArg, conflict, is_hex64, usage};
use prism_bundle::Failure;
use std::collections::{BTreeMap, BTreeSet};

/// The options of `system build` (CONTRACTS.md §8.8): `--document`, `-o`,
/// each member's revision key, the absent occurrences, board-level sub-ports
/// and published entries.
pub(super) fn check_system(raw: &Raw) -> Outcome<()> {
    if !raw.options.contains_key("document") {
        // `CliArgument` has no `document` value: the message names it.
        return Err(usage("system build takes --document <system.json>"));
    }
    if !raw.options.contains_key("output") {
        return Err(usage("system build takes -o <system-bundle.json>").argument("output"));
    }
    if !raw.positional.is_empty() {
        return Err(usage("system build takes no positional argument").argument("command"));
    }
    system_of(raw).map(|_| ())
}

/// `system build`'s members and absent occurrences, from the repeated options.
/// `<occurrence>=<value>` of one repeated `system build` option.
fn occurrence_pair(value: &str, option: &'static str) -> Outcome<(String, String)> {
    // `CliArgument` names the revision key, not the member option.
    let argument = match option {
        "member" => Some("member"),
        "member-revision-key" => Some("revision-key"),
        _ => None,
    };
    let form = || {
        let failure = usage(format!("--{option} takes <occurrence>=<value>"));
        match argument {
            Some(argument) => failure.argument(argument),
            None => failure,
        }
    };
    let (occurrence, rest) = value.split_once('=').ok_or_else(form)?;
    if occurrence.is_empty() || rest.is_empty() {
        return Err(form());
    }
    Ok((occurrence.to_owned(), rest.to_owned()))
}

fn system_bundles(raw: &Raw) -> Outcome<BTreeMap<String, String>> {
    let mut bundles = BTreeMap::new();
    for value in &raw.members {
        let (occurrence, bundle) = occurrence_pair(value, "member")?;
        if bundles.insert(occurrence.clone(), bundle).is_some() {
            return Err(conflict(
                format!("--member names {occurrence:?} twice"),
                "member",
            ));
        }
    }
    Ok(bundles)
}

fn system_revision_keys(raw: &Raw) -> Outcome<BTreeMap<String, String>> {
    let mut keys = BTreeMap::new();
    for value in &raw.member_revision_keys {
        let (occurrence, key) = occurrence_pair(value, "member-revision-key")?;
        if !is_hex64(&key) {
            return Err(usage("--member-revision-key takes 64 lowercase hex digits")
                .argument("revision-key"));
        }
        if keys.insert(occurrence.clone(), key).is_some() {
            // `CliArgument` has no `member-revision-key`: it is a revision key.
            return Err(conflict(
                format!("--member-revision-key names {occurrence:?} twice"),
                "revision-key",
            ));
        }
    }
    Ok(keys)
}

fn system_absent(raw: &Raw, bundles: &BTreeMap<String, String>) -> Outcome<BTreeSet<String>> {
    let mut absent = BTreeSet::new();
    for value in &raw.absent {
        if value.is_empty() {
            return Err(usage("--absent takes <occurrence>"));
        }
        if !absent.insert(value.clone()) {
            return Err(usage(format!("--absent names {value:?} twice")));
        }
    }
    if let Some(occurrence) = absent
        .iter()
        .find(|occurrence| bundles.contains_key(occurrence.as_str()))
    {
        return Err(conflict(
            format!("{occurrence:?} is both --member and --absent"),
            "member",
        ));
    }
    Ok(absent)
}

/// An `option-conflict` about an option `CliArgument` cannot spell.
fn option_conflict(message: impl Into<String>) -> Failure {
    Failure::usage("option-conflict", message)
}

/// A catalog revision stage: 1 to 32 characters of `[a-z_]` (CONTRACTS.md §12.2).
fn is_stage(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 32
        && value
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
}

fn entry_stages(raw: &Raw) -> Outcome<BTreeMap<String, String>> {
    let mut stages = BTreeMap::new();
    for value in &raw.entry_stages {
        let (occurrence, stage) = occurrence_pair(value, "entry-stage")?;
        if !is_stage(&stage) {
            return Err(usage("--entry-stage takes 1 to 32 characters of a-z and _"));
        }
        if stages.insert(occurrence.clone(), stage).is_some() {
            return Err(option_conflict(format!(
                "--entry-stage names {occurrence:?} twice"
            )));
        }
    }
    Ok(stages)
}

/// Each `--entry` takes exactly one `--entry-stage` for the same occurrence,
/// and an occurrence is named by at most one of `--entry`, `--member` and
/// `--absent`.
fn system_entries(
    raw: &Raw,
    bundles: &BTreeMap<String, String>,
    absent: &BTreeSet<String>,
) -> Outcome<BTreeMap<String, SystemEntryArg>> {
    let mut payloads = BTreeMap::new();
    for value in &raw.entries {
        let (occurrence, payload) = occurrence_pair(value, "entry")?;
        if payloads.insert(occurrence.clone(), payload).is_some() {
            return Err(option_conflict(format!(
                "--entry names {occurrence:?} twice"
            )));
        }
    }
    let stages = entry_stages(raw)?;
    if payloads.keys().ne(stages.keys()) {
        return Err(option_conflict(
            "each --entry takes exactly one --entry-stage for the same occurrence",
        ));
    }
    for occurrence in payloads.keys() {
        if bundles.contains_key(occurrence) {
            return Err(option_conflict(format!(
                "{occurrence:?} is both --entry and --member"
            )));
        }
        if absent.contains(occurrence) {
            return Err(option_conflict(format!(
                "{occurrence:?} is both --entry and --absent"
            )));
        }
    }
    Ok(payloads
        .into_iter()
        .map(|(occurrence, payload)| {
            let stage = stages[&occurrence].clone();
            (occurrence, SystemEntryArg { payload, stage })
        })
        .collect())
}

pub(super) type SystemOptions = (
    BTreeMap<String, SystemMemberArg>,
    BTreeSet<String>,
    Option<String>,
    BTreeMap<String, SystemEntryArg>,
);

pub(super) fn system_of(raw: &Raw) -> Outcome<SystemOptions> {
    let bundles = system_bundles(raw)?;
    let keys = system_revision_keys(raw)?;
    if bundles.keys().ne(keys.keys()) {
        return Err(conflict(
            "each --member takes exactly one --member-revision-key for the same occurrence",
            "revision-key",
        ));
    }
    let absent = system_absent(raw, &bundles)?;
    let entries = system_entries(raw, &bundles, &absent)?;
    let board_sub_ports = raw.options.get("board-sub-ports").cloned();
    let members = bundles
        .into_iter()
        .map(|(occurrence, bundle)| {
            let revision_key = keys.get(&occurrence).cloned().unwrap_or_default();
            (
                occurrence,
                SystemMemberArg {
                    bundle,
                    revision_key,
                },
            )
        })
        .collect();
    Ok((members, absent, board_sub_ports, entries))
}
