"""The ``prism`` CLI against canned API answers. Standard library only."""

from __future__ import annotations

import csv
import io
import json
import os
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from prism import cli  # noqa: E402
from prism import Client  # noqa: E402

BOM = {
    "commit": "abc123",
    "designKey": "design-key",
    "columns": ["Reference", "Qty", "Value"],
    "lines": [
        {
            "key": "value:10k",
            "quantity": 2,
            "references": ["R1", "R2"],
            "fields": {"Value": "10k"},
        }
    ],
}


class FakeTransport:
    def __init__(self, body, status: int = 200):
        self.body = body
        self.status = status
        self.calls = []

    def __call__(self, method, url, headers, body):
        self.calls.append({"method": method, "url": url, "headers": dict(headers), "body": body})
        return self.status, {"content-type": "application/json"}, json.dumps(self.body).encode("utf-8")


def run(argv, transport):
    client = Client("https://prism.example", token="t", transport=transport)
    stdout, stderr = io.StringIO(), io.StringIO()
    with patch.object(cli, "Client", lambda: client):
        with redirect_stdout(stdout), redirect_stderr(stderr):
            code = cli.main(argv)
    return code, stdout.getvalue(), stderr.getvalue()


class BomTests(unittest.TestCase):
    def test_bom_csv_writes_the_table(self) -> None:
        code, stdout, _stderr = run(["bom", "p1", "--csv"], FakeTransport(BOM))
        self.assertEqual(code, 0)
        rows = list(csv.reader(io.StringIO(stdout)))
        self.assertEqual(rows[0], ["Reference", "Qty", "Value"])
        self.assertEqual(rows[1], ["R1, R2", "2", "10k"])

    def test_bom_json_is_the_raw_body(self) -> None:
        code, stdout, _stderr = run(["bom", "p1", "--json"], FakeTransport(BOM))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(stdout), BOM)

    def test_human_table_is_the_default(self) -> None:
        code, stdout, _stderr = run(["bom", "p1"], FakeTransport(BOM))
        self.assertEqual(code, 0)
        self.assertIn("Reference", stdout)
        self.assertIn("R1, R2", stdout)


class CommandTests(unittest.TestCase):
    def test_projects_list(self) -> None:
        body = [{"id": "p1", "name": "board", "path": "/boards/board"}]
        code, stdout, _stderr = run(["projects", "list", "--json"], FakeTransport(body))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(stdout), body)

    def test_design_search(self) -> None:
        body = {
            "revision": {"commit": "abc", "designKey": "k"},
            "query": "R1",
            "results": [
                {"kind": "component", "reference": "R1", "value": "10k", "matched": "reference"}
            ],
        }
        code, stdout, _stderr = run(
            ["design", "search", "p1", "R1", "--revision", "abc"], FakeTransport(body)
        )
        self.assertEqual(code, 0)
        self.assertIn("R1", stdout)

    def test_job_wait(self) -> None:
        body = {"job_id": "j1", "status": "completed", "kind": "design_bundle"}
        code, stdout, _stderr = run(["job", "j1", "--wait", "--json"], FakeTransport(body))
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(stdout), body)


class ExitCodeTests(unittest.TestCase):
    def test_prism_error_exits_one_with_code_and_detail(self) -> None:
        transport = FakeTransport({"detail": "no such project", "code": "project-not-found"}, status=404)
        code, stdout, stderr = run(["project", "missing"], transport)
        self.assertEqual(code, 1)
        self.assertEqual(stdout, "")
        self.assertEqual(stderr.strip(), "project-not-found: no such project")

    def test_missing_base_url_exits_two_without_a_traceback(self) -> None:
        stderr = io.StringIO()
        with patch.dict(os.environ, {}, clear=True):
            with redirect_stderr(stderr):
                code = cli.main(["projects", "list"])
        self.assertEqual(code, 2)
        self.assertIn("PRISM_URL", stderr.getvalue())


if __name__ == "__main__":
    unittest.main()
