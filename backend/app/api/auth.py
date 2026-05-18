"""
Authentication API endpoints.

Handles OIDC login and session management.
"""

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from app.core.config import settings
from app.core.roles import Role
from app.core.security import AuthenticatedUser, get_current_user, guest_user
from app.core.session import clear_session_cookie, create_session_token, set_session_cookie
from app.services.auth_service import ResolvedSessionUser, authenticate_oidc_auth_code, oidc_public_config

router = APIRouter()


class LoginRequest(BaseModel):
    """Request body for OIDC auth code exchange."""
    code: str = Field(min_length=1)
    redirectUri: str = Field(min_length=1)
    nonce: str = ""


class UserSession(BaseModel):
    """User session data returned after successful login."""
    email: str
    name: str
    picture: str = ""
    role: Role


class AuthConfig(BaseModel):
    """Authentication configuration exposed to frontend."""
    auth_enabled: bool
    dev_mode: bool
    oidc_issuer_url: str = ""
    oidc_authorization_endpoint: str = ""
    oidc_client_id: str = ""
    oidc_scopes: str = ""
    oidc_provider_name: str = ""
    workspace_name: str


def _build_user_session(user: ResolvedSessionUser | AuthenticatedUser) -> UserSession:
    return UserSession(
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
    )


def _guest_user_session() -> UserSession:
    return _build_user_session(guest_user())


def _require_session_secret() -> None:
    if settings.AUTH_ENABLED and not settings.SESSION_SECRET:
        raise HTTPException(status_code=500, detail="SESSION_SECRET is not configured")


@router.get("/config", response_model=AuthConfig)
async def get_auth_config():
    """
    Get authentication configuration for the frontend.
    
    This allows the frontend to know whether to show the login page
    or go directly to the gallery.
    """
    oidc_config = oidc_public_config()
    return AuthConfig(
        auth_enabled=settings.AUTH_ENABLED,
        dev_mode=settings.DEV_MODE,
        oidc_issuer_url=oidc_config["issuer_url"],
        oidc_authorization_endpoint=oidc_config["authorization_endpoint"],
        oidc_client_id=oidc_config["client_id"],
        oidc_scopes=oidc_config["scopes"],
        oidc_provider_name=oidc_config["provider_name"],
        workspace_name=settings.WORKSPACE_NAME,
    )


@router.post("/login", response_model=UserSession)
async def login(request: LoginRequest, response: Response):
    """
    Authenticate user with an OIDC authorization code.
    
    Exchanges the code with the configured OIDC provider, checks access restrictions,
    and returns user session data.
    """
    # If auth is disabled, this endpoint shouldn't normally be called,
    # but handle gracefully just in case
    if not settings.AUTH_ENABLED:
        return _guest_user_session()

    _require_session_secret()
    session_user = authenticate_oidc_auth_code(
        code=request.code,
        redirect_uri=request.redirectUri,
        expected_nonce=request.nonce,
    )

    token = create_session_token(
        email=session_user.email,
        name=session_user.name,
        picture=session_user.picture,
        role=session_user.role,
    )
    set_session_cookie(response, token)

    return _build_user_session(session_user)


@router.get("/me", response_model=UserSession)
async def get_current_session_user(user: AuthenticatedUser = Depends(get_current_user)):
    return _build_user_session(user)


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"success": True}
