"""What counts as KiCad noise, and what must never be mistaken for it.

This classifier decides what the web history and the KiCad plugin fold away. Get it
wrong in one direction and the user's change list drowns in backup zips; get it wrong in
the other and a file they actually designed quietly stops being shown. The second is
much worse, so the "must stay visible" cases are the ones worth guarding.

Paths here are real ones taken from a live KiCad project.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import kicad_noise_service as noise  # noqa: E402


class Noise(unittest.TestCase):
    """Generated files. Folded away, never deleted."""

    def test_auto_backup_archives(self) -> None:
        # auto_backup is ON by default: up to 25 zips per project. The big one.
        self.assertTrue(
            noise.is_noise("Git test-backups/Git test-2026-05-09_171913.zip")
        )
        self.assertTrue(noise.is_noise("nested/My Board-backups/My Board-2026.zip"))

    def test_regenerated_caches(self) -> None:
        self.assertTrue(noise.is_noise("fp-info-cache"))
        self.assertTrue(noise.is_noise("board-cache.lib"))
        self.assertTrue(noise.is_noise("board-cache.dcm"))

    def test_per_user_local_state(self) -> None:
        # .kicad_prl is window layout and last-used layer. Not design data.
        self.assertTrue(noise.is_noise("Git test.kicad_prl"))

    def test_backups_and_autosaves(self) -> None:
        self.assertTrue(noise.is_noise("Git test.kicad_pcb-bak"))
        self.assertTrue(noise.is_noise("_autosave-Git test.kicad_pcb"))
        self.assertTrue(noise.is_noise("board.bak"))
        self.assertTrue(noise.is_noise("board.kicad_sch~"))

    def test_lock_files(self) -> None:
        # Present only because KiCad happened to be open when we looked.
        self.assertTrue(noise.is_noise("~Git test.kicad_pcb.lck"))
        self.assertTrue(noise.is_noise("~Git test.kicad_pro.lck"))

    def test_our_own_metadata(self) -> None:
        # We put .prism.json there. Showing it in the user's change list would be us
        # adding to the noise we exist to remove.
        self.assertTrue(noise.is_noise(".prism.json"))

    def test_fetched_symbol_library(self) -> None:
        # RemoteLibrary is where the provider downloads placed parts. A cache of
        # upstream assets, and it churns on every placement.
        self.assertTrue(noise.is_noise("RemoteLibrary/"))
        self.assertTrue(
            noise.is_noise("RemoteLibrary/symbols/remote_easyeda.kicad_sym")
        )


class Design(unittest.TestCase):
    """The user's actual work. Hiding any of this would be a lie about their repo."""

    def test_the_design_files(self) -> None:
        self.assertFalse(noise.is_noise("Git test.kicad_pcb"))
        self.assertFalse(noise.is_noise("Git test.kicad_sch"))
        self.assertFalse(noise.is_noise("Git test.kicad_pro"))

    def test_outputs_and_documents(self) -> None:
        self.assertFalse(noise.is_noise("gerbers/Git test-B_Cu.gbr"))
        self.assertFalse(noise.is_noise("gerbers/Git test-PTH.drl"))
        self.assertFalse(noise.is_noise("15EDGKD-3.5-XXP-1Y-00Z(H).pdf"))

    def test_library_tables_are_intent(self) -> None:
        # KiCad rewrites these, but adding a library IS a deliberate act. Folding them
        # would hide a real change.
        self.assertFalse(noise.is_noise("sym-lib-table"))
        self.assertFalse(noise.is_noise("fp-lib-table"))

    def test_a_real_file_with_an_odd_name(self) -> None:
        # This exists in a live project. A double extension is not a parse error.
        self.assertFalse(noise.is_noise("untitled2.kicad_sch .kicad_sch"))

    def test_prefix_collisions_do_not_match(self) -> None:
        # The rules must match path SEGMENTS, not substrings, or a user's own file gets
        # silently swallowed for having an unlucky name.
        self.assertFalse(noise.is_noise("MyRemoteLibraryNotes.md"))
        self.assertFalse(noise.is_noise("backups-are-important.md"))
        self.assertFalse(noise.is_noise("docs/fp-info-cache-explained.md"))

    def test_empty_and_missing(self) -> None:
        self.assertFalse(noise.is_noise(""))
        self.assertFalse(noise.is_noise(None))


class Partition(unittest.TestCase):
    def test_splits_and_preserves_order(self) -> None:
        design, folded = noise.partition(
            [
                "Git test.kicad_pcb",
                "Git test-backups/a.zip",
                "Git test.kicad_sch",
                "fp-info-cache",
            ]
        )
        self.assertEqual(design, ["Git test.kicad_pcb", "Git test.kicad_sch"])
        self.assertEqual(folded, ["Git test-backups/a.zip", "fp-info-cache"])


if __name__ == "__main__":
    unittest.main()
