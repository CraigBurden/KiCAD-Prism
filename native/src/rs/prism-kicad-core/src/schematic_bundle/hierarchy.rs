//! The realized sheet hierarchy: one occurrence per sheet instance, walked
//! depth-first from the project's top-level sheets.

use super::path_helpers::{join_occurrence_path, nonempty_or};
use super::sheet_parse::default_sheet;
use super::{SchematicDefinition, SchematicOccurrence, SchematicSheet, schematic_limit};
use crate::schematic_bundle_limits::SchematicBundleLimits;
use crate::schematic_project::ProjectTopLevelSheet;
use crate::sheet_file::Variables;
use crate::source_bundle::{SourceBundle, SourceBundleError, SourceBundleErrorKind};
use std::collections::{HashMap, HashSet};

/// A sheet the walk starts from.
pub(super) struct HierarchyRoot {
    source_path: String,
    sheet: Option<SchematicSheet>,
}

/// The sheets KiCad 10 opens a project with (`SCH_EDIT_FRAME::OpenProjectFiles`):
/// each listed `schematic.top_level_sheets` file that is in the bundle, in order.
/// Two or more become top-level sheets under KiCad's virtual root, each named
/// and identified by its listing (`SCHEMATIC::SetTopLevelSheets`); one is the
/// root schematic as before; none falls back to the bundle's root schematic.
pub(super) fn hierarchy_roots(
    bundle: &SourceBundle,
    listed: &[ProjectTopLevelSheet],
    definitions: &[SchematicDefinition],
    definition_by_path: &HashMap<String, usize>,
    limits: SchematicBundleLimits,
) -> Result<Vec<HierarchyRoot>, SourceBundleError> {
    let anchor = bundle
        .project_path()
        .unwrap_or_else(|| bundle.root_schematic_path());
    let mut seen = HashSet::new();
    let mut found = Vec::new();
    for entry in listed {
        let Some(source) = bundle.resolve_schematic(
            anchor,
            &entry.filename,
            Variables::default(),
            limits.max_path_bytes,
        )?
        else {
            continue;
        };
        if seen.insert(source.path().to_owned()) {
            found.push((entry, source.path().to_owned()));
        }
    }
    if found.len() < 2 {
        let source_path = found
            .pop()
            .map_or_else(|| bundle.root_schematic_path().to_owned(), |(_, path)| path);
        return Ok(vec![HierarchyRoot {
            source_path,
            sheet: None,
        }]);
    }
    Ok(found
        .into_iter()
        .map(|(entry, source_path)| {
            let own_uuid = definition_by_path
                .get(&source_path)
                .and_then(|&index| definitions[index].uuid.clone());
            let mut sheet = default_sheet();
            sheet.uuid = entry.uuid.clone().or(own_uuid).unwrap_or_default();
            sheet.sheet_name.clone_from(&entry.name);
            sheet.sheet_file.clone_from(&entry.filename);
            HierarchyRoot {
                source_path,
                sheet: Some(sheet),
            }
        })
        .collect())
}

#[derive(Clone, Debug)]
enum HierarchyWork {
    Enter(Box<HierarchyEnter>),
    Exit(String),
}

#[derive(Clone, Debug)]
struct HierarchyEnter {
    source_path: String,
    parent_index: Option<usize>,
    parent_sheet_index: Option<usize>,
    sheet: Option<SchematicSheet>,
    parent_address: String,
    parent_legacy_address: String,
    parent_human_address: String,
    effective_in_bom: bool,
    effective_on_board: bool,
    effective_dnp: bool,
    effective_exclude_from_sim: bool,
}

pub(super) fn realize_occurrences(
    bundle: &SourceBundle,
    roots: Vec<HierarchyRoot>,
    definitions: &[SchematicDefinition],
    definition_by_path: &HashMap<String, usize>,
    variables: Variables<'_>,
    limits: SchematicBundleLimits,
) -> Result<Vec<SchematicOccurrence>, SourceBundleError> {
    let mut occurrences = Vec::new();
    let mut active_sources = HashSet::new();
    let mut work = roots
        .into_iter()
        .rev()
        .map(|root| {
            HierarchyWork::Enter(Box::new(HierarchyEnter {
                source_path: root.source_path,
                parent_index: None,
                parent_sheet_index: None,
                sheet: root.sheet,
                parent_address: String::new(),
                parent_legacy_address: String::new(),
                parent_human_address: String::new(),
                effective_in_bom: true,
                effective_on_board: true,
                effective_dnp: false,
                effective_exclude_from_sim: false,
            }))
        })
        .collect::<Vec<_>>();
    while let Some(item) = work.pop() {
        match item {
            HierarchyWork::Exit(source_path) => {
                active_sources.remove(&source_path);
            }
            HierarchyWork::Enter(enter) => {
                if !active_sources.insert(enter.source_path.clone()) {
                    return Err(SourceBundleError::new(
                        SourceBundleErrorKind::HierarchyCycle,
                        Some(&enter.source_path),
                        "schematic hierarchy contains a source cycle",
                    ));
                }
                if occurrences.len() >= limits.max_occurrences {
                    return Err(schematic_limit(
                        &enter.source_path,
                        "hierarchy occurrence count exceeds its limit",
                    ));
                }
                let definition_index =
                    *definition_by_path.get(&enter.source_path).ok_or_else(|| {
                        SourceBundleError::new(
                            SourceBundleErrorKind::MissingSource,
                            Some(&enter.source_path),
                            "resolved schematic was not indexed",
                        )
                    })?;
                let definition = &definitions[definition_index];
                let index = occurrences.len() + 1;
                let occurrence = materialize_occurrence(&enter, definition, index, limits)?;
                let occurrence_address = occurrence.occurrence_address.clone();
                let legacy_address = occurrence.legacy_address.clone();
                let human_address = occurrence.human_address.clone();
                occurrences.push(occurrence);
                work.push(HierarchyWork::Exit(enter.source_path.clone()));
                for (child_index, child) in distinct_sheets(&definition.sheets).enumerate().rev() {
                    let Some(child_source) = bundle.resolve_schematic(
                        &enter.source_path,
                        &child.sheet_file,
                        variables,
                        limits.max_path_bytes,
                    )?
                    else {
                        continue;
                    };
                    let child_path = child_source.path().to_owned();
                    work.push(HierarchyWork::Enter(Box::new(HierarchyEnter {
                        source_path: child_path,
                        parent_index: Some(index),
                        parent_sheet_index: Some(child_index),
                        sheet: Some(child.clone()),
                        parent_address: occurrence_address.clone(),
                        parent_legacy_address: legacy_address.clone(),
                        parent_human_address: human_address.clone(),
                        effective_in_bom: enter.effective_in_bom && child.in_bom,
                        effective_on_board: enter.effective_on_board && child.on_board,
                        effective_dnp: enter.effective_dnp || child.dnp,
                        effective_exclude_from_sim: enter.effective_exclude_from_sim
                            || child.exclude_from_sim,
                    })));
                }
            }
        }
    }
    Ok(occurrences)
}

/// A sheet's UUID names its occurrence path. KiCad keeps a UUID two sheets share
/// (`SCH_SCREENS::ReplaceDuplicateTimeStamps` leaves sheets to a @todo), so a later
/// sibling sharing one is numbered here to keep the occurrences apart.
fn distinct_sheets(
    sheets: &[SchematicSheet],
) -> impl DoubleEndedIterator<Item = SchematicSheet> + ExactSizeIterator {
    let mut seen = HashMap::<String, usize>::new();
    sheets
        .iter()
        .map(|sheet| {
            let key = if sheet.uuid.is_empty() {
                &sheet.sheet_file
            } else {
                &sheet.uuid
            };
            let uses = seen.entry(key.clone()).or_default();
            *uses += 1;
            let mut sheet = sheet.clone();
            if *uses > 1 {
                sheet.uuid = format!("{key}#{}", *uses - 1);
            }
            sheet
        })
        .collect::<Vec<_>>()
        .into_iter()
}

fn materialize_occurrence(
    enter: &HierarchyEnter,
    definition: &SchematicDefinition,
    index: usize,
    limits: SchematicBundleLimits,
) -> Result<SchematicOccurrence, SourceBundleError> {
    let (occurrence_address, legacy_address, human_address) =
        occurrence_paths(enter, definition, limits)?;
    let (sheet_uuid, sheet_name, sheet_file) = enter.sheet.as_ref().map_or_else(
        || (None, "root".to_owned(), String::new()),
        |value| {
            (
                (!value.uuid.is_empty()).then(|| value.uuid.clone()),
                if value.sheet_name.is_empty() {
                    value.sheet_file.clone()
                } else {
                    value.sheet_name.clone()
                },
                value.sheet_file.clone(),
            )
        },
    );
    Ok(SchematicOccurrence {
        index,
        source_path: enter.source_path.clone(),
        parent_index: enter.parent_index,
        parent_sheet_index: enter.parent_sheet_index,
        sheet_uuid,
        sheet_name,
        sheet_file,
        occurrence_address,
        legacy_address,
        human_address,
        effective_in_bom: enter.effective_in_bom,
        effective_on_board: enter.effective_on_board,
        effective_dnp: enter.effective_dnp,
        effective_exclude_from_sim: enter.effective_exclude_from_sim,
    })
}

fn occurrence_paths(
    enter: &HierarchyEnter,
    definition: &SchematicDefinition,
    limits: SchematicBundleLimits,
) -> Result<(String, String, String), SourceBundleError> {
    let uuid_segment = enter
        .sheet
        .as_ref()
        .map(|sheet| nonempty_or(&sheet.uuid, &sheet.sheet_file))
        .or(definition.uuid.as_deref())
        .unwrap_or("root");
    let occurrence = join_occurrence_path(&enter.parent_address, uuid_segment, false);
    let legacy = enter.sheet.as_ref().map_or_else(
        || "/".to_owned(),
        |_| join_occurrence_path(&enter.parent_legacy_address, uuid_segment, true),
    );
    let human = enter.sheet.as_ref().map_or_else(
        || "/".to_owned(),
        |sheet| {
            join_occurrence_path(
                &enter.parent_human_address,
                nonempty_or(&sheet.sheet_name, &sheet.sheet_file),
                true,
            )
        },
    );
    if [occurrence.len(), legacy.len(), human.len()]
        .into_iter()
        .any(|bytes| bytes > limits.max_path_bytes)
    {
        return Err(schematic_limit(
            &enter.source_path,
            "schematic occurrence path exceeds max_path_bytes",
        ));
    }
    Ok((occurrence, legacy, human))
}
