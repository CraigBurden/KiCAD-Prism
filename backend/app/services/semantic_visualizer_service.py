import datetime
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from pathlib import Path
from typing import Any, Callable, Dict, Optional

from app.core.config import settings
from app.services import path_config_service
from app.services.semantic_viewer_runtime import find_viewer_repo_root, pythonpath as semantic_viewer_pythonpath

SCHEMA = "prism.visualizer_bundle.a0"
GENERATOR_NAME = "kicad-prism-webgpu-3d"
GENERATOR_VERSION = "0.2.0"


def _compute_build_fingerprint() -> str:
    base = f"{GENERATOR_NAME}-{GENERATOR_VERSION}-semantic-gltf-a0-stackup-a2-prism-host-a0"
    try:
        from app.services.semantic_viewer_runtime import find_viewer_repo_root
        viewer_root = find_viewer_repo_root()
        inputs = [
            "pipeline/topology_compiler/__main__.py",
            "pipeline/topology_compiler/compiler.py",
            "pipeline/topology_compiler/pcb_extract.py",
            "pipeline/topology_compiler/semantic_gltf.py",
            "pipeline/topology_compiler/kicad_cli_export.py",
            "pipeline/topology_compiler/exporter.py",
            "package.json",
            "package-lock.json",
            "requirements-runtime.txt",
            "pyproject.toml",
            "viewer/app.js",
            "viewer/styles.css",
            "viewer/viewer.template.html",
        ]
        hasher = hashlib.sha256()
        hasher.update(base.encode("utf-8"))
        for rel_path in inputs:
            path = viewer_root / rel_path
            if path.is_file():
                hasher.update(path.read_bytes())
        return f"{base}_{hasher.hexdigest()[:8]}"
    except Exception:
        return base


BUILD_FINGERPRINT = _compute_build_fingerprint()
_BUILD_LOCKS: dict[str, threading.Lock] = {}
_BUILD_LOCKS_GUARD = threading.Lock()
SOURCE_SUFFIXES = {
    ".kicad_pro",
    ".kicad_sch",
    ".kicad_pcb",
    ".kicad_sym",
    ".kicad_mod",
    ".kicad_jobset",
    ".lib",
    ".dcm",
    ".wrl",
    ".step",
    ".stp",
    ".glb",
    ".json",
}
MESHOPT_LEVELS = {"low", "medium", "high"}
ARTIFACT_SEGMENT_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,191}$")


def semantic_store_root() -> Path:
    root = Path(settings.KICAD_PROJECTS_ROOT) / ".kicad-prism" / "semantic-visualizer"
    root.mkdir(parents=True, exist_ok=True)
    return root


def semantic_compiler_cache_root() -> Path:
    configured = os.environ.get("PRISM_SEMANTIC_VIEWER_CACHE", "").strip()
    root = Path(configured).expanduser() if configured else semantic_store_root() / ".cache"
    root.mkdir(parents=True, exist_ok=True)
    return root


def semantic_meshopt_level() -> str:
    level = os.environ.get("PRISM_SEMANTIC_GLTF_MESHOPT_LEVEL", "medium").strip().lower()
    return level if level in MESHOPT_LEVELS else "medium"


def find_kicad_project(project_path: str) -> Path:
    root = Path(project_path)
    config = path_config_service.get_path_config(project_path)
    configured = getattr(config, "project", None) or getattr(config, "project_file", None)
    if configured:
      candidate = (root / str(configured)).resolve()
      if candidate.is_file() and candidate.suffix == ".kicad_pro":
          return candidate
    direct = sorted(root.glob("*.kicad_pro"))
    if direct:
        return direct[0]
    nested = sorted(path for path in root.rglob("*.kicad_pro") if ".git" not in path.parts)
    if nested:
        return nested[0]
    raise ValueError(".kicad_pro file not found")


def source_fingerprint(project_path: str) -> str:
    return source_fingerprint_for_root(Path(project_path))


def source_fingerprint_for_root(project_root: Path) -> str:
    root = project_root.resolve()
    digest = hashlib.sha256()
    for path in sorted(root.rglob("*")):
        if not path.is_file() or ".git" in path.parts:
            continue
        if path.name == ".prism.json":
            continue
        if path.suffix.lower() not in SOURCE_SUFFIXES:
            continue
        rel = path.relative_to(root).as_posix()
        stat = path.stat()
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        if stat.st_size > 32 * 1024 * 1024:
            digest.update(f"large:{stat.st_size}:{int(stat.st_mtime_ns)}".encode("utf-8"))
        else:
            digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()[:32]


def source_fingerprint_for_project_file(project_file: Path) -> str:
    return source_fingerprint_for_root(project_file.resolve().parent)


def _artifact_segment(value: object, label: str) -> str:
    segment = str(value or "")
    if not ARTIFACT_SEGMENT_PATTERN.fullmatch(segment):
        raise ValueError(f"Invalid {label}")
    return segment


def bundle_dir(project_id: str, source_hash: str, build_hash: str = BUILD_FINGERPRINT) -> Path:
    project_segment = _artifact_segment(project_id, "project ID")
    source_segment = _artifact_segment(source_hash, "source revision key")
    build_segment = _artifact_segment(build_hash, "generator build")
    return semantic_store_root() / project_segment / source_segment / build_segment


def bundle_path(project_id: str, source_hash: str, build_hash: str = BUILD_FINGERPRINT) -> Path:
    return bundle_dir(project_id, source_hash, build_hash) / "bundle.json"


def bundle_url(project_id: str, source_hash: str, build_hash: str = BUILD_FINGERPRINT) -> str:
    return f"/api/projects/{project_id}/webgpu-3d/assets/{source_hash}/{build_hash}/bundle.json"


def _build_lock(project_id: str, source_hash: str) -> threading.Lock:
    key = f"{project_id}:{source_hash}"
    with _BUILD_LOCKS_GUARD:
        lock = _BUILD_LOCKS.get(key)
        if lock is None:
            lock = threading.Lock()
            _BUILD_LOCKS[key] = lock
        return lock


def get_status(project: Any, commit: str | None = None) -> Dict[str, Any]:
    if commit:
        return get_status_for_commit(project, commit)
    current_source = source_fingerprint(project.path)
    return get_status_for_source(project, current_source)


def get_status_for_source(
    project: Any,
    source_hash: str,
    *,
    commit: str | None = None,
    project_rel: str | None = None,
) -> Dict[str, Any]:
    current_bundle = bundle_path(project.id, source_hash)
    available = current_bundle.exists()
    status = "ready" if available else "missing"
    payload: Dict[str, Any] = {
        "schema": "prism.webgpu_3d_status_a0",
        "project_id": project.id,
        "source_fingerprint": source_hash,
        "sourceRevisionKey": source_hash,
        "build_fingerprint": BUILD_FINGERPRINT,
        "generator": {
            "name": GENERATOR_NAME,
            "version": GENERATOR_VERSION,
            "build": BUILD_FINGERPRINT,
        },
        "artifactScope": "3d-semantic",
        "status": status,
        "available": available,
        "bundle_url": bundle_url(project.id, source_hash) if available else None,
    }
    if commit:
        payload["commit"] = commit
    if project_rel:
        payload["project_path"] = project_rel
    if available:
        try:
            bundle = json.loads(current_bundle.read_text(encoding="utf-8"))
            payload["generated_at"] = bundle.get("generated_at")
            payload["capabilities"] = bundle.get("capabilities", {})
            _validate_bundle_assets(current_bundle.parent, bundle)
        except Exception as exc:
            payload["status"] = "invalid"
            payload["available"] = False
            payload["error"] = str(exc)
    return payload


def get_status_for_commit(project: Any, commit: str, project_rel: str | None = None) -> Dict[str, Any]:
    repo_root = _repo_root(Path(project.path))
    resolved_commit = _resolve_commit(repo_root, commit)
    rel = project_rel or _project_relative_path(repo_root, Path(project.path))
    indexed = lookup_commit_source(project.id, resolved_commit, rel)
    if indexed:
        indexed_status = get_status_for_source(project, indexed["source_fingerprint"], commit=resolved_commit, project_rel=rel)
        indexed_status["source_tree_fingerprint"] = indexed.get("source_tree_fingerprint")
        return indexed_status

    with tempfile.TemporaryDirectory(prefix="semantic-status-") as tmp:
        checkout = Path(tmp) / "checkout"
        _archive_checkout(repo_root, resolved_commit, checkout)
        project_file = checkout / rel
        if not project_file.is_file():
            raise ValueError(f"KiCad project file not found in commit {resolved_commit}: {rel}")
        source_hash = source_fingerprint_for_project_file(project_file)
        source_tree = git_project_tree_fingerprint(repo_root, resolved_commit, rel)
        record_commit_source(
            project.id,
            resolved_commit,
            rel,
            source_hash,
            source_tree_fingerprint=source_tree,
        )
        status = get_status_for_source(project, source_hash, commit=resolved_commit, project_rel=rel)
        status["source_tree_fingerprint"] = source_tree
        return status


def _validate_bundle_assets(root: Path, bundle: Dict[str, Any]) -> None:
    semantic_geometry_path = root / str(bundle.get("semantic_geometry") or "semantic_geometry.json")
    if not semantic_geometry_path.is_file():
        raise RuntimeError(f"Missing semantic geometry asset: {semantic_geometry_path.name}")
    semantic_geometry = json.loads(semantic_geometry_path.read_text(encoding="utf-8"))
    scene_manifest_rel = (
        semantic_geometry.get("semantic_gltf", {}).get("path")
        or semantic_geometry.get("assets", {}).get("scene_manifest")
    )
    if not scene_manifest_rel:
        return
    scene_manifest_path = root / str(scene_manifest_rel)
    if not scene_manifest_path.is_file():
        raise RuntimeError(f"Missing semantic GLTF manifest: {scene_manifest_rel}")
    scene_manifest = json.loads(scene_manifest_path.read_text(encoding="utf-8"))
    missing_tiles = [
        str(tile.get("path") or "")
        for tile in scene_manifest.get("tiles", [])
        if not (scene_manifest_path.parent / str(tile.get("path") or "")).is_file()
    ]
    if missing_tiles:
        preview = ", ".join(missing_tiles[:8])
        suffix = "" if len(missing_tiles) <= 8 else f", ... +{len(missing_tiles) - 8} more"
        raise RuntimeError(f"Semantic GLTF manifest references missing tile files: {preview}{suffix}")


def commit_index_path(project_id: str) -> Path:
    return semantic_store_root() / project_id / "commit-index.json"


def lookup_commit_source(project_id: str, commit: str, project_rel: str) -> dict[str, Any] | None:
    path = commit_index_path(project_id)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    key = _commit_index_key(commit, project_rel)
    entry = (payload.get("entries") or {}).get(key)
    if not isinstance(entry, dict):
        return None
    if entry.get("build_fingerprint") != BUILD_FINGERPRINT:
        return None
    source_hash = entry.get("source_fingerprint")
    if not isinstance(source_hash, str) or not source_hash:
        return None
    return entry


def record_commit_source(
    project_id: str,
    commit: str,
    project_rel: str,
    source_hash: str,
    *,
    source_tree_fingerprint: str | None = None,
) -> None:
    path = commit_index_path(project_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        payload = json.loads(path.read_text(encoding="utf-8")) if path.is_file() else {}
    except Exception:
        payload = {}
    if payload.get("schema") != "prism.semantic_visualizer_commit_index.a0":
        payload = {
            "schema": "prism.semantic_visualizer_commit_index.a0",
            "entries": {},
        }
    entries = payload.setdefault("entries", {})
    entries[_commit_index_key(commit, project_rel)] = {
        "commit": commit,
        "project_path": project_rel,
        "source_fingerprint": source_hash,
        "source_tree_fingerprint": source_tree_fingerprint,
        "build_fingerprint": BUILD_FINGERPRINT,
        "indexed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    tmp_path = path.with_suffix(".json.tmp")
    tmp_path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    tmp_path.replace(path)


def git_project_tree_fingerprint(repo_root: Path, commit: str, project_rel: str) -> str | None:
    project_dir = str(Path(project_rel).parent)
    target = f"{commit}:" if project_dir in {"", "."} else f"{commit}:{project_dir}"
    result = subprocess.run(
        ["git", "-C", str(repo_root), "rev-parse", target],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def _commit_index_key(commit: str, project_rel: str) -> str:
    return f"{commit}:{project_rel}:{BUILD_FINGERPRINT}"


def _run_preflight(viewer_root: Path, job: Dict[str, Any], persist: Callable[[], None]) -> None:
    job["stage"] = "preflight"
    job["message"] = "Checking semantic visualizer compiler runtime..."
    job["percent"] = max(int(job.get("percent") or 0), 10)
    checks = [
        ("viewer compiler", viewer_root / "pipeline" / "topology_compiler" / "__main__.py"),
        ("semantic GLB builder", viewer_root / "pipeline" / "topology_compiler" / "semantic_gltf.py"),
        ("semantic GLB node builder", viewer_root / "tools" / "semantic-gltf" / "build.mjs"),
        ("viewer package", viewer_root / "package.json"),
    ]
    for label, path in checks:
        if not path.is_file():
            raise RuntimeError(f"Missing {label}: {path}")
        job["logs"].append(f"Preflight OK: {label} -> {path}")

    binaries: Dict[str, str] = {}
    for binary in ("kicad-cli", "node", "npm"):
        resolved = shutil.which(binary)
        if not resolved:
            raise RuntimeError(f"Missing required executable: {binary}")
        binaries[binary] = resolved
        try:
            result = subprocess.run(
                [resolved, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=10,
                check=False,
            )
            version = (result.stdout or "").strip().splitlines()[0] if result.stdout else "version unavailable"
        except Exception as exc:
            version = f"version check failed: {type(exc).__name__}: {exc}"
        job["logs"].append(f"Preflight OK: {binary} -> {resolved} ({version})")

    node_modules = viewer_root / "node_modules"
    if not node_modules.is_dir():
        raise RuntimeError(
            f"Viewer node dependencies are missing at {node_modules}. "
            "In Docker, restart the backend so the semantic-viewer-node-modules volume can be initialized. "
            "Outside Docker, run npm ci in the kicad-prism-viewer checkout."
        )

    # Validate that all required glTF/polygon processing libraries are resolvable by Node.js
    required_node_pkgs = [
        "@gltf-transform/core",
        "@gltf-transform/extensions",
        "@gltf-transform/functions",
        "earcut",
        "meshoptimizer",
        "polygon-clipping"
    ]
    node_check_script = "; ".join(f"require.resolve('{pkg}')" for pkg in required_node_pkgs)
    node_result = subprocess.run(
        [
            binaries["node"],
            "-e",
            node_check_script,
        ],
        cwd=viewer_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=20,
        check=False,
    )
    if node_result.returncode != 0:
        raise RuntimeError(
            "Viewer Node dependencies are not valid for this runtime. "
            f"Failed to resolve core libraries. Output: {(node_result.stdout or '').strip()}"
        )
    job["logs"].append("Preflight OK: Node packages verified (@gltf-transform, earcut, meshoptimizer, polygon-clipping)")

    env = os.environ.copy()
    env["PYTHONPATH"] = semantic_viewer_pythonpath(viewer_root, os.environ.get("PYTHONPATH", ""))
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            (
                "import kicad_monkey; "
                "import kicad_cruncher; "
                "print('monkey:', getattr(kicad_monkey, '__file__', 'ok')); "
                "print('cruncher:', getattr(kicad_cruncher, '__file__', 'ok'))"
            ),
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
        timeout=20,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(
            "Missing required Python libraries: kicad_monkey or kicad_cruncher. "
            f"Output: {(result.stdout or '').strip()}"
        )
    job["logs"].append(f"Preflight OK: Python libraries -> {(result.stdout or '').strip()}")
    persist()


def _write_bundle(project: Any, output_dir: Path, source_hash: str) -> None:
    topology = output_dir / "topology.json"
    semantic_geometry = output_dir / "semantic_geometry.json"
    if not topology.exists() or not semantic_geometry.exists():
        raise ValueError("semantic visualizer build did not produce topology.json and semantic_geometry.json")
    bundle = {
        "schema": SCHEMA,
        "project_id": project.id,
        "project_name": project.display_name or project.name,
        "source_fingerprint": source_hash,
        "sourceRevisionKey": source_hash,
        "build_fingerprint": BUILD_FINGERPRINT,
        "generator": {
            "name": GENERATOR_NAME,
            "version": GENERATOR_VERSION,
            "build": BUILD_FINGERPRINT,
        },
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "topology": "topology.json",
        "semantic_geometry": "semantic_geometry.json",
        "asset_base": "./",
        "capabilities": {
            "pcb_3d": True,
            "pcb_layer_compare": True,
            "component_selection": True,
            "net_selection": True,
        },
    }
    (output_dir / "bundle.json").write_text(json.dumps(bundle, indent=2), encoding="utf-8")
    _validate_bundle_assets(output_dir, bundle)


def build_visualizer_bundle(
    project: Any,
    job: Dict[str, Any],
    persist: Callable[[], None],
    *,
    force: bool = False,
) -> Dict[str, Any]:
    project_file = find_kicad_project(project.path)
    source_hash = source_fingerprint_for_project_file(project_file)
    return build_visualizer_bundle_from_project_file(
        project,
        project_file,
        job,
        persist,
        force=force,
        source_hash=source_hash,
    )


def build_visualizer_bundle_for_commit(
    project: Any,
    commit: str,
    job: Dict[str, Any],
    persist: Callable[[], None],
    *,
    force: bool = False,
) -> Dict[str, Any]:
    repo_root = _repo_root(Path(project.path))
    resolved_commit = _resolve_commit(repo_root, commit)
    rel = _project_relative_path(repo_root, Path(project.path))
    indexed = lookup_commit_source(project.id, resolved_commit, rel)
    if indexed and not force:
        status = get_status_for_source(
            project,
            indexed["source_fingerprint"],
            commit=resolved_commit,
            project_rel=rel,
        )
        if status.get("available"):
            job["percent"] = 100
            job["message"] = "Semantic visualizer bundle is already current for selected ref"
            job["logs"].append(f"Using cached commit bundle: {status.get('bundle_url')}")
            persist()
            return status

    with tempfile.TemporaryDirectory(prefix="semantic-commit-") as tmp:
        checkout = Path(tmp) / "checkout"
        _archive_checkout(repo_root, resolved_commit, checkout)
        project_file = checkout / rel
        if not project_file.is_file():
            raise ValueError(f"KiCad project file not found in commit {resolved_commit}: {rel}")
        source_hash = source_fingerprint_for_project_file(project_file)
        source_tree = git_project_tree_fingerprint(repo_root, resolved_commit, rel)
        record_commit_source(
            project.id,
            resolved_commit,
            rel,
            source_hash,
            source_tree_fingerprint=source_tree,
        )
        status = build_visualizer_bundle_from_project_file(
            project,
            project_file,
            job,
            persist,
            force=force,
            source_hash=source_hash,
        )
        status["commit"] = resolved_commit
        status["project_path"] = rel
        status["source_tree_fingerprint"] = source_tree
        return status


def build_visualizer_bundle_from_project_file(
    project: Any,
    project_file: Path,
    job: Dict[str, Any],
    persist: Callable[[], None],
    *,
    force: bool = False,
    source_hash: str | None = None,
) -> Dict[str, Any]:
    project_file = project_file.resolve()
    if not project_file.is_file():
        raise ValueError(f"KiCad project file not found: {project_file}")
    resolved_source = source_hash or source_fingerprint_for_project_file(project_file)
    lock = _build_lock(str(project.id), resolved_source)
    acquired = lock.acquire(blocking=False)
    if not acquired:
        job["logs"].append("Another semantic visualizer generation job is already running for this project; waiting for it to finish")
        persist()
        lock.acquire()
    try:
        return _build_visualizer_bundle_locked(
            project,
            project_file,
            resolved_source,
            job,
            persist,
            force=force,
        )
    finally:
        lock.release()


def _build_visualizer_bundle_locked(
    project: Any,
    project_file: Path,
    source_hash: str,
    job: Dict[str, Any],
    persist: Callable[[], None],
    *,
    force: bool = False,
) -> Dict[str, Any]:
    target = bundle_dir(project.id, source_hash)
    existing = target / "bundle.json"
    if existing.exists() and not force:
        try:
            bundle = json.loads(existing.read_text(encoding="utf-8"))
            _validate_bundle_assets(existing.parent, bundle)
            job["percent"] = 100
            job["message"] = "Semantic visualizer bundle is already current"
            job["logs"].append(f"Using cached bundle: {existing}")
            persist()
            return get_status_for_source(project, source_hash)
        except Exception as exc:
            job["logs"].append(f"Cached semantic visualizer bundle is invalid and will be rebuilt: {type(exc).__name__}: {exc}")
            persist()

    job["stage"] = "locate-compiler"
    viewer_root = find_viewer_repo_root()
    _run_preflight(viewer_root, job, persist)

    job["stage"] = "discover-project"
    kicad_project = project_file
    job["logs"].append(f"Building semantic visualizer for {kicad_project}")
    job["logs"].append(f"Source fingerprint: {source_hash}")
    job["logs"].append(f"Viewer compiler: {viewer_root}")
    compiler_cache = semantic_compiler_cache_root()
    job["logs"].append(f"Compiler cache: {compiler_cache}")
    job["message"] = "Generating semantic viewer assets..."
    job["percent"] = 15
    persist()

    with tempfile.TemporaryDirectory(prefix="semantic-visualizer-") as tmp:
        job["stage"] = "compile-assets"
        output = Path(tmp) / "bundle"
        output.mkdir(parents=True, exist_ok=True)
        env = os.environ.copy()
        env["PYTHONPATH"] = semantic_viewer_pythonpath(viewer_root, os.environ.get("PYTHONPATH", ""))
        cmd = [
            sys.executable,
            "-m",
            "pipeline.topology_compiler",
            "from-project",
            str(kicad_project),
            "--output",
            str(output),
            "--cache-dir",
            str(compiler_cache),
            "--meshopt-level",
            semantic_meshopt_level(),
            "--scope",
            "3d",
        ]
        if force:
            cmd.append("--force-rebuild")
        job["logs"].append(f"Command: {' '.join(cmd)}")
        persist()
        process = subprocess.Popen(
            cmd,
            cwd=str(viewer_root),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert process.stdout is not None
        for line in process.stdout:
            line = line.strip()
            if line:
                job["logs"].append(line)
                persist()
        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f"semantic visualizer compiler exited with code {return_code}")

        _write_bundle(project, output, source_hash)
        job["stage"] = "publish-assets"
        job["message"] = "Publishing semantic viewer assets..."
        job["percent"] = 85
        persist()
        target.parent.mkdir(parents=True, exist_ok=True)
        staging = Path(
            tempfile.mkdtemp(
                prefix=f"{target.name}.staging.",
                dir=str(target.parent),
            )
        )
        if staging.exists():
            shutil.rmtree(staging)
        shutil.copytree(output, staging)
        bundle = json.loads((staging / "bundle.json").read_text(encoding="utf-8"))
        _validate_bundle_assets(staging, bundle)
        if target.exists():
            shutil.rmtree(target)
        staging.rename(target)
        published_bundle = json.loads((target / "bundle.json").read_text(encoding="utf-8"))
        _validate_bundle_assets(target, published_bundle)

    job["percent"] = 100
    job["message"] = "Semantic visualizer bundle generated"
    job["logs"].append(f"Published bundle: {target / 'bundle.json'}")
    persist()
    return get_status_for_source(project, source_hash)


def _repo_root(project_path: Path) -> Path:
    result = subprocess.run(
        ["git", "-C", str(project_path), "rev-parse", "--show-toplevel"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise ValueError(f"Project is not inside a git repository: {project_path}")
    return Path(result.stdout.strip()).resolve()


def _project_relative_path(repo_root: Path, project_path: Path) -> str:
    project_file = find_kicad_project(str(project_path))
    return project_file.resolve().relative_to(repo_root).as_posix()


def _resolve_commit(repo_root: Path, ref: str) -> str:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "rev-parse", "--verify", f"{ref}^{{commit}}"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise ValueError(f"Commit not found: {ref}")
    return result.stdout.strip()


def _archive_checkout(repo_root: Path, commit: str, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    p1 = subprocess.Popen(["git", "archive", "--format=tar", commit], cwd=str(repo_root), stdout=subprocess.PIPE)
    assert p1.stdout is not None
    p2 = subprocess.Popen(["tar", "-x", "-C", str(destination)], stdin=p1.stdout)
    p1.stdout.close()
    p2.wait()
    p1.wait()
    if p1.returncode != 0 or p2.returncode != 0:
        raise ValueError(f"Failed to archive checkout commit {commit}")
