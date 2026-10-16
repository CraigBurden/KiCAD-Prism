//! A bounded pre-scan of untrusted JSON text.
//!
//! The workspace builds `serde_json` with `unbounded_depth`, so a deeply
//! nested document would overflow the stack while parsing. Every JSON input
//! that does not come from this binary (`bundle.json`, `--config`,
//! `--key-record`, JSON members being verified) is scanned first: nesting
//! depth against `max-json-depth` and, where it applies, the number of values
//! against `max-json-nodes` (cli-spec.md §7.2). The scan does not validate the
//! grammar; `serde_json` does that afterwards with its own error positions.

/// What the scan found over a limit.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JsonBound {
    /// Nesting deeper than the depth limit.
    Depth,
    /// More values than the node limit.
    Nodes,
}

/// Scan `text` for nesting depth (`max_depth`, the root at depth 1) and the
/// number of values (`max_nodes`, `None` for no node limit). Object keys are
/// not values.
pub fn scan(text: &[u8], max_depth: usize, max_nodes: Option<usize>) -> Result<(), JsonBound> {
    let mut stack: Vec<u8> = Vec::new();
    let mut nodes = 0usize;
    let mut at = 0usize;
    let mut expect_key = false;
    let mut count = || -> Result<(), JsonBound> {
        nodes += 1;
        match max_nodes {
            Some(limit) if nodes > limit => Err(JsonBound::Nodes),
            _ => Ok(()),
        }
    };
    while at < text.len() {
        let byte = text[at];
        match byte {
            b'"' => {
                at = skip_string(text, at + 1);
                if expect_key {
                    expect_key = false;
                } else {
                    count()?;
                }
                continue;
            }
            b'{' | b'[' => {
                count()?;
                if stack.len() >= max_depth {
                    return Err(JsonBound::Depth);
                }
                stack.push(byte);
                expect_key = byte == b'{';
            }
            b'}' | b']' => {
                stack.pop();
                expect_key = false;
            }
            b',' => expect_key = stack.last() == Some(&b'{'),
            b':' => expect_key = false,
            byte if byte.is_ascii_whitespace() => {}
            _ => {
                count()?;
                while at + 1 < text.len()
                    && !matches!(text[at + 1], b',' | b']' | b'}' | b':' | b'"')
                    && !text[at + 1].is_ascii_whitespace()
                {
                    at += 1;
                }
            }
        }
        at += 1;
    }
    Ok(())
}

fn skip_string(text: &[u8], mut at: usize) -> usize {
    while at < text.len() {
        match text[at] {
            b'\\' => at += 2,
            b'"' => return at + 1,
            _ => at += 1,
        }
    }
    at
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_depth_and_values() {
        assert_eq!(scan(br#"{"a":[1,2,{"b":"x"}]}"#, 3, Some(6)), Ok(()));
        assert_eq!(
            scan(br#"{"a":[1,2,{"b":"x"}]}"#, 2, None),
            Err(JsonBound::Depth)
        );
        assert_eq!(
            scan(br#"{"a":[1,2,{"b":"x"}]}"#, 3, Some(5)),
            Err(JsonBound::Nodes)
        );
        assert_eq!(scan(br#"["[[[","\"[["]"#, 1, Some(3)), Ok(()));
        let deep = "[".repeat(100_000);
        assert_eq!(scan(deep.as_bytes(), 256, None), Err(JsonBound::Depth));
    }
}
