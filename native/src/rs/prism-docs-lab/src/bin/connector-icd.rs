//! `connector-icd` — the connector interface control sheet prototype.
//!
//! `cargo run -p prism-docs-lab --bin connector-icd -- --in <bundle.prism>
//! -o <dir> [--geometer <exe>] [--model-dir VAR=DIR]... [--refs J1,J2]
//! [--prefixes J,P,CN,X] [--exclude-prefixes JP] [--exclude-refs <refs>] [--chrome <exe>] [--no-pdf]`
//!
//! Reads one design bundle, writes one A3 landscape SVG per connector, an
//! index page that inlines them, and a PDF printed from that page by headless
//! Chrome. It is a hand-run documentation prototype, not a Release Studio
//! feature: no service reads its output and no image ships it.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitCode, Stdio};
use std::time::Instant;

use prism_docs_lab::bundle::{Bundle, LabError};
use prism_docs_lab::icd::{
    Cache, LoadOptions, RenderedSheet, Session, SheetContext, index_page, load, render_sheet,
};
use prism_docs_lab::theme::Theme;

const USAGE: &str = "\
usage: connector-icd --in <bundle.prism> -o <dir> [--geometer <exe>]
                     [--model-dir VAR=DIR]... [--refs J1,J2]
                     [--prefixes J,P,CN,X] [--exclude-prefixes JP] [--exclude-refs <refs>]
                     [--chrome <exe>] [--no-pdf]
                     [--theme light|dark|blueprint]

  --in        a .prism design bundle with its board and models stages built
  -o          the output directory (created; one A3 SVG per connector)
  --geometer  the Geometer runtime (default: $GEOMETER_EXECUTABLE)
  --model-dir a KiCad stock library, `VAR=DIR` (repeatable)
  --refs      exact connector references, comma separated
  --prefixes  reference prefixes that mark a connector (default J,P,CN,X)
  --exclude-prefixes  prefixes that are not connectors though a prefix matches (default JP,
              KiCad's solder jumpers); pass an empty list to keep them
  --exclude-refs  exact references to leave out of a prefix selection
  --chrome    the Chrome binary for connectors.pdf (default: $CHROME)
  --no-pdf    skip connectors.pdf
  --theme     light (default), dark or blueprint";

struct Options {
    input: PathBuf,
    output: PathBuf,
    geometer: Option<PathBuf>,
    model_dirs: BTreeMap<String, PathBuf>,
    refs: Vec<String>,
    prefixes: Vec<String>,
    exclude_prefixes: Vec<String>,
    exclude_refs: Vec<String>,
    chrome: Option<PathBuf>,
    pdf: bool,
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
            eprintln!("connector-icd: {error}\n\n{USAGE}");
            return ExitCode::from(2);
        }
    };
    match run(&options) {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("connector-icd: {error}");
            ExitCode::FAILURE
        }
    }
}

fn run(options: &Options) -> Result<(), LabError> {
    let started = Instant::now();
    let bundle = Bundle::open(&options.input)?;
    let session = connect(options)?;
    let mut cache = Cache::new();
    let icd = load(
        &bundle,
        &LoadOptions {
            prefixes: options.prefixes.clone(),
            exclude_prefixes: options.exclude_prefixes.clone(),
            exclude_refs: options.exclude_refs.clone(),
            refs: options.refs.clone(),
            model_dirs: options.model_dirs.clone(),
        },
        session.as_ref(),
        &mut cache,
    )?;
    create_dir(&options.output)?;
    let sheets = write_sheets(&icd, &options.output, options.theme)?;
    let index = index_page(&icd, &sheets, options.theme);
    let index_path = options.output.join("index.html");
    write(&index_path, index.as_bytes())?;
    let pdf = if options.pdf {
        print_pdf(options, &index_path)?
    } else {
        None
    };
    report(&icd, &sheets, &pdf, started.elapsed().as_millis());
    Ok(())
}

fn connect(options: &Options) -> Result<Option<Session>, LabError> {
    let executable = match &options.geometer {
        Some(path) => path.clone(),
        None => match std::env::var_os("GEOMETER_EXECUTABLE") {
            Some(path) => PathBuf::from(path),
            None => return Ok(None),
        },
    };
    if !executable.is_file() {
        if options.geometer.is_some() {
            return Err(LabError::new(format!(
                "{} is not a file",
                executable.display()
            )));
        }
        eprintln!(
            "connector-icd: {} is not a file; drawing footprint views only",
            executable.display()
        );
        return Ok(None);
    }
    Session::connect(&executable).map(Some)
}

fn write_sheets(
    icd: &prism_docs_lab::icd::Icd,
    directory: &Path,
    theme: Theme,
) -> Result<Vec<RenderedSheet>, LabError> {
    let mut sheets = Vec::new();
    let mut sheet_number = 1;
    for connector in &icd.connectors {
        for page in 0..connector.pages {
            let context = SheetContext {
                icd,
                connector,
                page,
                sheet_number,
                theme,
            };
            let svg = render_sheet(&context);
            let file = if page == 0 {
                format!("{}.svg", file_stem(&connector.reference))
            } else {
                format!("{}-{}.svg", file_stem(&connector.reference), page + 1)
            };
            write(&directory.join(&file), svg.as_bytes())?;
            sheets.push(RenderedSheet {
                reference: connector.reference.clone(),
                page,
                pages: connector.pages,
                file,
                svg,
            });
            sheet_number += 1;
        }
    }
    Ok(sheets)
}

/// A reference as a file name: letters, digits, dashes and underscores.
fn file_stem(reference: &str) -> String {
    reference
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn print_pdf(options: &Options, index: &Path) -> Result<Option<PathBuf>, LabError> {
    let Some(chrome) = find_chrome(options.chrome.as_deref()) else {
        eprintln!("connector-icd: no Chrome found; skipping connectors.pdf");
        return Ok(None);
    };
    let pdf = options.output.join("connectors.pdf");
    let status = Command::new(&chrome)
        .arg("--headless=new")
        .arg("--disable-gpu")
        .arg("--hide-scrollbars")
        .arg("--no-pdf-header-footer")
        .arg(format!("--print-to-pdf={}", pdf.display()))
        .arg(file_url(index))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|error| {
            LabError::new(format!(
                "{} could not be started: {error}",
                chrome.display()
            ))
        })?;
    // Headless Chrome on macOS reports a display error and a non-zero status
    // even when it wrote the whole file, so the file is the evidence.
    if pdf.is_file() && std::fs::metadata(&pdf).is_ok_and(|meta| meta.len() > 0) {
        return Ok(Some(pdf));
    }
    eprintln!("connector-icd: Chrome exited with {status}; connectors.pdf was not written");
    Ok(None)
}

fn find_chrome(explicit: Option<&Path>) -> Option<PathBuf> {
    if let Some(path) = explicit {
        return path.is_file().then(|| path.to_path_buf());
    }
    if let Some(path) = std::env::var_os("CHROME") {
        let path = PathBuf::from(path);
        if path.is_file() {
            return Some(path);
        }
    }
    const CANDIDATES: [&str; 3] = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/usr/bin/google-chrome",
        "/usr/bin/chromium",
    ];
    for candidate in CANDIDATES {
        let path = PathBuf::from(candidate);
        if path.is_file() {
            return Some(path);
        }
    }
    let path = std::env::var_os("PATH")?;
    for directory in std::env::split_paths(&path) {
        for name in ["google-chrome", "chromium"] {
            let candidate = directory.join(name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// A `file://` URL for a local path, with the characters a URL cannot carry.
fn file_url(path: &Path) -> String {
    let absolute = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let mut url = String::from("file://");
    for character in absolute.to_string_lossy().chars() {
        match character {
            ' ' => url.push_str("%20"),
            '#' => url.push_str("%23"),
            '?' => url.push_str("%3F"),
            '%' => url.push_str("%25"),
            _ => url.push(character),
        }
    }
    url
}

fn report(
    icd: &prism_docs_lab::icd::Icd,
    sheets: &[RenderedSheet],
    pdf: &Option<PathBuf>,
    elapsed_ms: u128,
) {
    for connector in &icd.connectors {
        let views = if connector.views.is_some() {
            "step"
        } else {
            connector.model.reason().unwrap_or("no views")
        };
        println!(
            "  {:<6} {:<28} {:>3} pins  {:>2} sheet{}  {}",
            connector.reference,
            connector.value,
            connector.pins.len(),
            connector.pages,
            if connector.pages == 1 { "" } else { "s" },
            views,
        );
    }
    println!(
        "connector-icd: {} connector{}, {} with STEP views, {} footprint only; \
{} sheet{}, {} svg{}; {} ms{}",
        icd.connectors.len(),
        if icd.connectors.len() == 1 { "" } else { "s" },
        icd.with_views,
        icd.footprint_only,
        sheets.len(),
        if sheets.len() == 1 { "" } else { "s" },
        sheets.len(),
        match pdf {
            Some(path) => format!(", {}", path.display()),
            None => String::new(),
        },
        elapsed_ms,
        match &icd.geometer {
            Some(release) => format!(", Geometer {release}"),
            None => String::new(),
        },
    );
}

fn create_dir(path: &Path) -> Result<(), LabError> {
    std::fs::create_dir_all(path)
        .map_err(|error| LabError::new(format!("{} could not be created: {error}", path.display())))
}

fn write(path: &Path, bytes: &[u8]) -> Result<(), LabError> {
    std::fs::write(path, bytes)
        .map_err(|error| LabError::new(format!("{} could not be written: {error}", path.display())))
}

/// Parse `--in`, `-o`, `--geometer`, `--model-dir`, `--refs`, `--prefixes`,
/// `--chrome` and `--no-pdf`.
fn parse(args: &[String]) -> Result<Options, LabError> {
    let mut raw = RawOptions::default();
    let mut index = 0;
    while index < args.len() {
        if !raw.apply(args, &mut index)? {
            return Err(LabError::new(format!(
                "unexpected argument {:?}",
                args[index]
            )));
        }
        index += 1;
    }
    raw.into_options()
}

/// The arguments as they are met, before the required ones are checked.
struct RawOptions {
    input: Option<PathBuf>,
    output: Option<PathBuf>,
    geometer: Option<PathBuf>,
    model_dirs: BTreeMap<String, PathBuf>,
    refs: Vec<String>,
    prefixes: Vec<String>,
    exclude_prefixes: Vec<String>,
    exclude_refs: Vec<String>,
    chrome: Option<PathBuf>,
    pdf: bool,
    theme: Theme,
}

impl Default for RawOptions {
    fn default() -> Self {
        Self {
            input: None,
            output: None,
            geometer: None,
            model_dirs: BTreeMap::new(),
            refs: Vec::new(),
            prefixes: vec![
                "J".to_owned(),
                "P".to_owned(),
                "CN".to_owned(),
                "X".to_owned(),
            ],
            exclude_prefixes: vec!["JP".to_owned()],
            exclude_refs: Vec::new(),
            chrome: None,
            pdf: true,
            theme: Theme::Light,
        }
    }
}

impl RawOptions {
    /// One option, or `false` when `args[index]` is not one.
    fn apply(&mut self, args: &[String], index: &mut usize) -> Result<bool, LabError> {
        match args[*index].as_str() {
            "--in" => self.input = Some(PathBuf::from(value(args, index, "--in")?)),
            "-o" | "--out" => self.output = Some(PathBuf::from(value(args, index, "-o")?)),
            "--geometer" => self.geometer = Some(PathBuf::from(value(args, index, "--geometer")?)),
            "--chrome" => self.chrome = Some(PathBuf::from(value(args, index, "--chrome")?)),
            "--model-dir" => {
                let raw = value(args, index, "--model-dir")?;
                let (variable, directory) = model_dir(&raw)?;
                self.model_dirs.insert(variable, directory);
            }
            flag @ ("--refs" | "--prefixes" | "--exclude-prefixes" | "--exclude-refs") => {
                let items = list(&value(args, index, flag)?);
                self.select(flag, items);
            }
            "--no-pdf" => self.pdf = false,
            "--theme" => self.theme = value(args, index, "--theme")?.parse()?,
            _ => return Ok(false),
        }
        Ok(true)
    }

    /// One of the selection lists: which references are connectors.
    fn select(&mut self, flag: &str, items: Vec<String>) {
        match flag {
            "--refs" => self.refs = items,
            "--prefixes" => self.prefixes = items,
            "--exclude-prefixes" => self.exclude_prefixes = items,
            _ => self.exclude_refs = items,
        }
    }

    fn into_options(self) -> Result<Options, LabError> {
        if self.prefixes.is_empty() && self.refs.is_empty() {
            return Err(LabError::new("--prefixes or --refs must name something"));
        }
        Ok(Options {
            input: self
                .input
                .ok_or_else(|| LabError::new("--in is required"))?,
            output: self.output.ok_or_else(|| LabError::new("-o is required"))?,
            geometer: self.geometer,
            model_dirs: self.model_dirs,
            refs: self.refs,
            prefixes: self.prefixes,
            exclude_prefixes: self.exclude_prefixes,
            exclude_refs: self.exclude_refs,
            chrome: self.chrome,
            pdf: self.pdf,
            theme: self.theme,
        })
    }
}

/// `VAR=DIR` as a model library.
fn model_dir(raw: &str) -> Result<(String, PathBuf), LabError> {
    let (variable, directory) = raw
        .split_once('=')
        .ok_or_else(|| LabError::new(format!("--model-dir is `VAR=DIR`, not {raw:?}")))?;
    Ok((variable.to_owned(), PathBuf::from(directory)))
}

fn list(raw: &str) -> Vec<String> {
    raw.split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect()
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
    fn the_defaults_select_the_connector_prefixes() {
        let options = parsed(&["--in", "b.prism", "-o", "out"]).expect("valid");
        assert_eq!(options.prefixes, ["J", "P", "CN", "X"]);
        assert!(options.refs.is_empty());
        assert!(options.pdf);
    }

    #[test]
    fn references_and_model_directories_parse() {
        let options = parsed(&[
            "--in",
            "b.prism",
            "-o",
            "out",
            "--refs",
            "J1, J2",
            "--model-dir",
            "KICAD9_3DMODEL_DIR=/models",
        ])
        .expect("valid");
        assert_eq!(options.refs, ["J1", "J2"]);
        assert_eq!(
            options.model_dirs.get("KICAD9_3DMODEL_DIR"),
            Some(&PathBuf::from("/models"))
        );
    }

    #[test]
    fn a_malformed_argument_is_an_error() {
        assert!(parsed(&["--in"]).is_err());
        assert!(parsed(&["--in", "b", "-o", "o", "--model-dir", "nope"]).is_err());
        assert!(parsed(&["--in", "b", "-o", "o", "--wat"]).is_err());
        assert!(parsed(&[]).is_err());
    }

    #[test]
    fn the_theme_parses_and_defaults_to_light() {
        assert_eq!(
            parsed(&["--in", "b", "-o", "o"]).expect("valid").theme,
            Theme::Light
        );
        assert_eq!(
            parsed(&["--in", "b", "-o", "o", "--theme", "blueprint"])
                .expect("valid")
                .theme,
            Theme::Blueprint
        );
        assert!(parsed(&["--in", "b", "-o", "o", "--theme", "sepia"]).is_err());
    }

    #[test]
    fn a_reference_becomes_a_safe_file_name() {
        assert_eq!(file_stem("J1"), "J1");
        assert_eq!(file_stem("J/1"), "J_1");
    }
}
