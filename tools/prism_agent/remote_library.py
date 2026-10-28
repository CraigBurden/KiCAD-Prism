"""Is Prism registered as KiCad's remote symbol provider?

KiCad keeps the registration in **eeschema.json**, under `remote_symbols`:

    "remote_symbols": {
        "providers": [
            {
                "provider_id": "provider-<12 hex>",
                "metadata_url": "http://127.0.0.1:8000",
                "display_name_override": "Prism",
                "last_account_label": "",
                "last_auth_status": "signed_out"
            }
        ],
        ...
    }

`metadata_url` is the Prism server. If it's missing, or it names a *different* server
than the agent is configured for, the link is stale and the user should re-link.

Writing this works whether or not KiCad is running. KiCad does rewrite eeschema.json when
it exits, but only the sections it actually touched, and it doesn't touch
`remote_symbols.providers` unless the user opens the Remote Symbol dialog. So an external
write survives. (Verified the hard way: written with KiCad open, survived a full restart.)

KiCad reads the providers at startup, so the user has to restart KiCad to *see* a change.
That's the only caveat, and it's the one the UI should state.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from pathlib import Path

PROVIDER_NAME = "Prism"


def _config_version_key(name: str) -> tuple:
    """Numeric sort key, so "10.0" beats "9.0" (a string sort gets that backwards)."""
    return tuple(int(p) if p.isdigit() else 0 for p in name.split("."))


def _config_base() -> Path | None:
    if sys.platform == "win32":
        base = Path(os.environ.get("APPDATA", "")) / "kicad"
    elif sys.platform == "darwin":
        base = Path.home() / "Library" / "Preferences" / "kicad"
    else:
        base = (
            Path(os.environ.get("XDG_CONFIG_HOME") or Path.home() / ".config") / "kicad"
        )
    return base if base.is_dir() else None


def _installed_config_names() -> set[str]:
    """The config-dir names of the KiCads actually installed on this machine.

    A config dir is created by whatever KiCad ran once and is never cleaned up, so
    the newest folder is not necessarily a KiCad the user still has. Matching against
    real installs is what keeps a leftover from winning.
    """
    try:
        from . import kicad_versions
    except Exception:
        return set()
    try:
        installs = kicad_versions.discover()
    except Exception:
        return set()
    # KiCad names the config dir after the major version ("10.0"), and the install
    # reports the same, so these compare directly.
    return {i.version for i in installs if i.version}


def kicad_config_dir(kicad_command: str = "") -> Path | None:
    """The config dir of the KiCad the user actually runs.

    KiCad keeps one config dir per major version and never removes them, so a machine
    picks up folders for versions that are long gone: an 8.0 left over from an upgrade,
    or a 10.99 nightly that was tried once. Taking the highest number found there put
    Prism's registration into a KiCad the user never launches, and reported that
    version as theirs.

    So the version is resolved against reality, best evidence first:

    1. The executable the user pinned in settings, whose path carries its version.
    2. The newest KiCad actually installed, per kicad_versions.discover().
    3. The newest config dir, when discovery finds nothing at all. A portable install
       or an unusual layout still has to work, and an old folder beats no answer.
    """
    base = _config_base()
    if base is None:
        return None

    versions = [
        d for d in base.iterdir() if d.is_dir() and (d / "eeschema.json").is_file()
    ]
    if not versions:
        return None

    chosen = _version_of_command(kicad_command)
    if chosen:
        for d in versions:
            if d.name == chosen:
                return d

    installed = _installed_config_names()
    matching = [d for d in versions if d.name in installed]
    if matching:
        return max(matching, key=lambda d: _config_version_key(d.name))

    return max(versions, key=lambda d: _config_version_key(d.name))


def _version_of_command(kicad_command: str) -> str:
    r"""The major version in a pinned executable path, e.g. ...\KiCad\10.0\bin\kicad.exe.

    Returns "" when the path says nothing, which is the normal case on a layout that
    does not carry the version in a folder name.
    """
    if not kicad_command:
        return ""
    for part in Path(kicad_command).parts:
        if part and part[0].isdigit() and all(
            p.isdigit() for p in part.split(".") if p
        ):
            return part
    return ""


def _pinned_kicad_command() -> str:
    """The executable the user chose in settings, when there is one.

    Read here rather than passed in, so the callers of status/link/unlink keep their
    signatures: which KiCad this is about is a property of the machine, not of the
    request.
    """
    try:
        from . import settings as settings_store

        return settings_store.load().kicad_command or ""
    except Exception:
        return ""


def _same_server(a: str, b: str) -> bool:
    return a.rstrip("/").lower() == b.rstrip("/").lower()


def _providers(cfg: Path) -> list[dict]:
    try:
        data = json.loads((cfg / "eeschema.json").read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    remote = data.get("remote_symbols") or {}
    providers = remote.get("providers") or []
    return [p for p in providers if isinstance(p, dict)]


def status(server_url: str) -> dict:
    """Is Prism linked, and does it point at the server we're configured for?

    Three outcomes the UI cares about:
        not linked   no provider naming any Prism server
        linked       a provider whose metadata_url is our server
        stale        a provider is registered, but for a DIFFERENT server
    """
    cfg = kicad_config_dir(_pinned_kicad_command())
    if cfg is None:
        return {
            "configured": False,
            "kicad_version": "",
            "linked": False,
            "stale": False,
            "linked_url": "",
            "server_url": server_url,
        }

    providers = _providers(cfg)
    ours = next(
        (p for p in providers if _same_server(p.get("metadata_url", ""), server_url)),
        None,
    )

    # A provider registered under Prism's name but pointing somewhere else is the case
    # worth calling out: the user changed the server URL and the link never followed.
    other = next(
        (
            p
            for p in providers
            if p.get("display_name_override") == PROVIDER_NAME
            and not _same_server(p.get("metadata_url", ""), server_url)
        ),
        None,
    )

    return {
        "configured": True,
        "kicad_version": cfg.name,
        "linked": ours is not None,
        "stale": ours is None and other is not None,
        "linked_url": (other or {}).get("metadata_url", ""),
        "server_url": server_url,
    }


class RemoteLibraryError(Exception):
    """Couldn't change the registration, with a reason worth showing."""


def link(server_url: str) -> dict:
    """Register Prism as KiCad's remote symbol provider.

    Works whether or not KiCad is running. KiCad rewrites eeschema.json on exit, but
    only the sections it actually touched, `remote_symbols.providers` isn't one of them
    unless the user opened the Remote Symbol dialog, so an external write survives.
    (Verified: written with KiCad open, survived a full restart.)

    KiCad reads the providers at startup, so it does need a restart to *see* the change.

    Read-modify-write: this is the user's own eeschema config, and every other setting in
    it has to survive.
    """
    cfg = kicad_config_dir(_pinned_kicad_command())
    if cfg is None:
        raise RemoteLibraryError(
            "Couldn't find a KiCad configuration. Run KiCad once first."
        )

    path = cfg / "eeschema.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RemoteLibraryError(f"Couldn't read {path}: {exc}") from exc

    server_url = server_url.rstrip("/")
    remote = data.setdefault("remote_symbols", {})
    providers = remote.setdefault("providers", [])

    # Drop any previous Prism entry, including one pointing at an old server, which is
    # exactly the stale case we're here to fix. Leave other people's providers alone.
    providers = [
        p
        for p in providers
        if not (
            isinstance(p, dict)
            and (
                p.get("display_name_override") == PROVIDER_NAME
                or _same_server(p.get("metadata_url", ""), server_url)
            )
        )
    ]

    entry = {
        # KiCad's own ids look like provider-<12 hex>; match the shape so nothing
        # downstream is surprised by it.
        "provider_id": "provider-%s" % uuid.uuid4().hex[:12],
        "metadata_url": server_url,
        "display_name_override": PROVIDER_NAME,
        "last_account_label": "",
        "last_auth_status": "signed_out",
    }
    providers.append(entry)

    remote["providers"] = providers
    remote["last_used_provider_id"] = entry["provider_id"]

    _save(path, data)
    return {"kicad_version": cfg.name, "server_url": server_url}


def unlink(server_url: str) -> dict:
    """Remove Prism from KiCad's providers. Leaves every other provider untouched."""
    cfg = kicad_config_dir(_pinned_kicad_command())
    if cfg is None:
        return {"kicad_version": "", "removed": False}

    path = cfg / "eeschema.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        raise RemoteLibraryError(f"Couldn't read {path}: {exc}") from exc

    remote = data.get("remote_symbols") or {}
    providers = remote.get("providers") or []
    keep = [
        p
        for p in providers
        if not (
            isinstance(p, dict)
            and (
                p.get("display_name_override") == PROVIDER_NAME
                or _same_server(p.get("metadata_url", ""), server_url)
            )
        )
    ]
    if len(keep) == len(providers):
        return {"kicad_version": cfg.name, "removed": False}

    remote["providers"] = keep
    remote["last_used_provider_id"] = ""
    _save(path, data)
    return {"kicad_version": cfg.name, "removed": True}


def _save(path: Path, data: dict) -> None:
    # Write-then-replace: a half-written eeschema.json would cost the user every
    # preference they have.
    tmp = path.with_name(path.name + ".prism-tmp")
    try:
        tmp.write_text(json.dumps(data, indent=2), encoding="utf-8")
        tmp.replace(path)
    except OSError as exc:
        raise RemoteLibraryError(f"Couldn't write {path}: {exc}") from exc
