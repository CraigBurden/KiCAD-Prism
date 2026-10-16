"""Design bundles for tests, without Rust: the stub CLI on a path, and small KiCad repositories.

``install_stub(test)`` puts ``tests/support/prism_kicad_stub.py`` behind an
executable named ``prism-kicad`` and points ``PRISM_DESIGN_BUNDLE_CLI_PATH`` at
it for the test; it returns the invocation log the stub appends to.
``project_repo(root)`` commits a one-project repository whose sources the
stub selects. Consumer tests (Wave 3) fabricate bundles the same way.
"""

from __future__ import annotations

import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app.core.config import settings
from support.repo import git

STUB = Path(__file__).resolve().parent / "prism_kicad_stub.py"

PROJECT_FILES: dict[str, str] = {
    "board/demo.kicad_pro": '{"meta": {"filename": "demo.kicad_pro"}}\n',
    "board/demo.kicad_sch": "(kicad_sch (version 20260306) (generator \"eeschema\"))\n",
    "board/demo.kicad_pcb": "(kicad_pcb (version 20260206) (generator \"pcbnew\"))\n",
    "board/demo.kicad_dru": "(version 1)\n",
    "board/Subsheets/power.kicad_sch": "(kicad_sch (version 20260306))\n",
    "board/fp-lib-table": "(fp_lib_table (version 7))\n",
    "board/.prism.json": '{"designOutputs": "Design-Outputs"}\n',
    "board/Design-Outputs/old.kicad_pcb": "(kicad_pcb (version 20260206))\n",
    "lib/models/part.step": "ISO-10303-21;\n",
    "README.md": "# demo\n",
}


def install_stub(test: unittest.TestCase, *, modes: str = "") -> Path:
    """The stub as ``prism-kicad`` for the length of ``test``; returns its invocation log."""

    bin_dir = Path(test.enterContext(tempfile.TemporaryDirectory(prefix="prism-kicad-stub-")))
    executable = bin_dir / "prism-kicad"
    executable.write_text(f'#!/bin/sh\nexec "{sys.executable}" "{STUB}" "$@"\n', encoding="utf-8")
    executable.chmod(0o755)
    log = bin_dir / "invocations.jsonl"
    test.enterContext(mock.patch.object(settings, "PRISM_DESIGN_BUNDLE_CLI_PATH", str(executable)))
    test.enterContext(mock.patch.dict(os.environ, {"PRISM_KICAD_STUB_LOG": str(log), "PRISM_KICAD_STUB_MODE": modes}))
    return log


def set_modes(modes: str) -> None:
    os.environ["PRISM_KICAD_STUB_MODE"] = modes


def project_repo(root: Path, files: dict[str, str] | None = None) -> Path:
    """A committed repository holding one project at ``board/demo.kicad_pro``."""

    git(None, "init", "-q", "-b", "main", str(root))
    for rel, content in (files if files is not None else PROJECT_FILES).items():
        target = root / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    git(root, "add", "-A")
    git(root, "-c", "commit.gpgsign=false", "commit", "-q", "-m", "demo")
    return root
