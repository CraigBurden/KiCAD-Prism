"""Attachment, history and anchor-binding reads for the comments store.

A mixin so ``comments_store_service`` stays within the production-module size
limit; every method runs against the same connection and bootstrap helpers.
"""

from __future__ import annotations

from typing import Dict, List, Optional

from app.services import comment_attachments, comment_bundle, comments_revisions


class CommentsStoreMediaMixin:
    def create_attachment(
        self,
        project_id: str,
        prepared: comment_attachments.PreparedFile,
        filename: str,
        uploader_user_id: Optional[str],
        uploader_display: str,
    ) -> Dict:
        """Store an upload as ``pending`` until a root or reply references it."""
        self.initialize()
        with self._connect() as conn:
            with conn.transaction():
                comment_attachments.sweep_stale_pending(conn, project_id)
                comment_attachments.check_quota(conn, project_id, len(prepared.data))
                digest = comment_attachments.write_blob(prepared.data)
                return comment_attachments.insert_pending(
                    conn, project_id=project_id, uploader_user_id=uploader_user_id,
                    uploader_display=uploader_display, sha256=digest, filename=filename, prepared=prepared,
                )

    def comparison_discussion_report(
        self, project_id: str, project_path: str, base_commit: str, compare_commit: str,
        comparison_domain: Optional[str], title: str,
    ) -> bytes:
        comments = self.get_comparison_comments(
            project_id, project_path, base_commit, compare_commit, comparison_domain,
        )["comments"]
        with self._connect() as conn:
            return comment_bundle.discussion_report_zip(conn, project_id, comments, title)

    def get_attachment(self, project_id: str, attachment_id: str) -> Optional[Dict]:
        self.initialize()
        with self._connect() as conn:
            row = comment_attachments.get(conn, project_id, attachment_id)
            return dict(row) if row else None

    def get_history(self, project_id: str, target_kind: str, target_id: str) -> List[Dict]:
        self.initialize()
        with self._connect() as conn:
            return comments_revisions.history(conn, project_id=project_id, target_kind=target_kind, target_id=target_id)

    def get_anchor_bindings(self, project_id: str, comment_ids: List[str]) -> Dict[str, List[Dict]]:
        """Read manual reattachments in one query; creation stays on the root row."""
        self.initialize()
        if not comment_ids:
            return {}
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT id, comment_id, effective_commit, element_id, file_path,
                          location_x, location_y, location_layer, location_page, area_bounds, relative_point
                   FROM comment_anchor_bindings
                   WHERE project_id = %s AND comment_id = ANY(%s)
                   ORDER BY id""",
                (project_id, comment_ids),
            ).fetchall()
        bindings: Dict[str, List[Dict]] = {}
        for row in rows:
            location = {
                "x": row["location_x"], "y": row["location_y"],
                "layer": row["location_layer"], "page": row["location_page"],
            }
            if row["area_bounds"] is not None:
                location["bounds"] = row["area_bounds"]
            bindings.setdefault(row["comment_id"], []).append({
                "sequence": int(row["id"]), "commit": row["effective_commit"],
                "elementId": row["element_id"], "filePath": row["file_path"],
                "location": location, "relativePoint": row["relative_point"],
            })
        return bindings
