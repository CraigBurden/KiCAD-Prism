"""Store the anchor of projects registered before anchors existed.

Rows imported before ``project_file_rel`` (workspace migration 20) keep an
empty anchor. Most of Prism infers one when it reads such a row, but design
bundle keying reads the stored anchor alone and finds no project file
(revision-key.md §4.4: "the anchor is the stored ``project_file_rel`` alone"),
so those projects never get a design bundle. The contract leaves choosing the
anchor to registration, so this hook does what registration would do now and
stores it.

It runs after the workspace migrations on every start (a ledger ``after``
hook, like the origin and settings backfills beside it), because the answer
comes from the checkout on disk, which a numbered migration step must not
read. Only rows whose anchor is still empty are read, so a settled workspace
pays one query. The rule is ``infer_project_anchor``: a project directory
holding exactly one ``.kicad_pro`` has exactly one project. A directory with
several, or none, is left alone, as is a row whose inferred anchor another row
of the same directory already holds (the unique key forbids a second one).
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable

logger = logging.getLogger(__name__)


def backfill_project_anchors(conn: Any, abs_clone_path: Callable[[str], str]) -> int:
    """Store the inferred anchor of every project whose anchor is empty. Returns how many were stored."""

    from app.services.project_import_service import infer_project_anchor

    rows = conn.execute(
        """SELECT p.id, p.repo_id, p.relative_path, r.clone_path
           FROM ws_projects p JOIN ws_repositories r ON r.id = p.repo_id
           WHERE p.project_file_rel = ''"""
    ).fetchall()
    stored = 0
    for row in rows:
        relative = row["relative_path"] or "."
        clone = abs_clone_path(row["clone_path"] or "")
        checkout = clone if relative == "." else os.path.join(clone, relative)
        anchor = infer_project_anchor(checkout)
        if not anchor:
            logger.info("Project %s has no anchor and %s does not hold exactly one .kicad_pro", row["id"], checkout)
            continue
        updated = conn.execute(
            """UPDATE ws_projects p SET project_file_rel = %s
               WHERE p.id = %s AND p.project_file_rel = ''
                 AND NOT EXISTS (
                     SELECT 1 FROM ws_projects other
                     WHERE other.repo_id = p.repo_id AND other.relative_path = p.relative_path
                       AND other.project_file_rel = %s
                 )""",
            (anchor, row["id"], anchor),
        )
        if updated.rowcount == 1:
            stored += 1
            logger.info("Project %s: stored its anchor %s", row["id"], anchor)
        else:
            logger.info("Project %s: another project of its directory already has the anchor %s", row["id"], anchor)
    return stored
