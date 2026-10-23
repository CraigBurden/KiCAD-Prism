"""Release Studio's design files from a design bundle (ADR amendment C3).

A release is built from one revision's bundle when stages ``parse``, ``board``
and ``models`` are ready:

- the scope fingerprint reads ``projections/semantic-index.json`` through the
  a0 view (C3b, :mod:`app.release_studio.bundle_projections`);
- the kicad-cli board steps read ``refilled/<stem>.kicad_pcb`` (or the saved
  board when the effective configuration says ``zone_fills: "saved"``), and the
  schematic steps read ``sources/`` (C3c);
- the input closure reads ``projections/project.json``'s ``documents`` and
  ``references`` (C3d, :class:`app.release_studio.closure_references.ProjectReferences`);
- provenance records ``bundle.json``'s ``generator`` (C3f).

Unlike the Wave 3 rollout (``design_bundle.consumer.bundle_read``), bundle mode
has no per-request legacy fallback: one readiness check at the start of the
build either answers :class:`BundleDesign` or raises the typed
:class:`~app.release_studio.bundle_errors.BundlePending` /
:class:`~app.release_studio.bundle_errors.BundleFailed`.  The check queues
the ``design_bundle`` job deduplicated on its bundle key, exactly as
``bundle_read`` does.
"""

from __future__ import annotations

import functools
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from app.release_studio.closure_references import ProjectReferences
from app.release_studio.bundle_errors import BundleFailed, BundlePending

PROJECT_MEMBER = "projections/project.json"
SEMANTIC_MEMBER = "projections/semantic-index.json"
MODELS_MEMBER = "models/assembly-hlr.json"

#: The stages a bundle-mode release waits for (ADR amendment §2 item 5).
REQUIRED_STAGES = ("parse", "board", "models")

_READY_STAGE_STATES = frozenset({"complete", "partial"})
_STAGE_LABELS = {"parse": "stage parse", "board": "stage board", "models": "stage models"}


@dataclass
class BundleDesign:
    """A ready revision bundle, as Release Studio's build reads it."""

    project_id: str
    commit: str
    opened: Any

    @property
    def archive_path(self) -> Path:
        archive = self.opened.archive
        if archive is None:  # readiness refuses this; keep the error explicit
            raise BundlePending("the design bundle is not stored yet")
        return archive.path

    @property
    def manifest(self) -> Mapping[str, Any]:
        archive = self.opened.archive
        if archive is None:
            raise BundlePending("the design bundle is not stored yet")
        return archive.manifest

    @property
    def generator(self) -> Mapping[str, Any]:
        """``bundle.json``'s generator record: the build's tool identity (C3f)."""

        return dict(self.manifest.get("generator") or {})

    @property
    def config(self) -> Mapping[str, Any]:
        return dict(self.manifest.get("config") or {})

    @property
    def fill_provenance(self) -> str:
        """``refilled`` or ``saved``, from the board stage's record."""

        board = (self.manifest.get("stages") or {}).get("board") or {}
        return str(board.get("fill_provenance") or "")

    @functools.cached_property
    def project(self) -> Mapping[str, Any]:
        """``projections/project.json`` (``prism.project.a0``)."""

        return self.opened.read_json(PROJECT_MEMBER)

    def bundle_relative(self, repository_path: str, project_relpath: str) -> str:
        """A repository path as the bundle's ``sources/`` names it.

        Release Studio's configuration names files repository-relative because
        its closure is the whole repository. A bundle anchored at the project
        folder stores its sources relative to that anchor; one keyed at the
        repository root (a Type-2 subproject without an anchor) stores the
        repository path itself. Whichever form the manifest holds wins; with no
        manifest to ask, the anchor-relative form is the answer.
        """

        value = str(repository_path or "").replace("\\", "/").strip("/")
        anchor = str(project_relpath or "").replace("\\", "/").strip("/")
        stripped = value
        if anchor and anchor not in ("", "."):
            prefix = f"{anchor}/"
            if value == anchor:
                stripped = ""
            elif value.startswith(prefix):
                stripped = value[len(prefix) :]
        members = self._member_paths()
        if members is not None and stripped != value:
            if f"sources/{stripped}" not in members and f"sources/{value}" in members:
                return value
        return stripped

    def _member_paths(self) -> frozenset[str] | None:
        archive = getattr(self.opened, "archive", None) if self.opened is not None else None
        if archive is None:
            return None
        return frozenset(str(member.get("path") or "") for member in archive.manifest.get("members") or ())

    def board_member(self, board: str, project_relpath: str = "") -> str:
        """The member the board steps read: ``refilled/`` or the saved board."""

        bundle_relative = self.bundle_relative(board, project_relpath)
        if not bundle_relative:
            bundle_relative = str(self.config.get("board") or "")
        if not bundle_relative:
            raise BundleFailed("the design bundle names no board")
        if self.fill_provenance == "saved":
            return f"sources/{bundle_relative}"
        return f"refilled/{bundle_relative.rsplit('/', 1)[-1]}"

    def board_path(self, board: str, project_relpath: str = "") -> Path:
        member = self.board_member(board, project_relpath)
        return self.opened.extract([member]) / member

    def schematic_member(self, schematic: str, project_relpath: str = "") -> str:
        bundle_relative = self.bundle_relative(schematic, project_relpath)
        if not bundle_relative:
            bundle_relative = str(self.config.get("root_schematic") or "")
        if not bundle_relative:
            raise BundleFailed("the design bundle names no schematic")
        return f"sources/{bundle_relative}"

    def schematic_path(self, schematic: str, project_relpath: str = "") -> Path:
        """The schematic inside the whole extracted ``sources/`` tree.

        ERC, BOM and the schematic PDF open the hierarchy, so the sibling
        sheets, the project file and the local libraries have to be beside the
        root schematic; extracting only the root would make every sub-sheet
        reference unresolvable.
        """

        member = self.schematic_member(schematic, project_relpath)
        return self.sources_dir() / member[len("sources/") :]

    def sources_dir(self) -> Path:
        return self.opened.extract(["sources/"]) / "sources"

    def project_references(self) -> ProjectReferences:
        """The closure's documents and path references (C3d)."""

        return _project_references(self.project)

    def required_members(self) -> tuple[str, ...]:
        """Every member this build reads, checked once before it starts."""

        members: set[str] = {PROJECT_MEMBER, SEMANTIC_MEMBER, MODELS_MEMBER}
        config = self.config
        board = str(config.get("board") or "")
        if not board:
            raise BundleFailed("the design bundle names no board")
        members.add(self.board_member(board))
        project_file = str(config.get("project_file") or "")
        if project_file:
            members.add(f"sources/{project_file}")
        root_schematic = str(config.get("root_schematic") or "")
        if root_schematic:
            members.add(f"sources/{root_schematic}")
        for document in self.project.get("documents") or []:
            path = str(document.get("path") or "")
            if path:
                members.add(f"sources/{path}")
        return tuple(sorted(members))


def _project_references(document: Mapping[str, Any]) -> ProjectReferences:
    """``prism.project.a0``'s closure answer: documents and every path node."""

    documents = tuple(
        str(document["path"])
        for document in document.get("documents") or []
        if document.get("path")
    )
    return ProjectReferences(
        documents=documents,
        references=tuple(document.get("references") or []),
    )


def project_references_for(
    project_id: str,
    commit: str | None,
    *,
    requested_by: str = "",
) -> ProjectReferences:
    """The closure's project references for one revision, without the rest of a build.

    System Builder's board STEP export needs only ``projections/project.json``:
    it names the design's documents and every path-bearing node, so the closure
    never parses the checkout (WP-R2). A pending member queues the
    ``design_bundle`` job and raises :class:`BundlePending`; a failed stage or
    member, an absent project or a missing commit raises :class:`BundleFailed`.
    """

    if not project_id:
        raise BundleFailed("the board step names no project")
    if not commit:
        raise BundleFailed(
            "the board step needs a resolved commit: a design bundle is keyed by "
            "the revision's commit, and a working tree has none"
        )

    from app.services.design_bundle import reader

    try:
        opened = reader.open_revision(
            project_id, commit, queue=True, requested_by=requested_by
        )
    except Exception as error:  # noqa: BLE001 - any open fault is a failed answer
        raise BundleFailed(
            f"the design bundle of {project_id}@{commit} could not be opened: {error}"
        ) from error

    if opened.absent:
        raise BundleFailed(
            f"the project is not present at revision {commit}; no design bundle can exist"
        )
    if opened.archive is None:
        if opened.failure:
            raise BundleFailed(opened.failure)
        raise BundlePending(
            "the design bundle is not built yet; its job has been queued"
        )

    state = opened.readiness([PROJECT_MEMBER])[PROJECT_MEMBER]
    if state.state in ("pending", "unavailable"):
        raise BundlePending(f"the design bundle is not ready: {PROJECT_MEMBER}")
    if state.state == "failed":
        raise BundleFailed(
            f"the design bundle has no usable member: "
            f"{PROJECT_MEMBER}: {state.detail or 'failed'}"
        )
    if state.state in ("skipped", "not-applicable"):
        raise BundleFailed(
            f"the design bundle does not carry a member this board step needs: {PROJECT_MEMBER}"
        )
    return _project_references(opened.read_json(PROJECT_MEMBER))


def _stage_error(stage: str, record: Mapping[str, Any]) -> str:
    error = record.get("error") or {}
    detail = str(error.get("message") or "").strip()
    code = str(error.get("code") or "").strip()
    if code and detail:
        return f"{code}: {detail}"
    return detail or code or "no detail recorded"


def _check_stages(manifest: Mapping[str, Any]) -> None:
    stages = manifest.get("stages") or {}
    for stage in REQUIRED_STAGES:
        record = stages.get(stage) or {}
        status = str(record.get("status") or "pending")
        label = _STAGE_LABELS[stage]
        if status == "failed":
            raise BundleFailed(
                f"the design bundle's {label} failed: {_stage_error(stage, record)}"
            )
        if status == "skipped":
            reason = str(record.get("skip_reason") or "no reason recorded")
            raise BundleFailed(
                f"the design bundle's {label} was skipped: {reason}"
            )
        if status not in _READY_STAGE_STATES:
            raise BundlePending(
                f"the design bundle's {label} is not ready yet ({status})"
            )


def _check_members(opened: Any, paths: tuple[str, ...]) -> None:
    states = opened.readiness(paths)
    waiting = [
        path
        for path in paths
        if states[path].state in ("pending", "unavailable")
    ]
    if waiting:
        raise BundlePending(
            "the design bundle is not ready: "
            + ", ".join(waiting)
        )
    failed = [path for path in paths if states[path].state == "failed"]
    if failed:
        details = "; ".join(
            f"{path}: {states[path].detail or 'failed'}" for path in failed
        )
        raise BundleFailed(f"the design bundle has no usable member: {details}")
    missing = [
        path
        for path in paths
        if states[path].state in ("skipped", "not-applicable")
    ]
    if missing:
        raise BundleFailed(
            "the design bundle does not carry a member this release needs: "
            + ", ".join(missing)
        )


def readiness(
    project_id: str,
    commit: str | None,
    *,
    requested_by: str = "",
) -> BundleDesign:
    """The ready bundle for a build, or a typed pending/failed answer.

    A missing or pending bundle queues the ``design_bundle`` job (deduplicated
    on the bundle key) and raises :class:`BundlePending`; a failed stage or
    member raises :class:`BundleFailed`.  A build with no resolved commit (a
    working tree) cannot be keyed by a bundle at all, so it is a clear
    :class:`BundleFailed` rather than a legacy read.
    """

    if not project_id:
        raise BundleFailed("a release build names no project")
    if not commit:
        raise BundleFailed(
            "a release build needs a resolved commit: a design bundle is keyed "
            "by the revision's commit, and a working tree has none"
        )

    from app.services.design_bundle import reader

    try:
        opened = reader.open_revision(
            project_id, commit, queue=True, requested_by=requested_by
        )
    except Exception as error:  # noqa: BLE001 - any open fault is a failed answer
        raise BundleFailed(
            f"the design bundle of {project_id}@{commit} could not be opened: {error}"
        ) from error

    if opened.absent:
        raise BundleFailed(
            f"the project is not present at revision {commit}; no design bundle can exist"
        )
    if opened.archive is None:
        if opened.failure:
            raise BundleFailed(opened.failure)
        raise BundlePending(
            "the design bundle is not built yet; its job has been queued"
        )

    design = BundleDesign(project_id=project_id, commit=commit, opened=opened)
    try:
        _check_stages(opened.archive.manifest)
        _check_members(opened, design.required_members())
    except BundlePending:
        # A stage left pending by a build that ended, with no retry under
        # way, will not finish: the archive is what a failed build left.
        if opened.failure:
            raise BundleFailed(opened.failure) from None
        raise
    return design


def for_candidate(candidate: Mapping[str, Any]) -> BundleDesign:
    """The build's one readiness answer, computed in ``prepare_candidate``.

    ``execute_build`` calls this too, so a direct caller that skipped
    preparation gets the same check rather than a partially-read bundle.  The
    stored object is reused when preparation already resolved it.
    """

    existing = candidate.get("_bundle_design")
    if existing is not None:
        return existing
    return readiness(
        str(candidate.get("project_id") or ""),
        str(candidate.get("commit_sha") or "") or None,
        requested_by=str(candidate.get("created_by") or ""),
    )


__all__ = [
    "BundleDesign",
    "MODELS_MEMBER",
    "PROJECT_MEMBER",
    "REQUIRED_STAGES",
    "SEMANTIC_MEMBER",
    "for_candidate",
    "project_references_for",
    "readiness",
]
