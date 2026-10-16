//! The command line of cli-spec.md §2: command words, options anywhere after
//! them (`--name value`, never `--name=value`), no option twice except
//! `--limit` with different names, value syntax and combinations checked
//! before any work (exit 2).

use prism_bundle::{Failure, LimitName, Limits, Outcome, Work};
use std::collections::BTreeMap;

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
    /// `revision-key`.
    RevisionKey,
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
        (Command::RevisionKey, _) => Work::RevisionKey,
        _ => Work::Other,
    }
}

const VALUE_OPTIONS: [&str; 15] = [
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
    "limit",
    "threads",
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
            "config",
            "refilled-board",
            "refill-tool",
            "models-glb",
            "models-tool",
        ],
        Command::Extract => &["output"],
        Command::RevisionKey => &["commit", "worktree", "project", "config"],
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
        Some("bundle") => match argv.get(1).map(String::as_str) {
            Some("build") => Ok((Command::Build, 2)),
            Some("verify") => Ok((Command::Verify, 2)),
            Some("extract") => Ok((Command::Extract, 2)),
            _ => Err(Failure::usage("unknown-command", "bundle takes build, verify or extract").argument("command")),
        },
        Some(_) => Err(Failure::usage(
            "unknown-command",
            "the command is not version, bundle build, bundle verify, bundle extract or revision-key",
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
        .chain(["worktree", "quiet", "help"])
        .find(|candidate| *candidate == name)
}

struct Raw {
    positional: Vec<String>,
    options: BTreeMap<&'static str, String>,
    limits: Vec<String>,
    worktree: bool,
    quiet: bool,
    help: bool,
}

fn collect(command: Command, rest: &[String]) -> Outcome<Raw> {
    let mut raw = Raw {
        positional: Vec::new(),
        options: BTreeMap::new(),
        limits: Vec::new(),
        worktree: false,
        quiet: false,
        help: false,
    };
    let mut index = 0;
    while index < rest.len() {
        let token = &rest[index];
        index += 1;
        let Some(name) = long_name(token).filter(|_| token.starts_with('-') && token.len() > 1)
        else {
            raw.positional.push(token.clone());
            continue;
        };
        if token == "-h" || name == "help" {
            raw.help = true;
            continue;
        }
        let name = static_name(name)
            .filter(|name| allowed(command, name))
            .ok_or_else(|| usage(format!("unknown option {token:?}")))?;
        match name {
            "worktree" if !raw.worktree => raw.worktree = true,
            "quiet" if !raw.quiet => raw.quiet = true,
            "worktree" | "quiet" => {
                return Err(usage(format!("--{name} is given twice")).argument(name));
            }
            _ => {
                let value = rest
                    .get(index)
                    .ok_or_else(|| usage(format!("--{name} takes a value")).argument(name))?
                    .clone();
                index += 1;
                if name == "limit" {
                    raw.limits.push(value);
                } else if raw.options.insert(name, value).is_some() {
                    return Err(usage(format!("--{name} is given twice")).argument(name));
                }
            }
        }
    }
    Ok(raw)
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

fn check_values(raw: &Raw) -> Outcome<(Option<StageArg>, u64)> {
    if let Some(key) = raw.options.get("revision-key")
        && !is_hex64(key)
    {
        return Err(usage("--revision-key takes 64 lowercase hex digits").argument("revision-key"));
    }
    for tool in ["refill-tool", "models-tool"] {
        if let Some(version) = raw.options.get(tool)
            && !is_release_version(version)
        {
            return Err(
                usage(format!("--{tool} takes a release version such as 10.0.6")).argument(
                    if tool == "refill-tool" {
                        "refill-tool"
                    } else {
                        "models-tool"
                    },
                ),
            );
        }
    }
    let stage = match raw.options.get("stage").map(String::as_str) {
        None => None,
        Some("parse") => Some(StageArg::Parse),
        Some("board") => Some(StageArg::Board),
        Some("models") => Some(StageArg::Models),
        Some(_) => return Err(usage("--stage takes parse, board or models").argument("stage")),
    };
    let threads = match raw.options.get("threads") {
        None => 4,
        Some(value) => value
            .parse::<u64>()
            .ok()
            .filter(|threads| (1..=64).contains(threads) && !value.starts_with('+'))
            .ok_or_else(|| usage("--threads takes 1 to 64").argument("threads"))?,
    };
    Ok((stage, threads))
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
    for (name, argument) in [("source-root", "source-root"), ("key-record", "key-record")] {
        if has(name) && !parse {
            return Err(conflict(
                format!("--{name} is only for --stage parse"),
                argument,
            ));
        }
    }
    if has("key-record") && !has("revision-key") {
        return Err(conflict(
            "--key-record requires --revision-key",
            "key-record",
        ));
    }
    if parse == has("in") {
        return Err(conflict(
            "--in is required with board and models and refused with parse",
            "in",
        ));
    }
    if has("refilled-board") != has("refill-tool")
        || (has("refilled-board") && stage != StageArg::Board)
    {
        return Err(conflict(
            "--refilled-board and --refill-tool go together, with --stage board only",
            "refilled-board",
        ));
    }
    let models = stage == StageArg::Models;
    if has("models-glb") != models || has("models-tool") != models {
        return Err(conflict(
            "--models-glb and --models-tool go together and only with --stage models",
            "models-glb",
        ));
    }
    Ok(())
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
        Command::RevisionKey if raw.positional.len() != 1 => {
            Err(usage("revision-key takes one <repo>").argument("repo"))
        }
        Command::RevisionKey if raw.options.contains_key("commit") == raw.worktree => {
            Err(conflict(
                "revision-key takes exactly one of --commit and --worktree",
                "commit",
            ))
        }
        Command::RevisionKey if !raw.options.contains_key("project") => {
            Err(usage("revision-key takes --project").argument("project"))
        }
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
    let mut limits = Limits::defaults(work_of(command, stage));
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
    Ok(Args {
        command,
        positional: raw.positional,
        options: raw.options,
        worktree: raw.worktree,
        quiet: raw.quiet,
        threads,
        stage,
        limits,
    })
}

fn help_args() -> Args {
    Args {
        command: Command::Help,
        positional: Vec::new(),
        options: BTreeMap::new(),
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
              [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage board --in <bundle.prism> -o <out.prism>
              [--refilled-board <board.kicad_pcb> --refill-tool <kicad-version>]
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle build --stage models --in <bundle.prism> -o <out.prism>
              --models-glb <components.glb> --models-tool <kicad-version>
              [--revision-key <hex>] [--config <effective.json>] [COMMON]
  prism-kicad bundle verify <bundle.prism> [COMMON]
  prism-kicad bundle extract <bundle.prism> <member>... -o <dir> [COMMON]
  prism-kicad revision-key <repo> (--commit <rev> | --worktree) --project <rel>
              [--config <effective.json>] [COMMON]

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
}
