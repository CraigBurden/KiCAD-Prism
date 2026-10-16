"""Normalise an extracted footprint to a library footprint.

A footprint copied out of a board is stored the way the board placed it, not the
way a library stores it. Two placements leak through into the bytes:

* A part on the back of the board is stored mirrored: back copper, silk and fab
  layers, mirrored text justification, and geometry that is *not* a simple
  coordinate negation - KiCad also carries a 180 degree orientation and reorders
  items. Importing those bytes straight into the library yields a footprint that
  renders back-to-front in previews and is wrong for any other board.
* A part rotated on the board stores every pad's and text's angle *including*
  the placement angle, so a part placed at 90 degrees imports with its pads
  rotated by 90 degrees. The placement position and angle live on the
  footprint's own ``(at x y angle)``; the extractor keeps only the angle, and
  the footprint is returned to orientation 0 here.

Both transforms are reproduced with KiCad's own geometry - ``FOOTPRINT::Flip``
and ``FOOTPRINT::SetOrientationDegrees(0)`` - rather than with regular
expressions over the S-expression text. A hand-rolled geometric flip or rotation
would corrupt pad positions silently, which is far worse than the wrong preview
it set out to fix.

`pcbnew` is loaded in a subprocess. It is a heavyweight native module that
segfaults rather than raising when misused, and an import worker must not die
with it.
"""

from __future__ import annotations

import logging
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

NORMALIZE_TIMEOUT_SECONDS = 60


@dataclass(frozen=True)
class NormalizedFootprint:
    payload: bytes
    changed: bool
    error: str = ""
    flipped: bool = False
    rotated: bool = False
    rotation_degrees: float = 0.0


def _looks_back_side(payload: bytes) -> bool:
    """Cheap check so front-side footprints never pay for a subprocess."""
    head = payload[:4096].decode("utf-8", errors="replace")
    for line in head.splitlines()[:12]:
        stripped = line.strip()
        if stripped.startswith("(layer "):
            return stripped.startswith('(layer "B.')
    return False


def _footprint_rotation_degrees(payload: bytes) -> float:
    """The footprint's own placement angle, or 0.0 when it carries none.

    Only the top-level ``(at …)`` of the footprint counts. A pad's or a
    property's angle is relative to the placed footprint and must not be
    mistaken for the placement rotation, so the scan tracks parenthesis depth
    and ignores everything nested below the footprint's direct children.
    """
    text = payload[:8192].decode("utf-8", errors="replace")
    depth = 0
    in_string = False
    escaped = False
    for index, char in enumerate(text):
        if in_string:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == '"':
                in_string = False
            continue
        if char == '"':
            in_string = True
        elif char == "(":
            depth += 1
            follows = text[index + 3:index + 4]
            if depth == 2 and text.startswith("(at", index) and follows in ("", " ", "\t", "\n", ")"):
                end = text.find(")", index)
                tokens = text[index + 1:end].split()
                if len(tokens) >= 4:
                    try:
                        return float(tokens[3])
                    except ValueError:
                        return 0.0
                return 0.0
        elif char == ")":
            depth -= 1
    return 0.0


def normalize_footprint(payload: bytes, target_name: str) -> NormalizedFootprint:
    """Return library footprint bytes: front side, orientation 0, or unchanged.

    A footprint already on the front at orientation 0 is returned verbatim
    without spawning KiCad. Anything else is rewritten by KiCad itself, which
    owns the geometry that a correct flip and un-rotation require.
    """
    flipped = _looks_back_side(payload)
    rotation = _footprint_rotation_degrees(payload)
    if not flipped and rotation == 0:
        return NormalizedFootprint(payload=payload, changed=False)

    safe_name = "".join(char for char in target_name if char.isalnum() or char in "-_.") or "footprint"

    with tempfile.TemporaryDirectory(prefix="prism-fp-normalize-") as tmp:
        root = Path(tmp)
        source = root / "source.pretty"
        output = root / "output.pretty"
        source.mkdir()
        output.mkdir()
        (source / f"{safe_name}.kicad_mod").write_bytes(payload)

        try:
            completed = subprocess.run(
                [_python_executable(), "-m", "app.services.kicad_footprint_normalizer",
                 str(source), str(output), safe_name],
                capture_output=True,
                text=True,
                timeout=NORMALIZE_TIMEOUT_SECONDS,
            )
        except (subprocess.SubprocessError, OSError) as error:
            logger.warning("Footprint normalisation could not run: %s", error)
            return NormalizedFootprint(
                payload=payload, changed=False, error=str(error), flipped=flipped, rotated=rotation != 0
            )

        if completed.returncode != 0:
            detail = (completed.stderr or "").strip().splitlines()
            message = detail[-1] if detail else f"exit code {completed.returncode}"
            logger.warning("Footprint normalisation failed for %s: %s", target_name, message)
            return NormalizedFootprint(
                payload=payload, changed=False, error=message, flipped=flipped, rotated=rotation != 0
            )

        produced = output / f"{safe_name}.kicad_mod"
        if not produced.is_file():
            return NormalizedFootprint(
                payload=payload,
                changed=False,
                error="normaliser produced no footprint",
                flipped=flipped,
                rotated=rotation != 0,
            )
        return NormalizedFootprint(
            payload=produced.read_bytes(),
            changed=True,
            flipped=flipped,
            rotated=rotation != 0,
            rotation_degrees=rotation,
        )


def _python_executable() -> str:
    """Interpreter that can import `pcbnew`: the backend runs on KiCad's Python."""
    return sys.executable


def _main(argv: list[str]) -> int:
    """Subprocess entry point. Runs inside the KiCad runtime, never in the API process."""
    if len(argv) != 3:
        print("usage: kicad_footprint_normalizer <source.pretty> <output.pretty> <name>", file=sys.stderr)
        return 2
    source_dir, output_dir, name = argv

    import pcbnew  # noqa: PLC0415 - deliberately loaded only in this subprocess

    # A footprint must belong to a board before it is transformed; pcbnew segfaults
    # on an orphaned footprint rather than raising.
    board = pcbnew.CreateEmptyBoard()
    footprint = pcbnew.FootprintLoad(source_dir, name)
    if footprint is None:
        print(f"could not load footprint {name}", file=sys.stderr)
        return 3
    board.Add(footprint)

    # Undo the placement flip first: `Flip` mirrors about the footprint origin and
    # re-adds a 180 degree orientation, so the un-rotation has to follow it to
    # land on the library's front-side orientation 0.
    if footprint.IsFlipped():
        footprint.Flip(footprint.GetPosition(), False)
    footprint.SetOrientationDegrees(0)

    plugin = pcbnew.PCB_IO_MGR.FindPlugin(pcbnew.PCB_IO_MGR.KICAD_SEXP)
    plugin.FootprintSave(output_dir, footprint)
    return 0


if __name__ == "__main__":
    raise SystemExit(_main(sys.argv[1:]))
