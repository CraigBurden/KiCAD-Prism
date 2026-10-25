use crate::{
    ProjectBusAlias, ProjectDocument, ProjectErrorKind, ProjectLimits, ProjectView,
    SchematicBundleLimits, SchematicSubpartSettings, SourceBundleError, SourceBundleErrorKind,
    SourceFile,
};

#[derive(Clone, Debug)]
pub(crate) struct ProjectSchematicSettings {
    pub(crate) subparts: SchematicSubpartSettings,
    pub(crate) bus_aliases: Vec<ProjectBusAlias>,
    pub(crate) top_level_sheets: Vec<ProjectTopLevelSheet>,
    /// The project's `text_variables`, which a sheet file name may use
    /// (`sheet_file::expand`).
    pub(crate) text_variables: std::collections::BTreeMap<String, String>,
}

/// One entry of a KiCad 10 project's `schematic.top_level_sheets`: a schematic KiCad
/// loads as a root of the design (`SCH_EDIT_FRAME::OpenProjectFiles`).
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProjectTopLevelSheet {
    /// The file, relative to the project directory.
    pub filename: String,
    /// The sheet's name, shown in net and sheet paths when there are several roots.
    pub name: String,
    /// The sheet's UUID, which replaces the file's own; `None` when absent or nil.
    pub uuid: Option<String>,
}

const NIL_UUID: &str = "00000000-0000-0000-0000-000000000000";

/// The project's top-level sheets in file order, skipping entries without a file
/// name; empty when the project lists none (a single-root project).
#[must_use]
pub fn project_top_level_sheets(project: &serde_json::Value) -> Vec<ProjectTopLevelSheet> {
    top_level_sheets_of(project.get("schematic"))
}

fn top_level_sheets_of(schematic: Option<&serde_json::Value>) -> Vec<ProjectTopLevelSheet> {
    let text = |sheet: &serde_json::Value, key: &str| {
        sheet
            .get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_owned()
    };
    schematic
        .and_then(|schematic| schematic.get("top_level_sheets"))
        .and_then(serde_json::Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|sheet| {
            let filename = text(sheet, "filename");
            let uuid = text(sheet, "uuid");
            (!filename.is_empty()).then(|| ProjectTopLevelSheet {
                filename,
                name: text(sheet, "name"),
                uuid: (!uuid.is_empty() && uuid != NIL_UUID).then_some(uuid),
            })
        })
        .collect()
}

pub(crate) fn project_schematic_settings_with_limits(
    project: Option<&SourceFile>,
    limits: SchematicBundleLimits,
) -> Result<ProjectSchematicSettings, SourceBundleError> {
    let Some(project) = project else {
        return Ok(ProjectSchematicSettings {
            subparts: SchematicSubpartSettings::default(),
            bus_aliases: Vec::new(),
            top_level_sheets: Vec::new(),
            text_variables: std::collections::BTreeMap::new(),
        });
    };
    let document = ProjectDocument::from_reader(
        project.bytes(),
        ProjectLimits {
            max_source_bytes: project.bytes().len(),
            max_output_bytes: project.bytes().len(),
            max_bus_aliases: limits.max_bus_aliases_per_source,
            max_bus_alias_members: limits.max_bus_alias_members_per_source,
            max_typed_string_bytes: limits.max_decoded_string_bytes,
            ..ProjectLimits::default()
        },
    )
    .map_err(|error| {
        SourceBundleError::new(
            project_error_kind(error.kind),
            Some(project.path()),
            format!("project schematic settings are invalid: {error}"),
        )
    })?;
    let view = document.view();
    if let Some(schematic) = view.raw().get("schematic")
        && !schematic.is_object()
    {
        return Err(SourceBundleError::new(
            SourceBundleErrorKind::Project,
            Some(project.path()),
            "project schematic settings container must be a JSON object",
        ));
    }
    let bus_aliases = view.bus_aliases().map_err(|error| {
        SourceBundleError::new(
            project_error_kind(error.kind),
            Some(project.path()),
            format!("project schematic bus aliases are invalid: {error}"),
        )
    })?;
    Ok(ProjectSchematicSettings {
        subparts: SchematicSubpartSettings {
            first_id: setting_codepoint(
                setting(&view, "schematic.subpart_first_id", project)?,
                SchematicSubpartSettings::default().first_id,
                project,
                "subpart_first_id",
            )?,
            separator: setting_codepoint(
                setting(&view, "schematic.subpart_id_separator", project)?,
                SchematicSubpartSettings::default().separator,
                project,
                "subpart_id_separator",
            )?,
        },
        bus_aliases,
        top_level_sheets: top_level_sheets_of(view.raw().get("schematic")),
        text_variables: text_variables_of(view.raw().get("text_variables")),
    })
}

const fn project_error_kind(kind: ProjectErrorKind) -> SourceBundleErrorKind {
    if matches!(kind, ProjectErrorKind::ResourceLimit) {
        SourceBundleErrorKind::ResourceLimit
    } else {
        SourceBundleErrorKind::Project
    }
}

fn setting(
    view: &ProjectView<'_>,
    path: &str,
    project: &SourceFile,
) -> Result<Option<i64>, SourceBundleError> {
    let Some(value) = view.get_path(path) else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    value.as_i64().map(Some).ok_or_else(|| {
        SourceBundleError::new(
            SourceBundleErrorKind::Project,
            Some(project.path()),
            format!("{path} must be an integer"),
        )
    })
}

fn setting_codepoint(
    value: Option<i64>,
    fallback: u32,
    project: &SourceFile,
    field: &str,
) -> Result<u32, SourceBundleError> {
    value.map_or(Ok(fallback), |value| {
        u32::try_from(value).map_err(|_| {
            SourceBundleError::new(
                SourceBundleErrorKind::Project,
                Some(project.path()),
                format!("schematic.{field} is outside the uint32 range"),
            )
        })
    })
}

/// A project's `text_variables`: each string value by name.
fn text_variables_of(
    value: Option<&serde_json::Value>,
) -> std::collections::BTreeMap<String, String> {
    value
        .and_then(serde_json::Value::as_object)
        .map(|entries| {
            entries
                .iter()
                .filter_map(|(name, value)| Some((name.clone(), value.as_str()?.to_owned())))
                .collect()
        })
        .unwrap_or_default()
}
