"""The bundled variant catalog (ADR native design bundle §9.6, C1; §9.7 X).

A commit's catalog is the bundle member ``projections/semantic-index.json``'s
``assembly``, not a source scan; WP-X deleted the scan the parity test used to
compare against. The mapping tests pin the golden ``assembly`` to today's
shape. The consumer tests pin the R1 contract: a ready member supplies the
catalog, pending and failed raise the typed answer, a final non-member has no
variants, and no commit reads HEAD.
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
from support.repo import init_repo  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"

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


class GoldenMappingTests(unittest.TestCase):
    """The mapping preserves today's catalog shape for the golden assemblies."""

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


class _Archive:
    """The one member's manifest row, enough for the cache key."""

    def __init__(self, sha256: str) -> None:
        self._sha256 = sha256

    def member(self, path: str) -> dict:
        return {"path": path, "sha256": self._sha256}


class _Bundled(_Opened):
    """A revision in a stored archive, so the catalog cache can key it."""

    def __init__(
        self,
        state: str,
        document: dict | None = None,
        *,
        bundle_key: str = "bundle-a",
        sha256: str = "a" * 64,
    ) -> None:
        super().__init__(state, document)
        self.bundle_key = bundle_key
        self.archive = _Archive(sha256)


class _ProjectCase(unittest.TestCase):
    """A repository with one project, and the discovery call the tests drive."""

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
                    self.project, "HEAD", **kwargs
                ),
                open_revision,
            )


class ConsumerTests(_ProjectCase):
    """The API consumer reads only the bundle (ADR §9.7 R1)."""

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
                self.project, None
            )
        commit = open_revision.call_args.args[1]
        self.assertEqual(len(commit), 40)
        self.assertEqual(result["commit"], commit)

    def test_a_project_without_an_id_is_refused(self) -> None:
        # Release Studio once passed a checkout path with no id; this read has
        # no key to look up and must not guess one.
        self.project = SimpleNamespace(path=self.project.path, project_file="main.kicad_pro")
        with self.assertRaises(ValueError):
            variant_catalog_service.discover_variant_catalog(self.project, "HEAD")

    def test_an_unreadable_ready_member_is_a_typed_failure(self) -> None:
        class _Broken(_Opened):
            def read_json(self, path):
                raise RuntimeError("corrupt archive")

        with self.assertRaises(DesignDataFailed):
            self._discover(_Broken("ready", None))


class CatalogCacheTests(_ProjectCase):
    """A ready member is parsed once per (bundle key, member sha256, project dir)."""

    def setUp(self) -> None:
        super().setUp()
        variant_catalog_service.reset_variant_catalog_cache()
        self.addCleanup(variant_catalog_service.reset_variant_catalog_cache)

    def _document(self, diagnostic_path: str = "boards/main/broken.kicad_sch") -> dict:
        return {
            "assembly": {
                "catalog": [BUNDLE_ENTRY],
                "diagnostics": [{**BUNDLE_DIAGNOSTIC, "path": diagnostic_path}],
            }
        }

    def test_the_same_bundle_key_and_member_read_once(self) -> None:
        opened = _Bundled("ready", self._document())
        first, _ = self._discover(opened)
        second, _ = self._discover(opened)
        self.assertEqual(opened.read_paths, [variant_catalog_service.SEMANTIC_INDEX_MEMBER])
        self.assertEqual(first, second)
        # Key order is part of the HTTP body; a cached copy must not reorder it.
        self.assertEqual(json.dumps(first), json.dumps(second))
        self.assertEqual(variant_catalog_service.variant_catalog_cache_stats()["hits"], 1)

    def test_a_changed_member_digest_is_a_miss(self) -> None:
        document = self._document()
        first, _ = self._discover(_Bundled("ready", document, sha256="a" * 64))
        second, _ = self._discover(_Bundled("ready", document, sha256="b" * 64))
        self.assertEqual(first, second)
        self.assertEqual(variant_catalog_service.variant_catalog_cache_stats()["misses"], 2)

    def test_a_different_project_directory_is_a_miss(self) -> None:
        # Diagnostic paths are project-relative, so the same member shapes
        # differently in another project directory.
        opened = _Bundled("ready", self._document())
        (self.root / "boards" / "other").mkdir()
        first, _ = self._discover(opened)
        self.project = SimpleNamespace(
            id=self.project.id,
            path=str(self.root / "boards"),
            project_file="main.kicad_pro",
        )
        second, _ = self._discover(opened)
        self.assertEqual(first["diagnostics"][0]["path"], "broken.kicad_sch")
        self.assertEqual(second["diagnostics"][0]["path"], "main/broken.kicad_sch")
        self.assertEqual(
            opened.read_paths,
            [variant_catalog_service.SEMANTIC_INDEX_MEMBER] * 2,
        )

    def test_a_revision_without_a_bundle_key_is_not_cached(self) -> None:
        # A test double or an archive-less read has no key to trust.
        opened = _Opened("ready", self._document())
        self._discover(opened)
        self._discover(opened)
        self.assertEqual(
            opened.read_paths,
            [variant_catalog_service.SEMANTIC_INDEX_MEMBER] * 2,
        )
