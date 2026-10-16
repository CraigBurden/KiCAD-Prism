//! Collects one document's objects: file order, duplicate handling,
//! `contentDigest`, and the stage-`parse` warnings (`capture/board_objects.py:453-502`).

use super::digest::{self, DigestIndex, is_canonical_uuid};
use super::tree::Node;
use crate::ProducerWarning;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

pub(crate) struct Document {
    path: String,
    index: DigestIndex,
    objects: Vec<(usize, String, Value)>,
    warnings: Vec<ProducerWarning>,
    duplicates: usize,
    invalid: usize,
    invalid_paths: usize,
}

impl Document {
    #[must_use]
    pub(crate) fn new(path: &str, root: &Node, board: bool) -> Self {
        Self {
            path: path.to_owned(),
            index: digest::index(root, board),
            objects: Vec::new(),
            warnings: Vec::new(),
            duplicates: 0,
            invalid: 0,
            invalid_paths: 0,
        }
    }

    /// Add one object; `uuid` must be the form's own id. Non-canonical uuids
    /// are dropped with a warning (divergence 4).
    pub(crate) fn add(&mut self, node: &Node, kind: &str, uuid: &str, fields: Map<String, Value>) {
        if !is_canonical_uuid(uuid) {
            self.invalid += 1;
            self.warnings.push(ProducerWarning {
                code: "board-objects-invalid-uuid".to_owned(),
                message: format!("{}: object id {uuid:?} is not a canonical uuid", self.path),
            });
            return;
        }
        let digest = self
            .index
            .get(uuid)
            .map_or_else(String::new, |(_, digest)| digest.to_owned());
        let mut object = Map::new();
        object.insert("kind".to_owned(), Value::String(kind.to_owned()));
        object.insert("uuid".to_owned(), Value::String(uuid.to_owned()));
        object.insert("contentDigest".to_owned(), Value::String(digest));
        for (key, value) in fields {
            object.insert(key, value);
        }
        self.objects
            .push((node.start(), uuid.to_owned(), Value::Object(object)));
    }

    /// Record an invalid KIID path (divergence 5).
    pub(crate) fn invalid_path(&mut self) {
        self.invalid_paths += 1;
    }

    /// File order, unique uuids (the later form wins), with warnings.
    #[must_use]
    pub(crate) fn finish(mut self) -> (Vec<Value>, Vec<ProducerWarning>) {
        let mut by_uuid: BTreeMap<String, (usize, Value)> = BTreeMap::new();
        for (start, uuid, value) in self.objects.drain(..) {
            if by_uuid.insert(uuid.clone(), (start, value)).is_some() {
                self.duplicates += 1;
                self.warnings.push(ProducerWarning {
                    code: "board-objects-duplicate-uuid".to_owned(),
                    message: format!(
                        "{}: two forms carry uuid {uuid}; the later in file order is kept",
                        self.path
                    ),
                });
            }
        }
        if self.invalid_paths > 0 {
            self.warnings.push(ProducerWarning {
                code: "board-objects-invalid-kiid-path".to_owned(),
                message: format!(
                    "{}: {} KIID path(s) are not valid and were dropped",
                    self.path, self.invalid_paths
                ),
            });
        }
        let mut items: Vec<(usize, Value)> = by_uuid.into_values().collect();
        items.sort_by_key(|(start, _)| *start);
        (
            items.into_iter().map(|(_, value)| value).collect(),
            self.warnings,
        )
    }
}

/// The form's own id: its `(uuid …)`, else `(tstamp …)`
/// (`ecad-parse.mjs:1350`).
#[must_use]
pub(crate) fn identity(node: &Node) -> Option<String> {
    super::tree::child_text(node, "uuid").or_else(|| super::tree::child_text(node, "tstamp"))
}

/// A value an object field map accepts: `Value`, `Option<Value>`, `String` or
/// `Option<String>`.
pub(crate) trait IntoValue {
    /// The value as an optional JSON value.
    fn into_value(self) -> Option<Value>;
}

impl IntoValue for Value {
    fn into_value(self) -> Option<Value> {
        Some(self)
    }
}

impl IntoValue for Option<Value> {
    fn into_value(self) -> Option<Value> {
        self
    }
}

impl IntoValue for String {
    fn into_value(self) -> Option<Value> {
        Some(Value::String(self))
    }
}

impl IntoValue for Option<String> {
    fn into_value(self) -> Option<Value> {
        self.map(Value::String)
    }
}
