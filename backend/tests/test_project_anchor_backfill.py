"""Projects registered before anchors existed get their anchor stored at startup, and then key like any other."""

from __future__ import annotations

import os
import unittest

from app.services.design_bundle import jobs
from app.services.project_anchor_backfill import backfill_project_anchors
from support.postgres import requires_scratch_postgres, seed_project
from test_design_bundle_job import _Workspace


@requires_scratch_postgres("the project anchor backfill")
class ProjectAnchorBackfillTests(_Workspace, unittest.TestCase):
    def backfill(self) -> int:
        with self.scratch.connection() as conn:
            stored = backfill_project_anchors(conn, lambda clone: os.path.join(self.tmp / "projects", clone))
            conn.commit()
        return stored

    def clear_anchor(self, project_id: str) -> None:
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_projects SET project_file_rel='' WHERE id=%s", (project_id,))
            conn.commit()

    def anchor(self, project_id: str) -> str:
        with self.scratch.connection() as conn:
            row = conn.execute("SELECT project_file_rel FROM ws_projects WHERE id=%s", (project_id,)).fetchone()
        return row["project_file_rel"]

    def test_an_empty_anchor_is_stored_and_keys_like_a_project_registered_with_it(self) -> None:
        self.add_project("set", "r1")
        self.add_project("legacy", "r2")
        self.clear_anchor("legacy")
        # Keying reads the stored anchor alone (revision-key.md §4.4): before the backfill it finds no project.
        self.assertTrue(jobs.project_key(jobs._workspace().get_project_by_id("legacy")).absent)

        self.assertEqual(self.backfill(), 1)
        self.assertEqual(self.anchor("legacy"), "demo.kicad_pro")
        legacy = jobs.project_key(jobs._workspace().get_project_by_id("legacy"))
        registered = jobs.project_key(jobs._workspace().get_project_by_id("set"))
        self.assertFalse(legacy.absent)
        self.assertEqual(legacy.key.revision_key, registered.key.revision_key)  # type: ignore[union-attr]
        self.assertEqual(legacy.config, registered.config)
        self.assertIsNotNone(jobs.start_design_bundle_job("legacy"))
        self.assertEqual(self.backfill(), 0)  # settled rows are not read again

    def test_a_directory_with_several_project_files_is_left_alone(self) -> None:
        files = {"board/demo.kicad_pro": "{}\n", "board/other.kicad_pro": "{}\n"}
        self.add_project("two", "r1", files=files)
        self.clear_anchor("two")
        self.assertEqual(self.backfill(), 0)
        self.assertEqual(self.anchor("two"), "")

    def test_an_anchor_another_row_of_the_directory_holds_is_not_taken(self) -> None:
        self.add_project("legacy", "r1")
        self.clear_anchor("legacy")
        with self.scratch.connection() as conn:
            seed_project(conn, "adopted", "r1", relative_path="board", project_file_rel="demo.kicad_pro")
            conn.commit()
        self.assertEqual(self.backfill(), 0)
        self.assertEqual(self.anchor("legacy"), "")

