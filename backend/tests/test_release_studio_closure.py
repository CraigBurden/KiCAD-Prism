"""Dynamic, offline Git fixtures for the Release Studio input closure."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

from app.release_studio import closure as closure_module, closure_models
from app.release_studio.canonical import sha256_canonical
from app.release_studio.closure import (
    ClosureError,
    LfsMaterializationError,
    PinnedToolchainResource,
    materialize_input_closure,
    resource_root_digest,
)
from app.release_studio.closure_references import ProjectReferences
from support.repo import commit_all, git, init_repo  # noqa: E402


GIT = shutil.which("git")

#: The fixtures write plain KiCad text; this recovers the references a design
#: bundle's ``project.json`` would carry for them, so the closure tests stay
#: about resolution rather than about the bundle. WP-R2 removed the production
#: checkout scanner these tests used to lean on.
_MODEL_RE = re.compile(r'\(model\s+("(?:\\.|[^"\\])*"|[^\s()]+)')
_URI_RE = re.compile(r'\(uri\s+("(?:\\.|[^"\\])*")\)')


def _fixture_references(repo_path: str | Path, commit: str, project_dir: str) -> ProjectReferences:
    repo = Path(repo_path)
    prefix = "" if project_dir in ("", ".") else f"{project_dir.rstrip('/')}/"
    listing = git(repo, "ls-tree", "-r", "-z", "--name-only", commit).split("\0")
    references: list[dict[str, object]] = []
    for path in listing:
        if not path.startswith(prefix):
            continue
        relative = path[len(prefix):]
        name = relative.rsplit("/", 1)[-1]
        suffix = Path(name).suffix.casefold()
        if suffix not in {".kicad_pcb", ".kicad_sch"} and name.casefold() not in {
            "fp-lib-table",
            "sym-lib-table",
        }:
            continue
        text = git(repo, "show", f"{commit}:{path}")
        if name.casefold() in {"fp-lib-table", "sym-lib-table"}:
            kind = "footprint-library" if name.casefold() == "fp-lib-table" else "symbol-library"
            for token in _URI_RE.findall(text):
                references.append({
                    "kind": kind,
                    "documentPath": relative,
                    "raw": closure_models.unquote_token(token),
                })
            continue
        for token in _MODEL_RE.findall(text):
            raw = closure_models.unquote_token(token)
            reference: dict[str, object] = {
                "kind": "model-3d",
                "documentPath": relative,
                "raw": raw,
            }
            if raw.startswith("kicad-embed://"):
                reference["target"] = {"kind": "embedded"}
            references.append(reference)
    return ProjectReferences(references=tuple(references))


def materialize_with_fixture(
    repo_path: str | Path,
    commit: str,
    destination: str | Path,
    **kwargs,
):
    """``materialize_input_closure`` with the fixtures' bundle references filled in."""

    kwargs.setdefault(
        "bundle_project",
        _fixture_references(
            repo_path, str(commit), str(kwargs.get("relative_path") or ".")
        ),
    )
    return materialize_input_closure(repo_path, commit, destination, **kwargs)


@unittest.skipUnless(GIT, "git is required for closure fixtures")
class ReleaseStudioClosureTests(unittest.TestCase):
    def setUp(self) -> None:
        self._temporary = tempfile.TemporaryDirectory()
        self.root = Path(self._temporary.name)
        self.repo = self.root / "monorepo"
        self.nested = self.root / "nested-library"
        self.submodule = self.root / "board-library"
        init_repo(self.nested)
        (self.nested / "nested-footprint.kicad_mod").write_text(
            "(footprint nested)", encoding="utf-8"
        )
        self.nested_commit = commit_all(self.nested, "nested library")

        init_repo(self.submodule)
        (self.submodule / "submodule-footprint.kicad_mod").write_text(
            "(footprint submodule)", encoding="utf-8"
        )
        git(
            self.submodule,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            "--quiet",
            str(self.nested),
            "nested",
        )
        self.submodule_commit = commit_all(self.submodule, "board library")

        init_repo(self.repo)
        (self.repo / "common/footprints/Common.pretty").mkdir(parents=True)
        (self.repo / "common/symbols").mkdir(parents=True)
        (self.repo / "common/footprints/Common.pretty/common.kicad_mod").write_text(
            "(footprint common)", encoding="utf-8"
        )
        (self.repo / "common/symbols/Common.kicad_sym").write_text(
            "(kicad_symbol_lib)", encoding="utf-8"
        )
        (self.repo / "hardware/board/.prism/release-studio").mkdir(parents=True)
        (self.repo / "hardware/board/.prism/release-studio/release.yaml").write_text(
            "name: fixture\n", encoding="utf-8"
        )
        (self.repo / "hardware/board/fp-lib-table").write_text(
            '(fp_lib_table\n'
            '  (version 7)\n'
            '  (lib (name "Common") (type "KiCad") '
            '(uri "${KIPRJMOD}/../../common/footprints") '
            '(options "") (descr ""))\n'
            ')\n',
            encoding="utf-8",
        )
        (self.repo / "hardware/board/sym-lib-table").write_text(
            '(sym_lib_table\n'
            '  (version 7)\n'
            '  (lib (name "Common") (type "KiCad") '
            '(uri "${KIPRJMOD}/../../common/symbols/Common.kicad_sym") '
            '(options "") (descr ""))\n'
            ')\n',
            encoding="utf-8",
        )
        (self.repo / "hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(general (thickness 1.6)) '
            '(model "${KIPRJMOD}/model.step"))\n',
            encoding="utf-8",
        )
        (self.repo / "hardware/board/model.step").write_bytes(self.lfs_pointer())
        git(
            self.repo,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "add",
            "--quiet",
            str(self.submodule),
            "vendor/board-library",
        )
        git(
            self.repo,
            "-c",
            "protocol.file.allow=always",
            "submodule",
            "update",
            "--init",
            "--recursive",
        )
        (self.repo / ".prism/release-studio/project.yaml").parent.mkdir(
            parents=True, exist_ok=True
        )
        (self.repo / ".prism/release-studio/project.yaml").write_text(
            "closure: whole-tree\n", encoding="utf-8"
        )
        self.commit = commit_all(self.repo, "release fixture")

    def tearDown(self) -> None:
        self._temporary.cleanup()

    def test_full_tree_recursive_submodules_lfs_and_digest_are_deterministic(self) -> None:
        payload = b"small hydrated STEP payload\n"
        source_lfs_path = self.repo / "hardware/board/model.step"
        clone = self.root / "monorepo-independent-clone"
        git(
            self.root,
            "-c",
            "protocol.file.allow=always",
            "clone",
            "--quiet",
            "--no-local",
            "--recurse-submodules",
            str(self.repo),
            str(clone),
        )
        self.assertEqual(git(clone, "rev-parse", "HEAD").strip(), self.commit)
        # Clone-local submodule URL/config state may contain different host
        # paths, but the recorded commit tree and gitlinks must be identical.
        self.assertEqual(
            git(self.repo, "ls-tree", "-r", "--full-tree", self.commit),
            git(clone, "ls-tree", "-r", "--full-tree", self.commit),
        )
        source_lfs_path.write_bytes(payload)
        clone_lfs_path = clone / "hardware/board/model.step"
        clone_lfs_path.write_bytes(payload)
        before_status = self._status(self.repo)
        clone_before_status = self._status(clone)
        before_source = source_lfs_path.read_bytes()
        clone_before_source = clone_lfs_path.read_bytes()

        destination = self.root / "materialized-a"
        second_destination = self.root / "materialized-b"
        first = materialize_with_fixture(
            self.repo,
            self.commit,
            destination,
            relative_path="hardware/board",
        )
        second = materialize_with_fixture(
            clone,
            self.commit,
            second_destination,
            relative_path="hardware/board",
        )

        self.assertEqual(first.input_closure_digest, second.input_closure_digest)
        self.assertEqual(first.input_closure_digest, sha256_canonical(first.to_dict(False)))
        self.assertEqual(first.to_dict(), second.to_dict())
        record_text = repr(first.to_dict())
        for host_path in (self.repo, clone, destination, second_destination):
            self.assertNotIn(str(host_path), record_text)
        self.assertEqual(
            (destination / ".prism/release-studio/project.yaml").read_text(),
            "closure: whole-tree\n",
        )
        self.assertEqual(
            (destination / "hardware/board/.prism/release-studio/release.yaml").read_text(),
            "name: fixture\n",
        )
        self.assertEqual(
            (destination / "vendor/board-library/submodule-footprint.kicad_mod").read_text(),
            "(footprint submodule)",
        )
        self.assertEqual(
            (destination / "vendor/board-library/nested/nested-footprint.kicad_mod").read_text(),
            "(footprint nested)",
        )
        self.assertIn("vendor/board-library/nested/nested-footprint.kicad_mod",
                      {item.path for item in first.repository_inputs})
        self.assertEqual(
            {item.path for item in first.submodule_inputs},
            {"vendor/board-library", "vendor/board-library/nested"},
        )
        self.assertEqual(first.lfs_inputs[0].pointer_blob_sha, self._blob_sha(self.commit))
        self.assertEqual(first.lfs_inputs[0].lfs_oid, f"sha256:{hashlib.sha256(payload).hexdigest()}")
        self.assertEqual(first.lfs_inputs[0].materialized_digest, hashlib.sha256(payload).hexdigest())
        self.assertEqual(first.env_bindings[0].name, "KIPRJMOD")
        self.assertEqual(first.env_bindings[0].value, "hardware/board")
        self.assertIn(
            "common/footprints",
            {reference.resolved_path for reference in first.library_references},
        )
        self.assertEqual(before_status, self._status(self.repo))
        self.assertEqual(before_source, source_lfs_path.read_bytes())
        self.assertEqual(clone_before_status, self._status(clone))
        self.assertEqual(clone_before_source, clone_lfs_path.read_bytes())

    def test_unmaterialized_and_mismatched_lfs_content_fail_closed(self) -> None:
        with self.assertRaisesRegex(LfsMaterializationError, "unmaterialized"):
            materialize_with_fixture(self.repo, self.commit, self.root / "pointer")

        self.repo.joinpath("hardware/board/model.step").write_bytes(b"wrong bytes")
        with self.assertRaisesRegex(LfsMaterializationError, r"(size|sha256) mismatch"):
            materialize_with_fixture(self.repo, self.commit, self.root / "mismatch")

    def test_host_library_table_paths_are_recorded_not_fatal(self) -> None:
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"small hydrated STEP payload\n")
        self.repo.joinpath("hardware/board/fp-lib-table").write_text(
            '(fp_lib_table (version 7) '
            '(lib (name "Host") (type "KiCad") '
            '(uri "/tmp/host-only-footprints") (options "") (descr "")))\n',
            encoding="utf-8",
        )
        hostile_commit = commit_all(self.repo, "host path")
        # Recorded, and not fatal: the closure still materializes, so a
        # documentation build is never refused over a library table.
        closure = materialize_with_fixture(
            self.repo,
            hostile_commit,
            self.root / "host-recorded",
            relative_path="hardware/board",
        )
        # A footprint library is a real input. Calling it advisory would let a
        # build whose footprints came off the host record itself as hermetic,
        # so it counts against hermeticity even though it does not block.
        self.assertTrue(
            any("/tmp/host-only-footprints" in reason for reason in closure.non_hermetic_reasons())
        )
        self.assertEqual(closure.advisory_reasons(), [])

    def test_hermeticity_still_distinguishes_a_clean_closure(self) -> None:
        """The flag has to be able to say no, or recording it means nothing.

        Pinned alongside the two tests above: they prove an off-closure input
        makes `hermetic` false, and this proves an ordinary board leaves it
        true. Without both, a regression that hard-codes either answer passes.
        """

        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        commit = commit_all(self.repo, "clean closure")
        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "clean",
            relative_path="hardware/board",
        )
        self.assertEqual(closure.non_hermetic_reasons(), [])

    def test_a_missing_library_table_entry_is_recorded_not_fatal(self) -> None:
        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        self.repo.joinpath("hardware/board/fp-lib-table").write_text(
            '(fp_lib_table (version 7) '
            '(lib (name "Gone") (type "KiCad") '
            '(uri "${KIPRJMOD}/libraries/absent.pretty") (options "") (descr "")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "missing footprint library")
        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "missing-lib",
            relative_path="hardware/board",
        )
        # Same rule as the host-absolute URI above: a footprint library the
        # design names but the closure does not hold is a hermeticity finding,
        # reported rather than fatal.
        self.assertTrue(
            any("absent.pretty" in reason for reason in closure.non_hermetic_reasons())
        )
        self.assertEqual(closure.advisory_reasons(), [])

    def test_an_unreadable_external_3d_model_is_non_hermetic(self) -> None:
        # Every real KiCad board carries `(model "${KICAD9_3DMODEL_DIR}/...")`
        # nodes.  The cover render and the assembly views open them with the
        # worker's environment, so a model the build cannot read is bytes the
        # build key does not pin.
        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(general (thickness 1.6)) '
            '(model "${KIPRJMOD}/model.step") '
            '(model "${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0603.step") '
            f'(model "{self.root}/absent/R_0805.step"))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "stock 3d model reference")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "stock-3d",
            relative_path="hardware/board",
            model_env={"KICAD9_3DMODEL_DIR": str(self.root / "no-such-library")},
        )

        unreadable = closure.external_references
        self.assertEqual(
            sorted(reference.location for reference in unreadable),
            ["unreadable", "unreadable"],
        )
        reasons = closure.non_hermetic_reasons()
        self.assertEqual(len(reasons), 2)
        self.assertTrue(any("R_0603.step" in reason for reason in reasons))
        self.assertTrue(any("R_0805.step" in reason for reason in reasons))
        self.assertIn("bytes are not pinned", reasons[0])
        self.assertEqual(closure.advisory_reasons(), [])
        # The project's own model still resolves into the closure.
        self.assertIn(
            "hardware/board/model.step",
            {
                reference.resolved_path
                for reference in closure.library_references
                if reference.location == "closure"
            },
        )

    def test_an_external_3d_model_is_hashed_into_the_closure_digest(self) -> None:
        library = self.root / "host-models"
        (library / "Resistor_SMD.3dshapes").mkdir(parents=True)
        stock = library / "Resistor_SMD.3dshapes/R_0603.step"
        absolute = self.root / "absolute-models/R_0805.step"
        absolute.parent.mkdir()
        stock.write_bytes(b"stock model v1\n")
        absolute.write_bytes(b"absolute model v1\n")
        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(general (thickness 1.6)) '
            '(footprint "R" (model "${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0603.step")) '
            f'(footprint "R" (model "{absolute}" (hide yes))))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "external 3d models")

        def build(name: str, models: Path) -> object:
            return materialize_with_fixture(
                self.repo,
                commit,
                self.root / name,
                relative_path="hardware/board",
                model_env={"KICAD9_3DMODEL_DIR": str(models)},
            )

        first = build("models-1", library)
        self.assertEqual(first.non_hermetic_reasons(), [])
        hosted = {
            reference.reference: reference
            for reference in first.library_references
            if reference.location == "host"
        }
        self.assertEqual(
            hosted["${KICAD9_3DMODEL_DIR}/Resistor_SMD.3dshapes/R_0603.step"].digest,
            hashlib.sha256(b"stock model v1\n").hexdigest(),
        )
        self.assertEqual(
            hosted[str(absolute)].digest,
            hashlib.sha256(b"absolute model v1\n").hexdigest(),
        )
        # No host path is recorded, so the same bytes elsewhere agree.
        moved = self.root / "elsewhere"
        shutil.copytree(library, moved)
        self.assertEqual(build("models-2", moved).digest, first.digest)
        self.assertNotIn(str(library), str(first.to_dict()))

        stock.write_bytes(b"stock model v2\n")
        changed_stock = build("models-3", library)
        self.assertNotEqual(changed_stock.digest, first.digest)

        absolute.write_bytes(b"absolute model v2\n")
        self.assertNotEqual(build("models-4", library).digest, changed_stock.digest)

    def _host_model_digest(self, closure: object, reference: str) -> str:
        return {
            item.reference: item.digest
            for item in closure.library_references
            if item.location == "host"
        }[reference]

    def test_a_project_text_variable_wins_over_the_environment_for_a_model(
        self,
    ) -> None:
        # KiCad's ExpandEnvVarSubstitutions asks the project's text variables
        # before the environment, so the project's file is the one rendered.
        from_env = self.root / "env-models/part.step"
        from_project = self.root / "project-models/part.step"
        for path, payload in ((from_env, b"env model\n"), (from_project, b"project model\n")):
            path.parent.mkdir()
            path.write_bytes(payload)
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pro").write_text(
            json.dumps({"text_variables": {"CUSTOM": str(from_project.parent)}}),
            encoding="utf-8",
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "${CUSTOM}/part.step")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "project text variable model")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "project-variable",
            relative_path="hardware/board",
            model_env={"CUSTOM": str(from_env.parent)},
        )

        self.assertEqual(
            self._host_model_digest(closure, "${CUSTOM}/part.step"),
            hashlib.sha256(b"project model\n").hexdigest(),
        )

    def test_a_backslash_in_a_model_path_is_a_directory_separator(self) -> None:
        # KiCad swaps `\` for `/` before resolving on Linux, so it opens
        # `Folder/part.step`, never a file literally named `Folder\part.step`.
        library = self.root / "slash-models"
        (library / "Folder").mkdir(parents=True)
        (library / "Folder/part.step").write_bytes(b"nested model\n")
        (library / "Folder\\part.step").write_bytes(b"literal backslash name\n")
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "${KICAD9_3DMODEL_DIR}/Folder\\\\part.step")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "backslash model path")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "backslash",
            relative_path="hardware/board",
            model_env={"KICAD9_3DMODEL_DIR": str(library)},
        )

        self.assertEqual(
            self._host_model_digest(closure, "${KICAD9_3DMODEL_DIR}/Folder\\part.step"),
            hashlib.sha256(b"nested model\n").hexdigest(),
        )

    def test_a_project_kiprjmod_override_is_resolved_before_the_closure(self) -> None:
        # The project's text variables win even over KIPRJMOD, so KiCad opens
        # the outside file although the repository has one at the same path.
        outside = self.root / "outside-project/part.step"
        outside.parent.mkdir()
        outside.write_bytes(b"outside model v1\n")
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/part.step").write_bytes(b"in-repo model\n")
        self.repo.joinpath("hardware/board/board.kicad_pro").write_text(
            json.dumps({"text_variables": {"KIPRJMOD": str(outside.parent)}}),
            encoding="utf-8",
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "${KIPRJMOD}/part.step")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "project overrides KIPRJMOD")

        def build(name: str) -> object:
            return materialize_with_fixture(
                self.repo, commit, self.root / name, relative_path="hardware/board"
            )

        first = build("kiprjmod-1")
        self.assertEqual(
            self._host_model_digest(first, "${KIPRJMOD}/part.step"),
            hashlib.sha256(b"outside model v1\n").hexdigest(),
        )
        outside.write_bytes(b"outside model v2\n")
        self.assertNotEqual(build("kiprjmod-2").digest, first.digest)

    def test_a_backslash_path_that_climbs_out_of_the_closure_is_hashed(self) -> None:
        # KiCad normalizes `\..\` before it opens the file, so this reference
        # reads a host file, not a missing name inside the closure.
        host = self.root / "host-models/part.step"
        host.parent.mkdir()
        host.write_bytes(b"climbing model\n")
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        reference = "${KIPRJMOD}\\..\\..\\..\\host-models\\part.step"
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "'
            + reference.replace("\\", "\\\\")
            + '")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "backslash path out of the closure")

        closure = materialize_with_fixture(
            self.repo, commit, self.root / "climb", relative_path="hardware/board"
        )

        self.assertEqual(
            self._host_model_digest(closure, reference),
            hashlib.sha256(b"climbing model\n").hexdigest(),
        )
        self.assertEqual(closure.advisory_reasons(), [])

    def _model_location(
        self,
        name: str,
        reference: str,
        text_variables: dict[str, str] | None = None,
        model_env: dict[str, str] | None = None,
    ) -> str:
        return self._model_record(name, reference, text_variables, model_env).location

    def _model_record(
        self,
        name: str,
        reference: str,
        text_variables: dict[str, str] | None = None,
        model_env: dict[str, str] | None = None,
    ) -> object:
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pro").write_text(
            json.dumps({"text_variables": text_variables or {}}), encoding="utf-8"
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) (footprint "R" (model "'
            + reference.replace("\\", "\\\\")
            + '")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, name)
        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / name,
            relative_path="hardware/board",
            model_env=model_env or {},
        )
        (record,) = [
            item for item in closure.library_references if item.reference == reference
        ]
        return record

    def test_a_closure_symlink_out_of_the_closure_is_unreadable(self) -> None:
        # A repository symlink must not make the build read and fingerprint a
        # worker's file, nor stall on an endless device.
        outside = self.root / "secret/host.step"
        outside.parent.mkdir()
        outside.write_bytes(b"host secret\n")
        for name, target in (("outside-file", outside), ("dev-zero", Path("/dev/zero"))):
            with self.subTest(name):
                link = self.repo / f"hardware/board/{name}.step"
                link.symlink_to(target)
                started = time.monotonic()
                record = self._model_record(f"symlink-{name}", f"${{KIPRJMOD}}/{name}.step")
                self.assertLess(time.monotonic() - started, 30)
                self.assertEqual((record.location, record.digest), ("unreadable", ""))
                link.unlink()

    def test_a_host_model_that_is_not_a_regular_file_is_unreadable(self) -> None:
        host = self.root / "special"
        host.mkdir()
        os.mkfifo(host / "pipe.step")
        (host / "device.step").symlink_to("/dev/zero")
        for name in ("pipe", "device"):
            with self.subTest(name):
                started = time.monotonic()
                record = self._model_record(
                    f"special-{name}", f"${{MODELS}}/{name}.step", model_env={"MODELS": str(host)}
                )
                self.assertLess(time.monotonic() - started, 30)
                self.assertEqual((record.location, record.digest), ("unreadable", ""))

    def test_a_host_file_that_is_not_a_3d_model_is_never_hashed(self) -> None:
        host = self.root / "host-files"
        host.mkdir()
        (host / "backend.env").write_bytes(b"SECRET=1\n")
        (host / "disguised.step").symlink_to(host / "backend.env")
        cases = {
            # Absolute, no symlink: the model scan picks it up, KiCad would open it.
            "absolute": (f"{host}/backend.env.vrml", None),
            # A model name that resolves to a file KiCad's 3D plugins do not load.
            "disguised": ("${MODELS}/disguised.step", {"MODELS": str(host)}),
        }
        (host / "backend.env.vrml").write_bytes(b"SECRET=1\n")
        for name, (reference, env) in cases.items():
            with self.subTest(name):
                record = self._model_record(f"non-model-{name}", reference, model_env=env)
                self.assertEqual((record.location, record.digest), ("unreadable", ""))
        # A board naming a plain host file never gets its bytes hashed.
        plain = self._model_record("non-model-plain", f"{host}/backend.env")
        self.assertEqual(plain.digest, "")
        self.assertIn(plain.location, {"external", "unreadable"})

    def test_a_host_model_over_the_size_cap_is_unreadable(self) -> None:
        host = self.root / "large-models"
        host.mkdir()
        (host / "large.step").write_bytes(b"x" * 64)
        (host / "small.step").write_bytes(b"x" * 16)
        with mock.patch.object(closure_models, "HOST_MODEL_MAX_BYTES", 32):
            large = self._model_record(
                "large-model", "${MODELS}/large.step", model_env={"MODELS": str(host)}
            )
            small = self._model_record(
                "small-model", "${MODELS}/small.step", model_env={"MODELS": str(host)}
            )
        self.assertEqual((large.location, large.digest), ("unreadable", ""))
        self.assertEqual(small.digest, hashlib.sha256(b"x" * 16).hexdigest())

    def test_a_boards_project_variables_are_read_once(self) -> None:
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "${KIPRJMOD}/model.step")) '
            '(footprint "C" (model "${KIPRJMOD}/missing.step")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "two models on one board")
        with mock.patch.object(
            closure_module,
            "project_text_variables",
            wraps=closure_models.project_text_variables,
        ) as read:
            materialize_with_fixture(
                self.repo, commit, self.root / "read-once", relative_path="hardware/board"
            )
        self.assertEqual(read.call_count, 1)

    def test_models_kicad_resolves_differently_fail_closed(self) -> None:
        # Where Prism cannot reproduce KiCad's resolution exactly, the model
        # is unreadable, never hashed as something else or called advisory.
        host = self.root / "fail-closed/part.step"
        host.parent.mkdir()
        host.write_bytes(b"host model\n")
        loop = self.root / "loop"
        loop.symlink_to(loop)
        cases = {
            # A nested `$(VAR)` KiCad would expand.
            "nested": ("${CUSTOM}/part.step", {"CUSTOM": "$(ROOT)"}),
            # A relative value KiCad resolves against the tool's directory.
            "relative": ("${KIPRJMOD}/part.step", {"KIPRJMOD": "fail-closed"}),
            # KiCad checks the path before it normalizes `..`.
            "dotdot": (
                "${CUSTOM}/nonexistent/../part.step",
                {"CUSTOM": str(host.parent)},
            ),
            # A symlink loop must not escape as an exception.
            "loop": ("${CUSTOM}/x/part.step", {"CUSTOM": str(loop)}),
        }
        for name, (reference, variables) in cases.items():
            with self.subTest(name):
                self.assertEqual(
                    self._model_location(f"fail-closed-{name}", reference, variables),
                    "unreadable",
                )

    def test_eight_nested_model_variables_still_resolve(self) -> None:
        host = self.root / "deep-models/part.step"
        host.parent.mkdir()
        host.write_bytes(b"deep model\n")
        variables = {f"V{index}": f"${{V{index + 1}}}" for index in range(7)}
        variables["V7"] = str(host.parent)
        self.assertEqual(
            self._model_location("deep", "${V0}/part.step", variables), "host"
        )

    def test_a_missing_vrml_model_in_the_closure_is_non_hermetic(self) -> None:
        # kicad-cli replaces a missing WRL with a same-stem STEP from its
        # search paths, so this absence is not the same on every worker.
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "${KIPRJMOD}/packages3D/part.wrl")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "missing vrml model")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "missing-wrl",
            relative_path="hardware/board",
        )

        reasons = closure.non_hermetic_reasons()
        self.assertEqual(len(reasons), 1)
        self.assertIn("part.wrl", reasons[0])
        self.assertIn("same-name STEP model", reasons[0])
        self.assertEqual(closure.advisory_reasons(), [])

    def test_a_comma_in_a_quoted_model_path_is_not_truncated(self) -> None:
        # The unquoted-variable scan stops at `,`, so running it over a quoted
        # value invented a reference to `.../BUK9K18-40E` for a real file named
        # `BUK9K18-40E,115.stp` -- and then failed the build because the
        # invented path does not exist.
        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        models = self.repo / "hardware/board/packages3D"
        models.mkdir(parents=True, exist_ok=True)
        (models / "BUK9K18-40E,115.stp").write_text("solid", encoding="utf-8")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(general (thickness 1.6)) '
            '(model "${KIPRJMOD}/packages3D/BUK9K18-40E,115.stp"))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "comma in a model filename")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "comma",
            relative_path="hardware/board",
        )

        self.assertEqual(closure.non_hermetic_reasons(), [])
        self.assertIn(
            "hardware/board/packages3D/BUK9K18-40E,115.stp",
            {
                reference.resolved_path
                for reference in closure.library_references
                if reference.location == "closure"
            },
        )

    def test_a_relative_model_resolves_in_the_project_directory(self) -> None:
        # KiCad looks a relative model up beside the project; the board the
        # tools read names that file outright, so their working directory
        # cannot supply another one.
        models = self.repo / "hardware/board/packages3D"
        models.mkdir(parents=True, exist_ok=True)
        (models / "part.step").write_bytes(b"relative model\n")
        found = self._model_record("relative-found", "packages3D/part.step")
        self.assertEqual(
            (found.location, found.resolved_path),
            ("closure", "hardware/board/packages3D/part.step"),
        )
        board = (self.root / "relative-found/hardware/board/board.kicad_pcb").read_text()
        self.assertIn(f'(model "{self.root / "relative-found"}', board)
        self.assertNotIn('"packages3D/part.step"', board)
        # Not beside the project: KiCad would search the working directory,
        # the footprint library and the stock directory, so it fails closed.
        self.assertEqual(
            self._model_location("relative-missing", "packages3D/absent.step"), "unreadable"
        )

    def test_round_and_bare_variables_expand_like_braces(self) -> None:
        host = self.root / "round-models"
        host.mkdir()
        (host / "part.step").write_bytes(b"round model\n")
        digest = hashlib.sha256(b"round model\n").hexdigest()
        for name, reference in (("round", "$(MODELS)/part.step"), ("bare", "$MODELS/part.step")):
            with self.subTest(name):
                record = self._model_record(
                    f"variable-{name}", reference, model_env={"MODELS": str(host)}
                )
                self.assertEqual((record.location, record.digest), ("host", digest))
                unset = self._model_record(
                    f"variable-{name}-unset", reference.replace("MODELS", "UNSET")
                )
                self.assertEqual((unset.location, unset.digest), ("unreadable", ""))

    def test_an_alias_resolves_only_through_a_predefined_path_variable(self) -> None:
        host = self.root / "alias-models"
        host.mkdir()
        (host / "part.step").write_bytes(b"alias model\n")
        stock = self._model_record(
            "alias-stock",
            ":KICAD10_3DMODEL_DIR:part.step",
            model_env={"KICAD10_3DMODEL_DIR": str(host)},
        )
        self.assertEqual(
            (stock.location, stock.digest),
            ("host", hashlib.sha256(b"alias model\n").hexdigest()),
        )
        # Any other alias is whatever the worker's kicad_common.json says.
        self.assertEqual(
            self._model_location(
                "alias-custom", ":MYLIB:part.step", model_env={"MYLIB": str(host)}
            ),
            "unreadable",
        )

    def test_an_embedded_model_is_no_reference(self) -> None:
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(footprint "R" (model "kicad-embed://part.step")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "embedded model")
        closure = materialize_with_fixture(
            self.repo, commit, self.root / "embedded", relative_path="hardware/board"
        )
        self.assertNotIn(
            "kicad-embed://part.step",
            {reference.reference for reference in closure.library_references},
        )
        self.assertEqual(closure.non_hermetic_reasons(), [])

    def test_a_staged_host_model_is_what_the_board_names(self) -> None:
        host = self.root / "staged-models"
        host.mkdir()
        model = host / "part.step"
        model.write_bytes(b"hashed bytes\n")
        reference = "${MODELS}/part.step"
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"payload\n")
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) (footprint "R" (model "' + reference + '")))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "staged host model")

        def build(name: str, stage: Path | None) -> object:
            return materialize_with_fixture(
                self.repo,
                commit,
                self.root / name,
                relative_path="hardware/board",
                model_env={"MODELS": str(host)},
                model_stage=stage,
            )

        stage = self.root / "stage"
        staged = build("staged", stage)
        digest = hashlib.sha256(b"hashed bytes\n").hexdigest()
        copy = stage / digest / "part.step"
        self.assertEqual(copy.read_bytes(), b"hashed bytes\n")
        board = (self.root / "staged/hardware/board/board.kicad_pcb").read_text()
        self.assertIn(f'(model "{copy}")', board)
        # The host file changing after the hash cannot reach the tools.
        model.write_bytes(b"changed later\n")
        self.assertEqual(copy.read_bytes(), b"hashed bytes\n")
        # Staging changes nothing in the record.
        model.write_bytes(b"hashed bytes\n")
        self.assertEqual(build("unstaged", None).digest, staged.digest)
        self.assertNotIn(str(stage), str(staged.to_dict()))
        # The rewritten board never ships: a board has no canonicalizer, so it
        # cannot become a dossier member.
        from app.release_studio.dossier import DossierError, canonicalizer_for

        with self.assertRaises(DossierError):
            canonicalizer_for("hardware/board/board.kicad_pcb", "")
        # The read-only copies go with the job's staging directory.
        shutil.rmtree(stage)
        self.assertFalse(stage.exists())

    def test_a_model_missing_from_the_closure_is_advisory_not_a_blocker(self) -> None:
        # Boards routinely carry stale `(model ...)` paths whose case or
        # extension no longer matches the file on disk.  No Stage 1 step reads
        # them, so they are reported and do not block a release.
        self.repo.joinpath("hardware/board/model.step").write_bytes(
            b"small hydrated STEP payload\n"
        )
        self.repo.joinpath("hardware/board/board.kicad_pcb").write_text(
            '(kicad_pcb (version 20240108) '
            '(general (thickness 1.6)) '
            '(model "${KIPRJMOD}/packages3D/Absent.STEP"))\n',
            encoding="utf-8",
        )
        commit = commit_all(self.repo, "stale model path")

        closure = materialize_with_fixture(
            self.repo,
            commit,
            self.root / "stale-model",
            relative_path="hardware/board",
        )

        self.assertEqual(closure.non_hermetic_reasons(), [])
        advisory = closure.advisory_references
        self.assertEqual(len(advisory), 1)
        self.assertEqual(advisory[0].location, "missing")
        notes = closure.advisory_reasons()
        self.assertEqual(len(notes), 1)
        self.assertIn("is not present in the release closure", notes[0])
        self.assertIn("Absent.STEP", notes[0])

    def test_only_this_designs_files_are_scanned_for_path_references(self) -> None:
        """An archived revision's stale paths are not defects in this release.

        Scanning every KiCad file in the repository made a project's own
        `archive/` directory the source of most of its hermeticity findings --
        for boards that are not in the release and are not built.
        """

        board = self.repo / "hardware/board"
        board.joinpath("model.step").write_bytes(b"small hydrated STEP payload\n")

        # An archived board and its schematic, both carrying an unresolvable
        # library path of the kind that used to fail the whole closure.
        archive = board / "archive/rev-a"
        archive.mkdir(parents=True, exist_ok=True)
        for name in ("old.kicad_pcb", "old.kicad_sch"):
            archive.joinpath(name).write_text(
                '(kicad_pcb (lib (uri "${NOT_BOUND_ANYWHERE}/gone.pretty")))\n',
                encoding="utf-8",
            )

        # The design itself: a root schematic pointing into `Subsheets/`, one
        # of which points on to a third sheet.
        board.joinpath("board.kicad_sch").write_text(
            '(kicad_sch (sheet (property "Sheetfile" "Subsheets/power.kicad_sch")))\n',
            encoding="utf-8",
        )
        subsheets = board / "Subsheets"
        subsheets.mkdir(parents=True, exist_ok=True)
        subsheets.joinpath("power.kicad_sch").write_text(
            '(kicad_sch (sheet (property "Sheetfile" "regulator.kicad_sch")))\n',
            encoding="utf-8",
        )
        subsheets.joinpath("regulator.kicad_sch").write_text(
            '(kicad_sch (model "${KIPRJMOD}/model.step"))\n', encoding="utf-8"
        )
        # Filed with its siblings but not instantiated: still part of the design.
        subsheets.joinpath("detached.kicad_sch").write_text(
            '(kicad_sch (model "${KIPRJMOD}/model.step"))\n', encoding="utf-8"
        )
        commit = commit_all(self.repo, "archive and hierarchy")

        closure = materialize_with_fixture(
            self.repo, commit, self.root / "scoped", relative_path="hardware/board"
        )

        # The archived revision contributed nothing at all.
        self.assertEqual(closure.non_hermetic_reasons(), [])
        sources = {reference.source_path for reference in closure.library_references}
        self.assertFalse(
            {path for path in sources if "archive/" in path},
            f"an archived revision was scanned: {sources}",
        )
        # The design's own hierarchy was.
        self.assertIn("hardware/board/Subsheets/regulator.kicad_sch", sources)
        self.assertIn("hardware/board/Subsheets/detached.kicad_sch", sources)

    def test_symlink_and_regular_file_are_distinct_closure_inputs(self) -> None:
        repository = self.root / "link-repo"
        init_repo(repository)
        (repository / "payload.txt").write_text("same bytes", encoding="utf-8")
        (repository / "entry.txt").write_text("payload.txt", encoding="utf-8")
        regular_commit = commit_all(repository, "regular entry")
        (repository / "entry.txt").unlink()
        (repository / "entry.txt").symlink_to("payload.txt")
        symlink_commit = commit_all(repository, "symlink entry")

        regular = materialize_with_fixture(
            repository, regular_commit, self.root / "regular"
        )
        symlink = materialize_with_fixture(
            repository, symlink_commit, self.root / "symlink"
        )

        self.assertNotEqual(regular.input_closure_digest, symlink.input_closure_digest)
        regular_entry = next(item for item in regular.repository_inputs if item.path == "entry.txt")
        symlink_entry = next(item for item in symlink.repository_inputs if item.path == "entry.txt")
        self.assertEqual(regular_entry.type, "regular_file")
        self.assertEqual(symlink_entry.type, "symlink")
        self.assertEqual(regular_entry.git_object_id, symlink_entry.git_object_id)
        self.assertEqual(regular_entry.materialized_digest, symlink_entry.materialized_digest)
        self.assertTrue((self.root / "symlink/entry.txt").is_symlink())

    def test_explicit_toolchain_resource_is_a_stable_allowed_path(self) -> None:
        toolchain = self.root / "pinned-kicad/footprints"
        (toolchain / "Common.pretty").mkdir(parents=True)
        (toolchain / "Common.pretty/common.kicad_mod").write_text(
            "(footprint toolchain)", encoding="utf-8"
        )
        self.repo.joinpath("hardware/board/model.step").write_bytes(b"small hydrated STEP payload\n")
        self.repo.joinpath("hardware/board/fp-lib-table").write_text(
            '(fp_lib_table (version 7) '
            '(lib (name "Pinned") (type "KiCad") '
            '(uri "${KICAD10_FOOTPRINT_DIR}/Common.pretty") '
            '(options "") (descr "")))\n',
            encoding="utf-8",
        )
        resource_digest = resource_root_digest(toolchain)
        self.assertTrue(resource_digest)
        copied_toolchain = self.root / "pinned-kicad-copy/footprints"
        shutil.copytree(toolchain, copied_toolchain)
        pinned_commit = commit_all(self.repo, "pinned resource")
        closure = materialize_with_fixture(
            self.repo,
            pinned_commit,
            self.root / "pinned-closure",
            relative_path="hardware/board",
            toolchain_resources={
                "KICAD10_FOOTPRINT_DIR": PinnedToolchainResource(
                    "KICAD10_FOOTPRINT_DIR", toolchain, resource_digest
                )
            },
        )
        copied_closure = materialize_with_fixture(
            self.repo,
            pinned_commit,
            self.root / "pinned-closure-copy",
            relative_path="hardware/board",
            toolchain_resources={
                "KICAD10_FOOTPRINT_DIR": {
                    "root": copied_toolchain,
                    "digest": resource_digest,
                }
            },
        )
        self.assertEqual(closure.input_closure_digest, copied_closure.input_closure_digest)
        self.assertEqual(closure.to_dict(), copied_closure.to_dict())
        self.assertEqual(closure.toolchain_resources[0].digest, resource_digest)
        self.assertIn(
            "toolchain:KICAD10_FOOTPRINT_DIR/Common.pretty",
            {reference.resolved_path for reference in closure.library_references},
        )
        self.assertEqual(closure.env_bindings[0].value, "toolchain:KICAD10_FOOTPRINT_DIR")

        (toolchain / "Common.pretty/common.kicad_mod").write_text(
            "(footprint mutated)", encoding="utf-8"
        )
        with self.assertRaisesRegex(ClosureError, "digest mismatch"):
            materialize_with_fixture(
                self.repo,
                pinned_commit,
                self.root / "pinned-closure-mutated",
                relative_path="hardware/board",
                toolchain_resources={
                    "KICAD10_FOOTPRINT_DIR": {
                        "root": toolchain,
                        "digest": resource_digest,
                    }
                },
            )

        with self.assertRaisesRegex(ClosureError, "no pinned digest"):
            materialize_with_fixture(
                self.repo,
                pinned_commit,
                self.root / "pinned-closure-invalid",
                relative_path="hardware/board",
                toolchain_resources={
                    "KICAD10_FOOTPRINT_DIR": PinnedToolchainResource(
                        "KICAD10_FOOTPRINT_DIR", toolchain, ""
                    )
                },
            )

    def _status(self, path: Path) -> str:
        return git(path, "status", "--porcelain")

    def _blob_sha(self, commit: str) -> str:
        return git(
            self.repo,
            "rev-parse",
            f"{commit}:hardware/board/model.step",
        ).strip()

    def lfs_pointer(self) -> bytes:
        payload = b"small hydrated STEP payload\n"
        return (
            "version https://git-lfs.github.com/spec/v1\n"
            f"oid sha256:{hashlib.sha256(payload).hexdigest()}\n"
            f"size {len(payload)}\n"
        ).encode("ascii")


if __name__ == "__main__":
    unittest.main()


class ModelNodeRewriteTests(unittest.TestCase):
    def test_a_token_unquotes_as_the_closure_reader_reads_it(self) -> None:
        from kicad_monkey import parse_sexp

        for token in (
            "/abs/part.step",
            '"plain.step"',
            '"C:\\\\models\\\\part.step"',
            '"a \\"quoted\\" name.step"',
            '"tab\\there.step"',
            '"keep\\(this.step"',
        ):
            with self.subTest(token):
                self.assertEqual(
                    closure_models.unquote_token(token),
                    str(parse_sexp(f"(model {token})")[1]),
                )

    def test_escaped_references_are_rewritten_and_misses_are_logged(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            board = Path(directory) / "board.kicad_pcb"
            board.write_text(
                '(kicad_pcb (footprint "R" (model "dir\\\\a \\"b\\".step") (offset (xyz 0 0 0))) '
                "(footprint \"C\" (model bare.step)))\n",
                encoding="utf-8",
            )
            with self.assertLogs(closure_models.logger, level="WARNING") as logs:
                count = closure_models.rewrite_model_references(
                    board,
                    {
                        'dir\\a "b".step': '/stage/x/a "b".step',
                        "bare.step": "/stage/y/bare.step",
                        "absent.step": "/stage/z/absent.step",
                    },
                )
            self.assertEqual(count, 2)
            text = board.read_text(encoding="utf-8")
            self.assertIn('(model "/stage/x/a \\"b\\".step") (offset', text)
            self.assertIn('(model "/stage/y/bare.step")', text)
            self.assertIn("absent.step", "\n".join(logs.output))
            self.assertIn("board.kicad_pcb", "\n".join(logs.output))


class PathReferenceDiscriminationTests(unittest.TestCase):
    """KiCad text variables are not library paths.

    A real board substitutes built-in *text* variables into field and
    drawing-sheet content. Treating a bare ``${DNP}`` as a library path failed
    the closure closed on boards that are perfectly hermetic, which is the
    worst kind of false negative: it blocks a correct release.
    """

    def test_builtin_text_variables_are_not_path_references(self) -> None:
        from app.release_studio.closure_references import is_path_reference

        for value in (
            "${DNP}",
            "${REFERENCE}",
            "${VALUE}",
            "${FOOTPRINT}",
            "${DATASHEET}",
            "${ISSUE_DATE}",
            "${COMMENT1}",
            "${SHEETNAME}",
            "${SHEETPATH}",
            "${PROJECTNAME}",
            "${DNP} not fitted",
            # KiCad binds this itself for a special_execute job and it names an
            # output directory, so it can never resolve into the closure.
            "${JOBSET_OUTPUT_WORK_PATH}",
            "${JOBSET_OUTPUT_WORK_PATH}/archive.zip",
        ):
            with self.subTest(value=value):
                self.assertFalse(is_path_reference(value))

    def test_genuine_path_references_are_still_detected(self) -> None:
        from app.release_studio.closure_references import is_path_reference

        for value in (
            "${KIPRJMOD}",
            "${KIPRJMOD}/../../common/footprints",
            "${KICAD10_FOOTPRINT_DIR}",
            "${KICAD10_3DMODEL_DIR}/Resistor_SMD.3dshapes",
            "${MY_LIBRARY_PATH}",
            "some/relative/${VAR}/path",
        ):
            with self.subTest(value=value):
                self.assertTrue(is_path_reference(value))

    def test_a_board_using_text_variables_still_closes(self) -> None:
        """End to end: a DNP-annotated board must not be rejected."""

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = root / "repo"
            init_repo(repo)
            (repo / "board.kicad_pcb").write_text(
                '(kicad_pcb (version 20240108)\n'
                '  (property "Reference" "${REFERENCE}")\n'
                '  (property "Fitted" "${DNP}")\n'
                '  (gr_text "Issued ${ISSUE_DATE}")\n'
                ')\n',
                encoding="utf-8",
            )
            commit = commit_all(repo, "board with text variables")

            closure = materialize_with_fixture(repo, commit, root / "out")
            self.assertTrue(closure.input_closure_digest)
            self.assertEqual(closure.library_references, ())

    def test_a_jobset_special_execute_command_does_not_break_the_closure(self) -> None:
        """The reference jobset's plugin command must not fail a hermetic board.

        `Outputs.kicad_jobset` invokes InteractiveHtmlBom through
        `${KICAD9_3RD_PARTY}` inside a `special_execute` command that none of
        its outputs reference. Those paths belong to the command, not to the
        project, and R1 already classifies the job by type.
        """

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = root / "repo"
            init_repo(repo)
            (repo / "board.kicad_pcb").write_text("(kicad_pcb (version 20240108))\n")
            (repo / "Outputs.kicad_jobset").write_text(
                '{"jobs": [{"id": "x", "type": "special_execute", "settings": '
                '{"command": "python \\"${KICAD9_3RD_PARTY}plugins/ibom.py\\" '
                '--dest-dir \\"${JOBSET_OUTPUT_WORK_PATH}.\\""}}], "outputs": []}\n'
            )
            commit = commit_all(repo, "jobset with a plugin command")

            closure = materialize_with_fixture(repo, commit, root / "out")
            self.assertTrue(closure.input_closure_digest)
            self.assertIn(
                "Outputs.kicad_jobset", {item.path for item in closure.repository_inputs}
            )
