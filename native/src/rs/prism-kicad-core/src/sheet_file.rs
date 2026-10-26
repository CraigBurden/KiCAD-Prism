//! Where KiCad 10.0.6 finds a sheet's file (`SCH_IO_KICAD_SEXPR::loadHierarchy`),
//! as one rule for every reader of the hierarchy: the core, stage parse and the
//! projections.
//!
//! 1. The `Sheetfile` text has its text variables expanded (`ExpandTextVars`
//!    with the project): `${PROJECTNAME}` and the project's `text_variables`,
//!    again inside an expansion; an unknown variable stays as written. The date
//!    and VCS variables KiCad also knows depend on when and where it runs, so
//!    they are left as written.
//! 2. `\` becomes `/` (`SCH_SHEET::SetFileName`).
//! 3. A relative name is relative to the directory of the schematic that holds
//!    the sheet symbol (`m_currentPath`), and `.` and `..` are applied.
//! 4. The operating system opens it. Designs are authored on Windows and macOS,
//!    whose file systems ignore letter case, so a name that matches exactly one
//!    schematic only when case is ignored is that schematic ([`locate`]).
//!
//! An absolute name, or one that leaves the repository, is not a repository
//! file ([`Unresolved`]).

use std::collections::BTreeMap;

/// How deep a variable may expand inside another (`m_ResolveTextRecursionDepth`).
const MAX_DEPTH: usize = 10;

/// Why a sheet file is not a repository path.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unresolved {
    /// Absolute, or a drive letter.
    Absolute,
    /// `..` past the repository root.
    Outside,
    /// Empty.
    Empty,
}

/// The project values a sheet file's text variables expand to.
#[derive(Clone, Copy, Debug, Default)]
pub struct Variables<'a> {
    /// The project file's stem (`${PROJECTNAME}`).
    pub project_name: &'a str,
    /// The project's `text_variables`.
    pub text: Option<&'a BTreeMap<String, String>>,
}

impl Variables<'_> {
    fn value(&self, name: &str) -> Option<&str> {
        if name == "PROJECTNAME" && !self.project_name.is_empty() {
            return Some(self.project_name);
        }
        self.text?.get(name).map(String::as_str)
    }
}

/// A project file's `text_variables`: each string value by name. Empty when the
/// text is not a JSON object or has none.
#[must_use]
pub fn text_variables(project: &str) -> BTreeMap<String, String> {
    serde_json::from_str::<serde_json::Value>(project)
        .ok()
        .and_then(|document| {
            let entries = document.get("text_variables")?.as_object()?.clone();
            Some(
                entries
                    .into_iter()
                    .filter_map(|(name, value)| Some((name, value.as_str()?.to_owned())))
                    .collect(),
            )
        })
        .unwrap_or_default()
}

/// `${PROJECTNAME}`: the project file's name without `.kicad_pro`.
#[must_use]
pub fn project_name(project_file: &str) -> String {
    let name = project_file.rsplit('/').next().unwrap_or(project_file);
    name.strip_suffix(".kicad_pro").unwrap_or(name).to_owned()
}

/// `raw` with its project text variables expanded.
#[must_use]
pub fn expand(raw: &str, variables: Variables<'_>) -> String {
    expand_at(raw, variables, 0)
}

fn expand_at(raw: &str, variables: Variables<'_>, depth: usize) -> String {
    let mut out = String::with_capacity(raw.len());
    let mut rest = raw;
    while let Some(start) = rest.find("${") {
        out.push_str(&rest[..start]);
        let after = &rest[start + 2..];
        let Some(end) = after.find('}') else {
            out.push_str(&rest[start..]);
            return out;
        };
        let name = &after[..end];
        match variables.value(name) {
            Some(value) if depth < MAX_DEPTH => {
                out.push_str(&expand_at(value, variables, depth + 1))
            }
            _ => {
                out.push_str("${");
                out.push_str(name);
                out.push('}');
            }
        }
        rest = &after[end + 1..];
    }
    out.push_str(rest);
    out
}

/// The repository path the sheet file `raw` names, for a sheet symbol in the
/// schematic at repository path `parent`.
pub fn resolve(parent: &str, raw: &str, variables: Variables<'_>) -> Result<String, Unresolved> {
    let reference = expand(raw, variables).replace('\\', "/");
    if reference.is_empty() {
        return Err(Unresolved::Empty);
    }
    let first = reference.split('/').next().unwrap_or_default();
    if reference.starts_with('/') || first.contains(':') {
        return Err(Unresolved::Absolute);
    }
    let mut parts: Vec<&str> = parent.split('/').collect();
    parts.pop();
    for part in reference.split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop().ok_or(Unresolved::Outside)?;
            }
            other => parts.push(other),
        }
    }
    if parts.is_empty() {
        return Err(Unresolved::Empty);
    }
    Ok(parts.join("/"))
}

/// The file a resolved sheet path opens: `path` itself when `exists`, else the
/// one of `schematics` that differs from it only in letter case, with
/// `true` for a case match. `None` when neither (KiCad loads the sheet empty).
pub fn locate<I, S>(
    path: &str,
    exists: bool,
    schematics: impl FnOnce() -> I,
) -> Option<(String, bool)>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    if exists {
        return Some((path.to_owned(), false));
    }
    let folded = path.to_lowercase();
    let mut matches = schematics()
        .into_iter()
        .filter(|candidate| candidate.as_ref().to_lowercase() == folded);
    match (matches.next(), matches.next()) {
        (Some(only), None) => Some((only.as_ref().to_owned(), true)),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_as_kicad_loads_the_hierarchy() {
        let none = Variables::default();
        assert_eq!(
            resolve("root.kicad_sch", "a.kicad_sch", none),
            Ok("a.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "q.kicad_sch", none),
            Ok("b/q.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "../r.kicad_sch", none),
            Ok("r.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", ".\\d\\s.kicad_sch", none),
            Ok("b/d/s.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "../../x.kicad_sch", none),
            Err(Unresolved::Outside)
        );
        assert_eq!(
            resolve("p.kicad_sch", "/abs.kicad_sch", none),
            Err(Unresolved::Absolute)
        );
        assert_eq!(
            resolve("p.kicad_sch", "C:/x.kicad_sch", none),
            Err(Unresolved::Absolute)
        );
        assert_eq!(resolve("p.kicad_sch", "", none), Err(Unresolved::Empty));
    }

    #[test]
    fn text_variables_expand_and_unknown_ones_stay() {
        let text = BTreeMap::from([
            ("SHEETS".to_owned(), "sub/${PROJECTNAME}".to_owned()),
            ("LOOP".to_owned(), "${LOOP}".to_owned()),
        ]);
        let variables = Variables {
            project_name: "demo",
            text: Some(&text),
        };
        assert_eq!(
            resolve("p.kicad_sch", "${SHEETS}_power.kicad_sch", variables),
            Ok("sub/demo_power.kicad_sch".to_owned())
        );
        assert_eq!(
            expand("${UNKNOWN}/a.kicad_sch", variables),
            "${UNKNOWN}/a.kicad_sch"
        );
        assert_eq!(expand("${LOOP}", variables), "${LOOP}");
        assert_eq!(expand("${open", variables), "${open");
    }

    #[test]
    fn a_letter_case_difference_finds_the_one_schematic() {
        let files = ["Subsheets/HDRM.kicad_sch", "Subsheets/heaters.kicad_sch"];
        assert_eq!(
            locate("subsheets/HDRM.kicad_sch", false, || files),
            Some(("Subsheets/HDRM.kicad_sch".to_owned(), true))
        );
        assert_eq!(
            locate("a.kicad_sch", true, || files),
            Some(("a.kicad_sch".to_owned(), false))
        );
        assert_eq!(locate("missing.kicad_sch", false, || files), None);
        let twins = ["A.kicad_sch", "a.kicad_sch"];
        assert_eq!(locate("A.Kicad_sch", false, || twins), None);
    }
}
