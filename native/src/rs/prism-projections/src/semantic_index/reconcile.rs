//! Split-net reconciliation, a port of `semantic_index_nets.py`
//! (`SplitNetClaims`, `reconcile_split_nets`).

use super::State;

/// Today's `SplitNetClaims`: which schematic nets the board renamed.
#[derive(Debug, Default)]
pub(super) struct SplitNetClaims {}

impl SplitNetClaims {
    /// `SplitNetClaims(net_by_name)`, taken after the schematic passes.
    pub fn new(_state: &State) -> Self {
        Self {}
    }

    /// `note_pad(board_name, schematic_name)`.
    pub fn note_pad(&mut self, _board_name: &str, _schematic_name: &str) {}

    /// `reconcile(nets, terminals, indexes)`.
    pub fn reconcile(self, _state: &mut State) {}
}
