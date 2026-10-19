//! The command line of cli-spec.md §2: command words, options anywhere after
//! them (`--name value`, never `--name=value`), no option twice except
//! `--limit` with different names, value syntax and combinations checked
//! before any work (exit 2).

use prism_bundle::{Failure, LimitName, Limits, Outcome, Work};
use std::collections::{BTreeMap, BTreeSet};

mod system;
use system::{check_system, system_of};

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
    /// `system build`.
    SystemBuild,
}

/// A `system build` member: its stored design bundle and the revision key it
/// is read at.
#[derive(Clone, Debug)]
pub struct SystemMemberArg {
    /// The `.prism` path.
    pub bundle: String,
    /// Its identity, 64 lowercase hex digits.
    pub revision_key: String,
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
    /// `system build --member`, by occurrence.
    pub system_members: BTreeMap<String, SystemMemberArg>,
    /// `system build --absent`, in code point order.
    pub system_absent: BTreeSet<String>,
    /// `--worktree`.
    pub worktree: bool,
    /// `--quiet`.
    pub quiet: bool,
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

const VALUE_OPTIONS: [&str; 32] = [
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
    "document",
    "member",
    "member-revision-key",
    "absent",
];

fn allowed(command: Command, option: &str) -> bool {
    let common = matches!(option, "limit" | "threads" | "quiet");
    let specific: &[&str] = match command {
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
        Command::SystemBuild => &[
            "document",
            "member",
            "member-revision-key",
            "absent",
            "output",
        ],
        _ => &[],
    };
    common || specific.contains(&option)
}

fn usage(message: impl Into<String>) -> Failure {
    Failure::usage("usage", message)
}

fn conflict(message: impl Into<String>, argument: &'static str) -> Failure {
    Failure::usage("option-conflict", message).argument(argument)
}

fn command_words(argv: &[String]) -> Outcome<(Command, usize)> {
    match argv.first().map(String::as_str) {
        Some("version" | "--version") => Ok((Command::Version, 1)),
        Some("-h" | "--help") | None => Ok((Command::Help, 1)),
        Some("revision-key") => Ok((Command::RevisionKey, 1)),
        Some("compare") => Ok((Command::Compare, 1)),
        Some("system") => system_command(argv.get(1).map(String::as_str)),
        Some("bundle") => bundle_command(argv.get(1).map(String::as_str)),
        Some(_) => Err(Failure::usage(
            "unknown-command",
            "the command is not version, bundle build, bundle verify, bundle extract, bundle reuse, revision-key, compare or system build",
        )
        .argument("command")),
    }
}

fn system_command(word: Option<&str>) -> Outcome<(Command, usize)> {
    match word {
        Some("build") => Ok((Command::SystemBuild, 2)),
        _ => Err(Failure::usage("unknown-command", "system takes build").argument("command")),
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
        .chain(["worktree", "quiet", "include-unchanged", "help"])
        .find(|candidate| *candidate == name)
}

struct Raw {
    positional: Vec<String>,
    options: BTreeMap<&'static str, String>,
    limits: Vec<String>,
    upgraded: Vec<String>,
    base_upgraded: Vec<String>,
    head_upgraded: Vec<String>,
    members: Vec<String>,
    member_revision_keys: Vec<String>,
    absent: Vec<String>,
    include_unchanged: bool,
    worktree: bool,
    quiet: bool,
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
        members: Vec::new(),
        member_revision_keys: Vec::new(),
        absent: Vec::new(),
        include_unchanged: false,
        worktree: false,
        quiet: false,
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
            "worktree" | "quiet" | "include-unchanged" => self.flag(name).map(|()| index + 1),
            _ => {
                let value = rest.get(index + 1).ok_or_else(|| {
                    let failure = usage(format!("--{name} takes a value"));
                    match name {
                        // `CliArgument` has no `document` or `absent` value.
                        "document" | "absent" => failure,
                        "member-revision-key" => failure.argument("revision-key"),
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
            _ => &mut self.quiet,
        };
        if *slot {
            return Err(usage(format!("--{name} is given twice")).argument(name));
        }
        *slot = true;
        Ok(())
    }

    fn value(&mut self, name: &'static str, value: String) -> Outcome<()> {
        match name {
            "limit" => self.limits.push(value),
            "upgraded" => self.upgraded.push(value),
            "base-upgraded" => self.base_upgraded.push(value),
            "head-upgraded" => self.head_upgraded.push(value),
            "member" => self.members.push(value),
            "member-revision-key" => self.member_revision_keys.push(value),
            "absent" => self.absent.push(value),
            _ if self.options.insert(name, value).is_some() => {
                let failure = usage(format!("--{name} is given twice"));
                return Err(match name {
                    "document" => failure,
                    _ => failure.argument(name),
                });
            }
            _ => {}
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

/// The option combinations of `bundle build` (cli-spec.md §2.2): (broken,
/// message, argument), in the order checked.
fn build_rules(raw: &Raw, stage: StageArg) -> [(bool, &'static str, &'static str); 7] {
    let has = |name: &str| raw.options.contains_key(name);
    let parse = stage == StageArg::Parse;
    let models = stage == StageArg::Models;
    let board_only = has("refilled-board") && stage != StageArg::Board;
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
    ]
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
        Command::Verify if raw.positional.len() != 1 => {
            Err(usage("bundle verify takes one <bundle.prism>").argument("bundle"))
        }
        Command::Extract if raw.positional.len() < 2 => Err(usage(
            "bundle extract takes <bundle.prism> and at least one <member>",
        )
        .argument("member")),
        Command::Extract if !raw.options.contains_key("output") => {
            Err(usage("bundle extract takes -o <dir>").argument("output"))
        }
        Command::RevisionKey => check_revision_key(raw),
        Command::Reuse => check_reuse(raw),
        Command::Compare => check_compare(raw),
        Command::SystemBuild => check_system(raw),
        Command::Version if !raw.positional.is_empty() => {
            Err(usage("version takes no argument").argument("command"))
        }
        _ => Ok(()),
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
    let (system_members, system_absent) = if command == Command::SystemBuild {
        system_of(&raw)?
    } else {
        (BTreeMap::new(), BTreeSet::new())
    };
    Ok(Args {
        command,
        positional: raw.positional,
        options: raw.options,
        upgraded,
        base_upgraded,
        head_upgraded,
        system_members,
        system_absent,
        include_unchanged: raw.include_unchanged,
        worktree: raw.worktree,
        quiet: raw.quiet,
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
        system_members: BTreeMap::new(),
        system_absent: BTreeSet::new(),
        include_unchanged: false,
        worktree: false,
        quiet: false,
        threads: 4,
        stage: None,
        limits: Limits::defaults(Work::Other),
    }
}

/// The usage text of `-h`.
pub const HELP: &str = "prism-kicad: parse a KiCad revision once and write its design bundle

usage:
  prism-kicad version
  prism-kicad bundle build <project.kicad_pro> --stage parse -o <out.prism>
              [--source-root <dir>] [--revision-key <hex>] [--key-record <record.json>]
              [--upgraded <path>=<version>]... [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage board --in <bundle.prism> -o <out.prism>
              [--refilled-board <board.kicad_pcb> --refill-tool <kicad-version>]
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage models --in <bundle.prism> -o <out.prism>
              --models-glb <components.glb> --models-tool <kicad-version>
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle verify <bundle.prism> [COMMON]
  prism-kicad bundle extract <bundle.prism> <member>... -o <dir> [COMMON]
  prism-kicad bundle reuse --in <bundle.prism> --key-record <record.json> [COMMON]
  prism-kicad revision-key <repo> (--commit <rev> | --worktree) --project <rel>
              [--config <effective.json>] [COMMON]
  prism-kicad compare (--base <base.prism> | --base-src <project.kicad_pro>
              [--base-source-root <dir>] [--base-config <effective.json>]
              [--base-upgraded <path>=<version>]...) --base-revision-key <hex>
              (--head <head.prism> | --head-src … as for the base) --head-revision-key <hex>
              [--include-unchanged] -o <result.json> [COMMON]
  prism-kicad system build --document <system.json>
              [--member <occurrence>=<bundle.prism>
              --member-revision-key <occurrence>=<hex>]... [--absent <occurrence>]...
              -o <system-bundle.json> [COMMON]

COMMON: [--limit <name>=<value>]... [--threads <n>] [--quiet]

Every command writes one JSON document to stdout and JSON Lines to stderr
(native/contracts/prism/cli-spec.md).
";

#[cfg(test)]
mod tests {
    use super::*;

    fn args(line: &str) -> Outcome<Args> {
        let argv: Vec<String> = line.split_whitespace().map(str::to_owned).collect();
        parse(&argv)
    }

    #[test]
    fn parses_the_synopsis() {
        let build = args(
            "bundle build p.kicad_pro --stage parse -o out.prism --limit timeout-ms=5 --quiet",
        )
        .unwrap();
        assert_eq!(build.command, Command::Build);
        assert_eq!(build.stage, Some(StageArg::Parse));
        assert_eq!(build.limits.get(LimitName::TimeoutMs), 5);
        assert!(build.quiet);
        let board =
            args("bundle build --in a -o a --stage board --refilled-board b --refill-tool 10.0.6")
                .unwrap();
        assert_eq!(work_of(board.command, board.stage), Work::Board);
        assert!(args("revision-key . --worktree --project x.kicad_pro").is_ok());
        assert_eq!(args("version").unwrap().command, Command::Version);
        let key = "0".repeat(64);
        let compare = args(&format!(
            "compare --base a.prism --head b.prism --base-revision-key {key} --head-revision-key {key} -o d.json"
        ))
        .unwrap();
        assert_eq!(compare.command, Command::Compare);
        assert_eq!(work_of(compare.command, compare.stage), Work::Compare);
        // A source-tree side runs the parse stage, so it gets that stage's limits.
        let source = args(&format!(
            "compare --base-src p.kicad_pro --base-revision-key {key} --head b.prism --head-revision-key {key} -o r.json"
        ))
        .unwrap();
        assert_eq!(
            source.limits.get(LimitName::TimeoutMs),
            Limits::defaults(Work::Parse).get(LimitName::TimeoutMs)
        );
        let reuse = args("bundle reuse --in a.prism --key-record k.json").unwrap();
        assert_eq!(reuse.command, Command::Reuse);
        assert_eq!(reuse.option("key-record"), Some("k.json"));
    }

    #[test]
    fn rejects_bad_grammar() {
        let code = |line: &str| args(line).unwrap_err().finding.code;
        assert_eq!(code("frobnicate"), "unknown-command");
        assert_eq!(code("bundle build p --stage parse -o a -o b"), "usage");
        assert_eq!(code("bundle build p --stage=parse -o a"), "usage");
        assert_eq!(code("bundle build --stage board -o a"), "option-conflict");
        assert_eq!(
            code("bundle build p --stage parse -o a --in b"),
            "option-conflict"
        );
        assert_eq!(
            code("bundle build p --stage parse -o a --key-record r"),
            "option-conflict"
        );
        assert_eq!(
            code("bundle build p --stage parse -o a --revision-key ABC"),
            "usage"
        );
        assert_eq!(code("revision-key . --project x"), "option-conflict");
        assert_eq!(
            code("revision-key . --commit H --worktree --project x"),
            "option-conflict"
        );
        assert_eq!(code("bundle extract b.prism -o d"), "usage");
        assert_eq!(
            code("bundle verify b --limit max-findings=1 --limit max-findings=2"),
            "usage"
        );
        assert_eq!(code("bundle verify b --threads 0"), "usage");
        assert_eq!(code("bundle verify b --stage parse"), "usage");
    }

    #[test]
    fn rejects_bad_compare_grammar() {
        let code = |line: &str| args(line).unwrap_err().finding.code;
        assert_eq!(code("compare --head b -o d"), "usage");
        assert_eq!(code("compare --base a -o d"), "usage");
        assert_eq!(code("compare --base a --head b"), "usage");
        assert_eq!(code("compare --base a --head b -o d extra"), "usage");
        assert_eq!(code("compare --base a --head b --base c -o d"), "usage");
        // Both modes take each side's revision key (ADR amendment K2 §3.6).
        let key = "0".repeat(64);
        assert_eq!(
            code(&format!(
                "compare --base a --head b --base-revision-key {key} -o d"
            )),
            "usage"
        );
        assert_eq!(
            code(&format!(
                "compare --base a --head b --base-revision-key {key} --head-revision-key X -o d"
            )),
            "usage"
        );
    }

    #[test]
    fn rejects_bad_reuse_grammar() {
        let code = |line: &str| args(line).unwrap_err().finding.code;
        assert_eq!(code("bundle reuse --in a"), "usage");
        assert_eq!(code("bundle reuse --key-record k"), "usage");
        assert_eq!(code("bundle reuse b --in a --key-record k"), "usage");
        assert_eq!(code("bundle reuse --in a --key-record k -o d"), "usage");
        assert_eq!(code("bundle frob"), "unknown-command");
    }

    #[test]
    fn checks_upgrade_records() {
        let code = |line: &str| args(line).unwrap_err().finding.code;
        assert_eq!(
            code("bundle build --in a -o a --stage board --upgraded x.kicad_sch=1"),
            "option-conflict"
        );
        assert_eq!(
            code("bundle build p --stage parse -o a --upgraded x.kicad_pro=1"),
            "usage"
        );
        assert_eq!(
            code("bundle build p --stage parse -o a --upgraded x.kicad_sch=v7"),
            "usage"
        );
        assert_eq!(
            code(
                "bundle build p --stage parse -o a --upgraded x.kicad_sch=1 --upgraded x.kicad_sch=2"
            ),
            "usage"
        );
        let upgraded = args("bundle build p --stage parse -o a --upgraded a/x.kicad_sch=20230121 --upgraded b.kicad_pcb=20221018").unwrap();
        assert_eq!(upgraded.upgraded.get("a/x.kicad_sch"), Some(&20_230_121));
    }
}
