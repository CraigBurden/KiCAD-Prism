"""The prism:// handler must read the same settings as the agent that registered it.

The bug, found in the wild: a dev agent (PRISM_PROFILE=dev) registered a command with no
profile in it. The OS launches that handler as a fresh process carrying NONE of our
environment, so it fell back to the default profile and read a different settings file:
different server, no projects roots. The user added project folders in the plugin, saw
them saved, then got "no projects folder is set" when opening a commit.

The profile is part of *which agent this is*. It belongs in the registered command, not
in an environment we do not control at the moment the OS invokes us.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import protocol, version  # noqa: E402

TOOLS = str(Path(__file__).resolve().parent.parent)


def test_a_profiled_agent_bakes_its_profile_into_the_command(monkeypatch):
    monkeypatch.setenv("PRISM_PROFILE", "dev")
    bootstrap = protocol._launch_command()[2]
    assert "PRISM_PROFILE" in bootstrap
    assert "'dev'" in bootstrap


def test_an_unprofiled_agent_does_not(monkeypatch):
    """The installed agent has no profile, and injecting an empty one would be noise."""
    monkeypatch.setenv("PRISM_PROFILE", "")
    bootstrap = protocol._launch_command()[2]
    assert "PRISM_PROFILE" not in bootstrap


@pytest.mark.parametrize("profile", ["", "dev"])
def test_the_handler_resolves_the_registering_agents_config(profile, monkeypatch):
    """The one that actually matters. Run the registered bootstrap the way the OS does:
    a fresh process with NONE of our environment. It must land on the same config dir as
    the agent that wrote the command."""
    monkeypatch.setenv("PRISM_PROFILE", profile)
    bootstrap = protocol._launch_command()[2]

    probe = bootstrap.replace(
        "from prism_agent.__main__ import main; sys.exit(main())",
        "from prism_agent import discovery; print(discovery.config_dir().name)",
    )
    # No PRISM_PROFILE in the environment: this is exactly how Windows/Linux launch it.
    result = subprocess.run(
        [sys.executable, "-c", probe],
        capture_output=True,
        text=True,
        check=True,
        env=_scrubbed_env(),
    )
    # The expectation is not "empty profile means release": an unprofiled command
    # carries no PRISM_PROFILE, so the handler falls to auto-detection, and from a
    # source checkout that is 'dev' (build_agent.py is a sibling). The point of the
    # test is that the handler lands on the SAME config the registering agent would,
    # so compute the expectation the same way the agent resolves it, rather than
    # hard-coding release and failing in every checkout (CI included).
    from prism_agent import profiles

    expected = profiles.resolve(profile or None).config_suffix
    expected_dir = f"kicad-prism-{expected}" if expected else "kicad-prism"
    assert result.stdout.strip() == expected_dir


def _scrubbed_env() -> dict:
    """The bare environment the OS hands a URL handler, per platform.

    Windows needs SYSTEMROOT for the interpreter to start at all; POSIX does not,
    and pinning a C:\\Windows path there would break the subprocess on Linux CI.
    APPDATA points config_dir() somewhere harmless and writable on Windows; on
    POSIX config_dir() reads HOME/XDG, so it is simply left out.
    """
    import os

    env = {"PATH": "", "APPDATA": TOOLS}
    if sys.platform == "win32":
        env["SYSTEMROOT"] = os.environ.get("SYSTEMROOT", "C:\\Windows")
    else:
        # config_dir() falls back to ~/.config when XDG_CONFIG_HOME is unset, so a
        # HOME must exist for the probe to resolve a path.
        env["HOME"] = os.environ.get("HOME", TOOLS)
    return env


def test_the_bootstrap_sets_the_profile_before_importing_us(monkeypatch):
    """Order matters: discovery.PROFILE is captured at import time, so the environment
    has to be set BEFORE prism_agent is imported or the profile is read too late."""
    monkeypatch.setenv("PRISM_PROFILE", "dev")
    bootstrap = protocol._launch_command()[2]

    set_env = bootstrap.index("PRISM_PROFILE")
    do_import = bootstrap.index("from prism_agent")
    assert set_env < do_import


# -- noticing a registration that has gone stale ---------------------------


def test_a_registration_from_a_different_profile_is_stale(monkeypatch):
    """The bug. is_registered() said yes, because the key existed and looked fine, so
    nothing ever rewrote it and the handler kept reading the wrong settings file."""
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    # What an agent with NO profile wrote.
    monkeypatch.setenv("PRISM_PROFILE", "")
    stored = " ".join(f'"{p}"' for p in protocol._launch_command()) + ' "%1"'
    monkeypatch.setattr(protocol, "registered_command", lambda: stored)

    # We are now the dev agent. The stored command is not ours.
    monkeypatch.setenv("PRISM_PROFILE", "dev")
    assert protocol.is_stale() is True


def test_our_own_registration_is_not_stale(monkeypatch):
    """Idempotence. Without this the agent rewrites the registry on every single boot."""
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setenv("PRISM_PROFILE", "dev")
    stored = " ".join(f'"{p}"' for p in protocol._launch_command()) + ' "%1"'
    monkeypatch.setattr(protocol, "registered_command", lambda: stored)

    assert protocol.is_stale() is False


def test_a_mac_bundle_with_no_version_marker_is_stale(tmp_path, monkeypatch):
    """A bundle from before the marker existed at all: rebuild it once rather than
    assume it is current, since there is nothing to compare against."""
    bundle = tmp_path / "KiCad-Prism Agent.app"
    bundle.mkdir()
    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setattr(protocol, "_mac_app_bundle", lambda: bundle)
    monkeypatch.setattr(version, "VERSION", "0.5.5")

    assert protocol.is_stale() is True


def test_a_mac_bundle_from_an_older_version_is_stale(tmp_path, monkeypatch):
    bundle = tmp_path / "KiCad-Prism Agent.app"
    marker = bundle / "Contents" / "Resources" / "prism-agent-version.txt"
    marker.parent.mkdir(parents=True)
    marker.write_text("0.5.4", encoding="utf-8")

    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setattr(protocol, "_mac_app_bundle", lambda: bundle)
    monkeypatch.setattr(version, "VERSION", "0.5.5")

    assert protocol.is_stale() is True


def test_a_mac_bundle_matching_the_running_version_is_not_stale(tmp_path, monkeypatch):
    """Idempotence, same as the Windows case: without this the bundle rebuilds on
    every single boot."""
    bundle = tmp_path / "KiCad-Prism Agent.app"
    marker = bundle / "Contents" / "Resources" / "prism-agent-version.txt"
    marker.parent.mkdir(parents=True)
    marker.write_text("0.5.5", encoding="utf-8")

    monkeypatch.setattr(sys, "platform", "darwin")
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setattr(protocol, "_mac_app_bundle", lambda: bundle)
    monkeypatch.setattr(version, "VERSION", "0.5.5")

    assert protocol.is_stale() is False


@pytest.mark.skipif(
    sys.platform != "win32", reason="drive-letter casing is a Windows thing"
)
def test_a_difference_in_drive_letter_case_is_not_stale(monkeypatch):
    """sys.executable reports 'c:\\...' while the registry holds 'C:\\...'. That means
    nothing, and treating it as a difference would rewrite the registry forever."""
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setenv("PRISM_PROFILE", "dev")
    stored = " ".join(f'"{p}"' for p in protocol._launch_command()) + ' "%1"'
    monkeypatch.setattr(protocol, "registered_command", lambda: stored.upper())

    assert protocol.is_stale() is False


def test_an_unregistered_scheme_is_not_stale(monkeypatch):
    """Absent is 'off', not 'stale'. This must never claim the scheme uninvited."""
    monkeypatch.setattr(protocol, "is_registered", lambda: False)
    assert protocol.is_stale() is False


def test_a_command_we_cannot_read_back_is_not_stale(monkeypatch):
    """On a platform where we cannot read the registration, do not guess and do not
    rewrite: a wrong guess would clobber a working handler."""
    monkeypatch.setattr(protocol, "is_registered", lambda: True)
    monkeypatch.setattr(protocol, "registered_command", lambda: "")
    assert protocol.is_stale() is False


# -- macOS: the AppleScript applet source ----------------------------------
#
# LaunchServices delivers a prism:// invocation as a kAEGetURL Apple Event, not argv;
# a bare shell script has no run loop to catch it, so the URL was silently dropped
# every time (confirmed against a real Mac: the process launched, checked in, and
# exited with nothing having reached protocol.parse()). The fix, an AppleScript applet
# built by osacompile, has one thing worth pinning down without a Mac to test on: the
# generated script must still be valid AppleScript, and the URL it hands to the shell
# must be genuinely shell-quoted, not spliced into our own trusted command string.


def test_the_applet_source_shells_out_to_the_launch_command():
    script = protocol._open_location_applescript(["/usr/bin/prism-agent", "--open-url"])
    assert "on open location theURL" in script
    assert "end open location" in script
    # The shell command, with its own quoting escaped for the AppleScript literal
    # that wraps it.
    assert '\\"/usr/bin/prism-agent\\" \\"--open-url\\"' in script
    # theURL is concatenated as its own shell-quoted word, not embedded in the command
    # string: a URL is untrusted input, and the command string is not.
    assert "quoted form of theURL" in script


def test_a_quote_in_the_command_does_not_break_the_applescript_string():
    """The launch command embeds a real filesystem path (see _launch_command's
    bootstrap script, itself full of quotes); one that happened to carry a double
    quote or backslash must not terminate the AppleScript string literal early."""
    script = protocol._open_location_applescript(['/Applications/Weird "Path"/agent'])
    # Every embedded quote is escaped, so the whole path stays inside ONE AppleScript
    # string literal rather than closing it early partway through.
    assert '\\"/Applications/Weird \\"Path\\"/agent\\"' in script
    assert script.count('do shell script "') == 1


def test_the_applet_runs_the_handler_in_the_background_inside_try():
    """`do shell script` blocks until the handler exits (a dialog included), queueing
    every further click; an uncaught failure is a raw AppleScript error dialog."""
    script = protocol._open_location_applescript(["/usr/bin/prism-agent", "--open-url"])
    assert "    try\n" in script and "    end try\n" in script
    assert '" > /dev/null 2>&1 &"' in script


# -- macOS: building the bundle --------------------------------------------


@pytest.fixture
def fake_mac_tools(tmp_path, monkeypatch):
    """osacompile and PlistBuddy, simulated: this runs on any OS."""
    bundle = tmp_path / "Applications" / "KiCad-Prism Agent.app"
    monkeypatch.setattr(protocol, "_mac_app_bundle", lambda: bundle)
    monkeypatch.setattr(protocol, "_launch_command", lambda: ["/usr/bin/prism-agent"])
    monkeypatch.setattr(version, "VERSION", "0.5.10")
    state = {"plist_fails": False}

    def run(cmd, **_kwargs):
        if cmd[0] == "osacompile":
            out = Path(cmd[2])
            (out / "Contents" / "Resources").mkdir(parents=True)
            (out / "Contents" / "Info.plist").write_text("<plist/>")
            return subprocess.CompletedProcess(cmd, 0, "", "")
        if cmd[0].endswith("PlistBuddy"):
            code = 1 if state["plist_fails"] else 0
            return subprocess.CompletedProcess(cmd, code, "", "Entry Already Exists")
        return subprocess.CompletedProcess(cmd, 0, "", "")

    monkeypatch.setattr(protocol.subprocess, "run", run)
    return bundle, state


def test_a_rebuild_replaces_the_bundle_and_marks_its_version(fake_mac_tools):
    bundle, _state = fake_mac_tools
    (bundle / "Contents").mkdir(parents=True)
    (bundle / "Contents" / "old.txt").write_text("previous build")

    protocol._register_macos()

    assert not (bundle / "Contents" / "old.txt").exists()
    assert protocol._mac_version_marker(bundle).read_text() == "0.5.10"
    assert not bundle.with_name(bundle.name + ".old").exists()


def test_a_failed_plist_edit_keeps_the_working_bundle_and_writes_no_marker(fake_mac_tools):
    """The old code deleted the bundle first and wrote the marker regardless, so a
    failed edit left a bundle claiming no scheme that is_stale() called current."""
    bundle, state = fake_mac_tools
    marker = protocol._mac_version_marker(bundle)
    marker.parent.mkdir(parents=True)
    marker.write_text("0.5.9")
    state["plist_fails"] = True

    with pytest.raises(protocol.RegistrationError):
        protocol._register_macos()

    assert marker.read_text() == "0.5.9"  # the working one, untouched


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
