"""Assemble the KiCad Plugin & Content Manager (PCM) package.

Produces the zip a user installs from KiCad's Plugin Manager. Layout is fixed by
KiCad (https://dev-docs.kicad.org/en/addons/):

    archive root
      metadata.json
      plugins/            <- the plugin itself, NOT in a further subdirectory
        __init__.py
        ...
        prism-agent[.exe] <- the agent binary for THIS platform
      resources/
        icon.png          <- the package icon PCM shows

    python tools/package_plugin.py --binaries <dir> --out dist

`--binaries` is a directory of the artifacts CI downloaded, one subdirectory per
platform (that's how actions/download-artifact lays them out).

The VERSION is read from the source, never passed in. It used to be an argument that
only reached metadata.json, so a build could ship a package PCM called 0.5.0 whose
plugin reported 0.4.0 to itself and to the server: the panel showed the old number and
the update check compared the wrong one, silently. Reading it here means the committed
tree is what shipped, which is also what makes a zip traceable back to a commit.

`--expect` is for CI to state the version it believes it is building. It verifies, it
does not set: a mismatch is a failed build rather than a package that disagrees with
its own source.

One zip is produced per platform, because each carries its own agent binary. A
single zip with all three would triple the download for no reason, and KiCad has no
notion of per-platform files inside a package.
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import zipfile
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
PLUGIN_SRC = TOOLS / "kicad_plugin"

def _read_constant(path: Path, name: str) -> str:
    """Read `NAME = "..."` out of a module without importing it.

    The plugin imports wx and the agent imports its own package; neither is available
    to a packaging script, and neither needs to be just to read a string.
    """
    pattern = re.compile(rf"^{name}\s*=\s*[\"']([^\"']+)[\"']", re.M)
    match = pattern.search(path.read_text(encoding="utf-8"))
    if not match:
        raise SystemExit(f"couldn't find {name} in {path}")
    return match.group(1)


def resolve_version() -> str:
    """The one version this package ships, taken from the plugin's own source.

    version.py is vendored byte for byte into both packages (the parity test guards
    that), so the agent's copy is checked against the plugin's rather than read
    separately. A difference means one copy was bumped and the other was not, which is
    worth catching at build time instead of in a user's version check.
    """
    plugin = _read_constant(PLUGIN_SRC / "version.py", "VERSION")
    agent = _read_constant(TOOLS / "prism_agent" / "version.py", "VERSION")
    if plugin != agent:
        raise SystemExit(
            f"version mismatch: plugin {plugin}, agent {agent}. "
            "They ship in one package and must agree."
        )
    return plugin


IDENTIFIER = "com.github.keybored02.kicad-prism"

# The binary each package carries, keyed by the artifact name CI uses. `platform`
# is what metadata.json declares to PCM (its schema only knows OS, not arch, so
# both macOS entries say "macos"); `label` is what tells the two macOS zips apart
# on disk, since they'd otherwise both be kicad-prism-<version>-macos.zip and the
# second build would silently overwrite the first.
PLATFORMS = {
    "prism-agent-windows": ("windows", "prism-agent.exe", "windows"),
    # PyInstaller only builds for the arch it runs on; there is no single macOS
    # binary that works on both, see build-plugin.yml for why. Two thin binaries,
    # the user picks the one matching their Mac.
    "prism-agent-macos-arm64": ("macos", "prism-agent", "macos-arm64"),
    "prism-agent-macos-x86_64": ("macos", "prism-agent", "macos-intel"),
    "prism-agent-linux": ("linux", "prism-agent", "linux"),
}

# Files in kicad_plugin/ that are ours to ship. Everything else (caches, the dev
# build output) stays out.
EXCLUDE = {"__pycache__", ".pytest_cache"}


def metadata(version: str, platform: str) -> dict:
    return {
        "$schema": "https://go.kicad.org/pcm/schemas/v1",
        "name": "Prism",
        "description": "Project status, uncommitted changes, and cross-probe from Prism.",
        "description_full": (
            "Shows what you have changed but not yet committed, grouped the way "
            "Prism's web UI groups a commit, with components, nets, zones and "
            "symbols, and lets you jump straight to a changed item on the board.\n"
            "\n"
            "Includes the Prism agent, which does the machine-side work (git, "
            "project detection, diffing) and keeps running whether or not KiCad is "
            "open. No Python installation is required.\n"
        ),
        "identifier": IDENTIFIER,
        "type": "plugin",
        "author": {
            "name": "Matteo Parenti",
            "contact": {"web": "https://github.com/krishna-swaroop/KiCAD-Prism"},
        },
        "license": "MIT",
        "resources": {"homepage": "https://github.com/krishna-swaroop/KiCAD-Prism"},
        "versions": [
            {
                "version": version,
                "status": "testing",
                # The plugin uses pcbnew.ActionPlugin and FocusOnItem, both present
                # since 6.0; tested on 8 and 10.
                "kicad_version": "8.0",
                "platforms": [platform],
            }
        ],
    }


def _copy_plugin(dest: Path) -> None:
    """The plugin's own files, straight into plugins/, PCM requires no extra nesting."""
    dest.mkdir(parents=True, exist_ok=True)
    for item in sorted(PLUGIN_SRC.iterdir()):
        if item.name in EXCLUDE:
            continue
        if item.is_dir():
            shutil.copytree(
                item, dest / item.name, ignore=shutil.ignore_patterns(*EXCLUDE)
            )
        else:
            shutil.copy2(item, dest / item.name)


def _find_binary(binaries: Path, artifact: str, name: str) -> Path:
    """Locate a CI artifact. download-artifact puts each under its own directory,
    but a locally-built one may just be the file, accept both."""
    candidates = [
        binaries / artifact / name,
        binaries / name,
    ]
    for c in candidates:
        if c.is_file():
            return c
    raise SystemExit(
        f"can't find {name} for {artifact}. Looked in:\n  "
        + "\n  ".join(str(c) for c in candidates)
    )


def build_package(version: str, binaries: Path, out: Path, artifact: str) -> Path:
    platform, binary_name, label = PLATFORMS[artifact]
    binary = _find_binary(binaries, artifact, binary_name)

    staging = out / f"_stage-{label}"
    shutil.rmtree(staging, ignore_errors=True)

    plugins = staging / "plugins"
    _copy_plugin(plugins)

    # The agent sits beside the plugin, which is exactly where agent_launcher's
    # find_binary() looks first.
    shutil.copy2(binary, plugins / binary_name)
    if platform != "windows":
        (plugins / binary_name).chmod(0o755)  # zip preserves this; PCM extracts it

    resources = staging / "resources"
    resources.mkdir(parents=True, exist_ok=True)
    icon = PLUGIN_SRC / "assets" / "prism-64.png"
    if icon.is_file():
        shutil.copy2(icon, resources / "icon.png")

    (staging / "metadata.json").write_text(
        json.dumps(metadata(version, platform), indent=2), encoding="utf-8"
    )

    out.mkdir(parents=True, exist_ok=True)
    zip_path = out / f"kicad-prism-{version}-{label}.zip"
    zip_path.unlink(missing_ok=True)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(staging.rglob("*")):
            if path.is_file():
                arc = path.relative_to(staging)
                # Preserve the executable bit, a zip that loses it gives the user a
                # non-runnable agent and a baffling permission error.
                info = zipfile.ZipInfo(str(arc).replace("\\", "/"))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (path.stat().st_mode & 0xFFFF) << 16
                zf.writestr(info, path.read_bytes())

    shutil.rmtree(staging, ignore_errors=True)
    size = zip_path.stat().st_size / (1024 * 1024)
    print(f"  {zip_path.name}  ({size:.1f} MB)")
    return zip_path


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument(
        "--expect",
        help="the version CI believes it is building; verified against the source",
    )
    ap.add_argument("--binaries", required=True, type=Path)
    ap.add_argument("--out", default=Path("dist"), type=Path)
    args = ap.parse_args()

    if not PLUGIN_SRC.is_dir():
        raise SystemExit(f"plugin source not found: {PLUGIN_SRC}")

    version = resolve_version()
    if args.expect and args.expect != version:
        raise SystemExit(
            f"asked to build {args.expect}, but the source says {version}. "
            "Bump tools/kicad_plugin/version.py and copy it over "
            "tools/prism_agent/version.py first."
        )
    print(f"Packaging version {version}")

    built = []
    for artifact in PLATFORMS:
        # Only package platforms whose binary we actually got. A macOS runner
        # failing shouldn't stop us shipping Windows and Linux.
        try:
            built.append(build_package(version, args.binaries, args.out, artifact))
        except SystemExit as exc:
            print(f"  skipping {artifact}: {exc}")

    if not built:
        raise SystemExit("no packages were built, no agent binaries were found")
    print(f"\n{len(built)} package(s) in {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
