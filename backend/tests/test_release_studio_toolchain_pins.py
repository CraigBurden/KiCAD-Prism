"""The backend and the viewer must ask for one kicad-monkey, not two.

Both requirement files install into the same virtualenv in the image, so a
disagreement between their pins is resolved silently by whichever ``uv pip
install`` runs last -- and the backend's own release_studio parsing would then
run against a version nobody chose.  Cheaper to fail here.
"""

from __future__ import annotations

import re
import unittest
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
_BACKEND_REQUIREMENTS = _REPO_ROOT / "backend" / "requirements.txt"
_VIEWER_REQUIREMENTS = _REPO_ROOT / "kicad-prism-viewer" / "requirements-runtime.txt"


def _pinned_version(requirements: Path, distribution: str) -> str | None:
    pattern = re.compile(
        rf"^{re.escape(distribution)}\s*==\s*(?P<version>[^\s#]+)",
        re.IGNORECASE,
    )
    for raw in requirements.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        match = pattern.match(line)
        if match:
            return match.group("version")
    return None


class ToolchainPinTests(unittest.TestCase):
    def test_the_backend_declares_the_kicad_monkey_it_imports(self) -> None:
        """An undeclared import is only satisfied by accident of image layering."""
        self.assertIsNotNone(
            _pinned_version(_BACKEND_REQUIREMENTS, "kicad-monkey"),
            msg=(
                "app/release_studio imports kicad_monkey directly, so "
                f"{_BACKEND_REQUIREMENTS.name} must pin it"
            ),
        )

    def test_the_backend_and_viewer_pins_agree(self) -> None:
        backend = _pinned_version(_BACKEND_REQUIREMENTS, "kicad-monkey")
        viewer = _pinned_version(_VIEWER_REQUIREMENTS, "kicad-monkey")
        self.assertEqual(
            backend,
            viewer,
            msg=(
                "backend/requirements.txt and "
                "kicad-prism-viewer/requirements-runtime.txt install into the "
                "same venv; their kicad-monkey pins must move together"
            ),
        )


if __name__ == "__main__":
    unittest.main()
