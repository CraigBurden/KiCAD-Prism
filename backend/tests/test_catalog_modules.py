"""SB2-48: catalog modules, their symbol-derived interface, models and release gates (CONTRACTS_P2 §3.5).

The module here is made up (D-P2-38): a small sensor with two connectors, drawn as a two-unit
KiCad symbol (D-P2-39). Its model is a committed open-hardware STEP (a terminal block from the
USB-PD fixture), since the gate only needs one to exist.
"""

from __future__ import annotations

import hashlib
import os
import tempfile
import unittest
import uuid
from pathlib import Path

from app.services.catalog import module_interface

POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL", "").strip()
STEP = Path(__file__).resolve().parents[2] / "fixtures" / "release-studio" / "usb-pd" / "packages3D" / "796638-2.step"
# A made-up 2×5 header (pads 1–10) from the SB2-21 fixtures: the connector part placed on the module (SB2-48b).
CONNECTOR = (Path(__file__).resolve().parent / "fixtures" / "system_builder" / "p2" / "sources" / "mezz_base" / "F0"
             / "PrismFixture.pretty" / "Conn_Custom_2x05.kicad_mod")
OTHER_STEP = STEP.parent / "CYPD3177-24LQXQT.stp"
TOP = {"originMm": [0.0, 0.0, 10.0], "normal": [0.0, 0.0, 1.0], "quarterTurns": 0}


def _pin(kind: str, number: str, name: str, y: float) -> str:
    return (f'(pin {kind} line (at -5.08 {y} 0) (length 2.54) (name "{name}" (effects (font (size 1.27 1.27)))) '
            f'(number "{number}" (effects (font (size 1.27 1.27)))))')


def module_symbol(*, common_pin: bool = False, repeat_pad: bool = False) -> str:
    """A made-up IMU: unit A "POWER/SERIAL" (pads 1–6), unit B "AUX" (pads 7–9)."""
    unit_a = [("power_in", "1", "VIN"), ("power_in", "2", "GND"), ("input", "3", "RX_P"), ("input", "4", "RX_N"),
              ("output", "5", "TX_P"), ("output", "6", "~")]
    unit_b = [("output", "7", "PPS"), ("input", "8", "SYNC"), ("power_out", "9" if not repeat_pad else "7", "GND")]
    body = lambda pins: " ".join(_pin(k, n, name, -2.54 * i) for i, (k, n, name) in enumerate(pins))
    common = f'(symbol "TEST_IMU_0_1" {_pin("passive", "10", "SHIELD", 5.08)})' if common_pin else ""
    return f'''(kicad_symbol_lib (version 20241209) (generator "prism_test")
  (symbol "TEST_IMU" (in_bom yes) (on_board yes)
    (property "Reference" "U" (at 0 0 0) (effects (font (size 1.27 1.27))))
    (property "Value" "TEST_IMU" (at 0 0 0) (effects (font (size 1.27 1.27))))
    {common}
    (symbol "TEST_IMU_1_1" (unit_name "POWER/SERIAL") {body(unit_a)})
    (symbol "TEST_IMU_2_1" (unit_name "AUX") {body(unit_b)})
  )
)
'''


class FromSymbolTest(unittest.TestCase):
    def write(self, text: str) -> Path:
        handle = tempfile.NamedTemporaryFile("w", suffix=".kicad_sym", delete=False)
        handle.write(text)
        handle.close()
        self.addCleanup(os.unlink, handle.name)
        return Path(handle.name)

    def test_units_are_connectors_and_pin_names_are_signals(self) -> None:
        derived = module_interface.from_symbol_file(self.write(module_symbol()))
        self.assertEqual(derived["schema"], "prism.module_interface.v1")
        self.assertEqual([(u["key"], u["unit"], u["name"], len(u["pins"])) for u in derived["units"]],
                         [("A", 1, "POWER/SERIAL", 6), ("B", 2, "AUX", 3)])
        a, b = derived["units"]
        self.assertEqual(a["pins"][0], {"pad": "1", "name": "VIN", "signal": "VIN", "powerNet": True})
        self.assertEqual(a["pins"][5]["signal"], "", "KiCad's ~ is no name")
        self.assertEqual([p["powerNet"] for p in b["pins"]], [False, False, True], "power_out is a power net")

    def test_common_pins_and_repeated_pads_are_refused(self) -> None:
        with self.assertRaisesRegex(ValueError, "common to all units"):
            module_interface.from_symbol_file(self.write(module_symbol(common_pin=True)))
        with self.assertRaisesRegex(ValueError, "pad 7 appears twice in unit B"):
            module_interface.from_symbol_file(self.write(module_symbol(repeat_pad=True)))

    def test_each_connector_numbers_its_own_pads(self) -> None:
        text = module_symbol().replace('(number "7"', '(number "1"').replace('(number "8"', '(number "2"')
        derived = module_interface.from_symbol_file(self.write(text))
        self.assertEqual([p["pad"] for p in derived["units"][1]["pins"]], ["1", "2", "9"])

    def test_unit_letters_follow_kicad(self) -> None:
        self.assertEqual([module_interface.unit_key(n) for n in (1, 2, 26, 27, 28)], ["A", "B", "Z", "AA", "AB"])


@unittest.skipUnless(POSTGRES_URL, "TEST_POSTGRES_URL is required for catalog integration tests")
class ModuleItemsTest(unittest.TestCase):
    def setUp(self) -> None:
        from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService

        self.tempdir = tempfile.TemporaryDirectory()
        self.service = ComponentCatalogPostgresService(
            store_root=Path(self.tempdir.name) / "components", database_url=POSTGRES_URL)
        self.service.initialize()
        self.created: list[str] = []

    def tearDown(self) -> None:
        for component_id in self.created:
            self.service.deactivate_component(component_id, actor="test@local", reason="SB2-48 test cleanup")
        self.service.close()
        self.tempdir.cleanup()

    def module(self) -> str:
        created = self.service.create_manual_component(
            kind="module", value="TEST_IMU", description="Made-up two-connector IMU", datasheet="https://example.com/imu.pdf",
            manufacturer="Example Sensors", manufacturer_part_number=f"IMU-{uuid.uuid4().hex[:8]}", actor="author@example.com")
        component_id = str(created["id"])
        self.created.append(component_id)
        return component_id

    def attach(self, component_id: str, asset_type: str, name: str, payload: bytes) -> None:
        if asset_type == "symbol":
            self.service.import_symbol_library(component_id, upload_name=name, payload=payload, target_library="Test",
                                               selected_symbol="TEST_IMU", actor="author@example.com")
            return
        self.service.attach_auxiliary_asset(component_id, asset_type=asset_type, upload_name=name, payload=payload,
                                            target_library="Test", actor="author@example.com")

    def connector_part(self, *, footprint: bool = True) -> str:
        part = self.service.create_manual_component(
            value="Conn_Custom_2x05", description="Made-up 2x05 header", datasheet="https://example.com/c.pdf",
            manufacturer="Test", manufacturer_part_number=f"HDR-{uuid.uuid4().hex[:8]}", actor="author@example.com")
        part_id = str(part["id"])
        self.created.append(part_id)
        if footprint:
            self.service.import_footprint(part_id, upload_name=CONNECTOR.name, payload=CONNECTOR.read_bytes(),
                                          target_library="Test", selected_footprint="Conn_Custom_2x05",
                                          actor="author@example.com")
        return part_id

    def modelled_module(self) -> str:
        component_id = self.module()
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym", module_symbol().encode())
        self.attach(component_id, "3dmodel", STEP.name, STEP.read_bytes())
        return component_id

    def place_all(self, component_id: str) -> None:
        part = self.connector_part()
        for key, origin in (("A", [0.0, 0.0, 10.0]), ("B", [-12.0, 0.0, 4.0])):
            normal = [0.0, 0.0, 1.0] if key == "A" else [-1.0, 0.0, 0.0]
            self.service.system_items.set_module_connector(
                component_id, key, part, {"originMm": origin, "normal": normal, "quarterTurns": 0},
                actor="author@example.com")

    def release(self, component_id: str) -> None:
        """Walk the workflow to released, resuming after a refused attempt."""
        stages = (("in_progress", "author@example.com", "designer"), ("qa_review", "author@example.com", "designer"),
                  ("done", "qa@example.com", "qa"), ("released", "qa@example.com", "admin"))
        current = self.service.get_component(component_id)["release_status"]
        names = [stage for stage, _actor, _role in stages]
        for stage, actor, role in stages[names.index(current) + 1 if current in names else 0:]:
            self.service.set_release_status(component_id, stage, actor=actor, actor_role=role)

    def test_the_symbol_becomes_the_interface_and_release_needs_it_and_a_model(self) -> None:
        component_id = self.module()
        self.assertEqual(self.service.get_component(component_id)["kind"], "module")
        with self.assertRaisesRegex(ValueError, "no symbol"):
            self.release(component_id)
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym", module_symbol().encode())
        component = self.service.get_component(component_id)
        self.assertEqual([u["key"] for u in component["interface"]["units"]], ["A", "B"])
        self.assertEqual(component["source_ref"], {"kind": "module"})
        with self.assertRaisesRegex(ValueError, "STEP model"):
            self.release(component_id)
        self.attach(component_id, "3dmodel", STEP.name, STEP.read_bytes())
        self.assertEqual([u["key"] for u in self.service.get_component(component_id)["interface"]["units"]], ["A", "B"],
                         "attaching the model keeps the interface")
        [model] = self.service.system_items.list_models(component_id)
        aligned = self.service.system_items.set_model_alignment(
            component_id, model["assetId"], {"offsetMm": [0, 0, 1], "rotationDeg": [0, 0, 0], "scale": 1},
            actor="author@example.com")
        self.assertEqual(aligned[0]["alignment"]["offsetMm"], [0.0, 0.0, 1.0])
        with self.assertRaisesRegex(ValueError, "every connector is placed: A, B"):
            self.release(component_id)
        self.place_all(component_id)
        self.release(component_id)
        self.assertEqual(self.service.get_component(component_id)["release_status"], "released")

    def test_a_bad_symbol_says_why_at_release(self) -> None:
        component_id = self.module()
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym", module_symbol(common_pin=True).encode())
        self.attach(component_id, "3dmodel", STEP.name, STEP.read_bytes())
        with self.assertRaisesRegex(ValueError, "common to all units"):
            self.release(component_id)

    def test_connectors_are_parts_placed_on_the_model(self) -> None:
        from app.services.systems.placement import module_ports

        component_id = self.modelled_module()
        listed = self.service.system_items.module_connectors(component_id)
        self.assertEqual([(u["key"], u["pads"], u["connector"]) for u in listed["units"]],
                         [("A", ["1", "2", "3", "4", "5", "6"], None), ("B", ["7", "8", "9"], None)])
        self.assertFalse(listed["complete"])
        part = self.connector_part()
        detail = self.service.system_items.connector_geometry(part)
        self.assertEqual(len(detail["geometry"]["pads"]), 10)
        self.assertIsNone(detail["model"], "the part has no converted model")
        placed = self.service.system_items.set_module_connector(
            component_id, "A", part, dict(TOP, normal=[0.0, 0.0, 2.0], quarterTurns=1), actor="author@example.com")
        connector = placed["units"][0]["connector"]
        self.assertEqual(connector["part"]["componentId"], part)
        self.assertEqual(connector["placement"],
                         {"originMm": [0.0, 0.0, 10.0], "normal": [0.0, 0.0, 1.0], "quarterTurns": 1, "axis": None})
        self.assertEqual([p["pad"] for p in connector["geometry"]["pads"]][:3], ["1", "2", "3"])
        self.assertEqual(connector["footprintPose"],
                         module_ports.footprint_pose(connector["placement"], connector["geometry"]))
        self.assertEqual(connector["missingPads"], [])
        self.assertFalse(placed["complete"], "unit B is still unplaced")
        moved = self.service.system_items.set_module_connector(
            component_id, "B", part, {"originMm": [-12.0, 0.0, 4.0], "normal": [-1.0, 0.0, 0.0], "quarterTurns": 3},
            actor="author@example.com")
        self.assertTrue(moved["complete"])
        removed = self.service.system_items.remove_module_connector(component_id, "B", actor="author@example.com")
        self.assertIsNone(removed["units"][1]["connector"])
        events = [e["event_type"] for e in self.service.list_component_audit_events(component_id)]
        self.assertIn("component.module_connector_placed", events)
        self.assertIn("component.module_connector_removed", events)

    def test_a_connector_keeps_the_part_revision_it_was_placed_with(self) -> None:
        """#698: a newer revision of the connector part never changes a placed connector until it is placed again."""
        component_id = self.modelled_module()
        part = self.connector_part()
        self.attach(part, "3dmodel", STEP.name, STEP.read_bytes())
        [first] = self.service.system_items.convert_models(part)
        placed_revision = str(self.service.get_component(part)["current_revision_id"])
        self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com")
        self.service.detach_asset(part, "3dmodel", actor="author@example.com")
        self.attach(part, "3dmodel", OTHER_STEP.name, OTHER_STEP.read_bytes())
        [head] = self.service.system_items.convert_models(part)
        self.assertNotEqual(head["glb"]["key"], first["glb"]["key"])

        connector = self.service.system_items.module_connectors(component_id)["units"][0]["connector"]
        self.assertEqual((connector["part"]["revisionId"], connector["model"]["glbKey"]),
                         (placed_revision, first["glb"]["key"]))
        self.assertEqual(len(connector["geometry"]["pads"]), 10, "the placed revision's footprint")
        current = str(self.service.get_component(part)["current_revision_id"])
        self.assertEqual(connector["part"]["currentRevisionId"], current)
        moved = self.service.system_items.set_module_connector(component_id, "A", part, dict(TOP, quarterTurns=2),
                                                               actor="author@example.com")
        connector = moved["units"][0]["connector"]
        self.assertEqual((connector["part"]["revisionId"], connector["model"]["glbKey"], connector["placement"]["quarterTurns"]),
                         (placed_revision, first["glb"]["key"], 2), "a move keeps the recorded revision")
        updated = self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com",
                                                                 update_part_revision=True)
        connector = updated["units"][0]["connector"]
        self.assertEqual((connector["part"]["revisionId"], connector["model"]["glbKey"]), (current, head["glb"]["key"]))
        other = self.connector_part()
        self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com")
        swapped = self.service.system_items.set_module_connector(component_id, "A", other, TOP, actor="author@example.com")
        self.assertEqual(swapped["units"][0]["connector"]["part"]["revisionId"],
                         str(self.service.get_component(other)["current_revision_id"]), "another part takes its current one")

    def test_migration_10_records_each_placement_s_current_part_revision(self) -> None:
        from app.services import catalog_schema_migrations as migrations

        component_id = self.modelled_module()
        part = self.connector_part()
        self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com")
        with self.service.connection() as conn:
            step = conn.execute("SELECT name FROM catalog_schema_versions WHERE version = 10").fetchone()
            self.assertEqual(step["name"], "module_connector_part_revision")
            conn.execute("UPDATE catalog_module_connectors SET part_revision_id = NULL WHERE component_id = %s",
                         (component_id,))
            migrations._module_connector_part_revision(conn)  # re-runnable: a placement from before step 10
            row = conn.execute("SELECT part_revision_id FROM catalog_module_connectors WHERE component_id = %s",
                               (component_id,)).fetchone()
            conn.commit()
        self.assertEqual(row["part_revision_id"], str(self.service.get_component(part)["current_revision_id"]))

    def test_artifact_maintenance_keeps_the_step_of_a_placed_part_revision(self) -> None:
        """A connector placement pins its part revision's draft STEP like a system does (§3.6)."""
        from unittest.mock import patch

        from app.services import catalog_worker_tasks

        component_id = self.modelled_module()
        part = self.connector_part()
        self.attach(part, "3dmodel", "scratch.step", f"ISO-10303-21;/* {uuid.uuid4().hex} */END-ISO-10303-21;".encode())
        [scratch] = [a for a in self.service.get_component(part)["assets"] if a["asset_type"] == "3dmodel"]
        with self.service.connection() as conn:
            path = Path(str(conn.execute("SELECT canonical_path FROM assets WHERE id = %s",
                                         (scratch["id"],)).fetchone()["canonical_path"]))
        self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com")
        self.attach(part, "3dmodel", "next.step", f"ISO-10303-21;/* {uuid.uuid4().hex} */END-ISO-10303-21;".encode())
        head = self.service.get_component(part)
        self.service.detach_asset_by_id(part, str(scratch["id"]), expected_revision_id=head["revision_id"],
                                        actor="author@example.com")

        def purge() -> list[str]:
            with patch.object(catalog_worker_tasks, "catalog_service", self.service):
                return catalog_worker_tasks.purge_superseded_step_files()["asset_ids"]

        self.assertNotIn(str(scratch["id"]), purge())
        self.assertTrue(path.is_file(), "the STEP of the part revision a connector placement records was purged")
        self.service.system_items.remove_module_connector(component_id, "A", actor="author@example.com")
        self.assertIn(str(scratch["id"]), purge())

    def test_a_connector_s_recorded_draft_step_is_never_quarantined(self) -> None:
        """Issue #698 (D1): connector part revisions protect a draft STEP from quarantine, and a
        quarantined STEP a connector comes to record again is restored when its grace period ends."""
        from unittest.mock import patch

        from app.services import catalog_worker_tasks

        component_id = self.modelled_module()
        part = self.connector_part()
        self.attach(part, "3dmodel", "scratch.step", f"ISO-10303-21;/* {uuid.uuid4().hex} */END-ISO-10303-21;".encode())
        scratch_revision = str(self.service.get_component(part)["revision_id"])
        [scratch] = [a for a in self.service.get_component(part)["assets"] if a["asset_type"] == "3dmodel"]
        with self.service.connection() as conn:
            path = Path(str(conn.execute("SELECT canonical_path FROM assets WHERE id = %s",
                                         (scratch["id"],)).fetchone()["canonical_path"]))
        self.attach(part, "3dmodel", "next.step", f"ISO-10303-21;/* {uuid.uuid4().hex} */END-ISO-10303-21;".encode())
        head = self.service.get_component(part)
        self.service.detach_asset_by_id(part, str(scratch["id"]), expected_revision_id=head["revision_id"],
                                        actor="author@example.com")

        def purge(grace_days: int = 30) -> dict:
            with (
                patch.object(catalog_worker_tasks, "catalog_service", self.service),
                patch("app.core.config.settings.CATALOG_DRAFT_MODEL_QUARANTINE_DAYS", grace_days),
            ):
                return catalog_worker_tasks.purge_superseded_step_files()

        def record_scratch_revision() -> None:
            self.service.system_items.set_module_connector(component_id, "A", part, TOP, actor="author@example.com")
            with self.service.connection() as conn:
                conn.execute("UPDATE catalog_module_connectors SET part_revision_id = %s WHERE component_id = %s",
                             (scratch_revision, component_id))
                conn.commit()

        record_scratch_revision()
        for grace_days in (30, 0):
            self.assertNotIn(str(scratch["id"]), purge(grace_days)["asset_ids"])
            self.assertTrue(path.is_file(), "a connector's recorded draft STEP was quarantined")

        self.service.system_items.remove_module_connector(component_id, "A", actor="author@example.com")
        self.assertIn(str(scratch["id"]), purge()["asset_ids"])
        self.assertFalse(path.exists())
        record_scratch_revision()
        expired = purge(0)["expired"]
        self.assertEqual(expired["restored_asset_ids"], [str(scratch["id"])])
        self.assertTrue(path.is_file(), "a quarantined STEP a connector records again was deleted")

    def test_connectors_list_the_units_of_a_pinned_module_revision(self) -> None:
        component_id = self.modelled_module()
        pinned = str(self.service.get_component(component_id)["current_revision_id"])
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym",
                    module_symbol().replace('(number "9"', '(number "10"').encode())
        pads = lambda listed: [u["pads"] for u in listed["units"]]
        self.assertEqual(pads(self.service.system_items.module_connectors(component_id))[1], ["7", "8", "10"])
        self.assertEqual(pads(self.service.system_items.module_connectors(component_id, pinned))[1], ["7", "8", "9"])
        with self.assertRaisesRegex(LookupError, "revision not found"):
            self.service.system_items.module_connectors(component_id, "no-such-revision")

    def test_a_new_symbol_replaces_the_module_s_symbol(self) -> None:
        """A module has one symbol, its interface: a re-import replaces it rather than adding a second
        (otherwise the interface came from either one, by asset ID order)."""
        component_id = self.modelled_module()
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym", module_symbol().replace('"RX_P"', '"RX_PLUS"').encode())
        component = self.service.get_component(component_id)
        symbols = [a for a in component["assets"] if a["asset_type"] == "symbol"]
        self.assertEqual(len(symbols), 1)
        self.assertEqual(component["interface"]["units"][0]["pins"][2]["signal"], "RX_PLUS")

    def test_bad_connector_placements_are_refused(self) -> None:
        component_id = self.modelled_module()
        part = self.connector_part()
        with self.assertRaisesRegex(LookupError, "no unit C"):
            self.service.system_items.set_module_connector(component_id, "C", part, TOP)
        with self.assertRaisesRegex(ValueError, "no footprint"):
            self.service.system_items.set_module_connector(component_id, "A", self.connector_part(footprint=False), TOP)
        with self.assertRaisesRegex(ValueError, "only parts"):
            self.service.system_items.set_module_connector(component_id, "A", self.module(), TOP)
        with self.assertRaisesRegex(ValueError, "non-zero"):
            self.service.system_items.set_module_connector(component_id, "A", part, dict(TOP, normal=[0, 0, 0]))
        with self.assertRaisesRegex(ValueError, "only modules"):
            self.service.system_items.set_module_connector(part, "A", part, TOP)

    def test_a_released_module_s_model_never_ships_in_the_dbl(self) -> None:
        """Modules are not KiCad library parts: their STEP stays out of the DBL bundle (CONTRACTS_P2 §3.1)."""
        component_id = self.module()
        self.attach(component_id, "symbol", "TEST_IMU.kicad_sym", module_symbol().encode())
        # Unique bytes, so no part released by another test can ship the same content path.
        step = STEP.read_bytes() + f"\n/* {component_id} */\n".encode()
        self.attach(component_id, "3dmodel", STEP.name, step)
        self.place_all(component_id)
        self.release(component_id)

        exported = self.service.export_kicad_dbl_bundle()
        sha_prefix = hashlib.sha256(step).hexdigest()[:16]
        self.assertFalse((Path(exported["export_root"]) / "3DModels" / sha_prefix).exists())
        self.assertEqual([m for m in exported["missing_models"] if m["component_id"] == component_id], [])

    def test_parts_stay_parts(self) -> None:
        part = self.service.create_manual_component(
            value="conn", description="c", datasheet="https://example.com/c.pdf", manufacturer="Test",
            manufacturer_part_number=f"MD-{uuid.uuid4().hex[:8]}", actor="author@example.com")
        self.created.append(str(part["id"]))
        self.assertEqual(self.service.get_component(str(part["id"])).get("interface") or {}, {})
        with self.assertRaises(ValueError):
            self.service.create_manual_component(kind="assembly", value="x", description="d", datasheet="https://x",
                                                 manufacturer="m", manufacturer_part_number="X", actor="a")


if __name__ == "__main__":
    unittest.main()
