"""
Application configuration with environment variable support.

Configuration can be set via:
1. Environment variables
2. .env file in the backend directory

See .env.example for available configuration options.
"""
from pydantic import Field
from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ===========================================
    # Google OAuth Configuration
    # ===========================================
    GOOGLE_CLIENT_ID: str = Field(
        default="",
        description="OAuth Client ID from Google Cloud Console. Leave empty to skip authentication."
    )

    GOOGLE_CLIENT_SECRET: str = Field(
        default="",
        description="OAuth Client Secret from Google Cloud Console. Required for auth code exchange."
    )
    
    # ===========================================
    # Authentication & Access Control
    # ===========================================
    WORKSPACE_NAME: str = Field(
        default="KiCAD Prism",
        description="Display name shown to users when signing into this workspace."
    )

    # Explicitly enable/disable authentication. 
    # If not set, it's auto-determined by GOOGLE_CLIENT_ID and DEV_MODE.
    AUTH_ENABLED_OVERRIDE: bool = Field(
        default=True,
        alias="AUTH_ENABLED",
        description="Explicitly enable/disable authentication."
    )
    
    # Comma-separated list of allowed user emails
    ALLOWED_USERS_STR: str = Field(
        default="",
        description="Comma-separated list of allowed user emails"
    )

    # Comma-separated list of allowed email domains (legacy compatibility).
    ALLOWED_DOMAINS_STR: str = Field(
        default="",
        description="Comma-separated list of allowed email domains"
    )

    # Comma-separated list of bootstrap admin user emails.
    BOOTSTRAP_ADMIN_USERS_STR: str = Field(
        default="",
        description="Comma-separated list of admin user emails provisioned from env"
    )

    # Comma-separated list of email domains that receive implicit viewer access.
    DEFAULT_VIEWER_DOMAINS_STR: str = Field(
        default="pixxel.co.in,spacepixxel.co.in",
        description=(
            "Comma-separated list of email domains that get viewer access when no "
            "explicit RBAC assignment exists"
        ),
    )

    # Path to persistent role assignment JSON file.
    ROLE_STORE_PATH: str = Field(
        default="",
        description="Path to persistent RBAC role store JSON"
    )

    # Session signing secret for HttpOnly cookie authentication.
    SESSION_SECRET: str = Field(
        default="",
        description="HMAC secret used to sign session cookies"
    )

    # Session TTL in hours.
    SESSION_TTL_HOURS: int = Field(
        default=12,
        ge=1,
        le=168,
        description="Session expiration (hours)"
    )

    # Cookie secure flag (set true behind HTTPS).
    SESSION_COOKIE_SECURE: bool = Field(
        default=False,
        description="Whether session cookie should be marked Secure"
    )
    
    # ===========================================
    # Development Settings
    # ===========================================
    DEV_MODE: bool = Field(
        default=True,
        description="Enable development mode. When True and GOOGLE_CLIENT_ID is empty, bypasses authentication."
    )
    
    # ===========================================
    # Git & GitHub Integration
    # ===========================================
    GITHUB_TOKEN: str = Field(
        default="",
        description="GitHub Personal Access Token for private repository access."
    )

    COMMENTS_API_BASE_URL: str = Field(
        default="",
        description=(
            "Default base URL used to generate KiCad comments REST URLs "
            "for project import and visualizer helpers. "
            "If empty, URL helpers derive host from the incoming request."
        ),
    )
    
    # ===========================================
    # Computed Properties
    # ===========================================
    @property
    def ALLOWED_USERS(self) -> List[str]:
        """Parse allowed emails from comma-separated string."""
        return [u.strip().lower() for u in self.ALLOWED_USERS_STR.split(",") if u.strip()]

    @property
    def ALLOWED_DOMAINS(self) -> List[str]:
        """Parse allowed domains from comma-separated string."""
        return [d.strip().lower() for d in self.ALLOWED_DOMAINS_STR.split(",") if d.strip()]

    @property
    def BOOTSTRAP_ADMIN_USERS(self) -> List[str]:
        """Parse bootstrap admin emails from comma-separated string."""
        return [u.strip().lower() for u in self.BOOTSTRAP_ADMIN_USERS_STR.split(",") if u.strip()]

    @property
    def DEFAULT_VIEWER_DOMAINS(self) -> List[str]:
        """Parse implicit viewer domains from comma-separated string."""
        return [d.strip().lower() for d in self.DEFAULT_VIEWER_DOMAINS_STR.split(",") if d.strip()]

    @property
    def KICAD_PROJECTS_ROOT(self) -> str:
        return os.environ.get(
            "KICAD_PROJECTS_ROOT",
            os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../data/projects")),
        )

    @property
    def RESOLVED_ROLE_STORE_PATH(self) -> str:
        if self.ROLE_STORE_PATH.strip():
            return os.path.abspath(os.path.expanduser(self.ROLE_STORE_PATH.strip()))
        return os.path.join(self.KICAD_PROJECTS_ROOT, ".rbac_roles.json")
    
    @property
    def AUTH_ENABLED(self) -> bool:
        """
        Authentication is enabled only if:
        1. AUTH_ENABLED env var is True (default), AND
        2. Valid Google OAuth client credentials are configured, AND
        3. DEV_MODE is False (unless GOOGLE_CLIENT_ID is set)
        """
        # If explicitly disabled via env var, it's off.
        if not self.AUTH_ENABLED_OVERRIDE:
            return False
            
        return bool(self.GOOGLE_CLIENT_ID) and bool(self.GOOGLE_CLIENT_SECRET) and not self.DEV_MODE
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        # Allow extra fields to be ignored
        extra = "ignore"


# Global settings instance
settings = Settings()
