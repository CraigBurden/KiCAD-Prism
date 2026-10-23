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
import threading
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path, PurePosixPath
from typing import Any, Mapping, Sequence

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
#: it is kept; the bound only caps memory.
_KEYS_AT_COMMIT: "OrderedDict[tuple[str, ...], ProjectKey]" = OrderedDict()
_KEYS_AT_COMMIT_MAX = 512
_keys_lock = threading.Lock()


def key_at_commit(repo: Path, ref: ProjectRef, commit: str) -> ProjectKey:
    """The project's key at ``commit``: one ``ls-tree`` and the ``.prism.json`` blob.

    Resolving ``commit`` is one ``rev-parse``; the rest is memoized per
    resolved commit, because every design-data read of a page (a schematic's
    every sheet) asks for the same key and the full-tree ``ls-tree`` was most
    of each read's cost.
    """

    resolved = rk.resolve_commit(repo, commit)
    memo = (str(repo), resolved, ref.project_dir, ref.anchor, json.dumps(ref.stored, sort_keys=True, default=str))
    with _keys_lock:
        cached = _KEYS_AT_COMMIT.get(memo)
        if cached is not None:
            _KEYS_AT_COMMIT.move_to_end(memo)
            return cached
    _, listing = rk.commit_listing(repo, resolved)
    oid = _settings_blob(ref, listing)
    prism_json = rk.read_blob(repo, oid) if oid else None
    key = _keyed(ref, listing, prism_json, rk.object_format_of(repo), resolved)
    with _keys_lock:
        _KEYS_AT_COMMIT[memo] = key
        while len(_KEYS_AT_COMMIT) > _KEYS_AT_COMMIT_MAX:
            _KEYS_AT_COMMIT.popitem(last=False)
    return key


def key_of_worktree(repo: Path, ref: ProjectRef) -> ProjectKey:
    """The project's working-tree key (§9): what ``git add -A`` would make of it."""

    listing, warnings = rk.worktree_listing(repo)
    prism_json = None
    if _settings_blob(ref, listing):
        prism_json = (repo / ref.settings_path).read_bytes()
    return _keyed(ref, listing, prism_json, rk.object_format_of(repo), None, warnings)
