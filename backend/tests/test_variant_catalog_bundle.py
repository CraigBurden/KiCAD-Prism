"""The bundled variant catalog (ADR native design bundle §9.6, C1).

A commit's catalog is the
bundle member ``projections/semantic-index.json``'s ``assembly``, not a source
scan. The acceptance is parity: for every committed case whose sources were
*not* upgraded, today's ``discover_snapshot_catalog`` on the fixture equals the
golden ``assembly`` mapped back to today's shape. The consumer tests pin the
R1 contract: a ready member supplies the catalog, pending and failed raise the
typed answer, a final non-member has no variants, and no commit reads HEAD.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.services import variant_catalog_service
from app.services.design_bundle import consumer
from app.services.design_bundle.errors import DesignDataFailed, DesignDataPending
from app.services.design_bundle.manifest import Readiness
from app.services.project_source_snapshot import ProjectSourceSnapshot
from support.repo import init_repo  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
FIXTURES = json.loads((REPO / "native" / "parity" / "fixtures.json").read_text(encoding="utf-8"))

#: Committed parity cases whose sources stage parse did not upgrade; for these
#: the golden ``assembly`` is exactly what today's discovery answers.
CASES = (
    "dv-case_fold",
    "dv-kicad11_tokens",
    "dv-no_variants",
    "dv-oracle",
    "dv-oracle_rev2",
    "dv-rule_area",
    "dv-sch_only",
    "sb-mini_obc-F0",
    "sb-mini_obc-F1",
    "sb-mini_obc-F11.1",
    "sb-mini_obc-F11.2",
    "sb-mini_obc-F2",
    "sb-mini_obc-F3",
    "sb-mini_obc-F4",
    "sb-mini_obc-F5",
    "sb-mini_obc-F6",
    "sb-mini_obc-F7",
    "sb-mini_obc-F8",
    "sb-mini_obc-F9",
    "sb-mini_payload-F0",
    "sb-mini_power-F0",
    "sb-mini_power-F10",
    "sb-p2-ambiguous-F0",
    "sb-p2-edge_a-F0",
    "sb-p2-edge_b-F0",
    "sb-p2-mezz_base-F0",
    "sb-p2-mezz_top-F0",
    "sb-p2-mezz_top-F1",
)

PROJECT_FILES = {
    "boards/main/main.kicad_pro": json.dumps({"schematic": {"variants": [{"name": "Lite"}]}}),
    "boards/main/main.kicad_sch": "(kicad_sch (version 20260306) (generator \"eeschema\"))\n",
    "boards/main/main.kicad_pcb": "(kicad_pcb (version 20260206) (generator \"pcbnew\"))\n",
}

BUNDLE_ENTRY = {"name": "FromBundle", "description": None, "sources": ["project"]}
BUNDLE_DIAGNOSTIC = {
    "code": "source-unparseable",
    "severity": "error",
    "source": "schematic",
    "path": "boards/main/broken.kicad_sch",
    "message": "Could not read broken.kicad_sch as a KiCad source.",
}


def golden_assembly(case: str) -> dict:
    return json.loads((GOLDENS / case / "semantic-index.json").read_text(encoding="utf-8"))["assembly"]


class GoldenParityTests(unittest.TestCase):
    """The mapping reproduces today's discovery for the non-upgraded goldens."""

    def test_today_discovery_equals_the_goldens_assembly(self) -> None:
        by_id = {fixture["id"]: fixture for fixture in FIXTURES["fixtures"]}
        for case in CASES:
            with self.subTest(case=case):
                fixture = by_id[case]
                root = (REPO / fixture["sourceRoot"]).resolve()
                snapshot = ProjectSourceSnapshot(
                    root=root,
                    project_file=(root / fixture["project"]).resolve(),
                    commit=None,
                )
                today = variant_catalog_service.discover_snapshot_catalog(snapshot)
                # A committed fixture's source root is its project directory, so
                # the golden's RepoPaths are already today's spelling (D9).
                mapped = variant_catalog_service._catalog_body_from_assembly(
                    golden_assembly(case), ""
                )
                self.assertEqual(mapped, today)

    def test_resolver_diagnostics_stay_out_of_the_catalog(self) -> None:
        # dv-oracle's only diagnostics are resolver ones (no `source`): the
        # catalog answer must be their empty list, not the resolver's rows.
        mapped = variant_catalog_service._catalog_body_from_assembly(golden_assembly("dv-oracle"), "")
        self.assertEqual(mapped["diagnostics"], [])

    def test_catalog_diagnostics_are_kept_in_emission_order(self) -> None:
        mapped = variant_catalog_service._catalog_body_from_assembly(golden_assembly("dv-case_fold"), "")
        self.assertEqual(
            [diagnostic["code"] for diagnostic in mapped["diagnostics"]],
            ["catalog-name-case-mismatch", "catalog-name-case-mismatch"],
        )

    def test_repository_relative_paths_map_to_the_project(self) -> None:
        assembly = {"catalog": [], "diagnostics": [BUNDLE_DIAGNOSTIC]}
        mapped = variant_catalog_service._catalog_body_from_assembly(assembly, "boards/main")
        self.assertEqual(
            mapped["diagnostics"],
            [
                {
                    "code": "source-unparseable",
                    "severity": "error",
                    "source": "schematic",
                    "path": "broken.kicad_sch",
                    "message": "Could not read broken.kicad_sch as a KiCad source.",
                }
            ],
        )

    def test_paths_outside_the_project_keep_today_s_bare_name(self) -> None:
        diagnostic = {**BUNDLE_DIAGNOSTIC, "path": "libraries/common.kicad_sch"}
        assembly = {"catalog": [], "diagnostics": [diagnostic]}
        mapped = variant_catalog_service._catalog_body_from_assembly(assembly, "boards/main")
        self.assertEqual(mapped["diagnostics"][0]["path"], "common.kicad_sch")


class _Opened:
    """A stored revision whose one member has ``state`` (``tests.test_design_bundle_consumer``)."""

    def __init__(self, state: str, document: dict | None = None) -> None:
        self.absent = False
        self._state = state
        self._document = document
        self.read_paths: list[str] = []

    def readiness(self, paths):
        return {path: Readiness(path, self._state, "parse", "why") for path in paths}

    def read_json(self, path):
        self.read_paths.append(path)
        return self._document


class ConsumerTests(unittest.TestCase):
    """The API consumer reads only the bundle (ADR §9.7 R1)."""

    def setUp(self) -> None:
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="variant-bundle-")))
        init_repo(self.root, PROJECT_FILES)
        self.project = SimpleNamespace(
            id="prj_switch",
            path=str(self.root / "boards" / "main"),
            project_file="main.kicad_pro",
        )

    def _discover(self, opened, **kwargs):
        with mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
            return (
                variant_catalog_service.discover_variant_catalog(
                    self.project, "HEAD", bundle_only=True, **kwargs
                ),
                open_revision,
            )

    def test_a_ready_member_supplies_the_catalog(self) -> None:
        document = {
            "schema": "prism.semantic_index.a2",
            "assembly": {"catalog": [BUNDLE_ENTRY], "diagnostics": [BUNDLE_DIAGNOSTIC]},
        }
        opened = _Opened("ready", document)
        result, open_revision = self._discover(opened)
        open_revision.assert_called_once()
        self.assertEqual(opened.read_paths, [variant_catalog_service.SEMANTIC_INDEX_MEMBER])
        self.assertEqual(result["variants"], [BUNDLE_ENTRY])
        self.assertEqual(result["diagnostics"][0]["path"], "broken.kicad_sch")

    def test_pending_and_failed_are_typed(self) -> None:
        for state, error in (("pending", DesignDataPending), ("unavailable", DesignDataPending), ("failed", DesignDataFailed)):
            with self.subTest(state=state), self.assertRaises(error):
                self._discover(_Opened(state, {"assembly": {"catalog": [BUNDLE_ENTRY]}}))

    def test_a_final_non_member_has_no_variants(self) -> None:
        for state in ("skipped", "not-applicable"):
            with self.subTest(state=state):
                result, _ = self._discover(_Opened(state, {"assembly": {"catalog": [BUNDLE_ENTRY]}}))
                self.assertEqual(result["variants"], [])

    def test_no_commit_reads_head(self) -> None:
        document = {"assembly": {"catalog": [BUNDLE_ENTRY]}}
        opened = _Opened("ready", document)
        with mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
            result = variant_catalog_service.discover_variant_catalog(
                self.project, None, bundle_only=True
            )
        commit = open_revision.call_args.args[1]
        self.assertEqual(len(commit), 40)
        self.assertEqual(result["commit"], commit)

    def test_a_project_without_an_id_is_refused(self) -> None:
        # Release Studio once passed a checkout path with no id; this read has
        # no key to look up and must not guess one.
        self.project = SimpleNamespace(path=self.project.path, project_file="main.kicad_pro")
        with self.assertRaises(ValueError):
            variant_catalog_service.discover_variant_catalog(self.project, "HEAD", bundle_only=True)

    def test_an_unreadable_ready_member_is_a_typed_failure(self) -> None:
        class _Broken(_Opened):
            def read_json(self, path):
                raise RuntimeError("corrupt archive")

        with self.assertRaises(DesignDataFailed):
            self._discover(_Broken("ready", None))
