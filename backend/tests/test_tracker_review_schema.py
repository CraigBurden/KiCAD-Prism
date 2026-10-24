"""Review probes: comments migration 4 creates sync tables (H1) and delete cascades (H4)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.comments_schema_migrations import COMMENTS_LEDGER  # noqa: E402
from app.services.comments_store_schema import create_base_tables  # noqa: E402
from app.services.trackers.migrations import (  # noqa: E402
    cascade_comments_tracker_fks,
    cascade_workspace_tracker_fks,
    migrate_workspace_tracker_tables,
)
from app.services.trackers.store import TrackerStore  # noqa: E402
from support.postgres import (  # noqa: E402
    requires_scratch_postgres,
    scratch_schema,
    comments_store_on,
    seed_comment,
    seed_reply,
)

try:
    import psycopg
    from psycopg.errors import ForeignKeyViolation
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover
    psycopg = None  # type: ignore[assignment]
    ForeignKeyViolation = Exception  # type: ignore[misc, assignment]
    dict_row = None  # type: ignore[assignment]



@requires_scratch_postgres("tracker persistence tests")
class CommentsMigrationReviewPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        # The comment base tables as a database had them before the ledger's later steps.
        self.scratch = scratch_schema(self, "trh14", then=(create_base_tables,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn

    def test_h1_comments_migrate_creates_sync_tables_without_test_apply_schema(self) -> None:
        COMMENTS_LEDGER.apply(self.conn)
        self.conn.commit()
        tables = {
            row["table_name"]
            for row in self.conn.execute(
                """
                SELECT table_name FROM information_schema.tables
                WHERE table_schema = %s
                """,
                (self.schema,),
            ).fetchall()
        }
        self.assertGreaterEqual(
            tables,
            {
                "sync_ops",
                "remote_deliveries",
                "remote_hints",
                "sync_checkpoints",
                "tracked_threads",
                "tracked_replies",
            },
        )
        ledger = {
            int(row["version"])
            for row in self.conn.execute("SELECT version FROM comment_schema_migrations").fetchall()
        }
        self.assertIn(4, ledger)

    def test_h4_delete_project_comments_after_link_does_not_fk_violate(self) -> None:
        COMMENTS_LEDGER.apply(self.conn)
        self.conn.commit()
        store = comments_store_on(self.scratch)
        seed_comment(self.conn, "c_1", "prj_a", content="stub")
        seed_reply(self.conn, "r_1", "c_1", "prj_a", content="ack")
        self.conn.execute(
            """
            INSERT INTO tracked_threads (
                id, comment_id, project_tracker_id, destination_generation,
                connector_id, remote_container_id, external_id, link_state
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            ("tt_1", "c_1", "pt_a", 2, "cn_gh1", "111", "412", "linked"),
        )
        self.conn.execute(
            """
            INSERT INTO tracked_replies (id, tracked_thread_id, reply_id, external_comment_id)
            VALUES (%s,%s,%s,%s)
            """,
            ("tr_1", "tt_1", "r_1", "2211003"),
        )
        self.conn.execute(
            """
            INSERT INTO sync_ops (id, tracked_thread_id, op, destination_generation)
            VALUES (%s,%s,%s,%s)
            """,
            ("op_1", "tt_1", "create_issue", 2),
        )
        self.conn.commit()
        store.delete_project_comments("prj_a")
        leftover = self.conn.execute(
            """
            SELECT
                (SELECT COUNT(*) FROM comments WHERE project_id = 'prj_a') AS comments,
                (SELECT COUNT(*) FROM tracked_threads) AS threads,
                (SELECT COUNT(*) FROM tracked_replies) AS replies,
                (SELECT COUNT(*) FROM sync_ops) AS ops
            """
        ).fetchone()
        self.assertEqual(int(leftover["comments"]), 0)
        self.assertEqual(int(leftover["threads"]), 0)
        self.assertEqual(int(leftover["replies"]), 0)
        self.assertEqual(int(leftover["ops"]), 0)

    def test_h4_connector_delete_cascades_project_trackers(self) -> None:
        migrate_workspace_tracker_tables(self.conn)
        cascade_workspace_tracker_fks(self.conn)
        self.conn.commit()
        store = TrackerStore(self.conn)
        store.upsert_connector(connector_id="cn_gh1", provider="github", instance_kind="github.com")
        store.set_project_tracker(
            project_tracker_id="pt_a",
            project_id="prj_a",
            connector_id="cn_gh1",
            container_kind="repo",
            container_path="acme/openswitch",
            remote_container_id="111",
            generation=2,
        )
        self.conn.commit()
        self.conn.execute("DELETE FROM tracker_connectors WHERE id = 'cn_gh1'")
        self.conn.commit()
        leftover = self.conn.execute("SELECT COUNT(*) AS n FROM project_trackers").fetchone()
        self.assertEqual(int(leftover["n"]), 0)

    def test_h4_existing_non_cascade_fk_is_rewritten(self) -> None:
        self.conn.execute(
            """
            CREATE TABLE tracked_threads (
                id TEXT PRIMARY KEY,
                comment_id TEXT NOT NULL REFERENCES comments(id),
                project_tracker_id TEXT NOT NULL,
                destination_generation INTEGER NOT NULL,
                connector_id TEXT NOT NULL,
                remote_container_id TEXT NOT NULL,
                external_id TEXT NOT NULL,
                link_state TEXT NOT NULL,
                lineage JSONB NOT NULL DEFAULT '[]'::jsonb
            );
            CREATE TABLE tracked_replies (
                id TEXT PRIMARY KEY,
                tracked_thread_id TEXT NOT NULL REFERENCES tracked_threads(id),
                reply_id TEXT NOT NULL REFERENCES comment_replies(id),
                external_comment_id TEXT NOT NULL
            );
            CREATE TABLE sync_ops (
                id TEXT PRIMARY KEY,
                tracked_thread_id TEXT NOT NULL REFERENCES tracked_threads(id),
                op TEXT NOT NULL,
                destination_generation INTEGER NOT NULL DEFAULT 1
            );
            """,
            prepare=False,
        )
        seed_comment(self.conn, "c_old", "prj_a", content="stub")
        self.conn.execute(
            """
            INSERT INTO tracked_threads (
                id, comment_id, project_tracker_id, destination_generation,
                connector_id, remote_container_id, external_id, link_state
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """,
            ("tt_old", "c_old", "pt_a", 1, "cn_gh1", "111", "412", "linked"),
        )
        self.conn.commit()
        with self.assertRaises(ForeignKeyViolation):
            self.conn.execute("DELETE FROM comments WHERE id = 'c_old'")
        self.scratch.reset_path()
        cascade_comments_tracker_fks(self.conn)
        self.conn.commit()
        self.conn.execute("DELETE FROM comments WHERE id = 'c_old'")
        self.conn.commit()
        leftover = self.conn.execute("SELECT COUNT(*) AS n FROM tracked_threads").fetchone()
        self.assertEqual(int(leftover["n"]), 0)
