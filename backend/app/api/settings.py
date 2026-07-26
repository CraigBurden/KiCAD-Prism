import asyncio
from typing import List

from fastapi import APIRouter, Depends, HTTPException
import os
import subprocess
from pathlib import Path
from pydantic import BaseModel
import logging

from app.core.roles import ROLE_LABELS, Role, normalize_role
from app.core.security import AuthenticatedUser, require_admin
from app.services import (
    access_service,
    git_access_service,
    project_import_service,
    session_store_service,
)
from app.services.git_remote_url import RemoteUrlError, parse_remote_url
from app.services.workspace_service import workspace

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(dependencies=[Depends(require_admin)])

# In Docker, home is /root. SSH keys are usually in ~/.ssh
# We use resolve() to get the absolute path to avoid any ambiguity
SSH_DIR = (Path.home() / ".ssh").resolve()
PRIVATE_KEY = SSH_DIR / "id_ed25519"
PUBLIC_KEY = SSH_DIR / "id_ed25519.pub"

class SSHKeyResponse(BaseModel):
    exists: bool
    public_key: str | None = None
    # The fingerprint is what a forge shows beside an authorised key, so it is
    # how an operator confirms the key they pasted is the one Prism uses.
    fingerprint: str | None = None
    key_type: str | None = None
    comment: str | None = None
    created_at: str | None = None

class GenerateSSHKeyRequest(BaseModel):
    email: str = "kicad-prism@example.com"


class RoleAssignmentResponse(BaseModel):
    email: str
    role: Role
    source: str


class UpsertRoleRequest(BaseModel):
    role: str

@router.get("/ssh-key", response_model=SSHKeyResponse)
async def get_ssh_key():
    """Get the workspace machine-user key and its fingerprint."""
    info = await asyncio.to_thread(git_access_service.describe_key)
    return SSHKeyResponse(
        exists=info.exists,
        public_key=info.public_key,
        fingerprint=info.fingerprint,
        key_type=info.key_type,
        comment=info.comment,
        created_at=info.created_at,
    )

@router.post("/ssh-key/generate")
async def generate_ssh_key(request: GenerateSSHKeyRequest):
    """Generate a new Ed25519 SSH key."""
    logger.info(f"Starting SSH key generation for email: {request.email}")
    logger.info(f"SSH Directory: {SSH_DIR}")
    logger.info(f"Private Key Path: {PRIVATE_KEY}")
    logger.info(f"Public Key Path: {PUBLIC_KEY}")

    if PRIVATE_KEY.exists():
        logger.info("Existing private key found. Removing it.")
        try:
             os.remove(PRIVATE_KEY)
             if PUBLIC_KEY.exists():
                 os.remove(PUBLIC_KEY)
                 logger.info("Existing public key removed.")
        except OSError as e:
             logger.error(f"Failed to remove existing key: {e}")
             raise HTTPException(status_code=500, detail=f"Failed to remove existing key: {e}")
    
    # Ensure .ssh directory exists and has correct permissions
    try:
        if not SSH_DIR.exists():
            logger.info(f"Creating SSH directory: {SSH_DIR}")
            SSH_DIR.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"Setting permissions 0o700 on {SSH_DIR}")
        os.chmod(SSH_DIR, 0o700)
    except Exception as e:
        logger.error(f"Failed to create/chmod SSH directory: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to setup SSH directory: {str(e)}")
    
    try:
        # Generate key without passphrase (-N "")
        command = ["ssh-keygen", "-t", "ed25519", "-C", request.email, "-N", "", "-f", str(PRIVATE_KEY)]
        logger.info(f"Running command: {' '.join(command)}")
        
        subprocess.run(
            command,
            check=True,
            capture_output=True
        )
        logger.info("ssh-keygen command completed successfully.")
        
        # Ensure private key has correct permissions
        if PRIVATE_KEY.exists():
            logger.info(f"Setting permissions 0o600 on {PRIVATE_KEY}")
            os.chmod(PRIVATE_KEY, 0o600)
        else:
            logger.error("Private key file not found after generation!")
            raise HTTPException(status_code=500, detail="Key generation appeared to succeed but file is missing.")
        
        with open(PUBLIC_KEY, "r") as f:
            content = f.read().strip()
            logger.info("Public key read successfully returning result.")
            return {"success": True, "public_key": content}

    except subprocess.CalledProcessError as e:
        error_msg = e.stderr.decode() if e.stderr else "Unknown error"
        logger.error(f"ssh-keygen failed: {error_msg}")
        raise HTTPException(status_code=500, detail=f"Failed to generate SSH key: {error_msg}")
    except Exception as e:
        logger.error(f"An unexpected error occurred during key generation: {str(e)}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/git-access")
async def get_git_access():
    """Everything an operator needs to reason about Prism's Git access.

    The key, its fingerprint, which hosts are pinned, and the live access state
    of every imported repository — so a broken credential is visible here rather
    than at the moment someone tries to sync.
    """
    key = git_access_service.describe_key()
    repositories = await asyncio.to_thread(_repository_access_rows)
    return {
        "key": {
            "exists": key.exists,
            "public_key": key.public_key,
            "fingerprint": key.fingerprint,
            "key_type": key.key_type,
            "comment": key.comment,
            "created_at": key.created_at,
        },
        "trusted_hosts": git_access_service.trusted_hosts(),
        "repositories": repositories,
    }


def _repository_access_rows() -> List[dict]:
    rows: List[dict] = []
    for repository in workspace.get_repositories():
        url = str(repository.get("url") or "")
        entry = {
            "id": repository.get("id"),
            "name": repository.get("name"),
            "url": url,
            "last_synced_at": repository.get("last_synced_at"),
            "host": None,
            "host_trusted": None,
            "guidance": None,
        }
        try:
            parsed = parse_remote_url(url)
        except Exception:
            entry["guidance"] = "This repository's URL predates URL validation and cannot be parsed."
            rows.append(entry)
            continue
        guidance = git_access_service.guidance_for(parsed)
        entry.update(
            {
                "host": parsed.host,
                # Checked without a network call; the live check is on demand,
                # so opening Settings does not fan out to every Git server.
                "host_trusted": git_access_service.is_host_trusted(parsed.host)
                if parsed.scheme == "ssh"
                else None,
                "forge": guidance.forge,
                "deploy_key_url": guidance.deploy_key_url,
                "guidance": guidance.instructions,
            }
        )
        rows.append(entry)
    return rows


class CheckAccessRequest(BaseModel):
    url: str


@router.post("/git-access/check")
async def check_git_access(request: CheckAccessRequest):
    """Ask a Git server whether Prism may read one repository, right now."""
    try:
        parsed = parse_remote_url(request.url, project_import_service.remote_url_policy())
    except RemoteUrlError as error:
        raise HTTPException(status_code=400, detail=str(error))

    result = await asyncio.to_thread(
        git_access_service.check_repository_access,
        parsed,
        git_env=project_import_service.git_env(),
    )
    guidance = git_access_service.guidance_for(parsed)
    return {
        "reachable": result.reachable,
        "authorized": result.authorized,
        "reason": result.reason,
        "message": result.message,
        "default_branch": result.default_branch,
        "forge": guidance.forge,
        "deploy_key_url": guidance.deploy_key_url,
        "instructions": guidance.instructions,
    }


class HostKeyRequest(BaseModel):
    host: str
    port: int = 22


@router.post("/git-access/host-keys/scan")
async def scan_git_host_key(request: HostKeyRequest):
    """Fetch a host's SSH key so its fingerprint can be checked before trusting.

    Scanning and trusting are separate on purpose: a scan is exactly as
    trustworthy as the network it ran over, so an administrator has to compare
    the fingerprint against what the Git server's operator publishes.
    """
    try:
        candidate = await asyncio.to_thread(
            git_access_service.scan_host_key, request.host, request.port
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error))
    return {
        "host": candidate.host,
        "fingerprints": candidate.fingerprints,
        "already_trusted": git_access_service.is_host_trusted(candidate.host),
    }


@router.post("/git-access/host-keys/trust")
async def trust_git_host_key(request: HostKeyRequest):
    """Pin a host key the administrator has verified."""
    try:
        candidate = await asyncio.to_thread(
            git_access_service.scan_host_key, request.host, request.port
        )
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error))
    await asyncio.to_thread(git_access_service.trust_host, candidate)
    return {"host": candidate.host, "fingerprints": candidate.fingerprints, "trusted": True}


@router.delete("/git-access/host-keys/{host}")
async def forget_git_host_key(host: str):
    try:
        removed = await asyncio.to_thread(git_access_service.forget_host, host)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    return {"host": host, "removed": removed}


@router.get("/access/users", response_model=List[RoleAssignmentResponse])
async def list_access_users():
    return [RoleAssignmentResponse(**item) for item in access_service.list_role_assignments()]


@router.put("/access/users/{email}", response_model=RoleAssignmentResponse)
async def upsert_access_user(
    email: str,
    request: UpsertRoleRequest,
    user: AuthenticatedUser = Depends(require_admin),
):
    normalized_role = normalize_role(request.role)
    if normalized_role is None:
        valid_roles = ", ".join(f"{role} ({label})" for role, label in ROLE_LABELS.items())
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {valid_roles}.")

    try:
        assignment = access_service.upsert_user_role(email=email, role=normalized_role, updated_by=user.email)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    return RoleAssignmentResponse(**assignment)


@router.delete("/access/users/{email}")
async def delete_access_user(email: str, user: AuthenticatedUser = Depends(require_admin)):
    try:
        deleted = access_service.delete_user_role(email=email, updated_by=user.email)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))

    if not deleted:
        raise HTTPException(status_code=404, detail="User role assignment not found")

    # Withdrawing access must end access now, not when the browser cookie expires.
    revoked = session_store_service.revoke_sessions_for_email(email, reason=f"access_revoked:{user.email}")

    return {"deleted": email.strip().lower(), "sessions_revoked": revoked}
