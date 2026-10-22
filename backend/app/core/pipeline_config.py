"""Settings for the design pipelines: design compare, the semantic viewer, and Systems.

`Settings` in `app.core.config` inherits these fields; read them through
`app.core.config.settings` like every other setting. They live in their own
module only to keep the auth/database/catalog settings readable.
"""
from __future__ import annotations

from pydantic import Field, field_validator
from pydantic_core import PydanticUseDefault
from pydantic_settings import BaseSettings


class PipelineSettings(BaseSettings):
    # ===========================================
    # Design compare
    # ===========================================
    PRISM_DESIGN_COMPARE_CACHE: str = Field(
        default="",
        description="Revision snapshot cache. Defaults to <temp>/prism_design_compare_cache.",
    )
    PRISM_DESIGN_COMPARE_JOBS: str = Field(
        default="",
        description="Scratch root for design-compare jobs. Defaults to <temp>/prism_design_compare.",
    )
    PRISM_DESIGN_COMPARE_CACHE_MAX_BYTES: int = Field(
        default=20 * 1024**3,
        description="Revision cache size cap; least recently used commits are evicted. 0 disables the cap.",
    )
    PRISM_DESIGN_COMPARE_CACHE_MIN_AGE: float = Field(
        default=900.0,
        description="Seconds a revision cache entry is protected from eviction after its last use.",
    )
    PRISM_DESIGN_COMPARE_STALE_SECONDS: int = Field(
        default=300,
        description="Seconds without a heartbeat before an in-process compare job is reported stale.",
    )
    PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS: int = Field(
        default=2,
        description="Revisions built concurrently (capped at 2); the stage default below.",
    )
    PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS: int | None = Field(
        default=None,
        description="Schematic-stage workers (capped at 2). Unset uses MAX_REVISION_WORKERS.",
    )
    PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS: int | None = Field(
        default=None,
        description="PCB-stage workers (capped at 2). Unset uses MAX_REVISION_WORKERS.",
    )
    PRISM_DESIGN_COMPARE_REVISION_PROCESSES: bool = Field(
        default=True,
        description="Compile the two revisions in separate processes; false keeps one address space.",
    )

    @field_validator(
        "PRISM_DESIGN_COMPARE_CACHE_MAX_BYTES",
        "PRISM_DESIGN_COMPARE_CACHE_MIN_AGE",
        "PRISM_DESIGN_COMPARE_STALE_SECONDS",
        "PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS",
        "PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS",
        "PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS",
        "PRISM_DESIGN_COMPARE_REVISION_PROCESSES",
        mode="before",
    )
    @classmethod
    def _blank_is_default(cls, value: object) -> object:
        """Surrounding blanks are ignored, and "" (Compose forwards blank lines) means the default."""
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise PydanticUseDefault()
        return value
