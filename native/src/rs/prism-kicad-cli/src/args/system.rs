//! `system build`'s repeated options: members, their revision keys and the
//! absent occurrences (`docs/system-builder/CONTRACTS.md` §8.8).

use super::{Outcome, Raw, SystemMemberArg, conflict, is_hex64, usage};
use std::collections::{BTreeMap, BTreeSet};

/// The options of `system build` (CONTRACTS.md §8.8): `--document`, `-o`,
/// each member's revision key, and the absent occurrences.
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
    let argument = if option == "member-revision-key" {
        "revision-key"
    } else {
        option
    };
    let form = || usage(format!("--{option} takes <occurrence>=<value>")).argument(argument);
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

pub(super) fn system_of(
    raw: &Raw,
) -> Outcome<(BTreeMap<String, SystemMemberArg>, BTreeSet<String>)> {
    let bundles = system_bundles(raw)?;
    let keys = system_revision_keys(raw)?;
    if bundles.keys().ne(keys.keys()) {
        return Err(conflict(
            "each --member takes exactly one --member-revision-key for the same occurrence",
            "revision-key",
        ));
    }
    let absent = system_absent(raw, &bundles)?;
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
    Ok((members, absent))
}
