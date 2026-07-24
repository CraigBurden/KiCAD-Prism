"""
Project Import Service for KiCAD Prism

Handles Type-1 (single project) and Type-2 (multiple projects) imports.
"""
import os
import hashlib
import json
import mimetypes
import subprocess
import shutil
import tempfile
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import dataclass
from git import Repo, RemoteProgress
from app.services import project_service, path_config_service
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


@dataclass
class AnalysisResult:
    """Result of analyzing a repository for import."""
    repo_name: str
    repo_url: str
    import_type: str  # "type1" or "type2"
    projects: List[DiscoveredProject]
    temp_path: Optional[str] = None  # For cleanup after analysis


# Global job store for import operations
jobs: Dict[str, dict] = {}


def _persist_job(job_id: str) -> None:
    job = jobs.get(job_id)
    if job:
        workspace.update_job(
            job_id,
            status=job.get("status", "running"),
            message=job.get("message", ""),
            percent=job.get("percent", 0),
            **{
                key: value
                for key, value in job.items()
                if key not in {"job_id", "status", "message", "percent"}
            },
        )


def has_ssh_key() -> bool:
    """Check if a default SSH key exists."""
    ssh_dir = Path.home() / ".ssh"
    key_types = ["id_ed25519", "id_rsa"]
    for kt in key_types:
        if (ssh_dir / kt).exists():
            return True
    return False


class CloneProgress(RemoteProgress):
    """Git progress callback for clone operations."""
    
    def __init__(self, job_id: str):
        super().__init__()
        self.job_id = job_id
    
    def update(self, op_code, cur_count, max_count=None, message=''):
        if self.job_id in jobs:
            job = jobs[self.job_id]
            percent = 0
            if max_count and max_count > 0:
                percent = min((cur_count / max_count) * 100, 99)
            job['percent'] = int(percent)
            job['message'] = message or f"Cloning... {int(percent)}%"
            if message:
                job['logs'].append(f"[GIT] {message}")
            _persist_job(self.job_id)


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


def analyze_repository(repo_url: str) -> AnalysisResult:
    """
    Analyze a repository to determine import type and discover projects.
    Performs a shallow clone to a temporary directory.
    """
    repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
    
    # Create temp directory for analysis
    temp_dir = tempfile.mkdtemp(prefix="kicad_analyze_")
    clone_path = Path(temp_dir) / repo_name
    
    try:
        # Shallow clone for analysis
        env = os.environ.copy()
        env['GIT_TERMINAL_PROMPT'] = '0'
        # Trust On First Use (TOFU) for SSH
        env['GIT_SSH_COMMAND'] = 'ssh -o StrictHostKeyChecking=accept-new'
        
        repo = Repo.clone_from(
            repo_url,
            str(clone_path),
            depth=1,
            single_branch=True,
            no_checkout=True,
            filter='blob:none',
            env=env
        )
        
        # Discover projects from tree
        projects = discover_projects_from_repo(repo)
        
        # Determine import type
        # Type-1: Single .kicad_pro at root (relative_path == ".")
        # Type-2: Multiple projects or project not at root
        import_type = "type2"
        if len(projects) == 1 and projects[0].relative_path == ".":
            import_type = "type1"
        
        return AnalysisResult(
            repo_name=repo_name,
            repo_url=repo_url,
            import_type=import_type,
            projects=projects,
            temp_path=temp_dir
        )
        
    except Exception:
        # Cleanup on error
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
        raise


def _run_analyze_job(job_id: str, repo_url: str):
    """
    Background job: Analyze repository.
    """
    job = jobs[job_id]
    
    try:
        job['logs'].append(f"Analyzing {repo_url}...")
        _persist_job(job_id)
        
        repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
        temp_dir = tempfile.mkdtemp(prefix="kicad_analyze_")
        clone_path = Path(temp_dir) / repo_name
        
        job['logs'].append("Cloning repository (blobless/no-checkout)...")
        
        env = os.environ.copy()
        env['GIT_TERMINAL_PROMPT'] = '0'
        env['GIT_SSH_COMMAND'] = 'ssh -o StrictHostKeyChecking=accept-new'
        
        repo = Repo.clone_from(
            repo_url,
            str(clone_path),
            depth=1,
            single_branch=True,
            no_checkout=True,
            filter='blob:none',
            progress=CloneProgress(job_id),
            env=env
        )
        
        job['logs'].append("Discovering KiCAD projects from tree...")
        _persist_job(job_id)
        projects = discover_projects_from_repo(repo)
        
        import_type = "type2"
        if len(projects) == 1 and projects[0].relative_path == ".":
            import_type = "type1"
            
        job['logs'].append(f"Found {len(projects)} project(s). Type: {import_type}")
        
        # Store result in job
        job['result'] = {
            "repo_name": repo_name,
            "repo_url": repo_url,
            "import_type": import_type,
            "projects": [
                {
                    "name": p.name,
                    "relative_path": p.relative_path,
                    "has_schematic": p.has_schematic,
                    "has_pcb": p.has_pcb
                }
                for p in projects
            ],
            # We don't pass temp_path here as we'll cleanup immediately or handled differently
        }
        
        # Cleanup temp dir immediately since we have the metadata
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)
            
        job['status'] = 'completed'
        job['percent'] = 100
        job['message'] = "Analysis complete."
        _persist_job(job_id)
        
    except Exception as e:
        job['status'] = 'failed'
        job['error'] = str(e)
        job['logs'].append(f"Error: {str(e)}")
        _persist_job(job_id)


def cleanup_analysis_temp(analysis: AnalysisResult):
    """Clean up temporary directory used for analysis."""
    if analysis.temp_path and os.path.exists(analysis.temp_path):
        shutil.rmtree(analysis.temp_path, ignore_errors=True)


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



def _run_import_job(job_id: str, repo_url: str, import_type: str,
                    selected_paths: Optional[List[str]] = None):
    """
    Background job: Clone repository and register projects.
    """
    job = jobs[job_id]
    
    cloned_in_job = False
    try:
        # Extract repo name
        repo_name = repo_url.rstrip('/').split('/')[-1].replace('.git', '')
        
        # Determine target directory based on type
        if import_type == "type1":
            base_path = Path(project_service.PROJECTS_ROOT) / "type1"
        else:
            base_path = Path(project_service.PROJECTS_ROOT) / "type2"
        
        target_path = base_path / repo_name
        target_path_abs = str(target_path.resolve())
        
        # Check if already exists via workspace DB
        existing_repo = workspace.get_repository_by_url(repo_url)
        if existing_repo:
            job['status'] = 'failed'
            job['error'] = f"Repository '{repo_name}' is already imported"
            job['logs'].append(f"Error: Repository with URL {repo_url} already exists")
            _persist_job(job_id)
            return

        adopted_checkout = False
        if target_path.exists():
            try:
                existing_checkout = Repo(str(target_path))
                remotes = [remote.url for remote in existing_checkout.remotes]
                normalize = lambda value: value.strip().rstrip('/').removesuffix('.git').casefold()
                if normalize(repo_url) not in {normalize(value) for value in remotes}:
                    raise ValueError(
                        f"Existing checkout at {target_path} belongs to a different remote"
                    )
                adopted_checkout = True
                job['logs'].append(f"Adopting existing checkout: {target_path}")
                _persist_job(job_id)
            except Exception as error:
                job['status'] = 'failed'
                job['error'] = str(error)
                job['logs'].append(f"Cannot adopt existing checkout: {error}")
                _persist_job(job_id)
                return
        
        # Ensure base directory exists
        base_path.mkdir(parents=True, exist_ok=True)
        
        # Clone repository
        if not adopted_checkout:
            job['logs'].append(f"Cloning {repo_url}...")
            _persist_job(job_id)
            env = os.environ.copy()
            env['GIT_TERMINAL_PROMPT'] = '0'
            # Trust On First Use (TOFU) for SSH
            env['GIT_SSH_COMMAND'] = 'ssh -o StrictHostKeyChecking=accept-new'

            Repo.clone_from(
                repo_url,
                str(target_path),
                progress=CloneProgress(job_id),
                env=env
            )
            cloned_in_job = True

        job['logs'].append("Checkout ready. Registering projects...")
        _persist_job(job_id)
        
        # Register repository in workspace DB
        repo_id = workspace.register_repository(
            name=repo_name,
            url=repo_url,
            clone_path_abs=str(target_path),
            import_type='single' if import_type == 'type1' else 'multi',
        )
        
        imported_ids = []
        
        if import_type == "type1":
            # Generate thumbnail before resolving paths
            generate_thumbnail_for_project(str(target_path), job['logs'])
            cached = resolve_cached_paths(str(target_path))
            project_id = workspace.register_project(
                repo_id=repo_id,
                name=repo_name,
                relative_path='.',
                description=f"Project {repo_name}",
                **cached,
            )
            imported_ids.append(project_id)
            job['logs'].append(f"Registered Type-1 project: {project_id}")
            
        else:
            # Type-2: Register selected subprojects
            if not selected_paths:
                job['status'] = 'failed'
                job['error'] = "No projects selected for Type-2 import"
                _persist_job(job_id)
                return
            
            for rel_path in selected_paths:
                full_project_path = target_path / rel_path
                # Generate thumbnail before resolving paths
                generate_thumbnail_for_project(str(full_project_path), job['logs'])
                pro_files = list(full_project_path.glob("*.kicad_pro"))
                board_name = pro_files[0].stem if pro_files else os.path.basename(rel_path)
                cached = resolve_cached_paths(str(full_project_path))
                project_id = workspace.register_project(
                    repo_id=repo_id,
                    name=board_name,
                    relative_path=rel_path,
                    description=f"{repo_name} / {board_name}",
                    **cached,
                )
                imported_ids.append(project_id)
                job['logs'].append(f"Registered Type-2 subproject: {project_id}")
        
        job['project_ids'] = imported_ids
        job['status'] = 'completed'
        job['percent'] = 100
        job['message'] = f"Imported {len(imported_ids)} project(s)"
        job['logs'].append("Import completed successfully.")
        _persist_job(job_id)
        
    except Exception as e:
        job['status'] = 'failed'
        job['error'] = str(e)
        job['logs'].append(f"Error: {str(e)}")
        _persist_job(job_id)
        
        # Cleanup on failure
        if cloned_in_job and target_path.exists():
            try:
                shutil.rmtree(target_path)
            except:
                pass


def start_import_job(repo_url: str, import_type: str, 
                     selected_paths: Optional[List[str]] = None) -> str:
    """
    Start an asynchronous import job.
    Returns job ID for polling.
    """
    if import_type not in {"type1", "type2"}:
        raise ValueError("Import type must be type1 or type2")
    normalized_url = repo_url.strip().rstrip("/")
    active_key = hashlib.sha256(
        json.dumps(
            {
                "repo_url": normalized_url,
                "import_type": import_type,
                "selected_paths": sorted(selected_paths or []),
            },
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
    ).hexdigest()
    queued = v3_jobs.enqueue(
        "project_import",
        {
            "repo_url": normalized_url,
            "import_type": import_type,
            "selected_paths": list(selected_paths or []),
        },
        worker_pool="prism",
        artifact_key=active_key,
        requested_by="project-import",
        max_attempts=1,
        resources={"prism_worker": 1, "import": 1},
        locks=[
            {
                "key": f"repository-import:{hashlib.sha256(normalized_url.encode('utf-8')).hexdigest()}",
                "mode": "write",
            }
        ],
    )
    return str(queued["job_id"])


def start_analyze_job(repo_url: str) -> str:
    """
    Start an asynchronous analysis job.
    Returns job ID.
    """
    normalized_url = repo_url.strip().rstrip("/")
    active_key = hashlib.sha256(normalized_url.encode("utf-8")).hexdigest()
    queued = v3_jobs.enqueue(
        "project_analyze",
        {"repo_url": normalized_url},
        worker_pool="prism",
        artifact_key=active_key,
        requested_by="project-import",
        max_attempts=2,
        resources={"prism_worker": 1, "import": 1},
        locks=[
            {
                "key": f"repository-import:{active_key}",
                "mode": "read",
            }
        ],
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
    # Check import jobs first
    job = jobs.get(job_id)
    if job:
        return job
    
    return workspace.get_job(job_id)


def run_project_analyze_job_v3(context: JobContext) -> JobResult:
    repo_url = str(context.payload["repo_url"])
    repo_name = repo_url.rstrip("/").split("/")[-1].removesuffix(".git")
    temp_dir = tempfile.mkdtemp(prefix="kicad_analyze_")
    clone_path = Path(temp_dir) / repo_name
    context.progress(
        stage="clone-metadata",
        message="Cloning repository metadata",
        percent=0,
        force=True,
    )
    try:
        env = os.environ.copy()
        env["GIT_TERMINAL_PROMPT"] = "0"
        env["GIT_SSH_COMMAND"] = "ssh -o StrictHostKeyChecking=accept-new"
        repo = Repo.clone_from(
            repo_url,
            str(clone_path),
            depth=1,
            single_branch=True,
            no_checkout=True,
            filter="blob:none",
            progress=V3CloneProgress(context, stage="clone-metadata"),
            env=env,
        )
        context.check_cancelled()
        context.progress(
            stage="discover-projects",
            message="Discovering KiCad projects",
            percent=85,
            force=True,
        )
        projects = discover_projects_from_repo(repo)
        import_type = (
            "type1"
            if len(projects) == 1 and projects[0].relative_path == "."
            else "type2"
        )
        result = {
            "repo_name": repo_name,
            "repo_url": repo_url,
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
        return JobResult(
            message="Analysis complete",
            details={"result": result},
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def run_project_import_job_v3(context: JobContext) -> JobResult:
    payload = context.payload
    repo_url = str(payload["repo_url"])
    import_type = str(payload["import_type"])
    selected_paths = [str(path) for path in payload.get("selected_paths") or []]
    repo_name = repo_url.rstrip("/").split("/")[-1].removesuffix(".git")
    base_path = (
        Path(project_service.PROJECTS_ROOT) / "type1"
        if import_type == "type1"
        else Path(project_service.PROJECTS_ROOT) / "type2"
    )
    target_path = base_path / repo_name
    cloned_in_job = False
    thumbnail_logs: list[str] = []

    context.progress(
        stage="validate-import",
        message="Validating repository import",
        percent=0,
        force=True,
    )
    existing_repo = workspace.get_repository_by_url(repo_url)
    if existing_repo:
        raise ValueError(f"Repository '{repo_name}' is already imported")

    try:
        adopted_checkout = False
        if target_path.exists():
            existing_checkout = Repo(str(target_path))

            def normalize(value: str) -> str:
                return value.strip().rstrip("/").removesuffix(".git").casefold()

            remotes = {normalize(remote.url) for remote in existing_checkout.remotes}
            if normalize(repo_url) not in remotes:
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
                percent=1,
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
            if not selected_paths:
                raise ValueError("No projects selected for Type-2 import")
            for index, relative_path in enumerate(selected_paths):
                context.check_cancelled()
                full_project_path = target_path / relative_path
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
