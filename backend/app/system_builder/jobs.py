"""The ``system_bundle``, ``system_board_step`` and ``system_step`` jobs
(docs/system-builder/CONTRACTS.md §8.1, §8.8, §18).

One bundle job builds one system bundle key, deduplicated on
``<system_id>:<bundle_key>``. The handler re-reads the system as the system
itself, recomputes the members (queueing any missing design bundle) and the
key, then runs ``prism-kicad system build`` on the document, the ready members'
stored bundles and the catalog parts the document's bodies name. A pending
occurrence is left to the CLI; an absent one is passed as ``--absent``.

The document may change between queueing and execution. The key then differs
from the payload's, and the job builds the current key instead: a derived
artifact is always keyed by what it was actually built from. The queued row is
failed as superseded so no listing claims it is on its way.

The STEP jobs follow the same rule. ``system_board_step`` exports one board's
model with ``kicad-cli``, cached by ``(project, commit, kicad-cli version,
options)``. ``system_step`` waits for the models of the ready board
occurrences, stages the board and catalog part STEP files, then runs
``prism-kicad system step`` for the current bundle key.
"""

from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.core.config import settings
from app.release_studio.closure import ClosureError, materialize_project_input_closure
from app.services import project_revision
from app.services.design_bundle import cli, schemas
from app.services.job_kinds import JobKind
from app.services.job_runtime import JobContext, JobResult, PermanentJobError, RetryableJobError
from app.services.kicad_tools import KicadTools, ToolError, ToolTimeout, ToolUnavailable
from app.services.workspace_service import workspace
from app.system_builder import board_sub_ports, bundle_store, step_models, step_store
from app.system_builder import members as member_view
from app.system_builder import parts as parts_input
from app.system_builder.git_link import SYSTEM_GIT_COMMIT
from app.system_builder.store import SystemStore

KIND = "system_bundle"
BOARD_STEP_KIND = "system_board_step"
STEP_KIND = "system_step"


def system_store() -> SystemStore:
    """The store the job reads the system through; tests replace the factory."""

    return SystemStore()


def resolve_tools() -> KicadTools:
    """The KiCad tools the STEP jobs run; tests replace the factory."""

    return KicadTools.resolve()


def artifact_key(system_id: str, bundle_key: str) -> str:
    """The bundle job's dedup key, ``<system_id>:<bundle_key>``."""

    return f"{system_id}:{bundle_key}"


def step_artifact_key(system_id: str, bundle_key: str) -> str:
    """The STEP job's dedup key, ``<system_id>:<bundle_key>:step`` (§18)."""

    return f"{system_id}:{bundle_key}:step"


def start_system_bundle_job(
    system_id: str,
    bundle_key: str,
    document_version: int,
    *,
    requested_by: str = "",
) -> str:
    """Queue the bundle of ``system_id`` at ``bundle_key`` and record the row."""

    queued = SYSTEM_BUNDLE.enqueue(
        {
            "system_id": system_id,
            "bundle_key": bundle_key,
            "document_version": int(document_version),
        },
        artifact_key=artifact_key(system_id, bundle_key),
        requested_by=requested_by,
    )
    bundle_store.upsert(
        system_id=system_id,
        bundle_key=bundle_key,
        state="queued",
        job_id=str(queued["job_id"]),
        document_version=int(document_version),
    )
    return str(queued["job_id"])


# ------------------------------------------------------------ build inputs


@dataclass(frozen=True)
class StagedBuild:
    """The inputs both ``system build`` and ``system step`` read.

    The document, board sub-ports and parts documents are written beside the
    part files; the bundle key is computed from exactly the same values.
    """

    generator: Any
    members: tuple[member_view.Member, ...]
    board_sub_ports: Mapping[str, Any]
    parts_document: Mapping[str, Any]
    part_files: tuple[tuple[Path, Path], ...]
    bundle_key: str
    document_path: Path
    board_sub_ports_path: Path
    parts_path: Path


def _stage_build_inputs(
    context: JobContext,
    store: SystemStore,
    document: Mapping[str, Any],
    *,
    requested_by: str = "",
    members: Sequence[member_view.Member] | None = None,
    generator: Any = None,
) -> StagedBuild:
    """Stage the document, sub-ports and parts, and compute the current key.

    The bundle and STEP jobs share this: their staged bytes and key must be the
    same or the STEP would describe another build.
    """

    resolved = tuple(
        members
        if members is not None
        else member_view.resolve(document, requested_by=requested_by)
    )
    found = generator if generator is not None else cli.generator()
    with store.connection() as conn:
        board_input = board_sub_ports.build_input(conn, document)
    parts_document, part_files = parts_input.build_input(document)
    bundle_key = member_view.system_bundle_key(
        document,
        found.digest,
        resolved,
        board_sub_ports=board_input,
        entries=member_view.entry_key_input(resolved),
        parts=parts_input.digest(parts_document),
    )

    document_path = context.staging_dir / "document.json"
    document_path.write_bytes(member_view.canonical_bytes(document))
    board_sub_ports_path = context.staging_dir / "board-sub-ports.json"
    board_sub_ports_path.write_bytes(member_view.canonical_bytes(board_input))
    parts_path = context.staging_dir / "parts.json"
    parts_path.write_bytes(member_view.canonical_bytes(parts_document))
    parts_input.stage(context.staging_dir, part_files)
    return StagedBuild(
        generator=found,
        members=resolved,
        board_sub_ports=board_input,
        parts_document=parts_document,
        part_files=tuple(part_files),
        bundle_key=bundle_key,
        document_path=document_path,
        board_sub_ports_path=board_sub_ports_path,
        parts_path=parts_path,
    )


def _cli_error(failure: cli.CliFailure, command: str) -> RetryableJobError | PermanentJobError:
    message = f"prism-kicad {command}: {failure}"
    if failure.retryable:
        return RetryableJobError(message, code=failure.code)
    return PermanentJobError(message, code=failure.code)


# ------------------------------------------------------------------ bundle


def run_system_bundle_job(context: JobContext) -> JobResult:
    """Build one system bundle, or the one the system has moved on to."""

    payload = context.payload
    system_id = str(payload["system_id"])
    queued_key = str(payload["bundle_key"])
    store = system_store()
    record = store.read(system_id, role="admin")
    if record is None:
        raise PermanentJobError("System not found", code="system-not-found")
    document = record["document"]

    context.progress(
        stage="system-members", message="Reading the board design bundles", percent=5, force=True
    )
    try:
        staged = _stage_build_inputs(
            context, store, document,
            requested_by=str(payload.get("requested_by") or ""),
        )
    except cli.CliUnavailable as error:
        raise PermanentJobError(str(error), code="cli-unavailable") from error
    except cli.CliFailure as failure:
        raise _cli_error(failure, "version") from failure

    bundle_key = staged.bundle_key
    rebased = bundle_key != queued_key
    if rebased:
        bundle_store.supersede(system_id, queued_key, bundle_key)
        bundle_store.upsert(
            system_id=system_id,
            bundle_key=bundle_key,
            state="building",
            job_id=context.job_id,
            document_version=int(record["version"]),
        )

    output = context.staging_dir / "system-bundle.json"
    args = [
        "system", "build",
        "--document", str(staged.document_path),
        *member_view.cli_args(staged.members),
        "--board-sub-ports", str(staged.board_sub_ports_path),
        "--parts", str(staged.parts_path),
        "-o", str(output),
    ]
    context.progress(
        stage="system-build", message="Building the system bundle", percent=30, force=True
    )
    try:
        done = cli.run(
            args,
            expect="prism.cli.system_result.a0",
            timeout_seconds=settings.PRISM_SYSTEM_BUNDLE_TIMEOUT_SECONDS,
            cancel=context.check_cancelled,
        )
    except cli.CliFailure as failure:
        raise _cli_error(failure, "system build") from failure

    reported = str((done.document or {}).get("system_bundle_key") or "")
    if reported != bundle_key:
        raise PermanentJobError(
            f"prism-kicad computed system bundle key {reported or '(none)'}; "
            f"the document and members give {bundle_key}",
            code="system-bundle-key-mismatch",
        )

    try:
        bundle = json.loads(output.read_text(encoding="utf-8"))
    except (OSError, ValueError) as error:
        raise RetryableJobError(
            f"prism-kicad system build wrote no readable bundle: {error}",
            code="system-bundle-invalid",
        ) from error
    try:
        schemas.validate(bundle, "prism.system_bundle.a0")
    except schemas.SchemaInvalid as error:
        raise RetryableJobError(
            f"prism-kicad system build wrote an invalid bundle: {error}",
            code="system-bundle-invalid",
        ) from None

    bundle_store.install(system_id, bundle_key, output)
    bundle_store.upsert(
        system_id=system_id,
        bundle_key=bundle_key,
        state="complete",
        job_id=context.job_id,
        document_version=int(record["version"]),
    )
    counts = dict((done.document or {}).get("counts") or {})
    details: dict[str, Any] = {
        "system_id": system_id,
        "bundle_key": bundle_key,
        "queued_key": queued_key,
        "rebased": rebased,
        "document_version": int(record["version"]),
        "document_sha256": str((done.document or {}).get("document_sha256") or ""),
        "pending": sorted(
            member.occurrence for member in staged.members if member.state == member_view.PENDING
        ),
        "absent": sorted(
            member.occurrence for member in staged.members if member.state == member_view.ABSENT
        ),
        "ready": sorted(
            member.occurrence for member in staged.members if member.state == member_view.READY
        ),
        "entries": sorted(member_view.entry_key_input(staged.members)),
        "counts": counts,
    }
    if rebased:
        details["superseded_key"] = queued_key
    return JobResult(message="System bundle ready", details=details)


# ------------------------------------------------------------- board STEP


def _board_meta(
    project_id: str,
    commit: str,
    kicad_cli_version: str,
    *,
    missing_models: int = 0,
    fallback: bool = False,
    size_bytes: int = 0,
) -> dict[str, Any]:
    return {
        "project": str(project_id),
        "commit": str(commit),
        "kicadCli": str(kicad_cli_version),
        "options": list(step_store.BOARD_STEP_OPTIONS),
        "missingModels": int(missing_models),
        "fallback": bool(fallback),
        "sizeBytes": int(size_bytes),
    }


def start_system_board_step_job(
    project_id: str,
    commit: str,
    *,
    kicad_version: str | None = None,
    requested_by: str = "",
) -> str | None:
    """Queue one board export, unless a stored model already answers its key."""

    if kicad_version is None:
        tools = resolve_tools()
        kicad_version = tools.cli.version() if tools.cli is not None else "unavailable"
    key = step_store.board_key(
        project_id, commit, kicad_version, step_store.BOARD_STEP_OPTIONS
    )
    if step_store.board_exists(key):
        return None
    queued = SYSTEM_BOARD_STEP.enqueue(
        {"project_id": str(project_id), "commit": str(commit)},
        artifact_key=key,
        requested_by=requested_by,
    )
    if queued.get("cache_hit"):
        return None
    return str(queued["job_id"])


def _project_file(project_dir: Path, anchor: str) -> Path:
    """The ``.kicad_pro`` of the project, preferring the project row's anchor."""

    if not project_dir.is_dir():
        raise PermanentJobError(
            f"the project directory is not in the commit's tree: {project_dir.name}",
            code="step-project-missing",
        )
    if anchor:
        raw = Path(anchor)
        for candidate in (raw, raw.with_suffix(".kicad_pro")):
            target = (project_dir / candidate).resolve()
            if target.is_file() and target.suffix == ".kicad_pro":
                return target
    direct = sorted(project_dir.glob("*.kicad_pro"))
    if direct:
        return direct[0]
    nested = sorted(path for path in project_dir.rglob("*.kicad_pro") if ".git" not in path.parts)
    if nested:
        return nested[0]
    raise PermanentJobError(
        f"no .kicad_pro in the project directory: {project_dir.name}",
        code="step-project-missing",
    )


def _project_board(project_file: Path) -> Path:
    """The ``.kicad_pcb`` the project file names, else its same-stem sibling.

    KiCad writes a project's boards into ``boards`` (usually empty for a
    single-board project); the sibling is the ordinary case.
    """

    try:
        project = json.loads(project_file.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        project = {}
    entries = project.get("boards") or [] if isinstance(project, dict) else []
    for entry in entries:
        candidate = project_file.parent / str(entry)
        if candidate.suffix.lower() != ".kicad_pcb":
            candidate = candidate.with_suffix(".kicad_pcb")
        if candidate.is_file():
            return candidate
    sibling = project_file.with_suffix(".kicad_pcb")
    if sibling.is_file():
        return sibling
    boards = sorted(project_file.parent.glob("*.kicad_pcb"))
    if boards:
        return boards[0]
    raise PermanentJobError(
        f"the project names no .kicad_pcb: {project_file.name}", code="step-board-missing"
    )


def _tool_tail(result: Any) -> str:
    lines = [
        line.strip()
        for line in (result.stderr or result.stdout or "").splitlines()
        if line.strip()
    ]
    return " | ".join(lines[-5:]) or f"exit {result.returncode}"


def _run_board_export(
    context: JobContext,
    *,
    project_id: str,
    commit: str,
    key: str,
    meta: Mapping[str, Any],
    tool: Any,
    source_root: Path,
    project_rel: str,
    anchor: str,
    fallback: bool,
) -> JobResult:
    project_dir = source_root / project_rel if project_rel not in ("", ".") else source_root
    board = _project_board(_project_file(project_dir, anchor))
    output = context.staging_dir / f"board-{key}.step"
    context.progress(
        stage="board-step", message="Exporting the board STEP model", percent=30, force=True
    )
    try:
        result = tool.run(
            [
                "pcb", "export", "step",
                *step_store.BOARD_STEP_OPTIONS,
                "-o", str(output),
                str(board),
            ],
            timeout=settings.PRISM_SYSTEM_STEP_TIMEOUT_SECONDS,
            cwd=project_dir,
            tee=True,
        )
    except ToolTimeout as error:
        raise RetryableJobError(str(error), code="board-step-timeout", retry_after_seconds=15) from error
    except ToolUnavailable as error:
        raise PermanentJobError(str(error), code="kicad-cli-unavailable") from error
    except ToolError as error:
        raise PermanentJobError(str(error), code="board-step-export-failed") from error
    if not getattr(result, "ok", False):
        raise PermanentJobError(
            f"kicad-cli pcb export step failed: {_tool_tail(result)}",
            code="board-step-export-failed",
        )
    if not output.is_file():
        raise PermanentJobError(
            "kicad-cli pcb export step reported success but wrote no file",
            code="board-step-export-failed",
        )
    missing = sum(
        1
        for line in f"{result.stdout}\n{result.stderr}".splitlines()
        if "File not found" in line
    )
    stored = {
        **dict(meta),
        "missingModels": missing,
        "fallback": bool(fallback),
        "sizeBytes": output.stat().st_size,
    }
    step_store.board_install(key, output, meta=stored)
    return JobResult(
        message="Board STEP ready",
        details={
            "key": key,
            "project_id": project_id,
            "commit": commit,
            "kicad_cli": str(meta["kicadCli"]),
            "missingModels": missing,
            "fallback": bool(fallback),
            "sizeBytes": stored["sizeBytes"],
        },
    )


def run_system_board_step_job(context: JobContext) -> JobResult:
    """Export one board's STEP model, cached by ``(project, commit, CLI, options)``."""

    payload = context.payload
    project_id = str(payload["project_id"])
    commit = str(payload["commit"])
    tools = resolve_tools().with_cancel(context.check_cancelled)
    tool = tools.cli
    if tool is None:
        raise PermanentJobError(
            "kicad-cli is not installed where Prism looks", code="kicad-cli-unavailable"
        )
    version = tool.version()
    key = step_store.board_key(
        project_id, commit, version, step_store.BOARD_STEP_OPTIONS
    )
    if step_store.board_exists(key):
        return JobResult(
            message="Board STEP already stored",
            details={"key": key, "project_id": project_id, "commit": commit, "cached": True},
        )
    meta = _board_meta(project_id, commit, version)
    step_store.board_clear(key)
    try:
        location = project_revision.locate_id(project_id)
    except (ValueError, project_revision.ProjectNotInRepository) as error:
        step_store.board_failed(key, meta=meta, error=str(error))
        raise PermanentJobError(str(error), code="project-not-found") from error
    anchor = str(
        (workspace.get_project_by_id(project_id) or {}).get("project_file_rel")
        or location.anchor
        or ""
    )
    try:
        try:
            closure = materialize_project_input_closure(
                project_id,
                commit,
                context.staging_dir / "board-closure",
                model_env=os.environ,
                model_stage=context.staging_dir / "board-models",
            )
        except ClosureError:
            shutil.rmtree(context.staging_dir / "board-closure", ignore_errors=True)
            context.progress(
                stage="board-step",
                message="The closure is incomplete; using a plain checkout",
                percent=15,
                force=True,
            )
            with project_revision.checkout(location, commit) as checkout:
                return _run_board_export(
                    context,
                    project_id=project_id,
                    commit=commit,
                    key=key,
                    meta=meta,
                    tool=tool,
                    source_root=checkout.root,
                    project_rel=location.relative_path or ".",
                    anchor=anchor,
                    fallback=True,
                )
        return _run_board_export(
            context,
            project_id=project_id,
            commit=commit,
            key=key,
            meta=meta,
            tool=tool,
            source_root=closure.materialized_root,
            project_rel=closure.project_path or ".",
            anchor=anchor,
            fallback=False,
        )
    except PermanentJobError as error:
        step_store.board_failed(key, meta=meta, error=str(error))
        raise


# -------------------------------------------------------------- system STEP


def _step_record(
    state: str,
    boards: Sequence[Mapping[str, Any]],
    *,
    missing: Sequence[str] = (),
    error: str = "",
    size_bytes: int = 0,
    job_id: str = "",
) -> dict[str, Any]:
    return {
        "state": str(state),
        "boards": [dict(item) for item in boards],
        "missing": sorted(str(item) for item in missing),
        "error": str(error),
        "sizeBytes": int(size_bytes),
        "jobId": str(job_id),
    }


def _board_entry(
    target: step_models.BoardTarget,
    state: str,
    record: Mapping[str, Any] | None,
) -> dict[str, Any]:
    return {
        "occurrence": target.key,
        "label": target.label,
        "state": str(state),
        "missingModels": int((record or {}).get("missingModels") or 0),
        "fallback": bool((record or {}).get("fallback")),
    }


def _labels(document: Mapping[str, Any]) -> dict[str, str]:
    return {
        str(item["id"]): str(item.get("label") or item["id"])
        for item in document.get("occurrences") or []
        if item.get("id") is not None
    }


def start_system_step_job(
    system_id: str,
    bundle_key: str,
    *,
    requested_by: str = "",
    retry_failed: bool = False,
) -> str:
    """Queue the STEP assembly of ``system_id`` at ``bundle_key``."""

    queued = SYSTEM_STEP.enqueue(
        {
            "system_id": system_id,
            "bundle_key": bundle_key,
            "retry_failed": bool(retry_failed),
        },
        artifact_key=step_artifact_key(system_id, bundle_key),
        requested_by=requested_by,
    )
    job_id = str(queued["job_id"])
    existing = step_store.system_record(system_id, bundle_key)
    if not queued.get("cache_hit") and (
        existing is None or existing.get("state") != "building"
    ):
        step_store.system_write_meta(
            system_id, bundle_key, _step_record("building", [], job_id=job_id)
        )
    return job_id


def _fail_step(
    system_id: str,
    bundle_key: str,
    job_id: str,
    boards: Sequence[Mapping[str, Any]],
    error: str,
) -> None:
    step_store.system_write_meta(
        system_id,
        bundle_key,
        _step_record("failed", boards, error=error, job_id=job_id),
    )


def run_system_step_job(context: JobContext) -> JobResult:
    """Assemble one system's STEP file for its current bundle key."""

    payload = context.payload
    system_id = str(payload["system_id"])
    queued_key = str(payload["bundle_key"])
    requested_by = str(payload.get("requested_by") or "")
    retry_failed = bool(payload.get("retry_failed"))
    store = system_store()
    record = store.read(system_id, role="admin")
    if record is None:
        raise PermanentJobError("System not found", code="system-not-found")
    document = record["document"]
    boards: list[dict[str, Any]] = []
    current_key = queued_key
    try:
        context.progress(
            stage="system-step", message="Preparing the STEP assembly", percent=5, force=True
        )
        staged = _stage_build_inputs(
            context, store, document, requested_by=requested_by
        )
        current_key = staged.bundle_key

        if current_key != queued_key:
            step_store.system_write_meta(
                system_id,
                queued_key,
                _step_record(
                    "failed",
                    [],
                    error=f"the system changed after queueing; the current key is {current_key}",
                    job_id=context.job_id,
                ),
            )

        bundle = bundle_store.read(system_id, current_key)
        if bundle is None:
            row = bundle_store.get(system_id, current_key)
            if row is not None and row.get("state") == "failed" and bundle_store.failed_recently(row):
                raise PermanentJobError(
                    f"the system bundle failed: {row.get('error') or 'no reason recorded'}",
                    code="system-bundle-failed",
                )
            start_system_bundle_job(
                system_id, current_key, record["version"], requested_by=requested_by
            )
            step_store.system_write_meta(
                system_id,
                current_key,
                _step_record("building", [], job_id=context.job_id),
            )
            raise RetryableJobError(
                "the system bundle is still building",
                code="system-bundle-building",
                retry_after_seconds=5,
            )

        tools = resolve_tools().with_cancel(context.check_cancelled)
        labels = _labels(document)
        targets = step_models.board_targets(staged.members, labels)
        if targets and tools.cli is None:
            raise PermanentJobError(
                "kicad-cli is not installed where Prism looks",
                code="kicad-cli-unavailable",
            )
        version = tools.cli.version() if tools.cli is not None else ""
        waiting = False
        for target in targets:
            key = step_store.board_key(
                target.project_id, target.commit, version, step_store.BOARD_STEP_OPTIONS
            )
            stored = step_store.board_record(key)
            if step_store.board_exists(key):
                boards.append(_board_entry(target, "ready", stored))
                continue
            if stored and str(stored.get("state")) == "failed" and not retry_failed:
                boards.append(_board_entry(target, "failed", stored))
                continue
            start_system_board_step_job(
                target.project_id,
                target.commit,
                kicad_version=version,
                requested_by=requested_by,
            )
            boards.append(_board_entry(target, "building", stored))
            waiting = True
        step_store.system_write_meta(
            system_id,
            current_key,
            _step_record("building", boards, job_id=context.job_id),
        )
        if waiting:
            raise RetryableJobError(
                "the board STEP models are still building",
                code="system-board-step-building",
                retry_after_seconds=3,
            )

        board_files: dict[str, tuple[Path, int]] = {}
        for target in targets:
            key = step_store.board_key(
                target.project_id, target.commit, version, step_store.BOARD_STEP_OPTIONS
            )
            if step_store.board_exists(key):
                board_files[target.key] = (step_store.board_path(key), target.thickness_nm)
        part_files = step_models.models_for(document, members=staged.members)
        manifest = {
            "boards": step_models.stage_boards(context.staging_dir, board_files),
            "parts": step_models.stage_parts(context.staging_dir, part_files),
        }
        models_path = step_models.write_manifest(context.staging_dir, manifest)
        output = context.staging_dir / "system.step"
        args = [
            "system", "step",
            "--document", str(staged.document_path),
            *member_view.cli_args(staged.members),
            "--board-sub-ports", str(staged.board_sub_ports_path),
            "--parts", str(staged.parts_path),
            "--models", str(models_path),
            "-o", str(output),
        ]
        context.progress(
            stage="system-step", message="Assembling the system STEP file", percent=60,
            force=True,
        )
        try:
            done = cli.run_plain(
                args,
                timeout_seconds=settings.PRISM_SYSTEM_STEP_TIMEOUT_SECONDS,
                cancel=context.check_cancelled,
            )
        except cli.CliFailure as failure:
            raise _cli_error(failure, "system step") from failure
        reported = done.document or {}
        missing = reported.get("missing")
        if (
            not isinstance(missing, list)
            or not all(isinstance(item, str) for item in missing)
            or not output.is_file()
        ):
            raise RetryableJobError(
                "prism-kicad system step wrote no readable result",
                code="system-step-invalid",
            )
        step_store.system_install(
            system_id,
            current_key,
            output,
            record=_step_record(
                "ready",
                boards,
                missing=missing,
                size_bytes=output.stat().st_size,
                job_id=context.job_id,
            ),
        )
        details: dict[str, Any] = {
            "system_id": system_id,
            "bundle_key": current_key,
            "queued_key": queued_key,
            "rebased": current_key != queued_key,
            "document_version": int(record["version"]),
            "products": int(reported.get("products") or 0),
            "missing": sorted(missing),
            "sizeBytes": output.stat().st_size,
            "boards": boards,
        }
        if current_key != queued_key:
            details["superseded_key"] = queued_key
        return JobResult(message="System STEP ready", details=details)
    except RetryableJobError:
        raise
    except cli.CliUnavailable as error:
        _fail_step(system_id, current_key, context.job_id, boards, str(error))
        raise PermanentJobError(str(error), code="cli-unavailable") from error
    except cli.CliFailure as failure:
        message = f"prism-kicad system step: {failure}"
        _fail_step(system_id, current_key, context.job_id, boards, message)
        raise _cli_error(failure, "system step") from failure
    except PermanentJobError as error:
        _fail_step(system_id, current_key, context.job_id, boards, str(error))
        raise
    except Exception as error:
        _fail_step(system_id, current_key, context.job_id, boards, str(error))
        raise


# ------------------------------------------------------------- end of jobs


def settle_system_bundle_end(job: Mapping[str, Any]) -> bool:
    """End hook: a bundle whose job ended without completing is marked failed."""

    if job.get("status") not in ("failed", "cancelled"):
        return False
    payload = job.get("payload") or {}
    system_id = str(payload.get("system_id") or "")
    bundle_key = str(payload.get("bundle_key") or "")
    job_id = str(job.get("id") or job.get("job_id") or "")
    found = (
        bundle_store.get_by_job(system_id, job_id)
        if system_id and job_id
        else None
    )
    if found is None and system_id and bundle_key:
        found = bundle_store.get(system_id, bundle_key)
    if (
        not found
        or found["state"] not in ("queued", "building")
        or str(found.get("job_id") or "") != job_id
    ):
        return False
    bundle_store.upsert(
        system_id=system_id,
        bundle_key=str(found["bundle_key"]),
        state="failed",
        document_version=int(found["document_version"]),
        error=str(job.get("error_message") or job.get("status")),
    )
    return True


def settle_system_step_end(job: Mapping[str, Any]) -> bool:
    """End hook: a STEP whose job ended without completing is marked failed."""

    if job.get("status") not in ("failed", "cancelled"):
        return False
    payload = job.get("payload") or {}
    system_id = str(payload.get("system_id") or "")
    job_id = str(job.get("id") or job.get("job_id") or "")
    if not system_id or not job_id:
        return False
    found = step_store.system_record_for_job(system_id, job_id)
    if found is None:
        return False
    bundle_key, record = found
    if record.get("state") != "building":
        return False
    step_store.system_write_meta(
        system_id,
        bundle_key,
        _step_record(
            "failed",
            record.get("boards") or [],
            missing=record.get("missing") or [],
            error=str(job.get("error_message") or job.get("status")),
            size_bytes=int(record.get("sizeBytes") or 0),
            job_id=job_id,
        ),
    )
    return True


def _unsettled_bundles() -> list[str]:
    with bundle_store.default_connect() as conn:
        found = conn.execute(
            """SELECT j.id FROM ws_system_bundles b JOIN ws_jobs j ON j.id = b.job_id
               WHERE b.state IN ('queued', 'building') AND j.status IN ('failed', 'cancelled')
               ORDER BY j.updated_at DESC LIMIT 100"""
        ).fetchall()
    return [str(item["id"]) for item in found]


def _unsettled_steps() -> list[str]:
    with bundle_store.default_connect() as conn:
        found = conn.execute(
            """SELECT id FROM ws_jobs
                WHERE kind = %s AND status IN ('failed', 'cancelled')
                ORDER BY updated_at DESC LIMIT 100""",
            (STEP_KIND,),
        ).fetchall()
    return [str(item["id"]) for item in found]


SYSTEM_BUNDLE = JobKind(
    KIND,
    run_system_bundle_job,
    resources={"prism_worker": 1},
    max_attempts=2,
    priority=140,
    settle=settle_system_bundle_end,
    orphans=_unsettled_bundles,
)
SYSTEM_BOARD_STEP = JobKind(
    BOARD_STEP_KIND,
    run_system_board_step_job,
    resources={"prism_worker": 1},
    max_attempts=2,
    priority=140,
)
SYSTEM_STEP = JobKind(
    STEP_KIND,
    run_system_step_job,
    resources={"prism_worker": 1},
    # Waiting for board models retries a few times across a long export.
    max_attempts=120,
    priority=140,
    settle=settle_system_step_end,
    orphans=_unsettled_steps,
)
JOB_KINDS = (SYSTEM_BUNDLE, SYSTEM_BOARD_STEP, SYSTEM_STEP, SYSTEM_GIT_COMMIT)
