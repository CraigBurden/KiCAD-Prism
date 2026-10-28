"""The replay adapter: R0 recordings, recorded outputs, and misses."""

from __future__ import annotations

import json
import os
import tempfile
import time
import unittest
from pathlib import Path

from app.services.kicad_tool_replay import RecordingTool, ReplayTool
from app.services.kicad_tools import ToolError, ToolResult
from tests.kicad_tool_fakes import FakeTool
from tests.release_studio_support import fixture_recording


class ReplayToolTests(unittest.TestCase):
    def setUp(self) -> None:
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)

    def test_an_r0_recording_replays_its_exit_status_and_output(self) -> None:
        fixture, output = self.root / "fixture", self.root / "output"
        replay = ReplayTool(fixture_recording("synthetic"), {"fixture": fixture, "output": output})
        result = replay.run(
            ["pcb", "drc", "--output", str(output / "synthetic-drc.json"), str(fixture / "synthetic.kicad_pcb")],
            timeout=5,
        )
        self.assertEqual((result.returncode, result.stdout), (0, "Processed synthetic.kicad_pcb"))
        self.assertEqual(replay.version(), "10.0.4")
        self.assertEqual(replay.misses, [])

    def test_an_unrecorded_run_fails_and_is_listed(self) -> None:
        replay = ReplayTool(fixture_recording("synthetic"), {"fixture": self.root})
        result = replay.run(["pcb", "render", str(self.root / "x.kicad_pcb")], timeout=5)
        self.assertEqual(result.returncode, 127)
        self.assertEqual(replay.misses, [("pcb", "render", "<fixture>/x.kicad_pcb")])

    def test_a_recording_replays_its_files_under_another_root(self) -> None:
        source, target = self.root / "first", self.root / "second"
        for root in (source, target):
            (root / "out").mkdir(parents=True)

        def plot(args, **_kwargs):
            Path(args[args.index("--output") + 1]).write_text("gerber bytes")
            return ToolResult(0, f"Plotted to '{args[args.index('--output') + 1]}'.\n")

        recorder = RecordingTool(FakeTool(plot, version="10.0.4"), {"staging": source})
        recorder.run(["pcb", "export", "gerbers", "--output", str(source / "out" / "b.gbr")], timeout=5)
        recording = self.root / "rec" / "recording.json"
        recorder.write(recording, fixture="test")
        stored = json.loads(recording.read_text())
        self.assertEqual(stored["commands"][0]["stdout"], "Plotted to '<staging>/out/b.gbr'.\n")
        self.assertNotIn(str(source), recording.read_text())

        replay = ReplayTool(recording, {"staging": target})
        result = replay.run(["pcb", "export", "gerbers", "--output", str(target / "out" / "b.gbr")], timeout=5)
        self.assertTrue(result.ok)
        self.assertEqual((target / "out" / "b.gbr").read_text(), "gerber bytes")
        # Each recorded run answers once.
        again = replay.run(["pcb", "export", "gerbers", "--output", str(target / "out" / "b.gbr")], timeout=5)
        self.assertEqual(again.returncode, 127)

    def test_an_output_timed_before_the_run_is_still_recorded(self) -> None:
        # The kernel's file clock can trail time.time_ns(); the output's time is
        # set a second back to stand for that. The untouched input is not recorded.
        staging = self.root / "staging"
        (staging / "out").mkdir(parents=True)
        board = staging / "b.kicad_pcb"
        board.write_text("board")
        os.utime(board, ns=(1, 1))

        def plot(args, **_kwargs):
            output = Path(args[args.index("--output") + 1])
            output.write_text("gerber bytes")
            past = time.time_ns() - 1_000_000_000
            os.utime(output, ns=(past, past))
            return ToolResult(0, "")

        recorder = RecordingTool(FakeTool(plot), {"staging": staging})
        recorder.run(["pcb", "export", "gerbers", "--output", str(staging / "out" / "b.gbr"), str(board)], timeout=5)
        self.assertEqual(list(recorder.commands[0]["outputs"]), ["<staging>/out/b.gbr"])

    def test_a_host_path_outside_the_roots_cannot_be_recorded(self) -> None:
        recorder = RecordingTool(FakeTool(), {"staging": self.root / "staging"})
        with self.assertRaisesRegex(ToolError, "host path"):
            recorder.run(["pcb", "render", "/somewhere/else.kicad_pcb"], timeout=5)


if __name__ == "__main__":
    unittest.main()
