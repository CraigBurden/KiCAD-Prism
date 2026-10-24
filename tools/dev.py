"""One entry point for running Prism's agent and plugin during development.

Two profiles exist so a symlinked working copy and the installed release can run
at once without colliding: each has its own discovery file, settings, port, and
KiCad plugin identity (see prism_agent/profiles.py). This wraps the agent and
the plugin installer in one command per environment, and adds a status view of
what is actually running.

    python tools/dev.py agent --profile dev        # run the dev agent
    python tools/dev.py agent --profile release    # run the release agent
    python tools/dev.py plugin install --profile dev       # symlink dev plugin
    python tools/dev.py plugin install --profile release   # copy release plugin
    python tools/dev.py plugin uninstall --profile dev
    python tools/dev.py status                     # what's running, per profile

Profile defaults to auto-detection (a source checkout is "dev"); pass --profile
to be explicit. The agent binds its profile's preferred port when free and an
ephemeral one otherwise, so status is how you see where it actually landed.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))

from prism_agent import discovery  # noqa: E402
from prism_agent.profiles import PROFILES, resolve  # noqa: E402


def _config_dir_for(profile_name: str) -> Path:
    """Where a given profile publishes its discovery file.

    Resolves through discovery.config_dir with PRISM_PROFILE forced, so this
    matches exactly what that profile's agent and plugin compute.
    """
    saved = os.environ.get("PRISM_PROFILE")
    os.environ["PRISM_PROFILE"] = profile_name
    try:
        return discovery.config_dir()
    finally:
        if saved is None:
            os.environ.pop("PRISM_PROFILE", None)
        else:
            os.environ["PRISM_PROFILE"] = saved


def _read_endpoint(profile_name: str) -> dict | None:
    path = _config_dir_for(profile_name) / discovery.ENDPOINT_FILE
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _pid_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    if sys.platform == "win32":
        out = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            capture_output=True,
            text=True,
        )
        return str(pid) in out.stdout
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def cmd_agent(args: argparse.Namespace) -> int:
    profile = resolve(args.profile)
    env = dict(os.environ, PRISM_PROFILE=profile.name)
    cmd = [sys.executable, "-m", "prism_agent"]
    if args.no_tray:
        cmd.append("--no-tray")
    print(f"Starting the {profile.label} agent (profile '{profile.name}', "
          f"preferred port {profile.preferred_port})...")
    return subprocess.call(cmd, cwd=str(TOOLS), env=env)


def cmd_plugin(args: argparse.Namespace) -> int:
    cmd = [sys.executable, str(TOOLS / "install_plugin.py")]
    if args.plugin_action == "uninstall":
        cmd.append("--uninstall")
    if getattr(args, "copy", False):
        cmd.append("--copy")
    if args.profile:
        cmd += ["--profile", args.profile]
    if getattr(args, "dir", None):
        cmd += ["--dir", args.dir]
    return subprocess.call(cmd, cwd=str(TOOLS.parent))


def cmd_status(args: argparse.Namespace) -> int:
    print(f"{'PROFILE':<10}{'PORT':<8}{'PID':<8}{'ALIVE':<7}{'VERSION':<12}LABEL")
    for name in sorted(PROFILES):
        profile = PROFILES[name]
        data = _read_endpoint(name)
        if not data:
            print(f"{name:<10}{'-':<8}{'-':<8}{'-':<7}{'-':<12}{profile.label}")
            continue
        pid = int(data.get("pid", 0) or 0)
        alive = "yes" if _pid_alive(pid) else "stale"
        print(
            f"{name:<10}{str(data.get('port', '-')):<8}{str(pid):<8}"
            f"{alive:<7}{str(data.get('version') or '-'):<12}{profile.label}"
        )
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(prog="dev.py", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="command", required=True)

    profile_names = sorted(PROFILES)

    p_agent = sub.add_parser("agent", help="run the agent for a profile")
    p_agent.add_argument("--profile", choices=profile_names)
    p_agent.add_argument("--no-tray", action="store_true",
                         help="run headless (no tray icon)")
    p_agent.set_defaults(func=cmd_agent)

    p_plugin = sub.add_parser("plugin", help="install/uninstall the KiCad plugin")
    p_plugin.add_argument("plugin_action", choices=["install", "uninstall"])
    p_plugin.add_argument("--profile", choices=profile_names)
    p_plugin.add_argument("--copy", action="store_true",
                          help="copy instead of symlinking (install only)")
    p_plugin.add_argument("--dir", help="KiCad plugin dir (default: autodetect)")
    p_plugin.set_defaults(func=cmd_plugin)

    p_status = sub.add_parser("status", help="show which agents are running")
    p_status.set_defaults(func=cmd_status)

    args = ap.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
