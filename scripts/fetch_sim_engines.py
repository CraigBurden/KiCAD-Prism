#!/usr/bin/env python3
"""Install the pinned Simulation Studio engines (prism-sim-studio release assets).

Prism does not build the engines. It pins one prism-sim-studio release in
``backend/sim-engines.lock.json`` (tag and each platform's archive sha256) and
installs that release's ``bin/`` where ``PRISM_SIM_BIN_DIR`` points. The image
build runs this with a token passed as a BuildKit secret; developers run it
locally with ``gh auth token`` or ``GH_TOKEN``.

    python3 scripts/fetch_sim_engines.py --dest <dir> [--platform linux-x64]
        [--token-file <path>] [--optional]

The token comes from ``--token-file`` when that file exists and is not empty,
else ``PRISM_SIM_RELEASE_TOKEN``, ``GH_TOKEN`` or ``GITHUB_TOKEN``. With
``--optional`` a missing token installs nothing and exits 0 (Simulation Studio
is opt-in); any other failure, including a sha256 mismatch, exits 1.
Standard library only.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import sys
import tarfile
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

LOCK = Path(__file__).resolve().parent.parent / "backend" / "sim-engines.lock.json"
API = "https://api.github.com"


def host_platform() -> str:
    system = platform.system().lower()
    machine = platform.machine().lower()
    arch = {"x86_64": "x64", "amd64": "x64", "aarch64": "arm64", "arm64": "arm64"}.get(machine, machine)
    return f"{'macos' if system == 'darwin' else system}-{arch}"


def read_token(token_file: str | None) -> str:
    if token_file:
        path = Path(token_file)
        if path.is_file() and path.read_text().strip():
            return path.read_text().strip()
    for name in ("PRISM_SIM_RELEASE_TOKEN", "GH_TOKEN", "GITHUB_TOKEN"):
        if os.environ.get(name, "").strip():
            return os.environ[name].strip()
    return ""


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003 - urllib's signature
        return None


def _get(url: str, token: str, accept: str) -> tuple[int, dict[str, str], bytes]:
    request = urllib.request.Request(url, headers={
        "Accept": accept,
        "Authorization": f"Bearer {token}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "prism-fetch-sim-engines",
    })
    opener = urllib.request.build_opener(_NoRedirect)
    try:
        with opener.open(request, timeout=120) as response:
            return response.status, dict(response.headers), response.read()
    except urllib.error.HTTPError as error:
        if error.code in (301, 302, 303, 307, 308):
            return error.code, dict(error.headers), b""
        raise


def download_asset(repository: str, tag: str, name: str, token: str) -> bytes:
    _status, _headers, body = _get(f"{API}/repos/{repository}/releases/tags/{tag}", token, "application/vnd.github+json")
    release = json.loads(body)
    asset = next((item for item in release.get("assets", []) if item["name"] == name), None)
    if asset is None:
        raise SystemExit(f"release {tag} of {repository} has no asset {name}")
    status, headers, body = _get(f"{API}/repos/{repository}/releases/assets/{asset['id']}", token, "application/octet-stream")
    if status in (301, 302, 303, 307, 308):
        # The redirect target is a pre-signed URL; it must not carry the token.
        location = headers.get("Location") or headers.get("location")
        with urllib.request.urlopen(urllib.request.Request(location, headers={"User-Agent": "prism-fetch-sim-engines"}), timeout=300) as response:
            return response.read()
    return body


def install(archive: Path, dest: Path) -> list[str]:
    with tempfile.TemporaryDirectory(prefix="sim-engines-") as tmp:
        with tarfile.open(archive) as bundle:
            bundle.extractall(tmp, filter="data")
        bins = list(Path(tmp).glob("*/bin/*"))
        if not bins:
            raise SystemExit(f"{archive.name} has no bin/ directory")
        dest.mkdir(parents=True, exist_ok=True)
        for binary in bins:
            target = dest / binary.name
            shutil.copyfile(binary, target)
            target.chmod(0o755)
        for extra in ("engines.json", "build.json"):
            found = list(Path(tmp).glob(f"*/{extra}"))
            if found:
                shutil.copyfile(found[0], dest / extra)
        return sorted(binary.name for binary in bins)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dest", required=True, type=Path)
    parser.add_argument("--lock", type=Path, default=LOCK)
    parser.add_argument("--platform", default=None, help="linux-x64, linux-arm64 or macos-arm64 (default: this host)")
    parser.add_argument("--token-file", default=None)
    parser.add_argument("--optional", action="store_true", help="exit 0 without installing when no token is available")
    args = parser.parse_args()

    lock = json.loads(args.lock.read_text())
    target = args.platform or host_platform()
    asset = lock["assets"].get(target)
    if asset is None:
        print(f"fetch-sim-engines: {lock['tag']} has no {target} build", file=sys.stderr)
        return 1
    token = read_token(args.token_file)
    if not token:
        message = "fetch-sim-engines: no token for the private release; Simulation Studio engines are not installed"
        print(message, file=sys.stderr)
        return 0 if args.optional else 1

    payload = download_asset(lock["repository"], lock["tag"], asset["archive"], token)
    digest = hashlib.sha256(payload).hexdigest()
    if digest != asset["sha256"]:
        print(f"fetch-sim-engines: {asset['archive']} sha256 {digest} != pinned {asset['sha256']}", file=sys.stderr)
        return 1
    with tempfile.TemporaryDirectory(prefix="sim-engines-dl-") as tmp:
        archive = Path(tmp) / asset["archive"]
        archive.write_bytes(payload)
        names = install(archive, args.dest)
    print(f"fetch-sim-engines: {lock['repository']} {lock['tag']} ({target}) -> {args.dest}: {', '.join(names)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
