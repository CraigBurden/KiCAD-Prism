"""The ICD output files (docs/system-builder/CONTRACTS.md §17).

The sheets (summary first, then continuations), the PDF's determinism, the
self-contained HTML, and the CSV's columns and formula escaping.
"""

from __future__ import annotations

import csv
import io
import unittest

from app.release_studio.documents.layout import Text
from app.system_builder.icd import files
from support import icd_fixture as fixture


def csv_rows(data: bytes) -> list[list[str]]:
    return list(csv.reader(io.StringIO(data.decode("utf-8"))))


class IcdFileTests(unittest.TestCase):
    def setUp(self) -> None:
        self.model = fixture.model()

    def test_the_summary_comes_first_and_every_sheet_is_a3(self) -> None:
        pages = files.sheets(self.model)
        self.assertEqual(len(pages), 1)  # a small ICD's tables flow on under the summary
        self.assertEqual(pages[0].key, "icd-summary")
        self.assertEqual(pages[0].title, f"{fixture.SYSTEM} · Interface control document")
        self.assertTrue(all(page.size == "A3" for page in pages))
        summary = " ".join(element.value for element in pages[0].elements if isinstance(element, Text))
        self.assertIn("3 occurrences", summary)
        self.assertIn("1 interfaces · 6 connections · 2 system nets", summary)
        self.assertIn("2 single-board nets not listed", summary)

    def test_three_hundred_connections_continue_onto_more_sheets(self) -> None:
        pages = files.sheets(fixture.many_connections(300))
        self.assertGreater(len(pages), 2)
        self.assertTrue(all(page.size == "A3" for page in pages))
        continued = any(
            isinstance(element, Text) and "CONTINUED" in element.value
            for page in pages
            for element in page.elements
        )
        self.assertTrue(continued)

    def test_the_pdf_renders_the_same_bytes_twice(self) -> None:
        first = files.render(self.model, "icd.pdf")
        second = files.render(self.model, "icd.pdf")
        self.assertIsNotNone(first)
        assert first is not None and second is not None
        self.assertTrue(first.startswith(b"%PDF"))
        self.assertEqual(first, second)

    def test_html_is_one_page_with_every_section_and_no_scripts_or_requests(self) -> None:
        page = files.render(self.model, "icd.html")
        assert page is not None
        text = page.decode("utf-8")
        for anchor in ("summary", "occurrences", "interfaces", "connections", "system-nets"):
            self.assertIn(f'id="{anchor}"', text)
            self.assertIn(f'href="#{anchor}"', text)
        self.assertNotIn("<script", text.lower())
        self.assertNotIn("http", text.lower())
        self.assertIn('<style>', text)
        self.assertIn("Main interface — J1 · Alpha", text)
        self.assertIn("J1 · Alpha ↔ J1 · Beta", text)
        self.assertEqual(page, files.render(self.model, "icd.html"))

    def test_the_csv_has_the_contract_columns_one_row_per_connection_and_escaped_cells(self) -> None:
        rows = csv_rows(files.icd_csv(self.model))
        self.assertEqual(tuple(rows[0]), files.ICD_COLUMNS)
        self.assertEqual(len(rows), 1 + len(self.model.connections))
        details = [row[files.ICD_COLUMNS.index("detail")] for row in rows[1:]]
        self.assertIn("'=ALERT()", details)
        loose = next(row for row in rows[1:] if row[files.ICD_COLUMNS.index("note")] == "open end (pigtail)")
        self.assertEqual(loose[files.ICD_COLUMNS.index("b_occurrence")], "LE1")
        self.assertEqual(loose[files.ICD_COLUMNS.index("b_pin_name")], "pigtail")

    def test_every_sheet_has_an_svg_and_unknown_names_render_nothing(self) -> None:
        pages = files.sheets(self.model)
        for index in range(1, len(pages) + 1):
            self.assertIsNotNone(files.render(self.model, f"sheet-{index}.svg"))
        self.assertIsNone(files.render(self.model, "icd.txt"))
        self.assertIsNone(files.render(self.model, "sheet-0.svg"))
        self.assertIsNone(files.render(self.model, f"sheet-{len(pages) + 1}.svg"))

    def test_content_types_entries_and_download_names_cover_the_table(self) -> None:
        self.assertEqual(files.content_type("icd.pdf"), "application/pdf")
        self.assertEqual(files.content_type("icd.html"), "text/html")
        self.assertEqual(files.content_type("icd.csv"), "text/csv")
        self.assertEqual(files.content_type("sheet-2.svg"), "image/svg+xml")
        self.assertEqual(files.content_type("icd.txt"), "")
        self.assertEqual(
            [entry["name"] for entry in files.file_entries(2)],
            ["icd.pdf", "sheet-1.svg", "sheet-2.svg", "icd.html", "icd.csv"],
        )
        self.assertEqual(files.filename("Fixture rig", "icd.pdf"), "fixture-rig-icd.pdf")
        self.assertEqual(files.filename("Fixture rig", "sheet-2.svg"), "fixture-rig-icd-sheet-2.svg")


if __name__ == "__main__":
    unittest.main()
