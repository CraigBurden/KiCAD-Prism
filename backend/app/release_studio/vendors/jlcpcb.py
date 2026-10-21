"""JLCPCB SMT upload profile.

Cruncher's ``jlc`` command emits XLSX only. Release Studio also asks for the
CSV equivalents so the attested dossier members can use the existing CSV
canonicalizer. The XLSX pair stays in evidence and is copied into the derived
upload zip.
"""

from __future__ import annotations

import json
import re
import shutil
import time
from fnmatch import fnmatch
from pathlib import Path
from typing import Any, Mapping, Sequence

from app.services.design_bundle import schemas
from app.services.kicad_tools import KicadTool, ToolError

from .registry import VendorArtifacts

#: Pinned BOM/PnP configuration. Hashed into ``toolchain_digest`` by
#: ``documents.renderer_resource_digest`` so editing it moves ``build_key``
#: rather than changing a vendor pack under an unchanged one.
VENDOR_CONFIG = Path(__file__).with_name("jlcpcb.config.jsonc")

#: The schema ``prism-kicad vendor run jlcpcb`` validates ``--config`` against
#: (ADR amendment C3 §3.5, cli-spec.md §5.8).
VENDOR_CONFIG_SCHEMA = "prism.vendor.jlcpcb.config.a0"

#: The four files Cruncher's config mode wrote, and where each belongs in a
#: release.  The names are unchanged from the legacy path so dossier links and
#: the derived upload zip do not move.
CANONICAL_FILES: Mapping[str, str] = {
    "bom.csv": "manufacturing/vendors/jlcpcb/bom.csv",
    "cpl.csv": "manufacturing/vendors/jlcpcb/cpl.csv",
}
EVIDENCE_FILES: Mapping[str, str] = {
    "bom.xlsx": "vendors/jlcpcb/bom.xlsx",
    "cpl.xlsx": "vendors/jlcpcb/cpl.xlsx",
}

_JSONC_COMMENT = re.compile(r"^\s*//.*$", re.MULTILINE)


def vendor_config_document(source: Path = VENDOR_CONFIG) -> dict[str, Any]:
    """The ``prism.vendor.jlcpcb.config.a0`` document for ``prism-kicad``.

    The values are Prism's one pinned configuration, converted in Python rather
    than checked in a second time: the JSONC file feeds
    ``renderer_resource_digest``, so editing the values still moves
    ``build_key``.  The converted document is validated against the generated
    schema before it is written, which is what catches a value the Rust module
    does not accept.
    """

    text = source.read_text(encoding="utf-8")
    body = _JSONC_COMMENT.sub("", text)
    document = json.loads(body)
    document["schema"] = VENDOR_CONFIG_SCHEMA
    schemas.validate(document, VENDOR_CONFIG_SCHEMA)
    return document


def vendor_config_bytes(source: Path = VENDOR_CONFIG) -> bytes:
    """Canonical bytes of the converted configuration (deterministic per run)."""

    document = vendor_config_document(source)
    return (
        json.dumps(document, indent=2, sort_keys=True, ensure_ascii=True) + "\n"
    ).encode("utf-8")


class JlcpcbProfile:
    id = "jlcpcb"
    title = "JLCPCB"
    config_schema = VENDOR_CONFIG_SCHEMA
    pack_filename = "jlcpcb-upload.zip"
    description = (
        "Gerbers, drill, and JLCPCB SMT BOM/CPL workbooks for the JLCPCB "
        "order form. The signed release archive remains the attested record."
    )
    # These are deliberately semantic names rather than archive paths: pack
    # readiness tells an operator what is missing without requiring them to
    # understand the dossier/evidence split.
    required_pack_artifacts = (
        "gerber",
        "drill",
        "bom.csv",
        "cpl.csv",
        "bom.xlsx",
        "cpl.xlsx",
    )

    def config_document(self) -> dict[str, Any]:
        """The ``--config`` document for ``prism-kicad vendor run``."""

        return vendor_config_document()

    def config_bytes(self) -> bytes:
        return vendor_config_bytes()

    def pack_files(
        self,
        *,
        files: Mapping[str, Path],
        output_root: Path,
    ) -> tuple[dict[str, Path], dict[str, Path]]:
        """Copy a verified vendor run into today's dossier/evidence paths.

        Keys are the names in ``CliVendorRunResultA0.files``; a missing one is
        a failure rather than a silently incomplete pack.
        """

        canonical: dict[str, Path] = {}
        for name, relative in CANONICAL_FILES.items():
            source = files.get(name)
            if source is None:
                raise VendorGenerateError(f"JLCPCB did not produce {name}")
            canonical[relative] = _copy(source, output_root / relative)

        evidence: dict[str, Path] = {}
        for name, relative in EVIDENCE_FILES.items():
            source = files.get(name)
            if source is None:
                raise VendorGenerateError(f"JLCPCB did not produce {name}")
            evidence[relative] = _copy(
                source,
                output_root / "_vendor_evidence" / self.id / Path(relative).name,
            )
        return canonical, evidence

    def generate(
        self,
        *,
        cruncher: KicadTool,
        design_file: Path,
        output_root: Path,
        variant: str = "",
        timeout_seconds: int = 900,
    ) -> VendorArtifacts:
        workdir = output_root / "_vendor_work" / self.id
        if workdir.exists():
            shutil.rmtree(workdir)
        workdir.mkdir(parents=True)

        env = {"KIPRJMOD": str(design_file.resolve().parent)}
        argv_record: list[str] = []
        started = time.perf_counter()

        # One invocation per tool, not one per format. `--format` overrides
        # config mode and emits a single kind, so the four formats used to cost
        # four full parses of the design; the config lists all four and each
        # tool loads once. Two is the floor: the BOM comes from the schematic
        # side and the placement from the board.
        commands: tuple[tuple[str, Path, tuple[str, ...]], ...] = (
            ("bom", workdir, ("bom", "--config", str(VENDOR_CONFIG))),
            ("pnp", workdir, ("pnp", "--config", str(VENDOR_CONFIG))),
        )
        stdout_parts: list[str] = []
        stderr_parts: list[str] = []
        for _label, destination, parts in commands:
            argv = [*parts, str(design_file), "-o", str(destination)]
            if variant:
                argv.extend(("--variant", variant))
            argv_record.append(
                " ".join(["kicad-cruncher", *_normalize_argv(argv, design_file, output_root)])
            )
            try:
                result = cruncher.run(
                    argv, timeout=timeout_seconds, env=env, cwd=design_file.parent
                )
            except ToolError as exc:
                raise VendorGenerateError(f"kicad-cruncher {' '.join(parts[:2])}: {exc}") from exc
            stdout_parts.append(result.stdout)
            stderr_parts.append(result.stderr)
            if not result.ok:
                detail = (stderr_parts[-1] or stdout_parts[-1]).strip()
                raise VendorGenerateError(
                    f"kicad-cruncher {' '.join(parts[:2])} failed: {detail[:400]}"
                )

        dest = output_root / "manufacturing" / "vendors" / self.id
        dest.mkdir(parents=True, exist_ok=True)
        evidence_root = output_root / "_vendor_evidence" / self.id
        evidence_root.mkdir(parents=True, exist_ok=True)

        # Config mode names outputs by kind rather than by tool, and writes
        # them all under one root, so the patterns name the kind explicitly.
        bom_csv = _require_one(workdir, "*jlc-csv.csv", "JLC BOM CSV")
        cpl_csv = _require_one(workdir, "*jlc-cpl.csv", "JLC CPL CSV")
        bom_xlsx = _require_one(workdir, "*jlc-xlsx.xlsx", "JLC BOM XLSX")
        cpl_xlsx = _require_one(workdir, "*jlc-cpl-xlsx.xlsx", "JLC CPL XLSX")

        canonical = {
            "manufacturing/vendors/jlcpcb/bom.csv": _copy(bom_csv, dest / "bom.csv"),
            "manufacturing/vendors/jlcpcb/cpl.csv": _copy(cpl_csv, dest / "cpl.csv"),
        }
        evidence = {
            "vendors/jlcpcb/bom.xlsx": _copy(bom_xlsx, evidence_root / "bom.xlsx"),
            "vendors/jlcpcb/cpl.xlsx": _copy(cpl_xlsx, evidence_root / "cpl.xlsx"),
        }
        elapsed_ms = int((time.perf_counter() - started) * 1000)
        return VendorArtifacts(
            canonical_files=canonical,
            evidence_files=evidence,
            stdout="\n".join(part for part in stdout_parts if part),
            stderr="\n".join(part for part in stderr_parts if part),
            elapsed_ms=elapsed_ms,
            returncode=0,
            normalized_argv=tuple(argv_record),
        )


class VendorGenerateError(RuntimeError):
    """A vendor generator could not produce its files."""


def _copy(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


def _require_one(directory: Path, pattern: str, label: str) -> Path:
    matches = sorted(
        path
        for path in directory.rglob("*")
        if path.is_file() and fnmatch(path.name, pattern)
    )
    if not matches:
        raise VendorGenerateError(f"{label} was not produced under {directory}")
    return matches[0]


def _normalize_argv(argv: Sequence[str], design_file: Path, output_root: Path) -> list[str]:
    normalized: list[str] = []
    for part in argv:
        if part == str(design_file):
            normalized.append(design_file.name)
        elif part == str(VENDOR_CONFIG):
            # An install path is not part of the build's identity, and recording
            # one would make the same build differ between two checkouts. The
            # config's *content* is already bound through toolchain_digest.
            normalized.append(VENDOR_CONFIG.name)
        elif part.startswith(str(output_root)):
            normalized.append(Path(part).relative_to(output_root).as_posix())
        else:
            normalized.append(part)
    return normalized


JLCPCB_PROFILE = JlcpcbProfile()
