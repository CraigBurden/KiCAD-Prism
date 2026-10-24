"""Fabrication viewer routes: Gerber layers, drill and pick-and-place.

Two sources feed the same view model.  A Release Studio build serves the package
it released, read digest-checked out of its stored dossier; a project's output
folders serve the Gerber and drill files it keeps, from the working tree or at a
commit.  Only where the bytes come from differs.  Mounted at ``/api/projects``.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import posixpath
import re
import tarfile
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from app.api import projects as projects_api
from app.api import release_studio as release_api
from app.api._helpers import (
    get_project_for_role_or_404,
    require_output_type,
    resolve_path_within_root,
)
from app.core.security import AuthenticatedUser, require_viewer
from app.services.fabrication_view_service import (
    BoundedCache,
    FabricationPackage,
    FabricationViewError,
    RENDER_VERSION,
)
from app.services.placement_service import PlacementError, parse_bom, parse_positions
from app.services.placement_service import build_view as build_placement_view

router = APIRouter(dependencies=[Depends(require_viewer)])
logger = logging.getLogger(__name__)

#: Gerber (`.gbr`, KiCad's Protel `.gtl`/`.gbl`/`.gm1`/..., inner `.g1`), job file, drill.
_LAYER_FILE = re.compile(
    r"\.(gbr|gtl|gbl|gts|gbs|gto|gbo|gtp|gbp|gta|gba|gm\d|gko|g\d+|gbrjob|drl|xln)$",
    re.IGNORECASE,
)
_CSV_FILE = re.compile(r"\.csv$", re.IGNORECASE)
_LAYERS = (_LAYER_FILE, "No Gerber or drill files in this folder")
_TABLES = (_CSV_FILE, "No CSV files in this folder")

#: Limits that keep one request bounded: how many files, how big each is, and how
#: much a folder may ask to hold in memory at once.
_MAX_FILES = 80
_MAX_FILE_BYTES = 25 * 1024 * 1024
_MAX_TOTAL_BYTES = 100 * 1024 * 1024

_FULL_SHA = re.compile(r"[0-9a-fA-F]{40}")

#: Parsed packages and placement views. Neither is cheap to build; a handful is
#: enough, because a viewer asks for one package many times in a row.
_FABRICATION_CACHE_SIZE = 4
_cache = BoundedCache(_FABRICATION_CACHE_SIZE)
_fabrication_cache = BoundedCache(_FABRICATION_CACHE_SIZE)
_placement_cache = BoundedCache(_FABRICATION_CACHE_SIZE)

_SVG_HEADERS = {
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
}


# ---------------------------------------------------------------------------
# Release Studio builds
# ---------------------------------------------------------------------------

#: Where a build keeps what the viewer shows.
_FABRICATION_PREFIXES = ("fabrication/gerbers/", "fabrication/drill/")
_POSITIONS_MEMBER = "assembly/positions.csv"
_BOM_MEMBER = "assembly/bom.csv"


def _dossier_files(
    build: dict[str, Any], prefixes: tuple[str, ...], missing_detail: str
) -> dict[str, bytes]:
    """Digest-checked members under ``prefixes`` out of the stored dossier.

    The same rule as Release Studio's member download: a viewer only ever shows
    bytes that match what the manifest released.
    """

    wanted = {
        item["path"]: item
        for item in release_api.store.build_members(build["id"])
        if str(item["path"]).startswith(prefixes)
    }
    if not wanted:
        raise HTTPException(status_code=404, detail=missing_detail)
    payload = release_api._artifact_bytes(build["dossier_artifact_id"])
    files: dict[str, bytes] = {}
    try:
        with tarfile.open(fileobj=io.BytesIO(payload), mode="r:gz") as archive:
            for path, member in wanted.items():
                extracted = archive.extractfile(path)
                if extracted is None:
                    continue
                data = extracted.read()
                actual = hashlib.sha256(data).hexdigest()
                if actual != member["released_digest"]:
                    raise HTTPException(
                        status_code=500,
                        detail=(
                            f"Released digest mismatch for {path}: the manifest records "
                            f"{member['released_digest']} but the stored dossier holds {actual}"
                        ),
                    )
                files[path] = data
    except tarfile.TarError as exc:
        logger.exception("Could not read stored dossier for build %s", build["id"])
        raise HTTPException(
            status_code=500, detail="The stored dossier could not be read."
        ) from exc
    return files


def _fabrication_files(build: dict[str, Any]) -> dict[str, bytes]:
    return _dossier_files(build, _FABRICATION_PREFIXES, "This build has no fabrication files")


def _fabrication_package(build: dict[str, Any]) -> FabricationPackage:
    # A build is immutable, so its parsed package never goes stale.
    build_id = str(build["id"])
    cached = _fabrication_cache.get(build_id)
    if cached is not None:
        return cached
    try:
        package = FabricationPackage.from_files(_fabrication_files(build))
    except FabricationViewError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    _fabrication_cache.put(build_id, package)
    return package


def _build_for(project_id: str, build_id: str, user: AuthenticatedUser) -> dict[str, Any]:
    get_project_for_role_or_404(project_id, user.role)
    return release_api._build_or_404(project_id, build_id)


# Plain `def` throughout: parsing a dense board takes real CPU, which belongs in
# the threadpool and not on the event loop.
@router.get("/{project_id}/release-studio/builds/{build_id}/fabrication-view")
def get_fabrication_view(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    """Layers, board size and drill tools of the build's fabrication package."""

    return _fabrication_package(_build_for(project_id, build_id, user)).view()


@router.get("/{project_id}/release-studio/builds/{build_id}/fabrication-view/layers/{layer_id}.svg")
def get_fabrication_layer(
    project_id: str,
    build_id: str,
    layer_id: str,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """One layer drawn as SVG against the package's shared board extent."""

    build = _build_for(project_id, build_id, user)
    try:
        svg = _fabrication_package(build).svg(layer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Layer not found") from exc
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            "Cache-Control": "private, max-age=31536000, immutable",
            "ETag": f'"{build_id}-{layer_id}-r{RENDER_VERSION}"',
            **_SVG_HEADERS,
        },
    )


@router.get("/{project_id}/release-studio/builds/{build_id}/placement")
def get_build_placement(
    project_id: str, build_id: str, user: AuthenticatedUser = Depends(require_viewer)
):
    """Pick-and-place parts of the build, checked against its BOM when it has one."""

    build = _build_for(project_id, build_id, user)
    cached = _placement_cache.get(("build", str(build["id"])))
    if cached is not None:
        return cached
    members = {str(item["path"]) for item in release_api.store.build_members(build["id"])}
    if _POSITIONS_MEMBER not in members:
        raise HTTPException(status_code=404, detail="This build has no position file")
    wanted = (_POSITIONS_MEMBER,) + ((_BOM_MEMBER,) if _BOM_MEMBER in members else ())
    files = _dossier_files(build, wanted, "This build has no position file")
    bom = files.get(_BOM_MEMBER)
    try:
        view = build_placement_view(
            files[_POSITIONS_MEMBER].decode("utf-8", errors="replace"),
            bom.decode("utf-8", errors="replace") if bom is not None else None,
            positions_name=_POSITIONS_MEMBER.rsplit("/", 1)[-1],
            bom_name=_BOM_MEMBER.rsplit("/", 1)[-1],
        )
    except PlacementError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    _placement_cache.put(("build", str(build["id"])), view)
    return view


# ---------------------------------------------------------------------------
# Committed output folders (the Assets Portal)
# ---------------------------------------------------------------------------


def _clean_folder(folder: str) -> str:
    normalized = posixpath.normpath(folder.replace("\\", "/")) if folder.strip() else ""
    if normalized in ("", "."):
        return ""
    if normalized.startswith("/") or normalized == ".." or normalized.startswith("../"):
        raise HTTPException(status_code=400, detail="Invalid folder path")
    return normalized


def _candidates(names_sizes: list[tuple[str, int]], kind) -> list[tuple[str, int]]:
    """The files of one kind, with the limits that keep a request bounded."""

    pattern, empty = kind
    found = [(name, size) for name, size in names_sizes if pattern.search(name)]
    if not found:
        raise HTTPException(status_code=404, detail=empty)
    if len(found) > _MAX_FILES:
        raise HTTPException(status_code=413, detail="Too many files to view as one package")
    if any(size > _MAX_FILE_BYTES for _, size in found):
        raise HTTPException(status_code=413, detail="A file in this folder is too large to view")
    if sum(size for _, size in found) > _MAX_TOTAL_BYTES:
        raise HTTPException(status_code=413, detail="This folder is too large to view as one package")
    return found


def _working_tree(project, output_type: str, folder: str, kind=_LAYERS):
    output_dir = projects_api._resolve_output_dir(project, output_type)
    directory = resolve_path_within_root(output_dir, folder, invalid_detail="Invalid folder path")
    if not directory.is_dir():
        raise HTTPException(status_code=404, detail="Folder not found")
    entries = [
        (entry.name, entry.stat())
        for entry in os.scandir(directory)
        if entry.is_file() and kind[0].search(entry.name)
    ]
    _candidates([(name, stat.st_size) for name, stat in entries], kind)
    signature = tuple(sorted((name, stat.st_size, stat.st_mtime_ns) for name, stat in entries))

    def read() -> dict[str, bytes]:
        return {name: (directory / name).read_bytes() for name, _ in entries}

    return signature, read


def _at_commit(project, output_type: str, folder: str, commit: str, kind=_LAYERS):
    config = projects_api._path_config_from_commit(project, commit)
    base = projects_api._join_relative_paths(
        projects_api._output_dir_from_config(config, output_type), folder
    )
    items = [
        item
        for item in projects_api._files_from_commit(project, commit, base)
        if not item.is_dir and "/" not in item.path
    ]
    found = _candidates([(item.name, item.size) for item in items], kind)
    signature = tuple(sorted(found))

    def read() -> dict[str, bytes]:
        return {
            name: projects_api._read_commit_file(
                project, commit, name, relative_prefix=base, not_found_detail="File not found"
            ).content
            for name, _ in found
        }

    return signature, read


def _folder_files(
    project_id: str,
    user: AuthenticatedUser,
    output_type: str,
    folder: str,
    commit: Optional[str],
    kind,
):
    """Signature and reader for one kind of file in a project output folder."""

    project = get_project_for_role_or_404(project_id, user.role)
    return (
        _at_commit(project, output_type, folder, commit, kind)
        if commit
        else _working_tree(project, output_type, folder, kind)
    )


def _cacheable(commit: Optional[str]) -> bool:
    """A working tree is keyed by its files' signature; a commit only if it is pinned.

    A branch or tag name can move without any file in the folder changing size,
    so a name is never a safe key.
    """

    return not commit or bool(_FULL_SHA.fullmatch(commit))


def _package(
    project_id: str,
    user: AuthenticatedUser,
    output_type: str,
    folder: str,
    commit: Optional[str],
) -> FabricationPackage:
    output_type = require_output_type(output_type)
    folder = _clean_folder(folder)
    signature, read = _folder_files(project_id, user, output_type, folder, commit, _LAYERS)
    key = (project_id, output_type, folder, commit or "", signature)
    cached = _cache.get(key) if _cacheable(commit) else None
    if cached is not None:
        return cached
    try:
        package = FabricationPackage.from_files(read())
    except FabricationViewError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if _cacheable(commit):
        _cache.put(key, package)
    return package


@router.get("/{project_id}/fabrication-view")
def get_output_fabrication_view(
    project_id: str,
    type: str = "manufacturing",
    folder: str = "",
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Layers, board size and drill tools of the Gerber files in one folder."""

    return _package(project_id, user, type, folder, commit).view()


@router.get("/{project_id}/fabrication-view/layers/{layer_id}.svg")
def get_output_fabrication_layer(
    project_id: str,
    layer_id: str,
    type: str = "manufacturing",
    folder: str = "",
    commit: Optional[str] = Query(None),
    user: AuthenticatedUser = Depends(require_viewer),
):
    """One layer of that package as SVG, on the package's shared extent."""

    package = _package(project_id, user, type, folder, commit)
    try:
        svg = package.svg(layer_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Layer not found") from exc
    pinned = bool(commit and _FULL_SHA.fullmatch(commit))
    return Response(
        content=svg,
        media_type="image/svg+xml",
        headers={
            # Working-tree files can change, so only a pinned commit is immutable.
            "Cache-Control": "private, max-age=31536000, immutable" if pinned else "private, no-cache",
            **_SVG_HEADERS,
        },
    )


def _is_position_file(text: str) -> bool:
    try:
        parse_positions(text)
    except PlacementError:
        return False
    return True


def _pick(files: dict[str, str], wanted, prefer: re.Pattern[str]) -> Optional[str]:
    """First file `wanted` accepts, those named like `prefer` first."""

    for name in sorted(files, key=lambda item: (not prefer.search(item), item.casefold())):
        if wanted(files[name]):
            return name
    return None


_POSITION_NAME = re.compile(r"pos|cpl|place|centroid", re.IGNORECASE)
_BOM_NAME = re.compile(r"bom|parts", re.IGNORECASE)


@router.get("/{project_id}/placement")
def get_output_placement(
    project_id: str,
    type: str = "manufacturing",
    folder: str = "",
    commit: Optional[str] = None,
    user: AuthenticatedUser = Depends(require_viewer),
):
    """Parts of the position file in a folder, checked against its BOM if it has one.

    The files are found by what they contain, not by name: KiCad calls them
    ``*-pos.csv`` and ``*.csv``, the JLCPCB plugin ``CPL-*.csv`` and ``BOM-*.csv``.
    """

    output_type = require_output_type(type)
    folder = _clean_folder(folder)
    signature, read = _folder_files(project_id, user, output_type, folder, commit, _TABLES)
    key = ("outputs", project_id, output_type, folder, commit or "", signature)
    cached = _placement_cache.get(key) if _cacheable(commit) else None
    if cached is not None:
        return cached
    files = {name: data.decode("utf-8", errors="replace") for name, data in read().items()}
    positions = _pick(files, _is_position_file, _POSITION_NAME)
    if positions is None:
        raise HTTPException(status_code=404, detail="No position file in this folder")
    others = {name: text for name, text in files.items() if name != positions}

    def is_bom(text: str) -> bool:
        try:
            parse_bom(text)
        except PlacementError:
            return False
        return not _is_position_file(text)

    bom = _pick(others, is_bom, _BOM_NAME)
    try:
        view = build_placement_view(
            files[positions],
            others[bom] if bom else None,
            positions_name=positions,
            bom_name=bom or "",
        )
    except PlacementError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    if _cacheable(commit):
        _placement_cache.put(key, view)
    return view
