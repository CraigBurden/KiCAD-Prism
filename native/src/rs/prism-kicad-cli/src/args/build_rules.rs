//! The option combinations of `bundle build` (cli-spec.md §2.2).

use super::{Raw, StageArg};

/// The option combinations of `bundle build` (cli-spec.md §2.2): (broken,
/// message, argument), in the order checked.
pub(super) fn build_rules(raw: &Raw, stage: StageArg) -> Vec<(bool, &'static str, &'static str)> {
    let mut rules = parse_rules(raw, stage);
    rules.extend(stage_rules(raw, stage));
    rules
}

/// The options only stage `parse` takes, and the one that needs another.
fn parse_rules(raw: &Raw, stage: StageArg) -> Vec<(bool, &'static str, &'static str)> {
    let has = |name: &str| raw.options.contains_key(name);
    let parse = stage == StageArg::Parse;
    [
        (
            has("source-root") && !parse,
            "--source-root is only for --stage parse",
            "source-root",
        ),
        (
            has("key-record") && !parse,
            "--key-record is only for --stage parse",
            "key-record",
        ),
        (
            !raw.upgraded.is_empty() && !parse,
            "--upgraded is only for --stage parse",
            "upgraded",
        ),
        (
            has("key-record") && !has("revision-key"),
            "--key-record requires --revision-key",
            "key-record",
        ),
    ]
    .into()
}

/// The per-stage inputs and the assembly HLR options.
fn stage_rules(raw: &Raw, stage: StageArg) -> Vec<(bool, &'static str, &'static str)> {
    let has = |name: &str| raw.options.contains_key(name);
    let parse = stage == StageArg::Parse;
    let models = stage == StageArg::Models;
    let board_only = has("refilled-board") && stage != StageArg::Board;
    let hardware = models && has("geometer");
    [
        (
            parse == has("in"),
            "--in is required with board and models and refused with parse",
            "in",
        ),
        (
            has("refilled-board") != has("refill-tool") || board_only,
            "--refilled-board and --refill-tool go together, with --stage board only",
            "refilled-board",
        ),
        (
            has("models-glb") != models || has("models-tool") != models,
            "--models-glb and --models-tool go together and only with --stage models",
            "models-glb",
        ),
        (
            has("geometer") && !models,
            "--geometer is only for --stage models",
            "geometer",
        ),
        (
            !raw.model_dirs.is_empty() && !models,
            "--model-dir is only for --stage models",
            "model-dir",
        ),
        (
            has("hlr-cache") && !hardware,
            "--hlr-cache needs --geometer, with --stage models",
            "hlr-cache",
        ),
    ]
    .into()
}
