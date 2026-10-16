//! `boardThicknessMm` and `boardOutlineMm`, a port of `_board_outline`,
//! `_outline_points` and `_arc_points` (interface_extractor.py:265-321), with
//! kicad_monkey's `KiCadPcb.get_bounds()` as the fallback for a board without
//! board-level Edge.Cuts graphics.

use crate::{BoardModel, ProjectionError};
use serde_json::Value;

/// `_round(board.thickness)`, or `None` when the board has none or it is 0
/// (interface_extractor.py:458).
pub(super) fn thickness(_board: &BoardModel<'_>) -> Result<Option<f64>, ProjectionError> {
    Ok(None)
}

/// `_board_outline(board)`: `{minMm, maxMm, source}` or `None`.
pub(super) fn outline(_board: &BoardModel<'_>) -> Result<Option<Value>, ProjectionError> {
    Ok(None)
}
