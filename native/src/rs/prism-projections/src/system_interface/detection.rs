//! Connector candidates, a port of `connector_detection.classify`
//! (backend/app/services/systems/connector_detection.py).

use std::collections::BTreeMap;

/// `classify(reference, lib_id, footprint, fields)`: `(candidate, reason)`,
/// reason one of `field`, `refdes`, `library`, `none`.
pub(super) fn classify(
    _reference: &str,
    _lib_id: &str,
    _footprint: &str,
    _fields: &BTreeMap<String, String>,
) -> (bool, &'static str) {
    (false, "none")
}
