"""Board-level sub-ports API: routing, roles, ETags and refusals (§10.4)."""

from __future__ import annotations

import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from fastapi import FastAPI

from app.api import _helpers as api_helpers
from app.api import board_sub_ports as board_sub_ports_api
from app.core.errors import install_error_handlers
from app.core.policy import folder_visible
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from app.system_builder.board_sub_ports import BoardSubPortStore
from support.asgi import request as _request
from support.postgres import (
    requires_scratch_postgres,
    scratch_schema,
    seed_folder,
    seed_project,
    seed_repository,
)

PROJECT = "prj_0a1b2c3d4e5f"
OTHER_PROJECT = "prj_2b3c4d5e6f70"
VIEWER_HIDDEN = "prj_111111111111"
DESIGNER_HIDDEN = "prj_222222222222"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(board_sub_ports_api.router, prefix="/api/projects")
    return app


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
        self.assertIn("board_sub_ports_router", source)
        self.assertIn('tags=["board-sub-ports"]', source)
        paths = set(_app().openapi()["paths"])
        for path in (
            "/api/projects/{project_id}/sub-ports",
            "/api/projects/{project_id}/sub-ports/{sub_port_id}",
            "/api/projects/{project_id}/sub-ports/{sub_port_id}/history",
        ):
            self.assertIn(path, paths)


@requires_scratch_postgres("Board sub-port API tests")
class BoardSubPortApiTest(unittest.TestCase):
    def setUp(self) -> None:
        scratch = scratch_schema(self, "bsp_api", ledgers=(WORKSPACE_LEDGER,))
        seed_repository(scratch.conn, "repo_bsp")
        seed_folder(scratch.conn, "fld_designers", visibility_mode="roles", allowed_roles=["designer"])
        seed_folder(scratch.conn, "fld_qa", visibility_mode="roles", allowed_roles=["qa"])
        seed_project(scratch.conn, PROJECT, "repo_bsp")
        seed_project(scratch.conn, OTHER_PROJECT, "repo_bsp")
        seed_project(scratch.conn, VIEWER_HIDDEN, "repo_bsp", folder_id="fld_designers")
        seed_project(scratch.conn, DESIGNER_HIDDEN, "repo_bsp", folder_id="fld_qa")
        scratch.conn.commit()

        self.store = BoardSubPortStore(scratch.connection)
        for patcher in (
            mock.patch.object(board_sub_ports_api, "store", self.store),
            mock.patch.object(api_helpers, "workspace", _Workspace(scratch.conn)),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.app = _app()

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, path, **kwargs)

    def create(self, sub_port_id: str = "bsp_can", *, project_id: str = PROJECT, **kwargs) -> dict:
        body = {
            "id": sub_port_id,
            "connector": kwargs.pop("connector", "J1"),
            "name": kwargs.pop("name", "CAN"),
            "pins": kwargs.pop("pins", ["1", "2"]),
            **kwargs,
        }
        response = self.call("POST", f"/api/projects/{project_id}/sub-ports", body=body)
        self.assertEqual(response.status, 201, response.text)
        return response.json

    def test_create_read_list_filter_and_history(self) -> None:
        created = self.create()
        self.assertEqual(
            set(created),
            {
                "id", "projectId", "connector", "name", "pins", "version",
                "createdBy", "createdAt", "updatedBy", "updatedAt",
            },
        )
        self.assertEqual(
            (created["id"], created["projectId"], created["connector"], created["name"]),
            ("bsp_can", PROJECT, "J1", "CAN"),
        )
        self.assertEqual((created["pins"], created["version"]), (["1", "2"], 1))
        self.assertEqual(created["createdBy"], "designer@example.com")

        path = f"/api/projects/{PROJECT}/sub-ports/{created['id']}"
        read = self.call("GET", path, user="viewer")
        self.assertEqual(read.status, 200, read.text)
        self.assertEqual(read.json, created)
        self.assertEqual(read.headers["etag"], '"board-sub-port:bsp_can:1"')

        self.create("bsp_power", name="Power")
        self.create("bsp_data", connector="J2", name="Data")
        listed = self.call("GET", f"/api/projects/{PROJECT}/sub-ports", user="viewer")
        self.assertEqual(
            [(row["connector"], row["name"]) for row in listed.json],
            [("J1", "CAN"), ("J1", "Power"), ("J2", "Data")],
        )
        filtered = self.call("GET", f"/api/projects/{PROJECT}/sub-ports?connector=J1", user="viewer")
        self.assertEqual([row["id"] for row in filtered.json], ["bsp_can", "bsp_power"])

        deleted = self.call(
            "DELETE", f"/api/projects/{PROJECT}/sub-ports/bsp_data",
            headers={"If-Match": '"board-sub-port:bsp_data:1"'},
        )
        self.assertEqual(deleted.status, 200, deleted.text)
        self.assertEqual(deleted.json["version"], 2)
        self.assertIsNotNone(deleted.json["deletedAt"])
        self.assertEqual(deleted.json["deletedBy"], "designer@example.com")
        self.assertEqual(deleted.headers["etag"], '"board-sub-port:bsp_data:2"')

        live = self.call("GET", f"/api/projects/{PROJECT}/sub-ports", user="viewer")
        self.assertEqual([row["id"] for row in live.json], ["bsp_can", "bsp_power"])
        with_deleted = self.call(
            "GET", f"/api/projects/{PROJECT}/sub-ports?deleted=true", user="viewer",
        )
        self.assertEqual([row["id"] for row in with_deleted.json], ["bsp_can", "bsp_power", "bsp_data"])

        still_readable = self.call(
            "GET", f"/api/projects/{PROJECT}/sub-ports/bsp_data", user="viewer",
        )
        self.assertEqual(still_readable.status, 200)
        self.assertIsNotNone(still_readable.json["deletedAt"])

        history = self.call(
            "GET", f"/api/projects/{PROJECT}/sub-ports/bsp_data/history", user="viewer",
        )
        self.assertEqual(history.status, 200, history.text)
        self.assertEqual([row["version"] for row in history.json], [2, 1])
        self.assertEqual([row["action"] for row in history.json], ["delete", "create"])
        self.assertEqual(
            (history.json[0]["actor"], history.json[0]["pins"]),
            ("designer@example.com", ["1", "2"]),
        )

    def test_update_and_delete_are_guarded(self) -> None:
        created = self.create()
        path = f"/api/projects/{PROJECT}/sub-ports/{created['id']}"
        body = {"name": "CAN bus", "pins": ["2", "1"]}

        missing = self.call("PUT", path, body=body)
        self.assertEqual((missing.status, missing.json["code"]), (428, "precondition_required"))

        updated = self.call("PUT", path, body=body, headers={"If-Match": '"board-sub-port:bsp_can:1"'})
        self.assertEqual(updated.status, 200, updated.text)
        self.assertEqual((updated.json["version"], updated.json["name"]), (2, "CAN bus"))
        self.assertEqual(updated.headers["etag"], '"board-sub-port:bsp_can:2"')

        stale = self.call("PUT", path, body=body, headers={"If-Match": '"board-sub-port:bsp_can:1"'})
        self.assertEqual((stale.status, stale.json["code"]), (412, "stale_version"))
        self.assertEqual(stale.headers["etag"], '"board-sub-port:bsp_can:2"')

        missing_delete = self.call("DELETE", path)
        self.assertEqual(missing_delete.status, 428)
        stale_delete = self.call("DELETE", path, headers={"If-Match": '"board-sub-port:bsp_can:1"'})
        self.assertEqual((stale_delete.status, stale_delete.json["code"]), (412, "stale_version"))

        deleted = self.call("DELETE", path, headers={"If-Match": updated.headers["etag"]})
        self.assertEqual(deleted.status, 200, deleted.text)
        self.assertEqual(deleted.json["version"], 3)
        self.assertEqual(deleted.headers["etag"], '"board-sub-port:bsp_can:3"')

        change_deleted = self.call(
            "PUT", path, body=body, headers={"If-Match": deleted.headers["etag"]},
        )
        self.assertEqual((change_deleted.status, change_deleted.json["code"]), (409, "board_sub_port_deleted"))
        delete_deleted = self.call("DELETE", path, headers={"If-Match": deleted.headers["etag"]})
        self.assertEqual((delete_deleted.status, delete_deleted.json["code"]), (409, "board_sub_port_deleted"))

    def test_refusals_and_other_projects(self) -> None:
        self.create()
        duplicate = self.call(
            "POST", f"/api/projects/{PROJECT}/sub-ports",
            body={"id": "bsp_can", "connector": "J1", "name": "Other", "pins": ["3"]},
        )
        self.assertEqual((duplicate.status, duplicate.json["code"]), (409, "board_sub_port_exists"))

        taken = self.call(
            "POST", f"/api/projects/{PROJECT}/sub-ports",
            body={"id": "bsp_other", "connector": "J1", "name": "CAN", "pins": ["3"]},
        )
        self.assertEqual((taken.status, taken.json["code"]), (409, "board_sub_port_name_taken"))

        for body in (
            {"id": "BSP_CAN", "connector": "J1", "name": "Bad", "pins": ["1"]},
            {"id": "bsp_bad", "connector": "J1", "name": "Bad", "pins": []},
            {"id": "bsp_bad", "connector": "J1", "name": "Bad", "pins": ["1", "1"]},
        ):
            with self.subTest(body=body):
                refused = self.call("POST", f"/api/projects/{PROJECT}/sub-ports", body=body)
                self.assertEqual((refused.status, refused.json["code"]), (422, "board_sub_port_invalid"))

        unknown = f"/api/projects/{PROJECT}/sub-ports/bsp_missing"
        self.assertEqual(self.call("GET", unknown, user="viewer").status, 404)
        self.assertEqual(self.call("GET", unknown + "/history", user="viewer").status, 404)
        self.assertEqual(
            self.call(
                "PUT", unknown, body={"name": "X", "pins": ["1"]},
                headers={"If-Match": '"board-sub-port:bsp_missing:1"'},
            ).status,
            404,
        )
        self.assertEqual(
            self.call(
                "DELETE", unknown,
                headers={"If-Match": '"board-sub-port:bsp_missing:1"'},
            ).status,
            404,
        )

        other = f"/api/projects/{OTHER_PROJECT}/sub-ports/bsp_can"
        self.assertEqual(self.call("GET", other, user="viewer").status, 404)
        self.assertEqual(self.call("GET", other + "/history", user="viewer").status, 404)
        self.assertEqual(
            self.call(
                "PUT", other, body={"name": "X", "pins": ["1"]},
                headers={"If-Match": '"board-sub-port:bsp_can:1"'},
            ).status,
            404,
        )
        self.assertEqual(
            self.call(
                "DELETE", other, headers={"If-Match": '"board-sub-port:bsp_can:1"'},
            ).status,
            404,
        )

    def test_roles_and_project_visibility(self) -> None:
        created = self.create()
        path = f"/api/projects/{PROJECT}/sub-ports/{created['id']}"

        self.assertEqual(self.call("GET", path, user="viewer").status, 200)
        self.assertEqual(
            self.call("POST", f"/api/projects/{PROJECT}/sub-ports",
                      body={"id": "bsp_viewer", "connector": "J1", "name": "Viewer", "pins": ["1"]},
                      user="viewer").status,
            403,
        )
        self.assertEqual(
            self.call("PUT", path, body={"name": "X", "pins": ["1"]},
                      headers={"If-Match": '"board-sub-port:bsp_can:1"'}, user="viewer").status,
            403,
        )
        self.assertEqual(
            self.call("DELETE", path, headers={"If-Match": '"board-sub-port:bsp_can:1"'}, user="viewer").status,
            403,
        )

        # The designer's folder hides the project from a viewer.
        self.assertEqual(
            self.call("GET", f"/api/projects/{VIEWER_HIDDEN}/sub-ports", user="viewer").status,
            404,
        )
        self.assertEqual(
            self.call("GET", f"/api/projects/{VIEWER_HIDDEN}/sub-ports/bsp_can", user="viewer").status,
            404,
        )
        # A designer who cannot see this project may not write to it either.
        hidden_write = self.call(
            "POST", f"/api/projects/{DESIGNER_HIDDEN}/sub-ports",
            body={"id": "bsp_hidden", "connector": "J1", "name": "Hidden", "pins": ["1"]},
        )
        self.assertEqual(hidden_write.status, 404)


if __name__ == "__main__":
    unittest.main()
