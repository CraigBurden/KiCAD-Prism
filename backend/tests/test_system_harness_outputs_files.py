"""The harness output files (docs/system-builder/CONTRACTS.md §16.7).

CSV columns and rows, formula escaping, ``prism.harness.v1``, and the rendered
sheets: sizes, continuation, determinism and the no-route case.
"""

from __future__ import annotations

import csv
import io
import re
import unittest

import yaml

from app.system_builder.harness_outputs import files
from support.harness_outputs_fixture import many_wires, model, unrouted


def csv_rows(data: bytes) -> list[list[str]]:
    return list(csv.reader(io.StringIO(data.decode("utf-8"))))


class HarnessFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = model()

    def cell(self, row: list[str], column: str) -> str:
        return row[files.WIRING_COLUMNS.index(column)]

    def test_wiring_csv_has_the_contract_columns_and_one_row_per_wire(self) -> None:
        rows = csv_rows(files.wiring_csv(self.model))
        self.assertEqual(tuple(rows[0]), files.WIRING_COLUMNS)
        self.assertEqual(len(rows), 1 + len(self.model.wires))

        first = rows[1]
        self.assertEqual(self.cell(first, "wire"), "W1")
        self.assertEqual(self.cell(first, "from_end"), "J1 · Controller")
        self.assertEqual(self.cell(first, "from_cavity"), "1")
        self.assertEqual(self.cell(first, "from_signal"), "VBAT")
        self.assertEqual(self.cell(first, "to_end"), "J1 · Sensor")
        self.assertEqual(self.cell(first, "to_signal"), "SECRET")
        self.assertEqual(self.cell(first, "net"), "VBAT")
        self.assertEqual(self.cell(first, "length_mm"), "45.0")
        self.assertEqual(self.cell(first, "length_typed"), "true")
        self.assertEqual(self.cell(first, "colour_code"), "RD")
        self.assertEqual((self.cell(first, "cable"), self.cell(first, "conductor")), ("cab_1", "1"))

        self.assertEqual(self.cell(rows[2], "length_mm"), "30.0")
        self.assertEqual(self.cell(rows[2], "length_typed"), "false")

    def test_a_splice_or_loose_end_terminal_names_it_with_no_cavity_or_signal(self) -> None:
        rows = csv_rows(files.wiring_csv(self.model))
        splice, loose = rows[3], rows[4]
        self.assertEqual(
            (self.cell(splice, "to_end"), self.cell(splice, "to_cavity"), self.cell(splice, "to_signal")),
            ("SP1", "", ""),
        )
        self.assertEqual(
            (self.cell(loose, "to_end"), self.cell(loose, "to_cavity"), self.cell(loose, "to_signal")),
            ("LE1", "", ""),
        )
        self.assertEqual(self.cell(splice, "length_mm"), "")

    def test_formula_like_cells_are_prefixed_but_numbers_are_not(self) -> None:
        rows = csv_rows(files.wiring_csv(self.model))
        self.assertEqual([self.cell(row, "label") for row in rows[1:]], ["PWR", "-12", "'=EVIL()", "'@LED"])
        self.assertNotIn("'PWR", files.wiring_csv(self.model).decode("utf-8"))

    def test_bom_csv_has_the_contract_columns_and_the_grouped_rows(self) -> None:
        rows = csv_rows(files.bom_csv(self.model))
        self.assertEqual(tuple(rows[0]), files.BOM_COLUMNS)
        self.assertEqual(rows[1][0], "1")
        self.assertEqual(rows[1][1], "Housing")
        self.assertIn("not in the catalog", [row[2] for row in rows])

    def test_yaml_is_prism_harness_v1_in_the_contract_key_order(self) -> None:
        text = files.harness_yaml(self.model).decode("utf-8")
        data = yaml.safe_load(text)
        keys = [line.split(":", 1)[0] for line in text.splitlines() if re.match(r"^[A-Za-z]", line)]
        self.assertEqual(
            keys,
            [
                "schema", "system", "harness", "ends", "nodes", "wires",
                "cables", "segments", "coverings", "nodeNames", "bom",
            ],
        )
        self.assertEqual(data["schema"], "prism.harness.v1")
        self.assertEqual(
            data["system"], {"name": "Demo rig", "version": 3, "bundleKey": "a" * 64}
        )
        self.assertEqual(data["harness"], {"id": "har_h", "label": "H1", "routed": True})

    def test_yaml_wires_carry_terminals_colours_and_millimetre_lengths(self) -> None:
        data = yaml.safe_load(files.harness_yaml(self.model))
        first = data["wires"][0]
        self.assertEqual(first["number"], "W1")
        self.assertEqual(first["from"], {"kind": "contact", "node": "end_a", "cavity": "1"})
        self.assertEqual(first["to"], {"kind": "contact", "node": "end_b", "cavity": "1"})
        self.assertEqual(first["colourCodes"], ["RD"])
        self.assertEqual((first["lengthMm"], first["lengthTyped"]), (45.0, True))
        self.assertEqual(data["wires"][2]["to"], {"kind": "splice", "node": "sp_1"})
        self.assertIsNone(data["wires"][3]["lengthMm"])

    def test_yaml_parts_are_null_when_the_catalog_cannot_resolve_them(self) -> None:
        data = yaml.safe_load(files.harness_yaml(self.model))
        housing = data["ends"][0]["housing"]
        self.assertEqual(
            housing,
            {
                "reference": "cmp_housing@rev_h",
                "mpn": "H-4",
                "name": "Housing 4-way",
                "manufacturer": "Demo Components",
                "description": "4-way housing",
            },
        )
        self.assertIsNone(data["ends"][0]["cavities"][2]["contact"])
        self.assertEqual(data["nodes"][0]["name"], "SP1")
        self.assertEqual(data["cables"][0]["conductors"][1], {"name": "drain", "wire": "", "drain": True})
        self.assertEqual(data["nodeNames"]["bp_1"], "B1")

    def test_yaml_segments_carry_the_route_in_millimetres(self) -> None:
        data = yaml.safe_load(files.harness_yaml(self.model))
        self.assertEqual(len(data["segments"]), 3)
        first = data["segments"][0]
        self.assertEqual((first["from"], first["to"]), ("end_a", "bp_1"))
        self.assertEqual((first["lengthMm"], first["diameterMm"]), (120.0, 3.0))
        self.assertEqual(first["coverings"], ["heat-shrink"])
        self.assertEqual(data["bom"][0]["kind"], "Housing")

    def test_sheets_are_a_drawing_and_tables_all_on_a3(self) -> None:
        pages = files.sheets(self.model)
        self.assertGreaterEqual(len(pages), 2)
        self.assertTrue(all(page.size == "A3" for page in pages))

    def test_the_wiring_table_continues_onto_more_sheets_for_many_wires(self) -> None:
        pages = files.sheets(many_wires(120))
        self.assertGreater(len(pages), 2)

    def test_the_pdf_renders_the_same_bytes_twice(self) -> None:
        first = files.render(self.model, "harness.pdf")
        second = files.render(self.model, "harness.pdf")
        self.assertIsNotNone(first)
        assert first is not None and second is not None
        self.assertTrue(first.startswith(b"%PDF"))
        self.assertEqual(first, second)

    def test_every_sheet_has_an_svg_and_the_drawing_names_every_wire(self) -> None:
        pages = files.sheets(self.model)
        for index in range(1, len(pages) + 1):
            self.assertIsNotNone(files.render(self.model, f"sheet-{index}.svg"))
        drawing = files.render(self.model, "sheet-1.svg")
        assert drawing is not None
        for wire in self.model.wires:
            self.assertIn(wire.number, drawing.decode("utf-8"))

    def test_an_unknown_name_or_a_sheet_out_of_range_renders_nothing(self) -> None:
        self.assertIsNone(files.render(self.model, "harness.txt"))
        self.assertIsNone(files.render(self.model, "sheet-0.svg"))
        self.assertIsNone(files.render(self.model, f"sheet-{len(files.sheets(self.model)) + 1}.svg"))

    def test_content_types_and_file_entries_cover_the_table(self) -> None:
        self.assertEqual(files.content_type("harness.pdf"), "application/pdf")
        self.assertEqual(files.content_type("sheet-2.svg"), "image/svg+xml")
        self.assertEqual(files.content_type("wiring.csv"), "text/csv")
        self.assertEqual(files.content_type("bom.csv"), "text/csv")
        self.assertEqual(files.content_type("harness.yaml"), "application/yaml")
        self.assertEqual(files.content_type("harness.txt"), "")
        self.assertEqual(
            [entry["name"] for entry in files.file_entries(2)],
            ["harness.pdf", "sheet-1.svg", "sheet-2.svg", "wiring.csv", "bom.csv", "harness.yaml"],
        )

    def test_the_download_name_is_slugged(self) -> None:
        self.assertEqual(
            files.filename("Demo rig", "H1 / Main", "wiring.csv"),
            "demo-rig-h1-main-wiring.csv",
        )

    def test_a_harness_with_no_route_draws_and_has_no_segments(self) -> None:
        plain = unrouted()
        self.assertIsNotNone(files.render(plain, "sheet-1.svg"))
        data = yaml.safe_load(files.harness_yaml(plain))
        self.assertEqual(data["segments"], [])
        self.assertFalse(data["harness"]["routed"])


if __name__ == "__main__":
    unittest.main()
