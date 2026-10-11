"""Reviews, finding waivers and counts, import sessions, audit history, layout, the interface cache and
detection bookkeeping."""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from psycopg.types.json import Jsonb

from app.services.systems import interface_cache
from app.services.systems.store_base import (
    NotFound, Conflict, Invalid, new_id, _given_id, Mutation,
)


class ReviewsStore:
    # ------------------------------------------------------------------
    # Reviews (§5, §6.2, §6.5, §10.1)

    def open_source_review(self, instance_id: str) -> Optional[dict]:
        """The instance's open ``source_update``, ``baseline_unreachable`` or ``child_update`` review."""
        row = self.conn.execute(
            """
            SELECT * FROM system_reviews
            WHERE instance_id = %s AND status = 'open'
              AND kind IN ('source_update', 'baseline_unreachable', 'child_update')
            """,
            (instance_id,),
        ).fetchone()
        return dict(row) if row else None

    def open_review(
        self, change: Mutation, *, instance_id: Optional[str], kind: str,
        from_commit: Optional[str], to_commit: Optional[str],
        items: Sequence[Mapping[str, Any]] = (),
        pending_changes: Mapping[str, Any] | None = None,
    ) -> dict:
        """Create an open review with its items, in order, and audit it."""
        review_id = new_id("srv_")
        self.conn.execute(
            """
            INSERT INTO system_reviews
                (id, system_id, instance_id, kind, from_commit, to_commit, pending_changes)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            """,
            (review_id, change.system_id, instance_id, kind, from_commit, to_commit,
             Jsonb(dict(pending_changes or {}))),
        )
        for ordinal, item in enumerate(items):
            self.conn.execute(
                """
                INSERT INTO system_review_items
                    (id, review_id, ordinal, kind, link_id, link_end, row_ids,
                     expected, observed, candidates)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (new_id("sri_"), review_id, ordinal, item["kind"], item.get("linkId"),
                 item.get("end"), Jsonb(list(item.get("rowIds") or [])),
                 Jsonb(item.get("expected")), Jsonb(item.get("observed")),
                 None if item.get("candidates") is None else Jsonb(list(item["candidates"]))),
            )
        change.audit(
            "review_opened",
            {"reviewId": review_id, "instanceId": instance_id, "kind": kind,
             "from": from_commit, "to": to_commit, "itemCount": len(items)},
        )
        return self.get_review(change.system_id, review_id)

    def set_review_status(
        self, change: Mutation, review_id: str, status: str, *, audit_kind: Optional[str] = None,
        payload: Mapping[str, Any] | None = None,
    ) -> None:
        self.conn.execute(
            """
            UPDATE system_reviews SET status = %s, decided_by = %s, decided_at = NOW()
            WHERE id = %s AND system_id = %s
            """,
            (status, change.actor, review_id, change.system_id),
        )
        if audit_kind:
            change.audit(audit_kind, {"reviewId": review_id, "status": status, **dict(payload or {})})

    def set_item_decision(
        self, change: Mutation, review_id: str, item_id: str, decision: str,
        payload: Mapping[str, Any] | None,
    ) -> None:
        self.conn.execute(
            """
            UPDATE system_review_items SET decision = %s, decision_payload = %s
            WHERE id = %s AND review_id = %s
            """,
            (decision, None if payload is None else Jsonb(dict(payload)), item_id, review_id),
        )
        change.audit(
            "review_item_decided",
            {"reviewId": review_id, "itemId": item_id, "decision": decision,
             "payload": None if payload is None else dict(payload)},
        )

    def get_review(self, system_id: str, review_id: str) -> dict:
        row = self.conn.execute(
            "SELECT * FROM system_reviews WHERE system_id = %s AND id = %s", (system_id, review_id)
        ).fetchone()
        if row is None:
            raise NotFound(review_id)
        review = dict(row)
        review["items"] = [
            dict(item)
            for item in self.conn.execute(
                "SELECT * FROM system_review_items WHERE review_id = %s ORDER BY ordinal",
                (review_id,),
            ).fetchall()
        ]
        return review

    def list_reviews(self, system_id: str, *, status: Optional[str] = None) -> list[dict]:
        rows = self.conn.execute(
            """
            SELECT id FROM system_reviews
            WHERE system_id = %s AND (%s::text IS NULL OR status = %s::text)
            ORDER BY created_at DESC, id
            """,
            (system_id, status, status),
        ).fetchall()
        return [self.get_review(system_id, row["id"]) for row in rows]

    # ------------------------------------------------------------------
    # Finding waivers (SB2-100, D-P2-56)

    def list_waivers(self, system_id: str) -> list[dict]:
        return [dict(row) for row in self.conn.execute(
            "SELECT id, finding_key, rule, note, created_by, created_at FROM system_finding_waivers"
            " WHERE system_id = %s ORDER BY rule, finding_key", (system_id,)).fetchall()]

    def add_waiver(self, change: Mutation, *, finding_key: str, rule: str, note: str, created_by: str,
                   waiver_id: Optional[str] = None, created_at: Any = None) -> dict:
        """Waive one finding. ``waiver_id`` and ``created_at`` are kept when a manifest restores one."""
        if not note.strip():
            raise Invalid("a waiver needs a note")
        exists = self.conn.execute(
            "SELECT 1 FROM system_finding_waivers WHERE system_id = %s AND finding_key = %s",
            (change.system_id, finding_key)).fetchone()
        if exists:
            raise Conflict("finding_waived: this finding is already waived")
        row = self.conn.execute(
            """
            INSERT INTO system_finding_waivers (id, system_id, finding_key, rule, note, created_by, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, COALESCE(%s, NOW()))
            RETURNING id, finding_key, rule, note, created_by, created_at
            """,
            (_given_id("sfw_", waiver_id), change.system_id, finding_key, rule, note.strip(), created_by, created_at),
        ).fetchone()
        change.audit("finding_waived", {"waiverId": row["id"], "rule": rule, "findingKey": finding_key,
                                        "note": row["note"]})
        return dict(row)

    def delete_waiver(self, change: Mutation, waiver_id: str) -> None:
        row = self.conn.execute(
            "DELETE FROM system_finding_waivers WHERE system_id = %s AND id = %s RETURNING rule, finding_key",
            (change.system_id, waiver_id)).fetchone()
        if row is None:
            raise NotFound("Waiver not found")
        change.audit("finding_unwaived", {"waiverId": waiver_id, "rule": row["rule"], "findingKey": row["finding_key"]})

    # ------------------------------------------------------------------
    # Last finding counts (SB2-101)

    def record_finding_counts(self, system_id: str, version: int, counts: Mapping[str, Any]) -> None:
        """Keep the counts of the newest version built; an older build never overwrites a newer one."""
        self.conn.execute(
            """
            INSERT INTO system_finding_counts (system_id, version, counts) VALUES (%s, %s, %s)
            ON CONFLICT (system_id) DO UPDATE SET version = EXCLUDED.version, counts = EXCLUDED.counts,
                counted_at = NOW()
            WHERE system_finding_counts.version < EXCLUDED.version
            """,
            (system_id, int(version), Jsonb(dict(counts))),
        )

    def list_extras(self, system_ids: Sequence[str]) -> dict[str, dict]:
        """For the systems list, in one query: the last snapshot, the git link and the last counts."""
        rows = self.conn.execute(
            """
            SELECT s.id,
                   (SELECT jsonb_build_object('id', n.id, 'name', n.name, 'createdAt', n.created_at)
                      FROM system_snapshots n WHERE n.system_id = s.id ORDER BY n.created_at DESC LIMIT 1) AS last_snapshot,
                   g.branch AS git_branch, g.outside_commit IS NOT NULL AS git_outside, g.last_error IS NOT NULL AS git_error,
                   c.version AS counted_version, c.counts
            FROM system_projects s
            LEFT JOIN system_git_links g ON g.system_id = s.id
            LEFT JOIN system_finding_counts c ON c.system_id = s.id
            WHERE s.id = ANY(%s)
            """,
            (list(system_ids),),
        ).fetchall()
        return {row["id"]: dict(row) for row in rows}

    # ------------------------------------------------------------------
    # Import sessions (§9.3)

    IMPORT_RETENTION_DAYS = 7

    def create_import_session(
        self, system_id: str, *, actor: str, filename: str, delimiter: str, content: str, row_count: int,
    ) -> dict:
        self.get_system(system_id)
        self.conn.execute(
            """
            DELETE FROM system_import_sessions
            WHERE system_id = %s AND committed_at IS NULL
              AND created_at < NOW() - make_interval(days => %s)
            """,
            (system_id, self.IMPORT_RETENTION_DAYS),
        )
        row = self.conn.execute(
            """
            INSERT INTO system_import_sessions (id, system_id, created_by, filename, delimiter, content, row_count)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING *
            """,
            (new_id("sim_"), system_id, actor, filename, delimiter, content, int(row_count)),
        ).fetchone()
        return dict(row)

    def get_import_session(self, system_id: str, import_id: str, *, lock: bool = False) -> dict:
        row = self.conn.execute(
            "SELECT * FROM system_import_sessions WHERE system_id = %s AND id = %s"
            + (" FOR UPDATE" if lock else ""),
            (system_id, import_id),
        ).fetchone()
        if row is None:
            raise NotFound("Import not found")
        return dict(row)

    def mark_import_committed(self, change: Mutation, import_id: str, report: Mapping[str, Any]) -> None:
        self.conn.execute(
            "UPDATE system_import_sessions SET committed_at = NOW(), committed_by = %s WHERE id = %s",
            (change.actor, import_id),
        )
        change.audit("import_committed", {"importId": import_id, **dict(report)})

    # ------------------------------------------------------------------
    # Audit history

    def instance_projects(self, system_id: str) -> dict[str, str]:
        """Every instance the system has had, current or removed, and its project."""

        rows = self.conn.execute(
            """
            SELECT id, project_id FROM system_instances WHERE system_id = %s AND project_id IS NOT NULL
            UNION
            SELECT payload->>'instanceId', payload->>'projectId' FROM system_audit_events
            WHERE system_id = %s AND kind IN ('instance_added', 'instance_removed')
              AND payload ? 'instanceId' AND payload->>'projectId' IS NOT NULL
            """,
            (system_id, system_id),
        ).fetchall()
        return {row["id"]: row["project_id"] for row in rows}

    def history(self, system_id: str, *, before_seq: Optional[int] = None, limit: int = 100) -> list[dict]:
        rows = self.conn.execute(
            """
            SELECT seq, id, at, actor, kind, payload FROM system_audit_events
            WHERE system_id = %s AND (%s::bigint IS NULL OR seq < %s::bigint)
            ORDER BY seq DESC LIMIT %s
            """,
            (system_id, before_seq, before_seq, max(1, min(int(limit), 500))),
        ).fetchall()
        return [dict(row) for row in rows]

    # ------------------------------------------------------------------
    # Layout (§1 invariant 6: no version, no audit)

    def get_layout(self, system_id: str) -> dict:
        self.get_system(system_id)
        row = self.conn.execute(
            "SELECT positions FROM system_layouts WHERE system_id = %s", (system_id,)
        ).fetchone()
        return dict(row["positions"]) if row else {}

    def put_layout(self, system_id: str, positions: Mapping[str, Any]) -> None:
        self.get_system(system_id)
        self.conn.execute(
            """
            INSERT INTO system_layouts (system_id, positions) VALUES (%s, %s)
            ON CONFLICT (system_id) DO UPDATE
                SET positions = EXCLUDED.positions, updated_at = NOW()
            """,
            (system_id, Jsonb(dict(positions))),
        )

    # ------------------------------------------------------------------
    # Interface artifact cache (§3)

    def get_interface(self, project_id: str, commit: str, extractor_version: str) -> Optional[dict]:
        """An artifact, parsed once per process (SB2-93); the nested data is shared and read-only."""
        key = (project_id, commit, extractor_version)
        cached = interface_cache.interfaces.get(key)
        if cached is not None:
            return dict(cached)
        row = self.conn.execute(
            """
            SELECT payload, pg_column_size(payload) AS stored FROM system_interface_artifacts
            WHERE project_id = %s AND commit = %s AND extractor_version = %s
            """,
            key,
        ).fetchone()
        if not row:
            return None
        return dict(interface_cache.interfaces.put(key, row["payload"], row["stored"]))

    def get_interface_extent(self, project_id: str, commit: str, extractor_version: str) -> Optional[dict]:
        """The scene's slice of an artifact (outline and thickness), without the multi-MB payload."""
        cached = interface_cache.interfaces.get((project_id, commit, extractor_version))
        if cached is not None:
            return {"boardOutlineMm": cached.get("boardOutlineMm"), "boardThicknessMm": cached.get("boardThicknessMm")}
        row = self.conn.execute(
            """
            SELECT jsonb_build_object('boardOutlineMm', payload->'boardOutlineMm',
                                      'boardThicknessMm', payload->'boardThicknessMm') AS extent
            FROM system_interface_artifacts
            WHERE project_id = %s AND commit = %s AND extractor_version = %s
            """,
            (project_id, commit, extractor_version),
        ).fetchone()
        return dict(row["extent"]) if row else None

    def get_interface_component(self, project_id: str, commit: str, extractor_version: str,
                                port_key: str) -> Optional[dict]:
        """One component of an artifact by its port key. SB2-93: read through the process cache, which
        holds the whole artifact; a board's mated connectors then cost one read instead of one each."""
        key = (project_id, commit, extractor_version)
        if interface_cache.interfaces.get(key) is None:
            self.get_interface(*key)
        cached, component = interface_cache.interfaces.component(key, port_key)
        if not cached:  # larger than the whole cache budget: read just this component
            row = self.conn.execute(
                """
                SELECT c AS component FROM system_interface_artifacts a, jsonb_array_elements(a.payload->'components') c
                WHERE a.project_id = %s AND a.commit = %s AND a.extractor_version = %s AND c->>'portKey' = %s
                LIMIT 1
                """,
                (*key, port_key),
            ).fetchone()
            component = row["component"] if row else None
        if component is None:
            return None
        extent = self.get_interface_extent(*key) or {}
        return {**component, "boardThicknessMm": extent.get("boardThicknessMm")}

    def put_interface(self, payload: Mapping[str, Any]) -> dict:
        """Store an artifact; the first writer wins, and its copy is returned."""
        project_id, commit = payload["projectId"], payload["commit"]
        version = payload["extractor"]["version"]
        self.conn.execute(
            """
            INSERT INTO system_interface_artifacts
                (project_id, commit, extractor_version, digest, payload)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (project_id, commit, extractor_version) DO NOTHING
            """,
            (project_id, commit, version, payload["digest"], Jsonb(dict(payload))),
        )
        stored = self.get_interface(project_id, commit, version)
        assert stored is not None
        return stored

    # ------------------------------------------------------------------
    # Detection bookkeeping (§10.1)

    def get_source_check(self, instance_id: str) -> Optional[dict]:
        row = self.conn.execute(
            "SELECT * FROM system_source_checks WHERE instance_id = %s", (instance_id,)
        ).fetchone()
        return dict(row) if row else None

    def record_source_check(
        self, instance_id: str, *, tip_commit: Optional[str], checked_commit: Optional[str],
        outcome: str, retry: bool = False,
    ) -> None:
        """Record what detection saw. Not a design change: no version bump, no audit.

        ``retry`` forgets the checked commit, so the next check evaluates the tip again.
        """
        self.conn.execute(
            "UPDATE system_instances SET tip_commit = %s, tip_checked_at = NOW() WHERE id = %s",
            (tip_commit, instance_id),
        )
        self.conn.execute(
            """
            INSERT INTO system_source_checks (instance_id, last_checked_commit, last_outcome)
            VALUES (%s, %s, %s)
            ON CONFLICT (instance_id) DO UPDATE SET
                last_checked_commit = CASE WHEN %s THEN NULL ELSE COALESCE(
                    EXCLUDED.last_checked_commit, system_source_checks.last_checked_commit) END,
                last_outcome = EXCLUDED.last_outcome,
                checked_at = NOW()
            """,
            (instance_id, checked_commit, outcome, retry),
        )
