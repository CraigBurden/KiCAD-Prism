"""The seeded upgrade (cli-spec.md §9.4): isolated per file, run at once, shared within one comparison."""

from __future__ import annotations

import threading
from pathlib import Path

import pytest

from app.services.design_bundle import kicad_steps

CONFIG = {"project_file": "p.kicad_pro", "root_schematic": "p.kicad_sch", "board": "p.kicad_pcb"}
FORMATS = {"board": 20260206, "schematic": 20260306}


def _tree(root: Path, child_text: str = "child") -> Path:
    root.mkdir(parents=True)
    (root / "p.kicad_pro").write_text("{}", encoding="utf-8")
    (root / "p.kicad_pcb").write_text("(kicad_pcb (version 20240108) board)", encoding="utf-8")
    (root / "p.kicad_sch").write_text(
        '(kicad_sch (version 20231120) (property "Sheetfile" "child.kicad_sch"))', encoding="utf-8"
    )
    (root / "child.kicad_sch").write_text(f"(kicad_sch (version 20231120) {child_text})", encoding="utf-8")
    (root / "current.kicad_sch").write_text("(kicad_sch (version 20260306))", encoding="utf-8")
    return root


@pytest.fixture
def upgrades(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, bool, bool]]:
    """Stand in for KiCad: record (name, board, project copied beside) and mark the bytes."""

    calls: list[tuple[str, bool, bool]] = []
    lock = threading.Lock()

    def isolated(target: Path, project: Path | None, board: bool, *, cancel) -> bytes:
        with lock:
            calls.append((target.name, board, project is not None))
        return b"upgraded:" + target.read_bytes()

    monkeypatch.setattr(kicad_steps, "_upgrade_isolated", isolated)
    return calls


def test_every_older_closure_file_is_upgraded_in_place(tmp_path: Path, upgrades) -> None:
    src = _tree(tmp_path / "src")
    result = kicad_steps.upgrade_sources(src, CONFIG, FORMATS)
    assert result == [
        {"path": "p.kicad_pcb", "upgraded_from_version": 20240108},
        {"path": "p.kicad_sch", "upgraded_from_version": 20231120},
        {"path": "child.kicad_sch", "upgraded_from_version": 20231120},
    ]
    assert (src / "child.kicad_sch").read_bytes().startswith(b"upgraded:")
    assert (src / "current.kicad_sch").read_text(encoding="utf-8").startswith("(kicad_sch")  # not in the closure
    # The board reads the project file; a schematic only the project file of its own stem.
    assert sorted(upgrades) == [("child.kicad_sch", False, False), ("p.kicad_pcb", True, True), ("p.kicad_sch", False, True)]


def test_two_trees_sharing_a_cache_upgrade_a_shared_file_once(tmp_path: Path, upgrades) -> None:
    base, head = _tree(tmp_path / "base"), _tree(tmp_path / "head", child_text="edited")
    cache = kicad_steps.UpgradeCache()
    threads = [threading.Thread(target=kicad_steps.upgrade_sources, args=(tree, CONFIG, FORMATS), kwargs={"cache": cache})
               for tree in (base, head)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()
    names = sorted(name for name, _, _ in upgrades)
    assert names == ["child.kicad_sch", "child.kicad_sch", "p.kicad_pcb", "p.kicad_sch"]  # the edited child twice
    assert (base / "p.kicad_sch").read_bytes() == (head / "p.kicad_sch").read_bytes()


def test_a_failed_upgrade_fails_the_step(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    def fail(target: Path, project: Path | None, board: bool, *, cancel) -> bytes:
        raise kicad_steps.KicadStepFailed(f"KiCad's Python failed on {target.name}")

    monkeypatch.setattr(kicad_steps, "_upgrade_isolated", fail)
    with pytest.raises(kicad_steps.KicadStepFailed):
        kicad_steps.upgrade_sources(_tree(tmp_path / "src"), CONFIG, FORMATS)


def test_a_current_tree_runs_nothing(tmp_path: Path, upgrades) -> None:
    src = tmp_path / "src"
    src.mkdir()
    (src / "p.kicad_pro").write_text("{}", encoding="utf-8")
    (src / "p.kicad_sch").write_text("(kicad_sch (version 20260306))", encoding="utf-8")
    assert kicad_steps.upgrade_sources(src, {"project_file": "p.kicad_pro", "root_schematic": "p.kicad_sch"}, FORMATS) == []
    assert upgrades == []
