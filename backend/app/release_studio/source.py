"""Discover KiCad files, variants, and BOM presets from a commit — no Prism YAML."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any, Mapping

from app.release_studio.config.errors import ConfigLoadError

_BUILTIN_BOM_PRESETS: tuple[str, ...] = (
    "Grouped By Value",
    "Grouped By Value and Footprint",
    "Attributes",
)
_CURRENT_SETTINGS = "Current project settings"
SOURCE_DEFAULT_KEYS: tuple[str, ...] = (
    "board",
    "schematic",
    "variant",
    "bom_preset",
)


def normalize_source_defaults(raw: Mapping[str, Any] | None) -> dict[str, str]:
    payload = raw or {}
    return {key: str(payload.get(key) or "").strip() for key in SOURCE_DEFAULT_KEYS}


def apply_source_defaults(
    discovered: Mapping[str, Any],
    defaults: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Prefer saved project picks that still exist at this commit."""

    result = dict(discovered)
    saved = normalize_source_defaults(defaults)
    boards = list(result.get("boards") or [])
    schematics = list(result.get("schematics") or [])
    variants = list(result.get("variants") or [])
    presets = list(result.get("bom_presets") or [])
    if saved["board"] in boards:
        result["board"] = saved["board"]
    if saved["schematic"] in schematics:
        result["schematic"] = saved["schematic"]
    if saved["variant"] and (saved["variant"] in variants or (not variants and saved["variant"] == "default")):
        result["variant"] = saved["variant"]
    else:
        result["variant"] = variants[0] if variants else "default"
    if saved["bom_preset"] in presets:
        result["default_bom_preset"] = saved["bom_preset"]
    elif not str(result.get("default_bom_preset") or "") and presets:
        result["default_bom_preset"] = presets[0]
    return result


def discover_source(repo_root: Path | str, commit_sha: str) -> dict[str, Any]:
    """List boards, schematics, variants, and BOM presets at *commit_sha*."""

    root = Path(repo_root)
    files = _ls_tree(root, commit_sha)
    boards = [path for path in files if path.endswith(".kicad_pcb")]
    schematics = [path for path in files if path.endswith(".kicad_sch")]
    projects = [path for path in files if path.endswith(".kicad_pro")]

    board = _preferred(boards)
    schematic = _sibling(board, schematics, ".kicad_sch") if board else (_preferred(schematics) or "")
    project = _sibling(board, projects, ".kicad_pro") if board else (_preferred(projects) or "")

    presets = list(_BUILTIN_BOM_PRESETS)
    if project:
        presets = _bom_presets(root, commit_sha, project) + presets
        if _CURRENT_SETTINGS not in presets:
            presets.insert(0, _CURRENT_SETTINGS)

    discovered = {
        "boards": boards,
        "schematics": schematics,
        "board": board or "",
        "schematic": schematic or "",
        "project": project or "",
        "variants": _variants(root, commit_sha, schematic) if schematic else [],
        "bom_presets": presets,
        "default_bom_preset": presets[0] if presets else _CURRENT_SETTINGS,
        "variant": "",
    }
    return apply_source_defaults(discovered)


def _ls_tree(repo_root: Path, commit: str) -> list[str]:
    if not commit or commit.startswith("-") or any(ch.isspace() for ch in commit):
        raise ConfigLoadError(f"invalid commit ref: {commit!r}")
    result = subprocess.run(
        ["git", "-C", str(repo_root), "ls-tree", "-r", "--name-only", commit],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise ConfigLoadError(result.stderr.strip() or "could not list the commit tree")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def _preferred(paths: list[str]) -> str | None:
    if not paths:
        return None
    scored = sorted(
        paths,
        key=lambda path: (
            path.count("/"),
            0 if "hardware" in path.lower() else 1,
            path.lower(),
        ),
    )
    return scored[0]


def _sibling(path: str, candidates: list[str], suffix: str) -> str:
    stem = PurePosixPath(path).with_suffix("").as_posix()
    expected = f"{stem}{suffix}"
    if expected in candidates:
        return expected
    directory = str(PurePosixPath(path).parent)
    for item in candidates:
        if str(PurePosixPath(item).parent) == directory:
            return item
    return _preferred(candidates) or ""


def _bom_presets(repo_root: Path, commit: str, project_rel: str) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "show", f"{commit}:{project_rel}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return []
    schematic = payload.get("schematic") if isinstance(payload, dict) else None
    if not isinstance(schematic, dict):
        return []
    names: list[str] = []
    for item in schematic.get("bom_presets") or []:
        if isinstance(item, dict) and str(item.get("name") or "").strip():
            names.append(str(item["name"]).strip())
        elif isinstance(item, str) and item.strip():
            names.append(item.strip())
    return names


def _variants(repo_root: Path, commit: str, schematic_rel: str) -> list[str]:
    """Best-effort variant names from the schematic text at this commit."""

    result = subprocess.run(
        ["git", "-C", str(repo_root), "show", f"{commit}:{schematic_rel}"],
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return []
    names: list[str] = []
    for line in result.stdout.splitlines():
        stripped = line.strip()
        if stripped.startswith("(variant ") or stripped.startswith("variant "):
            token = stripped.split(None, 1)[-1].strip(' "()')
            if token and token not in names:
                names.append(token)
    return names
