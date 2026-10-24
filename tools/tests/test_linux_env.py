"""The agent must not hand KiCad's AppImage runtime, or PyInstaller's library path,
to the programs it starts. See prism_agent/linux_env.py.

The fixture below is the real environment captured from a plugin-launched agent on
Debian 13 with KiCad 10.0.6's AppImage, trimmed to the variables that matter.
"""

import importlib.util
import sys
import types
from pathlib import Path

import pytest

TOOLS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(TOOLS))

from prism_agent import linux_env  # noqa: E402

MOUNT = "/tmp/.mount_kicadremp9728916709621493320"

APPIMAGE_ENV = {
    "APPDIR": MOUNT,
    "APPIMAGE": "/home/matteo/Downloads/kicad-10.0.6-x86_64.AppImage",
    "ARGV0": "/home/matteo/Downloads/kicad-10.0.6-x86_64.AppImage",
    "OWD": "/home/matteo/Downloads",
    "PATH": f"{MOUNT}/bin:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games",
    "XDG_DATA_DIRS": f"/home/matteo/.local/share:/usr/share:{MOUNT}/share:/usr/share/gnome",
    "LD_PRELOAD": f"{MOUNT}/shared/lib/jsc-stack-fix.so",
    "PYTHONHOME": f"{MOUNT}/shared",
    "PYTHONPATH": (
        f"{MOUNT}/shared/lib/python3.11/dist-packages:"
        f"{MOUNT}/shared/lib/python3.11/site-packages:"
        f"{MOUNT}/usr/bin/../lib/python3/dist-packages"
    ),
    "GIO_MODULE_DIR": f"{MOUNT}/shared/lib/gio/modules",
    "GIO_LAUNCH_DESKTOP": f"{MOUNT}/bin/gio-launch-desktop",
    "GDK_PIXBUF_MODULE_FILE": f"{MOUNT}/shared/lib/gdk-pixbuf-2.0/2.10.0/loaders.cache",
    "GDK_PIXBUF_MODULEDIR": f"{MOUNT}/shared/lib/gdk-pixbuf-2.0/2.10.0/loaders",
    # Not the AppImage's: must survive.
    "HOME": "/home/matteo",
    "DISPLAY": ":0",
    "GTK_MODULES": "gail:atk-bridge",
}


@pytest.fixture
def linux(monkeypatch):
    monkeypatch.setattr(sys, "platform", "linux")


def test_the_appimage_runtime_is_removed(linux):
    env = linux_env.without_appimage(APPIMAGE_ENV)

    for key in (
        "APPDIR", "APPIMAGE", "ARGV0", "OWD", "LD_PRELOAD", "PYTHONHOME", "PYTHONPATH",
        "GIO_MODULE_DIR", "GIO_LAUNCH_DESKTOP", "GDK_PIXBUF_MODULE_FILE",
        "GDK_PIXBUF_MODULEDIR",
    ):
        assert key not in env, key
    assert MOUNT not in "".join(env.values())


def test_path_lists_keep_everything_that_is_not_the_appimages(linux):
    env = linux_env.without_appimage(APPIMAGE_ENV)

    assert env["PATH"] == "/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games"
    assert env["XDG_DATA_DIRS"] == "/home/matteo/.local/share:/usr/share:/usr/share/gnome"


def test_the_users_own_variables_survive(linux):
    env = linux_env.without_appimage(APPIMAGE_ENV)

    assert env["HOME"] == "/home/matteo"
    assert env["DISPLAY"] == ":0"
    assert env["GTK_MODULES"] == "gail:atk-bridge"


def test_nothing_changes_outside_an_appimage(linux):
    plain = {"PATH": "/usr/bin:/bin", "PYTHONPATH": "/home/me/lib", "HOME": "/home/me"}
    assert linux_env.without_appimage(plain) == plain


@pytest.mark.parametrize("platform", ["win32", "darwin"])
def test_nothing_changes_off_linux(monkeypatch, platform):
    monkeypatch.setattr(sys, "platform", platform)
    assert linux_env.without_appimage(APPIMAGE_ENV) == APPIMAGE_ENV


def test_a_frozen_agent_gives_children_the_original_library_path(linux, monkeypatch):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    env = {"LD_LIBRARY_PATH": "/tmp/_MEI12345", "LD_LIBRARY_PATH_ORIG": "/opt/lib"}

    assert linux_env.without_frozen_library_path(env) == {"LD_LIBRARY_PATH": "/opt/lib"}


def test_a_frozen_agent_with_no_original_drops_its_own(linux, monkeypatch):
    monkeypatch.setattr(sys, "frozen", True, raising=False)
    env = {"LD_LIBRARY_PATH": "/tmp/_MEI12345", "HOME": "/home/me"}

    assert linux_env.without_frozen_library_path(env) == {"HOME": "/home/me"}


def test_a_source_agent_keeps_its_library_path(linux, monkeypatch):
    monkeypatch.delattr(sys, "frozen", raising=False)
    env = {"LD_LIBRARY_PATH": "/opt/lib"}

    assert linux_env.without_frozen_library_path(env) == env


def test_clean_process_environment_applies_to_os_environ(linux, monkeypatch):
    monkeypatch.setattr(linux_env.os, "environ", dict(APPIMAGE_ENV))

    linux_env.clean_process_environment()

    assert "LD_PRELOAD" not in linux_env.os.environ
    assert linux_env.os.environ["PATH"].startswith("/usr/local/bin")
    assert linux_env.os.environ["HOME"] == "/home/matteo"


# -- the plugin's copy must agree with the agent's --------------------------


def _load_agent_launcher():
    """kicad_plugin/__init__.py imports pcbnew/wx, so load the one module directly,
    under a package name private to this file (see test_agent_launcher_restart)."""
    pkg_name = "kicad_plugin_linux_env_test"
    pkg = types.ModuleType(pkg_name)
    pkg.__path__ = [str(TOOLS / "kicad_plugin")]
    sys.modules[pkg_name] = pkg
    spec = importlib.util.spec_from_file_location(
        f"{pkg_name}.agent_launcher", TOOLS / "kicad_plugin" / "agent_launcher.py"
    )
    module = importlib.util.module_from_spec(spec)
    module.__package__ = pkg_name
    sys.modules[f"{pkg_name}.agent_launcher"] = module
    spec.loader.exec_module(module)
    return module


class _FakePopen:
    launched = []

    def __init__(self, args, **kwargs):
        _FakePopen.launched.append((list(args), kwargs))
        self.waited = False

    def wait(self, timeout=None):
        _FakePopen.launched[-1][1]["_waited"] = True
        return 0


def test_linux_launches_through_a_shell_so_kicad_keeps_no_zombie(linux, monkeypatch):
    """Started directly, the agent is KiCad's child and KiCad never reaps it: every
    agent that exited stayed <defunct> until KiCad closed (seen live)."""
    agent_launcher = _load_agent_launcher()
    _FakePopen.launched = []
    monkeypatch.setattr(agent_launcher.subprocess, "Popen", _FakePopen)

    agent_launcher._spawn(["/x/prism-agent"], cwd="/x", env={"HOME": "/h"})

    (args, kwargs), = _FakePopen.launched
    assert args[:2] == ["/bin/sh", "-c"] and args[-1] == "/x/prism-agent"
    assert kwargs["_waited"] is True  # the shell is reaped, it exits at once


@pytest.mark.parametrize("platform", ["win32", "darwin"])
def test_other_platforms_launch_directly_as_before(monkeypatch, platform):
    agent_launcher = _load_agent_launcher()
    monkeypatch.setattr(sys, "platform", platform)
    _FakePopen.launched = []
    monkeypatch.setattr(agent_launcher.subprocess, "Popen", _FakePopen)
    if platform == "win32":
        for flag in ("CREATE_NEW_PROCESS_GROUP", "DETACHED_PROCESS", "CREATE_NO_WINDOW"):
            monkeypatch.setattr(agent_launcher.subprocess, flag, 0, raising=False)

    agent_launcher._spawn(["/x/prism-agent"], cwd="/x", env={})

    (args, kwargs), = _FakePopen.launched
    assert args == ["/x/prism-agent"]
    assert "_waited" not in kwargs


def test_the_plugin_passes_the_appimage_path_to_the_agent(linux, monkeypatch):
    agent_launcher = _load_agent_launcher()
    monkeypatch.setattr(agent_launcher.os, "environ", dict(APPIMAGE_ENV))
    fake_client = types.ModuleType("fake_agent_client")
    fake_client.profile = lambda: ""
    monkeypatch.setitem(sys.modules, "kicad_plugin_linux_env_test.agent_client", fake_client)

    env = agent_launcher._env()

    assert env["PRISM_KICAD_APPIMAGE"] == APPIMAGE_ENV["APPIMAGE"]
    assert "APPIMAGE" not in env and "APPDIR" not in env


def test_the_agent_remembers_the_appimage(linux, tmp_path, monkeypatch):
    appimage = tmp_path / "kicad-10.0.6-x86_64.AppImage"
    appimage.write_text("")
    monkeypatch.setattr(linux_env.os, "environ", {"PRISM_KICAD_APPIMAGE": str(appimage)})
    from prism_agent import settings as settings_store

    saved = {}
    monkeypatch.setattr(settings_store, "load", lambda: settings_store.Settings())
    monkeypatch.setattr(settings_store, "update", lambda **kw: saved.update(kw))

    linux_env.remember_kicad_appimage()

    assert saved == {"kicad_appimage": str(appimage)}
    assert "PRISM_KICAD_APPIMAGE" not in linux_env.os.environ


def test_the_plugins_copy_matches_the_agents(linux):
    agent_launcher = _load_agent_launcher()

    assert agent_launcher._without_appimage(dict(APPIMAGE_ENV)) == (
        linux_env.without_appimage(APPIMAGE_ENV)
    )
