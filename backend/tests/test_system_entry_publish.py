"""Publishing a system to the catalog end to end (CONTRACTS.md §11.2)."""

from __future__ import annotations

import json
import sys
import unittest
import uuid
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core import errors  # noqa: E402
from app.services.catalog import system_entries  # noqa: E402
from app.services.catalog.component_identity import find_identity_holder  # noqa: E402
from app.services.catalog.workflow_policy import normalize_workflow_stage  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from app.services.design_bundle import schemas  # noqa: E402
from app.system_builder import publishing  # noqa: E402
from app.system_builder.document import canonical, new_document  # noqa: E402
from app.system_builder.publishing import lookup_entry  # noqa: E402
from app.system_builder.service import Caller, SystemService  # noqa: E402
from app.system_builder.settings import limits  # noqa: E402
from support.postgres import CATALOG_URL, requires_scratch_postgres  # noqa: E402
from test_system_bundle_job import (  # noqa: E402
    OBC_PROJECT,
    SystemBundleWorkspace,
    occurrence,
)

CALLER = Caller(
    email="owner@example.com", role="designer", can_see_project=lambda project_id: True,
)


def export(export_id: str = "exp_obc", occurrence_id: str = "occ_obc", connector: str = "J2") -> dict:
    return {
        "id": export_id,
        "name": export_id.replace("exp_", "").upper(),
        "site": {"occurrence": occurrence_id, "connector": connector},
        "pinNames": {},
    }


def entry_payload(system_id: str = "sys_child", key: str = "a" * 64) -> dict:
    document = new_document("Child")
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
    }
    payload = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": system_id,
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": key,
        },
        "document": document,
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": {"exports": []},
    }
    schemas.validate(payload, "prism.system_entry.a0")
    return payload


@requires_scratch_postgres("system publishing")
class SystemPublishTests(SystemBundleWorkspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.catalog = ComponentCatalogPostgresService(
            store_root=self.tmp / "catalog", database_url=CATALOG_URL,
        )
        self.catalog.initialize()
        self.addCleanup(self.catalog.close)
        self.service = SystemService(self.system_store, limits, catalog=self.catalog)

    # --------------------------------------------------------------- setup

    def create_publishable(self, system_id: str = "sys_a", occurrences: list[dict] | None = None) -> dict:
        project = f"prj_{uuid.uuid4().hex[:12]}"
        commit = self.add_board(project, f"r_{system_id}")
        self.build_design_bundle(project)
        document = new_document("Flight stack")
        document["occurrences"] = occurrences or [occurrence("occ_obc", "OBC", project, commit)]
        document["exports"] = [
            export() if (occurrences is None) else export("exp_obc", occurrences[0]["id"], "J2")
        ]
        document = canonical(document)
        self.system_store.create(
            system_id, document, folder_id=None, created_by="owner@example.com", role="admin",
        )
        return document

    def build_bundle(self, system_id: str = "sys_a") -> str:
        answer = self.service.bundle(system_id, CALLER, role="designer")
        self.assertEqual(answer["state"], "building", answer)
        result = self.run_system_job(self.queued_job("system_bundle"))
        return str(result.details["bundle_key"])

    def create_entry_revision(self, *, stage: str = "qa_review", system_id: str = "sys_child") -> tuple[str, str]:
        with self.catalog.connection() as conn:
            component_id = system_entries.new_component_id()
            payload = entry_payload(system_id=system_id)
            component, revision = system_entries.write_entry_revision(
                conn,
                self.catalog.runtime,
                revision_kernel=self.catalog.revisions,
                finalizer=publishing.CatalogGateway(self.catalog).finalizer(),
                component_writer=publishing.CatalogGateway(self.catalog).writer(),
                asset_files=self.catalog.asset_files,
                asset_registry=self.catalog.asset_registry,
                component_id=component_id,
                entry_payload=payload,
                interface=payload["interface"],
                source_ref={"systemId": system_id, "snapshotId": "snap_child"},
                ipn=f"IPN-{component_id[:8]}",
                name="Child",
                description="",
                actor="owner@example.com",
                change_summary="Create entry",
            )
            if stage != "qa_review":
                conn.execute(
                    "UPDATE component_revisions SET release_status = %s WHERE id = %s",
                    (stage, revision),
                )
            conn.commit()
        return component, revision

    def revision_rows(self, component_id: str) -> list[dict]:
        with self.catalog.connection() as conn:
            return [
                dict(row)
                for row in conn.execute(
                    "SELECT * FROM component_revisions WHERE component_id = %s ORDER BY version",
                    (component_id,),
                ).fetchall()
            ]

    # -------------------------------------------------------------- tests

    def test_first_publish_creates_the_component_and_later_publishes_add_revisions(self) -> None:
        ipn = f"PRISM-{uuid.uuid4().hex[:10]}"
        self.create_publishable()
        self.build_bundle()

        first = self.service.publish(
            "sys_a", CALLER, role="designer",
            expected="1", snapshot_id=None, ipn=ipn,
            change_summary="Publish flight stack",
        )
        self.assertEqual(first["stage"], "qa_review")
        component_id = first["componentId"]
        with self.catalog.connection() as conn:
            component = dict(
                conn.execute("SELECT * FROM components WHERE id = %s", (component_id,)).fetchone()
            )
            identity = find_identity_holder(
                conn,
                system_entries.ipn_identity(ipn),
            )
        self.assertEqual(component["kind"], "system")
        self.assertEqual(component["identity_kind"], "ipn")
        self.assertEqual(component["identity_source"], "system")
        self.assertEqual(component["normalized_part_number"], ipn.lower())
        self.assertEqual(identity["id"], component_id)

        revision = self.revision_rows(component_id)[0]
        self.assertEqual(normalize_workflow_stage(revision["release_status"]), "qa_review")
        source_ref = json.loads(revision["source_ref_json"])
        self.assertEqual(source_ref["systemId"], "sys_a")
        self.assertTrue(source_ref["snapshotId"].startswith("snap_"))
        interface = json.loads(revision["interface_json"])
        self.assertEqual([item["id"] for item in interface["exports"]], ["exp_obc"])
        self.assertEqual(interface["exports"][0]["connector"], "J2")

        with self.catalog.connection() as conn:
            assets = self.catalog.revisions.load_assets_for_revision(conn, first["revisionId"])
            manifest_hash = self.catalog.revisions.revision_manifest_hash(conn, first["revisionId"])
            asset = next(item for item in assets if item["asset_type"] == "system_entry")
            payload = json.loads(Path(asset["canonical_path"]).read_text(encoding="utf-8"))
        schemas.validate(payload, "prism.system_entry.a0")
        self.assertEqual(payload["source"]["systemId"], "sys_a")
        self.assertEqual(payload["source"]["version"], 1)
        self.assertEqual(payload["source"]["snapshotId"], json.loads(revision["source_ref_json"])["snapshotId"])
        self.assertEqual(bool(asset["required"]), True)
        self.assertEqual(manifest_hash, revision["manifest_hash"])
        with self.catalog.connection() as conn:
            manifest_assets = {
                item["sha256"]
                for item in self.catalog.revisions.load_assets_for_revision(conn, first["revisionId"])
            }
        self.assertIn(asset["sha256"], manifest_assets)

        # A later publish of a changed document adds a revision to the same component.
        self.rename_system("sys_a", "Renamed flight stack")
        self.build_bundle()
        second = self.service.publish(
            "sys_a", CALLER, role="designer",
            expected="2", snapshot_id=None, ipn=None,
            change_summary="Publish again",
        )
        self.assertEqual(second["componentId"], component_id)
        self.assertNotEqual(second["revisionId"], first["revisionId"])
        self.assertEqual(len(self.revision_rows(component_id)), 2)
        self.assertEqual(second["stage"], "qa_review")

        # An IPN that differs from the component's is refused.
        with self.assertRaises(errors.Conflict) as refused:
            self.service.publish(
                "sys_a", CALLER, role="designer",
                expected="2", snapshot_id=None, ipn="PRISM-SYS-OTHER",
                change_summary="Wrong IPN",
            )
        self.assertEqual(refused.exception.code, "system_ipn_mismatch")

    def test_the_first_publish_requires_an_ipn(self) -> None:
        self.create_publishable()
        self.build_bundle()
        with self.assertRaises(errors.Invalid) as refused:
            self.service.publish(
                "sys_a", CALLER, role="designer",
                expected="1", snapshot_id=None, ipn=None,
                change_summary="Publish",
            )
        self.assertEqual(refused.exception.code, "system_ipn_required")
        self.assertEqual(self.system_store.list_snapshots("sys_a"), [])

    def test_a_retry_after_a_failed_workspace_write_reuses_the_revision(self) -> None:
        ipn = f"PRISM-{uuid.uuid4().hex[:10]}"
        self.create_publishable()
        self.build_bundle()
        first = self.service.publish(
            "sys_a", CALLER, role="designer",
            expected="1", snapshot_id=None, ipn=ipn,
            change_summary="Publish",
        )
        snapshot_id = self.revision_rows(first["componentId"])[0]
        snapshot_id = json.loads(snapshot_id["source_ref_json"])["snapshotId"]
        # Simulate the catalog write succeeding and the workspace write failing.
        with self.system_store.connection() as conn:
            conn.execute("DELETE FROM ws_system_publications WHERE system_id = %s", ("sys_a",))
            conn.execute("UPDATE ws_systems SET catalog_component_id = NULL WHERE system_id = %s", ("sys_a",))
            conn.commit()

        retried = self.service.publish(
            "sys_a", CALLER, role="designer",
            expected="1", snapshot_id=snapshot_id, ipn=ipn,
            change_summary="Retry publish",
        )
        self.assertEqual(retried["componentId"], first["componentId"])
        self.assertEqual(retried["revisionId"], first["revisionId"])
        self.assertEqual(len(self.revision_rows(first["componentId"])), 1)
        record = self.system_store.read("sys_a", role="admin")
        assert record is not None
        self.assertEqual(record["catalog_component_id"], first["componentId"])
        with self.system_store.connection() as conn:
            published = conn.execute(
                "SELECT component_id, revision_id FROM ws_system_publications WHERE system_id = %s",
                ("sys_a",),
            ).fetchall()
        self.assertEqual([(row["component_id"], row["revision_id"]) for row in published], [(first["componentId"], first["revisionId"])])

    def test_checks_refuse_in_order(self) -> None:
        commit = self.add_board(OBC_PROJECT, "r1")
        self.build_design_bundle(OBC_PROJECT)

        # 1. no exports
        document = new_document("No exports")
        document["occurrences"] = [occurrence("occ_obc", "OBC", OBC_PROJECT, commit)]
        self.system_store.create("sys_empty", canonical(document), folder_id=None, created_by="owner@example.com", role="admin")
        with self.assertRaises(errors.Conflict) as refused:
            self.service.publish(
                "sys_empty", CALLER, role="designer", expected="1",
                snapshot_id=None, ipn="IPN-EMPTY", change_summary="Publish",
            )
        self.assertEqual(refused.exception.code, "system_no_exports")

        # 2. a body occurrence
        document = new_document("Body")
        document["occurrences"] = [
            occurrence("occ_obc", "OBC", OBC_PROJECT, commit),
            {
                "id": "occ_body",
                "label": "Case",
                "source": {"kind": "body", "componentId": "comp_body", "revisionId": "rev_body"},
            },
        ]
        document["exports"] = [export()]
        self.system_store.create("sys_body", canonical(document), folder_id=None, created_by="owner@example.com", role="admin")
        with self.assertRaises(errors.Conflict) as refused:
            self.service.publish(
                "sys_body", CALLER, role="designer", expected="1",
                snapshot_id=None, ipn="IPN-BODY", change_summary="Publish",
            )
        self.assertEqual(refused.exception.code, "system_publish_unsupported")

        # 3. the bundle is not built
        self.create_publishable("sys_unbuilt")
        with self.assertRaises(errors.Conflict) as refused:
            self.service.publish(
                "sys_unbuilt", CALLER, role="designer", expected="1",
                snapshot_id=None, ipn="IPN-UNBUILT", change_summary="Publish",
            )
        self.assertEqual(refused.exception.code, "system_bundle_not_ready")
        # A refused publish leaves no snapshot, so UI retries do not pile them up.
        self.assertEqual(self.system_store.list_snapshots("sys_unbuilt"), [])

        # 4. an unwaived error finding
        self.create_publishable("sys_dirty")
        key = self.build_bundle("sys_dirty")
        stored = Path(self.bundle_store_path("sys_dirty", key))
        bundle = json.loads(stored.read_text(encoding="utf-8"))
        bundle["findings"] = [
            {
                "code": "occurrence-absent",
                "severity": "error",
                "subject": "occurrence:occ_obc",
                "message": "injected",
                "objects": ["occ_obc"],
                "waived": False,
            }
        ]
        stored.write_text(json.dumps(bundle), encoding="utf-8")
        with self.assertRaises(errors.Conflict) as refused:
            self.service.publish(
                "sys_dirty", CALLER, role="designer", expected="1",
                snapshot_id=None, ipn="IPN-DIRTY", change_summary="Publish",
            )
        self.assertEqual(refused.exception.code, "system_not_clean")

        # 5. an unreleased entry
        component, revision = self.create_entry_revision()
        document = new_document("Parent")
        document["occurrences"] = [
            occurrence("occ_obc", "OBC", OBC_PROJECT, commit),
            {
                "id": "occ_child", "label": "Child",
                "source": {"kind": "entry", "componentId": component, "revisionId": revision},
            },
        ]
        document["exports"] = [export()]
        self.system_store.create("sys_parent", canonical(document), folder_id=None, created_by="owner@example.com", role="admin")
        with mock.patch.object(
            publishing,
            "lookup_entry",
            lambda component_id, revision_id, catalog=None: lookup_entry(
                component_id, revision_id, catalog=publishing.CatalogGateway(self.catalog),
            ),
        ), mock.patch(
            "app.system_builder.members.entry_lookup",
            lambda component_id, revision_id: lookup_entry(
                component_id, revision_id, catalog=publishing.CatalogGateway(self.catalog),
            ),
        ):
            self.build_bundle("sys_parent")
            with self.assertRaises(errors.Conflict) as refused:
                self.service.publish(
                    "sys_parent", CALLER, role="designer", expected="1",
                    snapshot_id=None, ipn="IPN-PARENT", change_summary="Publish",
                )
        self.assertEqual(refused.exception.code, "system_entry_unreleased")

    def test_an_ipn_identity_is_refused_on_a_part_and_a_system_entry_on_a_part_revision(self) -> None:
        from psycopg import errors as pg_errors

        from app.services.catalog.asset_links import CatalogAssetLinks
        from app.services.catalog.normalization import utc_now_iso

        with self.catalog.connection() as conn:
            with self.assertRaises(pg_errors.CheckViolation):
                conn.execute(
                    """
                    INSERT INTO components
                        (id, slug, kind, identity_kind, identity_source,
                         normalized_part_number, created_at, updated_at)
                    VALUES (%s, %s, 'part', 'ipn', 'system', %s, %s, %s)
                    """,
                    (
                        f"comp_{uuid.uuid4().hex[:10]}",
                        f"part-{uuid.uuid4().hex[:10]}",
                        f"ipn-{uuid.uuid4().hex[:10]}",
                        utc_now_iso(),
                        utc_now_iso(),
                    ),
                )
            conn.rollback()

        part = self.catalog.create_manual_component(
            value="10k",
            description="Part",
            datasheet="https://example.invalid/p.pdf",
            manufacturer="Prism",
            manufacturer_part_number=f"PART-{uuid.uuid4().hex[:10]}",
            actor="owner@example.com",
        )
        with self.catalog.connection() as conn:
            with self.assertRaises(ValueError):
                CatalogAssetLinks.link_asset_to_revision(
                    conn,
                    str(part["revision_id"]),
                    {"asset_type": "system_entry", "id": "asset-not-used"},
                    required=True,
                )

    def bundle_store_path(self, system_id: str, key: str) -> str:
        from app.system_builder import bundle_store

        return str(bundle_store.path(system_id, key))


if __name__ == "__main__":
    unittest.main()
