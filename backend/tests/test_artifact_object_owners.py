"""Job artifacts and catalog artifacts share one content-addressed object tree.

By default both stores write ``<projects>/.kicad-prism/artifacts/objects/sha256``.
Neither collector may remove a file the other still owns.
"""

from __future__ import annotations

import gzip
import io
import os
import tempfile
import time
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest import mock

from app.services import job_service
from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService
from app.services.job_artifact_service import JobArtifactService
from app.services.local_artifact_store import LocalArtifactStore


POSTGRES_URL = os.environ.get("PRISM_DATABASE_URL", "").strip()


def _age_file(path: Path, seconds: float) -> None:
    old = time.time() - seconds
    os.utime(path, (old, old))


@unittest.skipUnless(POSTGRES_URL, "PRISM_DATABASE_URL is required for catalog artifact rows")
class SharedObjectTreeOwnershipTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        # The artifact store indexes catalog tables, so the catalog schema comes first.
        with tempfile.TemporaryDirectory() as temporary:
            ComponentCatalogPostgresService(
                store_root=Path(temporary) / "catalog",
                database_url=POSTGRES_URL,
            ).initialize()

    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        # The production defaults: the job root is <projects>/.kicad-prism and the
        # catalog root is <projects>/.kicad-prism/artifacts, so both land on
        # <projects>/.kicad-prism/artifacts/objects/sha256.
        self.catalog = LocalArtifactStore(self.root / "artifacts")
        self.job_artifacts = JobArtifactService(self.root)
        self.assertEqual(self.catalog.objects, self.job_artifacts.objects)
        self.job_references: set[str] = set()
        patcher = mock.patch.object(
            job_service.jobs,
            "referenced_object_paths",
            side_effect=lambda: set(self.job_references),
        )
        patcher.start()
        self.addCleanup(patcher.stop)

    def _put_catalog_object(self, *, age: timedelta) -> Path:
        stored = self.catalog.put_stream(io.BytesIO(f"catalog-{uuid.uuid4()}".encode()))
        with self.catalog._connect() as conn:
            conn.execute(
                "UPDATE catalog_artifacts SET created_at = %s WHERE sha256 = %s",
                (datetime.now(timezone.utc) - age, stored.sha256),
            )
            conn.commit()
        _age_file(stored.path, age.total_seconds())
        return stored.path

    def _storage_state(self, path: Path) -> str:
        with self.catalog._connect() as conn:
            row = conn.execute(
                "SELECT storage_state FROM catalog_artifacts WHERE sha256 = %s", (path.name,)
            ).fetchone()
        return str(row["storage_state"])

    def test_old_catalog_object_survives_job_garbage_collection(self) -> None:
        catalog_object = self._put_catalog_object(age=timedelta(days=2))
        orphan = self.job_artifacts.objects / "ab" / "cd" / ("f" * 64)
        orphan.parent.mkdir(parents=True, exist_ok=True)
        orphan.write_bytes(b"orphan")
        _age_file(orphan, 2 * 24 * 3600)

        result = self.job_artifacts.collect_unreferenced_objects(grace_seconds=24 * 3600)

        self.assertTrue(catalog_object.is_file(), "catalog-owned object was collected as job garbage")
        self.assertFalse(orphan.exists())
        self.assertEqual(result["objects_removed"], 1)

    def test_job_referenced_object_survives_catalog_quarantine(self) -> None:
        shared = self._put_catalog_object(age=timedelta(days=60))
        self.job_references.add(str(shared))

        self.catalog.quarantine_unreferenced_before(datetime.now(timezone.utc) - timedelta(days=30))

        self.assertTrue(shared.is_file(), "catalog quarantine moved an object a job artifact references")
        self.assertEqual(self._storage_state(shared), "available")

    def test_job_referenced_object_survives_catalog_archive(self) -> None:
        shared = self._put_catalog_object(age=timedelta(days=120))
        self.job_references.add(str(shared))

        self.catalog.archive_unreleased_before(datetime.now(timezone.utc) - timedelta(days=90))

        self.assertTrue(shared.is_file(), "catalog archive removed an object a job artifact references")
        self.assertEqual(self._storage_state(shared), "available")

    def test_unreferenced_catalog_object_is_still_quarantined(self) -> None:
        unowned = self._put_catalog_object(age=timedelta(days=60))

        self.catalog.quarantine_unreferenced_before(datetime.now(timezone.utc) - timedelta(days=30))

        self.assertFalse(unowned.exists())
        self.assertEqual(self._storage_state(unowned), "quarantined")

    def test_archived_object_is_restored_through_the_store(self) -> None:
        path = self._put_catalog_object(age=timedelta(days=120))
        payload = path.read_bytes()
        self.catalog.archive_unreleased_before(datetime.now(timezone.utc) - timedelta(days=90))
        self.assertFalse(path.exists())

        restored = self.catalog.ensure_available(path.name)

        self.assertEqual(restored, path)
        self.assertEqual(restored.read_bytes(), payload)
        self.assertEqual(self._storage_state(path), "available")

    def test_corrupt_archive_is_never_published(self) -> None:
        path = self._put_catalog_object(age=timedelta(days=120))
        self.catalog.archive_unreleased_before(datetime.now(timezone.utc) - timedelta(days=90))
        with self.catalog._connect() as conn:
            archived = Path(
                conn.execute(
                    "SELECT archived_path FROM catalog_artifacts WHERE sha256 = %s", (path.name,)
                ).fetchone()["archived_path"]
            )
        with gzip.open(archived, "wb") as output:
            output.write(b"tampered")

        with self.assertRaisesRegex(ValueError, "failed integrity verification"):
            self.catalog.ensure_available(path.name)

        self.assertFalse(path.exists())
        self.assertEqual(list(self.catalog.staging.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
