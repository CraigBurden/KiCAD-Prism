"""Run registered vendor generators and turn their files into step outputs.

A pack comes from ``prism-kicad vendor run <id>`` over the same design bundle
the rest of the build reads (ADR amendment C3 §3.3).  The files land in the
release member paths a dossier link names.
"""

from __future__ import annotations

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


def generate_vendor_outputs(
    *,
    config: Mapping[str, Any],
    closure_root: Path,
    output_root: Path,
    variant: str = "",
    cli: KicadTool | None = None,
    bundle: Path | None = None,
    timeout_seconds: int = 900,
) -> tuple[tuple[StepOutput, ...], dict[str, bytes]]:
    """Run every configured vendor profile.

    Returns member-producing ``StepOutput``s (CSV only) and extra evidence
    bytes (XLSX and other opaque vendor files) keyed by archive-relative path.
    A missing generator skips the vendors rather than failing the build — the
    signed dossier is still complete without a fab-house pack.  With ``bundle``
    set the pack comes from ``prism-kicad``; every other outcome is a failed
    step so a configuration or bundle error is visible.
    """

    vendor_ids = resolve_vendor_ids(config)
    if not vendor_ids:
        return (), {}

    if bundle is None:
        # The build always resolves a design bundle before it runs; a vendor
        # pack without one is a build defect, not a silent skip.
        return _failed_steps(
            vendor_ids,
            output_root,
            message="the release build resolved no design bundle for its vendor pack",
        ), {}

    return _generate_from_bundle(
        vendor_ids=vendor_ids,
        bundle=bundle,
        cli=cli,
        output_root=output_root,
        variant=variant,
        timeout_seconds=timeout_seconds,
    )


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
    """One log line per component the vendor run excluded."""

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
    "generate_vendor_outputs",
]
