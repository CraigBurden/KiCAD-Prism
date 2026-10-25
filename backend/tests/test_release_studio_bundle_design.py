"""Release Studio on the bundle: C3b, C3c, C3d and C3f.

Four reads move from Python ``kicad_monkey``/``kicad_cruncher`` to the design
bundle in one place each:

- the a0-compatible semantic view the scope fingerprint hashes (C3b);
- the kicad-cli board and schematic inputs (C3c);
- the input closure's documents and path references (C3d);
- the build's provenance (C3f).

The tests here pin the parity the ADR asks for, the readiness answer that
replaces bundle mode's legacy fallback, and the import boundary: a bundle-mode
step set runs with ``kicad_monkey``, ``kicad_cruncher`` and ``geometer`` made
unimportable.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.release_studio import bundle_design, bundle_projections
from app.release_studio import closure as closure_module
from app.release_studio import semantic as semantic_module
from app.release_studio import steps as steps_module
from app.release_studio.closure_references import ProjectReferences
from app.release_studio import bundle_errors
from app.services.design_bundle import reader
from app.services.design_bundle.manifest import Readiness
from support.repo import commit_all, init_repo

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
SHA = "c" * 40


def _golden_index(case: str) -> dict:
    return json.loads(
        (GOLDENS / case / "semantic-index.json").read_text(encoding="utf-8")
    )


class SemanticA0Tests(unittest.TestCase):
    """C3b: the a0 view hashes to today's scope fingerprint on the fixtures."""

    #: ``sha256_canonical`` of each domain's scope projection, computed from the
    #: same revisions with today's ``build_semantic_index`` over the fixture
    #: sources the bundle was captured from (upgraded, kicad_monkey 2026.9.7).
    #: The parity script re-derives both sides; this pins the committed answer.
    #: rs-synthetic's bare-board and documentation digests follow its golden
    #: since its unconnected pin nets take KiCad's names (semantic-index D1).
    FINGERPRINTS = {
        "rs-synthetic": {
            "bare_board": "f94fd8a365858a2003c5e821dcf09b17edf3c2c55bfa55605d97d0c5026f908c",
            "assembly": "e73273ca7f2351b22b8ccc1e66c4c044e95114073c584afa948905d32d38a431",
            "documentation": "4c2c3026d942dd9144ca36b0bbc47c1a24f454cbfd6e6f63d852e8658b65f01d",
        },
        "rs-usb-pd": {
            "bare_board": "b22aa3466ab98dec74150b134ed5947a721010971ca5a9ae0033957300fed1b3",
            "assembly": "09ad72f0cfc77905c47219b5e396f5b0b54357bf31cd4d7c3777bf19fc5f6616",
            "documentation": "eed794ce39652aeca7b31d59cd611a8b59db0cf5d66214e3d6900f4752900064",
        },
        "rs-cynthion": {
            "bare_board": "f98cad688063c96bc7b4c33810f566056d6a757a894ffca2853e489fec87ec94",
            "assembly": "951fb2a2144a8b0ec4585238b0ca073654afb6d0a19ddadbb29e9463bf823f45",
            "documentation": "7836247f3a3c4b57351eaeaddfe6bdecfea32ae9f26cd992aca59222e4fddc10",
        },
    }

    def test_scope_fingerprint_equals_todays_on_the_parity_fixtures(self) -> None:
        from app.release_studio.canonical import sha256_canonical

        for case, expected in self.FINGERPRINTS.items():
            with self.subTest(case=case):
                bundled = bundle_projections.semantic_index_a0(_golden_index(case))
                self.assertEqual(bundled["schema"], "prism.semantic_index_a0")
                scopes = semantic_module.semantic_scope_projections(bundled)
                for domain, digest in expected.items():
                    self.assertEqual(sha256_canonical(scopes[domain]), digest, domain)

    def test_an_a0_index_expanded_with_the_a1_fields_reduces_back(self) -> None:
        a0 = {
            "schema": "prism.semantic_index_a0",
            "components": [
                {
                    "componentUid": "c1",
                    "fields": {"Value": "10k"},
                    "schematicRefs": [],
                    "pcbRefs": [],
                }
            ],
            "nets": [{"netUid": "n1", "name": "VCC"}],
            "terminals": [
                {
                    "terminalUid": "t1",
                    "componentUid": "c1",
                    "reference": "R1",
                    "pin": "1",
                    "netUid": "n1",
                    "netName": "VCC",
                }
            ],
            "sheetInstances": [],
            "buses": [],
        }
        a1 = json.loads(json.dumps(a0))
        a1["schema"] = "prism.semantic_index.a1"
        a1["components"][0]["libraryRef"] = {"name": "Lib"}
        a1["terminals"][0].update(
            {"pinName": "VCC", "pinType": "power_in", "schematicNetName": "VCC"}
        )

        self.assertEqual(
            semantic_module.semantic_scope_projections(
                bundle_projections.semantic_index_a0(a1)
            ),
            semantic_module.semantic_scope_projections(a0),
        )

    def test_the_four_a1_fields_are_removed_at_every_depth(self) -> None:
        member = {
            "schema": "prism.semantic_index.a2",
            "components": [
                {
                    "componentUid": "c1",
                    "libraryRef": {"name": "Lib", "nested": {"pinName": "x"}},
                    "fields": {"Value": "10k", "schematicNetName": "N"},
                }
            ],
            "terminals": [
                {
                    "terminalUid": "t1",
                    "pinName": "VCC",
                    "pinType": "power_in",
                    "schematicNetName": "VCC",
                }
            ],
            "nets": [{"netUid": "n1", "name": "VCC"}],
        }

        reduced = bundle_projections.semantic_index_a0(member)

        self.assertEqual(reduced["schema"], "prism.semantic_index_a0")
        text = json.dumps(reduced)
        for field in ("pinName", "pinType", "libraryRef", "schematicNetName"):
            self.assertNotIn(f'"{field}"', text)
        # The a0 fields survive unchanged.
        self.assertEqual(reduced["nets"], member["nets"])
        self.assertEqual(reduced["components"][0]["componentUid"], "c1")


def _write_project_repo(root: Path) -> tuple[Path, str]:
    files = {
        "board/demo.kicad_pro": '{"meta": {"filename": "demo.kicad_pro"}}\n',
        "board/demo.kicad_sch": (
            '(kicad_sch (version 20260306) (generator "eeschema")\n'
            '  (sheet (property "Sheetname" "power") '
            '(property "Sheetfile" "Subsheets/power.kicad_sch"))\n'
            ")\n"
        ),
        "board/demo.kicad_pcb": (
            '(kicad_pcb (version 20260206) '
            '(model "${KIPRJMOD}/models/part.step"))\n'
        ),
        "board/Subsheets/power.kicad_sch": (
            '(kicad_sch (version 20260306) (generator "eeschema"))\n'
        ),
        "board/fp-lib-table": (
            '(fp_lib_table (version 7) '
            '(lib (name "Demo") (type "KiCad") '
            '(uri "${KIPRJMOD}/libs/demo.pretty") (options "") (descr "")))\n'
        ),
        "board/sym-lib-table": (
            '(sym_lib_table (version 7) '
            '(lib (name "Demo") (type "KiCad") '
            '(uri "${KIPRJMOD}/libs/demo.kicad_sym") (options "") (descr "")))\n'
        ),
        "board/libs/demo.pretty/demo.kicad_mod": "(footprint demo)\n",
        "board/libs/demo.kicad_sym": "(kicad_symbol_lib)\n",
        "board/models/part.step": "ISO-10303-21;\n",
        ".prism/release-studio/project.yaml": "name: demo\n",
        "README.md": "# demo\n",
    }
    for relative, content in files.items():
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    init_repo(root)
    return root, commit_all(root, "demo")


def _bundle_project() -> ProjectReferences:
    """The P4 documents/references for :func:`_write_project_repo`."""

    return ProjectReferences(
        documents=(
            "demo.kicad_pcb",
            "demo.kicad_sch",
            "Subsheets/power.kicad_sch",
        ),
        references=(
            {
                "kind": "model-3d",
                "documentPath": "demo.kicad_pcb",
                "raw": "${KIPRJMOD}/models/part.step",
                "variables": ["KIPRJMOD"],
                "target": {
                    "kind": "repository",
                    "path": "models/part.step",
                    "base": "project-variable",
                    "inSources": True,
                },
            },
            {
                "kind": "footprint-library",
                "documentPath": "fp-lib-table",
                "raw": "${KIPRJMOD}/libs/demo.pretty",
                "variables": ["KIPRJMOD"],
                "target": {"kind": "repository", "path": "libs/demo.pretty"},
            },
            {
                "kind": "symbol-library",
                "documentPath": "sym-lib-table",
                "raw": "${KIPRJMOD}/libs/demo.kicad_sym",
                "variables": ["KIPRJMOD"],
                "target": {"kind": "repository", "path": "libs/demo.kicad_sym"},
            },
        ),
    )


class ClosureParityTests(unittest.TestCase):
    """C3d: the bundle's P4 answer resolves the closure records (R2: it is the only path)."""

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.root = Path(self._temporary.name)
        self.repo = self.root / "repo"
        _write_project_repo(self.repo)
        self.commit = commit_all(self.repo, "noop", allow_empty=True)

    def test_the_bundles_documents_and_references_resolve(self) -> None:
        bundled = closure_module.materialize_input_closure(
            self.repo,
            self.commit,
            self.root / "bundled",
            relative_path="board",
            bundle_project=_bundle_project(),
        )

        self.assertEqual(
            {
                (record.source_path, record.reference, record.resolved_path, record.location)
                for record in bundled.library_references
            },
            {
                (
                    "board/demo.kicad_pcb",
                    "${KIPRJMOD}/models/part.step",
                    "board/models/part.step",
                    "closure",
                ),
                (
                    "board/fp-lib-table",
                    "${KIPRJMOD}/libs/demo.pretty",
                    "board/libs/demo.pretty",
                    "closure",
                ),
                (
                    "board/sym-lib-table",
                    "${KIPRJMOD}/libs/demo.kicad_sym",
                    "board/libs/demo.kicad_sym",
                    "closure",
                ),
            },
        )
        self.assertEqual(bundled.non_hermetic_reasons(), [])

    def test_an_embedded_reference_is_not_a_closure_input(self) -> None:
        project = ProjectReferences(
            documents=("board/demo.kicad_pcb",),
            references=(
                {
                    "kind": "model-3d",
                    "documentPath": "board/demo.kicad_pcb",
                    "raw": "kicad-embed://part.step",
                    "target": {"kind": "embedded", "name": "part.step"},
                },
            ),
        )
        bundled = closure_module.materialize_input_closure(
            self.repo,
            self.commit,
            self.root / "embedded",
            relative_path="board",
            bundle_project=project,
        )
        self.assertEqual(bundled.library_references, ())


class _RecordingTool:
    """A kicad-cli that records argv and writes nothing."""

    def __init__(self) -> None:
        self.calls: list[list[str]] = []

    def executable(self) -> str:
        return "/fake/kicad-cli"

    def run(self, argv, *, cwd=None, timeout=None, tee=False):  # noqa: ANN001
        self.calls.append(list(argv))
        return SimpleNamespace(returncode=0, stdout="", stderr="")


class _DesignPaths:
    """The two path answers C3c needs from a ready bundle."""

    def __init__(self, board: Path, schematic: Path, *, refilled: bool = True) -> None:
        self.board = board
        self.schematic = schematic
        self.refilled = refilled

    def board_path(self, board, project_relpath=""):  # noqa: ANN001
        return self.board

    def board_member(self, board, project_relpath=""):  # noqa: ANN001
        return "refilled/demo.kicad_pcb" if self.refilled else "sources/board/demo.kicad_pcb"

    def schematic_path(self, schematic, project_relpath=""):  # noqa: ANN001
        return self.schematic

    def schematic_member(self, schematic, project_relpath=""):  # noqa: ANN001
        return "sources/board/demo.kicad_sch"


class CatalogueInputTests(unittest.TestCase):
    """C3c: board steps read refilled/, schematic steps read sources/."""

    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.root = Path(self._temporary.name)
        self.board = self.root / "refilled" / "demo.kicad_pcb"
        self.schematic = self.root / "sources" / "board" / "demo.kicad_sch"
        for path in (self.board, self.schematic):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("(kicad)\n", encoding="utf-8")

    def test_each_step_opens_the_bundle_file_and_records_a_stable_label(self) -> None:
        tool = _RecordingTool()
        design = _DesignPaths(self.board, self.schematic)
        outputs = steps_module.run_step_catalogue(
            closure_root=self.root,
            board_rel="board/demo.kicad_pcb",
            schematic_rel="board/demo.kicad_sch",
            output_root=self.root / "outputs",
            tool=tool,
            only=("drc", "erc", "board_stats"),
            board_path=design.board_path("board/demo.kicad_pcb"),
            schematic_path=design.schematic_path("board/demo.kicad_sch"),
            board_label=design.board_member("board/demo.kicad_pcb"),
            schematic_label=design.schematic_member("board/demo.kicad_sch"),
        )

        by_id = {output.step_id: output for output in outputs}
        self.assertEqual(tool.calls[0][-1], str(self.board))
        self.assertEqual(tool.calls[1][-1], str(self.schematic))
        self.assertIn("refilled/demo.kicad_pcb", by_id["drc"].normalized_argv)
        self.assertIn("sources/board/demo.kicad_sch", by_id["erc"].normalized_argv)
        self.assertNotIn(str(self.root), " ".join(by_id["drc"].normalized_argv))

    def test_a_configured_schematic_that_is_missing_fails_its_steps(self) -> None:
        with self.assertRaisesRegex(steps_module.StepExecutionError, "schematic not found"):
            steps_module.run_step_catalogue(
                closure_root=self.root,
                board_rel="board/demo.kicad_pcb",
                schematic_rel="board/missing.kicad_sch",
                output_root=self.root / "outputs",
                tool=_RecordingTool(),
                only=("bom",),
                board_path=self.board,
                schematic_path=self.root / "sources" / "board" / "missing.kicad_sch",
            )

    def test_a_missing_schematic_does_not_fail_board_only_steps(self) -> None:
        outputs = steps_module.run_step_catalogue(
            closure_root=self.root,
            board_rel="board/demo.kicad_pcb",
            schematic_rel="board/missing.kicad_sch",
            output_root=self.root / "outputs",
            tool=_RecordingTool(),
            only=("drc",),
            board_path=self.board,
            schematic_path=self.root / "sources" / "board" / "missing.kicad_sch",
        )
        self.assertEqual([output.step_id for output in outputs], ["drc"])

    def test_a_repository_rooted_bundle_keeps_the_subproject_prefix(self) -> None:
        # A Type-2 subproject keyed at the repository root stores
        # sources/hw/<project>/...; stripping the anchor pointed ERC and BOM at
        # a file that does not exist.
        members = [
            {"path": "sources/hw/demo/demo.kicad_sch"},
            {"path": "sources/hw/demo/demo.kicad_pcb"},
        ]
        design = _BundleDesignFixture(
            manifest={**_manifest(fill_provenance="saved"), "members": members},
            opened=_Opened(manifest={"members": members}),
        )
        self.assertEqual(design.schematic_member("hw/demo/demo.kicad_sch", "hw/demo"), "sources/hw/demo/demo.kicad_sch")
        self.assertEqual(design.board_member("hw/demo/demo.kicad_pcb", "hw/demo"), "sources/hw/demo/demo.kicad_pcb")

    def test_an_anchored_bundle_strips_the_subproject_prefix(self) -> None:
        members = [{"path": "sources/demo.kicad_sch"}]
        design = _BundleDesignFixture(
            manifest={**_manifest(fill_provenance="saved"), "members": members},
            opened=_Opened(manifest={"members": members}),
        )
        self.assertEqual(design.schematic_member("hw/demo/demo.kicad_sch", "hw/demo"), "sources/demo.kicad_sch")

    def test_saved_fills_choose_the_source_board(self) -> None:
        design = _BundleDesignFixture(
            manifest=_manifest(fill_provenance="saved"), opened=None
        )
        self.assertEqual(
            design.board_member("board/demo.kicad_pcb"),
            "sources/board/demo.kicad_pcb",
        )
        design = _BundleDesignFixture(
            manifest=_manifest(fill_provenance="refilled"), opened=None
        )
        self.assertEqual(
            design.board_member("board/demo.kicad_pcb"),
            "refilled/demo.kicad_pcb",
        )


class _Archive:
    def __init__(self, manifest: dict, path: Path) -> None:
        self.manifest = manifest
        self.path = path


class _Opened:
    def __init__(
        self,
        *,
        manifest: dict | None = None,
        states: dict[str, str] | None = None,
        project: dict | None = None,
        absent: bool = False,
        failure: str | None = None,
    ) -> None:
        self.archive = _Archive(manifest, Path("/tmp/demo.prism")) if manifest else None
        self._states = states or {}
        self._project = project or {}
        self.absent = absent
        self.failure = failure

    def readiness(self, paths):
        return {
            path: Readiness(path, self._states.get(path, "ready"), "parse", "why")
            for path in paths
        }

    def read_json(self, path):
        return self._project


class _BundleDesignFixture(bundle_design.BundleDesign):
    """A BundleDesign whose manifest is supplied without an archive reader."""

    def __init__(self, *, manifest: dict, opened) -> None:  # noqa: ANN001
        super().__init__(project_id="prj-1", commit=SHA, opened=opened)
        object.__setattr__(self, "_manifest", manifest)

    @property
    def manifest(self):  # noqa: ANN201
        return self._manifest


def _project_document() -> dict:
    return {
        "schema": "prism.project.a0",
        "documents": [
            {"path": "demo.kicad_pcb", "kind": "board"},
            {"path": "demo.kicad_sch", "kind": "root-schematic"},
        ],
        "references": [],
    }


def _manifest(*, fill_provenance: str = "refilled", status: str = "complete") -> dict:
    return {
        "generator": {
            "crate_version": "0.7.0",
            "engine_version": "2026.9.7",
            "kicad_version": "10.0.6",
            "hlr_procedure": {"geometer_version": "2026.9.19"},
            "member_schemas": [{"path": "bundle.json"}],
        },
        "config": {
            "board": "demo.kicad_pcb",
            "project_file": "demo.kicad_pro",
            "root_schematic": "demo.kicad_sch",
        },
        "stages": {
            "parse": {"status": status, "warnings": [], "failed_members": []},
            "board": {
                "status": status,
                "fill_provenance": fill_provenance,
                "warnings": [],
                "failed_members": [],
            },
            "models": {"status": status, "warnings": [], "failed_members": []},
        },
        "members": [],
    }


class ReadinessTests(unittest.TestCase):
    """A build waits or fails; it never serves a legacy parse."""

    def _read(self, opened):  # noqa: ANN001
        with mock.patch.object(reader, "open_revision", return_value=opened) as open_revision:
            answer = bundle_design.readiness(
                "prj-1", SHA, requested_by="release-studio"
            )
        return answer, open_revision

    def test_a_missing_commit_is_a_clear_failure(self) -> None:
        for commit in (None, ""):
            with self.subTest(commit=commit):
                with self.assertRaises(bundle_errors.BundleFailed) as caught:
                    bundle_design.readiness("prj-1", commit)
                self.assertIn("resolved commit", str(caught.exception))

    def test_a_missing_project_is_a_clear_failure(self) -> None:
        with self.assertRaises(bundle_errors.BundleFailed):
            bundle_design.readiness("", SHA)

    def test_a_pending_stage_waits_and_the_job_is_queued(self) -> None:
        opened = _Opened(manifest=_manifest(status="pending"), project=_project_document())
        with self.assertRaises(bundle_errors.BundlePending) as caught:
            with mock.patch.object(
                reader, "open_revision", return_value=opened
            ) as open_revision:
                bundle_design.readiness(
                    "prj-1", SHA, requested_by="release-studio"
                )
        self.assertIn("stage parse", str(caught.exception))
        open_revision.assert_called_once_with(
            "prj-1", SHA, queue=True, requested_by="release-studio"
        )

    def test_a_build_that_failed_after_parse_is_permanent_not_pending(self) -> None:
        # The parse archive survives a failed board build; its later stages
        # stay pending, but no job will finish them.
        manifest = _manifest()
        for stage in ("board", "models"):
            manifest["stages"][stage]["status"] = "pending"
        for opened in (
            _Opened(manifest=manifest, project=_project_document(), failure="zone refill failed"),
            _Opened(
                manifest=_manifest(),
                states={bundle_design.MODELS_MEMBER: "pending"},
                project=_project_document(),
                failure="glb export failed",
            ),
        ):
            with self.subTest(failure=opened.failure):
                with self.assertRaises(bundle_errors.BundleFailed) as caught:
                    self._read(opened)
                self.assertEqual(str(caught.exception), opened.failure)

    def test_a_failed_stage_is_permanent(self) -> None:
        manifest = _manifest()
        manifest["stages"]["models"] = {
            "status": "failed",
            "error": {"code": "glb-export-failed", "message": "kicad-cli died"},
            "warnings": [],
            "failed_members": [],
        }
        with self.assertRaises(bundle_errors.BundleFailed) as caught:
            self._read(_Opened(manifest=manifest, project=_project_document()))
        self.assertIn("glb-export-failed", str(caught.exception))

    def test_a_required_member_that_is_pending_waits(self) -> None:
        states = {bundle_design.MODELS_MEMBER: "pending"}
        with self.assertRaises(bundle_errors.BundlePending):
            self._read(
                _Opened(
                    manifest=_manifest(),
                    states=states,
                    project=_project_document(),
                )
            )

    def test_a_required_member_that_failed_is_permanent(self) -> None:
        states = {bundle_design.PROJECT_MEMBER: "failed"}
        with self.assertRaises(bundle_errors.BundleFailed):
            self._read(
                _Opened(
                    manifest=_manifest(),
                    states=states,
                    project=_project_document(),
                )
            )

    def test_an_absent_revision_is_permanent(self) -> None:
        with self.assertRaises(bundle_errors.BundleFailed):
            self._read(_Opened(absent=True))

    def test_a_ready_bundle_answers_with_its_generator(self) -> None:
        answer, _ = self._read(
            _Opened(manifest=_manifest(), project=_project_document())
        )
        self.assertIsInstance(answer, bundle_design.BundleDesign)
        self.assertEqual(answer.generator["engine_version"], "2026.9.7")
        self.assertEqual(answer.fill_provenance, "refilled")


class ImportBoundaryTests(unittest.TestCase):
    """The bundle step set executes with the Python KiCad parsers unimportable."""

    def test_bundle_steps_do_not_import_kicad_monkey_cruncher_or_geometer(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = Path(temporary.name)
        repo = root / "repo"
        _write_project_repo(repo)
        commit = commit_all(repo, "noop", allow_empty=True)

        board = root / "refilled" / "demo.kicad_pcb"
        schematic = root / "sources" / "board" / "demo.kicad_sch"
        for path in (board, schematic):
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("(kicad)\n", encoding="utf-8")
        tool = _RecordingTool()

        poisoned = {
            "kicad_monkey": None,
            "kicad_cruncher": None,
            "geometer": None,
        }
        with mock.patch.dict(sys.modules, poisoned):
            closure = closure_module.materialize_input_closure(
                repo,
                commit,
                root / "closure",
                relative_path="board",
                bundle_project=_bundle_project(),
            )
            self.assertTrue(closure.library_references)

            scopes = semantic_module.semantic_scope_projections(
                bundle_projections.semantic_index_a0(
                    {
                        "schema": "prism.semantic_index.a2",
                        "components": [{"componentUid": "c1", "libraryRef": {}}],
                        "nets": [],
                        "terminals": [{"terminalUid": "t1", "pinName": "VCC"}],
                        "sheetInstances": [],
                        "buses": [],
                    }
                )
            )
            self.assertEqual(scopes["assembly"]["schema"], "prism.semantic_index_a0")

            outputs = steps_module.run_step_catalogue(
                closure_root=root / "closure",
                board_rel="board/demo.kicad_pcb",
                schematic_rel="board/demo.kicad_sch",
                output_root=root / "outputs",
                tool=tool,
                only=("drc", "erc", "board_stats"),
                board_path=board,
                schematic_path=schematic,
                board_label="refilled/demo.kicad_pcb",
                schematic_label="sources/board/demo.kicad_sch",
            )
            self.assertEqual({output.step_id for output in outputs}, {"drc", "erc", "board_stats"})

            from app.services import release_studio_build_service as build_service

            with mock.patch.object(
                build_service, "executor_image", return_value="prism/kicad@sha256:" + "e" * 64
            ), mock.patch(
                "app.release_studio.documents.renderer_resource_digest",
                return_value="resources",
            ):
                record, digest = build_service.toolchain_identity(
                    bundle_generator=_manifest()["generator"]
                )
        self.assertNotIn("kicad_monkey_version", record)
        self.assertEqual(record["design_bundle_generator"]["engine_version"], "2026.9.7")
        self.assertEqual(len(digest), 64)


if __name__ == "__main__":
    unittest.main()
