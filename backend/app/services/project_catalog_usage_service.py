"""Library usage of a project commit: which catalog revision it placed (issue #698).

The one entry point for the scan job and the API. A ready
``projections/occurrences.json`` member (``prism.occurrences.a0``) supplies the
symbols; ``placed_symbols_from_occurrences`` maps them to the ``PlacedSymbol``
list, resolves them through ``catalog/project_placements.py`` and owns the
catalog transaction around it. The commit's schematics are never scanned in
Python (R1).

``bundle_read`` raises ``DesignDataPending`` while the member builds (it queues
the job) and ``DesignDataFailed`` when it cannot be built; the catalog job
retries the former.

A scan is queued after every successful project sync (best effort) and on
request; it runs on the catalog worker (``project_catalog_usage`` in
``catalog_worker_tasks``).
"""

from __future__ import annotations

import hashlib
import logging
from typing import Any, Mapping

from app.services import project_revision
from app.services.catalog.placement_stamp import PlacedSymbol, read_stamp
from app.services.catalog.project_placements import CatalogProjectPlacements

logger = logging.getLogger(__name__)

JOB_TYPE = "project_catalog_usage"

#: The bundle member the catalog usage scanner reads (bundle-format.md §2.1).
OCCURRENCES_MEMBER = "projections/occurrences.json"


def _catalog():
    from app.services.component_catalog_service import catalog_service

    catalog_service.initialize()
    return catalog_service


def read_commit_symbols(
    location: project_revision.ProjectLocation, commit: str, *, project_id: str = ""
) -> list[PlacedSymbol]:
    """Every symbol instance in the project's schematics at ``commit``.

    A ready ``projections/occurrences.json`` member is mapped; otherwise
    ``bundle_read`` raises the typed pending/failed answer. A working tree is
    never read: ``commit`` is a resolved commit id (``scan`` resolves first).
    """
    if not project_id:
        raise ValueError("A project id is required to read a commit's symbols")
    member = _occurrences_member(project_id, commit)
    return placed_symbols_from_occurrences(member, location.relative_path)


def _occurrences_member(project_id: str, commit: str) -> Mapping[str, Any]:
    """A ready ``projections/occurrences.json`` member.

    ``bundle_read`` raises ``DesignDataPending`` while the member builds (it
    queues the job) and ``DesignDataFailed`` when it cannot be built; a final
    non-member has no occurrences to record and is a typed failure too.
    """
    from app.services.design_bundle import consumer
    from app.services.design_bundle.errors import DesignDataFailed

    opened = consumer.bundle_read("CATALOG_IMPORT", project_id, commit, [OCCURRENCES_MEMBER])
    if not opened.ready(OCCURRENCES_MEMBER):
        raise DesignDataFailed([OCCURRENCES_MEMBER], "this revision has no occurrences")
    return opened.json(OCCURRENCES_MEMBER)


def placed_symbols_from_occurrences(member: Mapping[str, Any], project_dir: str = "") -> list[PlacedSymbol]:
    """The scan's ``PlacedSymbol`` list from a ``prism.occurrences.a0`` member.

    The field map's "Catalog usage" rule (occurrences.md): one ``PlacedSymbol``
    per distinct ``(documentPath, symbolUuid)``, ``references`` the distinct
    references of its occurrences, ``libId``/``properties`` as written, and the
    stamp from ``properties``. Today's scanner lists symbols per schematic file
    in path order and per occurrence in file order, so the groups follow
    ``documentPath`` and then first appearance. ``documentPath`` is a repository
    ``RepoPath`` and today's ``schematic`` is relative to the project directory,
    so ``project_dir`` comes off; a document outside it keeps its repository path.
    """
    grouped: dict[tuple[str, str], dict[str, Any]] = {}
    order: list[tuple[str, str]] = []
    for occurrence in member.get("symbols") or []:
        document = _project_relative(project_dir, str(occurrence.get("documentPath") or ""))
        key = (document, str(occurrence.get("symbolUuid") or ""))
        group = grouped.get(key)
        if group is None:
            group = grouped[key] = {
                "lib_id": str(occurrence.get("libId") or ""),
                "properties": occurrence.get("properties") or {},
                "references": [],
            }
            order.append(key)
        reference = str(occurrence.get("reference") or "")
        if reference:
            group["references"].append(reference)
    # ``order`` is first-appearance order; a stable sort by ``documentPath``
    # leaves a file's symbols in the order the file writes them.
    order.sort(key=lambda key: key[0])
    symbols: list[PlacedSymbol] = []
    for key in order:
        group = grouped[key]
        symbols.append(
            PlacedSymbol(
                schematic=key[0],
                symbol_uuid=key[1],
                lib_id=group["lib_id"],
                references=tuple(dict.fromkeys(group["references"])),
                properties=group["properties"],
                stamp=read_stamp(group["properties"]),
            )
        )
    return symbols


def _project_relative(project_dir: str, document_path: str) -> str:
    """The member's repository path as today's project-relative ``schematic`` spelling."""
    prefix = project_dir.strip("/")
    prefix = f"{prefix}/" if prefix else ""
    return document_path[len(prefix):] if prefix and document_path.startswith(prefix) else document_path


def scan(project_id: str, commit: str = "HEAD") -> dict[str, Any]:
    """Scan one commit (``HEAD`` of the checkout by default) and record what it placed."""
    location = project_revision.locate_id(project_id)
    resolved = project_revision.resolve_commit(location, commit or "HEAD")
    symbols = read_commit_symbols(location, resolved, project_id=project_id)
    service = _catalog()
    with service.connection() as conn:
        rows, counts = CatalogProjectPlacements.resolve(conn, symbols)
        CatalogProjectPlacements.record_scan(conn, project_id, resolved, rows, counts)
        conn.commit()
    return {"project_id": project_id, "commit": resolved, "placements": len(rows), **counts}


def report(project_id: str, commit: str = "") -> dict[str, Any]:
    """The usage report of ``commit``; by default the checkout's ``HEAD``.

    When ``HEAD`` has no scan yet (a sync just moved it), the report says so
    with ``scan: null`` and names the newest scanned commit in
    ``latestScannedCommit``. No scan and no ready occurrences member is the
    pending state: ``bundle_read`` queues the build and raises, so the screen
    shows "Preparing design data" instead of an empty report.
    """
    location = project_revision.locate_id(project_id)
    resolved = project_revision.resolve_commit(location, commit or "HEAD")
    service = _catalog()
    with service.connection() as conn:
        result = CatalogProjectPlacements.report(conn, project_id, resolved)
        latest = CatalogProjectPlacements.scan_row(conn, project_id)
        conn.rollback()
    if not result.get("scan"):
        from app.services.design_bundle import consumer

        consumer.bundle_read("CATALOG_IMPORT", project_id, resolved, [OCCURRENCES_MEMBER])
    result["latestScannedCommit"] = str(latest["source_revision"]) if latest else ""
    return result


def start_scan(project_id: str, commit: str = "", *, requested_by: str = "", force: bool = False) -> dict[str, Any]:
    """Queue a scan of ``commit``.

    Without ``force`` a commit is scanned once: a request joins the queued job
    or reuses the finished one. ``force`` scans again, as after catalog changes
    that inference depends on.
    """
    from app.services.catalog_worker_tasks import CATALOG_JOB_KINDS
    from app.services.job_kinds import JobSubject

    location = project_revision.locate_id(project_id)
    resolved = project_revision.resolve_commit(location, commit or "HEAD")
    key = "" if force else hashlib.sha256(f"{JOB_TYPE}:{project_id}:{resolved}".encode("utf-8")).hexdigest()
    # The project is the job's subject, so whoever may see the project may watch the scan.
    return CATALOG_JOB_KINDS[JOB_TYPE].enqueue(
        {"project_id": project_id, "commit": resolved},
        subject=JobSubject(project_id=project_id),
        artifact_key=key,
        requested_by=requested_by,
    )


def project_synced(project_id: str) -> None:
    """After a successful sync: scan the new ``HEAD``. Best effort; a failure never fails the sync."""
    try:
        start_scan(project_id, requested_by="project-sync")
    except Exception:  # noqa: BLE001 - the next sync or a manual scan catches up
        logger.exception("Could not queue the library usage scan for %s", project_id)


__all__ = [
    "JOB_TYPE",
    "OCCURRENCES_MEMBER",
    "placed_symbols_from_occurrences",
    "project_synced",
    "read_commit_symbols",
    "report",
    "scan",
    "start_scan",
]
