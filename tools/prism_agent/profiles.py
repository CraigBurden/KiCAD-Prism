"""The agent's run profiles, in one place both the agent and the plugin read.

VENDORED: this file exists byte-for-byte in both ``kicad_plugin/`` and
``prism_agent/``. The plugin is installed into KiCad on its own and cannot import the
agent package, so the registry both sides depend on to find each other must exist in
both. If they drifted on any config-relevant field, the plugin would compute a
different config dir than the agent and never find it.
``tools/tests/test_vendored_parity.py`` fails the moment the two copies differ.

A profile is a named environment the agent and plugin run as. Two exist so a
developer can run a symlinked working copy AND the installed release at once
without them colliding: each profile has its own discovery file, settings,
single-instance lock, preferred port, and KiCad plugin identity.

Kept deliberately stdlib-only and free of any other project import, because the
KiCad plugin imports it from inside KiCad's Python, which is not this repo's
virtualenv. Everything here must work from a bare interpreter.

Selection order, resolved by ``resolve``:
1. an explicit name passed on the command line (``--profile``),
2. the ``PRISM_PROFILE`` environment variable,
3. auto-detection: a source checkout (the build script is a sibling) is "dev",
   anything else is "release".
"""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Profile:
    """One named environment the agent/plugin run as."""

    name: str
    label: str
    """Human name shown in KiCad and status output, e.g. "Prism (dev)"."""
    preferred_port: int
    """The port the agent binds when free; it falls back to an ephemeral one."""
    install_name: str
    """The folder name the plugin installs under in KiCad's plugin directory.

    Distinct per profile so KiCad loads both the dev and release plugins as
    separate toolbar buttons instead of one shadowing the other.
    """
    config_suffix: str
    """Appended to the config dir name so profiles never share runtime state.

    Empty for release, which keeps the historical unsuffixed config dir so an
    existing install's settings and discovery file are found unchanged.
    """


# The registry. Ports sit just above IANA's dynamic range boundary, adjacent so
# they read as a pair, and are only *preferred* (see server.bind): a taken port
# falls back to ephemeral, so this is a convenience, not a hard reservation.
PROFILES: dict[str, Profile] = {
    "release": Profile(
        name="release",
        label="Prism",
        preferred_port=48730,
        install_name="prism",
        config_suffix="",
    ),
    "dev": Profile(
        name="dev",
        label="Prism (dev)",
        preferred_port=48731,
        install_name="prism_dev",
        config_suffix="dev",
    ),
}

DEFAULT_PROFILE = "release"


def _auto_detect() -> str:
    """"dev" when running from a source checkout, else "release".

    A checkout has the repo's build script two levels up (tools/build_agent.py);
    an installed copy does not. This mirrors the historical detection so nothing
    changes for a user who never sets a profile.
    """
    tools = os.path.dirname(os.path.dirname(os.path.realpath(__file__)))
    return "dev" if os.path.isfile(os.path.join(tools, "build_agent.py")) else "release"


def resolve(explicit: str | None = None) -> Profile:
    """The active profile, honouring an explicit name, then env, then detection.

    Falls back to the default rather than raising on an unknown name, so a typo
    degrades to a working agent rather than a crash; callers that want to reject
    an unknown name can check ``is_known`` first.
    """
    name = (explicit or os.environ.get("PRISM_PROFILE") or "").strip()
    if not name:
        name = _auto_detect()
    return PROFILES.get(name, PROFILES[DEFAULT_PROFILE])


def is_known(name: str) -> bool:
    return name in PROFILES
