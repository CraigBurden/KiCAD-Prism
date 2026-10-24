"""The design revision key ``prism.revision_key.a1``: Prism's Python reference.

``native/contracts/prism/revision-key.md`` is normative; the section numbers
below are its. The key is a pure function of a ``git ls-tree -r -z`` listing
(§3), the object format and the effective configuration (§4):

- :func:`validate_config` and :func:`canonical_config` are §4.1 and §4.2;
- :func:`select` is §5.3, by the name rules of §5.2;
- :func:`preimage` and :func:`compute` are §8;
- :func:`commit_listing` and :func:`worktree_listing` read the listing (§3.1, §9);
- :func:`record` builds the ``RevisionKeyRecordA1`` the CLI's ``--key-record`` takes.

Paths are bytes as git stores them: no Unicode normalization, no case folding,
sorted by unsigned bytes (§6). Nothing here reads a KiCad file.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

ALGORITHM = "prism.revision_key.a1"
CONFIG_SCHEMA = "prism.revision_key.effective_config.a1"
RECORD_SCHEMA = "prism.revision_key.record.a1"
CONFIG_KEYS = ("schema", "project_file", "root_schematic", "board", "excluded_dirs", "zone_fills")

# common.tsp's RepoPath (conventions.md §8): no empty, "." or ".." segment, no "\\" or ":".
_SEGMENT = r"(?:[^/\\:.][^/\\:]*|\.[^/\\:.][^/\\:]*|\.\.[^/\\:]+)"
_REPO_PATH = re.compile(rf"^{_SEGMENT}(?:/{_SEGMENT})*$")
_HEX = {"sha1": re.compile(r"^[0-9a-f]{40}$"), "sha256": re.compile(r"^[0-9a-f]{64}$")}

KIND_BY_MODE = {
    ("100644", "blob"): "regular",
    ("100755", "blob"): "executable",
    ("120000", "blob"): "symlink",
    ("160000", "commit"): "gitlink",
}
MODE_BY_KIND = {kind: mode_type for mode_type, kind in KIND_BY_MODE.items()}

CATEGORIES = (
    "kicad-project", "kicad-schematic", "kicad-board", "kicad-design-rules", "kicad-worksheet",
    "kicad-jobset", "library-table", "symbol-library", "footprint", "model-3d", "prism-settings",
    "symlink", "gitlink",
)
_AUTOSAVE = (b"_autosave-", b"_autosave_", b"~autosave-", b"~autosave_")
_NAME_RULES = {b"fp-lib-table": "library-table", b"sym-lib-table": "library-table", b".prism.json": "prism-settings"}
_SUFFIX_RULES = (
    ((b".kicad_pro",), "kicad-project"),
    ((b".kicad_sch",), "kicad-schematic"),
    ((b".kicad_pcb",), "kicad-board"),
    ((b".kicad_dru",), "kicad-design-rules"),
    ((b".kicad_wks",), "kicad-worksheet"),
    ((b".kicad_jobset",), "kicad-jobset"),
    ((b".kicad_sym", b".lib", b".dcm"), "symbol-library"),
    ((b".kicad_mod",), "footprint"),
    (
        (b".step", b".stp", b".stpz", b".stepz", b".step.gz", b".stp.gz", b".wrl", b".wrz",
         b".vrml", b".x3d", b".igs", b".iges", b".idf", b".emn", b".wings"),
        "model-3d",
    ),
)
LFS_WARNING = {
    "code": "lfs-filter-unavailable",
    "message": (
        "A selected path has the filter=lfs attribute but no Git LFS clean filter is in effect; "
        "its object id hashes the hydrated content, so this working-tree key differs from the "
        "commit key for the same content."
    ),
}


class RevisionKeyError(ValueError):
    """A key that cannot be computed. ``code`` is revision-key.md §11's."""

    def __init__(self, code: str, detail: str = "") -> None:
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


class ProjectAbsent(RevisionKeyError):
    """The anchor is not a project file of the tree: an outcome, not a failure (§11)."""

    def __init__(self, project_file: str) -> None:
        super().__init__("project-absent", project_file)
        self.project_file = project_file


@dataclass(frozen=True)
class ListingEntry:
    """One ``git ls-tree -z`` record. ``path`` is the raw bytes of the tree entry."""

    mode: str
    type: str
    object_id: str
    path: bytes


# ----------------------------------------------------------------- config


def is_repo_path(value: Any) -> bool:
    return isinstance(value, str) and _REPO_PATH.fullmatch(value) is not None


def _well_formed(value: str) -> bool:
    try:
        value.encode("utf-8")
    except UnicodeEncodeError:  # a lone surrogate (§4.1 rule 1)
        return False
    return True


def _ends_with(path: str, suffix: str) -> bool:
    return path.rsplit("/", 1)[-1].encode("utf-8").lower().endswith(suffix.encode("ascii"))


def validate_config(config: Mapping[str, Any]) -> None:
    """§4.1, or ``config-invalid``. A config has exactly one spelling."""

    def invalid(detail: str) -> RevisionKeyError:
        return RevisionKeyError("config-invalid", detail)

    if not isinstance(config, Mapping) or set(config) - set(CONFIG_KEYS):
        raise invalid("unknown field")
    if config.get("schema") != CONFIG_SCHEMA:
        raise invalid("schema")
    for key in ("project_file", "root_schematic", "board"):
        if key == "project_file" or key in config:
            value = config.get(key)
            if not isinstance(value, str) or not _well_formed(value) or not is_repo_path(value):
                raise invalid(key)
    if not _ends_with(config["project_file"], ".kicad_pro"):
        raise invalid("project_file suffix")
    if "root_schematic" in config and not _ends_with(config["root_schematic"], ".kicad_sch"):
        raise invalid("root_schematic suffix")
    if "board" in config and not _ends_with(config["board"], ".kicad_pcb"):
        raise invalid("board suffix")
    excluded = config.get("excluded_dirs")
    if not isinstance(excluded, list):
        raise invalid("excluded_dirs")
    for directory in excluded:
        if not isinstance(directory, str) or not _well_formed(directory) or not is_repo_path(directory):
            raise invalid("excluded_dirs element")
    encoded = [directory.encode("utf-8") for directory in excluded]
    if any(encoded[i] >= encoded[i + 1] for i in range(len(encoded) - 1)):
        raise invalid("excluded_dirs order")
    for outer in excluded:
        if any(inner.startswith(outer + "/") for inner in excluded):
            raise invalid("excluded_dirs nesting")
        for key in ("project_file", "root_schematic", "board"):
            value = config.get(key)
            if value is not None and (value == outer or value.startswith(outer + "/")):
                raise invalid(f"excluded_dirs contains {key}")
    if "zone_fills" in config and config["zone_fills"] != "saved":
        raise invalid("zone_fills")


def canonical_config(config: Mapping[str, Any]) -> bytes:
    """§4.2: compact JSON, keys in declared order, raw UTF-8, no trailing newline."""

    ordered = {key: config[key] for key in CONFIG_KEYS if key in config}
    return json.dumps(ordered, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def config_digest(config: Mapping[str, Any]) -> str:
    return hashlib.sha256(canonical_config(config)).hexdigest()


# -------------------------------------------------------------- selection


def category_of(name: bytes, kind: str) -> str | None:
    """§5.2 on an entry's name (the bytes after its last ``/``)."""

    if kind == "gitlink":
        return "gitlink"
    lowered = name.lower()  # ASCII only: bytes.lower never touches non-ASCII
    if lowered.startswith(_AUTOSAVE):
        return None
    if lowered in _NAME_RULES:
        return _NAME_RULES[lowered]
    for suffixes, category in _SUFFIX_RULES:
        if lowered.endswith(suffixes):
            return category
    return "symlink" if kind == "symlink" else None


def select(listing: Iterable[ListingEntry], config: Mapping[str, Any], object_format: str) -> list[dict[str, str]]:
    """§5.3. Raises :class:`RevisionKeyError`, or :class:`ProjectAbsent` for the outcome."""

    validate_config(config)
    pattern = _HEX.get(object_format)
    if pattern is None:
        raise RevisionKeyError("invalid-listing", f"object format {object_format!r}")
    excluded = [directory.encode("utf-8") for directory in config["excluded_dirs"]]
    seen: set[bytes] = set()
    selected: list[dict[str, str]] = []
    for entry in listing:
        if entry.path in seen:
            raise RevisionKeyError("invalid-listing", "duplicate path")
        seen.add(entry.path)
        if not pattern.match(entry.object_id):
            raise RevisionKeyError("invalid-listing", f"object id {entry.object_id!r}")
        kind = KIND_BY_MODE.get((entry.mode, entry.type))
        if kind is None:
            raise RevisionKeyError("unsupported-entry", f"{entry.mode} {entry.type}")
        if any(entry.path == d or entry.path.startswith(d + b"/") for d in excluded):
            continue
        category = category_of(entry.path.rsplit(b"/", 1)[-1], kind)
        if category is None:
            continue
        try:
            text = entry.path.decode("utf-8")
        except UnicodeDecodeError:
            raise RevisionKeyError("unrepresentable-path", repr(entry.path)) from None
        if not is_repo_path(text):
            raise RevisionKeyError("unrepresentable-path", text)
        selected.append({"path": text, "kind": kind, "object_id": entry.object_id, "category": category})
    selected.sort(key=lambda item: item["path"].encode("utf-8"))
    by_path = {item["path"]: item for item in selected}
    anchor = by_path.get(config["project_file"])
    if anchor is None or anchor["kind"] == "gitlink":
        raise ProjectAbsent(config["project_file"])
    for key in ("root_schematic", "board"):
        if key in config:
            found = by_path.get(config[key])
            if found is None or found["kind"] == "gitlink":
                raise RevisionKeyError("config-path-missing", f"{key} {config[key]}")
    return selected


def counts(entries: Iterable[Mapping[str, str]]) -> dict[str, int]:
    out = {category.replace("-", "_"): 0 for category in CATEGORIES}
    total = 0
    for entry in entries:
        out[entry["category"].replace("-", "_")] += 1
        total += 1
    out["total"] = total
    return out


# ---------------------------------------------------------------- hashing


def preimage(object_format: str, config: Mapping[str, Any], entries: Iterable[Mapping[str, str]]) -> bytes:
    """§8, byte for byte. ``entries`` may be in any order."""

    if object_format not in _HEX:
        raise RevisionKeyError("invalid-listing", object_format)
    ordered = sorted(entries, key=lambda item: item["path"].encode("utf-8"))
    out = bytearray(ALGORITHM.encode("ascii") + b"\0")
    out += b"object-format " + object_format.encode("ascii") + b"\0"
    out += b"config " + canonical_config(config) + b"\0"
    out += b"entries " + str(len(ordered)).encode("ascii") + b"\0"
    for item in ordered:
        mode, kind = MODE_BY_KIND[item["kind"]]
        out += f"{mode} {kind} {item['object_id']}\t".encode("ascii") + item["path"].encode("utf-8") + b"\0"
    return bytes(out)


@dataclass(frozen=True)
class RevisionKey:
    revision_key: str
    config_digest: str
    config_canonical: str
    entries: tuple[dict[str, str], ...]
    object_format: str


def compute(listing: Iterable[ListingEntry], config: Mapping[str, Any], object_format: str) -> RevisionKey:
    """Selection then hashing: the revision key of one listing under one config."""

    entries = select(listing, config, object_format)
    return RevisionKey(
        revision_key=hashlib.sha256(preimage(object_format, config, entries)).hexdigest(),
        config_digest=config_digest(config),
        config_canonical=canonical_config(config).decode("utf-8"),
        entries=tuple(entries),
        object_format=object_format,
    )


def record(key: RevisionKey, config: Mapping[str, Any], *, commit: str | None, warnings: Sequence[Mapping[str, str]] = ()) -> dict[str, Any]:
    """The ``RevisionKeyRecordA1`` of ``key`` (§11): what ``revision-key`` prints."""

    return {
        "schema": RECORD_SCHEMA,
        "revision_key": key.revision_key,
        "object_format": key.object_format,
        "source": {"kind": "commit", "commit": commit} if commit else {"kind": "worktree"},
        "config": {name: config[name] for name in CONFIG_KEYS if name in config},
        "config_digest": key.config_digest,
        "entries": [dict(entry) for entry in key.entries],
        "counts": counts(key.entries),
        "warnings": sorted((dict(w) for w in warnings), key=lambda w: (w["code"], w["message"])),
    }


# -------------------------------------------------------------------- git


def _git_env() -> dict[str, str]:
    """cli-spec.md §5.5's sanitized environment, so only the repository's config applies."""

    return {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "GIT_CONFIG_NOSYSTEM": "1",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_TERMINAL_PROMPT": "0",
        "HOME": os.devnull,
        "LC_ALL": "C",
    }


def git(repo: Path, *args: str, stdin: bytes | None = None, optional_locks: bool = False) -> bytes:
    process = subprocess.run(
        ["git", *(() if optional_locks else ("--no-optional-locks",)), "-C", str(repo), *args],
        input=stdin,
        capture_output=True,
        env=_git_env(),
        check=False,
    )
    if process.returncode != 0:
        detail = process.stderr.decode("utf-8", "replace").strip()
        raise RevisionKeyError("git-failed", f"git {args[0]}: {detail}")
    return process.stdout


def parse_ls_tree(output: bytes) -> list[ListingEntry]:
    """§3.1: split at NUL, then each record at its first HT."""

    if output and not output.endswith(b"\0"):
        raise RevisionKeyError("invalid-listing", "unterminated record")
    entries = []
    for chunk in output.split(b"\0")[:-1]:
        meta, tab, path = chunk.partition(b"\t")
        fields = meta.split(b" ")
        if not tab or len(fields) != 3:
            raise RevisionKeyError("invalid-listing", repr(chunk[:80]))
        mode, kind, oid = (field.decode("ascii") for field in fields)
        entries.append(ListingEntry(mode, kind, oid, path))
    return entries


_object_formats: dict[str, str] = {}


def object_format_of(repo: Path) -> str:
    """``sha1`` or ``sha256``: fixed when a repository is created, so asked once per repository."""

    found = _object_formats.get(str(repo))
    if found is None:
        found = _object_formats[str(repo)] = git(repo, "rev-parse", "--show-object-format").decode("ascii").strip()
    return found


def resolve_commit(repo: Path, rev: str) -> str:
    try:
        return git(repo, "rev-parse", "--verify", "--end-of-options", f"{rev}^{{commit}}").decode("ascii").strip()
    except RevisionKeyError as error:
        raise RevisionKeyError("commit-not-found", rev) from error


def commit_listing(repo: Path, commit: str) -> tuple[str, list[ListingEntry]]:
    """The resolved commit id and its full-tree listing (§3.1)."""

    resolved = resolve_commit(repo, commit)
    return resolved, parse_ls_tree(git(repo, "ls-tree", "-r", "-z", "--full-tree", resolved))


def read_blob(repo: Path, object_id: str) -> bytes:
    return git(repo, "cat-file", "blob", object_id)


def _config_bool(repo: Path, key: str, default: bool) -> bool:
    process = subprocess.run(
        ["git", "-C", str(repo), "config", "--type=bool", "--get", key],
        capture_output=True, env=_git_env(), check=False,
    )
    return default if process.returncode != 0 else process.stdout.strip() == b"true"


def _hash_args() -> list[str]:
    """§9: hash with git-lfs's clean filter whenever git-lfs is on PATH."""

    return ["-c", "filter.lfs.clean=git-lfs clean -- %f"] if shutil.which("git-lfs") else []


# Concurrent readers of one repository share a ``git status``: a page load
# reads many members at once (every sheet of a schematic) and each read used to
# run its own. A caller only takes a result whose status *started* after the
# caller arrived, so nothing it sees is older than its own request.
_worktree_changes: dict[str, tuple[float, list[bytes]]] = {}
_worktree_locks: dict[str, threading.Lock] = {}
_worktree_locks_guard = threading.Lock()


def worktree_changes(repo: Path) -> list[bytes]:
    """Paths ``git add -A`` would touch (§9): staged, modified, deleted and untracked.

    Only names, never contents: the caller decides which names its read set
    covers. Rename and copy entries carry both names.
    """

    arrived = time.monotonic()
    name = str(repo)
    with _worktree_locks_guard:
        lock = _worktree_locks.setdefault(name, threading.Lock())
    with lock:
        shared = _worktree_changes.get(name)
        if shared is not None and shared[0] >= arrived:
            return list(shared[1])
        started = time.monotonic()
        changes = _read_worktree_changes(repo)
        _worktree_changes[name] = (started, changes)
        return list(changes)


def _read_worktree_changes(repo: Path) -> list[bytes]:

    # Optional locks on: status may write back the index's refreshed stat
    # data. Without that, once a checkout's timestamps move (a sync, a host
    # editor, a bind mount) every read re-hashes every tracked file: 6-9 s per
    # project page on a repository of large boards. It changes no content and
    # skips the write when another git process holds the lock.
    output = git(repo, "status", "--porcelain=v1", "-z", "--untracked-files=normal", optional_locks=True)
    changes: list[bytes] = []
    fields = output.split(b"\0")
    index = 0
    while index < len(fields):
        entry = fields[index]
        index += 1
        if not entry:
            continue
        status, path = entry[:2], entry[3:]
        if path:
            changes.append(path)
        if b"R" in status or b"C" in status:
            if index < len(fields) and fields[index]:
                changes.append(fields[index])
            index += 1
    return changes


def worktree_listing(repo: Path) -> tuple[list[ListingEntry], list[dict[str, str]]]:
    """§9: the listing ``git add -A`` would stage, computed without writing anything."""

    for chunk in git(repo, "ls-files", "-z", "-v", "--cached").split(b"\0")[:-1]:
        tag = chunk[:1]
        if tag == b"S" or tag.islower():
            raise RevisionKeyError("worktree-unsupported-index", chunk[2:].decode("utf-8", "replace"))
    index: dict[bytes, tuple[str, str]] = {}
    for chunk in git(repo, "ls-files", "-z", "--stage").split(b"\0")[:-1]:
        meta, _, path = chunk.partition(b"\t")
        mode, oid, stage_number = meta.decode("ascii").split(" ")
        if path not in index or stage_number == "0":
            index[path] = (mode, oid)
    others = git(repo, "ls-files", "-z", "--others", "--exclude-standard").split(b"\0")[:-1]
    file_mode = _config_bool(repo, "core.fileMode", True)
    listing: list[ListingEntry] = []
    to_hash: list[tuple[str, bytes]] = []
    for path in sorted(set(index) | set(others)):
        embedded = path.endswith(b"/")
        relative = path[:-1] if embedded else path
        full = os.path.join(os.fsencode(repo), relative)
        try:
            info = os.lstat(full)
        except FileNotFoundError:
            continue
        indexed = index.get(relative)
        if embedded or (indexed and indexed[0] == "160000"):
            if stat.S_ISDIR(info.st_mode) and os.path.exists(os.path.join(full, b".git")):
                head = git(Path(os.fsdecode(full)), "rev-parse", "--verify", "HEAD").decode("ascii").strip()
                listing.append(ListingEntry("160000", "commit", head, relative))
            elif indexed:
                listing.append(ListingEntry("160000", "commit", indexed[1], relative))
            continue
        if stat.S_ISLNK(info.st_mode):
            target = os.readlink(full)
            oid = git(repo, "hash-object", "--no-filters", "--stdin", stdin=target).decode("ascii").strip()
            listing.append(ListingEntry("120000", "blob", oid, relative))
        elif stat.S_ISREG(info.st_mode):
            if not file_mode and indexed and indexed[0] in ("100644", "100755"):
                mode = indexed[0]
            else:
                mode = "100755" if info.st_mode & stat.S_IXUSR else "100644"
            to_hash.append((mode, relative))
    listing.extend(_hash_files(repo, to_hash))
    listing.sort(key=lambda entry: entry.path)
    return listing, _lfs_warnings(repo, listing)


def _hash_files(repo: Path, files: list[tuple[str, bytes]]) -> list[ListingEntry]:
    """``git hash-object`` with the path's clean filters; LF-bearing paths one by one."""

    out = []
    batch = [(mode, path) for mode, path in files if b"\n" not in path]
    if batch:
        stdin = b"".join(path + b"\n" for _, path in batch)
        oids = git(repo, *_hash_args(), "hash-object", "--stdin-paths", stdin=stdin).split()
        out.extend(ListingEntry(mode, "blob", oid.decode("ascii"), path) for (mode, path), oid in zip(batch, oids))
    for mode, path in files:
        if b"\n" in path:
            name = os.fsdecode(path)
            oid = git(repo, *_hash_args(), "hash-object", f"--path={name}", "--", name).decode("ascii").strip()
            out.append(ListingEntry(mode, "blob", oid, path))
    return out


def _lfs_warnings(repo: Path, listing: list[ListingEntry]) -> list[dict[str, str]]:
    if shutil.which("git-lfs"):
        return []
    blobs = [entry.path for entry in listing if entry.type == "blob" and entry.mode != "120000"]
    if not blobs:
        return []
    fields = git(repo, "check-attr", "-z", "--stdin", "filter", stdin=b"".join(p + b"\0" for p in blobs)).split(b"\0")
    if not any(fields[i + 2] == b"lfs" for i in range(0, len(fields) - 2, 3)):
        return []
    process = subprocess.run(
        ["git", "-C", str(repo), "config", "--get", "filter.lfs.clean"],
        capture_output=True, env=_git_env(), check=False,
    )
    if process.returncode == 0 and process.stdout.strip():
        return []  # the repository configures its own clean filter
    return [dict(LFS_WARNING)]
