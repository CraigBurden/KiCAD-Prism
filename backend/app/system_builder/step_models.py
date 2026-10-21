"""The STEP models a system assembly reads (docs/system-builder/CONTRACTS.md §18).

A board occurrence's model is the board export stored by ``step_store``; a body
occurrence, a body connector and a harness end's housing use their catalog
part's first STEP asset, with the part's model alignment
(:func:`app.services.catalog.models.alignment_matrix`) mapping the asset into
the part's frame. The manifest for ``prism-kicad system step --models`` names
each staged file relative to itself and carries the board thickness and every
part's 16-number column-major alignment.

Catalog resolution is a module-level seam (``catalog_step``) so a job test can
answer without a catalog; the production path reuses
:func:`app.system_builder.parts.catalog_lookup` for the revision rule and
:mod:`app.services.catalog.models` for the first STEP asset and its alignment.
"""

from __future__ import annotations

import json
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Iterable, Mapping, Sequence

from app.services.catalog import models
from app.services.design_bundle.archive import BundleInvalid, open_archive
from app.system_builder import members as member_view
from app.system_builder.parts import catalog_lookup

STACKUP_MEMBER = "projections/stackup.json"


@dataclass(frozen=True)
class StepModel:
    """One catalog part's STEP asset and its alignment into the part's frame."""

    path: Path
    alignment: tuple[float, ...]


# --------------------------------------------------------------- reference


def _reference(component_id: str, revision_id: str | None) -> str:
    return component_id if not revision_id else f"{component_id}@{revision_id}"


def _part_ref(value: Mapping[str, Any] | None) -> tuple[str, str | None] | None:
    source = value or {}
    component_id = str(source.get("componentId") or "")
    if not component_id:
        return None
    revision_id = str(source.get("revisionId") or "") or None
    return component_id, revision_id


def references(document: Mapping[str, Any]) -> list[tuple[str, str, str | None]]:
    """The parts §18 places: body sources, body connectors and end housings.

    Each is ``(ref, componentId, revisionId)`` with the reference exactly as the
    document spells it; sorted by ``ref`` and deduplicated. Contacts, cables and
    coverings are harness *wiring*, not placed bodies, so they are not here.
    """

    found: dict[str, tuple[str, str | None]] = {}
    for occurrence in document.get("occurrences") or []:
        source = occurrence.get("source") or {}
        if source.get("kind") != "body":
            continue
        part = _part_ref(source)
        if part is not None:
            found.setdefault(_reference(*part), part)
    for connector in document.get("bodyConnectors") or []:
        part = _part_ref(connector.get("part"))
        if part is not None:
            found.setdefault(_reference(*part), part)
    for harness in document.get("harnesses") or []:
        for end in harness.get("ends") or []:
            part = _part_ref(end.get("housing"))
            if part is not None:
                found.setdefault(_reference(*part), part)
    return [(ref, *found[ref]) for ref in sorted(found)]


# ----------------------------------------------------------------- catalog


def catalog_step(component_id: str, revision_id: str | None) -> StepModel | None:
    """A catalog part's first STEP asset and its alignment, or ``None``.

    ``catalog_lookup`` applies the document's revision rule (the named revision,
    else the newest released one). The alignment is the part's matrix for that
    asset, identity when none was configured.
    """

    part = catalog_lookup(component_id, revision_id)
    if part is None:
        return None
    from app.system_builder.publishing import CatalogGateway

    with CatalogGateway().connection() as conn:
        assets = models.step_assets(conn, part.component_id, part.revision_id)
        if not assets:
            return None
        asset = assets[0]
        path = Path(str(asset.get("canonical_path") or ""))
        if not path.is_file():
            return None
        alignment = models.alignments(conn, part.component_id).get(str(asset["id"]))
    return StepModel(
        path=path,
        alignment=tuple(models.alignment_matrix(alignment or models.IDENTITY)),
    )


@dataclass(frozen=True)
class BoardTarget:
    """A board whose model the assembly places: one of the system's own, or one
    inside a placed entry (manifest key ``<entry>/<child>``, §18)."""

    key: str
    project_id: str
    commit: str
    label: str
    thickness_nm: int


def _payload(member: Any) -> dict[str, Any] | None:
    path = getattr(member, "entry_payload", None)
    if path is None:
        return None
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return value if isinstance(value, dict) else None


def _placed_thickness(payload: Mapping[str, Any], occurrence: str) -> int:
    for item in ((payload.get("bundle") or {}).get("placement") or {}).get("occurrences") or []:
        if item.get("occurrence") == occurrence:
            bounds = item.get("bounds") or {}
            try:
                return int(bounds["max"]["zNm"]) - int(bounds["min"]["zNm"])
            except (KeyError, TypeError, ValueError):
                return 0
    return 0


def board_targets(members: Sequence[Any], labels: Mapping[str, str]) -> list[BoardTarget]:
    """Every board model the assembly needs, the system's own first."""

    targets: list[BoardTarget] = []
    for member in members:
        if getattr(member, "state", None) != member_view.READY:
            continue
        if not getattr(member, "is_entry", False):
            targets.append(BoardTarget(
                member.occurrence, str(member.project_id), str(member.commit),
                labels.get(member.occurrence, member.occurrence), board_thickness_nm(member),
            ))
            continue
        payload = _payload(member)
        if payload is None:
            continue
        for child in (payload.get("document") or {}).get("occurrences") or []:
            source = child.get("source") or {}
            commit = (source.get("track") or {}).get("commit")
            if source.get("kind") != "board" or not source.get("projectId") or not commit:
                continue
            targets.append(BoardTarget(
                f"{member.occurrence}/{child['id']}", str(source["projectId"]), str(commit),
                f"{labels.get(member.occurrence, member.occurrence)} · {child.get('label') or child['id']}",
                _placed_thickness(payload, str(child["id"])),
            ))
    return targets


def entry_references(members: Sequence[Any]) -> list[tuple[str, str, str | None]]:
    """The parts inside placed entries: their bodies and body connectors."""

    found: dict[str, tuple[str, str | None]] = {}
    for member in members:
        if not getattr(member, "is_entry", False) or getattr(member, "state", None) != member_view.READY:
            continue
        payload = _payload(member)
        if payload is None:
            continue
        for ref, component_id, revision_id in references(payload.get("document") or {}):
            found.setdefault(ref, (component_id, revision_id))
    return [(ref, *found[ref]) for ref in sorted(found)]


def models_for(
    document: Mapping[str, Any],
    *,
    lookup: Callable[[str, str | None], StepModel | None] | None = None,
    members: Sequence[Any] = (),
) -> dict[str, StepModel]:
    """Every placed part's STEP model, keyed by the reference the document spells
    (an entry's parts by the reference its frozen document spells)."""

    resolve = lookup or catalog_step
    found: dict[str, StepModel] = {}
    for ref, component_id, revision_id in [*references(document), *entry_references(members)]:
        model = resolve(component_id, revision_id)
        if model is not None:
            found[ref] = model
    return found


# ------------------------------------------------------------------ staging


def stage_parts(staging_dir: Path, parts: Mapping[str, StepModel]) -> dict[str, dict[str, Any]]:
    """Copy each part's STEP beside the manifest; return the manifest's ``parts``."""

    entries: dict[str, dict[str, Any]] = {}
    for index, ref in enumerate(sorted(parts)):
        model = parts[ref]
        relative = Path("models") / "parts" / f"{index}.step"
        _copy(model.path, Path(staging_dir) / relative)
        entries[ref] = {
            "step": relative.as_posix(),
            "alignment": [float(value) for value in model.alignment],
        }
    return entries


def stage_boards(
    staging_dir: Path, boards: Mapping[str, tuple[Path, int]]
) -> dict[str, dict[str, Any]]:
    """Copy each board's STEP beside the manifest; return the manifest's ``boards``."""

    entries: dict[str, dict[str, Any]] = {}
    for index, occurrence in enumerate(sorted(boards)):
        source, thickness_nm = boards[occurrence]
        relative = Path("models") / "boards" / f"{index}.step"
        _copy(source, Path(staging_dir) / relative)
        entries[occurrence] = {
            "step": relative.as_posix(),
            "thicknessNm": int(thickness_nm),
        }
    return entries


def write_manifest(staging_dir: Path, manifest: Mapping[str, Any]) -> Path:
    """Write the ``--models`` manifest; paths in it are relative to the file."""

    target = Path(staging_dir) / "models.json"
    data = (
        json.dumps(dict(manifest), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode(
            "utf-8"
        )
        + b"\n"
    )
    target.write_bytes(data)
    return target


# --------------------------------------------------------------- thickness


def board_thickness_nm(member: Any) -> int:
    """The board's stack thickness from its design bundle, in nanometres.

    A bundle that is unreadable or has no stackup is a zero-thickness board:
    the assembly still places its model, just without the half-thickness lift.
    """

    archive_path = getattr(member, "archive", None)
    if archive_path is None:
        return 0
    try:
        archive = open_archive(Path(archive_path))
        value = json.loads(archive.read(STACKUP_MEMBER, structured=False).decode("utf-8"))
    except (BundleInvalid, OSError, ValueError):
        return 0
    thickness = value.get("boardThicknessNm") if isinstance(value, dict) else None
    return int(thickness) if isinstance(thickness, int) and not isinstance(thickness, bool) else 0


def _copy(source: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)


def copy_boards(
    staging_dir: Path, boards: Iterable[tuple[str, Path, int]]
) -> dict[str, tuple[Path, int]]:
    """The mapping :func:`stage_boards` takes, from ``(occurrence, path, nm)``."""

    return {occurrence: (path, thickness) for occurrence, path, thickness in boards}


__all__ = [
    "STACKUP_MEMBER",
    "StepModel",
    "board_thickness_nm",
    "catalog_step",
    "copy_boards",
    "models_for",
    "references",
    "stage_boards",
    "stage_parts",
    "write_manifest",
]
