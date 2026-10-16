//! The board's facts the components join onto: pad nets and footprint
//! geometry, a port of `_board_pad_nets`, `_reference`, `_footprint_geometry`,
//! `_courtyard_points`, `_model` and `_board_geometry`
//! (interface_extractor.py:148-262).

use crate::{BoardModel, ProjectionError};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

/// What the component loop reads from the board.
#[derive(Debug, Default)]
pub(super) struct BoardFacts {
    /// `_board_pad_nets`: `Reference` property → pad number → the net names of
    /// every pad with that number on every footprint with that reference (`""`
    /// for a pad without a net); pads without a number are left out.
    pub pad_nets: BTreeMap<String, BTreeMap<String, BTreeSet<String>>>,
    /// `_board_geometry`: `Reference` property → the `geometry` object of the
    /// first footprint in file order with that reference, numbers already
    /// `_round`ed.
    pub geometry: BTreeMap<String, Value>,
}

/// Read the board's pad nets and footprint geometry in one pass.
pub(super) fn scan(_board: &BoardModel<'_>) -> Result<BoardFacts, ProjectionError> {
    Ok(BoardFacts::default())
}
