"""The system STEP export (SB2-109, CONTRACTS_P2 §25): queue it, run it, read it, download it.

Each board's STEP comes from ``kicad-cli pcb export step`` on a ``git archive`` of its baseline
commit, cached per commit; each module's or part's from the catalog STEP behind its model. They
are placed as the System 3D view places them, in a product tree that follows the instance paths,
and written as one AP214 file by ``step_assembly`` (OCCT). The export carries its requester's
access: restricted boards are left out, and a reader downloads it only when they can see every
board it holds.
"""

from __future__ import annotations

import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Optional

from app.services.kicad_tools import KicadTool, kicad_cli
from app.services.systems import step_assembly, visibility
from app.services.systems.placement import poses as poses_module
from app.services.systems.service_base import Caller
from app.services.systems.store import Conflict, NotFound, SystemStore

logger = logging.getLogger(__name__)

STEP_JOB_KIND = "system_step_export"
BOARD_TIMEOUT_S = 900
PARALLEL_BOARDS = 3  # kicad-cli processes at once; each is one CPU-heavy export


def _step_root() -> Path:
    from app.services.semantic_visualizer_service import semantic_store_root

    return semantic_store_root().parent / "system-step"


def _cli_version(cli: KicadTool) -> str:
    """The cache key's KiCad version: a new KiCad re-exports every board."""
    return re.sub(r"[^0-9A-Za-z.]+", "-", cli.version()) or "unknown"


def _shifted(matrix: list[float], z: float) -> list[float]:
    """``matrix · T(0, 0, z)``."""
    m = list(matrix)
    for row in range(3):
        m[12 + row] += m[8 + row] * z
    return m


def _multiply(a: list[float], b: list[float]) -> list[float]:
    """Column-major ``a · b``."""
    return [sum(a[k * 4 + row] * b[col * 4 + k] for k in range(4)) for col in range(4) for row in range(4)]


def board_step(project: Any, commit: str, *, tool: Optional[KicadTool] = None) -> Path:
    """The board's STEP at ``commit`` (§25), exported once per commit and KiCad version."""
    from app.services import project_revision

    cli = tool or kicad_cli()
    target = _step_root() / str(project.id) / f"{commit}-{_cli_version(cli)}.step"
    if target.is_file():
        return target
    location = project_revision.locate(project)
    relative = project_revision.project_file_rel(location)
    with project_revision.checkout(location, commit, prefix="system-step-") as revision:
        pcb = revision.path(relative).with_suffix(".kicad_pcb")
        if not pcb.is_file():
            raise RuntimeError(f"No board file in {commit[:12]}")
        out = revision.root.parent / "board.step"
        done = cli.run(["pcb", "export", "step", "--force", "--subst-models", "-o", str(out), str(pcb)],
                       timeout=BOARD_TIMEOUT_S)
        if done.returncode != 0 or not out.is_file():
            lines = [line for line in (done.stderr or done.stdout or "").splitlines() if line.strip()]
            raise RuntimeError(lines[-1] if lines else f"kicad-cli exited {done.returncode}")
        target.parent.mkdir(parents=True, exist_ok=True)
        out.replace(target)
    return target


class StepExportMixin:
    def request_step_export(self, caller: Caller, system_id: str) -> dict:
        """``POST …/step``: queue an export at the current version, or join the one running (§25)."""
        from app.services.job_service import jobs

        with self._tx() as store:
            system = self._system(store, system_id, caller)
            current = store.get_step_export(system_id)
        version = int(system["version"])
        if current and current["state"] == "running" and int(current["version"]) == version and current["job_id"]:
            return {"jobId": current["job_id"]}
        job = jobs.enqueue(STEP_JOB_KIND, {"systemId": system_id, "role": caller.role, "email": caller.email},
                           worker_pool="prism", artifact_key=f"system-step:{system_id}:{version}",
                           requested_by=caller.email, resources={"prism_worker": 1})
        job_id = job.get("job_id") if isinstance(job, dict) else getattr(job, "job_id", None)
        with self._tx() as store:
            store.record_step_export(system_id, version=version, state="running", job_id=job_id)
        return {"jobId": job_id}

    def step_export(self, caller: Caller, system_id: str) -> dict:
        """``GET …/step``: the latest export (§25)."""
        with self._tx() as store:
            self._system(store, system_id, caller)
            row = store.get_step_export(system_id)
        if row is None:
            return {"systemId": system_id, "state": "none", "version": None, "createdAt": None, "sizeBytes": None,
                    "skipped": [], "jobId": None, "error": None}
        return {"systemId": system_id, "state": row["state"], "version": int(row["version"]),
                "createdAt": row["created_at"].isoformat() if row.get("created_at") else None,
                "sizeBytes": row["size_bytes"], "skipped": list(row["skipped"] or []), "jobId": row["job_id"],
                "error": row["error"]}

    def step_export_file(self, caller: Caller, system_id: str) -> tuple[Path, str]:
        """``GET …/step/file``: the ready export's path and download name, when the reader may see it all."""
        with self._tx() as store:
            system = self._system(store, system_id, caller)
            row = store.get_step_export(system_id)
            projects = list(row["projects"] or []) if row else []
            access = visibility.project_access(store.conn, projects, caller.role) if projects else {}
        if row is None or row["state"] != "ready" or not row["path"] or not Path(row["path"]).is_file():
            raise NotFound("No STEP export is ready")
        if any(not access.get(project, {}).get("visible") for project in projects):
            raise Conflict("This export holds boards you cannot see; export it again")
        name = re.sub(r"[^\w.-]+", "_", str(system["name"])).strip("_") or system_id
        return Path(row["path"]), f"{name}-v{int(row['version'])}.step"

    def run_step_export(self, system_id: str, caller: Caller, job_id: Optional[str] = None) -> dict:
        """Compose and write the system's STEP with ``caller``'s access."""
        started = time.perf_counter()
        with self._tx(consistent=True) as store:
            system = self._system(store, system_id, caller)
            version = int(system["version"])
            root, boards, skipped = self._step_tree(store, system, caller)
        projects = sorted({project.id for _leaf, _path, _label, project, _commit in boards})
        try:
            unique = {(project.id, commit): (project, commit) for _leaf, _path, _label, project, commit in boards}

            def export(key: tuple[str, str]) -> Any:
                try:
                    return board_step(*unique[key])
                except Exception as error:  # one board's failure leaves the rest exported
                    logger.warning("STEP export of %s@%s failed: %s", key[0], key[1], error)
                    return error

            with ThreadPoolExecutor(max_workers=PARALLEL_BOARDS) as pool:
                exported = dict(zip(unique, pool.map(export, unique)))
            for leaf, path, label, project, commit in boards:
                found = exported[(project.id, commit)]
                if isinstance(found, Exception):
                    skipped.append({"occurrence": path, "label": label, "reason": "export_failed",
                                    "detail": str(found)[-300:]})
                else:
                    leaf.step = found
            _prune(root)
            target = _step_root() / "systems" / f"{system_id}.step"
            step_assembly.write(root, target)
        except Exception as error:
            with self._tx() as store:
                store.record_step_export(system_id, version=version, state="failed", job_id=job_id,
                                         skipped=skipped, projects=projects, error=str(error)[-500:])
            raise
        size = target.stat().st_size
        with self._tx() as store:
            store.record_step_export(system_id, version=version, state="ready", job_id=job_id, path=str(target),
                                     size_bytes=size, skipped=skipped, projects=projects)
        return {"version": version, "sizeBytes": size, "skipped": skipped,
                "seconds": round(time.perf_counter() - started, 1)}

    def _step_tree(self, store: SystemStore, system: dict, caller: Caller):
        """The product tree (§25) with its board leaves still to be exported: ``(root, boards, skipped)``,
        each board ``(leaf, occurrence path, label, project, commit)``. A restricted occurrence, and
        everything under it, is left out."""
        from app.services.catalog.models import alignment_matrix

        system_id = system["id"]
        tree = self._tree(store, system_id)
        shown = {o["path"]: o for o in self._hierarchy_view(store, caller, system_id, tree)["occurrences"]}
        level = self._net_level(store, system_id, tree)
        placement, extents = self._placement(store, system_id, tree, level)
        interface_of, _component_of = self._occurrence_lookups(store, extents)
        root = step_assembly.Assembly(str(system["name"]))
        nodes: dict[str, step_assembly.Assembly] = {"": root}
        boards: list[tuple] = []
        skipped: list[dict] = []
        cut: list[str] = []
        for occurrence in tree.occurrences:
            label = occurrence.display_path
            parent = nodes.get(occurrence.path.rsplit("/", 1)[0])
            if parent is None or any(occurrence.path.startswith(f"{c}/") for c in cut):
                continue  # under a restricted subsystem
            if shown.get(occurrence.path, {}).get("restricted"):
                cut.append(occurrence.path)
                skipped.append({"occurrence": occurrence.path, "label": label, "reason": "restricted"})
                continue
            local = poses_module.matrix(placement["placed"][occurrence.path])
            name = occurrence.labels[-1]
            if occurrence.kind == "assembly":
                node = step_assembly.Assembly(name, matrix=local)
                parent.children.append(node)
                nodes[occurrence.path] = node
                continue
            if occurrence.kind == "board":
                box = placement["local"].get(occurrence.path)
                project = self._load_project(occurrence.project_id) if occurrence.project_id else None
                if project is None or not occurrence.baseline_commit:
                    skipped.append({"occurrence": occurrence.path, "label": label, "reason": "restricted"})
                    continue
                product = f"{getattr(project, 'name', None) or project.id} @ {occurrence.baseline_commit[:7]}"
                leaf = step_assembly.Leaf(name, None, _shifted(local, self._step_mid_plane(caller, occurrence, box)),
                                          product=product)
                boards.append((leaf, occurrence.path, label, project, occurrence.baseline_commit))
                parent.children.append(leaf)
                continue
            model = (interface_of(occurrence) or {}).get("model")
            step: Optional[Path] = None
            if model:
                try:
                    step = self._catalog().model_step_path(model["glbKey"])
                except Exception:
                    logger.debug("No STEP for %s", model["glbKey"], exc_info=True)
            if step is None or not step.is_file():
                skipped.append({"occurrence": occurrence.path, "label": label, "reason": "no_model"})
                continue
            parent.children.append(step_assembly.Leaf(name, step, _multiply(local, alignment_matrix(model["alignment"])),
                                                      product=name))
        root.children += self._step_harnesses(store, (tree, level, placement, extents), cut, skipped)
        return root, boards, skipped

    def _step_harnesses(self, store: SystemStore, placed: tuple, cut: list[str], skipped: list[dict]) -> list:
        """Every level's routed harnesses as tubes in the system's frame (§25), as the System 3D view
        draws them. A harness of a restricted subsystem, or with an end on one, is skipped."""
        def hidden(path: Optional[str]) -> bool:
            return bool(path) and any(path == c or path.startswith(f"{c}/") for c in cut)

        routes, _matrices = self._harness_routes(store, placed, root_only=False)
        tubes = []
        for harness, routed in routes:
            name = harness["name"] or harness["id"]
            label = f"{harness['level']}/{name}" if harness["level"] else name
            if hidden(harness["level"]) or any(hidden(end.get("occurrence")) for end in harness["ends"]):
                skipped.append({"occurrence": f"harness:{harness['level']}:{harness['id']}", "label": label,
                                "reason": "restricted"})
                continue
            segments = [(curve["samplesMm"], float(curve["diameterMm"])) for curve in routed["curves"]
                        if curve["wires"] and curve["diameterMm"] > 0]
            parts: list = [step_assembly.Tube("Bundle", segments)] if segments else []
            parts += self._step_housings(harness, routed)
            if parts:
                tubes.append(step_assembly.Assembly(f"Harness {label}", parts))
        if not tubes:
            return []
        return [step_assembly.Assembly("Harnesses", tubes)]

    def _step_housings(self, harness: dict, routed: dict) -> list:
        """Each posed end's housing as the System 3D view draws it (§20.17): the part's STEP at the
        end's mating frame · the model's alignment, else the proxy box the view draws."""
        from app.services.catalog.models import alignment_matrix

        leaves: list = []
        for end in harness["ends"]:
            posed, housing = routed["ends"].get(end["id"]), end.get("housing")
            if not posed:
                continue
            name = f"{end.get('reference') or end['id']} housing"
            mating = poses_module.matrix(posed["pose"])
            step: Optional[Path] = None
            if housing:
                try:
                    step = self._catalog().model_step_path(housing["glbKey"])
                except Exception:
                    logger.debug("No STEP for housing %s", housing["glbKey"], exc_info=True)
            if step is not None and step.is_file():
                leaves.append(step_assembly.Leaf(name, step, _multiply(mating, alignment_matrix(housing["alignment"]))))
                continue
            box = _proxy_box(end, float(posed["depthMm"]))
            if box:
                leaves.append(step_assembly.Block(name, *box, matrix=mating))
        return leaves

    def _step_mid_plane(self, caller: Caller, occurrence: Any, box: Optional[dict]) -> float:
        """The z that takes the board's STEP (bottom face at 0) to its frame (§25): the 3D bundle's
        own mid-plane when the bundle is ready, else half the placement box's thickness."""
        try:
            asset = self._scene_asset(caller, occurrence.project_id, occurrence.baseline_commit)
        except Exception:
            logger.debug("No 3D bundle frame for %s", occurrence.path, exc_info=True)
            asset = {}
        if asset.get("status") == "ready" and asset.get("bundleToBoard"):
            return float(asset["bundleToBoard"][14])
        return -((box["maxMm"][2] - box["minMm"][2]) / 2 if box else 0.0)


def _proxy_box(end: dict, depth_mm: float) -> Optional[tuple[list[float], list[float]]]:
    """The housing proxy the System 3D view draws (§20.17, ``harness-housings.ts`` ``proxyBox``): the
    connector body's x–y extent in the housing's mating frame (y flipped) and ``depth_mm`` behind it."""
    from app.services.systems.placement.frames import connector_frame
    from app.services.systems.placement.mate import _box_in, body_corners

    connector = end.get("connector")
    frame = connector_frame(connector["geometry"], connector.get("thicknessMm"), connector.get("stored")) \
        if connector else None
    if frame is None:
        return None
    lo, hi = _box_in(frame, body_corners(connector["geometry"], connector.get("thicknessMm")))
    return [lo[0], -hi[1], -depth_mm], [hi[0], -lo[1], 0.0]


def _prune(node: step_assembly.Assembly) -> bool:
    """Drop leaves with no STEP and the assemblies left empty; True when ``node`` still holds something."""
    node.children = [child for child in node.children
                     if isinstance(child, (step_assembly.Tube, step_assembly.Block))
                     or (child.step is not None if isinstance(child, step_assembly.Leaf) else _prune(child))]
    return bool(node.children)


def run_step_job(context: Any) -> Any:
    from app.services.job_runtime import JobResult
    from app.services.systems import service as system_service

    payload = context.payload
    caller = Caller(role=str(payload["role"]), email=str(payload["email"]))
    context.progress(stage="system-step", message="Exporting the system STEP", percent=5, force=True)
    try:
        result = system_service.service.run_step_export(str(payload["systemId"]), caller,
                                                        job_id=getattr(context, "job_id", None))
    except NotFound:
        return JobResult(message="The system no longer exists", details={})
    return JobResult(message=f"STEP export ready ({result['sizeBytes'] // 1_000_000} MB)", details=result)

