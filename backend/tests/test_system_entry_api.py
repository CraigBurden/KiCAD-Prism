"""Reading a published entry's insides, with §6 redaction (CONTRACTS.md §12.3)."""

from __future__ import annotations

import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import systems as systems_api  # noqa: E402
from app.services.catalog import system_entries  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from app.services.design_bundle import schemas  # noqa: E402
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER  # noqa: E402
from app.system_builder import publishing  # noqa: E402
from app.system_builder.document import canonical, new_document  # noqa: E402
from app.system_builder.service import SystemService  # noqa: E402
from app.system_builder.settings import limits  # noqa: E402
from app.system_builder.store import SystemStore  # noqa: E402
from support.asgi import request as _request  # noqa: E402
from support.postgres import (  # noqa: E402
    CATALOG_URL,
    requires_scratch_postgres,
    scratch_schema,
    seed_folder,
    seed_project,
    seed_repository,
)
from test_system_api import _Workspace, _app  # noqa: E402

HIDDEN_PROJECT = "prj_aaaaaaaaaaaa"


def child_document() -> dict:
    document = new_document("Child")
    document["occurrences"] = [
        {
            "id": "occ_secret",
            "label": "Secret board",
            "source": {
                "kind": "board",
                "projectId": HIDDEN_PROJECT,
                "track": {"kind": "pinned", "commit": "a" * 40},
            },
        }
    ]
    document["exports"] = [
        {
            "id": "exp_x",
            "name": "Secret connector",
            "site": {"occurrence": "occ_secret", "connector": "J1"},
            "pinNames": {},
        }
    ]
    return canonical(document)


def entry_payload() -> dict:
    interface = {
        "exports": [
            {
                "id": "exp_x",
                "name": "Secret connector",
                "occurrence": "occ_secret",
                "connector": "J1",
                "pins": [
                    {
                        "pad": "1",
                        "name": "P1",
                        "net": "net-1111111111111111",
                        "signal": "N",
                    }
                ],
            }
        ]
    }
    bundle = {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [
            {
                "occurrence": "occ_secret",
                "state": "ready",
                "bundleKey": "b" * 64,
                "connectors": [
                    {
                        "refdes": "J1",
                        "value": "Secret connector",
                        "candidate": True,
                        "pins": [
                            {"pad": "1", "nets": ["N"], "pinName": "P1", "power": False}
                        ],
                    }
                ],
            }
        ],
        "nets": [
            {
                "id": "net-1111111111111111",
                "name": "N",
                "names": ["N"],
                "boardNets": [{"occurrence": "occ_secret", "net": "N"}],
                "pins": [{"occurrence": "occ_secret", "connector": "J1", "pad": "1"}],
            }
        ],
        "mates": [],
        "links": [],
        "splices": [],
        "suggestions": [],
        "findings": [],
        "placement": {
            "occurrences": [
                {
                    "occurrence": "occ_secret",
                    "pose": {
                        "translation": {"xNm": 0, "yNm": 0, "zNm": 0},
                        "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
                    },
                    "source": "default",
                    "root": True,
                }
            ],
            "mates": [],
            "exports": [
                {
                    "export": "exp_x",
                    "mount": {
                        "translation": {"xNm": 0, "yNm": 0, "zNm": 0},
                        "rotation": {"x": 0, "y": 0, "z": 0, "w": 1},
                    },
                    "geometry": {
                        "side": "top",
                        "positionMm": [0.0, 0.0],
                        "rotationDeg": 0.0,
                        "footprintName": "Conn",
                        "pads": [],
                        "courtyard": None,
                        "model": None,
                    },
                    "matesTop": False,
                }
            ],
        },
    }
    payload = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": "sys_source",
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": "a" * 64,
        },
        "document": child_document(),
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": interface,
    }
    schemas.validate(payload, "prism.system_entry.a0")
    return payload


@requires_scratch_postgres("the system entry route")
class SystemEntryApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.scratch = scratch_schema(self, "entry_api", ledgers=(WORKSPACE_LEDGER,))
        seed_repository(self.scratch.conn, "repo_entry")
        seed_folder(
            self.scratch.conn, "fld_secret", visibility_mode="roles", allowed_roles=["designer"],
        )
        seed_project(
            self.scratch.conn, HIDDEN_PROJECT, "repo_entry", folder_id="fld_secret",
        )
        self.scratch.conn.commit()

        self.catalog = ComponentCatalogPostgresService(
            store_root=self.tmp / "catalog", database_url=CATALOG_URL,
        )
        self.catalog.initialize()
        self.addCleanup(self.catalog.close)
        self.store = SystemStore(self.scratch.connection)
        self.store.create(
            "sys_source", new_document("Source"), folder_id=None,
            created_by="owner@example.com", role="admin",
        )
        self.service = SystemService(self.store, limits, catalog=self.catalog)
        for patcher in (
            mock.patch.object(systems_api, "store", self.store),
            mock.patch.object(systems_api, "service", self.service),
            mock.patch.object(systems_api, "workspace", _Workspace(self.scratch.conn)),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.app = _app()

    def make_revision(self) -> str:
        gateway = publishing.CatalogGateway(self.catalog)
        payload = entry_payload()
        with self.catalog.connection() as conn:
            _component, revision = system_entries.write_entry_revision(
                conn,
                self.catalog.runtime,
                revision_kernel=self.catalog.revisions,
                finalizer=gateway.finalizer(),
                component_writer=gateway.writer(),
                asset_files=self.catalog.asset_files,
                asset_registry=self.catalog.asset_registry,
                component_id=system_entries.new_component_id(),
                entry_payload=payload,
                interface=payload["interface"],
                source_ref={"systemId": "sys_source", "snapshotId": "snap_child"},
                identity=system_entries.EntryIdentity.ipn(f"API-{uuid.uuid4().hex[:10]}"),
                name="Child",
                description="",
                actor="owner@example.com",
                change_summary="Create entry",
            )
            conn.commit()
        return revision

    def call(self, revision_id: str, user: str):
        return _request(self.app, "GET", f"/api/catalog/system-entries/{revision_id}", user=user)

    def test_the_interface_is_never_redacted(self) -> None:
        revision = self.make_revision()
        for user in ("qa", "designer"):
            response = self.call(revision, user)
            self.assertEqual(response.status, 200, response.text)
            self.assertEqual(response.json["interface"], entry_payload()["interface"])

    def test_a_hidden_child_board_is_redacted_in_document_and_bundle(self) -> None:
        revision = self.make_revision()
        response = self.call(revision, "qa")
        self.assertEqual(response.status, 200, response.text)
        body = response.json
        self.assertEqual(body["document"]["occurrences"][0]["source"], {"kind": "redacted"})
        self.assertEqual(
            body["bundle"]["occurrences"],
            [{"occurrence": "occ_secret", "state": "redacted", "connectors": []}],
        )
        self.assertEqual(body["bundle"]["nets"], [])
        self.assertEqual(body["bundle"]["placement"]["exports"], [])
        self.assertNotIn("systemId", body)

    def test_a_designer_sees_the_child_and_the_source_system(self) -> None:
        revision = self.make_revision()
        response = self.call(revision, "designer")
        self.assertEqual(response.status, 200, response.text)
        body = response.json
        self.assertEqual(
            body["document"]["occurrences"][0]["source"]["projectId"], HIDDEN_PROJECT
        )
        self.assertEqual(body["bundle"]["occurrences"][0]["state"], "ready")
        self.assertEqual(body["systemId"], "sys_source")

    def test_an_unknown_revision_is_not_found(self) -> None:
        response = self.call("rev_missing", "designer")
        self.assertEqual(response.status, 404, response.text)


if __name__ == "__main__":
    unittest.main()
