//! `contentDigest`: the canonical-text digest of one KiCad form (field map,
//! "contentDigest"), a port of the reference
//! `native/parity/prism_parity/capture/board_objects_sexpr.mjs:81-249`.

use super::tree::Node;
use super::units::json_string;
use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;

/// A digest index over one document's forms: canonical uuid → (byte offset of
/// the form, digest). A later form with the same uuid wins
/// (`board_objects_sexpr.mjs:69-79`).
#[derive(Debug, Default)]
pub struct DigestIndex {
    map: BTreeMap<String, (usize, String)>,
}

impl DigestIndex {
    /// The digest and offset of the object with `uuid`, if it was indexed.
    #[must_use]
    pub fn get(&self, uuid: &str) -> Option<(usize, &str)> {
        self.map
            .get(uuid)
            .map(|(start, digest)| (*start, digest.as_str()))
    }
}

/// Index every form of `root` (the file's single top-level form) whose id is a
/// canonical uuid and whose head has an allow-list.
#[must_use]
pub fn index(root: &Node, board: bool) -> DigestIndex {
    let net_table = if board {
        net_table(root)
    } else {
        BTreeMap::new()
    };
    let context = Context { board, net_table };
    let mut index = DigestIndex::default();
    walk(root, None, &context, &mut index);
    index
}

struct Context {
    board: bool,
    net_table: BTreeMap<String, String>,
}

fn walk(node: &Node, parent_head: Option<&str>, context: &Context, index: &mut DigestIndex) {
    let Node::List { items, start } = node else {
        return;
    };
    if let Some(id) = identity_of(node) {
        if is_canonical_uuid(&id) {
            if let Some(allow) = allow_for(node, parent_head, context.board) {
                let text = canonical_text(node, &allow, context);
                index.map.insert(id, (*start, sha256_16(&text)));
            }
        }
    }
    let head = node.head().map(str::to_owned);
    for child in items {
        walk(child, head.as_deref(), context, index);
    }
}

/// The object's own id: its direct `(uuid …)`, else `(tstamp …)`
/// (`board_objects_sexpr.mjs:59-66`).
fn identity_of(node: &Node) -> Option<String> {
    for key in ["uuid", "tstamp"] {
        if let Some(child) = node.child(key) {
            let items = child.items()?;
            if let Some(value) = items.get(1).and_then(Node::text) {
                return Some(value.to_owned());
            }
        }
    }
    None
}

fn allow_for(
    form: &Node,
    parent_head: Option<&str>,
    board: bool,
) -> Option<BTreeSet<&'static str>> {
    let head = form.head()?;
    match head {
        "arc" => Some(if board { set(BOARD_ARC) } else { set(SCH_ARC) }),
        "pin" => Some(if parent_head == Some("sheet") {
            set(SHEET_PIN)
        } else {
            set(SYMBOL_PIN)
        }),
        "module" => Some(set(FOOTPRINT)),
        _ => allow_list(head),
    }
}

fn set(list: &'static str) -> BTreeSet<&'static str> {
    list.split_whitespace().collect()
}

fn allow_list(head: &str) -> Option<BTreeSet<&'static str>> {
    let list = match head {
        "footprint" => FOOTPRINT,
        "pad" => PAD,
        "zone" => ZONE,
        "fp_line" | "gr_line" => LINE,
        "fp_circle" | "gr_circle" => CIRCLE,
        "fp_arc" | "gr_arc" => ARC,
        "fp_poly" | "gr_poly" => POLY,
        "fp_rect" | "gr_rect" => RECT,
        "fp_text" => FP_TEXT,
        "gr_text" => GR_TEXT,
        "dimension" => DIMENSION,
        "segment" => SEGMENT,
        "via" => VIA,
        "group" => GROUP,
        "symbol" => SYMBOL,
        "sheet" => SHEET,
        "wire" | "bus" => WIRE,
        "bus_entry" => BUS_ENTRY,
        "junction" => JUNCTION,
        "no_connect" => NO_CONNECT,
        "label" => LABEL,
        "global_label" => GLOBAL_LABEL,
        "hierarchical_label" => HIERARCHICAL_LABEL,
        "polyline" | "bezier" => BEZIER,
        "rectangle" => RECTANGLE,
        "circle" => CIRCLE_SCH,
        "text" => TEXT,
        "text_box" => TEXT_BOX,
        "image" => IMAGE,
        "table" => TABLE,
        _ => return None,
    };
    Some(set(list))
}

const FOOTPRINT: &str = "version embedded_fonts generator locked placed layer tedit at descr tags sheetname sheetfile path autoplace_cost90 autoplace_cost180 solder_mask_margin solder_paste_margin solder_paste_ratio clearance zone_connect thermal_width thermal_gap attr variant property model";
const PAD: &str = "locked at size rect_delta layers remove_unused_layers keep_end_layers roundrect_rratio chamfer_ratio chamfer pinfunction pintype die_length solder_mask_margin solder_paste_margin solder_paste_margin_ratio clearance thermal_width thermal_gap thermal_bridge_angle zone_connect drill net options primitives";
const ZONE: &str = "locked net net_name name layer layers hatch priority connect_pads min_thickness filled_areas_thickness keepout fill polygon";
const LINE: &str = "layer locked start end width stroke";
const CIRCLE: &str = "layer locked center end width fill stroke";
const ARC: &str = "layer locked start mid end angle width stroke";
const POLY: &str = "layer locked pts width fill island stroke";
const RECT: &str = "layer locked start end width fill stroke";
const FP_TEXT: &str = "locked at hide unlocked layer effects";
const GR_TEXT: &str = "at layer unlocked hide locked effects";
const DIMENSION: &str = "locked layer pts height orientation leader_length gr_text format style";
const SEGMENT: &str = "start end width layer net locked";
const VIA: &str = "at size drill layers remove_unused_layers keep_end_layers locked free net";
const GROUP: &str = "locked members";
const SYMBOL: &str = "lib_name lib_id at mirror exclude_from_sim unit convert body_style in_bom on_board in_pos_files dnp property default_instance instances";
const SHEET: &str = "at size exclude_from_sim in_bom on_board dnp stroke fill property instances";
const WIRE: &str = "pts stroke";
const BUS_ENTRY: &str = "at size stroke";
const JUNCTION: &str = "at diameter color";
const NO_CONNECT: &str = "at";
const LABEL: &str = "at effects";
const GLOBAL_LABEL: &str = "at effects shape property";
const HIERARCHICAL_LABEL: &str = "at effects shape";
const BEZIER: &str = "pts stroke fill";
const RECTANGLE: &str = "start end stroke fill";
const CIRCLE_SCH: &str = "center radius stroke fill";
const TEXT: &str = "at effects exclude_from_sim";
const TEXT_BOX: &str = "at size effects stroke fill exclude_from_sim margins";
const IMAGE: &str = "at scale data";
const TABLE: &str = "column_count border separators column_widths row_heights cells";
const BOARD_ARC: &str = "start mid end width layer net locked";
const SCH_ARC: &str = "start mid end radius stroke fill";
const SYMBOL_PIN: &str = "alternate";
const SHEET_PIN: &str = "at effects";

const IDENTITY: [&str; 2] = ["uuid", "tstamp"];
const GENERATED: [&str; 3] = ["fields_autoplaced", "filled_polygon", "render_cache"];
const NET_CARRIERS: [&str; 5] = ["pad", "segment", "arc", "via", "zone"];
const FOOTPRINT_CHILDREN: [&str; 8] = [
    "pad",
    "zone",
    "fp_line",
    "fp_circle",
    "fp_arc",
    "fp_poly",
    "fp_rect",
    "fp_text",
];

fn child_object_heads(head: &str) -> &'static [&'static str] {
    match head {
        "footprint" | "module" => &FOOTPRINT_CHILDREN,
        "symbol" => &["pin"],
        "sheet" => &["pin"],
        _ => &[],
    }
}

fn canonical_text(form: &Node, allow: &BTreeSet<&str>, context: &Context) -> String {
    let children = child_object_heads(form.head().unwrap_or_default());
    // Step 1: keep only the allowed direct child lists (and child objects).
    let mut kept: Vec<&Node> = Vec::new();
    if let Some(items) = form.items() {
        for (position, child) in items.iter().enumerate() {
            if position == 0 || matches!(child, Node::Atom(_) | Node::Str(_)) {
                kept.push(child);
                continue;
            }
            let head = child.head().unwrap_or_default();
            if allow.contains(head) || children.contains(&head) {
                kept.push(child);
            }
        }
    }
    emit_children(kept, form, context, 0, &[])
}

/// `emit(node, depth, path)` (`board_objects_sexpr.mjs:129-156`).
fn emit(node: &Node, context: &Context, depth: usize, path: &[&str]) -> String {
    match node {
        Node::Str(value) => json_string(value),
        Node::Atom(value) => {
            if is_number_token(value) {
                canonical_number(value)
            } else {
                value.clone()
            }
        }
        Node::List { items, .. } => emit_children(items.iter(), node, context, depth, path),
    }
}

/// Emit a list's children; `form` is the list itself (a zone needs its own
/// `(net_name …)`).
fn emit_children<'a>(
    items: impl IntoIterator<Item = &'a Node>,
    form: &Node,
    context: &Context,
    depth: usize,
    path: &[&str],
) -> String {
    let head = form.head().unwrap_or_default();
    let children = child_object_heads(head);
    let mut parts: Vec<String> = Vec::new();
    for child in items {
        let Node::List { .. } = child else {
            parts.push(emit(child, context, depth + 1, path));
            continue;
        };
        let child_head = child.head().unwrap_or_default();
        if IDENTITY.contains(&child_head) || GENERATED.contains(&child_head) {
            continue;
        }
        if child_head == "page" && head == "path" && path.contains(&"instances") {
            continue;
        }
        if depth == 0 && child_head == "net" && NET_CARRIERS.contains(&head) {
            let name = resolve_net(child, form, context);
            if !name.is_empty() {
                parts.push(format!("(net {})", json_string(&name)));
            }
            continue;
        }
        if depth == 0 && children.contains(&child_head) {
            match child_object_id(child) {
                Some(id) => parts.push(format!("({child_head} {})", json_string(&id))),
                None => parts.push(format!("({child_head})")),
            }
            continue;
        }
        let mut extended = path.to_vec();
        extended.push(head);
        parts.push(emit(child, context, depth + 1, &extended));
    }
    format!("({})", parts.join(" "))
}

fn child_object_id(node: &Node) -> Option<String> {
    let id = identity_of(node)?;
    is_canonical_uuid(&id).then_some(id)
}

/// Step 3 (`board_objects_sexpr.mjs:161-184`). `form` is the object's own
/// form, so a zone can prefer its `(net_name …)`.
fn resolve_net(net_node: &Node, form: &Node, context: &Context) -> String {
    if form.head() == Some("zone") {
        if let Some(name) = form
            .child("net_name")
            .and_then(|child| child.items())
            .and_then(|items| items.get(1))
            .and_then(Node::text)
        {
            if !name.is_empty() {
                return name.to_owned();
            }
        }
    }
    let items = net_node.items().unwrap_or_default();
    let first = items.get(1);
    let second = items.get(2);
    if let Some(Node::Atom(value)) = first {
        if is_number_token(value) {
            let named = second.and_then(Node::text).unwrap_or_default();
            if !named.is_empty() {
                return named.to_owned();
            }
            return context
                .net_table
                .get(&canonical_number(value))
                .cloned()
                .unwrap_or_default();
        }
    }
    if let Some(value) = first.and_then(Node::text) {
        return value.to_owned();
    }
    String::new()
}

fn net_table(root: &Node) -> BTreeMap<String, String> {
    let mut table = BTreeMap::new();
    for child in root.items().unwrap_or_default() {
        if child.head() != Some("net") {
            continue;
        }
        let items = child.items().unwrap_or_default();
        if let Some(Node::Atom(code)) = items.get(1) {
            if is_number_token(code) {
                let name = items.get(2).and_then(Node::text).unwrap_or_default();
                table.insert(canonical_number(code), name.to_owned());
            }
        }
    }
    table
}

/// `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$` (`board_objects_sexpr.mjs:82`).
#[must_use]
pub fn is_number_token(text: &str) -> bool {
    let bytes = text.as_bytes();
    let mut index = usize::from(matches!(bytes.first(), Some(b'+' | b'-')));
    if index >= bytes.len() {
        return false;
    }
    let before = consume_digits(bytes, &mut index);
    let mut after = 0;
    if index < bytes.len() && bytes[index] == b'.' {
        index += 1;
        after = consume_digits(bytes, &mut index);
    }
    if before == 0 && after == 0 {
        return false;
    }
    if index < bytes.len() && matches!(bytes[index], b'e' | b'E') {
        index += 1;
        if index < bytes.len() && matches!(bytes[index], b'+' | b'-') {
            index += 1;
        }
        if consume_digits(bytes, &mut index) == 0 {
            return false;
        }
    }
    index == bytes.len()
}

fn consume_digits(bytes: &[u8], index: &mut usize) -> usize {
    let start = *index;
    while *index < bytes.len() && bytes[*index].is_ascii_digit() {
        *index += 1;
    }
    *index - start
}

/// Exact decimal value of a numeric atom, no exponent, no superfluous zeros,
/// `0` for any zero (`board_objects_sexpr.mjs:84-109`).
#[must_use]
pub fn canonical_number(text: &str) -> String {
    let mut body = text;
    let mut sign = "";
    if let Some(rest) = body.strip_prefix('-') {
        sign = "-";
        body = rest;
    } else if let Some(rest) = body.strip_prefix('+') {
        body = rest;
    }
    let mut exponent = 0i64;
    if let Some(position) = body.find(['e', 'E']) {
        exponent = body[position + 1..].parse::<i64>().unwrap_or(0);
        body = &body[..position];
    }
    let (int, frac) = body.split_once('.').unwrap_or((body, ""));
    let all = format!("{int}{frac}");
    let lead = all.len() - all.trim_start_matches('0').len();
    let point = int.len() as i64 - lead as i64 + exponent;
    let digits = all[lead..].trim_end_matches('0');
    if digits.is_empty() {
        return "0".to_owned();
    }
    let mut out = String::new();
    if point <= 0 {
        out.push_str("0.");
        for _ in 0..-point {
            out.push('0');
        }
        out.push_str(digits);
    } else if point as usize >= digits.len() {
        out.push_str(digits);
        for _ in 0..(point as usize - digits.len()) {
            out.push('0');
        }
    } else {
        out.push_str(&digits[..point as usize]);
        out.push('.');
        out.push_str(&digits[point as usize..]);
    }
    format!("{sign}{out}")
}

const UUID_HEX: [u8; 5] = [8, 4, 4, 4, 12];

/// Whether `text` is a canonical KiCad uuid (`capture/board_objects.py:46`).
#[must_use]
pub fn is_canonical_uuid(text: &str) -> bool {
    let parts: Vec<&str> = text.split('-').collect();
    parts.len() == UUID_HEX.len()
        && parts.iter().zip(UUID_HEX).all(|(part, length)| {
            part.len() == usize::from(length)
                && part
                    .bytes()
                    .all(|byte| byte.is_ascii_hexdigit() && !byte.is_ascii_uppercase())
        })
}

fn sha256_16(text: &str) -> String {
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(text.as_bytes());
    let digest = hasher.finalize();
    let mut out = String::with_capacity(16);
    for byte in digest.iter().take(8) {
        let _ = write!(out, "{byte:02x}");
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::board_objects::tree;

    #[test]
    fn numbers_canonicalize_exactly() {
        assert_eq!(canonical_number("1.0"), "1");
        assert_eq!(canonical_number("1"), "1");
        assert_eq!(canonical_number("1.000"), "1");
        assert_eq!(canonical_number("-0"), "0");
        assert_eq!(canonical_number("0.100"), "0.1");
        assert_eq!(canonical_number("1e3"), "1000");
        assert_eq!(canonical_number("+0.5"), "0.5");
        assert_eq!(canonical_number("0.000"), "0");
    }

    #[test]
    fn number_tokens_follow_the_reference_regex() {
        assert!(is_number_token("1"));
        assert!(is_number_token("-1."));
        assert!(is_number_token(".5"));
        assert!(is_number_token("1E-3"));
        assert!(!is_number_token("1.2.3"));
        assert!(!is_number_token("abc"));
    }

    #[test]
    fn canonical_uuids_reject_non_canonical_ids() {
        assert!(is_canonical_uuid("00000000-0000-0000-0000-000000000000"));
        assert!(!is_canonical_uuid("aaaa-0201"));
        assert!(!is_canonical_uuid("00000000-0000-0000-0000-00000000000A"));
    }

    fn digest_of(text: &str, board: bool) -> DigestIndex {
        let roots = tree::parse(text);
        let root = roots.into_iter().next().unwrap();
        index(&root, board)
    }

    #[test]
    fn a_symbol_pin_becomes_a_reference_at_any_depth() {
        // A child `fields_autoplaced` list is dropped; the pin is referenced by
        // its uuid.
        let text = "(kicad_sch\n (symbol (lib_id \"a\") (uuid \"00000000-0000-0000-0000-000000000001\") \
                    (fields_autoplaced) (pin \"1\" (uuid \"00000000-0000-0000-0000-000000000002\"))))";
        let index = digest_of(text, false);
        assert!(index.get("00000000-0000-0000-0000-000000000001").is_some());
        assert!(index.get("00000000-0000-0000-0000-000000000002").is_some());
        // The pin's canonical text keeps its number and drops the uuid.
        let (_, pin) = index.get("00000000-0000-0000-0000-000000000002").unwrap();
        assert_eq!(pin, &sha256_16("(pin \"1\")"));
    }
}
