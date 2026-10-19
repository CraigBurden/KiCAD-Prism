"""The Git link's rules in isolation: paths, bytes and the commit decision (CONTRACTS.md §13)."""

from __future__ import annotations

import json
import unittest

from app.system_builder import git_link
from app.system_builder.document import new_document


def _document() -> dict:
    document = new_document("Flight stack", "An OBC and a payload")
    document["occurrences"] = [
        {"id": "occ_z", "label": "Payload", "source": {"kind": "redacted"}},
        {"id": "occ_a", "label": "OBC", "source": {"kind": "redacted"}},
    ]
    document["waivers"] = [
        {"id": "wav_z", "code": "occurrence-pending", "subject": "occurrence:occ_a", "reason": "lab"},
        {"id": "wav_a", "code": "connector-missing", "subject": "connector:occ_a/J9", "reason": "lab"},
    ]
    document["layout"] = {
        "occ_z": {"xNm": 2, "yNm": 0, "rotationDeg": 0, "mirror": False},
        "occ_a": {"xNm": 1, "yNm": 0, "rotationDeg": 0, "mirror": False},
    }
    return document


class PathRulesTest(unittest.TestCase):
    def test_the_default_path_is_a_kebab_case_slug_under_systems(self) -> None:
        self.assertEqual(
            git_link.default_path("Flight Stack"), "systems/flight-stack.system.json"
        )
        self.assertEqual(
            git_link.default_path("Flight stack!"), "systems/flight-stack.system.json"
        )
        self.assertEqual(git_link.default_path("  "), "systems/system.system.json")

    def test_a_repository_relative_system_file_is_accepted(self) -> None:
        for path in (
            "systems/flight-stack.system.json",
            "a/b/nested.system.json",
            "stack.system.json",
        ):
            with self.subTest(path=path):
                self.assertEqual(git_link.validate_path(path), path)

    def test_a_path_that_leaves_the_repository_or_enters_git_is_refused(self) -> None:
        for path in (
            "",
            "/tmp/stack.system.json",
            "C:/stack.system.json",
            "../stack.system.json",
            "systems/../../stack.system.json",
            "systems/./stack.system.json",
            "systems//stack.system.json",
            ".git/stack.system.json",
            "systems/.git/stack.system.json",
            "systems/.GIT/stack.system.json",
            "systems\\stack.system.json",
            "systems/stack.json",
            "systems/.system.json",
            "systems/stack.system.json\n",
        ):
            with self.subTest(path=path):
                with self.assertRaises(git_link.PathInvalid) as caught:
                    git_link.validate_path(path)
                self.assertEqual(caught.exception.code, "system_git_path_invalid")

    def test_branch_names_git_could_parse_as_an_option_are_refused(self) -> None:
        for branch in ("", "-upload", "main branch", "main..dev", "main.lock"):
            with self.subTest(branch=branch):
                with self.assertRaises(git_link.BranchInvalid):
                    git_link.validate_branch(branch)
        self.assertEqual(git_link.validate_branch("release/1c"), "release/1c")


class FileBytesTest(unittest.TestCase):
    def test_the_file_is_sorted_two_space_json_with_one_trailing_lf(self) -> None:
        document = _document()
        data = git_link.file_bytes(document)

        self.assertTrue(data.endswith(b"\n"))
        self.assertFalse(data.endswith(b"\n\n"))
        self.assertIn(b'\n  "description": ', data)
        self.assertIn(b'\n      "id": "occ_a"', data)

        decoded = data.decode("utf-8")
        self.assertEqual(
            decoded,
            json.dumps(
                git_link.canonical(_document()), indent=2, sort_keys=True, ensure_ascii=False
            ) + "\n",
        )

    def test_collections_are_in_id_order_and_the_input_is_not_mutated(self) -> None:
        document = _document()
        original = json.loads(json.dumps(document))

        data = git_link.file_bytes(document)

        parsed = json.loads(data)
        self.assertEqual([item["id"] for item in parsed["occurrences"]], ["occ_a", "occ_z"])
        self.assertEqual([item["id"] for item in parsed["waivers"]], ["wav_a", "wav_z"])
        self.assertEqual(list(parsed["layout"]), ["occ_a", "occ_z"])
        self.assertEqual(document, original)

    def test_every_object_key_is_in_code_point_order(self) -> None:
        data = git_link.file_bytes(_document())

        def check(value) -> None:
            if isinstance(value, dict):
                keys = list(value)
                self.assertEqual(keys, sorted(keys))
                for item in value.values():
                    check(item)
            elif isinstance(value, list):
                for item in value:
                    check(item)

        check(json.loads(data))

    def test_equivalent_documents_give_identical_bytes(self) -> None:
        first = _document()
        second = _document()
        second["occurrences"] = list(reversed(second["occurrences"]))
        second["waivers"] = list(reversed(second["waivers"]))
        self.assertEqual(git_link.file_bytes(first), git_link.file_bytes(second))


class CommitDecisionTest(unittest.TestCase):
    def test_a_changed_file_at_the_head_diverges(self) -> None:
        self.assertEqual(
            git_link.commit_outcome(last_blob="a" * 40, head_blob="b" * 40, desired_blob="c" * 40),
            git_link.DIVERGED,
        )
        self.assertEqual(
            git_link.commit_outcome(last_blob="", head_blob="b" * 40, desired_blob="c" * 40),
            git_link.DIVERGED,
        )
        self.assertEqual(
            git_link.commit_outcome(last_blob="a" * 40, head_blob="", desired_blob="c" * 40),
            git_link.DIVERGED,
        )

    def test_the_head_blob_already_being_the_document_is_unchanged(self) -> None:
        self.assertEqual(
            git_link.commit_outcome(last_blob="a" * 40, head_blob="a" * 40, desired_blob="a" * 40),
            git_link.UNCHANGED,
        )

    def test_an_untouched_file_with_a_new_document_commits(self) -> None:
        self.assertEqual(
            git_link.commit_outcome(last_blob="a" * 40, head_blob="a" * 40, desired_blob="b" * 40),
            git_link.COMMIT,
        )
        self.assertEqual(
            git_link.commit_outcome(last_blob="", head_blob="", desired_blob="b" * 40),
            git_link.COMMIT,
        )


if __name__ == "__main__":
    unittest.main()
