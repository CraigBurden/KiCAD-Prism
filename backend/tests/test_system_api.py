"""System Builder v2 API: routing, roles, ETags, operations, undo and redaction."""

from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from fastapi import FastAPI

from app.api import systems as systems_api
from app.core.errors import install_error_handlers
from app.core.policy import folder_visible
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from app.system_builder import git_link, ops
from app.system_builder.document import new_document
from app.system_builder.service import SystemService
from app.system_builder.settings import limits
from app.system_builder.store import SystemStore
from support.asgi import request as _request
from support.postgres import (
    requires_scratch_postgres,
    scratch_schema,
    seed_folder,
    seed_project,
    seed_repository,
)

PROJECT = "prj_0a1b2c3d4e5f"
PAYLOAD = "prj_2b3c4d5e6f70"
VIEWER_HIDDEN = "prj_111111111111"
DESIGNER_HIDDEN = "prj_222222222222"
COMMIT = "5f8d04832e54e9af901a1c920b045dbda1c2d4ad"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


def _occurrence(occurrence_id: str, label: str, project_id: str) -> dict:
    return {
        "id": occurrence_id,
        "label": label,
        "source": {
            "kind": "board",
            "projectId": project_id,
            "track": {"kind": "pinned", "commit": COMMIT},
        },
    }


def _edit_ops() -> list[dict]:
    return [
        {"kind": "add-occurrence", "occurrence": _occurrence("occ_obc", "OBC", PROJECT)},
        {"kind": "add-occurrence", "occurrence": _occurrence("occ_payload", "Payload", PAYLOAD)},
        {
            "kind": "add-sub-port",
            "subPort": {
                "id": "sub_can", "occurrence": "occ_obc", "connector": "J2",
                "name": "CAN", "pins": ["3", "4"],
            },
        },
        {
            "kind": "connect-harness",
            "newHarness": {"id": "har_h1", "label": "H1"},
            "newEnds": {"a": "end_obc", "b": "end_payload"},
            "link": {
                "id": "link_can",
                "a": {
                    "occurrence": "occ_obc", "connector": "J2",
                    "subPort": {"kind": "occurrence", "id": "sub_can"},
                },
                "b": {"occurrence": "occ_payload", "connector": "J1"},
                "unmapped": [],
            },
        },
        {
            "kind": "set-layout", "item": "occ_payload",
            "placement": {"xNm": 152400000, "yNm": 25400000, "rotationDeg": 0, "mirror": False},
        },
    ]


class _Workspace:
    """The folder visibility Prism's workspace service would answer for these rows."""

    def __init__(self, conn) -> None:
        self._conn = conn

    def get_project_for_role(self, project_id: str, role: str):
        row = self._conn.execute(
            """
            SELECT f.visibility_mode, f.allowed_roles
              FROM ws_projects p
              LEFT JOIN ws_folders f ON f.id = p.folder_id
             WHERE p.id = %s
            """,
            (project_id,),
        ).fetchone()
        if row is None or not folder_visible(role, row["visibility_mode"], row["allowed_roles"] or []):
            return None
        return SimpleNamespace(id=project_id)


class RoutingTest(unittest.TestCase):
    def test_main_registers_the_router(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(encoding="utf-8")
        self.assertIn('app.include_router(systems_router, prefix="/api", tags=["systems"])', source)
        paths = set(_app().openapi()["paths"])
        for path in (
            "/api/systems",
            "/api/systems/{system_id}",
            "/api/systems/{system_id}/bundle",
            "/api/systems/{system_id}/ops",
            "/api/systems/{system_id}/undo",
            "/api/systems/{system_id}/history",
            "/api/systems/{system_id}/snapshots",
            "/api/systems/{system_id}/snapshots/{snapshot_id}",
        ):
            self.assertIn(path, paths)


@requires_scratch_postgres("System Builder API tests")
class SystemApiTest(unittest.TestCase):
    def setUp(self) -> None:
        scratch = scratch_schema(self, "sys_api", ledgers=(WORKSPACE_LEDGER,))
        seed_repository(scratch.conn, "repo_sys")
        seed_folder(scratch.conn, "fld_designers", visibility_mode="roles", allowed_roles=["designer"])
        seed_folder(scratch.conn, "fld_qa", visibility_mode="roles", allowed_roles=["qa"])
        seed_project(scratch.conn, PROJECT, "repo_sys")
        seed_project(scratch.conn, PAYLOAD, "repo_sys")
        seed_project(scratch.conn, VIEWER_HIDDEN, "repo_sys", folder_id="fld_designers")
        seed_project(scratch.conn, DESIGNER_HIDDEN, "repo_sys", folder_id="fld_qa")
        scratch.conn.commit()

        self.store = SystemStore(scratch.connection)
        self.service = SystemService(
            self.store, limits, git_link.GitLinkStore(scratch.connection)
        )
        for patcher in (
            mock.patch.object(systems_api, "store", self.store),
            mock.patch.object(systems_api, "service", self.service),
            mock.patch.object(systems_api, "workspace", _Workspace(scratch.conn)),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.app = _app()

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, path, **kwargs)

    def create(self, name: str = "Flight stack", **kwargs) -> dict:
        response = self.call("POST", "/api/systems", body={"name": name, **kwargs})
        self.assertEqual(response.status, 201, response.text)
        return response.json

    def seed_system(self, system_id: str, occurrences: list[dict], *, created_by: str = "owner@example.com") -> None:
        document = new_document("Seeded")
        if occurrences:
            document = ops.apply(
                document,
                [{"kind": "add-occurrence", "occurrence": occurrence} for occurrence in occurrences],
                seen_ids=set(), limits=limits(),
            ).document
        self.store.create(
            system_id, document, folder_id=None, created_by=created_by, role="admin",
        )

    def test_create_read_list_and_snapshots(self) -> None:
        created = self.create("Flight stack")
        self.assertTrue(created["systemId"].startswith("sys_"))
        self.assertEqual(created["version"], 1)
        self.assertEqual(created["document"]["schema"], "prism.system.v2")
        self.assertEqual(created["redacted"], [])

        path = f"/api/systems/{created['systemId']}"
        read = self.call("GET", path, user="viewer")
        self.assertEqual(read.status, 200, read.text)
        self.assertEqual(read.json["document"], created["document"])
        self.assertEqual(read.headers["etag"], f'"system:{created["systemId"]}:1"')

        listed = self.call("GET", "/api/systems", user="viewer").json
        self.assertEqual([row["systemId"] for row in listed], [created["systemId"]])
        self.assertNotIn("document", listed[0])

        take = self.call("POST", path + "/snapshots", body={"name": "Before wiring"})
        self.assertEqual(take.status, 201, take.text)
        snapshot = take.json
        self.assertTrue(snapshot["snapshotId"].startswith("snap_"))
        self.assertEqual(snapshot["document"], created["document"])

        listed_snaps = self.call("GET", path + "/snapshots", user="viewer").json
        self.assertEqual([row["snapshotId"] for row in listed_snaps], [snapshot["snapshotId"]])
        self.assertNotIn("document", listed_snaps[0])
        loaded = self.call("GET", f"{path}/snapshots/{snapshot['snapshotId']}", user="viewer")
        self.assertEqual(loaded.status, 200)
        self.assertEqual(loaded.json["document"]["name"], "Flight stack")

    def test_ops_are_guarded_and_advance_the_version(self) -> None:
        created = self.create()
        path = f"/api/systems/{created['systemId']}/ops"
        body = {"schema": "prism.system.ops.a0", "ops": _edit_ops()}

        missing = self.call("POST", path, body=body)
        self.assertEqual(missing.status, 428, missing.text)

        applied = self.call("POST", path, body=body, headers={"If-Match": f'"system:{created["systemId"]}:1"'})
        self.assertEqual(applied.status, 200, applied.text)
        self.assertEqual(applied.json["version"], 2)
        self.assertEqual([item["id"] for item in applied.json["document"]["occurrences"]], ["occ_obc", "occ_payload"])
        self.assertEqual(applied.headers["etag"], f'"system:{created["systemId"]}:2"')

        stale = self.call("POST", path, body=body, headers={"If-Match": f'"system:{created["systemId"]}:1"'})
        self.assertEqual(stale.status, 412, stale.text)
        self.assertEqual((stale.json["code"], stale.headers["etag"]), ("stale_version", applied.headers["etag"]))

        invalid = self.call(
            "POST", path, body={"schema": "prism.system.ops.a0", "ops": [{"kind": "add-occurrence", "occurrence": {"id": "occ_bad"}}]},
            headers={"If-Match": applied.headers["etag"]},
        )
        self.assertEqual((invalid.status, invalid.json["code"]), (422, "system_ops_invalid"))
        self.assertIn("pointer", invalid.json)
        self.assertTrue(invalid.json["pointer"].startswith("/ops/0"))

        history = self.call("GET", f"/api/systems/{created['systemId']}/history", user="viewer").json
        self.assertEqual([row["version"] for row in history], [2])
        self.assertNotIn("ops", history[0])
        self.assertNotIn("inverse", history[0])
        self.assertEqual(set(history[0]), {"version", "kind", "actor", "undoes", "touched", "createdAt"})

    def test_undo_restores_the_document_and_refuses_after_later_changes(self) -> None:
        created = self.create()
        system_path = f"/api/systems/{created['systemId']}"
        body = {"schema": "prism.system.ops.a0", "ops": _edit_ops()}
        applied = self.call("POST", system_path + "/ops", body=body, headers={"If-Match": f'"system:{created["systemId"]}:1"'})
        self.assertEqual(applied.status, 200, applied.text)

        undone = self.call(
            "POST", system_path + "/undo", body={"version": 2},
            headers={"If-Match": applied.headers["etag"]},
        )
        self.assertEqual(undone.status, 200, undone.text)
        self.assertEqual(undone.json["version"], 3)
        self.assertEqual(undone.json["document"]["occurrences"], [])
        self.assertEqual(undone.json["document"]["harnesses"], [])

        history = self.call("GET", system_path + "/history", user="viewer").json
        self.assertEqual([row["version"] for row in history], [3, 2])
        self.assertEqual((history[0]["kind"], history[0]["undoes"]), ("undo", 2))

        # A later request that touched the same occurrence makes version 2 unsafe to undo.
        fresh = self.create("Conflicting")
        fresh_path = f"/api/systems/{fresh['systemId']}"
        first = self.call(
            "POST", fresh_path + "/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "add-occurrence", "occurrence": _occurrence("occ_a", "A", PROJECT)}]},
            headers={"If-Match": f'"system:{fresh["systemId"]}:1"'},
        )
        self.assertEqual(first.status, 200, first.text)
        occurrence = first.json["document"]["occurrences"][0]
        second = self.call(
            "POST", fresh_path + "/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "replace-occurrence", "occurrence": {**occurrence, "label": "B"}}]},
            headers={"If-Match": first.headers["etag"]},
        )
        self.assertEqual(second.status, 200, second.text)

        conflict = self.call(
            "POST", fresh_path + "/undo", body={"version": 2},
            headers={"If-Match": second.headers["etag"]},
        )
        self.assertEqual((conflict.status, conflict.json["code"]), (409, "system_undo_conflict"))
        self.assertEqual(conflict.json["laterVersions"], [3])

        # Undoing the later change first clears the way: undo walks back in order.
        back = self.call(
            "POST", fresh_path + "/undo", body={"version": 3},
            headers={"If-Match": second.headers["etag"]},
        )
        self.assertEqual(back.status, 200, back.text)
        walked = self.call(
            "POST", fresh_path + "/undo", body={"version": 2},
            headers={"If-Match": back.headers["etag"]},
        )
        self.assertEqual(walked.status, 200, walked.text)
        self.assertEqual(walked.json["document"]["occurrences"], [])

    def test_a_redone_change_still_blocks_undoing_what_it_touches(self) -> None:
        fresh = self.create("Redo")
        path = f"/api/systems/{fresh['systemId']}"
        first = self.call(
            "POST", path + "/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "add-occurrence", "occurrence": _occurrence("occ_a", "A", PROJECT)}]},
            headers={"If-Match": f'"system:{fresh["systemId"]}:1"'},
        )
        occurrence = first.json["document"]["occurrences"][0]
        second = self.call(
            "POST", path + "/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "replace-occurrence", "occurrence": {**occurrence, "label": "B"}}]},
            headers={"If-Match": first.headers["etag"]},
        )
        undo = self.call("POST", path + "/undo", body={"version": 3}, headers={"If-Match": second.headers["etag"]})
        redo = self.call("POST", path + "/undo", body={"version": 4}, headers={"If-Match": undo.headers["etag"]})
        self.assertEqual(redo.status, 200, redo.text)
        self.assertEqual(redo.json["document"]["occurrences"][0]["label"], "B")
        blocked = self.call("POST", path + "/undo", body={"version": 2}, headers={"If-Match": redo.headers["etag"]})
        self.assertEqual((blocked.status, blocked.json["code"]), (409, "system_undo_conflict"))
        self.assertEqual(blocked.json["laterVersions"], [3])

    def test_undoing_a_request_that_changed_nothing_is_refused(self) -> None:
        created = self.create()
        system_path = f"/api/systems/{created['systemId']}"
        same = self.call(
            "POST", system_path + "/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "set-system-info", "name": created["name"]}]},
            headers={"If-Match": f'"system:{created["systemId"]}:1"'},
        )
        self.assertEqual(same.status, 200, same.text)
        refused = self.call("POST", system_path + "/undo", body={"version": 2}, headers={"If-Match": same.headers["etag"]})
        self.assertEqual((refused.status, refused.json["code"]), (409, "system_undo_nothing"))

    def test_viewers_cannot_write(self) -> None:
        created = self.create()
        path = f"/api/systems/{created['systemId']}"
        self.assertEqual(self.call("GET", path, user="viewer").status, 200)
        self.assertEqual(
            self.call("POST", path + "/ops", body={"schema": "prism.system.ops.a0", "ops": []}, user="viewer").status,
            403,
        )
        self.assertEqual(self.call("POST", path + "/snapshots", body={"name": "x"}, user="viewer").status, 403)
        self.assertEqual(self.call("DELETE", path, user="viewer").status, 403)

    def test_a_hidden_board_is_redacted_on_read_and_protected_on_edit(self) -> None:
        self.seed_system("sys_secret", [_occurrence("occ_secret", "Secret", VIEWER_HIDDEN)])
        path = "/api/systems/sys_secret"

        viewer = self.call("GET", path, user="viewer")
        self.assertEqual(viewer.status, 200, viewer.text)
        self.assertEqual(viewer.json["redacted"], ["occ_secret"])
        self.assertEqual(viewer.json["document"]["occurrences"][0]["source"], {"kind": "redacted"})

        designer = self.call("GET", path, user="designer")
        self.assertEqual(designer.json["redacted"], [])
        self.assertEqual(designer.json["document"]["occurrences"][0]["source"]["projectId"], VIEWER_HIDDEN)

        # A designer who cannot see a board may not remove its occurrence.
        self.seed_system("sys_refused", [_occurrence("occ_refused", "Refused", DESIGNER_HIDDEN)], created_by="owner@example.com")
        read = self.call("GET", "/api/systems/sys_refused", user="designer")
        self.assertEqual(read.json["redacted"], ["occ_refused"])
        refused = self.call(
            "POST", "/api/systems/sys_refused/ops",
            body={"schema": "prism.system.ops.a0", "ops": [{"kind": "remove-occurrence", "id": "occ_refused"}]},
            headers={"If-Match": read.headers["etag"]},
        )
        self.assertEqual((refused.status, refused.json["code"]), (403, "system_redacted"))

    def test_delete_needs_the_owner_or_an_admin(self) -> None:
        created = self.create()
        owned = f"/api/systems/{created['systemId']}"
        self.assertEqual(self.call("DELETE", owned).status, 204)
        self.assertEqual(self.call("GET", owned).status, 404)
        self.assertEqual(self.call("GET", owned).json["code"], "system_not_found")

        self.seed_system("sys_other", [], created_by="owner@example.com")
        other = "/api/systems/sys_other"
        self.assertEqual(self.call("DELETE", other).status, 403)
        self.assertEqual(self.call("DELETE", other, user="admin").status, 204)


if __name__ == "__main__":
    unittest.main()
