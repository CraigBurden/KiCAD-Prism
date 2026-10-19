"""The ``system_bundle`` job end to end with the stub CLI, real design bundles
and a scratch workspace (docs/system-builder/CONTRACTS.md §8)."""

from __future__ import annotations

import hashlib
import json
import unittest
from pathlib import Path
from unittest import mock

from app.services.design_bundle import jobs as design_jobs
from app.services.design_bundle import schemas
from app.services.job_runtime import JobContext, PermanentJobError
from app.system_builder import bundle_store, ops
from app.system_builder import jobs as system_jobs
from app.system_builder.board_sub_ports import BoardSubPortStore
from app.system_builder.document import canonical, new_document
from app.system_builder.service import Caller, SystemService
from app.system_builder.settings import limits
from app.system_builder.store import SystemStore
from support.design_bundle_fixtures import set_modes
from support.postgres import requires_scratch_postgres
from support.repo import git
from test_design_bundle_job import _Workspace

OBC_PROJECT = "prj_000000000001"
PAYLOAD_PROJECT = "prj_000000000002"
MISSING_PROJECT = "prj_ffffffffffff"

CALLER = Caller(email="owner@example.com", can_see_project=lambda project_id: True)


def occurrence(occurrence_id: str, label: str, project_id: str, commit: str) -> dict:
    return {
        "id": occurrence_id,
        "label": label,
        "source": {"kind": "board", "projectId": project_id, "track": {"kind": "pinned", "commit": commit}},
    }


def board_sub_port_document(commit: str, sub_port_id: str, version: int = 1) -> dict:
    """One board occurrence whose export names ``sub_port_id`` at ``version``."""

    document = new_document("Board sub-ports")
    document["occurrences"] = [occurrence("occ_obc", "OBC", OBC_PROJECT, commit)]
    document["exports"] = [
        {
            "id": "exp_can",
            "name": "CAN",
            "site": {
                "occurrence": "occ_obc",
                "connector": "J2",
                "subPort": {"kind": "board", "id": sub_port_id, "version": version},
            },
            "pinNames": {},
        }
    ]
    return canonical(document)


class SystemBundleWorkspace(_Workspace):
    """A workspace with a system store, the system job's store seam and a real job context."""

    def setUp(self) -> None:
        super().setUp()
        self.system_store = SystemStore(self.scratch.connection)
        self.board_sub_ports = BoardSubPortStore(self.scratch.connection)
        self.enterContext(mock.patch.object(bundle_store, "default_connect", self.scratch.connection))
        self.enterContext(mock.patch.object(system_jobs, "system_store", lambda: self.system_store))
        self.enterContext(
            mock.patch("app.services.job_runtime.job_state_root", return_value=self.tmp / "state")
        )
        self.service = SystemService(self.system_store, limits)

    # ---------------------------------------------------------------- input

    def add_board(self, project_id: str, repo_id: str, **columns) -> str:
        repo = self.add_project(project_id, repo_id, **columns)
        return git(repo, "rev-parse", "HEAD")

    def build_design_bundle(self, project_id: str) -> dict:
        job_id = design_jobs.start_design_bundle_job(project_id, requested_by="test")
        assert job_id is not None
        return self.run_job(job_id).details

    def create_system(self, system_id: str, occurrences: list[dict]) -> dict:
        document = new_document("Flight stack")
        document["occurrences"] = occurrences
        document = canonical(document)
        self.system_store.create(
            system_id, document, folder_id=None, created_by="owner@example.com", role="admin",
        )
        return document

    def rename_system(self, system_id: str, name: str) -> None:
        record = self.system_store.read(system_id, role="admin")
        assert record is not None
        request = [{"kind": "set-system-info", "name": name}]
        applied = ops.apply(record["document"], request, seen_ids=record["seen_ids"], limits=limits())
        with self.system_store.transaction(system_id, role="admin") as tx:
            tx.write(applied, actor="owner@example.com", kind="edit", ops=request)

    # ------------------------------------------------------------ system job

    def queued_job(self, kind: str) -> str:
        return next(
            job_id
            for job_id, row in self.queue.rows.items()
            if row["kind"] == kind and row["status"] == "queued"
        )

    def queued_design_job(self, project_id: str) -> str:
        return next(
            job_id
            for job_id, row in self.queue.rows.items()
            if row["kind"] == "design_bundle"
            and row["status"] == "queued"
            and row["payload"].get("project_id") == project_id
        )

    def run_system_job(self, job_id: str):
        """Run one queued system job in place, as the worker's claimed attempt."""

        row = self.queue.rows[job_id]
        row.update(
            status="running",
            fence=int(row["fence"]) + 1,
            attempt=int(row["attempt"]) + 1,
            lease_owner="test-worker",
            lease_live=True,
        )
        return system_jobs.run_system_bundle_job(
            JobContext(row, worker_id="test-worker", service=self.queue)
        )

    def system_invocation(self) -> list[str]:
        return next(
            argv for argv in reversed(self.invocations()) if argv[:2] == ["system", "build"]
        )

    # ---------------------------------------------------------------- key

    def expected_key(self, document: dict, members: dict[str, str], absent: list[str], pending: list[str],
                     board_sub_ports: dict[str, int] | None = None,
                     entries: dict | None = None) -> str:
        preimage = {
            "documentSha256": hashlib.sha256(
                json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
            ).hexdigest(),
            "generator": design_jobs.cli.generator().digest,
            "members": members,
            "absent": sorted(absent),
            "pending": sorted(pending),
            "boardSubPorts": board_sub_ports or {},
            "entries": entries or {},
        }
        return hashlib.sha256(
            json.dumps(preimage, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        ).hexdigest()


@requires_scratch_postgres("the system_bundle job")
class SystemBundleJobTests(SystemBundleWorkspace, unittest.TestCase):
    def test_two_ready_boards_build_one_bundle_under_the_contract_key(self) -> None:
        obc_commit = self.add_board(OBC_PROJECT, "r1")
        payload_commit = self.add_board(PAYLOAD_PROJECT, "r2")
        obc = self.build_design_bundle(OBC_PROJECT)
        payload = self.build_design_bundle(PAYLOAD_PROJECT)
        document = self.create_system(
            "sys_a",
            [
                occurrence("occ_obc", "OBC", OBC_PROJECT, obc_commit),
                occurrence("occ_payload", "Payload", PAYLOAD_PROJECT, payload_commit),
            ],
        )

        answer = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual((answer["state"], answer["pending"]), ("building", []))
        job_id = self.queued_job("system_bundle")
        job = self.queue.rows[job_id]
        self.assertEqual(job["artifact_key"], f"sys_a:{answer['key']}")
        self.assertEqual(job["resource_requirements"], {"prism_worker": 1})
        self.assertEqual(job["max_attempts"], 2)

        result = self.run_system_job(job_id)
        self.assertEqual(result.details["bundle_key"], answer["key"])
        self.assertEqual(result.details["counts"]["ready_occurrences"], 2)
        expected = self.expected_key(
            document,
            {"occ_obc": obc["bundle_key"], "occ_payload": payload["bundle_key"]},
            [],
            [],
        )
        self.assertEqual(answer["key"], expected)
        self.assertEqual(result.details["bundle_key"], expected)

        bundle = bundle_store.read("sys_a", expected)
        assert bundle is not None
        schemas.validate(bundle, "prism.system_bundle.a0")
        self.assertEqual(bundle["documentSha256"], self.expected_document_sha(document))
        self.assertEqual(
            [(item["occurrence"], item["state"]) for item in bundle["occurrences"]],
            [("occ_obc", "ready"), ("occ_payload", "ready")],
        )
        self.assertTrue(bundle_store.path("sys_a", expected).is_file())
        row = bundle_store.get("sys_a", expected)
        assert row is not None
        self.assertEqual((row["state"], row["document_version"]), ("complete", 1))

    def test_a_pending_board_is_pending_and_the_key_changes_when_its_bundle_arrives(self) -> None:
        obc_commit = self.add_board(OBC_PROJECT, "r1")
        payload_commit = self.add_board(PAYLOAD_PROJECT, "r2")
        obc = self.build_design_bundle(OBC_PROJECT)
        document = self.create_system(
            "sys_a",
            [
                occurrence("occ_obc", "OBC", OBC_PROJECT, obc_commit),
                occurrence("occ_payload", "Payload", PAYLOAD_PROJECT, payload_commit),
            ],
        )

        first = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual((first["state"], first["pending"]), ("building", ["occ_payload"]))
        first_job = self.queued_job("system_bundle")
        first_result = self.run_system_job(first_job)
        first_key = first_result.details["bundle_key"]
        self.assertEqual(
            first_key,
            self.expected_key(document, {"occ_obc": obc["bundle_key"]}, [], ["occ_payload"]),
        )
        first_bundle = bundle_store.read("sys_a", first_key)
        assert first_bundle is not None
        schemas.validate(first_bundle, "prism.system_bundle.a0")
        states = {item["occurrence"]: item["state"] for item in first_bundle["occurrences"]}
        self.assertEqual(states, {"occ_obc": "ready", "occ_payload": "pending"})
        self.assertEqual(
            [finding["code"] for finding in first_bundle["findings"]], ["occurrence-pending"]
        )

        # The design bundle the read queued finishes; the system key moves with it.
        payload = self.run_job(self.queued_design_job(PAYLOAD_PROJECT)).details
        second = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual((second["state"], second["pending"]), ("building", []))
        self.assertNotEqual(second["key"], first_key)
        second_result = self.run_system_job(self.queued_job("system_bundle"))
        self.assertEqual(second_result.details["bundle_key"], second["key"])
        self.assertEqual(
            second["key"],
            self.expected_key(
                document,
                {"occ_obc": obc["bundle_key"], "occ_payload": payload["bundle_key"]},
                [],
                [],
            ),
        )
        second_bundle = bundle_store.read("sys_a", second["key"])
        assert second_bundle is not None
        schemas.validate(second_bundle, "prism.system_bundle.a0")
        self.assertTrue(all(item["state"] == "ready" for item in second_bundle["occurrences"]))

    def test_a_project_that_no_longer_exists_is_absent_and_reported_to_the_cli(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        obc = self.build_design_bundle(OBC_PROJECT)
        document = self.create_system(
            "sys_a",
            [
                occurrence("occ_obc", "OBC", OBC_PROJECT, commit),
                occurrence("occ_gone", "Gone", MISSING_PROJECT, "c" * 40),
            ],
        )

        answer = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual(answer["pending"], [])
        self.run_system_job(self.queued_job("system_bundle"))
        self.assertEqual(
            answer["key"],
            self.expected_key(document, {"occ_obc": obc["bundle_key"]}, ["occ_gone"], []),
        )
        invocation = self.system_invocation()
        self.assertEqual(invocation[invocation.index("--absent") + 1], "occ_gone")
        bundle = bundle_store.read("sys_a", answer["key"])
        assert bundle is not None
        schemas.validate(bundle, "prism.system_bundle.a0")
        states = {item["occurrence"]: item["state"] for item in bundle["occurrences"]}
        self.assertEqual(states, {"occ_obc": "ready", "occ_gone": "absent"})

    def test_a_failed_build_marks_the_row_failed_and_is_not_queued_again_within_the_hour(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        self.build_design_bundle(OBC_PROJECT)
        self.create_system("sys_a", [occurrence("occ_obc", "OBC", OBC_PROJECT, commit)])

        answer = self.service.bundle("sys_a", CALLER, role="viewer")
        job_id = self.queued_job("system_bundle")
        set_modes("system build=exit:3")
        with self.assertRaises(PermanentJobError):
            self.run_system_job(job_id)

        job = self.queue.rows[job_id]
        job.update(status="failed", error_message="injected input failure")
        self.assertTrue(system_jobs.settle_system_bundle_end(job))
        row = bundle_store.get("sys_a", answer["key"])
        assert row is not None
        self.assertEqual(row["state"], "failed")

        queued_before = sum(1 for item in self.queue.rows.values() if item["kind"] == "system_bundle")
        again = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual(again["state"], "failed")
        self.assertIn("injected", again["error"])
        queued_after = sum(1 for item in self.queue.rows.values() if item["kind"] == "system_bundle")
        self.assertEqual(queued_after, queued_before)
        self.assertFalse(bundle_store.exists("sys_a", answer["key"]))

    def test_a_named_board_sub_port_is_a_key_input_and_passed_to_the_cli(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        obc = self.build_design_bundle(OBC_PROJECT)
        self.board_sub_ports.create(
            OBC_PROJECT, "bsp_can", "J2", "CAN", ["3", "4"], actor="owner@example.com",
        )
        self.board_sub_ports.create(
            OBC_PROJECT, "bsp_spare", "J3", "Spare", ["1"], actor="owner@example.com",
        )
        document = board_sub_port_document(commit, "bsp_can")
        self.system_store.create(
            "sys_a", document, folder_id=None, created_by="owner@example.com", role="admin",
        )

        first = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual(first["state"], "building")
        self.assertEqual(
            first["key"],
            self.expected_key(document, {"occ_obc": obc["bundle_key"]}, [], [],
                             board_sub_ports={"bsp_can": 1}),
        )
        result = self.run_system_job(self.queued_job("system_bundle"))
        self.assertEqual(result.details["bundle_key"], first["key"])

        invocation = self.system_invocation()
        written = json.loads(
            Path(invocation[invocation.index("--board-sub-ports") + 1]).read_text(encoding="utf-8")
        )
        schemas.validate(written, "prism.board_sub_ports.a0")
        self.assertEqual(
            [(item["id"], item["version"]) for item in written["subPorts"]],
            [("bsp_can", 1)],
        )

        # The live definition is what counts: an edit moves the key and builds again.
        self.board_sub_ports.update(
            OBC_PROJECT, "bsp_can", name="CAN", pins=["3", "4", "5"],
            expected_version=1, actor="owner@example.com",
        )
        second = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual(second["state"], "building")
        self.assertNotEqual(second["key"], first["key"])
        self.assertEqual(
            second["key"],
            self.expected_key(document, {"occ_obc": obc["bundle_key"]}, [], [],
                             board_sub_ports={"bsp_can": 2}),
        )
        second_result = self.run_system_job(self.queued_job("system_bundle"))
        self.assertEqual(second_result.details["bundle_key"], second["key"])
        self.assertTrue(bundle_store.exists("sys_a", second["key"]))

        # An unnamed sub-port is not an input, so editing it keeps the key.
        self.board_sub_ports.update(
            OBC_PROJECT, "bsp_spare", name="Spare", pins=["1", "2"],
            expected_version=1, actor="owner@example.com",
        )
        third = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertEqual((third["state"], third["key"]), ("ready", second["key"]))

    def test_a_snapshot_stores_and_returns_the_board_sub_ports_it_names(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        self.build_design_bundle(OBC_PROJECT)
        self.board_sub_ports.create(
            OBC_PROJECT, "bsp_can", "J2", "CAN", ["3", "4"], actor="owner@example.com",
        )
        document = board_sub_port_document(commit, "bsp_can")
        self.system_store.create(
            "sys_a", document, folder_id=None, created_by="owner@example.com", role="admin",
        )

        snapshot = self.system_store.create_snapshot(
            "sys_a", name="Before wiring", note=None, created_by="owner@example.com",
        )
        self.assertEqual(
            [(item["id"], item["pins"], item["version"])
             for item in snapshot["boardSubPorts"]["subPorts"]],
            [("bsp_can", ["3", "4"], 1)],
        )
        read = self.system_store.read_snapshot("sys_a", snapshot["snapshot_id"])
        assert read is not None
        self.assertEqual(read["boardSubPorts"], snapshot["boardSubPorts"])

        # The snapshot keeps its copy: a later edit never moves it.
        self.board_sub_ports.update(
            OBC_PROJECT, "bsp_can", name="CAN", pins=["3", "4", "5"],
            expected_version=1, actor="owner@example.com",
        )
        again = self.system_store.read_snapshot("sys_a", snapshot["snapshot_id"])
        assert again is not None
        self.assertEqual(again["boardSubPorts"], snapshot["boardSubPorts"])

    def test_a_document_changed_after_queueing_builds_the_current_key(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        obc = self.build_design_bundle(OBC_PROJECT)
        self.create_system("sys_a", [occurrence("occ_obc", "OBC", OBC_PROJECT, commit)])

        queued = self.service.bundle("sys_a", CALLER, role="viewer")
        queued_key = queued["key"]
        job_id = self.queued_job("system_bundle")

        self.rename_system("sys_a", "Renamed after queueing")
        current = self.system_store.read("sys_a", role="admin")
        assert current is not None

        result = self.run_system_job(job_id)
        self.assertTrue(result.details["rebased"])
        self.assertEqual(result.details["superseded_key"], queued_key)
        self.assertNotEqual(result.details["bundle_key"], queued_key)
        self.assertEqual(
            result.details["bundle_key"],
            self.expected_key(current["document"], {"occ_obc": obc["bundle_key"]}, [], []),
        )
        self.assertEqual(result.details["document_version"], current["version"])
        self.assertTrue(bundle_store.exists("sys_a", result.details["bundle_key"]))
        self.assertFalse(bundle_store.exists("sys_a", queued_key))
        old = bundle_store.get("sys_a", queued_key)
        assert old is not None
        self.assertEqual(old["state"], "failed")
        new = bundle_store.get("sys_a", result.details["bundle_key"])
        assert new is not None
        self.assertEqual((new["state"], new["document_version"]), ("complete", current["version"]))
        schemas.validate(
            bundle_store.read("sys_a", result.details["bundle_key"]), "prism.system_bundle.a0"
        )

    def test_retention_keeps_the_newest_complete_bundle_and_drops_a_deleted_system(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        self.build_design_bundle(OBC_PROJECT)
        self.create_system("sys_a", [occurrence("occ_obc", "OBC", OBC_PROJECT, commit)])

        first = self.service.bundle("sys_a", CALLER, role="viewer")
        self.run_system_job(self.queued_job("system_bundle"))
        self.rename_system("sys_a", "Second key")
        second = self.service.bundle("sys_a", CALLER, role="viewer")
        self.assertNotEqual(second["key"], first["key"])
        self.run_system_job(self.queued_job("system_bundle"))

        with self.scratch.connection() as conn:
            conn.execute(
                "UPDATE ws_system_bundles SET updated_at = now() - interval '41 days',"
                " last_used_at = now() - interval '41 days' WHERE bundle_key = %s",
                (first["key"],),
            )
            conn.execute(
                "UPDATE ws_system_bundles SET updated_at = now() - interval '40 days',"
                " last_used_at = now() - interval '40 days' WHERE bundle_key = %s",
                (second["key"],),
            )
        report = bundle_store.prune()
        self.assertEqual(report["removed"], 1)
        self.assertFalse(bundle_store.exists("sys_a", first["key"]))
        self.assertIsNone(bundle_store.get("sys_a", first["key"]))
        self.assertTrue(bundle_store.exists("sys_a", second["key"]))
        self.assertIsNotNone(bundle_store.get("sys_a", second["key"]))

        self.assertTrue(self.system_store.soft_delete("sys_a"))
        report = bundle_store.prune()
        self.assertEqual(report["deleted_systems"], 1)
        self.assertFalse(bundle_store.exists("sys_a", second["key"]))
        self.assertIsNone(bundle_store.get("sys_a", second["key"]))

    @staticmethod
    def expected_document_sha(document: dict) -> str:
        return hashlib.sha256(
            json.dumps(document, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        ).hexdigest()


if __name__ == "__main__":
    unittest.main()
