"""``prism-kicad vendor`` as Release Studio's vendor generator (C3 chunk F2).

A vendor pack comes from ``prism-kicad vendor run`` over the build's design
bundle.  This module is the one place that knows the command line
(cli-spec.md §5.8), the two stdout documents and the exit codes the caller maps
to build outcomes.

The binary is located exactly as the background bundle jobs locate it
(``PRISM_DESIGN_BUNDLE_CLI_PATH``, then ``prism-kicad`` on ``PATH``), through
:mod:`app.services.design_bundle.cli`.  The vendor registry is read once per
CLI generator: ``vendor list`` is the source of the ids and the configuration
schema ids, so adding a vendor is a binary change, not a Python one.
"""

from __future__ import annotations

import hashlib
import json
import threading
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from app.services.design_bundle import cli as bundle_cli
from app.services.design_bundle import schemas
from app.services.kicad_tools import KicadTool, LocalTool, ToolError, ToolResult

PRISM_KICAD = "prism-kicad"
VENDOR_LIST_SCHEMA = "prism.cli.vendor_list.a0"
VENDOR_RUN_SCHEMA = "prism.cli.vendor_run_result.a0"
CLI_ERROR_SCHEMA = "prism.cli.error.a0"
LIST_TIMEOUT_SECONDS = 60

#: cli-spec.md §4: stage order / generator / config preconditions.
PRECONDITION_EXIT = 7
#: cli-spec.md §5.8: an id the binary does not register.
USAGE_EXIT = 2
VENDOR_UNKNOWN = "vendor-unknown"

#: What a caller gets when the design bundle cannot answer yet.
BUNDLE_NOT_READY_MESSAGE = "design bundle stage parse is not ready"


class VendorCliError(RuntimeError):
    """A ``prism-kicad vendor`` invocation failed.

    ``code`` is the CLI finding code when stdout carried a valid
    ``prism.cli.error.a0``; ``exit_code`` is the process status.
    """

    def __init__(
        self, message: str, *, exit_code: int = 0, code: str = ""
    ) -> None:
        super().__init__(message)
        self.exit_code = exit_code
        self.code = code


class VendorConfigurationError(VendorCliError):
    """The vendor id or its configuration cannot be used (a build defect)."""


class VendorBundleNotReady(VendorCliError):
    """The bundle's parse stage is not ready for a vendor run."""


@dataclass(frozen=True, slots=True)
class VendorInfo:
    """One registered vendor from ``vendor list``."""

    id: str
    name: str
    config_schema: str


def prism_kicad() -> KicadTool:
    """The ``prism-kicad`` binary, located as the design-bundle jobs locate it."""

    return LocalTool(PRISM_KICAD, bundle_cli.locate, isolate=False)


def _stamp(cli: KicadTool) -> tuple[str, float, int, str]:
    """Identity of one CLI generator: its path, mtime, size and reported version."""

    path = cli.executable()
    try:
        status = Path(path).stat()
        mtime, size = status.st_mtime, status.st_size
    except OSError:
        mtime, size = 0.0, 0
    try:
        version = cli.version()
    except ToolError:
        version = ""
    return (path, mtime, size, version)


_lists: dict[tuple[str, float, int, str], tuple[VendorInfo, ...]] = {}
_lists_lock = threading.Lock()


def reset_vendor_list_cache() -> None:
    """Forget every cached ``vendor list`` (tests and a replaced binary)."""

    with _lists_lock:
        _lists.clear()


def vendors(cli: KicadTool) -> tuple[VendorInfo, ...]:
    """The binary's vendor registry, cached per CLI generator.

    ``vendor list`` is fixed by the binary, so one invocation answers every
    pack in a build and every build on the same worker process.
    """

    key = _stamp(cli)
    with _lists_lock:
        cached = _lists.get(key)
    if cached is not None:
        return cached

    try:
        result = cli.run(["vendor", "list"], timeout=LIST_TIMEOUT_SECONDS)
    except ToolError as error:
        raise VendorCliError(f"{PRISM_KICAD} vendor list: {error}") from error
    document = _document(result)
    if not result.ok:
        raise _failure(result, document)
    try:
        schemas.validate(document, VENDOR_LIST_SCHEMA)
    except schemas.SchemaInvalid as error:
        raise VendorCliError(
            f"{PRISM_KICAD} vendor list printed an invalid {VENDOR_LIST_SCHEMA}: {error}"
        ) from None
    found = tuple(
        VendorInfo(
            id=str(item["id"]),
            name=str(item["name"]),
            config_schema=str(item["config_schema"]),
        )
        for item in document.get("vendors") or ()
    )
    with _lists_lock:
        _lists[key] = found
    return found


def run_vendor(
    cli: KicadTool,
    *,
    vendor_id: str,
    bundle: Path,
    config: Path,
    output: Path,
    variant: str = "",
    timeout_seconds: int = 900,
) -> dict[str, Any]:
    """Run one vendor and return its validated ``CliVendorRunResultA0`` document."""

    argv = [
        "vendor",
        "run",
        vendor_id,
        "--in",
        str(bundle),
        "--config",
        str(config),
        "-o",
        str(output),
    ]
    if variant:
        argv.extend(("--variant", variant))
    try:
        result = cli.run(argv, timeout=timeout_seconds)
    except ToolError as error:
        raise VendorCliError(f"{PRISM_KICAD} vendor run {vendor_id}: {error}") from error
    document = _document(result)
    if not result.ok:
        raise _failure(result, document, vendor_id=vendor_id)
    try:
        schemas.validate(document, VENDOR_RUN_SCHEMA)
    except schemas.SchemaInvalid as error:
        raise VendorCliError(
            f"{PRISM_KICAD} vendor run {vendor_id} printed an invalid "
            f"{VENDOR_RUN_SCHEMA}: {error}"
        ) from None
    if document.get("vendor") != vendor_id:
        raise VendorCliError(
            f"{PRISM_KICAD} vendor run {vendor_id} reported vendor "
            f"{document.get('vendor')!r}"
        )
    return document


def verified_files(
    output: Path, document: Mapping[str, Any], *, vendor_id: str
) -> dict[str, Path]:
    """The run's files, each checked against the sha256 the CLI reported.

    A mismatch means the bytes on disk are not the bytes the result names, so
    the pack is not the one the CLI attested and the step must fail.
    """

    verified: dict[str, Path] = {}
    for item in document.get("files") or ():
        relative = str(item.get("path") or "")
        expected = str(item.get("sha256") or "")
        path = _safe_output_path(output, relative)
        if not path.is_file():
            raise VendorCliError(
                f"{PRISM_KICAD} vendor run {vendor_id} reported {relative!r} "
                "but did not write it"
            )
        actual = hashlib.sha256(path.read_bytes()).hexdigest()
        if actual != expected:
            raise VendorCliError(
                f"{PRISM_KICAD} vendor run {vendor_id} wrote {relative!r} with "
                f"sha256 {actual}, not the reported {expected}"
            )
        verified[relative] = path
    return verified


def _safe_output_path(output: Path, relative: str) -> Path:
    """A result path must stay under ``-o`` and name a regular file."""

    if not relative:
        raise VendorCliError(f"{PRISM_KICAD} vendor run reported an empty file path")
    candidate = Path(relative)
    if candidate.is_absolute() or ".." in candidate.parts:
        raise VendorCliError(
            f"{PRISM_KICAD} vendor run reported an unsafe file path: {relative!r}"
        )
    root = output.resolve()
    resolved = (output / candidate).resolve()
    try:
        resolved.relative_to(root)
    except ValueError:
        raise VendorCliError(
            f"{PRISM_KICAD} vendor run reported a path outside -o: {relative!r}"
        ) from None
    return resolved


def _document(result: ToolResult) -> dict[str, Any]:
    text = (result.stdout or "").strip()
    if not text:
        return {}
    try:
        document = json.loads(text)
    except ValueError:
        return {}
    return document if isinstance(document, dict) else {}


def _failure(
    result: ToolResult, document: Mapping[str, Any], *, vendor_id: str = ""
) -> VendorCliError:
    """Map cli-spec.md §4's exit codes to what the build should say and do."""

    message = ""
    code = str(document.get("code") or "")
    if document.get("schema") == CLI_ERROR_SCHEMA:
        try:
            schemas.validate(document, CLI_ERROR_SCHEMA)
        except schemas.SchemaInvalid:
            pass
        else:
            message = str(document.get("message") or "")

    if result.returncode == USAGE_EXIT and (code == VENDOR_UNKNOWN or not code):
        named = f" {vendor_id!r}" if vendor_id else ""
        return VendorConfigurationError(
            f"vendor{named}: configuration error: "
            f"{message or 'no vendor is registered as ' + (repr(vendor_id) if vendor_id else 'this id')}",
            exit_code=result.returncode,
            code=code or VENDOR_UNKNOWN,
        )
    if result.returncode == PRECONDITION_EXIT:
        return VendorBundleNotReady(
            BUNDLE_NOT_READY_MESSAGE,
            exit_code=result.returncode,
            code=code,
        )
    detail = message or (result.stderr or result.stdout or "").strip()
    return VendorCliError(
        detail[:400] or f"{PRISM_KICAD} exited {result.returncode}",
        exit_code=result.returncode,
        code=code,
    )


__all__ = [
    "BUNDLE_NOT_READY_MESSAGE",
    "PRISM_KICAD",
    "VendorBundleNotReady",
    "VendorCliError",
    "VendorConfigurationError",
    "VendorInfo",
    "prism_kicad",
    "reset_vendor_list_cache",
    "run_vendor",
    "vendors",
    "verified_files",
]
