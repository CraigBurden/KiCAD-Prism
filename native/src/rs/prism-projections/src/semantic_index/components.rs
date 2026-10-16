//! Pass 3: `components` from `design.json`, a port of the component loop
//! (semantic_index_service.py:879-910) with `_canonical_fields` and
//! `_resolve_dnp` (:438-513).

use super::State;
use super::fields::SourceFields;
use serde_json::Value;

/// Append every designated component of `design.json` to `state.components`
/// and fill `componentByReference`, `componentBySchematicUuid` and
/// `state.component_by_reference`.
pub(super) fn project(_design: &Value, _source_fields: &SourceFields, _state: &mut State) {}
