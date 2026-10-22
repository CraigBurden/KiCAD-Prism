//! KiCad's bus group syntax (`PREFIX{A B C}`): parsing a group label into
//! its prefix and members.

use super::*;

pub(super) fn parse_group_syntax(
    text: &str,
    limits: SchematicBusExpansionLimits,
    collect_members: bool,
) -> Result<Option<SchematicBusPattern>, SchematicBusExpansionError> {
    let characters = text.chars().collect::<Vec<_>>();
    if characters.len() < 3 {
        return Ok(None);
    }
    let Some((prefix, index)) = parse_group_prefix(&characters, text.len()) else {
        return Ok(None);
    };
    parse_group_members(&characters, index + 1, prefix, limits, collect_members)
}

fn parse_group_prefix(characters: &[char], capacity: usize) -> Option<(String, usize)> {
    let mut prefix = String::with_capacity(capacity);
    let mut index = 0_usize;
    let mut brace_nesting = 0_i64;
    let mut in_quotes = false;
    while index < characters.len() {
        if let Some(next) = consume_quoted_character(characters, index, &mut in_quotes, &mut prefix)
        {
            index = next;
            continue;
        }
        let action = group_prefix_action(characters, index);
        if matches!(action, PrefixAction::EscapedSpace) {
            index += 1;
        }
        match apply_group_prefix_action(action, &mut prefix, &mut brace_nesting) {
            ScanControl::Continue => {}
            ScanControl::Stop => break,
            ScanControl::Invalid => return None,
        }
        index += 1;
    }
    (index < characters.len() && characters[index] == '{' && brace_nesting == 0 && !in_quotes)
        .then_some((prefix, index))
}

fn apply_group_prefix_action(
    action: PrefixAction,
    prefix: &mut String,
    brace_nesting: &mut i64,
) -> ScanControl {
    match action {
        PrefixAction::OpenFormat => {
            *brace_nesting += 1;
            prefix.push('{');
            ScanControl::Continue
        }
        PrefixAction::CloseFormat if *brace_nesting > 0 => {
            *brace_nesting -= 1;
            prefix.push('}');
            ScanControl::Continue
        }
        PrefixAction::EscapedSpace => {
            prefix.push(' ');
            ScanControl::Continue
        }
        PrefixAction::Delimiter => ScanControl::Stop,
        PrefixAction::Push(character) => {
            prefix.push(character);
            ScanControl::Continue
        }
        PrefixAction::CloseFormat | PrefixAction::Invalid => ScanControl::Invalid,
        PrefixAction::Separator => unreachable!("group prefix separator"),
    }
}

fn group_prefix_action(characters: &[char], index: usize) -> PrefixAction {
    match characters[index] {
        '{' if index > 0 && is_format_marker(characters[index - 1]) => PrefixAction::OpenFormat,
        '{' => PrefixAction::Delimiter,
        '}' => PrefixAction::CloseFormat,
        '\\' if characters.get(index + 1) == Some(&' ') => PrefixAction::EscapedSpace,
        ' ' | '[' | ']' => PrefixAction::Invalid,
        character => PrefixAction::Push(character),
    }
}

fn parse_group_members(
    characters: &[char],
    mut index: usize,
    prefix: String,
    limits: SchematicBusExpansionLimits,
    collect_members: bool,
) -> Result<Option<SchematicBusPattern>, SchematicBusExpansionError> {
    let mut members = Vec::new();
    let mut member_count = 0_usize;
    let mut retained_bytes = 0_usize;
    let mut member = String::new();
    let mut in_quotes = false;
    let mut brace_nesting = 0_i64;
    while index < characters.len() {
        if let Some(next) = consume_quoted_character(characters, index, &mut in_quotes, &mut member)
        {
            index = next;
            continue;
        }
        match group_member_action(characters, index, brace_nesting) {
            PrefixAction::OpenFormat => {
                brace_nesting += 1;
                member.push('{');
            }
            PrefixAction::CloseFormat => {
                brace_nesting -= 1;
                member.push('}');
            }
            PrefixAction::Delimiter => {
                push_group_member(
                    &mut members,
                    &mut member_count,
                    &mut retained_bytes,
                    &mut member,
                    limits,
                    collect_members,
                )?;
                return Ok(finish_group(
                    prefix,
                    members,
                    member_count,
                    index + 1,
                    characters.len(),
                ));
            }
            PrefixAction::EscapedSpace => {
                member.push(' ');
                index += 1;
            }
            PrefixAction::Separator => push_group_member(
                &mut members,
                &mut member_count,
                &mut retained_bytes,
                &mut member,
                limits,
                collect_members,
            )?,
            PrefixAction::Push(character) => member.push(character),
            PrefixAction::Invalid => return Ok(None),
        }
        index += 1;
    }
    Ok(None)
}

fn finish_group(
    prefix: String,
    members: Vec<String>,
    member_count: usize,
    index: usize,
    length: usize,
) -> Option<SchematicBusPattern> {
    (index == length && member_count > 0).then_some(SchematicBusPattern { prefix, members })
}

fn group_member_action(characters: &[char], index: usize, brace_nesting: i64) -> PrefixAction {
    match characters[index] {
        '{' if index > 0 && is_format_marker(characters[index - 1]) => PrefixAction::OpenFormat,
        '{' => PrefixAction::Invalid,
        '}' if brace_nesting > 0 => PrefixAction::CloseFormat,
        '}' => PrefixAction::Delimiter,
        '\\' if characters.get(index + 1) == Some(&' ') => PrefixAction::EscapedSpace,
        ' ' | ',' => PrefixAction::Separator,
        character => PrefixAction::Push(character),
    }
}

pub(super) fn consume_quoted_character(
    characters: &[char],
    index: usize,
    in_quotes: &mut bool,
    output: &mut String,
) -> Option<usize> {
    let character = characters[index];
    if character == '"' && !is_escaped(characters, index) {
        *in_quotes = !*in_quotes;
        return Some(index + 1);
    }
    if !*in_quotes {
        return None;
    }
    let value_index = if character == '\\' && index + 1 < characters.len() {
        index + 1
    } else {
        index
    };
    output.push(characters[value_index]);
    Some(value_index + 1)
}

fn push_group_member(
    members: &mut Vec<String>,
    member_count: &mut usize,
    retained_bytes: &mut usize,
    member: &mut String,
    limits: SchematicBusExpansionLimits,
    collect_member: bool,
) -> Result<(), SchematicBusExpansionError> {
    if member.is_empty() {
        return Ok(());
    }
    if *member_count >= limits.max_group_members {
        return Err(resource_error("bus member count exceeds its limit"));
    }
    if !collect_member {
        *member_count += 1;
        member.clear();
        return Ok(());
    }
    let next_bytes = retained_bytes
        .checked_add(escaped_net_name_bytes(member)?)
        .ok_or_else(|| resource_error("bus member bytes overflowed"))?;
    if next_bytes > limits.max_parsed_member_bytes {
        return Err(resource_error("bus member bytes exceed their limit"));
    }
    let escaped = escape_net_name(member);
    member.clear();
    *member_count += 1;
    *retained_bytes = next_bytes;
    members.push(escaped);
    Ok(())
}
