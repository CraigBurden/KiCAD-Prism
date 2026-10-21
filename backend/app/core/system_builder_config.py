"""Settings for System Builder v2 (docs/system-builder/CONTRACTS.md §7).

`Settings` in `app.core.config` inherits this group, so the limits a deployment
may raise live here rather than in the routes that check them.
"""

from __future__ import annotations

from pydantic import Field
from pydantic_settings import BaseSettings


class SystemBuilderSettings(BaseSettings):
    PRISM_SYSTEM_MAX_DOCUMENT_BYTES: int = Field(
        default=4 * 1024 * 1024,
        gt=0,
        description="Largest canonical JSON document a system may store, in bytes.",
    )
    PRISM_SYSTEM_MAX_OCCURRENCES: int = Field(
        default=200,
        gt=0,
        description="Most board, entry or body occurrences one system may hold.",
    )
    PRISM_SYSTEM_MAX_CONNECTIONS: int = Field(
        default=2000,
        gt=0,
        description="Most mates plus harness links one system may hold.",
    )
    PRISM_SYSTEM_MAX_HARNESSES: int = Field(
        default=200,
        gt=0,
        description="Most harness blocks one system may hold.",
    )
    PRISM_SYSTEM_MAX_ENDS_PER_HARNESS: int = Field(
        default=64,
        gt=0,
        description="Most ends one harness block may hold.",
    )
    PRISM_SYSTEM_MAX_WIRES: int = Field(
        default=10000,
        gt=0,
        description="Most wires one system may hold across all of its harness blocks.",
    )
    PRISM_SYSTEM_MAX_OPS_PER_REQUEST: int = Field(
        default=1000,
        gt=0,
        description="Most operations one prism.system.ops.a0 request may apply.",
    )
    PRISM_SYSTEM_BUNDLE_TIMEOUT_SECONDS: int = Field(
        default=300,
        ge=10,
        description="Wall-clock bound for one prism-kicad system build, in seconds.",
    )
    PRISM_SYSTEM_STEP_TIMEOUT_SECONDS: int = Field(
        default=900,
        ge=10,
        description=(
            "Wall-clock bound for one board STEP export or one prism-kicad system step,"
            " in seconds."
        ),
    )
    PRISM_BOARD_SUB_PORT_MAX_PINS: int = Field(
        default=1024,
        gt=0,
        description="Most pads one board-level sub-port may hold.",
    )
    PRISM_BOARD_SUB_PORT_MAX_PER_PROJECT: int = Field(
        default=2000,
        gt=0,
        description="Most live board-level sub-ports one project may hold.",
    )
