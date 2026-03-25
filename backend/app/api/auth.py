"""
Authentication API endpoints.

Handles Google OAuth login and domain validation.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
import requests
from app.core.config import settings
from app.core.roles import Role
from app.core.security import AuthenticatedUser, get_current_user, guest_user
from app.core.session import clear_session_cookie, create_session_token, set_session_cookie
from app.services import access_service

router = APIRouter()
logger = logging.getLogger(__name__)


class LoginRequest(BaseModel):
    """Request body for Google auth code exchange."""
    code: str = Field(min_length=1)
    redirectUri: str = Field(min_length=1)


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
    google_client_id: str
    workspace_name: str


def _guest_user_session() -> UserSession:
    guest = guest_user()
    return UserSession(email=guest.email, name=guest.name, picture=guest.picture, role=guest.role)


def _validate_allowed_user(email: str) -> None:
    normalized_email = email.strip().casefold()
    if not normalized_email:
        raise HTTPException(status_code=401, detail="Invalid token")

    allowed_users = {user.strip().casefold() for user in settings.ALLOWED_USERS if user.strip()}
    if allowed_users and normalized_email not in allowed_users:
        raise HTTPException(
            status_code=403,
            detail="Access denied. Your email is not in the allowed users list.",
        )

    allowed_domains = {domain.strip().casefold() for domain in settings.ALLOWED_DOMAINS if domain.strip()}
    if allowed_domains:
        domain = normalized_email.split("@")[-1]
        if domain not in allowed_domains:
            raise HTTPException(
                status_code=403,
                detail="Access denied. Your email domain is not in the allowed domains list.",
            )


def _require_session_secret() -> None:
    if settings.AUTH_ENABLED and not settings.SESSION_SECRET:
        raise HTTPException(status_code=500, detail="SESSION_SECRET is not configured")


def _require_google_oauth_credentials() -> None:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth client credentials are not configured")


@router.get("/config", response_model=AuthConfig)
async def get_auth_config():
    """
    Get authentication configuration for the frontend.
    
    This allows the frontend to know whether to show the login page
    or go directly to the gallery.
    """
    return AuthConfig(
        auth_enabled=settings.AUTH_ENABLED,
        dev_mode=settings.DEV_MODE,
        google_client_id=settings.GOOGLE_CLIENT_ID,
        workspace_name=settings.WORKSPACE_NAME,
    )


@router.post("/login", response_model=UserSession)
async def login(request: LoginRequest, response: Response):
    """
    Authenticate user with Google OAuth authorization code.
    
    Exchanges the code with Google, checks domain restrictions, and returns user session data.
    """
    # If auth is disabled, this endpoint shouldn't normally be called,
    # but handle gracefully just in case
    if not settings.AUTH_ENABLED:
        return _guest_user_session()

    _require_session_secret()
    _require_google_oauth_credentials()
    
    try:
        token_response = requests.post(
            "https://oauth2.googleapis.com/token",
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": request.code,
                "grant_type": "authorization_code",
                "redirect_uri": request.redirectUri,
            },
            timeout=10,
        )
        token_payload = token_response.json()

        access_token = str(token_payload.get("access_token") or "").strip()
        if not access_token:
            details = token_payload.get("error_description") or token_payload.get("error") or "Failed to exchange code"
            raise HTTPException(status_code=401, detail=str(details))

        userinfo_response = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        userinfo_response.raise_for_status()
        userinfo = userinfo_response.json()

        email = str(userinfo.get("email") or "").strip()
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")

        _validate_allowed_user(email)
        access_service.ensure_default_viewer_assignment(email)
        role = access_service.resolve_user_role(email)
        if not role:
            raise HTTPException(
                status_code=403,
                detail="Access denied. No role assignment found for your account.",
            )

        name = str(userinfo.get("name") or email.split("@")[0])
        picture = str(userinfo.get("picture") or "")

        token = create_session_token(
            email=email,
            name=name,
            picture=picture,
            role=role,
        )
        set_session_cookie(response, token)

        return UserSession(
            email=email,
            name=name,
            picture=picture,
            role=role,
        )

    except requests.RequestException:
        logger.exception("Authentication error during Google OAuth code exchange")
        raise HTTPException(status_code=502, detail="Failed to contact Google authentication services")
    except HTTPException:
        # Re-raise HTTP exceptions (like 403 for domain validation)
        raise
    except Exception:
        # Catch-all for unexpected errors
        logger.exception("Authentication error during Google OAuth login")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")


@router.get("/me", response_model=UserSession)
async def get_current_session_user(user: AuthenticatedUser = Depends(get_current_user)):
    return UserSession(
        email=user.email,
        name=user.name,
        picture=user.picture,
        role=user.role,
    )


@router.post("/logout")
async def logout(response: Response):
    clear_session_cookie(response)
    return {"success": True}
