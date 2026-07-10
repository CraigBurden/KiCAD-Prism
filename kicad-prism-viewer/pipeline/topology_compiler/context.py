from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .pcb_extract import extract_pcb_metadata_light
from .pcb_geometry import extract_pad_holes
from .vendor_paths import ensure_reference_paths


@dataclass
class PrismCompilationContext:
    project_file: Path
    compatibility_design_json: bool = False
    progress: Callable[[str], None] | None = None
    timings: dict[str, float] = field(default_factory=dict)
    _design: Any = None
    _pcb_ir: Any = None
    _design_payload_for_topology: dict[str, Any] | None = None
    _design_payload_for_svg_world: dict[str, Any] | None = None
    _pad_holes: dict[str, Any] | None = None
    _pcb_metadata_light: dict[str, Any] | None = None
    _manufacturing_design: Any = None
    _bom_assembly_by_variant: dict[str | None, Any] = field(default_factory=dict)

    def _log(self, message: str) -> None:
        if self.progress:
            self.progress(message)

    def _timed(self, key: str, label: str, factory):
        started = time.perf_counter()
        self._log(f"START {label}")
        try:
            return factory()
        finally:
            elapsed = (time.perf_counter() - started) * 1000.0
            self.timings[key] = self.timings.get(key, 0.0) + elapsed
            self._log(f"DONE {label} ({elapsed / 1000.0:.1f}s)")

    @property
    def design(self):
        if self._design is None:
            def load():
                from kicad_monkey import KiCadDesign  # type: ignore

                return KiCadDesign.from_project_file(self.project_file)

            self._design = self._timed("design_load_ms", "load KiCad project with kicad_monkey", load)
        return self._design

    @property
    def pcb(self):
        return self.design.pcb

    @property
    def netlist(self):
        def build():
            return getattr(self.design, "netlist", None)

        if "netlist_ms" not in self.timings:
            return self._timed("netlist_ms", "resolve KiCad netlist", build)
        return getattr(self.design, "netlist", None)

    @property
    def design_payload_for_topology(self) -> dict[str, Any]:
        if self._design_payload_for_topology is None:
            self._design_payload_for_topology = self._timed(
                "design_json_topology_ms",
                "compile topology design JSON",
                lambda: self.design.to_json(include_indexes=self.compatibility_design_json),
            )
        return self._design_payload_for_topology

    @property
    def design_payload_for_svg_world(self) -> dict[str, Any]:
        if self._design_payload_for_svg_world is None:
            self._design_payload_for_svg_world = self._timed(
                "design_json_svg_ms",
                "compile schematic-world design JSON",
                lambda: self.design.to_json(include_indexes=True),
            )
        return self._design_payload_for_svg_world

    @property
    def pcb_ir(self):
        if self._pcb_ir is None:
            self._pcb_ir = self._timed("pcb_ir_ms", "compile PCB IR", self.design.to_pcb_ir)
        return self._pcb_ir

    @property
    def pad_holes(self) -> dict[str, Any]:
        if self._pad_holes is None:
            self._pad_holes = self._timed("pad_holes_ms", "extract PCB pad holes", lambda: extract_pad_holes(self.pcb))
        return self._pad_holes

    @property
    def pcb_metadata_light(self) -> dict[str, Any]:
        if self._pcb_metadata_light is None:
            self._pcb_metadata_light = self._timed(
                "pcb_metadata_light_ms",
                "extract light PCB metadata",
                lambda: extract_pcb_metadata_light(self.pcb, self.project_file),
            )
        return self._pcb_metadata_light

    @property
    def manufacturing_design(self):
        if self._manufacturing_design is None:
            def build():
                ensure_reference_paths()
                from kicad_cruncher.kicad_manufacturing_design import KiCadManufacturingDesign  # type: ignore

                return KiCadManufacturingDesign(design=self.design, source_path=self.project_file)

            self._manufacturing_design = self._timed(
                "bom_design_reuse_ms",
                "reuse KiCad design for BOM",
                build,
            )
        return self._manufacturing_design

    def bom_assembly_by_variant(self, variant: str | None = None):
        if variant not in self._bom_assembly_by_variant:
            self._bom_assembly_by_variant[variant] = self._timed(
                "bom_assembly_ms",
                "assemble BOM variant",
                lambda: self.manufacturing_design.to_bom(variant),
            )
        return self._bom_assembly_by_variant[variant]
