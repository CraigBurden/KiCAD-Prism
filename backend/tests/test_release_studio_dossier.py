"""R7/R10 acceptance: evidence capture, dossier assembly, and reproducibility.

The step runner is faked so the whole pipeline — canonicalize, fingerprint,
manifest, package — is exercised in the default gate.  The fake writes the
byte shapes KiCad 10.0.4 actually emits, including the wall-clock stamps, so
the reproducibility assertion here is meaningful rather than trivially true.
"""

from __future__ import annotations

import json
import sys
import tarfile
import io
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:  # pragma: no cover - import bootstrap
    sys.path.insert(0, str(REPO_ROOT))

from app.release_studio import dossier as dossier_module  # noqa: E402
from app.release_studio.dossier import (  # noqa: E402
    DossierError,
    assemble,
    assert_no_governance_leak,
    compute_dossier_digest,
)
from app.release_studio.steps import (  # noqa: E402
    STEP_BY_ID,
    evidence_counts,
    run_step_catalogue,
)


GERBER = (
    "%TF.GenerationSoftware,KiCad,Pcbnew,10.0.4*%\n"
    "%TF.CreationDate,{stamp}*%\n"
    "%FSLAX46Y46*%\n"
    "G04 Created by KiCad (PCBNEW 10.0.4) date {plain}*\n"
    "%MOMM*%\n%ADD10C,0.200000*%\nD10*\nX1000Y1000D02*\nX2000Y2000D01*\nM02*\n"
)
DRILL = (
    "M48\n; DRILL file KiCad 10.0.4 date {stamp}\n"
    "; #@! TF.CreationDate,{stamp}\nFMAT,2\nMETRIC\nT1C0.300\n%\nG90\nT1\nX10.0Y10.0\nM30\n"
)
POSITIONS = (
    "### Footprint positions - created on {stamp} ###\n"
    "# Ref,Val,Package,PosX,PosY,Rot,Side\n"
    "R1,10k,R_0402,10.000000,-10.000000,90.000000,top\n"
)
BOM = "Reference,Value,Footprint,Qty\nR1,10k,R_0402,1\n"
DRC = {
    "$schema": "https://schemas.kicad.org/drc.v1.json",
    "date": "{stamp}",
    "source": "board.kicad_pcb",
    "violations": [
        {"type": "clearance", "severity": "error", "description": "Clearance violation"},
        {"type": "silk_overlap", "severity": "warning", "description": "Silkscreen overlap"},
    ],
    "unconnected_items": [],
    "schematic_parity": [],
}
ERC = {
    "$schema": "https://schemas.kicad.org/erc.v1.json",
    "date": "{stamp}",
    "sheets": [
        {"violations": [{"type": "pin_not_connected", "severity": "warning", "description": "NC"}]}
    ],
}
STATS = {"metadata": {"date": "{stamp}"}, "drill": {"total": 12}, "layers": 2}


def _member_fields(member) -> dict:
    return {
        "path": member.path,
        "member_kind": member.member_kind,
        "media_type": member.media_type,
        "size_bytes": member.size_bytes,
        "released_digest": member.released_digest,
        "source_raw_digest": member.source_raw_digest,
        "canonicalizer": member.canonicalizer,
        "domains": member.domains,
        "step_id": member.step_id,
    }


def _fake_runner(stamp: str, plain: str):
    """Return a runner that writes what the requested step would have written."""

    def run(argv, cwd, timeout_seconds):  # noqa: ARG001 - signature is the contract
        out = Path(argv[argv.index("--output") + 1])
        text = lambda body: body.format(stamp=stamp, plain=plain)  # noqa: E731
        jdump = lambda payload: json.dumps(payload).replace("{stamp}", stamp)  # noqa: E731
        if argv[1:3] == ["export", "gerbers"] or argv[2:4] == ["export", "gerbers"]:
            out.mkdir(parents=True, exist_ok=True)
            (out / "board-F_Cu.gbr").write_text(text(GERBER))
            (out / "board-B_Cu.gbr").write_text(text(GERBER))
            (out / "board-job.gbrjob").write_text(
                json.dumps({"GeneralSpecs": {"CreationDate": stamp, "ProjectId": {"Name": "b"}}})
            )
        elif "drill" in argv:
            out.mkdir(parents=True, exist_ok=True)
            (out / "board-PTH.drl").write_text(text(DRILL))
        elif "pos" in argv:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text(POSITIONS))
        elif "bom" in argv:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(BOM)
        elif "drc" in argv:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(jdump(DRC))
        elif "erc" in argv:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(jdump(ERC))
        elif "stats" in argv:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(jdump(STATS))
        else:
            # pdf steps are optional; report failure so the optional path runs
            return type("R", (), {"returncode": 1, "stdout": "", "stderr": "no pdf here"})()
        return type("R", (), {"returncode": 0, "stdout": "", "stderr": ""})()

    return run


class ReleaseStudioDossierTests(unittest.TestCase):
    def setUp(self) -> None:
        self._tmp = tempfile.TemporaryDirectory()
        self.root = Path(self._tmp.name)
        self.addCleanup(self._tmp.cleanup)
        self.closure = self.root / "closure"
        (self.closure / "hardware").mkdir(parents=True)
        (self.closure / "hardware/board.kicad_pcb").write_text("(kicad_pcb)")
        (self.closure / "hardware/board.kicad_sch").write_text("(kicad_sch)")

    def _build(self, stamp: str, plain: str, out_name: str):
        output_root = self.root / out_name
        output_root.mkdir()
        outputs = run_step_catalogue(
            closure_root=self.closure,
            board_rel="hardware/board.kicad_pcb",
            schematic_rel="hardware/board.kicad_sch",
            output_root=output_root,
            variant="default",
            cli_path="/usr/bin/true",
            runner=_fake_runner(stamp, plain),
        )
        return assemble(
            outputs=outputs,
            commit_sha="a" * 40,
            variant="default",
            config_key="default",
            technical_config_digest="c" * 64,
            input_closure_digest="d" * 64,
            toolchain={"kicad_version": "10.0.4", "executor_image": "sha256:e"},
            toolchain_digest="t" * 64,
            build_key="b" * 64,
            config_fragments={"board": "hardware/board.kicad_pcb"},
        )

    # -- Stage 1 exit criterion 1 ------------------------------------------

    def test_two_builds_at_different_times_are_semantically_identical(self) -> None:
        early = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        later = self._build("2026-08-11T09:41:12+00:00", "2026-08-11 09:41:12", "b")

        self.assertEqual(early.dossier_digest, later.dossier_digest)
        self.assertEqual(early.manifest_digest, later.manifest_digest)
        self.assertEqual(early.dossier_bytes, later.dossier_bytes)
        for member in early.members:
            other = later.member_by_path(member.path)
            self.assertIsNotNone(other, member.path)
            self.assertEqual(member.released_digest, other.released_digest, member.path)

        # ...and the raw bytes really did differ for the timestamp-bearing set,
        # otherwise the assertion above would be vacuous.
        stamped = {
            member.path
            for member in early.members
            if member.canonicalizer in {"gerber", "excellon", "gbrjob"}
        }
        self.assertTrue(stamped)
        differing = {
            member.path
            for member in early.members
            if member.source_raw_digest != later.member_by_path(member.path).source_raw_digest
        }
        self.assertTrue(stamped <= differing, f"raw bytes did not differ for {stamped - differing}")

    def test_dossier_is_a_deterministic_archive_containing_its_manifest(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        with tarfile.open(fileobj=io.BytesIO(built.dossier_bytes), mode="r:gz") as tar:
            names = sorted(tar.getnames())
            manifest = json.loads(tar.extractfile("manifest.json").read().decode())
            for info in tar.getmembers():
                self.assertEqual(info.mtime, 0)
                self.assertEqual((info.uid, info.gid), (0, 0))
        self.assertIn("manifest.json", names)
        self.assertEqual(manifest["dossier_digest"], built.dossier_digest)
        # The manifest never contains its own digest.
        self.assertNotIn("manifest_digest", manifest)
        for member in built.members:
            self.assertIn(member.path, names)

    def test_manifest_excludes_every_governance_field(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        assert_no_governance_leak(built.manifest)
        leaked = dict(built.manifest)
        leaked["policy_binding_digest"] = "x" * 64
        with self.assertRaisesRegex(DossierError, "policy_binding_digest"):
            assert_no_governance_leak(leaked)
        nested = {"members": {"a.gbr": {"approver": "someone"}}}
        with self.assertRaisesRegex(DossierError, "approver"):
            assert_no_governance_leak(nested)

    def test_raw_bytes_are_retained_outside_the_dossier(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        with tarfile.open(fileobj=io.BytesIO(built.evidence_bytes), mode="r:gz") as tar:
            names = tar.getnames()
            raw = tar.extractfile("raw/fabrication/gerbers/board-F_Cu.gbr").read().decode()
            evidence = json.loads(tar.extractfile("build-evidence.json").read().decode())
        self.assertIn("TF.CreationDate", raw, "build evidence must keep pre-canonical bytes")
        self.assertEqual(evidence["manifest_digest"], built.manifest_digest)
        self.assertTrue(any(name.startswith("raw/") for name in names))

    # -- domains and fingerprints ------------------------------------------

    def test_members_are_mapped_to_governed_domains(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        by_path = {member.path: member.domains for member in built.members}
        self.assertEqual(by_path["fabrication/gerbers/board-F_Cu.gbr"], ("bare_board",))
        self.assertEqual(by_path["assembly/positions.csv"], ("assembly",))
        self.assertEqual(by_path["evidence/drc.json"], ("evidence",))
        self.assertEqual(
            sorted(built.fingerprints), ["assembly", "bare_board", "evidence"]
        )

    def test_domain_fingerprint_moves_only_with_its_own_members(self) -> None:
        """An assembly-only change must not disturb the bare-board fingerprint.

        This is the mechanism behind the R17 carry-forward table: a variant
        population change alters the position file and nothing else, so the
        fabrication approval survives while the assembly approval does not.
        """

        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        mutated = tuple(
            member
            if member.path != "assembly/positions.csv"
            else dossier_module.Member(
                **{**_member_fields(member), "released_digest": "9" * 64}
            )
            for member in built.members
        )

        def fingerprint(domain: str, members) -> str:
            return dossier_module.technical_scope_fingerprint(
                domain,
                members,
                toolchain_digest="t" * 64,
                normalized_argv={},
                config_fragments={},
            )["fingerprint"]

        self.assertNotEqual(
            fingerprint("assembly", built.members), fingerprint("assembly", mutated)
        )
        self.assertEqual(
            fingerprint("bare_board", built.members), fingerprint("bare_board", mutated)
        )

    def test_dossier_digest_is_order_independent(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        self.assertEqual(
            compute_dossier_digest(built.members),
            compute_dossier_digest(list(reversed(built.members))),
        )

    # -- evidence ----------------------------------------------------------

    def test_failing_drc_produces_evidence_rather_than_aborting(self) -> None:
        built = self._build("2026-08-11T07:00:00+00:00", "2026-08-11 07:00:00", "a")
        by_kind = {record["kind"]: record for record in built.evidence}
        self.assertEqual(sorted(by_kind), ["drc", "erc"])
        self.assertEqual(by_kind["drc"]["counts"]["error"], 1)
        self.assertEqual(by_kind["drc"]["counts"]["warning"], 1)
        self.assertEqual(by_kind["drc"]["counts"]["total"], 2)
        self.assertEqual(by_kind["erc"]["counts"]["total"], 1)
        self.assertEqual(
            by_kind["drc"]["report_digest"],
            built.member_by_path("evidence/drc.json").released_digest,
        )

    def test_evidence_counts_folds_every_kicad_violation_container(self) -> None:
        counts = evidence_counts(
            {
                "violations": [{"severity": "error"}],
                "unconnected_items": [{"severity": "warning"}],
                "schematic_parity": [{"severity": "error"}],
                "sheets": [{"violations": [{"severity": "exclusion"}]}],
            }
        )
        self.assertEqual(counts, {"error": 2, "warning": 1, "exclusion": 1, "total": 4})

    def test_every_protel_gerber_extension_resolves_to_the_gerber_canonicalizer(self) -> None:
        # Transcribed from the pinned KiCad 10.0.4 source,
        # `pcbnew/pcbplot.cpp:44` `GetGerberProtelExtension`.  A jobset with
        # Protel extensions enabled emits these, and a gap fails the build only
        # once real fabrication artwork reaches canonicalization.
        protel = [
            "gtl", "gbl",              # F_Cu, B_Cu
            "gta", "gba",              # F_Adhes, B_Adhes
            "gto", "gbo",              # F_SilkS, B_SilkS
            "gts", "gbs",              # F_Mask, B_Mask
            "gtp", "gbp",              # F_Paste, B_Paste
            "gm1",                     # Edge_Cuts
            "gbr",                     # the documented default
        ]
        for extension in protel:
            with self.subTest(extension=extension):
                self.assertEqual(
                    dossier_module.canonicalizer_for(f"fabrication/board.{extension}", ""),
                    "gerber",
                )

        # Inner copper is `g` + the copper layer ordinal, so it has no fixed
        # extension and cannot be enumerated in a static table.
        for ordinal in (1, 2, 9, 30):
            with self.subTest(inner=ordinal):
                self.assertEqual(
                    dossier_module.canonicalizer_for(f"fabrication/board.g{ordinal}", ""),
                    "gerber",
                )

    def test_unknown_member_type_fails_closed(self) -> None:
        with self.assertRaisesRegex(DossierError, "no canonicalizer registered"):
            dossier_module.canonicalizer_for("fabrication/mystery.xyz", "")

    def test_catalogue_step_types_are_all_known_to_the_jobset_registry(self) -> None:
        from app.release_studio.jobset import KICAD_10_0_4_JOB_TYPES

        for spec in STEP_BY_ID.values():
            self.assertIn(spec.step_type, KICAD_10_0_4_JOB_TYPES, spec.step_id)


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
