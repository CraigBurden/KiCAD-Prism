//! ecad-viewer's input (`/projectDiff`, `kicad-project-diff-v1.tsp`): the
//! native changes of both tabs per document, and the navigation from each
//! change id. Today's code: `backend/app/services/document_diff_service.py`
//! (`build_project_diff`).
//!
//! Today's complete comparison builds it from the hydrated schematic changes
//! and the PCB changes, using only the `files` tab for the board's path
//! (`design_compare_service.py:1167-1171`; the first, schematic-only publish at
//! `1074-1081` passes none and is replaced by it). The body is a Rust-native
//! rebuild on the typed changes and their visual targets: the generated
//! `dc::KiCadProjectDiff*` types are built directly, there is no
//! `serde_json::Value`, and changes are grouped by document with indexes rather
//! than cloned.

mod value;

use super::{ReviewChange, VisualRole, VisualSide, VisualStatus, VisualTarget};
use prism_kicad_contracts::generated::prism_design_compare_result_a1 as dc;
use std::borrow::Cow;
use std::collections::{BTreeMap, BTreeSet, HashMap};

/// Build ecad-viewer's input from the schematic and PCB changes and the file
/// list.
pub(super) fn build(
    schematic: &[ReviewChange],
    pcb: &[ReviewChange],
    files: &dc::DesignCompareFiles,
) -> dc::KiCadProjectDiffBundleV1 {
    let mut builder = Builder::new(files);
    for change in schematic.iter().chain(pcb) {
        builder.push(change);
    }
    builder.finish()
}

/// The bundle as it is assembled, per document, with the claimed native ids.
struct Builder {
    pcb_path: Option<String>,
    documents: BTreeMap<String, Vec<dc::KiCadProjectDiffItemChange>>,
    document_types: BTreeMap<String, dc::KiCadProjectDiffDocType>,
    navigation: BTreeMap<String, dc::KiCadProjectDiffNavigation>,
    diagnostics: Vec<dc::KiCadProjectDiffDiagnostic>,
    claimed: BTreeSet<(String, String, u8)>,
}

impl Builder {
    fn new(files: &dc::DesignCompareFiles) -> Self {
        Self {
            pcb_path: first_pcb_path(files),
            documents: BTreeMap::new(),
            document_types: BTreeMap::new(),
            navigation: BTreeMap::new(),
            diagnostics: Vec::new(),
            claimed: BTreeSet::new(),
        }
    }

    /// One review item (`build_project_diff`'s per-change body).
    fn push(&mut self, change: &ReviewChange) {
        let targets = targets(change);
        let id = change.change.id.as_str();
        if id.is_empty() || targets.is_empty() {
            if change.change.details.review_only != Some(true) {
                self.diagnostics.push(diagnostic(id, "missing-source-id"));
            }
            return;
        }
        let groups = self.resolve(change, &targets);
        self.emit(change, id, &targets, groups);
    }

    /// Group the change's targets by document path, in first-seen order.
    fn resolve(
        &mut self,
        change: &ReviewChange,
        targets: &[VisualTarget],
    ) -> Vec<(String, Vec<usize>)> {
        let candidates = candidates(change, targets, self.pcb_path.as_deref());
        let (by_side, all) = native_paths(change, targets, &candidates);
        let mut groups: Vec<(String, Vec<usize>)> = Vec::new();
        for &(index, ref raw) in &candidates {
            match resolved_path(change, &targets[index], raw.as_deref(), &by_side, &all) {
                Ok(path) => push_group(&mut groups, path, index),
                Err(reason) => self
                    .diagnostics
                    .push(diagnostic(change.change.id.as_str(), reason)),
            }
        }
        groups
    }

    /// Turn the resolved targets of one change into documents and navigation.
    fn emit(
        &mut self,
        change: &ReviewChange,
        id: &str,
        targets: &[VisualTarget],
        groups: Vec<(String, Vec<usize>)>,
    ) {
        let mut navigation_documents = Vec::new();
        for (path, indices) in groups {
            let (unique, duplicates) = self.claim(change, &path, targets, &indices);
            self.emit_document(
                change,
                targets,
                &path,
                &unique,
                duplicates,
                &mut navigation_documents,
            );
        }
        if let Some(first) = navigation_documents.first() {
            self.navigation
                .insert(id.to_owned(), navigation(first, &navigation_documents));
        }
    }

    /// Split the targets into the ones this review item newly claims and the
    /// native ids an earlier item already claimed.
    fn claim(
        &mut self,
        change: &ReviewChange,
        path: &str,
        targets: &[VisualTarget],
        indices: &[usize],
    ) -> (Vec<usize>, Vec<String>) {
        let mut unique = Vec::new();
        let mut duplicates = Vec::new();
        for &index in indices {
            let id = change_id(&change.change, &targets[index]);
            let key = (path.to_owned(), id.clone(), side_rank(targets[index].side));
            if self.claimed.contains(&key) {
                duplicates.push(id);
            } else {
                self.claimed.insert(key);
                unique.push(index);
            }
        }
        (unique, duplicates)
    }

    fn emit_document(
        &mut self,
        change: &ReviewChange,
        targets: &[VisualTarget],
        path: &str,
        unique: &[usize],
        duplicates: Vec<String>,
        navigation_documents: &mut Vec<dc::KiCadProjectDiffNavigationDocument>,
    ) {
        if unique.is_empty() {
            let change_ids = unique_ordered(duplicates);
            if let Some(first) = change_ids.first() {
                navigation_documents.push(navigation_document(path, first.clone(), change_ids));
            }
            return;
        }
        let children = unique[1..]
            .iter()
            .map(|&index| item(change, &targets[index], false, true, Vec::new()))
            .collect();
        let item = item(change, &targets[unique[0]], true, false, children);
        let mut change_ids = vec![item.id.clone()];
        change_ids.extend(item.children.iter().map(|child| child.id.clone()));
        change_ids.extend(duplicates);
        self.documents
            .entry(path.to_owned())
            .or_default()
            .push(item);
        self.document_types
            .insert(path.to_owned(), doc_type(&change.change));
        navigation_documents.push(navigation_document(path, change_ids[0].clone(), change_ids));
    }

    fn finish(self) -> dc::KiCadProjectDiffBundleV1 {
        let Builder {
            documents,
            document_types,
            navigation,
            diagnostics,
            ..
        } = self;
        let documents = documents
            .into_iter()
            .map(|(path, changes)| dc::KiCadProjectDiffDocument {
                doc_type: document_types[&path],
                path,
                changes,
            })
            .collect();
        dc::KiCadProjectDiffBundleV1 {
            schema: "prism.kicad_project_diff_v1".to_owned(),
            provider: "prism-semantic".to_owned(),
            project: dc::KiCadProjectDiffProject { documents },
            navigation: dc::RecordKiCadProjectDiffNavigation(navigation),
            diagnostics,
        }
    }
}

// ----------------------------------------------------------------- candidates

/// The targets of a change, borrowed, or the one target the fallback
/// manufactures when a change carries none.
fn targets(change: &ReviewChange) -> Cow<'_, [VisualTarget]> {
    if change.change.details.review_only == Some(true) {
        return Cow::Borrowed(&[]);
    }
    if !change.visual_targets.is_empty() {
        return Cow::Borrowed(&change.visual_targets);
    }
    match fallback_target(change) {
        Some(target) => Cow::Owned(vec![target]),
        None => Cow::Borrowed(&[]),
    }
}

/// `_visual_targets`'s fallback: a target from the change's source id and page.
fn fallback_target(change: &ReviewChange) -> Option<VisualTarget> {
    if change.change.details.review_only == Some(true) {
        return None;
    }
    let source_id = source_id(&change.change)?;
    if source_id.is_empty() {
        return None;
    }
    let side = if change.change.kind == dc::DesignCompareChangeKind::Removed {
        VisualSide::Reference
    } else {
        VisualSide::Comparison
    };
    Some(VisualTarget {
        side,
        status: visual_status(change.change.kind),
        source_id: source_id.to_owned(),
        parent_source_id: None,
        kind: None,
        document_path: fallback_document(&change.change),
        sheet_path: None,
        at: None,
        role: if change.change.reference.is_some() {
            VisualRole::Component
        } else {
            VisualRole::Wire
        },
        reference: None,
        pin: None,
    })
}

/// The deduplicated `(target index, raw document path)` of a change.
fn candidates(
    change: &ReviewChange,
    targets: &[VisualTarget],
    pcb_path: Option<&str>,
) -> Vec<(usize, Option<String>)> {
    let mut seen = BTreeSet::new();
    let mut candidates = Vec::new();
    for (index, target) in targets.iter().enumerate() {
        if target.source_id.is_empty() {
            continue;
        }
        let key = (
            side_rank(target.side),
            status_rank(target.status),
            target.source_id.clone(),
            target.sheet_path.clone().unwrap_or_default(),
        );
        if !seen.insert(key) {
            continue;
        }
        candidates.push((index, raw_path(change, target, pcb_path)));
    }
    candidates
}

/// `pcb_path` for a board change, the target's document otherwise.
fn raw_path(
    change: &ReviewChange,
    target: &VisualTarget,
    pcb_path: Option<&str>,
) -> Option<String> {
    if change.change.domain == dc::DesignCompareDomain::Pcb {
        return pcb_path.map(normalize);
    }
    let raw = first_non_empty(&[
        target.document_path.as_deref(),
        change.change.page.as_deref(),
        change
            .change
            .head
            .as_ref()
            .map(|side| side.document_path.as_str()),
        change
            .change
            .base
            .as_ref()
            .map(|side| side.document_path.as_str()),
    ]);
    raw.map(normalize)
}

/// The native schematic paths a change's targets name, by side and overall
/// (the hierarchy fallback of `build_project_diff`).
fn native_paths(
    change: &ReviewChange,
    targets: &[VisualTarget],
    candidates: &[(usize, Option<String>)],
) -> (HashMap<u8, BTreeSet<String>>, BTreeSet<String>) {
    let mut by_side: HashMap<u8, BTreeSet<String>> = HashMap::new();
    let mut all = BTreeSet::new();
    if change.change.domain != dc::DesignCompareDomain::Schematic {
        return (by_side, all);
    }
    for &(index, ref path) in candidates {
        if let Some(path) = path
            && is_native_schematic_path(path)
        {
            by_side
                .entry(side_rank(targets[index].side))
                .or_default()
                .insert(path.clone());
            all.insert(path.clone());
        }
    }
    (by_side, all)
}

/// The document a target resolves to, or the reason it does not.
fn resolved_path(
    change: &ReviewChange,
    target: &VisualTarget,
    raw: Option<&str>,
    by_side: &HashMap<u8, BTreeSet<String>>,
    all: &BTreeSet<String>,
) -> Result<String, &'static str> {
    if change.change.domain == dc::DesignCompareDomain::Pcb {
        return raw.map(str::to_owned).ok_or("missing-document-path");
    }
    let path = schematic_path(raw, target.side, by_side, all)?;
    path.ok_or("missing-document-path")
}

/// A non-native schematic path falls back to the side's only native schematic
/// path, then to the change's only one.
fn schematic_path(
    raw: Option<&str>,
    side: VisualSide,
    by_side: &HashMap<u8, BTreeSet<String>>,
    all: &BTreeSet<String>,
) -> Result<Option<String>, &'static str> {
    if raw.is_some_and(is_native_schematic_path) {
        return Ok(raw.map(str::to_owned));
    }
    if let Some(paths) = by_side.get(&side_rank(side))
        && let Some(only) = only(paths)
    {
        return Ok(Some(only.to_owned()));
    }
    if let Some(only) = only(all) {
        return Ok(Some(only.to_owned()));
    }
    Err("unresolved-schematic-hierarchy")
}

fn only(paths: &BTreeSet<String>) -> Option<&str> {
    if paths.len() == 1 {
        paths.iter().next().map(String::as_str)
    } else {
        None
    }
}

// ------------------------------------------------------------------ item

fn item(
    change: &ReviewChange,
    target: &VisualTarget,
    include_properties: bool,
    retain_reference: bool,
    children: Vec<dc::KiCadProjectDiffItemChange>,
) -> dc::KiCadProjectDiffItemChange {
    let native = &change.change;
    dc::KiCadProjectDiffItemChange {
        id: change_id(native, target),
        type_name: type_name(target.kind.as_deref().or(native.object_kind.as_deref()))
            .unwrap_or_else(|| fallback_type_name(target.role))
            .to_owned(),
        kind: change_kind(target.status),
        source_side: Some(source_side(target.side)),
        properties: if include_properties {
            value::property_deltas(native)
        } else {
            Vec::new()
        },
        bbox: None,
        refdes: refdes_of(native),
        retain_reference: retain_reference.then_some(true),
        children,
    }
}

/// The object's KIID path (`_change_id`): the target's sheet prefix when the
/// hierarchy supplies one, otherwise the bare id.
fn change_id(change: &dc::DesignCompareChange, target: &VisualTarget) -> String {
    match sheet_instance_path(change, target) {
        Some(prefix) => format!("{prefix}/{}", target.source_id),
        None => format!("/{}", target.source_id),
    }
}

/// `_sheet_instance_path`: the human hierarchy prefix for a schematic target.
fn sheet_instance_path(change: &dc::DesignCompareChange, target: &VisualTarget) -> Option<String> {
    if change.domain == dc::DesignCompareDomain::Pcb {
        return None;
    }
    for candidate in [
        target.sheet_path.as_deref(),
        target.document_path.as_deref(),
        change.page.as_deref(),
    ]
    .into_iter()
    .flatten()
    {
        let normalized = candidate.replace('\\', "/");
        if !normalized.starts_with('/') || is_native_schematic_path(&normalized) {
            continue;
        }
        let trimmed = normalized.trim_end_matches('/');
        return (!trimmed.is_empty()).then(|| trimmed.to_owned());
    }
    None
}

fn is_native_schematic_path(path: &str) -> bool {
    path.ends_with(".kicad_sch")
}

fn refdes_of(change: &dc::DesignCompareChange) -> Option<String> {
    change
        .reference
        .as_ref()
        .map(|reference| String::from(reference.clone()))
        .or_else(|| change.net.as_ref().map(|net| String::from(net.clone())))
        .filter(|text| !text.is_empty())
}

/// KiCad's type name for a board-objects kind, as ecad-viewer's diff names it.
const TYPE_NAMES: [(&str, &str); 19] = [
    ("symbol", "SCH_SYMBOL"),
    ("wire", "SCH_LINE"),
    ("label", "SCH_LABEL"),
    ("junction", "SCH_JUNCTION"),
    ("pin", "SCH_PIN"),
    ("sheet_pin", "SCH_SHEET_PIN"),
    ("sheet", "SCH_SHEET"),
    ("bus", "SCH_BUS_WIRE"),
    ("bus_entry", "SCH_BUS_ENTRY"),
    ("no_connect", "SCH_NO_CONNECT"),
    ("graphic", "SCH_SHAPE"),
    ("footprint", "PCB_FOOTPRINT"),
    ("track", "PCB_TRACK"),
    ("segment", "PCB_TRACK"),
    ("arc", "PCB_ARC"),
    ("arc_segment", "PCB_ARC"),
    ("via", "PCB_VIA"),
    ("zone", "ZONE"),
    ("pad", "PCB_PAD"),
];

fn type_name(kind: Option<&str>) -> Option<&'static str> {
    let kind = kind?;
    TYPE_NAMES
        .iter()
        .find(|(name, _)| *name == kind)
        .map(|(_, type_name)| *type_name)
}

fn fallback_type_name(role: VisualRole) -> &'static str {
    match role {
        VisualRole::Component => "SCH_SYMBOL",
        VisualRole::Wire => "SCH_LINE",
        VisualRole::Label => "SCH_LABEL",
        VisualRole::Junction => "SCH_JUNCTION",
        VisualRole::Terminal => "SCH_PIN",
        _ => "EDA_ITEM",
    }
}

fn change_kind(status: VisualStatus) -> dc::KiCadProjectDiffChangeKind {
    match status {
        VisualStatus::Added => dc::KiCadProjectDiffChangeKind::Added,
        VisualStatus::Removed => dc::KiCadProjectDiffChangeKind::Removed,
        VisualStatus::Modified => dc::KiCadProjectDiffChangeKind::Modified,
    }
}

fn source_side(side: VisualSide) -> dc::KiCadProjectDiffSourceSide {
    match side {
        VisualSide::Reference => dc::KiCadProjectDiffSourceSide::Reference,
        VisualSide::Comparison => dc::KiCadProjectDiffSourceSide::Comparison,
    }
}

fn visual_status(kind: dc::DesignCompareChangeKind) -> VisualStatus {
    match kind {
        dc::DesignCompareChangeKind::Added => VisualStatus::Added,
        dc::DesignCompareChangeKind::Removed => VisualStatus::Removed,
        dc::DesignCompareChangeKind::Changed => VisualStatus::Modified,
    }
}

/// `_source_id`: the base's id for a removed change, the head's otherwise.
fn source_id(change: &dc::DesignCompareChange) -> Option<&str> {
    if change.kind == dc::DesignCompareChangeKind::Removed {
        return change.base.as_ref().map(|side| side.source_id.as_str());
    }
    change
        .head
        .as_ref()
        .map(|side| side.source_id.as_str())
        .or_else(|| change.base.as_ref().map(|side| side.source_id.as_str()))
}

/// `_document_path(change, None)`: the change's page, then its sides'.
fn fallback_document(change: &dc::DesignCompareChange) -> Option<String> {
    if change.domain == dc::DesignCompareDomain::Pcb {
        return None;
    }
    first_non_empty(&[
        change.page.as_deref(),
        change.head.as_ref().map(|side| side.document_path.as_str()),
        change.base.as_ref().map(|side| side.document_path.as_str()),
    ])
    .map(normalize)
}

// ------------------------------------------------------------------ shared

fn first_pcb_path(files: &dc::DesignCompareFiles) -> Option<String> {
    files
        .head
        .iter()
        .chain(files.base.iter())
        .map(|file| {
            let path = if file.path.is_empty() {
                file.filename.as_str()
            } else {
                file.path.as_str()
            };
            path.replace('\\', "/")
        })
        .find(|path| path.ends_with(".kicad_pcb"))
}

fn doc_type(change: &dc::DesignCompareChange) -> dc::KiCadProjectDiffDocType {
    match change.domain {
        dc::DesignCompareDomain::Pcb => dc::KiCadProjectDiffDocType::KicadPcb,
        dc::DesignCompareDomain::Schematic => dc::KiCadProjectDiffDocType::KicadSch,
    }
}

fn diagnostic(change_id: &str, reason: &str) -> dc::KiCadProjectDiffDiagnostic {
    dc::KiCadProjectDiffDiagnostic {
        change_id: change_id.to_owned(),
        reason: reason.to_owned(),
    }
}

fn navigation(
    first: &dc::KiCadProjectDiffNavigationDocument,
    documents: &[dc::KiCadProjectDiffNavigationDocument],
) -> dc::KiCadProjectDiffNavigation {
    dc::KiCadProjectDiffNavigation {
        document_path: first.document_path.clone(),
        change_id: first.change_id.clone(),
        change_ids: Some(first.change_ids.clone()),
        documents: (documents.len() > 1).then(|| documents.to_vec()),
    }
}

fn navigation_document(
    path: &str,
    change_id: String,
    change_ids: Vec<String>,
) -> dc::KiCadProjectDiffNavigationDocument {
    dc::KiCadProjectDiffNavigationDocument {
        document_path: path.to_owned(),
        change_id,
        change_ids,
    }
}

fn push_group(groups: &mut Vec<(String, Vec<usize>)>, path: String, index: usize) {
    match groups.iter_mut().find(|(existing, _)| *existing == path) {
        Some((_, indices)) => indices.push(index),
        None => groups.push((path, vec![index])),
    }
}

fn unique_ordered(items: Vec<String>) -> Vec<String> {
    let mut seen = BTreeSet::new();
    items
        .into_iter()
        .filter(|item| seen.insert(item.clone()))
        .collect()
}

fn normalize(path: &str) -> String {
    path.replace('\\', "/")
}

fn first_non_empty<'a>(candidates: &[Option<&'a str>]) -> Option<&'a str> {
    candidates
        .iter()
        .copied()
        .flatten()
        .find(|candidate| !candidate.is_empty())
}

fn side_rank(side: VisualSide) -> u8 {
    match side {
        VisualSide::Reference => 0,
        VisualSide::Comparison => 1,
    }
}

fn status_rank(status: VisualStatus) -> u8 {
    match status {
        VisualStatus::Added => 0,
        VisualStatus::Removed => 1,
        VisualStatus::Modified => 2,
    }
}

#[cfg(test)]
mod tests;
