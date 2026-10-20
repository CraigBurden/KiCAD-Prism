"""A placed entry is a key input and a CLI input of the system bundle (§12.2)."""

from __future__ import annotations

import sys
import tempfile
import unittest
import uuid
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.catalog import system_entries  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from app.services.design_bundle import schemas  # noqa: E402
from app.system_builder import bundle_store, publishing  # noqa: E402
from app.system_builder.document import canonical, new_document  # noqa: E402
from app.system_builder.publishing import lookup_entry  # noqa: E402
from support.postgres import CATALOG_URL, requires_scratch_postgres  # noqa: E402
from test_system_bundle_job import (  # noqa: E402
    CALLER,
    OBC_PROJECT,
    SystemBundleWorkspace,
    occurrence,
)


def entry_payload(key: str = "c" * 64) -> dict:
    bundle = {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [],
        "nets": [],
        "mates": [],
        "links": [],
        "splices": [],
        "suggestions": [],
        "findings": [],
        "placement": {"occurrences": [], "mates": []},
    }
    payload = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": "sys_child",
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": key,
        },
        "document": new_document("Child"),
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": {"exports": []},
    }
    schemas.validate(payload, "prism.system_entry.a0")
    return payload


@requires_scratch_postgres("the system bundle with entries")
class SystemBundleEntryTests(SystemBundleWorkspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.catalog = ComponentCatalogPostgresService(
            store_root=self.tmp / "catalog", database_url=CATALOG_URL,
        )
        self.catalog.initialize()
        self.addCleanup(self.catalog.close)
        self.gateway = publishing.CatalogGateway(self.catalog)
        self.entry_component = ""
        self.entry_revision = ""

    def make_entry(self, stage: str = "released") -> None:
        payload = entry_payload()
        with self.catalog.connection() as conn:
            self.entry_component, self.entry_revision = system_entries.write_entry_revision(
                conn,
                self.catalog.runtime,
                revision_kernel=self.catalog.revisions,
                finalizer=self.gateway.finalizer(),
                component_writer=self.gateway.writer(),
                asset_files=self.catalog.asset_files,
                asset_registry=self.catalog.asset_registry,
                component_id=system_entries.new_component_id(),
                entry_payload=payload,
                interface={"exports": []},
                source_ref={"systemId": "sys_child", "snapshotId": "snap_child"},
                identity=system_entries.EntryIdentity.ipn(f"BUNDLE-{uuid.uuid4().hex[:10]}"),
                name="Child",
                description="",
                actor="owner@example.com",
                change_summary="Create entry",
            )
            conn.execute(
                "UPDATE component_revisions SET release_status = %s WHERE id = %s",
                (stage, self.entry_revision),
            )
            conn.commit()

    def set_stage(self, stage: str) -> None:
        with self.catalog.connection() as conn:
            conn.execute(
                "UPDATE component_revisions SET release_status = %s WHERE id = %s",
                (stage, self.entry_revision),
            )
            conn.commit()

    def resolver(self):
        return mock.patch(
            "app.system_builder.members.entry_lookup",
            lambda component_id, revision_id: lookup_entry(
                component_id, revision_id, catalog=self.gateway,
            ),
        )

    def create_parent(self, commit: str) -> dict:
        document = new_document("Parent")
        document["occurrences"] = [
            occurrence("occ_obc", "OBC", OBC_PROJECT, commit),
            {
                "id": "occ_child",
                "label": "Child",
                "source": {
                    "kind": "entry",
                    "componentId": self.entry_component,
                    "revisionId": self.entry_revision,
                },
            },
        ]
        document = canonical(document)
        self.system_store.create(
            "sys_parent", document, folder_id=None, created_by="owner@example.com", role="admin",
        )
        return document

    def test_the_job_passes_entry_inputs_and_the_key_moves_with_the_stage(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        obc = self.build_design_bundle(OBC_PROJECT)
        self.make_entry(stage="released")

        with self.resolver():
            document = self.create_parent(commit)
            payload_sha = lookup_entry(
                self.entry_component, self.entry_revision, catalog=self.gateway,
            ).payload_sha256
            first = self.service.bundle("sys_parent", CALLER, role="viewer")
            self.assertEqual(first["state"], "building")
            first_result = self.run_system_job(self.queued_job("system_bundle"))

        expected_first = self.expected_key(
            document,
            {"occ_obc": obc["bundle_key"]},
            [],
            [],
            entries={"occ_child": {"payload": payload_sha, "stage": "released"}},
        )
        self.assertEqual(first["key"], expected_first)
        self.assertEqual(first_result.details["bundle_key"], expected_first)
        invocation = self.system_invocation()
        self.assertEqual(
            invocation[invocation.index("--entry") + 1],
            f"occ_child={self.entry_file()}",
        )
        self.assertEqual(
            invocation[invocation.index("--entry-stage") + 1], "occ_child=released"
        )
        stored = bundle_store.read("sys_parent", expected_first)
        assert stored is not None
        schemas.validate(stored, "prism.system_bundle.a0")
        states = {item["occurrence"]: item["state"] for item in stored["occurrences"]}
        self.assertEqual(states, {"occ_obc": "ready", "occ_child": "ready"})
        self.assertEqual(
            next(item for item in stored["occurrences"] if item["occurrence"] == "occ_child")["bundleKey"],
            "c" * 64,
        )

        # Only the catalog stage changed; the payload and the document did not.
        self.set_stage("archived")
        with self.resolver():
            second = self.service.bundle("sys_parent", CALLER, role="viewer")
            self.assertEqual(second["state"], "building")
            self.assertNotEqual(second["key"], first["key"])
            second_result = self.run_system_job(self.queued_job("system_bundle"))
        expected_second = self.expected_key(
            document,
            {"occ_obc": obc["bundle_key"]},
            [],
            [],
            entries={"occ_child": {"payload": payload_sha, "stage": "archived"}},
        )
        self.assertEqual(second["key"], expected_second)
        self.assertEqual(second_result.details["bundle_key"], expected_second)
        self.assertTrue(bundle_store.exists("sys_parent", expected_second))

    def entry_file(self) -> str:
        found = lookup_entry(self.entry_component, self.entry_revision, catalog=self.gateway)
        assert found is not None
        return str(found.payload_path)


if __name__ == "__main__":
    unittest.main()
