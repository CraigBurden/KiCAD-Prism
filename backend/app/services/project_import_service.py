"""
Project Import Service for KiCAD Prism

Handles Type-1 (single project) and Type-2 (multiple projects) imports.
"""
import os
import hashlib
import mimetypes
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional
from dataclasses import dataclass
from git import Repo, RemoteProgress
from app.core.config import settings
from app.services import project_service, path_config_service
from app.services.git_remote_url import ParsedRemote, RemoteUrlPolicy, parse_remote_url
from app.services.job_runtime import JobContext, JobResult
from app.services.job_service import jobs as v3_jobs
from app.services.workspace_service import workspace


@dataclass
class DiscoveredProject:
    """A KiCAD project discovered within a repository."""
    name: str
    relative_path: str
    full_path: str
    has_schematic: bool
    has_pcb: bool


def remote_url_policy() -> RemoteUrlPolicy:
    """Build the clone-URL policy for this deployment."""
    return RemoteUrlPolicy.build(
        allowed_hosts=settings.IMPORT_ALLOWED_HOSTS,
        allow_insecure_http=settings.IMPORT_ALLOW_INSECURE_HTTP,
    )


def find_existing_repository(parsed: ParsedRemote) -> Optional[dict]:
    """Find an already-imported repository that resolves to the same remote.

    Compares canonical identities rather than URL strings, so importing
    ``git@github.com:org/repo.git`` after ``https://github.com/org/repo`` is
    recognised as the same repository instead of cloning it twice.
    """
    target = parsed.dedup_key
    for repository in workspace.get_repositories():
        stored = str(repository.get("url") or "")
        if not stored:
            continue
        try:
            if parse_remote_url(stored).dedup_key == target:
                return repository
        except Exception:
            # A row predating URL validation should not block a valid import.
            if stored.strip() == parsed.url:
                return repository
    return None


class V3CloneProgress(RemoteProgress):
    def __init__(self, context: JobContext, *, stage: str) -> None:
        super().__init__()
        self.context = context
        self.stage = stage

    def update(self, op_code, cur_count, max_count=None, message=""):
        self.context.check_cancelled()
        percent = 0.0
        if max_count and max_count > 0:
            percent = min((float(cur_count) / float(max_count)) * 75.0, 75.0)
        if message:
            print(f"[git] {message}", flush=True)
        self.context.progress(
            stage=self.stage,
            message=message or f"Cloning repository ({percent:.0f}%)",
            percent=percent,
        )


def is_excluded_directory(dir_name: str) -> bool:
    """Check if directory should be excluded from project discovery."""
    excluded = {
        'archive', 'archived', 'old', 'backup', 'backups',
        'obsolete', 'deprecated', 'trash', '.git', '__pycache__',
        'node_modules', '.venv', 'venv', '.env'
    }
    return dir_name.lower() in excluded or dir_name.startswith('.')


def discover_projects_from_repo(repo: Repo) -> List[DiscoveredProject]:
    """
    Discover KiCAD projects by inspecting the Git tree directly (no-checkout).
    Returns list of DiscoveredProject.
    """
    # Get all files in the repo recursively
    try:
        all_files = repo.git.ls_tree('-r', 'HEAD', '--name-only').splitlines()
    except Exception:
        # Fallback for empty repos or other issues
        return []
    
    # Map directory -> list of filenames
    dir_map = {}
    for fpath in all_files:
        p = Path(fpath)
        # Handle relative path correctly (relative to repo root)
        dir_path = p.parent.as_posix() # Use as_posix for consistency
        filename = p.name
        
        if dir_path not in dir_map:
            dir_map[dir_path] = []
        dir_map[dir_path].append(filename)
        
    projects = []
    for dir_path, filenames in dir_map.items():
        # Skip if any part of the path is excluded
        should_exclude = False
        parts = dir_path.split('/')
        if dir_path != ".":
            for part in parts:
                if is_excluded_directory(part):
                    should_exclude = True
                    break
        if should_exclude:
            continue
            
        pro_files = [f for f in filenames if f.endswith(".kicad_pro")]
        for pro_file in pro_files:
            has_sch = any(f.endswith(".kicad_sch") for f in filenames)
            has_pcb = any(f.endswith(".kicad_pcb") for f in filenames)
            
            projects.append(DiscoveredProject(
                name=Path(pro_file).stem,
                relative_path=dir_path if dir_path != "." else ".",
                full_path="", # No checkout path
                has_schematic=has_sch,
                has_pcb=has_pcb
            ))
            
    # Sort by path depth (shallow first) then by name
    projects.sort(key=lambda p: (0 if p.relative_path == "." else len(p.relative_path.split('/')), p.name.lower()))
    
    return projects


def resolve_cached_paths(project_path: str) -> dict:
    """Resolve and return cached path info for a project directory."""
    try:
        resolved = path_config_service.resolve_paths(project_path)
        sch = resolved.schematic
        pcb = resolved.pcb
        thumb = resolved.thumbnail_dir
        jobset = resolved.jobset_path
        # Make paths relative to project_path
        def _rel(abs_path):
            if not abs_path:
                return None
            try:
                return os.path.relpath(abs_path, project_path)
            except ValueError:
                return None
        # Thumbnail: resolve to first image if directory
        thumb_rel = None
        thumbnail_digest = None
        thumbnail_media_type = None
        thumbnail_size_bytes = None
        if thumb:
            if os.path.isfile(thumb):
                thumb_rel = _rel(thumb)
            elif os.path.isdir(thumb):
                for f in sorted(os.listdir(thumb)):
                    if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')):
                        thumb_rel = _rel(os.path.join(thumb, f))
                        break
        if thumb_rel:
            thumbnail_file = Path(project_path) / thumb_rel
            if thumbnail_file.is_file():
                thumbnail_digest = hashlib.sha256(thumbnail_file.read_bytes()).hexdigest()
                thumbnail_media_type = (
                    mimetypes.guess_type(thumbnail_file.name)[0]
                    or "application/octet-stream"
                )
                thumbnail_size_bytes = thumbnail_file.stat().st_size
        design_dir = resolved.design_outputs_dir
        has_3d = False
        has_ibom = False
        if design_dir and os.path.isdir(design_dir):
            for f in os.listdir(design_dir):
                fl = f.lower()
                if fl.endswith(('.glb', '.step', '.stp')):
                    has_3d = True
                if 'ibom' in fl and fl.endswith('.html'):
                    has_ibom = True
            model_dir = os.path.join(design_dir, '3DModel')
            if os.path.isdir(model_dir):
                for f in os.listdir(model_dir):
                    if f.lower().endswith(('.glb', '.step', '.stp')):
                        has_3d = True
        return {
            'schematic_rel': _rel(sch),
            'pcb_rel': _rel(pcb),
            'thumbnail_rel': thumb_rel,
            'thumbnail_digest': thumbnail_digest,
            'thumbnail_media_type': thumbnail_media_type,
            'thumbnail_size_bytes': thumbnail_size_bytes,
            'jobset_rel': _rel(jobset),
            'has_3d_model': has_3d,
            'has_ibom': has_ibom,
        }
    except Exception:
        return {}


def generate_thumbnail_for_project(project_path: str, logs_list: Optional[List[str]] = None) -> bool:
    """
    Find the main .kicad_pcb file and run kicad-cli pcb render to generate a thumbnail.
    """
    try:
        from PIL import Image

        resolved = path_config_service.resolve_paths(project_path)
        pcb_file = resolved.pcb
        if not pcb_file or not os.path.exists(pcb_file):
            if logs_list is not None:
                logs_list.append(f"No .kicad_pcb file found to generate thumbnail for {project_path}")
            return False
        
        # Check standard paths for kicad-cli
        cli_path = "kicad-cli"
        # Check environment variable
        for var in ("KICAD_CLI_PATH", "KICAD_CLI"):
            val = os.environ.get(var, "").strip()
            if val and os.path.exists(val):
                cli_path = val
                break
        else:
            # Check standard Mac path
            mac_path = "/Applications/KiCad/KiCad.app/Contents/MacOS/kicad-cli"
            if os.path.exists(mac_path):
                cli_path = mac_path
            else:
                # Check PATH
                which_cli = shutil.which("kicad-cli")
                if which_cli:
                    cli_path = which_cli

        if logs_list is not None:
            logs_list.append(f"Generating thumbnail using {cli_path} for PCB: {pcb_file}")

        # Create assets/thumbnail directory
        thumbnail_dir = Path(project_path) / "assets" / "thumbnail"
        thumbnail_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.NamedTemporaryFile(
            dir=thumbnail_dir,
            prefix=".thumbnail-render-",
            suffix=".png",
            delete=False,
        ) as temporary_render:
            render_path = Path(temporary_render.name)
        
        cmd = [
            cli_path,
            "pcb",
            "render",
            "--quality", "high",
            "--floor",
            "--perspective",
            "--rotate", "-45,0,45",
            "--width", "800",
            "--height", "600",
            "-o", str(render_path),
            pcb_file
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=120,
            check=False
        )
        
        if result.returncode != 0:
            if logs_list is not None:
                logs_list.append(f"kicad-cli render failed (code {result.returncode}): {result.stderr[:400]}")
            render_path.unlink(missing_ok=True)
            return False

        with tempfile.NamedTemporaryFile(
            dir=thumbnail_dir,
            prefix=".thumbnail-encode-",
            suffix=".webp",
            delete=False,
        ) as temporary_webp:
            webp_path = Path(temporary_webp.name)
        try:
            with Image.open(render_path) as image:
                image.thumbnail((640, 480), Image.Resampling.LANCZOS)
                for quality in (78, 68, 58):
                    image.save(
                        webp_path,
                        format="WEBP",
                        quality=quality,
                        method=6,
                    )
                    if webp_path.stat().st_size <= 250 * 1024:
                        break
            encoded = webp_path.read_bytes()
            digest = hashlib.sha256(encoded).hexdigest()
            output_path = thumbnail_dir / f"thumbnail.{digest[:16]}.webp"
            os.replace(webp_path, output_path)
            for stale in thumbnail_dir.glob("thumbnail.*.webp"):
                if stale != output_path:
                    stale.unlink(missing_ok=True)
            (thumbnail_dir / "thumbnail.png").unlink(missing_ok=True)
        finally:
            render_path.unlink(missing_ok=True)
            webp_path.unlink(missing_ok=True)

        if logs_list is not None:
            logs_list.append(
                f"Successfully generated WebP thumbnail at {output_path} "
                f"({output_path.stat().st_size} bytes)"
            )
        return True
        
    except Exception as e:
        if logs_list is not None:
            logs_list.append(f"Exception during thumbnail generation: {e}")
        return False



def _repository_lock_key(parsed: ParsedRemote) -> str:
    """Lock on repository identity, so the two spellings of one remote serialise."""
    return f"repository-import:{hashlib.sha256(parsed.dedup_key.encode('utf-8')).hexdigest()}"


def start_import_job(repo_url: str, import_type: str,
                     selected_paths: Optional[List[str]] = None) -> str:
    """
    Start an asynchronous import job.
    Returns job ID for polling.

    ``import_type`` and ``selected_paths`` are client-supplied hints only. The
    job re-derives both from the repository before anything is written to disk.
    """
    if import_type not in {"type1", "type2"}:
        raise ValueError("Import type must be type1 or type2")
    parsed = parse_remote_url(repo_url, remote_url_policy())
    paths = sorted(selected_paths or [])
    active_key = hashlib.sha256(
        "\x1f".join([parsed.dedup_key, import_type, *paths]).encode("utf-8")
    ).hexdigest()
    queued = v3_jobs.enqueue(
        "project_import",
        {
            "repo_url": parsed.url,
            "import_type": import_type,
            "selected_paths": list(selected_paths or []),
        },
        worker_pool="prism",
        artifact_key=active_key,
        requested_by="project-import",
        max_attempts=1,
        resources={"prism_worker": 1, "import": 1},
        locks=[{"key": _repository_lock_key(parsed), "mode": "write"}],
    )
    return str(queued["job_id"])


def start_analyze_job(repo_url: str) -> str:
    """
    Start an asynchronous analysis job.
    Returns job ID.
    """
    parsed = parse_remote_url(repo_url, remote_url_policy())
    active_key = hashlib.sha256(parsed.dedup_key.encode("utf-8")).hexdigest()
    queued = v3_jobs.enqueue(
        "project_analyze",
        {"repo_url": parsed.url},
        worker_pool="prism",
        artifact_key=active_key,
        requested_by="project-import",
        max_attempts=2,
        resources={"prism_worker": 1, "import": 1},
        locks=[{"key": _repository_lock_key(parsed), "mode": "read"}],
    )
    return str(queued["job_id"])


def get_job_status(job_id: str) -> Optional[dict]:
    """Get the current status of an import or workflow job."""
    v3_job = v3_jobs.get(job_id)
    if v3_job:
        metadata = dict(v3_job.get("result_metadata") or {})
        return {
            **v3_job,
            **metadata,
            "type": v3_job.get("kind"),
            "error": v3_job.get("error_message") or None,
            "logs": [],
        }
    return workspace.get_job(job_id)


def run_project_analyze_job_v3(context: JobContext) -> JobResult:
    parsed = parse_remote_url(str(context.payload["repo_url"]), remote_url_policy())
    projects, import_type = _discover_remote_projects(
        context, parsed, stage="clone-metadata", percent_ceiling=85.0
    )
    result = {
        "repo_name": parsed.repo_name,
        "repo_url": parsed.url,
        "import_type": import_type,
        "projects": [
            {
                "name": project.name,
                "relative_path": project.relative_path,
                "has_schematic": project.has_schematic,
                "has_pcb": project.has_pcb,
            }
            for project in projects
        ],
    }
    print(
        f"Found {len(projects)} project(s); classified repository as {import_type}",
        flush=True,
    )
    return JobResult(message="Analysis complete", details={"result": result})


def classify_import_type(projects: List[DiscoveredProject]) -> str:
    """A single project at the repository root is Type-1; anything else Type-2."""
    if len(projects) == 1 and projects[0].relative_path == ".":
        return "type1"
    return "type2"


def _discover_remote_projects(
    context: JobContext,
    parsed: ParsedRemote,
    *,
    stage: str,
    percent_ceiling: float,
) -> tuple[List[DiscoveredProject], str]:
    """Clone just enough of a remote to enumerate the KiCad projects inside it.

    Blobless, single-branch, no-checkout: the tree listing is all that is
    needed, so this stays cheap even against a repository with gigabytes of
    history.
    """
    temp_dir = tempfile.mkdtemp(prefix="kicad_analyze_")
    clone_path = Path(temp_dir) / parsed.repo_name
    context.progress(
        stage=stage,
        message="Cloning repository metadata",
        percent=0,
        force=True,
    )
    try:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["GIT_SSH_COMMAND"] = "ssh -o StrictHostKeyChecking=accept-new"
        repo = Repo.clone_from(
            parsed.url,
            str(clone_path),
            depth=1,
            single_branch=True,
            no_checkout=True,
            filter="blob:none",
            progress=V3CloneProgress(context, stage=stage),
            env=env,
        )
        context.check_cancelled()
        context.progress(
            stage="discover-projects",
            message="Discovering KiCad projects",
            percent=percent_ceiling,
            force=True,
        )
        projects = discover_projects_from_repo(repo)
        return projects, classify_import_type(projects)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def run_project_import_job_v3(context: JobContext) -> JobResult:
    payload = context.payload
    parsed = parse_remote_url(str(payload["repo_url"]), remote_url_policy())
    repo_url = parsed.url
    repo_name = parsed.repo_name
    requested_paths = [str(path) for path in payload.get("selected_paths") or []]
    cloned_in_job = False
    thumbnail_logs: list[str] = []

    context.progress(
        stage="validate-import",
        message="Validating repository import",
        percent=0,
        force=True,
    )
    existing_repo = find_existing_repository(parsed)
    if existing_repo:
        raise ValueError(
            f"Repository '{existing_repo.get('name') or repo_name}' is already imported"
        )

    # The client's import_type and selected_paths are hints. Re-derive both from
    # the repository itself before choosing a target directory, so a crafted
    # request cannot pick the on-disk layout or escape the checkout with a
    # relative path like "../../etc".
    discovered, import_type = _discover_remote_projects(
        context, parsed, stage="validate-import", percent_ceiling=8.0
    )
    if not discovered:
        raise ValueError(
            f"No KiCad projects found in '{repo_name}'. "
            "Prism looks for a directory containing a .kicad_pro file."
        )

    discovered_paths = {project.relative_path for project in discovered}
    if import_type == "type1":
        selected_paths = ["."]
    else:
        selected_paths = [path for path in requested_paths if path in discovered_paths]
        unknown = sorted(set(requested_paths) - discovered_paths)
        if unknown:
            raise ValueError(
                "Selected paths are not KiCad projects in this repository: "
                + ", ".join(unknown)
            )
        if not selected_paths:
            raise ValueError("No projects selected for Type-2 import")

    base_path = Path(project_service.PROJECTS_ROOT) / import_type
    target_path = base_path / repo_name

    try:
        adopted_checkout = False
        if target_path.exists():
            existing_checkout = Repo(str(target_path))
            remotes = set()
            for remote in existing_checkout.remotes:
                try:
                    remotes.add(parse_remote_url(remote.url).dedup_key)
                except Exception:
                    continue
            if parsed.dedup_key not in remotes:
                raise ValueError(
                    f"Existing checkout at {target_path} belongs to a different remote"
                )
            adopted_checkout = True
            print(f"Adopting existing checkout: {target_path}", flush=True)

        base_path.mkdir(parents=True, exist_ok=True)
        if not adopted_checkout:
            context.progress(
                stage="clone-repository",
                message="Cloning repository",
                percent=10,
                force=True,
            )
            env = os.environ.copy()
            env["GIT_TERMINAL_PROMPT"] = "0"
            env["GIT_SSH_COMMAND"] = "ssh -o StrictHostKeyChecking=accept-new"
            Repo.clone_from(
                repo_url,
                str(target_path),
                progress=V3CloneProgress(context, stage="clone-repository"),
                env=env,
            )
            cloned_in_job = True

        context.check_cancelled()
        context.progress(
            stage="register-projects",
            message="Registering imported projects",
            percent=80,
            force=True,
        )
        repo_id = workspace.register_repository(
            name=repo_name,
            url=repo_url,
            clone_path_abs=str(target_path),
            import_type="single" if import_type == "type1" else "multi",
        )
        imported_ids: list[str] = []
        if import_type == "type1":
            generate_thumbnail_for_project(str(target_path), thumbnail_logs)
            cached = resolve_cached_paths(str(target_path))
            imported_ids.append(
                workspace.register_project(
                    repo_id=repo_id,
                    name=repo_name,
                    relative_path=".",
                    description=f"Project {repo_name}",
                    **cached,
                )
            )
        else:
            checkout_root = target_path.resolve()
            for index, relative_path in enumerate(selected_paths):
                context.check_cancelled()
                full_project_path = target_path / relative_path
                # Paths are already validated against discovery; this keeps the
                # guarantee local to the place that does the filesystem write.
                if not full_project_path.resolve().is_relative_to(checkout_root):
                    raise ValueError(f"Project path escapes the checkout: {relative_path}")
                generate_thumbnail_for_project(str(full_project_path), thumbnail_logs)
                pro_files = sorted(full_project_path.glob("*.kicad_pro"))
                board_name = (
                    pro_files[0].stem if pro_files else os.path.basename(relative_path)
                )
                cached = resolve_cached_paths(str(full_project_path))
                imported_ids.append(
                    workspace.register_project(
                        repo_id=repo_id,
                        name=board_name,
                        relative_path=relative_path,
                        description=f"{repo_name} / {board_name}",
                        **cached,
                    )
                )
                context.progress(
                    stage="register-projects",
                    message=f"Registered {index + 1} of {len(selected_paths)} projects",
                    percent=80 + (15 * (index + 1) / len(selected_paths)),
                )
        for line in thumbnail_logs:
            print(line, flush=True)
        return JobResult(
            message=f"Imported {len(imported_ids)} project(s)",
            details={
                "project_ids": imported_ids,
                "repo_id": repo_id,
                "repo_url": repo_url,
                "import_type": import_type,
            },
        )
    except Exception:
        if cloned_in_job:
            shutil.rmtree(target_path, ignore_errors=True)
        raise


def start_sync_job(project_id: str, *, requested_by: str = "") -> str:
    row = workspace.get_project_by_id(project_id)
    if not row:
        raise ValueError("Project not found")
    repository_id = str(row.get("repo_id") or "")
    active_key = hashlib.sha256(f"sync:{project_id}".encode("utf-8")).hexdigest()
    queued = v3_jobs.enqueue(
        "project_sync",
        {"project_id": project_id},
        worker_pool="prism",
        artifact_key=active_key,
        project_id=project_id,
        repository_id=repository_id or None,
        requested_by=requested_by,
        max_attempts=2,
        resources={"prism_worker": 1, "import": 1},
        locks=(
            [{"key": f"repository:{repository_id}", "mode": "write"}]
            if repository_id
            else [{"key": f"project:{project_id}", "mode": "write"}]
        ),
    )
    return str(queued["job_id"])


def run_project_sync_job_v3(context: JobContext) -> JobResult:
    project_id = str(context.payload["project_id"])
    context.progress(
        stage="fetch",
        message="Fetching repository updates",
        percent=5,
        force=True,
    )
    result = sync_project(project_id)
    context.check_cancelled()
    if result.get("status") == "error":
        raise RuntimeError(str(result.get("message") or "Project sync failed"))
    from app.services import file_service

    file_service.invalidate_file_listing_cache()
    return JobResult(
        message=str(result.get("message") or "Sync completed"),
        details=dict(result),
    )


def sync_project(project_id: str) -> dict:
    """
    Sync a project with its remote repository.
    For Type-1: pulls the project repo.
    For Type-2: pulls the parent repo.
    """
    row = workspace.get_project_by_id(project_id)
    if not row:
        return {"status": "error", "message": "Project not found"}

    import_type = row.get('import_type') or 'single'
    sync_path = row.get('parent_repo_path') if import_type == 'multi' else row.get('path')

    if not sync_path or not os.path.exists(sync_path):
        return {"status": "error", "message": f"Project path not found: {sync_path}"}

    try:
        repo = Repo(sync_path)
        origin = repo.remote('origin')
        
        env = os.environ.copy()
        env['GIT_TERMINAL_PROMPT'] = '0'
        env['GIT_SSH_COMMAND'] = 'ssh -o StrictHostKeyChecking=accept-new'
        
        fetch_info = origin.fetch(env=env)
        origin.pull(env=env)

        # Refresh cached paths after sync
        path_config_service.clear_config_cache()
        project_path = row.get('path', '')
        if project_path and os.path.isdir(project_path):
            # Generate/refresh thumbnail on sync
            generate_thumbnail_for_project(project_path)
            cached = resolve_cached_paths(project_path)
            workspace.update_project(project_id, **cached)

        # Update repo last_synced_at
        workspace.update_repository_synced(row.get('repo_id', ''))
        
        return {
            "status": "success",
            "message": f"Synced {len(fetch_info)} ref(s)",
            "path": sync_path
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}
