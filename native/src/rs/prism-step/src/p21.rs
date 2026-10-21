//! ISO 10303-21 ("Part 21") exchange structure parser: the HEADER and the DATA
//! section's entity instances, simple (`#1=NAME(...)`) and complex
//! (`#2=(A(...) B(...))`), with strings, enums, lists and typed values.
//!
//! Adapted from SolidCraft's `crates/kernel/src/step_in/p21.rs` (MIT OR
//! Apache-2.0, commit a0c1a67; see the repository's `NOTICE`). Input is
//! hostile: sizes, entity counts and nesting depth are capped and every error
//! is a message, never a panic.

use std::collections::BTreeMap;
use std::fmt;

/// Largest STEP text we parse.
pub const MAX_BYTES: usize = 512 << 20;
/// Most entity instances in one file.
pub const MAX_ENTITIES: usize = 20_000_000;
/// Deepest parameter list nesting.
const MAX_DEPTH: usize = 64;

/// A Part 21 parse error.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ParseError {
    /// The line the lexer stopped at, when it had read that far.
    pub line: Option<usize>,
    /// What went wrong.
    pub message: String,
}

impl fmt::Display for ParseError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self.line {
            Some(line) => write!(
                formatter,
                "STEP syntax error at line {line}: {}",
                self.message
            ),
            None => write!(formatter, "STEP error: {}", self.message),
        }
    }
}

impl std::error::Error for ParseError {}

/// A parameter value.
#[derive(Clone, Debug, PartialEq)]
pub enum Param {
    /// A whole number.
    Int(i64),
    /// A real number.
    Real(f64),
    /// A quoted string, with Part 21 escapes decoded.
    Str(String),
    /// `.NAME.` (`.T.`/`.F.` included).
    Enum(String),
    /// `#N`.
    Ref(u64),
    /// `(...)`.
    List(Vec<Param>),
    /// `NAME(params)` (a typed value such as `LENGTH_MEASURE(1.)`).
    Typed(String, Vec<Param>),
    /// `"..."`.
    Binary(String),
    /// `$`.
    Null,
    /// `*`.
    Derived,
}

impl Param {
    /// The number, if this is one (or a typed single number).
    #[must_use]
    pub fn as_f64(&self) -> Option<f64> {
        match self {
            Self::Real(value) => Some(*value).filter(|value| value.is_finite()),
            Self::Int(value) => Some(*value as f64),
            Self::Typed(_, values) if values.len() == 1 => values.first().and_then(Self::as_f64),
            _ => None,
        }
    }

    /// The integer, if this is a whole number (or a whole real).
    #[must_use]
    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Self::Int(value) => Some(*value),
            Self::Real(value) if value.fract() == 0.0 && value.abs() < 9e15 => Some(*value as i64),
            _ => None,
        }
    }

    /// The referenced entity id, if this is a reference.
    #[must_use]
    pub fn as_ref_id(&self) -> Option<u64> {
        match self {
            Self::Ref(id) => Some(*id),
            _ => None,
        }
    }

    /// The string, if this is one.
    #[must_use]
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Self::Str(value) => Some(value),
            _ => None,
        }
    }

    /// The enumeration name, if this is one.
    #[must_use]
    pub fn as_enum(&self) -> Option<&str> {
        match self {
            Self::Enum(value) => Some(value),
            _ => None,
        }
    }

    /// `.T.` → true, `.F.` → false (`.U.` and anything else → `None`).
    #[must_use]
    pub fn as_bool(&self) -> Option<bool> {
        match self.as_enum()? {
            "T" => Some(true),
            "F" => Some(false),
            _ => None,
        }
    }

    /// The list, if this is one.
    #[must_use]
    pub fn as_list(&self) -> Option<&[Self]> {
        match self {
            Self::List(values) => Some(values),
            _ => None,
        }
    }
}

/// One record of an entity instance: a simple instance has one, a complex one
/// several.
#[derive(Clone, Debug, PartialEq)]
pub struct Record {
    /// The record's keyword.
    pub name: String,
    /// Its parameters.
    pub params: Vec<Param>,
}

/// An entity instance.
#[derive(Clone, Debug, PartialEq)]
pub struct Entity {
    /// The records: one for a simple entity, several for a complex one.
    pub records: Vec<Record>,
}

impl Entity {
    /// Whether this is a complex instance.
    #[must_use]
    pub fn is_complex(&self) -> bool {
        self.records.len() > 1
    }

    /// The first record's name (a simple instance's only name).
    #[must_use]
    pub fn name(&self) -> &str {
        self.records
            .first()
            .map_or("", |record| record.name.as_str())
    }

    /// The parameters of the record called `name`.
    #[must_use]
    pub fn record(&self, name: &str) -> Option<&[Param]> {
        self.records
            .iter()
            .find(|record| record.name == name)
            .map(|record| record.params.as_slice())
    }

    /// Whether one of the records is called `name`.
    #[must_use]
    pub fn has(&self, name: &str) -> bool {
        self.records.iter().any(|record| record.name == name)
    }

    /// The first record's parameters (a simple instance's parameters).
    #[must_use]
    pub fn params(&self) -> &[Param] {
        self.records
            .first()
            .map_or(&[], |record| record.params.as_slice())
    }
}

/// A parsed exchange file's HEADER.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct Header {
    /// `FILE_DESCRIPTION`'s description strings.
    pub description: Vec<String>,
    /// `FILE_NAME`'s name.
    pub name: String,
    /// `FILE_NAME`'s time stamp.
    pub time_stamp: String,
    /// `FILE_NAME`'s authors.
    pub author: Vec<String>,
    /// `FILE_NAME`'s organizations.
    pub organization: Vec<String>,
    /// `FILE_NAME`'s preprocessor version.
    pub preprocessor: String,
    /// `FILE_NAME`'s originating system.
    pub originating_system: String,
    /// `FILE_NAME`'s authorization.
    pub authorization: String,
    /// `FILE_SCHEMA`'s schema names.
    pub schemas: Vec<String>,
}

/// A parsed exchange file.
#[derive(Clone, Debug, Default)]
pub struct File {
    /// The HEADER.
    pub header: Header,
    /// Entity instances by id.
    pub entities: BTreeMap<u64, Entity>,
    /// Ids defined more than once (the first definition is kept).
    pub duplicates: Vec<u64>,
}

impl File {
    /// An entity by id.
    #[must_use]
    pub fn get(&self, id: u64) -> Option<&Entity> {
        self.entities.get(&id)
    }
}

fn error<T>(message: impl Into<String>) -> Result<T, ParseError> {
    Err(ParseError {
        line: None,
        message: message.into(),
    })
}

struct Lexer<'a> {
    text: &'a [u8],
    at: usize,
}

impl<'a> Lexer<'a> {
    fn new(text: &'a str) -> Self {
        Self {
            text: text.as_bytes(),
            at: 0,
        }
    }

    fn line(&self) -> usize {
        self.text.get(..self.at).map_or(0, |bytes| {
            bytes.iter().filter(|byte| **byte == b'\n').count() + 1
        })
    }

    fn fail<T>(&self, message: &str) -> Result<T, ParseError> {
        Err(ParseError {
            line: Some(self.line()),
            message: message.to_owned(),
        })
    }

    fn peek(&self) -> Option<u8> {
        self.text.get(self.at).copied()
    }

    /// Skip whitespace and comments.
    fn skip(&mut self) -> Result<(), ParseError> {
        loop {
            match self.peek() {
                Some(byte) if byte.is_ascii_whitespace() => self.at += 1,
                Some(b'/') if self.text.get(self.at + 1) == Some(&b'*') => {
                    let rest = self.text.get(self.at + 2..).unwrap_or(&[]);
                    match rest.windows(2).position(|window| window == b"*/") {
                        Some(found) => self.at += found + 4,
                        None => return self.fail("unterminated comment"),
                    }
                }
                _ => return Ok(()),
            }
        }
    }

    fn eat(&mut self, byte: u8) -> Result<bool, ParseError> {
        self.skip()?;
        if self.peek() == Some(byte) {
            self.at += 1;
            Ok(true)
        } else {
            Ok(false)
        }
    }

    fn expect(&mut self, byte: u8) -> Result<(), ParseError> {
        if self.eat(byte)? {
            Ok(())
        } else {
            self.fail(&format!("expected `{}`", byte as char))
        }
    }

    fn keyword(&mut self) -> Result<String, ParseError> {
        self.skip()?;
        let start = self.at;
        if self.peek() == Some(b'!') {
            self.at += 1;
        }
        while let Some(byte) = self.peek() {
            if byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-' {
                self.at += 1;
            } else {
                break;
            }
        }
        if self.at == start {
            return self.fail("expected a keyword");
        }
        Ok(self.slice(start, self.at).to_ascii_uppercase())
    }

    fn slice(&self, start: usize, end: usize) -> String {
        String::from_utf8_lossy(self.text.get(start..end).unwrap_or(&[])).into_owned()
    }

    fn number(&mut self) -> Result<Param, ParseError> {
        let start = self.at;
        while let Some(byte) = self.peek() {
            if byte.is_ascii_digit() || matches!(byte, b'+' | b'-' | b'.' | b'E' | b'e') {
                self.at += 1;
            } else {
                break;
            }
        }
        let text = self.slice(start, self.at);
        if !text.contains(['.', 'E', 'e'])
            && let Ok(value) = text.parse::<i64>()
        {
            return Ok(Param::Int(value));
        }
        // STEP allows `1.` and `1.E-3`.
        let fixed = text.replace(".E", ".0E").replace(".e", ".0e");
        let fixed = if fixed.ends_with('.') {
            format!("{fixed}0")
        } else {
            fixed
        };
        match fixed.parse::<f64>() {
            Ok(value) => Ok(Param::Real(value)),
            Err(_) => self.fail(&format!("bad number `{text}`")),
        }
    }

    fn string(&mut self) -> Result<String, ParseError> {
        // The opening quote is consumed by the caller.
        let mut raw = Vec::new();
        loop {
            match self.peek() {
                None => return self.fail("unterminated string"),
                Some(b'\'') => {
                    if self.text.get(self.at + 1) == Some(&b'\'') {
                        raw.push(b'\'');
                        self.at += 2;
                    } else {
                        self.at += 1;
                        break;
                    }
                }
                Some(b'\n' | b'\r') => self.at += 1,
                Some(byte) => {
                    raw.push(byte);
                    self.at += 1;
                }
            }
        }
        Ok(decode_string(&raw))
    }

    fn binary(&mut self) -> Result<Param, ParseError> {
        self.at += 1;
        let start = self.at;
        while self.peek().is_some_and(|byte| byte != b'"') {
            self.at += 1;
        }
        let value = self.slice(start, self.at);
        self.expect(b'"')?;
        Ok(Param::Binary(value))
    }

    fn reference(&mut self) -> Result<Param, ParseError> {
        self.at += 1;
        let start = self.at;
        while self.peek().is_some_and(|byte| byte.is_ascii_digit()) {
            self.at += 1;
        }
        self.slice(start, self.at)
            .parse::<u64>()
            .map(Param::Ref)
            .map_err(|_| ParseError {
                line: Some(self.line()),
                message: "bad entity reference".to_owned(),
            })
    }

    fn enumeration(&mut self) -> Result<Param, ParseError> {
        self.at += 1;
        let start = self.at;
        while self.peek().is_some_and(|byte| byte != b'.') {
            self.at += 1;
        }
        let value = self.slice(start, self.at).trim().to_ascii_uppercase();
        self.expect(b'.')?;
        Ok(Param::Enum(value))
    }

    fn typed(&mut self, depth: usize) -> Result<Param, ParseError> {
        let name = self.keyword()?;
        self.expect(b'(')?;
        Ok(Param::Typed(name, self.list_rest(depth + 1)?))
    }

    fn param(&mut self, depth: usize) -> Result<Param, ParseError> {
        if depth > MAX_DEPTH {
            return self.fail("parameters nested too deeply");
        }
        self.skip()?;
        let Some(byte) = self.peek() else {
            return self.fail("unexpected end of file");
        };
        match byte {
            b'$' | b'*' => {
                self.at += 1;
                Ok(if byte == b'$' {
                    Param::Null
                } else {
                    Param::Derived
                })
            }
            b'\'' => {
                self.at += 1;
                Ok(Param::Str(self.string()?))
            }
            b'"' => self.binary(),
            b'#' => self.reference(),
            other => self.complex_param(other, depth),
        }
    }

    fn complex_param(&mut self, byte: u8, depth: usize) -> Result<Param, ParseError> {
        match byte {
            b'.' => {
                let enumeration = self
                    .text
                    .get(self.at + 1)
                    .is_some_and(|next| next.is_ascii_alphabetic() || *next == b'_');
                if enumeration {
                    self.enumeration()
                } else {
                    self.number()
                }
            }
            b'(' => {
                self.at += 1;
                Ok(Param::List(self.list_rest(depth + 1)?))
            }
            digit if digit.is_ascii_digit() || matches!(digit, b'+' | b'-') => self.number(),
            letter if letter.is_ascii_alphabetic() || letter == b'!' => self.typed(depth),
            other => self.fail(&format!("unexpected `{}`", other as char)),
        }
    }

    /// Parameters after an opening `(` up to and including the `)`.
    fn list_rest(&mut self, depth: usize) -> Result<Vec<Param>, ParseError> {
        let mut values = Vec::new();
        if self.eat(b')')? {
            return Ok(values);
        }
        loop {
            values.push(self.param(depth)?);
            if self.eat(b',')? {
                continue;
            }
            self.expect(b')')?;
            return Ok(values);
        }
    }

    fn record(&mut self) -> Result<Record, ParseError> {
        let name = self.keyword()?;
        self.expect(b'(')?;
        Ok(Record {
            name,
            params: self.list_rest(1)?,
        })
    }

    /// The bytes after the current position, for skipping an unknown section.
    fn rest(&self) -> &[u8] {
        self.text.get(self.at..).unwrap_or(&[])
    }
}

/// Decode the Part 21 string escapes (`\X\hh`, `\X2\…\X0\`, `\X4\…\X0\`,
/// `\S\c`, `\\`).
fn decode_string(raw: &[u8]) -> String {
    let mut out = String::new();
    let mut at = 0;
    while let Some(&byte) = raw.get(at) {
        if byte == b'\\' {
            if let Some((decoded, used)) = decode_escape(&raw[at..]) {
                out.push_str(&decoded);
                at += used;
            } else {
                out.push('\\');
                at += 1;
            }
            continue;
        }
        let start = at;
        while raw.get(at).is_some_and(|byte| *byte != b'\\') {
            at += 1;
        }
        out.push_str(&String::from_utf8_lossy(raw.get(start..at).unwrap_or(&[])));
    }
    out
}

fn hex(text: &[u8]) -> Option<u32> {
    std::str::from_utf8(text)
        .ok()
        .and_then(|text| u32::from_str_radix(text, 16).ok())
}

/// One escape at the start of `rest`: its decoded text and the bytes used.
fn decode_escape(rest: &[u8]) -> Option<(String, usize)> {
    if rest.starts_with(b"\\\\") {
        return Some(("\\".to_owned(), 2));
    }
    if rest.starts_with(b"\\X\\")
        && let Some(value) = rest.get(3..5).and_then(hex)
    {
        return Some((char::from_u32(value).unwrap_or('?').to_string(), 5));
    }
    if let Some(found) = decode_run(rest, b"\\X2\\", 4) {
        return Some(found);
    }
    if let Some(found) = decode_run(rest, b"\\X4\\", 8) {
        return Some(found);
    }
    if rest.starts_with(b"\\S\\")
        && let Some(&byte) = rest.get(3)
    {
        return Some((
            char::from_u32(u32::from(byte) + 128)
                .unwrap_or('?')
                .to_string(),
            4,
        ));
    }
    None
}

/// A `\X2\`/`\X4\` run up to `\X0\`.
fn decode_run(rest: &[u8], tag: &[u8], width: usize) -> Option<(String, usize)> {
    if !rest.starts_with(tag) {
        return None;
    }
    let end = rest.windows(4).position(|window| window == b"\\X0\\")?;
    let body = rest.get(tag.len()..end).unwrap_or(&[]);
    let units: Vec<u32> = body.chunks(width).filter_map(hex).collect();
    let decoded = if width == 4 {
        let units: Vec<u16> = units.iter().map(|unit| *unit as u16).collect();
        String::from_utf16_lossy(&units)
    } else {
        units
            .iter()
            .map(|unit| char::from_u32(*unit).unwrap_or('?'))
            .collect()
    };
    Some((decoded, end + 4))
}

/// Parse a Part 21 file.
pub fn parse(text: &str) -> Result<File, ParseError> {
    if text.len() > MAX_BYTES {
        return error(format!(
            "STEP file too large ({} MB, limit {} MB)",
            text.len() >> 20,
            MAX_BYTES >> 20
        ));
    }
    let mut lexer = Lexer::new(text);
    let magic = lexer.keyword()?;
    if magic != "ISO-10303-21" {
        return error("not a STEP file (no ISO-10303-21 header)");
    }
    lexer.expect(b';')?;
    let mut file = File::default();
    loop {
        lexer.skip()?;
        if lexer.peek().is_none() {
            return error("STEP file ends without END-ISO-10303-21");
        }
        let keyword = lexer.keyword()?;
        match keyword.as_str() {
            "HEADER" => {
                lexer.expect(b';')?;
                parse_header(&mut lexer, &mut file.header)?;
            }
            "DATA" => parse_data(&mut lexer, &mut file)?,
            "END-ISO-10303-21" => {
                lexer.expect(b';')?;
                return Ok(file);
            }
            "ANCHOR" | "REFERENCE" | "SIGNATURE" => skip_section(&mut lexer)?,
            other => return lexer.fail(&format!("unexpected `{other}`")),
        }
    }
}

fn parse_header(lexer: &mut Lexer<'_>, header: &mut Header) -> Result<(), ParseError> {
    loop {
        let keyword = lexer.keyword()?;
        if keyword == "ENDSEC" {
            lexer.expect(b';')?;
            return Ok(());
        }
        lexer.expect(b'(')?;
        let params = lexer.list_rest(1)?;
        lexer.expect(b';')?;
        match keyword.as_str() {
            "FILE_DESCRIPTION" => {
                header.description = params
                    .first()
                    .and_then(Param::as_list)
                    .map(strings)
                    .unwrap_or_default();
            }
            "FILE_NAME" => {
                header.name = string_at(&params, 0);
                header.time_stamp = string_at(&params, 1);
                header.author = list_at(&params, 2);
                header.organization = list_at(&params, 3);
                header.preprocessor = string_at(&params, 4);
                header.originating_system = string_at(&params, 5);
                header.authorization = string_at(&params, 6);
            }
            "FILE_SCHEMA" => {
                header.schemas = params
                    .first()
                    .and_then(Param::as_list)
                    .map(strings)
                    .unwrap_or_default();
            }
            _ => {}
        }
    }
}

fn strings(values: &[Param]) -> Vec<String> {
    values
        .iter()
        .filter_map(|value| value.as_str().map(str::to_owned))
        .collect()
}

fn string_at(params: &[Param], index: usize) -> String {
    params
        .get(index)
        .and_then(Param::as_str)
        .unwrap_or_default()
        .to_owned()
}

fn list_at(params: &[Param], index: usize) -> Vec<String> {
    params
        .get(index)
        .and_then(Param::as_list)
        .map(strings)
        .unwrap_or_default()
}

fn parse_data(lexer: &mut Lexer<'_>, file: &mut File) -> Result<(), ParseError> {
    // Optional `DATA('name', ('schema'));`.
    if lexer.eat(b'(')? {
        lexer.list_rest(1)?;
    }
    lexer.expect(b';')?;
    loop {
        lexer.skip()?;
        if lexer.peek() != Some(b'#') {
            let keyword = lexer.keyword()?;
            if keyword == "ENDSEC" {
                lexer.expect(b';')?;
                return Ok(());
            }
            return lexer.fail(&format!("unexpected `{keyword}` in DATA"));
        }
        let id = entity_id(lexer)?;
        lexer.expect(b'=')?;
        let records = records(lexer)?;
        lexer.expect(b';')?;
        insert(file, id, records)?;
    }
}

fn entity_id(lexer: &mut Lexer<'_>) -> Result<u64, ParseError> {
    lexer.at += 1;
    let start = lexer.at;
    while lexer.peek().is_some_and(|byte| byte.is_ascii_digit()) {
        lexer.at += 1;
    }
    lexer
        .slice(start, lexer.at)
        .parse::<u64>()
        .map_err(|_| ParseError {
            line: Some(lexer.line()),
            message: "bad entity id".to_owned(),
        })
}

fn records(lexer: &mut Lexer<'_>) -> Result<Vec<Record>, ParseError> {
    if !lexer.eat(b'(')? {
        return Ok(vec![lexer.record()?]);
    }
    let mut records = Vec::new();
    while !lexer.eat(b')')? {
        if records.len() > 64 {
            return lexer.fail("complex entity with too many parts");
        }
        records.push(lexer.record()?);
    }
    Ok(records)
}

fn insert(file: &mut File, id: u64, records: Vec<Record>) -> Result<(), ParseError> {
    if file.entities.len() >= MAX_ENTITIES {
        return error(format!("STEP file has more than {MAX_ENTITIES} entities"));
    }
    match file.entities.entry(id) {
        std::collections::btree_map::Entry::Occupied(_) => file.duplicates.push(id),
        std::collections::btree_map::Entry::Vacant(entry) => {
            entry.insert(Entity { records });
        }
    }
    Ok(())
}

/// Skip an edition-3 section up to `ENDSEC;`.
fn skip_section(lexer: &mut Lexer<'_>) -> Result<(), ParseError> {
    let rest = lexer.rest();
    match rest.windows(7).position(|window| window == b"ENDSEC;") {
        Some(found) => {
            lexer.at += found + 7;
            Ok(())
        }
        None => lexer.fail("unterminated section"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SMALL: &str = "ISO-10303-21;\nHEADER;FILE_DESCRIPTION((''),'2;1');\nFILE_NAME('a','',(''),(''),'','sys','');\nFILE_SCHEMA(('AUTOMOTIVE_DESIGN'));ENDSEC;\nDATA;\n#1=CARTESIAN_POINT('p',(0.,1.5E1,-2));\n/* c */ #2=(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.));\n#3=X('it''s','\\X2\\00E9\\X0\\',$,#1,LENGTH_MEASURE(1.E-3),\"0F\");\nENDSEC;\nEND-ISO-10303-21;\n";

    #[test]
    fn parses_simple_and_complex() {
        let file = parse(SMALL).unwrap();
        assert_eq!(file.header.schemas, vec!["AUTOMOTIVE_DESIGN"]);
        assert_eq!(file.header.originating_system, "sys");
        let point = file.get(1).unwrap();
        assert_eq!(point.name(), "CARTESIAN_POINT");
        let xyz: Vec<f64> = point.params()[1]
            .as_list()
            .unwrap()
            .iter()
            .filter_map(Param::as_f64)
            .collect();
        assert_eq!(xyz, vec![0.0, 15.0, -2.0]);
        let unit = file.get(2).unwrap();
        assert!(unit.is_complex() && unit.has("SI_UNIT"));
        assert_eq!(unit.record("SI_UNIT").unwrap()[0].as_enum(), Some("MILLI"));
        let values = file.get(3).unwrap().params();
        assert_eq!(values[0].as_str(), Some("it's"));
        assert_eq!(values[1].as_str(), Some("\u{e9}"));
        assert_eq!(values[2], Param::Null);
        assert_eq!(values[3].as_ref_id(), Some(1));
        assert_eq!(values[4].as_f64(), Some(1e-3));
        assert_eq!(values[5], Param::Binary("0F".to_owned()));
    }

    #[test]
    fn hostile_text_is_an_error() {
        for text in [
            "",
            "garbage",
            "ISO-10303-21;",
            "ISO-10303-21;DATA;#1=A(",
            "ISO-10303-21;DATA;#1=A('x",
            "ISO-10303-21;DATA;#1=A(/*",
            "ISO-10303-21;DATA;#=A();ENDSEC;END-ISO-10303-21;",
            "ISO-10303-21;DATA;#99999999999999999999999=A();ENDSEC;END-ISO-10303-21;",
            "ISO-10303-21;DATA;#1=A(1e999999.);ENDSEC;END-ISO-10303-21;",
        ] {
            assert!(parse(text).is_err(), "{text:?} is rejected");
        }
        let deep = format!(
            "ISO-10303-21;DATA;#1=A({}{});ENDSEC;END-ISO-10303-21;",
            "(".repeat(10_000),
            ")".repeat(10_000)
        );
        assert!(parse(&deep).is_err());
        let duplicate = parse("ISO-10303-21;DATA;#1=A(1);#1=B();ENDSEC;END-ISO-10303-21;")
            .expect("duplicates are tolerated");
        assert_eq!(duplicate.duplicates, vec![1]);
        assert_eq!(duplicate.get(1).unwrap().name(), "A");
    }

    #[test]
    fn accepts_numbers_with_a_leading_dot() {
        let file = parse("ISO-10303-21;DATA;#1=A(.5,-.25,1.E-3);ENDSEC;END-ISO-10303-21;")
            .expect("the numbers parse");
        let values = file.get(1).unwrap().params();
        assert_eq!(values[0].as_f64(), Some(0.5));
        assert_eq!(values[1].as_f64(), Some(-0.25));
        assert_eq!(values[2].as_f64(), Some(1e-3));
    }

    #[test]
    fn decodes_part_21_strings() {
        assert_eq!(decode_string(b"\\X\\E9"), "\u{e9}");
        assert_eq!(decode_string(b"a\\X2\\00E900E8\\X0\\b"), "a\u{e9}\u{e8}b");
        assert_eq!(decode_string(b"\\"), "\\");
        assert_eq!(
            decode_string(b"\\X2\\5706\\X0\\\\X2\\89D2\\X0\\20"),
            "\u{5706}\u{89d2}20"
        );
        assert_eq!(
            decode_string(b"\\X4\\0001F600\\X0\\\\X2\\00E9\\X0\\\\S\\a"),
            "\u{1f600}\u{e9}\u{e1}"
        );
    }
}
