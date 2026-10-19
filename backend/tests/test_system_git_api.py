"""The system Git link end to end, against a local bare repository (CONTRACTS.md §13)."""

from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

from fastapi import FastAPI
from psycopg.types.json import Jsonb

from app.api import systems as systems_api
from app.core.errors import install_error_handlers
from app.core.policy import folder_visible
from app.services import project_revision
from app.services.job_runtime import JobContext, PermanentJobError
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from app.system_builder import git_link
from app.system_builder.service import SystemService
from app.system_builder.settings import limits
from app.system_builder.store import SystemStore
from in_memory_jobs import InMemoryJobService
from support.asgi import request as _request
from support.postgres import (
    requires_scratch_postgres,
    scratch_schema,
    seed_folder,
    seed_project,
    seed_repository,
)
from support.repo import commit_all, git, set_identity, write_files

PROJECT = "prj_0a1b2c3d4e5f"
HIDDEN_PROJECT = "prj_222222222222"
UNKNOWN_PROJECT = "prj_ffffffffffff"


def _app() -> FastAPI:
    app = FastAPI()
    install_error_handlers(app)
    app.include_router(systems_api.router, prefix="/api")
    return app


class _Workspace:
    """The project rows Prism's workspace service would answer for this scratch schema."""

    def __init__(self, conn) -> None:
        self._conn = conn

    def get_project_for_role(self, project_id: str, role: str):
        row = self._conn.execute(
            """
            SELECT p.id, p.repo_id, f.visibility_mode, f.allowed_roles
              FROM ws_projects p
              LEFT JOIN ws_folders f ON f.id = p.folder_id
             WHERE p.id = %s
            """,
            (project_id,),
        ).fetchone()
        if row is None or not folder_visible(role, row["visibility_mode"], row["allowed_roles"] or []):
            return None
        return dict(row)

    def get_project_by_id(self, project_id: str):
        row = self._conn.execute(
            "SELECT id, repo_id FROM ws_projects WHERE id = %s", (project_id,)
        ).fetchone()
        return dict(row) if row is not None else None


class _MirroringQueue(InMemoryJobService):
    """The in-memory queue, with each job row mirrored into the scratch ``ws_jobs``.

    The API's link read asks PostgreSQL for the last job; the handler itself runs
    on the in-memory queue, so the mirror keeps the two views of one job equal.
    """

    def __init__(self, mirror) -> None:
        super().__init__()
        self._mirror = mirror

    def enqueue(self, *args, **kwargs):
        row = super().enqueue(*args, **kwargs)
        self._mirror(row)
        return row


@requires_scratch_postgres("System Builder Git link tests")
class SystemGitApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.remote = self.tmp / "remote.git"
        self.mirror = self.tmp / "mirror"
        git(None, "init", "--bare", "--initial-branch=main", str(self.remote))
        git(None, "clone", str(self.remote), str(self.mirror))
        set_identity(self.mirror)
        write_files(self.mirror, {"board.kicad_pro": "{}\n"})
        commit_all(self.mirror, "design")
        git(self.mirror, "push", "-u", "origin", "main")

        self.scratch = scratch_schema(self, "sys_git", ledgers=(WORKSPACE_LEDGER,))
        seed_repository(self.scratch.conn, "repo_sys", clone_path=str(self.mirror))
        seed_folder(self.scratch.conn, "fld_designers", visibility_mode="roles", allowed_roles=["designer"])
        seed_folder(self.scratch.conn, "fld_qa", visibility_mode="roles", allowed_roles=["qa"])
        seed_project(self.scratch.conn, PROJECT, "repo_sys", relative_path=".")
        seed_project(self.scratch.conn, HIDDEN_PROJECT, "repo_sys", relative_path="hidden", folder_id="fld_qa")
        self.scratch.conn.commit()

        self.queue = _MirroringQueue(self._mirror)
        self.store = SystemStore(self.scratch.connection)
        self.links = git_link.GitLinkStore(self.scratch.connection)
        self.service = SystemService(self.store, limits, self.links)
        workspace = _Workspace(self.scratch.conn)
        for patcher in (
            mock.patch.object(systems_api, "store", self.store),
            mock.patch.object(systems_api, "service", self.service),
            mock.patch.object(systems_api, "workspace", workspace),
            mock.patch("app.api._helpers.workspace", workspace),
            mock.patch("app.system_builder.service.workspace", workspace),
            mock.patch.object(git_link, "git_link_store", lambda: self.links),
            mock.patch("app.services.job_service.jobs", self.queue),
            mock.patch(
                "app.services.job_runtime.job_state_root", return_value=self.tmp / "state"
            ),
            mock.patch.object(
                project_revision,
                "locate_id",
                lambda project_id: project_revision.ProjectLocation(self.mirror.resolve(), ""),
            ),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.app = _app()

    # ---------------------------------------------------------------- helpers

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, path, **kwargs)

    def create(self, name: str = "Flight stack") -> dict:
        response = self.call("POST", "/api/systems", body={"name": name})
        self.assertEqual(response.status, 201, response.text)
        return response.json

    def etag(self, system_id: str) -> str:
        response = self.call("GET", f"/api/systems/{system_id}")
        self.assertEqual(response.status, 200, response.text)
        return response.headers["etag"]

    def link(self, system_id: str, *, path: str | None = None, project_id: str = PROJECT):
        body: dict = {"projectId": project_id, "branch": "main"}
        if path is not None:
            body["path"] = path
        return self.call("PUT", f"/api/systems/{system_id}/git", body=body)

    def latest_job(self) -> dict:
        return next(
            row
            for row in reversed(list(self.queue.rows.values()))
            if row["kind"] == git_link.KIND
        )

    def _mirror(self, row: dict) -> None:
        with self.scratch.connection() as conn:
            conn.execute(
                """
                INSERT INTO ws_jobs
                    (id, kind, worker_pool, status, payload, error_code, error_message,
                     created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, now(), now())
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status,
                    payload = EXCLUDED.payload,
                    error_code = EXCLUDED.error_code,
                    error_message = EXCLUDED.error_message,
                    updated_at = now()
                """,
                (
                    str(row["job_id"]),
                    str(row["kind"]),
                    str(row.get("worker_pool") or "prism"),
                    str(row["status"]),
                    Jsonb(dict(row.get("payload") or {})),
                    str(row.get("error_code") or ""),
                    str(row.get("error_message") or ""),
                ),
            )

    def run_commit_job(self, job_id: str):
        row = self.queue.rows[job_id]
        row.update(
            status="running",
            fence=int(row["fence"]) + 1,
            attempt=int(row["attempt"]) + 1,
            lease_owner="test-worker",
            lease_live=True,
        )
        context = JobContext(row, worker_id="test-worker", service=self.queue)
        try:
            result = git_link.run_system_git_commit_job(context)
        except PermanentJobError as error:
            self.queue.fail(
                job_id, "test-worker", row["fence"],
                error_code=error.code, error_message=str(error),
            )
            self._mirror(self.queue.rows[job_id])
            raise
        self.queue.complete(
            job_id, "test-worker", row["fence"],
            message=result.message, details=dict(result.details),
        )
        self._mirror(self.queue.rows[job_id])
        return result

    def commit(self, system_id: str, message: str = "Update system"):
        return self.call(
            "POST", f"/api/systems/{system_id}/git/commit",
            body={"message": message},
            headers={"If-Match": self.etag(system_id)},
        )

    def remote_head(self, branch: str = "main") -> str:
        return git(None, f"--git-dir={self.remote}", "rev-parse", branch)

    def remote_blob(self, path: str, branch: str = "main") -> str:
        return git(None, f"--git-dir={self.remote}", "rev-parse", f"{branch}:{path}")

    def remote_file(self, path: str, branch: str = "main") -> str:
        return git(None, f"--git-dir={self.remote}", "show", f"{branch}:{path}")

    def outside_commit(self, files: dict[str, str], message: str = "outside") -> str:
        clone = self.tmp / f"outside-{uuid.uuid4().hex}"
        git(None, "clone", str(self.remote), str(clone))
        set_identity(clone)
        write_files(clone, files)
        head = commit_all(clone, message)
        git(clone, "push", "origin", "main")
        return head

    # ------------------------------------------------------------------ tests

    def test_link_defaults_the_path_and_relinking_clears_the_last_commit(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]

        linked = self.link(system_id)
        self.assertEqual(linked.status, 200, linked.text)
        self.assertEqual(linked.json["systemId"], system_id)
        self.assertEqual(linked.json["link"]["projectId"], PROJECT)
        self.assertEqual(linked.json["link"]["path"], "systems/flight-stack.system.json")
        self.assertIsNone(linked.json["link"]["lastCommit"])
        self.assertIsNone(linked.json["lastJob"])

        read = self.call("GET", f"/api/systems/{system_id}/git", user="viewer")
        self.assertEqual(read.status, 200, read.text)
        self.assertEqual(read.json["link"], linked.json["link"])

        queued = self.commit(system_id)
        self.assertEqual(queued.status, 202, queued.text)
        job_id = queued.json["lastJob"]["jobId"]
        self.assertEqual(job_id, self.latest_job()["job_id"])
        self.assertEqual(queued.json["lastJob"]["status"], "queued")
        self.run_commit_job(job_id)

        after = self.call("GET", f"/api/systems/{system_id}/git").json
        self.assertEqual(after["link"]["lastVersion"], 1)
        self.assertRegex(after["link"]["lastCommit"], r"^[0-9a-f]{40}$")
        self.assertEqual(after["link"]["lastBlob"], self.remote_blob(after["link"]["path"]))
        self.assertEqual(after["lastJob"]["status"], "completed")

        relinked = self.link(system_id, path="custom/flight.system.json")
        self.assertEqual(relinked.status, 200, relinked.text)
        self.assertEqual(relinked.json["link"]["path"], "custom/flight.system.json")
        self.assertIsNone(relinked.json["link"]["lastCommit"])
        self.assertIsNone(relinked.json["link"]["lastBlob"])

        invalid = self.link(system_id, path="../escape.system.json")
        self.assertEqual((invalid.status, invalid.json["code"]), (422, "system_git_path_invalid"))

        removed = self.call("DELETE", f"/api/systems/{system_id}/git")
        self.assertEqual(removed.status, 204, removed.text)
        self.assertIsNone(self.call("GET", f"/api/systems/{system_id}/git").json["link"])

        refused = self.commit(system_id)
        self.assertEqual((refused.status, refused.json["code"]), (409, "system_git_not_linked"))
        imported = self.call(
            "POST", f"/api/systems/{system_id}/git/import",
            headers={"If-Match": self.etag(system_id)},
        )
        self.assertEqual((imported.status, imported.json["code"]), (409, "system_git_not_linked"))

    def test_commit_writes_the_document_as_the_caller_then_answers_unchanged(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]
        self.link(system_id)
        document = self.call("GET", f"/api/systems/{system_id}").json["document"]
        expected = git_link.file_bytes(document)

        queued = self.commit(system_id, "Add the flight stack")
        self.assertEqual(queued.status, 202, queued.text)
        result = self.run_commit_job(queued.json["lastJob"]["jobId"])
        self.assertEqual(result.message, "System committed")
        self.assertEqual(result.details["outcome"], git_link.COMMIT)

        path = "systems/flight-stack.system.json"
        self.assertEqual(self.remote_file(path) + "\n", expected.decode("utf-8"))
        self.assertEqual(
            git(None, f"--git-dir={self.remote}", "log", "-1", "--format=%an <%ae>|%cn <%ce>", "main"),
            "designer <designer@example.com>|Prism System Builder <designer@example.com>",
        )

        head = self.remote_head()
        again = self.commit(system_id, "Nothing changed")
        again_result = self.run_commit_job(again.json["lastJob"]["jobId"])
        self.assertEqual(again_result.message, "System unchanged")
        self.assertEqual(again_result.details["outcome"], git_link.UNCHANGED)
        self.assertEqual(self.remote_head(), head)

    def test_an_outside_change_diverges_and_nothing_is_pushed(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]
        self.link(system_id)
        first = self.commit(system_id, "First")
        self.run_commit_job(first.json["lastJob"]["jobId"])
        path = "systems/flight-stack.system.json"

        outside_head = self.outside_commit({path: '{"schema": "prism.system.v2", "outside": true}\n'})
        outside_blob = self.remote_blob(path)

        queued = self.commit(system_id, "Should not land")
        with self.assertRaises(PermanentJobError) as caught:
            self.run_commit_job(queued.json["lastJob"]["jobId"])
        self.assertEqual(caught.exception.code, "system_git_diverged")
        self.assertEqual(self.remote_head(), outside_head)

        answer = self.call("GET", f"/api/systems/{system_id}/git").json
        self.assertEqual(answer["lastJob"]["status"], "failed")
        self.assertEqual(answer["lastJob"]["errorCode"], "system_git_diverged")
        self.assertEqual(answer["lastJob"]["blob"], outside_blob)

    def test_import_applies_the_file_as_a_version_and_is_undoable(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]
        self.link(system_id)
        path = "systems/flight-stack.system.json"
        first = self.commit(system_id, "First")
        self.run_commit_job(first.json["lastJob"]["jobId"])

        imported = self.call("GET", f"/api/systems/{system_id}").json["document"]
        imported["name"] = "Imported stack"
        imported["description"] = "From the branch"
        outside_head = self.outside_commit({path: git_link.file_bytes(imported).decode("utf-8")})

        response = self.call(
            "POST", f"/api/systems/{system_id}/git/import",
            headers={"If-Match": self.etag(system_id)},
        )
        self.assertEqual(response.status, 200, response.text)
        self.assertEqual(response.json["version"], 2)
        self.assertEqual(response.json["document"]["name"], "Imported stack")
        self.assertEqual(response.headers["etag"], f'"system:{system_id}:2"')
        self.assertEqual(
            self.links.read(system_id)["last_blob"], self.remote_blob(path)
        )

        history = self.call("GET", f"/api/systems/{system_id}/history").json
        self.assertEqual((history[0]["version"], history[0]["kind"]), (2, "edit"))

        undone = self.call(
            "POST", f"/api/systems/{system_id}/undo", body={"version": 2},
            headers={"If-Match": response.headers["etag"]},
        )
        self.assertEqual(undone.status, 200, undone.text)
        self.assertEqual(undone.json["version"], 3)
        self.assertEqual(undone.json["document"]["name"], "Flight stack")

        # The import moved last_blob to the branch head, so this commit is allowed.
        committed = self.call(
            "POST", f"/api/systems/{system_id}/git/commit", body={"message": "Restore"},
            headers={"If-Match": undone.headers["etag"]},
        )
        result = self.run_commit_job(committed.json["lastJob"]["jobId"])
        self.assertEqual(result.details["outcome"], git_link.COMMIT)
        self.assertNotEqual(self.remote_head(), outside_head)
        self.assertEqual(
            self.remote_file(path) + "\n", git_link.file_bytes(self.call(
                "GET", f"/api/systems/{system_id}"
            ).json["document"]).decode("utf-8"),
        )

    def test_import_refuses_a_file_that_is_not_a_document(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]
        self.link(system_id)
        path = "systems/flight-stack.system.json"
        self.outside_commit({path: "this is not json\n"})

        response = self.call(
            "POST", f"/api/systems/{system_id}/git/import",
            headers={"If-Match": self.etag(system_id)},
        )
        self.assertEqual((response.status, response.json["code"]), (422, "system_ops_invalid"))
        self.assertEqual(response.json["pointer"], "/document")

    def test_a_snapshot_of_a_linked_system_queues_a_commit(self) -> None:
        created = self.create("Flight stack")
        system_id = created["systemId"]
        self.link(system_id)

        snapshot = self.call(
            "POST", f"/api/systems/{system_id}/snapshots", body={"name": "Before wiring"}
        )
        self.assertEqual(snapshot.status, 201, snapshot.text)
        job_id = snapshot.json["gitCommitJobId"]
        self.assertTrue(job_id)

        job = self.queue.rows[job_id]
        self.assertEqual(job["payload"]["message"], "Snapshot: Before wiring")
        self.assertEqual(job["payload"]["document_version"], snapshot.json["version"])

        result = self.run_commit_job(job_id)
        self.assertEqual(result.details["outcome"], git_link.COMMIT)
        self.assertEqual(
            self.remote_file("systems/flight-stack.system.json") + "\n",
            git_link.file_bytes(snapshot.json["document"]).decode("utf-8"),
        )

    def test_linking_and_writing_need_design_on_the_system_and_the_project(self) -> None:
        created = self.create()
        system_id = created["systemId"]
        self.assertEqual(self.call("GET", f"/api/systems/{system_id}/git", user="viewer").status, 200)
        self.assertEqual(self.link(system_id).status, 200)

        self.assertEqual(self.link(system_id, project_id=PROJECT).status, 200)
        # A viewer may not link at all.
        self.assertEqual(
            self.call(
                "PUT", f"/api/systems/{system_id}/git",
                body={"projectId": PROJECT, "branch": "main"}, user="viewer",
            ).status,
            403,
        )
        # A designer who cannot see the project sees no project.
        hidden = self.link(system_id, project_id=HIDDEN_PROJECT)
        self.assertEqual(hidden.status, 404, hidden.text)
        unknown = self.link(system_id, project_id=UNKNOWN_PROJECT)
        self.assertEqual(unknown.status, 404, unknown.text)
        self.assertEqual(self.call("DELETE", f"/api/systems/{system_id}/git", user="viewer").status, 403)

    def test_ops_refuses_the_import_document_operation(self) -> None:
        created = self.create()
        system_id = created["systemId"]
        document = created["document"]
        response = self.call(
            "POST", f"/api/systems/{system_id}/ops",
            body={
                "schema": "prism.system.ops.a0",
                "ops": [{"kind": "import-document", "document": document}],
            },
            headers={"If-Match": self.etag(system_id)},
        )
        self.assertEqual((response.status, response.json["code"]), (422, "system_ops_invalid"))
        self.assertEqual(response.json["pointer"], "/ops/0/kind")


@requires_scratch_postgres("System Builder migration 128 tests")
class SystemPublishingMigrationTest(unittest.TestCase):
    def setUp(self) -> None:
        self.scratch = scratch_schema(self, "sys_git_schema", ledgers=(WORKSPACE_LEDGER,))
        self.schema, self.conn = self.scratch.name, self.scratch.conn
        self.types: dict[tuple[str, str], tuple[str, str]] = {}

    def _columns(self, table: str) -> set[str]:
        rows = self.conn.execute(
            """
            SELECT column_name, data_type, is_nullable
              FROM information_schema.columns
             WHERE table_schema = %s AND table_name = %s
            """,
            (self.schema, table),
        ).fetchall()
        for row in rows:
            self.types[(table, str(row["column_name"]))] = (
                str(row["data_type"]), str(row["is_nullable"]),
            )
        return {str(row["column_name"]) for row in rows}

    def test_migration_128_creates_its_tables_and_columns(self) -> None:
        self.assertEqual(
            self._columns("ws_system_git_links"),
            {
                "system_id", "project_id", "branch", "path", "last_commit",
                "last_blob", "last_version", "linked_by", "linked_at",
            },
        )
        self.assertEqual(
            self._columns("ws_system_publications"),
            {
                "system_id", "version", "snapshot_id", "component_id",
                "revision_id", "published_by", "published_at",
            },
        )
        self.assertEqual(
            self.types[("ws_system_git_links", "last_commit")][1],
            "YES",
        )
        self.assertEqual(
            self.types[("ws_system_git_links", "last_blob")][1],
            "YES",
        )
        system_columns = self._columns("ws_systems")
        self.assertIn("catalog_component_id", system_columns)
        self.assertEqual(
            self.types[("ws_systems", "catalog_component_id")], ("text", "YES")
        )
        snapshot_columns = self._columns("ws_system_snapshots")
        self.assertIn("board_sub_ports", snapshot_columns)
        self.assertEqual(
            self.types[("ws_system_snapshots", "board_sub_ports")],
            ("jsonb", "YES"),
        )

        keys = self.conn.execute(
            """
            SELECT child.relname AS table_name,
                   array_agg(attribute.attname ORDER BY key_columns.ordinality) AS columns
              FROM pg_constraint AS c
              JOIN pg_class AS child ON child.oid = c.conrelid
              JOIN pg_namespace AS namespace ON namespace.oid = child.relnamespace
              CROSS JOIN LATERAL unnest(c.conkey) WITH ORDINALITY
                  AS key_columns(attnum, ordinality)
              JOIN pg_attribute AS attribute
                ON attribute.attrelid = child.oid
               AND attribute.attnum = key_columns.attnum
             WHERE namespace.nspname = %s
               AND c.contype = 'p'
               AND child.relname IN ('ws_system_git_links', 'ws_system_publications')
             GROUP BY child.relname, c.conname
            """,
            (self.schema,),
        ).fetchall()
        primary_keys = {str(row["table_name"]): tuple(row["columns"]) for row in keys}
        self.assertEqual(primary_keys["ws_system_git_links"], ("system_id",))
        self.assertEqual(
            primary_keys["ws_system_publications"], ("system_id", "version", "revision_id")
        )

        foreign_keys = self.conn.execute(
            """
            SELECT child.relname AS child_table, parent.relname AS parent_table
              FROM pg_constraint AS c
              JOIN pg_class AS child ON child.oid = c.conrelid
              JOIN pg_class AS parent ON parent.oid = c.confrelid
              JOIN pg_namespace AS namespace ON namespace.oid = child.relnamespace
             WHERE namespace.nspname = %s AND c.contype = 'f'
               AND child.relname IN ('ws_system_git_links', 'ws_system_publications')
            """,
            (self.schema,),
        ).fetchall()
        self.assertTrue(
            {
                ("ws_system_git_links", "ws_systems"),
                ("ws_system_publications", "ws_systems"),
            }
            <= {(str(row["child_table"]), str(row["parent_table"])) for row in foreign_keys}
        )


if __name__ == "__main__":
    unittest.main()
