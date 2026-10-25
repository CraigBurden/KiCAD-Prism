"""The one link builder: project URLs and ``prism://`` resource URIs (MCP-07)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.links import (  # noqa: E402
    RESOURCE_KINDS,
    ResourceRef,
    normalize_public_base_url,
    parse_resource_uri,
    project_url,
    resource_uri,
)

BASE = "https://prism.example.com"
SHA = "3f2c9a1b7e4d5c6a8b9f0e1d2c3b4a5968778695"


class ProjectUrlTests(unittest.TestCase):
    def test_parameter_order_is_the_call_order(self) -> None:
        self.assertEqual(
            project_url(BASE, "prj_1", commit=SHA, view="pcb", comment="c_1"),
            f"{BASE}/project/prj_1?commit={SHA}&view=pcb&comment=c_1",
        )
        self.assertEqual(
            project_url(BASE, "prj_1", section="history", base=SHA, compare=SHA),
            f"{BASE}/project/prj_1?section=history&base={SHA}&compare={SHA}",
        )

    def test_none_and_empty_parameters_are_dropped(self) -> None:
        self.assertEqual(
            project_url(BASE, "prj_1", commit=SHA, variant=None, item=""),
            f"{BASE}/project/prj_1?commit={SHA}",
        )
        self.assertEqual(project_url(BASE, "prj_1", variant=None), f"{BASE}/project/prj_1")

    def test_project_id_is_one_quoted_segment(self) -> None:
        self.assertEqual(
            project_url(BASE, "a/b c"),
            f"{BASE}/project/a%2Fb%20c",
        )

    def test_trailing_slash_on_the_base_is_dropped(self) -> None:
        self.assertEqual(project_url(f"{BASE}/", "prj_1"), f"{BASE}/project/prj_1")
        self.assertEqual(normalize_public_base_url(f"  {BASE}//  "), BASE)

    def test_empty_base_raises(self) -> None:
        for base in ("", "   ", "/"):
            with self.assertRaises(ValueError, msg=repr(base)):
                project_url(base, "prj_1")


class ResourceUriTests(unittest.TestCase):
    def test_round_trip_without_key(self) -> None:
        uri = resource_uri("prj_1", SHA, "component")
        self.assertEqual(uri, f"prism://project/prj_1/rev/{SHA}/component")
        self.assertEqual(
            parse_resource_uri(uri),
            ResourceRef("prj_1", SHA, "component", None),
        )

    def test_round_trip_with_key(self) -> None:
        uri = resource_uri("prj_1", SHA, "net", "MGMT.D0_P")
        self.assertEqual(uri, f"prism://project/prj_1/rev/{SHA}/net/MGMT.D0_P")
        self.assertEqual(
            parse_resource_uri(uri),
            ResourceRef("prj_1", SHA, "net", "MGMT.D0_P"),
        )

    def test_slashes_and_spaces_are_quoted(self) -> None:
        uri = resource_uri("a/b c", SHA, "sheet", "root/Sheet 1")
        self.assertEqual(
            uri,
            f"prism://project/a%2Fb%20c/rev/{SHA}/sheet/root%2FSheet%201",
        )
        self.assertEqual(
            parse_resource_uri(uri),
            ResourceRef("a/b c", SHA, "sheet", "root/Sheet 1"),
        )

    def test_uppercase_sha_is_lowercased(self) -> None:
        uri = resource_uri("prj_1", SHA.upper(), "bom")
        self.assertIn(f"/rev/{SHA}/", uri)
        self.assertEqual(parse_resource_uri(uri).commit, SHA)

    def test_every_kind_is_accepted(self) -> None:
        for kind in RESOURCE_KINDS:
            with self.subTest(kind=kind):
                self.assertEqual(
                    parse_resource_uri(resource_uri("prj_1", SHA, kind)).kind,
                    kind,
                )

    def test_bad_uris_raise(self) -> None:
        for uri in (
            f"prism://project/prj_1/rev/{SHA[:12]}/component",  # short sha
            f"prism://project/prj_1/rev/{SHA}/widget",  # unknown kind
            f"https://prism.example.com/project/prj_1/rev/{SHA}/component",  # wrong scheme
            f"prism://project/prj_1/rev/{SHA}/component/U1/extra",  # extra segment
            f"prism://project/prj_1/rev/{SHA}/component/",  # empty key segment
            "prism://project/prj_1/rev",  # truncated
        ):
            with self.assertRaises(ValueError, msg=uri):
                parse_resource_uri(uri)

    def test_resource_uri_rejects_a_short_sha_and_an_unknown_kind(self) -> None:
        with self.assertRaises(ValueError):
            resource_uri("prj_1", SHA[:12], "component")
        with self.assertRaises(ValueError):
            resource_uri("prj_1", SHA, "widget")


if __name__ == "__main__":
    unittest.main()
