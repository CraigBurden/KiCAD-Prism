"""JLCPCB SMT upload profile.

``prism-kicad vendor run jlcpcb`` emits the CSV pair the attested dossier
members use and the XLSX pair that stays in evidence and is copied into the
derived upload zip.
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path
from typing import Any, Mapping

from app.services.design_bundle import schemas

#: Pinned BOM/PnP configuration. Hashed into ``toolchain_digest`` by
#: ``documents.renderer_resource_digest`` so editing it moves ``build_key``
#: rather than changing a vendor pack under an unchanged one.
VENDOR_CONFIG = Path(__file__).with_name("jlcpcb.config.jsonc")

#: The schema ``prism-kicad vendor run jlcpcb`` validates ``--config`` against
#: (ADR amendment C3 §3.5, cli-spec.md §5.8).
VENDOR_CONFIG_SCHEMA = "prism.vendor.jlcpcb.config.a0"

#: The four files the vendor run writes, and where each belongs in a release.
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


class VendorGenerateError(RuntimeError):
    """A vendor generator could not produce its files."""


def _copy(source: Path, destination: Path) -> Path:
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)
    return destination


JLCPCB_PROFILE = JlcpcbProfile()
