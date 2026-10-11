"""SYS-19: the SYS-01 history replayed through fetch → detection → reconcile.

Unlike the SYS-06/07 tests, nothing here moves a branch by hand. Each fixture
board has a bare upstream and a separate server clone with ``origin`` set, as
an imported project does. A step is *pushed* to the upstream; the real
``project_sync`` job handler fetches it into the server clone, queues the
source check, and the real ``system_source_check`` handler runs detection.
Jobs are queued through ``jobs.enqueue`` and run from the builtin handler
registry, so the chain is the one a worker executes. The system is built,
reviewed and reconciled only through the HTTP API, and checked against the
hand-written goldens in ``expected/steps.json``.

Interface extraction is the one step run inline instead of through its job
handler, because that handler opens the workspace schema rather than the
test's isolated one; it calls the same ``extract_and_store``.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import unittest
import uuid
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:  # pragma: no cover - dependency guard for host-only checks
    psycopg = None  # type: ignore[assignment]
    dict_row = None  # type: ignore[assignment]

from fastapi import FastAPI

from system_builder_fixtures import build_fixture_repo, expected_steps, fixture_system
from test_system_api import _request

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services import job_service, project_import_service, workspace_service
from app.services.job_handlers import get_job_handler, load_builtin_job_handlers
from app.services.systems import detection
from app.services.systems import service as service_module
from app.services.systems.detection import DETECTION_ACTOR, SOURCE_CHECK_JOB_KIND, Detector
from app.services.systems.drift import pad_sort_key
from app.services.systems.jobs import EXTRACT_JOB_KIND, extract_and_store
from app.services.systems.service import SystemService

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip().replace(
    "postgresql+psycopg://", "postgresql://", 1
)
BOARDS = {"mini_obc": ("prj_obc", "repo_obc"), "mini_payload": ("prj_pay", "repo_pay"),
          "mini_power": ("prj_pwr", "repo_pwr")}
PROJECT_BOARD = {project: board for board, (project, _repo) in BOARDS.items()}

_GIT_ENV = {**os.environ, "GIT_CONFIG_GLOBAL": os.devnull, "GIT_CONFIG_SYSTEM": os.devnull,
            "GIT_TERMINAL_PROMPT": "0"}


def _git(*args: str) -> str:
    return subprocess.run(["git", *args], env=_GIT_ENV, check=True, capture_output=True,
                          text=True).stdout.strip()


class _Workspace:
    """The two ``workspace`` calls a fetch-only sync and a source check make."""

    def __init__(self, rows: dict[str, dict]) -> None:
        self.rows = rows
        self.synced: list[str] = []

    def get_project_by_id(self, project_id: str):
        return self.rows.get(project_id)

    def update_repository_synced(self, repo_id: str) -> None:
        self.synced.append(repo_id)


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for the System Builder replay")
@unittest.skipUnless(psycopg is not None, "psycopg is required for the System Builder replay")
class ReplayTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        load_builtin_job_handlers()
        cls._scratch = tempfile.TemporaryDirectory()
        root = Path(cls._scratch.name)
        cls.commits, cls.authors, cls.upstreams, cls.clones = {}, {}, {}, {}
        for board in BOARDS:
            author, upstream, clone = root / "author" / board, root / "upstream" / f"{board}.git", root / "server" / board
            cls.commits[board] = build_fixture_repo(board, author)
            _git("init", "--quiet", "--bare", "--initial-branch=main", str(upstream))
            _git("-C", str(author), "push", "--quiet", str(upstream), "main:refs/heads/main")
            _git("clone", "--quiet", str(upstream), str(clone))
            cls.authors[board], cls.upstreams[board], cls.clones[board] = author, upstream, clone
        cls.projects = {
            project: SimpleNamespace(id=project, path=str(cls.clones[board]), project_file=f"{board}.kicad_pro")
            for board, (project, _repo) in BOARDS.items()
        }

    @classmethod
    def tearDownClass(cls) -> None:
        cls._scratch.cleanup()

    # ------------------------------------------------------------------ per test

    def setUp(self) -> None:
        from app.services.workspace_schema_migrations import apply_workspace_migrations

        # Every episode starts from F0 upstream and in the server clones.
        for board in BOARDS:
            self.push(board, "F0")
            _git("-C", str(self.clones[board]), "fetch", "--quiet", "--prune", "origin")

        self.schema = f"system_replay_{uuid.uuid4().hex}"
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
            INSERT INTO ws_repositories (id) VALUES ('repo_obc'), ('repo_pay'), ('repo_pwr');
            INSERT INTO ws_projects (id, repo_id, name) VALUES
                ('prj_obc', 'repo_obc', 'mini_obc'), ('prj_pay', 'repo_pay', 'mini_payload'),
                ('prj_pwr', 'repo_pwr', 'mini_power');
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
        self.queue: list[tuple[str, dict]] = []
        self.ran: list[tuple[str, str]] = []

        def enqueue_job(kind: str, payload: dict, **_kwargs) -> dict:
            self.queue.append((kind, dict(payload)))
            return {"job_id": f"job-{len(self.queue)}", "status": "queued"}

        def enqueue_extraction(project_id: str, commit: str, *, requested_by: str = "") -> dict:
            return enqueue_job(EXTRACT_JOB_KIND, {"project_id": project_id, "commit": commit})

        self.workspace = _Workspace({
            project: {"id": project, "repo_id": repo, "path": str(self.clones[board]),
                      "import_type": "single"}
            for board, (project, repo) in BOARDS.items()
        })
        self.detector = Detector(connect=connect, project_loader=self.projects.get)
        self.service = SystemService(connect=connect, project_loader=self.projects.get,
                                     enqueue=enqueue_extraction)
        for patcher in (
            mock.patch.object(job_service.jobs, "enqueue", side_effect=enqueue_job),
            mock.patch.object(project_import_service, "workspace", self.workspace),
            mock.patch.object(workspace_service, "workspace", self.workspace),
            mock.patch.object(detection, "detector", self.detector),
            mock.patch.object(service_module, "service", self.service),
            mock.patch("app.services.file_service.invalidate_file_listing_cache"),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.app = FastAPI()
        install_error_handlers(self.app)
        self.app.include_router(systems_api.router, prefix="/api/systems")
        self.build_fixture_system()

    def tearDown(self) -> None:
        self.conn.rollback()
        self.conn.execute(f'DROP SCHEMA "{self.schema}" CASCADE')
        self.conn.commit()
        self.conn.close()

    # ------------------------------------------------------------------ the loop

    def push(self, board: str, snapshot: str) -> str:
        """A designer force-pushes a step to the board's upstream ``main``."""

        sha = self.commits[board][snapshot]
        _git("-C", str(self.authors[board]), "push", "--quiet", "--force", str(self.upstreams[board]),
             f"{sha}:refs/heads/main")
        return sha

    def drain(self) -> list[tuple[str, object]]:
        """Run queued jobs in order, as the worker would; returns (kind, result)."""

        results = []
        while self.queue:
            kind, payload = self.queue.pop(0)
            context = SimpleNamespace(payload=payload, progress=lambda **_: None,
                                      check_cancelled=lambda: None)
            if kind == EXTRACT_JOB_KIND:
                project = self.projects[payload["project_id"]]
                result = extract_and_store(project, payload["commit"], self.connect)
            else:
                handler = get_job_handler(kind)
                self.assertIsNotNone(handler, kind)
                result = handler(context)
            self.ran.append((kind, str(payload.get("project_id") or payload.get("repository_id") or "")))
            results.append((kind, result))
        return results

    def fetch(self, board: str) -> dict[str, int]:
        """The scheduled background fetch: queue a fetch-only sync and run the jobs it causes."""

        project, _repo = BOARDS[board]
        project_import_service.start_sync_job(project, requested_by="scheduler", fetch_only=True)
        results = self.drain()
        kinds = [kind for kind, _ in results]
        self.assertEqual(kinds[0], "project_sync")
        checks = [result for kind, result in results if kind == SOURCE_CHECK_JOB_KIND]
        return checks[0].details["outcomes"] if checks else {}

    def push_and_fetch(self, board: str, snapshot: str) -> tuple[str, dict[str, int]]:
        sha = self.push(board, snapshot)
        outcomes = self.fetch(board)
        remote = _git("-C", str(self.clones[board]), "rev-parse", "refs/remotes/origin/main")
        self.assertEqual(remote, sha, "the sync job did not fetch the pushed tip")
        return sha, outcomes

    # ------------------------------------------------------------------ API

    def call(self, method: str, path: str, **kwargs):
        return _request(self.app, method, f"/api/systems{path}", **kwargs)

    def mutate(self, method: str, path: str, *, expect: int = 200, **kwargs):
        response = self.call(method, f"/{self.sid}{path}", headers={"If-Match": self.etag}, **kwargs)
        self.assertEqual(response.status, expect, response.text)
        self.etag = response.headers.get("etag", self.etag)
        self.drain()
        return response

    def document(self) -> dict:
        response = self.call("GET", f"/{self.sid}")
        self.assertEqual(response.status, 200, response.text)
        self.etag = response.headers["etag"]
        return response.json

    def instance(self, label: str) -> dict:
        return next(i for i in self.document()["instances"] if i["label"] == label)

    def link(self, name: str) -> dict:
        return next(link for link in self.document()["links"] if link["name"] == name)

    def reviews(self, status: str | None = None, label: str | None = None) -> list[dict]:
        query = f"?status={status}" if status else ""
        response = self.call("GET", f"/{self.sid}/reviews{query}")
        self.assertEqual(response.status, 200, response.text)
        reviews = response.json
        if label is not None:
            reviews = [r for r in reviews if r["instanceId"] == self.instances[label]]
        return reviews

    def decide(self, review: dict, item: dict, decision: str, payload: dict | None = None):
        self.document()
        return self.mutate("POST", f"/reviews/{review['id']}/items/{item['id']}/decision",
                           body={"decision": decision, "payload": payload})

    def build_fixture_system(self) -> None:
        """``system.json`` at F0, entered the way a designer would: instances, links, rows."""

        spec = fixture_system()
        created = self.call("POST", "", body={"name": "Replay"})
        self.assertEqual(created.status, 201, created.text)
        self.sid, self.etag = created.json["id"], created.headers["etag"]
        self.mutate("PATCH", "", body={"optionalRules": ["SYS-V09"]})  # the goldens include the opt-in V09
        self.instances, self.link_ids = {}, {}
        for label, board in spec["instances"].items():
            added = self.mutate("POST", "/instances", expect=201, body={
                "projectId": BOARDS[board["board"]][0], "label": label,
                "baselineCommit": self.commits[board["board"]][board["baseline"]],
                "trackedRef": board["trackedRef"], "pinned": board["pinned"],
            })
            self.instances[label] = added.json["id"]
        self.fixture_rows = {}
        for link in spec["links"]:
            made = self.mutate("POST", "/links", expect=201, body={
                "a": {"instanceId": self.instances[link["a"]["instance"]], "portKey": link["a"]["portKey"]},
                "b": {"instanceId": self.instances[link["b"]["instance"]], "portKey": link["b"]["portKey"]},
                "name": link["id"], "harness": link["harness"],
            })
            self.link_ids[link["id"]] = made.json["id"]
            self.mutate("PUT", f"/links/{made.json['id']}/rows",
                        body=[{"pinA": r["pinA"], "pinB": r["pinB"], "signal": r.get("signal", "")}
                              for r in link["rows"]])
            self.fixture_rows[link["id"]] = link["rows"]
        self.names = {v: k for k, v in self.link_ids.items()}

    def comparable(self, review: dict) -> list[dict]:
        out = []
        for item in review["items"]:
            entry = {"kind": item["kind"], "link": self.names[item["linkId"]], "end": item["end"],
                     "pins": sorted(item["pins"], key=pad_sort_key)}
            if item["kind"] != "connector_missing":
                entry["expected"], entry["observed"] = item["expected"], item["observed"]
            out.append(entry)
        return out

    @staticmethod
    def golden(items: list[dict]) -> list[dict]:
        return [{k: v for k, v in i.items() if k not in ("note", "candidates")} for i in items]

    def row(self, link: str, pin_a: str) -> dict | None:
        return next((r for r in self.link(link)["rows"] if r["pinA"] == pin_a), None)

    # ------------------------------------------------------------------ the fixture system itself

    def test_the_api_built_system_matches_the_fixture_baselines(self) -> None:
        document = self.document()
        self.assertEqual(document["openReviewCount"], 0)
        for link in document["links"]:
            rows = {(r["pinA"], r["pinB"]): r for r in link["rows"]}
            for expected in self.fixture_rows[link["name"]]:
                row = rows[(expected["pinA"], expected["pinB"])]
                self.assertEqual((row["netA"], row["netB"]), (expected["netA"], expected["netB"]),
                                 f"{link['name']} {expected['pinA']}")
        baseline = expected_steps()["baselineFindings"]["F0"]
        report = self.call("GET", f"/{self.sid}/validation").json
        self.assertEqual([f for f in report["findings"] if f["severity"] in ("error", "warning")], [])
        self.assertEqual([(n["rule"], n["instanceId"]) for n in report["notEvaluated"]],
                         [(n["rule"], self.instances[n["instance"]]) for n in baseline["notEvaluated"]])

    def test_a_fetch_that_moves_nothing_checks_and_changes_nothing(self) -> None:
        version = self.document()["system"]["version"]
        outcomes = self.fetch("mini_obc")
        self.assertEqual(outcomes, {"at_baseline": 2})  # OBC-A and the pinned OBC-B
        self.assertEqual(self.document()["system"]["version"], version)
        self.assertIn("repo_obc", self.workspace.synced)
        # A board no instance tracks from another repository queues no check.
        self.conn.execute("UPDATE system_instances SET tracked_ref = NULL WHERE project_id = 'prj_pay'")
        self.conn.commit()
        self.assertEqual(self.fetch("mini_payload"), {})

    # ------------------------------------------------------------------ review steps, then reconcile

    # One test per step, each from F0, so the parallel runner can spread them (CI plan item 4).
    def test_review_step_f1_replays_to_its_golden_and_reconciles(self) -> None:
        self.replay_review_step("F1", "accept")

    def test_review_step_f4_replays_to_its_golden_and_reconciles(self) -> None:
        self.replay_review_step("F4", "accept")

    def test_review_step_f5_replays_to_its_golden_and_reconciles(self) -> None:
        self.replay_review_step("F5", "accept")

    def test_review_step_f8_replays_to_its_golden_and_reconciles(self) -> None:
        self.replay_review_step("F8", "accept")

    def test_review_step_f9_replays_to_its_golden_and_reconciles(self) -> None:
        self.replay_review_step("F9", "bind_candidate")

    def replay_review_step(self, name: str, decision: str) -> None:
        spec = expected_steps()["steps"][name]
        tip, outcomes = self.push_and_fetch("mini_obc", spec["candidate"].split("/")[1])
        self.assertEqual(outcomes.get("review_opened"), 1, outcomes)
        [review] = self.reviews("open", "OBC-A")
        self.assertEqual((review["kind"], review["fromCommit"], review["toCommit"]),
                         ("source_update", self.commits["mini_obc"]["F0"], tip))
        self.assertEqual(self.comparable(review), self.golden(spec["items"]))
        self.assertEqual(self.instance("OBC-A")["baselineCommit"], self.commits["mini_obc"]["F0"])
        for item in review["items"]:
            payload = None
            if decision == "bind_candidate":
                j6 = next(c for c in item["candidates"] if c["reference"] == "J6")
                payload = {"portKey": j6["portKey"]}
            self.decide(review, item, decision, payload)
        self.assertEqual(self.reviews("open"), [])
        [applied] = self.reviews("applied", "OBC-A")
        self.assertEqual(applied["id"], review["id"])
        self.assertEqual(self.instance("OBC-A")["baselineCommit"], tip)
        # A second fetch of the same tip is a no-op.
        version = self.document()["system"]["version"]
        self.assertEqual(self.fetch("mini_obc").get("already_checked"), 1)
        self.assertEqual(self.document()["system"]["version"], version)
        self.assert_reconciled(name, spec)

    def assert_reconciled(self, name: str, spec: dict) -> None:
        if name == "F1":
            self.assertEqual(self.row("L-J7J4", "17")["netA"], [])
        elif name == "F4":
            port = self.link("L-J7J4")["a"]["port"]
            self.assertEqual((port["libId"], port["pinCount"]),
                             (spec["items"][0]["observed"]["libId"], 24))
        elif name == "F5":
            self.assertEqual(self.row("L-J7J4", "3")["netA"], ["/Payload Interface/SPI_SCK"])
            self.assertEqual(self.row("L-J7J4", "1")["netA"], ["GND"])
        elif name == "F8":
            findings = self.call("GET", f"/{self.sid}/validation").json["findings"]
            warnings = [(f["rule"], f["instanceId"], f["reference"], f["pin"])
                        for f in findings if f["severity"] == "warning"]
            self.assertEqual(warnings, [(w["rule"], (self.instances[w["instance"]] if w["instance"] else None), w["reference"], w["pin"])
                                        for w in spec["afterAccept"]["warnings"]])
        elif name == "F9":
            port = self.link("L-J2J1")["a"]["port"]
            self.assertEqual(port["reference"], "J6")

    # ------------------------------------------------------------------ rows edited during a review

    def edit_rows(self, link: str, change) -> None:
        current = self.link(link)
        rows = [{"id": r["id"], "pinA": r["pinA"], "pinB": r["pinB"], "signal": r["signal"]}
                for r in current["rows"]]
        self.mutate("PUT", f"/links/{current['id']}/rows", body=change(rows))

    def accept_all(self, review: dict, *, expect: int = 200):
        response = None
        for item in review["items"]:
            self.document()
            response = self.call("POST", f"/{self.sid}/reviews/{review['id']}/items/{item['id']}/decision",
                                 headers={"If-Match": self.etag}, body={"decision": "accept"})
            if response.status != 200:
                break
        self.assertEqual(response.status, expect, response.text)
        self.drain()
        return response

    def test_a_row_added_during_a_review_is_reviewed_not_left_stale(self) -> None:
        tip, _ = self.push_and_fetch("mini_obc", "F5")  # sheet rename: every sheet net changes
        [review] = self.reviews("open", "OBC-A")
        self.assertNotIn("19", [pin for item in review["items"] for pin in item["pins"]])
        pin_b = self.link("L-J7J4")["rows"][0]["pinB"]
        self.edit_rows("L-J7J4", lambda rows: rows + [{"pinA": "19", "pinB": pin_b, "signal": "SPARE"}])

        stale = self.accept_all(review, expect=409)
        self.assertIn("review_stale", stale.text)
        self.assertEqual([r["id"] for r in self.reviews("superseded", "OBC-A")], [review["id"]])
        [fresh] = self.reviews("open", "OBC-A")
        self.assertEqual(fresh["toCommit"], tip)
        self.assertIn("19", [p for item in fresh["items"] for p in item["pins"]])

        self.accept_all(fresh)
        self.assertEqual(self.instance("OBC-A")["baselineCommit"], tip)
        rows = self.link("L-J7J4")["rows"]
        self.assertEqual([r["pinA"] for r in rows if r["netA"] != r["observedA"]["nets"]], [])
        self.assertEqual(self.row("L-J7J4", "19")["netA"], ["/Payload Interface/SPARE19"])

    def test_a_reviewed_row_moved_to_another_pad_is_evaluated_again(self) -> None:
        self.push_and_fetch("mini_obc", "F1")  # J7.17 becomes unconnected
        [review] = self.reviews("open", "OBC-A")
        [item] = review["items"]
        moved = item["rowIds"][0]
        used = {r["pinA"] for r in self.link("L-J7J4")["rows"]}
        spare = next(str(pad) for pad in range(1, 21) if str(pad) not in used)
        self.edit_rows("L-J7J4", lambda rows: [{**r, "pinA": spare} if r["id"] == moved else r for r in rows])

        self.accept_all(review, expect=409)
        # Pad 17 no longer carries a row, so nothing on the board drifted: the tip is accepted.
        self.assertEqual(self.reviews("open", "OBC-A"), [])
        self.assertEqual(self.instance("OBC-A")["baselineCommit"], self.commits["mini_obc"]["F1"])
        self.assertIsNotNone(self.row("L-J7J4", spare))

    # ------------------------------------------------------------------ silent steps

    def test_auto_advance_step_f2_moves_the_baseline_without_a_review(self) -> None:
        self.replay_auto_advance_step("F2")

    def test_auto_advance_step_f3_moves_the_baseline_without_a_review(self) -> None:
        self.replay_auto_advance_step("F3")

    def test_auto_advance_step_f6_moves_the_baseline_without_a_review(self) -> None:
        self.replay_auto_advance_step("F6")

    def test_auto_advance_step_f7_moves_the_baseline_without_a_review(self) -> None:
        self.replay_auto_advance_step("F7")

    def test_auto_advance_step_f10_moves_the_baseline_without_a_review(self) -> None:
        self.replay_auto_advance_step("F10")

    def replay_auto_advance_step(self, name: str) -> None:
        spec = expected_steps()["steps"][name]
        board, snapshot = spec["candidate"].split("/")
        version = self.document()["system"]["version"]
        tip, outcomes = self.push_and_fetch(board, snapshot)
        self.assertEqual(outcomes.get("auto_advanced"), 1, outcomes)
        self.assertEqual(self.instance(spec["instance"])["baselineCommit"], tip)
        self.assertEqual(self.reviews(), [])
        self.assertEqual(self.document()["system"]["version"], version + 1)
        history = self.call("GET", f"/{self.sid}/history").json
        events = history["events"] if isinstance(history, dict) else history
        advanced = [e for e in events if e["kind"] == "baseline_auto_advanced"]
        self.assertEqual([e["actor"] for e in advanced], [DETECTION_ACTOR])
        for silent in spec.get("silent", []):
            self.assertTrue([e for e in events if e["kind"] == silent["kind"]], silent)
        if name == "F2":
            self.assertEqual(self.link("L-J2J1")["a"]["port"]["reference"], "J12")

    # ------------------------------------------------------------------ sequences and pinned boards

    def test_f11_a_newer_push_supersedes_the_open_review(self) -> None:
        sequence = expected_steps()["steps"]["F11"]["sequence"]
        self.push_and_fetch("mini_obc", "F11.1")
        [first] = self.reviews("open", "OBC-A")
        self.assertEqual(self.comparable(first), self.golden(sequence[0]["items"]))
        tip, _ = self.push_and_fetch("mini_obc", "F11.2")
        [superseded] = self.reviews("superseded", "OBC-A")
        self.assertEqual(superseded["id"], first["id"])
        [current] = self.reviews("open", "OBC-A")
        self.assertEqual((current["fromCommit"], current["toCommit"]), (self.commits["mini_obc"]["F0"], tip))
        self.assertEqual(self.comparable(current), self.golden(sequence[1]["items"]))
        # A stale ETag cannot decide it: reconcile is optimistic like every write.
        stale = self.etag
        self.decide(current, current["items"][0], "accept")
        refused = self.call("POST", f"/{self.sid}/reviews/{current['id']}/items/{current['items'][1]['id']}/decision",
                            headers={"If-Match": stale}, body={"decision": "accept"})
        self.assertEqual(refused.status, 412)
        self.decide(current, current["items"][1], "accept")
        self.assertEqual(self.instance("OBC-A")["baselineCommit"], tip)

    def test_f12_pinned_instance_reports_the_update_and_rebases_by_hand(self) -> None:
        spec = expected_steps()["steps"]["F12"]
        tip, outcomes = self.push_and_fetch("mini_obc", spec["tip"].split("/")[1])
        self.assertEqual(outcomes, {"review_opened": 1, "update_available": 1})
        pinned = self.instance("OBC-B")
        self.assertEqual((pinned["tipCommit"], pinned["updateAvailable"]), (tip, True))
        self.assertEqual(pinned["baselineCommit"], self.commits["mini_obc"]["F0"])
        self.assertEqual(self.reviews(label="OBC-B"), [])
        [review] = self.reviews("open", "OBC-A")
        self.assertEqual(self.comparable(review), self.golden(spec["instances"]["OBC-A"]["items"]))
        # Keep OBC-A pinned at F0 instead of accepting.
        self.document()
        self.mutate("POST", f"/reviews/{review['id']}/keep-pinned")
        kept = self.instance("OBC-A")
        self.assertTrue(kept["pinned"])
        self.assertEqual(kept["baselineCommit"], self.commits["mini_obc"]["F0"])
        # Rebasing the pinned OBC-B onto the tip raises the J7.17 change it hid.
        self.document()
        rebased = self.call("POST", f"/{self.sid}/instances/{self.instances['OBC-B']}/rebase",
                            headers={"If-Match": self.etag}, body={"commit": tip})
        self.drain()
        self.assertIn(rebased.status, (200, 202), rebased.text)
        if rebased.status == 202:
            self.document()
            rebased = self.call("POST", f"/{self.sid}/instances/{self.instances['OBC-B']}/rebase",
                                headers={"If-Match": self.etag}, body={"commit": tip})
            self.assertEqual(rebased.status, 200, rebased.text)
        [opened] = self.reviews("open", "OBC-B")
        self.assertEqual([(i["kind"], self.names[i["linkId"]], i["pins"]) for i in opened["items"]],
                         [("net_changed", "L-OBCB-TP1", ["17"])])

    # ------------------------------------------------------------------ snapshots across a reconcile

    def test_snapshot_diff_and_icd_follow_an_accepted_change(self) -> None:
        self.document()
        snap = self.mutate("POST", "/snapshots", expect=201, body={"name": "PDR"}).json
        tip, _ = self.push_and_fetch("mini_obc", "F1")
        [review] = self.reviews("open", "OBC-A")
        self.decide(review, review["items"][0], "accept")
        diff = self.call("GET", f"/{self.sid}/snapshots/{snap['id']}/diff?against=live").json
        self.assertEqual([(b["label"], b["status"], b["before"], b["after"]) for b in diff["boards"]],
                         [("OBC-A", "rebased", self.commits["mini_obc"]["F0"], tip)])
        [changed] = diff["links"]
        self.assertEqual((changed["name"], changed["status"]), ("L-J7J4", "changed"))
        [row] = changed["rows"]["changed"]
        self.assertEqual((row["before"]["pinA"], row["before"]["netA"], row["after"]["netA"]),
                         ("17", ["PAYLOAD_RESET#"], []))
        csv = self.call("GET", f"/{self.sid}/snapshots/{snap['id']}/icd.csv")
        live = self.call("GET", f"/{self.sid}/icd.csv")
        self.assertEqual((csv.status, live.status), (200, 200))
        self.assertIn("PAYLOAD_RESET#", csv.text)
        self.assertNotEqual(csv.text, live.text)


if __name__ == "__main__":
    unittest.main()
