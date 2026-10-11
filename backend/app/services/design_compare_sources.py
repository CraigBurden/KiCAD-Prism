"""Which files in a snapshot are the design.

A KiCad checkout also holds backups, autosaves and generated output. These
helpers answer "is this part of the design, and where is its root document",
which both the revision builder and the stackup reader need to know before they
can read anything.
"""

from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services import project_revision


def _is_generated_kicad_path(path: Path, root: Path) -> bool:
    """The revision source-set rule (``project_revision.is_generated``), for a snapshot path."""
    try:
        relative = path.relative_to(root)
    except ValueError:
        relative = path
    return project_revision.is_generated(relative.as_posix())


def _list_kicad_sources(root: Path) -> List[Dict[str, str]]:
    out = []
    for path in sorted(root.rglob("*")):
        if (
            path.suffix in {".kicad_sch", ".kicad_pcb", ".kicad_pro"}
            and path.is_file()
            and not _is_generated_kicad_path(path, root)
        ):
            out.append(
                {
                    "filename": path.name,
                    "path": str(path.relative_to(root)).replace("\\", "/"),
                }
            )
    return out


def _anchor_stem(anchor: Optional[str]) -> str:
    """The bare name a project's files share, from its anchor filename."""
    return Path(anchor).stem.strip().casefold() if anchor else ""


def _prefer_anchored(paths: List[Path], anchor: Optional[str]) -> Optional[Path]:
    """Pick the file belonging to ``anchor``, if this revision still has it.

    KiCad associates a project's files by name, so `top.kicad_pro` owns
    `top.kicad_pcb`. Without this a directory holding two projects compared
    whichever file sat shallowest, so a second co-located project could look
    correct live and diff its sibling's board at a past revision.

    When the anchored file is absent from the revision -- a project that did
    not exist yet, or was renamed -- return no file. Selecting a sibling would
    manufacture a comparison against a different project, which is worse than
    accurately reporting that this project has no document at that revision.
    """
    stem = _anchor_stem(anchor)
    if stem:
        owned = [path for path in paths if path.stem.casefold() == stem]
        if not owned:
            return None
        paths = owned
    return min(paths, key=lambda path: (len(path.parts), str(path)))


def _find_pro(root: Path, anchor: Optional[str] = None) -> Optional[Path]:
    pros = [path for path in root.rglob("*.kicad_pro") if not _is_generated_kicad_path(path, root)]
    if not pros:
        return None
    return _prefer_anchored(pros, anchor)


def _find_pcb(root: Path, anchor: Optional[str] = None) -> Optional[Path]:
    boards = [
        path for path in root.rglob("*.kicad_pcb")
        if not _is_generated_kicad_path(path, root)
    ]
    if not boards:
        return None
    return _prefer_anchored(boards, anchor)
