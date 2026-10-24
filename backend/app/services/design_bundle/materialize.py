"""Materializing a revision's source set for stage parse (cli-spec.md §9.1 step 1).

Every regular and executable entry of the key's record is written to
``$JOB/src`` at its repository path, from Git objects (no checkout, no
``git archive``). Git LFS pointers are hydrated from the repository's local
LFS store, or from the working tree when its file has the pointer's SHA-256
(Release Studio's rule, ``release_studio/closure.py``). Each gitlink is
expanded from its initialized submodule at the commit it records, selected by
the key's own name rules. Symlink entries are never written (the CLI refuses
links under ``--source-root``).

A design source that cannot be materialized raises :class:`SourceUnavailable`
(the job retries; no archive is written). A 3D model that cannot be is left
out and listed in ``Materialized.unavailable_models``; stage parse warns
``model-unavailable`` for it (bundle-format.md §2.2). A gitlink whose
submodule is not initialized is listed in ``unavailable_gitlinks``.
"""

from __future__ import annotations

import contextlib
import hashlib
import os
import subprocess
import threading
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Callable, Iterable, Mapping, Sequence

from app.services.design_bundle import revision_key as rk

_LFS_VERSION = b"version https://git-lfs.github.com/spec/v1"
_LFS_MAX_POINTER = 1024


class SourceUnavailable(RuntimeError):
    """A design source of the key could not be materialized."""


@dataclass
class Materialized:
    files: int = 0
    lfs_hydrated: list[str] = field(default_factory=list)
    unavailable_models: list[str] = field(default_factory=list)
    unavailable_gitlinks: list[str] = field(default_factory=list)
    submodule_files: int = 0


@dataclass(frozen=True)
class _Object:
    path: str  # repository path (through gitlinks)
    oid: str
    executable: bool
    category: str


def lfs_pointer(content: bytes) -> tuple[str, int] | None:
    """``(sha256, size)`` of an LFS spec v1 pointer, else ``None``."""

    if len(content) > _LFS_MAX_POINTER or not content.startswith(_LFS_VERSION):
        return None
    values = {}
    for line in content.decode("ascii", "replace").splitlines()[1:]:
        key, _, value = line.partition(" ")
        values[key] = value
    oid, size = values.get("oid", ""), values.get("size", "")
    if not oid.startswith("sha256:") or len(oid) != 71 or not size.isdigit():
        return None
    return oid[7:], int(size)


def _git(repo: Path, *args: str) -> bytes:
    process = subprocess.run(["git", "--no-optional-locks", "-C", str(repo), *args], capture_output=True, check=False)
    if process.returncode != 0:
        raise SourceUnavailable(f"git {args[0]} failed in {repo.name}: {process.stderr.decode('utf-8', 'replace').strip()}")
    return process.stdout


def _batch(repo: Path, oids: Sequence[str], sink: Callable[[int, bytes | None], None]) -> None:
    """``git cat-file --batch``: ``sink(index, content)``, ``None`` for a missing object."""

    if not oids:
        return
    process = subprocess.Popen(
        ["git", "--no-optional-locks", "-C", str(repo), "cat-file", "--batch"],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
    )
    assert process.stdin is not None and process.stdout is not None

    def request() -> None:
        with contextlib.suppress(BrokenPipeError):
            for oid in oids:
                process.stdin.write(oid.encode("ascii") + b"\n")
            process.stdin.close()

    writer = threading.Thread(target=request, daemon=True)
    writer.start()
    try:
        for index, oid in enumerate(oids):
            header = process.stdout.readline().split()
            if len(header) == 2 and header[1] == b"missing":
                sink(index, None)
                continue
            if len(header) != 3 or header[0].decode("ascii") != oid or header[1] != b"blob":
                raise SourceUnavailable(f"could not read object {oid}")
            content = process.stdout.read(int(header[2]))
            process.stdout.read(1)
            sink(index, content)
    except BaseException:
        process.kill()
        raise
    finally:
        writer.join()
        process.stdout.close()
        process.wait()


def _lfs_object(repo: Path, worktree_file: Path, sha: str, size: int) -> bytes | None:
    common = Path(_git(repo, "rev-parse", "--path-format=absolute", "--git-common-dir").decode().strip())
    for candidate in (common / "lfs" / "objects" / sha[:2] / sha[2:4] / sha, worktree_file):
        try:
            if candidate.is_symlink() or not candidate.is_file() or candidate.stat().st_size != size:
                continue
            content = candidate.read_bytes()
        except OSError:
            continue
        if hashlib.sha256(content).hexdigest() == sha:
            return content
    return None


def _write(destination: Path, path: str, content: bytes, executable: bool) -> None:
    target = destination.joinpath(*PurePosixPath(path).parts)
    if not target.resolve().is_relative_to(destination.resolve()):
        raise SourceUnavailable(f"{path} leaves the source root")
    target.parent.mkdir(parents=True, exist_ok=True)
    with open(target, "xb") as handle:
        handle.write(content)
    os.chmod(target, 0o755 if executable else 0o644)


def _materialize_objects(repo: Path, objects: Sequence[_Object], prefix: str, destination: Path, out: Materialized) -> None:
    def sink(index: int, content: bytes | None) -> None:
        item = objects[index]
        if content is not None:
            pointer = lfs_pointer(content)
            if pointer is not None:
                local = item.path[len(prefix):] if prefix else item.path
                content = _lfs_object(repo, repo.joinpath(*PurePosixPath(local).parts), *pointer)
                if content is not None:
                    out.lfs_hydrated.append(item.path)
        if content is None:
            if item.category == "model-3d":
                out.unavailable_models.append(item.path)
                return
            raise SourceUnavailable(f"{item.path} ({item.category}) cannot be materialized")
        _write(destination, item.path, content, item.executable)
        out.files += 1

    _batch(repo, [item.oid for item in objects], sink)


def _submodule_repo(repo: Path, path: str, commit: str) -> Path | None:
    candidate = repo.joinpath(*PurePosixPath(path).parts)
    if not (candidate / ".git").exists():
        return None
    process = subprocess.run(
        ["git", "-C", str(candidate), "cat-file", "-e", f"{commit}^{{commit}}"], capture_output=True, check=False
    )
    return candidate if process.returncode == 0 else None


def _expand_gitlink(
    repo: Path, local: str, prefix: str, commit: str, excluded: Sequence[bytes], destination: Path, out: Materialized
) -> None:
    """Expand the gitlink at ``local`` (in ``repo``), whose repository path is ``prefix``."""

    submodule = _submodule_repo(repo, local, commit)
    if submodule is None:
        out.unavailable_gitlinks.append(prefix)
        return
    objects: list[_Object] = []
    for entry in rk.parse_ls_tree(_git(submodule, "ls-tree", "-r", "-z", "--full-tree", commit)):
        kind = rk.KIND_BY_MODE.get((entry.mode, entry.type))
        global_path = prefix.encode("utf-8") + b"/" + entry.path
        if kind is None or any(global_path == d or global_path.startswith(d + b"/") for d in excluded):
            continue
        category = rk.category_of(entry.path.rsplit(b"/", 1)[-1], kind)
        if category is None:
            continue
        try:
            text, inner = global_path.decode("utf-8"), entry.path.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if not rk.is_repo_path(text):
            continue
        if kind == "gitlink":
            _expand_gitlink(submodule, inner, text, entry.object_id, excluded, destination, out)
        elif kind in ("regular", "executable"):
            objects.append(_Object(text, entry.object_id, kind == "executable", category))
    before = out.files
    _materialize_objects(submodule, objects, prefix + "/", destination, out)
    out.submodule_files += out.files - before


def materialize(repo: Path, record: Mapping[str, object], destination: Path) -> Materialized:
    """Write the key record's source set under ``destination`` (which must be empty or absent)."""

    destination.mkdir(parents=True, exist_ok=True)
    if any(destination.iterdir()):
        raise SourceUnavailable("the materialization destination is not empty")
    entries: Iterable[Mapping[str, str]] = record["entries"]  # type: ignore[assignment]
    config: Mapping[str, object] = record["config"]  # type: ignore[assignment]
    excluded = [str(d).encode("utf-8") for d in config.get("excluded_dirs", [])]  # type: ignore[union-attr]
    out = Materialized()
    objects = [
        _Object(e["path"], e["object_id"], e["kind"] == "executable", e["category"])
        for e in entries
        if e["kind"] in ("regular", "executable")
    ]
    _materialize_objects(repo, objects, "", destination, out)
    for entry in entries:
        if entry["kind"] == "gitlink":
            _expand_gitlink(repo, entry["path"], entry["path"], entry["object_id"], excluded, destination, out)
    for listed in (out.lfs_hydrated, out.unavailable_models, out.unavailable_gitlinks):
        listed.sort(key=lambda item: item.encode("utf-8"))
    return out
