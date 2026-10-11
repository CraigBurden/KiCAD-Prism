"""Snapshots (§9.1): immutable, stored unredacted, with the manifest each one froze."""

from __future__ import annotations

from typing import Any, Mapping, Optional

from psycopg.types.json import Jsonb

from app.services.systems import interface_cache
from app.services.systems.store_base import NotFound, Conflict, Invalid, _given_id, Mutation


class SnapshotsStore:
    _SNAPSHOT_META = ("id, system_id, name, note, created_by, created_at, digest, open_review_count, "
                      "renderer_version, manifest_schema, connectivity_digest, git, "
                      # SB2-116: what the snapshot froze, for the publish dialog.
                      "(document->'findingCounts'->>'error')::int AS error_count, "
                      "(document->'findingCounts'->>'warning')::int AS warning_count, "
                      "jsonb_array_length(COALESCE(document->'exports', '[]'::jsonb)) AS export_count")

    def create_snapshot(
        self, change: Mutation, *, name: str, note: str, document: Mapping[str, Any], digest: str,
        open_review_count: int, renderer_version: str, snapshot_id: Optional[str] = None,
        manifest: Optional[Mapping[str, Any]] = None, connectivity_digest: Optional[str] = None,
        git: Optional[Mapping[str, Any]] = None,
    ) -> dict:
        if not name.strip():
            raise Invalid("name is required")
        snapshot_id = _given_id("ssn_", snapshot_id)
        row = self.conn.execute(
            f"""
            INSERT INTO system_snapshots
                (id, system_id, name, note, created_by, document, digest, open_review_count, renderer_version,
                 manifest, manifest_schema, connectivity_digest, git)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT ON CONSTRAINT system_snapshots_name_key DO NOTHING
            RETURNING {self._SNAPSHOT_META}
            """,
            (snapshot_id, change.system_id, name.strip(), note, change.actor, Jsonb(dict(document)),
             digest, int(open_review_count), renderer_version,
             Jsonb(dict(manifest)) if manifest is not None else None,
             manifest.get("schema") if manifest is not None else None, connectivity_digest,
             Jsonb(dict(git)) if git is not None else None),
        ).fetchone()
        if row is None:
            raise Conflict(f"a snapshot named {name.strip()!r} already exists")
        change.audit("snapshot_created", {"snapshotId": snapshot_id, "name": row["name"], "digest": digest})
        return dict(row)

    def list_snapshots(self, system_id: str) -> list[dict]:
        rows = self.conn.execute(
            f"SELECT {self._SNAPSHOT_META} FROM system_snapshots WHERE system_id = %s ORDER BY created_at DESC, id",
            (system_id,),
        ).fetchall()
        return [dict(row) for row in rows]

    def snapshot_counts(self, system_id: str, snapshot_id: str) -> Optional[dict]:
        """``{error, warning}`` open in a snapshot's frozen document, or None if it is gone (SB2-117)."""
        row = self.conn.execute(
            "SELECT (document->'findingCounts'->>'error')::int AS error, (document->'findingCounts'->>'warning')::int AS warning "
            "FROM system_snapshots WHERE system_id = %s AND id = %s", (system_id, snapshot_id)).fetchone()
        return {"error": row["error"] or 0, "warning": row["warning"] or 0} if row else None

    def get_snapshot(self, system_id: str, snapshot_id: str) -> dict:
        row = self.conn.execute(
            f"SELECT {self._SNAPSHOT_META}, document, manifest FROM system_snapshots WHERE system_id = %s AND id = %s",
            (system_id, snapshot_id),
        ).fetchone()
        if row is None:
            raise NotFound("Snapshot not found")
        return dict(row)

    def get_snapshot_manifest(self, system_id: str, snapshot_id: str) -> Optional[dict]:
        """Only a snapshot's manifest (SB2-95): resolving a child never needs its multi-MB document.
        Snapshots never change, so the parsed manifest is kept in process."""
        key = (system_id, snapshot_id, "manifest")
        cached = interface_cache.manifests.get(key)
        if cached is not None:
            return cached
        row = self.conn.execute(
            "SELECT manifest, pg_column_size(manifest) AS stored FROM system_snapshots WHERE system_id = %s AND id = %s",
            (system_id, snapshot_id),
        ).fetchone()
        if row is None:
            raise NotFound("Snapshot not found")
        if row["manifest"] is None:
            return None
        return interface_cache.manifests.put(key, row["manifest"], row["stored"])
