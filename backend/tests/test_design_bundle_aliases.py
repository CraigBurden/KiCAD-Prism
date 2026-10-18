"""The design bundle alias table (revision-key.md §10, ADR amendment K2 §3.3),
its rows, and the stub's ``bundle reuse`` (cli-spec.md §5.10)."""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from app.services.design_bundle import cli, rows, schemas
from app.services.design_bundle.archive import open_archive
from app.services.design_bundle.revision_key import ALGORITHM
from app.services.workspace_schema_migrations import MIGRATIONS
from support.design_bundle_fixtures import PROJECT_FILES, install_stub
from support.postgres import requires_scratch_postgres
from test_design_bundle_job import _Workspace

KEY_A, KEY_B, KEY_C, KEY_D = "a" * 64, "b" * 64, "c" * 64, "d" * 64
DIGEST, OTHER_DIGEST = "e" * 64, "f" * 64
BUNDLE_A, BUNDLE_B, BUNDLE_C, BUNDLE_D = "1" * 64, "2" * 64, "3" * 64, "4" * 64


@requires_scratch_postgres("design bundle aliases")
class AliasRowTests(_Workspace, unittest.TestCase):
    def test_migration_103_creates_the_table_and_is_registered(self) -> None:
        self.assertIn((103, "design_bundle_aliases"), [(version, name) for version, name, _ in MIGRATIONS])
        with self.scratch.connection() as conn:
            table = conn.execute("SELECT to_regclass('ws_design_bundle_aliases') AS found").fetchone()
            index = conn.execute("SELECT to_regclass('idx_ws_design_bundle_aliases_bundle') AS found").fetchone()
        self.assertIsNotNone(table["found"])
        self.assertIsNotNone(index["found"])

    def test_add_alias_is_idempotent_immutable_and_readable(self) -> None:
        self.add_project()
        rows.add_alias("p1", KEY_A, DIGEST, BUNDLE_A)
        rows.add_alias("p1", KEY_A, DIGEST, BUNDLE_B)  # immutable: the first target stands
        self.assertEqual(len(rows.aliases("p1")), 1)
        found = rows.get_alias("p1", KEY_A, DIGEST)
        self.assertEqual((found["project_id"], found["algorithm"], found["bundle_key"]), ("p1", ALGORITHM, BUNDLE_A))
        self.assertIsNone(rows.get_alias("p1", KEY_B, DIGEST))
        self.assertEqual([alias["revision_key"] for alias in rows.aliases_of_bundle("p1", BUNDLE_A)], [KEY_A])
        self.assertEqual(rows.aliases_of_bundle("p1", BUNDLE_B), [])

    def test_delete_aliases_by_revision_bundle_all_and_empty(self) -> None:
        self.add_project()
        rows.add_alias("p1", KEY_A, DIGEST, BUNDLE_A)
        rows.add_alias("p1", KEY_B, DIGEST, BUNDLE_A)
        rows.add_alias("p1", KEY_C, DIGEST, BUNDLE_B)
        self.assertEqual(rows.delete_aliases("p1", revision_keys=[]), 0)  # empty matches nothing
        self.assertEqual(rows.delete_aliases("p1", revision_keys=[], bundle_keys=[]), 0)
        self.assertEqual(len(rows.aliases("p1")), 3)
        self.assertEqual(rows.delete_aliases("p1", revision_keys=[KEY_A]), 1)
        self.assertIsNone(rows.get_alias("p1", KEY_A, DIGEST))
        self.assertEqual(rows.delete_aliases("p1", bundle_keys=[BUNDLE_A]), 1)  # KEY_B's target
        self.assertIsNone(rows.get_alias("p1", KEY_B, DIGEST))
        self.assertEqual(rows.delete_aliases("p1"), 1)  # both None deletes the rest
        self.assertEqual(rows.aliases("p1"), [])

    def test_prune_aliases_keeps_kept_and_recent_and_removes_old(self) -> None:
        self.add_project()
        rows.add_alias("p1", KEY_A, DIGEST, BUNDLE_A)  # kept by key
        rows.add_alias("p1", KEY_B, DIGEST, BUNDLE_A)  # unkept, recently used
        rows.add_alias("p1", KEY_C, DIGEST, BUNDLE_A)  # unkept, gone stale
        with self.scratch.connection() as conn:
            conn.execute(
                "UPDATE ws_design_bundle_aliases SET last_used_at = NOW() - make_interval(days => %s) WHERE revision_key=%s",
                (40, KEY_C),
            )
        self.assertEqual(rows.prune_aliases("p1", [KEY_A], older_than_days=30), 1)
        self.assertIsNotNone(rows.get_alias("p1", KEY_A, DIGEST))
        self.assertIsNotNone(rows.get_alias("p1", KEY_B, DIGEST))
        self.assertIsNone(rows.get_alias("p1", KEY_C, DIGEST))

    def test_indexed_keys_are_the_commits_keys_at_any_digest(self) -> None:
        self.add_project()
        commit = "a" * 40
        rows.index_key("p1", commit, "1" * 64, KEY_A)
        rows.index_key("p1", commit, "2" * 64, KEY_B)
        rows.index_key("p1", "b" * 40, "1" * 64, KEY_C)
        self.assertEqual(rows.indexed_keys("p1", commit), {KEY_A, KEY_B})
        self.assertEqual(rows.indexed_keys("p1", "c" * 40), set())

    def test_recent_bundles_order_state_filter_and_limit(self) -> None:
        self.add_project()
        rows.upsert_bundle(bundle_key=BUNDLE_A, project_id="p1", revision_key=KEY_A, generator_digest=DIGEST,
                           commit=None, state="complete")
        rows.upsert_bundle(bundle_key=BUNDLE_B, project_id="p1", revision_key=KEY_B, generator_digest=DIGEST,
                           commit=None, state="failed")
        rows.upsert_bundle(bundle_key=BUNDLE_C, project_id="p1", revision_key=KEY_C, generator_digest=DIGEST,
                           commit=None, state="building")
        rows.upsert_bundle(bundle_key=BUNDLE_D, project_id="p1", revision_key=KEY_D, generator_digest=OTHER_DIGEST,
                           commit=None, state="complete")
        with self.scratch.connection() as conn:
            conn.execute("UPDATE ws_design_bundles SET updated_at = NOW() - make_interval(secs => %s) WHERE bundle_key=%s",
                         (10, BUNDLE_A))
            conn.execute("UPDATE ws_design_bundles SET updated_at = NOW() - make_interval(secs => %s) WHERE bundle_key=%s",
                         (5, BUNDLE_C))
        recent = rows.recent_bundles("p1", DIGEST, limit=5)
        self.assertEqual([row["bundle_key"] for row in recent], [BUNDLE_C, BUNDLE_A])  # newest first; failed and other generator out
        self.assertEqual([row["bundle_key"] for row in rows.recent_bundles("p1", DIGEST, limit=1)], [BUNDLE_C])


RK = "faea5ace66f591553c21fdcb2555e5a67e6e2fe73b7d17663375ac6f809206f5"
CONFIG = {
    "schema": "prism.revision_key.effective_config.a1",
    "project_file": "board/demo.kicad_pro",
    "root_schematic": "board/demo.kicad_sch",
    "board": "board/demo.kicad_pcb",
    "excluded_dirs": ["board/Design-Outputs"],
}


class StubReuseTests(unittest.TestCase):
    def setUp(self) -> None:
        install_stub(self)
        self.tmp = Path(self.enterContext(tempfile.TemporaryDirectory()))
        self.src = self.tmp / "src"
        for rel, content in PROJECT_FILES.items():
            (self.src / rel).parent.mkdir(parents=True, exist_ok=True)
            (self.src / rel).write_text(content, encoding="utf-8")
        self.out = self.tmp / "store" / "b.prism"
        self.out.parent.mkdir()
        self.config_path = self.tmp / "effective.json"
        self.record_path = self.tmp / "record.json"

    def _build(self) -> None:
        self._record(entries=[])
        self.config_path.write_text(json.dumps(CONFIG), encoding="utf-8")
        cli.run(
            ["bundle", "build", str(self.src / "board/demo.kicad_pro"), "--stage", "parse", "--source-root", str(self.src),
             "-o", str(self.out), "--revision-key", RK, "--config", str(self.config_path), "--key-record", str(self.record_path),
             *cli.limits("parse")],
            timeout_seconds=60, expect="prism.cli.build_result.a0",
        )

    def _record(self, *, config: dict | None = None, entries: list[dict] | None = None) -> None:
        document = {"revision_key": RK, "config": CONFIG if config is None else config, "entries": entries or []}
        self.record_path.write_text(json.dumps(document), encoding="utf-8")

    def _entries(self) -> list[dict]:
        members = open_archive(self.out).manifest["members"]
        return [
            {"path": member["source"]["path"], "kind": member["source"]["kind"], "object_id": member["source"]["object_id"]}
            for member in members if "source" in member
        ]

    def _reuse(self) -> cli.CliRun:
        return cli.run(["bundle", "reuse", "--in", str(self.out), "--key-record", str(self.record_path)],
                       timeout_seconds=60, expect="prism.cli.reuse_result.a0")

    def test_it_holds_with_the_record_the_bundle_was_built_with(self) -> None:
        self._build()
        self._record(entries=self._entries())
        done = self._reuse()
        self.assertEqual(done.exit_code, 0)
        self.assertTrue(done.document["holds"])
        self.assertNotIn("failure", done.document)
        self.assertEqual(done.document["revision_key"], RK)
        self.assertEqual(done.document["bundle_key"], open_archive(self.out).manifest["bundle_key"])
        schemas.validate(done.document, "prism.cli.reuse_result.a0")

    def test_an_entry_with_another_object_id_fails_the_read(self) -> None:
        self._build()
        entries = self._entries()
        next(entry for entry in entries if entry["path"] == "board/demo.kicad_sch")["object_id"] = "0" * 40
        self._record(entries=entries)
        done = self._reuse()
        self.assertFalse(done.document["holds"])
        self.assertEqual(done.document["failure"]["condition"], "read")
        self.assertEqual(done.document["failure"]["path"], "board/demo.kicad_sch")
        schemas.validate(done.document, "prism.cli.reuse_result.a0")

    def test_another_config_fails_config_before_read(self) -> None:
        self._build()
        self._record(config={**CONFIG, "board": "board/other.kicad_pcb"}, entries=self._entries())
        done = self._reuse()
        self.assertFalse(done.document["holds"])
        self.assertEqual(done.document["failure"]["condition"], "config")
        self.assertNotIn("path", done.document["failure"])
        schemas.validate(done.document, "prism.cli.reuse_result.a0")

    def test_a_usage_error_without_in_is_exit_2(self) -> None:
        with self.assertRaises(cli.CliFailure) as caught:
            cli.run(["bundle", "reuse", "--key-record", str(self.record_path)],
                    timeout_seconds=30, expect="prism.cli.reuse_result.a0")
        self.assertEqual(caught.exception.exit_code, 2)
        self.assertFalse(caught.exception.retryable)


if __name__ == "__main__":
    unittest.main()
