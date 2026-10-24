"""Saving a setting an agent is too old to understand.

The bug this pins, found in the wild: the user added folders in the Projects card and
pressed Save. The running agent predated `projects_roots`, so `update()` quietly dropped
the key, `save()` wrote a file without it, and the route answered 200. The plugin
reported success and the folders were gone.

Accepting something you cannot store and calling it success is worse than refusing it.

The tolerance itself is right and must stay: KiCad reloads the plugin while the agent
survives across restarts, so a NEW plugin meeting an OLD agent is the normal state during
an upgrade. It must not crash. It must just not lie.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import settings as settings_store  # noqa: E402


@pytest.fixture(autouse=True)
def config_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("APPDATA", str(tmp_path))
    monkeypatch.setenv("XDG_CONFIG_HOME", str(tmp_path))
    return tmp_path


def test_a_known_setting_is_stored_and_reported_as_stored():
    saved, ignored = settings_store.apply(projects_roots=["/work/boards"])
    assert saved.projects_roots == ["/work/boards"]
    assert ignored == []


def test_it_survives_a_reload(tmp_path):
    settings_store.apply(projects_roots=["/work/boards"])
    # A fresh read, as a restarted agent (or the next dialog open) would do.
    assert settings_store.load().projects_roots == ["/work/boards"]


def test_an_unknown_setting_is_reported_rather_than_swallowed():
    """The actual bug. A key this agent does not have must come back in `ignored`, so
    the caller can tell the user instead of claiming success."""
    saved, ignored = settings_store.apply(a_setting_from_a_newer_plugin=True)
    assert ignored == ["a_setting_from_a_newer_plugin"]


def test_an_unknown_setting_does_not_crash_the_agent():
    """The tolerance has to stay. A new plugin meeting an old agent is the normal state
    during an upgrade, not an exotic one."""
    saved, _ = settings_store.apply(server_url="http://example.com", something_new="x")
    # The keys it DID understand still landed.
    assert saved.server_url == "http://example.com"


def test_known_and_unknown_keys_in_one_save_are_separated():
    saved, ignored = settings_store.apply(
        server_url="http://example.com",
        projects_roots=["/a"],
        from_the_future=1,
    )
    assert saved.server_url == "http://example.com"
    assert saved.projects_roots == ["/a"]
    assert ignored == ["from_the_future"]


def test_update_still_works_for_callers_that_do_not_care():
    saved = settings_store.update(projects_roots=["/a"])
    assert saved.projects_roots == ["/a"]


def test_a_none_value_is_left_alone_not_stored_as_none():
    """The plugin omits fields it is not managing. `None` means "not asked for", and
    writing it would clear a setting the user never touched."""
    settings_store.apply(server_url="http://example.com")
    saved, _ = settings_store.apply(server_url=None, projects_roots=["/a"])
    assert saved.server_url == "http://example.com"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
