"""The ``system_bundle`` job (docs/system-builder/CONTRACTS.md §8.1, §8.8).

One job builds one system bundle key, deduplicated on
``<system_id>:<bundle_key>``. The handler re-reads the system as the system
itself, recomputes the members (queueing any missing design bundle) and the
key, then runs ``prism-kicad system build`` on the document and the ready
members' stored bundles. A pending occurrence is left to the CLI; an absent one
is passed as ``--absent``.

The document may change between queueing and execution. The key then differs
from the payload's, and the job builds the current key instead: a derived
artifact is always keyed by what it was actually built from. The queued row is
failed as superseded so no listing claims it is on its way.
"""

from __future__ import annotations

import json
from typing import Any, Mapping

from app.core.config import settings
from app.services.design_bundle import cli, schemas
from app.services.job_kinds import JobKind
from app.services.job_runtime import JobContext, JobResult, PermanentJobError, RetryableJobError
from app.system_builder import board_sub_ports, bundle_store
from app.system_builder import members as member_view
from app.system_builder.git_link import SYSTEM_GIT_COMMIT
from app.system_builder.store import SystemStore

KIND = "system_bundle"


def system_store() -> SystemStore:
    """The store the job reads the system through; tests replace the factory."""

    return SystemStore()


def artifact_key(system_id: str, bundle_key: str) -> str:
    """The job's dedup key, ``<system_id>:<bundle_key>``."""

    return f"{system_id}:{bundle_key}"


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


def _cli_error(failure: cli.CliFailure, command: str) -> RetryableJobError | PermanentJobError:
    message = f"prism-kicad {command}: {failure}"
    if failure.retryable:
        return RetryableJobError(message, code=failure.code)
    return PermanentJobError(message, code=failure.code)


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
    resolved = member_view.resolve(
        document, requested_by=str(payload.get("requested_by") or "")
    )
    try:
        generator = cli.generator()
    except cli.CliUnavailable as error:
        raise PermanentJobError(str(error), code="cli-unavailable") from error
    except cli.CliFailure as failure:
        raise _cli_error(failure, "version") from failure

    with store.connection() as conn:
        board_input = board_sub_ports.build_input(conn, document)
    bundle_key = member_view.system_bundle_key(
        document, generator.digest, resolved, board_sub_ports=board_input,
        entries=member_view.entry_key_input(resolved),
    )
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

    document_path = context.staging_dir / "document.json"
    document_path.write_bytes(member_view.canonical_bytes(document))
    board_sub_ports_path = context.staging_dir / "board-sub-ports.json"
    board_sub_ports_path.write_bytes(member_view.canonical_bytes(board_input))
    output = context.staging_dir / "system-bundle.json"
    args = [
        "system", "build",
        "--document", str(document_path),
        *member_view.cli_args(resolved),
        "--board-sub-ports", str(board_sub_ports_path),
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
            member.occurrence for member in resolved if member.state == member_view.PENDING
        ),
        "absent": sorted(
            member.occurrence for member in resolved if member.state == member_view.ABSENT
        ),
        "ready": sorted(
            member.occurrence for member in resolved if member.state == member_view.READY
        ),
        "entries": sorted(member_view.entry_key_input(resolved)),
        "counts": counts,
    }
    if rebased:
        details["superseded_key"] = queued_key
    return JobResult(message="System bundle ready", details=details)


# ------------------------------------------------------------- end of job


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


def _unsettled_bundles() -> list[str]:
    with bundle_store.default_connect() as conn:
        found = conn.execute(
            """SELECT j.id FROM ws_system_bundles b JOIN ws_jobs j ON j.id = b.job_id
               WHERE b.state IN ('queued', 'building') AND j.status IN ('failed', 'cancelled')
               ORDER BY j.updated_at DESC LIMIT 100"""
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
JOB_KINDS = (SYSTEM_BUNDLE, SYSTEM_GIT_COMMIT)
