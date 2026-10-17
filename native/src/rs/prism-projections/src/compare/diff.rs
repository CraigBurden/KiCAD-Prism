//! The diff itself: identity matching and the change list
//! (`ecad-diff.mjs:338-481`).

use super::CompareError;
use super::classify::{self, MergedDelta};
use super::entry::{self, Entry};
use super::numbers::utf16_cmp;
use super::output;
use prism_kicad_contracts::generated::prism_compare_object_delta_a0::CompareObjectDeltaA0;
use serde_json::Value;
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
    /// Equal content: `unchanged`.
    Unchanged,
    /// Equal authored content with a changed generated digest: `ignored`.
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

/// Design Comparison's object diff of two `board-objects` documents
/// (`ecad-diff.mjs:338-519`), without the run facts and `routeMetrics`.
///
/// `base_dir` and `head_dir` are the anchors' directories: the two
/// `config.project_file` values, whose directories are stripped from every
/// document path (D1).
pub fn diff(
    base_document: &Value,
    base_dir: &str,
    head_document: &Value,
    head_dir: &str,
) -> Result<CompareObjectDeltaA0, CompareError> {
    let base = entry::entries(base_document, base_dir)?;
    let head = entry::entries(head_document, head_dir)?;
    let delta = diff_entries(base, head);
    serde_json::to_value(&delta)
        .and_then(serde_json::from_value)
        .map_err(|error| {
            CompareError::new(format!(
                "the compare document does not fit its schema: {error}"
            ))
        })
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

/// The typed object diff: every change, the ignored pairs and the unchanged
/// count. [`diff_entries`] renders it as the `prism.compare.object_delta.a0`
/// document; the object tab reads it directly.
pub struct Outcome<'a> {
    /// The changes, sorted by key as today.
    pub changes: Vec<Pair<'a>>,
    /// Head indexes the diff ignored, with the reason.
    pub ignored: Vec<(usize, &'static str)>,
    /// The number of matched, unchanged objects.
    pub unchanged: usize,
}

impl Outcome<'_> {
    /// The object counts `Output.object_counts` carries, without a [`output::Delta`].
    #[must_use]
    pub fn counts(&self, base_objects: usize, head_objects: usize) -> Value {
        let (mut added, mut removed, mut modified) = (0u64, 0u64, 0u64);
        for pair in &self.changes {
            match pair.status {
                output::Status::Added => added += 1,
                output::Status::Removed => removed += 1,
                output::Status::Modified => modified += 1,
            }
        }
        output::counts_value(
            added,
            removed,
            modified,
            self.unchanged,
            self.ignored.len(),
            base_objects,
            head_objects,
        )
    }
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

/// The typed pass of [`diff_entries`]: identity matching, the change list and
/// the reasons and deltas each change carries.
pub fn outcome<'a>(base: &'a [Entry], head: &'a [Entry]) -> Outcome<'a> {
    let mut matcher = Matcher::new(base, head);
    matcher.native_identity();
    matcher.pair(entry::authored_identity, Reason::InternalOnly);
    matcher.pair(entry::sheet_pin_slot_identity, Reason::SheetPinSlot);

    let mut changes = Vec::new();
    let mut ignored = Vec::new();
    let mut unchanged = 0usize;
    for (head_index, after) in head.iter().enumerate() {
        match matcher.matches.get(&head_index) {
            None => changes.push(added_pair(after, head_index)),
            Some(found) if found.reason == Reason::InternalOnly => {
                ignored.push((head_index, "internal-identity-only"));
                unchanged += 1;
            }
            Some(found) => {
                let before = &base[found.base];
                match pair_outcome(before, after) {
                    PairOutcome::Modified => {
                        changes.push(modified_pair(before, after, found.base, head_index));
                    }
                    PairOutcome::GeneratedContentOnly => {
                        ignored.push((head_index, "generated-content-only"));
                        unchanged += 1;
                    }
                    PairOutcome::Unchanged => unchanged += 1,
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
    Outcome {
        changes,
        ignored,
        unchanged,
    }
}

/// [`diff`] over entries already rebuilt with [`entry::entries`]: the CLI
/// drops each member's parsed JSON as soon as its entries exist, and writes
/// the returned [`output::Delta`] without building it as one value.
pub fn diff_entries(base: entry::Entries, head: entry::Entries) -> output::Delta {
    let (base, head) = (base.0, head.0);
    let (changes, ignored, unchanged) = {
        let outcome = outcome(&base, &head);
        let changes = outcome
            .changes
            .iter()
            .map(|pair| match pair.status {
                output::Status::Added => output::added(
                    &head[pair.after.expect("an added pair has an after side")],
                    &pair.reasons,
                    &pair.deltas,
                ),
                output::Status::Removed => output::removed(
                    &base[pair.before.expect("a removed pair has a before side")],
                    &pair.reasons,
                    &pair.deltas,
                ),
                output::Status::Modified => output::modified(
                    &base[pair.before.expect("a modified pair has a before side")],
                    &head[pair.after.expect("a modified pair has an after side")],
                    &pair.reasons,
                    &pair.deltas,
                ),
            })
            .collect();
        let ignored = outcome
            .ignored
            .iter()
            .map(|&(index, reason)| output::ignored(&head[index], reason))
            .collect();
        (changes, ignored, outcome.unchanged)
    };
    output::document(base, head, changes, ignored, unchanged)
}

#[cfg(test)]
mod tests {
    use super::*;
    use prism_kicad_contracts::generated::prism_compare_object_delta_a0::CompareObjectDeltaReason as CompareReason;
    use serde_json::json;

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

    fn diff_docs(base: &Value, head: &Value) -> CompareObjectDeltaA0 {
        diff(base, "", head, "").unwrap()
    }

    #[test]
    fn the_streamed_document_equals_the_typed_one() {
        let base = document("d.kicad_pcb", json!([pad("u1", "a"), pad("u2", "b")]));
        let head = document("d.kicad_pcb", json!([pad("u1", "a2"), pad("u3", "c")]));
        let delta = diff_entries(
            entry::entries(&base, "").unwrap(),
            entry::entries(&head, "").unwrap(),
        );
        let streamed: Value = serde_json::from_slice(&serde_json::to_vec(&delta).unwrap()).unwrap();
        // The typed document goes through `f64`, which writes `0.0`; compare
        // values with the streamed document's ECMAScript number text.
        let typed =
            super::super::json::ecma(serde_json::to_value(diff_docs(&base, &head)).unwrap());
        assert_eq!(streamed, typed);
        assert_eq!(delta.objects(), (2, 2));
        assert_eq!(delta.counts()["added"], json!(1));
    }

    #[test]
    fn the_same_member_twice_has_no_changes() {
        let side = document("d.kicad_pcb", json!([pad("u1", "a"), pad("u2", "b")]));
        let delta = diff_docs(&side, &side);
        assert!(delta.changes.is_empty());
        assert_eq!(delta.counts.unchanged.0, 2);
        assert_eq!(delta.counts.base_objects.0, 2);
        assert_eq!(delta.counts.head_objects.0, 2);
    }

    #[test]
    fn internal_identity_only_pairs_across_a_uuid_change() {
        // Same authored content, different uuid: `internal-identity-only`.
        let base = document("d.kicad_pcb", json!([pad("u1", "same")]));
        let head = document("d.kicad_pcb", json!([pad("u2", "same")]));
        let delta = diff_docs(&base, &head);
        assert!(delta.changes.is_empty());
        assert_eq!(delta.ignored.len(), 1);
        assert_eq!(delta.counts.ignored.0, 1);
        assert_eq!(delta.counts.unchanged.0, 1);
    }

    #[test]
    fn sheet_pin_slot_pairs_a_renamed_pin() {
        let pin = |uuid: &str, name: &str| {
            json!({"kind": "sheet-pin", "uuid": uuid, "contentDigest": uuid,
                   "parentUuid": "p", "name": name, "at": {"xNm": 0, "yNm": 0}, "rotationDeg": 0.0})
        };
        let base = document("d.kicad_sch", json!([pin("u1", "A")]));
        let head = document("d.kicad_sch", json!([pin("u2", "B")]));
        let delta = diff_docs(&base, &head);
        assert!(delta.ignored.is_empty());
        assert_eq!(delta.changes.len(), 1);
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
        let ignored = output::ignored(&after, "generated-content-only");
        assert_eq!(ignored["reason"], json!("generated-content-only"));
    }

    fn entry_from(value: Value) -> Entry {
        let member = document("d.kicad_pcb", json!([value]));
        entry::build(&member, "").unwrap().remove(0)
    }

    #[test]
    fn modification_reasons_and_content_changed_fallback() {
        let base = document("d.kicad_pcb", json!([pad("u1", "a")]));
        let head = document(
            "d.kicad_pcb",
            json!([{"kind": "pad", "uuid": "u1", "contentDigest": "b",
                    "at": {"xNm": 0, "yNm": 0}, "rotationDeg": 0.0, "layer": "F.Cu"}]),
        );
        let delta = diff_docs(&base, &head);
        assert_eq!(delta.changes.len(), 1);
        let reasons = delta.changes[0].reasons.as_ref().unwrap();
        assert_eq!(reasons.len(), 1);
        assert_eq!(reasons[0], CompareReason::ContentChanged);
    }
}
