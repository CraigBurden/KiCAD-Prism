"""Settings for Simulation Studio (WP-C6 fills this group; ADR §9.6).

`Settings` in `app.core.config` inherits it already, so C6 adds its
`PRISM_SIM_*` fields here without editing `config.py` (ownership map).
"""
from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings


class SimStudioSettings(BaseSettings):
    PRISM_SIM_STUDIO_ENABLED: bool = Field(
        default=False,
        description="Experimental: the Simulation Studio tab and its /api/.../sim/a0 routes.",
    )
    PRISM_SIM_BIN_DIR: str = Field(
        default="/opt/prism-sim/bin",
        description="Directory holding the prism-sim-studio binaries (prism-bundle, sim-worker).",
    )
    PRISM_SIM_CONCURRENCY: int = Field(default=1, description="Simulation runs one worker executes at once.")
    PRISM_SIM_TIMEOUT_SECONDS: int = Field(default=3600, description="Longest a simulation engine may run.")
    PRISM_SIM_ENGINE: str = Field(
        default="dc-drop-grid",
        description=(
            "Preferred sim-worker engine id. A run takes it when it runs the analysis's kind, else the "
            "first installed engine that does (dc-drop-synthetic stands in for pipeline tests)."
        ),
    )
    PRISM_SIM_MESHES_KEPT: int = Field(
        default=4,
        description=(
            "Engine meshes kept per project for re-runs that change only values (newest by use). "
            "A mesh is tens of megabytes on a large board."
        ),
    )
    PRISM_SIM_SUCCEEDED_RUNS_KEPT: int = Field(
        default=3,
        description=(
            "Succeeded Simulation Studio runs kept indefinitely per setup (the newest). Failed and "
            "cancelled runs are deleted, except a setup's latest run."
        ),
    )
