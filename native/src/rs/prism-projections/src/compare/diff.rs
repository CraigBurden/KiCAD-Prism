//! The diff itself: identity matching and the change list
//! (`ecad-diff.mjs:338-481`).

use super::classify::{self, MergedDelta};
use super::entry::{self, Entry};
use super::numbers::utf16_cmp;
use super::output;
use std::collections::HashMap;

/// Why two objects were matched.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Reason {
    /// The same key on both sides (`native-identity`).
    Native,
    /// Equal authored content across a UUID change.
    InternalOnly,
    /// A hierarchical sheet pin that kept its exact parent slot.
    SheetPinSlot,
}

#[derive(Clone, Copy)]
struct Match {
    base: usize,
    reason: Reason,
}

struct Matcher<'a> {
    base: &'a [Entry],
    head: &'a [Entry],
    base_map: HashMap<String, usize>,
    head_map: HashMap<String, usize>,
    matched_base: Vec<bool>,
    matched_head: Vec<bool>,
    matches: HashMap<usize, Match>,
}

impl<'a> Matcher<'a> {
    fn new(base: &'a [Entry], head: &'a [Entry]) -> Self {
        Self {
            base,
            head,
            base_map: index(base),
            head_map: index(head),
            matched_base: vec![false; base.len()],
            matched_head: vec![false; head.len()],
            matches: HashMap::new(),
        }
    }

    /// `native-identity`: the same `documentPath#uuid` on both sides.
    fn native_identity(&mut self) {
        for (head_index, entry) in self.head.iter().enumerate() {
            let Some(&base_index) = self.base_map.get(&entry.key) else {
                continue;
            };
            self.matched_base[base_index] = true;
            self.matched_head[head_index] = true;
            self.matches.insert(
                head_index,
                Match {
                    base: base_index,
                    reason: Reason::Native,
                },
            );
        }
    }

    /// One `pair_unmatched` pass (`ecad-diff.mjs:159-186`): group the still
    /// unmatched objects by `identity` and pair the two sides index-wise, with
    /// each group's keys in JS `.sort()` order (T5).
    fn pair(&mut self, identity: fn(&Entry) -> Option<String>, reason: Reason) {
        let mut base_groups: HashMap<String, Vec<String>> = HashMap::new();
        let mut head_groups: HashMap<String, Vec<String>> = HashMap::new();
        for (index, entry) in self.base.iter().enumerate() {
            if self.matched_base[index] {
                continue;
            }
            if let Some(signature) = identity(entry) {
                base_groups
                    .entry(signature)
                    .or_default()
                    .push(entry.key.clone());
            }
        }
        for (index, entry) in self.head.iter().enumerate() {
            if self.matched_head[index] {
                continue;
            }
            if let Some(signature) = identity(entry) {
                head_groups
                    .entry(signature)
                    .or_default()
                    .push(entry.key.clone());
            }
        }
        let mut signatures: Vec<String> = base_groups.keys().cloned().collect();
        signatures.sort_by(|left, right| utf16_cmp(left, right));
        for signature in signatures {
            let mut base_keys = base_groups.remove(&signature).unwrap_or_default();
            let Some(mut head_keys) = head_groups.remove(&signature) else {
                continue;
            };
            base_keys.sort_by(|left, right| utf16_cmp(left, right));
            head_keys.sort_by(|left, right| utf16_cmp(left, right));
            for (base_key, head_key) in base_keys.iter().zip(head_keys.iter()) {
                let (Some(&base_index), Some(&head_index)) =
                    (self.base_map.get(base_key), self.head_map.get(head_key))
                else {
                    continue;
                };
                self.matched_base[base_index] = true;
                self.matched_head[head_index] = true;
                self.matches.insert(
                    head_index,
                    Match {
                        base: base_index,
                        reason,
                    },
                );
            }
        }
    }
}

fn index(entries: &[Entry]) -> HashMap<String, usize> {
    entries
        .iter()
        .enumerate()
        .map(|(index, entry)| (entry.key.clone(), index))
        .collect()
}

/// What a matched, non-internal-identity pair is (`ecad-diff.mjs:400-414`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PairOutcome {
    /// Equal content: no change.
    Unchanged,
    /// Equal authored content with a changed generated digest: no change.
    GeneratedContentOnly,
    /// Content differs: a `modified` change.
    Modified,
}

fn pair_outcome(before: &Entry, after: &Entry) -> PairOutcome {
    if before.hash != after.hash || !classify::same_index_fields(before, after) {
        return PairOutcome::Modified;
    }
    // `board-objects` replaces `hash` with a digest that already ignores
    // generated content, so `generatedHash` is always absent (T7); the branch
    // remains for parity with the reference and is covered by a unit test.
    if before.generated_hash.is_some() && before.generated_hash != after.generated_hash {
        PairOutcome::GeneratedContentOnly
    } else {
        PairOutcome::Unchanged
    }
}

/// One matched, added or removed object, typed: the entries it relates and the
/// classification its change carries. The identity fields borrow the entries.
pub struct Pair<'a> {
    /// The object's key (`documentPath#uuid`); the order [`Outcome`] is sorted
    /// by.
    pub key: &'a str,
    /// The base side's index, present unless the object is `added`.
    pub before: Option<usize>,
    /// The head side's index, present unless the object is `removed`.
    pub after: Option<usize>,
    /// How the two sides relate.
    pub status: output::Status,
    /// The classifier reasons of a `modified` pair; empty otherwise.
    pub reasons: Vec<&'static str>,
    /// The property and review-field deltas, computed once.
    pub deltas: Vec<MergedDelta>,
}

/// The typed object diff: every change, in key order. The object tab reads it
/// ([`super::result`]).
pub struct Outcome<'a> {
    /// The changes, sorted by key as today.
    pub changes: Vec<Pair<'a>>,
}

fn added_pair(after: &Entry, index: usize) -> Pair<'_> {
    Pair {
        key: &after.key,
        before: None,
        after: Some(index),
        status: output::Status::Added,
        reasons: Vec::new(),
        deltas: classify::review_field_deltas(None, Some(after)),
    }
}

fn removed_pair(before: &Entry, index: usize) -> Pair<'_> {
    Pair {
        key: &before.key,
        before: Some(index),
        after: None,
        status: output::Status::Removed,
        reasons: Vec::new(),
        deltas: classify::review_field_deltas(Some(before), None),
    }
}

fn modified_pair<'a>(
    before: &'a Entry,
    after: &'a Entry,
    before_index: usize,
    after_index: usize,
) -> Pair<'a> {
    let deltas = classify::merged_property_deltas(before, after);
    let mut reasons = classify::classify(before, after);
    if classify::properties_changed(&deltas) {
        reasons.push("properties-changed");
    }
    if reasons.is_empty() {
        reasons.push("content-changed");
    }
    Pair {
        key: &after.key,
        before: Some(before_index),
        after: Some(after_index),
        status: output::Status::Modified,
        reasons,
        deltas,
    }
}

/// The typed pass: identity matching, the change list and the reasons and
/// deltas each change carries. Pairs that are unchanged, or that only matched
/// across a UUID change, carry no change.
pub fn outcome<'a>(base: &'a [Entry], head: &'a [Entry]) -> Outcome<'a> {
    let mut matcher = Matcher::new(base, head);
    matcher.native_identity();
    matcher.pair(entry::authored_identity, Reason::InternalOnly);
    matcher.pair(entry::sheet_pin_slot_identity, Reason::SheetPinSlot);

    let mut changes = Vec::new();
    for (head_index, after) in head.iter().enumerate() {
        match matcher.matches.get(&head_index) {
            None => changes.push(added_pair(after, head_index)),
            Some(found) if found.reason == Reason::InternalOnly => {}
            Some(found) => {
                let before = &base[found.base];
                if pair_outcome(before, after) == PairOutcome::Modified {
                    changes.push(modified_pair(before, after, found.base, head_index));
                }
            }
        }
    }
    for (index, before) in base.iter().enumerate() {
        if !matcher.matched_base[index] {
            changes.push(removed_pair(before, index));
        }
    }
    drop(matcher);
    changes.sort_by(|left, right| left.key.cmp(right.key));
    Outcome { changes }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::{Value, json};

    fn document(path: &str, objects: Value) -> Value {
        json!({
            "schema": "prism.board_objects.a0",
            "documents": [{"path": path, "objects": objects, "reviewOnlyObjects": []}]
        })
    }

    fn pad(uuid: &str, digest: &str) -> Value {
        json!({"kind": "pad", "uuid": uuid, "contentDigest": digest,
               "at": {"xNm": 0, "yNm": 0}, "rotationDeg": 0.0, "layer": "F.Cu"})
    }

    fn sides(base: &Value, head: &Value) -> (Vec<Entry>, Vec<Entry>) {
        (
            entry::build(base, "").unwrap(),
            entry::build(head, "").unwrap(),
        )
    }

    #[test]
    fn the_same_member_twice_has_no_changes() {
        let side = document("d.kicad_pcb", json!([pad("u1", "a"), pad("u2", "b")]));
        let (base, head) = sides(&side, &side);
        let found = outcome(&base, &head);
        assert!(found.changes.is_empty());
    }

    #[test]
    fn added_removed_and_modified_are_sorted_by_key() {
        let (base, head) = sides(
            &document("d.kicad_pcb", json!([pad("u1", "a"), pad("u2", "b")])),
            &document("d.kicad_pcb", json!([pad("u1", "a2"), pad("u3", "c")])),
        );
        let found = outcome(&base, &head);
        let statuses: Vec<_> = found
            .changes
            .iter()
            .map(|pair| (pair.key, pair.status))
            .collect();
        assert_eq!(
            statuses,
            [
                ("d.kicad_pcb#u1", output::Status::Modified),
                ("d.kicad_pcb#u2", output::Status::Removed),
                ("d.kicad_pcb#u3", output::Status::Added),
            ]
        );
    }

    #[test]
    fn internal_identity_only_pairs_across_a_uuid_change() {
        // Same authored content, different uuid: `internal-identity-only`.
        let (base, head) = sides(
            &document("d.kicad_pcb", json!([pad("u1", "same")])),
            &document("d.kicad_pcb", json!([pad("u2", "same")])),
        );
        let found = outcome(&base, &head);
        assert!(found.changes.is_empty());
    }

    #[test]
    fn sheet_pin_slot_pairs_a_renamed_pin() {
        let pin = |uuid: &str, name: &str| {
            json!({"kind": "sheet-pin", "uuid": uuid, "contentDigest": uuid,
                   "parentUuid": "p", "name": name, "at": {"xNm": 0, "yNm": 0}, "rotationDeg": 0.0})
        };
        let (base, head) = sides(
            &document("d.kicad_sch", json!([pin("u1", "A")])),
            &document("d.kicad_sch", json!([pin("u2", "B")])),
        );
        let found = outcome(&base, &head);
        assert_eq!(found.changes.len(), 1);
    }

    #[test]
    fn generated_content_only_is_kept_when_the_generated_hash_differs() {
        // `board-objects` never carries a generated hash (T7), so drive the
        // branch through the internal entry the reference tests with.
        let mut before = entry_from(json!({"kind": "zone", "uuid": "u1", "contentDigest": "h"}));
        let mut after = entry_from(json!({"kind": "zone", "uuid": "u1", "contentDigest": "h"}));
        assert_eq!(pair_outcome(&before, &after), PairOutcome::Unchanged);
        before.generated_hash = Some("fill-before".to_owned());
        after.generated_hash = Some("fill-after".to_owned());
        assert_eq!(
            pair_outcome(&before, &after),
            PairOutcome::GeneratedContentOnly
        );
    }

    fn entry_from(value: Value) -> Entry {
        let member = document("d.kicad_pcb", json!([value]));
        entry::build(&member, "").unwrap().remove(0)
    }

    #[test]
    fn modification_reasons_and_content_changed_fallback() {
        let (base, head) = sides(
            &document("d.kicad_pcb", json!([pad("u1", "a")])),
            &document("d.kicad_pcb", json!([pad("u1", "b")])),
        );
        let found = outcome(&base, &head);
        assert_eq!(found.changes.len(), 1);
        assert_eq!(found.changes[0].reasons, ["content-changed"]);
    }
}
