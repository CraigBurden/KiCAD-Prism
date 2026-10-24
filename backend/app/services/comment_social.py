"""Reactions and edit markers on review messages (issue #417, phase 4).

Reactions are a fixed, named set rather than free-form emoji: the names are
what the API and the database carry, and the client owns the glyphs. A
reaction is not an edit -- it never bumps a revision, so reacting cannot
conflict with someone editing the same message -- but it is a committed
change on the thread, so live clients refetch it.

``editedAt`` is derived from ``comment_revisions`` (the latest content edit),
never stored, so every edit path -- Prism, the API, a forge echo -- marks a
message the same way.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence

REACTIONS = ("thumbs_up", "eyes", "check", "question", "heart", "tada")

#: Private per-reaction key the API turns into ``mine`` for the reader.
REACTED_BY = "_reactedBy"


def apply_schema(conn: Any) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS comment_reactions (
            project_id TEXT NOT NULL,
            comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
            target_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            user_display TEXT NOT NULL DEFAULT '',
            reaction TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (comment_id, target_id, user_id, reaction)
        );
        CREATE INDEX IF NOT EXISTS idx_comment_reactions_project
            ON comment_reactions(project_id, comment_id);
        """,
        prepare=False,
    )


def set_reaction(
    conn: Any,
    *,
    project_id: str,
    comment_id: str,
    target_id: str,
    user_id: str,
    user_display: str,
    reaction: str,
    present: bool,
) -> bool:
    """Add or remove one reader's reaction; True when anything changed."""
    if reaction not in REACTIONS:
        raise ValueError(f"unknown reaction {reaction!r}")
    if present:
        row = conn.execute(
            """INSERT INTO comment_reactions(project_id, comment_id, target_id, user_id, user_display, reaction)
               VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT DO NOTHING RETURNING 1""",
            (project_id, comment_id, target_id, user_id, user_display, reaction),
        ).fetchone()
    else:
        row = conn.execute(
            """DELETE FROM comment_reactions
               WHERE project_id = %s AND comment_id = %s AND target_id = %s AND user_id = %s AND reaction = %s
               RETURNING 1""",
            (project_id, comment_id, target_id, user_id, reaction),
        ).fetchone()
    return row is not None


def _reactions(conn: Any, project_id: str, comment_ids: List[str]) -> Dict[str, List[Dict]]:
    rows = conn.execute(
        """SELECT target_id, reaction, user_id, user_display FROM comment_reactions
           WHERE project_id = %s AND comment_id = ANY(%s)
           ORDER BY created_at, user_id""",
        (project_id, comment_ids),
    ).fetchall()
    grouped: Dict[str, Dict[str, Dict]] = {}
    for row in rows:
        entry = grouped.setdefault(row["target_id"], {}).setdefault(
            row["reaction"], {"reaction": row["reaction"], "count": 0, "users": [], REACTED_BY: []},
        )
        entry["count"] += 1
        entry["users"].append(row["user_display"] or "Someone")
        entry[REACTED_BY].append(row["user_id"])
    order = {name: index for index, name in enumerate(REACTIONS)}
    return {
        target: sorted(by_name.values(), key=lambda item: order.get(item["reaction"], len(order)))
        for target, by_name in grouped.items()
    }


def _edited(conn: Any, project_id: str, target_ids: List[str]) -> Dict[str, Any]:
    rows = conn.execute(
        """SELECT target_id, MAX(created_at) AS edited_at FROM comment_revisions
           WHERE project_id = %s AND target_id = ANY(%s) AND change_kind = 'edit' AND content IS NOT NULL
           GROUP BY target_id""",
        (project_id, target_ids),
    ).fetchall()
    return {row["target_id"]: row["edited_at"] for row in rows}


def _iso(value: Any) -> str:
    return value.isoformat().replace("+00:00", "Z") if hasattr(value, "isoformat") else str(value)


def decorate(conn: Any, project_id: str, comments: Sequence[Dict]) -> None:
    """Add ``reactions`` and ``editedAt`` to each root and reply that has them."""
    roots = [comment for comment in comments if comment.get("id")]
    if not roots:
        return
    targets = [comment["id"] for comment in roots]
    targets += [reply["id"] for comment in roots for reply in comment.get("replies", []) if reply.get("id")]
    reactions = _reactions(conn, project_id, [comment["id"] for comment in roots])
    edited = _edited(conn, project_id, targets)
    for comment in roots:
        for message in (comment, *comment.get("replies", [])):
            message_id = message.get("id")
            if message_id in reactions:
                message["reactions"] = reactions[message_id]
            if message_id in edited:
                message["editedAt"] = _iso(edited[message_id])


def personalize(comment: Dict, actor_id: Optional[str]) -> Dict:
    """Replace who-reacted ids with ``mine`` for one reader; ids never leave the API."""
    for message in (comment, *comment.get("replies", [])):
        for entry in message.get("reactions") or []:
            reacted_by = entry.pop(REACTED_BY, [])
            entry["mine"] = actor_id is not None and actor_id in reacted_by
    return comment


def strip(comments: Sequence[Dict]) -> None:
    """Drop reactions from an export: they are reader state, not review content."""
    for comment in comments:
        for message in (comment, *comment.get("replies", [])):
            message.pop("reactions", None)
