"""Resolve and pin the 3D models a board names, the way the build tools open them.

The cover render and the assembly views open every model a footprint names, so
the input closure (``closure.py``) records where each one resolves and, for a
model outside the closure, the hash of its bytes.  This module holds that
resolution; ``closure.py`` turns its placement into a ``ResolvedLibraryPath``.

Only regular files are read, and never more than ``HOST_MODEL_MAX_BYTES``: a
board may name ``/dev/zero``, a FIFO, or a symlink anywhere on the worker, and
none of those may stall a build or put a host file's digest in a closure.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping

from app.release_studio.closure_references import VARIABLE_RE
# Any variable form KiCad expands: `${VAR}`, `$(VAR)`, or a bare `$VAR`.
_ANY_VARIABLE_RE = re.compile(r"\$(?:\{|\(|[A-Za-z_])")
_URI_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
# Suffixes of 3D models.  A footprint's `(model ...)` node names one of these,
# and boards routinely carry stale ones whose case or extension no longer
# matches anything on disk.
_MODEL_SUFFIXES = {
    ".step", ".stp", ".stpz", ".wrl", ".wrz", ".vrml", ".x3d", ".igs", ".iges",
    ".wings",
}
# A missing `.wrl`/`.wrz` is not an absence every worker shares: kicad-cli
# swaps in a same-stem STEP model found on its search paths
# (`3d_cache.cpp`, `MODEL_SUBSTITUTION::IsWrlExtension`, KiCad 10.0.4).
_SUBSTITUTED_SUFFIXES = {".wrl", ".wrz"}
# Names KiCad 10.0.4's 3D plugins load (`plugins/3d/oce/oce.cpp`,
# `plugins/3d/vrml/plugin.cpp`, `plugins/3d/idf/s3d_plugin_idf.cpp`).  A host
# file is hashed only when both the written and the resolved name end in one,
# so a board cannot make a build fingerprint `/etc/...` or `~/.ssh/...`.
_LOADABLE_SUFFIXES = (
    ".step", ".stp", ".stpz", ".stepz", ".step.gz", ".stp.gz", ".igs", ".iges",
    ".wrl", ".wrz", ".x3d", ".idf", ".emn",
)
# Larger than any real STEP model; a file past it is `unreadable`, not hashed.
HOST_MODEL_MAX_BYTES = 256 * 1024 * 1024
# A project file is small JSON; this bounds a hostile one.
_PROJECT_FILE_MAX_BYTES = 16 * 1024 * 1024
_CHUNK = 1024 * 1024


@dataclass(frozen=True, slots=True)
class ModelPlacement:
    """Where a model reference resolves: the fields of a ``ResolvedLibraryPath``."""

    location: str
    resolved_path: str = ""
    advisory: bool = False
    digest: str = ""


def is_model_reference(reference: str) -> bool:
    """Whether *reference* names a 3D model.

    Judged by suffix, which is what a ``(model ...)`` node carries.  The
    alternative -- deciding from the s-expression node the path sits in --
    would need a board parser here for no extra accuracy: nothing else in a
    board file points at a ``.step`` or a ``.wrl``.
    """

    return Path(reference.replace("\\", "/")).suffix.casefold() in _MODEL_SUFFIXES


def resolve_model(
    reference: str,
    *,
    project_variables: Mapping[str, str],
    lookup: Callable[[str], str | None],
    model_env: Mapping[str, str],
    destination: Path,
    destination_root: Path,
    toolchain_roots: Mapping[str, Path],
) -> ModelPlacement:
    """Resolve a 3D model reference once, the way the build tools find it.

    As in KiCad 10.0.4's ``FILENAME_RESOLVER::ResolvePath``: backslashes become
    slashes, then each variable resolves from the project's ``text_variables``
    before ``KIPRJMOD`` and the environment (``ExpandEnvVarSubstitutions``,
    ``common.cpp``), then the path is normalized.  Only then is it placed:

    - in the closure: recorded as before; a missing file is advisory, except a
      ``.wrl``/``.wrz`` KiCad may replace with a STEP model from elsewhere;
    - written inside the closure but resolving outside it through a symlink:
      ``unreadable``, never hashed, so a repository cannot make a build read
      and fingerprint a worker's files;
    - outside it: a regular file whose written and resolved names both carry a
      suffix KiCad's 3D plugins load is hashed into ``digest``
      (``location="host"``); anything else, or a file over
      ``HOST_MODEL_MAX_BYTES``, is ``unreadable`` and the build is non-hermetic.

    ``lookup`` gives ``KIPRJMOD`` and Prism's own bindings, or None.  The tools
    inherit the worker's environment (``kicad_tools.py``) plus ``KIPRJMOD``;
    ``model_env`` stands for it.  The record keeps the reference as written and
    never the expanded root, so two workers with the same bytes under different
    mount points agree.
    """

    expanded = reference.replace("\\", "/")
    for _ in range(8):
        match = VARIABLE_RE.search(expanded)
        if match is None:
            break
        name = match.group(1)
        if name in project_variables:
            value = project_variables[name]
        else:
            value = lookup(name)
            if value is None:
                value = str(model_env.get(name) or "")
        if not value:
            return ModelPlacement("unreadable")
        expanded = expanded[: match.start()] + value.replace("\\", "/") + expanded[match.end() :]
    # Fail closed wherever KiCad's resolution is not reproduced exactly: a
    # variable left over (nested `$(VAR)`, `$VAR`, or more than the bounded
    # depth), a relative result (KiCad resolves it against the tool's working
    # directory), or a URI or home-relative path.
    if (
        _ANY_VARIABLE_RE.search(expanded)
        or _URI_RE.match(expanded)
        or not Path(expanded).is_absolute()
    ):
        return ModelPlacement("unreadable")
    written = Path(os.path.normpath(expanded))
    try:
        # KiCad checks the path as written before it normalizes `..`, so
        # `missing/../part.step` is absent even when `part.step` exists.
        exists = Path(expanded).exists()
        resolved = written.resolve(strict=False)
    except (OSError, RuntimeError):
        return ModelPlacement("unreadable")

    inside = _relative(resolved, destination_root)
    if inside is None:
        if any(
            _relative(written, root) is not None
            for root in (destination_root, Path(os.path.normpath(os.path.abspath(destination))))
        ):
            return ModelPlacement("unreadable")  # a closure symlink out of the closure
        for name, root in toolchain_roots.items():
            toolchain_relative = _relative(resolved, root)
            if toolchain_relative is None:
                continue
            if exists:
                return ModelPlacement("toolchain", f"toolchain:{name}/{toolchain_relative}")
            return ModelPlacement("missing", advisory=True)
    else:
        if exists:
            return ModelPlacement("closure", inside or ".")
        if Path(expanded).suffix.casefold() in _SUBSTITUTED_SUFFIXES:
            return ModelPlacement("substitutable")
        return ModelPlacement("missing", advisory=True)
    if not exists or not (_is_loadable(written) and _is_loadable(resolved)):
        return ModelPlacement("unreadable")
    digest = _hash_regular_file(resolved, HOST_MODEL_MAX_BYTES)
    return ModelPlacement("host", digest=digest) if digest else ModelPlacement("unreadable")


def project_text_variables(project_file: Path, destination_root: Path) -> dict[str, str]:
    """The ``text_variables`` of *project_file*, read only inside the closure."""

    try:
        resolved = project_file.resolve(strict=True)
    except (OSError, RuntimeError):
        return {}
    if _relative(resolved, destination_root) is None:
        return {}
    content = _read_regular_file(resolved, _PROJECT_FILE_MAX_BYTES)
    if content is None:
        return {}
    try:
        payload = json.loads(content.decode("utf-8"))
    except ValueError:
        return {}
    variables = payload.get("text_variables") if isinstance(payload, dict) else None
    if not isinstance(variables, dict):
        return {}
    return {str(name): str(value) for name, value in variables.items()}


def _is_loadable(path: Path) -> bool:
    return path.name.casefold().endswith(_LOADABLE_SUFFIXES)


def _relative(path: Path, root: Path) -> str | None:
    try:
        return path.relative_to(root).as_posix()
    except ValueError:
        return None


def _regular_file_chunks(path: Path, limit: int, consume: Callable[[bytes], None]) -> bool:
    """Feed *path*'s bytes to *consume* if it is a regular file of at most *limit* bytes.

    The file is opened without following a final symlink and without blocking
    on a FIFO, then judged by ``fstat`` of the opened descriptor, so it cannot
    be swapped between the check and the read.
    """

    flags = os.O_RDONLY
    for optional in ("O_NOFOLLOW", "O_NONBLOCK", "O_BINARY"):
        flags |= getattr(os, optional, 0)
    try:
        descriptor = os.open(path, flags)
    except OSError:
        return False
    try:
        status = os.fstat(descriptor)
        if not stat.S_ISREG(status.st_mode) or status.st_size > limit:
            return False
        total = 0
        while chunk := os.read(descriptor, _CHUNK):
            total += len(chunk)
            if total > limit:  # grew after fstat
                return False
            consume(chunk)
        return True
    except OSError:
        return False
    finally:
        os.close(descriptor)


def _hash_regular_file(path: Path, limit: int) -> str | None:
    digest = hashlib.sha256()
    return digest.hexdigest() if _regular_file_chunks(path, limit, digest.update) else None


def _read_regular_file(path: Path, limit: int) -> bytes | None:
    parts: list[bytes] = []
    return b"".join(parts) if _regular_file_chunks(path, limit, parts.append) else None
