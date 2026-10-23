//! Collects one document's objects: file order, duplicate handling,
//! `contentDigest`, and the stage-`parse` warnings (`capture/board_objects.py:453-502`).
//!
//! Objects are built as the bundle's generated structs, never as
//! `serde_json::Value`, so the parse stage serializes one typed document.

use super::digest::{DigestIndex, is_canonical_uuid};
use super::tree::Node;
use crate::ProducerWarning;
use prism_kicad_contracts::generated::prism_board_objects_a0 as bo;
use std::collections::BTreeMap;

pub(crate) struct Document {
    path: String,
    index: DigestIndex,
    objects: Vec<(usize, String, bo::BoardObjectsObject)>,
    warnings: Vec<ProducerWarning>,
    duplicates: usize,
    invalid: usize,
    invalid_paths: usize,
}

impl Document {
    /// A document over an empty digest index; [`Document::index_form`] fills it
    /// as the document's top-level items are read.
    #[must_use]
    pub(crate) fn new(path: &str, index: DigestIndex) -> Self {
        Self {
            path: path.to_owned(),
            index,
            objects: Vec::new(),
            warnings: Vec::new(),
            duplicates: 0,
            invalid: 0,
            invalid_paths: 0,
        }
    }

    /// Index one top-level item's forms (`contentDigest`) before its objects
    /// are built.
    pub(crate) fn index_form(&mut self, item: &Node<'_>) {
        self.index.add(item);
    }

    /// The `contentDigest` of the object with `uuid`.
    #[must_use]
    pub(crate) fn digest(&self, uuid: &str) -> String {
        self.index
            .get(uuid)
            .map_or_else(String::new, |(_, digest)| digest.to_owned())
    }

    /// Add one object; `uuid` must be the form's own id. Non-canonical uuids
    /// are dropped with a warning (divergence 4).
    pub(crate) fn add(&mut self, node: &Node<'_>, uuid: &str, object: bo::BoardObjectsObject) {
        if !is_canonical_uuid(uuid) {
            self.invalid += 1;
            self.warnings.push(ProducerWarning {
                code: "board-objects-invalid-uuid".to_owned(),
                message: format!("{}: object id {uuid:?} is not a canonical uuid", self.path),
            });
            return;
        }
        self.objects.push((node.start(), uuid.to_owned(), object));
    }

    /// Record an invalid KIID path (divergence 5).
    pub(crate) fn invalid_path(&mut self) {
        self.invalid_paths += 1;
    }

    /// File order, unique uuids (the later form wins), with warnings.
    #[must_use]
    pub(crate) fn finish(mut self) -> (Vec<bo::BoardObjectsObject>, Vec<ProducerWarning>) {
        let mut by_uuid: BTreeMap<String, (usize, bo::BoardObjectsObject)> = BTreeMap::new();
        for (start, uuid, object) in self.objects.drain(..) {
            if by_uuid.insert(uuid.clone(), (start, object)).is_some() {
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
        let mut items: Vec<(usize, bo::BoardObjectsObject)> = by_uuid.into_values().collect();
        items.sort_by_key(|(start, _)| *start);
        (
            items.into_iter().map(|(_, object)| object).collect(),
            self.warnings,
        )
    }
}

/// The form's own id: its `(uuid …)`, else `(tstamp …)`
/// (`ecad-parse.mjs:1350`).
#[must_use]
pub(crate) fn identity(node: &Node<'_>) -> Option<String> {
    super::tree::child_text(node, "uuid").or_else(|| super::tree::child_text(node, "tstamp"))
}

/// A point in nanometres from a millimetre `(x, y)`.
#[must_use]
pub(crate) fn point_nm(point: (f64, f64)) -> bo::PointNm {
    bo::PointNm {
        x_nm: bo::Nanometres(super::units::mm_to_nm(point.0)),
        y_nm: bo::Nanometres(super::units::mm_to_nm(point.1)),
    }
}

/// A non-empty newtype: `None` when `text` fails its `FromStr` (empty).
#[must_use]
pub(crate) fn parse_nonempty<T: std::str::FromStr>(text: String) -> Option<T> {
    text.parse::<T>().ok()
}

/// The `rotationDeg` of an `(at …)` form, present exactly when the position is.
#[must_use]
pub(crate) fn rotation_deg(
    point: Option<(f64, f64)>,
    at: Option<&Node<'_>>,
) -> Option<bo::Degrees> {
    point.and(super::tree::rotation(at)).map(bo::Degrees)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board_objects::tree;

    fn root(text: &str) -> Node<'_> {
        tree::parse(text).into_iter().next().expect("one root")
    }

    #[test]
    fn a_non_canonical_uuid_is_dropped_with_a_warning() {
        // Divergence 4.
        let text = "(kicad_sch (symbol (lib_id \"a\") (uuid \"aaaa-0201\")))";
        let parsed = root(text);
        let node = parsed.child("symbol").unwrap();
        let mut document = Document::new("board.kicad_sch", DigestIndex::default());
        document.add(
            node,
            "aaaa-0201",
            bo::BoardObjectsObject::Group(tag("group")),
        );
        let (objects, warnings) = document.finish();
        assert!(objects.is_empty());
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "board-objects-invalid-uuid");
    }

    #[test]
    fn a_duplicate_uuid_keeps_the_later_form_with_a_warning() {
        // Divergence 7.
        let uuid = "00000000-0000-0000-0000-00000000000d";
        let text = format!(
            "(kicad_sch (symbol (lib_id \"first\") (uuid \"{uuid}\")) (symbol (lib_id \"second\") (uuid \"{uuid}\")))"
        );
        let parsed = root(&text);
        let mut document = Document::new("board.kicad_sch", DigestIndex::default());
        for symbol in parsed.children("symbol") {
            document.add(symbol, uuid, bo::BoardObjectsObject::Group(tag("group")));
        }
        let (objects, warnings) = document.finish();
        assert_eq!(objects.len(), 1);
        assert_eq!(warnings.len(), 1);
        assert_eq!(warnings[0].code, "board-objects-duplicate-uuid");
    }

    fn tag(name: &str) -> bo::BoardObjectsGroup {
        bo::BoardObjectsGroup {
            kind: "group".to_owned(),
            uuid: bo::KiCadUuid("00000000-0000-0000-0000-000000000000".to_owned()),
            content_digest: bo::BoardObjectsContentDigest(String::new()),
            name: name.to_owned(),
            review_fields: bo::RecordBoardObjectsReviewValue(std::collections::BTreeMap::new()),
        }
    }
}
