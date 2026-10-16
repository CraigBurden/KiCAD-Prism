//! The quote-aware S-expression scanner for catalog forms, a port of
//! `backend/app/services/variant_source_scan.py` (the whole module).
//!
//! Quoted spans are masked once, retaining byte offsets; C-level searches and
//! counts skip large numeric board payloads; only variant and sheet-link forms
//! are visited. Quoted strings and escaped quotes never confuse the form walk,
//! and an unreadable or unbalanced source is reported, never guessed at.

/// `SourceRecords` (`variant_source_scan.py:23-29`): what one source file said.
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub(super) struct SourceRecords {
    /// `(name, description)` of each board `(variants …)` header variant.
    pub header: Vec<(String, Option<String>)>,
    /// Variant names, in file order.
    pub names: Vec<String>,
    /// `Sheetfile` property values of `(sheet …)` forms, in file order.
    pub sheets: Vec<String>,
    /// False when the text is not one balanced KiCad root form.
    pub readable: bool,
}

impl SourceRecords {
    /// The fast path (`variant_source_scan.py:44-45`): readable, nothing found.
    fn empty() -> Self {
        Self {
            readable: true,
            ..Self::default()
        }
    }

    /// `scan_source`'s `except (ValueError, IndexError)` result (:48-49).
    fn unreadable() -> Self {
        Self::default()
    }
}

/// `scan_source(text, root)` (`variant_source_scan.py:40-49`): the catalog
/// forms of one board (`root` = `"kicad_pcb"`) or schematic (`"kicad_sch"`).
pub(super) fn scan(text: &str, root: &str) -> SourceRecords {
    // Metadata discovery, not whole-file validation: without variant forms or
    // possible sheet links there is nothing to extract.
    if !has_relevant_form(text) && (root != "kicad_sch" || !text.contains("Sheetfile")) {
        return SourceRecords::empty();
    }
    scan_structural(text, root).unwrap_or_else(SourceRecords::unreadable)
}

/// The `_scan_source` body (`variant_source_scan.py:52-122`); `None` is any
/// `ValueError`/`IndexError` the walk raises there.
fn scan_structural(text: &str, root: &str) -> Option<SourceRecords> {
    let (mask, malformed) = mask_strings(text);
    if malformed || !starts_root(&mask, root) || !balanced_root(&mask) {
        return None;
    }
    let root_end = mask.iter().rposition(|&byte| byte == b')')? + 1;
    if !text[root_end..].chars().all(is_python_space) {
        return None;
    }

    let mut walk = Walk {
        text,
        mask: &mask,
        root,
        records: SourceRecords::empty(),
        parents: Vec::new(),
    };
    let mut depth: i64 = 0;
    let mut offset = 0;
    for form in find_forms(&mask) {
        for &byte in &mask[offset..form.start] {
            match byte {
                b'(' => depth += 1,
                b')' => depth -= 1,
                _ => {}
            }
        }
        while walk.parents.last().is_some_and(|(at, _)| *at >= depth) {
            walk.parents.pop();
        }
        let parent = walk
            .parents
            .last()
            .filter(|(at, _)| *at == depth - 1)
            .map(|(_, tag)| *tag);
        walk.visit(&form, depth, parent)?;
        walk.parents.push((depth, form.tag));
        depth += 1;
        offset = form.tag_end;
    }
    Some(walk.records)
}

/// The state of one `_scan_source` walk (`variant_source_scan.py:78-122`).
struct Walk<'a> {
    text: &'a str,
    mask: &'a [u8],
    root: &'a str,
    records: SourceRecords,
    /// Open recognized forms, innermost last, as `(depth, tag)`.
    parents: Vec<(i64, Tag)>,
}

impl Walk<'_> {
    /// Handle one `_FORMS` match (`variant_source_scan.py:84-119`).
    fn visit(&mut self, form: &Form, depth: i64, parent: Option<Tag>) -> Option<()> {
        match form.tag {
            Tag::Variant => self.visit_variant(form, depth, parent)?,
            Tag::Property if parent == Some(Tag::Sheet) => {
                if let Some((key, value)) = property_pair(self.text, form.start)
                    && json_string(key)? == "Sheetfile"
                {
                    self.records.sheets.push(json_string(value)?);
                }
            }
            _ => {}
        }
        Some(())
    }

    /// A `(variant …)` header or instance record (`variant_source_scan.py:90-114`).
    fn visit_variant(&mut self, form: &Form, depth: i64, parent: Option<Tag>) -> Option<()> {
        let is_header = self.is_variant_header(depth, parent);
        let is_record = self.is_variant_record(parent);
        if !is_header && !is_record {
            return Some(());
        }
        let end = end_of_form(self.mask, form.start)?;
        let (name, description) = variant_fields(self.text, self.mask, form.tag_end, end)?;
        let Some(name) = meaningful_variant_name(name) else {
            return Some(());
        };
        if is_header {
            self.records.header.push((name, description));
        } else {
            self.records.names.push(name);
        }
        Some(())
    }

    /// `root == "kicad_pcb" and parent == "variants" and depth == 2`
    /// (`variant_source_scan.py:91-92`).
    fn is_variant_header(&self, depth: i64, parent: Option<Tag>) -> bool {
        self.root == "kicad_pcb" && parent == Some(Tag::Variants) && depth == 2
    }

    /// `root == "kicad_pcb" and parent == "footprint"`, or `root ==
    /// "kicad_sch"` under a `(path …)` inside an `(instances …)`
    /// (`variant_source_scan.py:93-95`).
    fn is_variant_record(&self, parent: Option<Tag>) -> bool {
        (self.root == "kicad_pcb" && parent == Some(Tag::Footprint))
            || (self.root == "kicad_sch"
                && parent == Some(Tag::Path)
                && self.parents.iter().any(|(_, tag)| *tag == Tag::Instances))
    }
}

/// The `(name …)`/`(description …)` fields of one variant record
/// (`variant_source_scan.py:96-114`); `None` is a JSON error there.
fn variant_fields(
    text: &str,
    mask: &[u8],
    mut position: usize,
    end: usize,
) -> Option<(Option<String>, Option<String>)> {
    let mut name = None;
    let mut description = None;
    while position < end {
        let Some(start) = find_byte(mask, b'(', position, end) else {
            break;
        };
        let stop = end_of_form(mask, start)?;
        if let Some((key, token)) = name_form(&text[start..stop]) {
            let value = json_string(token)?;
            match key {
                "name" => name = Some(value),
                "description" => description = Some(value),
                _ => {}
            }
        }
        position = stop;
    }
    Some((name, description))
}

/// The name a record keeps (`variant_source_scan.py:97-98`): non-empty and not
/// the reserved `< Default >` header name.
fn meaningful_variant_name(name: Option<String>) -> Option<String> {
    name.filter(|name| !name.is_empty() && name != "< Default >")
}

/// The `_NAME` form (`variant_source_scan.py:19`): `(name "…")` or
/// `(description "…")` exactly, returning `(key, quoted token)`.
fn name_form(slice: &str) -> Option<(&'static str, &str)> {
    let bytes = slice.as_bytes();
    if bytes.first() != Some(&b'(') {
        return None;
    }
    let (key, after_key) = name_key(bytes, skip_spaces(bytes, 1))?;
    if after_key >= bytes.len() || space_len(bytes, after_key) == 0 {
        return None;
    }
    let token_start = skip_spaces(bytes, after_key);
    let token_end = match_quoted(bytes, token_start)?;
    let after = skip_spaces(bytes, token_end);
    if after + 1 != bytes.len() || bytes[after] != b')' {
        return None;
    }
    Some((key, &slice[token_start..token_end]))
}

/// `_NAME`'s `name`/`description` alternation, returning the key and the offset
/// just past it (`variant_source_scan.py:19`).
fn name_key(bytes: &[u8], at: usize) -> Option<(&'static str, usize)> {
    if starts_word(bytes, at, b"name") {
        Some(("name", at + "name".len()))
    } else if starts_word(bytes, at, b"description") {
        Some(("description", at + "description".len()))
    } else {
        None
    }
}

/// The `_PROPERTY` form (`variant_source_scan.py:20`): `(property "…" "…")`,
/// returning the two quoted tokens.
fn property_pair(text: &str, start: usize) -> Option<(&str, &str)> {
    let bytes = text.as_bytes();
    if start >= bytes.len() || bytes[start] != b'(' {
        return None;
    }
    let at = skip_spaces(bytes, start + 1);
    if !starts_word(bytes, at, b"property") {
        return None;
    }
    let after_key = at + "property".len();
    if after_key >= bytes.len() || space_len(bytes, after_key) == 0 {
        return None;
    }
    let key_start = skip_spaces(bytes, after_key);
    let key_end = match_quoted(bytes, key_start)?;
    if key_end >= bytes.len() || space_len(bytes, key_end) == 0 {
        return None;
    }
    let value_start = skip_spaces(bytes, key_end);
    let value_end = match_quoted(bytes, value_start)?;
    Some((&text[key_start..key_end], &text[value_start..value_end]))
}

/// The `\s*` run from `at`, returning the offset just past it.
fn skip_spaces(bytes: &[u8], mut at: usize) -> usize {
    while at < bytes.len() && space_len(bytes, at) > 0 {
        at += space_len(bytes, at);
    }
    at
}

/// `json.loads` on a quoted token (`variant_source_scan.py:107`, `:117-118`).
fn json_string(token: &str) -> Option<String> {
    serde_json::from_str(token).ok()
}

/// `_PARENS` form end (`variant_source_scan.py:31-37`), `None` for unbalanced.
fn end_of_form(mask: &[u8], start: usize) -> Option<usize> {
    let mut depth = 0i64;
    for (index, &byte) in mask.iter().enumerate().skip(start) {
        match byte {
            b'(' => depth += 1,
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(index + 1);
                }
            }
            _ => {}
        }
    }
    None
}

/// One `_FORMS` match (`variant_source_scan.py:18`).
struct Form {
    start: usize,
    tag_end: usize,
    tag: Tag,
}

/// A `_FORMS` alternative (`variant_source_scan.py:18`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Tag {
    KicadPcb,
    KicadSch,
    Footprint,
    Symbol,
    Sheet,
    Instances,
    Project,
    Path,
    Variants,
    Variant,
    Property,
}

/// `_FORMS.finditer(mask)` (`variant_source_scan.py:84`).
fn find_forms(mask: &[u8]) -> Vec<Form> {
    let mut forms = Vec::new();
    let mut at = 0;
    while at < mask.len() {
        if mask[at] == b'(' {
            let mut word = at + 1;
            while word < mask.len() && space_len(mask, word) > 0 {
                word += space_len(mask, word);
            }
            if let Some((tag, tag_end)) = match_tag(mask, word) {
                forms.push(Form {
                    start: at,
                    tag_end,
                    tag,
                });
                at = tag_end;
                continue;
            }
        }
        at += 1;
    }
    forms
}

/// The `_FORMS` alternation, in order, with its `(?=\s|\))` lookahead.
fn match_tag(mask: &[u8], at: usize) -> Option<(Tag, usize)> {
    const TAGS: [(&[u8], Tag); 11] = [
        (b"kicad_pcb", Tag::KicadPcb),
        (b"kicad_sch", Tag::KicadSch),
        (b"footprint", Tag::Footprint),
        (b"symbol", Tag::Symbol),
        (b"sheet", Tag::Sheet),
        (b"instances", Tag::Instances),
        (b"project", Tag::Project),
        (b"path", Tag::Path),
        (b"variants", Tag::Variants),
        (b"variant", Tag::Variant),
        (b"property", Tag::Property),
    ];
    for (word, tag) in TAGS {
        if starts_word(mask, at, word) {
            let end = at + word.len();
            if end >= mask.len() || space_len(mask, end) > 0 || mask[end] == b')' {
                return Some((tag, end));
            }
        }
    }
    None
}

/// `_RELEVANT.search(text)` (`variant_source_scan.py:16`, `:44`).
fn has_relevant_form(text: &str) -> bool {
    let bytes = text.as_bytes();
    for (at, &byte) in bytes.iter().enumerate() {
        if byte == b'(' && variant_form_at(bytes, at) {
            return true;
        }
    }
    false
}

/// `\(\s*variant s? (?=\s|\))` at the `(` at `at` (`_RELEVANT`,
/// `variant_source_scan.py:16`).
fn variant_form_at(bytes: &[u8], at: usize) -> bool {
    let word = skip_spaces(bytes, at + 1);
    if !starts_word(bytes, word, b"variant") {
        return false;
    }
    let mut end = word + "variant".len();
    if end < bytes.len() && bytes[end] == b's' {
        end += 1;
    }
    end >= bytes.len() || space_len(bytes, end) > 0 || bytes[end] == b')'
}

/// Mask every quoted span (`variant_source_scan.py:54-61`), returning the mask
/// and whether any string was unterminated. Every masked byte becomes a space,
/// so byte offsets still name the same source positions.
fn mask_strings(text: &str) -> (Vec<u8>, bool) {
    let bytes = text.as_bytes();
    let mut mask = bytes.to_vec();
    let mut malformed = false;
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] == b'"'
            && let Some(end) = match_string(bytes, at)
        {
            for byte in &mut mask[at..end] {
                *byte = b' ';
            }
            if bytes[end - 1] != b'"' || end - at == 1 {
                malformed = true;
            }
            at = end;
            continue;
        }
        at += 1;
    }
    (mask, malformed)
}

/// The `_STRINGS` match at `at` (`variant_source_scan.py:12`), end-exclusive;
/// Python's `(?:"|$)` lets an unterminated string run to the end of the text.
fn match_string(bytes: &[u8], at: usize) -> Option<usize> {
    let mut index = at + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'"' => return Some(index + 1),
            b'\\' => {
                if index + 1 < bytes.len() && bytes[index + 1] != b'\n' {
                    index += 2;
                } else {
                    return None;
                }
            }
            _ => index += 1,
        }
    }
    Some(bytes.len())
}

/// A quoted token that must be terminated (`_NAME`/`_PROPERTY` groups).
fn match_quoted(bytes: &[u8], at: usize) -> Option<usize> {
    if bytes.get(at) != Some(&b'"') {
        return None;
    }
    let mut index = at + 1;
    while index < bytes.len() {
        match bytes[index] {
            b'"' => return Some(index + 1),
            b'\\' => {
                if index + 1 < bytes.len() && bytes[index + 1] != b'\n' {
                    index += 2;
                } else {
                    return None;
                }
            }
            _ => index += 1,
        }
    }
    None
}

/// `\s*\(\s*ROOT(?=\s|\))` at the start of the mask (:62).
fn starts_root(mask: &[u8], root: &str) -> bool {
    let mut at = 0;
    while at < mask.len() && space_len(mask, at) > 0 {
        at += space_len(mask, at);
    }
    if at >= mask.len() || mask[at] != b'(' {
        return false;
    }
    at += 1;
    while at < mask.len() && space_len(mask, at) > 0 {
        at += space_len(mask, at);
    }
    if !starts_word(mask, at, root.as_bytes()) {
        return false;
    }
    let end = at + root.len();
    end >= mask.len() || space_len(mask, end) > 0 || mask[end] == b')'
}

/// The `_PARENS` balance/one-root check (`variant_source_scan.py:64-73`).
fn balanced_root(mask: &[u8]) -> bool {
    let mut depth = 0i64;
    let mut roots = 0;
    for &byte in mask {
        match byte {
            b'(' => depth += 1,
            b')' => depth -= 1,
            _ => continue,
        }
        if depth == 0 {
            roots += 1;
        }
        if depth < 0 {
            return false;
        }
    }
    depth == 0 && roots == 1
}

/// `mask.find(byte, from, to)` (Python `str.find`).
fn find_byte(mask: &[u8], byte: u8, from: usize, to: usize) -> Option<usize> {
    mask.get(from..to)?
        .iter()
        .position(|&it| it == byte)
        .map(|at| from + at)
}

/// `bytes[at..].starts_with(word)` without an index panic.
fn starts_word(bytes: &[u8], at: usize, word: &[u8]) -> bool {
    bytes.len() >= at + word.len() && &bytes[at..at + word.len()] == word
}

/// The byte length of the `\s` character at `at`, or 0 (also 0 past the end
/// or inside a UTF-8 sequence). The mask keeps every unmasked byte, and masks
/// whole strings with ASCII spaces, so it stays valid UTF-8.
fn space_len(bytes: &[u8], at: usize) -> usize {
    let Some(&lead) = bytes.get(at) else {
        return 0;
    };
    if lead.is_ascii() {
        return usize::from(is_python_space(char::from(lead)));
    }
    let width = match lead {
        0xc0..=0xdf => 2,
        0xe0..=0xef => 3,
        _ => 4,
    };
    bytes
        .get(at..at + width)
        .and_then(|slice| std::str::from_utf8(slice).ok())
        .and_then(|text| text.chars().next())
        .filter(|&character| is_python_space(character))
        .map_or(0, char::len_utf8)
}

/// Python's `str.isspace()`, which `\s` and `str.strip()` use on `str`:
/// Unicode `White_Space` plus the four information separators U+001C-U+001F.
fn is_python_space(character: char) -> bool {
    character.is_whitespace() || ('\u{1c}'..='\u{1f}').contains(&character)
}

// ---------------------------------------------------------------------------
// The variant/rule-area diagnostics scans (semantic_index_variants.py:535-561).
// These run over the raw text (not the masked copy): Python's `_VARIANT_START`,
// `_RULE_AREA_START` and `_RULE_AREA_FLAGS` are plain `re` searches, and only
// `kicad_library_reader.form_end` is quote-aware (`_SEXPR_SCAN`, :32-56).
// ---------------------------------------------------------------------------

/// `kicad_library_reader.form_end(text, start)` (kicad_library_reader.py:35-56):
/// the offset just past the form opening at `start`, or `None` when the text is
/// unbalanced or carries an unterminated string.
pub(super) fn form_end(text: &str, start: usize) -> Option<usize> {
    let bytes = text.as_bytes();
    let mut depth = 0i64;
    let mut at = start;
    while at < bytes.len() {
        match bytes[at] {
            // `_SEXPR_SCAN`'s string alternative needs a closing quote; a
            // string without one (including `"…\"` at the end of the text,
            // whose last quote is escaped) leaves a bare `"`: no form end.
            b'"' => at = match_quoted(bytes, at)?,
            b'(' => {
                depth += 1;
                at += 1;
            }
            b')' => {
                depth -= 1;
                if depth == 0 {
                    return Some(at + 1);
                }
                if depth < 0 {
                    return None;
                }
                at += 1;
            }
            _ => at += 1,
        }
    }
    None
}

/// `form_starts`/`_VARIANT_START`/`_RULE_AREA_START` (`(head(?=\s|\))`) over the
/// raw text, in order (`kicad_library_reader.py:59-62`).
fn form_starts(text: &str, head: &str) -> Vec<usize> {
    let bytes = text.as_bytes();
    let needle = head.as_bytes();
    let mut starts = Vec::new();
    let mut at = 0;
    while at + 1 + needle.len() <= bytes.len() {
        if bytes[at] == b'(' && &bytes[at + 1..at + 1 + needle.len()] == needle {
            let end = at + 1 + needle.len();
            if end < bytes.len() && (space_len(bytes, end) > 0 || bytes[end] == b')') {
                starts.push(at);
                at = end;
                continue;
            }
        }
        at += 1;
    }
    starts
}

/// `_scan_unsupported_tokens(text, suffix)` (semantic_index_variants.py:535-545):
/// the first-seen token of `candidates` found inside any `(variant …)` block.
pub(super) fn unsupported_tokens(text: &str, candidates: &[&str]) -> Vec<String> {
    let mut found: Vec<String> = Vec::new();
    for start in form_starts(text, "variant") {
        let Some(end) = form_end(text, start) else {
            continue;
        };
        let block = &text[start..end];
        for token in candidates {
            if !found.iter().any(|seen| seen == token) && block.contains(&format!("({token}")) {
                found.push((*token).to_owned());
            }
        }
    }
    found
}

/// `_scan_rule_areas(text)` (semantic_index_variants.py:548-561): one detail
/// map per `(rule_area …)` block that sets a recognized flag, in `_RULE_AREA_FLAGS`
/// order.
pub(super) fn rule_areas(text: &str) -> Vec<Vec<(&'static str, bool)>> {
    const FLAGS: [(&str, &str, bool); 4] = [
        ("dnp", "yes", true),
        ("in_bom", "no", false),
        ("on_board", "no", false),
        ("exclude_from_sim", "yes", true),
    ];
    let mut areas = Vec::new();
    for start in form_starts(text, "rule_area") {
        let Some(end) = form_end(text, start) else {
            continue;
        };
        let block = &text[start..end];
        let detail = FLAGS
            .iter()
            .filter(|(key, value, _)| contains_flag_expression(block, key, value))
            .map(|(key, _, flag)| (*key, *flag))
            .collect::<Vec<_>>();
        if !detail.is_empty() {
            areas.push(detail);
        }
    }
    areas
}

/// `\(key\s+value\)` over the raw block (`_RULE_AREA_FLAGS`, :65-70).
fn contains_flag_expression(block: &str, key: &str, value: &str) -> bool {
    let bytes = block.as_bytes();
    let mut at = 0;
    while at < bytes.len() {
        if bytes[at] == b'(' && starts_word(bytes, at + 1, key.as_bytes()) {
            let mut position = at + 1 + key.len();
            let mut spaces = 0;
            while position < bytes.len() && space_len(bytes, position) > 0 {
                position += space_len(bytes, position);
                spaces += 1;
            }
            if spaces > 0 && starts_word(bytes, position, value.as_bytes()) {
                let close = position + value.len();
                if close < bytes.len() && bytes[close] == b')' {
                    return true;
                }
            }
        }
        at += 1;
    }
    false
}

#[cfg(test)]
mod tests {
    use super::scan;

    #[test]
    fn board_header_and_footprint_records() {
        let header = scan(
            "(kicad_pcb (variants (variant (name \"Lite\") (description \"Cost\"))))",
            "kicad_pcb",
        );
        assert!(header.readable);
        assert_eq!(
            header.header,
            vec![("Lite".to_owned(), Some("Cost".to_owned()))]
        );
        assert!(header.names.is_empty());

        let footprint = scan(
            "(kicad_pcb (footprint (variant (name \"LITE\"))))",
            "kicad_pcb",
        );
        assert!(footprint.readable);
        assert_eq!(footprint.names, vec!["LITE".to_owned()]);
    }

    #[test]
    fn schematic_instance_records_and_sheet_links() {
        let text = "(kicad_sch \
            (symbol (instances (project (path \"/\" (variant (name \"Lite\")))))) \
            (sheet (property \"Sheetfile\" \"sub.kicad_sch\")))";
        let records = scan(text, "kicad_sch");
        assert!(records.readable);
        assert_eq!(records.names, vec!["Lite".to_owned()]);
        assert_eq!(records.sheets, vec!["sub.kicad_sch".to_owned()]);
    }

    #[test]
    fn quoted_forms_do_not_confuse_the_walk() {
        // A `(variant` inside a quoted string is masked, not a record.
        let records = scan(
            "(kicad_pcb (property \"X\" \"(variant (name \\\"no\\\"))\"))",
            "kicad_pcb",
        );
        assert!(records.readable);
        assert!(records.header.is_empty());
        assert!(records.names.is_empty());
    }

    #[test]
    fn unrelated_and_unbalanced_sources() {
        assert_eq!(
            scan("(kicad_pcb (net 0 \"\"))", "kicad_pcb"),
            super::SourceRecords::empty()
        );
        assert!(!scan("(kicad_pcb (variants (variant (name \"x\")))", "kicad_pcb").readable);
    }

    #[test]
    fn a_property_without_a_quoted_value_is_skipped_not_unreadable() {
        // `_PROPERTY` simply does not match; the source stays readable.
        let records = scan(
            "(kicad_sch (sheet (property \"Sheetname\\x\" footprint\"x\") \
             (property \"Sheetfile\" \"a.kicad_sch\")))",
            "kicad_sch",
        );
        assert!(records.readable);
        assert_eq!(records.sheets, ["a.kicad_sch"]);
    }

    #[test]
    fn unicode_whitespace_is_python_whitespace() {
        let records = scan(
            "(kicad_pcb (variants (\u{a0}variant (name\u{3000}\"A\") (description \"d\"\u{1f}))))",
            "kicad_pcb",
        );
        assert_eq!(records.header, [("A".to_owned(), Some("d".to_owned()))]);
    }

    /// `_scan_unsupported_tokens` (semantic_index_variants.py:535-545): first
    /// seen across variant blocks, checked in token order per block.
    #[test]
    fn unsupported_tokens_are_first_seen_across_variant_blocks() {
        let tokens = super::unsupported_tokens(
            "(kicad_sch (symbol (instances \
             (path \"/\" (variant (name \"V\") (symbol_override yes))))) \
             (symbol (instances (path \"/\" (variant (name \"W\") (pin_map_override x))))))",
            &["symbol_override", "pin_map_override"],
        );
        assert_eq!(tokens, ["symbol_override", "pin_map_override"]);

        // A token outside any variant block is not reported.
        assert!(
            super::unsupported_tokens("(kicad_sch (symbol_override yes))", &["symbol_override"])
                .is_empty()
        );
    }

    /// `_scan_rule_areas` (semantic_index_variants.py:548-561): one detail map
    /// per block that sets a recognized flag, in `_RULE_AREA_FLAGS` order.
    #[test]
    fn rule_area_flags_are_reported_in_flag_order() {
        let areas = super::rule_areas(
            "(kicad_sch (rule_area (polygon) (on_board no) (dnp yes)) \
             (rule_area (polygon)) \
             (rule_area (in_bom no) (exclude_from_sim yes)))",
        );
        assert_eq!(
            areas,
            vec![
                vec![("dnp", true), ("on_board", false)],
                vec![("in_bom", false), ("exclude_from_sim", true)],
            ]
        );
        assert!(super::rule_areas("(kicad_sch (rule_area (dnp no)))").is_empty());
    }

    /// `kicad_library_reader.form_end` (`:35-56`) stops on an unbalanced form
    /// and never counts parentheses inside a quoted string.
    #[test]
    fn form_end_is_quote_aware_and_balanced() {
        let text = "(a \"(b)\" (c d)) tail";
        assert_eq!(super::form_end(text, 0), Some(15));
        assert_eq!(super::form_end("(a (b)", 0), None);
        assert_eq!(super::form_end("(a \"unterminated)", 0), None);
    }

    #[test]
    fn form_end_refuses_an_unterminated_string() {
        // kicad_library_reader.form_end: a bare quote returns None.
        assert_eq!(super::form_end("(a \"x\")", 0), Some(7));
        assert_eq!(super::form_end("(a \"x\\\"", 0), None);
        assert_eq!(super::form_end("(a \"x\\\n\")", 0), None);
    }
}
