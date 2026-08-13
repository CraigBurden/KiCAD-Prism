"""Derived manufacturer upload zips.

The zip is a convenience download assembled from the signed dossier (gerbers,
drill, vendor CSV) plus evidence (XLSX). It is not a new signed member and
must not enter a fingerprint.
"""

from __future__ import annotations

import io
import tarfile
from pathlib import PurePosixPath
from typing import Mapping

from app.release_studio.canonical import write_deterministic_zip

from .registry import profile_by_id


class VendorPackError(RuntimeError):
    """A vendor pack could not be assembled from stored artifacts."""


def build_vendor_pack(
    vendor_id: str,
    *,
    dossier_bytes: bytes,
    evidence_bytes: bytes | None = None,
) -> bytes:
    """Build the derived zip for *vendor_id* from stored archives."""

    try:
        profile = profile_by_id(vendor_id)
    except KeyError as exc:
        raise VendorPackError(f"unknown vendor profile: {vendor_id}") from exc

    members = _pack_members(vendor_id, dossier_bytes, evidence_bytes)

    readiness = _readiness(profile, members)
    if not readiness["ready"]:
        missing = ", ".join(readiness["missing_requirements"])
        raise VendorPackError(f"{profile.title} pack is incomplete: missing {missing}")
    return write_deterministic_zip(members)


def vendor_pack_readiness(
    vendor_id: str,
    *,
    dossier_bytes: bytes,
    evidence_bytes: bytes | None = None,
) -> dict[str, object]:
    """Return the same fail-closed readiness predicate used by pack download."""

    try:
        profile = profile_by_id(vendor_id)
    except KeyError as exc:
        raise VendorPackError(f"unknown vendor profile: {vendor_id}") from exc
    members = _pack_members(vendor_id, dossier_bytes, evidence_bytes)
    return {"vendor_id": vendor_id, "title": profile.title, **_readiness(profile, members)}


def _pack_members(
    vendor_id: str, dossier_bytes: bytes, evidence_bytes: bytes | None
) -> dict[str, bytes]:
    members: dict[str, bytes] = {}
    dossier = _tar_members(dossier_bytes)
    evidence = _tar_members(evidence_bytes or b"")

    for path, payload in dossier.items():
        if path.startswith("fabrication/gerbers/") and _is_file(path):
            members[f"gerbers/{PurePosixPath(path).name}"] = payload
        elif path.startswith("fabrication/drill/") and _is_file(path):
            members[f"drill/{PurePosixPath(path).name}"] = payload
        elif path.startswith(f"manufacturing/vendors/{vendor_id}/") and path.endswith(".csv"):
            members[PurePosixPath(path).name] = payload
    prefix = f"raw/vendors/{vendor_id}/"
    for path, payload in evidence.items():
        if path.startswith(prefix) and _is_file(path):
            members[PurePosixPath(path).name] = payload
    return members


def _readiness(profile, members: Mapping[str, bytes]) -> dict[str, object]:
    requirements = tuple(getattr(profile, "required_pack_artifacts", ("gerber", "drill")))
    present = {
        "gerber": any(name.startswith("gerbers/") for name in members),
        "drill": any(name.startswith("drill/") for name in members),
        **{name: name in members for name in requirements if name not in {"gerber", "drill"}},
    }
    missing = [name for name in requirements if not present.get(name, False)]
    return {
        "ready": not missing,
        "missing_requirements": missing,
        "required_artifacts": list(requirements),
    }


def _tar_members(payload: bytes) -> dict[str, bytes]:
    if not payload:
        return {}
    members: dict[str, bytes] = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:*") as archive:
            for info in archive.getmembers():
                if not info.isfile():
                    continue
                extracted = archive.extractfile(info)
                if extracted is None:
                    continue
                members[info.name] = extracted.read()
    except tarfile.TarError as exc:
        raise VendorPackError(f"stored archive could not be read: {exc}") from exc
    return members


def _is_file(path: str) -> bool:
    return bool(path) and not path.endswith("/")


__all__ = ["VendorPackError", "build_vendor_pack", "vendor_pack_readiness"]
