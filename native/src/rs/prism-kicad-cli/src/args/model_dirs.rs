//! `--model-dir VAR=dir` (cli-spec.md §5.2.4).

use super::{Outcome, conflict, usage};
use std::collections::BTreeMap;

/// Parse every `--model-dir <VAR>=<dir>`: a non-empty variable and a
/// directory, distinct variables.
pub(super) fn model_directories(values: &[String]) -> Outcome<BTreeMap<String, String>> {
    let mut directories = BTreeMap::new();
    for value in values {
        let bad = || {
            usage("--model-dir takes <VAR>=<dir>, for example KICAD10_3DMODEL_DIR=/models")
                .argument("model-dir")
        };
        let (name, directory) = value.split_once('=').ok_or_else(bad)?;
        if name.is_empty()
            || directory.is_empty()
            || !name
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            return Err(bad());
        }
        if directories
            .insert(name.to_owned(), directory.to_owned())
            .is_some()
        {
            return Err(conflict(
                format!("--model-dir names {name} twice"),
                "model-dir",
            ));
        }
    }
    Ok(directories)
}
