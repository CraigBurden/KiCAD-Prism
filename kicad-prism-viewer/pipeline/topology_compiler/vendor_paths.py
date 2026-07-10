from __future__ import annotations

import os
import sys
from pathlib import Path


def reference_paths(repo_root: Path | None = None) -> list[Path]:
    root = repo_root or Path(__file__).resolve().parents[2]
    prism_root = root.parent
    platform_root = prism_root.parent
    return [
        root,
        root / "references" / "kicad_monkey",
        root / "references" / "kicad_monkey" / "src" / "py",
        root / "references" / "kicad_cruncher" / "src" / "py",
        root / "references",
        prism_root / "references" / "kicad_monkey" / "src" / "py",
        prism_root / "references" / "kicad_cruncher" / "src" / "py",
        platform_root / "kicad-monkey" / "src" / "py",
        platform_root / "kicad-cruncher" / "src" / "py",
        platform_root / "kicad_monkey" / "src" / "py",
        platform_root / "kicad_cruncher" / "src" / "py",
    ]


def pythonpath(repo_root: Path | None = None, current: str | None = None) -> str:
    entries = [str(path) for path in reference_paths(repo_root) if path.exists()]
    if current:
        entries.append(current)
    return os.pathsep.join(entries)


def ensure_reference_paths(repo_root: Path | None = None) -> None:
    # Iterate in reverse because each insert goes to the front of sys.path.
    for path in reversed(reference_paths(repo_root)):
        if not path.exists():
            continue
        text = str(path)
        if text in sys.path:
            sys.path.remove(text)
        sys.path.insert(0, text)
