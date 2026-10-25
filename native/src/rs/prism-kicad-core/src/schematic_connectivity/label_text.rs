//! A label's connection name: KiCad names a label's net from its shown text,
//! unescaped (`UnescapeString`) and escaped again for net names
//! (`SCH_LABEL_BASE::GetShownText`, `EscapeString(…, CTX_NETNAME)`), so a
//! label written `A/B` and one written `A{slash}B` name one net. The net name
//! writers escape `/` again.

/// `text` with KiCad's `{token}` escapes replaced by their characters
/// (common/string_utils.cpp `UnescapeString`).
pub(crate) fn unescape(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    let mut out = String::with_capacity(text.len());
    let mut index = 0;
    let mut previous = None;
    while index < chars.len() {
        let character = chars[index];
        if character != '{' {
            out.push(character);
            previous = Some(character);
            index += 1;
            continue;
        }
        let mut depth = 1;
        let mut end = index + 1;
        while end < chars.len() {
            match chars[end] {
                '{' => depth += 1,
                '}' => depth -= 1,
                _ => {}
            }
            if depth == 0 {
                break;
            }
            end += 1;
        }
        let token: String = chars[index + 1..end.min(chars.len())].iter().collect();
        if end >= chars.len() {
            out.push('{');
            out.push_str(&unescape(&token));
        } else if matches!(previous, Some('$' | '~' | '^' | '_')) {
            out.push('{');
            out.push_str(&unescape(&token));
            out.push('}');
        } else if let Some(replacement) = replacement(&token) {
            out.push(replacement);
        } else {
            out.push('{');
            out.push_str(&unescape(&token));
            out.push('}');
        }
        previous = chars.get(end).copied();
        index = end + 1;
    }
    out
}

/// KiCad's escape tokens and the characters they stand for.
const ESCAPES: [(&str, char); 14] = [
    ("dblquote", '"'),
    ("quote", '\''),
    ("lt", '<'),
    ("gt", '>'),
    ("backslash", '\\'),
    ("slash", '/'),
    ("bar", '|'),
    ("comma", ','),
    ("colon", ':'),
    ("space", ' '),
    ("dollar", '$'),
    ("tab", '\t'),
    ("return", '\n'),
    ("brace", '{'),
];

fn replacement(token: &str) -> Option<char> {
    ESCAPES
        .iter()
        .find(|(name, _)| *name == token)
        .map(|(_, character)| *character)
}

#[cfg(test)]
mod tests {
    use super::unescape;

    #[test]
    fn escapes_become_their_characters_and_formatting_stays() {
        assert_eq!(unescape("VPP{slash}MCLR"), "VPP/MCLR");
        assert_eq!(unescape("A{colon}B{space}C"), "A:B C");
        assert_eq!(unescape("~{RESET}"), "~{RESET}");
        assert_eq!(unescape("BUS{A B}"), "BUS{A B}");
        assert_eq!(unescape("D{open"), "D{open");
        assert_eq!(unescape("x{a{slash}b}"), "x{a/b}");
    }
}
