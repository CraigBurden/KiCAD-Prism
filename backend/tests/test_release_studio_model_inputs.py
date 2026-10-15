"""A candidate's 3D model inputs: the rows kept, self-containment, acknowledgement."""

from __future__ import annotations

import unittest
from types import SimpleNamespace

from app.core.errors import DomainError
from app.release_studio.closure import ResolvedLibraryPath
from app.services import release_studio_model_inputs as model_inputs


def _closure(*references: ResolvedLibraryPath) -> SimpleNamespace:
    return SimpleNamespace(library_references=references)


BOARD = "hw/board.kicad_pcb"


class ModelInputTests(unittest.TestCase):
    def test_only_model_references_become_rows(self) -> None:
        rows = model_inputs.closure_model_rows(
            _closure(
                ResolvedLibraryPath(BOARD, "${MODELS}/a.step", "", "host", digest="f" * 64),
                ResolvedLibraryPath("fp-lib-table", "${LIBS}/x.pretty", "", "external"),
                ResolvedLibraryPath(BOARD, "b.wrl", "", "substitutable"),
            )
        )
        self.assertEqual(
            [(row["reference"], row["location"], row["digest"]) for row in rows],
            [("${MODELS}/a.step", "host", "f" * 64), ("b.wrl", "substitutable", "")],
        )

    def test_a_host_model_makes_a_hermetic_build_not_self_contained(self) -> None:
        host = [{"location": "host"}]
        closure = [{"location": "closure"}, {"location": "toolchain"}]
        self.assertFalse(model_inputs.is_self_contained(True, host))
        self.assertTrue(model_inputs.is_self_contained(True, closure))
        self.assertFalse(model_inputs.is_self_contained(False, closure))

    def test_every_unpinned_model_must_be_acknowledged(self) -> None:
        unpinned = model_inputs.unpinned_models(
            {},
            [
                {"source_path": BOARD, "reference": "a.step", "location": "unreadable"},
                {"source_path": BOARD, "reference": "b.wrl", "location": "substitutable"},
                {"source_path": BOARD, "reference": "c.step", "location": "missing", "advisory": True},
            ],
        )
        keys = [row["key"] for row in unpinned]
        self.assertEqual(keys, [f"{BOARD}::a.step", f"{BOARD}::b.wrl"])
        with self.assertRaises(DomainError) as caught:
            model_inputs.require_acknowledgement(unpinned, keys[:1], action="Publishing")
        self.assertEqual(caught.exception.status_code, 409)
        self.assertIn("b.wrl", str(caught.exception.detail))
        self.assertNotIn("a.step", str(caught.exception.detail))
        self.assertEqual(
            model_inputs.require_acknowledgement(unpinned, [*keys, "stale"], action="Publishing"),
            keys,
        )
        # Nothing unpinned: nothing to acknowledge.
        self.assertEqual(model_inputs.require_acknowledgement([], [], action="Approval"), [])


if __name__ == "__main__":
    unittest.main()
