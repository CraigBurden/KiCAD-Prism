"""Shared paths and the live KiCad test seam for Release Studio fixtures."""

from __future__ import annotations

import contextlib
import functools
import os
import re
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Any, Callable, Iterator, ParamSpec, TypeVar, cast


EXECUTOR_IMAGE_ENV = "PRISM_RELEASE_EXECUTOR_IMAGE"
BAKED_KICAD_BASE_IMAGE_PATH = Path("/etc/prism/kicad-base-image")
REQUIRED_KICAD_VERSION = "10.0.4"
_KICAD_VERSION_RE = re.compile(r"(?<![0-9.])10\.0\.4(?![0-9.])")
_DIGEST_SUFFIX = re.compile(r"@sha256:([0-9a-f]{64})$")
_P = ParamSpec("_P")
_R = TypeVar("_R")

RELEASE_STUDIO_ROOT = Path(__file__).resolve().parents[2] / "fixtures" / "release-studio"
FIXTURE_NAMES = ("synthetic", "usb-pd", "cynthion")
RECORDING_ROOT = RELEASE_STUDIO_ROOT / "cli-recordings"
DOCUMENTS_STUB = Path(__file__).resolve().parent / "support" / "prism_kicad_documents_stub.py"


@contextlib.contextmanager
def documents_stub() -> Iterator[Path]:
    """A fake ``prism-kicad`` for ``version``/``stroke-text``/``drawing-sheet``.

    Yields the invocation log the stub appends to. The documents'renderer
    caches are cleared on the way in and out, so a case can count the CLI calls
    it actually made.
    """

    from unittest import mock

    from app.core.config import settings
    from app.release_studio.documents import fonts, worksheet

    directory = Path(tempfile.mkdtemp(prefix="prism-kicad-documents-"))
    executable = directory / "prism-kicad"
    executable.write_text(
        f'#!/bin/sh\nexec "{sys.executable}" "{DOCUMENTS_STUB}" "$@"\n',
        encoding="utf-8",
    )
    executable.chmod(0o755)
    log = directory / "invocations.jsonl"
    fonts._reset_stroke_caches()
    worksheet._reset_drawing_sheet_cache()
    try:
        with (
            mock.patch.object(
                settings, "PRISM_DESIGN_BUNDLE_CLI_PATH", str(executable)
            ),
            mock.patch.object(
                settings, "KICAD_PROJECTS_ROOT", str(directory / "projects")
            ),
            mock.patch.dict(os.environ, {"PRISM_KICAD_STUB_LOG": str(log)}),
        ):
            yield log
    finally:
        fonts._reset_stroke_caches()
        worksheet._reset_drawing_sheet_cache()


def install_documents_stub(test: unittest.TestCase) -> Path:
    """Install :func:`documents_stub` for the length of *test*; returns its log."""

    return test.enterContext(documents_stub())



def read_baked_kicad_base_image(
    path: Path = BAKED_KICAD_BASE_IMAGE_PATH,
) -> str:
    """Return the executor identity baked into the running image."""

    try:
        raw = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise AssertionError(
            f"missing baked KiCad base image identity at {path}"
        ) from exc
    value = raw.strip()
    if not value:
        raise AssertionError(f"baked KiCad base image identity at {path} is empty")
    if _DIGEST_SUFFIX.search(value) is None:
        raise AssertionError(
            "baked KiCad base image must end with @sha256:<64 lowercase hex>; "
            f"got {value!r}"
        )
    return value


def fixture_root(name: str) -> Path:
    """Return a named, repository-local Release Studio fixture directory."""

    if name not in FIXTURE_NAMES:
        raise ValueError(f"unknown Release Studio fixture: {name!r}")
    return RELEASE_STUDIO_ROOT / name


def fixture_manifest(name: str) -> Path:
    """Return the manifest that documents one fixture's entrypoints."""

    return fixture_root(name) / "fixture.json"


def fixture_recording(name: str) -> Path:
    """Return the scrubbed CLI recording for one fixture."""

    if name not in FIXTURE_NAMES:
        raise ValueError(f"unknown Release Studio fixture: {name!r}")
    return RECORDING_ROOT / f"{name}.json"


def synthetic_bundle_design(closure: Path):
    """The synthetic fixture's committed bundle as a ready ``BundleDesign``.

    The archive's members are extracted under ``closure/_bundle``, so a
    recording made from this layout replays against the same placeholder
    paths.
    """

    import json
    import zipfile

    from app.release_studio import bundle_design
    from app.services.design_bundle.manifest import Readiness

    archive = RELEASE_STUDIO_ROOT / "synthetic" / "models.prism"

    class _ZipOpened:
        def __init__(self) -> None:
            self._zip = zipfile.ZipFile(archive)
            self._root = closure / "_bundle"
            self.absent = False
            self.failure = None
            self.archive = SimpleNamespace(
                path=archive,
                manifest=json.loads(self._zip.read("bundle.json")),
            )

        def read_json(self, path: str) -> dict:
            return json.loads(self._zip.read(path))

        def readiness(self, paths):
            members = {member["path"] for member in self.archive.manifest["members"]}
            return {
                path: Readiness(
                    path, "ready" if path in members else "not-applicable", "parse"
                )
                for path in paths
            }

        def extract(self, paths) -> Path:
            for wanted in paths:
                chosen = (
                    [name for name in self._zip.namelist() if name.startswith(wanted)]
                    if wanted.endswith("/")
                    else [wanted]
                )
                for member in chosen:
                    target = self._root / member
                    target.parent.mkdir(parents=True, exist_ok=True)
                    target.write_bytes(self._zip.read(member))
            return self._root

    return bundle_design.BundleDesign(
        project_id="project-1", commit="a" * 40, opened=_ZipOpened()
    )


def fixture_entrypoint(name: str, kind: str) -> Path:
    """Resolve an entrypoint from a fixture manifest without external state."""

    import json

    manifest_path = fixture_manifest(name)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    try:
        relative_path = manifest["entrypoints"][kind]
    except KeyError as exc:
        raise KeyError(f"fixture {name!r} has no {kind!r} entrypoint") from exc
    if not isinstance(relative_path, str):
        raise TypeError(f"fixture {name!r} entrypoint {kind!r} is not a path")
    return fixture_root(name) / relative_path


def _executor_identity_present() -> bool:
    """Return whether the R00 live-executor contract is active."""

    return EXECUTOR_IMAGE_ENV in os.environ


def _kicad_cli_executable() -> str | None:
    """Find the CLI, allowing a test-only explicit executable override."""

    override = os.environ.get("KICAD_CLI")
    if override:
        return override
    return shutil.which("kicad-cli")


def _probe_kicad_cli() -> tuple[str | None, str]:
    """Return the executable and version output, or a stable failure reason."""

    executable = _kicad_cli_executable()
    if not executable:
        return None, "kicad-cli is not available on PATH"

    try:
        result = subprocess.run(
            [executable, "--version"],
            check=False,
            capture_output=True,
            text=True,
            shell=False,
            timeout=30,
        )
    except FileNotFoundError:
        return None, f"kicad-cli executable was not found: {executable}"
    except (OSError, subprocess.SubprocessError) as exc:
        return None, f"kicad-cli --version failed: {exc}"

    output = f"{result.stdout}\n{result.stderr}".strip()
    if result.returncode != 0:
        return None, f"kicad-cli --version exited with {result.returncode}: {output}"
    return executable, output


def kicad_cli_executable() -> str:
    """Return a usable CLI after the caller has passed the live-test seam."""

    executable, reason = _probe_kicad_cli()
    if executable is None:
        raise RuntimeError(reason)
    return executable


def _require_kicad_cli(test_case: unittest.TestCase) -> str:
    """Skip only the ordinary host job; fail closed in the R00 executor."""

    executor_active = _executor_identity_present()
    if executor_active:
        try:
            baked = read_baked_kicad_base_image()
        except AssertionError as exc:
            test_case.fail(str(exc))
        runtime = os.environ.get(EXECUTOR_IMAGE_ENV, "")
        if runtime != baked:
            test_case.fail(
                f"{EXECUTOR_IMAGE_ENV} must match the baked identity at "
                f"{BAKED_KICAD_BASE_IMAGE_PATH}"
            )

    executable, version_or_reason = _probe_kicad_cli()
    if executable is None:
        if executor_active:
            test_case.fail(
                "kicad-cli is required in the Release Studio live executor: "
                + version_or_reason
            )
        test_case.skipTest("default host has no usable kicad-cli: " + version_or_reason)

    if executor_active:
        if not _KICAD_VERSION_RE.search(version_or_reason):
            test_case.fail(
                "Release Studio live executor requires KiCad 10.0.4; "
                f"got:\n{version_or_reason}"
            )
    return executable


def requires_kicad_cli(
    test_case: unittest.TestCase | Callable[_P, _R] | None = None,
) -> Any:
    """Decorate a unittest method with the R00-aware live CLI requirement.

    The normal form is ``@requires_kicad_cli()``. Passing a ``TestCase`` also
    supports a direct guard from a test body, and the no-parentheses decorator
    form is accepted for small downstream tests.
    """

    def decorate(test_method: Callable[_P, _R]) -> Callable[_P, _R]:
        @functools.wraps(test_method)
        def wrapped(*args: _P.args, **kwargs: _P.kwargs) -> _R:
            if not args or not isinstance(args[0], unittest.TestCase):
                raise TypeError("requires_kicad_cli must decorate a unittest method")
            _require_kicad_cli(args[0])
            return test_method(*args, **kwargs)

        return wrapped

    if test_case is None:
        return decorate
    if isinstance(test_case, unittest.TestCase):
        return _require_kicad_cli(test_case)
    if callable(test_case):
        return decorate(cast(Callable[_P, _R], test_case))
    raise TypeError("requires_kicad_cli expects a unittest case or test method")


def run_kicad_cli(
    *arguments: str,
    cwd: Path | None = None,
    timeout: int = 180,
) -> subprocess.CompletedProcess[str]:
    """Run a CLI command after the caller's test has passed the seam."""

    executable = kicad_cli_executable()
    return subprocess.run(
        [executable, *arguments],
        check=False,
        capture_output=True,
        text=True,
        shell=False,
        cwd=str(cwd) if cwd else None,
        timeout=timeout,
    )
