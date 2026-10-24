"""A candidate's 3D model inputs: the rows kept, self-containment, acknowledgement."""

from __future__ import annotations

import unittest
import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.core.errors import DomainError
from app.release_studio.closure import ResolvedLibraryPath
from app.services import release_studio_build_service as build_service
from app.services import release_studio_model_inputs as model_inputs
from app.services import release_studio_service as store
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from support.postgres import (  # noqa: E402
    requires_scratch_postgres,
    scratch_schema,
    seed_project,
    seed_repository,
)


def _closure(*references: ResolvedLibraryPath) -> SimpleNamespace:
    return SimpleNamespace(library_references=references)


BOARD = "hw/board.kicad_pcb"


class ModelInputTests(unittest.TestCase):
    def test_only_model_references_become_rows(self) -> None:
        rows = model_inputs.closure_model_rows(
            _closure(
                ResolvedLibraryPath(BOARD, "${MODELS}/a.step", "", "host", digest="f" * 64),
                ResolvedLibraryPath("fp-lib-table", "${LIBS}/x.pretty", "", "external"),
                ResolvedLibraryPath(BOARD, "b.wrl", "", "substitutable"),
            )
        )
        self.assertEqual(
            [(row["reference"], row["location"], row["digest"]) for row in rows],
            [("${MODELS}/a.step", "host", "f" * 64), ("b.wrl", "substitutable", "")],
        )

    def test_a_host_model_makes_a_hermetic_build_not_self_contained(self) -> None:
        host = [{"location": "host"}]
        closure = [{"location": "closure"}, {"location": "toolchain"}]
        self.assertFalse(model_inputs.is_self_contained(True, host))
        self.assertTrue(model_inputs.is_self_contained(True, closure))
        self.assertFalse(model_inputs.is_self_contained(False, closure))

    def test_every_unpinned_model_must_be_acknowledged(self) -> None:
        unpinned = model_inputs.unpinned_models(
            {},
            [
                {"source_path": BOARD, "reference": "a.step", "location": "unreadable"},
                {"source_path": BOARD, "reference": "b.wrl", "location": "substitutable"},
                {"source_path": BOARD, "reference": "c.step", "location": "missing", "advisory": True},
            ],
        )
        keys = [row["key"] for row in unpinned]
        self.assertEqual(keys, [f"{BOARD}::a.step", f"{BOARD}::b.wrl"])
        with self.assertRaises(DomainError) as caught:
            model_inputs.require_acknowledgement(unpinned, keys[:1], action="Publishing")
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("b.wrl", str(caught.exception.detail))
        self.assertNotIn("a.step", str(caught.exception.detail))
        self.assertEqual(
            model_inputs.require_acknowledgement(unpinned, [*keys, "stale"], action="Publishing"),
            keys,
        )
        # Nothing unpinned: nothing to acknowledge.
        self.assertEqual(model_inputs.require_acknowledgement([], [], action="Approval"), [])


class RequestTests(unittest.TestCase):
    def test_an_acknowledged_model_key_is_bounded(self) -> None:
        from pydantic import ValidationError

        from app.api.release_studio import PublishRequest, ReviewDecisionRequest

        self.assertEqual(
            ReviewDecisionRequest(slot="qa", acknowledged_models=["k" * 4096]).acknowledged_models,
            ["k" * 4096],
        )
        for request in (
            lambda: ReviewDecisionRequest(slot="qa", acknowledged_models=["k" * 4097]),
            lambda: PublishRequest(tag="v1", acknowledged_models=["k" * 4097]),
        ):
            with self.assertRaises(ValidationError):
                request()


class PrepareCandidateTests(unittest.TestCase):
    def test_the_candidate_gets_the_model_rows_and_self_contained(self) -> None:
        closure = SimpleNamespace(
            library_references=(
                ResolvedLibraryPath(BOARD, "${MODELS}/a.step", "", "host", digest="f" * 64),
            ),
            commit_sha="a" * 40,
            input_closure_digest="d" * 64,
            repository_inputs=(),
            submodule_inputs=(),
            lfs_inputs=(),
            toolchain_resources=(),
            env_bindings=(),
            non_hermetic_reasons=lambda: [],
            advisory_reasons=lambda: [],
        )
        workspace = Path("/nonexistent-workspace")
        design = SimpleNamespace(project_references=lambda: object(), generator={})
        with mock.patch.object(
            build_service.bundle_design, "readiness", return_value=design
        ), mock.patch.object(
            build_service, "materialize_input_closure", return_value=closure
        ) as materialize, mock.patch.object(
            build_service, "toolchain_identity", return_value=({}, "t" * 64)
        ), mock.patch.object(
            build_service.store, "create_candidate", return_value={"id": "cand-1"}
        ) as create:
            build_service.prepare_candidate(
                project_id="project",
                repository_id="repo",
                repo_root=Path("/repo"),
                commit_sha="a" * 40,
                config_key="release",
                variant="",
                workspace_root=workspace,
                configuration={"board": "board.kicad_pcb"},
            )
        self.assertEqual(materialize.call_args.kwargs["model_stage"], workspace / "models")
        fields = create.call_args.kwargs
        self.assertEqual([row["reference"] for row in fields["model_inputs"]], ["${MODELS}/a.step"])
        self.assertIs(fields["self_contained"], False)


@requires_scratch_postgres("Release Studio model input store tests")
class ModelInputStoreTests(unittest.TestCase):
    """The rows and acknowledgements reach real PostgreSQL."""

    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "release_models", ledgers=(WORKSPACE_LEDGER,))
        self.conn = self.scratch.conn
        suffix = uuid.uuid4().hex[:8]
        self.project, self.repository = f"project-{suffix}", f"repo-{suffix}"
        seed_repository(self.conn, self.repository)
        seed_project(self.conn, self.project, self.repository)
        self.conn.commit()
        patcher = mock.patch.object(store, "connect", self.scratch.connection)
        patcher.start()
        self.addCleanup(patcher.stop)

    def _candidate(self) -> dict:
        return store.create_candidate(
            project_id=self.project,
            repository_id=self.repository,
            config_key="release",
            commit_sha="a" * 40,
            variant="",
            technical_config_digest="c" * 64,
            input_closure_digest="d" * 64,
            toolchain_digest="t" * 64,
            generator_build="test",
            hermetic=False,
            non_hermetic_reasons=["unreadable model"],
            model_inputs=[
                {"source_path": BOARD, "reference": "a.step", "location": "unreadable"},
                {"source_path": BOARD, "reference": "b.step", "location": "host", "digest": "f" * 64},
            ],
            self_contained=False,
            created_by="designer@example.com",
        )

    def test_create_candidate_stores_model_rows_and_self_contained(self) -> None:
        candidate = self._candidate()
        self.assertIs(candidate["self_contained"], False)
        rows = store.model_inputs(candidate["id"])
        self.assertEqual(
            [(row["reference"], row["location"], row["digest"]) for row in rows],
            [("a.step", "unreadable", ""), ("b.step", "host", "f" * 64)],
        )

    def test_approve_and_publish_store_the_acknowledged_models(self) -> None:
        candidate = self._candidate()
        build_id = f"build-{uuid.uuid4().hex[:8]}"
        self.conn.execute(
            """
            INSERT INTO ws_release_builds(id, candidate_id, status, dossier_digest)
            VALUES (%s, %s, 'succeeded', %s)
            """,
            (build_id, candidate["id"], "e" * 64),
        )
        self.conn.commit()
        key = f"{BOARD}::a.step"
        store.record_review_decision(
            project_id=self.project,
            build_id=build_id,
            slot="designer",
            actor="designer@example.com",
            actor_role="designer",
            decision="approved",
            dossier_digest="e" * 64,
            author="designer@example.com",
            published=False,
            build_status="succeeded",
            config_key="release",
            acknowledged_models=[key],
        )
        decision = store.latest_review_decision(build_id, "designer")
        self.assertEqual(decision["acknowledged_models"], [key])
        record = store.record_publish(
            project_id=self.project,
            build_id=build_id,
            tag="v1.0.0",
            commit_sha="a" * 40,
            dossier_digest="e" * 64,
            published_by="qa@example.com",
            forge_url="https://example.invalid/release",
            asset_names=["board.zip"],
            config_key="release",
            acknowledged_models=[key],
        )
        self.assertEqual(record["acknowledged_models"], [key])


if __name__ == "__main__":
    unittest.main()
