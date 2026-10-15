"""Embedded 3D models survive KiCad and come back out of a board (issue #698, D2).

The kicad-cli round trip loads a placed footprint, and a board holding it, and
saves both again: KiCad verifies every embedded file's checksum on load and
drops a file that fails it, so the saved data proves KiCad accepted the bytes.
It is skipped when kicad-cli is not installed. Project harvest then reads the
model back out of the saved board, as re-importing a placed board does.
"""

from __future__ import annotations

import hashlib
import importlib.util
import contextlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.config import settings  # noqa: E402
from app.services.catalog.kicad_embedded_files import decode_embedded_files, embedded_model_name  # noqa: E402
from app.services.catalog.placement_payloads import rewrite_footprint_payload  # noqa: E402
from app.services.kicad_tools import kicad_cli  # noqa: E402
from app.services.project_component_asset_extractor import build_project_asset_index  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
CLI = kicad_cli()

MODEL = b"ISO-10303-21;\nHEADER;\nround trip\nDATA;\n" + b"#1=CARTESIAN_POINT('',(0.,0.,0.));\n" * 400 + b"END-ISO-10303-21;\n"
LIBRARY_FOOTPRINT = (
    '(footprint "R_0402"\n'
    "\t(version 20241229)\n"
    '\t(generator "test")\n'
    '\t(layer "F.Cu")\n'
    '\t(property "Reference" "R1" (at 0 0 0) (layer "F.SilkS"))\n'
    '\t(pad "1" smd rect (at 0 0) (size 1 1) (layers "F.Cu"))\n'
    '\t(model "${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0402.step"\n'
    "\t\t(offset\n\t\t\t(xyz 0 0 0)\n\t\t)\n\t)\n"
    ")\n"
).encode("utf-8")
NAME = embedded_model_name("R_0402.step", MODEL)


def placed_footprint() -> str:
    with (
        patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
        patch.object(settings, "REMOTE_PROVIDER_DESTINATION_DIR", "${KIPRJMOD}/RemoteLibrary"),
    ):
        return rewrite_footprint_payload(
            LIBRARY_FOOTPRINT, {}, [{"canonical_path": "/store/3dmodels/Lib/R_0402.step"}], lambda _asset: MODEL
        ).decode("utf-8")


def board_with(footprint: str) -> str:
    """A minimal board holding ``footprint`` as placed, its embedded data still inside it."""
    placed = footprint.replace('(footprint "R_0402"', '(footprint "remote_lib:R_0402"\n\t(at 10 10)', 1)
    body = "\t" + placed.rstrip("\n").replace("\n", "\n\t")
    return (
        "(kicad_pcb\n\t(version 20241229)\n\t(generator \"test\")\n\t(general (thickness 1.6))\n"
        '\t(paper "A4")\n\t(layers\n\t\t(0 "F.Cu" signal)\n\t\t(2 "B.Cu" signal)\n'
        '\t\t(37 "F.SilkS" user "F.Silkscreen")\n\t)\n'
        f"{body}\n)\n"
    )


@unittest.skipUnless(CLI.available(), "kicad-cli is not installed")
class KicadCliRoundTripTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def _run(self, *args: str) -> str:
        result = CLI.run(list(args), timeout=120)
        output = result.stdout + result.stderr
        self.assertEqual(result.returncode, 0, output)
        self.assertNotIn("Checksum error", output)
        return output

    def test_kicad_keeps_a_placed_footprints_embedded_model(self) -> None:
        library = self.root / "remote_lib.pretty"
        library.mkdir()
        (library / "R_0402.kicad_mod").write_text(placed_footprint(), encoding="utf-8")

        self._run("fp", "upgrade", "--force", str(library), "-o", str(self.root / "saved.pretty"))

        saved = (self.root / "saved.pretty" / "R_0402.kicad_mod").read_text(encoding="utf-8")
        self.assertIn(f'(model "kicad-embed://{NAME}"', saved)
        self.assertEqual(decode_embedded_files(saved)[NAME]["data"], MODEL)

    def test_a_saved_board_pins_the_model_and_harvest_reads_it_back(self) -> None:
        project = self.root / "project"
        project.mkdir()
        board = project / "board.kicad_pcb"
        board.write_text(board_with(placed_footprint()), encoding="utf-8")

        self._run("pcb", "upgrade", "--force", str(board))

        text = board.read_text(encoding="utf-8")
        self.assertIn(f'(model "kicad-embed://{NAME}"', text)
        self.assertEqual(decode_embedded_files(text)[NAME]["data"], MODEL, "the board lost the model data")
        index = build_project_asset_index(project, staging_dir=self.root / "staging")
        assets, findings, _resolved = index.extract_component_assets(
            {"reference": "R1", "footprint": "remote_lib:R_0402", "pcbRefs": []}
        )
        self.assertEqual([finding["code"] for finding in findings], ["symbol_not_resolved"])
        [model] = [asset for asset in assets if asset["asset_type"] == "3dmodel"]
        self.assertEqual(model["filename"], "R_0402.step")
        self.assertEqual(model["sha256"], hashlib.sha256(MODEL).hexdigest())
        self.assertEqual(Path(model["staged_path"]).read_bytes(), MODEL)


class HarvestEmbeddedModelTests(unittest.TestCase):
    """Harvest without kicad-cli: a board as KiCad writes it, data at board level."""

    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.project = self.root / "project"
        self.project.mkdir()

    def _harvest(self, board_text: str) -> tuple[list[dict], list[dict]]:
        (self.project / "board.kicad_pcb").write_text(board_text, encoding="utf-8")
        index = build_project_asset_index(self.project, staging_dir=self.root / "staging")
        assets, findings, _resolved = index.extract_component_assets(
            {"reference": "R1", "footprint": "remote_lib:R_0402", "pcbRefs": []}
        )
        return assets, findings

    def test_board_level_embedded_data_becomes_a_model_asset(self) -> None:
        footprint = placed_footprint()
        start = footprint.index("\t(embedded_files")
        block = footprint[start:footprint.rindex(")")]
        # KiCad keeps the file names in the footprint and moves the data to the board.
        stub = f'\t(embedded_files\n\t\t(file\n\t\t\t(name "{NAME}")\n\t\t\t(type model)\n\t\t)\n\t)\n'
        board = board_with(footprint[:start] + stub + ")\n").rstrip().removesuffix(")") + block + ")\n"

        assets, findings = self._harvest(board)

        self.assertNotIn("model_not_resolved", [finding["code"] for finding in findings])
        [model] = [asset for asset in assets if asset["asset_type"] == "3dmodel"]
        self.assertEqual((model["filename"], model["sha256"]), ("R_0402.step", hashlib.sha256(MODEL).hexdigest()))
        [footprint_asset] = [asset for asset in assets if asset["asset_type"] == "footprint"]
        staged = Path(footprint_asset["staged_path"]).read_text(encoding="utf-8")
        self.assertIn('(model "R_0402.step"', staged)
        self.assertNotIn("embedded_files", staged)

    def test_footprint_level_data_is_read_too(self) -> None:
        assets, _findings = self._harvest(board_with(placed_footprint()))
        self.assertEqual([asset["sha256"] for asset in assets if asset["asset_type"] == "3dmodel"],
                         [hashlib.sha256(MODEL).hexdigest()])

    def test_an_embedded_reference_without_data_is_reported(self) -> None:
        footprint = placed_footprint()
        start = footprint.index("\t(embedded_files")
        assets, findings = self._harvest(board_with(footprint[:start] + ")\n"))
        self.assertIn("model_not_resolved", [finding["code"] for finding in findings])
        self.assertEqual([asset for asset in assets if asset["asset_type"] == "3dmodel"], [])


def load_report_script():
    spec = importlib.util.spec_from_file_location(
        "prism_report_unpinned_board_models_under_test", REPO_ROOT / "scripts" / "report_unpinned_board_models.py"
    )
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class UnpinnedBoardReportTests(unittest.TestCase):
    def test_report_lists_provider_models_the_board_does_not_pin(self) -> None:
        report_script = load_report_script()
        with tempfile.TemporaryDirectory() as tmp:
            project = Path(tmp) / "project"
            (project / "RemoteLibrary" / "remote_3d").mkdir(parents=True)
            (project / "RemoteLibrary" / "remote_3d" / "R_0402.step").write_bytes(MODEL)
            unpinned = LIBRARY_FOOTPRINT.decode().replace(
                "${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0402.step",
                "${KIPRJMOD}/RemoteLibrary/remote_3d/R_0402.step",
            )
            (project / "old.kicad_pcb").write_text(board_with(unpinned), encoding="utf-8")
            (project / "new.kicad_pcb").write_text(board_with(placed_footprint()), encoding="utf-8")
            (project / "stock.kicad_pcb").write_text(board_with(LIBRARY_FOOTPRINT.decode()), encoding="utf-8")
            output = io.StringIO()
            with (
                patch.object(settings, "REMOTE_PROVIDER_LIBRARY_PREFIX", "remote"),
                contextlib.redirect_stdout(output),
            ):
                code = report_script.main([str(project), "--database-url", ""])

        self.assertEqual(code, 0)
        report = json.loads(output.getvalue())
        self.assertEqual(report["summary"]["boards"], 3)
        self.assertEqual(report["summary"]["unpinned_models"], 1)
        self.assertEqual(report["summary"]["embedded_models"], 1)
        [board] = report["boards"]
        self.assertTrue(board["board"].endswith("old.kicad_pcb"))
        [item] = board["unpinned"]
        self.assertEqual((item["reference"], item["present"], item["sha256"]),
                         ("R1", True, hashlib.sha256(MODEL).hexdigest()))


if __name__ == "__main__":
    unittest.main()
