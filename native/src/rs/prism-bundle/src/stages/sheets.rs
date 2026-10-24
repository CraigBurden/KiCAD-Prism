//! Resolving a `Sheetfile` reference to a repository path.
//!
//! A sheet file is relative to the directory of the schematic that holds the
//! sheet symbol, as the core resolves it (`source_bundle.rs`,
//! `resolve_relative_path`) and as a1 did (sim: `src/prism-bundle/src/sheets.rs`).
//! A reference that leaves the source root, or is absolute, is
//! `source-outside-root` (cli-spec.md §5.2.2).

/// Why a reference does not resolve inside the source root.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Unresolved {
    /// Absolute, or a drive letter.
    Absolute,
    /// `..` past the root.
    Outside,
    /// Empty.
    Empty,
}

/// Resolve `reference` against the directory of `parent` (both
/// repository-relative, `/`-separated); `\` counts as `/`.
pub fn resolve(parent: &str, reference: &str) -> Result<String, Unresolved> {
    let reference = reference.replace('\\', "/");
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_relative_to_the_parent_sheet() {
        assert_eq!(
            resolve("root.kicad_sch", "a.kicad_sch"),
            Ok("a.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "q.kicad_sch"),
            Ok("b/q.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "../r.kicad_sch"),
            Ok("r.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", ".\\d\\s.kicad_sch"),
            Ok("b/d/s.kicad_sch".to_owned())
        );
        assert_eq!(
            resolve("b/p.kicad_sch", "../../x.kicad_sch"),
            Err(Unresolved::Outside)
        );
        assert_eq!(
            resolve("p.kicad_sch", "/abs.kicad_sch"),
            Err(Unresolved::Absolute)
        );
        assert_eq!(
            resolve("p.kicad_sch", "C:/x.kicad_sch"),
            Err(Unresolved::Absolute)
        );
        assert_eq!(resolve("p.kicad_sch", ""), Err(Unresolved::Empty));
    }
}
