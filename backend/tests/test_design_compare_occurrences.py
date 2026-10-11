"""Component occurrences: the comparison BOM agrees with the project BOM."""

import shutil
import tempfile
import unittest
from unittest import mock
from pathlib import Path

from app.services import design_compare_occurrences as occurrences
from app.services import design_compare_service, semantic_index_service

FIXTURE = Path(__file__).parent / "fixtures" / "design_variants" / "oracle_rev2"
TOP = "variants_oracle.kicad_sch"
WIRELESS_SHEET = "c33f383d-e37a-5ee0-b3d2-b1d64b3f8476"
CH_A_SHEET = "2b37a7b5-50d3-5e47-8b5a-0eb89cbfd3a1"


def _set_sheet_attribute(text: str, sheet_uuid: str, old: str, new: str) -> str:
    """Rewrite one attribute of one sheet symbol, leaving its variant records."""

    anchor = text.index(f'(uuid "{sheet_uuid}")')
    start = text.rindex("(sheet\n", 0, anchor)
    head = text[start:anchor]
    assert old in head, f"{old} not on sheet {sheet_uuid}"
    return text[:start] + head.replace(old, new, 1) + text[anchor:]


def _sheet_flagged_snapshot(root: Path) -> Path:
    """KiCad 10 oracle with the Wireless sheet DNP and CH_A out of the BOM.

    CH_A and CH_B are two instances of one ``channel.kicad_sch``, so the BOM
    flag must follow the occurrence path, not the file.
    """

    snapshot = root / "snapshot"
    shutil.copytree(FIXTURE, snapshot)
    top = snapshot / TOP
    text = top.read_text(encoding="utf-8")
    text = _set_sheet_attribute(text, WIRELESS_SHEET, "(dnp no)", "(dnp yes)")
    text = _set_sheet_attribute(text, CH_A_SHEET, "(in_bom yes)", "(in_bom no)")
    top.write_text(text, encoding="utf-8")
    return snapshot


@unittest.skipUnless(shutil.which("node"), "node runs the comparison parser")
class SheetLevelAssemblyStateTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temp = tempfile.TemporaryDirectory()
        self.snapshot = _sheet_flagged_snapshot(Path(self._temp.name))

    def tearDown(self) -> None:
        self._temp.cleanup()

    def test_comparison_bom_matches_project_bom_under_flagged_sheets(self) -> None:
        index = semantic_index_service.build_semantic_index(
            self.snapshot / "variants_oracle.kicad_pro",
            source_revision_key="fixture",
            include_pcb=False,
        )
        project = {
            component["reference"]: component["fields"]
            for component in index["components"]
        }
        delta = design_compare_service._ecad_object_delta(self.snapshot, self.snapshot)
        rows = occurrences.bom_rows(
            occurrences.revision_components(delta["head"])
        )

        # One row per unit of a multi-unit part; the BOM diff keys by designator.
        self.assertEqual(
            sorted({row["Reference"] for row in rows}),
            sorted(ref for ref, fields in project.items() if fields["In BOM"] == "Yes"),
        )
        self.assertEqual(
            {row["Reference"]: row["kicad_dnp"] == "true" for row in rows},
            {
                row["Reference"]: project[row["Reference"]]["DNP"] == "Yes"
                for row in rows
            },
        )
        # The fixture exercises both flags, not a vacuous agreement.
        self.assertNotIn("R7", {row["Reference"] for row in rows})
        self.assertEqual(
            sorted(row["Reference"] for row in rows if row["kicad_dnp"] == "true"),
            ["R12", "R2", "R6", "U2"],
        )


class SheetFlagScanTests(unittest.TestCase):
    def test_variant_records_are_not_the_sheet_default(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            snapshot = Path(temp) / "snapshot"
            shutil.copytree(FIXTURE, snapshot)
            # The unmodified oracle's sheets carry DNP and BOM records only
            # inside per-variant instances.
            self.assertEqual(occurrences.sheet_flags(snapshot), {})

    def test_an_occurrence_takes_every_ancestor_sheet_flag(self) -> None:
        side = {
            "root": ".",
            "componentObjects": [
                {
                    "uuid": "sym",
                    "kind": "symbol",
                    "documentPath": "leaf.kicad_sch",
                    "refdes": "R1",
                    "instances": [
                        {"reference": "R1", "path": "/root/outer/inner/sym"},
                        {"reference": "R2", "path": "/root/other/sym"},
                    ],
                },
            ]
        }
        sheets = {"outer": {"dnp": True, "excludeFromBom": False}}
        with mock.patch.object(occurrences, "sheet_flags", return_value=sheets):
            components = occurrences.revision_components(side)
        self.assertEqual(
            {c["reference"]: c["fields"]["kicad_dnp"] for c in components},
            {"R1": "true", "R2": "false"},
        )
        self.assertEqual(
            {c["schematicRefs"][0]["sheetInstancePath"] for c in components},
            {"/root/outer/inner", "/root/other"},
        )


if __name__ == "__main__":
    unittest.main()
