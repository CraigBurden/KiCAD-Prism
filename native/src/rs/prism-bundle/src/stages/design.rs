//! The schematic model and `design.json` (`kicad_monkey.design.a0`), built
//! by the core from the project file, every reached sheet and the board.
//!
//! Moved from a1 (sim: `src/prism-bundle/src/design.rs`). Two changes: every
//! source is addressed by its repository path, and the board is the source
//! board stage parse read (a1 used the refilled board; a2 builds
//! `design.json` in stage parse, before any refill).

use prism_kicad_contracts::generated::source_bundle_manifest::{
    SourceBundleManifestA0, SourceBundleSource, SourceKind,
};
use prism_kicad_core::{
    KiCadDesignFacts, KiCadDesignJsonBytes, KiCadDesignJsonPaths, KiCadDesignPcb,
    KiCadDesignSourcePath, KiCadNetlistLimits, PcbView, ProjectLimits, SchematicBundleIndex,
    SchematicBundleLimits, SourceBundle, SourceBundleLimits, build_kicad_design_facts,
    build_kicad_design_json_bytes, build_kicad_design_semantic_inputs,
};
use serde_json::Value;

/// One source text, by repository path.
pub struct Text {
    /// Repository path.
    pub path: String,
    /// The file's text.
    pub text: String,
}

fn descriptor(file: &Text, kind: SourceKind, slot: usize) -> Result<SourceBundleSource, String> {
    serde_json::from_value(serde_json::json!({
        "kind": kind,
        "path": file.path,
        "slot": slot,
        "source_bytes": file.text.len().to_string(),
    }))
    .map_err(|error| error.to_string())
}

/// The core's source bundle of the project file and the sheets, the root
/// schematic first.
pub fn source_bundle(
    project: &Text,
    sheets: &[Text],
    limits: SourceBundleLimits,
) -> Result<SourceBundle, String> {
    let files = std::iter::once((project, SourceKind::Project))
        .chain(sheets.iter().map(|sheet| (sheet, SourceKind::Schematic)));
    let mut descriptors = Vec::new();
    let mut buffers = Vec::new();
    for (slot, (file, kind)) in files.enumerate() {
        descriptors.push(descriptor(file, kind, slot)?);
        buffers.push(file.text.as_bytes().to_vec());
    }
    let manifest = SourceBundleManifestA0 {
        project_path: Some(project.path.clone()),
        root_schematic_path: sheets
            .first()
            .map(|sheet| sheet.path.clone())
            .unwrap_or_default(),
        schema: "kicad_monkey.source_bundle_manifest.a0".to_owned(),
        sources: descriptors,
        type_: "kicad_monkey.source_bundle_manifest".to_owned(),
        version: "a0".to_owned(),
    };
    SourceBundle::from_manifest(manifest, buffers, limits).map_err(|error| error.to_string())
}

/// The realized hierarchy.
pub fn index(
    bundle: &SourceBundle,
    limits: SchematicBundleLimits,
) -> Result<SchematicBundleIndex, String> {
    SchematicBundleIndex::build(bundle, limits).map_err(|error| error.to_string())
}

/// The compiled graph and netlist.
pub fn facts<'index>(
    index: &'index SchematicBundleIndex,
    bundle: &SourceBundle,
    project_limits: ProjectLimits,
) -> Result<KiCadDesignFacts<'index>, String> {
    build_kicad_design_facts(
        index,
        bundle,
        project_limits,
        Default::default(),
        KiCadNetlistLimits::default(),
    )
    .map_err(|error| error.to_string())
}

fn paths(project: &Text, sheets: &[Text]) -> KiCadDesignJsonPaths {
    let name = crate::paths::file_name(&project.path);
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    KiCadDesignJsonPaths {
        project_name: Some(stem.to_owned()),
        project_filename: Some(project.path.clone()),
        project_path: Some(project.path.clone()),
        schematic_paths: sheets
            .iter()
            .map(|sheet| {
                let path = KiCadDesignSourcePath {
                    filename: crate::paths::file_name(&sheet.path).to_owned(),
                    path: sheet.path.clone(),
                };
                (sheet.path.clone(), path)
            })
            .collect(),
    }
}

/// `design.json` of the project, with the board's placement facts: the
/// member's bytes, and the `components` and `nets` the semantic index reads.
pub fn design_json(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
    project: &Text,
    sheets: &[Text],
    board: Option<(&str, &PcbView<'_>)>,
) -> Result<KiCadDesignJsonBytes, String> {
    let pcb = board.map(|(path, view)| KiCadDesignPcb {
        source_filename: path,
        view,
    });
    let mut built = build_kicad_design_json_bytes(index, facts, &paths(project, sheets), pcb, true)
        .map_err(|error| error.to_string())?;
    // The member is compact JSON plus one LF (conventions.md §13).
    built.bytes.push(b'\n');
    Ok(built)
}

/// The `components` and `nets` the semantic index reads, for a run that does
/// not write `design.json` (`compare`): the same values [`design_json`]
/// carries, without building the rest of it.
pub fn semantic_inputs(
    index: &SchematicBundleIndex,
    facts: &KiCadDesignFacts<'_>,
) -> Result<Value, String> {
    build_kicad_design_semantic_inputs(index, facts).map_err(|error| error.to_string())
}
