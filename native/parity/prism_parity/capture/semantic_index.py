"""Golden for ``projections/semantic-index.json`` (``prism.semantic_index.a1``).

Field map ``semantic-index.md``, "How a golden is produced from today's code":

1. Producer: dev's ``semantic_index_service.build_semantic_index(project_file,
   source_revision_key=..., commit=None)`` with its defaults, patched in memory
   with the a1 additions taken from the reference branch (``ref:sis:887``,
   ``:993-994``): ``components[].libraryRef``; on schematic terminals
   ``pinName``/``pinType`` only when ``"pin_type" in raw_terminal``, and
   ``schematicNetName``. The patch is applied to the module's source text and
   the result executed as a private module; the imported module is untouched.
2. Envelope a0 -> a1: ``schema`` a1; ``sourceRevisionKey`` a deterministic
   64-hex stand-in derived from today's key (non-semantic: the runner ignores
   it); ``commit``, ``generator``, ``generatedAt`` removed.

D9 (paths are repository-relative RepoPaths): the private module's
``_relative_schematic_page`` is replaced for the call by one that resolves the
schematic file against the repository root (``ctx.src``), so every ``page``
(sheet instances, buses, schematic-ref placements), the derived ``parentPage``
and ``sheetInstanceUid`` (which hashes ``page``) are computed from the RepoPath.
Diagnostic ``path`` values (project-relative today, written by
``semantic_index_variants``/``variant_catalog_service``) are mapped with
``ctx.repo_path``. With ``ctx.project_dir == ""`` both are the identity.

Runs offline on ``ctx.src``: ``build_semantic_index`` writes no artifacts (only
``get_or_build`` does). Path resolution asks ``project_settings_service`` for
Prism-stored settings, which reads the workspace database; that lookup is
replaced by "none stored" for the call (offline, the lookup fails and falls
back to the same result). ``KICAD_MONKEY_PYTHONPATH`` must be empty so the
installed kicad_monkey wheel is used.
"""

from __future__ import annotations

import hashlib
import types
from pathlib import Path
from typing import Any

from . import Context, NotCaptured, Result

MEMBER = "semantic-index"
SCHEMA = "prism.semantic_index.a1"
BODY = ("components", "nets", "terminals", "sheetInstances", "buses", "indexes", "assembly")

_PATCHES = (
    (
        '''            "footprint": _string(raw.get("footprint")),
            "fields": _canonical_fields(raw),''',
        '''            "footprint": _string(raw.get("footprint")),
            "libraryRef": _string(raw.get("library_ref")),
            "fields": _canonical_fields(raw),''',
    ),
    (
        '''                "pin": pin_number,
                "netUid": net_entry["netUid"],
                "netName": name,
                "schematicPinUuid": pin_uuid,''',
        '''                "pin": pin_number,
                **(
                    {
                        "pinName": _string(raw_terminal.get("pin_name")),
                        "pinType": _string(raw_terminal.get("pin_type")),
                    }
                    if "pin_type" in raw_terminal
                    else {}
                ),
                "netUid": net_entry["netUid"],
                "netName": name,
                "schematicNetName": name,
                "schematicPinUuid": pin_uuid,''',
    ),
)

_PATCHED: types.ModuleType | None = None


def patched_service() -> types.ModuleType:
    """dev's semantic_index_service with the a1 additions, as a private module."""

    global _PATCHED
    if _PATCHED is None:
        import app.services.semantic_index_service as original

        text = Path(original.__file__).read_text(encoding="utf-8")
        for old, new in _PATCHES:
            if text.count(old) != 1:
                raise RuntimeError(f"a1 patch anchor not found exactly once in semantic_index_service.py: {old[:60]!r}")
            text = text.replace(old, new)
        module = types.ModuleType("prism_parity_semantic_index_a1")
        module.__file__ = original.__file__
        exec(compile(text, f"{original.__file__} (a1 patch)", "exec"), module.__dict__)
        _PATCHED = module
    return _PATCHED


def stand_in_revision_key(today_key: str) -> str:
    """64-hex stand-in for the bundle's design revision key (as in the example)."""

    return hashlib.sha256(b"prism.revision_key.a1\0stand-in\0" + today_key.encode()).hexdigest()


def _repo_page(ctx: Context):
    root = ctx.src.resolve()

    def relative_schematic_page(project_file: Path, source_path: object) -> str:
        # Today's _relative_schematic_page (sis:557-564), against the repository root.
        if source_path is None:
            return ""
        path = Path(str(source_path))
        try:
            return path.resolve().relative_to(root).as_posix()
        except (OSError, ValueError):
            return path.name

    return relative_schematic_page


def capture(ctx: Context) -> Result:
    from app.core.config import settings

    if settings.KICAD_MONKEY_PYTHONPATH.strip():
        raise RuntimeError("KICAD_MONKEY_PYTHONPATH is set: the golden must use the installed kicad_monkey wheel")
    from app.services import path_config_service

    service = patched_service()
    pro = ctx.project_file.resolve()
    today_page = service._relative_schematic_page
    today_stored = path_config_service._stored_settings
    service._relative_schematic_page = _repo_page(ctx)
    # Offline: Prism-stored project settings live in the workspace database; a
    # golden is built from the committed sources alone (no stored settings).
    path_config_service._stored_settings = lambda project_path, anchor: None
    try:
        key = service.source_revision_key_for_project_file(pro)
        payload: dict[str, Any] = service.build_semantic_index(pro, source_revision_key=key, commit=None)
    except Exception as error:  # noqa: BLE001 - today's failure is the recorded outcome
        raise NotCaptured(f"build_semantic_index raised {type(error).__name__}: {error}") from error
    finally:
        service._relative_schematic_page = today_page
        path_config_service._stored_settings = today_stored

    for diagnostic in payload["assembly"]["diagnostics"]:
        if "path" in diagnostic:
            diagnostic["path"] = ctx.repo_path(diagnostic["path"])

    document = {"schema": SCHEMA, "sourceRevisionKey": stand_in_revision_key(key)}
    for name in BODY:
        document[name] = payload[name]
    notes = [f"today's a0 sourceRevisionKey {key} (stand-in derived from it)"]
    if ctx.project_dir:
        notes.append(f"D9: pages and diagnostic paths prefixed with project directory {ctx.project_dir!r}")
    return Result(document=document, notes=notes)
