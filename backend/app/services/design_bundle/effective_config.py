"""The effective project configuration, resolved by Prism (revision-key.md §4.4).

One function of three inputs, the same for a commit and for a working tree:
the project row (anchor, directory, stored settings), the revision's listing,
and the bytes of ``<project dir>/.prism.json`` at that revision. It reads no
file system and attributes files by anchor only, never by directory
(issue #681): there is no fallback to "the board in the directory".

:func:`key_at_commit` and :func:`key_of_worktree` put it together with the
listing and the key (``revision_key``).
"""

from __future__ import annotations

import fnmatch
import json
import posixpath
import sys
import threading
import weakref
from collections import OrderedDict
from dataclasses import dataclass, field, replace
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, NamedTuple, Sequence

from app.services import path_config_service
from app.services.design_bundle import revision_key as rk

#: Path settings the key reads (§4); the others select nothing the build parses.
_KEYED_PATH_FIELDS = ("schematic", "pcb", "designOutputs", "manufacturingOutputs")
_GLOB_CHARACTERS = ("*", "?", "[")


@dataclass(frozen=True)
class Resolution:
    """A resolved configuration, and what the backfill should know about it.

    ``notes`` are codes: ``schematic-unresolved`` / ``board-unresolved`` when
    the project directory holds such files but none is this project's (a
    stricter result than today's directory fallbacks), ``prism-json-invalid``
    when the committed ``.prism.json`` is not a JSON object.
    """

    config: dict[str, Any]
    notes: tuple[str, ...] = ()


@dataclass(frozen=True)
class ProjectRef:
    """What the resolution needs from a workspace project row."""

    project_dir: str  # repository-relative, "" at the root
    anchor: str  # ``project_file_rel``, relative to the project directory
    stored: Mapping[str, Any] = field(default_factory=dict)

    @classmethod
    def from_row(cls, row: Mapping[str, Any]) -> "ProjectRef":
        relative = str(row.get("relative_path") or ".").strip().strip("/")
        return cls(
            project_dir="" if relative in ("", ".") else relative,
            anchor=str(row.get("project_file_rel") or "").strip(),
            stored=dict(row.get("path_settings") or {}),
        )

    def repo_path(self, relative: str) -> str | None:
        """``relative`` joined to the project directory, or ``None`` when it leaves the repository."""

        if not relative or relative.startswith("/"):
            return None
        joined = posixpath.normpath(posixpath.join(self.project_dir, relative) if self.project_dir else relative)
        if joined in (".", "") or joined == ".." or joined.startswith("../"):
            return None
        return joined

    @property
    def project_file(self) -> str | None:
        return self.repo_path(self.anchor) if self.anchor else None

    @property
    def settings_path(self) -> str:
        return f"{self.project_dir}/.prism.json" if self.project_dir else ".prism.json"


def _blank_to_none(value: Any) -> Any:
    return (value.strip() or None) if isinstance(value, str) else value


def _settings(ref: ProjectRef, prism_json: bytes | None, notes: list[str]) -> dict[str, Any]:
    """Step 1: ``config_for_anchor`` of the committed file, overridden key by key by stored settings."""

    parsed: Any = {}
    if prism_json is not None:
        try:
            parsed = json.loads(prism_json.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            parsed = {}
        if not isinstance(parsed, dict):
            notes.append("prism-json-invalid")
            parsed = {}
    merged = {key: _blank_to_none(value) for key, value in path_config_service.config_for_anchor(parsed, ref.anchor).items()}
    for key, value in ref.stored.items():
        if key in path_config_service.PATH_FIELDS:
            merged[key] = _blank_to_none(value)
    for key in _KEYED_PATH_FIELDS:
        if not isinstance(merged.get(key), str) or not merged.get(key):
            merged[key] = path_config_service.DEFAULT_PATHS[key]
    return merged


def _stem(name: str) -> str:
    return PurePosixPath(name).stem


def _resolve_document(
    ref: ProjectRef, value: str, suffix: str, category: str, blobs: Mapping[str, str]
) -> str | None:
    """Step 3: one ``root_schematic``/``board`` value against the listing's blob paths."""

    def usable(path: str) -> bool:
        name = path.rsplit("/", 1)[-1]
        return (
            path in blobs
            and rk.is_repo_path(path)
            and name.encode("utf-8").lower().endswith(suffix.encode("ascii"))
            and rk.category_of(name.encode("utf-8"), blobs[path]) == category
        )

    if not any(character in value for character in _GLOB_CHARACTERS):
        path = ref.repo_path(value)
        return path if path is not None and usable(path) else None
    stem = _stem(ref.anchor).casefold()
    pattern = value.strip("/").split("/")
    prefix = f"{ref.project_dir}/" if ref.project_dir else ""
    for path in sorted(blobs, key=lambda item: item.encode("utf-8")):
        if not path.startswith(prefix):
            continue
        parts = path[len(prefix):].split("/")
        if len(parts) != len(pattern) or not all(fnmatch.fnmatchcase(p, g) for p, g in zip(parts, pattern)):
            continue
        if _stem(parts[-1]).casefold() == stem and usable(path):
            return path
    return None


def _excluded_dirs(ref: ProjectRef, settings: Mapping[str, Any], documents: Sequence[str]) -> list[str]:
    """Step 4: the output directories, normalized, filtered, un-nested and byte-sorted."""

    found: set[str] = set()
    for key in ("designOutputs", "manufacturingOutputs"):
        value = settings.get(key)
        if not isinstance(value, str) or not value or any(c in value for c in _GLOB_CHARACTERS):
            continue
        path = ref.repo_path(value)
        if path is None or not rk.is_repo_path(path):
            continue
        if any(document == path or document.startswith(path + "/") for document in documents):
            continue
        found.add(path)
    ordered = sorted(found, key=lambda item: item.encode("utf-8"))
    return [d for d in ordered if not any(d.startswith(other + "/") for other in ordered if other != d)]


def resolve(ref: ProjectRef, listing: Sequence[rk.ListingEntry], prism_json: bytes | None) -> Resolution:
    """§4.4: the effective configuration of ``ref`` at the revision ``listing`` describes.

    Raises :class:`revision_key.ProjectAbsent` when the anchor is not a
    ``.kicad_pro`` path at all; an anchor missing from the listing is found
    absent by ``select`` with the same outcome.
    """

    notes: list[str] = []
    project_file = ref.project_file
    if project_file is None or not rk.is_repo_path(project_file) or not project_file.lower().endswith(".kicad_pro"):
        raise rk.ProjectAbsent(project_file or ref.anchor or "")
    settings = _settings(ref, prism_json, notes)
    blobs: dict[str, str] = {}
    for entry in listing:
        kind = rk.KIND_BY_MODE.get((entry.mode, entry.type))
        if kind in (None, "gitlink"):
            continue
        try:
            blobs[entry.path.decode("utf-8")] = kind
        except UnicodeDecodeError:
            continue
    config: dict[str, Any] = {"schema": rk.CONFIG_SCHEMA, "project_file": project_file}
    for key, setting, suffix, category, note in (
        ("root_schematic", "schematic", ".kicad_sch", "kicad-schematic", "schematic-unresolved"),
        ("board", "pcb", ".kicad_pcb", "kicad-board", "board-unresolved"),
    ):
        found = _resolve_document(ref, str(settings[setting]), suffix, category, blobs)
        if found is not None:
            config[key] = found
        elif any(_beside(ref, path) and path.lower().endswith(suffix) for path in blobs):
            notes.append(note)
    documents = [config[key] for key in ("project_file", "root_schematic", "board") if key in config]
    config["excluded_dirs"] = _excluded_dirs(ref, settings, documents)
    if _blank_to_none(ref.stored.get("zone_fills")) == "saved":
        config["zone_fills"] = "saved"
    return Resolution(config=config, notes=tuple(notes))


def _beside(ref: ProjectRef, path: str) -> bool:
    parent = path.rsplit("/", 1)[0] if "/" in path else ""
    return parent == ref.project_dir


# --------------------------------------------------------------- keying


@dataclass(frozen=True)
class ProjectKey:
    """A project's key at one revision; ``key`` is ``None`` when the project is absent."""

    commit: str | None
    config: dict[str, Any] | None
    key: rk.RevisionKey | None
    notes: tuple[str, ...] = ()
    warnings: tuple[dict[str, str], ...] = ()
    absent_project_file: str | None = None

    @property
    def absent(self) -> bool:
        return self.key is None

    def record(self) -> dict[str, Any]:
        if self.key is None or self.config is None:
            raise ValueError("an absent project has no key record")
        return rk.record(self.key, self.config, commit=self.commit, warnings=self.warnings)


def _settings_blob(ref: ProjectRef, listing: Sequence[rk.ListingEntry]) -> str | None:
    wanted = ref.settings_path.encode("utf-8")
    for entry in listing:
        if entry.path == wanted and (entry.mode, entry.type) in (("100644", "blob"), ("100755", "blob")):
            return entry.object_id
    return None


def _keyed(
    ref: ProjectRef,
    listing: Sequence[rk.ListingEntry],
    prism_json: bytes | None,
    object_format: str,
    commit: str | None,
    warnings: Sequence[dict[str, str]] = (),
) -> ProjectKey:
    try:
        resolution = resolve(ref, listing, prism_json)
        key = rk.compute(listing, resolution.config, object_format)
    except rk.ProjectAbsent as absent:
        return ProjectKey(commit=commit, config=None, key=None, absent_project_file=absent.project_file)
    return ProjectKey(
        commit=commit, config=resolution.config, key=key, notes=resolution.notes, warnings=tuple(warnings)
    )


#: Keys of resolved commits, by repository, commit and project reference. A
#: commit's tree and blobs never change, so an entry stays right for as long as
#: it is kept; the bound only caps memory. Entries are capped both by count and
#: by the approximate bytes they retain (:func:`_approx_bytes`), because a large
#: monorepo's key holds thousands of source entries: 512 such keys are hundreds
#: of megabytes, while 512 small projects fit in one.
_KEYS_AT_COMMIT: "OrderedDict[tuple[str, ...], _Memo]" = OrderedDict()
_KEYS_AT_COMMIT_MAX = 512
_KEYS_AT_COMMIT_MAX_BYTES = 32 * 1024 * 1024


class _Memo(NamedTuple):
    """A cached key and the bytes it is estimated to retain."""

    key: ProjectKey
    size: int


class _Flight:
    """One cold computation that concurrent misses wait on instead of repeating."""

    __slots__ = ("done", "value", "error")

    def __init__(self) -> None:
        self.done = threading.Event()
        self.value: ProjectKey | None = None
        self.error: BaseException | None = None


#: Memo keys being computed right now. The thread that found none becomes the
#: leader, computes, and hands its result to the waiters; a failure is handed
#: over the same way and cached by nobody, so the next caller tries again.
_INFLIGHT: "dict[tuple[str, ...], _Flight]" = {}

#: Commits whose project is unchanged select the same entries with the same
#: object ids, so they share one ``RevisionKey`` (its entry list is nearly all
#: of a cached key's cost) instead of keeping a copy each, by revision key: the
#: preimage covers the object format and the config, so a digest names one
#: content. Weak on purpose: a shared key lives only while a memo entry keeps
#: it, so it needs no bound of its own, which also means ``RevisionKey`` must
#: stay weak-referenceable.
_SHARED_REVISION_KEYS: "weakref.WeakValueDictionary[str, rk.RevisionKey]" = weakref.WeakValueDictionary()

_keys_lock = threading.Lock()


def _approx_bytes(key: ProjectKey, memo: tuple[str, ...]) -> int:
    """Approximate bytes ``key`` keeps alive, counted cheaply when it is stored.

    Every retained string is measured once with ``sys.getsizeof`` and the fixed
    objects as themselves: no recursive walk, so storing an entry costs a
    fraction of a millisecond, not a second pass over its thousands of entries.
    ``kind`` and ``category`` are module-level constants shared by every entry,
    and an entry dictionary's key strings are the same literals everywhere, so
    an entry pays for its own dictionary, path and object id only.

    The estimate bounds memory from above: an entries list shared through
    :data:`_SHARED_REVISION_KEYS` is still charged in full to every entry that
    would otherwise have held its own copy, so sharing lowers the memory a
    budget buys rather than the budget's meaning.
    """

    size = sum(sys.getsizeof(part) for part in memo)
    size += sys.getsizeof(key) + sys.getsizeof(key.__dict__)
    size += sys.getsizeof(key.commit) + sys.getsizeof(key.absent_project_file)
    size += sum(sys.getsizeof(note) for note in key.notes)
    for warning in key.warnings:
        size += sum(sys.getsizeof(name) + sys.getsizeof(value) for name, value in warning.items())
    if key.config is not None:
        size += sys.getsizeof(key.config) + sum(
            sys.getsizeof(name) + sys.getsizeof(value) for name, value in key.config.items()
        )
    revision = key.key
    if revision is not None:
        size += sys.getsizeof(revision) + sys.getsizeof(revision.__dict__)
        size += sys.getsizeof(revision.entries) + sys.getsizeof(revision.revision_key)
        size += sys.getsizeof(revision.config_canonical) + sys.getsizeof(revision.object_format)
        for entry in revision.entries:
            size += sys.getsizeof(entry) + sys.getsizeof(entry["path"]) + sys.getsizeof(entry["object_id"])
    return size


def _keys_cache_bytes() -> int:
    """The cache's own estimate of what it retains (diagnostics and tests)."""

    with _keys_lock:
        return sum(entry.size for entry in _KEYS_AT_COMMIT.values())


def _remember(memo: tuple[str, ...], key: ProjectKey) -> None:
    """Cache ``key``, evicting least-recently-used entries over either bound."""

    _KEYS_AT_COMMIT[memo] = _Memo(key=key, size=_approx_bytes(key, memo))
    total = sum(entry.size for entry in _KEYS_AT_COMMIT.values())
    # The newest entry stays even when it alone is over the byte budget: a key
    # that is too big to keep is still the one the caller is about to use.
    while len(_KEYS_AT_COMMIT) > 1 and (
        len(_KEYS_AT_COMMIT) > _KEYS_AT_COMMIT_MAX or total > _KEYS_AT_COMMIT_MAX_BYTES
    ):
        _, evicted = _KEYS_AT_COMMIT.popitem(last=False)
        total -= evicted.size


def _share(revision: rk.RevisionKey) -> rk.RevisionKey:
    """``revision``, or the equal one the cache already holds (under the lock)."""

    held = _SHARED_REVISION_KEYS.get(revision.revision_key)
    if held is not None and held == revision:
        return held
    _SHARED_REVISION_KEYS[revision.revision_key] = revision
    return revision


def _cache(memo: tuple[str, ...], key: ProjectKey, flight: _Flight) -> ProjectKey:
    """Share, memoize, and hand ``key`` to the waiters (under the lock)."""

    revision = key.key
    if revision is not None:
        shared = _share(revision)
        if shared is not revision:
            key = replace(key, key=shared)
    _remember(memo, key)
    _INFLIGHT.pop(memo, None)
    flight.value = key
    flight.done.set()
    return key


def _compute(repo: Path, resolved: str, ref: ProjectRef) -> ProjectKey:
    """The one ``ls-tree``, settings blob and resolution a cold key costs."""

    _, listing = rk.commit_listing(repo, resolved)
    oid = _settings_blob(ref, listing)
    prism_json = rk.read_blob(repo, oid) if oid else None
    return _keyed(ref, listing, prism_json, rk.object_format_of(repo), resolved)


def key_at_commit(repo: Path, ref: ProjectRef, commit: str) -> ProjectKey:
    """The project's key at ``commit``: one ``ls-tree`` and the ``.prism.json`` blob.

    Resolving ``commit`` is one ``rev-parse``; the rest is memoized per
    resolved commit, because every design-data read of a page (a schematic's
    every sheet) asks for the same key and the full-tree ``ls-tree`` was most
    of each read's cost. A burst of cold readers of one commit computes it once:
    the first arrives, the rest wait for its result. A failure reaches every
    waiter and is not cached, so the next call computes again.
    """

    resolved = rk.resolve_commit(repo, commit)
    memo = (str(repo), resolved, ref.project_dir, ref.anchor, json.dumps(ref.stored, sort_keys=True, default=str))
    with _keys_lock:
        cached = _KEYS_AT_COMMIT.get(memo)
        if cached is not None:
            _KEYS_AT_COMMIT.move_to_end(memo)
            return cached.key
        running = _INFLIGHT.get(memo)
        if running is None:
            running = _INFLIGHT[memo] = _Flight()
            leader = True
        else:
            leader = False
    if not leader:
        running.done.wait()
        if running.error is not None:
            raise running.error
        assert running.value is not None
        return running.value
    try:
        key = _compute(repo, resolved, ref)
    except BaseException as error:
        with _keys_lock:
            _INFLIGHT.pop(memo, None)
            running.error = error
            running.done.set()
        raise
    with _keys_lock:
        return _cache(memo, key, running)


def key_of_worktree(repo: Path, ref: ProjectRef) -> ProjectKey:
    """The project's working-tree key (§9): what ``git add -A`` would make of it."""

    listing, warnings = rk.worktree_listing(repo)
    prism_json = None
    if _settings_blob(ref, listing):
        prism_json = (repo / ref.settings_path).read_bytes()
    return _keyed(ref, listing, prism_json, rk.object_format_of(repo), None, warnings)
