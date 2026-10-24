"""Who may clone and push a Prism-hosted repo over /git/*.

The role gate alone let anyone who knew a prj_ id reach a repo whose folder their
role can no longer see. The repo is named after the project id, so the same folder
visibility the API applies has to hold here too.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import git_http  # noqa: E402
from app.core.security import AuthenticatedUser  # noqa: E402


def _user(role: str) -> AuthenticatedUser:
    return AuthenticatedUser(email=f"{role}@example.com", name=role, role=role)


LOOKUP = "app.api._helpers.workspace.get_project_for_role"
VISIBLE_ROW = {"id": "prj_abc", "name": "Board"}


class GitHttpAuthoriseTests(unittest.TestCase):
    def _authorise(self, role: str, path: str, row: dict | None) -> None:
        with patch(LOOKUP, return_value=row) as lookup:
            try:
                git_http._authorise(_user(role), "prj_abc", path)
            finally:
                self.lookup = lookup

    def test_a_viewer_can_clone_a_visible_project(self) -> None:
        self._authorise("viewer", "/git-upload-pack", VISIBLE_ROW)
        self.lookup.assert_called_once_with("prj_abc", "viewer")

    def test_a_designer_can_push_a_visible_project(self) -> None:
        self._authorise("designer", "/git-receive-pack", VISIBLE_ROW)

    def test_a_project_hidden_from_the_role_is_not_found(self) -> None:
        for path in ("/info/refs", "/git-upload-pack", "/git-receive-pack"):
            with self.subTest(path=path), self.assertRaises(HTTPException) as caught:
                self._authorise("designer", path, None)
            self.assertEqual(caught.exception.status_code, 404)

    def test_a_viewer_cannot_push_even_where_it_can_see(self) -> None:
        with self.assertRaises(HTTPException) as caught:
            self._authorise("viewer", "/git-receive-pack", VISIBLE_ROW)
        self.assertEqual(caught.exception.status_code, 403)


class GitHttpPathTests(unittest.TestCase):
    def test_a_malformed_repo_id_is_not_found_rather_than_a_server_error(self) -> None:
        """The visibility lookup runs before anything builds a path from the id."""
        project_id, sub_path = git_http._split("../etc.git/info/refs")
        with patch(LOOKUP, return_value=None):
            with self.assertRaises(HTTPException) as caught:
                git_http._authorise(_user("admin"), project_id, sub_path)
        self.assertEqual(caught.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
