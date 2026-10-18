"""Settings for the design bundle (ADR native design bundle §4.4, §5, §8).

`Settings` in `app.core.config` inherits these fields; read them through
`app.core.config.settings` like every other setting. They live in their own
module so `config.py` stays untouched while the bundle work lands (ownership
map, WP-K).

- `PRISM_DESIGN_SOURCE_<CONSUMER>`: each consumer's switch, `legacy` or
  `bundle` (ADR §8). The PR that proves a consumer's parity flips its default:
  Design Comparison's is `bundle` (amendment C2r); the rest are `legacy`.
- `PRISM_DESIGN_BUNDLE_*`: the `design_bundle` job, its resource slot, the
  per-stage limits it passes to `prism-kicad` (cli-spec.md §7), the store and
  its retention, and the paced backfill.
- `PRISM_KICAD_PYTHON`, `PRISM_ZONE_REFILL_TIMEOUT_SECONDS`: KiCad's Python
  for the zone refill and the board upgrade (cli-spec.md §9.2, §9.4).
"""
from __future__ import annotations

from typing import Literal

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings

DesignSource = Literal["legacy", "bundle"]

GIB = 1024**3
#: cli-spec.md §7.4: the Linux backstop adds 1 GiB plus thread stacks over the heap cap.
BACKSTOP_OVERHEAD_BYTES = GIB + GIB // 4


class DesignBundleSettings(BaseSettings):
    # ===========================================
    # Consumer switches (ADR §8)
    # ===========================================
    PRISM_DESIGN_SOURCE_SEMANTIC_INDEX: DesignSource = Field(
        default="legacy", description="Semantic index: today's Python index, or the bundle's semantic-index member."
    )
    PRISM_DESIGN_SOURCE_DESIGN_COMPARISON: DesignSource = Field(
        default="bundle",
        description=(
            "Design Comparison: `prism-kicad compare` over bundles or source trees (default since the C2r"
            " switch), or `legacy`, today's parsers, until R1 removes them."
        ),
    )
    PRISM_DESIGN_SOURCE_RELEASE_STUDIO: DesignSource = Field(
        default="legacy", description="Release Studio projections and closure: today's readers, or bundle members."
    )
    PRISM_DESIGN_SOURCE_SYSTEM_BUILDER: DesignSource = Field(
        default="legacy", description="System Builder interface and 3D scene: today's extractor, or bundle members."
    )
    PRISM_DESIGN_SOURCE_VIEWER_3D: DesignSource = Field(
        default="legacy", description="3D tab: the topology compiler's store, or the bundle's materialization."
    )
    PRISM_DESIGN_SOURCE_PROJECT_METADATA: DesignSource = Field(
        default="legacy", description="Project card, properties and viewer sources: the checkout, or bundle members."
    )
    PRISM_DESIGN_SOURCE_CATALOG_IMPORT: DesignSource = Field(
        default="legacy", description="Catalog project component import and usage: today's scanners, or bundle members."
    )

    # ===========================================
    # The design_bundle job
    # ===========================================
    PRISM_DESIGN_BUNDLE_AUTO_BUILD: bool = Field(
        default=True,
        description=(
            "Queue a design bundle for the project's HEAD after every import and sync, and run the "
            "paced prebuild of each branch's newest commits and every tagged commit (ADR amendment "
            "K2 §7). On by default since the C2r switch, which relies on warm bundles (C2r §10). "
            "Off: bundles are built only on demand."
        ),
    )
    PRISM_DESIGN_BUNDLE_CLI_PATH: str = Field(
        default="", description="The prism-kicad binary. Unset uses prism-kicad on PATH (/usr/local/bin in the image)."
    )
    PRISM_DESIGN_BUNDLE_ROOT: str = Field(
        default="", description="Bundle store. Defaults to <KICAD_PROJECTS_ROOT>/.kicad-prism/bundles."
    )
    PRISM_DESIGN_BUNDLE_SCHEMA_DIR: str = Field(
        default="",
        description="Committed JSON Schema of the bundle contracts. Unset uses native/contracts/generated/schema.",
    )
    PRISM_DESIGN_BUNDLE_CONCURRENCY: int = Field(
        default=1, ge=1, le=8, description="Capacity of the design_bundle resource slot (bundle builds at once)."
    )
    PRISM_DESIGN_BUNDLE_THREADS: int = Field(default=4, ge=1, le=64, description="prism-kicad --threads.")
    PRISM_DESIGN_BUNDLE_MAX_ATTEMPTS: int = Field(
        default=3, ge=1, le=10, description="Attempts of one design_bundle job before a failing KiCad step ends it."
    )
    PRISM_DESIGN_BUNDLE_PARSE_TIMEOUT_MS: int = Field(default=300_000, ge=1_000)
    PRISM_DESIGN_BUNDLE_BOARD_TIMEOUT_MS: int = Field(default=600_000, ge=1_000)
    PRISM_DESIGN_BUNDLE_MODELS_TIMEOUT_MS: int = Field(default=120_000, ge=1_000)
    PRISM_DESIGN_BUNDLE_VERIFY_TIMEOUT_MS: int = Field(
        default=300_000,
        ge=1_000,
        description="`prism-kicad bundle verify` when an archive is stored (bundle-format.md §9).",
    )
    PRISM_DESIGN_BUNDLE_PARSE_MEMORY_BYTES: int = Field(default=4 * GIB, ge=64 * 1024**2)
    PRISM_DESIGN_BUNDLE_BOARD_MEMORY_BYTES: int = Field(default=6 * GIB, ge=64 * 1024**2)
    PRISM_DESIGN_BUNDLE_MODELS_MEMORY_BYTES: int = Field(default=2 * GIB, ge=64 * 1024**2)
    PRISM_DESIGN_BUNDLE_MEMORY_BUDGET_BYTES: int = Field(
        default=8 * GIB,
        ge=GIB,
        description=(
            "Worker memory the design_bundle slot may use: CONCURRENCY x (largest stage cap + 1.25 GiB) "
            "must fit (cli-spec.md §7.4). 12 GiB worker minus the other slots by default."
        ),
    )
    PRISM_DESIGN_BUNDLE_GLB_TIMEOUT_SECONDS: int = Field(
        default=600, ge=10, description="kicad-cli pcb export glb for the models stage."
    )
    PRISM_DESIGN_BUNDLE_UPGRADE_TIMEOUT_SECONDS: int = Field(
        default=900, ge=10, description="KiCad's upgrade of one older board or schematic before stage parse."
    )
    PRISM_DESIGN_BUNDLE_UPGRADE_WORKERS: int = Field(
        default=8,
        ge=1,
        description="KiCad upgrades of one source set run at once (each file in its own scratch directory).",
    )
    PRISM_KICAD_PYTHON: str = Field(
        default="/usr/bin/python3", description="KiCad's Python (imports pcbnew) for the zone refill and board upgrades."
    )
    PRISM_ZONE_REFILL_TIMEOUT_SECONDS: int = Field(default=900, ge=10, description="One pcbnew zone refill.")

    # ===========================================
    # Store, retention and backfill (ADR §5, §8)
    # ===========================================
    PRISM_DESIGN_BUNDLE_RETENTION_DAYS: int = Field(
        default=30,
        ge=1,
        description=(
            "Days a bundle may go unused before retention removes it. Branch heads, System Builder "
            "baselines and released Release Studio commits are always kept."
        ),
    )
    PRISM_DESIGN_BUNDLE_BACKFILL_INTERVAL_SECONDS: int = Field(
        default=60,
        ge=0,
        description=(
            "Seconds between prebuild ticks; each aliases the commits it can to stored bundles and "
            "queues at most one build. 0 disables it."
        ),
    )
    PRISM_DESIGN_BUNDLE_PREBUILD_COMMITS: int = Field(
        default=10,
        ge=0,
        description=(
            "How many of each branch's newest commits (first parent) the background prebuild keeps "
            "bundles for, besides every tagged commit. 0 prebuilds branch heads and tags only."
        ),
    )
    PRISM_DESIGN_BUNDLE_REUSE_CANDIDATES: int = Field(
        default=3,
        ge=0,
        description=(
            "How many stored bundles a new revision is checked against with prism-kicad bundle reuse "
            "before it is built. 0 disables reuse."
        ),
    )

    @model_validator(mode="after")
    def _memory_fits_the_slot(self) -> "DesignBundleSettings":
        largest = max(
            self.PRISM_DESIGN_BUNDLE_PARSE_MEMORY_BYTES,
            self.PRISM_DESIGN_BUNDLE_BOARD_MEMORY_BYTES,
            self.PRISM_DESIGN_BUNDLE_MODELS_MEMORY_BYTES,
        )
        needed = self.PRISM_DESIGN_BUNDLE_CONCURRENCY * (largest + BACKSTOP_OVERHEAD_BYTES)
        if needed > self.PRISM_DESIGN_BUNDLE_MEMORY_BUDGET_BYTES:
            raise ValueError(
                "PRISM_DESIGN_BUNDLE_CONCURRENCY x (largest stage memory cap + 1.25 GiB) "
                f"is {needed} bytes, over PRISM_DESIGN_BUNDLE_MEMORY_BUDGET_BYTES"
            )
        return self
