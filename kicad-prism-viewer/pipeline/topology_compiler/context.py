from __future__ import annotations

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .pcb_extract import compile_pcb_artifacts
from .vendor_paths import ensure_reference_paths


@dataclass(frozen=True)
class BoardCompilation:
    pcb_ir: dict[str, Any]
    metadata: dict[str, Any]
    pad_holes: dict[str, dict[str, Any]]


@dataclass
class PrismCompilationContext:
    project_file: Path
    compatibility_design_json: bool = False
    progress: Callable[[str], None] | None = None
    profile: Callable[[str, dict[str, Any]], None] | None = None
    timings: dict[str, float] = field(default_factory=dict)
    _design: Any = None
    _board_compilation: BoardCompilation | None = None
    _design_payload_for_topology: dict[str, Any] | None = None
    _design_payload_for_svg_world: dict[str, Any] | None = None
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
            if self.profile:
                self.profile(key, {"elapsed_ms": elapsed})
            self._log(f"DONE {label} ({elapsed / 1000.0:.1f}s)")

    def _board_compilation_profile(self, key: str, values: dict[str, Any]) -> None:
        if self.profile:
            self.profile(f"board_compilation.{key}", values)

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
                "compile topology-only netlist JSON",
                lambda: (
                    self.design.to_json(include_indexes=True)
                    if self.compatibility_design_json
                    else self.design.to_netlist_json()
                ),
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
        return self.board_compilation.pcb_ir

    @property
    def pad_holes(self) -> dict[str, Any]:
        return self.board_compilation.pad_holes

    @property
    def pcb_metadata(self) -> dict[str, Any]:
        return self.board_compilation.metadata

    @property
    def board_compilation(self) -> BoardCompilation:
        if self._board_compilation is None:
            def compile_board() -> BoardCompilation:
                ir_document = self._timed(
                    "pcb_ir_ms",
                    "compile PCB IR",
                    self.design.to_pcb_ir,
                )
                ir_payload = self._timed(
                    "pcb_ir_to_dict_ms",
                    "materialize PCB IR payload",
                    ir_document.to_dict,
                )
                metadata, pad_holes = self._timed(
                    "pcb_metadata_unified_ms",
                    "derive PCB topology indexes from IR",
                    lambda: compile_pcb_artifacts(
                        self.pcb,
                        self.project_file,
                        ir_payload,
                        profile_callback=self._board_compilation_profile,
                    ),
                )
                return BoardCompilation(
                    pcb_ir=ir_payload,
                    metadata=metadata,
                    pad_holes=pad_holes,
                )

            self._board_compilation = self._timed(
                "board_compilation_ms",
                "compile unified PCB artifacts",
                compile_board,
            )
        return self._board_compilation

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
