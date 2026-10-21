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
    /// `system step`.
    SystemStep,
    /// `vendor list`.
    VendorList,
    /// `vendor run`.
    VendorRun,
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

/// A `system build` published entry: its payload and the catalog revision's
/// workflow stage.
#[derive(Clone, Debug)]
pub struct SystemEntryArg {
    /// The `prism.system_entry.a0` path.
    pub payload: String,
    /// The revision's stage, 1 to 32 characters of `[a-z_]`.
    pub stage: String,
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
    /// `system build --board-sub-ports`, when given.
    pub system_board_sub_ports: Option<String>,
    /// `system build --entry`, by occurrence.
    pub system_entries: BTreeMap<String, SystemEntryArg>,
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

const VALUE_OPTIONS: [&str; 38] = [
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
    "board-sub-ports",
    "parts",
    "entry",
    "entry-stage",
    "models",
    "variant",
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
            "board-sub-ports",
            "parts",
            "entry",
            "entry-stage",
            "output",
        ],
        Command::SystemStep => &[
            "document",
            "member",
            "member-revision-key",
            "absent",
            "board-sub-ports",
            "parts",
            "entry",
            "entry-stage",
            "models",
            "output",
        ],
        Command::VendorList | Command::VendorRun => &["in", "config", "output", "variant"],
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
        Some("vendor") => vendor_command(argv.get(1).map(String::as_str)),
        Some("bundle") => bundle_command(argv.get(1).map(String::as_str)),
        Some(_) => Err(Failure::usage(
            "unknown-command",
            "the command is not version, bundle build, bundle verify, bundle extract, bundle reuse, revision-key, compare, vendor list, vendor run, system build or system step",
        )
        .argument("command")),
    }
}

fn system_command(word: Option<&str>) -> Outcome<(Command, usize)> {
    match word {
        Some("build") => Ok((Command::SystemBuild, 2)),
        Some("step") => Ok((Command::SystemStep, 2)),
        _ => {
            Err(Failure::usage("unknown-command", "system takes build or step").argument("command"))
        }
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
    entries: Vec<String>,
    entry_stages: Vec<String>,
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
        entries: Vec::new(),
        entry_stages: Vec::new(),
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
                        // `CliArgument` has no `document`, `absent`, `board-sub-ports`, `parts`,
                        // `entry` or `entry-stage` value: the message names the option.
                        "document" | "absent" | "board-sub-ports" | "parts" | "entry"
                        | "entry-stage" | "models" => failure,
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
            "entry" => self.entries.push(value),
            "entry-stage" => self.entry_stages.push(value),
            _ => return self.single(name, value),
        }
        Ok(())
    }

    /// Store a single-valued option, refusing a second one.
    fn single(&mut self, name: &'static str, value: String) -> Outcome<()> {
        if self.options.insert(name, value).is_some() {
            let failure = usage(format!("--{name} is given twice"));
            return Err(match name {
                "document" | "board-sub-ports" | "parts" | "models" => failure,
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
        Command::SystemBuild | Command::SystemStep => {
            check_system(raw, command == Command::SystemStep)
        }
        Command::Version => check_version(raw),
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
    let (system_members, system_absent, system_board_sub_ports, system_entries) =
        if matches!(command, Command::SystemBuild | Command::SystemStep) {
            system_of(&raw)?
        } else {
            (BTreeMap::new(), BTreeSet::new(), None, BTreeMap::new())
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
        system_board_sub_ports,
        system_entries,
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
        system_board_sub_ports: None,
        system_entries: BTreeMap::new(),
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
              [--board-sub-ports <board-sub-ports.json>] [--parts <system-parts.json>]
              [--entry <occurrence>=<system-entry.json>
              --entry-stage <occurrence>=<stage>]...
              -o <system-bundle.json> [COMMON]
  prism-kicad vendor list [COMMON]
  prism-kicad vendor run <vendor-id> --in <bundle.prism> --config <cfg.json>
              -o <dir> [--variant <name>] [COMMON]
  prism-kicad system step --document <system.json>
              [--member <occurrence>=<bundle.prism>
              --member-revision-key <occurrence>=<hex>]... [--absent <occurrence>]...
              [--board-sub-ports <board-sub-ports.json>] [--parts <system-parts.json>]
              [--entry <occurrence>=<system-entry.json>
              --entry-stage <occurrence>=<stage>]... --models <manifest.json>
              -o <system.step> [COMMON]

COMMON: [--limit <name>=<value>]... [--threads <n>] [--quiet]

Every command writes one JSON document to stdout and JSON Lines to stderr
(native/contracts/prism/cli-spec.md).
";

#[cfg(test)]
mod tests;
