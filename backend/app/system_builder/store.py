"""``ws_systems``: System Builder v2 documents, their log and snapshots.

One row per system holds the complete document and the version ``If-Match``
guards. :class:`SystemTransaction` owns the row lock and the two writes a
request makes (the document and its log entry) so they commit together or not
at all. Visibility follows the system's folder, like a project's.
"""

from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable, ContextManager, Iterator, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.core import errors
from app.core.policy import folder_visibility_params, folder_visible_sql
from app.services.postgres_database import database
from app.system_builder import board_sub_ports, ops
from app.system_builder.document import all_ids, new_id

_COLUMNS = (
    "system_id, folder_id, name, document, version, seen_ids, catalog_component_id, "
    "created_by, created_at, updated_at"
)
_SELECT = ", ".join(f"s.{column}" for column in _COLUMNS.split(", "))
_SUMMARY_COLUMNS = "system_id, folder_id, name, version, created_by, created_at, updated_at"
_OPS_COLUMNS = "version, kind, ops, inverse, touched, actor, undoes, created_at"


@contextmanager
def workspace_connection() -> Iterator[Any]:
    with database.connection() as conn:
        conn.execute("SET search_path TO workspace, public")
        yield conn


def _record(row: Mapping[str, Any]) -> dict[str, Any]:
    return {**row, "seen_ids": frozenset(row.get("seen_ids") or [])}


class SystemTransaction:
    """The row lock a write holds, its log lookups and the commit-time write."""

    def __init__(self, conn: Any, record: Optional[dict[str, Any]]) -> None:
        self._conn = conn
        self.record = record

    @property
    def conn(self) -> Any:
        """The transaction's connection, for writes that must commit with the request."""

        return self._conn

    def entry(self, version: int) -> Optional[dict[str, Any]]:
        """The log row for ``version``, or None when no request produced it."""

        row = self._conn.execute(
            f"SELECT {_OPS_COLUMNS} FROM ws_system_ops WHERE system_id = %s AND version = %s",
            (self._system_id(), version),
        ).fetchone()
        return dict(row) if row is not None else None

    def entries_after(self, version: int) -> list[dict[str, Any]]:
        """Log rows newer than ``version``, oldest first."""

        rows = self._conn.execute(
            f"SELECT {_OPS_COLUMNS} FROM ws_system_ops"
            " WHERE system_id = %s AND version > %s ORDER BY version",
            (self._system_id(), version),
        ).fetchall()
        return [dict(row) for row in rows]

    def write(
        self, applied: ops.Applied, *, actor: str, kind: str,
        ops: Sequence[Mapping[str, Any]], undoes: Optional[int] = None,
    ) -> dict[str, Any]:
        """Store ``applied`` as the record's next version and log the request."""

        system_id = self._system_id()
        version = int(self.record["version"]) + 1
        row = self._conn.execute(
            f"""
            UPDATE ws_systems
               SET document = %s, name = %s, version = %s, seen_ids = %s, updated_at = now()
             WHERE system_id = %s
             RETURNING {_COLUMNS}
            """,
            (
                Jsonb(applied.document), applied.document["name"], version,
                Jsonb(sorted(applied.seen_ids)), system_id,
            ),
        ).fetchone()
        self._conn.execute(
            """
            INSERT INTO ws_system_ops
                (system_id, version, kind, ops, inverse, touched, actor, undoes)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                system_id, version, kind, Jsonb(list(ops)), Jsonb(applied.inverse),
                Jsonb(sorted(applied.touched)), actor, undoes,
            ),
        )
        self.record = _record(row)
        return self.record

    def _system_id(self) -> str:
        if self.record is None:
            raise LookupError("the transaction found no system")
        return self.record["system_id"]


class SystemStore:
    def __init__(self, connect: Callable[[], ContextManager[Any]] = workspace_connection) -> None:
        self._connect = connect

    @contextmanager
    def connection(self) -> Iterator[Any]:
        """A connection on the store's schema, for a read that must see its writes."""

        with self._connect() as conn:
            yield conn

    # ----------------------------------------------------------------- writes

    def create(
        self, system_id: str, document: Mapping[str, Any], *, folder_id: Optional[str],
        created_by: str, role: str,
    ) -> dict[str, Any]:
        """Insert version 1 of a new system, refusing a folder ``role`` cannot see."""

        with self._connect() as conn:
            if folder_id is not None:
                visible = conn.execute(
                    f"SELECT 1 FROM ws_folders f WHERE f.id = %(folder_id)s AND {folder_visible_sql('f')}",
                    {"folder_id": folder_id, **folder_visibility_params(role)},
                ).fetchone()
                if visible is None:
                    raise errors.NotFound("Folder not found")
            row = conn.execute(
                f"""
                INSERT INTO ws_systems
                    (system_id, folder_id, name, document, version, seen_ids, created_by)
                VALUES (%s, %s, %s, %s, 1, %s, %s)
                RETURNING {_COLUMNS}
                """,
                (
                    system_id, folder_id, document["name"], Jsonb(document),
                    Jsonb(sorted(all_ids(document))), created_by,
                ),
            ).fetchone()
            conn.commit()
        return _record(row)

    def soft_delete(self, system_id: str) -> bool:
        """Mark the system deleted; it vanishes from reads and listings."""

        with self._connect() as conn:
            cursor = conn.execute(
                "UPDATE ws_systems SET deleted_at = now()"
                " WHERE system_id = %s AND deleted_at IS NULL",
                (system_id,),
            )
            conn.commit()
        return cursor.rowcount > 0

    # ------------------------------------------------------------------ reads

    def read(self, system_id: str, *, role: str) -> Optional[dict[str, Any]]:
        """The visible, non-deleted system, or None when it is neither."""

        with self._connect() as conn:
            row = conn.execute(
                f"""
                SELECT {_SELECT}
                  FROM ws_systems s
                  LEFT JOIN ws_folders f ON f.id = s.folder_id
                 WHERE s.system_id = %(system_id)s
                   AND s.deleted_at IS NULL
                   AND {folder_visible_sql('f')}
                """,
                {"system_id": system_id, **folder_visibility_params(role)},
            ).fetchone()
        return _record(row) if row is not None else None

    def list(self, *, role: str) -> list[dict[str, Any]]:
        """Visible, non-deleted systems, newest change first; no document."""

        with self._connect() as conn:
            rows = conn.execute(
                f"""
                SELECT {', '.join(f's.{column}' for column in _SUMMARY_COLUMNS.split(', '))}
                  FROM ws_systems s
                  LEFT JOIN ws_folders f ON f.id = s.folder_id
                 WHERE s.deleted_at IS NULL
                   AND {folder_visible_sql('f')}
                 ORDER BY s.updated_at DESC, s.system_id
                """,
                folder_visibility_params(role),
            ).fetchall()
        return [dict(row) for row in rows]

    @contextmanager
    def transaction(self, system_id: str, *, role: str) -> Iterator[SystemTransaction]:
        """Lock the visible system for one write; commit on success, roll back on error."""

        with self._connect() as conn:
            row = conn.execute(
                f"""
                SELECT {_SELECT}
                  FROM ws_systems s
                  LEFT JOIN ws_folders f ON f.id = s.folder_id
                 WHERE s.system_id = %(system_id)s
                   AND s.deleted_at IS NULL
                   AND {folder_visible_sql('f')}
                 FOR UPDATE OF s
                """,
                {"system_id": system_id, **folder_visibility_params(role)},
            ).fetchone()
            try:
                yield SystemTransaction(conn, _record(row) if row is not None else None)
                conn.commit()
            except Exception:
                conn.rollback()
                raise

    def history(
        self, system_id: str, *, before: Optional[int] = None, limit: int = 50,
    ) -> list[dict[str, Any]]:
        """Log rows newest first, optionally older than ``before``; at most 200."""

        limit = max(1, min(int(limit), 200))
        conditions = ["system_id = %s"]
        params: list[Any] = [system_id]
        if before is not None:
            conditions.append("version < %s")
            params.append(before)
        params.append(limit)
        with self._connect() as conn:
            rows = conn.execute(
                f"SELECT {_OPS_COLUMNS} FROM ws_system_ops"
                f" WHERE {' AND '.join(conditions)} ORDER BY version DESC LIMIT %s",
                tuple(params),
            ).fetchall()
        return [dict(row) for row in rows]

    # -------------------------------------------------------------- snapshots

    def create_snapshot(
        self, system_id: str, *, name: str, note: Optional[str], created_by: str,
    ) -> dict[str, Any]:
        """Copy the current document, version and board-level sub-ports into a snapshot."""

        with self._connect() as conn:
            current = conn.execute(
                "SELECT document, version FROM ws_systems"
                " WHERE system_id = %s AND deleted_at IS NULL",
                (system_id,),
            ).fetchone()
            if current is None:
                raise errors.NotFound("System not found")
            snapshot_id = new_id("snap")
            row = conn.execute(
                """
                INSERT INTO ws_system_snapshots
                    (snapshot_id, system_id, version, name, note, document,
                     board_sub_ports, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING snapshot_id, system_id, version, name, note, document,
                          board_sub_ports AS "boardSubPorts", created_by, created_at
                """,
                (
                    snapshot_id, system_id, int(current["version"]), name, note,
                    Jsonb(current["document"]),
                    Jsonb(board_sub_ports.build_input(conn, current["document"])),
                    created_by,
                ),
            ).fetchone()
            conn.commit()
        return dict(row)

    def list_snapshots(self, system_id: str) -> list[dict[str, Any]]:
        """Snapshot summaries, newest first, without their documents."""

        with self._connect() as conn:
            rows = conn.execute(
                """
                SELECT snapshot_id, system_id, version, name, note, created_by, created_at
                  FROM ws_system_snapshots
                 WHERE system_id = %s
                 ORDER BY created_at DESC, snapshot_id
                """,
                (system_id,),
            ).fetchall()
        return [dict(row) for row in rows]

    def read_snapshot(self, system_id: str, snapshot_id: str) -> Optional[dict[str, Any]]:
        """One snapshot with its document and board-level sub-ports, or None when it is not this system's."""

        with self._connect() as conn:
            row = conn.execute(
                """
                SELECT snapshot_id, system_id, version, name, note, document,
                       board_sub_ports AS "boardSubPorts", created_by, created_at
                  FROM ws_system_snapshots
                 WHERE system_id = %s AND snapshot_id = %s
                """,
                (system_id, snapshot_id),
            ).fetchone()
        return dict(row) if row is not None else None
