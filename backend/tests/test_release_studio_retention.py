"""Retention and filesystem-GC behavior for Release Studio artifact pins."""

from __future__ import annotations

import hashlib
import os
import sys
import tempfile
import unittest
import uuid
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

from app.services.job_artifact_service import JobArtifactService  # noqa: E402
from app.services.job_service import JobService  # noqa: E402
from app.services.object_store import ReferenceOwner  # noqa: E402
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER  # noqa: E402
from support.postgres import requires_scratch_postgres, scratch_schema  # noqa: E402


class TestDatabaseJobService(JobService):
    """Run the production JobService SQL against the isolated test database."""

    def __init__(self, scratch) -> None:
        self.scratch = scratch
        self.schema = scratch.name

    def initialize(self) -> None:
        # The fixture creates only the workspace tables needed by these methods.
        # In particular, never initialize the process-global application pool.
        return None

    def _set_workspace_search_path(self, conn) -> None:
        conn.execute(f'SET search_path TO "{self.schema}", public')

    def _connect(self):
        return self.scratch.connection()


@requires_scratch_postgres("Release Studio retention tests")
class ReleaseStudioRetentionPostgresTests(unittest.TestCase):
    """Exercise R9 against a disposable PostgreSQL workspace schema."""

    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "release_r9", ledgers=(WORKSPACE_LEDGER,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn

        self.service = TestDatabaseJobService(self.scratch)
        self.tempdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tempdir.cleanup)
        self.artifacts = JobArtifactService(Path(self.tempdir.name))
        self.job_ids: list[str] = []
        self.artifact_ids: list[str] = []

    def _artifact(
        self,
        *,
        readiness: str = "ready",
        invalidated: bool = False,
        pinned: bool = False,
        object_path: str | None = None,
    ) -> str:
        job_id = f"r9-job-{uuid.uuid4().hex}"
        artifact_id = f"r9-artifact-{uuid.uuid4().hex}"
        artifact_path = object_path or str(
            Path(self.tempdir.name) / f"{artifact_id}.bin"
        )
        self.conn.execute(
            """
            INSERT INTO ws_jobs(
                id, kind, status, created_at, updated_at, completed_at
            )
            VALUES (
                %s, %s, 'completed',
                NOW() - INTERVAL '1 hour',
                NOW() - INTERVAL '1 hour',
                NOW() - INTERVAL '1 hour'
            )
            """,
            (job_id, "release-studio-r9"),
        )
        self.conn.execute(
            """
            INSERT INTO ws_artifacts(
                id, kind, artifact_key, digest, object_path, readiness,
                source_job_id, created_at, last_accessed_at, invalidated_at
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                NOW() - INTERVAL '1 hour',
                NOW() - INTERVAL '1 hour',
                CASE
                    WHEN %s THEN NOW() - INTERVAL '1 hour'
                    ELSE NULL
                END
            )
            """,
            (
                artifact_id,
                "release-studio-r9",
                artifact_id,
                hashlib.sha256(artifact_id.encode()).hexdigest(),
                artifact_path,
                readiness,
                job_id,
                invalidated,
            ),
        )
        if pinned:
            self.conn.execute(
                """
                INSERT INTO ws_artifact_release_pins(artifact_id, pin_kind, pin_ref)
                VALUES (%s, 'release_studio', %s)
                """,
                (artifact_id, f"release-{artifact_id}"),
            )
        self.conn.commit()
        self.job_ids.append(job_id)
        self.artifact_ids.append(artifact_id)
        return artifact_id

    def _object_path(self, label: str) -> Path:
        digest = hashlib.sha256(label.encode()).hexdigest()
        return self.artifacts.objects / digest[:2] / digest[2:4] / digest

    def test_expired_pinned_artifact_survives_general_pruning(self) -> None:
        pinned = self._artifact(pinned=True)
        unpinned = self._artifact()

        pruned = self.service.prune_artifact_metadata(
            retention_seconds=0,
            partial_retention_seconds=0,
            invalid_retention_seconds=0,
        )

        self.assertEqual(pruned, 1)
        rows = self.conn.execute(
            "SELECT id FROM ws_artifacts WHERE id = ANY(%s)",
            ([pinned, unpinned],),
        ).fetchall()
        self.assertEqual({str(row["id"]) for row in rows}, {pinned})

    def test_pinned_invalid_and_partial_artifacts_survive_pruning(self) -> None:
        cases = (
            ("invalid", "invalid", True),
            ("partial", "partial", False),
        )
        for label, readiness, invalidated in cases:
            with self.subTest(label=label):
                pinned = self._artifact(
                    readiness=readiness,
                    invalidated=invalidated,
                    pinned=True,
                )
                unpinned = self._artifact(
                    readiness=readiness,
                    invalidated=invalidated,
                )

                pruned = self.service.prune_artifact_metadata(
                    retention_seconds=0,
                    partial_retention_seconds=0,
                    invalid_retention_seconds=0,
                )

                self.assertEqual(pruned, 1)
                rows = self.conn.execute(
                    "SELECT id FROM ws_artifacts WHERE id = ANY(%s)",
                    ([pinned, unpinned],),
                ).fetchall()
                self.assertEqual({str(row["id"]) for row in rows}, {pinned})

    def test_referenced_paths_include_pinned_invalidated_artifacts(self) -> None:
        pinned_path = self._object_path("pinned-invalidated")
        unpinned_path = self._object_path("unpinned-invalidated")
        self._artifact(
            invalidated=True,
            pinned=True,
            object_path=str(pinned_path),
        )
        self._artifact(invalidated=True, object_path=str(unpinned_path))

        paths = self.service.referenced_object_paths()

        self.assertIn(str(pinned_path), paths)
        self.assertNotIn(str(unpinned_path), paths)

    def test_filesystem_gc_preserves_pinned_invalidated_object(self) -> None:
        pinned_path = self._object_path("gc-pinned")
        unpinned_path = self._object_path("gc-unpinned")
        for path in (pinned_path, unpinned_path):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(path.name.encode())
            old = max(0.0, path.stat().st_mtime - 3600)
            os.utime(path, (old, old))

        self._artifact(
            invalidated=True,
            pinned=True,
            object_path=str(pinned_path),
        )
        self._artifact(invalidated=True, object_path=str(unpinned_path))

        referenced = self.service.referenced_object_paths()
        self.assertIn(str(pinned_path), referenced)
        self.assertNotIn(str(unpinned_path), referenced)

        result = self.artifacts.collect_unreferenced_objects(
            owners=[ReferenceOwner("jobs", self.service.referenced_object_paths)],
            grace_seconds=0,
        )

        self.assertTrue(pinned_path.exists())
        self.assertFalse(unpinned_path.exists())
        self.assertEqual(result["objects_removed"], 1)


if __name__ == "__main__":
    unittest.main()
