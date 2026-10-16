"""The models stage's KiCad step: ``kicad-cli-glb-a0`` (cli-spec.md §9.3).

Created by WP-K as the hook the job calls; WP-V1 owns it from Wave 2 (parity
with today's component export, divergences, the board-body and mask facts).

The export runs in a copy of the bundle's ``sources/`` so models resolve
through ``${KIPRJMOD}`` to the bundled repository models and through
``KICAD*_3DMODEL_DIR`` to the image's stock library. Its output is always
named ``components.glb`` (cli-spec.md §5.2.4). Results are cached by the
source board's blob id, the repository model blobs, the generator's KiCad
version and models procedure (ADR §4.4).
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
from pathlib import Path
from typing import Any, Callable, Mapping

from app.core.config import settings
from app.services import kicad_tools
from app.services.design_bundle.generator import Generator
from app.services.design_bundle.kicad_steps import KicadStepFailed

GLB_NAME = "components.glb"


def cache_root() -> Path:
    return Path(settings.KICAD_PROJECTS_ROOT).expanduser() / ".kicad-prism" / "bundle-models-cache"


def cache_key(record: Mapping[str, Any], generator: Generator, tool_version: str = "") -> str:
    board = record["config"].get("board")
    entries = record["entries"]
    board_id = next((e["object_id"] for e in entries if e["path"] == board), "")
    models = sorted((e["path"], e["object_id"]) for e in entries if e["category"] == "model-3d")
    material = {
        "board": [board, board_id],
        "models": models,
        "kicad_version": generator.kicad_version,
        "models_procedure": generator.models_procedure,
        # The KiCad that exports may be a later patch release of the generator's (decisions.md).
        "tool_version": tool_version,
    }
    return hashlib.sha256(json.dumps(material, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def export_components_glb(
    sources: Path,
    record: Mapping[str, Any],
    generator: Generator,
    work: Path,
    *,
    cancel: Callable[[], None] | None = None,
) -> tuple[Path, bool]:
    """``$JOB/models/components.glb`` for the record's board; returns ``(path, cache_hit)``."""

    from app.services.design_bundle.kicad_steps import worker_kicad_version

    key = cache_key(record, generator, worker_kicad_version())
    cached = cache_root() / f"{key}.glb"
    output_dir = work / "models"
    output_dir.mkdir(parents=True, exist_ok=True)
    output = output_dir / GLB_NAME
    if cached.is_file():
        shutil.copyfile(cached, output)
        return output, True
    tool = kicad_tools.kicad_cli()
    if not tool.available():
        raise KicadStepFailed("kicad-cli is not installed; the component GLB cannot be exported")
    tree = work / "models-src"
    shutil.copytree(sources, tree, symlinks=False)
    board = tree / str(record["config"]["board"])
    try:
        result = tool.with_cancel(cancel).run(
            ["pcb", "export", "glb", "--force", "--no-board-body", "--output", str(output), str(board)],
            timeout=settings.PRISM_DESIGN_BUNDLE_GLB_TIMEOUT_SECONDS,
            cwd=tree,
        )
    except kicad_tools.ToolError as error:
        raise KicadStepFailed(f"kicad-cli pcb export glb failed: {error}") from error
    if not result.ok or not output.is_file():
        raise KicadStepFailed(f"kicad-cli pcb export glb failed: {result.detail()[:400]}")
    cached.parent.mkdir(parents=True, exist_ok=True)
    temp = cached.with_name(f".{cached.name}.{os.getpid()}.part")
    shutil.copyfile(output, temp)
    os.replace(temp, cached)
    return output, False
