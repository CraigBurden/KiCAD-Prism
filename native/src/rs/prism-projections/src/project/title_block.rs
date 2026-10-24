//! Title-block expansion (`project.py:366-423`), the field map's
//! "Title-block expansion (normative)".
//!
//! [`TitleBlock::read`] reads a `(title_block …)` as written; [`expanded_block`]
//! expands its fields and comments with `kicad_text_variables` variables at
//! depth 10 ([`tb_expand`], `project.py:366-383`).

use prism_kicad_core::Sexp;
use serde_json::{Map, Value};
use std::collections::BTreeMap;

use super::sexpr::{as_list, child, children, find_byte, str_atom};

/// `project.py:363`: `\$\{(.+?)\}`, the title-block expander. The `.` matches
/// any char but `\n`, and `+?` is one or more, non-greedy: the match at the `$`
/// in `bytes[start]` closes at the first `}` before a newline, `(content_start,
/// content_end, end)`.
pub(super) fn tb_var_at(bytes: &[u8], start: usize) -> Option<(usize, usize, usize)> {
    if bytes.get(start + 1) != Some(&b'{') {
        return None;
    }
    let content_start = start + 2;
    if bytes.get(content_start).is_none_or(|&byte| byte == b'\n') {
        return None;
    }
    let mut end = content_start + 1;
    while let Some(&byte) = bytes.get(end) {
        if byte == b'\n' {
            return None;
        }
        if byte == b'}' {
            return Some((content_start, end, end + 1));
        }
        end += 1;
    }
    None
}

/// `project.py:385-398`: a `(title_block …)` as written.
pub(super) struct TitleBlock {
    title: Option<String>,
    date: Option<String>,
    rev: Option<String>,
    company: Option<String>,
    comments: Vec<(i64, String)>,
}

impl TitleBlock {
    /// `project.py:385-398`: read a title block, or `None` when absent.
    pub(super) fn read(form: Option<&Sexp>) -> Option<Self> {
        let form = form?;
        let mut block = Self {
            title: None,
            date: None,
            rev: None,
            company: None,
            comments: Vec::new(),
        };
        for (key, slot) in [
            ("title", &mut block.title),
            ("date", &mut block.date),
            ("rev", &mut block.rev),
            ("company", &mut block.company),
        ] {
            if let Some(value) = str_atom(child(form, key), 1)
                && !value.is_empty()
            {
                *slot = Some(value);
            }
        }
        let mut comments: BTreeMap<i64, String> = BTreeMap::new();
        for comment in children(form, "comment") {
            let Some(number) = comment_number(comment) else {
                continue;
            };
            if let Some(value) = str_atom(Some(comment), 2) {
                comments.insert(number, value);
            }
        }
        block.comments = comments
            .into_iter()
            .filter(|(_, text)| !text.is_empty())
            .collect();
        Some(block)
    }

    /// `project.py:387-397`: the raw contract fields.
    pub(super) fn to_value(&self) -> Value {
        let mut object = Map::new();
        for (key, value) in [
            ("title", &self.title),
            ("date", &self.date),
            ("rev", &self.rev),
            ("company", &self.company),
        ] {
            if let Some(value) = value {
                object.insert(key.to_owned(), value.clone().into());
            }
        }
        let comments = self
            .comments
            .iter()
            .map(|(number, text)| serde_json::json!({"number": number, "text": text}))
            .collect();
        object.insert("comments".to_owned(), Value::Array(comments));
        Value::Object(object)
    }
}

/// `project.py:395`: a comment's number when it is an integer in 1..=9.
fn comment_number(comment: &Sexp) -> Option<i64> {
    let values = as_list(comment)?;
    if values.len() < 3 {
        return None;
    }
    let Sexp::Integer(number) = values[1] else {
        return None;
    };
    if !(1..=9).contains(&number) || matches!(values[2], Sexp::List(_)) {
        return None;
    }
    Some(number)
}

/// `project.py:401-423`: a title block with its variables expanded.
pub(super) fn expanded_block(
    block: &TitleBlock,
    properties: &BTreeMap<String, String>,
    text_variables: &BTreeMap<String, String>,
    project_name: &str,
    filename: &str,
) -> Value {
    let mut variables: BTreeMap<String, String> = BTreeMap::new();
    variables.insert("TITLE".to_owned(), block.title.clone().unwrap_or_default());
    variables.insert(
        "ISSUE_DATE".to_owned(),
        block.date.clone().unwrap_or_default(),
    );
    variables.insert("REVISION".to_owned(), block.rev.clone().unwrap_or_default());
    variables.insert(
        "COMPANY".to_owned(),
        block.company.clone().unwrap_or_default(),
    );
    let by_number: BTreeMap<i64, &String> = block
        .comments
        .iter()
        .map(|(number, text)| (*number, text))
        .collect();
    for number in 1..=9 {
        let value = by_number.get(&number).map_or("", |text| text.as_str());
        variables.insert(format!("COMMENT{number}"), value.to_owned());
    }
    variables.extend(properties.iter().map(|(k, v)| (k.clone(), v.clone())));
    variables.extend(text_variables.iter().map(|(k, v)| (k.clone(), v.clone())));
    if !project_name.is_empty() {
        variables.insert("PROJECTNAME".to_owned(), project_name.to_owned());
    }
    variables.insert("FILENAME".to_owned(), filename.to_owned());

    let mut object = Map::new();
    for (key, value) in [
        ("title", &block.title),
        ("date", &block.date),
        ("rev", &block.rev),
        ("company", &block.company),
    ] {
        if let Some(value) = value {
            let expanded = tb_expand(value, &variables);
            if !expanded.is_empty() {
                object.insert(key.to_owned(), expanded.into());
            }
        }
    }
    let comments = block
        .comments
        .iter()
        .filter_map(|(number, text)| {
            let expanded = tb_expand(text, &variables);
            (!expanded.is_empty()).then(|| serde_json::json!({"number": number, "text": expanded}))
        })
        .collect();
    object.insert("comments".to_owned(), Value::Array(comments));
    Value::Object(object)
}

/// `project.py:366-383`: `kicad_text_variables.py:51-71` (depth 10).
pub(super) fn tb_expand(text: &str, variables: &BTreeMap<String, String>) -> String {
    if text.is_empty() || !text.contains("${") {
        return text.to_owned();
    }
    expand_title(text, variables, 0)
}

/// One recursively substituted pass (`project.py:369-378`).
fn expand_title(text: &str, variables: &BTreeMap<String, String>, depth: u8) -> String {
    let mut out = String::with_capacity(text.len());
    let mut last = 0;
    let bytes = text.as_bytes();
    let mut cursor = 0;
    while let Some(start) = find_byte(bytes, b'$', cursor) {
        let Some((content_start, content_end, end)) = tb_var_at(bytes, start) else {
            cursor = start + 1;
            continue;
        };
        out.push_str(&text[last..start]);
        last = end;
        cursor = end;
        let name = &text[content_start..content_end];
        match variables.get(name) {
            Some(value) if depth >= 10 => out.push_str(value),
            Some(value) => out.push_str(&expand_title(value, variables, depth + 1)),
            None => out.push_str(&text[start..end]),
        }
    }
    out.push_str(&text[last..]);
    out
}
