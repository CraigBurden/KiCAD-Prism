"""Catalog "mates with" on the catalog database."""

from __future__ import annotations

import os
import tempfile
import unittest
import uuid
from pathlib import Path

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for catalog mates-with tests")
class MatesWithTest(unittest.TestCase):
    def setUp(self) -> None:
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

        self.tempdir = tempfile.TemporaryDirectory()
        self.service = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components", database_url=POSTGRES_URL,
        )
        self.service.initialize()
        self.created: list[str] = []

    def tearDown(self) -> None:
        for component_id in self.created:
            self.service.deactivate_component(component_id, actor="test@local", reason="SB2-16 test cleanup")
        self.service.close()
        self.tempdir.cleanup()

    def part(self, mpn: str | None = None) -> tuple[str, str]:
        mpn = mpn or f"MW-{uuid.uuid4().hex[:8]}"
        created = self.service.create_manual_component(
            value="conn", description="connector", datasheet="https://example.com/c.pdf", manufacturer="Samtec",
            manufacturer_part_number=mpn, actor="author@example.com",
        )
        self.created.append(str(created["id"]))
        return str(created["id"]), mpn

    def test_a_pair_reads_from_both_sides_and_is_audited_once_per_part(self) -> None:
        (plug, plug_mpn), (socket, _socket_mpn) = self.part(), self.part()
        listed = self.service.part_relations.set_mate(plug, socket, mates=True, actor="author@example.com")
        self.assertEqual([m["componentId"] for m in listed], [socket])
        self.assertEqual([m["componentId"] for m in self.service.part_relations.list_mates_with(socket)], [plug])
        again = self.service.part_relations.set_mate(socket, plug, mates=True, actor="author@example.com")  # same pair, reversed
        self.assertEqual(len(again), 1)
        self.assertEqual(self.service.part_relations.mate_pairs([plug]), {tuple(sorted((plug, socket)))})
        for part in (plug, socket):
            events = [e for e in self.service.list_component_audit_events(part)
                      if str(e.get("event_type") or e.get("eventType")).startswith("component.mates_with")]
            self.assertEqual(len(events), 1, part)  # the reversed add changed nothing and wrote nothing
        self.assertEqual(self.service.part_relations.parts_by_mpn([plug_mpn.upper()])[plug_mpn.lower()]["componentId"], plug)
        self.service.part_relations.set_mate(plug, socket, mates=False, actor="author@example.com")
        self.assertEqual(self.service.part_relations.list_mates_with(socket), [])

    def test_a_part_does_not_mate_with_itself_or_a_missing_part(self) -> None:
        part, _ = self.part()
        with self.assertRaises(ValueError):
            self.service.part_relations.set_mate(part, part, mates=True)
        with self.assertRaises(LookupError):
            self.service.part_relations.set_mate(part, "missing", mates=True)

    def test_an_ambiguous_mpn_matches_no_part(self) -> None:
        shared = f"MW-{uuid.uuid4().hex[:8]}"
        self.part(shared)
        try:
            self.part(shared)
        except Exception:
            self.skipTest("the catalog refuses a duplicate MPN outright")
        self.assertEqual(self.service.part_relations.parts_by_mpn([shared]), {})
