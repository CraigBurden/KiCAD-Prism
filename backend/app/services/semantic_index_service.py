"""The semantic index served from the design bundle, plus the revision key.

The index itself is a member of a revision's design bundle
(``projections/semantic-index.json``, ``prism.semantic_index.a2``) and every
public reader here serves it. A request without a commit reads the checkout's
HEAD (``design_bundle.consumer``). A member that is building raises
``DesignDataPending``; one that failed raises ``DesignDataFailed``.

This module also owns the revision-key rules the catalog and comment anchors
share: which files identify a revision, and how a working tree and a commit
produce the same key. No Python KiCad parser runs here any more (WP-R2): the
parse is ``prism-kicad``'s, in the bundle's job.
"""

from __future__ import annotations

import hashlib
import subprocess
from pathlib import Path, PurePosixPath
from typing import Any, Iterable

from app.services import (
    kicad_project_locator,
    path_config_service,
    project_revision,
    semantic_index_bundle,
)


GENERATOR_NAME = "kicad-prism-semantic-index"
GENERATOR_VERSION = "0.2.0"
#: Bump when the stored payload changes (new fields, different values) in a
#: way the bundle member's own contract does not. The index is a design-bundle
#: member now, so the member's schema and the bundle generator digest identify
#: its content; this is the status route's legacy envelope value.
GENERATOR_BUILD = "r1"


def _blob_id(data: bytes) -> str:
    """Git's object id for a blob: SHA-1 over the object header and content.

    Computing this locally lets a working-tree revision produce the same key as
    the same content read out of a commit, where the ids come from the index for
    free.  SHA-1 is git's choice of object id here, not a security boundary.
    """

    digest = hashlib.sha1(b"blob %d\0" % len(data), usedforsecurity=False)
    digest.update(data)
    return digest.hexdigest()


def _revision_key(
    entries: Iterable[tuple[str, str]], *, project_file_rel: str = ""
) -> str:
    """Reduce source entries and the selected project anchor to a cache key."""

    digest = hashlib.sha256()
    digest.update(project_file_rel.encode("utf-8"))
    digest.update(b"\0")
    for path, blob in sorted(entries):
        digest.update(path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(blob.encode("utf-8"))
        digest.update(b"\0")
    return digest.hexdigest()[:32]


def _source_entries_on_disk(root: Path) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".git" in path.parts:
            continue
        relative = path.relative_to(root).as_posix()
        if not project_revision.SEMANTIC_SOURCES.includes(relative):
            continue
        entries.append((relative, _blob_id(path.read_bytes())))
    return entries


def _source_entries_in_commit(
    repo_root: Path,
    commit: str,
    project_dir: str,
) -> list[tuple[str, str]]:
    """List the project's semantic sources at a commit, without checking it out.

    Every blob id here is already a hash of that file's content, so the tree
    listing alone identifies the revision as precisely as reading the files
    would — for the cost of one `git ls-tree` instead of an archive extraction.
    """

    args = ["git", "-C", str(repo_root), "ls-tree", "-r", "-z", commit]
    if project_dir:
        args.extend(["--", f"{project_dir}/"])
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if result.returncode != 0:
        raise ValueError(
            f"Could not list {commit}: "
            f"{result.stderr.decode('utf-8', errors='replace').strip()}"
        )

    prefix = f"{project_dir}/" if project_dir else ""
    entries: list[tuple[str, str]] = []
    for record in result.stdout.decode("utf-8", errors="replace").split("\0"):
        if not record:
            continue
        metadata, _, path = record.partition("\t")
        parts = metadata.split()
        if len(parts) < 3 or parts[1] != "blob":
            continue
        if not path.startswith(prefix):
            continue
        relative = path[len(prefix):]
        if not project_revision.SEMANTIC_SOURCES.includes(relative):
            continue
        entries.append((relative, parts[2]))
    return entries


def source_revision_key_for_project_file(project_file: Path) -> str:
    resolved = project_file.resolve()
    return _revision_key(
        _source_entries_on_disk(resolved.parent),
        project_file_rel=resolved.name,
    )


def generator_cache_tag() -> str:
    """The extractor tag recorded in catalog provenance.

    The semantic index is a design-bundle member now, produced by
    ``prism-kicad``; no Python ``kicad-monkey`` projection runs. The tag names
    this module's payload build and the design-bundle generator contract
    (``prism.cli.version.a0``), which is the identity a consumer can compare.
    Stored tags stay opaque: only new provenance rows carry the new text.
    """

    from app.services.design_bundle.generator import GENERATOR_SCHEMA

    return f"{GENERATOR_VERSION}-{GENERATOR_BUILD}-{GENERATOR_SCHEMA}"


def _revision_identity(project: Any, commit: str | None) -> tuple[str, str | None]:
    """Identify a revision cheaply enough to check the cache before building it.

    Materializing a commit means extracting the whole repository into a
    temporary directory, and the caller used to do that before it knew whether
    the artifact already existed — so every cache hit paid for an archive
    extraction and a full re-read of the sources.  A tree listing answers the
    same question, because git's blob ids are content hashes already.
    """

    anchor = path_config_service.anchor_for_project(project)
    if not commit:
        project_file = kicad_project_locator.find_kicad_project(project.path, anchor)
        return (
            _revision_key(
                _source_entries_on_disk(project_file.resolve().parent),
                project_file_rel=anchor or project_file.name,
            ),
            None,
        )

    location = project_revision.locate(project)
    repo_root = location.repo_root
    resolved_commit = project_revision.resolve_commit(location, commit)
    project_rel = project_revision.project_file_rel(location)
    project_dir = PurePosixPath(project_rel).parent.as_posix()
    if project_dir == ".":
        project_dir = ""
    entries = _source_entries_in_commit(repo_root, resolved_commit, project_dir)
    return (
        _revision_key(
            entries,
            project_file_rel=anchor or PurePosixPath(project_rel).name,
        ),
        resolved_commit,
    )


def _bundle_read(project: Any, commit: str | None) -> Any:
    """The project's semantic-index bundle read at ``commit`` (``HEAD`` when ``None``).

    Raises ``DesignDataPending`` while the member builds and ``DesignDataFailed``
    when it cannot be built; the API renders both the same way for every route.
    """

    location = project_revision.locate(project)
    resolved_commit = project_revision.resolve_commit(location, commit or "HEAD")
    return semantic_index_bundle.ready(str(project.id), resolved_commit)


def _ready_read(project: Any, commit: str | None) -> Any:
    """The read when its semantic-index member is ready; a final non-member fails.

    ``not-applicable`` and ``skipped`` are final: a project with no root
    schematic has no index, and that is a typed failure rather than a wait.
    """

    from app.services.design_bundle.errors import DesignDataFailed

    read = _bundle_read(project, commit)
    if not read.ready(semantic_index_bundle.MEMBER):
        raise DesignDataFailed([semantic_index_bundle.MEMBER], "this project has no semantic index")
    return read


def get_index(project: Any, commit: str | None = None) -> dict[str, Any]:
    """The revision's semantic index: ``projections/semantic-index.json`` (a2)."""

    return _ready_read(project, commit).json(semantic_index_bundle.MEMBER)


def artifact_file(project: Any, commit: str | None = None) -> semantic_index_bundle.ArtifactFile:
    """The member's file in the verified unpacked cache, keyed by the design revision key.

    Readers that only pass the index on (the identity endpoint, Sim Studio)
    start from this, so a request never holds the whole index as Python objects.
    """

    return semantic_index_bundle.artifact(_ready_read(project, commit))


def get_status(project: Any, commit: str | None = None) -> tuple[dict[str, Any], dict[str, str]]:
    read = _bundle_read(project, commit)
    return (
        semantic_index_bundle.status(read, str(project.id), _generator_record()),
        read.response_headers(),
    )


def start_generate_job(
    project_id: str,
    *,
    commit: str | None = None,
    force: bool = False,
    requested_by: str = "",
) -> dict[str, Any]:
    """Queue the revision's design bundle (the semantic index is one of its members).

    Replaces the retired ``semantic_index`` job: the bundle's build is the only
    index generator. ``force`` rebuilds even when ``reuse`` could serve the key.
    """

    from app.services.design_bundle import jobs as bundle_jobs

    job_id = bundle_jobs.start_design_bundle_job(
        project_id, commit=commit, force=force, retry_failed=True, requested_by=requested_by
    )
    return {"job_id": job_id or "", "status": "started" if job_id else "ready"}


def _generator_record() -> dict[str, str]:
    """The status route's legacy generator envelope.

    ``cacheTag`` and ``kicadMonkeyVersion`` are filled from the bundle by
    ``semantic_index_bundle.status``: the bundle's generator digest is the
    identity, and its ``engine_version`` is the parser engine that produced the
    member (the value the Python distribution used to supply).
    """

    return {
        "name": GENERATOR_NAME,
        "version": GENERATOR_VERSION,
        "build": GENERATOR_BUILD,
    }
