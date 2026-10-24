"""Project deletion must cascade Release Studio listings instead of 500ing."""

from __future__ import annotations

import asyncio
import sys
import tempfile
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

from app.core.errors import DomainError  # noqa: E402
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER  # noqa: E402
from support.postgres import (  # noqa: E402
    requires_scratch_postgres, scratch_schema, seed_job, seed_project, seed_repository,
)
from app.services.workspace_service import (  # noqa: E402
    ProjectHasSignedReleasesError,
    WorkspaceService,
)


# A route refuses with an HTTPException or a typed domain error (rendered by the app handler).
ROUTE_ERRORS = (HTTPException, DomainError)


def _run(coro):
    return asyncio.run(coro)


class _User:
    def __init__(self, role: str) -> None:
        self.role = role
        self.email = f"{role}@example.test"
        self.name = role
        self.auth_type = "session"


@requires_scratch_postgres("workspace delete tests")
class WorkspaceDeleteProjectTests(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "ws_del", ledgers=(WORKSPACE_LEDGER,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn

        service = WorkspaceService()
        @contextmanager
        def _connect():
            conn = self.scratch.connect()
            try:
                yield conn
                if not conn.closed:
                    conn.rollback()
            finally:
                conn.close()

        self.service = service
        self.service._connect = _connect  # type: ignore[method-assign]

    def _seed_unsigned_history(self) -> str:
        suffix = uuid.uuid4().hex[:8]
        project_id = f"prj_{suffix}"
        repo_id = f"repo_{suffix}"
        seed_repository(self.conn, repo_id)
        seed_project(self.conn, project_id, repo_id)
        self.conn.execute(
            """
            INSERT INTO ws_release_candidates(
                id, project_id, repository_id, config_key, commit_sha, variant,
                technical_config_digest, input_closure_digest, toolchain_digest,
                generator_build, build_key, status
            )
            VALUES (%s, %s, %s, 'default', 'commit-1', '',
                    'technical-1', 'closure-1', 'toolchain-1', 'generator-1',
                    %s, 'built')
            """,
            (f"cand_{suffix}", project_id, repo_id, f"build-key-{suffix}"),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_waivers(
                id, project_id, config_key, rule_id, domain, subject_pattern,
                finding_key, reason, owner
            )
            VALUES (%s, %s, 'default', 'rule-1', 'bare_board', '*',
                    'finding-1', 'temporary lab exception', 'owner@example.test')
            """,
            (f"waiver_{suffix}", project_id),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_audit_events(
                id, project_id, config_key, sequence, event_type, actor,
                subject_kind, subject_id, previous_hash, event_hash, created_at_iso
            )
            VALUES (%s, %s, 'default', 1, 'candidate.created', 'user@example.test',
                    'candidate', %s, NULL, 'event-hash-1', '2026-01-01T00:00:00Z')
            """,
            (f"audit_{suffix}", project_id, f"cand_{suffix}"),
        )
        self.conn.commit()
        return project_id

    def _seed_signed_release(self) -> str:
        suffix = uuid.uuid4().hex[:8]
        ids = {
            "project": f"prj_{suffix}",
            "repository": f"repo_{suffix}",
            "job": f"job_{suffix}",
            "candidate": f"cand_{suffix}",
            "build": f"build_{suffix}",
            "artifact_dossier": f"art_d_{suffix}",
            "artifact_evidence": f"art_e_{suffix}",
            "artifact_attestation": f"art_a_{suffix}",
            "key": f"key_{suffix}",
            "record": f"rel_{suffix}",
        }
        seed_repository(self.conn, ids["repository"])
        seed_project(self.conn, ids["project"], ids["repository"])
        seed_job(self.conn, ids["job"], "release-build", "queued")
        for artifact_id, kind in (
            (ids["artifact_dossier"], "release-dossier"),
            (ids["artifact_evidence"], "release-evidence"),
            (ids["artifact_attestation"], "release-attestation"),
        ):
            self.conn.execute(
                """
                INSERT INTO ws_artifacts(id, kind, artifact_key, digest, object_path)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (artifact_id, kind, artifact_id, f"digest-{artifact_id}", f"objects/{artifact_id}"),
            )
        self.conn.execute(
            """
            INSERT INTO ws_release_candidates(
                id, project_id, repository_id, config_key, commit_sha, variant,
                technical_config_digest, input_closure_digest, toolchain_digest,
                generator_build, build_key, status
            )
            VALUES (%s, %s, %s, 'default', 'commit-1', '',
                    'technical-1', 'closure-1', 'toolchain-1', 'generator-1',
                    %s, 'built')
            """,
            (ids["candidate"], ids["project"], ids["repository"], f"build-key-{suffix}"),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_builds(
                id, candidate_id, job_id, status, manifest_digest, dossier_digest,
                dossier_artifact_id, evidence_artifact_id
            )
            VALUES (%s, %s, %s, 'succeeded', 'manifest-1', 'dossier-1', %s, %s)
            """,
            (
                ids["build"],
                ids["candidate"],
                ids["job"],
                ids["artifact_dossier"],
                ids["artifact_evidence"],
            ),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_signing_keys(
                key_id, algorithm, public_key, valid_from, created_by
            )
            VALUES (%s, 'ed25519', 'public-key-material', NOW(), 'security@example.test')
            """,
            (ids["key"],),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_records(
                id, project_id, config_key, candidate_id, build_id, release_label,
                dossier_digest, manifest_digest, attestation_digest, signature,
                signing_key_id, attestation_artifact_id, commit_sha, released_by
            )
            VALUES (%s, %s, 'default', %s, %s, 'REL-1', 'dossier-1', 'manifest-1',
                    'attestation-1', 'signature-1', %s, %s, 'commit-1',
                    'release@example.test')
            """,
            (
                ids["record"],
                ids["project"],
                ids["candidate"],
                ids["build"],
                ids["key"],
                ids["artifact_attestation"],
            ),
        )
        self.conn.execute(
            """
            INSERT INTO ws_release_audit_events(
                id, project_id, config_key, sequence, event_type, actor,
                subject_kind, subject_id, previous_hash, event_hash, created_at_iso
            )
            VALUES (%s, %s, 'default', 1, 'release.created', 'user@example.test',
                    'record', %s, NULL, 'event-hash-1', '2026-01-01T00:00:00Z')
            """,
            (f"audit_{suffix}", ids["project"], ids["record"]),
        )
        self.conn.commit()
        return ids["project"]

    def test_delete_removes_unsigned_release_studio_history(self) -> None:
        project_id = self._seed_unsigned_history()

        deleted = self.service.delete_project(project_id)

        self.assertTrue(deleted)
        remaining = self.conn.execute(
            "SELECT id FROM ws_projects WHERE id = %s",
            (project_id,),
        ).fetchone()
        self.assertIsNone(remaining)
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_audit_events WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            0,
        )
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_waivers WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            0,
        )
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_candidates WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            0,
        )

    def test_delete_without_force_keeps_signed_release_records(self) -> None:
        project_id = self._seed_signed_release()

        with self.assertRaises(ProjectHasSignedReleasesError):
            self.service.delete_project(project_id)

        self.assertIsNotNone(
            self.conn.execute(
                "SELECT id FROM ws_projects WHERE id = %s",
                (project_id,),
            ).fetchone()
        )
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_records WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            1,
        )

    def test_admin_force_delete_removes_signed_release_records(self) -> None:
        project_id = self._seed_signed_release()

        deleted = self.service.delete_project(project_id, force=True)

        self.assertTrue(deleted)
        self.assertIsNone(
            self.conn.execute(
                "SELECT id FROM ws_projects WHERE id = %s",
                (project_id,),
            ).fetchone()
        )
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_records WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            0,
        )
        self.assertEqual(
            self.conn.execute(
                "SELECT COUNT(*) AS n FROM ws_release_audit_events WHERE project_id = %s",
                (project_id,),
            ).fetchone()["n"],
            0,
        )


class DeleteProjectEndpointTests(unittest.TestCase):
    def test_designer_is_blocked_when_signed_releases_exist(self) -> None:
        from app.api import projects as api

        with patch.object(api, "authorized_project", return_value={"id": "prj_1"}), \
             patch.object(api.workspace, "get_project_by_id", return_value={"repo_id": "repo", "import_type": "single", "parent_repo_path": "/tmp/p"}), \
             patch.object(
                 api.workspace,
                 "delete_project",
                 side_effect=ProjectHasSignedReleasesError("prj_1", 1),
             ):
            with self.assertRaises(ROUTE_ERRORS) as caught:
                _run(api.delete_project_endpoint("prj_1", user=_User("designer")))

        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("signed release records", caught.exception.detail)

    def test_admin_delete_passes_force_true(self) -> None:
        from app.api import projects as api

        with patch.object(api, "authorized_project", return_value={"id": "prj_1"}), \
             patch.object(api.workspace, "get_project_by_id", return_value={"repo_id": "repo", "import_type": "single", "parent_repo_path": "/tmp/p"}), \
             patch.object(api.workspace, "delete_project", return_value=True) as delete_project, \
             patch.object(api.project_deletion.comments_store, "delete_project_comments"), \
             patch.object(api.workspace, "get_projects_by_repo", return_value=[]), \
             patch.object(api.workspace, "delete_repository"), \
             patch.object(api.project_service, "PROJECTS_ROOT", "/tmp"):
            result = _run(api.delete_project_endpoint("prj_1", user=_User("admin")))

        delete_project.assert_called_once_with("prj_1", force=True)
        self.assertEqual(result["message"], "Project deleted successfully")


class ProjectDeletionServiceTests(unittest.TestCase):
    def _delete(self, root: Path, row: dict, remaining: list) -> object:
        from app.services import project_deletion

        with patch.object(project_deletion.workspace, "get_project_by_id", return_value=row), \
             patch.object(project_deletion.workspace, "delete_project", return_value=True), \
             patch.object(project_deletion.workspace, "get_projects_by_repo", return_value=remaining), \
             patch.object(project_deletion.workspace, "delete_repository") as delete_repository, \
             patch.object(project_deletion.comments_store, "delete_project_comments"), \
             patch.object(project_deletion.project_service, "PROJECTS_ROOT", str(root)):
            result = project_deletion.delete_project("prj_1", force=False)
        self.delete_repository = delete_repository
        return result

    def test_monorepo_subproject_keeps_a_clone_its_siblings_still_use(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            clone = root / "type2" / "mono"
            (clone / "boards" / "a").mkdir(parents=True)
            row = {
                "repo_id": "repo",
                "import_type": "multi",
                "parent_repo_path": str(clone),
                "path": str(clone / "boards" / "a"),
            }
            result = self._delete(root, row, remaining=[{"id": "prj_2"}])
            self.assertTrue(clone.is_dir())
        self.assertFalse(result.repository_deleted)
        self.assertFalse(result.removed_files)
        self.delete_repository.assert_not_called()

    def test_last_project_removes_the_clone_inside_the_projects_root(self) -> None:
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            clone = root / "type1" / "board"
            clone.mkdir(parents=True)
            row = {"repo_id": "repo", "import_type": "single", "parent_repo_path": str(clone), "path": str(clone)}
            result = self._delete(root, row, remaining=[])
            self.assertFalse(clone.exists())
        self.assertTrue(result.repository_deleted)
        self.assertTrue(result.removed_files)
        self.delete_repository.assert_called_once_with("repo")


if __name__ == "__main__":
    unittest.main()
