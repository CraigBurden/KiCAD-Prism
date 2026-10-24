"""Golden for ``projections/system-interface.json`` (``prism.system_interface.v1``).

Field map ``system-interface.md``, "How a golden is produced from today's code":
dev's ``interface_extractor.extract_interface`` (``EXTRACTOR_VERSION`` 8) on the
design loaded as ``extract_for_revision`` loads it (``load_configured_design``),
then the member form: ``projectId``, ``commit`` and ``extractor`` removed.
Nothing else changes; the digest is today's.
"""

from __future__ import annotations

import hashlib
import json
from types import SimpleNamespace

from . import Context, NotCaptured, Result

MEMBER = "system-interface"
ENVELOPE = ("projectId", "commit", "extractor")


def recompute_digest(document: dict) -> str:
    """``interface_extractor._digest``: sha256 over the canonical body (conventions.md §14)."""

    body = {k: v for k, v in document.items() if k not in ("digest", *ENVELOPE)}
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def capture(ctx: Context) -> Result:
    from app.services.systems import interface_extractor as ie

    pro = ctx.project_file.resolve()
    snapshot = SimpleNamespace(root=pro.parent, project_file=pro, commit=None)
    try:
        design = ie.load_configured_design(snapshot)
        payload = ie.extract_interface(pro, project_id="prj_parity", commit=None, design=design)
    except Exception as error:  # noqa: BLE001 - today's failure is the recorded outcome
        raise NotCaptured(f"extract_interface raised {type(error).__name__}: {error}") from error
    document = {key: value for key, value in payload.items() if key not in ENVELOPE}
    if recompute_digest(document) != document["digest"]:
        raise RuntimeError("today's digest does not match its own canonical body")
    return Result(document=document, notes=[f"digest {document['digest']}"])
