"""Warm bundles (ADR amendment K2, K2b): reuse through aliases, the prebuild set and forced rebuilds.

On a scratch workspace with the stub CLI, whose ``bundle reuse`` holds when
every source member of the archive is an entry of the key record with the same
object id. The stub's parse reads every KiCad file of the key but no 3D model,
so a commit that changes only ``lib/models/part.step`` has a new revision key
and the same read set.
"""

from __future__ import annotations

import unittest
from unittest import mock

from app.core.config import settings
from app.services.design_bundle import backfill, cli, jobs, reader, regenerate, retention, reuse, rows, store
from support.postgres import requires_scratch_postgres, seed_job
from support.repo import git
from test_design_bundle_job import _Workspace


def _commit(repo, path: str, content: str, message: str) -> str:
    target = repo / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    git(repo, "add", "-A")
    git(repo, "-c", "commit.gpgsign=false", "commit", "-qm", message)
    return git(repo, "rev-parse", "HEAD")


@requires_scratch_postgres("warm design bundles")
class ReuseTests(_Workspace, unittest.TestCase):
    def _build(self, commit: str | None = None) -> dict:
        job_id = jobs.start_design_bundle_job("p1", commit=commit)
        self.assertIsNotNone(job_id)
        result = self.run_job(job_id)
        return result.details

    def _parses(self) -> int:
        return sum(1 for argv in self.builds() if argv[argv.index("--stage") + 1] == "parse")

    def test_a_commit_that_leaves_the_design_unchanged_is_aliased_not_built(self) -> None:
        repo = self.add_project()
        built = self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        job_id = jobs.start_design_bundle_job("p1")
        payload = self.queue.rows[job_id]["payload"]
        # The model file is in the revision key, but stage parse (the stub's) never read it.
        self.assertNotEqual(payload["revision_key"], built["revision_key"])
        result = self.run_job(job_id)
        self.assertTrue(result.details["aliased"])
        self.assertEqual(result.details["bundle_key"], built["bundle_key"])
        self.assertEqual(self._parses(), 1)
        self.assertIsNone(rows.get_bundle("p1", payload["bundle_key"]))  # its queued row gave way to the alias
        alias = rows.get_alias("p1", payload["revision_key"], built["generator_digest"])
        self.assertEqual(alias["bundle_key"], built["bundle_key"])
        # A consumer reads the other revision's archive and reports the key it asked for.
        opened = reader.open_revision("p1")
        self.assertEqual((opened.revision_key, opened.bundle_key, opened.aliased), (payload["revision_key"], built["bundle_key"], True))
        self.assertEqual(opened.archive_revision_key, built["revision_key"])
        self.assertEqual(opened.read_json("projections/stackup.json")["schema"], "prism.stackup.a0")
        extracted = opened.extract(["sources/board/demo.kicad_sch"])
        self.assertTrue((extracted / "sources/board/demo.kicad_sch").is_file())
        # Served: not queued again.
        self.assertIsNone(jobs.start_design_bundle_job("p1"))

    def test_an_alias_whose_target_archive_is_gone_is_dropped_and_the_revision_rebuilt(self) -> None:
        repo = self.add_project()
        built = self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        aliased = self.run_job(jobs.start_design_bundle_job("p1")).details
        self.assertTrue(aliased["aliased"])
        store.delete("p1", built["revision_key"], built["generator_digest"])  # lost, or rejected on open
        job_id = jobs.start_design_bundle_job("p1")
        self.assertIsNotNone(job_id)
        self.assertIsNone(rows.get_alias("p1", aliased["revision_key"], built["generator_digest"]))

    def test_a_design_change_is_built(self) -> None:
        repo = self.add_project()
        self._build()
        _commit(repo, "board/demo.kicad_sch", "(kicad_sch (version 20260306) (v2))\n", "sheet")
        result = self._build()
        self.assertNotIn("aliased", result)
        self.assertEqual(self._parses(), 2)
        self.assertEqual(rows.aliases("p1"), [])

    def test_reuse_is_off_with_no_candidates(self) -> None:
        repo = self.add_project()
        self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_REUSE_CANDIDATES", 0):
            result = self._build()
        self.assertNotIn("aliased", result)
        self.assertEqual(self._parses(), 2)

    def test_candidates_start_with_the_first_parent(self) -> None:
        repo = self.add_project()
        first = self._build()
        _commit(repo, "board/demo.kicad_sch", "(kicad_sch (version 20260306) (v2))\n", "sheet")
        second = self._build()
        head = _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        found = reuse.candidates("p1", repo, head, cli.generator(), limit=3)
        self.assertEqual(found[0]["bundle_key"], second["bundle_key"])
        self.assertIn(first["bundle_key"], [row["bundle_key"] for row in found])

    def test_regenerating_a_commit_drops_its_alias_and_builds_without_reuse(self) -> None:
        repo = self.add_project()
        built = self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        aliased = self._build()
        self.assertTrue(aliased["aliased"])
        done = regenerate.regenerate("p1", requested_by="t")
        self.assertEqual((done.scope, done.removed_aliases, done.removed_bundles), ("commit", 1, 0))
        payload = self.queue.rows[done.job_id]["payload"]
        self.assertTrue(payload["force"])
        result = self.run_job(done.job_id)
        self.assertNotIn("aliased", result.details)
        self.assertEqual(self._parses(), 2)
        self.assertIsNone(rows.get_alias("p1", payload["revision_key"], built["generator_digest"]))
        self.assertEqual(rows.get_bundle("p1", payload["bundle_key"])["state"], "complete")
        self.assertIsNotNone(rows.get_bundle("p1", built["bundle_key"]))  # the other revision keeps its own

    def test_regenerating_a_built_commit_drops_the_aliases_that_pointed_to_it(self) -> None:
        repo = self.add_project()
        first_commit = git(repo, "rev-parse", "HEAD")
        built = self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        self._build()
        done = regenerate.regenerate("p1", commit=first_commit)
        self.assertEqual((done.removed_bundles, done.removed_aliases), (1, 1))
        self.assertFalse(store.archive_path("p1", built["revision_key"], built["generator_digest"]).exists())
        self.assertEqual(rows.aliases("p1"), [])

    def test_regenerating_the_project_drops_everything_and_queues_head(self) -> None:
        repo = self.add_project()
        self._build()
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        self._build()
        done = regenerate.regenerate("p1", scope="project")
        self.assertEqual((done.removed_bundles, done.removed_aliases), (1, 1))
        self.assertEqual(rows.bundles("p1")[0]["state"], "queued")  # only HEAD's forced build
        self.assertTrue(self.queue.rows[done.job_id]["payload"]["force"])

    def test_regenerating_is_refused_while_a_build_is_active(self) -> None:
        self.add_project()
        with self.scratch.connection() as conn:
            seed_job(conn, "active-1", "design_bundle", "running")
            conn.execute("""UPDATE ws_jobs SET payload='{"project_id": "p1"}'::jsonb WHERE id='active-1'""")
        with self.assertRaises(regenerate.RegenerateConflict):
            regenerate.regenerate("p1")
        with self.assertRaises(regenerate.RegenerateConflict):
            regenerate.regenerate("p1", scope="project")


@requires_scratch_postgres("the design bundle prebuild")
class PrebuildTests(_Workspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_AUTO_BUILD", True))

    def test_the_prebuild_set_is_heads_then_branch_windows_then_tags(self) -> None:
        repo = self.add_project()
        root = git(repo, "rev-parse", "HEAD")
        git(repo, "tag", "v0")  # lightweight, on the root
        commits = [_commit(repo, "lib/models/part.step", f"ISO-10303-21; {n}\n", f"c{n}") for n in range(1, 5)]
        git(repo, "tag", "-a", "-m", "release", "v1", commits[0])
        git(repo, "checkout", "-q", "-b", "feature", commits[1])
        feature = _commit(repo, "board/demo.kicad_sch", "(kicad_sch (version 20260306) (f))\n", "feature")
        git(repo, "checkout", "-q", "main")
        warm = reuse.prebuild_commits(repo, per_branch=2)
        self.assertEqual(warm[:2], [feature, commits[3]])  # heads, in ref order
        self.assertEqual(warm[2:4], [commits[1], commits[2]])  # each branch's next newest
        self.assertEqual(sorted(warm[4:]), sorted([root, commits[0]]))  # the tagged commits
        self.assertEqual(len(warm), len(set(warm)))

    def test_a_tick_aliases_what_it_can_and_builds_one_at_a_time(self) -> None:
        repo = self.add_project()
        job = jobs.start_design_bundle_job("p1")
        self.run_job(job)
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        queued_before = len(self.queue.rows)  # the harness keeps the job it ran
        outcome = backfill.tick(backfill.BackfillState())
        self.assertEqual(len(outcome["reused"]), 1)
        self.assertIsNone(outcome["queued"])
        self.assertEqual(len(self.queue.rows), queued_before)
        self.assertTrue(reuse.is_served("p1", git(repo, "rev-parse", "HEAD"), cli.generator()))
        _commit(repo, "board/demo.kicad_sch", "(kicad_sch (version 20260306) (v2))\n", "sheet")
        _commit(repo, "board/demo.kicad_pcb", "(kicad_pcb (version 20260206) (v2))\n", "board")
        outcome = backfill.tick(backfill.BackfillState())
        self.assertIsNotNone(outcome["queued"])
        self.assertEqual(len(self.queue.rows), queued_before + 1)  # one build per tick, while the slot is free

    def test_a_busy_slot_still_aliases(self) -> None:
        repo = self.add_project()
        self.run_job(jobs.start_design_bundle_job("p1"))
        _commit(repo, "lib/models/part.step", "ISO-10303-21; changed\n", "model only")
        with self.scratch.connection() as conn:
            seed_job(conn, "active-1", "design_bundle", "running")
        outcome = backfill.tick(backfill.BackfillState())
        self.assertEqual(outcome["busy"], "every design_bundle slot is taken")
        self.assertEqual(len(outcome["reused"]), 1)

    def test_retention_keeps_an_archive_an_alias_points_to(self) -> None:
        repo = self.add_project()
        first = self.run_job(jobs.start_design_bundle_job("p1")).details
        for n in range(3):
            _commit(repo, "lib/models/part.step", f"ISO-10303-21; {n}\n", f"model {n}")
        aliased = self.run_job(jobs.start_design_bundle_job("p1")).details
        self.assertEqual(aliased["bundle_key"], first["bundle_key"])
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_design_bundles SET last_used_at = NOW() - INTERVAL '400 days'")
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS", 1):
            report = retention.run()
        self.assertEqual(report["removed"], 0)  # the first commit is outside the window, but HEAD's alias points to it
        self.assertIsNotNone(rows.get_bundle("p1", first["bundle_key"]))
        # Once the alias is unused and its revision is outside the kept set, both go.
        _commit(repo, "board/demo.kicad_sch", "(kicad_sch (version 20260306) (v2))\n", "sheet")
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_design_bundle_aliases SET last_used_at = NOW() - INTERVAL '400 days'")
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS", 1):
            report = retention.run()
        self.assertEqual((report["aliases_removed"], report["removed"]), (1, 1))
        self.assertIsNone(rows.get_bundle("p1", first["bundle_key"]))
