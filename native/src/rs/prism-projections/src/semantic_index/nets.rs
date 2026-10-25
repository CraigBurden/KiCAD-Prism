//! Pass 4: schematic nets and their terminals from `design.json`, a port of
//! the netlist loop (semantic_index_service.py:929-1023) and
//! `_group_schematic_refs` (:721-781).
//!
//! Every named `design.json` net, in `design["nets"]` order, appends one
//! `nets` entry with its `schematicRefs` grouped by sheet instance. Each net's
//! terminals follow: the netlist's own terminal records in their order, then
//! the graphical-only pins that the netlist omitted (the stable union at
//! :968-987). The a1 additions (`pinName`, `pinType`, `schematicNetName`) are
//! from the field map's "How a golden is produced", step 1.

use super::{Placement, Placements, State, stable_uid, string};
use serde_json::{Map, Value, json};
use std::collections::{BTreeSet, HashMap};

/// Append every named `design.json` net and its terminals to `state.nets` and
/// `state.terminals`, and fill `netByName`, `netBySchematicUuid`,
/// `terminalByReferencePin`, `terminalBySchematicPinUuid`,
/// `state.net_index_by_name` and `state.terminal_index_by_pair`
/// (semantic_index_service.py:929-1023).
pub(super) fn project(design: &Value, placements: &Placements, state: &mut State) {
    let nets = design
        .get("nets")
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice);
    for raw in nets {
        let name = string(raw.get("name"));
        if name.is_empty() {
            continue;
        }
        let empty = Map::new();
        let graphical = raw
            .get("graphical")
            .and_then(Value::as_object)
            .unwrap_or(&empty);

        let net_index = state.nets.len();
        let mut schematic_refs = group_schematic_refs(graphical, placements);
        // `indexes["netBySchematicUuid"]` from every placed or unplaced
        // wire/label/junction uuid, before the pins (:958-961).
        index_net_items(state, &schematic_refs, net_index);

        let pins_by_pair = pins_by_pair(graphical);
        let terminals_by_pair = terminals_by_pair(raw, &pins_by_pair);
        let net_uid = stable_uid("net", &[&name]);
        append_terminals(
            state,
            &mut schematic_refs,
            placements,
            &NetTerminals {
                pins_by_pair: &pins_by_pair,
                terminals_by_pair: &terminals_by_pair,
                net_uid: &net_uid,
                name: &name,
                net_index,
            },
        );

        let net_entry = json!({
            "netUid": net_uid,
            "name": name,
            "netClass": string(raw.get("net_class")),
            "aliases": sorted_strings(raw.get("aliases")),
            "sourceSheets": sorted_strings(raw.get("source_sheets")),
            "schematicRefs": schematic_refs,
            "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
            "webgpuRefs": [],
        });
        state.nets.push(net_entry);
        state.net_index_by_name.insert(name.clone(), net_index);
        state.indexes.net_by_name.insert(name, net_index);
    }
}

/// `indexes["netBySchematicUuid"]` for a net's wire, label and junction uuids
/// (semantic_index_service.py:958-961).
fn index_net_items(state: &mut State, schematic_refs: &[Value], net_index: usize) {
    for schematic_ref in schematic_refs {
        for bucket in ["wireUuids", "labelUuids", "junctionUuids"] {
            let Some(uuids) = schematic_ref.get(bucket).and_then(Value::as_array) else {
                continue;
            };
            for source_uuid in uuids {
                state
                    .indexes
                    .net_by_schematic_uuid
                    .insert(string(Some(source_uuid)), net_index);
            }
        }
    }
}

/// `pins_by_pair`: graphical pins keyed `<designator>:<pin>`
/// (semantic_index_service.py:963-967). A pin without a designator or a
/// number (a library pin KiCad writes as `(pin "")`, such as a mounting hole's)
/// has no terminal, as in the netlist pass below.
fn pins_by_pair(graphical: &Map<String, Value>) -> OrderedMap {
    let mut pins = OrderedMap::default();
    for pin in object_list(graphical, "pins") {
        let reference = string(pin.get("designator"));
        let number = string(pin.get("pin"));
        if !reference.is_empty() && !number.is_empty() {
            pins.insert(format!("{reference}:{number}"), pin.clone());
        }
    }
    pins
}

/// `terminals_by_pair`: the netlist's terminal records, then a graphical-only
/// entry for each pin the netlist omitted (semantic_index_service.py:974-987).
fn terminals_by_pair(raw: &Value, pins_by_pair: &OrderedMap) -> OrderedMap {
    let mut terminals = OrderedMap::default();
    for raw_terminal in value_list(raw, "terminals") {
        let reference = string(raw_terminal.get("designator"));
        let pin_number = string(raw_terminal.get("pin"));
        if reference.is_empty() || pin_number.is_empty() {
            continue;
        }
        let pair = format!("{reference}:{pin_number}");
        terminals.insert(pair, raw_terminal.clone());
    }
    for (pair, _) in pins_by_pair.iter() {
        terminals.entry_or_insert_with(pair, || {
            let (reference, pin_number) = pair.split_once(':').unwrap_or(("", ""));
            json!({"designator": reference, "pin": pin_number})
        });
    }
    terminals
}

/// One net's terminals and the context [`append_terminals`] needs.
struct NetTerminals<'a> {
    pins_by_pair: &'a OrderedMap,
    terminals_by_pair: &'a OrderedMap,
    net_uid: &'a str,
    name: &'a str,
    net_index: usize,
}

/// Append one net's terminals, in `terminals_by_pair` order, to
/// `state.terminals` and fill the terminal indexes
/// (semantic_index_service.py:989-1023).
fn append_terminals(
    state: &mut State,
    schematic_refs: &mut [Value],
    placements: &Placements,
    net: &NetTerminals<'_>,
) {
    for (pair, raw_terminal) in net.terminals_by_pair.iter() {
        let reference = string(raw_terminal.get("designator"));
        let pin_number = string(raw_terminal.get("pin"));
        let pin_graphic = net.pins_by_pair.get(pair);
        // `pin_graphic.get("source_pin_id") or pin_graphic.get("svg_id")`
        // (:993).
        let pin_uuid = pin_graphic.map_or_else(String::new, |pin| {
            let source = pin.get("source_pin_id").filter(|value| truthy(value));
            string(source.or_else(|| pin.get("svg_id")))
        });

        let mut terminal = Map::new();
        terminal.insert(
            "terminalUid".to_owned(),
            Value::String(stable_uid("term", &[&reference, &pin_number])),
        );
        terminal.insert(
            "componentUid".to_owned(),
            Value::String(state.component_uid_for(&reference)),
        );
        terminal.insert("reference".to_owned(), Value::String(reference.clone()));
        terminal.insert("pin".to_owned(), Value::String(pin_number.clone()));
        // a1: the pin record's name and type, only when the netlist listed
        // the pin (`"pin_type" in raw_terminal`); a graphical-only
        // terminal has neither (D6).
        if raw_terminal.get("pin_type").is_some() {
            terminal.insert(
                "pinName".to_owned(),
                Value::String(string(raw_terminal.get("pin_name"))),
            );
            terminal.insert(
                "pinType".to_owned(),
                Value::String(string(raw_terminal.get("pin_type"))),
            );
        }
        terminal.insert("netUid".to_owned(), Value::String(net.net_uid.to_owned()));
        terminal.insert("netName".to_owned(), Value::String(net.name.to_owned()));
        // a1: the schematic netlist net's name, before the board pass and
        // the reconciliation rewrite `netName` (D7).
        terminal.insert(
            "schematicNetName".to_owned(),
            Value::String(net.name.to_owned()),
        );
        terminal.insert(
            "schematicPinUuid".to_owned(),
            Value::String(pin_uuid.clone()),
        );

        let terminal_index = state.terminals.len();
        state.terminals.push(Value::Object(terminal));
        state
            .terminal_index_by_pair
            .insert(pair.clone(), terminal_index);
        state
            .indexes
            .terminal_by_reference_pin
            .insert(pair.clone(), terminal_index);

        if !pin_uuid.is_empty() {
            append_pin_uuid(schematic_refs, placements.get(&pin_uuid), &pin_uuid);
            state
                .indexes
                .terminal_by_schematic_pin_uuid
                .insert(pin_uuid.clone(), terminal_index);
            state
                .indexes
                .net_by_schematic_uuid
                .insert(pin_uuid, net.net_index);
        }
    }
}

/// `_group_schematic_refs` (semantic_index_service.py:721-781): the net's
/// wires, labels and junctions grouped by sheet instance, in first-seen order
/// (walking wires, then labels, then junctions), with the unplaced entry last.
fn group_schematic_refs(graphical: &Map<String, Value>, placements: &Placements) -> Vec<Value> {
    let wires = string_list(graphical, "wires");
    let label_values = string_list(graphical, "labels");
    let mut labels = label_values.clone();
    labels.extend(string_list(graphical, "ports"));
    labels.extend(string_list(graphical, "power_ports"));
    let mut junctions = string_list(graphical, "junctions");
    junctions.extend(string_list(graphical, "sheet_entries"));

    // The local labels whose uuid counts once per placement (:737-739).
    let counted_labels: BTreeSet<String> = label_values
        .iter()
        .filter(|value| !value.is_empty())
        .cloned()
        .collect();

    let mut refs: Vec<SchematicRef> = Vec::new();
    let mut by_key: HashMap<(String, String), usize> = HashMap::new();
    let mut unplaced = SchematicRef::unplaced();
    for (bucket, values) in [
        (Bucket::Wire, &wires),
        (Bucket::Label, &labels),
        (Bucket::Junction, &junctions),
    ] {
        accumulate_bucket(
            &mut refs,
            &mut by_key,
            &mut unplaced,
            placements,
            bucket,
            values,
            &counted_labels,
        );
    }

    let mut out: Vec<Value> = refs.iter().map(ref_to_value).collect();
    let any_unplaced = !unplaced.wire_uuids.is_empty()
        || !unplaced.label_uuids.is_empty()
        || !unplaced.junction_uuids.is_empty();
    if any_unplaced {
        // The unplaced entry's count is the net's total local-label count
        // (:777).
        unplaced.label_instance_count = label_values.len() as u64;
        out.push(ref_to_value(&unplaced));
    }
    if out.is_empty() {
        out.push(ref_to_value(&unplaced));
    }
    out
}

/// Fold one bucket's source uuids into the refs, in first-seen order, grouping
/// placed uuids by `(sheetInstancePath, page)` and collecting the rest in
/// `unplaced` (semantic_index_service.py:748-774).
fn accumulate_bucket(
    refs: &mut Vec<SchematicRef>,
    by_key: &mut HashMap<(String, String), usize>,
    unplaced: &mut SchematicRef,
    placements: &Placements,
    bucket: Bucket,
    values: &[String],
    counted_labels: &BTreeSet<String>,
) {
    for source_uuid in values {
        let Some(source_placements) = placements.get(source_uuid) else {
            unplaced.bucket_mut(bucket).push(source_uuid.clone());
            continue;
        };
        for placement in source_placements {
            let key = (
                placement.sheet_instance_path.clone(),
                placement.page.clone(),
            );
            let index = *by_key.entry(key).or_insert_with(|| {
                refs.push(SchematicRef::placed(placement));
                refs.len() - 1
            });
            let item = &mut refs[index];
            let bucket_uuids = item.bucket_mut(bucket);
            if !bucket_uuids.contains(source_uuid) {
                bucket_uuids.push(source_uuid.clone());
            }
            if bucket == Bucket::Label && counted_labels.contains(source_uuid) {
                item.label_instance_count += 1;
            }
        }
    }
}

/// A terminal's pin uuid is appended to the refs whose `sheetInstancePath`
/// matches one of the pin's placements, or to the first ref when none matches;
/// it never repeats (semantic_index_service.py:1008-1021).
fn append_pin_uuid(
    schematic_refs: &mut [Value],
    pin_placements: Option<&Vec<Placement>>,
    pin_uuid: &str,
) {
    let matches = |item: &Value| -> bool {
        let Some(path) = item.get("sheetInstancePath").and_then(Value::as_str) else {
            return false;
        };
        pin_placements.is_some_and(|placements| {
            placements
                .iter()
                .any(|placement| placement.sheet_instance_path == path)
        })
    };
    let matching: Vec<usize> = schematic_refs
        .iter()
        .enumerate()
        .filter(|(_, item)| matches(item))
        .map(|(index, _)| index)
        .collect();
    let targets = if matching.is_empty() {
        if schematic_refs.is_empty() {
            Vec::new()
        } else {
            vec![0]
        }
    } else {
        matching
    };
    for index in targets {
        if let Some(uuids) = schematic_refs[index]
            .get_mut("pinUuids")
            .and_then(Value::as_array_mut)
            && !uuids.iter().any(|value| value.as_str() == Some(pin_uuid))
        {
            uuids.push(Value::String(pin_uuid.to_owned()));
        }
    }
}

/// `sorted(_string(value) for value in values if _string(value))`
/// (semantic_index_service.py:939-948): the non-empty string forms, in code
/// point order.
fn sorted_strings(value: Option<&Value>) -> Vec<String> {
    let mut values: Vec<String> = value
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .map(|item| string(Some(item)))
                .filter(|item| !item.is_empty())
                .collect()
        })
        .unwrap_or_default();
    values.sort();
    values
}

/// `list(container.get(key) or ())` for the `graphical.pins` and
/// `net.terminals` arrays, whose elements stay whole `Value`s
/// (semantic_index_service.py:964, :975).
fn value_list<'a>(container: &'a Value, key: &str) -> &'a [Value] {
    container
        .get(key)
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice)
}

/// `list(graphical.get(key) or ())` for the object-typed `graphical` map.
fn object_list<'a>(graphical: &'a Map<String, Value>, key: &str) -> &'a [Value] {
    graphical
        .get(key)
        .and_then(Value::as_array)
        .map_or(&[][..], Vec::as_slice)
}

/// `[_string(value) for value in graphical.get(key) or ()]`
/// (semantic_index_service.py:725-735).
fn string_list(graphical: &Map<String, Value>, key: &str) -> Vec<String> {
    graphical
        .get(key)
        .and_then(Value::as_array)
        .map(|items| items.iter().map(|item| string(Some(item))).collect())
        .unwrap_or_default()
}

/// Python truthiness of a `design.json` value, for the `a or b` form at
/// semantic_index_service.py:993.
fn truthy(value: &Value) -> bool {
    match value {
        Value::Null => false,
        Value::Bool(flag) => *flag,
        Value::Number(number) => number.as_f64().is_some_and(|number| number != 0.0),
        Value::String(text) => !text.is_empty(),
        Value::Array(items) => !items.is_empty(),
        Value::Object(object) => !object.is_empty(),
    }
}

/// One `schematicRefs` bucket before serialization; `placement` is `None` for
/// the single unplaced entry (semantic_index_service.py:741-747, :760-770).
struct SchematicRef {
    placement: Option<Placement>,
    wire_uuids: Vec<String>,
    label_uuids: Vec<String>,
    junction_uuids: Vec<String>,
    pin_uuids: Vec<String>,
    label_instance_count: u64,
}

impl SchematicRef {
    fn placed(placement: &Placement) -> Self {
        Self {
            placement: Some(placement.clone()),
            wire_uuids: Vec::new(),
            label_uuids: Vec::new(),
            junction_uuids: Vec::new(),
            pin_uuids: Vec::new(),
            label_instance_count: 0,
        }
    }

    fn unplaced() -> Self {
        Self {
            placement: None,
            wire_uuids: Vec::new(),
            label_uuids: Vec::new(),
            junction_uuids: Vec::new(),
            pin_uuids: Vec::new(),
            label_instance_count: 0,
        }
    }

    fn bucket_mut(&mut self, bucket: Bucket) -> &mut Vec<String> {
        match bucket {
            Bucket::Wire => &mut self.wire_uuids,
            Bucket::Label => &mut self.label_uuids,
            Bucket::Junction => &mut self.junction_uuids,
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Bucket {
    Wire,
    Label,
    Junction,
}

/// The ref as today's `{**placement, wireUuids, labelUuids, junctionUuids,
/// pinUuids, labelInstanceCount}` (semantic_index_service.py:760-770); the
/// unplaced entry carries no `sheetInstancePath`, `sheetPath` or `page`.
fn ref_to_value(item: &SchematicRef) -> Value {
    let mut object = Map::new();
    if let Some(placement) = &item.placement {
        object.insert(
            "sheetInstancePath".to_owned(),
            Value::String(placement.sheet_instance_path.clone()),
        );
        object.insert(
            "sheetPath".to_owned(),
            Value::String(placement.sheet_path.clone()),
        );
        object.insert("page".to_owned(), Value::String(placement.page.clone()));
    }
    object.insert("wireUuids".to_owned(), uuid_array(&item.wire_uuids));
    object.insert("labelUuids".to_owned(), uuid_array(&item.label_uuids));
    object.insert("junctionUuids".to_owned(), uuid_array(&item.junction_uuids));
    object.insert("pinUuids".to_owned(), uuid_array(&item.pin_uuids));
    object.insert(
        "labelInstanceCount".to_owned(),
        json!(item.label_instance_count),
    );
    Value::Object(object)
}

fn uuid_array(values: &[String]) -> Value {
    Value::Array(
        values
            .iter()
            .map(|value| Value::String(value.clone()))
            .collect(),
    )
}

/// A Python `dict` for `pins_by_pair` and `terminals_by_pair`: keys in
/// first-insertion order, a later write replacing the value in place
/// (semantic_index_service.py:963-987).
#[derive(Default)]
struct OrderedMap(Vec<(String, Value)>);

impl OrderedMap {
    fn insert(&mut self, key: String, value: Value) {
        match self.0.iter_mut().find(|(name, _)| *name == key) {
            Some(entry) => entry.1 = value,
            None => self.0.push((key, value)),
        }
    }

    fn get(&self, key: &str) -> Option<&Value> {
        self.0
            .iter()
            .find(|(name, _)| name == key)
            .map(|(_, value)| value)
    }

    fn entry_or_insert_with(&mut self, key: &str, value: impl FnOnce() -> Value) {
        if self.get(key).is_none() {
            self.insert(key.to_owned(), value());
        }
    }

    fn iter(&self) -> impl Iterator<Item = (&String, &Value)> {
        self.0.iter().map(|(key, value)| (key, value))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn placement(instance_path: &str, sheet_path: &str, page: &str) -> Placement {
        Placement {
            sheet_instance_path: instance_path.to_owned(),
            sheet_path: sheet_path.to_owned(),
            page: page.to_owned(),
        }
    }

    fn placements(rows: &[(&str, Placement)]) -> Placements {
        let mut map = Placements::new();
        for (uuid, placement) in rows {
            map.entry((*uuid).to_owned())
                .or_default()
                .push(placement.clone());
        }
        map
    }

    #[test]
    fn an_empty_net_gets_one_unplaced_entry() {
        // `if not refs: refs.append(unplaced)` (semantic_index_service.py:779-780).
        let graphical = Map::new();
        let refs = group_schematic_refs(&graphical, &Placements::new());
        assert_eq!(
            refs,
            vec![json!({
                "wireUuids": [],
                "labelUuids": [],
                "junctionUuids": [],
                "pinUuids": [],
                "labelInstanceCount": 0,
            })]
        );
    }

    #[test]
    fn refs_group_by_sheet_instance_in_first_seen_order() {
        // The key is `(sheetInstancePath or "/", page or "")`; a later item on
        // an existing instance joins its bucket (semantic_index_service.py:748-774).
        let graphical = json!({
            "wires": ["w1", "w2"],
            "labels": ["l1"],
        });
        let graphical = graphical.as_object().unwrap();
        let rows = [
            ("w1", placement("/a", "/A/", "a.kicad_sch")),
            ("w2", placement("/b", "/B/", "b.kicad_sch")),
            ("l1", placement("/a", "/A/", "a.kicad_sch")),
        ];
        let refs = group_schematic_refs(graphical, &placements(&rows));
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[0]["sheetInstancePath"], "/a");
        assert_eq!(refs[0]["wireUuids"], json!(["w1"]));
        assert_eq!(refs[0]["labelUuids"], json!(["l1"]));
        assert_eq!(refs[0]["labelInstanceCount"], 1);
        assert_eq!(refs[1]["sheetInstancePath"], "/b");
        assert_eq!(refs[1]["wireUuids"], json!(["w2"]));
    }

    #[test]
    fn unplaced_items_go_to_a_last_entry_with_the_total_label_count() {
        // `any(unplaced[bucket])` appends the unplaced entry last, with the
        // net's total local-label count (semantic_index_service.py:776-778).
        let graphical = json!({
            "wires": ["w1"],
            "labels": ["l1", "l2"],
        });
        let graphical = graphical.as_object().unwrap();
        let rows = [("w1", placement("/a", "/A/", "a.kicad_sch"))];
        let refs = group_schematic_refs(graphical, &placements(&rows));
        assert_eq!(refs.len(), 2);
        assert_eq!(refs[1]["wireUuids"], json!([]));
        assert_eq!(refs[1]["labelUuids"], json!(["l1", "l2"]));
        assert_eq!(refs[1]["labelInstanceCount"], 2);
        assert!(refs[1].get("sheetInstancePath").is_none());
    }

    #[test]
    fn a_pin_uuid_lands_on_the_matching_instance_or_the_first_ref() {
        // The matching refs by `sheetInstancePath`, else `schematic_refs[:1]`
        // (semantic_index_service.py:1008-1021).
        let mut refs = vec![
            ref_to_value(&SchematicRef::placed(&placement(
                "/a",
                "/A/",
                "a.kicad_sch",
            ))),
            ref_to_value(&SchematicRef::placed(&placement(
                "/b",
                "/B/",
                "b.kicad_sch",
            ))),
        ];
        let pin = vec![placement("/b", "/B/", "b.kicad_sch")];
        append_pin_uuid(&mut refs, Some(&pin), "pin-1");
        assert_eq!(refs[0]["pinUuids"], json!([]));
        assert_eq!(refs[1]["pinUuids"], json!(["pin-1"]));

        // No matching placement: the first ref.
        let mut refs = vec![
            ref_to_value(&SchematicRef::placed(&placement(
                "/a",
                "/A/",
                "a.kicad_sch",
            ))),
            ref_to_value(&SchematicRef::placed(&placement(
                "/b",
                "/B/",
                "b.kicad_sch",
            ))),
        ];
        append_pin_uuid(&mut refs, None, "pin-2");
        assert_eq!(refs[0]["pinUuids"], json!(["pin-2"]));

        // Never repeats.
        append_pin_uuid(&mut refs, None, "pin-2");
        assert_eq!(refs[0]["pinUuids"], json!(["pin-2"]));
    }

    #[test]
    fn the_ordered_map_keeps_first_insertion_order() {
        // `terminals_by_pair[pair] = raw_terminal` overwrites in place, and
        // `setdefault` appends new pairs (semantic_index_service.py:975-987).
        let mut map = OrderedMap::default();
        map.insert("A:1".to_owned(), json!(1));
        map.insert("B:2".to_owned(), json!(2));
        map.insert("A:1".to_owned(), json!(3));
        map.entry_or_insert_with("C:3", || json!(4));
        map.entry_or_insert_with("A:1", || json!(5));
        let keys: Vec<_> = map.iter().map(|(key, _)| key.as_str()).collect();
        assert_eq!(keys, ["A:1", "B:2", "C:3"]);
        assert_eq!(map.get("A:1"), Some(&json!(3)));
    }
}
