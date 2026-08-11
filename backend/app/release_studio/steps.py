"""The Release Studio step catalogue and its evidence capture (R7).

Every released artifact is produced by one entry here, and every entry names
the KiCad 10.0.4 job type it corresponds to so :mod:`app.release_studio.jobset`
can classify its hermeticity.  Steps run against the materialized input
closure, never against a user's working tree.

DRC and ERC are ordinary steps whose *output is the evidence*.  ``kicad-cli``
returns 0 for a board with violations unless ``--exit-code-violations`` is
passed, so violations are recorded rather than aborting the build; only a
genuine tool failure fails the step.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence


DEFAULT_CLI_TIMEOUT_SECONDS = 900


@dataclass(frozen=True, slots=True)
class StepSpec:
    """One `kicad-cli` invocation and the member class it produces.

    ``argv`` uses ``{board}``, ``{schematic}``, ``{out}`` and ``{variant}``
    placeholders so the recorded argv can be normalized to closure-relative
    text without host paths.
    """

    step_id: str
    step_type: str
    argv: tuple[str, ...]
    source: str  # "board" | "schematic"
    output_kind: str  # "dir" | "file"
    output_name: str
    member_kind: str
    canonicalizer: str
    domains: tuple[str, ...]
    optional: bool = False
    variant_flag: bool = False


@dataclass(frozen=True, slots=True)
class StepOutput:
    """The result of running one catalogue step."""

    step_id: str
    step_type: str
    normalized_argv: tuple[str, ...]
    returncode: int
    files: tuple[Path, ...]
    root: Path
    spec: StepSpec
    stdout: str = ""
    stderr: str = ""
    skipped_reason: str = ""

    @property
    def ran(self) -> bool:
        return not self.skipped_reason


# Ordered so cheap validation runs before expensive artwork: a board that
# cannot be opened fails in seconds rather than after a STEP export.
STEP_CATALOGUE: tuple[StepSpec, ...] = (
    StepSpec(
        step_id="drc",
        step_type="pcb_drc",
        argv=("pcb", "drc", "--format", "json", "--severity-all", "--output", "{out}", "{board}"),
        source="board",
        output_kind="file",
        output_name="evidence/drc.json",
        member_kind="drc_report",
        canonicalizer="drc_erc_json",
        domains=("evidence",),
    ),
    StepSpec(
        step_id="erc",
        step_type="sch_erc",
        argv=("sch", "erc", "--format", "json", "--severity-all", "--output", "{out}", "{schematic}"),
        source="schematic",
        output_kind="file",
        output_name="evidence/erc.json",
        member_kind="erc_report",
        canonicalizer="drc_erc_json",
        domains=("evidence",),
    ),
    StepSpec(
        step_id="board_stats",
        step_type="pcb_export_stats",
        argv=("pcb", "export", "stats", "--format", "json", "--output", "{out}", "{board}"),
        source="board",
        output_kind="file",
        output_name="fabrication/board-stats.json",
        member_kind="board_stats",
        canonicalizer="board_stats_json",
        domains=("bare_board",),
    ),
    StepSpec(
        step_id="gerbers",
        step_type="pcb_export_gerbers",
        argv=("pcb", "export", "gerbers", "--output", "{out}", "{board}"),
        source="board",
        output_kind="dir",
        output_name="fabrication/gerbers",
        member_kind="gerber",
        canonicalizer="",  # per-file, resolved by suffix
        domains=("bare_board",),
        variant_flag=True,
    ),
    StepSpec(
        step_id="drill",
        step_type="pcb_export_drill",
        argv=(
            "pcb", "export", "drill",
            "--format", "excellon", "--excellon-units", "mm",
            "--generate-map", "--map-format", "gerberx2",
            "--output", "{out}", "{board}",
        ),
        source="board",
        output_kind="dir",
        output_name="fabrication/drill",
        member_kind="drill",
        canonicalizer="",
        domains=("bare_board",),
    ),
    StepSpec(
        step_id="positions",
        step_type="pcb_export_pos",
        argv=(
            "pcb", "export", "pos",
            "--format", "csv", "--units", "mm", "--side", "both",
            "--output", "{out}", "{board}",
        ),
        source="board",
        output_kind="file",
        output_name="assembly/positions.csv",
        member_kind="position",
        canonicalizer="csv",
        domains=("assembly",),
        variant_flag=True,
    ),
    StepSpec(
        step_id="bom",
        step_type="sch_export_bom",
        argv=("sch", "export", "bom", "--output", "{out}", "{schematic}"),
        source="schematic",
        output_kind="file",
        output_name="assembly/bom.csv",
        member_kind="bom",
        canonicalizer="csv",
        domains=("assembly",),
        variant_flag=True,
    ),
    StepSpec(
        step_id="board_pdf",
        step_type="pcb_export_pdf",
        argv=("pcb", "export", "pdf", "--output", "{out}", "{board}"),
        source="board",
        output_kind="file",
        output_name="documentation/board.pdf",
        member_kind="board_pdf",
        canonicalizer="pdf",
        domains=("documentation",),
        optional=True,
        variant_flag=True,
    ),
    StepSpec(
        step_id="schematic_pdf",
        step_type="sch_export_plot_pdf",
        argv=("sch", "export", "pdf", "--output", "{out}", "{schematic}"),
        source="schematic",
        output_kind="file",
        output_name="documentation/schematic.pdf",
        member_kind="schematic_pdf",
        canonicalizer="pdf",
        domains=("documentation",),
        optional=True,
    ),
)


STEP_BY_ID: Mapping[str, StepSpec] = {spec.step_id: spec for spec in STEP_CATALOGUE}

# The Documentation Engine's sheets, deliberately *outside* `STEP_CATALOGUE`:
# they are composed in-process rather than by a `kicad-cli` invocation, so they
# have no step type in KiCad's job registry and `run_step_catalogue` must not
# try to execute them. The spec exists so composed sheets travel through the
# same member pipeline as everything else, with the canonicalizer resolved per
# file by suffix.
DOCUMENT_STEP_SPEC = StepSpec(
    step_id="documents",
    step_type="prism_compose_documents",
    argv=(),
    source="board",
    output_kind="dir",
    output_name="documentation",
    member_kind="document_sheet",
    canonicalizer="",
    domains=("documentation",),
    optional=True,
)

# Which steps produce release evidence rather than shipped artwork.
EVIDENCE_STEPS: Mapping[str, str] = {"drc": "drc", "erc": "erc"}


class StepExecutionError(RuntimeError):
    """A catalogue step failed for a reason that is not a design violation."""


def resolve_cli_path(explicit: str | None = None) -> str:
    """Return the kicad-cli executable, preferring an explicit override."""

    if explicit:
        return explicit
    configured = os.environ.get("KICAD_CLI_PATH", "").strip()
    if configured:
        return configured
    found = shutil.which("kicad-cli")
    if found:
        return found
    raise StepExecutionError("kicad-cli is not available on PATH")


def selected_steps(
    *,
    board: Path | None,
    schematic: Path | None,
    only: Sequence[str] | None = None,
) -> tuple[StepSpec, ...]:
    """Return catalogue steps whose source document exists."""

    chosen: list[StepSpec] = []
    for spec in STEP_CATALOGUE:
        if only is not None and spec.step_id not in only:
            continue
        if spec.source == "board" and board is None:
            continue
        if spec.source == "schematic" and schematic is None:
            continue
        chosen.append(spec)
    return tuple(chosen)


def run_step_catalogue(
    *,
    closure_root: Path,
    board_rel: str,
    schematic_rel: str | None,
    output_root: Path,
    variant: str = "",
    cli_path: str | None = None,
    only: Sequence[str] | None = None,
    timeout_seconds: int = DEFAULT_CLI_TIMEOUT_SECONDS,
    progress: Any = None,
    runner: Any = None,
) -> tuple[StepOutput, ...]:
    """Run the catalogue against a materialized closure.

    ``runner`` is injected by tests; it defaults to :func:`subprocess.run`.
    """

    cli = resolve_cli_path(cli_path)
    execute = runner or _default_runner
    board = (closure_root / board_rel) if board_rel else None
    schematic = (closure_root / schematic_rel) if schematic_rel else None
    if board is not None and not board.is_file():
        raise StepExecutionError(f"board not found in closure: {board_rel}")
    if schematic is not None and not schematic.is_file():
        schematic = None

    specs = selected_steps(board=board, schematic=schematic, only=only)
    results: list[StepOutput] = []
    for index, spec in enumerate(specs):
        if progress is not None:
            progress(
                stage="generate",
                message=f"Running {spec.step_id}",
                percent=10 + int(60 * index / max(1, len(specs))),
            )
        results.append(
            _run_one(
                spec,
                cli=cli,
                closure_root=closure_root,
                board=board,
                schematic=schematic,
                board_rel=board_rel,
                schematic_rel=schematic_rel or "",
                output_root=output_root,
                variant=variant,
                timeout_seconds=timeout_seconds,
                execute=execute,
            )
        )
    return tuple(results)


def _run_one(
    spec: StepSpec,
    *,
    cli: str,
    closure_root: Path,
    board: Path | None,
    schematic: Path | None,
    board_rel: str,
    schematic_rel: str,
    output_root: Path,
    variant: str,
    timeout_seconds: int,
    execute: Any,
) -> StepOutput:
    destination = output_root / spec.output_name
    if spec.output_kind == "dir":
        destination.mkdir(parents=True, exist_ok=True)
    else:
        destination.parent.mkdir(parents=True, exist_ok=True)

    substitutions = {
        "board": str(board) if board else "",
        "schematic": str(schematic) if schematic else "",
        "out": str(destination),
        "variant": variant,
    }
    # The recorded argv must be host-path independent: it feeds the domain
    # fingerprints, so an identical build from a different checkout directory
    # has to normalize to identical text.
    normalized_substitutions = {
        "board": board_rel,
        "schematic": schematic_rel,
        "out": spec.output_name,
        "variant": variant,
    }
    argv = [cli, *(part.format(**substitutions) for part in spec.argv)]
    normalized = ["kicad-cli", *(part.format(**normalized_substitutions) for part in spec.argv)]
    if spec.variant_flag and variant:
        argv.extend(("--variant", variant))
        normalized.extend(("--variant", variant))

    result = execute(argv, closure_root, timeout_seconds)
    files = _collect_outputs(destination, spec)
    if result.returncode != 0 and not files:
        message = (result.stderr or result.stdout or "").strip()
        if spec.optional:
            return StepOutput(
                step_id=spec.step_id,
                step_type=spec.step_type,
                normalized_argv=tuple(normalized),
                returncode=result.returncode,
                files=(),
                root=output_root,
                spec=spec,
                stdout=result.stdout,
                stderr=result.stderr,
                skipped_reason=f"optional step failed: {message[:400]}",
            )
        raise StepExecutionError(
            f"step {spec.step_id} ({spec.step_type}) failed with exit code "
            f"{result.returncode}: {message[:800]}"
        )
    return StepOutput(
        step_id=spec.step_id,
        step_type=spec.step_type,
        normalized_argv=tuple(normalized),
        returncode=result.returncode,
        files=files,
        root=output_root,
        spec=spec,
        stdout=result.stdout,
        stderr=result.stderr,
    )


def _collect_outputs(destination: Path, spec: StepSpec) -> tuple[Path, ...]:
    if spec.output_kind == "file":
        return (destination,) if destination.is_file() else ()
    if not destination.is_dir():
        return ()
    return tuple(
        sorted(
            (path for path in destination.rglob("*") if path.is_file()),
            key=lambda path: path.as_posix(),
        )
    )


@dataclass(frozen=True, slots=True)
class _RunResult:
    returncode: int
    stdout: str
    stderr: str


def _default_runner(argv: Sequence[str], cwd: Path, timeout_seconds: int) -> _RunResult:
    try:
        completed = subprocess.run(
            list(argv),
            cwd=str(cwd),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:  # pragma: no cover - timing dependent
        raise StepExecutionError(
            f"kicad-cli timed out after {timeout_seconds}s: {' '.join(argv[:4])}"
        ) from exc
    except OSError as exc:
        raise StepExecutionError(f"kicad-cli could not be executed: {exc}") from exc
    return _RunResult(completed.returncode, completed.stdout or "", completed.stderr or "")


def evidence_counts(report: Mapping[str, Any]) -> dict[str, int]:
    """Count violations by severity in a canonicalized DRC/ERC report.

    KiCad nests violations under several keys and, for ERC, under per-sheet
    lists.  Everything is folded into one severity histogram plus a total.
    """

    counts: dict[str, int] = {}
    total = 0
    for item in _iter_violations(report):
        severity = str(item.get("severity") or "unknown").strip().lower() or "unknown"
        counts[severity] = counts.get(severity, 0) + 1
        total += 1
    counts["total"] = total
    return counts


def _iter_violations(report: Mapping[str, Any]) -> Iterable[Mapping[str, Any]]:
    for key in ("violations", "unconnected_items", "schematic_parity"):
        for item in report.get(key) or ():
            if isinstance(item, Mapping):
                yield item
    for sheet in report.get("sheets") or ():
        if isinstance(sheet, Mapping):
            for item in sheet.get("violations") or ():
                if isinstance(item, Mapping):
                    yield item


__all__ = [
    "EVIDENCE_STEPS",
    "STEP_BY_ID",
    "STEP_CATALOGUE",
    "StepExecutionError",
    "StepOutput",
    "StepSpec",
    "evidence_counts",
    "resolve_cli_path",
    "run_step_catalogue",
    "selected_steps",
]
