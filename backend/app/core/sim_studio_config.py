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
    PRISM_SIM_ENGINE: str = Field(default="dc-drop-grid", description="sim-worker engine id that runs every analysis (dc-drop-grid, or dc-drop-synthetic for pipeline tests).")
    PRISM_SIM_SUCCEEDED_RUNS_KEPT: int = Field(
        default=3,
        description=(
            "Succeeded Simulation Studio runs kept indefinitely per setup (the newest). Failed and "
            "cancelled runs are deleted, except a setup's latest run."
        ),
    )
