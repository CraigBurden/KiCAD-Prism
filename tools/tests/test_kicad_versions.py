"""Discovering installed KiCad versions, so the tray can offer a definite choice.

The filesystem scan itself is platform-specific and hard to pin in a unit test,
so what is tested here is the logic that does not depend on a real install: the
version sort, de-duplication, the label, and how a chosen command is launched.
"""

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from prism_agent import kicad_versions, open_project  # noqa: E402
from prism_agent.kicad_versions import KiCadInstall  # noqa: E402


def test_installs_sort_newest_first(monkeypatch):
    monkeypatch.setattr(
        kicad_versions,
        "_discover_windows",
        lambda: [
            KiCadInstall("8.0", r"C:\KiCad\8.0\kicad.exe"),
            KiCadInstall("10.0", r"C:\KiCad\10.0\kicad.exe"),
            KiCadInstall("9.0", r"C:\KiCad\9.0\kicad.exe"),
        ],
    )
    monkeypatch.setattr(sys, "platform", "win32")
    versions = [i.version for i in kicad_versions.discover()]
    # 10.0 beats 9.0: numeric, not string ("10.0" < "9.0" as strings).
    assert versions == ["10.0", "9.0", "8.0"]


def test_duplicate_paths_are_collapsed(monkeypatch):
    monkeypatch.setattr(
        kicad_versions,
        "_discover_linux",
        lambda: [
            KiCadInstall("9.0", "/usr/bin/kicad"),
            KiCadInstall("9.0", "/usr/bin/kicad"),
        ],
    )
    monkeypatch.setattr(sys, "platform", "linux")
    assert len(kicad_versions.discover()) == 1


def test_label_prefers_the_version():
    assert KiCadInstall("9.0", "/x/kicad").label == "KiCad 9.0"


# -- Linux version detection: headless kicad-cli, never the GUI binary ---------
#
# Found live on Debian with KiCad's AppImage: KiCad 10's `kicad` does not know
# --version and starts a whole second KiCad instead, which warns that the project is
# already open in another window. The agent did that on every /project request
# (kicad_config_dir -> discover()), so every dialog load flashed the warning and
# stalled until a timeout killed the stray instance.


@pytest.fixture(autouse=True)
def _clear_caches(monkeypatch):
    """Both caches are process-lifetime by design; each test needs a clean one. And
    no test should read this machine's real settings for a remembered AppImage."""
    kicad_versions._cli_version_cache.clear()
    kicad_versions._flatpak_has_kicad_cache.clear()
    monkeypatch.setattr(kicad_versions, "_remembered_appimage", lambda: "")
    yield
    kicad_versions._cli_version_cache.clear()
    kicad_versions._flatpak_has_kicad_cache.clear()


def _linux_install(tmp_path, *, with_cli):
    bindir = tmp_path / "bin"
    bindir.mkdir()
    (bindir / "kicad").write_text("")
    if with_cli:
        (bindir / "kicad-cli").write_text("")
    return bindir


def test_linux_reads_the_version_from_kicad_cli_not_the_gui(tmp_path, monkeypatch):
    bindir = _linux_install(tmp_path, with_cli=True)
    ran = []

    def fake_run(args, **kwargs):
        ran.append(list(args))
        return subprocess.CompletedProcess(args, 0, stdout="10.0.6", stderr="")

    monkeypatch.setattr(kicad_versions.subprocess, "run", fake_run)
    monkeypatch.setattr(
        "shutil.which", lambda name: str(bindir / name) if name == "kicad" else None
    )

    found = kicad_versions._discover_linux()

    assert [(i.version, i.path) for i in found] == [("10.0", str(bindir / "kicad"))]
    assert ran == [[str(bindir / "kicad-cli"), "version"]]


def test_linux_never_runs_the_gui_binary_even_without_kicad_cli(tmp_path, monkeypatch):
    """No kicad-cli beside it: leave the version blank. Running `kicad` to find out is
    exactly what opened the second instance."""
    bindir = _linux_install(tmp_path, with_cli=False)
    ran = []
    monkeypatch.setattr(
        kicad_versions.subprocess, "run", lambda args, **k: ran.append(args)
    )
    monkeypatch.setattr(
        "shutil.which", lambda name: str(bindir / name) if name == "kicad" else None
    )

    found = kicad_versions._discover_linux()

    assert [(i.version, i.path) for i in found] == [("", str(bindir / "kicad"))]
    assert ran == []


def test_flatpak_version_comes_from_its_kicad_cli(monkeypatch):
    ran = []

    def fake_run(args, **kwargs):
        ran.append(list(args))
        return subprocess.CompletedProcess(args, 0, stdout="9.0.4", stderr="")

    monkeypatch.setattr(kicad_versions.subprocess, "run", fake_run)
    monkeypatch.setattr(
        "shutil.which", lambda name: "/usr/bin/flatpak" if name == "flatpak" else None
    )

    found = kicad_versions._discover_linux()

    assert [i.version for i in found] == ["9.0"]
    assert ran[-1] == [
        "/usr/bin/flatpak", "run", "--command=kicad-cli", "org.kicad.KiCad", "version"
    ]


def test_the_version_command_only_runs_once_per_process(monkeypatch):
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 0, stdout="9.0.1", stderr="")

    monkeypatch.setattr(kicad_versions.subprocess, "run", fake_run)

    assert kicad_versions._cli_version(["/usr/bin/kicad-cli", "version"]) == "9.0"
    assert kicad_versions._cli_version(["/usr/bin/kicad-cli", "version"]) == "9.0"
    assert len(calls) == 1


def test_a_failed_version_command_is_cached_as_unknown(monkeypatch):
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        raise subprocess.TimeoutExpired(cmd=args, timeout=kwargs.get("timeout"))

    monkeypatch.setattr(kicad_versions.subprocess, "run", fake_run)

    assert kicad_versions._cli_version(["/x/kicad-cli", "version"]) == ""
    assert kicad_versions._cli_version(["/x/kicad-cli", "version"]) == ""
    assert len(calls) == 1


def test_flatpak_probe_only_runs_once(monkeypatch):
    calls = []

    def fake_run(args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 0)

    monkeypatch.setattr(kicad_versions.subprocess, "run", fake_run)

    assert kicad_versions._flatpak_has_kicad("/usr/bin/flatpak") is True
    assert kicad_versions._flatpak_has_kicad("/usr/bin/flatpak") is True
    assert len(calls) == 1


# -- a KiCad AppImage the plugin ran inside ---------------------------------
#
# Not on PATH, not registered with the desktop (on the Debian test machine a
# .kicad_pro opened in LibreOffice), and its /tmp/.mount_* path is gone once KiCad
# closes. The .AppImage file is the stable handle; the plugin passes it on and the
# agent remembers it (settings.kicad_appimage).


@pytest.mark.parametrize(
    "name,version",
    [
        ("kicad-10.0.6-x86_64.AppImage", "10.0"),
        ("KiCad-9.0.4-x86_64.AppImage", "9.0"),
        ("kicad_8.0.9.AppImage", "8.0"),
        ("my-eda.AppImage", ""),
    ],
)
def test_the_appimage_version_is_read_from_its_name(name, version):
    assert kicad_versions._appimage_version(f"/home/me/Downloads/{name}") == version


def test_linux_lists_the_remembered_appimage(monkeypatch):
    appimage = "/home/me/Downloads/kicad-10.0.6-x86_64.AppImage"
    monkeypatch.setattr(kicad_versions, "_remembered_appimage", lambda: appimage)
    monkeypatch.setattr("shutil.which", lambda name: None)
    ran = []
    monkeypatch.setattr(kicad_versions.subprocess, "run", lambda a, **k: ran.append(a))

    found = kicad_versions._discover_linux()

    assert [(i.version, i.path) for i in found] == [("10.0", appimage)]
    assert ran == []  # read from the name, the AppImage is never run to ask


def test_linux_opens_projects_in_the_remembered_appimage(tmp_path, monkeypatch):
    appimage = tmp_path / "kicad-10.0.6-x86_64.AppImage"
    appimage.write_text("")
    monkeypatch.setattr(
        open_project.settings_store, "load", lambda: FakeSettings("", str(appimage))
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "linux")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched[0][0] == str(appimage)
    assert launched[0][1].endswith("board.kicad_pro")


def test_a_pinned_kicad_still_beats_the_remembered_appimage(tmp_path, monkeypatch):
    appimage = tmp_path / "kicad-10.0.6-x86_64.AppImage"
    appimage.write_text("")
    monkeypatch.setattr(
        open_project.settings_store,
        "load",
        lambda: FakeSettings("/usr/bin/kicad", str(appimage)),
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "linux")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched[0][0] == "/usr/bin/kicad"


def test_the_remembered_appimage_is_ignored_off_linux(tmp_path, monkeypatch):
    appimage = tmp_path / "kicad-10.0.6-x86_64.AppImage"
    appimage.write_text("")
    monkeypatch.setattr(
        open_project.settings_store, "load", lambda: FakeSettings("", str(appimage))
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "darwin")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched[0][0] == "open"  # the OS default, as before


def test_label_falls_back_to_the_executable_name():
    assert KiCadInstall("", "/opt/kicad-nightly/kicad").label == "kicad"


def test_version_key_orders_numerically():
    assert kicad_versions._version_key("10.0") > kicad_versions._version_key("9.0")


# -- launching with a chosen command --------------------------------------


class FakeSettings:
    def __init__(self, command, appimage=""):
        self.kicad_command = command
        self.kicad_appimage = appimage


def _project_with_pro(tmp_path):
    (tmp_path / "board.kicad_pro").write_text("{}")
    return tmp_path


def test_a_pinned_executable_is_run_directly(tmp_path, monkeypatch):
    monkeypatch.setattr(
        open_project.settings_store,
        "load",
        lambda: FakeSettings(r"C:\Program Files\KiCad\9.0\bin\kicad.exe"),
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "win32")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched and launched[0][0] == r"C:\Program Files\KiCad\9.0\bin\kicad.exe"
    assert launched[0][1].endswith("board.kicad_pro")


def test_a_flatpak_command_is_expanded(tmp_path, monkeypatch):
    monkeypatch.setattr(
        open_project.settings_store,
        "load",
        lambda: FakeSettings("flatpak run org.kicad.KiCad"),
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "linux")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched[0][:3] == ["flatpak", "run", "org.kicad.KiCad"]
    assert launched[0][3].endswith("board.kicad_pro")


def test_a_mac_app_is_opened_with_open_dash_a(tmp_path, monkeypatch):
    monkeypatch.setattr(
        open_project.settings_store,
        "load",
        lambda: FakeSettings("/Applications/KiCad 9.0.app"),
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "darwin")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    assert launched[0][:3] == ["open", "-a", "/Applications/KiCad 9.0.app"]


def _make_mac_bundle(path):
    """A minimal fake .app bundle: just enough for _discover_macos to find it."""
    exe = path / "Contents" / "MacOS" / "kicad"
    exe.parent.mkdir(parents=True)
    exe.write_text("")


def test_finds_the_real_installers_suite_layout(tmp_path, monkeypatch):
    """The official .dmg and Homebrew's cask both give you
    /Applications/KiCad/KiCad.app, a suite folder, not a bare bundle at the
    Applications root. Missing this is exactly what sent someone hunting for
    why a real install wasn't found."""
    apps = tmp_path / "Applications"
    _make_mac_bundle(apps / "KiCad" / "KiCad.app")
    monkeypatch.setattr(kicad_versions, "_macos_app_roots", lambda: [apps])
    monkeypatch.setattr(sys, "platform", "darwin")

    found = kicad_versions.discover()

    assert [i.path for i in found] == [str(apps / "KiCad" / "KiCad.app")]


def test_still_finds_a_flat_bundle_at_the_applications_root(tmp_path, monkeypatch):
    apps = tmp_path / "Applications"
    _make_mac_bundle(apps / "KiCad 9.0.app")
    monkeypatch.setattr(kicad_versions, "_macos_app_roots", lambda: [apps])
    monkeypatch.setattr(sys, "platform", "darwin")

    found = kicad_versions.discover()

    assert [i.version for i in found] == ["9.0"]


def test_no_pinned_command_uses_the_os_default(tmp_path, monkeypatch):
    monkeypatch.setattr(
        open_project.settings_store, "load", lambda: FakeSettings("")
    )
    launched = []
    monkeypatch.setattr(
        open_project.subprocess, "Popen", lambda args, **k: launched.append(args)
    )
    monkeypatch.setattr(sys, "platform", "linux")

    open_project.launch_kicad(_project_with_pro(tmp_path))

    # The historical behaviour: hand it to the desktop's opener.
    assert launched[0][0] == "xdg-open"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
