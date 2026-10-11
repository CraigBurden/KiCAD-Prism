"""SB2-55: a published revision records the commit of its snapshot (CONTRACTS_P2 §21.6, D-P2-46)."""

from __future__ import annotations

from fastapi import FastAPI
from unittest import mock

from test_system_api import _request
from test_system_git import GitCase
from test_system_publish import PublishCase

from app.core.errors import install_error_handlers  # noqa: E402
from app.api import systems as systems_api
from app.services.systems import service as service_module
from app.services.systems.store import Conflict, Invalid, NotFound


class CommitPublishTest(GitCase, PublishCase):
    def test_a_committed_snapshot_publishes_with_its_commit_and_by_its_commit(self) -> None:
        self.export("PWR_IN", "OBC-A", "J6")
        self.link()
        cdr = self.take("CDR")
        with self.assertRaisesRegex(Conflict, "git_commit_pending"):
            self.publish(cdr["id"], ipn=self.ipn)
        pushed = self.commit(cdr)

        created, publication = self.publish(cdr["id"], ipn=self.ipn)
        self.assertTrue(created)
        self.assertEqual(publication["commit"], pushed["commit"])
        source = self.catalog.get_component(publication["componentId"])["source_ref"]
        self.assertEqual(source["git"], {"url": str(self.upstream), "branch": "main", "commit": pushed["commit"]})
        self.assertEqual(source["snapshotId"], cdr["id"], "the revision still pins the snapshot (D-P2-1)")
        listed = next(s for s in self.service.list_snapshots(self.service_caller(), self.sid) if s["id"] == cdr["id"])
        self.assertEqual(listed["publication"]["commit"], pushed["commit"])

        pdr = self.take("PDR")
        second = self.commit(pdr)
        snapshot_id = self.service.snapshot_for_commit(self.service_caller(), self.sid, second["commit"].upper())
        self.assertEqual(snapshot_id, pdr["id"])
        created, again = self.publish(snapshot_id)
        self.assertEqual((created, again["commit"], again["version"]), (True, second["commit"], 2))

    def test_only_commits_prism_pushed_for_a_snapshot_can_be_published(self) -> None:
        self.export("PWR_IN", "OBC-A", "J6")
        self.link()
        outside = self.outside_commit("README.md", "notes\n")
        with self.assertRaisesRegex(NotFound, "commit_not_a_snapshot"):
            self.service.snapshot_for_commit(self.service_caller(), self.sid, outside)
        with self.assertRaisesRegex(Invalid, "40-character"):
            self.service.snapshot_for_commit(self.service_caller(), self.sid, outside[:12])

    def test_a_snapshot_of_an_unlinked_system_or_a_failed_commit_publishes_without_one(self) -> None:
        self.export("PWR_IN", "OBC-A", "J6")
        _, publication = self.publish(self.take("CDR")["id"], ipn=self.ipn)
        self.assertIsNone(publication["commit"])
        self.assertNotIn("git", self.catalog.get_component(publication["componentId"])["source_ref"])

    def test_the_commit_route_publishes(self) -> None:
        self.export("PWR_IN", "OBC-A", "J6")
        self.link()
        pushed = self.commit(self.take("CDR"))
        patcher = mock.patch.object(service_module, "service", self.service)
        patcher.start()
        self.addCleanup(patcher.stop)
        app = FastAPI()
        install_error_handlers(app)
        app.include_router(systems_api.router, prefix="/api/systems")
        path = f"/api/systems/{self.sid}/git/commits/{pushed['commit']}/publish"
        self.assertEqual(_request(app, "POST", path, body={"ipn": self.ipn}, user="viewer").status, 403)
        response = _request(app, "POST", path, body={"ipn": self.ipn})
        self.assertEqual((response.status, response.json["commit"]), (201, pushed["commit"]))
        missing = _request(app, "POST", f"/api/systems/{self.sid}/git/commits/{'0' * 40}/publish", body={})
        self.assertEqual(missing.status, 404)

    def service_caller(self):
        from test_system_snapshots import DESIGNER

        return DESIGNER
