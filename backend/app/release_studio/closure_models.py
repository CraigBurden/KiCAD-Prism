"""Resolve and pin the 3D models a board names, the way the build tools open them.

The cover render and the assembly views open every model a footprint names, so
the input closure (``closure.py``) records where each one resolves and, for a
model outside the closure, the hash of its bytes.  This module holds that
resolution; ``closure.py`` turns its placement into a ``ResolvedLibraryPath``.

A hashed host model is staged as it is hashed, and the materialized board is
pointed at the staged copy (``rewrite_model_references``), so the tools read the
bytes the closure pinned rather than whatever the host path holds later.

Only regular files are read, and never more than ``HOST_MODEL_MAX_BYTES``: a
board may name ``/dev/zero``, a FIFO, or a symlink anywhere on the worker, and
none of those may stall a build or put a host file's digest in a closure.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import stat
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping

logger = logging.getLogger(__name__)

# A variable as KiCad 10.0.4 expands it (`KIwxExpandEnvVars`, `common.cpp`):
# `${NAME}`, `$(NAME)` or a bare `$NAME`, the name a run of letters, digits,
# `_` and `:`.
_VARIABLE_RE = re.compile(
    r"\$(?:\{(?P<curly>[A-Za-z0-9_:]+)\}"
    r"|\((?P<round>[A-Za-z0-9_:]+)\)"
    r"|(?P<bare>[A-Za-z0-9_:]+))"
)
_URI_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*://")
# A model KiCad reads out of the board itself (`kicad-embed://`); its bytes are
# the board's, so it is no reference to resolve.
EMBEDDED_PREFIX = "kicad-embed://"
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
# The `:alias:` names every KiCad 10.0.4 process knows: the predefined path
# variables (`env_vars.cpp`) less the two `GetKicadPaths` filters out
# (`filename_resolver.cpp`).  Any other alias is a variable the worker's own
# `kicad_common.json` may define, so it fails closed.
_ALIASES = frozenset(
    {
        "KICAD10_3DMODEL_DIR",
        "KICAD10_SYMBOL_DIR",
        "KICAD10_TEMPLATE_DIR",
        "KICAD10_3RD_PARTY",
        "KICAD_USER_TEMPLATE_DIR",
    }
)
# Larger than any real STEP model; a file past it is `unreadable`, not hashed.
HOST_MODEL_MAX_BYTES = 256 * 1024 * 1024
# A project file is small JSON; this bounds a hostile one.
_PROJECT_FILE_MAX_BYTES = 16 * 1024 * 1024
_CHUNK = 1024 * 1024


@dataclass(frozen=True, slots=True)
class ModelPlacement:
    """Where a model reference resolves: the fields of a ``ResolvedLibraryPath``.

    ``target`` is not part of the record.  It is the absolute path the build
    tools must open instead of the reference as written -- the staged copy of
    a hashed host model, or the file a relative or ``:alias:`` form resolved
    to -- so they read exactly the bytes the closure pinned.
    """

    location: str
    resolved_path: str = ""
    advisory: bool = False
    digest: str = ""
    target: str = ""

    def record(self) -> dict[str, object]:
        return {
            "location": self.location,
            "resolved_path": self.resolved_path,
            "advisory": self.advisory,
            "digest": self.digest,
        }


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
    project_root: Path | None = None,
    stage: Path | None = None,
) -> ModelPlacement:
    """Resolve a 3D model reference once, the way the build tools find it.

    As in KiCad 10.0.4's ``FILENAME_RESOLVER::ResolvePath``: backslashes become
    slashes, then every ``${VAR}``, ``$(VAR)`` and ``$VAR`` resolves from the
    project's ``text_variables`` before ``KIPRJMOD`` and the environment
    (``ExpandEnvVarSubstitutions``, ``common.cpp``), then the path is
    normalized.  A relative result of a reference that does not start with a
    variable is looked up in the project directory (*project_root*); one that
    is not there would fall through to the tool's working directory, the
    footprint library and the stock model directory, so it fails closed.  An
    ``:alias:path`` form resolves through one of KiCad's predefined path
    variables.  Only then is it placed:

    - in the closure: recorded as before; a missing file is advisory, except a
      ``.wrl``/``.wrz`` KiCad may replace with a STEP model from elsewhere;
    - written inside the closure but resolving outside it through a symlink:
      ``unreadable``, never hashed, so a repository cannot make a build read
      and fingerprint a worker's files;
    - outside it: a regular file whose written and resolved names both carry a
      suffix KiCad's 3D plugins load is hashed into ``digest``
      (``location="host"``) and, given *stage*, copied there as it is hashed;
      anything else, or a file over ``HOST_MODEL_MAX_BYTES``, is
      ``unreadable`` and the build is non-hermetic.

    ``lookup`` gives ``KIPRJMOD`` and Prism's own bindings, or None.  The tools
    inherit the worker's environment (``kicad_tools.py``) plus ``KIPRJMOD``;
    ``model_env`` stands for it.  The record keeps the reference as written and
    never the expanded root, so two workers with the same bytes under different
    mount points agree.
    """

    def value(name: str) -> str:
        if name in project_variables:
            return project_variables[name]
        found = lookup(name)
        return found if found is not None else str(model_env.get(name) or "")

    written_form = reference.replace("\\", "/")
    expanded = _expand(written_form, value)
    # Fail closed wherever KiCad's resolution is not reproduced exactly: a
    # variable that is unset or left over, a URI, or a home-relative path.
    if expanded is None or _URI_RE.match(expanded) or expanded.startswith("~"):
        return ModelPlacement("unreadable")
    pinned_form = False  # the tools must be pointed at the file Prism chose
    if expanded.startswith(":"):
        alias, _, relative = expanded[1:].partition(":")
        root = value(alias) if alias in _ALIASES else ""
        if not relative or not root or "$" in root or not Path(root).is_absolute():
            return ModelPlacement("unreadable")
        expanded, pinned_form = f"{root.rstrip('/')}/{relative}", True
    elif not Path(expanded).is_absolute():
        # A reference that starts with a variable is looked up only in the
        # tool's working directory, which is no closure input.
        if written_form.startswith(("${", "$(")) or project_root is None:
            return ModelPlacement("unreadable")
        expanded, pinned_form = os.path.join(os.path.abspath(project_root), expanded), True
    elif not written_form.startswith(("${", "$(", "/")):
        pinned_form = True  # a bare `$VAR`: missing, KiCad searches further
    written = Path(os.path.normpath(expanded))
    try:
        # KiCad checks the path as written before it normalizes `..`, so
        # `missing/../part.step` is absent even when `part.step` exists.
        exists = Path(expanded).exists()
        resolved = written.resolve(strict=False)
    except (OSError, RuntimeError):
        return ModelPlacement("unreadable")
    target = str(written) if pinned_form else ""

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
                return ModelPlacement(
                    "toolchain", f"toolchain:{name}/{toolchain_relative}", target=target
                )
            if pinned_form:
                return ModelPlacement("unreadable")
            return ModelPlacement("missing", advisory=True)
    else:
        if exists:
            return ModelPlacement("closure", inside or ".", target=target)
        if pinned_form:
            return ModelPlacement("unreadable")
        if Path(expanded).suffix.casefold() in _SUBSTITUTED_SUFFIXES:
            return ModelPlacement("substitutable")
        return ModelPlacement("missing", advisory=True)
    if not exists or not (_is_loadable(written) and _is_loadable(resolved)):
        return ModelPlacement("unreadable")
    if stage is None:
        digest = _hash_regular_file(resolved, HOST_MODEL_MAX_BYTES)
        return ModelPlacement("host", digest=digest) if digest else ModelPlacement("unreadable")
    staged = _stage_regular_file(resolved, HOST_MODEL_MAX_BYTES, stage)
    if staged is None:
        return ModelPlacement("unreadable")
    digest, copy = staged
    return ModelPlacement("host", digest=digest, target=str(copy))


def rewrite_model_references(board: Path, targets: Mapping[str, str]) -> int:
    """Point *board*'s ``(model ...)`` nodes named in *targets* at their files.

    The board in the materialized closure is rewritten, never the repository:
    its closure record was taken from Git before this runs.  Only the model
    path token changes, so every other byte the tools read stays the
    committed one.  Returns how many of *targets* were rewritten; one left
    untouched is logged.
    """

    if not targets:
        return 0
    text = board.read_text(encoding="utf-8")
    rewritten_references: set[str] = set()

    def replace(match: re.Match[str]) -> str:
        value = unquote_token(match.group(2))
        target = targets.get(value)
        if target is None:
            return match.group(0)
        rewritten_references.add(value)
        quoted = target.replace("\\", "\\\\").replace('"', '\\"')
        return f'{match.group(1)}"{quoted}"'

    rewritten = _MODEL_NODE_RE.sub(replace, text)
    if rewritten_references:
        board.write_text(rewritten, encoding="utf-8")
    missed = sorted(set(targets) - rewritten_references)
    if missed:
        # The tools then open these as written, not the pinned file.
        logger.warning(
            "Release Studio could not point %d model node(s) of %s at their pinned "
            "files: %s",
            len(missed),
            board.name,
            ", ".join(missed),
        )
    return len(rewritten_references)


def unquote_token(token: str) -> str:
    """A ``(model ...)`` token's value, as the closure's s-expression reader gives it.

    A bare token is its own value.  In a quoted one ``\\\\`` and ``\\"`` stand
    for the character, ``\\n``, ``\\r`` and ``\\t`` for the control
    character, and any other backslash is kept (kicad-monkey's lexer).
    """

    if len(token) < 2 or not (token.startswith('"') and token.endswith('"')):
        return token
    return _ESCAPE_RE.sub(lambda match: _ESCAPES.get(match.group(1), match.group(0)), token[1:-1])


_ESCAPES = {"\\": "\\", '"': '"', "n": "\n", "r": "\r", "t": "\t"}
_ESCAPE_RE = re.compile(r"\\(.)", re.DOTALL)
_MODEL_NODE_RE = re.compile(r'(\(model\s+)("(?:[^"\\]|\\.)*"|[^\s()"]+)')


def _expand(text: str, value: Callable[[str], str]) -> str | None:
    """Expand every variable in *text*, or None where one is unset or left over.

    KiCad re-expands a result that still holds a variable; eight rounds is
    deeper than any real project nests them.
    """

    for _ in range(8):
        if "$" not in text:
            return text
        missing = False

        def substitute(match: re.Match[str]) -> str:
            nonlocal missing
            name = match.group("curly") or match.group("round") or match.group("bare")
            found = value(name)
            if not found:
                missing = True
                return ""
            return found.replace("\\", "/")

        text = _VARIABLE_RE.sub(substitute, text)
        if missing:
            return None
    return None if "$" in text else text


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


def _stage_regular_file(path: Path, limit: int, stage: Path) -> tuple[str, Path] | None:
    """Copy *path* into *stage* while hashing it: the copy holds the hashed bytes.

    Read once, so a file changed after it was hashed cannot reach the tools.
    The copy lands at ``<stage>/<sha256>/<name>``: KiCad picks a 3D plugin by
    the name's suffix, and equal bytes under one name are staged once.
    """

    stage.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    descriptor, temporary = tempfile.mkstemp(dir=stage, prefix=".staging-")
    try:
        with os.fdopen(descriptor, "wb") as handle:
            def consume(chunk: bytes) -> None:
                digest.update(chunk)
                handle.write(chunk)

            if not _regular_file_chunks(path, limit, consume):
                return None
        copy = stage / digest.hexdigest() / path.name
        copy.parent.mkdir(exist_ok=True)
        os.replace(temporary, copy)
        os.chmod(copy, 0o444)
        return digest.hexdigest(), copy
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
