# Analytic renderer perf harness

Measures the analytic board in headless Chrome on a real WebGPU device, for
comparing builds before and after a renderer change. It reuses the pixel-diff
harness's Chrome driver, element builder and PNG code, and injects
`gpu-meter.js` before any page script; the viewer itself is unchanged.

```sh
cd kicad-prism-viewer
node tests/browser/perf/run.mjs \
  --board eda=<analytic bundle dir> --board usbpd=<analytic bundle dir> \
  --build base=origin/feature/native-design-bundle --build candidate=worktree \
  --repeat 2
```

An analytic bundle dir holds `bundle.json` (schema
`prism.viewer_3d.analytic.a0`) and the `board.kmpack` it names. Frame-rate
limits are lifted, so frames come as fast as the GPU finishes them.

| Option | Meaning |
|---|---|
| `--board name=dir` | An analytic bundle. Repeatable. |
| `--build name=spec` | As the pixel-diff runner: `worktree`, a git ref, or a built `.js`. Repeatable; the first is the reference. Default: `worktree`. |
| `--scale s`, `--size WxH` | Device pixel ratio (default 2) and viewport (default 1280x800). |
| `--orbit-ms n` | Length of each measured orbit (default 3000). |
| `--repeat n` | Rounds over all builds (default 1). |
| `--only a,b` | Only these orbit cases; skips interactions and idle. |
| `--capture` | Capture views instead of measuring, and diff them against the reference build. |
| `--out dir`, `--headed` | Output directory (default `out/<timestamp>`, gitignored); show the window. |

## What it measures

Fields are synthetic: two `prism.sim.field` grids covering every copper slice
of the board at 0.2 mm, made in the page.

- **Orbits** of `solid`, `solid-zoomed`, `solid-far`, `separated-0.3`,
  `exploded`, `substrate-off`, `exploded-zoomed`, `field-exploded` (copper
  only, as Simulation Studio shows a run) and `field-relief`. Per frame: GPU
  time (timestamp queries on every pass, summed per submit), the frame
  callback's CPU time, draws, vertices of direct draws, stencil references,
  scissors, pipelines, `writeBuffer` calls, upload KB and GPU objects created.
  Then how long frames keep coming once the drag ends (the camera easing out).
  The CPU p95 includes waits for the GPU; read p50 as the encode cost.
- **Interactions** after the view settles: a field switch (a, b, a, b), a
  pick at the centre, the relief turned on, and field switches with the
  relief up. Each reports the call's time, time to the next drawn frame, long
  tasks, GPU time, uploads and objects created. A pick does not redraw, so its
  time to frame is the idle refresh; read its call time.
- **Idle**: one second with nothing changing, after the camera settles, with
  and without a highlighted net.

`--capture` draws `solid`, `solid-zoomed`, `exploded`, `separated-0.3`, the
two fields and a switch back, and the relief on both fields. For each it
stores a PNG, the overlay's range and the values `analyticAt` reads at three
points, and reports pixels that differ (and beyond 8 levels) against the
reference build.

Compare numbers only between builds measured in the same run on the same
machine, with nothing else using the GPU.
