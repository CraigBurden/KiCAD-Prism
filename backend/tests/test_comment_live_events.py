from __future__ import annotations

import threading
import unittest
from concurrent.futures import ThreadPoolExecutor

from app.services import comment_live_events
from support.postgres import requires_scratch_postgres, scratch_schema


@requires_scratch_postgres("comment live event tests")
class CommentLiveEventsPostgresTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "comment_live_test", then=(comment_live_events.apply_schema,))

    def _connect(self):
        return self.scratch.connect(autocommit=True)

    def test_rollback_does_not_advance_replay_cursor(self) -> None:
        with self._connect() as conn:
            with self.assertRaises(RuntimeError), conn.transaction():
                comment_live_events.record_change(
                    conn, project_id="p1", comment_id="c1", scope="canvas", change_kind="upsert"
                )
                raise RuntimeError("abort comment mutation")

            self.assertEqual(comment_live_events.current_cursor(conn, "p1"), 0)
            self.assertEqual(comment_live_events.changes_after(conn, "p1", 0), [])

            with conn.transaction():
                cursor = comment_live_events.record_change(
                    conn, project_id="p1", comment_id="c1", scope="canvas", change_kind="upsert"
                )
            self.assertEqual(cursor, 1)
            self.assertEqual(comment_live_events.current_cursor(conn, "p1"), 1)

    def test_concurrent_writers_commit_in_cursor_order(self) -> None:
        first_recorded = threading.Event()
        release_first = threading.Event()

        def first_writer() -> int:
            with self._connect() as conn, conn.transaction():
                cursor = comment_live_events.record_change(
                    conn, project_id="p1", comment_id="c1", scope="canvas", change_kind="upsert"
                )
                first_recorded.set()
                if not release_first.wait(5):
                    raise TimeoutError("first writer was not released")
                return cursor

        def second_writer() -> int:
            with self._connect() as conn, conn.transaction():
                return comment_live_events.record_change(
                    conn, project_id="p1", comment_id="c2", scope="canvas", change_kind="delete"
                )

        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(first_writer)
            self.assertTrue(first_recorded.wait(5))
            second = pool.submit(second_writer)
            release_first.set()
            self.assertEqual(first.result(timeout=5), 1)
            self.assertEqual(second.result(timeout=5), 2)

        with self._connect() as conn:
            self.assertEqual(
                [(row["cursor"], row["commentId"]) for row in comment_live_events.changes_after(conn, "p1", 0)],
                [(1, "c1"), (2, "c2")],
            )
            self.assertEqual(
                [row["commentId"] for row in comment_live_events.changes_after(conn, "p1", 1)],
                ["c2"],
            )


if __name__ == "__main__":
    unittest.main()
