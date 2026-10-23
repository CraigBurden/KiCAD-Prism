//! One streaming pass over a KiCad s-expression source before the core reads
//! it (cli-spec.md §5.2.2): UTF-8 (`source-not-utf8`), balanced syntax
//! (`source-unparseable`, with the core's own message and position), the
//! CLI's parser limits (`max-sexpr-depth`, `max-sexpr-nodes`,
//! `max-sexpr-string-bytes`, exit 4), the file format version
//! (`source-format-unsupported` when newer than the worker KiCad's) and, for
//! schematics, the sheet references of the top-level `(sheet …)` forms.
//!
//! The pass allocates nothing per token, so a large board costs one scan.

use crate::finding::{Failure, Finding, Location};
use crate::limits::{LimitName, Limits};
use prism_kicad_core::sexpr::{self, Lexer, TokenKind};

/// The newest schematic format KiCad 10.0.6 writes (`(version …)`):
/// `generator.kicad_file_formats.schematic`.
pub const SCHEMATIC_FORMAT: u64 = 20_260_306;
/// The newest board format KiCad 10.0.6 writes:
/// `generator.kicad_file_formats.board`.
pub const BOARD_FORMAT: u64 = 20_260_206;

/// A `Sheetfile` reference of a top-level sheet.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SheetReference {
    /// The value, unescaped, as written.
    pub file: String,
    /// Byte offset of the value in the file.
    pub offset: usize,
}

/// What the pass found.
#[derive(Clone, Debug, Default)]
pub struct Scanned {
    /// `(version N)` of the root.
    pub version: Option<u64>,
    /// The sheet references, in file order (schematics only).
    pub sheets: Vec<SheetReference>,
}

/// A failure of the pass.
#[derive(Clone, Debug)]
pub enum CheckError {
    /// A recorded content failure.
    Content(Finding),
    /// A limit (exit 4).
    Limit(Failure),
}

/// Undo KiCad's string escapes of a quoted lexeme.
#[must_use]
pub fn unquote(lexeme: &str) -> String {
    let body = lexeme
        .strip_prefix('"')
        .and_then(|rest| rest.strip_suffix('"'))
        .unwrap_or(lexeme);
    let mut text = String::with_capacity(body.len());
    let mut chars = body.chars();
    while let Some(ch) = chars.next() {
        let value = if ch == '\\' {
            match chars.next() {
                Some('n') => '\n',
                Some('t') => '\t',
                Some('r') => '\r',
                Some(other) => other,
                None => '\\',
            }
        } else {
            ch
        };
        text.push(value);
    }
    text
}

fn location(member: &str, position: sexpr::Position) -> Location {
    let wide = |value: usize| u64::try_from(value).unwrap_or(u64::MAX);
    Location::text(
        member,
        wide(position.line),
        wide(position.column),
        wide(position.offset),
    )
}

/// The core's diagnostic for a malformed source.
fn syntax_error(member: &str, text: &str) -> Finding {
    let limits = sexpr::Limits {
        max_source_bytes: usize::MAX,
        max_depth: usize::MAX,
        max_nodes: usize::MAX,
        max_decoded_string_bytes: usize::MAX,
    };
    match sexpr::parse_with_limits(text, limits) {
        Err(error) => {
            let finding = Finding::new("source-unparseable", error.message.to_string());
            match error.position {
                Some(position) => finding.at(location(member, position)),
                None => finding.at_path(member),
            }
        }
        Ok(_) => Finding::new(
            "source-unparseable",
            "the file is not one KiCad s-expression",
        )
        .at_path(member),
    }
}

/// Validate `bytes` as UTF-8, naming the first bad byte.
pub fn utf8<'a>(member: &str, bytes: &'a [u8]) -> Result<&'a str, Finding> {
    sexpr::utf8_text(bytes).map_err(|error| {
        let finding = Finding::new("source-not-utf8", format!("{member} is not UTF-8 text"));
        match error.position {
            Some(position) => finding.at(location(member, position)),
            None => finding.at_path(member),
        }
    })
}

struct Pass<'a> {
    member: &'a str,
    limits: &'a Limits,
    want_sheets: bool,
    depth: usize,
    nodes: u64,
    heads: Vec<Option<&'a str>>,
    first_args: Vec<Option<String>>,
    sheet_seen: bool,
    pending_version: bool,
    scanned: Scanned,
}

impl<'a> Pass<'a> {
    fn limit(&self, name: LimitName, what: &str) -> CheckError {
        CheckError::Limit(
            self.limits
                .exceeded(name, None, &format!("{} {what}", self.member))
                .at_path(self.member.to_owned()),
        )
    }

    fn open(&mut self) -> Result<(), CheckError> {
        if u64::try_from(self.depth).unwrap_or(u64::MAX) > self.limits.get(LimitName::MaxSexprDepth)
        {
            return Err(self.limit(LimitName::MaxSexprDepth, "nests lists too deeply"));
        }
        if self.depth == 1 {
            self.sheet_seen = false;
        }
        self.depth += 1;
        self.heads.push(None);
        self.first_args.push(None);
        Ok(())
    }

    fn atom(&mut self, kind: TokenKind, lexeme: &'a str, offset: usize) -> Result<(), CheckError> {
        if kind == TokenKind::QuotedString {
            let bound = self.limits.get_usize(LimitName::MaxSexprStringBytes);
            if lexeme.len().saturating_sub(2) > bound && unquote(lexeme).len() > bound {
                return Err(self.limit(
                    LimitName::MaxSexprStringBytes,
                    "holds a string that is too long",
                ));
            }
        }
        let Some(head) = self.heads.last_mut() else {
            return Ok(());
        };
        if head.is_none() {
            *head = Some(lexeme);
            self.pending_version = self.depth == 2 && lexeme == "version";
            return Ok(());
        }
        if self.pending_version && kind == TokenKind::Integer {
            self.scanned.version = lexeme.parse().ok();
            self.pending_version = false;
        }
        self.sheet_property(kind, lexeme, offset);
        Ok(())
    }

    /// `(sheet … (property "Sheetfile" "<file>" …))`, the first per sheet.
    fn in_sheet_property(&self) -> bool {
        let heads = [
            self.heads.get(1).copied().flatten(),
            self.heads.get(2).copied().flatten(),
        ];
        [
            self.want_sheets,
            self.depth == 3,
            heads == [Some("sheet"), Some("property")],
            !self.sheet_seen,
        ]
        .iter()
        .all(|holds| *holds)
    }

    fn set_first_arg(&mut self, value: String) {
        if let Some(arg) = self.first_args.last_mut() {
            *arg = Some(value);
        }
    }

    fn sheet_property(&mut self, kind: TokenKind, lexeme: &str, offset: usize) {
        if !self.in_sheet_property() {
            return;
        }
        let value = if kind == TokenKind::QuotedString {
            unquote(lexeme)
        } else {
            lexeme.to_owned()
        };
        let Some(key) = self.first_args.last_mut().and_then(Option::take) else {
            self.set_first_arg(value);
            return;
        };
        if matches!(key.as_str(), "Sheetfile" | "Sheet file") {
            self.scanned.sheets.push(SheetReference {
                file: value,
                offset,
            });
            self.sheet_seen = true;
        }
        // Only the first two arguments matter; mark the property done.
        self.set_first_arg(String::from("\u{0}done"));
    }
}

/// Check `bytes` of the source named `member` (`sources/<path>`), a board
/// when `format` is [`BOARD_FORMAT`] and a schematic when it is
/// [`SCHEMATIC_FORMAT`].
pub fn check(
    member: &str,
    bytes: &[u8],
    format: u64,
    limits: &Limits,
) -> Result<Scanned, CheckError> {
    let text = utf8(member, bytes).map_err(CheckError::Content)?;
    let mut pass = Pass {
        member,
        limits,
        want_sheets: format == SCHEMATIC_FORMAT,
        depth: 0,
        nodes: 0,
        heads: Vec::new(),
        first_args: Vec::new(),
        sheet_seen: false,
        pending_version: false,
        scanned: Scanned::default(),
    };
    let mut shape = Shape::default();
    for token in Lexer::new(text) {
        let token = token.map_err(|_| CheckError::Content(syntax_error(member, text)))?;
        if !pass.token(&token, &mut shape)? {
            return Err(CheckError::Content(syntax_error(member, text)));
        }
    }
    if pass.depth != 0 || shape.roots == 0 {
        return Err(CheckError::Content(syntax_error(member, text)));
    }
    check_format(member, pass.scanned.version, shape.version_at, format)?;
    Ok(pass.scanned)
}

/// Root lists seen, and where the root's `(version N)` value is.
#[derive(Default)]
struct Shape {
    roots: usize,
    version_at: Option<sexpr::Position>,
}

impl<'a> Pass<'a> {
    /// Take one token; `Ok(false)` when it breaks the one-root syntax.
    fn token(&mut self, token: &sexpr::Token<'a>, shape: &mut Shape) -> Result<bool, CheckError> {
        self.nodes += 1;
        if self.nodes > self.limits.get(LimitName::MaxSexprNodes) {
            return Err(self.limit(LimitName::MaxSexprNodes, "has too many s-expression nodes"));
        }
        match token.kind {
            TokenKind::Left => {
                shape.roots += usize::from(self.depth == 0);
                if shape.roots > 1 {
                    return Ok(false);
                }
                self.open()?;
            }
            TokenKind::Right if self.depth == 0 => return Ok(false),
            TokenKind::Right => self.close(),
            _ if self.depth == 0 => return Ok(false),
            kind => {
                let version = self.depth == 2 && self.pending_version && kind == TokenKind::Integer;
                if version {
                    shape.version_at = Some(token.position);
                }
                self.atom(kind, token.lexeme, token.position.offset)?;
            }
        }
        Ok(true)
    }

    fn close(&mut self) {
        self.depth -= 1;
        self.heads.pop();
        self.first_args.pop();
        self.pending_version = false;
    }
}

fn check_format(
    member: &str,
    version: Option<u64>,
    at: Option<sexpr::Position>,
    format: u64,
) -> Result<(), CheckError> {
    let (Some(version), Some(at)) = (version, at) else {
        return Ok(());
    };
    if version <= format {
        return Ok(());
    }
    Err(CheckError::Content(
        Finding::new(
            "source-format-unsupported",
            format!(
                "{member} has file format version {version}, newer than {format}, the newest this generator's KiCad writes"
            ),
        )
        .at(location(member, at)),
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::limits::Work;

    fn run(text: &str) -> Result<Scanned, CheckError> {
        check(
            "sources/x.kicad_sch",
            text.as_bytes(),
            SCHEMATIC_FORMAT,
            &Limits::defaults(Work::Parse),
        )
    }

    #[test]
    fn finds_versions_and_top_level_sheet_files() {
        let scanned = run(concat!(
            "(kicad_sch (version 20250114)\n",
            " (symbol (property \"Sheetfile\" \"no.kicad_sch\"))\n",
            " (sheet (at 1 2) (property \"Sheetname\" \"P\") (property \"Sheetfile\" \"sub/p.kicad_sch\")\n",
            "   (property \"Sheetfile\" \"second.kicad_sch\"))\n",
            " (sheet (property \"Sheet file\" \"esc\\\\aped.kicad_sch\")))\n"
        ))
        .unwrap();
        assert_eq!(scanned.version, Some(20_250_114));
        let files: Vec<&str> = scanned
            .sheets
            .iter()
            .map(|sheet| sheet.file.as_str())
            .collect();
        assert_eq!(files, ["sub/p.kicad_sch", "esc\\aped.kicad_sch"]);
    }

    #[test]
    fn reports_syntax_format_and_limits() {
        let Err(CheckError::Content(finding)) = run("(kicad_sch (version 1)") else {
            panic!("unbalanced text passed");
        };
        assert_eq!(finding.code, "source-unparseable");
        let Err(CheckError::Content(finding)) = run("(kicad_sch (version 20990101))") else {
            panic!("a newer format passed");
        };
        assert_eq!(finding.code, "source-format-unsupported");
        assert_eq!(finding.location.unwrap().column, Some(21));
        let mut limits = Limits::defaults(Work::Parse);
        limits.set(LimitName::MaxSexprDepth, 1);
        let deep = check(
            "sources/x.kicad_sch",
            b"(a (b (c)))",
            SCHEMATIC_FORMAT,
            &limits,
        );
        assert!(
            matches!(deep, Err(CheckError::Limit(failure)) if failure.limit.unwrap().name == LimitName::MaxSexprDepth)
        );
        let Err(CheckError::Content(finding)) = check(
            "sources/x.kicad_sch",
            b"(a \xff)",
            SCHEMATIC_FORMAT,
            &limits,
        ) else {
            panic!("bad UTF-8 passed");
        };
        assert_eq!(finding.code, "source-not-utf8");
    }
}
