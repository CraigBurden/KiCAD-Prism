"""Run registered vendor generators and turn their files into step outputs.

Two generators exist behind this seam:

- **legacy** (``PRISM_DESIGN_SOURCE_RELEASE_STUDIO=legacy``, or a bundle whose
  parse stage is not ready): ``kicad-cruncher bom``/``pnp`` over the closure,
  as Release Studio has always run it;
- **bundle** (the switch is ``bundle`` and the parse members are ready):
  ``prism-kicad vendor run <id>`` over the same design bundle the rest of the
  build reads (ADR amendment C3 §3.3).

Both land in the same release member paths, so a dossier link does not move
when the source switches.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Mapping

from app.release_studio.steps import StepOutput, StepSpec
from app.services.kicad_tools import KicadTool, ToolError

from .cli import (
    BUNDLE_NOT_READY_MESSAGE,
    PRISM_KICAD,
    VendorBundleNotReady,
    VendorCliError,
    VendorConfigurationError,
    run_vendor,
    vendors,
    verified_files,
)
from .jlcpcb import VendorGenerateError
from .registry import (
    profile_by_id,
    resolve_vendor_ids,
    vendor_step_spec,
)

logger = logging.getLogger(__name__)

#: The parse members a vendor run reads.  Requesting them through
#: ``bundle_read`` is what makes "parse is ready" mean the projections exist,
#: and keeps the legacy path when the bundle is still pending.
BUNDLE_MEMBERS = (
    "projections/occurrences.json",
    "projections/placements.json",
)


def design_file_for(board: Path) -> Path:
    """Prefer the project file when Cruncher needs variants and text variables."""

    project = board.with_suffix(".kicad_pro")
    return project if project.is_file() else board


def vendor_bundle_archive(project_id: str, commit: str | None) -> Path | None:
    """The design bundle a vendor run can read, or ``None`` to serve legacy.

    ``bundle_read`` owns the switch and the rollout fallback: it answers
    ``None`` for ``legacy``, a member that is not ready (it queues the build)
    and a member that failed.  A working tree has no commit to key a bundle by,
    and a parse stage that is not final has no projections to read.
    """

    if not project_id or not commit:
        return None
    from app.services.design_bundle.consumer import bundle_read

    try:
        read = bundle_read(
            "RELEASE_STUDIO",
            project_id,
            commit,
            BUNDLE_MEMBERS,
            requested_by="release-studio:vendor",
        )
    except Exception as error:  # noqa: BLE001 - a bundle-side fault must not break the legacy path
        logger.warning(
            "design bundle: vendor packs of %s@%s cannot read the bundle: %s",
            project_id,
            commit,
            error,
        )
        return None
    if read is None or not all(read.ready(path) for path in BUNDLE_MEMBERS):
        return None
    archive = read.opened.archive
    if archive is None:
        return None
    stages = (archive.manifest or {}).get("stages") or {}
    parse = stages.get("parse") or {}
    # The projection members being ready already implies parse is final; the
    # manifest check keeps a pending archive on the legacy path even if a fake
    # or an older manifest answers readiness differently.
    if parse.get("status") not in {None, "complete", "partial"}:
        return None
    return archive.path


def generate_vendor_outputs(
    *,
    config: Mapping[str, Any],
    closure_root: Path,
    output_root: Path,
    variant: str = "",
    cruncher: KicadTool | None = None,
    cli: KicadTool | None = None,
    bundle: Path | None = None,
    timeout_seconds: int = 900,
) -> tuple[tuple[StepOutput, ...], dict[str, bytes]]:
    """Run every configured vendor profile.

    Returns member-producing ``StepOutput``s (CSV only) and extra evidence
    bytes (XLSX and other opaque vendor files) keyed by archive-relative path.
    A missing generator skips the vendors rather than failing the build — the
    signed dossier is still complete without a fab-house pack.  With ``bundle``
    set the pack comes from ``prism-kicad`` instead; every other outcome is a
    failed step so a configuration or bundle error is visible.
    """

    vendor_ids = resolve_vendor_ids(config)
    if not vendor_ids:
        return (), {}

    if bundle is not None:
        return _generate_from_bundle(
            vendor_ids=vendor_ids,
            bundle=bundle,
            cli=cli,
            output_root=output_root,
            variant=variant,
            timeout_seconds=timeout_seconds,
        )

    board_rel = str(config.get("board") or "")
    board = (closure_root / board_rel) if board_rel else None
    if board is None or not board.is_file():
        return (), {}

    outputs: list[StepOutput] = []
    extra_evidence: dict[str, bytes] = {}
    if cruncher is None:
        for vendor_id in vendor_ids:
            spec = vendor_step_spec(vendor_id)
            outputs.append(
                StepOutput(
                    step_id=spec.step_id,
                    step_type=spec.step_type,
                    normalized_argv=(),
                    returncode=0,
                    files=(),
                    root=output_root,
                    spec=spec,
                    skipped_reason="kicad-cruncher is not available",
                )
            )
        return tuple(outputs), extra_evidence

    design = design_file_for(board)
    for vendor_id in vendor_ids:
        spec = vendor_step_spec(vendor_id)
        try:
            profile = profile_by_id(vendor_id)
        except KeyError:
            outputs.append(
                StepOutput(
                    step_id=spec.step_id,
                    step_type=spec.step_type,
                    normalized_argv=(),
                    returncode=0,
                    files=(),
                    root=output_root,
                    spec=spec,
                    skipped_reason=f"unknown vendor profile: {vendor_id}",
                )
            )
            continue
        try:
            artifacts = profile.generate(
                cruncher=cruncher,
                design_file=design,
                output_root=output_root,
                variant=variant,
                timeout_seconds=timeout_seconds,
            )
        except VendorGenerateError as exc:
            outputs.append(
                StepOutput(
                    step_id=spec.step_id,
                    step_type=spec.step_type,
                    normalized_argv=(),
                    returncode=1,
                    files=(),
                    root=output_root,
                    spec=spec,
                    stderr=str(exc),
                    skipped_reason=str(exc)[:400],
                )
            )
            continue
        files = tuple(path for path in artifacts.canonical_files.values() if path.is_file())
        outputs.append(
            StepOutput(
                step_id=spec.step_id,
                step_type=spec.step_type,
                normalized_argv=artifacts.normalized_argv,
                returncode=artifacts.returncode,
                files=files,
                root=output_root,
                spec=spec,
                stdout=artifacts.stdout,
                stderr=artifacts.stderr,
                elapsed_ms=artifacts.elapsed_ms,
            )
        )
        for relative, path in artifacts.evidence_files.items():
            extra_evidence[relative] = path.read_bytes()
    return tuple(outputs), extra_evidence


def _generate_from_bundle(
    *,
    vendor_ids: tuple[str, ...],
    bundle: Path,
    cli: KicadTool | None,
    output_root: Path,
    variant: str,
    timeout_seconds: int,
) -> tuple[tuple[StepOutput, ...], dict[str, bytes]]:
    """Each pack from ``prism-kicad vendor run``; failures are step failures."""

    outputs: list[StepOutput] = []
    extra_evidence: dict[str, bytes] = {}

    if cli is None:
        for vendor_id in vendor_ids:
            spec = vendor_step_spec(vendor_id)
            outputs.append(
                StepOutput(
                    step_id=spec.step_id,
                    step_type=spec.step_type,
                    normalized_argv=(),
                    returncode=0,
                    files=(),
                    root=output_root,
                    spec=spec,
                    skipped_reason=f"{PRISM_KICAD} is not available",
                )
            )
        return tuple(outputs), extra_evidence

    try:
        registered = {item.id: item for item in vendors(cli)}
    except VendorCliError as error:
        return _failed_steps(
            vendor_ids,
            output_root,
            message=str(error),
        ), {}

    for vendor_id in vendor_ids:
        spec = vendor_step_spec(vendor_id)
        try:
            profile = profile_by_id(vendor_id)
        except KeyError:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=f"configuration error: unknown vendor profile {vendor_id!r}",
                )
            )
            continue

        info = registered.get(vendor_id)
        if info is None:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=(
                        f"configuration error: no vendor is registered as {vendor_id!r} "
                        f"by {PRISM_KICAD}"
                    ),
                )
            )
            continue
        if info.config_schema != profile.config_schema:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=(
                        f"configuration error: {PRISM_KICAD} expects "
                        f"{info.config_schema} for {vendor_id}, this release builds "
                        f"{profile.config_schema}"
                    ),
                )
            )
            continue

        workdir = output_root / "_vendor_work" / profile.id
        workdir.mkdir(parents=True, exist_ok=True)
        config_path = workdir / f"{profile.id}.config.json"
        config_path.write_bytes(profile.config_bytes())

        try:
            document = run_vendor(
                cli,
                vendor_id=vendor_id,
                bundle=bundle,
                config=config_path,
                output=workdir,
                variant=variant,
                timeout_seconds=timeout_seconds,
            )
            files = verified_files(workdir, document, vendor_id=vendor_id)
            canonical, evidence = profile.pack_files(
                files=files, output_root=output_root
            )
        except VendorBundleNotReady as error:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=str(error) or BUNDLE_NOT_READY_MESSAGE,
                )
            )
            continue
        except VendorConfigurationError as error:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=str(error),
                )
            )
            continue
        except (VendorCliError, VendorGenerateError, ToolError) as error:
            outputs.append(
                _failed_step(
                    spec,
                    output_root,
                    message=str(error),
                )
            )
            continue

        log = _excluded_log(document)
        outputs.append(
            StepOutput(
                step_id=spec.step_id,
                step_type=spec.step_type,
                normalized_argv=_normalized_argv(
                    vendor_id,
                    bundle=bundle,
                    config=config_path,
                    output_root=output_root,
                    workdir=workdir,
                    variant=variant,
                ),
                returncode=0,
                files=tuple(path for path in canonical.values() if path.is_file()),
                root=output_root,
                spec=spec,
                stdout=log,
            )
        )
        for relative, path in evidence.items():
            extra_evidence[relative] = path.read_bytes()

    return tuple(outputs), extra_evidence


def _failed_steps(
    vendor_ids: tuple[str, ...],
    output_root: Path,
    *,
    message: str,
) -> tuple[StepOutput, ...]:
    return tuple(
        _failed_step(vendor_step_spec(vendor_id), output_root, message=message)
        for vendor_id in vendor_ids
    )


def _failed_step(
    spec: StepSpec,
    output_root: Path,
    *,
    message: str,
) -> StepOutput:
    """A step that ran and failed: no ``skipped_reason``, so the pipeline fails it."""

    return StepOutput(
        step_id=spec.step_id,
        step_type=spec.step_type,
        normalized_argv=(),
        returncode=1,
        files=(),
        root=output_root,
        spec=spec,
        stderr=message,
    )


def _excluded_log(document: Mapping[str, Any]) -> str:
    """Surfaced like Cruncher's warnings: one line per excluded component."""

    lines: list[str] = []
    for item in document.get("excluded") or ():
        reference = str(item.get("reference") or item.get("key") or "")
        code = str(item.get("code") or "")
        message = str(item.get("message") or "")
        lines.append(f"excluded {reference}: {message} [{code}]")
    return "\n".join(lines)


def _normalized_argv(
    vendor_id: str,
    *,
    bundle: Path,
    config: Path,
    output_root: Path,
    workdir: Path,
    variant: str,
) -> tuple[str, ...]:
    """Recorded argv without a host path, like every other step (steps.py)."""

    relative = workdir.relative_to(output_root).as_posix()
    argv = [
        PRISM_KICAD,
        "vendor",
        "run",
        vendor_id,
        "--in",
        bundle.name,
        "--config",
        config.name,
        "-o",
        relative,
    ]
    if variant:
        argv.extend(("--variant", variant))
    return (" ".join(argv),)


__all__ = [
    "BUNDLE_MEMBERS",
    "design_file_for",
    "generate_vendor_outputs",
    "vendor_bundle_archive",
]
