"""Tests for rust_hygiene.py: the measurement and the ratchet.

    uv run --no-project --with-requirements native/scripts/rust_hygiene_requirements.txt \\
        python native/scripts/test_rust_hygiene.py
"""

from __future__ import annotations

import io
import json
import shutil
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import rust_hygiene  # noqa: E402

NATIVE = Path(__file__).resolve().parents[1]

CONFIG = """\
schema = 1
mode = "ratchet"
baseline = "rust-hygiene-baseline.json"

[limits]
max_parameters = 2
max_function_lines = 100
max_test_function_lines = 150
max_file_lines = 1000
max_cyclomatic_complexity = 2
max_nesting = 1

[paths]
source_roots = ["src"]
exclude_parts = [".git", "_build", "bindings", "build", "generated", "node_modules", "target", "third_party", "vendor"]
"""

CARGO = """\
[workspace]
members = []

[workspace.lints.clippy]
allow_attributes_without_reason = "deny"
cognitive_complexity = "deny"
too_many_arguments = "deny"
too_many_lines = "deny"
"""

CLIPPY = "too-many-arguments-threshold = 7\ntoo-many-lines-threshold = 100\ncognitive-complexity-threshold = 15\n"

SOURCE = """\
pub fn wide(a: u8, b: u8, c: u8) -> u8 { a + b + c }

pub fn branchy(x: u8) -> u8 {
    if x > 1 && x < 9 {
        for _ in 0..x {
            if x == 3 { return 1; }
        }
    }
    match x { 0 => 0, 1 => 1, _ => 2 }
}

impl Thing {
    fn method(&self, a: u8, b: u8) {}
}
"""


class RatchetTest(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix="rust-hygiene-test-"))
        self.addCleanup(shutil.rmtree, self.root)
        (self.root / "src").mkdir()
        (self.root / "src" / "lib.rs").write_text(SOURCE)
        (self.root / "rust-hygiene.toml").write_text(CONFIG)
        (self.root / "Cargo.toml").write_text(CARGO)
        (self.root / "clippy.toml").write_text(CLIPPY)

    def _run(self, **kwargs: object) -> tuple[int, str]:
        out = io.StringIO()
        with redirect_stdout(out):
            status = rust_hygiene.run(self.root, do_prune=False, **kwargs)  # type: ignore[arg-type]
        return status, out.getvalue()

    def _baseline(self) -> dict[tuple[str, str, str], int]:
        return rust_hygiene.load_baseline(self.root / "rust-hygiene-baseline.json")[1]

    def test_measurement(self) -> None:
        policy = rust_hygiene.load_policy(self.root)
        found = {(v.item, v.rule): v.value for v in rust_hygiene.scan(self.root, policy)[0]}
        self.assertEqual(
            found,
            {
                ("wide", "max_parameters"): 3,
                # 1 + if + && + for + if + (3 arms - 1)
                ("branchy", "max_cyclomatic_complexity"): 7,
                ("branchy", "max_nesting"): 3,
                ("Thing::method", "max_parameters"): 3,
            },
        )

    def test_new_debt_fails_and_recorded_debt_passes(self) -> None:
        rust_hygiene.write_baseline(self.root / "rust-hygiene-baseline.json", "empty", [])
        status, out = self._run()
        self.assertEqual(status, 1)
        self.assertIn("new Rust hygiene debt: src/lib.rs:wide max_parameters=3 exceeds 2", out)
        status, _ = self._run(record_rationale="adopt")
        self.assertEqual(status, 0)
        self.assertEqual(len(self._baseline()), 4)

    def test_growth_fails_and_prune_only_tightens(self) -> None:
        self._run(record_rationale="adopt")
        (self.root / "src" / "lib.rs").write_text(SOURCE.replace("c: u8)", "c: u8, d: u8)"))
        status, out = self._run()
        self.assertEqual(status, 1)
        self.assertIn("increased Rust hygiene debt: src/lib.rs:wide max_parameters=4 exceeds baseline 3", out)
        # Pay the debt down: `wide` drops to the limit, `method` loses one parameter.
        (self.root / "src" / "lib.rs").write_text(SOURCE.replace("c: u8)", ")").replace("a: u8, b: u8) {}", "a: u8) {}"))
        status, out = self._run()
        self.assertEqual(status, 0)
        self.assertIn("resolved debt still in the baseline", out)
        with redirect_stdout(io.StringIO()):
            rust_hygiene.run(self.root, do_prune=True)
        baseline = self._baseline()
        self.assertNotIn(("src/lib.rs", "wide", "max_parameters"), baseline)
        self.assertNotIn(("src/lib.rs", "Thing::method", "max_parameters"), baseline)
        self.assertEqual(baseline[("src/lib.rs", "branchy", "max_nesting")], 3)

    def test_loosened_limit_is_a_config_error(self) -> None:
        (self.root / "rust-hygiene.toml").write_text(CONFIG.replace("max_file_lines = 1000", "max_file_lines = 2000"))
        with self.assertRaises(rust_hygiene.ConfigError):
            rust_hygiene.load_policy(self.root)


class NativeWorkspaceTest(unittest.TestCase):
    def test_baseline_is_current(self) -> None:
        """The committed baseline admits native/ exactly as it is (the CI gate)."""
        out = io.StringIO()
        with redirect_stdout(out):
            status = rust_hygiene.run(NATIVE, do_prune=False)
        self.assertEqual(status, 0, out.getvalue())

    def test_baseline_layout_round_trips(self) -> None:
        path = NATIVE / "rust-hygiene-baseline.json"
        document, entries = rust_hygiene.load_baseline(path)
        with tempfile.TemporaryDirectory() as scratch:
            copy = Path(scratch) / path.name
            rust_hygiene.write_baseline(copy, str(document["rationale"]), document["violations"])  # type: ignore[arg-type]
            self.assertEqual(copy.read_text(), path.read_text())
        self.assertEqual(len(entries), len(json.loads(path.read_text())["violations"]))

    def test_member_lints_must_be_at_least_as_strict_as_the_workspace(self) -> None:
        workspace = {
            "rust": {"unsafe_code": "forbid"},
            "clippy": {"all": {"level": "warn", "priority": -1}, "too_many_lines": "deny"},
        }
        own = {"rust": {"unsafe_code": "deny"}, "clippy": {"all": {"level": "warn"}, "too_many_lines": "deny"}}
        self.assertEqual(rust_hygiene._weaker_lints(workspace, own), [])
        own["clippy"]["too_many_lines"] = "warn"
        self.assertEqual(rust_hygiene._weaker_lints(workspace, own), ["clippy.too_many_lines"])
        self.assertEqual(rust_hygiene._weaker_lints(workspace, {"rust": {"unsafe_code": "warn"}}),
                         ["rust.unsafe_code", "clippy.all", "clippy.too_many_lines"])


if __name__ == "__main__":
    unittest.main()
