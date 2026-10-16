"""Golden capture: run today's code on a prepared case and write its goldens.

One module per member, ``capture/<stem with _>.py``, each exposing::

    MEMBER = "<stem>"
    def capture(ctx: Context) -> Result

``capture`` runs today's producers (dev's ``backend/``, the reference branch
where the field map says so) on ``ctx.src``, transforms their output into the
contract's shape exactly as the field map's "How a golden is produced from
today's code" section says, and returns the document. It raises
``NotCaptured`` when today's code cannot produce one (for example
``design_variants/malformed``, which today's parsers reject).

``Result.checks`` records the field map's consumer checks: today's own output
shapes re-derived from the golden by the field map's reader adapters and
compared with what today's code wrote. A golden whose check differs from
today without a documented divergence is refused (``capture`` fails).

This package runs inside the backend environment (Python 3.12 with
kicad_monkey 2026.9.7, ``requirements/test.txt``); see ``native/parity/README.md``.
"""

from __future__ import annotations

import importlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tempfile
import traceback
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .. import fixtures as fx
from ..members import MEMBERS

CAPTURE_SCHEMA = "prism.parity.capture.a0"
DEFAULT_REFERENCE = Path("/Users/Swaroop/Personal-Projects/KiCAD-Platform/.worktrees/prism-analytic")

MODULES = {
    "semantic-index": "semantic_index",
    "board-objects": "board_objects",
    "occurrences": "occurrences",
    "stackup": "stackup",
    "route-metrics": "route_metrics",
    "placements": "placements",
    "project": "project",
    "system-interface": "system_interface",
}


class NotCaptured(Exception):
    """Today's code produced no output for this case. ``status`` is recorded in capture.json."""

    def __init__(self, reason: str, status: str = "today-failed") -> None:
        super().__init__(reason)
        self.reason = reason
        self.status = status


@dataclass
class Result:
    document: dict
    # Extra files beside the golden, ``goldens/<case>/<stem>.<name>.json``, that a
    # comparison check needs (for example today's board-object hashes).
    sidecars: dict[str, Any] = field(default_factory=dict)
    # Consumer checks: {"shape", "result": "equal"|"divergence"|"differs", "divergences": [...], "detail": [...]}
    checks: list[dict] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


@dataclass
class Context:
    prepared: fx.Prepared
    today: Path  # repository root whose backend/ is today's code
    reference: Path  # the reference branch checkout (feature/analytic-pack-spike)
    scratch: Path  # empty scratch directory for this member
    node: str
    cache: dict = field(default_factory=dict)  # shared between the members of one case

    @property
    def case(self) -> fx.Case:
        return self.prepared.case

    @property
    def src(self) -> Path:
        """The prepared (upgraded) copy; stands for the repository root."""

        return self.prepared.src

    @property
    def project(self) -> str:
        """The anchor's RepoPath."""

        return self.case.project

    @property
    def project_file(self) -> Path:
        return self.src / self.case.project

    @property
    def project_dir(self) -> str:
        """The anchor directory's RepoPath, ``""`` at the repository root."""

        return self.case.project_dir

    def repo_path(self, project_relative: str) -> str:
        """Today's project-relative path → the bundle's RepoPath (conventions.md §8)."""

        rel = project_relative.replace("\\", "/")
        if rel in ("", "."):
            return self.project_dir or "."
        return f"{self.project_dir}/{rel}" if self.project_dir else rel

    def shared(self, key: str, compute: Callable[[], Any]) -> Any:
        """Compute a value once per case (e.g. today's ecad index, used by two members)."""

        if key not in self.cache:
            self.cache[key] = compute()
        return self.cache[key]

    def run_node(self, script: Path, *args: str, env: dict | None = None, timeout: int = 1800) -> Any:
        """Run a Node 24 helper that prints one JSON document on stdout."""

        environment = dict(os.environ)
        environment["ECAD_INDEX_CACHE"] = "0"
        environment.update(env or {})
        out = subprocess.run(
            [self.node, str(script), *args],
            capture_output=True,
            text=True,
            env=environment,
            timeout=timeout,
        )
        if out.returncode != 0:
            raise RuntimeError(f"{script.name} failed ({out.returncode}): {out.stderr[-2000:]}")
        return json.loads(out.stdout)


def setup_today(today: Path) -> None:
    """Put today's backend and topology pipeline first on ``sys.path``."""

    for path in (today / "kicad-prism-viewer" / "pipeline", today / "backend"):
        if str(path) not in sys.path:
            sys.path.insert(0, str(path))


def load(stem: str):
    return importlib.import_module(f"{__name__}.{MODULES[stem]}")


def _git(repo: Path, *args: str) -> str | None:
    try:
        return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def producers(today: Path, reference: Path, node: str, kicad: fx.KiCad | None) -> dict:
    record: dict[str, Any] = {}
    head = _git(today, "rev-parse", "HEAD")
    if head:
        record["todayCommit"] = head
        dirty = _git(today, "status", "--porcelain", "--", "backend", "kicad-prism-viewer/pipeline")
        record["todayDirty"] = bool(dirty)
    ref_head = _git(reference, "rev-parse", "HEAD") if reference.exists() else None
    if ref_head:
        record["referenceCommit"] = ref_head
    try:
        from importlib.metadata import version

        record["kicadMonkey"] = version("kicad-monkey")
    except Exception:  # noqa: BLE001 - recorded as unknown
        pass
    if kicad is not None:
        record["kicad"] = kicad.version
    record["python"] = platform.python_version()
    try:
        record["node"] = subprocess.run([node, "--version"], capture_output=True, text=True, check=True).stdout.strip().lstrip("v")
    except (OSError, subprocess.CalledProcessError):
        pass
    record["platform"] = f"{sys.platform}-{platform.machine()}"
    return record


def dump(document: Any) -> str:
    """Golden text: one-space indent, raw UTF-8, one trailing LF. Compared by value, never by bytes."""

    return json.dumps(document, indent=1, ensure_ascii=False) + "\n"


def capture_case(
    case: fx.Case,
    out_dir: Path,
    scratch: Path,
    *,
    members: list[str],
    today: Path,
    reference: Path,
    node: str,
    kicad: fx.KiCad | None,
    upgrade_sources: bool = True,
    keep: bool = False,
) -> dict:
    """Prepare one case, run every member's capture, write goldens and capture.json."""

    prepared = fx.prepare(case, scratch, kicad, upgrade_sources=upgrade_sources)
    golden_dir = out_dir / case.id
    golden_dir.mkdir(parents=True, exist_ok=True)
    previous = {}
    meta_path = golden_dir / "capture.json"
    if meta_path.exists():
        previous = json.loads(meta_path.read_text(encoding="utf-8")).get("members", {})
    record: dict[str, Any] = {
        "schema": CAPTURE_SCHEMA,
        "case": case.id,
        "kind": case.kind,
        "sourceRoot": case.source_root_label,
        "project": case.project,
        "inputs": prepared.inputs,
        "producers": producers(today, reference, node, kicad),
        "members": dict(previous),
    }
    cache: dict = {}
    for stem in members:
        member_scratch = prepared.work / f"member-{stem}"
        member_scratch.mkdir(parents=True, exist_ok=True)
        ctx = Context(prepared=prepared, today=today, reference=reference, scratch=member_scratch, node=node, cache=cache)
        for stale in golden_dir.glob(f"{stem}*.json"):
            stale.unlink()
        try:
            result = load(stem).capture(ctx)
        except NotCaptured as error:
            record["members"][stem] = {"status": error.status, "reason": error.reason}
            print(f"  {case.id} {stem}: {error.status}: {error.reason}", flush=True)
            continue
        except Exception as error:  # noqa: BLE001 - a capture bug must not hide other members
            record["members"][stem] = {"status": "capture-error", "reason": f"{type(error).__name__}: {error}"}
            print(f"  {case.id} {stem}: CAPTURE ERROR\n{traceback.format_exc()}", flush=True)
            continue
        refused = [check for check in result.checks if check.get("result") == "differs"]
        if refused:
            record["members"][stem] = {
                "status": "capture-error",
                "reason": "a consumer check differs from today without a documented divergence",
                "checks": result.checks,
            }
            print(f"  {case.id} {stem}: REFUSED: {[c['shape'] for c in refused]}", flush=True)
            continue
        schema = MEMBERS[stem].schema_id
        if result.document.get("schema") != schema:
            raise RuntimeError(f"{stem}: capture returned schema {result.document.get('schema')!r}, not {schema}")
        (golden_dir / MEMBERS[stem].golden_name).write_text(dump(result.document), encoding="utf-8")
        for name, value in sorted(result.sidecars.items()):
            (golden_dir / f"{stem}.{name}.json").write_text(dump(value), encoding="utf-8")
        entry: dict[str, Any] = {"status": "captured"}
        if result.sidecars:
            entry["sidecars"] = sorted(result.sidecars)
        if result.checks:
            entry["checks"] = result.checks
        if result.notes:
            entry["notes"] = result.notes
        record["members"][stem] = entry
        summary = ", ".join(f"{c['shape']}={c['result']}" for c in result.checks)
        print(f"  {case.id} {stem}: captured{(' (' + summary + ')') if summary else ''}", flush=True)
    record["members"] = {stem: record["members"][stem] for stem in MEMBERS if stem in record["members"]}
    meta_path.write_text(dump(record), encoding="utf-8")
    if not keep:
        shutil.rmtree(prepared.work, ignore_errors=True)
    return record


def default_node() -> str:
    for candidate in (os.environ.get("PRISM_PARITY_NODE"), "/opt/homebrew/opt/node@24/bin/node", shutil.which("node")):
        if candidate and Path(candidate).exists():
            return candidate
    raise SystemExit("node (24.22.0) not found: set PRISM_PARITY_NODE")


def new_scratch(base: Path | None) -> Path:
    if base is not None:
        base.mkdir(parents=True, exist_ok=True)
        return base
    return Path(tempfile.mkdtemp(prefix="prism-parity-"))
