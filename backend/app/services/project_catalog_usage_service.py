"""Library usage of a project commit: which catalog revision it placed (issue #698).

The one entry point for the scan job and the API. It reads a commit's
schematics from Git (``project_revision``), so a scan describes exactly that
commit and never the working tree, resolves their symbols through
``catalog/project_placements.py`` and owns the catalog transaction around it.

A scan is queued after every successful project sync (best effort) and on
request; it runs on the catalog worker (``project_catalog_usage`` in
``catalog_worker_tasks``).
"""

from __future__ import annotations

import hashlib
import logging
from pathlib import Path
import tempfile
from typing import Any

from app.services import project_revision
from app.services.catalog.placement_stamp import PlacedSymbol, placed_symbols
from app.services.catalog.project_placements import CatalogProjectPlacements

logger = logging.getLogger(__name__)

JOB_TYPE = "project_catalog_usage"

#: The schematics of one commit, generated files (autosaves, backups) left out.
SCHEMATICS = project_revision.SourceSet("schematics", suffixes=frozenset({".kicad_sch"}), skip_generated=True)


def _catalog():
    from app.services.component_catalog_service import catalog_service

    catalog_service.initialize()
    return catalog_service


def read_commit_symbols(location: project_revision.ProjectLocation, commit: str) -> list[PlacedSymbol]:
    """Every symbol instance in the project's schematics at ``commit``."""
    symbols: list[PlacedSymbol] = []
    with tempfile.TemporaryDirectory(prefix="project-catalog-usage-") as tmp:
        root = Path(tmp)
        project_revision.materialize(
            location, commit, root, source_set=SCHEMATICS, scope=location.relative_path, strip_scope=True
        )
        for path in sorted(root.rglob("*.kicad_sch")):
            if path.is_symlink():
                continue
            relative = path.relative_to(root).as_posix()
            symbols.extend(placed_symbols(path.read_text(encoding="utf-8", errors="ignore"), relative))
    return symbols


def scan(project_id: str, commit: str = "HEAD") -> dict[str, Any]:
    """Scan one commit (``HEAD`` of the checkout by default) and record what it placed."""
    location = project_revision.locate_id(project_id)
    resolved = project_revision.resolve_commit(location, commit or "HEAD")
    symbols = read_commit_symbols(location, resolved)
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
    ``latestScannedCommit``.
    """
    location = project_revision.locate_id(project_id)
    resolved = project_revision.resolve_commit(location, commit or "HEAD")
    service = _catalog()
    with service.connection() as conn:
        result = CatalogProjectPlacements.report(conn, project_id, resolved)
        latest = CatalogProjectPlacements.scan_row(conn, project_id)
        conn.rollback()
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


__all__ = ["JOB_TYPE", "SCHEMATICS", "project_synced", "read_commit_symbols", "report", "scan", "start_scan"]
