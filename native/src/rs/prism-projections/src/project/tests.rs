//! Unit tests for the producer's resolution (`project.py:167-303`) and the
//! text-path and title-block rules.

use std::collections::BTreeMap;

use crate::test_support::SetSources;

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

fn sources(paths: &[&str]) -> SetSources {
    SetSources::of(paths)
}

fn target(
    raw: &str,
    kind: RefKind,
    project_dir: &[&str],
    text_variables: &BTreeMap<String, String>,
    sources_set: &SetSources,
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        &SetSources::default(),
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
        sources: &SetSources::default(),
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
    assert_eq!(
        normalize(&["x".to_owned()], "sub\\power.kicad_sch"),
        ["x", "sub", "power.kicad_sch"]
    );
}

/// The regex each hand-written scanner replaces. Every scanner's behavior is
/// compared with its regex over generated and curated edge cases, so the two
/// stay in step.
#[cfg(test)]
mod scanner_parity {
    use std::collections::BTreeMap;

    use regex::Regex;

    use super::super::resolver::{is_drive, is_uri, marker_at, var_at, versioned_library};
    use super::super::sexpr::is_canonical_uuid;
    use super::super::text_paths::{closure_var_at, is_path_reference};
    use super::super::title_block::{tb_expand, tb_var_at};

    /// Every string over `alphabet` of length at most `max_len`, with "" first.
    fn generated(alphabet: &[char], max_len: usize) -> Vec<String> {
        let mut out = vec![String::new()];
        let mut level = vec![String::new()];
        for _ in 0..max_len {
            let mut next = Vec::new();
            for prefix in &level {
                for &symbol in alphabet {
                    let mut text = prefix.clone();
                    text.push(symbol);
                    next.push(text);
                }
            }
            out.extend(next.iter().cloned());
            level = next;
        }
        out
    }

    /// The scanner's match at `$` compared with the regex's leftmost match at
    /// that same position (a match starting later is not a match here).
    fn assert_var_at(regex: &Regex, text: &str, start: usize) {
        let scanner = var_at(text.as_bytes(), start);
        let sliced = &text[start..];
        let found = regex.find(sliced).filter(|found| found.start() == 0);
        match (scanner, found) {
            (Some((name_start, name_end, end)), Some(found)) => {
                let captures = regex.captures(sliced).unwrap();
                let group = captures
                    .get(1)
                    .or_else(|| captures.get(2))
                    .or_else(|| captures.get(3))
                    .unwrap();
                assert_eq!(&text[name_start..name_end], group.as_str(), "{text:?}");
                assert_eq!(end, start + found.end(), "{text:?}");
            }
            (None, None) => {}
            _ => panic!("scanner and regex disagree at {start} of {text:?}"),
        }
    }

    #[test]
    fn resolver_var_scanner_matches_its_regex() {
        let regex = Regex::new(r"\$(?:\{([A-Za-z0-9_:]+)\}|\(([A-Za-z0-9_:]+)\)|([A-Za-z0-9_:]+))")
            .unwrap();
        let mut cases: Vec<String> = [
            "", "$", "${", "$}", "$(A)", "${A}", "$A", "$A_B", "$A:B", "$(A B)", "$${A}",
            "${A}{B}", "$-", "${-}", "a$b c$d",
        ]
        .iter()
        .map(|text| (*text).to_owned())
        .collect();
        cases.extend(generated(&['$', '{', '}', '(', ')', 'A', '_', ':'], 4));
        for case in cases {
            for start in 0..case.len() {
                if case.as_bytes()[start] == b'$' {
                    assert_var_at(&regex, &case, start);
                }
            }
        }
    }

    fn find_bytes(bytes: &[u8], needle: u8) -> Vec<usize> {
        bytes
            .iter()
            .enumerate()
            .filter(|(_, byte)| **byte == needle)
            .map(|(index, _)| index)
            .collect()
    }

    fn assert_closure_var_at(regex: &Regex, text: &str, start: usize) {
        let scanner = closure_var_at(text.as_bytes(), start);
        let sliced = &text[start..];
        let found = regex.find(sliced).filter(|found| found.start() == 0);
        match (scanner, found) {
            (Some((name_start, name_end, end)), Some(found)) => {
                let name = regex.captures(sliced).unwrap().get(1).unwrap();
                assert_eq!(&text[name_start..name_end], name.as_str(), "{text:?}");
                assert_eq!(end, start + found.end(), "{text:?}");
            }
            (None, None) => {}
            _ => panic!("scanner and regex disagree at {start} of {text:?}"),
        }
    }

    /// The exact rule `is_path_reference` replaces (`project.py:310-323`).
    fn path_reference_reference(value: &str) -> bool {
        let regex = Regex::new(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}").unwrap();
        if !regex.is_match(value) {
            return false;
        }
        if regex.captures_iter(value).any(|captures| {
            captures.get(1).is_some_and(|name| {
                name.as_str()
                    .eq_ignore_ascii_case("JOBSET_OUTPUT_WORK_PATH")
            })
        }) {
            return false;
        }
        if value.contains('/') || value.contains('\\') {
            return true;
        }
        let trimmed = value.trim();
        let Some(captures) = regex.captures(trimmed) else {
            return false;
        };
        if captures.get(0).map(|whole| whole.range()) != Some(0..trimmed.len()) {
            return false;
        }
        let name = captures
            .get(1)
            .map_or("", |group| group.as_str())
            .to_ascii_uppercase();
        name == "KIPRJMOD" || name.ends_with("_DIR") || name.ends_with("_PATH")
    }

    #[test]
    fn path_reference_scanner_matches_its_regex() {
        let regex = Regex::new(r"\$\{([A-Za-z_][A-Za-z0-9_]*)\}").unwrap();
        let mut cases: Vec<String> = [
            "",
            "$",
            "${}",
            "${A}",
            "${_}",
            "${A0_}",
            "$${A}",
            "${A{B}}",
            "${A}}",
            "${café}",
            "\u{a0}${MY_DIR}\u{a0}",
            "\t${MY_PATH}",
            "${JOBSET_OUTPUT_WORK_PATH}",
            "${jobset_output_work_path}/x",
            "${A}/x",
            "x${A}/y",
            "a\\b${A}",
            "${a_DIR}",
            "${a_path}",
            "${KIPRJMOD}",
            "${kiprjmod}",
            "${a_DIREXTRA}",
            "plain text",
            "${}${A}",
            "${A}\n",
        ]
        .iter()
        .map(|text| (*text).to_owned())
        .collect();
        cases.extend(generated(&['$', '{', '}', 'A', '_', '/', '\\', ' '], 4));
        for case in &cases {
            assert_eq!(
                is_path_reference(case),
                path_reference_reference(case),
                "{case:?}"
            );
        }
        for case in &cases {
            for start in find_bytes(case.as_bytes(), b'$') {
                assert_closure_var_at(&regex, case, start);
            }
        }
    }

    #[test]
    fn resolver_classification_scanners_match_their_regexes() {
        let uri = Regex::new(r"^[A-Za-z][A-Za-z0-9+.-]*://").unwrap();
        let drive = Regex::new(r"^[A-Za-z]:/").unwrap();
        let library = Regex::new(
            r"^KICAD[0-9]+_(3DMODEL_DIR|SYMBOL_DIR|FOOTPRINT_DIR|TEMPLATE_DIR|3RD_PARTY)$",
        )
        .unwrap();
        let mut cases: Vec<String> = [
            "",
            "https://example.com/a.step",
            "file:///x",
            "a+.-://",
            "1://",
            "://",
            "C:/x",
            "c:/x",
            "C:\\x",
            "KICAD9_3DMODEL_DIR",
            "KICAD10_3RD_PARTY",
            "KICAD_SYMBOL_DIR",
            "KICAD9_3DMODEL_DIRX",
            "KICAD__3DMODEL_DIR",
        ]
        .iter()
        .map(|text| (*text).to_owned())
        .collect();
        cases.extend(generated(&['a', ':', '/', '+', '-', '.', '1'], 3));
        for case in cases {
            assert_eq!(is_uri(&case), uri.is_match(&case), "{case:?}");
            assert_eq!(is_drive(&case), drive.is_match(&case), "{case:?}");
            let expected = library
                .captures(&case)
                .and_then(|captures| captures.get(1))
                .map(|group| group.as_str());
            assert_eq!(versioned_library(&case), expected, "{case:?}");
        }
    }

    #[test]
    fn marker_scanner_matches_its_regex() {
        let regex = Regex::new("\u{0}(?:PRJ|LIB:[A-Za-z0-9_:]+)\u{0}").unwrap();
        let mut cases: Vec<String> = [
            "",
            "\u{0}PRJ\u{0}",
            "\u{0}LIB:Device\u{0}",
            "\u{0}LIB:\u{0}",
            "x\u{0}PRJ\u{0}y",
            "\u{0}LIB:A:B_C\u{0}",
            "\u{0}LIB:x",
            "\u{0}PRJ",
            "\u{0}LIB:A\u{0}PRJ\u{0}",
        ]
        .iter()
        .map(|text| (*text).to_owned())
        .collect();
        cases.extend(generated(&['\u{0}', 'P', 'R', 'J', 'L', 'I', 'B', ':'], 5));
        for case in cases {
            let expected: Vec<usize> = regex.find_iter(&case).map(|found| found.end()).collect();
            let bytes = case.as_bytes();
            let mut actual = Vec::new();
            let mut cursor = 0;
            while let Some(at) = find_bytes(&bytes[cursor..], 0)
                .first()
                .map(|rel| cursor + rel)
            {
                match marker_at(bytes, at) {
                    Some(end) => {
                        actual.push(end);
                        cursor = end;
                    }
                    None => cursor = at + 1,
                }
            }
            assert_eq!(actual, expected, "{case:?}");
        }
    }

    #[test]
    fn title_block_scanner_matches_its_regex() {
        let regex = Regex::new(r"\$\{(.+?)\}").unwrap();
        let mut cases: Vec<String> = [
            "",
            "$",
            "${}",
            "${A}",
            "${}}",
            "${A{B}}",
            "${A\nB}",
            "x${A}y${B}",
            "${\u{e9}}",
            "$${A}",
        ]
        .iter()
        .map(|text| (*text).to_owned())
        .collect();
        cases.extend(generated(&['$', '{', '}', 'A', '\n'], 4));
        for case in cases {
            for start in find_bytes(case.as_bytes(), b'$') {
                let scanner = tb_var_at(case.as_bytes(), start);
                let sliced = &case[start..];
                let found = regex
                    .captures(sliced)
                    .filter(|captures| captures.get(0).unwrap().start() == 0);
                match (scanner, found) {
                    (Some((content_start, content_end, end)), Some(captures)) => {
                        let whole = captures.get(0).unwrap();
                        let group = captures.get(1).unwrap();
                        assert_eq!(&case[content_start..content_end], group.as_str());
                        assert_eq!(end, start + whole.end(), "{case:?}");
                    }
                    (None, None) => {}
                    _ => panic!("scanner and regex disagree at {start} of {case:?}"),
                }
            }
        }
    }

    #[test]
    fn title_block_expansion_matches_a_regex_expander() {
        let variables = BTreeMap::from([
            ("A".to_owned(), "${B}".to_owned()),
            ("B".to_owned(), "value".to_owned()),
            ("EMPTY".to_owned(), String::new()),
        ]);
        let mut cases: Vec<String> = ["", "plain", "${A}", "${#}", "${}", "${A}}", "${B}${A}"]
            .iter()
            .map(|text| (*text).to_owned())
            .collect();
        cases.extend(generated(&['$', '{', '}', 'A', 'B'], 4));
        for case in cases {
            assert_eq!(
                tb_expand(&case, &variables),
                expand_with_regex(&case, &variables, 0),
                "{case:?}"
            );
        }
    }

    fn expand_with_regex(text: &str, variables: &BTreeMap<String, String>, depth: u8) -> String {
        let regex = Regex::new(r"\$\{(.+?)\}").unwrap();
        let mut out = String::new();
        let mut last = 0;
        for captures in regex.captures_iter(text) {
            let whole = captures.get(0).unwrap();
            out.push_str(&text[last..whole.start()]);
            last = whole.end();
            let name = captures.get(1).unwrap().as_str();
            match variables.get(name) {
                Some(value) if depth >= 10 => out.push_str(value),
                Some(value) => out.push_str(&expand_with_regex(value, variables, depth + 1)),
                None => out.push_str(whole.as_str()),
            }
        }
        out.push_str(&text[last..]);
        out
    }

    #[test]
    fn uuid_scanner_matches_its_regex() {
        let regex =
            Regex::new(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$").unwrap();
        let mut cases = vec![
            String::new(),
            "8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03".to_owned(),
            "8EA1ED23-3f8f-42ce-8c56-16f2acc6ed03".to_owned(),
            "8ea1ed23-3f8f-42ce-8c56-16f2acc6ed0".to_owned(),
            "8ea1ed233f8f42ce8c5616f2acc6ed03".to_owned(),
            "gea1ed23-3f8f-42ce-8c56-16f2acc6ed03".to_owned(),
        ];
        for index in 0..36 {
            let mut candidate: Vec<u8> = b"8ea1ed23-3f8f-42ce-8c56-16f2acc6ed03".to_vec();
            candidate[index] = if candidate[index] == b'0' { b'9' } else { b'0' };
            cases.push(String::from_utf8(candidate).unwrap());
        }
        for case in cases {
            assert_eq!(is_canonical_uuid(&case), regex.is_match(&case), "{case:?}");
        }
    }
}
