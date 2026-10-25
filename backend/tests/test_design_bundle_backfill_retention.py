"""The paced backfill (ADR §8, amendment K2 §7) and bundle retention (ADR §5), on a scratch workspace.

Reuse, the prebuild set and aliases are in ``test_design_bundle_reuse.py``.
"""

from __future__ import annotations

import os
import time
import unittest
from unittest import mock

from app.core.config import settings
from app.release_studio.documents import render_cache
from app.services.design_bundle import backfill, jobs, kicad_steps, retention, rows, store
from support.design_bundle_fixtures import PROJECT_FILES
from support.postgres import requires_scratch_postgres, seed_job
from support.repo import git
from test_design_bundle_job import _Workspace


@requires_scratch_postgres("the design bundle backfill")
class BackfillTests(_Workspace, unittest.TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.enterContext(mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_AUTO_BUILD", True))
        self.state = backfill.BackfillState()

    def test_it_is_off_unless_auto_build_is_on(self) -> None:
        self.add_project()
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_AUTO_BUILD", False):
            self.assertEqual(backfill.tick(self.state)["skipped"], "disabled")
        self.assertEqual(self.queue.rows, {})

    def test_one_branch_head_per_tick_round_robin_and_paced_by_the_slot(self) -> None:
        repo = self.add_project("p1", "r1")
        git(repo, "branch", "feature")
        git(repo, "checkout", "-q", "feature")
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (feature))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "feature")
        git(repo, "checkout", "-q", "main")
        self.add_project("p2", "r2")
        first = backfill.tick(self.state)["queued"]
        self.assertEqual(first["project_id"], "p1")
        self.assertEqual(len(self.queue.rows), 1)
        # Paced: nothing more while a design_bundle job is active.
        with self.scratch.connection() as conn:
            seed_job(conn, "active-1", "design_bundle", "running")
        paced = backfill.tick(self.state)
        self.assertEqual((paced["busy"], paced["queued"]), ("every design_bundle slot is taken", None))
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_jobs SET status='completed' WHERE id='active-1'")
        second = backfill.tick(self.state)["queued"]
        third = backfill.tick(self.state)["queued"]
        queued = {(item["project_id"], item["commit"]) for item in (first, second, third)}
        self.assertEqual({project for project, _ in queued}, {"p1", "p2"})
        self.assertEqual(len(queued), 3)  # p1 main, p1 feature, p2 main
        self.assertIsNone(backfill.tick(self.state)["queued"])  # every head is queued now
        payloads = [row["payload"] for row in self.queue.rows.values()]
        self.assertTrue(all(row["requested_by"] == jobs.BACKFILL_REQUESTED_BY for row in self.queue.rows.values()))
        self.assertEqual(sum(1 for p in payloads if p["head"]), 2)

    def _older_commits(self, repo, count: int) -> list[str]:
        """Commit ``count`` more revisions on main; returns the ones now behind HEAD, newest first."""

        before = [git(repo, "rev-parse", "HEAD")]
        for index in range(count):
            (repo / "board/demo.kicad_sch").write_text(f"(kicad_sch (version 20260306) (rev {index}))\n", encoding="utf-8")
            git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", f"rev {index}")
            before.insert(0, git(repo, "rev-parse", "HEAD"))
        return before[1:]

    def _busy(self, job_id: str = "active-1") -> None:
        with self.scratch.connection() as conn:
            seed_job(conn, job_id, "design_bundle", "running")

    def _free(self, job_id: str = "active-1") -> None:
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_jobs SET status='completed' WHERE id=%s", (job_id,))

    def test_every_projects_head_is_queued_before_any_older_revision(self) -> None:
        # Found on v5.0.1: after a generator change the backfill rebuilt older
        # revisions of the first projects while later projects had no HEAD bundle.
        older = self._older_commits(self.add_project("p1", "r1"), 2)
        heads = {p: git(self.add_project(p, f"r{p}"), "rev-parse", "HEAD") for p in ("p2", "p3")}
        order = [backfill.tick(self.state)["queued"] for _ in range(5)]
        self.assertEqual(
            [(item["project_id"], item["commit"]) for item in order[1:]],
            [("p2", heads["p2"]), ("p3", heads["p3"]), ("p1", older[0]), ("p1", older[1])],
        )
        self.assertEqual(order[0]["project_id"], "p1")

    def test_a_busy_slot_keys_nothing_and_keeps_the_next_build(self) -> None:
        for project in ("p1", "p2", "p3"):
            self.add_project(project, f"r{project}")
        self._busy()
        first = backfill.tick(self.state)
        self.assertEqual((first["queued"], first["keyed"]), (None, 3))  # each HEAD keyed once, for its flags
        for _ in range(3):
            busy = backfill.tick(self.state)
            self.assertEqual((busy["queued"], busy["keyed"]), (None, 0))
        self._free()
        self.assertEqual(backfill.tick(self.state)["queued"]["project_id"], "p1")

    def test_older_revisions_are_taken_round_robin_across_projects(self) -> None:
        old = {p: self._older_commits(self.add_project(p, f"r{p}"), 2) for p in ("p1", "p2")}
        queued = [backfill.tick(self.state)["queued"] for _ in range(6)][2:]  # the two HEADs come first
        self.assertEqual(
            [(item["project_id"], item["commit"]) for item in queued],
            [("p1", old["p1"][0]), ("p2", old["p2"][0]), ("p1", old["p1"][1]), ("p2", old["p2"][1])],
        )

    def test_free_slots_are_filled_in_parallel_heads_first(self) -> None:
        older = self._older_commits(self.add_project("p1", "r1"), 1)
        heads = {p: git(self.add_project(p, f"r{p}"), "rev-parse", "HEAD") for p in ("p2", "p3")}
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_CONCURRENCY", 3):
            self._busy()  # one of the three slots is taken
            first = backfill.tick(self.state)["builds"]
            self.assertEqual([item["project_id"] for item in first], ["p1", "p2"])
            self.assertEqual(first[1]["commit"], heads["p2"])
            self._free()
            second = backfill.tick(self.state)["builds"]
        # Two queued jobs are in the in-memory queue, not ws_jobs: three slots are free again.
        self.assertEqual([(item["project_id"], item["commit"]) for item in second], [("p3", heads["p3"]), ("p1", older[0])])

    def test_served_and_absent_commits_are_not_keyed_again(self) -> None:
        self.add_project("p1", "r1")
        repo = self.add_project("p2", "r2")
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_projects SET project_file_rel='renamed.kicad_pro' WHERE id='p2'")
        self._older_commits(repo, 1)
        first = backfill.tick(self.state)
        self.assertEqual(first["queued"]["project_id"], "p1")
        backfill.tick(self.state)  # p2 is absent at every commit; p1 is served
        for _ in range(2):
            self.assertEqual(backfill.tick(self.state)["keyed"], 0)

    def test_it_flags_projects_whose_board_or_schematic_no_longer_resolves(self) -> None:
        files = {k: v for k, v in PROJECT_FILES.items() if k not in ("board/demo.kicad_pcb", "board/demo.kicad_sch")}
        files["board/main.kicad_pcb"] = "(kicad_pcb (version 20260206))\n"  # today's directory fallback would pick it
        files["board/main.kicad_sch"] = "(kicad_sch (version 20260306))\n"
        self.add_project(files=files)
        outcome = backfill.tick(self.state)
        self.assertEqual(outcome["flagged"], {"p1": ["board-unresolved", "schematic-unresolved"]})
        self.assertEqual(sorted(rows.flags("p1")), ["board-unresolved", "schematic-unresolved"])
        self.assertIsNotNone(outcome["queued"])  # it still bundles what does resolve
        with self.scratch.connection() as conn:
            conn.execute("""UPDATE ws_projects SET path_settings='{"pcb": "main.kicad_pcb", "schematic": "main.kicad_sch"}'::jsonb""")
        backfill.tick(backfill.BackfillState())
        self.assertEqual(rows.flags("p1"), {})  # an explicit setting resolves them

    def test_an_absent_anchor_is_recorded_and_flagged(self) -> None:
        repo = self.add_project()
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_projects SET project_file_rel='renamed.kicad_pro'")
        outcome = backfill.tick(self.state)
        self.assertIsNone(outcome["queued"])
        self.assertEqual(outcome["flagged"], {"p1": ["project-absent"]})
        self.assertTrue(rows.is_absent("p1", git(repo, "rev-parse", "HEAD"), "board/renamed.kicad_pro"))


@requires_scratch_postgres("design bundle retention")
class RetentionTests(_Workspace, unittest.TestCase):
    def _bundle(self, commit: str | None = None) -> dict:
        job_id = jobs.start_design_bundle_job("p1", commit=commit)
        result = self.run_job(job_id)
        return rows.get_bundle("p1", result.details["bundle_key"])

    def _age(self, bundle_key: str, days: int) -> None:
        with self.scratch.connection() as conn:
            conn.execute(
                "UPDATE ws_design_bundles SET last_used_at = NOW() - make_interval(days => %s) WHERE bundle_key=%s",
                (days, bundle_key),
            )

    def test_branch_heads_stay_and_unused_others_go(self) -> None:
        repo = self.add_project()
        old_commit = git(repo, "rev-parse", "HEAD")
        old = self._bundle(old_commit)
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (v2))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "v2")
        head = self._bundle()
        self.assertNotEqual(old["revision_key"], head["revision_key"])
        self._age(old["bundle_key"], 40)
        self._age(head["bundle_key"], 40)
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS", 0):  # heads and tags only
            report = retention.run()
        self.assertEqual(report["removed"], 1)
        self.assertIsNone(rows.get_bundle("p1", old["bundle_key"]))
        self.assertFalse(store.archive_path("p1", old["revision_key"], old["generator_digest"]).exists())
        self.assertIsNotNone(rows.get_bundle("p1", head["bundle_key"]))  # a branch head, however old its last use
        self.assertTrue(store.archive_path("p1", head["revision_key"], head["generator_digest"]).exists())

    def test_a_branch_window_and_tags_stay(self) -> None:
        repo = self.add_project()
        tagged = self._bundle(git(repo, "rev-parse", "HEAD"))
        git(repo, "tag", "v1")
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (v2))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "v2")
        windowed = self._bundle(git(repo, "rev-parse", "HEAD"))
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (v3))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "v3")
        self._age(tagged["bundle_key"], 400)
        self._age(windowed["bundle_key"], 400)
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS", 2):
            report = retention.run()
        self.assertEqual(report["removed"], 0)  # the tag, and HEAD~1 inside the window of 2
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS", 0):
            report = retention.run()
        self.assertEqual(report["removed"], 1)  # the window is gone; the tag stays
        self.assertIsNotNone(rows.get_bundle("p1", tagged["bundle_key"]))

    def test_recently_used_and_pinned_commits_stay(self) -> None:
        repo = self.add_project()
        first = git(repo, "rev-parse", "HEAD")
        pinned = self._bundle(first)
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (v2))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "v2")
        second = git(repo, "rev-parse", "HEAD")
        recent = self._bundle(second)
        (repo / "board/demo.kicad_sch").write_text("(kicad_sch (version 20260306) (v3))\n", encoding="utf-8")
        git(repo, "-c", "commit.gpgsign=false", "commit", "-qam", "v3")
        self._age(pinned["bundle_key"], 400)
        self._age(recent["bundle_key"], 2)
        with mock.patch.object(rows, "pinned_commits", return_value={first}):
            report = retention.run()
        self.assertEqual(report["removed"], 0)
        self.assertIsNotNone(rows.get_bundle("p1", pinned["bundle_key"]))
        self.assertIsNotNone(rows.get_bundle("p1", recent["bundle_key"]))

    def test_pinned_commits_read_release_studio(self) -> None:
        self.add_project()
        self.assertEqual(rows.pinned_commits("p1"), set())  # the tables exist at head and hold nothing yet

    def test_orphans_stale_temporaries_and_old_cache_versions(self) -> None:
        self.add_project()
        bundle = self._bundle()
        orphan = store.prepare("p1", "e" * 64, bundle["generator_digest"])
        orphan.write_bytes(b"no row names me")
        stale = orphan.parent / f".{orphan.name}.prism-kicad-7-0.tmp"
        stale.write_bytes(b"partial")
        cache = store.cache_dir("p1", bundle["revision_key"], bundle["generator_digest"]) / ("f" * 64)
        cache.mkdir(parents=True)
        past = time.time() - 60 * 86400
        for path in (orphan, stale, cache):
            os.utime(path, (past, past))
        report = retention.run()
        self.assertEqual((report["orphan_archives"], report["temp_files"], report["cache_versions"]), (1, 1, 1))
        self.assertFalse(orphan.exists())
        self.assertFalse(cache.exists())
        self.assertTrue(store.archive_path("p1", bundle["revision_key"], bundle["generator_digest"]).exists())

    def test_an_idle_revisions_cache_goes_while_its_archive_stays(self) -> None:
        self.add_project()
        bundle = self._bundle()
        key = ("p1", bundle["revision_key"], bundle["generator_digest"])
        archive = store.open_bundle(*key, bundle["bundle_key"])
        version = store.extract(archive, *key, ["sources/"])
        past = time.time() - 10 * 86400
        os.utime(version, (past, past))
        self._age(bundle["bundle_key"], 10)
        report = retention.run()
        self.assertTrue(store.archive_path(*key).exists())  # the archive is kept, its cache is not
        self.assertFalse(version.exists(), report)
        self.assertEqual(report["cache_idle_versions"], 1)
        self.assertGreater(report["cache_idle_bytes"], 0)
        # A read re-extracts it; the archive is the source of truth.
        reopened = store.open_bundle(*key, bundle["bundle_key"])
        self.assertTrue(store.extract(reopened, *key, ["sources/"]).is_dir())

    def test_the_cache_cap_evicts_the_least_recently_used_and_keeps_archives(self) -> None:
        self.add_project()
        bundle = self._bundle()
        key = ("p1", bundle["revision_key"], bundle["generator_digest"])
        archive = store.open_bundle(*key, bundle["bundle_key"])
        store.extract(archive, *key, ["sources/"])
        past = time.time() - 2 * 86400
        for version in store.cache_dir(*key).iterdir():
            if version.is_dir() and not version.is_symlink():
                os.utime(version, (past, past))
        self._age(bundle["bundle_key"], 2)  # outside the grace period, inside the idle period
        with mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_CACHE_PROJECT_MAX_BYTES", 1):
            report = retention.run()
        self.assertGreater(report["cache_capped_versions"], 0)
        self.assertTrue(store.archive_path(*key).exists())
        self.assertEqual(report["cache_bytes"], 0)

    def test_kicad_caches_are_swept_with_the_glb_cache(self) -> None:
        self.add_project()
        self._bundle()
        now, past = time.time(), time.time() - 60 * 86400
        refill, upgrade = self.tmp / "refill-cache", self.tmp / "upgrade-cache"
        for root, suffix in ((refill, ".kicad_pcb"), (upgrade, ".kicad_sch")):
            root.mkdir()
            old, part = root / f"old{suffix}", root / f".old{suffix}.1.part"
            for path in (old, part):
                path.write_bytes(b"old")
                os.utime(path, (past, past))
            (root / f"fresh{suffix}").write_bytes(b"new")
        with mock.patch.object(kicad_steps, "refill_cache_root", return_value=refill), \
                mock.patch.object(kicad_steps, "upgrade_cache_root", return_value=upgrade):
            report = retention.run()
        self.assertEqual((report["refill_cache_removed"], report["upgrade_cache_removed"]), (1, 1))
        self.assertEqual((report["refill_cache_bytes"], report["upgrade_cache_bytes"]), (3, 3))
        self.assertEqual(sorted(p.name for p in refill.iterdir()), ["fresh.kicad_pcb"])
        self.assertEqual(sorted(p.name for p in upgrade.iterdir()), ["fresh.kicad_sch"])

    def test_the_cover_render_cache_is_swept_with_the_other_kicad_caches(self) -> None:
        self.add_project()
        self._bundle()
        past = time.time() - 60 * 86400
        root = self.tmp / "render-cache"
        root.mkdir()
        old, part, fresh = root / "old.png", root / ".old.png.1.part", root / "fresh.png"
        for path in (old, part):
            path.write_bytes(b"old")
            os.utime(path, (past, past))
        fresh.write_bytes(b"new")
        with mock.patch.object(render_cache, "cache_root", return_value=root):
            report = retention.run()
        self.assertEqual(report["render_cache_removed"], 1)
        self.assertEqual(report["render_cache_bytes"], 3)
        self.assertEqual(sorted(p.name for p in root.iterdir()), ["fresh.png"])

    def test_superseded_generators_are_removed_when_a_new_one_is_stored(self) -> None:
        self.add_project()
        from app.services.workspace_service import workspace

        revision_key = jobs.project_key(workspace.get_project_by_id("p1")).key.revision_key
        older = "9" * 64
        store.prepare("p1", revision_key, older).write_bytes(b"older generator")
        rows.upsert_bundle(bundle_key="8" * 64, project_id="p1", revision_key=revision_key,
                           generator_digest=older, commit=None, state="complete")
        bundle = self._bundle()
        self.assertEqual(bundle["revision_key"], revision_key)
        self.assertIsNone(rows.get_bundle("p1", "8" * 64))
        self.assertFalse(store.archive_path("p1", revision_key, older).exists())


if __name__ == "__main__":
    unittest.main()
