"""Settings for Simulation Studio (WP-C6 fills this group; ADR §9.6).

`Settings` in `app.core.config` inherits it already, so C6 adds its
`PRISM_SIM_*` fields here without editing `config.py` (ownership map).
"""
from __future__ import annotations

from pydantic_settings import BaseSettings


class SimStudioSettings(BaseSettings):
    pass
