"""
Comments storage service.

Design:
- PostgreSQL is the single source of truth for comments/replies.
- Per-project isolation is enforced via project_id on every row.
- Existing .comments/comments.json is imported once per project on first access.
- comments.json is exported from DB when users press "Push Comments".
- Authorship is a stable actor key (``author_user_id``/``author_kind``) with the
  display text kept beside it; rows written before that existed are ``legacy``
  and have no owner. Edits advance ``revision`` and append to
  ``comment_revisions``; deletes are tombstones. Reads only return live rows.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from contextlib import contextmanager
from typing import Dict, List, Optional, Tuple

from app.services import comment_attachments, comment_bundle, comment_live_events, comment_social, comments_schema_migrations
from app.services.comments_revisions import Editor, RevisionConflict  # noqa: F401  (re-exported for callers)
from app.services.comments_store_codec import (  # noqa: F401  (constants re-exported for the API)
    COMMENT_CLASSES,
    COMMENT_SEVERITIES,
    COMMENTS_META,
    DEFAULT_COMMENT_CLASS,
    DEFAULT_COMMENT_SEVERITY,
    _COMMENT_COLUMNS,
    _REPLY_COLUMNS,
    _row_to_comment_dict,
    _row_to_reply_dict,
    _utc_now_iso,
    get_project_comments_json_path,
    import_comments_payload,
)
from app.services.comments_store_media import CommentsStoreMediaMixin
from app.services.comments_store_writes import CommentsStoreWritesMixin
from app.services.postgres_database import database
from app.services.trackers.projections import attach_tracker_projection, attach_tracker_projections


class CommentsStoreService(CommentsStoreWritesMixin, CommentsStoreMediaMixin):
    """PostgreSQL-backed comments service: reads, import/export and project lifecycle here;
    root and reply writes in ``comments_store_writes``; attachments and history in
    ``comments_store_media``."""

    # Tests point a subclass at a disposable schema; production is "comments".
    schema = "comments"
    workspace_schema = "workspace"

    def __init__(self) -> None:
        self._init_lock = threading.Lock()
        self._initialized = False

    def initialize(self) -> None:
        """Create DB schema if missing."""
        if self._initialized:
            return

        with self._init_lock:
            if self._initialized:
                return

            comments_schema_migrations.COMMENTS_LEDGER.migrate(self._connect, schema=self.schema)

            self._initialized = True

    @contextmanager
    def _connect(self):
        with database.connection() as conn:
            # Tracker projections and outbound hooks read workspace tables
            # (connectors, project destinations) through this connection.
            conn.execute(f'SET search_path TO "{self.schema}", "{self.workspace_schema}", public')
            yield conn

    def _bootstrap_project_if_needed(self, conn, project_id: str, project_path: str) -> None:
        conn.execute(
            """
            INSERT INTO project_comment_state(project_id, imported_from_json)
            VALUES(%s, FALSE)
            ON CONFLICT (project_id) DO NOTHING
            """,
            (project_id,),
        )

        state_row = conn.execute(
            "SELECT imported_from_json FROM project_comment_state WHERE project_id = %s",
            (project_id,),
        ).fetchone()

        imported = bool(state_row["imported_from_json"]) if state_row else False
        if imported:
            return

        existing_count = conn.execute(
            "SELECT COUNT(1) AS count FROM comments WHERE project_id = %s",
            (project_id,),
        ).fetchone()["count"]

        if existing_count == 0:
            payload = self._read_comments_json(project_path)
            if payload:
                bundle_dir = os.path.dirname(get_project_comments_json_path(project_path))
                import_comments_payload(conn, project_id, payload, bundle_dir)

        conn.execute(
            """
            UPDATE project_comment_state
            SET imported_from_json = TRUE,
                imported_at = %s
            WHERE project_id = %s
            """,
            (_utc_now_iso(), project_id),
        )

    def _read_comments_json(self, project_path: str) -> Optional[Dict]:
        comments_path = get_project_comments_json_path(project_path)
        if not os.path.exists(comments_path):
            return None

        try:
            with open(comments_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return None

        if not isinstance(payload, dict):
            return None

        comments = payload.get("comments")
        if not isinstance(comments, list):
            return None

        return payload

    def _build_snapshot(self, conn, project_id: str) -> Dict:
        # Read the cursor before the rows. Under READ COMMITTED a concurrent
        # commit after this read is then replayable, never silently skipped.
        cursor = comment_live_events.current_cursor(conn, project_id)
        comment_rows = conn.execute(
            f"""
            SELECT {_COMMENT_COLUMNS}
            FROM comments
            WHERE project_id = %s AND scope <> 'comparison' AND deleted_at IS NULL
            ORDER BY timestamp ASC, id ASC
            """,
            (project_id,),
        ).fetchall()

        reply_rows = conn.execute(
            f"""
            SELECT {_REPLY_COLUMNS}
            FROM comment_replies
            WHERE project_id = %s AND deleted_at IS NULL
            ORDER BY timestamp ASC, id ASC
            """,
            (project_id,),
        ).fetchall()

        replies_by_comment: Dict[str, List[Dict]] = {}

        for row in reply_rows:
            replies_by_comment.setdefault(row["comment_id"], []).append(_row_to_reply_dict(row))

        comments: List[Dict] = [
            _row_to_comment_dict(row, replies_by_comment.get(row["id"], []))
            for row in comment_rows
        ]
        attach_tracker_projections(conn, project_id, comments, workspace_schema=self.workspace_schema)
        comment_attachments.decorate(conn, project_id, comments)
        comment_social.decorate(conn, project_id, comments)

        return {
            "meta": dict(COMMENTS_META),
            "comments": comments,
            "cursor": cursor,
        }

    def _get_comment_with_replies(
        self,
        conn,
        project_id: str,
        comment_id: str,
        *,
        unsynced_reply_ids: Optional[set[str]] = None,
    ) -> Optional[Dict]:
        row = conn.execute(
            f"""
            SELECT {_COMMENT_COLUMNS}
            FROM comments
            WHERE project_id = %s AND id = %s AND deleted_at IS NULL
            """,
            (project_id, comment_id),
        ).fetchone()

        if not row:
            return None

        reply_rows = conn.execute(
            f"""
            SELECT {_REPLY_COLUMNS}
            FROM comment_replies
            WHERE project_id = %s AND comment_id = %s AND deleted_at IS NULL
            ORDER BY timestamp ASC, id ASC
            """,
            (project_id, comment_id),
        ).fetchall()

        comment = _row_to_comment_dict(row, [_row_to_reply_dict(reply) for reply in reply_rows])
        comment_attachments.decorate(conn, project_id, [comment])
        comment_social.decorate(conn, project_id, [comment])
        attach_tracker_projection(
            conn, project_id, comment,
            workspace_schema=self.workspace_schema, unsynced_reply_ids=unsynced_reply_ids,
        )
        return comment

    def get_comments_file(self, project_id: str, project_path: str) -> Dict:
        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                self._bootstrap_project_if_needed(conn, project_id, project_path)
                return self._build_snapshot(conn, project_id)

    def get_comparison_comments(
        self,
        project_id: str,
        project_path: str,
        base_commit: str,
        compare_commit: str,
        comparison_domain: Optional[str] = None,
    ) -> Dict:
        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                self._bootstrap_project_if_needed(conn, project_id, project_path)
                cursor = comment_live_events.current_cursor(conn, project_id)
                query = f"""
                    SELECT {_COMMENT_COLUMNS}
                    FROM comments
                    WHERE project_id = %s
                      AND scope = 'comparison'
                      AND deleted_at IS NULL
                      AND base_commit = %s
                      AND compare_commit = %s
                """
                params: List[object] = [project_id, base_commit, compare_commit]
                if comparison_domain:
                    query += " AND comparison_domain = %s"
                    params.append(comparison_domain)
                query += " ORDER BY timestamp ASC, id ASC"
                rows = conn.execute(query, tuple(params)).fetchall()
                comment_ids = [row["id"] for row in rows]
                replies_by_comment: Dict[str, List[Dict]] = {}
                if comment_ids:
                    reply_rows = conn.execute(
                        f"""
                        SELECT {_REPLY_COLUMNS}
                        FROM comment_replies
                        WHERE project_id = %s AND comment_id = ANY(%s) AND deleted_at IS NULL
                        ORDER BY timestamp ASC, id ASC
                        """,
                        (project_id, comment_ids),
                    ).fetchall()
                    for reply in reply_rows:
                        replies_by_comment.setdefault(reply["comment_id"], []).append(_row_to_reply_dict(reply))
                comments = [
                    _row_to_comment_dict(row, replies_by_comment.get(row["id"], []))
                    for row in rows
                ]
                comment_attachments.decorate(conn, project_id, comments)
                comment_social.decorate(conn, project_id, comments)
                return {
                    "meta": dict(COMMENTS_META),
                    "cursor": cursor,
                    "comments": comments,
                }

    def get_comment(self, project_id: str, project_path: str, comment_id: str) -> Optional[Dict]:
        """One live root with its live replies, or None."""
        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                self._bootstrap_project_if_needed(conn, project_id, project_path)
                return self._get_comment_with_replies(conn, project_id, comment_id)

    def get_thread(self, project_id: str, project_path: str, comment_id: str) -> Tuple[Optional[Dict], int]:
        """One thread for a live refresh, with the stream cursor read before it.

        ``None`` means the thread is gone (deleted or never existed), which the
        client applies as a removal.
        """
        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                self._bootstrap_project_if_needed(conn, project_id, project_path)
                # Same ordering as the snapshot: cursor first, then the row.
                cursor = comment_live_events.current_cursor(conn, project_id)
                return self._get_comment_with_replies(conn, project_id, comment_id), cursor

    def _live_root_exists(self, conn, project_id: str, comment_id: str) -> bool:
        return bool(conn.execute(
            "SELECT 1 FROM comments WHERE project_id = %s AND id = %s AND deleted_at IS NULL",
            (project_id, comment_id),
        ).fetchone())

    def _live_reply(self, conn, project_id: str, comment_id: str, reply_id: str):
        return conn.execute(
            f"""
            SELECT {_REPLY_COLUMNS} FROM comment_replies
            WHERE project_id = %s AND comment_id = %s AND id = %s AND deleted_at IS NULL
            """,
            (project_id, comment_id, reply_id),
        ).fetchone()

    def get_reply(self, project_id: str, comment_id: str, reply_id: str) -> Optional[Dict]:
        self.initialize()
        with self._connect() as conn:
            row = self._live_reply(conn, project_id, comment_id, reply_id)
            return _row_to_reply_dict(row) if row else None

    def delete_project_comments(self, project_id: str) -> None:
        """Remove every comment listing stored for a deleted project."""
        self.initialize()

        with self._connect() as conn:
            with conn.transaction():
                conn.execute("DELETE FROM comment_revisions WHERE project_id = %s", (project_id,))
                conn.execute("DELETE FROM comment_change_events WHERE project_id = %s", (project_id,))
                conn.execute("DELETE FROM comment_stream_heads WHERE project_id = %s", (project_id,))
                conn.execute(
                    "DELETE FROM comments WHERE project_id = %s",
                    (project_id,),
                )
                conn.execute(
                    "DELETE FROM project_comment_state WHERE project_id = %s",
                    (project_id,),
                )

    def export_comments_json(self, project_id: str, project_path: str) -> str:
        self.initialize()

        with self._connect() as conn:
            with conn.transaction():
                self._bootstrap_project_if_needed(conn, project_id, project_path)
                snapshot = self._build_snapshot(conn, project_id)
                comment_social.strip(snapshot["comments"])

                comments_path = get_project_comments_json_path(project_path)
                os.makedirs(os.path.dirname(comments_path), exist_ok=True)
                comment_bundle.write_bundle(conn, project_id, os.path.dirname(comments_path), snapshot)

                fd, tmp_path = tempfile.mkstemp(
                    prefix=".comments-",
                    suffix=".tmp",
                    dir=os.path.dirname(comments_path),
                )

                try:
                    with os.fdopen(fd, "w", encoding="utf-8") as handle:
                        json.dump(snapshot, handle, indent=2)
                        handle.write("\n")
                    os.replace(tmp_path, comments_path)
                finally:
                    if os.path.exists(tmp_path):
                        os.unlink(tmp_path)

                conn.execute(
                    """
                    UPDATE project_comment_state
                    SET last_exported_at = %s
                    WHERE project_id = %s
                    """,
                    (_utc_now_iso(), project_id),
                )

                return comments_path

    def mark_export_commit(self, project_id: str, commit_sha: str) -> None:
        if not commit_sha:
            return

        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                conn.execute(
                    """
                    INSERT INTO project_comment_state(project_id, imported_from_json)
                    VALUES(%s, TRUE)
                    ON CONFLICT (project_id) DO NOTHING
                    """,
                    (project_id,),
                )
                conn.execute(
                    """
                    UPDATE project_comment_state
                    SET last_exported_at = %s,
                        last_export_commit = %s
                    WHERE project_id = %s
                    """,
                    (_utc_now_iso(), commit_sha, project_id),
                )


comments_store = CommentsStoreService()


def initialize_comments_store() -> None:
    comments_store.initialize()
