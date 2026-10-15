"""Superseded draft STEP files: quarantine, grace period, restore, final delete.

Artifact maintenance never deletes a superseded never-released draft STEP at
once. It moves the file to ``<store>/quarantine/<entry id>/<name>`` and records
the move in the append-only purge ledger (``catalog_asset_file_purges``). Once
the grace period (``CATALOG_DRAFT_MODEL_QUARANTINE_DAYS``) has passed, a later
run deletes the quarantined copy and records that too. Until then an operator
can restore the file (``scripts/check_catalog_asset_files.py --restore``).

Each ledger row carries an ``event``:

- ``purged``: the file was deleted with no quarantine (rows written before the
  quarantine existed, and ``--record-legacy`` rows for files lost before the
  ledger existed);
- ``quarantined``: the file was moved to ``quarantine_path``;
- ``quarantine_failed``: the move after a ``quarantined`` row failed, so the
  file never left;
- ``restored``: the quarantined file is back at its canonical path;
- ``deleted``: the quarantined copy was deleted after the grace period.

``quarantine_failed``, ``restored`` and ``deleted`` name the ``quarantined``
row they close in ``quarantine_id``. The latest of ``purged``, ``quarantined``,
``quarantine_failed`` and ``restored`` for an asset's bytes is its state: a
``purged`` or ``quarantined`` state accounts for a missing file while it is
newer than every link to the asset, and a ``restored`` state keeps the purge
away from the file until the asset is linked again.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any, Iterable
import uuid

from app.core.errors import NotFound
from app.services.catalog.asset_files import (
    DATABASE_NOW_ISO_SQL,
    PROTECTED_REVISION_SQL,
    STEP_SUFFIXES,
    asset_bytes_lock_key,
)
from app.services.catalog.conflicts import CatalogConflict
from app.services.catalog.normalization import sha256_file
from app.services.catalog.runtime import CatalogRuntime


logger = logging.getLogger(__name__)

QUARANTINE_DIRNAME = "quarantine"

EVENT_PURGED = "purged"
EVENT_QUARANTINED = "quarantined"
EVENT_QUARANTINE_FAILED = "quarantine_failed"
EVENT_RESTORED = "restored"
EVENT_DELETED = "deleted"

STATE_EVENTS = (EVENT_PURGED, EVENT_QUARANTINED, EVENT_QUARANTINE_FAILED, EVENT_RESTORED)
EXCUSING_EVENTS = (EVENT_PURGED, EVENT_QUARANTINED)

REASON_SUPERSEDED = "superseded_draft_step"
REASON_LEGACY = "legacy_pre_ledger"


# The latest state row for an asset's bytes (alias ``asset``), as ``latest``.
_LATEST_STATE_SQL = f"""
    SELECT purge.id, purge.event, purge.purged_at
    FROM catalog_asset_file_purges purge
    WHERE purge.asset_id = asset.id AND purge.sha256 = asset.sha256
      AND purge.event IN ({", ".join(f"'{event}'" for event in STATE_EVENTS)})
    ORDER BY purge.purged_at::timestamptz DESC
    LIMIT 1
"""

_NEWER_THAN_EVERY_LINK_SQL = """
    latest.purged_at::timestamptz > (
        SELECT max(link.created_at::timestamptz)
        FROM revision_assets link
        WHERE link.asset_id = asset.id
    )
"""

_UNPROTECTED_SQL = f"""
    NOT EXISTS (
        SELECT 1
        FROM revision_assets link
        JOIN component_revisions revision ON revision.id = link.revision_id
        JOIN components component ON component.id = revision.component_id
        WHERE link.asset_id = asset.id AND ({PROTECTED_REVISION_SQL})
    )
"""

_ENTRY_IS_OPEN_SQL = """
    NOT EXISTS (
        SELECT 1 FROM catalog_asset_file_purges follow_up WHERE follow_up.quarantine_id = entry.id
    )
"""


def quarantine_root(runtime: CatalogRuntime) -> Path:
    return runtime.store_root / QUARANTINE_DIRNAME


def excusing_event(conn: Any, asset_id: str) -> str:
    """``purged`` or ``quarantined`` when the ledger accounts for this asset's missing file, else ``""``.

    A quarantined file whose copy the grace period has since deleted is ``purged``.

    The asset must still be purge-eligible (no revision linking it is
    protected), and its latest state row must be excusing and newer than every
    link to it: a link made after the purge, such as re-uploading the same
    bytes, voids the old row until a new purge records the file again.
    """
    row = conn.execute(
        f"""
        SELECT CASE WHEN latest.event = '{EVENT_QUARANTINED}' AND EXISTS (
                   SELECT 1 FROM catalog_asset_file_purges closed
                   WHERE closed.quarantine_id = latest.id AND closed.event = '{EVENT_DELETED}'
               ) THEN '{EVENT_PURGED}' ELSE latest.event END AS event
        FROM assets asset
        CROSS JOIN LATERAL ({_LATEST_STATE_SQL}) latest
        WHERE asset.id = %s
          AND latest.event IN ('{EVENT_PURGED}', '{EVENT_QUARANTINED}')
          AND {_UNPROTECTED_SQL}
          AND {_NEWER_THAN_EVERY_LINK_SQL}
        """,
        (asset_id,),
    ).fetchone()
    return str(row["event"]) if row else ""


def purge_excuses_missing_file(conn: Any, asset_id: str) -> bool:
    """Whether a purge-ledger row still accounts for this asset's missing file."""
    return bool(excusing_event(conn, asset_id))


def raise_if_asset_purged(conn: Any, asset_id: str) -> None:
    """Refuse a read of an asset whose file artifact maintenance removed on purpose."""
    event = excusing_event(conn, asset_id)
    if event == EVENT_QUARANTINED:
        raise NotFound(
            "The asset's file is in artifact-maintenance quarantine; an operator can restore it",
            code="asset_quarantined",
        )
    if event:
        raise NotFound("The asset's file was purged by artifact maintenance", code="asset_purged")


def _insert_event(
    conn: Any,
    *,
    asset_id: str,
    sha256: str,
    canonical_path: str,
    event: str,
    reason: str,
    job_id: str,
    quarantine_path: str = "",
    quarantine_id: str = "",
) -> str:
    entry_id = str(uuid.uuid4())
    conn.execute(
        f"""
        INSERT INTO catalog_asset_file_purges
            (id, asset_id, sha256, canonical_path, reason, job_id, purged_at, event, quarantine_path, quarantine_id)
        VALUES (%s, %s, %s, %s, %s, %s, {DATABASE_NOW_ISO_SQL}, %s, %s, %s)
        """,
        (entry_id, asset_id, sha256, canonical_path, reason, job_id, event, quarantine_path, quarantine_id),
    )
    return entry_id


def _protected_or_pinned(conn: Any, asset_id: str, pinned_revision_ids: list[str]) -> bool:
    row = conn.execute(
        f"""
        SELECT 1
        FROM revision_assets link
        JOIN component_revisions revision ON revision.id = link.revision_id
        JOIN components component ON component.id = revision.component_id
        WHERE link.asset_id = %s AND (({PROTECTED_REVISION_SQL}) OR revision.id = ANY(%s::text[]))
        LIMIT 1
        """,
        (asset_id, pinned_revision_ids),
    ).fetchone()
    return row is not None


def _remove_entry_directory(path: Path, root: Path) -> None:
    """Remove the per-entry directory once it is empty; never anything outside ``root``."""
    directory = path.parent
    if directory.parent != root:
        return
    try:
        directory.rmdir()
    except OSError:
        pass


def _move_back(source: Path, destination: Path) -> None:
    """Put a quarantined file back without replacing any existing directory entry."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    os.link(source, destination)
    source.unlink()


class StepQuarantine:
    """Stateless quarantine operations; callers pass ``conn`` and the runtime.

    Every method commits ``conn``: each file move is bracketed by its own
    ledger commit, so a crash never leaves a moved file without its row.
    """

    @staticmethod
    def _quarantine_locked(
        conn: Any, runtime: CatalogRuntime, row: Any, path: Path, *, job_id: str, pinned: list[str]
    ) -> bool:
        """Under the asset's lock: re-check eligibility (``pinned`` revisions protect too), commit the
        ledger row, then move the file."""
        if _protected_or_pinned(conn, str(row["id"]), pinned):
            return False
        entry_dir = quarantine_root(runtime) / str(uuid.uuid4())
        destination = entry_dir / path.name
        entry_id = _insert_event(
            conn, asset_id=str(row["id"]), sha256=str(row["sha256"]), canonical_path=str(row["canonical_path"]),
            event=EVENT_QUARANTINED, reason=REASON_SUPERSEDED, job_id=job_id, quarantine_path=str(destination),
        )
        conn.commit()
        try:
            entry_dir.mkdir(parents=True, exist_ok=False)
            path.rename(destination)
        except FileNotFoundError:
            # Gone already; the committed row accounts for it.
            return True
        except OSError:
            logger.warning(
                "Could not quarantine superseded STEP file %s; the next maintenance run retries", path, exc_info=True
            )
            conn.rollback()
            _insert_event(
                conn, asset_id=str(row["id"]), sha256=str(row["sha256"]), canonical_path=str(row["canonical_path"]),
                event=EVENT_QUARANTINE_FAILED, reason=REASON_SUPERSEDED, job_id=job_id, quarantine_id=entry_id,
            )
            conn.commit()
            _remove_entry_directory(destination, quarantine_root(runtime))
            return False
        return True

    @staticmethod
    def purge_superseded_step_files(
        conn: Any, runtime: CatalogRuntime, *, job_id: str = "", pinned_revision_ids: Iterable[str] = ()
    ) -> dict[str, Any]:
        """Quarantine obsolete draft STEP bytes while preserving immutable revision evidence.

        The asset row, hash, revision link, and audit history remain intact. A file
        is moved out only when a newer current revision for that component has a
        different 3D model and no revision linking the asset, in any component, is
        protected. A revision is protected while it is its component's current or
        released revision, or once it has ever been released, so released STEP
        evidence is never touched. A revision in ``pinned_revision_ids`` (one a
        System Builder instance, harness end or module connector placement pins)
        is protected too, in the candidate query and in the re-check under the
        lock. A file an operator restored stays until its asset is linked again.

        Each file's ``quarantined`` row is committed before the file moves, one
        file at a time, so a crash never leaves a moved file without its row. A
        failed move is recorded as ``quarantine_failed``, which voids the row,
        and the next run tries again. This commits ``conn``.

        Each candidate moves only under its ``asset_bytes_lock_key`` lock, after
        re-checking under it that no protected revision links the asset. The
        purge only tries the lock: an asset being linked right now is skipped
        until the next run, so the purge never waits and cannot deadlock with a
        linker. It is a session lock, held across the ledger commit until the
        file has moved, so a linker of that asset waits for the move and then
        refuses the missing file.
        """
        pinned = sorted({str(value) for value in pinned_revision_ids})
        rows = conn.execute(
            f"""
            WITH current_models AS (
                SELECT revision.component_id, link.asset_id
                FROM components component
                JOIN component_revisions revision ON revision.id = component.current_revision_id
                JOIN revision_assets link ON link.revision_id = revision.id
                WHERE link.asset_type = '3dmodel'
            ), superseded_models AS (
                SELECT DISTINCT revision.component_id, link.asset_id
                FROM component_revisions revision
                JOIN components component ON component.id = revision.component_id
                JOIN revision_assets link ON link.revision_id = revision.id
                JOIN current_models replacement
                  ON replacement.component_id = revision.component_id
                 AND replacement.asset_id <> link.asset_id
                WHERE revision.id <> component.current_revision_id
                  AND link.asset_type = '3dmodel'
            ), protected_models AS (
                SELECT DISTINCT link.asset_id
                FROM revision_assets link
                JOIN component_revisions revision ON revision.id = link.revision_id
                JOIN components component ON component.id = revision.component_id
                WHERE ({PROTECTED_REVISION_SQL}) OR revision.id = ANY(%s::text[])
            )
            SELECT DISTINCT asset.id, asset.canonical_path, asset.sha256
            FROM superseded_models superseded
            JOIN assets asset ON asset.id = superseded.asset_id
            LEFT JOIN protected_models protected ON protected.asset_id = superseded.asset_id
            WHERE protected.asset_id IS NULL
              AND (
                lower(asset.canonical_path) LIKE %s
                OR lower(asset.canonical_path) LIKE %s
              )
              AND NOT EXISTS (
                SELECT 1 FROM ({_LATEST_STATE_SQL}) latest
                WHERE latest.event = '{EVENT_RESTORED}' AND {_NEWER_THAN_EVERY_LINK_SQL}
              )
            """,
            (pinned, "%.step", "%.stp"),
        ).fetchall()
        # Commit the read, and with it the connection's search_path, before any per-file rollback.
        conn.commit()
        quarantined: list[str] = []
        for row in rows:
            path = Path(str(row["canonical_path"] or "")).resolve()
            try:
                path.relative_to(runtime.store_root)
            except ValueError:
                continue
            if path.suffix.lower() not in STEP_SUFFIXES:
                continue
            if not path.is_file():
                continue
            lock_key = asset_bytes_lock_key(str(row["sha256"]))
            locked = conn.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (lock_key,)).fetchone()
            if not locked["locked"]:
                continue
            try:
                if StepQuarantine._quarantine_locked(conn, runtime, row, path, job_id=job_id, pinned=pinned):
                    quarantined.append(str(row["id"]))
            finally:
                # Ends a skipped re-check or a failed statement; a moved file's row is already committed.
                conn.rollback()
                conn.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_key,))
                conn.commit()
        return {"quarantined": len(quarantined), "asset_ids": quarantined}

    @staticmethod
    def list_open_entries(conn: Any, *, grace_days: int, asset_id: str = "") -> list[dict[str, Any]]:
        """Quarantined files not yet restored or deleted, oldest first, with when each expires."""
        rows = conn.execute(
            f"""
            SELECT entry.id, entry.asset_id, entry.sha256, entry.canonical_path, entry.quarantine_path,
                   entry.job_id, entry.purged_at,
                   to_char(
                       (entry.purged_at::timestamptz + make_interval(days => %s)) AT TIME ZONE 'UTC',
                       'YYYY-MM-DD"T"HH24:MI:SS.US"+00:00"'
                   ) AS expires_at,
                   entry.purged_at::timestamptz + make_interval(days => %s) <= clock_timestamp() AS expired
            FROM catalog_asset_file_purges entry
            WHERE entry.event = '{EVENT_QUARANTINED}'
              AND {_ENTRY_IS_OPEN_SQL}
              AND (%s = '' OR entry.asset_id = %s)
            ORDER BY entry.purged_at::timestamptz, entry.id
            """,
            (grace_days, grace_days, asset_id, asset_id),
        ).fetchall()
        return [dict(row) for row in rows]

    @staticmethod
    def _restore_entry(conn: Any, runtime: CatalogRuntime, entry: dict[str, Any], *, reason: str, job_id: str) -> str:
        """Move one quarantined file back; returns ``restored`` or ``already_present``. Caller holds the lock."""
        source = Path(str(entry["quarantine_path"]))
        destination = Path(str(entry["canonical_path"])).resolve()
        try:
            destination.relative_to(runtime.store_root)
            source.resolve().relative_to(quarantine_root(runtime).resolve())
        except ValueError:
            raise CatalogConflict("The quarantine entry points outside the catalog store", code="quarantine_conflict")
        if destination.is_file() and sha256_file(destination) == str(entry["sha256"]):
            outcome = "already_present"
        elif destination.exists() or destination.is_symlink():
            raise CatalogConflict(
                "A different file now sits at the asset's canonical path", code="quarantine_conflict"
            )
        elif not source.is_file() or sha256_file(source) != str(entry["sha256"]):
            raise CatalogConflict("The quarantined file is missing or changed", code="quarantine_conflict")
        else:
            _move_back(source, destination)
            outcome = "restored"
        source.unlink(missing_ok=True)
        _remove_entry_directory(source, quarantine_root(runtime))
        _insert_event(
            conn, asset_id=str(entry["asset_id"]), sha256=str(entry["sha256"]),
            canonical_path=str(entry["canonical_path"]), event=EVENT_RESTORED, reason=reason, job_id=job_id,
            quarantine_id=str(entry["id"]),
        )
        conn.commit()
        return outcome

    @staticmethod
    def restore(
        conn: Any, runtime: CatalogRuntime, asset_id: str, *, reason: str = "operator_restore", job_id: str = ""
    ) -> dict[str, Any]:
        """Put an asset's quarantined STEP back at its canonical path and record ``restored``.

        Waits for the asset's lock, so it never races the purge or a linker.
        The file is moved before its row is written: a crash in between leaves
        the file in place with the entry still open, which the next maintenance
        run closes as ``deleted`` without touching the restored file.
        """
        entries = StepQuarantine.list_open_entries(conn, grace_days=0, asset_id=asset_id)
        conn.commit()
        if not entries:
            raise NotFound("The asset has no file in quarantine", code="quarantine_entry_not_found")
        entry = entries[-1]
        lock_key = asset_bytes_lock_key(str(entry["sha256"]))
        conn.execute("SELECT pg_advisory_lock(hashtext(%s))", (lock_key,)).fetchone()
        try:
            if not StepQuarantine.list_open_entries(conn, grace_days=0, asset_id=asset_id):
                raise NotFound("The asset has no file in quarantine", code="quarantine_entry_not_found")
            outcome = StepQuarantine._restore_entry(conn, runtime, entry, reason=reason, job_id=job_id)
        finally:
            conn.rollback()
            conn.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_key,))
            conn.commit()
        return {"asset_id": asset_id, "outcome": outcome, "quarantine_id": str(entry["id"])}

    @staticmethod
    def expire(
        conn: Any,
        runtime: CatalogRuntime,
        *,
        grace_days: int,
        job_id: str = "",
        pinned_revision_ids: Iterable[str] = (),
    ) -> dict[str, Any]:
        """Delete quarantined copies older than ``grace_days`` and record ``deleted``.

        An entry whose asset became protected or pinned again while it waited
        (a revision linking it was released, or System Builder pinned one) is
        restored instead. Each entry is handled under the asset's lock, only
        tried, like the purge; its ``deleted`` row is committed before the
        copy is unlinked. This commits ``conn``.
        """
        pinned = sorted({str(value) for value in pinned_revision_ids})
        entries = [entry for entry in StepQuarantine.list_open_entries(conn, grace_days=grace_days) if entry["expired"]]
        conn.commit()
        deleted: list[str] = []
        restored: list[str] = []
        root = quarantine_root(runtime)
        for entry in entries:
            lock_key = asset_bytes_lock_key(str(entry["sha256"]))
            locked = conn.execute("SELECT pg_try_advisory_lock(hashtext(%s)) AS locked", (lock_key,)).fetchone()
            if not locked["locked"]:
                continue
            try:
                still_open = conn.execute(
                    f"SELECT 1 FROM catalog_asset_file_purges entry WHERE entry.id = %s AND {_ENTRY_IS_OPEN_SQL}",
                    (entry["id"],),
                ).fetchone()
                if not still_open:
                    continue
                if _protected_or_pinned(conn, str(entry["asset_id"]), pinned):
                    try:
                        StepQuarantine._restore_entry(conn, runtime, entry, reason="protected_again", job_id=job_id)
                    except CatalogConflict:
                        logger.warning("Could not restore quarantined STEP %s", entry["quarantine_path"], exc_info=True)
                        continue
                    restored.append(str(entry["asset_id"]))
                    continue
                _insert_event(
                    conn, asset_id=str(entry["asset_id"]), sha256=str(entry["sha256"]),
                    canonical_path=str(entry["canonical_path"]), event=EVENT_DELETED, reason="quarantine_expired",
                    job_id=job_id, quarantine_id=str(entry["id"]),
                )
                conn.commit()
                source = Path(str(entry["quarantine_path"]))
                try:
                    source.resolve().relative_to(root.resolve())
                except ValueError:
                    continue
                try:
                    source.unlink(missing_ok=True)
                except OSError:
                    logger.warning("Could not delete quarantined STEP file %s", source, exc_info=True)
                    continue
                _remove_entry_directory(source, root)
                deleted.append(str(entry["asset_id"]))
            finally:
                conn.rollback()
                conn.execute("SELECT pg_advisory_unlock(hashtext(%s))", (lock_key,))
                conn.commit()
        return {"deleted": len(deleted), "deleted_asset_ids": deleted, "restored": len(restored),
                "restored_asset_ids": restored}

    @staticmethod
    def legacy_losses(conn: Any) -> list[dict[str, Any]]:
        """Missing STEP files of purge-eligible assets that no ledger row accounts for.

        These are the files the purge deleted before the ledger existed (or any
        other loss of a never-released draft model). Released history and
        heads are never listed: those losses need a restore, not a record.
        """
        rows = conn.execute(
            f"""
            SELECT asset.id, asset.sha256, asset.canonical_path
            FROM assets asset
            WHERE EXISTS (SELECT 1 FROM revision_assets link WHERE link.asset_id = asset.id
                          AND link.asset_type = '3dmodel')
              AND (lower(asset.canonical_path) LIKE %s OR lower(asset.canonical_path) LIKE %s)
              AND {_UNPROTECTED_SQL}
            ORDER BY asset.id
            """,
            ("%.step", "%.stp"),
        ).fetchall()
        return [
            dict(row) for row in rows
            if not Path(str(row["canonical_path"])).is_file() and not purge_excuses_missing_file(conn, str(row["id"]))
        ]

    @staticmethod
    def record_legacy_losses(conn: Any, *, job_id: str = "record-legacy") -> list[dict[str, Any]]:
        """Record each ``legacy_losses`` file as ``purged`` (``legacy_pre_ledger``). Commits ``conn``."""
        recorded = []
        for row in StepQuarantine.legacy_losses(conn):
            _insert_event(
                conn, asset_id=str(row["id"]), sha256=str(row["sha256"]), canonical_path=str(row["canonical_path"]),
                event=EVENT_PURGED, reason=REASON_LEGACY, job_id=job_id,
            )
            recorded.append(row)
        conn.commit()
        return recorded


__all__ = [
    "EVENT_DELETED",
    "EVENT_PURGED",
    "EVENT_QUARANTINED",
    "EVENT_RESTORED",
    "QUARANTINE_DIRNAME",
    "StepQuarantine",
    "excusing_event",
    "purge_excuses_missing_file",
    "quarantine_root",
    "raise_if_asset_purged",
]
