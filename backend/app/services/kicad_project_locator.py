"""Which ``.kicad_pro`` a Prism project is (moved out of the mesh viewer's service at System Builder v2 stage 0)."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from app.services import path_config_service


def find_kicad_project(project_path: str, anchor: Optional[str] = None) -> Path:
    """Locate the .kicad_pro this project is.

    This used to return whichever project file sorted first in the directory,
    ignoring the schematic and PCB paths configured for the project. A repo with
    two projects in one directory therefore always rendered the same board, and
    correcting the paths in project settings changed nothing.
    """
    root = Path(project_path)
    config = path_config_service.get_path_config(project_path, anchor=anchor)

    def _candidate(name: object) -> Optional[Path]:
        if not name:
            return None
        candidate = (root / str(name)).resolve()
        return candidate if candidate.is_file() and candidate.suffix == ".kicad_pro" else None

    # The project's own anchor first, then an explicitly configured project file.
    for configured in (
        anchor,
        getattr(config, "project", None),
        getattr(config, "project_file", None),
    ):
        candidate = _candidate(configured)
        if candidate is not None:
            return candidate

    # Then the project file belonging to the configured board or schematic, so
    # pointing settings at a board actually moves the viewer to it.
    for configured in (config.pcb, config.schematic):
        if not configured or "*" in str(configured):
            continue
        candidate = _candidate(f"{Path(str(configured)).stem}.kicad_pro")
        if candidate is not None:
            return candidate

    direct = sorted(root.glob("*.kicad_pro"))
    if direct:
        return direct[0]
    nested = sorted(path for path in root.rglob("*.kicad_pro") if ".git" not in path.parts)
    if nested:
        return nested[0]
    raise ValueError(".kicad_pro file not found")
