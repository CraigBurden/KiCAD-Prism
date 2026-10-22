//! `mechanical-outline` — the mechanical outline sheet prototype.
//!
//! `cargo run -p prism-docs-lab --bin mechanical-outline -- --in
//! <bundle.prism> -o <dir> [--geometer <exe>] [--model-dir VAR=DIR]...
//! [--height-limit-mm 5.0]`
//!
//! Reads one design bundle, measures the STEP models through one Geometer
//! process, and writes one or two A3 landscape SVG sheets beside an
//! `index.html` and a `mechanical.pdf` printed by headless Chrome. It is a
//! hand-run documentation prototype, not a Release Studio feature: no service
//! reads its output and no image ships it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode};
use std::time::Instant;

use prism_docs_lab::bundle::{Bundle, LabError};
use prism_docs_lab::mech::{Geometer, board::Board, layout, measure, sheet};
use prism_docs_lab::theme::Theme;

const USAGE: &str = "\
usage: mechanical-outline --in <bundle.prism> -o <dir> [--geometer <exe>]
                          [--model-dir VAR=DIR]... [--height-limit-mm 5.0]
                          [--chrome <exe>] [--theme light|dark|blueprint]

  --in                a .prism bundle whose parse, board and models stages are built
  -o                  the directory for mechanical-1.svg, index.html and mechanical.pdf
  --geometer          the Geometer executable (default: $GEOMETER_EXECUTABLE)
  --model-dir         a stock 3D-model directory, e.g. KICAD9_3DMODEL_DIR=<dir> (repeatable)
  --height-limit-mm   parts taller than this are marked red (default 5.0)
  --chrome            the Chrome executable used for the PDF (default: $CHROME)
  --theme             light (default), dark or blueprint";

struct Options {
    input: PathBuf,
    output: PathBuf,
    geometer: Option<PathBuf>,
    model_dirs: BTreeMap<String, PathBuf>,
    height_limit: f64,
    chrome: Option<PathBuf>,
    theme: Theme,
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args
        .iter()
        .any(|argument| argument == "--help" || argument == "-h")
    {
        println!("{USAGE}");
        return ExitCode::SUCCESS;
    }
    let options = match parse(&args) {
        Ok(options) => options,
        Err(error) => {
            eprintln!("mechanical-outline: {error}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match run(&options) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("mechanical-outline: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(options: &Options) -> Result<(), LabError> {
    let started = Instant::now();
    let bundle = Bundle::open(&options.input)?;
    let mut board = Board::load(&bundle)?;
    let executable = options
        .geometer
        .clone()
        .or_else(|| std::env::var_os("GEOMETER_EXECUTABLE").map(PathBuf::from));
    let mut session = match executable.as_deref() {
        Some(path) => Some(Geometer::connect(path).map_err(LabError::new)?),
        None => {
            eprintln!(
                "mechanical-outline: no --geometer and no $GEOMETER_EXECUTABLE; heights are unknown"
            );
            None
        }
    };
    let measure_started = Instant::now();
    let measurement = measure(&mut board, &bundle, session.as_mut(), &options.model_dirs)?;
    drop(session);
    let measure_ms = measure_started.elapsed().as_millis();
    let render_started = Instant::now();
    let (height_rows, hole_rows) = sheet::row_counts(&board, options.height_limit);
    let tables_on_sheet = layout::tables_fit_on_sheet_one(height_rows, hole_rows);
    let sheets = sheet::render(
        &board,
        &measurement,
        options.height_limit,
        tables_on_sheet,
        options.theme,
    );
    let index = write_sheets(options, &board.name, &sheets)?;
    let pdf = options.output.join("mechanical.pdf");
    let render_ms = render_started.elapsed().as_millis();
    let pdf_started = Instant::now();
    let chrome = chrome(options.chrome.as_deref());
    match chrome {
        Some(chrome) => {
            if let Err(error) = print_pdf(&chrome, &index, &pdf) {
                eprintln!("mechanical-outline: the PDF was not printed: {error}");
            }
        }
        None => eprintln!("mechanical-outline: no Chrome found; skipped mechanical.pdf"),
    }
    let pdf_ms = pdf_started.elapsed().as_millis();
    summary(
        options,
        &board,
        &measurement,
        &sheets,
        tables_on_sheet,
        Timings {
            measure: measure_ms,
            render: render_ms,
            pdf: pdf_ms,
            total: started.elapsed().as_millis(),
        },
    );
    for warning in &measurement.warnings {
        eprintln!("mechanical-outline: {warning}");
    }
    Ok(())
}

struct Timings {
    measure: u128,
    render: u128,
    pdf: u128,
    total: u128,
}

fn summary(
    options: &Options,
    board: &Board,
    measurement: &prism_docs_lab::mech::Measurement,
    sheets: &[String],
    tables_on_sheet: bool,
    timings: Timings,
) {
    let known = board
        .parts
        .iter()
        .filter(|part| part.height.is_some())
        .count();
    let overhanging = board
        .parts
        .iter()
        .filter(|part| part.overhang.is_some())
        .count();
    let mounting = board.holes.iter().filter(|hole| hole.mounting).count();
    println!(
        "mechanical-outline: {} — {} sheets, scale {}, {} parts ({} measured, {} unknown), \
{} holes ({} mounting), {} overhanging; max {} above / {} below; Geometer {} ({} requests); \
wrote {} in {} ms (measure {}, render {}, pdf {})",
        board.name,
        sheets.len(),
        prism_docs_lab::mech::layout::choose(board, tables_on_sheet)
            .scale
            .label(),
        board.parts.len(),
        known,
        board.parts.len().saturating_sub(known),
        board.holes.len(),
        mounting,
        overhanging,
        prism_docs_lab::html::millimetres(board.tallest_above()),
        prism_docs_lab::html::millimetres(board.deepest_below()),
        measurement.geometer.as_deref().unwrap_or("none"),
        measurement.requests,
        options.output.display(),
        timings.total,
        timings.measure,
        timings.render,
        timings.pdf,
    );
}

fn write_sheets(options: &Options, name: &str, sheets: &[String]) -> Result<PathBuf, LabError> {
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
    std::fs::create_dir_all(&options.output).map_err(|error| {
        LabError::new(format!(
            "{} could not be created: {error}",
            options.output.display()
        ))
    })?;
    for (index, svg) in sheets.iter().enumerate() {
        let path = options.output.join(format!("mechanical-{}.svg", index + 1));
        write(&path, svg)?;
    }
    let title = format!("{name} — mechanical outline");
    let page = sheet::html(&title, sheets, options.theme);
    let index = options.output.join("index.html");
    write(&index, &page)?;
    Ok(index)
}

fn write(path: &Path, text: &str) -> Result<(), LabError> {
    std::fs::write(path, text.as_bytes())
        .map_err(|error| LabError::new(format!("{} could not be written: {error}", path.display())))
}

/// The Chrome to print with: `--chrome`, then `$CHROME`, then the macOS app.
fn chrome(argument: Option<&Path>) -> Option<PathBuf> {
    if let Some(path) = argument {
        return Some(path.to_owned());
    }
    if let Some(path) = std::env::var_os("CHROME").map(PathBuf::from) {
        return Some(path);
    }
    let default = PathBuf::from("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome");
    default.exists().then_some(default)
}

fn print_pdf(chrome: &Path, index: &Path, pdf: &Path) -> Result<(), String> {
    let source = format!("file://{}", index.display());
    let target = format!("--print-to-pdf={}", pdf.display());
    let mut last = String::new();
    // A Chrome started by another agent can hold the shared headless profile
    // for a moment; one clean retry with a fresh profile is enough.
    for attempt in 0..2 {
        let profile_dir = std::env::temp_dir().join(format!(
            "prism-docs-lab-chrome-{}-{attempt}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&profile_dir);
        let profile = format!("--user-data-dir={}", profile_dir.display());
        let status = Command::new(chrome)
            .args([
                "--headless=new",
                "--disable-gpu",
                "--hide-scrollbars",
                "--no-first-run",
                "--no-default-browser-check",
                "--no-pdf-header-footer",
                "--run-all-compositor-stages-before-draw",
                "--virtual-time-budget=2000",
                &profile,
                &target,
                &source,
            ])
            .status()
            .map_err(|error| format!("{} did not start: {error}", chrome.display()))?;
        let _ = std::fs::remove_dir_all(&profile_dir);
        if status.success() {
            return Ok(());
        }
        last = format!("{} exited with {status}", chrome.display());
    }
    Err(last)
}

fn parse(args: &[String]) -> Result<Options, LabError> {
    let mut input: Option<PathBuf> = None;
    let mut output: Option<PathBuf> = None;
    let mut geometer: Option<PathBuf> = None;
    let mut model_dirs: BTreeMap<String, PathBuf> = BTreeMap::new();
    let mut height_limit = 5.0;
    let mut chrome: Option<PathBuf> = None;
    let mut theme = Theme::Light;
    let mut index = 0;
    while index < args.len() {
        match args[index].as_str() {
            "--in" => input = Some(PathBuf::from(value(args, &mut index, "--in")?)),
            "-o" | "--out" => output = Some(PathBuf::from(value(args, &mut index, "-o")?)),
            "--geometer" => geometer = Some(PathBuf::from(value(args, &mut index, "--geometer")?)),
            "--chrome" => chrome = Some(PathBuf::from(value(args, &mut index, "--chrome")?)),
            "--model-dir" => {
                let (name, directory) = model_dir(&value(args, &mut index, "--model-dir")?)?;
                model_dirs.insert(name, directory);
            }
            "--theme" => theme = value(args, &mut index, "--theme")?.parse()?,
            "--height-limit-mm" => {
                height_limit = limit(&value(args, &mut index, "--height-limit-mm")?)?;
            }
            other => return Err(LabError::new(format!("unexpected argument {other:?}"))),
        }
        index += 1;
    }
    Ok(Options {
        input: input.ok_or_else(|| LabError::new("--in is required"))?,
        output: output.ok_or_else(|| LabError::new("-o is required"))?,
        geometer,
        model_dirs,
        height_limit,
        chrome,
        theme,
    })
}

fn model_dir(raw: &str) -> Result<(String, PathBuf), LabError> {
    let (name, directory) = raw
        .split_once('=')
        .ok_or_else(|| LabError::new(format!("--model-dir is VAR=DIR, not {raw:?}")))?;
    if name.is_empty() || directory.is_empty() {
        return Err(LabError::new(format!(
            "--model-dir is VAR=DIR, not {raw:?}"
        )));
    }
    Ok((name.to_owned(), PathBuf::from(directory)))
}

fn limit(raw: &str) -> Result<f64, LabError> {
    let value = raw
        .parse::<f64>()
        .map_err(|_| LabError::new(format!("--height-limit-mm is a number, not {raw:?}")))?;
    if value.is_finite() && value > 0.0 {
        Ok(value)
    } else {
        Err(LabError::new("--height-limit-mm must be positive"))
    }
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
        parse(
            &args
                .iter()
                .map(|argument| (*argument).to_owned())
                .collect::<Vec<_>>(),
        )
    }

    #[test]
    fn the_defaults_are_a_five_millimetre_limit_and_no_model_dirs() {
        let options = parsed(&["--in", "b.prism", "-o", "out"]).expect("valid");
        assert_eq!(options.height_limit, 5.0);
        assert!(options.model_dirs.is_empty());
        assert_eq!(options.output, PathBuf::from("out"));
    }

    #[test]
    fn the_theme_parses_and_defaults_to_light() {
        assert_eq!(
            parsed(&["--in", "b", "-o", "o"]).expect("valid").theme,
            Theme::Light
        );
        assert_eq!(
            parsed(&["--in", "b", "-o", "o", "--theme", "dark"])
                .expect("valid")
                .theme,
            Theme::Dark
        );
        assert!(parsed(&["--in", "b", "-o", "o", "--theme", "sepia"]).is_err());
    }

    #[test]
    fn model_dirs_are_repeatable() {
        let options = parsed(&[
            "--in",
            "b",
            "-o",
            "o",
            "--model-dir",
            "KICAD9_3DMODEL_DIR=/models",
            "--model-dir",
            "KICAD10_3DMODEL_DIR=/new",
        ])
        .expect("valid");
        assert_eq!(options.model_dirs.len(), 2);
        assert_eq!(
            options.model_dirs["KICAD10_3DMODEL_DIR"],
            PathBuf::from("/new")
        );
    }

    #[test]
    fn a_bad_limit_or_model_dir_is_an_error() {
        assert!(parsed(&["--in", "b", "-o", "o", "--height-limit-mm", "x"]).is_err());
        assert!(parsed(&["--in", "b", "-o", "o", "--height-limit-mm", "0"]).is_err());
        assert!(parsed(&["--in", "b", "-o", "o", "--model-dir", "VAR"]).is_err());
        assert!(parsed(&["--in"]).is_err());
    }
}
