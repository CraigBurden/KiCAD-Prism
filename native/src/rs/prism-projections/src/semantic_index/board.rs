//! Pass 5: the board, a port of semantic_index_service.py:1035-1129 (the
//! `pcb is not None` block: footprints and pads, then tracks/arcs/vias/zones,
//! `ensure_pcb_net` at :1043-1066) with the net helpers `_property_map`,
//! `_net_table`, `_net_name` and `_net_code` (:516-554).
//!
//! The fork's [`PcbView`] already resolves every board net reference through
//! the board's net table (`NetResolver`, the same snapshot km's `net_table()`
//! builds), so `_net_name` is the resolved name and `_net_code` the resolved
//! ordinal; no per-element re-scan is needed. Footprint references come from
//! the footprint `properties` (km `_property_map`), its ids and pads from the
//! view. The split-net reconciliation is [`super::reconcile`].

use super::reconcile::SplitNetClaims;
use super::{State, stable_uid, string};
use crate::{BoardModel, ProjectionError};
use prism_kicad_core::{PcbNetRef, PcbView};
use serde_json::{Value, json};
use std::collections::HashMap;

/// The footprint property that names a component (semantic_index_service.py:1070).
const REFERENCE_PROPERTY: &str = "Reference";

/// One pad reduced to the fields the board pass reads
/// (semantic_index_service.py:1079-1081).
struct PadRecord {
    uuid: String,
    number: String,
    net: PcbNetRef,
}

/// Attach footprints, pads, tracks, arcs, vias and zones to the index
/// (semantic_index_service.py:1068-1129).
pub(super) fn project(
    board: &BoardModel<'_>,
    state: &mut State,
    claims: &mut SplitNetClaims,
) -> Result<(), ProjectionError> {
    let view = board.view;
    let references = reference_properties(view)?;
    let pads_by_footprint = pads_by_footprint(view)?;
    project_footprints(view, &references, &pads_by_footprint, state, claims)?;
    project_board_items(view, state)?;
    Ok(())
}

/// `_property_map(footprint)` (:516-522) over each footprint, keeping the last
/// `Reference` (a dict's later write wins) by footprint index.
fn reference_properties(view: &PcbView<'_>) -> Result<HashMap<usize, String>, ProjectionError> {
    let mut references: HashMap<usize, String> = HashMap::new();
    for property in view.decoded_footprint_properties() {
        let property = property
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        if property.name == REFERENCE_PROPERTY {
            references.insert(property.footprint_index, property.value.clone());
        }
    }
    Ok(references)
}

/// Pads in board file order, grouped by their footprint; the view yields every
/// pad once, in source order.
fn pads_by_footprint(
    view: &PcbView<'_>,
) -> Result<HashMap<usize, Vec<PadRecord>>, ProjectionError> {
    let mut grouped: HashMap<usize, Vec<PadRecord>> = HashMap::new();
    for pad in view.decoded_pads() {
        let pad = pad.as_ref().map_err(|error| board_error(error.clone()))?;
        grouped
            .entry(pad.footprint_index)
            .or_default()
            .push(PadRecord {
                uuid: pad.uuid.clone().unwrap_or_default(),
                number: pad.number.clone(),
                net: pad.net.clone(),
            });
    }
    Ok(grouped)
}

/// Attach each footprint's component ref and pads
/// (semantic_index_service.py:1068-1111).
fn project_footprints(
    view: &PcbView<'_>,
    references: &HashMap<usize, String>,
    pads_by_footprint: &HashMap<usize, Vec<PadRecord>>,
    state: &mut State,
    claims: &mut SplitNetClaims,
) -> Result<(), ProjectionError> {
    let empty_pads = Vec::new();
    for (footprint_index, footprint) in view.decoded_footprints().iter().enumerate() {
        let footprint = footprint
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        let reference = references
            .get(&footprint_index)
            .map(String::as_str)
            .unwrap_or_default();
        let footprint_uuid = footprint.uuid.as_deref().unwrap_or_default();
        // `component_by_reference.get(reference)` (:1072-1077).
        if let Some(&component_index) = state.component_by_reference.get(reference) {
            push_component_pcb_ref(state, component_index, footprint_uuid);
            if !footprint_uuid.is_empty() {
                state
                    .indexes
                    .component_by_pcb_footprint_uuid
                    .insert(footprint_uuid.to_owned(), component_index);
            }
        }
        let pads = pads_by_footprint
            .get(&footprint_index)
            .unwrap_or(&empty_pads);
        for pad in pads {
            project_pad(state, claims, reference, pad);
        }
    }
    Ok(())
}

/// Segments, arcs, vias and zones, in that order (:1113-1127).
fn project_board_items(view: &PcbView<'_>, state: &mut State) -> Result<(), ProjectionError> {
    for segment in view.decoded_segments() {
        let segment = segment
            .as_ref()
            .map_err(|error| board_error(error.clone()))?;
        record_board_item(
            state,
            "trackUuids",
            segment.uuid.as_deref().unwrap_or_default(),
            &segment.net,
        );
    }
    for arc in view.decoded_arcs() {
        let arc = arc.as_ref().map_err(|error| board_error(error.clone()))?;
        record_board_item(
            state,
            "arcUuids",
            arc.uuid.as_deref().unwrap_or_default(),
            &arc.net,
        );
    }
    for via in view.decoded_vias() {
        let via = via.as_ref().map_err(|error| board_error(error.clone()))?;
        record_board_item(
            state,
            "viaUuids",
            via.uuid.as_deref().unwrap_or_default(),
            &via.net,
        );
    }
    for zone in view.decoded_zones() {
        let zone = zone.as_ref().map_err(|error| board_error(error.clone()))?;
        record_board_item(
            state,
            "zoneUuids",
            zone.uuid.as_deref().unwrap_or_default(),
            &zone.net,
        );
    }
    Ok(())
}

/// One pad's board record: the net, the pad uuid index, and the terminal it
/// matches (semantic_index_service.py:1078-1111).
fn project_pad(state: &mut State, claims: &mut SplitNetClaims, reference: &str, pad: &PadRecord) {
    let name = net_name(&pad.net);
    let code = pad.net.ordinal;
    let net_index = ensure_pcb_net(state, &name, code);
    if let Some(net_index) = net_index
        && !pad.uuid.is_empty()
    {
        push_pcb_uuid(state, net_index, "padUuids", &pad.uuid);
        state
            .indexes
            .net_by_pcb_uuid
            .insert(pad.uuid.clone(), net_index);
    }

    let pair = format!("{reference}:{}", pad.number);
    let mut terminal_index = state.terminal_index_by_pair.get(&pair).copied();
    if terminal_index.is_none() && !reference.is_empty() && !pad.number.is_empty() {
        // A pad with no schematic pin becomes a board-only terminal
        // (:1090-1104): no `pinName`, `pinType`, `schematicNetName` or
        // `schematicPinUuid`.
        let net_uid = net_uid_of(state, net_index);
        let terminal = json!({
            "terminalUid": stable_uid("term", &[reference, &pad.number]),
            "componentUid": state.component_uid_for(reference),
            "reference": reference,
            "pin": pad.number,
            "netUid": net_uid,
            "netName": net_name_value(&name),
            "pcbPadUuid": pad.uuid,
        });
        let index = state.terminals.len();
        state.terminals.push(terminal);
        state.terminal_index_by_pair.insert(pair.clone(), index);
        state
            .indexes
            .terminal_by_reference_pin
            .insert(pair.clone(), index);
        terminal_index = Some(index);
    } else if let Some(index) = terminal_index {
        // A terminal the netlist already created: it gains the pad uuid and,
        // when the pad has a net, the board net's identity (:1105-1109). The
        // mismatch is what the reconciliation later folds.
        let net_uid = net_uid_of(state, net_index);
        let terminal = &mut state.terminals[index];
        if let Some(object) = terminal.as_object_mut() {
            object.insert("pcbPadUuid".to_owned(), Value::String(pad.uuid.clone()));
            if net_index.is_some() {
                let schematic_name = string(object.get("netName"));
                claims.note_pad(&name, &schematic_name);
                object.insert("netUid".to_owned(), net_uid);
                object.insert("netName".to_owned(), Value::String(name.clone()));
            }
        }
    }
    if !pad.uuid.is_empty()
        && let Some(index) = terminal_index
    {
        state
            .indexes
            .terminal_by_pcb_pad_uuid
            .insert(pad.uuid.clone(), index);
    }
}

/// One track, arc, via or zone: its net, and its uuid under `bucket`
/// (semantic_index_service.py:1119-1127).
fn record_board_item(state: &mut State, bucket: &str, uuid: &str, net: &PcbNetRef) {
    let name = net_name(net);
    let net_index = ensure_pcb_net(state, &name, net.ordinal);
    let Some(net_index) = net_index else {
        return;
    };
    if uuid.is_empty() {
        return;
    }
    push_pcb_uuid(state, net_index, bucket, uuid);
    state
        .indexes
        .net_by_pcb_uuid
        .insert(uuid.to_owned(), net_index);
}

/// `ensure_pcb_net(name, code)` (semantic_index_service.py:1043-1066): the net
/// named `name`, created (with `netCode: null` when `code` is `None`) when the
/// schematic netlist has none; a `code` updates `netCode` and `netByNetCode`.
/// `None` for an empty name.
fn ensure_pcb_net(state: &mut State, name: &str, code: Option<i64>) -> Option<usize> {
    if name.is_empty() {
        return None;
    }
    let index = if let Some(&index) = state.net_index_by_name.get(name) {
        index
    } else {
        let index = state.nets.len();
        state.nets.push(json!({
            "netUid": stable_uid("net", &[name]),
            "name": name,
            "netCode": code,
            "netClass": "",
            "schematicRefs": [],
            "pcbRefs": [{"trackUuids": [], "arcUuids": [], "viaUuids": [], "zoneUuids": [], "padUuids": []}],
            "webgpuRefs": [],
        }));
        state.net_index_by_name.insert(name.to_owned(), index);
        state.indexes.net_by_name.insert(name.to_owned(), index);
        index
    };
    if let Some(code) = code {
        if let Some(entry) = state.nets[index].as_object_mut() {
            entry.insert("netCode".to_owned(), json!(code));
        }
        state
            .indexes
            .net_by_net_code
            .insert(code.to_string(), index);
    }
    Some(index)
}

/// `_net_name(pcb, item, net_table)` (:542-549) over an already-resolved
/// [`PcbNetRef`]: the net table resolves the name from the ordinal, or the
/// ordinal from the name, whichever is missing.
fn net_name(net: &PcbNetRef) -> String {
    net.name.clone().unwrap_or_default()
}

/// `name or None` for a terminal's `netName` (:1097).
fn net_name_value(name: &str) -> Value {
    if name.is_empty() {
        Value::Null
    } else {
        Value::String(name.to_owned())
    }
}

/// `net_entry.get("netUid") if net_entry else None` (:1096).
fn net_uid_of(state: &State, net_index: Option<usize>) -> Value {
    net_index.map_or(Value::Null, |index| {
        state.nets[index]
            .get("netUid")
            .cloned()
            .unwrap_or(Value::Null)
    })
}

/// `component["pcbRefs"].append({"footprintUuid": footprint_uuid})` (:1074).
fn push_component_pcb_ref(state: &mut State, component_index: usize, footprint_uuid: &str) {
    if let Some(pcb_refs) = state.components[component_index]
        .get_mut("pcbRefs")
        .and_then(Value::as_array_mut)
    {
        pcb_refs.push(json!({"footprintUuid": footprint_uuid}));
    }
}

/// `net_entry["pcbRefs"][0][bucket].append(uuid)` (:1085, :1126).
fn push_pcb_uuid(state: &mut State, net_index: usize, bucket: &str, uuid: &str) {
    let Some(first) = state.nets[net_index]
        .get_mut("pcbRefs")
        .and_then(Value::as_array_mut)
        .and_then(|refs| refs.first_mut())
        .and_then(Value::as_object_mut)
    else {
        return;
    };
    if let Some(items) = first.get_mut(bucket).and_then(Value::as_array_mut) {
        items.push(Value::String(uuid.to_owned()));
    }
}

/// The board view decodes records on demand; a decode error fails the pass.
fn board_error(error: prism_kicad_core::Error) -> ProjectionError {
    ProjectionError::new(format!("semantic-index board: {}", error.message))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn pad(uuid: &str, number: &str, net: PcbNetRef) -> PadRecord {
        PadRecord {
            uuid: uuid.to_owned(),
            number: number.to_owned(),
            net,
        }
    }

    #[test]
    fn a_pad_without_a_net_appends_a_null_net_terminal() {
        // A pad whose `(net …)` resolves to nothing has no board net
        // (semantic_index_service.py:1044-1046): `ensure_pcb_net` returns None,
        // and the board-only terminal's `netUid` and `netName` are null
        // (:1096-1097).
        let mut state = State::default();
        let mut claims = SplitNetClaims::new(&state);
        let pad = pad("pad-1", "1", PcbNetRef::default());
        project_pad(&mut state, &mut claims, "J9", &pad);
        assert!(state.nets.is_empty());
        assert_eq!(state.terminals.len(), 1);
        let terminal = &state.terminals[0];
        assert_eq!(terminal["netUid"], Value::Null);
        assert_eq!(terminal["netName"], Value::Null);
        assert_eq!(terminal["pcbPadUuid"], "pad-1");
        assert_eq!(terminal["componentUid"], stable_uid("cmp", &["J9"]));
        // The pad uuid is indexed even without a net; no net uuid is.
        assert_eq!(
            state.indexes.terminal_by_pcb_pad_uuid.get("pad-1"),
            Some(&0)
        );
        assert!(state.indexes.net_by_pcb_uuid.is_empty());
    }

    #[test]
    fn a_board_only_terminal_carries_the_board_net() {
        // A pad the netlist did not list becomes a board-only terminal
        // (semantic_index_service.py:1090-1104): no `pinName`, `pinType`,
        // `schematicNetName` or `schematicPinUuid`, and the board net's
        // `netUid`/`netName`.
        let mut state = State::default();
        let mut claims = SplitNetClaims::new(&state);
        let pad = pad(
            "pad-7",
            "7",
            PcbNetRef {
                ordinal: None,
                name: Some("VCC".to_owned()),
            },
        );
        project_pad(&mut state, &mut claims, "J1", &pad);
        assert_eq!(state.nets.len(), 1);
        assert_eq!(state.nets[0]["name"], "VCC");
        assert_eq!(state.nets[0]["netCode"], Value::Null);
        assert_eq!(state.nets[0]["pcbRefs"][0]["padUuids"], json!(["pad-7"]));
        let terminal = &state.terminals[0];
        assert_eq!(terminal["netUid"], state.nets[0]["netUid"]);
        assert_eq!(terminal["netName"], "VCC");
        assert!(terminal.get("schematicNetName").is_none());
        assert!(terminal.get("schematicPinUuid").is_none());
        assert_eq!(
            state.indexes.terminal_by_reference_pin.get("J1:7"),
            Some(&0)
        );
        assert_eq!(state.indexes.net_by_pcb_uuid.get("pad-7"), Some(&0));
    }

    #[test]
    fn the_net_code_rule_splits_kicad10_from_older_boards() {
        // KiCad 10 `(net "NAME")` resolves to no ordinal (:552-554), so
        // `netCode` is null and `netByNetCode` empty; an older board's
        // `(net 3 "NAME")` carries the ordinal, so `netCode` is 3 and the
        // decimal key is indexed (:1063-1065).
        let mut state = State::default();
        record_board_item(
            &mut state,
            "trackUuids",
            "track-1",
            &PcbNetRef {
                ordinal: None,
                name: Some("NAME".to_owned()),
            },
        );
        assert_eq!(state.nets[0]["netCode"], Value::Null);
        assert!(state.indexes.net_by_net_code.is_empty());
        record_board_item(
            &mut state,
            "trackUuids",
            "track-2",
            &PcbNetRef {
                ordinal: Some(3),
                name: Some("OTHER".to_owned()),
            },
        );
        assert_eq!(state.nets[1]["netCode"], 3);
        assert_eq!(state.indexes.net_by_net_code.get("3"), Some(&1));
        assert_eq!(
            state.nets[1]["pcbRefs"][0]["trackUuids"],
            json!(["track-2"])
        );
    }
}
