from typing import List

from fastapi import APIRouter, Depends, HTTPException
import os
import subprocess
from pathlib import Path
from pydantic import BaseModel
import logging

from app.core.roles import ROLE_LABELS, Role, normalize_role
from app.core.security import AuthenticatedUser, require_admin
from app.services import access_service

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
    """Get the current SSH public key if it exists."""
    logger.info(f"Checking for SSH public key at: {PUBLIC_KEY}")
    if not PUBLIC_KEY.exists():
        logger.info("SSH public key not found.")
        return {"exists": False, "public_key": None}
    
    try:
        with open(PUBLIC_KEY, "r") as f:
            key_content = f.read().strip()
            logger.info("SSH public key found and read successfully.")
            return {"exists": True, "public_key": key_content}
    except Exception as e:
        logger.error(f"Error reading public key: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error reading public key: {str(e)}")

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

    return {"deleted": email.strip().lower()}
