"""Board 3D bundles for the system scene (CONTRACTS_P2 §20.2).

Wraps the single-board pipeline (``semantic_visualizer_service``): the scene
reuses its bundles, its readiness cache and its ``webgpu_3d`` job, and adds
nothing to how a bundle is built.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Iterable, Mapping, Optional

logger = logging.getLogger(__name__)


class BundleUnreadable(Exception):
    """The bundle a ready status names cannot be read: its files are gone or broken (SB2-91)."""


def mid_plane_from_layers(layers: list[Mapping[str, Any]]) -> float:
    """Height of the board mid-plane in a bundle's runtime frame, in mm.

    The pipeline puts KiCad's substrate between the inner faces of the outer
    copper layers, from z = 0 up (``semantic_gltf._set_canonical_board_y_range``); the
    mid-plane is half way. Without two copper layers the runtime z is the
    centred stackup z, so the mid-plane is 0.
    """
    copper = sorted((layer for layer in layers if layer.get("role") == "copper"),
                    key=lambda layer: float(layer.get("z_mm") or 0.0))
    if len(copper) < 2:
        return 0.0
    bottom, top = copper[0], copper[-1]
    bottom_inner = float(bottom.get("z_mm") or 0.0) + float(bottom.get("thickness_mm") or 0.0) / 2.0
    top_inner = float(top.get("z_mm") or 0.0) - float(top.get("thickness_mm") or 0.0) / 2.0
    body = top_inner - bottom_inner
    return body / 2.0 if body > 0 else 0.0


def latest_job(kind: str, artifact_key: str) -> Optional[dict]:
    """The most recent job of ``kind`` for ``artifact_key``, in any status."""
    from app.services.systems.jobs import workspace_connection

    with workspace_connection() as conn:
        row = conn.execute(
            "SELECT id, status, error_message, message FROM ws_jobs"
            " WHERE kind = %s AND artifact_key = %s ORDER BY created_at DESC LIMIT 1",
            (kind, artifact_key),
        ).fetchone()
    return dict(row) if row else None


def latest_jobs(kind: str, artifact_keys: Iterable[str]) -> dict[str, dict]:
    """``artifact key -> its most recent job of kind`` (any status), in one query; keys with none are left out."""
    from app.services.systems.jobs import workspace_connection

    keys = sorted(set(artifact_keys))
    if not keys:
        return {}
    with workspace_connection() as conn:
        rows = conn.execute(
            "SELECT DISTINCT ON (artifact_key) artifact_key, id, status FROM ws_jobs"
            " WHERE kind = %s AND artifact_key = ANY(%s) ORDER BY artifact_key, created_at DESC",
            (kind, keys),
        ).fetchall()
    return {str(row["artifact_key"]): dict(row) for row in rows}


class BundleSource:
    """The production source; tests pass a fake with the same four methods."""

    def status(self, project: Any, commit: str) -> dict:
        from app.services import semantic_visualizer_service

        return semantic_visualizer_service.get_status_fast(project, commit)

    def last_build(self, project_id: str, commit: str) -> Optional[dict]:
        """The latest ``webgpu_3d`` job for this commit: ``{jobId, status, error}``, or None."""
        from app.services import project_service
        from app.services.workspace_service import workspace

        row = workspace.get_project_by_id(project_id)
        if not row:
            return None
        job = latest_job("webgpu_3d", project_service.webgpu_artifact_key(row, commit))
        if not job:
            return None
        return {"jobId": str(job["id"]), "status": str(job["status"]),
                "error": job["error_message"] or job["message"] or None}

    def build(self, project_id: str, commit: str, *, requested_by: str) -> Optional[str]:
        from app.services import project_service

        return project_service.start_workflow_job(project_id, "webgpu_3d", requested_by or "system-scene", commit=commit)

    def mid_plane_mm(self, project_id: str, status: Mapping[str, Any]) -> Optional[float]:
        """The bundle's board mid-plane; None for a board-stage bundle; BundleUnreadable when its files fail.

        SB2-96: a computed mid-plane is kept per (project, source, build) fingerprint, in this
        process and in ``system_bundle_frames``; the files never change for that key, so a warm
        read only confirms with two stats that they are still there (SB2-91)."""
        from app.services import semantic_visualizer_service

        try:
            key = (project_id, str(status["source_fingerprint"]), str(status["build_fingerprint"]))
            root = semantic_visualizer_service.bundle_dir(*key)
        except (KeyError, TypeError) as error:
            raise BundleUnreadable(str(error)) from error
        frame = _FRAMES.get(key) or _stored_frame(key)
        if frame is not None:
            manifest, mid_plane = frame
            if (root / "bundle.json").is_file() and (root / manifest).is_file():
                _FRAMES[key] = frame
                return mid_plane
            _FRAMES.pop(key, None)
            raise BundleUnreadable(f"{root}: bundle files are gone")
        try:
            bundle = json.loads((root / "bundle.json").read_text(encoding="utf-8"))
            geometry = json.loads((root / str(bundle.get("semantic_geometry") or "semantic_geometry.json"))
                                  .read_text(encoding="utf-8"))
            manifest = (geometry.get("assets") or {}).get("scene_manifest") or (geometry.get("semantic_gltf") or {}).get("path")
            if not manifest:
                return None  # a board-stage bundle: the renderer waits for the next readiness step
            layers = json.loads((root / manifest).read_text(encoding="utf-8")).get("layers") or []
        except (OSError, ValueError, KeyError, TypeError) as error:
            logger.warning("Could not read the layer table of bundle %s: %s", status.get("bundle_url"), error)
            raise BundleUnreadable(str(error)) from error
        mid_plane = mid_plane_from_layers(layers)
        _FRAMES[key] = (str(manifest), mid_plane)
        _store_frame(key, str(manifest), mid_plane)
        return mid_plane


# (project, source fingerprint, build fingerprint) -> (scene manifest path, mid-plane mm).
_FRAMES: dict[tuple[str, str, str], tuple[str, float]] = {}


def _stored_frame(key: tuple[str, str, str]) -> Optional[tuple[str, float]]:
    from app.services.systems.jobs import workspace_connection

    try:
        with workspace_connection() as conn:
            row = conn.execute(
                "SELECT manifest_path, mid_plane_mm FROM system_bundle_frames"
                " WHERE project_id = %s AND source_fingerprint = %s AND build_fingerprint = %s", key).fetchone()
    except Exception:
        logger.exception("Could not read the stored frame of bundle %s", key)
        return None
    return (str(row["manifest_path"]), float(row["mid_plane_mm"])) if row else None


def _store_frame(key: tuple[str, str, str], manifest: str, mid_plane: float) -> None:
    from app.services.systems.jobs import workspace_connection

    try:
        with workspace_connection() as conn:
            conn.execute(
                "INSERT INTO system_bundle_frames(project_id, source_fingerprint, build_fingerprint, manifest_path,"
                " mid_plane_mm) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING", (*key, manifest, mid_plane))
            conn.commit()
    except Exception:
        logger.exception("Could not store the frame of bundle %s", key)
