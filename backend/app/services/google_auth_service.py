import logging
from dataclasses import dataclass

import requests
from fastapi import HTTPException

from app.core.config import settings
from app.core.roles import Role
from app.services import access_service

GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class GoogleUserProfile:
    email: str
    name: str
    picture: str


@dataclass(frozen=True)
class ResolvedSessionUser:
    email: str
    name: str
    picture: str
    role: Role


def _require_google_oauth_credentials() -> None:
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Google OAuth client credentials are not configured")


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


def _exchange_auth_code_for_access_token(code: str, redirect_uri: str) -> str:
    token_response = requests.post(
        GOOGLE_TOKEN_ENDPOINT,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        data={
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
        },
        timeout=10,
    )
    token_payload = token_response.json()

    access_token = str(token_payload.get("access_token") or "").strip()
    if access_token:
        return access_token

    details = token_payload.get("error_description") or token_payload.get("error") or "Failed to exchange code"
    raise HTTPException(status_code=401, detail=str(details))


def _fetch_google_user_profile(access_token: str) -> GoogleUserProfile:
    userinfo_response = requests.get(
        GOOGLE_USERINFO_ENDPOINT,
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    userinfo_response.raise_for_status()
    userinfo = userinfo_response.json()

    email = str(userinfo.get("email") or "").strip()
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token")

    return GoogleUserProfile(
        email=email,
        name=str(userinfo.get("name") or email.split("@")[0]),
        picture=str(userinfo.get("picture") or ""),
    )


def authenticate_google_oauth_code(code: str, redirect_uri: str) -> ResolvedSessionUser:
    _require_google_oauth_credentials()

    try:
        access_token = _exchange_auth_code_for_access_token(code=code, redirect_uri=redirect_uri)
        profile = _fetch_google_user_profile(access_token)
        _validate_allowed_user(profile.email)
        access_service.ensure_default_viewer_assignment(profile.email)

        role = access_service.resolve_user_role(profile.email)
        if not role:
            raise HTTPException(
                status_code=403,
                detail="Access denied. No role assignment found for your account.",
            )

        return ResolvedSessionUser(
            email=profile.email,
            name=profile.name,
            picture=profile.picture,
            role=role,
        )
    except requests.RequestException:
        logger.exception("Authentication error during Google OAuth code exchange")
        raise HTTPException(status_code=502, detail="Failed to contact Google authentication services")
