"""The version the package claims is the version the code reports.

It used to be a command-line argument that only reached metadata.json, so a build could
produce a zip PCM listed as 0.5.0 whose plugin told itself, and the server, that it was
0.4.0. Nothing failed: the panel showed the old number and the update check compared
the wrong one.

So the version is read from the source, and the plugin and agent are required to agree
with each other before anything is built.
"""

import importlib.util
import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parent.parent


def _load_packager():
    """Import package_plugin without importing the plugin package it lives beside."""
    spec = importlib.util.spec_from_file_location(
        "package_plugin", TOOLS / "package_plugin.py"
    )
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def packager():
    return _load_packager()


def test_the_version_comes_from_the_plugin_source(packager):
    """Read rather than imported: kicad_plugin imports pcbnew, which only exists
    inside KiCad, and the packager cannot import it either. That is why it parses the
    constant out of the file instead."""
    import re

    def constant(path: Path) -> str:
        text = path.read_text(encoding="utf-8")
        return re.search(r'^VERSION\s*=\s*"([^"]+)"', text, re.M).group(1)

    resolved = packager.resolve_version()
    assert resolved == constant(TOOLS / "kicad_plugin" / "version.py")
    assert resolved == constant(TOOLS / "prism_agent" / "version.py")


def test_a_plugin_and_agent_that_disagree_fail_the_build(packager, tmp_path, monkeypatch):
    """The one a person actually makes: bump one, forget the other.

    Caught here rather than in a user's version check, where it looks like the update
    mechanism is broken instead of like a release that was assembled wrong.
    """
    plugin_src = tmp_path / "kicad_plugin"
    agent_src = tmp_path / "prism_agent"
    plugin_src.mkdir()
    agent_src.mkdir()
    (plugin_src / "version.py").write_text('VERSION = "0.5.0"\n', encoding="utf-8")
    (agent_src / "version.py").write_text('VERSION = "0.4.0"\n', encoding="utf-8")

    monkeypatch.setattr(packager, "PLUGIN_SRC", plugin_src)
    monkeypatch.setattr(packager, "TOOLS", tmp_path)

    with pytest.raises(SystemExit, match="version mismatch"):
        packager.resolve_version()


def test_a_missing_version_is_an_error_not_a_blank(packager, tmp_path, monkeypatch):
    """Shipping an empty version would be worse than failing to ship."""
    plugin_src = tmp_path / "kicad_plugin"
    plugin_src.mkdir()
    (plugin_src / "version.py").write_text("# no version here\n", encoding="utf-8")
    monkeypatch.setattr(packager, "PLUGIN_SRC", plugin_src)

    with pytest.raises(SystemExit, match="couldn't find VERSION"):
        packager.resolve_version()


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
