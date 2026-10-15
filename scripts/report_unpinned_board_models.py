#!/usr/bin/env python3
"""Report the 3D models of placed Prism parts that a board does not pin.

Remote placement embeds each footprint's 3D models in the footprint
(``kicad-embed://``), so the board file pins them. Parts placed before that
(or with ``REMOTE_PROVIDER_EMBED_3D_MODELS=false``, or whose model was over the
embed cap) reference ``<destination>/<prefix>_3d/<name>`` instead: a folder
that is gitignored and shared by every revision, so a fresh clone opens without
the model and placing a newer revision replaces it.

For every ``.kicad_pcb`` under the given directories (default
``KICAD_PROJECTS_ROOT``; ``.git`` and ``.kicad-prism`` are skipped) this lists:

- ``unpinned``: footprints with a model under the provider's ``<prefix>_3d``
  folder, with whether the file is present in that checkout and its sha256;
  ``catalog_asset_ids`` names the catalog 3D model assets with those bytes
  when ``--database-url`` (or ``PRISM_DATABASE_URL``) reaches the catalog;
- ``embedded_missing``: ``kicad-embed://`` references whose data the board
  does not carry;
- counts of embedded and other (stock or project) model references.

It only reads. To pin such a part, place it again from KiCad (Prism embeds its
model), or embed the present file with KiCad's footprint properties dialog.
The exit status is 0, or 2 when a directory does not exist.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from pathlib import Path
from typing import Any

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
for candidate in (REPO_ROOT / "backend", REPO_ROOT):
    if (candidate / "app").is_dir():
        sys.path.insert(0, str(candidate))
        break

SKIPPED_DIRS = {".git", ".kicad-prism", "node_modules"}
EMBED_PREFIX = "kicad-embed://"
_REFERENCE_RE = re.compile(r'\(property\s+"Reference"\s+"([^"]*)"')


def boards(roots: list[Path]) -> list[Path]:
    found: list[Path] = []
    for root in roots:
        for directory, dirs, names in os.walk(root):
            dirs[:] = sorted(name for name in dirs if name not in SKIPPED_DIRS)
            found.extend(Path(directory) / name for name in sorted(names) if name.endswith(".kicad_pcb"))
    return found


def provider_model_dir() -> str:
    """The ``<prefix>_3d`` folder name remote placement writes external models to."""
    from app.core.config import settings  # noqa: PLC0415
    from app.services.catalog.normalization import sanitize_name  # noqa: PLC0415

    return f"{sanitize_name(settings.REMOTE_PROVIDER_LIBRARY_PREFIX, 'remote').lower()}_3d"


def board_data_names(text: str) -> set[str]:
    """Names of the embedded files whose data the board carries."""
    from app.services.catalog.kicad_embedded_files import decode_embedded_files  # noqa: PLC0415

    return set(decode_embedded_files(text))


def resolve_local(raw_path: str, board: Path) -> Path | None:
    expanded = raw_path.replace("${KIPRJMOD}", str(board.parent)).replace("$(KIPRJMOD)", str(board.parent))
    path = Path(expanded)
    if not path.is_absolute():
        path = board.parent / path
    return path if path.is_file() else None


def scan_board(board: Path, model_dir: str) -> dict[str, Any]:
    from app.services.kicad_library_reader import iter_forms, model_references  # noqa: PLC0415

    text = board.read_text(encoding="utf-8", errors="ignore")
    embedded_names = board_data_names(text) if EMBED_PREFIX in text else set()
    report: dict[str, Any] = {"board": str(board), "embedded": 0, "other": 0, "unpinned": [], "embedded_missing": []}
    for footprint in iter_forms(text, "footprint"):
        reference_match = _REFERENCE_RE.search(footprint)
        reference = reference_match.group(1) if reference_match else ""
        for raw in model_references(footprint):
            if raw.startswith(EMBED_PREFIX):
                if raw[len(EMBED_PREFIX):] in embedded_names:
                    report["embedded"] += 1
                else:
                    report["embedded_missing"].append({"reference": reference, "model": raw})
                continue
            if f"/{model_dir}/" not in raw.replace("\\", "/"):
                report["other"] += 1
                continue
            local = resolve_local(raw, board)
            report["unpinned"].append({
                "reference": reference,
                "model": raw,
                "present": local is not None,
                "sha256": hashlib.sha256(local.read_bytes()).hexdigest() if local else "",
            })
    return report


def match_catalog(reports: list[dict[str, Any]], database_url: str) -> None:
    """Add ``catalog_asset_ids`` to each present unpinned model, by sha256."""
    from app.services.component_catalog_service_postgres import ComponentCatalogPostgresService  # noqa: PLC0415

    hashes = sorted({item["sha256"] for report in reports for item in report["unpinned"] if item["sha256"]})
    if not hashes:
        return
    service = ComponentCatalogPostgresService(database_url=database_url or None)
    with service.connection() as conn:
        rows = conn.execute(
            "SELECT id, sha256 FROM assets WHERE asset_type = '3dmodel' AND sha256 = ANY(%s::text[]) ORDER BY id",
            (hashes,),
        ).fetchall()
        conn.rollback()
    by_hash: dict[str, list[str]] = {}
    for row in rows:
        by_hash.setdefault(str(row["sha256"]), []).append(str(row["id"]))
    for report in reports:
        for item in report["unpinned"]:
            item["catalog_asset_ids"] = by_hash.get(item["sha256"], [])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", type=Path, help="Directories to scan (default: KICAD_PROJECTS_ROOT)")
    parser.add_argument("--database-url", default=os.environ.get("PRISM_DATABASE_URL", ""),
                        help="Catalog PostgreSQL URL for matching models to catalog assets")
    parser.add_argument("--all", action="store_true", help="Also list boards with nothing unpinned")
    args = parser.parse_args(argv)

    roots = list(args.paths)
    if not roots:
        from app.core.config import settings  # noqa: PLC0415

        roots = [Path(settings.KICAD_PROJECTS_ROOT)]
    missing = [str(root) for root in roots if not root.is_dir()]
    if missing:
        print(f"Not a directory: {', '.join(missing)}", file=sys.stderr)
        return 2
    model_dir = provider_model_dir()
    reports = [scan_board(board, model_dir) for board in boards(roots)]
    if args.database_url:
        match_catalog(reports, args.database_url)
    listed = [
        report for report in reports if args.all or report["unpinned"] or report["embedded_missing"]
    ]
    summary = {
        "boards": len(reports),
        "boards_with_unpinned_models": sum(1 for report in reports if report["unpinned"]),
        "unpinned_models": sum(len(report["unpinned"]) for report in reports),
        "unpinned_models_missing_locally": sum(
            1 for report in reports for item in report["unpinned"] if not item["present"]
        ),
        "embedded_models": sum(report["embedded"] for report in reports),
        "embedded_models_missing": sum(len(report["embedded_missing"]) for report in reports),
    }
    print(json.dumps({"summary": summary, "boards": listed}, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
