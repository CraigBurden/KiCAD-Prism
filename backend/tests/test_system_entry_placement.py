"""Placing a published entry on a system (CONTRACTS.md §12.1, §12.2)."""

from __future__ import annotations

import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import errors  # noqa: E402
from app.services.catalog import system_entries  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from app.services.design_bundle import schemas  # noqa: E402
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER  # noqa: E402
from app.system_builder import publishing  # noqa: E402
from app.system_builder.document import new_document  # noqa: E402
from app.system_builder.service import Caller, SystemService  # noqa: E402
from app.system_builder.settings import limits  # noqa: E402
from app.system_builder.store import SystemStore  # noqa: E402
from support.postgres import CATALOG_URL, requires_scratch_postgres, scratch_schema  # noqa: E402


def payload(system_id: str) -> dict:
    bundle = {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [],
        "nets": [],
        "mates": [],
        "links": [],
        "splices": [],
        "harnesses": [],
        "suggestions": [],
        "findings": [],
        "placement": {"occurrences": [], "mates": []},
    }
    value = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": system_id,
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": "a" * 64,
        },
        "document": new_document("Child"),
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": {"exports": []},
    }
    schemas.validate(value, "prism.system_entry.a0")
    return value


@requires_scratch_postgres("system entry placement")
class SystemEntryPlacementTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.scratch = scratch_schema(self, "entry_place", ledgers=(WORKSPACE_LEDGER,))
        self.store = SystemStore(self.scratch.connection)
        self.catalog = ComponentCatalogPostgresService(
            store_root=self.tmp / "catalog", database_url=CATALOG_URL,
        )
        self.catalog.initialize()
        self.addCleanup(self.catalog.close)
        self.service = SystemService(self.store, limits, catalog=self.catalog)
        self.store.create(
            "sys_target", new_document("Parent"), folder_id=None,
            created_by="owner@example.com", role="admin",
        )
        self.store.create(
            "sys_source", new_document("Source"), folder_id=None,
            created_by="owner@example.com", role="admin",
        )

    def entry(self, *, stage: str, system_id: str = "sys_source") -> tuple[str, str]:
        gateway = publishing.CatalogGateway(self.catalog)
        with self.catalog.connection() as conn:
            component, revision = system_entries.write_entry_revision(
                conn,
                self.catalog.runtime,
                revision_kernel=self.catalog.revisions,
                finalizer=gateway.finalizer(),
                component_writer=gateway.writer(),
                asset_files=self.catalog.asset_files,
                asset_registry=self.catalog.asset_registry,
                component_id=system_entries.new_component_id(),
                entry_payload=payload(system_id),
                interface={"exports": []},
                source_ref={"systemId": system_id, "snapshotId": "snap_child"},
                identity=system_entries.EntryIdentity.ipn(f"PLACE-{uuid.uuid4().hex[:10]}"),
                name="Child",
                description="",
                actor="owner@example.com",
                change_summary="Create entry",
            )
            conn.execute(
                "UPDATE component_revisions SET release_status = %s WHERE id = %s",
                (stage, revision),
            )
            conn.commit()
        return component, revision

    def add(self, component_id: str, revision_id: str, *, role: str = "designer", version: int = 1):
        caller = Caller(
            email="owner@example.com", role=role, can_see_project=lambda project_id: True,
        )
        return self.service.apply(
            "sys_target", caller, role=role, expected=str(version),
            request_ops=[
                {
                    "kind": "add-occurrence",
                    "occurrence": {
                        "id": "occ_child",
                        "label": "Child",
                        "source": {
                            "kind": "entry",
                            "componentId": component_id,
                            "revisionId": revision_id,
                        },
                    },
                }
            ],
        )

    def test_a_released_entry_places(self) -> None:
        component, revision = self.entry(stage="released")
        applied = self.add(component, revision)
        self.assertEqual(applied["version"], 2)
        self.assertEqual(
            applied["document"]["occurrences"][0]["source"],
            {"kind": "entry", "componentId": component, "revisionId": revision},
        )

    def test_an_unreleased_entry_is_refused_for_a_non_author(self) -> None:
        component, revision = self.entry(stage="qa_review")
        with self.assertRaises(errors.Conflict) as refused:
            self.add(component, revision, role="viewer")
        self.assertEqual(refused.exception.code, "system_entry_unreleased")
        record = self.store.read("sys_target", role="admin")
        assert record is not None
        self.assertEqual(record["version"], 1)

    def test_the_source_system_author_may_place_an_unreleased_entry(self) -> None:
        component, revision = self.entry(stage="qa_review", system_id="sys_source")
        applied = self.add(component, revision, role="designer")
        self.assertEqual(applied["version"], 2)

    def test_a_designer_without_the_source_system_is_refused(self) -> None:
        component, revision = self.entry(stage="qa_review", system_id="sys_not_here")
        with self.assertRaises(errors.Conflict) as refused:
            self.add(component, revision, role="designer")
        self.assertEqual(refused.exception.code, "system_entry_unreleased")

    def test_an_unknown_revision_is_not_found(self) -> None:
        with self.assertRaises(errors.NotFound):
            self.add("comp_unknown", "rev_unknown", role="designer")
        with self.assertRaises(errors.NotFound):
            self.add("comp_unknown", "rev_unknown", role="viewer")

    def test_changing_to_a_different_unreleased_revision_is_checked(self) -> None:
        released_component, released_revision = self.entry(stage="released")
        other_component, other_revision = self.entry(stage="qa_review")
        applied = self.add(released_component, released_revision)
        occurrence = applied["document"]["occurrences"][0]
        redesigned = {**occurrence, "source": {
            "kind": "entry", "componentId": other_component, "revisionId": other_revision,
        }}
        caller = Caller(
            email="owner@example.com", role="viewer", can_see_project=lambda project_id: True,
        )
        with self.assertRaises(errors.Conflict) as refused:
            self.service.apply(
                "sys_target", caller, role="viewer", expected="2",
                request_ops=[{"kind": "replace-occurrence", "occurrence": redesigned}],
            )
        self.assertEqual(refused.exception.code, "system_entry_unreleased")


if __name__ == "__main__":
    unittest.main()
