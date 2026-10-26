"""The engineering BOM is one computation with one fixture (ADR §3.8).

`fixtures/bom/components.json` is read here and by the frontend's
`engineering-bom.test.ts`; `expected.json` is the answer both must reproduce.
The route test feeds the fixture through a stubbed semantic-index artifact and
checks the typed response and the assembly filter.
"""

from __future__ import annotations

import asyncio
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.api import project_bom as api
from app.services.design_query.bom import build_bom

FIXTURE_DIR = Path(__file__).resolve().parents[2] / "fixtures" / "bom"
FILTERS = ("all", "assembly")


def _load(name: str):
    return json.loads((FIXTURE_DIR / name).read_text(encoding="utf-8"))


class BomParityTests(unittest.TestCase):
    def test_python_and_typescript_share_the_fixture_answer(self) -> None:
        components = _load("components.json")
        expected = _load("expected.json")
        for assembly in FILTERS:
            self.assertEqual(build_bom(components, assembly), expected[assembly], assembly)

    def test_an_unknown_assembly_filter_is_refused(self) -> None:
        with self.assertRaises(ValueError):
            build_bom(_load("components.json"), "prototype")


class BomRouteTests(unittest.TestCase):
    def _response(self, assembly: str, commit: str | None = "abcdef"):
        components = _load("components.json")
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "semantic-index.json"
            path.write_text(json.dumps({"components": components}), encoding="utf-8")
            with mock.patch.object(api, "get_project_for_role_or_404", return_value=SimpleNamespace(id="p1")):
                with mock.patch.object(
                    api.semantic_index_service,
                    "artifact_file",
                    return_value=(path, "design-revision-key"),
                ):
                    return asyncio.run(
                        api.get_project_bom("p1", commit, assembly, SimpleNamespace(role="viewer"))
                    )

    def test_the_route_returns_the_typed_bom_and_filters_the_assembly(self) -> None:
        expected = _load("expected.json")
        for assembly in FILTERS:
            response = self._response(assembly)
            self.assertIsInstance(response, api.BomOut)
            self.assertEqual(response.commit, "abcdef")
            self.assertEqual(response.designKey, "design-revision-key")
            self.assertEqual(response.columns, expected[assembly]["columns"])
            self.assertEqual(
                [line.model_dump() for line in response.lines],
                expected[assembly]["lines"],
            )

    def test_a_request_without_a_commit_answers_with_none(self) -> None:
        self.assertIsNone(self._response("all", commit=None).commit)


if __name__ == "__main__":
    unittest.main()
