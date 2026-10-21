//! The streams of cli-spec.md §3: one stdout document, chosen by the exit
//! code, and JSON Lines diagnostics on stderr (`CliDiagnosticA0`, at most
//! 4096-byte messages, 64 KiB lines and `max-diagnostic-lines` lines).
//!
//! Every stdout document is validated against its JSON Schema before it is
//! written (`main.rs`), so a document that breaks its contract is an
//! internal error rather than a malformed output.

use crate::process;
use prism_bundle::finding::{Failure, Finding, LimitHit, Location};
use prism_bundle::limits::LimitUnit;
use prism_bundle::manifest::{json_bytes, location_json};
use serde_json::{Value, json};
use std::io::Write;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};

const MAX_MESSAGE_BYTES: usize = 4096;
const MAX_LINE_BYTES: usize = 64 * 1024;

/// Cut `message` to 4096 bytes at a character boundary, ending in `…`.
#[must_use]
pub fn cap_message(message: &str) -> String {
    if message.len() <= MAX_MESSAGE_BYTES {
        return message.to_owned();
    }
    let mut end = MAX_MESSAGE_BYTES - '…'.len_utf8();
    while !message.is_char_boundary(end) {
        end -= 1;
    }
    format!("{}…", &message[..end])
}

/// `CliLimitHit` JSON.
#[must_use]
pub fn limit_json(hit: &LimitHit) -> Value {
    let name = hit.name.as_str();
    match hit.name.unit() {
        LimitUnit::Bytes => {
            let mut value = json!({"kind": "bytes", "name": name, "limit_bytes": hit.limit});
            if let Some(observed) = hit.observed {
                value["observed_bytes"] = observed.into();
            }
            value
        }
        LimitUnit::Time => json!({"kind": "time", "name": name, "limit_ms": hit.limit}),
        LimitUnit::Count => {
            let mut value = json!({"kind": "count", "name": name, "limit_count": hit.limit});
            if let Some(observed) = hit.observed {
                value["observed_count"] = observed.into();
            }
            value
        }
    }
}

/// The `CliErrorA0` of `failure`.
#[must_use]
pub fn error_document(failure: &Failure, stage: Option<&str>) -> Value {
    let mut value = json!({
        "schema": "prism.cli.error.a0",
        "category": failure.category.as_str(),
        "code": failure.finding.code,
        "message": cap_message(&failure.finding.message),
    });
    if let Some(stage) = stage {
        value["stage"] = stage.into();
    }
    if let Some(argument) = failure.argument {
        value["argument"] = argument.into();
    }
    if let Some(location) = &failure.finding.location {
        value["location"] = location_json(location);
    }
    if let Some(limit) = &failure.limit {
        value["limit"] = limit_json(limit);
    }
    value
}

/// Severity of a diagnostic.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Severity {
    /// Progress.
    Info,
    /// A recorded warning.
    Warning,
    /// What fails the command, the stage or a member.
    Error,
}

impl Severity {
    fn as_str(self) -> &'static str {
        match self {
            Self::Info => "info",
            Self::Warning => "warning",
            Self::Error => "error",
        }
    }
}

/// A `CliDiagnosticA0` line.
pub struct Diagnostic<'a> {
    /// Severity.
    pub severity: Severity,
    /// Code.
    pub code: &'a str,
    /// Message.
    pub message: &'a str,
    /// Stage, for `bundle build`.
    pub stage: Option<&'a str>,
    /// Argument.
    pub argument: Option<&'a str>,
    /// Location.
    pub location: Option<&'a Location>,
    /// Limit.
    pub limit: Option<&'a LimitHit>,
}

/// The `CliDiagnosticA0` JSON of `diagnostic`.
#[must_use]
pub fn diagnostic_json(diagnostic: &Diagnostic<'_>) -> Value {
    let message = if diagnostic.message.is_empty() {
        diagnostic.code
    } else {
        diagnostic.message
    };
    let mut value = json!({
        "schema": "prism.cli.diagnostic.a0",
        "severity": diagnostic.severity.as_str(),
        "code": diagnostic.code,
        "message": cap_message(message),
    });
    if let Some(stage) = diagnostic.stage {
        value["stage"] = stage.into();
    }
    if let Some(argument) = diagnostic.argument {
        value["argument"] = argument.into();
    }
    if let Some(location) = diagnostic.location {
        value["location"] = location_json(location);
    }
    if let Some(limit) = diagnostic.limit {
        value["limit"] = limit_json(limit);
    }
    value
}

/// The stderr writer of one invocation.
pub struct Stderr {
    quiet: bool,
    max_lines: u64,
    written: AtomicU64,
    truncated: AtomicBool,
    stage: Mutex<Option<&'static str>>,
}

impl Stderr {
    /// A writer that drops `info` when `quiet`.
    #[must_use]
    pub fn new(quiet: bool, max_lines: u64) -> Self {
        Self {
            quiet,
            max_lines,
            written: AtomicU64::new(0),
            truncated: AtomicBool::new(false),
            stage: Mutex::new(None),
        }
    }

    /// Set the stage later lines carry.
    pub fn set_stage(&self, stage: Option<&'static str>) {
        if let Ok(mut slot) = self.stage.lock() {
            *slot = stage;
        }
    }

    fn stage(&self) -> Option<&'static str> {
        self.stage.lock().ok().and_then(|slot| *slot)
    }

    /// Write one line.
    pub fn emit(&self, diagnostic: &Diagnostic<'_>) {
        if self.quiet && diagnostic.severity == Severity::Info {
            return;
        }
        if self.truncated.load(Ordering::SeqCst) {
            return;
        }
        if self.written.fetch_add(1, Ordering::SeqCst) >= self.max_lines {
            self.truncated.store(true, Ordering::SeqCst);
            let line = diagnostic_json(&Diagnostic {
                severity: Severity::Warning,
                code: "diagnostics-truncated",
                message: "max-diagnostic-lines was reached; later diagnostics are dropped",
                stage: diagnostic.stage,
                argument: None,
                location: None,
                limit: None,
            });
            write_line(&line);
            return;
        }
        let mut line = diagnostic_json(diagnostic);
        if diagnostic.stage.is_none()
            && let Some(stage) = self.stage()
        {
            line["stage"] = stage.into();
        }
        write_line(&line);
    }

    /// An `error` line for `failure`.
    pub fn failure(&self, failure: &Failure) {
        self.emit(&Diagnostic {
            severity: Severity::Error,
            code: &failure.finding.code,
            message: &failure.finding.message,
            stage: None,
            argument: failure.argument,
            location: failure.finding.location.as_ref(),
            limit: failure.limit.as_ref(),
        });
    }

    /// A line for `finding` at `severity`.
    pub fn finding(&self, severity: Severity, finding: &Finding) {
        self.emit(&Diagnostic {
            severity,
            code: &finding.code,
            message: &finding.message,
            stage: None,
            argument: None,
            location: finding.location.as_ref(),
            limit: None,
        });
    }
}

fn write_line(value: &Value) {
    let value = &in_declaration_order(value).unwrap_or_else(|_| value.clone());
    let mut bytes = json_bytes(value);
    if bytes.len() > MAX_LINE_BYTES {
        let mut trimmed = value.clone();
        trimmed["message"] = Value::from("the diagnostic was longer than 64 KiB and was dropped");
        if let Some(object) = trimmed.as_object_mut() {
            object.remove("location");
        }
        bytes = json_bytes(&trimmed);
    }
    let _ = std::io::stderr().lock().write_all(&bytes);
}

impl prism_bundle::stages::Reporter for Stderr {
    fn info(&self, code: &str, message: &str) {
        self.emit(&Diagnostic {
            severity: Severity::Info,
            code,
            message,
            stage: None,
            argument: None,
            location: None,
            limit: None,
        });
    }

    fn warning(&self, finding: &Finding) {
        self.finding(Severity::Warning, finding);
    }

    fn error(&self, finding: &Finding) {
        self.finding(Severity::Error, finding);
    }
}

/// Write the one stdout document. Returns false when stdout failed.
pub fn stdout(value: &Value) -> bool {
    if !process::take_stdout() {
        return true;
    }
    let ordered = in_declaration_order(value).unwrap_or_else(|_| value.clone());
    let bytes = json_bytes(&ordered);
    let mut out = std::io::stdout().lock();
    out.write_all(&bytes).and_then(|()| out.flush()).is_ok()
}

fn retyped<T: serde::de::DeserializeOwned + serde::Serialize>(
    value: &Value,
) -> Result<Value, String> {
    let typed: T = serde_json::from_value(value.clone()).map_err(|error| error.to_string())?;
    serde_json::to_value(typed).map_err(|error| error.to_string())
}

/// `value` with its keys in the contract's declaration order: decoded into
/// its generated root type and encoded again (conventions.md §13).
pub fn in_declaration_order(value: &Value) -> Result<Value, String> {
    use prism_kicad_contracts::generated as contract;
    match value
        .get("schema")
        .and_then(Value::as_str)
        .unwrap_or_default()
    {
        "prism.cli.build_result.a0" => {
            retyped::<contract::prism_cli_build_result_a0::CliBuildResultA0>(value)
        }
        "prism.cli.verify_report.a0" => {
            retyped::<contract::prism_cli_verify_report_a0::CliVerifyReportA0>(value)
        }
        "prism.cli.extract_result.a0" => {
            retyped::<contract::prism_cli_extract_result_a0::CliExtractResultA0>(value)
        }
        "prism.cli.reuse_result.a0" => {
            retyped::<contract::prism_cli_reuse_result_a0::CliReuseResultA0>(value)
        }
        "prism.cli.error.a0" => retyped::<contract::prism_cli_error_a0::CliErrorA0>(value),
        "prism.cli.project_absent.a0" => {
            retyped::<contract::prism_cli_project_absent_a0::CliProjectAbsentA0>(value)
        }
        "prism.cli.diagnostic.a0" => {
            retyped::<contract::prism_cli_diagnostic_a0::CliDiagnosticA0>(value)
        }
        "prism.revision_key.record.a1" => {
            retyped::<contract::prism_revision_key_record_a1::RevisionKeyRecordA1>(value)
        }
        other => other_document(other, value),
    }
}

/// The stdout documents added with amendment C3's commands (vendor, stroke text, drawing sheet).
fn other_document(schema: &str, value: &Value) -> Result<Value, String> {
    use prism_kicad_contracts::generated as contract;
    match schema {
        "prism.cli.vendor_list.a0" => {
            retyped::<contract::prism_cli_vendor_list_a0::CliVendorListA0>(value)
        }
        "prism.cli.vendor_run_result.a0" => {
            retyped::<contract::prism_cli_vendor_run_result_a0::CliVendorRunResultA0>(value)
        }
        "prism.cli.stroke_text_result.a0" => {
            retyped::<contract::prism_cli_stroke_text_result_a0::CliStrokeTextResultA0>(value)
        }
        "prism.cli.stroke_font_metrics.a0" => {
            retyped::<contract::prism_cli_stroke_font_metrics_a0::CliStrokeFontMetricsA0>(value)
        }
        "prism.cli.drawing_sheet_result.a0" => {
            retyped::<contract::prism_cli_drawing_sheet_result_a0::CliDrawingSheetResultA0>(value)
        }
        "prism.cli.artwork_result.a0" => {
            retyped::<contract::prism_cli_artwork_result_a0::CliArtworkResultA0>(value)
        }
        other => Err(format!("{other} is not a prism-kicad stdout document")),
    }
}
