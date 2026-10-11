"""SYS-04: the System Builder CRUD API against PostgreSQL and real fixture repositories.

Requests go through the FastAPI router (ETag, status mapping, role checks) into
``SystemService`` on an isolated schema. Child projects are the SYS-01 fixture
boards as Git repositories, and their interfaces are real extractions.
"""

from __future__ import annotations

import json
import os
import tempfile
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest import mock
from urllib.parse import quote

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

from fastapi import FastAPI

from system_builder_fixtures import build_fixture_repo

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import interface_cache
from app.core.security import AuthenticatedUser, get_current_user
from app.services.systems import service as service_module
from app.services.systems.interface_extractor import extract_for_revision
from app.services.systems.jobs import EXTRACT_JOB_KIND, artifact_key
from app.services.systems.service import SystemService
from app.services.systems.interface_extractor import EXTRACTOR_VERSION
from app.services.systems.store import SystemStore

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip().replace(
    "postgresql+psycopg://", "postgresql://", 1
)

USERS = {
    role: AuthenticatedUser(email=f"{role}@example.com", name=role, role=role)
    for role in ("viewer", "qa", "designer", "admin")
}


def _request(app, method: str, path: str, *, body=None, headers=None, user="designer"):
    """One ASGI request without adding httpx to Prism's runtime/test lock."""

    import asyncio

    raw_path, _, query = path.partition("?")
    payload = b"" if body is None else json.dumps(body).encode()
    header_list = [(b"content-type", b"application/json")]
    header_list += [(k.lower().encode(), v.encode()) for k, v in (headers or {}).items()]
    messages: list[dict] = []
    sent = False

    async def receive() -> dict:
        nonlocal sent
        if sent:
            return {"type": "http.disconnect"}
        sent = True
        return {"type": "http.request", "body": payload, "more_body": False}

    async def send(message: dict) -> None:
        messages.append(message)

    from urllib.parse import unquote

    app.dependency_overrides[get_current_user] = lambda: USERS[user]
    try:
        asyncio.run(app({
            "type": "http", "http_version": "1.1", "method": method, "scheme": "http",
            "path": unquote(raw_path), "raw_path": raw_path.encode(), "query_string": query.encode(),
            "headers": header_list, "client": ("test", 1), "server": ("test", 80), "root_path": "",
        }, receive, send))
    finally:
        app.dependency_overrides.pop(get_current_user, None)
    start = next(m for m in messages if m["type"] == "http.response.start")
    data = b"".join(m.get("body", b"") for m in messages if m["type"] == "http.response.body")
    response_headers = {k.decode().lower(): v.decode() for k, v in start["headers"]}
    return SimpleNamespace(
        status=start["status"], headers=response_headers, text=data.decode("utf-8", "replace"),
        json=json.loads(data) if data and response_headers.get("content-type", "").startswith("application/json") else None,
    )


class RoutingTest(unittest.TestCase):
    def test_main_registers_the_systems_router(self) -> None:
        source = (Path(__file__).resolve().parents[1] / "app" / "main.py").read_text(encoding="utf-8")
        self.assertIn('app.include_router(systems_router, prefix="/api/systems"', source)
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        paths = set(app.openapi()["paths"])
        for path in ("/api/systems", "/api/systems/{system_id}",
                     "/api/systems/{system_id}/instances/{instance_id}/interface",
                     "/api/systems/{system_id}/links/{link_id}/rows",
                     "/api/systems/{system_id}/history", "/api/systems/{system_id}/layout"):
            self.assertIn(path, paths)

    def test_extraction_job_handler_is_registered(self) -> None:
        from app.services.job_handlers import load_builtin_job_handlers, registered_job_kinds

        load_builtin_job_handlers()
        self.assertIn(EXTRACT_JOB_KIND, registered_job_kinds())


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for System Builder API tests")
@unittest.skipUnless(psycopg is not None, "psycopg is required for System Builder API tests")
class SystemApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls._scratch = tempfile.TemporaryDirectory()
        root = Path(cls._scratch.name)
        cls.commits = {board: build_fixture_repo(board, root / board) for board in ("mini_obc", "mini_payload")}
        cls.projects = {
            "prj_obc": SimpleNamespace(id="prj_obc", path=str(root / "mini_obc"), project_file="mini_obc.kicad_pro"),
            "prj_pay": SimpleNamespace(id="prj_pay", path=str(root / "mini_payload"), project_file="mini_payload.kicad_pro"),
        }
        cls.interfaces = {
            "prj_obc": extract_for_revision(cls.projects["prj_obc"], cls.commits["mini_obc"]["F0"]),
            "prj_pay": extract_for_revision(cls.projects["prj_pay"], cls.commits["mini_payload"]["F0"]),
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls._scratch.cleanup()

    def setUp(self) -> None:
        from app.services.workspace_schema_migrations import apply_workspace_migrations

        self.schema = f"system_api_{uuid.uuid4().hex}"
        self.conn = psycopg.connect(POSTGRES_URL, row_factory=dict_row)
        self.conn.execute(f'CREATE SCHEMA "{self.schema}"')
        self.conn.execute(f'SET search_path TO "{self.schema}", public')
        self.conn.execute(
            """
            CREATE TABLE ws_repositories (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'r',
                url TEXT, clone_path TEXT, import_type TEXT, last_synced_at TIMESTAMPTZ);
            CREATE TABLE ws_folders (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'f',
                parent_id TEXT, visibility_mode TEXT,
                allowed_roles JSONB NOT NULL DEFAULT '[]'::jsonb);
            CREATE TABLE ws_projects (id TEXT PRIMARY KEY,
                repo_id TEXT NOT NULL REFERENCES ws_repositories(id),
                name TEXT NOT NULL, display_name TEXT, relative_path TEXT NOT NULL DEFAULT '.',
                folder_id TEXT REFERENCES ws_folders(id) ON DELETE SET NULL);
            CREATE TABLE ws_project_portfolio (project_id TEXT PRIMARY KEY);
            CREATE TABLE ws_jobs (id TEXT PRIMARY KEY, kind TEXT NOT NULL, status TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '', percent REAL NOT NULL DEFAULT 0,
                payload JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
            INSERT INTO ws_repositories (id) VALUES ('repo_obc'), ('repo_pay');
            INSERT INTO ws_folders (id, visibility_mode, allowed_roles) VALUES
                ('fld_open', NULL, '[]'), ('fld_designers', 'roles', '["designer"]'),
                ('fld_admins', 'roles', '["admin"]');
            INSERT INTO ws_projects (id, repo_id, name, folder_id) VALUES
                ('prj_obc', 'repo_obc', 'mini_obc', 'fld_open'),
                ('prj_pay', 'repo_pay', 'mini_payload', 'fld_open');
            """,
            prepare=False,
        )
        apply_workspace_migrations(self.conn)
        self.conn.commit()

        schema = self.schema

        @contextmanager
        def connect():
            conn = psycopg.connect(POSTGRES_URL, row_factory=dict_row)
            try:
                conn.execute(f'SET search_path TO "{schema}", public')
                yield conn
            finally:
                conn.close()

        self.connect = connect
        self.enqueued: list[tuple[str, str]] = []

        def enqueue(project_id: str, commit: str, *, requested_by: str = "") -> dict:
            self.enqueued.append((project_id, commit))
            return {"job_id": f"job-{len(self.enqueued)}", "status": "queued"}

        self.checks: list[tuple[str, str]] = []

        def enqueue_check(instance_id: str, project_id: str, *, requested_by: str = "") -> dict:
            self.checks.append((instance_id, project_id))
            return {"job_id": "check-job", "status": "queued"}

        self.service = SystemService(
            connect=connect, project_loader=self.projects.get, enqueue=enqueue,
            enqueue_check=enqueue_check,
        )
        patcher = mock.patch.object(service_module, "service", self.service)
        patcher.start()
        self.addCleanup(patcher.stop)
        self.app = FastAPI()
        install_error_handlers(self.app)
        self.app.include_router(systems_api.router, prefix="/api/systems")

    def tearDown(self) -> None:
        self.conn.rollback()
        self.conn.execute(f'DROP SCHEMA "{self.schema}" CASCADE')
        self.conn.commit()
        self.conn.close()

    # ------------------------------------------------------------------ helpers

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, f"/api/systems{path}", **kwargs)

    def create_system(self, name: str = "Flight stack", folder: str | None = None) -> tuple[str, str]:
        response = self.call("POST", "", body={"name": name, "folderId": folder})
        self.assertEqual(response.status, 201, response.json)
        return response.json["id"], response.headers["etag"]

    def mutate(self, method: str, path: str, etag: str, *, expect: int = 200, **kwargs):
        response = self.call(method, path, headers={"If-Match": etag}, **kwargs)
        self.assertEqual(response.status, expect, response.json)
        return response

    def cache_interfaces(self) -> None:
        with self.connect() as conn:
            store = SystemStore(conn)
            for payload in self.interfaces.values():
                store.put_interface(payload)
            conn.commit()

    def port_key(self, project_id: str, reference: str) -> str:
        return next(c["portKey"] for c in self.interfaces[project_id]["components"]
                    if c["reference"] == reference)

    def two_boards(self) -> tuple[str, str, str, str]:
        """A system with OBC (tracking main) and PAY; interfaces cached."""
        sid, etag = self.create_system()
        obc = self.mutate("POST", f"/{sid}/instances", etag, expect=201,
                          body={"projectId": "prj_obc", "label": "OBC", "trackedRef": "main"})
        pay = self.mutate("POST", f"/{sid}/instances", obc.headers["etag"], expect=201,
                          body={"projectId": "prj_pay", "label": "PAY",
                                "baselineCommit": self.commits["mini_payload"]["F0"][:10]})
        self.cache_interfaces()
        return sid, pay.headers["etag"], obc.json["id"], pay.json["id"]

    def link_j7_j4(self, sid: str, etag: str, obc: str, pay: str):
        return self.mutate("POST", f"/{sid}/links", etag, expect=201, body={
            "a": {"instanceId": obc, "portKey": self.port_key("prj_obc", "J7")},
            "b": {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")},
            "name": "Payload bus",
        })

    def hide_project(self, project_id: str, folder: str) -> None:
        self.conn.execute("UPDATE ws_projects SET folder_id = %s WHERE id = %s", (folder, project_id))
        self.conn.commit()

    # ------------------------------------------------------------------ systems

    def test_create_list_read_and_etag(self) -> None:
        sid, etag = self.create_system()
        self.assertTrue(sid.startswith("sys_"))
        self.assertEqual(etag, f'"sys:{sid}:1"')
        listed = self.call("GET", "", user="viewer")
        self.assertEqual([s["id"] for s in listed.json], [sid])
        self.assertEqual(listed.json[0]["instanceCount"], 0)
        document = self.call("GET", f"/{sid}", user="viewer")
        self.assertEqual(document.status, 200)
        self.assertEqual(document.headers["etag"], etag)
        self.assertEqual(document.json["instances"], [])
        self.assertEqual(document.json["findingCounts"],
                         {"error": 0, "warning": 0, "info": 0, "notEvaluated": 0, "waived": 0})

    def test_mutations_need_designer_and_if_match(self) -> None:
        sid, etag = self.create_system()
        self.assertEqual(self.call("POST", "", body={"name": "x"}, user="viewer").status, 403)
        self.assertEqual(self.call("PATCH", f"/{sid}", body={"name": "x"}, user="qa",
                                   headers={"If-Match": etag}).status, 403)
        self.assertEqual(self.call("PATCH", f"/{sid}", body={"name": "x"}).status, 428)
        renamed = self.mutate("PATCH", f"/{sid}", etag, body={"name": "Renamed"})
        self.assertEqual(renamed.json["name"], "Renamed")
        self.assertEqual(renamed.headers["etag"], f'"sys:{sid}:2"')
        stale = self.call("PATCH", f"/{sid}", body={"name": "Again"}, headers={"If-Match": etag})
        self.assertEqual(stale.status, 412)
        self.assertEqual(stale.headers["etag"], f'"sys:{sid}:2"')
        garbage = self.call("PATCH", f"/{sid}", body={"name": "Again"}, headers={"If-Match": "*"})
        self.assertEqual(garbage.status, 412)
        other_system = self.call("PATCH", f"/{sid}", body={"name": "Again"},
                                 headers={"If-Match": '"sys:sys_other:2"'})
        self.assertEqual(other_system.status, 412)
        self.assertEqual(self.call("GET", f"/{sid}").json["system"]["name"], "Renamed")

    def test_optional_rules_are_set_through_patch(self) -> None:
        sid, etag = self.create_system()
        self.assertEqual(self.call("GET", f"/{sid}").json["system"]["optionalRules"], [])
        enabled = self.mutate("PATCH", f"/{sid}", etag, body={"optionalRules": ["SYS-V09"]})
        self.assertEqual(enabled.json["optionalRules"], ["SYS-V09"])
        self.mutate("PATCH", f"/{sid}", enabled.headers["etag"], body={"optionalRules": ["SYS-V01"]}, expect=422)
        cleared = self.mutate("PATCH", f"/{sid}", enabled.headers["etag"], body={"optionalRules": None})
        self.assertEqual(cleared.json["optionalRules"], [])

    def test_folder_visibility_hides_systems(self) -> None:
        hidden, _ = self.create_system("Secret", folder="fld_designers")
        open_sid, _ = self.create_system("Open", folder="fld_open")
        self.assertEqual([s["id"] for s in self.call("GET", "", user="viewer").json], [open_sid])
        self.assertEqual(self.call("GET", f"/{hidden}", user="viewer").status, 404)
        self.assertEqual(self.call("GET", f"/{hidden}", user="designer").status, 200)
        # A folder the caller cannot see is not a valid destination.
        response = self.call("POST", "", body={"name": "x", "folderId": "fld_admins"})
        self.assertEqual(response.status, 422)
        self.assertEqual(self.call("POST", "", body={"name": "x", "folderId": "fld_nope"}).status, 422)

    def test_workspace_listing_includes_systems(self) -> None:
        from app.services.systems.visibility import visible_systems

        sid, _ = self.create_system("Root system")
        in_folder, _ = self.create_system("Filed", folder="fld_open")
        hidden, _ = self.create_system("Secret", folder="fld_designers")
        with self.connect() as conn:
            root = visible_systems(conn, "viewer", folder_id=None)
            everything = visible_systems(conn, None)
            filed = visible_systems(conn, "viewer", folder_id="fld_open")
        self.assertEqual([s["id"] for s in root], [sid])
        self.assertEqual([s["id"] for s in filed], [in_folder])
        self.assertEqual({s["id"] for s in everything}, {sid, in_folder, hidden})
        self.assertEqual(root[0]["kind"], "system")

    def test_system_changes_bump_the_workspace_version(self) -> None:
        def version() -> int:
            return self.conn.execute("SELECT version FROM ws_workspace_state").fetchone()["version"]

        before = version()
        sid, etag = self.create_system()
        after_create = version()
        self.assertGreater(after_create, before)
        self.conn.commit()
        self.mutate("PATCH", f"/{sid}", etag, body={"description": "d"})
        self.assertGreater(version(), after_create)

    def test_delete_system(self) -> None:
        sid, etag = self.create_system()
        self.assertEqual(self.call("DELETE", f"/{sid}").status, 428)
        deleted = self.mutate("DELETE", f"/{sid}", etag, expect=200)
        # D-P2-31: the answer says whether it was deleted or, being referenced, archived.
        self.assertEqual((deleted.json["deleted"], deleted.json["archived"]), (True, False))
        self.assertEqual(self.call("GET", f"/{sid}").status, 404)

    # ------------------------------------------------------------------ instances

    def test_add_instance_resolves_tracked_ref_once_and_enqueues_extraction(self) -> None:
        sid, etag = self.create_system()
        response = self.mutate("POST", f"/{sid}/instances", etag, expect=201,
                               body={"projectId": "prj_obc", "label": "OBC-A", "trackedRef": "main"})
        f0 = self.commits["mini_obc"]["F0"]
        self.assertEqual(response.json["baselineCommit"], f0)
        self.assertEqual(response.json["trackedRef"], "main")
        self.assertEqual(self.enqueued, [("prj_obc", f0)])
        # An explicit baseline on another branch; a short SHA is expanded.
        f1 = self.commits["mini_obc"]["F1"]
        second = self.mutate("POST", f"/{sid}/instances", response.headers["etag"], expect=201,
                             body={"projectId": "prj_obc", "label": "OBC-B", "baselineCommit": f1[:8],
                                   "trackedRef": "step/F1", "pinned": True})
        self.assertEqual(second.json["baselineCommit"], f1)
        self.assertTrue(second.json["pinned"])

    def test_add_instance_rejects_bad_sources(self) -> None:
        sid, etag = self.create_system()
        cases = [
            ({"projectId": "prj_obc", "label": "A", "trackedRef": "nope"}, 422),
            ({"projectId": "prj_obc", "label": "A", "trackedRef": "--upload-pack=x"}, 422),
            ({"projectId": "prj_obc", "label": "A", "baselineCommit": "f" * 40}, 422),
            ({"projectId": "prj_obc", "label": "A", "baselineCommit": "not-hex"}, 422),
            ({"projectId": "prj_obc", "label": "A"}, 422),
            ({"projectId": "prj_missing", "label": "A", "trackedRef": "main"}, 404),
        ]
        for body, status in cases:
            with self.subTest(body=body):
                self.assertEqual(self.call("POST", f"/{sid}/instances", body=body,
                                           headers={"If-Match": etag}).status, status)
        self.hide_project("prj_obc", "fld_admins")
        hidden = self.call("POST", f"/{sid}/instances", headers={"If-Match": etag},
                           body={"projectId": "prj_obc", "label": "A", "trackedRef": "main"})
        self.assertEqual(hidden.status, 404)
        self.assertEqual(self.enqueued, [])

    def test_labels_are_unique_case_insensitively(self) -> None:
        sid, etag, _obc, pay = self.two_boards()
        clash = self.call("POST", f"/{sid}/instances", headers={"If-Match": etag},
                          body={"projectId": "prj_obc", "label": "obc", "trackedRef": "main"})
        self.assertEqual(clash.status, 409)
        renamed = self.mutate("PATCH", f"/{sid}/instances/{pay}", etag, body={"label": "Payload"})
        self.assertEqual(renamed.json["label"], "Payload")

    def test_update_instance_tracked_ref_is_validated_and_clears_tip(self) -> None:
        sid, etag, obc, _pay = self.two_boards()
        with self.connect() as conn:
            SystemStore(conn).record_source_check(obc, tip_commit="c" * 40, checked_commit="c" * 40,
                                                  outcome="update_available")
            conn.commit()
        self.assertEqual(self.call("PATCH", f"/{sid}/instances/{obc}", headers={"If-Match": etag},
                                   body={"trackedRef": "missing"}).status, 422)
        moved = self.mutate("PATCH", f"/{sid}/instances/{obc}", etag, body={"trackedRef": "step/F2"})
        self.assertEqual(moved.json["trackedRef"], "step/F2")
        self.assertIsNone(moved.json["tipCommit"])
        # The baseline never moves through PATCH.
        self.assertEqual(moved.json["baselineCommit"], self.commits["mini_obc"]["F0"])
        untracked = self.mutate("PATCH", f"/{sid}/instances/{obc}", moved.headers["etag"],
                                body={"trackedRef": None, "pinned": True})
        self.assertIsNone(untracked.json["trackedRef"])
        self.assertTrue(untracked.json["pinned"])

    def test_document_reports_pending_interface_and_requests_it_once(self) -> None:
        sid, etag = self.create_system()
        self.mutate("POST", f"/{sid}/instances", etag, expect=201,
                    body={"projectId": "prj_obc", "label": "OBC", "trackedRef": "main"})
        self.enqueued.clear()
        document = self.call("GET", f"/{sid}").json
        self.assertEqual(document["instances"][0]["interface"]["status"], "pending")
        self.assertIsNone(document["instances"][0]["ports"])
        self.assertEqual(len(self.enqueued), 1)  # no job row yet, so the read asks for one
        # A failed job is reported, not silently retried on every read.
        self.conn.execute(
            "INSERT INTO ws_jobs (id, kind, status, artifact_key, error_code, error_message)"
            " VALUES ('job-f', %s, 'failed', %s, 'source_unavailable', 'secret path detail')",
            (EXTRACT_JOB_KIND, artifact_key("prj_obc", self.commits["mini_obc"]["F0"])),
        )
        self.conn.commit()
        self.enqueued.clear()
        state = self.call("GET", f"/{sid}").json["instances"][0]["interface"]
        self.assertEqual(state, {"status": "failed", "digest": None, "hasPcb": None,
                                 "jobId": "job-f", "errorCode": "source_unavailable"})
        self.assertEqual(self.enqueued, [])

    def test_document_lists_exposed_ports_at_baseline(self) -> None:
        sid, _etag, obc, _pay = self.two_boards()
        document = self.call("GET", f"/{sid}", user="viewer").json
        instance = next(i for i in document["instances"] if i["id"] == obc)
        self.assertEqual(instance["interface"]["status"], "ready")
        self.assertEqual(instance["projectName"], "mini_obc")
        references = sorted(p["reference"] for p in instance["ports"])
        self.assertEqual(references, ["J2", "J5", "J6", "J7"])
        self.assertTrue(all(p["exposed"] for p in instance["ports"]))

    def test_remove_instance_needs_cascade_when_linked(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        etag = self.link_j7_j4(sid, etag, obc, pay).headers["etag"]
        self.assertEqual(self.call("DELETE", f"/{sid}/instances/{obc}",
                                   headers={"If-Match": etag}).status, 409)
        removed = self.mutate("DELETE", f"/{sid}/instances/{obc}?cascade=links", etag, expect=204)
        document = self.call("GET", f"/{sid}")
        self.assertEqual(document.headers["etag"], removed.headers["etag"])
        self.assertEqual([i["id"] for i in document.json["instances"]], [pay])
        self.assertEqual(document.json["links"], [])

    # ------------------------------------------------------------------ interface and overrides

    def test_interface_endpoint(self) -> None:
        sid, _etag, obc, _pay = self.two_boards()
        ready = self.call("GET", f"/{sid}/instances/{obc}/interface", user="viewer")
        self.assertEqual(ready.status, 200)
        self.assertTrue(ready.json["atBaseline"])
        by_ref = {c["reference"]: c for c in ready.json["components"]}
        self.assertTrue(by_ref["J7"]["exposed"])
        self.assertFalse(by_ref["R10"]["exposed"])
        f1 = self.commits["mini_obc"]["F1"]
        queued = self.call("GET", f"/{sid}/instances/{obc}/interface?commit={f1}", user="viewer")
        self.assertEqual(queued.status, 202)
        self.assertEqual(queued.json["status"], "queued")
        self.assertEqual(self.enqueued[-1], ("prj_obc", f1))
        self.assertEqual(self.call("GET", f"/{sid}/instances/{obc}/interface?commit={'e' * 40}").status, 404)
        self.assertEqual(self.call("GET", f"/{sid}/instances/{obc}/interface?commit=abc").status, 422)

    def test_check_now_queues_detection_for_a_tracked_instance(self) -> None:
        sid, _etag, obc, pay = self.two_boards()
        self.assertEqual(self.checks, [(obc, "prj_obc")])  # SB2-124: a tracked board is checked when added
        self.checks.clear()
        self.assertEqual(self.call("POST", f"/{sid}/instances/{obc}/check", user="viewer").status, 403)
        queued = self.call("POST", f"/{sid}/instances/{obc}/check")
        self.assertEqual((queued.status, queued.json), (202, {"job_id": "check-job", "status": "queued"}))
        self.assertEqual(self.checks, [(obc, "prj_obc")])
        # PAY was added by commit, without a tracked branch.
        self.assertEqual(self.call("POST", f"/{sid}/instances/{pay}/check").status, 409)
        self.hide_project("prj_obc", "fld_admins")
        self.assertEqual(self.call("POST", f"/{sid}/instances/{obc}/check").status, 404)

    def test_validation_endpoint_redacts_restricted_boards(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        self.mutate("PUT", f"/{sid}/links/{created.json['id']}/rows", created.headers["etag"],
                    body=[{"pinA": "3", "pinB": "3"}])
        with self.connect() as conn:  # make PAY's row pad vanish from its baseline interface
            payload = dict(self.interfaces["prj_pay"])
            payload["components"] = [
                {**c, "pins": [p for p in c["pins"] if p["pad"] != "3"]} if c["reference"] == "J4" else c
                for c in payload["components"]
            ]
            interface_cache.interfaces.clear()  # a direct artifact write bypasses the SB2-93 cache
            conn.execute("UPDATE system_interface_artifacts SET payload = %s WHERE project_id = 'prj_pay'",
                         (json.dumps(payload),))
            conn.commit()
        designer = self.call("GET", f"/{sid}/validation").json
        [absent] = [f for f in designer["findings"] if f["rule"] == "SYS-V04"]
        self.assertEqual((absent["reference"], absent["pin"], absent["redacted"]), ("J4", "3", False))
        self.hide_project("prj_pay", "fld_designers")
        viewer = self.call("GET", f"/{sid}/validation", user="viewer")
        self.assertEqual(viewer.status, 200)
        [redacted] = [f for f in viewer.json["findings"] if f["rule"] == "SYS-V04"]
        self.assertEqual((redacted["reference"], redacted["pin"], redacted["redacted"]), (None, None, True))
        self.assertEqual(self.call("GET", f"/{sid}").json["findingCounts"]["error"], 1)

    def test_port_overrides(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        r10 = quote(self.port_key("prj_obc", "R10"), safe="")
        promoted = self.mutate("PUT", f"/{sid}/instances/{obc}/ports/{r10}/override", etag,
                               body={"state": "promoted"})
        self.assertTrue(promoted.json["exposed"])
        etag = promoted.headers["etag"]
        j5 = quote(self.port_key("prj_obc", "J5"), safe="")
        etag = self.mutate("PUT", f"/{sid}/instances/{obc}/ports/{j5}/override", etag,
                           body={"state": "hidden"}).headers["etag"]
        ports = next(i for i in self.call("GET", f"/{sid}").json["instances"] if i["id"] == obc)["ports"]
        by_ref = {p["reference"]: p for p in ports}
        self.assertTrue(by_ref["R10"]["exposed"])
        self.assertFalse(by_ref["J5"]["exposed"])
        self.assertEqual(by_ref["J5"]["override"], "hidden")
        # A linked port cannot be hidden.
        etag = self.link_j7_j4(sid, etag, obc, pay).headers["etag"]
        j7 = quote(self.port_key("prj_obc", "J7"), safe="")
        self.assertEqual(self.call("PUT", f"/{sid}/instances/{obc}/ports/{j7}/override",
                                   headers={"If-Match": etag}, body={"state": "hidden"}).status, 409)
        unknown = quote("/nope/nope", safe="")
        self.assertEqual(self.call("PUT", f"/{sid}/instances/{obc}/ports/{unknown}/override",
                                   headers={"If-Match": etag}, body={"state": "hidden"}).status, 422)
        cleared = self.mutate("PUT", f"/{sid}/instances/{obc}/ports/{j5}/override", etag,
                              body={"state": None})
        self.assertIsNone(cleared.json["override"])

    def test_link_needs_ready_interfaces(self) -> None:
        sid, etag = self.create_system()
        a = self.mutate("POST", f"/{sid}/instances", etag, expect=201,
                        body={"projectId": "prj_obc", "label": "OBC", "trackedRef": "main"})
        b = self.mutate("POST", f"/{sid}/instances", a.headers["etag"], expect=201,
                        body={"projectId": "prj_pay", "label": "PAY", "trackedRef": "main"})
        response = self.call("POST", f"/{sid}/links", headers={"If-Match": b.headers["etag"]}, body={
            "a": {"instanceId": a.json["id"], "portKey": self.port_key("prj_obc", "J7")},
            "b": {"instanceId": b.json["id"], "portKey": self.port_key("prj_pay", "J4")},
        })
        self.assertEqual(response.status, 409)
        self.assertIn("interface_not_ready", response.json["detail"])

    # ------------------------------------------------------------------ links and rows

    def test_link_captures_port_baselines(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        link = self.link_j7_j4(sid, etag, obc, pay).json
        self.assertTrue(link["id"].startswith("slk_"))
        self.assertEqual(link["a"]["port"]["reference"], "J7")
        self.assertEqual(link["a"]["port"]["pinCount"], 20)
        self.assertEqual(link["a"]["port"]["libId"], "Connector_Generic:Conn_02x10_Odd_Even")
        self.assertTrue(link["a"]["resolved"] and link["a"]["exposed"])
        self.assertEqual(link["b"]["port"]["reference"], "J4")

    def test_link_ports_must_be_exposed_and_distinct(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        j7 = self.port_key("prj_obc", "J7")
        cases = [
            ({"a": {"instanceId": obc, "portKey": self.port_key("prj_obc", "R10")},
              "b": {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")}}, 409),
            ({"a": {"instanceId": obc, "portKey": "/no/such"},
              "b": {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")}}, 422),
            ({"a": {"instanceId": obc, "portKey": j7}, "b": {"instanceId": obc, "portKey": j7}}, 422),
            ({"a": {"instanceId": "sin_missing", "portKey": j7},
              "b": {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")}}, 404),
        ]
        for body, status in cases:
            with self.subTest(status=status, body=body):
                self.assertEqual(self.call("POST", f"/{sid}/links", body=body,
                                           headers={"If-Match": etag}).status, status)

    def test_rows_capture_observed_nets(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        lid, etag = created.json["id"], created.headers["etag"]
        rows = [{"pinA": "3", "pinB": "3", "signal": "SPI_SCK"},
                {"pinA": "1", "pinB": "1", "signal": "GND", "source": "generator"}]
        saved = self.mutate("PUT", f"/{sid}/links/{lid}/rows", etag, body=rows)
        by_pin = {row["pinA"]: row for row in saved.json["rows"]}
        self.assertEqual(by_pin["3"]["netA"], ["/Payload IF/SPI_SCK"])
        self.assertEqual(by_pin["3"]["netB"], ["/SCK_IN"])
        self.assertEqual(by_pin["3"]["observedA"]["nets"], ["/Payload IF/SPI_SCK"])
        self.assertTrue(by_pin["3"]["observedB"]["present"])
        self.assertEqual(by_pin["1"]["source"], "generator")
        etag = saved.headers["etag"]
        # Keeping a row id keeps the row; unknown pads and duplicates are refused.
        keep = [{"id": by_pin["3"]["id"], "pinA": "3", "pinB": "3", "signal": "SCK"}]
        kept = self.mutate("PUT", f"/{sid}/links/{lid}/rows", etag, body=keep)
        self.assertEqual([r["id"] for r in kept.json["rows"]], [by_pin["3"]["id"]])
        etag = kept.headers["etag"]
        for bad in ([{"pinA": "99", "pinB": "1"}],
                    [{"pinA": "1", "pinB": "1"}, {"pinA": "1", "pinB": "1"}],
                    [{"id": "srw_other", "pinA": "1", "pinB": "1"}]):
            with self.subTest(rows=bad):
                self.assertIn(self.call("PUT", f"/{sid}/links/{lid}/rows", body=bad,
                                        headers={"If-Match": etag}).status, (409, 422))
        too_many = [{"pinA": "1", "pinB": str(n)} for n in range(5001)]
        self.assertEqual(self.call("PUT", f"/{sid}/links/{lid}/rows", body=too_many,
                                   headers={"If-Match": etag}).status, 422)
        document = self.call("GET", f"/{sid}").json
        self.assertEqual(document["links"][0]["rows"][0]["signal"], "SCK")

    def test_harness_routes(self) -> None:
        """SB2-14 (CONTRACTS_P2 §17.3): create with identity wires, wires, generate, and back to a link."""
        sid, etag, obc, pay = self.two_boards()
        ends = [{"instanceId": obc, "portKey": self.port_key("prj_obc", "J7")},
                {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")}]
        self.assertEqual(self.call("POST", f"/{sid}/harnesses", body={"ends": ends}).status, 428)
        created = self.mutate("POST", f"/{sid}/harnesses", etag, expect=201,
                              body={"name": "WH-001", "ends": ends, "identity": True})
        harness = created.json
        self.assertEqual(len(harness["ends"]), 2)
        self.assertTrue(harness["wires"])
        a, b = harness["ends"][0]["id"], harness["ends"][1]["id"]
        generated = self.call("POST", f"/{sid}/harnesses/{harness['id']}/generate",
                              body={"fromEnd": a, "toEnd": b, "generator": "identity"})
        self.assertEqual((generated.status, generated.json["wires"]), (200, []))
        first = harness["wires"][0]
        replaced = self.mutate("PUT", f"/{sid}/harnesses/{harness['id']}/wires", created.headers["etag"],
                               body=[{"id": first["id"], "from": first["from"], "to": first["to"], "gaugeAwg": 26}])
        self.assertEqual([w["gaugeAwg"] for w in replaced.json["wires"]], [26])
        listed = self.call("GET", f"/{sid}/harnesses").json
        self.assertEqual([h["id"] for h in listed], [harness["id"]])
        link = self.mutate("POST", f"/{sid}/harnesses/{harness['id']}/to-link", replaced.headers["etag"], expect=201)
        self.assertEqual(len(link.json["rows"]), 1)
        self.assertEqual(self.call("GET", f"/{sid}").json["harnesses"], [])
        back = self.mutate("POST", f"/{sid}/links/{link.json['id']}/to-harness", link.headers["etag"], expect=201)
        self.assertEqual(len(back.json["wires"]), 1)
        self.mutate("DELETE", f"/{sid}/harnesses/{back.json['id']}", back.headers["etag"], expect=204)

    def test_harness_node_routes(self) -> None:
        """SB2-45 (CONTRACTS_P2 §17.9): breakouts and waypoints replace as a list, checked, and follow end deletes."""
        sid, etag, obc, pay = self.two_boards()
        ends = [{"instanceId": obc, "portKey": self.port_key("prj_obc", "J7")},
                {"instanceId": pay, "portKey": self.port_key("prj_pay", "J4")}, {"pinCount": 4}]
        created = self.mutate("POST", f"/{sid}/harnesses", etag, expect=201, body={"name": "WH-N", "ends": ends})
        hid = created.json["id"]
        a, b, c = (end["id"] for end in created.json["ends"])
        self.assertEqual(created.json["nodes"], [])
        breakout = "shd_" + "1" * 32
        nodes = [{"id": breakout, "kind": "breakout", "positionMm": [10, 0, 20], "ends": [c]},
                 {"kind": "waypoint", "positionMm": [5, 0, 10], "between": [a, breakout], "pinned": True},
                 {"kind": "waypoint", "positionMm": [20, 0, 10], "between": [breakout, b]}]
        self.assertEqual(self.call("PUT", f"/{sid}/harnesses/{hid}/nodes", body=nodes).status, 428)
        put = self.mutate("PUT", f"/{sid}/harnesses/{hid}/nodes", created.headers["etag"], body=nodes)
        stored = put.json["nodes"]
        shape = sorted((n["kind"], n["order"], n["pinned"], n["between"] or [], n["ends"]) for n in stored)
        self.assertEqual(shape, sorted([("breakout", 0, False, [], [c]), ("waypoint", 0, True, [a, breakout], []),
                                        ("waypoint", 0, False, [breakout, b], [])]))
        self.assertTrue(all(n["id"].startswith("shd_") for n in stored))
        bad = [
            [{"kind": "waypoint", "positionMm": [0, 0, 0], "between": [a, "shd_" + "9" * 32]}],
            [{"kind": "breakout", "positionMm": [0, 0, 0], "pinned": True}],
            [{"kind": "breakout", "positionMm": [0, 0, 0], "ends": [a]}, {"kind": "breakout", "positionMm": [1, 0, 0], "ends": [a]}],
            [{"kind": "waypoint", "positionMm": [0, 0, 0], "between": [a, b]},
             {"kind": "waypoint", "positionMm": [1, 0, 0], "between": [b, a]}],
            [{"kind": "waypoint", "positionMm": [0, 0, 2e6], "between": [a, b]}],
            [{"id": "shd_nope", "kind": "breakout", "positionMm": [0, 0, 0]}],
            [{"kind": "waypoint", "positionMm": [0, 0, 0]}],
        ]
        for body in bad:
            with self.subTest(nodes=body):
                self.assertEqual(self.call("PUT", f"/{sid}/harnesses/{hid}/nodes", body=body,
                                           headers={"If-Match": put.headers["etag"]}).status, 422)
        dropped = self.mutate("DELETE", f"/{sid}/harnesses/{hid}/ends/{a}", put.headers["etag"])
        self.assertEqual(sorted(n["between"] or [] for n in dropped.json["nodes"]), [[], [breakout, b]])
        dropped = self.mutate("DELETE", f"/{sid}/harnesses/{hid}/ends/{c}", dropped.headers["etag"])
        self.assertEqual([n["ends"] for n in dropped.json["nodes"] if n["kind"] == "breakout"], [[]])

    def test_update_and_delete_link(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        lid = created.json["id"]
        updated = self.mutate("PATCH", f"/{sid}/links/{lid}", created.headers["etag"],
                              body={"harness": "WH-001", "name": "Bus"})
        self.assertEqual((updated.json["name"], updated.json["harness"]), ("Bus", "WH-001"))
        cleared = self.mutate("PATCH", f"/{sid}/links/{lid}", updated.headers["etag"],
                              body={"harness": None})
        self.assertIsNone(cleared.json["harness"])
        self.assertEqual(cleared.json["name"], "Bus")
        self.mutate("DELETE", f"/{sid}/links/{lid}", cleared.headers["etag"], expect=204)
        self.assertEqual(self.call("GET", f"/{sid}").json["links"], [])

    # ------------------------------------------------------------------ O1 restriction

    def test_restricted_board_is_redacted_for_the_viewer(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        lid = created.json["id"]
        self.mutate("PUT", f"/{sid}/links/{lid}/rows", created.headers["etag"],
                    body=[{"pinA": "3", "pinB": "3", "signal": "SPI_SCK"}])
        self.hide_project("prj_pay", "fld_designers")

        designer = self.call("GET", f"/{sid}", user="designer").json
        self.assertFalse(next(i for i in designer["instances"] if i["id"] == pay)["restricted"])

        viewer = self.call("GET", f"/{sid}", user="viewer").json
        restricted = next(i for i in viewer["instances"] if i["id"] == pay)
        self.assertTrue(restricted["restricted"])
        self.assertEqual(restricted["label"], "PAY")
        for key in ("projectId", "baselineCommit", "trackedRef", "ports", "interface"):
            self.assertIsNone(restricted[key], key)
        link = viewer["links"][0]
        self.assertTrue(link["b"]["redacted"])
        self.assertIsNone(link["b"]["port"])
        self.assertEqual(link["a"]["port"]["reference"], "J7")
        row = link["rows"][0]
        self.assertEqual((row["pinA"], row["pinB"], row["netB"], row["observedB"]), ("3", None, None, None))
        self.assertEqual(row["redactedEnds"], ["b"])
        self.assertEqual(self.call("GET", f"/{sid}/instances/{pay}/interface", user="viewer").status, 404)
        serialized = json.dumps(viewer)
        for secret in ("prj_pay", "/SCK_IN", self.commits["mini_payload"]["F0"], "J4"):
            self.assertNotIn(secret, serialized)

        history = self.call("GET", f"/{sid}/history", user="viewer").json["events"]
        by_kind = {}
        for event in history:
            by_kind.setdefault(event["kind"], []).append(event)
        self.assertTrue(all(e["redacted"] for e in by_kind["link_created"]))
        obc_added = [e for e in by_kind["instance_added"] if not e["redacted"]]
        self.assertEqual([e["payload"]["label"] for e in obc_added], ["OBC"])
        self.assertNotIn("prj_pay", json.dumps(history))

    def test_restricted_board_cannot_be_changed(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        lid, etag = created.json["id"], created.headers["etag"]
        self.hide_project("prj_pay", "fld_admins")
        attempts = [
            ("PATCH", f"/{sid}/instances/{pay}", {"label": "X"}),
            ("DELETE", f"/{sid}/instances/{pay}", None),
            ("DELETE", f"/{sid}/instances/{obc}?cascade=links", None),
            ("PATCH", f"/{sid}/links/{lid}", {"name": "X"}),
            ("PUT", f"/{sid}/links/{lid}/rows", [{"pinA": "1", "pinB": "1"}]),
            ("DELETE", f"/{sid}/links/{lid}", None),
        ]
        for method, path, body in attempts:
            with self.subTest(method=method, path=path):
                self.assertEqual(self.call(method, path, body=body, headers={"If-Match": etag}).status, 404)
        self.assertEqual(self.call("DELETE", f"/{sid}", headers={"If-Match": etag}).status, 409)
        self.assertEqual(self.call("DELETE", f"/{sid}", headers={"If-Match": etag}, user="admin").status, 200)

    def delete_project(self, project_id: str) -> None:
        with self.connect() as conn:
            SystemStore(conn).mark_project_unresolved(project_id)
            conn.execute("DELETE FROM ws_projects WHERE id = %s", (project_id,))
            conn.commit()

    def test_deleted_project_stays_restricted_below_admin(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        self.mutate("PUT", f"/{sid}/links/{created.json['id']}/rows", created.headers["etag"],
                    body=[{"pinA": "3", "pinB": "3", "signal": "SPI_SCK"}])
        self.delete_project("prj_pay")

        viewer = self.call("GET", f"/{sid}", user="viewer")
        instance = next(i for i in viewer.json["instances"] if i["id"] == pay)
        self.assertEqual((instance["resolution"], instance["restricted"], instance["projectId"],
                          instance["projectDeleted"]), ("unresolved", True, None, True))
        serialized = json.dumps(viewer.json)
        for secret in ("prj_pay", "/SCK_IN", self.commits["mini_payload"]["F0"]):
            self.assertNotIn(secret, serialized)
        self.assertNotIn("prj_pay", json.dumps(self.call("GET", f"/{sid}/history", user="viewer").json))

        admin = next(i for i in self.call("GET", f"/{sid}", user="admin").json["instances"] if i["id"] == pay)
        self.assertEqual((admin["restricted"], admin["projectId"], admin["projectName"]),
                         (False, "prj_pay", None))

        # A designer cannot read it, but can clear it out of the system.
        etag = viewer.headers["etag"]
        self.assertEqual(self.call("PATCH", f"/{sid}/instances/{pay}", body={"label": "X"},
                                   headers={"If-Match": etag}).status, 404)
        self.mutate("DELETE", f"/{sid}/instances/{pay}?cascade=links", etag, expect=204)
        self.assertEqual(self.call("GET", f"/{sid}").json["links"], [])

    def test_history_redacts_events_of_a_removed_restricted_board(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        etag = self.mutate("PATCH", f"/{sid}/instances/{pay}", etag, body={"label": "PAY-2"}).headers["etag"]
        self.mutate("DELETE", f"/{sid}/instances/{pay}", etag, expect=204)
        self.hide_project("prj_pay", "fld_admins")
        events = self.call("GET", f"/{sid}/history", user="viewer").json["events"]
        relabel = next(e for e in events if e["kind"] == "instance_updated")
        self.assertEqual((relabel["redacted"], relabel["payload"]), (True, None))
        self.assertNotIn("PAY-2", json.dumps(events))

    def test_rows_reject_a_repeated_id_and_audit_what_changed(self) -> None:
        sid, etag, obc, pay = self.two_boards()
        created = self.link_j7_j4(sid, etag, obc, pay)
        lid = created.json["id"]
        first = self.mutate("PUT", f"/{sid}/links/{lid}/rows", created.headers["etag"],
                            body=[{"pinA": "3", "pinB": "3", "signal": "SCK"}])
        rid, etag = first.json["rows"][0]["id"], first.headers["etag"]
        repeated = [{"id": rid, "pinA": "3", "pinB": "3"}, {"id": rid, "pinA": "4", "pinB": "4"}]
        self.mutate("PUT", f"/{sid}/links/{lid}/rows", etag, expect=422, body=repeated)

        self.mutate("PUT", f"/{sid}/links/{lid}/rows", etag,
                    body=[{"id": rid, "pinA": "4", "pinB": "3", "signal": "SCK2"}])
        event = next(e for e in self.call("GET", f"/{sid}/history").json["events"] if e["kind"] == "rows_replaced")
        [changed] = event["payload"]["rows"]["changed"]
        self.assertEqual(changed["id"], rid)
        self.assertEqual((changed["before"]["pinA"], changed["before"]["signal"]), ("3", "SCK"))
        self.assertEqual((changed["after"]["pinA"], changed["after"]["signal"]), ("4", "SCK2"))
        self.assertNotEqual(changed["before"]["netA"], changed["after"]["netA"])

    # ------------------------------------------------------------------ history and layout

    def test_history_pages_newest_first(self) -> None:
        sid, etag = self.create_system()
        for index in range(3):
            etag = self.mutate("PATCH", f"/{sid}", etag, body={"description": f"v{index}"}).headers["etag"]
        first = self.call("GET", f"/{sid}/history?limit=2", user="viewer").json
        self.assertEqual([e["kind"] for e in first["events"]], ["system_updated", "system_updated"])
        self.assertEqual(first["events"][0]["payload"]["description"]["after"], "v2")
        self.assertEqual(first["events"][0]["actor"], "user:designer@example.com")
        rest = self.call("GET", f"/{sid}/history?limit=2&cursor={first['nextCursor']}").json
        self.assertEqual([e["kind"] for e in rest["events"]], ["system_updated", "system_created"])
        self.assertIsNone(self.call("GET", f"/{sid}/history?limit=10").json["nextCursor"])

    def test_layout_is_unversioned(self) -> None:
        sid, etag = self.create_system()
        self.assertEqual(self.call("GET", f"/{sid}/layout", user="viewer").json, {"positions": {}})
        saved = self.call("PUT", f"/{sid}/layout", body={"positions": {"sin_a": {"x": 1.5, "y": -2}}})
        self.assertEqual(saved.status, 200)
        self.assertEqual(saved.json["positions"], {"sin_a": {"x": 1.5, "y": -2.0}})
        self.assertEqual(self.call("PUT", f"/{sid}/layout", user="viewer",
                                   body={"positions": {}}).status, 403)
        self.assertEqual(self.call("PUT", f"/{sid}/layout",
                                   body={"positions": {"a": {"x": "wide"}}}).status, 422)
        self.assertEqual(self.call("PUT", f"/{sid}/layout",
                                   body={"positions": {"k" * 201: {"x": 0, "y": 0}}}).status, 422)
        self.assertEqual(self.call("GET", f"/{sid}").headers["etag"], etag)


    # ------------------------------------------------------------------ extraction job

    def test_extraction_is_cached_per_project_and_commit(self) -> None:
        from app.services.systems import jobs

        project = self.projects["prj_obc"]
        f0 = self.commits["mini_obc"]["F0"]
        with mock.patch.object(jobs, "extract_for_revision",
                               return_value=self.interfaces["prj_obc"]) as extract:
            first = jobs.extract_and_store(project, f0, self.connect)
            second = jobs.extract_and_store(project, f0, self.connect)
        self.assertEqual(extract.call_count, 1)
        self.assertEqual(first["digest"], second["digest"])
        self.assertEqual(artifact_key("prj_obc", f0), f"system-interface:v{EXTRACTOR_VERSION}:prj_obc:{f0}")

    def test_extraction_job_fails_permanently_without_a_source(self) -> None:
        from app.services.job_runtime import PermanentJobError
        from app.services.systems import jobs

        context = SimpleNamespace(payload={"project_id": "prj_gone", "commit": "a" * 40},
                                  progress=lambda **_: None)
        with mock.patch("app.services.workspace_service.workspace.get_project_by_id", return_value=None):
            with self.assertRaises(PermanentJobError) as missing:
                jobs.run_system_interface_job(context)
        self.assertEqual(missing.exception.code, "project_missing")

        row = {"id": "prj_obc"}
        with (
            mock.patch("app.services.workspace_service.workspace.get_project_by_id", return_value=row),
            mock.patch("app.services.project_service._workspace_row_to_project",
                       return_value=self.projects["prj_obc"]),
            mock.patch.object(jobs, "extract_and_store", side_effect=ValueError("Commit not found: x")),
        ):
            with self.assertRaises(PermanentJobError) as unreadable:
                jobs.run_system_interface_job(context)
        self.assertEqual(unreadable.exception.code, "source_unavailable")
        self.assertNotIn("Commit not found", str(unreadable.exception))


if __name__ == "__main__":
    unittest.main()
