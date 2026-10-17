//! A tolerant KiCad S-expression reader that keeps token text and byte
//! offsets.
//!
//! This is a port of the reader the two reference implementations share
//! (`native/parity/prism_parity/capture/board_objects_sexpr.mjs:13-53` for the
//! digest and `backend/design-compare-parser/vendor/kicad-sexpr-parser.mjs:120-184`
//! `listify` for today's object index). Both treat an unquoted token as text
//! and classify it only when a value is needed; keeping the raw text is what
//! lets the digest canonicalize numbers exactly (field map, "contentDigest").
//!
//! Differences between the two readers that matter here are folded into the
//! helpers below: quoted strings decode `\n`, `\t`, `\r`, `\"` and `\\`
//! (digest reader, `board_objects_sexpr.mjs:31-38`); every other escape keeps
//! its character, as `listify` does (`kicad-sexpr-parser.mjs:97-119`). Neither
//! difference occurs in a KiCad file Prism parses.
//!
//! Every node borrows the source document: an unquoted token is a `&str` slice
//! of it, and a quoted string is a slice too unless it carries an escape (then
//! it is the one decoded `String`). A parse therefore allocates only the
//! per-list child vectors, never one owned token text per token.

use std::borrow::Cow;

/// One s-expression node. Lists carry the byte offset of their opening
/// parenthesis so objects can be ordered in file order (field map, document
/// `objects` order).
#[derive(Clone, Debug, PartialEq)]
pub enum Node<'a> {
    /// A parenthesized list, with the byte offset of its `(`.
    List { items: Vec<Node<'a>>, start: usize },
    /// An unquoted token, a slice of the source, exactly as written.
    Atom(&'a str),
    /// A quoted string after escape decoding (borrowed when it has no escape).
    Str(Cow<'a, str>),
}

impl<'a> Node<'a> {
    /// The list's items, or `None` for a leaf.
    #[must_use]
    pub fn items(&self) -> Option<&[Node<'a>]> {
        match self {
            Node::List { items, .. } => Some(items),
            _ => None,
        }
    }

    /// The byte offset of a list's `(`, or `usize::MAX` for a leaf.
    #[must_use]
    pub fn start(&self) -> usize {
        match self {
            Node::List { start, .. } => *start,
            _ => usize::MAX,
        }
    }

    /// The text of a leaf (`Atom` or `Str`).
    #[must_use]
    pub fn text(&self) -> Option<&str> {
        match self {
            Node::Atom(text) => Some(text),
            Node::Str(text) => Some(text.as_ref()),
            Node::List { .. } => None,
        }
    }

    /// The head symbol of a list: its first child when that child is an atom
    /// (`board_objects_sexpr.mjs:55`).
    #[must_use]
    pub fn head(&self) -> Option<&str> {
        match self {
            Node::List { items, .. } => match items.first() {
                Some(Node::Atom(text)) => Some(text),
                _ => None,
            },
            _ => None,
        }
    }

    /// The direct child lists whose head is `name`, in file order.
    pub fn children<'t>(&'t self, name: &'t str) -> impl Iterator<Item = &'t Node<'a>> + 't {
        self.items()
            .into_iter()
            .flatten()
            .filter(move |child| child.head() == Some(name))
    }

    /// The first direct child list whose head is `name`.
    #[must_use]
    pub fn child(&self, name: &str) -> Option<&Node<'a>> {
        self.items()?
            .iter()
            .find(|child| child.head() == Some(name))
    }

    /// The list elements after the head, as a slice.
    #[must_use]
    pub fn rest(&self) -> &[Node<'a>] {
        self.items().map_or(
            &[],
            |items| {
                if items.is_empty() { &[] } else { &items[1..] }
            },
        )
    }
}

/// Parse `text` into its top-level forms, tolerating unbalanced parentheses
/// as both reference readers do. The nodes borrow `text`.
#[must_use]
pub fn parse(text: &str) -> Vec<Node<'_>> {
    let bytes = text.as_bytes();
    let mut roots: Vec<Node> = Vec::with_capacity(4);
    let mut stack: Vec<(usize, Vec<Node>)> = Vec::with_capacity(16);
    let mut index = 0usize;
    while index < bytes.len() {
        match bytes[index] {
            b'(' => {
                stack.push((index, Vec::with_capacity(4)));
                index += 1;
            }
            b')' => {
                if let Some((start, items)) = stack.pop() {
                    let node = Node::List { items, start };
                    push(&mut roots, &mut stack, node);
                }
                index += 1;
            }
            b'"' => {
                let (value, next) = read_string(text, index + 1);
                push(&mut roots, &mut stack, Node::Str(value));
                index = next;
            }
            b' ' | b'\t' | b'\n' | b'\r' => index += 1,
            _ => {
                let start = index;
                while index < bytes.len()
                    && !matches!(
                        bytes[index],
                        b'(' | b')' | b'"' | b' ' | b'\t' | b'\n' | b'\r'
                    )
                {
                    index += 1;
                }
                push(&mut roots, &mut stack, Node::Atom(&text[start..index]));
            }
        }
    }
    roots
}

fn push<'a>(roots: &mut Vec<Node<'a>>, stack: &mut [(usize, Vec<Node<'a>>)], node: Node<'a>) {
    if let Some((_, items)) = stack.last_mut() {
        items.push(node);
    } else {
        roots.push(node);
    }
}

/// Read a quoted string starting after the opening quote at `start`; returns
/// the decoded value and the index just past the closing quote. A string with
/// no backslash escape is borrowed from `text`; one with an escape is decoded
/// into an owned `String`.
fn read_string(text: &str, start: usize) -> (Cow<'_, str>, usize) {
    let (end, escaped) = scan_string(text, start);
    if escaped {
        return decode_string(text, start, end);
    }
    let next = if end < text.len() { end + 1 } else { end };
    (Cow::Borrowed(&text[start..end]), next)
}

/// The index of the closing quote (or the end of the text) and whether a
/// backslash escape was seen before it.
fn scan_string(text: &str, start: usize) -> (usize, bool) {
    let bytes = text.as_bytes();
    let mut index = start;
    let mut escaped = false;
    while index < bytes.len() {
        match bytes[index] {
            b'"' => break,
            b'\\' => {
                escaped = true;
                index += usize::from(index + 1 < bytes.len());
            }
            _ => {}
        }
        index += 1;
    }
    (index, escaped)
}

/// Decode a quoted string that carries at least one escape.
fn decode_string(text: &str, start: usize, end: usize) -> (Cow<'_, str>, usize) {
    let bytes = text.as_bytes();
    let mut out = String::with_capacity(end.saturating_sub(start));
    let mut index = start;
    while index < bytes.len() {
        match bytes[index] {
            b'"' => return (Cow::Owned(out), index + 1),
            b'\\' if index + 1 < bytes.len() => {
                let next = bytes[index + 1];
                match next {
                    b'n' => out.push('\n'),
                    b't' => out.push('\t'),
                    b'r' => out.push('\r'),
                    _ => out.push(next as char),
                }
                index += 2;
            }
            _ => {
                let ch = text[index..].chars().next().unwrap_or('\u{fffd}');
                out.push(ch);
                index += ch.len_utf8();
            }
        }
    }
    (Cow::Owned(out), index)
}

/// Where an s-expression file's lists do not balance, as the fork's reader
/// rejects it (`capture/board_objects.py:105-133`, fork `sexpr.rs:412-426`).
/// Quoted strings (with backslash escapes) are skipped.
#[must_use]
pub fn unbalanced(text: &str) -> Option<String> {
    let bytes = text.as_bytes();
    let mut opened: Vec<usize> = Vec::new();
    let mut index = 0usize;
    while index < bytes.len() {
        match bytes[index] {
            b'"' => {
                index += 1;
                while index < bytes.len() && bytes[index] != b'"' {
                    index += if bytes[index] == b'\\' { 2 } else { 1 };
                }
            }
            b'(' => opened.push(index),
            b')' if opened.pop().is_none() => {
                return Some(format!("unbalanced closing parenthesis at offset {index}"));
            }
            _ => {}
        }
        index += 1;
    }
    if let Some(offset) = opened.last() {
        let line = text[..*offset].matches('\n').count() + 1;
        let column = offset
            - text[..*offset]
                .rfind('\n')
                .map_or(0, |position| position + 1)
            + 1;
        return Some(format!("unclosed '(' at line {line}, column {column}"));
    }
    None
}

/// Whether a numeric atom is a plain decimal (the vendored parser's
/// `classify_numeric`, `kicad-sexpr-parser.mjs:185-208`): only `[-+]?[0-9.]*`
/// and hex (`0x…` with `_` group separators); `e`/`E` exponents are not
/// numbers there. `String.replace("_", "")` removes only the first `_`, and
/// `parseInt` stops at the next one — both reproduced here.
#[must_use]
pub fn number(text: &str) -> Option<f64> {
    let bytes = text.as_bytes();
    if bytes.is_empty() {
        return None;
    }
    let mut index = usize::from(matches!(bytes[0], b'+' | b'-'));
    if index >= bytes.len() {
        return None;
    }
    while index < bytes.len() {
        let byte = bytes[index];
        if byte == b'.' || byte.is_ascii_digit() {
            index += 1;
            continue;
        }
        if byte == b'x' || byte == b'X' {
            return classify_hex(text, index);
        }
        return None;
    }
    text.parse::<f64>().ok()
}

/// The `x`/`X` branch of `classify_numeric`: every remaining byte must be a
/// hex digit or `_`, then `parseInt(text.replace("_", ""), 16)`.
fn classify_hex(text: &str, mut index: usize) -> Option<f64> {
    let bytes = text.as_bytes();
    index += 1;
    while index < bytes.len() {
        if !(bytes[index].is_ascii_hexdigit() || bytes[index] == b'_') {
            return None;
        }
        index += 1;
    }
    parse_hex(&text.replacen('_', "", 1))
}

/// `parseInt(text, 16)`: an optional sign, an optional `0x`, then hex digits.
fn parse_hex(text: &str) -> Option<f64> {
    let bytes = text.as_bytes();
    let mut index = 0usize;
    let mut negative = false;
    if matches!(bytes.first(), Some(b'+' | b'-')) {
        negative = bytes[0] == b'-';
        index = 1;
    }
    if index + 1 < bytes.len() && bytes[index] == b'0' && matches!(bytes[index + 1], b'x' | b'X') {
        index += 2;
    }
    let start = index;
    while index < bytes.len() && bytes[index].is_ascii_hexdigit() {
        index += 1;
    }
    if index == start {
        return None;
    }
    let value = u128::from_str_radix(&text[start..index], 16).ok()? as f64;
    Some(if negative { -value } else { value })
}

/// The leaf text at `index` of a form, if it is not a list (`scalar_child`).
#[must_use]
pub fn text_at(form: &Node<'_>, index: usize) -> Option<String> {
    form.items()
        .and_then(|items| items.get(index))
        .and_then(Node::text)
        .map(str::to_owned)
}

/// The `item[1]` text of the first child list with head `head`.
#[must_use]
pub fn child_text(form: &Node<'_>, head: &str) -> Option<String> {
    form.child(head)
        .and_then(|child| child.items())
        .and_then(|items| items.get(1))
        .and_then(Node::text)
        .map(str::to_owned)
}

/// The numeric value at `index` of a form, if it is a number.
#[must_use]
pub fn number_at(form: &Node<'_>, index: usize) -> Option<f64> {
    text_at(form, index).and_then(|text| number(&text))
}

/// The numeric `item[1]` of the first child list with head `head`.
#[must_use]
pub fn child_number(form: &Node<'_>, head: &str) -> Option<f64> {
    child_text(form, head).and_then(|text| number(&text))
}

/// The items of the first child list with head `head`.
#[must_use]
pub fn child_items<'t, 'a>(form: &'t Node<'a>, head: &str) -> Option<&'t [Node<'a>]> {
    form.child(head).and_then(Node::items)
}

/// The `(at x y …)` position, or `None` when it has no numeric `x`/`y`
/// (`ecad-parse.mjs:302-308`).
#[must_use]
pub fn point(at: Option<&Node<'_>>) -> Option<(f64, f64)> {
    let at = at?;
    let x = number_at(at, 1)?;
    let y = number_at(at, 2)?;
    Some((x, y))
}

/// The rotation of an `(at x y angle …)` form, defaulting to 0
/// (`kicad-sexpr-parser.mjs:483-501`).
#[must_use]
pub fn rotation(at: Option<&Node<'_>>) -> Option<f64> {
    let at = at?;
    Some(number_at(at, 3).unwrap_or(0.0))
}

/// Every `(xy x y)` point of a `(pts …)` list, with absent coordinates as
/// `None`.
#[must_use]
pub fn points(items: &[Node<'_>]) -> Vec<(Option<f64>, Option<f64>)> {
    items
        .iter()
        .filter(|item| item.head() == Some("xy"))
        .map(|xy| (number_at(xy, 1), number_at(xy, 2)))
        .collect()
}

/// Every `(xy x y)` point of a form's `(pts …)` child.
#[must_use]
pub fn pts_points(form: &Node<'_>) -> Vec<(Option<f64>, Option<f64>)> {
    child_items(form, "pts").map_or_else(Vec::new, points)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_lists_atoms_and_strings() {
        let roots = parse("(kicad_sch (version 20230121) (generator \"eeschema\"))");
        assert_eq!(roots.len(), 1);
        let root = &roots[0];
        assert_eq!(root.head(), Some("kicad_sch"));
        assert_eq!(
            root.children("version")
                .next()
                .unwrap()
                .items()
                .unwrap()
                .len(),
            2
        );
        assert_eq!(
            root.child("generator").unwrap().items().unwrap()[1],
            Node::Str("eeschema".into())
        );
    }

    #[test]
    fn keeps_offsets_and_file_order() {
        let roots = parse("(a) (b)");
        assert_eq!(roots[0].start(), 0);
        assert_eq!(roots[1].start(), 4);
    }

    #[test]
    fn detects_unbalanced_input() {
        assert!(unbalanced("(a (b)").is_some());
        assert!(unbalanced("(a))").is_some());
        assert!(unbalanced("(a \"(\")").is_none());
    }

    #[test]
    fn numbers_follow_the_vendored_parser() {
        assert_eq!(number("1.5"), Some(1.5));
        assert_eq!(number("-2"), Some(-2.0));
        assert_eq!(number(".5"), Some(0.5));
        assert_eq!(number("1e3"), None);
        assert_eq!(number("abc"), None);
    }
}
