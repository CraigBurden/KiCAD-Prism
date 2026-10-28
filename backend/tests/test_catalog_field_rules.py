"""Catalog field rules and the frontend contract generated from them."""

import json
import subprocess
import sys
import unittest
from pathlib import Path

from app.services.catalog.field_rules import (
    CONTEXT_BULK,
    blocking_import_findings,
    custom_field_errors,
    custom_import_problems,
    field_error,
    field_rules_contract,
    field_verdict,
    import_metadata_problems,
    is_field_required,
    missing_metadata_findings,
)
from app.services.catalog.metadata_descriptors import BUILTIN_METADATA_DESCRIPTORS

REPO_ROOT = Path(__file__).resolve().parents[2]
EXPORT_SCRIPT = REPO_ROOT / "scripts" / "export_catalog_field_rules.py"
GENERATED_MODULE = REPO_ROOT / "frontend" / "src" / "lib" / "catalog-field-rules.generated.ts"
# One hand-written table, also run by frontend/src/lib/catalog-field-rules.test.ts.
CASES = json.loads(
    (REPO_ROOT / "frontend" / "src" / "lib" / "catalog-field-rules.cases.json").read_text(encoding="utf-8")
)


class FieldRulesCaseTableTests(unittest.TestCase):
    def test_field_verdicts(self) -> None:
        for case in CASES["fields"]:
            with self.subTest(case=case):
                self.assertEqual(
                    field_verdict(
                        case["field"],
                        case["value"],
                        context=case["context"],
                        identity_kind=case["identity"],
                    ),
                    case["verdict"],
                )

    def test_import_metadata_problems(self) -> None:
        for case in CASES["imports"]:
            with self.subTest(case=case):
                self.assertEqual(import_metadata_problems(case["values"]), case["problems"])

    def test_custom_import_problems(self) -> None:
        for case in CASES["customImports"]:
            with self.subTest(case=case):
                self.assertEqual(
                    custom_import_problems(case["fields"], {"extra_fields": case["extra_fields"]}),
                    case["problems"],
                )

    def test_blocking_import_findings(self) -> None:
        for case in CASES["findings"]:
            with self.subTest(case=case):
                blocking = blocking_import_findings(case["findings"], case["linked"])
                self.assertEqual([finding["code"] for finding in blocking], case["blocking"])


class FieldRulesTests(unittest.TestCase):
    def test_builtin_requirements_come_from_descriptors_not_the_row_flag(self) -> None:
        for descriptor in BUILTIN_METADATA_DESCRIPTORS:
            for row_flag in (True, False):
                with self.subTest(key=descriptor.key, row_flag=row_flag):
                    field = {"key": descriptor.key, "type": descriptor.field_type, "required": row_flag}
                    self.assertEqual(is_field_required(field, identity_kind="mpn"), descriptor.required)
        self.assertTrue(is_field_required({"key": "custom", "required": True}, identity_kind="provisional_ipn"))

    def test_custom_required_fields_are_checked_for_presence_only(self) -> None:
        fields = [
            {"key": "approval", "label": "Approval", "storage_kind": "extra", "storage_key": "Approval", "required": True},
            {"key": "lot", "label": "Lot", "type": "number", "storage_kind": "extra", "storage_key": "lot", "required": True},
            {"key": "old", "label": "Old", "storage_kind": "extra", "storage_key": "old", "required": True, "archived": True},
            {"key": "note", "label": "Note", "storage_kind": "extra", "storage_key": "note"},
            {"key": "value", "label": "Value", "storage_kind": "column", "storage_key": "value", "built_in": True},
        ]
        metadata = {"value": "", "extra_fields": {"Approval": "  ", "lot": "not a number"}}
        self.assertEqual(custom_field_errors(fields, metadata), ["Approval: Required"])
        self.assertEqual(custom_import_problems(fields, metadata), ["Approval is required"])
        self.assertEqual(custom_field_errors(fields, {"extra_fields": {"Approval": "ok", "lot": "1"}}), [])

    def test_messages_and_unknown_context(self) -> None:
        self.assertEqual(field_error({"key": "value"}, "", context=CONTEXT_BULK), "Required")
        self.assertEqual(field_error({"key": "x", "type": "url"}, "x", context=CONTEXT_BULK), "Enter a valid HTTP(S) URL")
        with self.assertRaisesRegex(ValueError, "Unknown field-rules context"):
            field_verdict({"key": "value"}, "x", context="grid")

    def test_scan_findings_name_only_missing_required_metadata(self) -> None:
        findings = missing_metadata_findings(
            {
                "value": "10k",
                "manufacturer": "Yageo",
                "manufacturer_part_number": "",
                "description": "Resistor",
                "datasheet": "not a url",
            }
        )
        self.assertEqual(
            findings,
            [
                {
                    "code": "missing_metadata_manufacturer_part_number",
                    "severity": "error",
                    "message": "Required component metadata is missing: manufacturer part number.",
                }
            ],
        )


class FieldRulesContractTests(unittest.TestCase):
    def test_generated_module_matches_the_rules(self) -> None:
        result = subprocess.run(
            [sys.executable, str(EXPORT_SCRIPT), "--check"],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(json.dumps(field_rules_contract(), indent=2), GENERATED_MODULE.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
