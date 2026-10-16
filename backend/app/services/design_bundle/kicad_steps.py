"""The KiCad steps the job runs around ``prism-kicad`` (cli-spec.md §9.2, §9.4).

The CLI never runs KiCad. Before stage parse, older boards and schematics are
upgraded by KiCad itself (``kicad-seeded-upgrade-a0``); before stage board,
the board's zones are refilled by pcbnew (``pcbnew-zone-filler-a0``), unless
the project's configuration says ``zone_fills: "saved"``. Both scripts are the
spec's, verbatim. A failing step raises :class:`KicadStepFailed`, which the
job retries; it is never recorded in a bundle and never replaced by the saved
fills.
"""

from __future__ import annotations

import re
import shutil
import tempfile
from pathlib import Path, PurePosixPath
from typing import Callable, Mapping

from app.core.config import settings
from app.services import kicad_tools

UPGRADE_BOARD_SCRIPT = (
    "import sys, pcbnew\n"
    "pcbnew.KIID.SeedGenerator(0x50524953)\n"
    "board = pcbnew.LoadBoard(sys.argv[1])\n"
    "pcbnew.SaveBoard(sys.argv[1], board)\n"
)
REFILL_SCRIPT = (
    "import sys, pcbnew\n"
    "board = pcbnew.LoadBoard(sys.argv[1])\n"
    "pcbnew.ZONE_FILLER(board).Fill(board.Zones())\n"
    "pcbnew.SaveBoard(sys.argv[1], board)\n"
)
_VERSION = re.compile(rb"\(\s*version\s+(\d+)\s*\)")
_SHEET_FILE = re.compile(r'\(property\s+"Sheet\s?file"\s+"((?:[^"\\]|\\.)*)"')
_HEAD_BYTES = 4096


class KicadStepFailed(RuntimeError):
    """A KiCad step failed or timed out; retried by the job, never recorded."""


_RELEASE = re.compile(r"(\d+)\.(\d+)\.(\d+)")


def worker_kicad_version() -> str:
    """The worker's ``kicad-cli version`` as ``X.Y.Z``: what ``--refill-tool`` and ``--models-tool`` state.

    The CLI accepts any patch release of the generator's major.minor
    (decisions.md, KiCad patch releases), so K reports the KiCad that ran.
    """

    tool = kicad_tools.kicad_cli()
    match = _RELEASE.search(tool.version() if tool.available() else "")
    if match is None:
        raise KicadStepFailed("kicad-cli did not report a release version")
    return match.group(0)


def file_version(path: Path) -> int | None:
    """A KiCad s-expression file's ``(version N)``, from its head."""

    try:
        with path.open("rb") as handle:
            head = handle.read(_HEAD_BYTES)
    except OSError:
        return None
    match = _VERSION.search(head)
    return int(match.group(1)) if match else None


def _run_python(script: str, board: Path, *, timeout: float, cancel: Callable[[], None] | None) -> None:
    """KiCad's Python, isolated like kicad-cli (its own temp and runtime directories)."""

    python = kicad_tools.LocalTool(
        "kicad-python", lambda: settings.PRISM_KICAD_PYTHON.strip() or None, isolate=True, cancel=cancel
    )
    try:
        result = python.run(["-I", "-c", script, str(board)], timeout=timeout)
    except kicad_tools.ToolError as error:
        raise KicadStepFailed(f"KiCad's Python failed on {board.name}: {error}") from error
    if not result.ok:
        detail = result.detail().splitlines()[-1:] or ["no output"]
        raise KicadStepFailed(f"KiCad's Python failed on {board.name}: {detail[0][:400]}")


# ------------------------------------------------------------------ upgrade


def closure_documents(src: Path, config: Mapping[str, object]) -> list[str]:
    """The board and the schematics reachable from the root schematic, as repository paths.

    Sheets are followed through their ``Sheetfile`` property, relative to the
    referencing sheet's directory, then to the project directory; only files
    present under ``src`` count. Reading a file's header and sheet names is all
    this does; the parse is the CLI's.
    """

    found: list[str] = []
    if isinstance(config.get("board"), str) and (src / str(config["board"])).is_file():
        found.append(str(config["board"]))
    project_dir = PurePosixPath(str(config["project_file"])).parent
    queue = [str(config["root_schematic"])] if isinstance(config.get("root_schematic"), str) else []
    seen: set[str] = set()
    while queue:
        sheet = queue.pop(0)
        if sheet in seen or not (src / sheet).is_file():
            continue
        seen.add(sheet)
        found.append(sheet)
        text = (src / sheet).read_text(encoding="utf-8", errors="replace")
        for raw in _SHEET_FILE.findall(text):
            name = raw.replace('\\"', '"').replace("\\\\", "\\")
            for base in (PurePosixPath(sheet).parent, project_dir):
                candidate = _normalized(base / name)
                if candidate is not None and (src / candidate).is_file():
                    queue.append(candidate)
                    break
    return found


def _normalized(path: PurePosixPath) -> str | None:
    parts: list[str] = []
    for part in path.parts:
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return None
            parts.pop()
        else:
            parts.append(part)
    return "/".join(parts) or None


def upgrade_sources(
    src: Path,
    config: Mapping[str, object],
    file_formats: Mapping[str, int],
    *,
    cancel: Callable[[], None] | None = None,
) -> list[dict[str, object]]:
    """cli-spec.md §9.4 over the closure's documents; returns ``[{path, upgraded_from_version}]``.

    ``file_formats`` is the generator id's ``kicad_file_formats``: a board or
    schematic older than its kind's format is upgraded.
    """

    upgraded: list[dict[str, object]] = []
    for path in closure_documents(src, config):
        target = src / path
        version = file_version(target)
        board = path.lower().endswith(".kicad_pcb")
        current = int(file_formats["board" if board else "schematic"])
        if version is None or version >= current:
            continue  # current, newer (stage parse records source-format-unsupported) or unreadable
        if board:
            _upgrade_board(src, config, target, cancel=cancel)
        else:
            _upgrade_schematic(target, cancel=cancel)
        upgraded.append({"path": path, "upgraded_from_version": version})
    return upgraded


def _upgrade_board(src: Path, config: Mapping[str, object], board: Path, *, cancel: Callable[[], None] | None) -> None:
    with tempfile.TemporaryDirectory(prefix="kicad-upgrade-") as scratch:
        work = Path(scratch) / board.name
        shutil.copyfile(board, work)
        project = src / str(config["project_file"])
        if project.is_file():
            shutil.copyfile(project, work.with_suffix(".kicad_pro"))
        _run_python(UPGRADE_BOARD_SCRIPT, work, timeout=settings.PRISM_DESIGN_BUNDLE_UPGRADE_TIMEOUT_SECONDS, cancel=cancel)
        shutil.copyfile(work, board)  # only the .kicad_pcb comes back


def _upgrade_schematic(schematic: Path, *, cancel: Callable[[], None] | None) -> None:
    tool = kicad_tools.kicad_cli()
    if not tool.available():
        raise KicadStepFailed("kicad-cli is not installed; an older schematic cannot be upgraded")
    try:
        result = tool.with_cancel(cancel).run(
            ["sch", "upgrade", str(schematic)], timeout=settings.PRISM_DESIGN_BUNDLE_UPGRADE_TIMEOUT_SECONDS
        )
    except kicad_tools.ToolError as error:
        raise KicadStepFailed(f"kicad-cli sch upgrade failed: {error}") from error
    if not result.ok:
        raise KicadStepFailed(f"kicad-cli sch upgrade failed on {schematic.name}: {result.detail()[:400]}")


# ------------------------------------------------------------------- refill


def refill_board(
    sources: Path, config: Mapping[str, object], work: Path, *, cancel: Callable[[], None] | None = None
) -> Path:
    """cli-spec.md §9.2: refill a scratch copy; returns the refilled ``.kicad_pcb``.

    ``sources`` holds the bundle's sources at repository paths. The project
    and rules files are named after the board's stem so pcbnew finds them;
    only the board is handed to the CLI.
    """

    board_path = str(config["board"])
    board_name = PurePosixPath(board_path).name
    stem = PurePosixPath(board_name).stem
    work.mkdir(parents=True, exist_ok=False)
    target = work / board_name
    shutil.copyfile(sources / board_path, target)
    project = sources / str(config["project_file"])
    shutil.copyfile(project, work / f"{stem}.kicad_pro")
    rules = project.with_suffix(".kicad_dru")
    if rules.is_file():
        shutil.copyfile(rules, work / f"{stem}.kicad_dru")
    _run_python(REFILL_SCRIPT, target, timeout=settings.PRISM_ZONE_REFILL_TIMEOUT_SECONDS, cancel=cancel)
    return target
