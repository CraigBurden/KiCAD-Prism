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
            {row["Reference"]: row["DNP"] for row in rows},
            {row["Reference"]: project[row["Reference"]]["DNP"] for row in rows},
        )
        # The project BOM's column names and field mapping (aliases folded).
        # Description is the one column with another source: the project BOM
        # falls back to the library symbol's description, which the comparison
        # parser does not read (it keeps the placed symbol's own property).
        for row in rows:
            fields = project[row["Reference"]]
            for name in (*semantic_index_service.REQUIRED_BOM_FIELDS, "In BOM"):
                if name == "Description":
                    continue
                self.assertEqual(row[name], fields[name], (row["Reference"], name))
            self.assertFalse([key for key in row if key.startswith("kicad_")])
        # The fixture exercises both flags, not a vacuous agreement.
        self.assertNotIn("R7", {row["Reference"] for row in rows})
        self.assertEqual(
            sorted(row["Reference"] for row in rows if row["DNP"] == "Yes"),
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
            {c["reference"]: c["fields"]["DNP"] for c in components},
            {"R1": "Yes", "R2": "No"},
        )
        self.assertEqual(
            {c["schematicRefs"][0]["sheetInstancePath"] for c in components},
            {"/root/outer/inner", "/root/other"},
        )


class ComparisonFieldTests(unittest.TestCase):
    """The comparison BOM uses the project BOM's field mapping (decision D23)."""

    def _component(self, **flags):
        side = {
            "componentObjects": [
                {
                    "uuid": "sym",
                    "kind": "symbol",
                    "refdes": "U1",
                    "properties": [
                        {"name": "Value", "value": "LDO"},
                        {"name": "Footprint", "value": "SOT-23"},
                        {"name": "MPN", "value": "AP2112K"},
                        {"name": "MFR", "value": "Diodes"},
                        {"name": "Supplier", "value": "Mouser"},
                    ],
                    **flags,
                },
            ]
        }
        [component] = occurrences.revision_components(side)
        return component

    def test_aliases_fold_into_the_project_bom_columns(self) -> None:
        fields = self._component()["fields"]
        self.assertEqual(fields["Manufacturer Part Number"], "AP2112K")
        self.assertEqual(fields["Manufacturer"], "Diodes")
        self.assertEqual(fields["Vendor"], "Mouser")
        self.assertEqual(fields["Value"], "LDO")
        self.assertEqual(fields["Footprint"], "SOT-23")
        self.assertEqual((fields["DNP"], fields["In BOM"]), ("No", "Yes"))
        self.assertFalse([key for key in fields if key.startswith("kicad_")])

    def test_flags_become_yes_no_columns_and_drive_bom_membership(self) -> None:
        dnp = self._component(dnp=True)
        self.assertEqual(dnp["fields"]["DNP"], "Yes")
        excluded = self._component(inBom=False)
        self.assertEqual(excluded["fields"]["In BOM"], "No")
        self.assertEqual(occurrences.bom_rows([excluded]), [])
        [row] = occurrences.bom_rows([dnp])
        self.assertEqual((row["DNP"], row["In BOM"]), ("Yes", "Yes"))


if __name__ == "__main__":
    unittest.main()
