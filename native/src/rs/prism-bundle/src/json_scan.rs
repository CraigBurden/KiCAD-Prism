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
    let mut scanner = Scanner {
        text,
        max_depth,
        max_nodes,
        stack: Vec::new(),
        nodes: 0,
        expect_key: false,
    };
    let mut at = 0usize;
    while at < text.len() {
        at = scanner.step(at)?;
    }
    Ok(())
}

struct Scanner<'a> {
    text: &'a [u8],
    max_depth: usize,
    max_nodes: Option<usize>,
    stack: Vec<u8>,
    nodes: usize,
    expect_key: bool,
}

impl Scanner<'_> {
    fn count(&mut self) -> Result<(), JsonBound> {
        self.nodes += 1;
        match self.max_nodes {
            Some(limit) if self.nodes > limit => Err(JsonBound::Nodes),
            _ => Ok(()),
        }
    }

    /// Consume the token at `at`; return where the next one starts.
    fn step(&mut self, at: usize) -> Result<usize, JsonBound> {
        let byte = self.text[at];
        match byte {
            b'"' => return self.string(at),
            b'{' | b'[' => self.open(byte)?,
            b'}' | b']' => {
                self.stack.pop();
                self.expect_key = false;
            }
            b',' => self.expect_key = self.stack.last() == Some(&b'{'),
            b':' => self.expect_key = false,
            byte if byte.is_ascii_whitespace() => {}
            _ => return self.scalar(at),
        }
        Ok(at + 1)
    }

    fn string(&mut self, at: usize) -> Result<usize, JsonBound> {
        if self.expect_key {
            self.expect_key = false;
        } else {
            self.count()?;
        }
        Ok(skip_string(self.text, at + 1))
    }

    fn open(&mut self, byte: u8) -> Result<(), JsonBound> {
        self.count()?;
        if self.stack.len() >= self.max_depth {
            return Err(JsonBound::Depth);
        }
        self.stack.push(byte);
        self.expect_key = byte == b'{';
        Ok(())
    }

    fn scalar(&mut self, at: usize) -> Result<usize, JsonBound> {
        self.count()?;
        let ends = |byte: &u8| {
            matches!(byte, b',' | b']' | b'}' | b':' | b'"') || byte.is_ascii_whitespace()
        };
        let length = self.text[at..]
            .iter()
            .position(ends)
            .unwrap_or(self.text.len() - at);
        Ok(at + length.max(1))
    }
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
