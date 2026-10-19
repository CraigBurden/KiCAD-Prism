"""Board-level sub-ports: records, history, refusals and project removal (§10)."""

from __future__ import annotations

import unittest
from unittest import mock

from app.core.config import settings
from app.services.design_bundle import schemas
from app.services.workspace_schema_migrations import WORKSPACE_LEDGER
from app.services.workspace_service import WorkspaceService
from app.system_builder.board_sub_ports import (
    BoardSubPortDeleted,
    BoardSubPortExists,
    BoardSubPortInvalid,
    BoardSubPortNameTaken,
    BoardSubPortNotFound,
    BoardSubPortStore,
    StaleBoardSubPort,
    build_input,
)
from support.postgres import (
    requires_scratch_postgres,
    scratch_schema,
    seed_project,
    seed_repository,
)

PROJECT = "prj_0a1b2c3d4e5f"
OTHER_PROJECT = "prj_2b3c4d5e6f70"
ACTOR = "designer@example.com"


def endpoints_document(*named: tuple[str, int]) -> dict:
    """A document whose export sites and link sides name board-level sub-ports in turn."""

    document: dict = {"exports": [], "harnesses": []}
    for index, (sub_port_id, version) in enumerate(named):
        endpoint = {
            "occurrence": "occ",
            "connector": "J1",
            "subPort": {"kind": "board", "id": sub_port_id, "version": version},
        }
        if index % 2:
            document["harnesses"].append({"links": [{"a": endpoint, "b": endpoint}]})
        else:
            document["exports"].append({"site": endpoint})
    return document


@requires_scratch_postgres("Board sub-port store tests")
class BoardSubPortStoreTest(unittest.TestCase):
    def setUp(self) -> None:
        scratch = scratch_schema(self, "bspstore", ledgers=(WORKSPACE_LEDGER,))
        self.conn = scratch.conn
        self.connect = scratch.connection
        self.store = BoardSubPortStore(scratch.connection)

    def create(
        self, sub_port_id: str = "bsp_can", *, connector: str = "J1", name: str = "CAN",
        pins: list[str] | None = None, project_id: str = PROJECT,
        actor: str = ACTOR,
    ) -> dict:
        return self.store.create(
            project_id, sub_port_id, connector, name,
            ["1", "2"] if pins is None else pins, actor=actor,
        )

    def test_create_read_list_filter_and_deleted_flag(self) -> None:
        created = self.create()
        self.assertEqual(
            (created["sub_port_id"], created["project_id"], created["connector"]),
            ("bsp_can", PROJECT, "J1"),
        )
        self.assertEqual((created["name"], created["pins"], created["version"]), ("CAN", ["1", "2"], 1))
        self.assertEqual((created["created_by"], created["updated_by"]), (ACTOR, ACTOR))
        self.assertIsNone(created["deleted_at"])
        self.assertIsNone(created["deleted_by"])

        self.create("bsp_power", name="Power")
        self.create("bsp_data", connector="J2", name="Data")
        self.create("bsp_old", name="Old")
        self.store.delete(PROJECT, "bsp_old", expected_version=1, actor="deleter@example.com")

        listed = self.store.list(PROJECT)
        self.assertEqual(
            [(row["connector"], row["name"]) for row in listed],
            [("J1", "CAN"), ("J1", "Power"), ("J2", "Data")],
        )
        self.assertEqual(
            [row["sub_port_id"] for row in self.store.list(PROJECT, connector="J1")],
            ["bsp_can", "bsp_power"],
        )
        self.assertEqual(self.store.list(PROJECT, connector="J9"), [])

        with_deleted = self.store.list(PROJECT, deleted=True)
        self.assertEqual(
            [row["sub_port_id"] for row in with_deleted],
            ["bsp_can", "bsp_old", "bsp_power", "bsp_data"],
        )
        old = next(row for row in with_deleted if row["sub_port_id"] == "bsp_old")
        self.assertIsNotNone(old["deleted_at"])
        self.assertEqual((old["deleted_by"], old["version"]), ("deleter@example.com", 2))

        # A deleted record stays readable; another project's id is not.
        self.assertEqual(self.store.read(PROJECT, "bsp_old"), old)
        self.assertIsNone(self.store.read(OTHER_PROJECT, "bsp_can"))

    def test_history_is_newest_first_and_records_every_action(self) -> None:
        self.create(pins=["1", "2"])
        updated = self.store.update(
            PROJECT, "bsp_can", name="CAN bus", pins=["2", "1"],
            expected_version=1, actor="editor@example.com",
        )
        self.assertEqual((updated["version"], updated["name"], updated["pins"]), (2, "CAN bus", ["2", "1"]))
        deleted = self.store.delete(
            PROJECT, "bsp_can", expected_version=2, actor="deleter@example.com",
        )
        self.assertEqual((deleted["version"], deleted["pins"]), (3, ["2", "1"]))

        history = self.store.history(PROJECT, "bsp_can")
        assert history is not None
        self.assertEqual([row["version"] for row in history], [3, 2, 1])
        self.assertEqual([row["action"] for row in history], ["delete", "update", "create"])
        self.assertEqual(
            (history[0]["name"], history[0]["pins"], history[0]["actor"]),
            ("CAN bus", ["2", "1"], "deleter@example.com"),
        )
        self.assertEqual(
            (history[1]["name"], history[1]["pins"], history[1]["actor"]),
            ("CAN bus", ["2", "1"], "editor@example.com"),
        )
        self.assertEqual(
            (history[2]["name"], history[2]["pins"], history[2]["actor"]),
            ("CAN", ["1", "2"], ACTOR),
        )
        self.assertIsNone(self.store.history(OTHER_PROJECT, "bsp_can"))
        self.assertIsNone(self.store.history(PROJECT, "bsp_missing"))

    def test_every_write_bumps_the_version(self) -> None:
        self.create()
        first = self.store.update(
            PROJECT, "bsp_can", name="CAN", pins=["1", "2", "3"],
            expected_version=1, actor=ACTOR,
        )
        self.assertEqual(first["version"], 2)
        second = self.store.update(
            PROJECT, "bsp_can", name="CAN", pins=["3", "2", "1"],
            expected_version=2, actor=ACTOR,
        )
        self.assertEqual(second["version"], 3)
        third = self.store.delete(PROJECT, "bsp_can", expected_version=3, actor=ACTOR)
        self.assertEqual(third["version"], 4)
        self.assertEqual([row["version"] for row in self.store.history(PROJECT, "bsp_can")], [4, 3, 2, 1])

    def test_invalid_input_is_422(self) -> None:
        for sub_port_id in ("", "Bsp", "1bsp", "bsp space", "bsp." + "x" * 60):
            with self.subTest(sub_port_id=sub_port_id):
                with self.assertRaises(BoardSubPortInvalid):
                    self.create(sub_port_id)
        for connector in ("", "x" * 65):
            with self.subTest(connector=connector):
                with self.assertRaises(BoardSubPortInvalid):
                    self.create(connector=connector)
        for name in ("", "x" * 65):
            with self.subTest(name=name):
                with self.assertRaises(BoardSubPortInvalid):
                    self.create(name=name)
        for pins in ([], ["1", "1"], [""], [1], ["1", None]):
            with self.subTest(pins=pins):
                with self.assertRaises(BoardSubPortInvalid):
                    self.create(pins=pins)

    def test_an_id_is_never_reused_but_a_deleted_name_is(self) -> None:
        first = self.create(name="CAN")
        with self.assertRaises(BoardSubPortExists):
            self.create("bsp_can", name="Other")

        self.store.delete(PROJECT, first["sub_port_id"], expected_version=1, actor=ACTOR)
        with self.assertRaises(BoardSubPortExists):
            self.create("bsp_can", name="Other")

        # The deleted holder frees its name for a new, differently identified sub-port.
        replaced = self.create("bsp_can_2", name="CAN")
        self.assertEqual((replaced["name"], replaced["version"]), ("CAN", 1))

    def test_a_live_name_is_unique_per_project_and_connector(self) -> None:
        self.create("bsp_a", connector="J1", name="CAN")
        with self.assertRaises(BoardSubPortNameTaken):
            self.create("bsp_b", connector="J1", name="CAN")

        # Another connector or project may use the same name.
        self.create("bsp_c", connector="J2", name="CAN")
        self.create("bsp_d", connector="J1", name="CAN", project_id=OTHER_PROJECT)

        # An update that collides is refused too, and the row keeps its old name.
        self.create("bsp_e", connector="J1", name="Power")
        with self.assertRaises(BoardSubPortNameTaken):
            self.store.update(
                PROJECT, "bsp_e", name="CAN", pins=["1"], expected_version=1, actor=ACTOR,
            )
        unchanged = self.store.read(PROJECT, "bsp_e")
        assert unchanged is not None
        self.assertEqual((unchanged["name"], unchanged["version"]), ("Power", 1))

    def test_deleted_sub_ports_cannot_be_changed_or_deleted(self) -> None:
        self.create()
        self.store.delete(PROJECT, "bsp_can", expected_version=1, actor=ACTOR)
        with self.assertRaises(BoardSubPortDeleted):
            self.store.update(
                PROJECT, "bsp_can", name="CAN", pins=["1"], expected_version=2, actor=ACTOR,
            )
        with self.assertRaises(BoardSubPortDeleted):
            self.store.delete(PROJECT, "bsp_can", expected_version=2, actor=ACTOR)

    def test_unknown_ids_are_not_found(self) -> None:
        with self.assertRaises(BoardSubPortNotFound):
            self.store.update(
                PROJECT, "bsp_missing", name="CAN", pins=["1"], expected_version=1, actor=ACTOR,
            )
        with self.assertRaises(BoardSubPortNotFound):
            self.store.delete(PROJECT, "bsp_missing", expected_version=1, actor=ACTOR)

    def test_a_stale_version_is_refused_with_the_current_etag(self) -> None:
        self.create()
        with self.assertRaises(StaleBoardSubPort) as caught:
            self.store.update(
                PROJECT, "bsp_can", name="CAN", pins=["1"], expected_version=2, actor=ACTOR,
            )
        self.assertEqual(caught.exception.headers, {"ETag": '"board-sub-port:bsp_can:1"'})

        with self.assertRaises(StaleBoardSubPort) as caught:
            self.store.delete(PROJECT, "bsp_can", expected_version=2, actor=ACTOR)
        self.assertEqual(caught.exception.headers, {"ETag": '"board-sub-port:bsp_can:1"'})
        self.assertEqual(self.store.read(PROJECT, "bsp_can")["version"], 1)

    def test_limits_are_read_from_settings(self) -> None:
        with mock.patch.object(settings, "PRISM_BOARD_SUB_PORT_MAX_PINS", 2):
            with self.assertRaises(BoardSubPortInvalid):
                self.create(pins=["1", "2", "3"])
            two = self.create("bsp_two", pins=["1", "2"], project_id=OTHER_PROJECT)
            self.assertEqual(two["pins"], ["1", "2"])

        with mock.patch.object(settings, "PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT", 2):
            self.create("bsp_a", name="A")
            self.create("bsp_b", name="B")
            with self.assertRaises(BoardSubPortInvalid):
                self.create("bsp_c", name="C")
            # The limit is per project, so another project is unaffected.
            self.create("bsp_d", name="D", project_id=OTHER_PROJECT)
            # A deleted row no longer counts.
            self.store.delete(PROJECT, "bsp_a", expected_version=1, actor=ACTOR)
            self.create("bsp_e", name="E")

    def test_soft_delete_project_marks_every_live_sub_port(self) -> None:
        self.create("bsp_a", name="A")
        self.create("bsp_b", connector="J2", name="B")
        self.create("bsp_c", name="C", project_id=OTHER_PROJECT)

        self.assertEqual(self.store.soft_delete_project(PROJECT, "system"), 2)
        self.assertEqual(self.store.list(PROJECT), [])
        deleted = self.store.list(PROJECT, deleted=True)
        self.assertEqual([row["sub_port_id"] for row in deleted], ["bsp_a", "bsp_b"])
        for row in deleted:
            self.assertEqual((row["version"], row["deleted_by"]), (2, "system"))
            history = self.store.history(PROJECT, row["sub_port_id"])
            assert history is not None
            self.assertEqual((history[0]["version"], history[0]["action"]), (2, "delete"))

        untouched = self.store.read(OTHER_PROJECT, "bsp_c")
        assert untouched is not None
        self.assertEqual((untouched["version"], untouched["deleted_at"]), (1, None))

    def test_project_deletion_soft_deletes_its_sub_ports_in_the_same_transaction(self) -> None:
        seed_repository(self.conn, "repo_bsp")
        seed_project(self.conn, PROJECT, "repo_bsp")
        self.conn.commit()
        self.create("bsp_a", name="A")
        self.create("bsp_b", name="B")
        self.create("bsp_c", name="C", project_id=OTHER_PROJECT)

        service = WorkspaceService()
        service._connect = self.connect  # type: ignore[method-assign]
        self.assertTrue(service.delete_project(PROJECT))

        self.assertEqual(self.store.list(PROJECT), [])
        rows = self.store.list(PROJECT, deleted=True)
        self.assertEqual([row["sub_port_id"] for row in rows], ["bsp_a", "bsp_b"])
        for row in rows:
            self.assertEqual((row["version"], row["deleted_by"]), (2, "system"))
        self.assertIsNotNone(self.store.read(OTHER_PROJECT, "bsp_c"))

    def test_build_input_collects_named_sub_ports_and_their_named_versions(self) -> None:
        self.create("bsp_b", connector="J2", name="CAN", pins=["3", "4"])
        self.store.update(
            PROJECT, "bsp_b", name="CAN", pins=["4", "3", "5"],
            expected_version=1, actor=ACTOR,
        )
        self.store.update(
            PROJECT, "bsp_b", name="CAN bus", pins=["4", "3"],
            expected_version=2, actor=ACTOR,
        )
        self.create("bsp_a", connector="J1", name="Old", pins=["1", "2"])
        self.store.delete(PROJECT, "bsp_a", expected_version=1, actor=ACTOR)
        self.create("bsp_unnamed", name="Spare")

        # bsp_b is named at two older versions and at the current one; bsp_missing has no row at all.
        result = build_input(
            self.conn,
            endpoints_document(
                ("bsp_b", 1), ("bsp_b", 2), ("bsp_b", 3), ("bsp_a", 1), ("bsp_a", 2), ("bsp_missing", 1),
            ),
        )
        schemas.validate(result, "prism.board_sub_ports.a0")
        self.assertEqual(result["schema"], "prism.board_sub_ports.a0")
        self.assertEqual([item["id"] for item in result["subPorts"]], ["bsp_a", "bsp_b"])

        deleted = result["subPorts"][0]
        self.assertEqual(
            (deleted["projectId"], deleted["connector"], deleted["name"],
             deleted["pins"], deleted["version"], deleted["deleted"]),
            (PROJECT, "J1", "Old", ["1", "2"], 2, True),
        )
        self.assertEqual(deleted["previous"], [{"version": 1, "pins": ["1", "2"]}])

        live = result["subPorts"][1]
        self.assertEqual(
            (live["connector"], live["name"], live["pins"], live["version"], live["deleted"]),
            ("J2", "CAN bus", ["4", "3"], 3, False),
        )
        self.assertEqual(
            live["previous"],
            [{"version": 1, "pins": ["3", "4"]}, {"version": 2, "pins": ["4", "3", "5"]}],
        )

    def test_build_input_leaves_out_a_named_version_with_no_history_row(self) -> None:
        self.create("bsp_c", pins=["1"])
        self.store.update(
            PROJECT, "bsp_c", name="CAN", pins=["1", "2"], expected_version=1, actor=ACTOR,
        )
        self.store.update(
            PROJECT, "bsp_c", name="CAN", pins=["1", "2", "3"], expected_version=2, actor=ACTOR,
        )
        self.conn.execute(
            "DELETE FROM ws_board_sub_port_history WHERE sub_port_id = %s AND version = %s",
            ("bsp_c", 2),
        )
        self.conn.commit()

        result = build_input(self.conn, endpoints_document(("bsp_c", 1), ("bsp_c", 2)))
        self.assertEqual(
            result["subPorts"][0]["previous"],
            [{"version": 1, "pins": ["1"]}],
        )

    def test_build_input_with_no_named_sub_ports_is_empty(self) -> None:
        self.create("bsp_c")
        result = build_input(self.conn, {"exports": [], "harnesses": []})
        self.assertEqual(result, {"schema": "prism.board_sub_ports.a0", "subPorts": []})

    def test_migration_127_creates_both_tables_and_the_live_name_index(self) -> None:
        tables = {
            str(row["table_name"])
            for row in self.conn.execute(
                "SELECT table_name FROM information_schema.tables"
                " WHERE table_schema = current_schema()"
                " AND table_name IN ('ws_board_sub_ports', 'ws_board_sub_port_history')"
            ).fetchall()
        }
        self.assertEqual(tables, {"ws_board_sub_ports", "ws_board_sub_port_history"})

        index = self.conn.execute(
            """
            SELECT index_class.relname AS index_name,
                   pg_index.indisunique AS is_unique,
                   pg_index.indpred IS NOT NULL AS is_partial,
                   pg_get_indexdef(pg_index.indexrelid) AS definition
              FROM pg_index
              JOIN pg_class AS table_class ON table_class.oid = pg_index.indrelid
              JOIN pg_class AS index_class ON index_class.oid = pg_index.indexrelid
              JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
             WHERE namespace.nspname = current_schema()
               AND table_class.relname = 'ws_board_sub_ports'
               AND index_class.relname = 'uq_ws_board_sub_ports_live_name'
            """
        ).fetchone()
        self.assertIsNotNone(index)
        assert index is not None
        self.assertTrue(index["is_unique"])
        self.assertTrue(index["is_partial"])
        self.assertIn("(project_id, connector, name)", index["definition"])
        self.assertIn("deleted_at IS NULL", index["definition"])

        project_index = self.conn.execute(
            """
            SELECT index_class.relname AS index_name
              FROM pg_index
              JOIN pg_class AS table_class ON table_class.oid = pg_index.indrelid
              JOIN pg_class AS index_class ON index_class.oid = pg_index.indexrelid
              JOIN pg_namespace AS namespace ON namespace.oid = table_class.relnamespace
             WHERE namespace.nspname = current_schema()
               AND table_class.relname = 'ws_board_sub_ports'
               AND index_class.relname = 'idx_ws_board_sub_ports_project_connector'
            """
        ).fetchone()
        self.assertIsNotNone(project_index)


if __name__ == "__main__":
    unittest.main()
