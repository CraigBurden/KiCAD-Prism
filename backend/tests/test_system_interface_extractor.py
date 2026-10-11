"""SYS-02: the interface extractor against the SYS-01 fixture boards.

Every assertion is checked against an independent source: KiCad 10.0.6's own
netlist evidence, the fixture system baselines, or the contract rules
(``docs/system-builder/CONTRACTS.md`` §2–§4).
"""

from __future__ import annotations

import json
import tempfile
import unittest
import xml.etree.ElementTree as ET
from functools import lru_cache
from pathlib import Path
from types import SimpleNamespace

from system_builder_fixtures import (
    EVIDENCE,
    build_fixture_repo,
    fixture_system,
    manifest,
    snapshot_dir,
)

from app.services.systems import connector_detection
from app.services.systems.interface_extractor import (
    SCHEMA,
    connected_interface_digest,
    extract_for_revision,
    extract_interface,
)
from support.repo import commit_all, git  # noqa: E402


@lru_cache(maxsize=None)
def extract(snapshot_id: str) -> dict:
    board, snapshot = snapshot_id.split("/")
    return extract_interface(
        snapshot_dir(board, snapshot) / f"{board}.kicad_pro",
        project_id=f"prj_{board}",
        commit=None,
    )


def component(payload: dict, reference: str) -> dict:
    return next(c for c in payload["components"] if c["reference"] == reference)


def pads(payload: dict, reference: str) -> dict[str, dict]:
    return {pin["pad"]: pin for pin in component(payload, reference)["pins"]}


def native_netlist(snapshot_id: str) -> tuple[dict, dict]:
    root = ET.parse(EVIDENCE / snapshot_id / "netlist.xml").getroot()
    nets: dict[tuple[str, str], set[str]] = {}
    for net in root.iter("net"):
        for node in net.iter("node"):
            nets.setdefault((node.get("ref"), node.get("pin")), set()).add(net.get("name"))
    comps = {}
    for comp in root.iter("comp"):
        lib = comp.find("libsource")
        comps[comp.get("ref")] = {
            "libId": f"{lib.get('lib')}:{lib.get('part')}",
            "footprint": comp.findtext("footprint") or "",
            "uuids": sorted(u for t in comp.findall("tstamps") for u in (t.text or "").split()),
            "sheet": comp.find("sheetpath").get("tstamps"),
        }
    return nets, comps


class NativeAgreementTest(unittest.TestCase):
    """For every snapshot, the artifact agrees with KiCad's own netlist."""

    def test_every_snapshot_matches_native_netlist(self) -> None:
        for snapshot_id in manifest()["snapshots"]:
            with self.subTest(snapshot=snapshot_id):
                payload = extract(snapshot_id)
                self.assertEqual(payload["schema"], SCHEMA)
                nets, comps = native_netlist(snapshot_id)
                self.assertEqual({c["reference"] for c in payload["components"]}, set(comps))
                for item in payload["components"]:
                    native = comps[item["reference"]]
                    self.assertEqual(item["libId"], native["libId"])
                    self.assertEqual(item["footprint"], native["footprint"])
                    # memberKeys are KIID paths: /<root>/<netlist sheet path>/<uuid>.
                    self.assertEqual(
                        sorted(key.rsplit("/", 1)[1] for key in item["memberKeys"]),
                        native["uuids"],
                    )
                    for key in item["memberKeys"]:
                        uuid = key.rsplit("/", 1)[1]
                        self.assertTrue(key.endswith(native["sheet"] + uuid), key)
                    for pin in item["pins"]:
                        expected = sorted(
                            n for n in nets[(item["reference"], pin["pad"])]
                            if not n.startswith("unconnected-(")
                        )
                        self.assertEqual(pin["nets"], expected, (item["reference"], pin["pad"]))

    def test_linked_port_identity_matches_fixture_system(self) -> None:
        system = fixture_system()
        for link in system["links"]:
            for side in ("a", "b"):
                end = link[side]
                board = system["instances"][end["instance"]]["board"]
                item = component(extract(f"{board}/F0"), end["reference"])
                self.assertEqual(item["portKey"], end["portKey"], link["id"])
                self.assertEqual(item["memberKeys"], end["memberKeys"], link["id"])
                self.assertEqual(item["libId"], end["libId"], link["id"])
                self.assertEqual(len(item["pins"]), end["pinCount"], link["id"])


class ContractAssumptionTest(unittest.TestCase):
    """The two assumptions SYS-00 left to SYS-02."""

    def test_lib_id_is_read_natively(self) -> None:
        self.assertEqual(component(extract("mini_power/F0"), "J3")["libId"], "MiniSys:Conn_Split_2x2")
        self.assertEqual(
            component(extract("mini_obc/F4"), "J7")["libId"], "Connector_Generic:Conn_02x12_Odd_Even"
        )

    def test_schematic_net_is_not_overwritten_by_the_board(self) -> None:
        pin = pads(extract("mini_obc/F8"), "J7")["18"]
        self.assertEqual(pin["nets"], ["PAYLOAD_INT#"])
        self.assertEqual(pin["pcbNets"], ["PAYLOAD_IRQ#"])


class IdentityTest(unittest.TestCase):
    def test_repeated_sheets_give_distinct_keys_for_one_symbol(self) -> None:
        payload = extract("mini_payload/F0")
        j11, j12 = component(payload, "J11"), component(payload, "J12")
        self.assertNotEqual(j11["portKey"], j12["portKey"])
        self.assertEqual(j11["portKey"].rsplit("/", 1)[1], j12["portKey"].rsplit("/", 1)[1])

    def test_multi_unit_port_key_is_the_lowest_unit(self) -> None:
        j3 = component(extract("mini_power/F0"), "J3")
        self.assertEqual(len(j3["memberKeys"]), 2)
        self.assertEqual([p["pad"] for p in j3["pins"]], ["1", "2", "3", "4"])
        after = component(extract("mini_power/F10"), "J3")
        self.assertEqual(len(after["memberKeys"]), 1)
        self.assertNotEqual(after["portKey"], j3["portKey"])
        self.assertIn(after["portKey"], j3["memberKeys"])  # §2.3: resolves by intersection
        self.assertEqual([p["pad"] for p in after["pins"]], ["3", "4"])

    def test_reannotation_keeps_the_key_and_replacement_changes_it(self) -> None:
        base = component(extract("mini_obc/F0"), "J2")["portKey"]
        self.assertEqual(component(extract("mini_obc/F2"), "J12")["portKey"], base)
        j7 = component(extract("mini_obc/F0"), "J7")["portKey"]
        self.assertNotEqual(component(extract("mini_obc/F3"), "J7")["portKey"], j7)

    def test_sheet_rename_keeps_keys(self) -> None:
        self.assertEqual(
            component(extract("mini_obc/F0"), "J7")["portKey"],
            component(extract("mini_obc/F5"), "J7")["portKey"],
        )


class NetTest(unittest.TestCase):
    def test_unconnected_pins_have_no_net(self) -> None:
        self.assertEqual(pads(extract("mini_obc/F0"), "J7")["20"]["nets"], [])
        self.assertEqual(pads(extract("mini_obc/F1"), "J7")["17"]["nets"], [])

    def test_pin_names_and_types_are_best_effort_display(self) -> None:
        pin = pads(extract("mini_obc/F0"), "J7")["17"]
        self.assertEqual(pin["pinNames"], ["Pin_17"])
        self.assertEqual(pin["pinTypes"], ["passive"])

    def test_board_less_project_has_null_pcb_nets(self) -> None:
        payload = extract("mini_payload/F0")
        self.assertFalse(payload["hasPcb"])
        self.assertTrue(all(p["pcbNets"] is None for c in payload["components"] for p in c["pins"]))

    def test_synchronized_board_matches_schematic(self) -> None:
        payload = extract("mini_obc/F0")
        self.assertTrue(payload["hasPcb"])
        for item in payload["components"]:
            for pin in item["pins"]:
                self.assertEqual(pin["pcbNets"], pin["nets"], (item["reference"], pin["pad"]))


class DetectionTest(unittest.TestCase):
    EXPECTED = {
        "mini_obc/F0": {
            "J2": (True, "refdes"), "J5": (True, "refdes"), "J6": (True, "refdes"),
            "J7": (True, "refdes"), "JP1": (False, "none"), "R10": (False, "none"),
        },
        "mini_payload/F0": {
            "J4": (True, "refdes"), "TP1": (True, "field"), "J9": (False, "field"),
            "J11": (True, "refdes"), "J12": (True, "refdes"),
        },
        "mini_power/F0": {"J1": (True, "refdes"), "J3": (True, "refdes"), "J8": (True, "refdes")},
    }

    def test_fixture_classification(self) -> None:
        for snapshot_id, expected in self.EXPECTED.items():
            payload = extract(snapshot_id)
            got = {
                c["reference"]: (c["candidate"], c["candidateReason"]) for c in payload["components"]
            }
            self.assertEqual(got, expected, snapshot_id)

    def test_dnp_comes_from_the_default_assembly(self) -> None:
        payload = extract("mini_power/F0")
        self.assertTrue(component(payload, "J8")["dnp"])
        self.assertFalse(component(payload, "J1")["dnp"])

    def test_rule_order(self) -> None:
        classify = connector_detection.classify
        self.assertEqual(classify("U1", "MCU:X", "", {"System": "Connector"}), (True, "field"))
        self.assertEqual(classify("J1", "Connector:Y", "", {"Prism_Port": "No"}), (False, "field"))
        self.assertEqual(classify("U2", "Mine:Z", "", {"prism port": "PORT"}), (True, "field"))
        self.assertEqual(classify("J3", "Mine:Z", "", {}), (True, "refdes"))
        # v1.10: only J. X is usually an oscillator; P and CN need a Connector library.
        self.assertEqual(classify("X1", "Oscillator:ASE", "", {}), (False, "none"))
        self.assertEqual(classify("CN3", "Mine:Z", "", {}), (False, "none"))
        self.assertEqual(classify("P2", "Connector_Generic:Conn_01x04", "", {}), (True, "library"))
        self.assertEqual(classify("JP1", "Jumper:J", "", {}), (False, "none"))
        self.assertEqual(classify("PS1", "Power:P", "", {}), (False, "none"))
        self.assertEqual(classify("U4", "Connector_Audio:J", "", {}), (True, "library"))
        self.assertEqual(classify("U5", "Mine:Z", "connector_custom:FP", {}), (True, "library"))
        self.assertEqual(classify("U6", "Mine:Z", "", {"Prism_Port": "maybe"}), (False, "none"))
        # v1.9: KiCad's test points live in the Connector library but are not ports,
        # unless a field says so.
        self.assertEqual(classify("TP1", "Connector:TestPoint", "TestPoint:TestPoint_Pad_D1.0mm", {}),
                         (False, "none"))
        self.assertEqual(classify("TP2", "Connector:TestPoint_2Pole", "Connector_Custom:TP", {}),
                         (False, "none"))
        self.assertEqual(classify("TP3", "Connector:TestPoint", "", {"Prism_Port": "yes"}), (True, "field"))


class DigestTest(unittest.TestCase):
    def test_docs_only_commit_keeps_the_digest(self) -> None:
        self.assertEqual(extract("mini_obc/F0")["digest"], extract("mini_obc/F6")["digest"])

    def test_interface_changes_change_the_digest(self) -> None:
        base = extract("mini_obc/F0")["digest"]
        for step in ("F1", "F2", "F3", "F4", "F5", "F7", "F8", "F9"):
            self.assertNotEqual(extract(f"mini_obc/{step}")["digest"], base, step)

    def test_digest_ignores_identity_and_provenance(self) -> None:
        path = snapshot_dir("mini_power", "F0") / "mini_power.kicad_pro"
        one = extract_interface(path, project_id="prj_a", commit="a" * 40)
        two = extract_interface(path, project_id="prj_b", commit="b" * 40)
        self.assertEqual(one["digest"], two["digest"])

    def test_connected_interface_digest(self) -> None:
        link = next(l for l in fixture_system()["links"] if l["id"] == "L-J7J4")
        connected = [row["pinA"] for row in link["rows"]]

        def end_digest(snapshot_id: str) -> str:
            item = component(extract(snapshot_id), "J7")
            by_pad = {p["pad"]: p["nets"] for p in item["pins"]}
            return connected_interface_digest(
                item["libId"], item["footprint"], {pad: by_pad[pad] for pad in connected}
            )

        stored = connected_interface_digest(
            link["a"]["libId"], link["a"]["footprint"],
            {row["pinA"]: row["netA"] for row in link["rows"]},
        )
        self.assertEqual(end_digest("mini_obc/F0"), stored)
        self.assertEqual(end_digest("mini_obc/F7"), stored)  # pin 19 is not connected
        self.assertEqual(end_digest("mini_obc/F3"), stored)  # re-placed, same facts
        self.assertNotEqual(end_digest("mini_obc/F1"), stored)
        self.assertNotEqual(end_digest("mini_obc/F4"), stored)


class RevisionTest(unittest.TestCase):
    def test_extracts_an_exact_commit_from_git(self) -> None:
        with tempfile.TemporaryDirectory() as scratch:
            repo = Path(scratch) / "mini_obc"
            commits = build_fixture_repo("mini_obc", repo)
            project = SimpleNamespace(id="prj_obc", path=str(repo), project_file="mini_obc.kicad_pro")
            at_f1 = extract_for_revision(project, commits["F1"])
            at_f0 = extract_for_revision(project, commits["F0"])
        self.assertEqual(at_f1["commit"], commits["F1"])
        self.assertEqual(pads(at_f1, "J7")["17"]["nets"], [])
        self.assertEqual(pads(at_f0, "J7")["17"]["nets"], ["PAYLOAD_RESET#"])
        self.assertEqual(at_f0["digest"], extract("mini_obc/F0")["digest"])

    def test_reads_the_sources_the_commit_configures(self) -> None:
        """A ``.prism.json`` naming differently named sources is honoured at that commit."""

        with tempfile.TemporaryDirectory() as scratch:
            repo = Path(scratch) / "mini_obc"
            commits = build_fixture_repo("mini_obc", repo)
            git(repo, "checkout", "-q", commits["F0"])
            git(repo, "mv", "mini_obc.kicad_sch", "main.kicad_sch")
            git(repo, "mv", "mini_obc.kicad_pcb", "board.kicad_pcb")
            (repo / ".prism.json").write_text(json.dumps({"schematic": "main.kicad_sch", "pcb": "board.kicad_pcb"}))
            renamed = commit_all(repo, "configured sources")
            project = SimpleNamespace(id="prj_obc", path=str(repo), project_file="mini_obc.kicad_pro")
            configured = extract_for_revision(project, renamed)
        baseline = extract("mini_obc/F0")
        self.assertTrue(configured["hasPcb"])
        self.assertEqual(configured["components"], baseline["components"])


if __name__ == "__main__":
    unittest.main()
