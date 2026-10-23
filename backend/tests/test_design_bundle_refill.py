"""The zone refill cache: identical inputs refill once, across jobs.

The cache key is the board, its project and rules files, the script and the
worker's KiCad; a failed refill publishes nothing.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest

from app.core.config import settings
from app.services.design_bundle import kicad_steps

CONFIG = {"project_file": "p.kicad_pro", "board": "p.kicad_pcb"}


def _sources(root: Path) -> Path:
    root.mkdir(parents=True)
    (root / "p.kicad_pcb").write_text("(kicad_pcb (version 20260206))", encoding="utf-8")
    (root / "p.kicad_pro").write_text("{}", encoding="utf-8")
    (root / "p.kicad_dru").write_text("(version 1)", encoding="utf-8")
    return root


@pytest.fixture(autouse=True)
def refill(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> list[str]:
    """A scratch cache root, a fixed worker KiCad, and pcbnew recorded instead of run."""

    monkeypatch.setattr(settings, "KICAD_PROJECTS_ROOT", str(tmp_path / "projects"))
    monkeypatch.setattr(kicad_steps, "worker_kicad_version", lambda: "10.0.7")
    calls: list[str] = []

    def run(script: str, board: Path, *, timeout: float, cancel) -> None:
        calls.append(board.name)
        board.write_text(board.read_text(encoding="utf-8") + "(refilled)\n", encoding="utf-8")

    monkeypatch.setattr(kicad_steps, "_run_python", run)
    return calls


def _refill(sources: Path, work: Path) -> tuple[Path, bool]:
    return kicad_steps.refill_board(sources, CONFIG, work)


def test_a_second_refill_of_the_same_inputs_is_a_hit(tmp_path: Path, refill: list[str]) -> None:
    sources = _sources(tmp_path / "src")
    first, first_hit = _refill(sources, tmp_path / "w1")
    assert first_hit is False
    second, second_hit = _refill(sources, tmp_path / "w2")
    assert second_hit is True
    assert refill == ["p.kicad_pcb"]  # pcbnew ran once
    assert second.read_bytes() == first.read_bytes()
    assert second.read_text(encoding="utf-8").endswith("(refilled)\n")


@pytest.mark.parametrize("change", ["board", "project", "rules", "version"])
def test_changing_an_input_is_a_miss(
    tmp_path: Path, refill: list[str], monkeypatch: pytest.MonkeyPatch, change: str
) -> None:
    sources = _sources(tmp_path / "src")
    _refill(sources, tmp_path / "w1")
    if change == "board":
        (sources / "p.kicad_pcb").write_text("(kicad_pcb (version 20260206) (edited))", encoding="utf-8")
    elif change == "project":
        (sources / "p.kicad_pro").write_text('{"edited": true}', encoding="utf-8")
    elif change == "rules":
        (sources / "p.kicad_dru").write_text("(version 2)", encoding="utf-8")
    else:
        monkeypatch.setattr(kicad_steps, "worker_kicad_version", lambda: "10.0.8")
    _, hit = _refill(sources, tmp_path / "w2")
    assert hit is False
    assert len(refill) == 2  # the changed key ran pcbnew again


@pytest.mark.parametrize("failure", [kicad_steps.KicadStepFailed, kicad_steps.KicadSourceUnreadable])
def test_a_failed_refill_caches_nothing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, failure: type[kicad_steps.KicadStepFailed]
) -> None:
    sources = _sources(tmp_path / "src")

    def fail(script: str, board: Path, *, timeout: float, cancel) -> None:
        raise failure("pcbnew failed")

    monkeypatch.setattr(kicad_steps, "_run_python", fail)
    with pytest.raises(failure):
        _refill(sources, tmp_path / "w1")
    root = kicad_steps.refill_cache_root()
    assert not root.exists() or list(root.iterdir()) == []


def test_retention_drops_unused_entries_and_dead_part_files(tmp_path: Path) -> None:
    root = kicad_steps.refill_cache_root()
    root.mkdir(parents=True)
    now = time.time()
    old, fresh = root / "old.kicad_pcb", root / "fresh.kicad_pcb"
    part, live_part = root / ".x.kicad_pcb.1.part", root / ".y.kicad_pcb.2.part"
    for path, age in ((old, 40 * 86400), (fresh, 60), (part, 7200), (live_part, 60)):
        path.write_bytes(b"x" * 10)
        os.utime(path, (now - age, now - age))
    report = kicad_steps.prune_refill_cache(unused_before=now - 30 * 86400, now=now)
    assert report == {"removed": 1, "bytes": 20}
    assert sorted(p.name for p in root.iterdir()) == [live_part.name, fresh.name]
