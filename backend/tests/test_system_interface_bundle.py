"""WP-C4a: the System Builder interface from the bundle member (flag ``SYSTEM_BUILDER``).

The artifact of a project at a commit is built from
``projections/system-interface.json`` (``prism.system_interface.v1``) when
``PRISM_DESIGN_SOURCE_SYSTEM_BUILDER=bundle``: the member plus the envelope the
projection cannot carry, so every reader sees today's payload and digest. Two
things are pinned here.

**Parity.** On the committed parity cases whose sources the bundle did not
upgrade, the golden member is exactly what ``prism-kicad`` writes for the
committed bytes, so mapping it must give the same artifact today's
``extract_interface`` computes from those files — the same ``digest``, and the
same whole payload but for the documented ``extractor.kicadMonkeyVersion``.

**The switch.** ``legacy`` never opens a bundle, ``bundle`` with a ready member
uses it, a member that is pending or final-but-not-ready keeps today's answer,
and a working tree never opens a bundle.
"""

from __future__ import annotations

import json
import unittest
from contextlib import contextmanager
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

from app.core.config import settings
from app.services.design_bundle import consumer
from app.services.design_bundle.manifest import Readiness
from app.services.systems import interface_extractor as ie

REPO = Path(__file__).resolve().parents[2]
GOLDENS = REPO / "native" / "parity" / "goldens"
MEMBER = "projections/system-interface.json"
SHA = "c" * 40

#: WP-C4a's acceptance list: parity cases whose sources were not upgraded, so
#: their golden is the member for the committed bytes (task WP-C4a). ``dv-malformed``
#: is excluded because today's extractor refuses it and writes no member.
NON_UPGRADED = (
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

#: A minimal ``prism.system_interface.v1`` member: enough for the envelope rules.
MEMBER_DOCUMENT = {
    "schema": "prism.system_interface.v1",
    "hasPcb": False,
    "boardThicknessMm": None,
    "boardOutlineMm": None,
    "components": [],
    "diagnostics": [],
    "digest": "sha256:" + "a" * 64,
}


def _fixtures_by_id() -> dict[str, dict]:
    document = json.loads(
        (REPO / "native" / "parity" / "fixtures.json").read_text(encoding="utf-8")
    )
    return {case["id"]: case for case in document["fixtures"]}


def _without_kicad_monkey_version(payload: dict) -> dict:
    """Today's payload without the one envelope field the bundle's generator replaces."""

    trimmed = dict(payload)
    trimmed["extractor"] = {"version": payload["extractor"]["version"]}
    return trimmed


class ParityTests(unittest.TestCase):
    """The member maps to what today's extractor computes on the same sources."""

    def test_mapping_reproduces_today_extractor_on_every_fixture(self) -> None:
        fixtures = _fixtures_by_id()
        for case_id in NON_UPGRADED:
            with self.subTest(case=case_id):
                self.assertIn(case_id, fixtures)
                case = fixtures[case_id]
                project_file = (REPO / case["sourceRoot"] / case["project"]).resolve()
                snapshot = SimpleNamespace(
                    root=project_file.parent, project_file=project_file, commit=None
                )
                today = ie.extract_interface(
                    project_file,
                    project_id="prj_parity",
                    commit=None,
                    design=ie.load_configured_design(snapshot),
                )
                member = json.loads(
                    (GOLDENS / case_id / "system-interface.json").read_text(encoding="utf-8")
                )
                derived = ie.interface_from_member(
                    member,
                    project_id="prj_parity",
                    commit=None,
                    kicad_monkey_version="bundle-generator",
                )
                self.assertEqual(derived["extractor"]["version"], ie.EXTRACTOR_VERSION)
                self.assertEqual(derived["digest"], today["digest"])
                self.assertEqual(ie.interface_digest(derived), derived["digest"])
                self.assertEqual(
                    _without_kicad_monkey_version(derived),
                    _without_kicad_monkey_version(today),
                )


class _Opened:
    """The parts of ``reader.OpenedRevision`` that ``bundle_read`` and the mapping touch."""

    def __init__(
        self, states: dict[str, str], member: dict | None = None, *, engine_version: str | None = None
    ) -> None:
        self.absent = False
        self._states = states
        self._member = member
        self.archive = (
            SimpleNamespace(manifest={"generator": {"engine_version": engine_version}})
            if engine_version
            else None
        )

    def readiness(self, paths):
        return {
            path: Readiness(path, self._states.get(path, "pending"), "parse", "why") for path in paths
        }

    def read_json(self, path):
        return self._member


def _read(source: str, opened: _Opened, commit: str | None = SHA):
    with mock.patch.object(settings, "PRISM_DESIGN_SOURCE_SYSTEM_BUILDER", source), \
            mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision:
        payload = ie.interface_from_bundle("prj-1", commit)
    return payload, open_revision


class BundleReadTests(unittest.TestCase):
    """``interface_from_bundle``'s switch and fallback policy."""

    def test_legacy_never_opens_the_bundle(self) -> None:
        payload, open_revision = _read("legacy", _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT))
        self.assertIsNone(payload)
        open_revision.assert_not_called()

    def test_a_ready_member_becomes_today_envelope(self) -> None:
        opened = _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT, engine_version="2026.9.7")
        payload, open_revision = _read("bundle", opened)

        open_revision.assert_called_once_with("prj-1", SHA, queue=True, requested_by="")
        self.assertEqual(list(payload), [
            "schema", "projectId", "commit", "extractor", "hasPcb",
            "boardThicknessMm", "boardOutlineMm", "components", "diagnostics", "digest",
        ])
        self.assertEqual(payload["projectId"], "prj-1")
        self.assertEqual(payload["commit"], SHA)
        self.assertEqual(payload["extractor"], {"version": "8", "kicadMonkeyVersion": "2026.9.7"})
        self.assertEqual(payload["digest"], MEMBER_DOCUMENT["digest"])

    def test_a_member_without_a_generator_falls_back_to_the_installed_version(self) -> None:
        payload, _ = _read("bundle", _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT))
        self.assertEqual(payload["extractor"]["kicadMonkeyVersion"], ie._kicad_monkey_version())

    def test_a_member_that_is_not_ready_falls_back(self) -> None:
        for state in ("pending", "unavailable", "failed", "skipped", "not-applicable"):
            with self.subTest(state=state):
                payload, open_revision = _read("bundle", _Opened({MEMBER: state}, MEMBER_DOCUMENT))
                open_revision.assert_called_once()
                self.assertIsNone(payload)

    def test_an_unreadable_member_falls_back(self) -> None:
        opened = _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT)
        opened.read_json = mock.Mock(side_effect=ValueError("member-digest-mismatch"))
        payload, open_revision = _read("bundle", opened)
        open_revision.assert_called_once()
        self.assertIsNone(payload)

    def test_a_working_tree_never_opens_the_bundle(self) -> None:
        for commit in (None, ""):
            with self.subTest(commit=commit):
                payload, open_revision = _read(
                    "bundle", _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT), commit=commit
                )
                self.assertIsNone(payload)
                open_revision.assert_not_called()


class ExtractForRevisionTests(unittest.TestCase):
    """``extract_for_revision`` chooses the bundle before it extracts the sources."""

    @contextmanager
    def _snapshot(self, project, commit):
        yield SimpleNamespace(
            root=Path("/snapshot"), project_file=Path("/snapshot/p.kicad_pro"), commit=commit
        )

    def _extract(self, source: str, opened: _Opened, commit: str | None = SHA):
        project = SimpleNamespace(id="prj-1")
        with mock.patch.object(settings, "PRISM_DESIGN_SOURCE_SYSTEM_BUILDER", source), \
                mock.patch.object(consumer.reader, "open_revision", return_value=opened) as open_revision, \
                mock.patch.object(ie, "extract_interface", return_value={"legacy": True}) as extract, \
                mock.patch.object(ie, "load_configured_design", return_value=None), \
                mock.patch("app.services.project_source_snapshot.project_source_snapshot", new=self._snapshot):
            result = ie.extract_for_revision(project, commit)
        return result, open_revision, extract

    def test_a_ready_member_is_used_without_extracting(self) -> None:
        opened = _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT, engine_version="2026.9.7")
        result, open_revision, extract = self._extract("bundle", opened)

        extract.assert_not_called()
        self.assertEqual(result["projectId"], "prj-1")
        self.assertEqual(result["commit"], SHA)

    def test_a_member_that_is_not_ready_extracts(self) -> None:
        result, open_revision, extract = self._extract(
            "bundle", _Opened({MEMBER: "pending"}, MEMBER_DOCUMENT)
        )

        extract.assert_called_once()
        self.assertEqual(result, {"legacy": True})

    def test_the_legacy_switch_extracts(self) -> None:
        result, open_revision, extract = self._extract(
            "legacy", _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT)
        )

        open_revision.assert_not_called()
        extract.assert_called_once()
        self.assertEqual(result, {"legacy": True})

    def test_a_working_tree_extracts_and_never_opens_a_bundle(self) -> None:
        result, open_revision, extract = self._extract(
            "bundle", _Opened({MEMBER: "ready"}, MEMBER_DOCUMENT), commit=None
        )

        open_revision.assert_not_called()
        extract.assert_called_once()
        self.assertEqual(result, {"legacy": True})


if __name__ == "__main__":
    unittest.main()
