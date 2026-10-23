"""The board steps come from one ``kicad-cli jobset run``: one board load, not five.

On EDA-04903 the five board steps took 122 s as separate kicad-cli runs and
68 s as one jobset, every output identical (DRC up to item order). KiCad drops
a jobset it cannot read without failing, so a step whose output did not appear
runs on its own; DRC checks schematic parity on both paths.
"""

from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from app.release_studio import steps
from app.services.kicad_tools import ToolResult
from tests.kicad_tool_fakes import FakeTool

BOARD_STEPS = steps.CATALOGUE_WAVE_BOARD


def _kicad(*, jobset_writes: bool = True):
    """A kicad-cli that writes a jobset's outputs the way KiCad names them, and any single step."""

    def run(args, cwd=None, env=None, **_kwargs):  # noqa: ANN001
        args = list(args)
        if args[:2] == ["jobset", "run"]:
            # KiCad stages every output under the temp directory and leaves it there.
            staged = Path((env or {})["TMPDIR"]) / "c8506cbb"
            staged.mkdir()
            (staged / "leftover.gbr").write_text("G04*", encoding="utf-8")
            if not jobset_writes:
                return ToolResult(0, "0 jobs succeeded, 0 job failed", "")
            document = json.loads(Path(args[3]).read_text(encoding="utf-8"))
            jobs = {job["id"]: job for job in document["jobs"]}
            stem = Path(args[4]).stem
            for output in document["outputs"]:
                folder = Path(cwd) / output["settings"]["output_path"]
                folder.mkdir(parents=True, exist_ok=True)
                job = jobs[output["only"][0]]
                name = {
                    "pcb_drc": "drc.json",
                    "pcb_export_stats": "board-stats.json",
                    "pcb_export_pos": "positions-all-pos.csv",
                }.get(job["type"])
                if name:
                    (folder / name).write_text("{}", encoding="utf-8")
                elif job["type"] == "pcb_export_gerbers":
                    (folder / f"{stem}-F_Cu.gtl").write_text("G04*", encoding="utf-8")
                    (folder / f"{stem}-job.gbrjob").write_text("{}", encoding="utf-8")
                else:
                    (folder / f"{stem}.drl").write_text("M48", encoding="utf-8")
            return ToolResult(0, f"{len(jobs)} jobs succeeded, 0 job failed", "")
        out = Path(args[args.index("--output") + 1])
        if args[1] in ("export",) and args[2] in ("gerbers", "drill"):
            out.mkdir(parents=True, exist_ok=True)
            (out / "single").write_text("x", encoding="utf-8")
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text("{}", encoding="utf-8")
        return ToolResult(0, "", "")

    return FakeTool(run)


class BoardJobsetTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        self.project = self.root / "project"
        self.project.mkdir()
        for name in ("demo.kicad_pcb", "demo.kicad_pro", "demo.kicad_sch"):
            (self.project / name).write_text("(x)", encoding="utf-8")
        self.output = self.root / "outputs"

    def _run(self, tool, *, variant: str = "", project_dir: Path | None = None):
        return steps.run_step_catalogue(
            closure_root=self.root,
            board_rel="demo.kicad_pcb",
            schematic_rel="demo.kicad_sch",
            output_root=self.output,
            tool=tool,
            only=BOARD_STEPS,
            variant=variant,
            board_path=self.project / "demo.kicad_pcb",
            schematic_path=self.project / "demo.kicad_sch",
            project_dir=self.project if project_dir is None else project_dir,
        )

    def test_one_jobset_writes_every_board_output_where_the_steps_did(self) -> None:
        tool = _kicad()
        outputs = {output.step_id: output for output in self._run(tool)}

        self.assertEqual([call["args"][:2] for call in tool.calls], [["jobset", "run"]])
        self.assertEqual(set(outputs), set(BOARD_STEPS))
        self.assertTrue((self.output / "assembly/positions.csv").is_file())
        self.assertTrue((self.output / "evidence/drc.json").is_file())
        self.assertTrue((self.output / "fabrication/gerbers/demo-F_Cu.gtl").is_file())
        self.assertTrue((self.output / "fabrication/drill/demo.drl").is_file())
        self.assertFalse((self.project / steps.JOBSET_DIR).exists())
        temp = Path(tool.calls[0]["env"]["TMPDIR"])
        self.assertEqual(temp.parent, self.project / steps.JOBSET_DIR)
        self.assertFalse(temp.exists())
        drc = outputs["drc"].normalized_argv
        self.assertEqual(drc[:4], ("kicad-cli", "jobset", "run", "pcb_drc"))
        self.assertTrue(json.loads(drc[4])["parity"])
        self.assertNotIn(str(self.root), " ".join(drc))

    def test_a_jobset_kicad_ignored_falls_back_to_one_run_per_step(self) -> None:
        tool = _kicad(jobset_writes=False)
        outputs = {output.step_id: output for output in self._run(tool)}

        self.assertEqual(set(outputs), set(BOARD_STEPS))
        self.assertEqual(len(tool.calls), 1 + len(BOARD_STEPS))
        drc_call = next(call["args"] for call in tool.calls if call["args"][:2] == ["pcb", "drc"])
        self.assertIn("--schematic-parity", drc_call)
        self.assertIn("--schematic-parity", outputs["drc"].normalized_argv)

    def test_a_variant_build_runs_step_by_step(self) -> None:
        tool = _kicad()
        self._run(tool, variant="lite")
        self.assertFalse(any(call["args"][:2] == ["jobset", "run"] for call in tool.calls))


if __name__ == "__main__":
    unittest.main()
