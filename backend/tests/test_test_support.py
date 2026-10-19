"""The test-support module is the only place tests make schemas, tables and repositories.

Copies drift: a hand-made ``comments`` table once gave columns defaults that
production lacks, so an insert passed in tests and failed live. These checks fail
when a test module brings back its own schema teardown, database URL helpers,
production-table DDL or Git identity.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

TESTS = Path(__file__).resolve().parent

FORBIDDEN = {
    "its own schema teardown (use support.postgres.scratch_schema or drop_schema)": re.compile(r"DROP SCHEMA"),
    "its own database URL helpers (use support.postgres)": re.compile(
        r"^def _dsn\(|^SHARED_APPLICATION_DATABASE = |^def _(database_)?identity\(url", re.M
    ),
    "a copy of a production table (migrate with the ledger and seed rows)": re.compile(
        r"CREATE TABLE (IF NOT EXISTS )?(\"[^\"]*\"\.)?(comments|comment_replies|ws_\w+|tracker_connectors"
        r"|project_trackers|users|user_roles) ?\("
    ),
    "its own Git identity or git runner (use support.repo)": re.compile(
        r"\"user\.email|user\.email=|GIT_AUTHOR_|\[\"git\", |subprocess\.(run|check_output)\(\s*\[\s*\"git\""
    ),
}

# Each entry is a fixture whose point is the exact bytes it writes.
ALLOWED = {
    # Frozen DDL: databases as an older Prism left them, to prove the upgrade path.
    ("test_tracker_tr_01.py", "a copy of a production table (migrate with the ledger and seed rows)"),
    ("test_comments_foundation.py", "a copy of a production table (migrate with the ledger and seed rows)"),
    ("test_schema_ledger_adoption.py", "a copy of a production table (migrate with the ledger and seed rows)"),
}


class TestSupportIsTheOnlyCopyTests(unittest.TestCase):
    def test_no_test_module_makes_its_own_schema_table_or_repository(self) -> None:
        offenders = []
        for path in sorted(TESTS.glob("*.py")):
            if path.name == Path(__file__).name:
                continue
            text = path.read_text(encoding="utf-8")
            for reason, pattern in FORBIDDEN.items():
                if (path.name, reason) in ALLOWED:
                    continue
                for match in pattern.finditer(text):
                    line = text.count("\n", 0, match.start()) + 1
                    offenders.append(f"{path.name}:{line} has {reason}")
        self.assertEqual(offenders, [])

    def test_every_allowance_is_still_needed(self) -> None:
        for name, reason in ALLOWED:
            text = (TESTS / name).read_text(encoding="utf-8")
            self.assertRegex(text, FORBIDDEN[reason], f"{name} no longer needs its allowance")


if __name__ == "__main__":
    unittest.main()
