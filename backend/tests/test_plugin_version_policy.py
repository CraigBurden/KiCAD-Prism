"""The numbers that decide whether a user's plugin keeps working.

Two of them are edited by hand, and a slip in either is felt by every installed
plugin at once: too high a floor hard-blocks people mid-session for being one release
behind, and a floor above the version we actually ship blocks everybody including the
plugin that came with this server. Neither shows up in ordinary use of the codebase,
so they are pinned here.

Deliberately NOT derived from the plugin build. Prism releases far more often than the
plugin does, and coupling them would mean every backend release claimed a plugin
release that never happened.
"""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.api import plugin  # noqa: E402


def _parts(version: str) -> tuple:
    return tuple(int(x) for x in version.split("."))


class PluginVersionPolicyTests(unittest.TestCase):
    def test_the_floor_is_not_above_what_we_ship(self) -> None:
        """A floor above expected blocks every plugin there is, including ours."""
        self.assertLessEqual(
            _parts(plugin.PLUGIN_MIN),
            _parts(plugin.PLUGIN_EXPECTED),
            "PLUGIN_MIN must not be newer than PLUGIN_EXPECTED",
        )

    def test_the_floor_trails_what_we_ship(self) -> None:
        """Equal is legal but almost never intended.

        With the two equal, the next bump to expected flips every plugin in the field
        from "you should update" to "you must", which is a hard block for being one
        release behind. The floor is for a plugin that is genuinely broken against this
        server, not merely behind it.
        """
        self.assertLess(
            _parts(plugin.PLUGIN_MIN),
            _parts(plugin.PLUGIN_EXPECTED),
            "PLUGIN_MIN should trail PLUGIN_EXPECTED; raise it only when an older "
            "plugin is actually broken against this server",
        )

    def test_the_endpoint_reports_both_and_a_download(self) -> None:
        """The plugin decides ok/update/required from exactly these three fields."""
        import asyncio

        payload = asyncio.run(plugin.plugin_version())
        self.assertEqual(payload["expected"], plugin.PLUGIN_EXPECTED)
        self.assertEqual(payload["minimum"], plugin.PLUGIN_MIN)
        self.assertTrue(payload["download_url"])


if __name__ == "__main__":
    unittest.main()
