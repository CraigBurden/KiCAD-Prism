"""Identity in the repo: the `project` block in `.prism.json`.

The dangerous direction here is *destructive*, not absent: `.prism.json` is a file the
user may have hand-written (paths, portfolio metadata, custom project name), and this
code opens it for writing. Losing someone's path config to add an id they never asked
for would be a far worse bug than failing to stamp one. Most of these tests guard that.
"""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import project_identity_service as ident  # noqa: E402


class ProjectIdentityTests(unittest.TestCase):
    def setUp(self) -> None:
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.project = Path(temporary.name)

    def marker(self) -> Path:
        return self.project / ".prism.json"

    def read_raw(self) -> dict:
        return json.loads(self.marker().read_text(encoding="utf-8"))

    # -- writing -----------------------------------------------------------

    def test_stamps_a_project_with_no_marker_at_all(self) -> None:
        self.assertIs(ident.write(self.project, "prj_abc123", "https://prism.example.com"), True)
        self.assertEqual(
            self.read_raw()["project"],
            {"id": "prj_abc123", "server": "https://prism.example.com"},
        )

    def test_omits_server_when_it_is_not_configured(self) -> None:
        # An empty PRISM_SERVER_URL is the default. Better to write no server than a
        # wrong one, since the id alone identifies the project.
        ident.write(self.project, "prj_abc123", "")
        self.assertEqual(self.read_raw()["project"], {"id": "prj_abc123"})

    def test_preserves_everything_else_in_the_file(self) -> None:
        self.marker().write_text(
            json.dumps(
                {
                    "project_name": "My Board",
                    "description": "hand written",
                    "paths": {"pcb": "boards/main.kicad_pcb"},
                    "portfolio": {"featured": True},
                }
            ),
            encoding="utf-8",
        )

        ident.write(self.project, "prj_abc123")

        data = self.read_raw()
        self.assertEqual(data["project_name"], "My Board")
        self.assertEqual(data["description"], "hand written")
        self.assertEqual(data["paths"], {"pcb": "boards/main.kicad_pcb"})
        self.assertEqual(data["portfolio"], {"featured": True})
        self.assertEqual(data["project"]["id"], "prj_abc123")

    def test_rewriting_the_same_identity_does_not_touch_the_file(self) -> None:
        ident.write(self.project, "prj_abc123", "https://prism.example.com")
        before = self.marker().read_bytes()

        # False means "already said this". It matters: a rewrite would dirty the working
        # tree on every server boot, since this runs in the startup backfill.
        self.assertIs(ident.write(self.project, "prj_abc123", "https://prism.example.com"), False)
        self.assertEqual(self.marker().read_bytes(), before)

    def test_a_changed_server_is_rewritten(self) -> None:
        ident.write(self.project, "prj_abc123", "https://old.example.com")
        self.assertIs(ident.write(self.project, "prj_abc123", "https://new.example.com"), True)
        self.assertEqual(self.read_raw()["project"]["server"], "https://new.example.com")

    def test_refuses_to_clobber_a_file_it_cannot_parse(self) -> None:
        # A hand-written .prism.json with a trailing comma is a real thing. Overwriting
        # it to add an id would destroy the user's config. Leave it alone and say so.
        broken = '{"paths": {"pcb": "main.kicad_pcb"},}'
        self.marker().write_text(broken, encoding="utf-8")

        self.assertIs(ident.write(self.project, "prj_abc123"), False)
        self.assertEqual(self.marker().read_text(encoding="utf-8"), broken)

    def test_refuses_to_clobber_a_file_that_is_not_an_object(self) -> None:
        self.marker().write_text("[1, 2, 3]", encoding="utf-8")
        # A JSON array parses fine but is not a config. Do not turn it into one.
        ident.write(self.project, "prj_abc123")
        self.assertEqual(self.read_raw()["project"]["id"], "prj_abc123")

    def test_write_to_a_missing_directory_fails_quietly(self) -> None:
        # Never raise: a project that cannot be stamped is one that keeps working the
        # old way. Failing an import over identity would be a bad trade.
        self.assertIs(ident.write(self.project / "does-not-exist", "prj_abc123"), False)

    # -- reading -----------------------------------------------------------

    def test_read_returns_none_when_there_is_no_marker(self) -> None:
        self.assertIsNone(ident.read(self.project))
        self.assertIsNone(ident.project_id(self.project))

    def test_read_returns_none_when_the_marker_has_no_project_block(self) -> None:
        self.marker().write_text(json.dumps({"paths": {}}), encoding="utf-8")
        self.assertIsNone(ident.read(self.project))

    def test_read_returns_none_when_the_block_has_no_id(self) -> None:
        # A block without an id is not an identity, it is noise.
        self.marker().write_text(
            json.dumps({"project": {"server": "https://prism.example.com"}}),
            encoding="utf-8",
        )
        self.assertIsNone(ident.read(self.project))

    def test_read_survives_an_unparseable_marker(self) -> None:
        self.marker().write_text("{not json", encoding="utf-8")
        self.assertIsNone(ident.read(self.project))

    def test_round_trip(self) -> None:
        ident.write(self.project, "prj_abc123", "https://prism.example.com")
        self.assertEqual(ident.project_id(self.project), "prj_abc123")

    # -- matching ----------------------------------------------------------

    def test_matches_on_id(self) -> None:
        ident.write(self.project, "prj_abc123", "https://prism.example.com")
        self.assertIs(ident.matches(self.project, "prj_abc123"), True)
        self.assertIs(ident.matches(self.project, "prj_other"), False)

    def test_matches_ignores_the_server(self) -> None:
        # `server` is a hint, not a constraint. The same repo may be registered on a
        # staging server and a production one, and a client that found the "wrong" one
        # should still recognise the project rather than refuse to work.
        ident.write(self.project, "prj_abc123", "https://staging.example.com")
        self.assertIs(ident.matches(self.project, "prj_abc123"), True)

    def test_matches_is_false_for_an_unstamped_project(self) -> None:
        self.assertIs(ident.matches(self.project, "prj_abc123"), False)


if __name__ == "__main__":
    unittest.main()
