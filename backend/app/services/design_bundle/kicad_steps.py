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

import hashlib
import re
import shutil
import tempfile
import threading
from concurrent.futures import Future, ThreadPoolExecutor
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


class UpgradeCache:
    """Upgraded bytes by what determines them, shared by the source sets of one comparison.

    A board's upgrade reads the board and the project file copied beside it; a
    schematic's reads the schematic and the project file of the same stem, if
    any (cli-spec.md §9.4; a sheet's sub-sheets do not change its output). Two
    revisions that share a file at the same content upgrade it once.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._futures: dict[str, Future[bytes]] = {}

    def get(self, key: str, upgrade: Callable[[], bytes]) -> bytes:
        with self._lock:
            future = self._futures.get(key)
            owner = future is None
            if owner:
                future = self._futures[key] = Future()
        assert future is not None
        if owner:
            try:
                future.set_result(upgrade())
            except BaseException as error:
                future.set_exception(error)
        return future.result()


def upgrade_sources(
    src: Path,
    config: Mapping[str, object],
    file_formats: Mapping[str, int],
    *,
    cancel: Callable[[], None] | None = None,
    cache: UpgradeCache | None = None,
) -> list[dict[str, object]]:
    """cli-spec.md §9.4 over the closure's documents; returns ``[{path, upgraded_from_version}]``.

    ``file_formats`` is the generator id's ``kicad_file_formats``: a board or
    schematic older than its kind's format is upgraded. Each file is upgraded
    in its own scratch directory with only the project file it reads, so the
    upgrades run at once (``PRISM_DESIGN_BUNDLE_UPGRADE_WORKERS``) and give the
    bytes the in-place upgrade gives.
    """

    selected: list[tuple[str, int, bool]] = []
    for path in closure_documents(src, config):
        version = file_version(src / path)
        board = path.lower().endswith(".kicad_pcb")
        current = int(file_formats["board" if board else "schematic"])
        if version is None or version >= current:
            continue  # current, newer (stage parse records source-format-unsupported) or unreadable
        selected.append((path, version, board))
    if not selected:
        return []
    cache = cache or UpgradeCache()

    def upgrade(path: str, board: bool) -> bytes:
        target = src / path
        project = _project_beside(src, config, target, board)
        key = _upgrade_key(board, target.read_bytes(), project.read_bytes() if project else None)
        upgraded = cache.get(key, lambda: _upgrade_isolated(target, project, board, cancel=cancel))
        target.write_bytes(upgraded)
        return upgraded

    workers = min(settings.PRISM_DESIGN_BUNDLE_UPGRADE_WORKERS, len(selected))
    with ThreadPoolExecutor(max_workers=workers, thread_name_prefix="kicad-upgrade") as pool:
        futures = [pool.submit(upgrade, path, board) for path, _, board in selected]
        for future in futures:
            future.result()
    return [{"path": path, "upgraded_from_version": version} for path, version, _ in selected]


def _project_beside(src: Path, config: Mapping[str, object], target: Path, board: bool) -> Path | None:
    """The project file the upgrade of ``target`` reads: the project's for a board, the same stem's for a schematic."""

    project = src / str(config["project_file"]) if board else target.with_suffix(".kicad_pro")
    return project if project.is_file() else None


def _upgrade_key(board: bool, content: bytes, project: bytes | None) -> str:
    digest = hashlib.sha256(b"board\0" if board else b"schematic\0")
    digest.update(hashlib.sha256(content).digest())
    digest.update(hashlib.sha256(project).digest() if project is not None else b"\0")
    return digest.hexdigest()


def _upgrade_isolated(target: Path, project: Path | None, board: bool, *, cancel: Callable[[], None] | None) -> bytes:
    """Upgrade a copy of ``target`` beside a copy of ``project`` named after it; return the upgraded bytes."""

    with tempfile.TemporaryDirectory(prefix="kicad-upgrade-") as scratch:
        work = Path(scratch) / target.name
        shutil.copyfile(target, work)
        if project is not None:
            shutil.copyfile(project, work.with_suffix(".kicad_pro"))
        if board:
            _run_python(UPGRADE_BOARD_SCRIPT, work, timeout=settings.PRISM_DESIGN_BUNDLE_UPGRADE_TIMEOUT_SECONDS, cancel=cancel)
        else:
            _upgrade_schematic(work, cancel=cancel)
        return work.read_bytes()


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
