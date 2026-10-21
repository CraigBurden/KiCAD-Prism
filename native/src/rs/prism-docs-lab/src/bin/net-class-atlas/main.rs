//! `net-class-atlas` — the net-class atlas prototype.
//!
//! `cargo run -p prism-docs-lab --bin net-class-atlas -- --in <bundle.prism>
//! -o <atlas.html> [--side top|bottom|both] [--theme light|dark|blueprint]`
//!
//! Reads one design bundle, groups the board's nets by net class and writes
//! one self-contained HTML page. It is a hand-run documentation prototype, not
//! a Release Studio feature: no service reads its output and no image ships
//! it.

mod model;
mod pads;
mod page;
mod svg;

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::Instant;

use prism_docs_lab::bundle::{Bundle, LabError};
use prism_docs_lab::theme::Theme;

use model::SideChoice;

const USAGE: &str = "\
usage: net-class-atlas --in <bundle.prism> -o <atlas.html> [--side top|bottom|both]
                       [--theme light|dark|blueprint]

  --in    a .prism design bundle whose parse, board and models stages are built
  -o      the HTML file to write (parent directories are created)
  --side  which footprints to draw in full; `both` adds a switch (default top)
  --theme light (default), dark or blueprint";

struct Options {
    input: PathBuf,
    output: PathBuf,
    side: SideChoice,
    theme: Theme,
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.iter().any(|arg| arg == "--help" || arg == "-h") {
        println!("{USAGE}");
        return ExitCode::SUCCESS;
    }
    let options = match parse(&args) {
        Ok(options) => options,
        Err(error) => {
            eprintln!("net-class-atlas: {error}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match run(&options) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("net-class-atlas: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(options: &Options) -> Result<(), LabError> {
    let started = Instant::now();
    let bundle = Bundle::open(&options.input)?;
    let atlas = model::load(&bundle)?;
    let html = page::render(&atlas, options.side, options.theme);
    let elapsed = started.elapsed();
    if let Some(parent) = options
        .output
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        std::fs::create_dir_all(parent).map_err(|error| {
            LabError::new(format!(
                "{} could not be created: {error}",
                parent.display()
            ))
        })?;
    }
    std::fs::write(&options.output, html.as_bytes()).map_err(|error| {
        LabError::new(format!(
            "{} could not be written: {error}",
            options.output.display()
        ))
    })?;
    let nets: usize = atlas.classes.iter().map(|section| section.net_count).sum();
    let groups: usize = atlas
        .classes
        .iter()
        .map(|section| section.groups.len())
        .sum();
    println!(
        "atlas: {} net classes, {} groups, {} nets, {} tracks, {} vias; wrote {} ({} bytes) in {} ms",
        atlas.classes.len(),
        groups,
        nets,
        atlas.tracks,
        atlas.vias,
        options.output.display(),
        html.len(),
        elapsed.as_millis(),
    );
    Ok(())
}

/// Parse `--in`, `-o` and `--side`, each taking one value.
fn parse(args: &[String]) -> Result<Options, LabError> {
    let mut input: Option<PathBuf> = None;
    let mut output: Option<PathBuf> = None;
    let mut side = SideChoice::Top;
    let mut theme = Theme::Light;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--in" => input = Some(PathBuf::from(value(args, &mut index, "--in")?)),
            "-o" | "--out" => output = Some(PathBuf::from(value(args, &mut index, "-o")?)),
            "--theme" => theme = value(args, &mut index, "--theme")?.parse()?,
            "--side" => {
                let raw = value(args, &mut index, "--side")?;
                side = SideChoice::parse(&raw).ok_or_else(|| {
                    LabError::new(format!("--side is `top`, `bottom` or `both`, not {raw:?}"))
                })?;
            }
            other => return Err(LabError::new(format!("unexpected argument {other:?}"))),
        }
        index += 1;
    }
    Ok(Options {
        input: input.ok_or_else(|| LabError::new("--in is required"))?,
        output: output.ok_or_else(|| LabError::new("-o is required"))?,
        side,
        theme,
    })
}

fn value(args: &[String], index: &mut usize, option: &str) -> Result<String, LabError> {
    *index += 1;
    args.get(*index)
        .cloned()
        .ok_or_else(|| LabError::new(format!("{option} takes a value")))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed(args: &[&str]) -> Result<Options, LabError> {
        parse(&args.iter().map(|arg| (*arg).to_owned()).collect::<Vec<_>>())
    }

    #[test]
    fn the_defaults_are_top_light_and_no_output() {
        let options = parsed(&["--in", "board.prism", "-o", "atlas.html"]).expect("valid");
        assert_eq!(options.side, SideChoice::Top);
        assert_eq!(options.theme, Theme::Light);
        assert_eq!(options.output, PathBuf::from("atlas.html"));
    }

    #[test]
    fn the_side_parses_and_rejects_unknown_values() {
        let options = parsed(&["--in", "b", "-o", "o", "--side", "both"]).expect("valid");
        assert_eq!(options.side, SideChoice::Both);
        assert!(parsed(&["--in", "b", "-o", "o", "--side", "left"]).is_err());
    }

    #[test]
    fn the_theme_parses_and_rejects_unknown_values() {
        assert_eq!(
            parsed(&["--in", "b", "-o", "o", "--theme", "dark"])
                .expect("valid")
                .theme,
            Theme::Dark
        );
        assert!(parsed(&["--in", "b", "-o", "o", "--theme", "sepia"]).is_err());
    }

    #[test]
    fn a_missing_value_or_argument_is_an_error() {
        assert!(parsed(&["--in"]).is_err());
        assert!(parsed(&["--in", "b", "-o", "o", "--wat"]).is_err());
        assert!(parsed(&[]).is_err());
    }
}
