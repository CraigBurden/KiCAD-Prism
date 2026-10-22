//! The command line of cli-spec.md §2: command words, options anywhere after
//! them (`--name value`, never `--name=value`), no option twice except
//! `--limit` with different names, value syntax and combinations checked
//! before any work (exit 2).

use prism_bundle::{Failure, LimitName, Limits, Outcome, Work};
use std::collections::BTreeMap;

mod build_rules;
mod help;
mod model_dirs;
use build_rules::build_rules;
use model_dirs::model_directories;

/// The command.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Command {
    /// `version` / `--version`.
    Version,
    /// `-h` / `--help`.
    Help,
    /// `bundle build`.
    Build,
    /// `bundle verify`.
    Verify,
    /// `bundle extract`.
    Extract,
    /// `bundle reuse`.
    Reuse,
    /// `revision-key`.
    RevisionKey,
    /// `compare`.
    Compare,
    /// `vendor list`.
    VendorList,
    /// `vendor run`.
    VendorRun,
    /// `stroke-text`.
    StrokeText,
    /// `drawing-sheet`.
    DrawingSheet,
    /// `artwork`.
    Artwork,
}

/// A `bundle build` stage.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StageArg {
    /// `parse`.
    Parse,
    /// `board`.
    Board,
    /// `models`.
    Models,
}

/// Parsed arguments.
#[derive(Clone, Debug)]
pub struct Args {
    /// The command.
    pub command: Command,
    /// Positional arguments, in order.
    pub positional: Vec<String>,
    /// Options with a value, by long name.
    pub options: BTreeMap<&'static str, String>,
    /// `--upgraded`, by repository path.
    pub upgraded: BTreeMap<String, u64>,
    /// `compare --base-upgraded`, by repository path.
    pub base_upgraded: BTreeMap<String, u64>,
    /// `compare --head-upgraded`, by repository path.
    pub head_upgraded: BTreeMap<String, u64>,
    /// `compare --include-unchanged`.
    pub include_unchanged: bool,
    /// `bundle build --stage models --model-dir`, by variable.
    pub model_dirs: BTreeMap<String, String>,
    /// `--worktree`.
    pub worktree: bool,
    /// `--quiet`.
    pub quiet: bool,
    /// `stroke-text --metrics`.
    pub metrics: bool,
    /// `artwork --view`, in code point order.
    pub views: Vec<String>,
    /// `artwork --paper-scale`: sheet millimetres per board millimetre.
    pub paper_scale: Option<f64>,
    /// `--threads`, validated.
    pub threads: u64,
    /// The stage of `bundle build`.
    pub stage: Option<StageArg>,
    /// The limits after `--limit` overrides.
    pub limits: Limits,
}

impl Args {
    /// The value of option `name`.
    #[must_use]
    pub fn option(&self, name: &str) -> Option<&str> {
        self.options.get(name).map(String::as_str)
    }
}

fn work_of(command: Command, stage: Option<StageArg>) -> Work {
    match (command, stage) {
        (Command::Build, Some(StageArg::Board)) => Work::Board,
        (Command::Build, Some(StageArg::Models)) => Work::Models,
        (Command::Build, _) => Work::Parse,
        (Command::Verify, _) => Work::Verify,
        (Command::Extract, _) => Work::Extract,
        // Like `verify`, it reads one bundle's manifest.
        (Command::Reuse, _) => Work::Verify,
        (Command::RevisionKey, _) => Work::RevisionKey,
        (Command::Compare, _) => Work::Compare,
        _ => Work::Other,
    }
}

const VALUE_OPTIONS: [&str; 36] = [
    "output",
    "in",
    "stage",
    "source-root",
    "revision-key",
    "key-record",
    "config",
    "refilled-board",
    "refill-tool",
    "models-glb",
    "models-tool",
    "geometer",
    "model-dir",
    "hlr-cache",
    "commit",
    "project",
    "base",
    "head",
    "base-src",
    "head-src",
    "base-source-root",
    "head-source-root",
    "base-config",
    "head-config",
    "base-revision-key",
    "head-revision-key",
    "base-upgraded",
    "head-upgraded",
    "limit",
    "threads",
    "upgraded",
    "models",
    "variant",
    "request",
    "view",
    "paper-scale",
];

fn allowed(command: Command, option: &str) -> bool {
    let common = matches!(option, "limit" | "threads" | "quiet");
    common || specific(command).contains(&option)
}

/// The options a command takes beyond `COMMON`.
fn specific(command: Command) -> &'static [&'static str] {
    match command {
        Command::Build => &[
            "output",
            "in",
            "stage",
            "source-root",
            "revision-key",
            "key-record",
            "upgraded",
            "config",
            "refilled-board",
            "refill-tool",
            "models-glb",
            "models-tool",
            "geometer",
            "model-dir",
            "hlr-cache",
        ],
        Command::Extract => &["output"],
        Command::Reuse => &["in", "key-record"],
        Command::Compare => &[
            "base",
            "head",
            "output",
            "base-src",
            "head-src",
            "base-source-root",
            "head-source-root",
            "base-config",
            "head-config",
            "base-revision-key",
            "head-revision-key",
            "base-upgraded",
            "head-upgraded",
            "include-unchanged",
        ],
        Command::RevisionKey => &["commit", "worktree", "project", "config"],
        _ => sheet_options(command),
    }
}

/// The options of the remaining leaf commands.
fn sheet_options(command: Command) -> &'static [&'static str] {
    match command {
        Command::VendorList | Command::VendorRun => &["in", "config", "output", "variant"],
        Command::Artwork => &["in", "config", "view", "output", "variant", "paper-scale"],
        Command::StrokeText => &["request", "metrics"],
        Command::DrawingSheet => &["request"],
        _ => &[],
    }
}

fn usage(message: impl Into<String>) -> Failure {
    Failure::usage("usage", message)
}

fn conflict(message: impl Into<String>, argument: &'static str) -> Failure {
    Failure::usage("option-conflict", message).argument(argument)
}

const ONE_WORD: [(&str, Command); 9] = [
    ("version", Command::Version),
    ("--version", Command::Version),
    ("-h", Command::Help),
    ("--help", Command::Help),
    ("revision-key", Command::RevisionKey),
    ("compare", Command::Compare),
    ("stroke-text", Command::StrokeText),
    ("drawing-sheet", Command::DrawingSheet),
    ("artwork", Command::Artwork),
];

fn command_words(argv: &[String]) -> Outcome<(Command, usize)> {
    let Some(word) = argv.first().map(String::as_str) else {
        return Ok((Command::Help, 1));
    };
    if let Some((_, command)) = ONE_WORD.iter().find(|(name, _)| *name == word) {
        return Ok((*command, 1));
    }
    match word {
        "vendor" => vendor_command(argv.get(1).map(String::as_str)),
        "bundle" => bundle_command(argv.get(1).map(String::as_str)),
        _ => Err(Failure::usage(
            "unknown-command",
            "the command is not version, bundle build, bundle verify, bundle extract, bundle reuse, revision-key, compare, vendor list, vendor run, stroke-text, drawing-sheet or artwork",
        )
        .argument("command")),
    }
}

fn vendor_command(word: Option<&str>) -> Outcome<(Command, usize)> {
    match word {
        Some("list") => Ok((Command::VendorList, 2)),
        Some("run") => Ok((Command::VendorRun, 2)),
        _ => Err(Failure::usage("unknown-command", "vendor takes list or run").argument("command")),
    }
}

fn bundle_command(word: Option<&str>) -> Outcome<(Command, usize)> {
    match word {
        Some("build") => Ok((Command::Build, 2)),
        Some("verify") => Ok((Command::Verify, 2)),
        Some("extract") => Ok((Command::Extract, 2)),
        Some("reuse") => Ok((Command::Reuse, 2)),
        _ => Err(Failure::usage(
            "unknown-command",
            "bundle takes build, verify, extract or reuse",
        )
        .argument("command")),
    }
}

fn long_name(token: &str) -> Option<&str> {
    if token == "-o" {
        return Some("output");
    }
    token.strip_prefix("--")
}

/// Static name of an option, so errors can name it as a `CliArgument`.
fn static_name(name: &str) -> Option<&'static str> {
    VALUE_OPTIONS
        .into_iter()
        .chain(["worktree", "quiet", "include-unchanged", "metrics", "help"])
        .find(|candidate| *candidate == name)
}

struct Raw {
    positional: Vec<String>,
    options: BTreeMap<&'static str, String>,
    limits: Vec<String>,
    upgraded: Vec<String>,
    base_upgraded: Vec<String>,
    head_upgraded: Vec<String>,
    model_dirs: Vec<String>,
    views: Vec<String>,
    include_unchanged: bool,
    worktree: bool,
    quiet: bool,
    metrics: bool,
    help: bool,
}

fn collect(command: Command, rest: &[String]) -> Outcome<Raw> {
    let mut raw = Raw {
        positional: Vec::new(),
        options: BTreeMap::new(),
        limits: Vec::new(),
        upgraded: Vec::new(),
        base_upgraded: Vec::new(),
        head_upgraded: Vec::new(),
        model_dirs: Vec::new(),
        views: Vec::new(),
        include_unchanged: false,
        worktree: false,
        quiet: false,
        metrics: false,
        help: false,
    };
    let mut index = 0;
    while index < rest.len() {
        index = raw.take(command, rest, index)?;
    }
    Ok(raw)
}

impl Raw {
    /// Take the argument at `index`; return the index of the next one.
    fn take(&mut self, command: Command, rest: &[String], index: usize) -> Outcome<usize> {
        let token = &rest[index];
        let option = token.starts_with('-') && token.len() > 1;
        let Some(name) = long_name(token).filter(|_| option) else {
            self.positional.push(token.clone());
            return Ok(index + 1);
        };
        if token == "-h" || name == "help" {
            self.help = true;
            return Ok(index + 1);
        }
        let name = static_name(name)
            .filter(|name| allowed(command, name))
            .ok_or_else(|| usage(format!("unknown option {token:?}")))?;
        match name {
            "worktree" | "quiet" | "include-unchanged" | "metrics" => {
                self.flag(name).map(|()| index + 1)
            }
            _ => {
                let value = rest.get(index + 1).ok_or_else(|| {
                    let failure = usage(format!("--{name} takes a value"));
                    match name {
                        // `CliArgument` has no `models` value: the message names the option.
                        "models" => failure,
                        _ => failure.argument(name),
                    }
                })?;
                self.value(name, value.clone()).map(|()| index + 2)
            }
        }
    }

    fn flag(&mut self, name: &'static str) -> Outcome<()> {
        let slot = match name {
            "worktree" => &mut self.worktree,
            "include-unchanged" => &mut self.include_unchanged,
            "metrics" => &mut self.metrics,
            _ => &mut self.quiet,
        };
        if *slot {
            return Err(usage(format!("--{name} is given twice")).argument(name));
        }
        *slot = true;
        Ok(())
    }

    fn value(&mut self, name: &'static str, value: String) -> Outcome<()> {
        if self.push_repeated(name, value.clone()) {
            Ok(())
        } else {
            self.single(name, value)
        }
    }

    /// Store a repeatable option; false for a single-valued one.
    fn push_repeated(&mut self, name: &'static str, value: String) -> bool {
        let slot = if let Some(slot) = self.repeated_comparison(name) {
            slot
        } else if let Some(slot) = self.repeated_views(name) {
            slot
        } else {
            return false;
        };
        slot.push(value);
        true
    }

    /// The repeatable options of `compare` and `bundle build`.
    fn repeated_comparison(&mut self, name: &'static str) -> Option<&mut Vec<String>> {
        match name {
            "limit" => Some(&mut self.limits),
            "upgraded" => Some(&mut self.upgraded),
            "base-upgraded" => Some(&mut self.base_upgraded),
            "head-upgraded" => Some(&mut self.head_upgraded),
            "model-dir" => Some(&mut self.model_dirs),
            _ => None,
        }
    }

    /// The repeatable options of `artwork`.
    fn repeated_views(&mut self, name: &'static str) -> Option<&mut Vec<String>> {
        match name {
            "view" => Some(&mut self.views),
            _ => None,
        }
    }

    /// Store a single-valued option, refusing a second one.
    fn single(&mut self, name: &'static str, value: String) -> Outcome<()> {
        if self.options.insert(name, value).is_some() {
            let failure = usage(format!("--{name} is given twice"));
            return Err(match name {
                "models" => failure,
                _ => failure.argument(name),
            });
        }
        Ok(())
    }
}

fn is_hex64(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte))
}

fn is_release_version(value: &str) -> bool {
    let parts: Vec<&str> = value.split('.').collect();
    parts.len() == 3
        && parts.iter().all(|part| {
            !part.is_empty()
                && part.bytes().all(|byte| byte.is_ascii_digit())
                && (part.len() == 1 || !part.starts_with('0'))
        })
}

fn check_tools(raw: &Raw) -> Outcome<()> {
    for tool in ["refill-tool", "models-tool"] {
        let bad = raw
            .options
            .get(tool)
            .is_some_and(|version| !is_release_version(version));
        if bad {
            let argument = if tool == "refill-tool" {
                "refill-tool"
            } else {
                "models-tool"
            };
            return Err(
                usage(format!("--{tool} takes a release version such as 10.0.6"))
                    .argument(argument),
            );
        }
    }
    Ok(())
}

fn stage_of(raw: &Raw) -> Outcome<Option<StageArg>> {
    match raw.options.get("stage").map(String::as_str) {
        None => Ok(None),
        Some("parse") => Ok(Some(StageArg::Parse)),
        Some("board") => Ok(Some(StageArg::Board)),
        Some("models") => Ok(Some(StageArg::Models)),
        Some(_) => Err(usage("--stage takes parse, board or models").argument("stage")),
    }
}

/// `artwork --paper-scale`: a positive, finite ratio of sheet millimetres to
/// board millimetres (cli-spec.md §5.7).
fn paper_scale_of(raw: &Raw) -> Outcome<Option<f64>> {
    let Some(value) = raw.options.get("paper-scale") else {
        return Ok(None);
    };
    value
        .parse::<f64>()
        .ok()
        .filter(|ratio| ratio.is_finite() && *ratio > 0.0)
        .map(Some)
        .ok_or_else(|| usage("--paper-scale takes a positive number").argument("paper-scale"))
}

fn threads_of(raw: &Raw) -> Outcome<u64> {
    let Some(value) = raw.options.get("threads") else {
        return Ok(4);
    };
    value
        .parse::<u64>()
        .ok()
        .filter(|threads| (1..=64).contains(threads) && !value.starts_with('+'))
        .ok_or_else(|| usage("--threads takes 1 to 64").argument("threads"))
}

fn check_values(raw: &Raw) -> Outcome<(Option<StageArg>, u64)> {
    let bad_key = raw
        .options
        .get("revision-key")
        .is_some_and(|key| !is_hex64(key));
    if bad_key {
        return Err(usage("--revision-key takes 64 lowercase hex digits").argument("revision-key"));
    }
    check_tools(raw)?;
    Ok((stage_of(raw)?, threads_of(raw)?))
}

fn check_build(raw: &Raw, stage: Option<StageArg>) -> Outcome<()> {
    let has = |name: &str| raw.options.contains_key(name);
    let stage = stage.ok_or_else(|| usage("bundle build takes --stage").argument("stage"))?;
    if !has("output") {
        return Err(usage("bundle build takes -o").argument("output"));
    }
    let parse = stage == StageArg::Parse;
    match (parse, raw.positional.len()) {
        (true, 1) | (false, 0) => {}
        (true, _) => {
            return Err(
                usage("--stage parse takes one <project.kicad_pro>").argument("project-file")
            );
        }
        (false, _) => {
            return Err(conflict(
                "only --stage parse takes a project file",
                "project-file",
            ));
        }
    }
    let rules = build_rules(raw, stage);
    match rules.iter().find(|(broken, _, _)| *broken) {
        Some((_, message, argument)) => Err(conflict(*message, argument)),
        None => Ok(()),
    }
}

/// The options of `bundle reuse` (cli-spec.md §5.10): `--in` and
/// `--key-record`, no positional argument.
fn check_reuse(raw: &Raw) -> Outcome<()> {
    for option in ["in", "key-record"] {
        if !raw.options.contains_key(option) {
            return Err(usage(format!("bundle reuse takes --{option}")).argument(option));
        }
    }
    if raw.positional.is_empty() {
        Ok(())
    } else {
        Err(usage("bundle reuse takes no positional argument").argument("command"))
    }
}

/// The options of `compare` (cli-spec.md §5.6, amendment C2r §3): each side
/// is a bundle (`--base`, `--head`) or a source tree (`--base-src`,
/// `--head-src`), with its revision key in both modes; a source tree's other
/// inputs only with it; `-o`; no positional argument.
fn check_compare(raw: &Raw) -> Outcome<()> {
    for side in ["base", "head"] {
        check_compare_side(raw, side)?;
    }
    if !raw.options.contains_key("output") {
        return Err(usage("compare takes -o <result.json>").argument("output"));
    }
    if !raw.positional.is_empty() {
        return Err(usage("compare takes no positional argument").argument("command"));
    }
    Ok(())
}

/// One side of `compare`: a bundle or a source tree, the source tree's
/// inputs only with it, and its revision key, which a bundle may serve among
/// others (ADR amendment K2 §3.6).
fn check_compare_side(raw: &Raw, side: &str) -> Outcome<()> {
    let has = |suffix: &str| raw.options.contains_key(format!("{side}{suffix}").as_str());
    let refuse = |message: String, option: &str| {
        Err(usage(message).argument(static_name(option).unwrap_or("base")))
    };
    let source = has("-src");
    if has("") == source {
        return refuse(
            format!("compare takes exactly one of --{side} and --{side}-src"),
            side,
        );
    }
    let upgraded = if side == "base" {
        &raw.base_upgraded
    } else {
        &raw.head_upgraded
    };
    let source_only = [
        (has("-source-root"), "-source-root"),
        (has("-config"), "-config"),
        (!upgraded.is_empty(), "-upgraded"),
    ];
    if let Some((_, option)) = source_only.iter().find(|(given, _)| *given && !source) {
        let name = format!("{side}{option}");
        return refuse(format!("--{name} is only for --{side}-src"), &name);
    }
    let key = format!("{side}-revision-key");
    match raw.options.get(key.as_str()) {
        None => refuse(format!("compare takes --{key}"), &key),
        Some(value) if !is_hex64(value) => {
            refuse(format!("--{key} takes 64 lowercase hex digits"), &key)
        }
        _ => Ok(()),
    }
}

fn check_verify(raw: &Raw) -> Outcome<()> {
    if raw.positional.len() == 1 {
        Ok(())
    } else {
        Err(usage("bundle verify takes one <bundle.prism>").argument("bundle"))
    }
}

fn check_extract(raw: &Raw) -> Outcome<()> {
    if raw.positional.len() < 2 {
        return Err(
            usage("bundle extract takes <bundle.prism> and at least one <member>")
                .argument("member"),
        );
    }
    if raw.options.contains_key("output") {
        Ok(())
    } else {
        Err(usage("bundle extract takes -o <dir>").argument("output"))
    }
}

fn check_version(raw: &Raw) -> Outcome<()> {
    if raw.positional.is_empty() {
        Ok(())
    } else {
        Err(usage("version takes no argument").argument("command"))
    }
}

/// The options of `vendor list` and `vendor run` (cli-spec.md §5.8): `list`
/// takes none of the run options, `run` takes one `<vendor-id>`, `--in`,
/// `--config`, `-o` and an optional `--variant`.
fn check_vendor(raw: &Raw, command: Command) -> Outcome<()> {
    if command == Command::VendorList {
        let run_option = ["in", "config", "output", "variant"]
            .iter()
            .any(|option| raw.options.contains_key(option));
        if raw.positional.is_empty() && !run_option {
            return Ok(());
        }
        return Err(usage("vendor list takes no argument or option").argument("command"));
    }
    if raw.positional.len() != 1 {
        return Err(usage("vendor run takes one <vendor-id>").argument("command"));
    }
    for option in ["in", "config", "output"] {
        if !raw.options.contains_key(option) {
            return Err(usage(format!("vendor run takes --{option}")).argument(option));
        }
    }
    Ok(())
}

/// The options of `artwork` (cli-spec.md §5.7): `--in`, `--config`, at least
/// one `--view`, `-o` and an optional `--variant`, and no positional argument.
fn check_artwork(raw: &Raw) -> Outcome<()> {
    if !raw.positional.is_empty() {
        return Err(usage("artwork takes no positional argument").argument("command"));
    }
    for option in ["in", "config", "output"] {
        if !raw.options.contains_key(option) {
            return Err(usage(format!("artwork takes --{option}")).argument(option));
        }
    }
    if raw.views.is_empty() {
        return Err(usage("artwork takes at least one --view").argument("view"));
    }
    Ok(())
}

/// The options of `revision-key` (cli-spec.md §5.5): one `<repo>`, exactly
/// one of `--commit` and `--worktree`, and `--project`.
fn check_revision_key(raw: &Raw) -> Outcome<()> {
    if raw.positional.len() != 1 {
        return Err(usage("revision-key takes one <repo>").argument("repo"));
    }
    if raw.options.contains_key("commit") == raw.worktree {
        return Err(conflict(
            "revision-key takes exactly one of --commit and --worktree",
            "commit",
        ));
    }
    if raw.options.contains_key("project") {
        Ok(())
    } else {
        Err(usage("revision-key takes --project").argument("project"))
    }
}

fn check_combinations(command: Command, raw: &Raw, stage: Option<StageArg>) -> Outcome<()> {
    match command {
        Command::Build => check_build(raw, stage),
        Command::Verify => check_verify(raw),
        Command::Extract => check_extract(raw),
        Command::RevisionKey => check_revision_key(raw),
        Command::Reuse => check_reuse(raw),
        Command::Compare => check_compare(raw),
        Command::VendorList | Command::VendorRun => check_vendor(raw, command),
        Command::StrokeText | Command::DrawingSheet | Command::Artwork | Command::Version => {
            check_leaf_command(command, raw)
        }
        _ => Ok(()),
    }
}

/// The commands whose only argument rules are their own: `stroke-text`,
/// `drawing-sheet` and `version`.
fn check_leaf_command(command: Command, raw: &Raw) -> Outcome<()> {
    match command {
        Command::StrokeText => check_stroke_text(raw),
        Command::DrawingSheet => check_drawing_sheet(raw),
        Command::Artwork => check_artwork(raw),
        Command::Version => check_version(raw),
        _ => Ok(()),
    }
}

/// `stroke-text` takes exactly one of `--request` and `--metrics`
/// (cli-spec.md §5.9) and no positional argument.
fn check_stroke_text(raw: &Raw) -> Outcome<()> {
    if !raw.positional.is_empty() {
        return Err(usage("stroke-text takes no positional argument").argument("command"));
    }
    match (raw.options.contains_key("request"), raw.metrics) {
        (true, false) | (false, true) => Ok(()),
        (true, true) => Err(conflict(
            "stroke-text takes exactly one of --request and --metrics",
            "metrics",
        )),
        (false, false) => {
            Err(usage("stroke-text takes --request or --metrics").argument("request"))
        }
    }
}

/// `drawing-sheet` takes `--request` and no positional argument (cli-spec.md
/// §5.9).
fn check_drawing_sheet(raw: &Raw) -> Outcome<()> {
    if !raw.positional.is_empty() {
        return Err(usage("drawing-sheet takes no positional argument").argument("command"));
    }
    if raw.options.contains_key("request") {
        Ok(())
    } else {
        Err(usage("drawing-sheet takes --request").argument("request"))
    }
}

/// Parse `argv` (without the program name).
pub fn parse(argv: &[String]) -> Outcome<Args> {
    let (command, consumed) = command_words(argv)?;
    let raw = collect(command, &argv[consumed..])?;
    if raw.help {
        return Ok(help_args());
    }
    if argv
        .iter()
        .any(|argument| argument.starts_with("--") && argument.contains('='))
    {
        return Err(usage(
            "options take their value as the next argument, not --name=value",
        ));
    }
    let (stage, threads) = check_values(&raw)?;
    let paper_scale = paper_scale_of(&raw)?;
    check_combinations(command, &raw, stage)?;
    // A source-tree side of `compare` runs the parse stage, so the command
    // takes the parse stage's limits (cli-spec.md §5.6).
    let source_tree = raw.options.contains_key("base-src") || raw.options.contains_key("head-src");
    let work = match work_of(command, stage) {
        Work::Compare if source_tree => Work::Parse,
        work => work,
    };
    let mut limits = Limits::defaults(work);
    let mut seen: Vec<LimitName> = Vec::new();
    for argument in &raw.limits {
        let name = limits.apply(argument)?;
        if seen.contains(&name) {
            return Err(
                usage(format!("--limit {} is given twice", name.as_str())).argument("limit")
            );
        }
        seen.push(name);
    }
    let upgraded = upgrades(&raw.upgraded, "upgraded")?;
    let base_upgraded = upgrades(&raw.base_upgraded, "base-upgraded")?;
    let head_upgraded = upgrades(&raw.head_upgraded, "head-upgraded")?;
    let model_dirs = model_directories(&raw.model_dirs)?;
    Ok(Args {
        command,
        positional: raw.positional,
        options: raw.options,
        upgraded,
        base_upgraded,
        head_upgraded,
        model_dirs,
        include_unchanged: raw.include_unchanged,
        worktree: raw.worktree,
        quiet: raw.quiet,
        metrics: raw.metrics,
        views: raw.views,
        paper_scale,
        threads,
        stage,
        limits,
    })
}

/// Parse every `--upgraded <path>=<version>` (cli-spec.md §2.2): a `RepoPath`
/// ending in `.kicad_pcb` or `.kicad_sch`, a decimal version, distinct paths.
fn upgrades(values: &[String], option: &'static str) -> Outcome<BTreeMap<String, u64>> {
    let mut upgraded = BTreeMap::new();
    for value in values {
        let bad = || {
            usage(format!("--{option} takes <path>=<version>: a repository path ending in .kicad_pcb or .kicad_sch and a decimal version"))
                .argument(option)
        };
        let (path, version) = value.rsplit_once('=').ok_or_else(bad)?;
        let lowered = path.to_ascii_lowercase();
        let kind_ok = lowered.ends_with(".kicad_pcb") || lowered.ends_with(".kicad_sch");
        let digits = !version.is_empty() && version.bytes().all(|byte| byte.is_ascii_digit());
        let version: u64 = digits
            .then(|| version.parse().ok())
            .flatten()
            .ok_or_else(bad)?;
        if !kind_ok || !prism_bundle::paths::has_path_form(path) {
            return Err(bad());
        }
        if upgraded.insert(path.to_owned(), version).is_some() {
            return Err(usage(format!("--{option} names {path:?} twice")).argument(option));
        }
    }
    Ok(upgraded)
}

fn help_args() -> Args {
    Args {
        command: Command::Help,
        positional: Vec::new(),
        options: BTreeMap::new(),
        upgraded: BTreeMap::new(),
        base_upgraded: BTreeMap::new(),
        head_upgraded: BTreeMap::new(),
        model_dirs: BTreeMap::new(),
        include_unchanged: false,
        worktree: false,
        quiet: false,
        metrics: false,
        views: Vec::new(),
        paper_scale: None,
        threads: 4,
        stage: None,
        limits: Limits::defaults(Work::Other),
    }
}

pub use help::HELP;

#[cfg(test)]
mod tests;
