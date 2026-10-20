"""The system revision's own release gate (CONTRACTS.md §11.3)."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.catalog import system_entries  # noqa: E402
from app.services.catalog.normalization import utc_now_iso  # noqa: E402
from app.services.component_catalog_service_postgres import (  # noqa: E402
    ComponentCatalogPostgresService,
)
from app.services.design_bundle import schemas  # noqa: E402
from app.system_builder import publishing  # noqa: E402
from app.system_builder.document import new_document  # noqa: E402
from support.postgres import CATALOG_URL, requires_scratch_postgres  # noqa: E402


def payload_with(findings: list[dict] | None = None) -> dict:
    bundle = {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [],
        "nets": [],
        "mates": [],
        "links": [],
        "splices": [],
        "suggestions": [],
        "findings": findings or [],
        "placement": {"occurrences": [], "mates": []},
    }
    payload = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": "sys_child",
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": "a" * 64,
        },
        "document": new_document("Child"),
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": {"exports": []},
    }
    schemas.validate(payload, "prism.system_entry.a0")
    return payload


def bought_out_payload(*, body_model: bool = True, with_parts: bool = True) -> dict:
    """A bought-out system entry: a body occurrence, its bundle state and parts."""

    document = new_document("Bought-out child")
    document["occurrences"] = [
        {
            "id": "occ_body",
            "label": "Case",
            "source": {"kind": "body", "componentId": "cmp_body", "revisionId": "rev_body"},
        }
    ]
    bundle = {
        "schema": "prism.system_bundle.a0",
        "documentSha256": "0" * 64,
        "occurrences": [{"occurrence": "occ_body", "state": "ready", "connectors": []}],
        "nets": [],
        "mates": [],
        "links": [],
        "splices": [],
        "suggestions": [],
        "findings": [],
        "placement": {"occurrences": [], "mates": [], "exports": []},
    }
    payload = {
        "schema": "prism.system_entry.a0",
        "source": {
            "systemId": "sys_child",
            "version": 1,
            "snapshotId": "snap_child",
            "systemBundleKey": "a" * 64,
        },
        "document": document,
        "boardSubPorts": {"schema": "prism.board_sub_ports.a0", "subPorts": []},
        "bundle": bundle,
        "interface": {"exports": []},
    }
    if with_parts:
        part = {
            "ref": "cmp_body@rev_body",
            "componentId": "cmp_body",
            "revisionId": "rev_body",
            "name": "Case",
        }
        if body_model:
            part["model"] = {
                "glbKey": "glb_case",
                "stepSha256": "c" * 64,
                "boundsMin": {"xNm": -10_000_000, "yNm": -10_000_000, "zNm": 0},
                "boundsMax": {"xNm": 10_000_000, "yNm": 10_000_000, "zNm": 20_000_000},
            }
        payload["parts"] = {"schema": "prism.system_parts.a0", "parts": [part]}
    schemas.validate(payload, "prism.system_entry.a0")
    return payload


@requires_scratch_postgres("the system release gate")
class SystemReleaseGateTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.catalog = ComponentCatalogPostgresService(
            store_root=self.tmp / "catalog", database_url=CATALOG_URL,
        )
        self.catalog.initialize()
        self.addCleanup(self.catalog.close)
        self.gateway = publishing.CatalogGateway(self.catalog)

    def write(self, payload: dict, *, identity=None) -> tuple[str, str]:
        identity = identity or system_entries.EntryIdentity.ipn(
            f"REL-{uuid.uuid4().hex[:10]}"
        )
        with self.catalog.connection() as conn:
            component, revision = system_entries.write_entry_revision(
                conn,
                self.catalog.runtime,
                revision_kernel=self.catalog.revisions,
                finalizer=self.gateway.finalizer(),
                component_writer=self.gateway.writer(),
                asset_files=self.catalog.asset_files,
                asset_registry=self.catalog.asset_registry,
                component_id=system_entries.new_component_id(),
                entry_payload=payload,
                interface=payload["interface"],
                source_ref={"systemId": "sys_child", "snapshotId": "snap_child"},
                identity=identity,
                name="Child",
                description="",
                actor="owner@example.com",
                change_summary="Create entry",
            )
            conn.execute(
                "UPDATE component_revisions SET release_status = 'done' WHERE id = %s",
                (revision,),
            )
            conn.commit()
        return component, revision

    def asset(self, revision_id: str) -> dict:
        with self.catalog.connection() as conn:
            return dict(
                conn.execute(
                    """
                    SELECT asset.*, link.required AS required
                      FROM revision_assets link
                      JOIN assets asset ON asset.id = link.asset_id
                     WHERE link.revision_id = %s AND asset.asset_type = 'system_entry'
                    """,
                    (revision_id,),
                ).fetchone()
            )

    def status(self, component_id: str) -> dict:
        with self.catalog.connection() as conn:
            return dict(
                conn.execute(
                    "SELECT * FROM component_revisions WHERE component_id = %s",
                    (component_id,),
                ).fetchone()
            )

    def test_a_clean_system_revision_releases_without_klc_or_a_representation(self) -> None:
        component, _revision = self.write(payload_with())
        self.catalog.set_release_status(component, "released", actor="", actor_role="qa")
        self.assertEqual(self.status(component)["release_status"], "released")

    def test_an_unwaived_error_finding_blocks(self) -> None:
        component, _revision = self.write(
            payload_with(
                [
                    {
                        "code": "occurrence-absent",
                        "severity": "error",
                        "subject": "occurrence:occ_gone",
                        "message": "the project is not present",
                        "objects": ["occ_gone"],
                        "waived": False,
                    }
                ]
            )
        )
        with self.assertRaises(ValueError) as refused:
            self.catalog.set_release_status(component, "released", actor="")
        self.assertIn("unwaived error", str(refused.exception))
        self.assertEqual(self.status(component)["release_status"], "done")

    def test_a_waived_error_finding_passes(self) -> None:
        component, _revision = self.write(
            payload_with(
                [
                    {
                        "code": "occurrence-absent",
                        "severity": "error",
                        "subject": "occurrence:occ_gone",
                        "message": "the project is not present",
                        "objects": ["occ_gone"],
                        "waived": True,
                    }
                ]
            )
        )
        self.catalog.set_release_status(component, "released", actor="")
        self.assertEqual(self.status(component)["release_status"], "released")

    def test_a_bought_out_revision_needs_a_ready_body_with_a_model(self) -> None:
        component, _revision = self.write(
            bought_out_payload(body_model=False),
            identity=system_entries.EntryIdentity.mpn("Acme", f"REL-{uuid.uuid4().hex[:8]}"),
        )
        with self.assertRaises(ValueError) as refused:
            self.catalog.set_release_status(component, "released", actor="")
        self.assertIn("body with its STEP model", str(refused.exception))
        self.assertEqual(self.status(component)["release_status"], "done")

    def test_a_bought_out_revision_without_parts_refuses_closed(self) -> None:
        component, _revision = self.write(
            bought_out_payload(with_parts=False),
            identity=system_entries.EntryIdentity.mpn("Acme", f"REL-{uuid.uuid4().hex[:8]}"),
        )
        with self.assertRaises(ValueError) as refused:
            self.catalog.set_release_status(component, "released", actor="")
        self.assertIn("body with its STEP model", str(refused.exception))

    def test_a_bought_out_revision_with_a_modelled_body_releases(self) -> None:
        component, _revision = self.write(
            bought_out_payload(body_model=True),
            identity=system_entries.EntryIdentity.mpn("Acme", f"REL-{uuid.uuid4().hex[:8]}"),
        )
        self.catalog.set_release_status(component, "released", actor="")
        self.assertEqual(self.status(component)["release_status"], "released")

    def test_a_missing_payload_asset_blocks(self) -> None:
        ipn = f"BARE-{uuid.uuid4().hex[:10]}"
        with self.catalog.connection() as conn:
            component = system_entries.new_component_id()
            revision = self.gateway.writer().upsert_metadata_row(
                conn,
                self.catalog.runtime,
                component_id=component,
                metadata=system_entries.empty_system_metadata(ipn, "Bare", ""),
                now=utc_now_iso(),
                existing_component_id=None,
                actor="owner@example.com",
                change_summary="Bare system revision",
                finalize_revision=False,
                kind="system",
            )[1]
            conn.execute(
                "UPDATE component_revisions SET release_status = 'done' WHERE id = %s",
                (revision,),
            )
            conn.commit()
        with self.assertRaises(ValueError) as refused:
            self.catalog.set_release_status(component, "released", actor="")
        self.assertIn("system_entry asset", str(refused.exception))
        self.assertEqual(self.status(component)["release_status"], "done")

    def test_altered_payload_bytes_block(self) -> None:
        component, revision = self.write(payload_with())
        asset = self.asset(revision)
        Path(asset["canonical_path"]).write_bytes(b'{"schema":"tampered"}')
        with self.assertRaises(ValueError) as refused:
            self.catalog.set_release_status(component, "released", actor="")
        self.assertIn("missing or its bytes", str(refused.exception))
        self.assertEqual(self.status(component)["release_status"], "done")


if __name__ == "__main__":
    unittest.main()
