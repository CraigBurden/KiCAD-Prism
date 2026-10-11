"""The stackup frame: where each physical layer sits and which face is drawn.

One place for the rules both geometry lanes share. The Rust lane implements
the same rules in ``native/prism-kicad-native/src/stackup_frame.rs``; both are
held to one golden, ``native/prism-kicad-native/src/testdata/stackup-frame.json``.

Two frames are involved:

* the *centred* frame: the physical stack placed top first, centred on z = 0;
* KiCad's *board* frame: the centred frame shifted (not scaled) so the bottom
  copper's inner face sits at 0. KiCad's exported board body spans the inner
  faces of the outer copper and its outer copper sits on those faces; scaling
  the full board thickness onto the body pushed outer copper inside it.

A layer is drawn by its outward face: the top face above the board centre,
the bottom face below it.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

STACKUP_FRAME_GOLDEN = (
    Path(__file__).resolve().parents[2]
    / "native"
    / "prism-kicad-native"
    / "src"
    / "testdata"
    / "stackup-frame.json"
)


def role_for_layer(name: str, raw_type: str = "") -> str:
    """A layer's role from its name, then its declared type."""

    if name == "Board":
        return "dielectric"
    if name == "Edge.Cuts":
        return "outline"
    if name.endswith(".Cu"):
        return "copper"
    if name.endswith(".Mask"):
        return "soldermask"
    if name.endswith(".Paste"):
        return "paste"
    if name.endswith(".SilkS"):
        return "silkscreen"
    if name.endswith(".Fab"):
        return "fabrication"
    if raw_type:
        return raw_type
    return "drawing"


def normalize_physical_role(role: str) -> str:
    normalized = str(role or "").lower()
    if normalized == "solderpaste":
        return "paste"
    if normalized in {"core", "prepreg"}:
        return "dielectric"
    return normalized


def stackup_role(name: str, type_name: str = "") -> str:
    """The role of a physical stackup layer."""

    return normalize_physical_role(role_for_layer(name, type_name))


def centred_layer_z(thicknesses: Iterable[float]) -> list[float]:
    """Centre z of each layer of a physical stack, top first, centred on 0."""

    values = [max(0.0, float(value or 0.0)) for value in thicknesses]
    cursor = sum(values) / 2.0  # compensated since Python 3.12; Rust matches it
    centres: list[float] = []
    for thickness in values:
        cursor -= thickness / 2.0
        centres.append(cursor)
        cursor -= thickness / 2.0
    return centres


def board_frame(copper: Iterable[tuple[float, float]]) -> tuple[float, float] | None:
    """``(offset, body_thickness)`` for copper layers given as ``(centred z, thickness)``.

    Centred z plus ``offset`` is KiCad's board frame: the bottom copper's inner
    face at 0. ``None`` with fewer than two copper layers. ``body_thickness``
    is the gap between the outer copper layers' inner faces, and may be zero or
    less for a malformed stackup; callers decide what that means.
    """

    ordered = sorted(copper, key=lambda layer: layer[0])
    if len(ordered) < 2:
        return None
    bottom_inner = ordered[0][0] + ordered[0][1] / 2.0
    top_inner = ordered[-1][0] - ordered[-1][1] / 2.0
    return -bottom_inner, top_inner - bottom_inner


def outward_sign(centred_z_mm: float) -> int:
    """+1 to draw a layer's top face, -1 for its bottom face."""

    return 1 if centred_z_mm >= 0 else -1


def outward_face_z(z_mm: float, thickness_mm: float, sign: int) -> float:
    return z_mm + sign * thickness_mm / 2.0


def stackup_frame(stackup: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Place a physical stackup in the board frame.

    ``stackup`` lists ``{name, type, thicknessMm}`` top first. Each result
    carries the layer's role, centred z, board-frame (runtime) z, drawn face
    sign and drawn face z.
    """

    thicknesses = [max(0.0, float(layer.get("thicknessMm") or 0.0)) for layer in stackup]
    centres = centred_layer_z(thicknesses)
    roles = [stackup_role(str(layer.get("name") or ""), str(layer.get("type") or "")) for layer in stackup]
    frame = board_frame(
        (centre, thickness)
        for centre, thickness, role in zip(centres, thicknesses, roles)
        if role == "copper"
    )
    offset = frame[0] if frame and frame[1] > 0 else 0.0
    result = []
    for layer, centre, thickness, role in zip(stackup, centres, thicknesses, roles):
        runtime = centre + offset
        sign = outward_sign(centre)
        result.append(
            {
                "name": str(layer.get("name") or ""),
                "role": role,
                "zMm": centre,
                "runtimeZMm": runtime,
                "surfaceSign": sign,
                "faceZMm": outward_face_z(runtime, thickness, sign),
            }
        )
    return result
