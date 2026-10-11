"""What plugin version this server expects.

The KiCad plugin talks to one Prism server, so its version has to follow that server's.
Letting the two drift is how you end up supporting a plugin from six months ago against
an API that has moved on.

This is deliberately NOT authenticated. A plugin too old to authenticate is exactly the
one that most needs to be told to update, and telling it so leaks nothing: the version
number and a download URL are public facts about a release.

Bump PLUGIN_EXPECTED when the server starts relying on plugin behaviour an older one
does not have. Bump PLUGIN_MIN only when an older plugin is genuinely broken against
this server, not merely behind: it is the difference between "you should update" and
"you must".
"""

from __future__ import annotations

from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()

# These two are edited BY HAND, and deliberately not derived from the plugin build.
# Prism releases far more often than the plugin does, so tying them together would mean
# every backend release claimed a plugin release that never happened. What they record
# is a judgement about compatibility, which is not something a build can work out.

# The newest plugin behaviour this server relies on. Older plugins are told to update.
# Not the latest plugin build: that is tools/kicad_plugin/version.py.
PLUGIN_EXPECTED = "0.5.0"

# The oldest plugin this server can still serve correctly.
#
# This TRAILS expected, and should stay behind it. Setting the two equal means the
# first bump to expected turns every plugin in the field from "you should update" into
# "you must": hard-blocked, mid-session, for being one release behind. Only raise this
# when an older plugin is genuinely broken against this server.
PLUGIN_MIN = "0.3.0"

# Where to get it. Overridable so a private deployment can serve its own build rather
# than sending users to a public repo they may not be able to reach.
DOWNLOAD_URL = settings.PRISM_PLUGIN_DOWNLOAD_URL


@router.get("/version")
async def plugin_version() -> dict:
    """The plugin version this server expects, and where to get it."""
    return {
        "expected": PLUGIN_EXPECTED,
        "minimum": PLUGIN_MIN,
        "download_url": DOWNLOAD_URL,
    }
