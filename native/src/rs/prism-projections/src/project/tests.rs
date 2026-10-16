//! Unit tests for the producer's resolution (`project.py:167-303`) and the
//! text-path and title-block rules.

use std::collections::{BTreeMap, BTreeSet};

use super::reference::{EmbeddedLayer, Reason, RefKind, Target};
use super::resolver::{Resolver, normalize};
use super::text_paths::is_path_reference;
use super::title_block::tb_expand;

fn variables(pairs: &[(&str, &str)]) -> BTreeMap<String, String> {
    pairs
        .iter()
        .map(|(key, value)| ((*key).to_owned(), (*value).to_owned()))
        .collect()
}

fn sources(paths: &[&str]) -> BTreeSet<String> {
    paths.iter().map(|path| (*path).to_owned()).collect()
}

fn target(
    raw: &str,
    kind: RefKind,
    project_dir: &[&str],
    text_variables: &BTreeMap<String, String>,
    sources_set: &BTreeSet<String>,
) -> (Vec<String>, Target) {
    let project_dir: Vec<String> = project_dir.iter().map(|s| (*s).to_owned()).collect();
    let resolver = Resolver {
        project_name: "demo",
        text_variables,
        project_dir: &project_dir,
        sources: sources_set,
    };
    resolver.resolve(raw, kind, "demo.kicad_sch", &[])
}

fn is_reason(target: &Target, reason: Reason) -> bool {
    matches!(target, Target::Unresolved { reason: actual, .. } if actual.as_str() == reason.as_str())
}

#[test]
fn embedded_without_a_match_is_embedded_missing() {
    let (_, target) = target(
        "kicad-embed://missing.stp",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::EmbeddedMissing));
}

#[test]
fn embedded_outside_the_embeddable_kinds_is_a_uri() {
    let (_, target) = target(
        "kicad-embed://missing.stp",
        RefKind::SheetFile,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::Uri));
}

#[test]
fn a_home_relative_path_is_home_relative() {
    let (_, target) = target(
        "~/kicad/models/D_SOD-123.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::HomeRelative));
}

#[test]
fn a_uri_is_a_uri() {
    let (_, target) = target(
        "https://example.com/a.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::Uri));
}

#[test]
fn an_alias_of_a_library_variable_is_a_kicad_library() {
    let (variables, target) = target(
        ":KICAD9_3DMODEL_DIR:Package_TO_SOT_SMD.3dshapes/SOT-23.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(variables.is_empty());
    match target {
        Target::KiCadLibrary {
            variable,
            library,
            relative_path,
        } => {
            assert_eq!(variable, "KICAD9_3DMODEL_DIR");
            assert_eq!(library.as_str(), "model-3d");
            assert_eq!(relative_path, "Package_TO_SOT_SMD.3dshapes/SOT-23.step");
        }
        _ => panic!("expected a kicad-library target"),
    }
}

#[test]
fn an_unknown_alias_is_an_alias() {
    let (_, target) = target(
        ":NotALibrary:foo.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::Alias));
}

#[test]
fn climbing_above_the_repository_is_outside_repository() {
    let (variables, target) = target(
        "${KIPRJMOD}/../shared-models/SOT-23.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert_eq!(variables, ["KIPRJMOD"]);
    match target {
        Target::OutsideRepository { path, base } => {
            assert_eq!(path, "../shared-models/SOT-23.step");
            assert_eq!(base.as_str(), "project-variable");
        }
        _ => panic!("expected an outside-repository target"),
    }
}

#[test]
fn a_text_variable_cycle_is_a_variable_loop() {
    let text_variables = variables(&[("A", "${B}"), ("B", "${A}")]);
    let (_, target) = target(
        "${A}/x.step",
        RefKind::Model3d,
        &[],
        &text_variables,
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::VariableLoop));
}

#[test]
fn a_marker_that_does_not_start_the_text_is_misplaced() {
    let (variables, target) = target(
        "prefix${KIPRJMOD}/x.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert_eq!(variables, ["KIPRJMOD"]);
    match target {
        Target::Unresolved { reason, variable } => {
            assert_eq!(reason.as_str(), "misplaced-variable");
            assert_eq!(variable.as_deref(), Some("KIPRJMOD"));
        }
        _ => panic!("expected an unresolved target"),
    }
}

#[test]
fn a_nondeterministic_variable_names_the_variable() {
    let (_, target) = target(
        "${CURRENT_DATE}/x.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    match target {
        Target::Unresolved { reason, variable } => {
            assert_eq!(reason.as_str(), "nondeterministic-variable");
            assert_eq!(variable.as_deref(), Some("CURRENT_DATE"));
        }
        _ => panic!("expected an unresolved target"),
    }
}

#[test]
fn an_undefined_variable_names_the_variable() {
    let (variables, target) = target(
        "${TEAM_LIBS}/Team.pretty",
        RefKind::FootprintLibrary,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(variables.is_empty());
    match target {
        Target::Unresolved { reason, variable } => {
            assert_eq!(reason.as_str(), "undefined-variable");
            assert_eq!(variable.as_deref(), Some("TEAM_LIBS"));
        }
        _ => panic!("expected an unresolved target"),
    }
}

#[test]
fn a_resolved_repository_path_reports_in_sources() {
    let sources_set = sources(&["packages3D/796638-2.step"]);
    let (variables, target) = target(
        "${KIPRJMOD}/packages3D/796638-2.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &sources_set,
    );
    assert_eq!(variables, ["KIPRJMOD"]);
    match target {
        Target::Repository {
            path,
            base,
            in_sources,
        } => {
            assert_eq!(path, "packages3D/796638-2.step");
            assert_eq!(base.as_str(), "project-variable");
            assert!(in_sources);
        }
        _ => panic!("expected a repository target"),
    }
}

#[test]
fn a_directory_target_is_in_sources_for_a_file_below_it() {
    let sources_set = sources(&["PrismFixture.pretty/Conn.kicad_mod"]);
    let (_, target) = target(
        "${KIPRJMOD}/PrismFixture.pretty",
        RefKind::FootprintLibrary,
        &[],
        &BTreeMap::new(),
        &sources_set,
    );
    match target {
        Target::Repository { in_sources, .. } => assert!(in_sources),
        _ => panic!("expected a repository target"),
    }
}

#[test]
fn a_sheet_file_joins_the_document_directory() {
    let resolver = Resolver {
        project_name: "demo",
        text_variables: &BTreeMap::new(),
        project_dir: &[],
        sources: &sources(&["Subsheets/child.kicad_sch"]),
    };
    let (_, target) = resolver.resolve(
        "Subsheets/child.kicad_sch",
        RefKind::SheetFile,
        "Subsheets/parent.kicad_sch",
        &[],
    );
    match target {
        Target::Repository { path, base, .. } => {
            assert_eq!(path, "Subsheets/Subsheets/child.kicad_sch");
            assert_eq!(base.as_str(), "document-directory");
        }
        _ => panic!("expected a repository target"),
    }
}

#[test]
fn an_absolute_path_is_normalized() {
    let (_, target) = target(
        "/opt/libs/../libs/Host.pretty",
        RefKind::FootprintLibrary,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    match target {
        Target::Absolute { path } => assert_eq!(path, "/opt/libs/Host.pretty"),
        _ => panic!("expected an absolute target"),
    }
}

#[test]
fn a_library_path_climbing_above_its_root_is_outside_library_root() {
    let (_, target) = target(
        "${KICAD9_3DMODEL_DIR}/../extra.step",
        RefKind::Model3d,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::OutsideLibraryRoot));
}

#[test]
fn a_project_marker_alone_is_an_empty_path() {
    let (_, target) = target(
        "${KIPRJMOD}",
        RefKind::FootprintLibrary,
        &[],
        &BTreeMap::new(),
        &BTreeSet::new(),
    );
    assert!(is_reason(&target, Reason::EmptyPath));
}

#[test]
fn a_text_variable_is_used_before_a_library_variable() {
    let text_variables = variables(&[("KICAD9_3DMODEL_DIR", "custom")]);
    let (variables, target) = target(
        "${KICAD9_3DMODEL_DIR}/x.step",
        RefKind::Model3d,
        &[],
        &text_variables,
        &BTreeSet::new(),
    );
    assert_eq!(variables, ["KICAD9_3DMODEL_DIR"]);
    match target {
        Target::Repository { path, .. } => assert_eq!(path, "custom/x.step"),
        _ => panic!("expected a repository target"),
    }
}

#[test]
fn an_embedded_file_matches_the_lookup_order() {
    let files = BTreeMap::from([("BSL308PE.stp".to_owned(), "model".to_owned())]);
    let stack = [EmbeddedLayer {
        document: "board.kicad_pcb",
        footprint_uuid: Some("8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03"),
        files: &files,
    }];
    let resolver = Resolver {
        project_name: "demo",
        text_variables: &BTreeMap::new(),
        project_dir: &[],
        sources: &BTreeSet::new(),
    };
    let (_, target) = resolver.resolve(
        "kicad-embed://BSL308PE.stp",
        RefKind::Model3d,
        "board.kicad_pcb",
        &stack,
    );
    match target {
        Target::Embedded {
            name,
            document_path,
            footprint_uuid,
            file_type,
        } => {
            assert_eq!(name, "BSL308PE.stp");
            assert_eq!(document_path, "board.kicad_pcb");
            assert_eq!(
                footprint_uuid.as_deref(),
                Some("8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03")
            );
            assert_eq!(file_type, "model");
        }
        _ => panic!("expected an embedded target"),
    }
}

#[test]
fn only_known_shapes_are_path_references() {
    assert!(is_path_reference("${KIPRJMOD}/a.step"));
    assert!(is_path_reference("${MY_DIR}"));
    assert!(is_path_reference("${MY_PATH}"));
    assert!(!is_path_reference("${MY_VARIABLE}"));
    assert!(!is_path_reference("${JOBSET_OUTPUT_WORK_PATH}/x"));
    assert!(!is_path_reference("plain text"));
}

#[test]
fn title_block_expansion_is_recursive_and_bounded() {
    let variables = variables(&[("A", "${B}"), ("B", "value")]);
    assert_eq!(tb_expand("${A}", &variables), "value");
    assert_eq!(tb_expand("${#}", &variables), "${#}");
    assert_eq!(tb_expand("plain", &variables), "plain");
}

#[test]
fn normalize_drops_dots_and_cancels_dot_dot() {
    assert_eq!(normalize(&[], "a/./b/../c"), ["a", "c"]);
    assert_eq!(normalize(&["x".to_owned()], "../y"), ["y"]);
    assert_eq!(normalize(&[], "../../y"), ["..", "..", "y"]);
}
