"""The collision check (SB2-108, CONTRACTS_P2 §24.2): queue it, run it, read it.

A check places every occurrence as the System 3D view does, builds each one's bodies (a board's
outline box and component bodies, a module's or part's model), intersects them and stores the result
with the scene key it was made for. The document raises SYS-V22 from it while that key is current.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, Optional

from app.services.systems import (
    collision_meshes, collisions, scene as scene_module, system_nets,
)
from app.services.job_kinds import JobKind
from app.services.systems.placement import poses as poses_module
from app.services.systems.service_base import Caller
from app.services.systems.store import NotFound

logger = logging.getLogger(__name__)

COLLISION_JOB_KIND = "system_collision_check"
CHECKER = Caller(role="admin", email="system:collisions")


def mated_pairs(level: system_nets.Level, kinds: dict[str, str]) -> set[frozenset]:
    """The two connector bodies of every ``b2b`` link at any depth (§24.2): they touch by design.
    A module's end is its whole body (one mesh), so the pair is the module and the board connector."""
    out: set[frozenset] = set()
    for link in level.links:
        if link.get("type") != "b2b":
            continue
        ends = []
        for end in ("a", "b"):
            located = system_nets._locate(level, system_nets._end(link, end))
            if located is None:
                break
            path, _key, reference = located
            kind = kinds.get(path, "board")  # by occurrence path: an export may resolve into a child level
            ends.append((path, None if kind in ("module", "part") else reference or None))
        if len(ends) == 2:
            out.add(frozenset(ends))
    for child in level.children.values():
        out |= mated_pairs(child, kinds)
    return out


class CollisionsMixin:
    def request_collision_check(self, caller: Caller, system_id: str) -> dict:
        """``POST …/collisions``: queue a check (§24.2). Any reader may ask; it changes no version."""
        with self._tx() as store:
            self._system(store, system_id, caller)
        job = COLLISION_CHECK.enqueue({"systemId": system_id}, artifact_key=f"system-collisions:{system_id}",
                                      requested_by=caller.email)
        return {"jobId": job["job_id"]}

    def collision_check(self, caller: Caller, system_id: str) -> dict:
        """``GET …/collisions``: the stored check as the document reads it (§24.2)."""
        with self._tx() as store:
            system = self._system(store, system_id, caller)
        report = self.document(caller, system_id, include_validation=True).body["validation"]
        found = [f for f in report["findings"] if f["rule"] == "SYS-V22"]
        return {"systemId": system["id"], **report.get("collisionCheck", {}), "findings": found}

    def run_collision_check(self, system_id: str, job_id: Optional[str] = None) -> dict:
        """Build every body, intersect them and store the result with its scene key."""
        started = time.perf_counter()
        with self._tx(consistent=True) as store:
            loaded = self._load(store, system_id, CHECKER)
            system = loaded.system
            built = self._built(loaded)
            bodies, gaps, exempt = self._collision_bodies(loaded)
        found = collisions.check(bodies, exempt)
        result = {"collisions": found, "notEvaluated": gaps,
                  "stats": {"bodies": len(bodies), "triangles": int(sum(len(b.faces) for b in bodies)),
                            "seconds": round(time.perf_counter() - started, 2)}}
        with self._tx() as store:
            store.record_collision_check(system_id, scene_key=built["sceneKey"], version=system["version"],
                                         result=result, job_id=job_id)
        return result

    def _collision_bodies(self, loaded: Any) -> tuple[list, list, set]:
        from app.services.catalog.models import alignment_matrix
        from app.services.semantic_visualizer_service import bundle_dir, semantic_store_root

        tree, level, placement = loaded.tree, loaded.level, loaded.placement
        world = scene_module.world_poses(tree.occurrences, placement["placed"])
        interface_of, _component_of = self._occurrence_lookups(loaded.rows, loaded.extents)
        cache_root = semantic_store_root().parent / "system-collision-meshes"
        bodies, gaps = [], []
        for occurrence in tree.occurrences:
            if occurrence.kind == "assembly":
                continue  # its members are occurrences of their own
            label = occurrence.display_path
            matrix = poses_module.matrix(world[occurrence.path])

            def gap(reason: str) -> None:
                gaps.append({"occurrence": occurrence.path, "label": label, "reason": reason})

            if occurrence.kind == "board":
                local = placement["local"].get(occurrence.path)
                if local:
                    vertices, faces = collisions.box(local["minMm"], local["maxMm"])
                    bodies.append(collisions.Body(occurrence.path, label, None, vertices, faces, matrix, solid=True))
                else:
                    gap("no_outline")
                if not occurrence.project_id or not occurrence.baseline_commit:
                    gap("restricted")
                    continue
                asset = self._scene_asset(CHECKER, occurrence.project_id, occurrence.baseline_commit)
                if asset["status"] != "ready":
                    gap(f"bundle_{asset['status']}")
                    continue
                directory = bundle_dir(occurrence.project_id, asset["sourceRevisionKey"], asset["generatorBuild"])
                cache = cache_root / occurrence.project_id / asset["sourceRevisionKey"] / f"{asset['generatorBuild']}.npz"
                for reference, vertices, faces in collision_meshes.board_components(
                        directory, asset["bundleToBoard"], cache):
                    bodies.append(collisions.Body(occurrence.path, label, reference, vertices, faces, matrix))
                continue
            model = (interface_of(occurrence) or {}).get("model")
            path: Optional[Path] = None
            if model:
                try:
                    path = self._catalog().model_glb_path(model["glbKey"])
                except Exception:
                    logger.debug("No model file for %s", model["glbKey"], exc_info=True)
            if path is None or not path.exists():
                gap("no_model")
                continue
            for _reference, vertices, faces in collision_meshes.catalog_model(path, alignment_matrix(model["alignment"])):
                bodies.append(collisions.Body(occurrence.path, label, None, vertices, faces, matrix))
        return bodies, gaps, mated_pairs(level, {o.path: o.kind for o in tree.occurrences})


def run_collision_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult
    from app.services.systems import service as system_service

    system_id = str(context.payload["systemId"])
    context.progress(stage="system-collisions", message="Checking for collisions", percent=10, force=True)
    try:
        result = system_service.service.run_collision_check(system_id, job_id=getattr(context, "job_id", None))
    except NotFound:
        return JobResult(message="The system no longer exists", details={})
    return JobResult(message=f"{len(result['collisions'])} collision(s)", details=result["stats"])


COLLISION_CHECK = JobKind(COLLISION_JOB_KIND, run_collision_job)
JOB_KINDS = (COLLISION_CHECK,)
