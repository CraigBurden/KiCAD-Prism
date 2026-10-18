"""V2a step 1: today's 3D-tab mesh build (the webgpu_3d job's work), cold, one board.

usage: v2a_mesh_build.py <project.kicad_pro> <project_id> <out.json>
Runs inside a throwaway worker-image container. KICAD_PROJECTS_ROOT points at a
fresh directory, so nothing is cached (compiler cache included).
"""
import json, resource, sys, time
from pathlib import Path
from types import SimpleNamespace

project_file, project_id, out = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
from app.services import semantic_visualizer_service as svc  # noqa: E402

project = SimpleNamespace(id=project_id, path=str(project_file.parent), project_file=project_file.name, name=project_id, display_name=project_id)
job = {"logs": [], "perf": [], "percent": 0}
milestones = {}
start = time.perf_counter()
seen = [0]
def persist():
    events = job.get("performance", [])
    for event in events[seen[0]:]:
        milestones.setdefault(event["stage"], round(time.perf_counter() - start, 2))
    seen[0] = len(events)
result = svc.build_visualizer_bundle_from_project_file(project, project_file, job, persist, force=True)
wall = round(time.perf_counter() - start, 2)
root = svc.bundle_dir(project_id, result["source_fingerprint"], result["build_fingerprint"]) if "source_fingerprint" in result else None
sizes = {}
if root and root.is_dir():
    for f in root.rglob("*"):
        if f.is_file():
            sizes[str(f.relative_to(root))] = f.stat().st_size
peak_kb = max(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss, resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss)
doc = {"board": project_id, "wall_s": wall, "milestones_s": milestones, "peak_rss_mb": round(peak_kb / 1024),
       "bundle_bytes": sum(sizes.values()), "files": len(sizes), "largest": sorted(sizes.items(), key=lambda kv: -kv[1])[:12],
       "perf": job.get("performance"), "readiness": job.get("readiness"), "root": str(root)}
out.write_text(json.dumps(doc, indent=1, default=str))
print(json.dumps({k: doc[k] for k in ("board", "wall_s", "milestones_s", "peak_rss_mb", "bundle_bytes", "files")}))
