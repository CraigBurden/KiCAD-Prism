//! `contentDigest`: the canonical-text digest of one KiCad form (field map,
//! "contentDigest"), a port of the reference
//! `native/parity/prism_parity/capture/board_objects_sexpr.mjs:81-249`.
//!
//! The canonical text is never materialized: the walk feeds the SHA-256 state
//! directly, so an object's digest costs one hash, not a `String` plus a hash.

use super::tree::Node;
use std::collections::BTreeMap;
use std::fmt::Write as _;

/// A digest index over one document's forms: canonical uuid → (byte offset of
/// the form, digest). A later form with the same uuid wins
/// (`board_objects_sexpr.mjs:69-79`) — including a nested form that shares a
/// uuid with the object that contains it, as a `dimension` and its `gr_text`
/// do, so the digest is indexed by a whole-tree walk, not at emission.
///
/// The index is filled one top-level item at a time ([`DigestIndex::add`]), so
/// a board is never held as one tree. An item's forms are indexed before its
/// objects read their digest, and an object's own item is the one that holds
/// its uuid, so a document's index is the same either way.
#[derive(Debug, Default)]
pub struct DigestIndex {
    map: BTreeMap<String, (usize, String)>,
    board: bool,
    net_table: BTreeMap<String, String>,
}

impl DigestIndex {
    /// An empty index: `board` selects the board allow-lists and `net_table`
    /// resolves a board's `(net <code>)` references.
    #[must_use]
    pub fn new(board: bool, net_table: BTreeMap<String, String>) -> Self {
        Self {
            map: BTreeMap::new(),
            board,
            net_table,
        }
    }

    /// Index every form of `node`, one top-level item of a document.
    pub fn add(&mut self, node: &Node<'_>) {
        let context = Context {
            board: self.board,
            net_table: &self.net_table,
        };
        walk(node, None, &context, &mut self.map);
    }

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
pub fn index(root: &Node<'_>, board: bool) -> DigestIndex {
    let net_table = if board {
        net_table(root.children("net"))
    } else {
        BTreeMap::new()
    };
    let mut index = DigestIndex::new(board, net_table);
    index.add(root);
    index
}

fn walk(
    node: &Node<'_>,
    parent_head: Option<&str>,
    context: &Context<'_>,
    map: &mut BTreeMap<String, (usize, String)>,
) {
    let Node::List { items, start } = node else {
        return;
    };
    if let Some(id) = identity_of(node)
        && is_canonical_uuid(id)
        && let Some(digest) = object_digest(node, parent_head, context)
    {
        map.insert(id.to_owned(), (*start, digest));
    }
    let head = node.head();
    for child in items {
        walk(child, head, context, map);
    }
}

/// The document context a digest needs: whether it is a board, and the board's
/// `(net <code> "<name>")` table.
struct Context<'a> {
    board: bool,
    net_table: &'a BTreeMap<String, String>,
}

/// The `contentDigest` of one object form, or `None` when its head has no
/// allow-list. `parent_head` distinguishes a sheet `pin` from a symbol `pin`.
fn object_digest(
    node: &Node<'_>,
    parent_head: Option<&str>,
    context: &Context<'_>,
) -> Option<String> {
    let (allow, children) = allow_for(node, parent_head, context.board)?;
    Some(digest_form(node, allow, children, context))
}

/// The object's own id: its direct `(uuid …)`, else `(tstamp …)`
/// (`board_objects_sexpr.mjs:59-66`).
fn identity_of<'n, 'a>(node: &'n Node<'a>) -> Option<&'n str> {
    for key in IDENTITY {
        if let Some(child) = node.child(key)
            && let Some(value) = child
                .items()
                .and_then(|items| items.get(1))
                .and_then(Node::text)
        {
            return Some(value);
        }
    }
    None
}

/// The allow-list of a form, or `None` when its head is not an object head.
fn allow_for(
    form: &Node<'_>,
    parent_head: Option<&str>,
    board: bool,
) -> Option<(&'static str, &'static [&'static str])> {
    let head = form.head()?;
    let allow = match head {
        "arc" => {
            if board {
                BOARD_ARC
            } else {
                SCH_ARC
            }
        }
        "pin" => {
            if parent_head == Some("sheet") {
                SHEET_PIN
            } else {
                SYMBOL_PIN
            }
        }
        "module" => FOOTPRINT,
        _ => allow_list(head)?,
    };
    Some((allow, child_object_heads(head)))
}

fn allow_list(head: &str) -> Option<&'static str> {
    ALLOW_TABLE
        .iter()
        .find(|(name, _)| *name == head)
        .map(|(_, list)| *list)
}

/// The allow-lists of the field map's table, by form head.
const ALLOW_TABLE: &[(&str, &str)] = &[
    ("footprint", FOOTPRINT),
    ("pad", PAD),
    ("zone", ZONE),
    ("fp_line", LINE),
    ("gr_line", LINE),
    ("fp_circle", CIRCLE),
    ("gr_circle", CIRCLE),
    ("fp_arc", ARC),
    ("gr_arc", ARC),
    ("fp_poly", POLY),
    ("gr_poly", POLY),
    ("fp_rect", RECT),
    ("gr_rect", RECT),
    ("fp_text", FP_TEXT),
    ("gr_text", GR_TEXT),
    ("dimension", DIMENSION),
    ("segment", SEGMENT),
    ("via", VIA),
    ("group", GROUP),
    ("symbol", SYMBOL),
    ("sheet", SHEET),
    ("wire", WIRE),
    ("bus", WIRE),
    ("bus_entry", BUS_ENTRY),
    ("junction", JUNCTION),
    ("no_connect", NO_CONNECT),
    ("label", LABEL),
    ("global_label", GLOBAL_LABEL),
    ("hierarchical_label", HIERARCHICAL_LABEL),
    ("polyline", BEZIER),
    ("bezier", BEZIER),
    ("rectangle", RECTANGLE),
    ("circle", CIRCLE_SCH),
    ("text", TEXT),
    ("text_box", TEXT_BOX),
    ("image", IMAGE),
    ("table", TABLE),
];

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

/// Whether `list` (a space-separated head list) contains `head`.
fn list_contains(list: &str, head: &str) -> bool {
    list.split_whitespace().any(|word| word == head)
}

/// The SHA-256 sink the canonical text is streamed into.
trait Canon {
    fn raw(&mut self, text: &str);
    fn byte(&mut self, byte: u8);
}

impl Canon for sha2::Sha256 {
    fn raw(&mut self, text: &str) {
        use sha2::Digest as _;
        self.update(text.as_bytes());
    }
    fn byte(&mut self, byte: u8) {
        use sha2::Digest as _;
        self.update([byte]);
    }
}

/// The digest of one object form: SHA-256 of its canonical text, first 16 hex
/// digits.
fn digest_form(
    form: &Node<'_>,
    allow: &'static str,
    children: &'static [&'static str],
    context: &Context<'_>,
) -> String {
    use sha2::Digest as _;
    let mut hasher = sha2::Sha256::new();
    write_form(&mut hasher, form, allow, children, context);
    hex16(&hasher.finalize())
}

/// Step 1: keep only the allowed direct child lists (and child objects), then
/// emit the form.
fn write_form<'n, 'a, S: Canon>(
    sink: &mut S,
    form: &'n Node<'a>,
    allow: &'static str,
    children: &'static [&'static str],
    context: &Context<'_>,
) {
    sink.byte(b'(');
    let mut first = true;
    for (position, child) in form.items().unwrap_or_default().iter().enumerate() {
        if position != 0
            && matches!(child, Node::List { .. })
            && !list_contains(allow, child.head().unwrap_or_default())
            && !children.contains(&child.head().unwrap_or_default())
        {
            continue;
        }
        write_piece(sink, child, form, context, 0, &[], &mut first);
    }
    sink.byte(b')');
}

/// Emit a list's children; `head` is the list's own head and `first` tracks
/// whether a separator is due.
fn write_children<'n, 'a, S: Canon>(
    sink: &mut S,
    items: impl IntoIterator<Item = &'n Node<'a>>,
    form: &'n Node<'a>,
    context: &Context<'_>,
    depth: usize,
    path: &[&str],
) {
    sink.byte(b'(');
    let mut first = true;
    for child in items {
        write_piece(sink, child, form, context, depth, path, &mut first);
    }
    sink.byte(b')');
}

/// Write one child, or return `false` when the child was not a top-level kept
/// child (so `write_form` can try the next). Writes the space separator itself.
fn write_piece<'n, 'a, S: Canon>(
    sink: &mut S,
    child: &'n Node<'a>,
    form: &'n Node<'a>,
    context: &Context<'_>,
    depth: usize,
    path: &[&str],
    first: &mut bool,
) -> bool {
    let head = form.head();
    if !matches!(child, Node::List { .. }) {
        separator(sink, first);
        write_leaf(sink, child);
        return true;
    }
    let child_head = child.head().unwrap_or_default();
    if dropped_head(child_head, head, path) {
        return false;
    }
    if let Some(name) = net_part(child, form, context, depth, head) {
        if !name.is_empty() {
            separator(sink, first);
            sink.raw("(net ");
            write_json_string(sink, &name);
            sink.raw(")");
        }
        return true;
    }
    if depth == 0 && child_object_heads(head.unwrap_or_default()).contains(&child_head) {
        separator(sink, first);
        write_reference(sink, child_head, child);
        return true;
    }
    separator(sink, first);
    let mut extended = path.to_vec();
    extended.push(head.unwrap_or_default());
    write_text(sink, child, context, depth + 1, &extended);
    true
}

/// Whether a child list is dropped at any depth (identity, generated, or an
/// instance path's `page`).
fn dropped_head(child_head: &str, head: Option<&str>, path: &[&str]) -> bool {
    IDENTITY.contains(&child_head)
        || GENERATED.contains(&child_head)
        || (child_head == "page" && head == Some("path") && path.contains(&"instances"))
}

/// Write a child object as `(<head> "<uuid>")`, or `(<head>)` without an id.
fn write_reference<S: Canon>(sink: &mut S, child_head: &str, child: &Node<'_>) {
    sink.byte(b'(');
    sink.raw(child_head);
    if let Some(id) = child_object_id(child) {
        sink.byte(b' ');
        write_json_string(sink, id);
    }
    sink.byte(b')');
}

fn separator<S: Canon>(sink: &mut S, first: &mut bool) {
    if *first {
        *first = false;
    } else {
        sink.byte(b' ');
    }
}

/// `emit(node, depth, path)` (`board_objects_sexpr.mjs:129-156`).
fn write_text<'n, 'a, S: Canon>(
    sink: &mut S,
    node: &'n Node<'a>,
    context: &Context<'_>,
    depth: usize,
    path: &[&str],
) {
    match node {
        Node::List { items, .. } => write_children(sink, items.iter(), node, context, depth, path),
        leaf => write_leaf(sink, leaf),
    }
}

fn write_leaf<S: Canon>(sink: &mut S, node: &Node<'_>) {
    match node {
        Node::Str(value) => write_json_string(sink, value),
        Node::Atom(value) => {
            if is_number_token(value) {
                sink.raw(&canonical_number(value));
            } else {
                sink.raw(value);
            }
        }
        Node::List { .. } => {}
    }
}

/// A `(net …)` on a depth-0 net carrier, by name (`None` when the child is not
/// a net reference at all; an empty name drops the child).
fn net_part(
    child: &Node<'_>,
    form: &Node<'_>,
    context: &Context<'_>,
    depth: usize,
    head: Option<&str>,
) -> Option<String> {
    if depth != 0
        || child.head() != Some("net")
        || !NET_CARRIERS.contains(&head.unwrap_or_default())
    {
        return None;
    }
    Some(resolve_net(child, form, context))
}

fn child_object_id<'n, 'a>(node: &'n Node<'a>) -> Option<&'n str> {
    let id = identity_of(node)?;
    is_canonical_uuid(id).then_some(id)
}

/// Step 3 (`board_objects_sexpr.mjs:161-184`). `form` is the object's own
/// form, so a zone can prefer its `(net_name …)`.
fn resolve_net(net_node: &Node<'_>, form: &Node<'_>, context: &Context<'_>) -> String {
    if form.head() == Some("zone")
        && let Some(name) = form
            .child("net_name")
            .and_then(|child| child.items())
            .and_then(|items| items.get(1))
            .and_then(Node::text)
        && !name.is_empty()
    {
        return name.to_owned();
    }
    let items = net_node.items().unwrap_or_default();
    let first = items.get(1);
    let second = items.get(2);
    if let Some(Node::Atom(value)) = first
        && is_number_token(value)
    {
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
    if let Some(value) = first.and_then(Node::text) {
        return value.to_owned();
    }
    String::new()
}

/// The `(net <code> "<name>")` table a board's digest resolves a numeric
/// `(net <code>)` through, from the board's top-level net forms.
#[must_use]
pub fn net_table<'n, 'a>(nets: impl IntoIterator<Item = &'n Node<'a>>) -> BTreeMap<String, String>
where
    'a: 'n,
{
    let mut table = BTreeMap::new();
    for net in nets {
        let items = net.items().unwrap_or_default();
        if let Some(Node::Atom(code)) = items.get(1)
            && is_number_token(code)
        {
            let name = items.get(2).and_then(Node::text).unwrap_or_default();
            table.insert(canonical_number(code), name.to_owned());
        }
    }
    table
}

/// ECMAScript `JSON.stringify` of a string, written straight to the sink.
fn write_json_string<S: Canon>(sink: &mut S, text: &str) {
    sink.byte(b'"');
    for character in text.chars() {
        match character {
            '"' => sink.raw("\\\""),
            '\\' => sink.raw("\\\\"),
            '\u{0008}' => sink.raw("\\b"),
            '\u{000c}' => sink.raw("\\f"),
            '\n' => sink.raw("\\n"),
            '\r' => sink.raw("\\r"),
            '\t' => sink.raw("\\t"),
            character if (character as u32) < 0x20 => {
                let mut buffer = [0u8; 6];
                let code = character as u32;
                buffer[0] = b'\\';
                buffer[1] = b'u';
                buffer[2] = b'0';
                buffer[3] = b'0';
                buffer[4] = HEX[(code >> 4) as usize & 0xf];
                buffer[5] = HEX[code as usize & 0xf];
                sink.raw(std::str::from_utf8(&buffer).unwrap_or(""));
            }
            character => {
                let mut buffer = [0u8; 4];
                sink.raw(character.encode_utf8(&mut buffer));
            }
        }
    }
    sink.byte(b'"');
}

const HEX: &[u8; 16] = b"0123456789abcdef";

/// `^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$` (`board_objects_sexpr.mjs:82`).
#[must_use]
pub fn is_number_token(text: &str) -> bool {
    let bytes = text.as_bytes();
    let mut index = usize::from(matches!(bytes.first(), Some(b'+' | b'-')));
    if index >= bytes.len() {
        return false;
    }
    let before = consume_digits(bytes, &mut index);
    let after = consume_fraction(bytes, &mut index);
    if before == 0 && after == 0 {
        return false;
    }
    if !consume_exponent(bytes, &mut index) {
        return false;
    }
    index == bytes.len()
}

/// Consume an optional `.digits`; returns how many fractional digits.
fn consume_fraction(bytes: &[u8], index: &mut usize) -> usize {
    if *index < bytes.len() && bytes[*index] == b'.' {
        *index += 1;
        return consume_digits(bytes, index);
    }
    0
}

/// Consume an optional `[eE][+-]?digits`; `false` when an exponent is present
/// but has no digits.
fn consume_exponent(bytes: &[u8], index: &mut usize) -> bool {
    if *index >= bytes.len() || !matches!(bytes[*index], b'e' | b'E') {
        return true;
    }
    *index += 1;
    if *index < bytes.len() && matches!(bytes[*index], b'+' | b'-') {
        *index += 1;
    }
    consume_digits(bytes, index) != 0
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

/// The first 16 hex digits of a SHA-256 digest.
fn hex16(digest: &[u8]) -> String {
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

    fn sha256_16(text: &str) -> String {
        use sha2::Digest as _;
        let mut hasher = sha2::Sha256::new();
        hasher.update(text.as_bytes());
        hex16(&hasher.finalize())
    }

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

    const SYMBOL_UUID: &str = "00000000-0000-0000-0000-00000000000a";

    fn symbol_digest(body: &str) -> String {
        let text = format!("(kicad_sch (symbol (lib_id \"a\") (uuid \"{SYMBOL_UUID}\"){body}))");
        let index = digest_of(&text, false);
        index.get(SYMBOL_UUID).unwrap().1.to_owned()
    }

    #[test]
    fn dropped_heads_are_dropped_at_any_depth() {
        // `render_cache` is a generated head, dropped nested inside a kept
        // `property` (field map, "contentDigest" step 2).
        let base = symbol_digest(" (property \"Reference\" \"R1\")");
        let with_cache = symbol_digest(
            " (property \"Reference\" \"R1\" (render_cache (polygon (pts (xy 1 2)))))",
        );
        assert_eq!(base, with_cache);
    }

    #[test]
    fn an_instance_page_is_dropped_below_a_path() {
        let one = symbol_digest(
            " (instances (project \"p\" (path \"/\" (reference \"R1\") (page \"1\"))))",
        );
        let two = symbol_digest(
            " (instances (project \"p\" (path \"/\" (reference \"R1\") (page \"2\"))))",
        );
        assert_eq!(one, two);
    }

    #[test]
    fn nets_resolve_by_name_from_the_board_table() {
        let uuid = "00000000-0000-0000-0000-00000000000c";
        let by_code = format!(
            "(kicad_pcb (net 5 \"GND\") (segment (uuid \"{uuid}\") (start 0 0) (end 1 0) (layer \"F.Cu\") (net 5)))"
        );
        let by_name = format!(
            "(kicad_pcb (net 5 \"GND\") (segment (uuid \"{uuid}\") (start 0 0) (end 1 0) (layer \"F.Cu\") (net 5 \"GND\")))"
        );
        let without = format!(
            "(kicad_pcb (net 5 \"GND\") (segment (uuid \"{uuid}\") (start 0 0) (end 1 0) (layer \"F.Cu\")))"
        );
        let index = digest_of(&by_code, true);
        let index_by_name = digest_of(&by_name, true);
        let index_without = digest_of(&without, true);
        assert_eq!(
            index.get(uuid).unwrap().1,
            index_by_name.get(uuid).unwrap().1
        );
        // An empty net (net 0) is dropped, so a net-less segment matches.
        let empty_net = format!(
            "(kicad_pcb (segment (uuid \"{uuid}\") (start 0 0) (end 1 0) (layer \"F.Cu\") (net 0 \"\")))"
        );
        assert_eq!(
            index_without.get(uuid).unwrap().1,
            digest_of(&empty_net, true).get(uuid).unwrap().1
        );
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
