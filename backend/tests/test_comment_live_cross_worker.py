"""Two independent PostgreSQL listeners see one committed comment event."""

from __future__ import annotations

import asyncio
import time
import unittest
import uuid
from unittest.mock import patch

from app.services import comment_live_events
from app.services import comment_live_broker as broker_module
from app.services.comment_live_broker import CommentLiveBroker
from support.postgres import CATALOG_URL, requires_scratch_postgres, scratch_schema


@requires_scratch_postgres("comment notification tests")
class CrossWorkerCommentNotificationTests(unittest.IsolatedAsyncioTestCase):
    async def test_both_listeners_wake_from_one_committed_event(self) -> None:
        scratch = scratch_schema(self, "test_comment_notify", then=(comment_live_events.apply_schema,))
        project_id = "p_" + uuid.uuid4().hex[:12]

        first = CommentLiveBroker()
        second = CommentLiveBroker()
        first_queue = first.subscribe(project_id)
        second_queue = second.subscribe(project_id)
        try:
            with patch.object(broker_module, "postgres_dsn", return_value=CATALOG_URL):
                first.start()
                second.start()
                await asyncio.wait_for(asyncio.gather(first.ready.wait(), second.ready.wait()), 5)
                started = time.perf_counter()
                with scratch.connection() as conn:
                    with conn.transaction():
                        comment_live_events.record_change(
                            conn, project_id=project_id, comment_id="c1",
                            scope="canvas", change_kind="upsert",
                        )
                await asyncio.wait_for(asyncio.gather(first_queue.get(), second_queue.get()), 2)
                self.assertLess(time.perf_counter() - started, 2)
                with scratch.connection() as conn:
                    self.assertEqual(comment_live_events.changes_after(conn, project_id, 0)[0]["cursor"], 1)
        finally:
            await first.stop()
            await second.stop()


if __name__ == "__main__":
    unittest.main()
