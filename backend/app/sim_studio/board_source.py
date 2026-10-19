"""How a Simulation Studio run gets its board (amendment V2 §4, parent ADR C6).

The reference branch built its own ``board.prism`` through the mesh 3D
pipeline. Here a run will read the design bundle by key instead; that is
implemented separately (V2c). Until then these raise.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping


def stage_board(run: Mapping[str, Any], inputs_dir: Path, log: list[str]) -> dict[str, str]:
    """Place the run's board input in ``inputs_dir``; return ``{"path": <relative path>, "sha256": <hex>}``."""
    raise NotImplementedError("V2c: the run's board comes from the design bundle")


def materialization(run: Mapping[str, Any]) -> bytes:
    """The analytic pack the run ran on."""
    raise NotImplementedError("V2c: the run's board comes from the design bundle")
