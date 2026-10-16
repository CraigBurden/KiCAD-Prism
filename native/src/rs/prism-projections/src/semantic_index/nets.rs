//! Pass 4: schematic nets and their terminals from `design.json`, a port of
//! the netlist loop (semantic_index_service.py:924-1023) and
//! `_group_schematic_refs` (:721-781).

use super::{Placements, State};
use serde_json::Value;

/// Append every named `design.json` net and its terminals.
pub(super) fn project(_design: &Value, _placements: &Placements, _state: &mut State) {}
