"""Test configuration for the agent and plugin suites.

Some suites drive a real engine on a full board (the merge engine on
feat/merge-editor: around twenty seconds a test). That work cannot be mocked or
cached away, and paying for it on every run while editing the plugin's UI is what
made the suite something to avoid rather than something to lean on.

So `slow` tests are skipped by default and run on request:

    python -m pytest tools/tests              # fast, seconds
    python -m pytest tools/tests --slow       # everything
    python -m pytest tools/tests -m slow --slow   # only the slow ones

CI passes --slow, so nothing is quietly dropped from the gate: see the agent-plugin
job in .github/workflows/dev-quality-gate.yml.
"""

from __future__ import annotations

import pytest

# Suites whose cost is the real engine rather than the test harness. Named here rather
# than marked file by file so the list is visible in one place. None on this branch;
# test_merge_session belongs here when the merge editor lands.
SLOW_MODULES: tuple[str, ...] = ()


def pytest_addoption(parser):
    parser.addoption(
        "--slow",
        action="store_true",
        default=False,
        help="run the slow engine tests as well as the fast suite",
    )


def pytest_configure(config):
    config.addinivalue_line(
        "markers", "slow: exercises a real engine on a full board"
    )


def pytest_collection_modifyitems(config, items):
    """Mark the slow modules, and skip them unless --slow was given."""
    for item in items:
        if item.module.__name__.rsplit(".", 1)[-1] in SLOW_MODULES:
            item.add_marker(pytest.mark.slow)

    if config.getoption("--slow"):
        return

    skip = pytest.mark.skip(reason="slow; run with --slow")
    for item in items:
        if "slow" in item.keywords:
            item.add_marker(skip)
