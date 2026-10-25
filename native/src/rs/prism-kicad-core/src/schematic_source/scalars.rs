//! Bare values of one form: `direct_scalars` and a field's `[private] NAME VALUE`.

use super::{limit_error, source_error};
use crate::schematic_bundle::SchematicBundleLimits;
use crate::sexpr::{Lexer, Token, TokenKind, decode_quoted};
use crate::sexpr_projection::FormSpan;
use crate::source_bundle::SourceBundleError;
use std::borrow::Cow;

pub(crate) fn direct_scalars(
    source: &str,
    span: &FormSpan,
    maximum: usize,
    source_path: &str,
    limits: SchematicBundleLimits,
) -> Result<Vec<String>, SourceBundleError> {
    Ok(
        direct_scalar_tokens(source, span, maximum, source_path, limits, |path| {
            limit_error(path, "direct scalar count exceeds its limit")
        })?
        .into_iter()
        .map(|(_, value)| value)
        .collect(),
    )
}

/// A symbol or sheet field: `(property [private] "NAME" "VALUE" …)`.
#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct PropertyScalars {
    pub(crate) private: bool,
    pub(crate) key: String,
    pub(crate) value: String,
    /// How many of name and value the form carried (0–2); a missing one reads as "".
    pub(crate) count: usize,
}

/// Read a field's name and value. KiCad 9 added a bare `private` flag before
/// the name (`SCH_IO_KICAD_SEXPR_PARSER::parseProperty` and `parseSchField`);
/// a quoted `"private"` is an ordinary field name.
pub(crate) fn property_scalars(
    source: &str,
    span: &FormSpan,
    source_path: &str,
    limits: SchematicBundleLimits,
) -> Result<PropertyScalars, SourceBundleError> {
    // A value past `[private] NAME VALUE` is a malformed field, not a size limit.
    let values = direct_scalar_tokens(source, span, 3, source_path, limits, |path| {
        source_error(path, "property has more values than a name and a value")
    })?;
    let (private, values) = match values.split_first() {
        Some(((TokenKind::Atom, flag), rest)) if flag == "private" => (true, rest),
        _ => (false, values.as_slice()),
    };
    if values.len() > 2 {
        return Err(source_error(
            source_path,
            "property has more values than a name and a value",
        ));
    }
    let count = values.len();
    let mut values = values.iter().map(|(_, value)| value.clone());
    Ok(PropertyScalars {
        private,
        key: values.next().unwrap_or_default(),
        value: values.next().unwrap_or_default(),
        count,
    })
}

fn direct_scalar_tokens(
    source: &str,
    span: &FormSpan,
    maximum: usize,
    source_path: &str,
    limits: SchematicBundleLimits,
    overflow: impl Fn(&str) -> SourceBundleError,
) -> Result<Vec<(TokenKind, String)>, SourceBundleError> {
    let text = span
        .text(source)
        .map_err(|error| source_error(source_path, error.to_string()))?;
    let mut lexer = Lexer::new(text);
    require_header(&mut lexer, source_path)?;
    let mut depth = 1_usize;
    let mut values = Vec::new();
    for token in lexer {
        let token = token.map_err(|error| source_error(source_path, error.to_string()))?;
        match token.kind {
            TokenKind::Left => depth = depth.saturating_add(1),
            TokenKind::Right => {
                depth = depth.saturating_sub(1);
                if depth == 0 {
                    break;
                }
            }
            _ if depth == 1 => {
                if values.len() >= maximum {
                    return Err(overflow(source_path));
                }
                if token.lexeme.len() > limits.max_decoded_string_bytes.saturating_add(2) {
                    return Err(limit_error(source_path, "decoded string exceeds its limit"));
                }
                let kind = token.kind;
                let decoded = decoded(token);
                if decoded.len() > limits.max_decoded_string_bytes {
                    return Err(limit_error(source_path, "decoded string exceeds its limit"));
                }
                values.push((kind, decoded.into_owned()));
            }
            _ => {}
        }
    }
    Ok(values)
}

fn require_header(lexer: &mut Lexer<'_>, source_path: &str) -> Result<(), SourceBundleError> {
    let left = next_token(lexer, source_path)?;
    let head = next_token(lexer, source_path)?;
    if left.kind == TokenKind::Left && head.kind == TokenKind::Atom {
        Ok(())
    } else {
        Err(source_error(
            source_path,
            "selected schematic form has an invalid header",
        ))
    }
}

fn next_token<'a>(
    lexer: &mut Lexer<'a>,
    source_path: &str,
) -> Result<Token<'a>, SourceBundleError> {
    lexer
        .next()
        .transpose()
        .map_err(|error| source_error(source_path, error.to_string()))?
        .ok_or_else(|| {
            source_error(
                source_path,
                "selected schematic form ended before its header",
            )
        })
}

fn decoded(token: Token<'_>) -> Cow<'_, str> {
    if token.kind == TokenKind::QuotedString {
        Cow::Owned(decode_quoted(token.lexeme))
    } else {
        Cow::Borrowed(token.lexeme)
    }
}
