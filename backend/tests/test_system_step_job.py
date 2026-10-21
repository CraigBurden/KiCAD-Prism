"""The STEP jobs: board export cache, the system assembly and its manifest
(docs/system-builder/CONTRACTS.md §18)."""

from __future__ import annotations

import json
import unittest
from pathlib import Path
from unittest import mock

from app.services.catalog import models
from app.services.job_runtime import JobContext, PermanentJobError, RetryableJobError
from app.services.kicad_tools import KicadTools, ToolResult
from app.system_builder import jobs as system_jobs
from app.system_builder import step_models, step_store
from app.system_builder.document import canonical, empty_harness, new_document
from app.system_builder.service import Caller
from kicad_tool_fakes import FakeTool
from support.design_bundle_fixtures import set_modes
from support.postgres import requires_scratch_postgres
from test_system_bundle_job import SystemBundleWorkspace, occurrence

PROJECT = "prj_000000000021"
CALLER = Caller(email="owner@example.com", can_see_project=lambda project_id: True)
KICAD_VERSION = "10.0.7"


class StepWorkspace(SystemBundleWorkspace):
    """The bundle workspace plus a fake kicad-cli and fake catalog STEP parts."""

    def setUp(self) -> None:
        super().setUp()
        self.exported = self.tmp / "exported.step"
        self.kicad = FakeTool(self._export, version=KICAD_VERSION)
        self.enterContext(
            mock.patch.object(
                system_jobs, "resolve_tools",
                lambda: KicadTools(cli=self.kicad, cruncher=None),
            )
        )
        self.catalog_steps = {
            "cmp_body": self.tmp / "body.step",
            "cmp_connector": self.tmp / "connector.step",
            "cmp_housing": self.tmp / "housing.step",
        }
        for path in self.catalog_steps.values():
            path.write_text("ISO-10303-21;\n", encoding="ascii")
        self.alignment = tuple(
            models.alignment_matrix(
                {"offsetMm": [1.0, 2.0, 3.0], "rotationDeg": [0.0, 0.0, 0.0], "scale": 1.0}
            )
        )
        self.enterContext(mock.patch.object(step_models, "catalog_step", self._catalog_step))
        self.enterContext(
            mock.patch.object(system_jobs.parts_input, "catalog_lookup", lambda component_id, revision_id: None)
        )

    def _export(self, args, **kwargs):
        target = Path(args[args.index("-o") + 1])
        data = "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n"
        target.write_text(data, encoding="ascii")
        self.exported = target
        return ToolResult(0)

    def _catalog_step(self, component_id: str, revision_id):
        path = self.catalog_steps.get(component_id)
        if path is None:
            return None
        return step_models.StepModel(path=path, alignment=self.alignment)

    # --------------------------------------------------------------- jobs

    def _claim(self, job_id: str):
        row = self.queue.rows[job_id]
        row.update(
            status="running",
            fence=int(row["fence"]) + 1,
            attempt=int(row["attempt"]) + 1,
            lease_owner="test-worker",
            lease_live=True,
        )
        return JobContext(row, worker_id="test-worker", service=self.queue)

    def run_board_job(self, job_id: str):
        return system_jobs.run_system_board_step_job(self._claim(job_id))

    def run_step_job(self, job_id: str):
        return system_jobs.run_system_step_job(self._claim(job_id))

    def step_invocations(self) -> list[list[str]]:
        return [argv for argv in self.invocations() if argv[:2] == ["system", "step"]]

    def manifest_of(self, argv: list[str]) -> tuple[Path, dict]:
        path = Path(argv[argv.index("--models") + 1])
        return path, json.loads(path.read_text(encoding="utf-8"))

    def ready_bundle(self, system_id: str, document: dict) -> str:
        self.system_store.create(
            system_id, document, folder_id=None, created_by="owner@example.com", role="admin",
        )
        answer = self.service.bundle(system_id, CALLER, role="viewer")
        self.run_system_job(self.queued_job("system_bundle"))
        return str(answer["key"])


def step_document(commit: str, *, parts: bool = False) -> dict:
    document = new_document("Flight stack")
    document["occurrences"] = [occurrence("occ_board", "Main board", PROJECT, commit)]
    if parts:
        document["occurrences"].append(
            {
                "id": "occ_body",
                "label": "Enclosure",
                "source": {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_body"},
            }
        )
        document["bodyConnectors"] = [
            {
                "id": "bc_1",
                "occurrence": "occ_body",
                "refdes": "J1",
                "part": {"componentId": "cmp_connector", "revisionId": "rev_connector"},
            }
        ]
        harness = empty_harness("har_1", "Power")
        harness["ends"] = [
            {
                "id": "end_1",
                "occurrence": "occ_board",
                "connector": "J1",
                "housing": {"componentId": "cmp_housing", "revisionId": "rev_housing"},
            }
        ]
        document["harnesses"] = [harness]
    return canonical(document)


@requires_scratch_postgres("the system_board_step job")
class BoardStepJobTests(StepWorkspace, unittest.TestCase):
    def test_a_board_exports_once_under_its_key(self) -> None:
        commit = self.add_board(PROJECT, "r_step")
        job_id = system_jobs.start_system_board_step_job(PROJECT, commit)
        assert job_id is not None
        result = self.run_board_job(job_id)

        key = step_store.board_key(PROJECT, commit, KICAD_VERSION)
        self.assertEqual(result.details["key"], key)
        self.assertTrue(step_store.board_exists(key))
        record = step_store.board_record(key)
        assert record is not None
        self.assertEqual(record["project"], PROJECT)
        self.assertEqual(record["commit"], commit)
        self.assertEqual(record["kicadCli"], KICAD_VERSION)
        self.assertEqual(record["options"], list(step_store.BOARD_STEP_OPTIONS))
        self.assertEqual((record["missingModels"], record["fallback"]), (0, False))
        self.assertGreater(record["sizeBytes"], 0)
        self.assertIn("pcb", self.kicad.calls[0]["args"])

        # A stored model answers the next request without running kicad-cli.
        runs = len(self.kicad.calls)
        self.assertIsNone(system_jobs.start_system_board_step_job(PROJECT, commit))
        cached = self.run_board_job(job_id)
        self.assertTrue(cached.details["cached"])
        self.assertEqual(len(self.kicad.calls), runs)

    def test_a_closure_failure_falls_back_to_a_plain_checkout(self) -> None:
        from app.release_studio.closure import ClosureError

        commit = self.add_board(PROJECT, "r_step")
        with mock.patch.object(
            system_jobs, "materialize_project_input_closure",
            side_effect=ClosureError("missing LFS object"),
        ):
            self.run_board_job(system_jobs.start_system_board_step_job(PROJECT, commit))
        record = step_store.board_record(step_store.board_key(PROJECT, commit, KICAD_VERSION))
        assert record is not None
        self.assertTrue(record["fallback"])

    def test_missing_component_models_are_counted(self) -> None:
        commit = self.add_board(PROJECT, "r_step")

        def report_missing(args, **kwargs):
            target = Path(args[args.index("-o") + 1])
            target.write_text("ISO-10303-21;\n", encoding="ascii")
            return ToolResult(0, stdout="File not found: a.step\nFile not found: b.step\n")

        tool = FakeTool(report_missing, version=KICAD_VERSION)
        with mock.patch.object(
            system_jobs, "resolve_tools",
            lambda: KicadTools(cli=tool, cruncher=None),
        ):
            self.run_board_job(system_jobs.start_system_board_step_job(PROJECT, commit))
        record = step_store.board_record(step_store.board_key(PROJECT, commit, KICAD_VERSION))
        assert record is not None
        self.assertEqual(record["missingModels"], 2)

    def test_a_kicad_cli_failure_is_permanent_and_records_its_output(self) -> None:
        commit = self.add_board(PROJECT, "r_step")

        def fail(args, **kwargs):
            return ToolResult(3, stderr="error one\nError: the export failed\n")

        tool = FakeTool(fail, version=KICAD_VERSION)
        with mock.patch.object(
            system_jobs, "resolve_tools",
            lambda: KicadTools(cli=tool, cruncher=None),
        ):
            job_id = system_jobs.start_system_board_step_job(PROJECT, commit)
            with self.assertRaises(PermanentJobError) as caught:
                self.run_board_job(job_id)
        self.assertIn("the export failed", str(caught.exception))
        record = step_store.board_record(step_store.board_key(PROJECT, commit, KICAD_VERSION))
        assert record is not None
        self.assertEqual(record["state"], "failed")
        self.assertIn("the export failed", record["error"])


@requires_scratch_postgres("the system_step job")
class SystemStepJobTests(StepWorkspace, unittest.TestCase):
    def test_it_waits_for_a_board_model_then_writes_the_manifest(self) -> None:
        commit = self.add_board(PROJECT, "r_step")
        self.build_design_bundle(PROJECT)
        document = step_document(commit)
        key = self.ready_bundle("sys_step", document)

        job_id = system_jobs.start_system_step_job("sys_step", key, requested_by="test")
        with self.assertRaises(RetryableJobError) as caught:
            self.run_step_job(job_id)
        self.assertEqual(caught.exception.code, "system-board-step-building")
        record = step_store.system_record("sys_step", key)
        assert record is not None
        self.assertEqual(record["state"], "building")
        self.assertEqual(record["boards"][0]["state"], "building")
        self.assertEqual(self.step_invocations(), [])

        self.run_board_job(self.queued_job("system_board_step"))
        result = self.run_step_job(job_id)
        self.assertEqual(result.details["bundle_key"], key)
        self.assertEqual(result.details["missing"], [])
        self.assertTrue(step_store.system_exists("sys_step", key))
        record = step_store.system_record("sys_step", key)
        assert record is not None
        self.assertEqual(record["state"], "ready")
        self.assertEqual(record["boards"][0]["state"], "ready")

        argv = self.step_invocations()[-1]
        manifest_path, manifest = self.manifest_of(argv)
        board = manifest["boards"]["occ_board"]
        self.assertEqual(board["thicknessNm"], 1_558_400)
        self.assertTrue((manifest_path.parent / board["step"]).is_file())
        self.assertEqual(manifest["parts"], {})

    def test_body_connector_and_housing_steps_carry_their_alignment(self) -> None:
        commit = self.add_board(PROJECT, "r_step")
        self.build_design_bundle(PROJECT)
        document = step_document(commit, parts=True)
        key = self.ready_bundle("sys_step", document)

        job_id = system_jobs.start_system_step_job("sys_step", key, requested_by="test")
        with self.assertRaises(RetryableJobError):
            self.run_step_job(job_id)
        self.run_board_job(self.queued_job("system_board_step"))
        self.run_step_job(job_id)

        manifest_path, manifest = self.manifest_of(self.step_invocations()[-1])
        self.assertEqual(
            sorted(manifest["parts"]),
            ["cmp_body@rev_body", "cmp_connector@rev_connector", "cmp_housing@rev_housing"],
        )
        for entry in manifest["parts"].values():
            self.assertEqual(entry["alignment"], list(self.alignment))
            self.assertTrue((manifest_path.parent / entry["step"]).is_file())

    def test_a_document_changed_after_queueing_builds_the_current_key(self) -> None:
        commit = self.add_board(PROJECT, "r_step")
        self.build_design_bundle(PROJECT)
        document = step_document(commit)
        key = self.ready_bundle("sys_step", document)

        job_id = system_jobs.start_system_step_job("sys_step", key, requested_by="test")
        with self.assertRaises(RetryableJobError):
            self.run_step_job(job_id)
        self.run_board_job(self.queued_job("system_board_step"))

        self.rename_system("sys_step", "Renamed before the assembly")
        with self.assertRaises(RetryableJobError) as caught:
            self.run_step_job(job_id)
        self.assertEqual(caught.exception.code, "system-bundle-building")
        current = self.system_store.read("sys_step", role="admin")
        assert current is not None
        current_key = system_jobs.member_view.system_bundle_key(
            current["document"], system_jobs.cli.generator().digest,
            system_jobs.member_view.resolve(current["document"], requested_by="test"),
            parts=system_jobs.parts_input.digest(
                system_jobs.parts_input.build_input(current["document"])[0]
            ),
        )
        self.assertNotEqual(current_key, key)
        old = step_store.system_record("sys_step", key)
        assert old is not None
        self.assertEqual(old["state"], "failed")
        self.run_system_job(self.queued_job("system_bundle"))
        result = self.run_step_job(job_id)
        self.assertEqual(result.details["bundle_key"], current_key)
        self.assertTrue(step_store.system_exists("sys_step", current_key))

    def test_a_cli_failure_leaves_the_sidecar_failed(self) -> None:
        commit = self.add_board(PROJECT, "r_step")
        self.build_design_bundle(PROJECT)
        document = step_document(commit)
        key = self.ready_bundle("sys_step", document)

        job_id = system_jobs.start_system_step_job("sys_step", key, requested_by="test")
        with self.assertRaises(RetryableJobError):
            self.run_step_job(job_id)
        self.run_board_job(self.queued_job("system_board_step"))

        set_modes("system step=exit:3")
        with self.assertRaises(PermanentJobError):
            self.run_step_job(job_id)
        record = step_store.system_record("sys_step", key)
        assert record is not None
        self.assertEqual(record["state"], "failed")
        self.assertIn("injected", record["error"])
        self.assertFalse(step_store.system_exists("sys_step", key))


if __name__ == "__main__":
    unittest.main()
