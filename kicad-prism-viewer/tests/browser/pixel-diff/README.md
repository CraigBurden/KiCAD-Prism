# Pixel-diff and frame-time harness (VT-00)

This harness checks that a renderer change leaves the 3D view unchanged where it should. It
loads `<prism-semantic-viewer>` builds in headless Chrome on real bundles from disk, captures
named views, and diffs them pixel by pixel. With `--perf` it also measures frame times.

It needs no Prism server, no login and no dependencies: Node 24 and a local Chrome are enough.
Every load gets a fresh browser context, so the OPFS asset cache starts empty and all loads come
from the network. Cached and network loads can otherwise differ by coplanar draw-order ties.

```sh
cd kicad-prism-viewer
node tests/browser/pixel-diff/run.mjs \
  --board obc=../data/projects/.kicad-prism/semantic-visualizer/<project>/<revision> \
  --build base=origin/dev --build candidate=worktree \
  --perf
```

## Options

| Option | Meaning |
|---|---|
| `--board name=dir` | A bundle directory (the one holding `bundle.json`, or its revision parent). Repeatable. |
| `--build name=spec` | `worktree` (this checkout's `viewer/src`, uncommitted changes included), a git ref (`origin/dev`, a SHA), or a built `.js` file. Repeatable. The first build is the reference. |
| `--views a,b` | Any of `default` (the loaded camera), `exploded` (separation 0.5), `top`, `bottom` (the viewer's `Z` / `Shift+Z` keys). Default: `default,exploded,top`. Axis views run last, because they move the camera for good. |
| `--strict a,b` | Views that must match the reference within `--max-px` (default 0). Default: all three. Keep `exploded` strict: outer copper sits under the solder mask, so a copper-only change shows only there. |
| `--repeat n` | Loads per build (default 2). Load 0 against load 1 of the same build is the noise floor. |
| `--load` | Time each load from the element's mount: `ready` (the viewer's own event), the first drawn frame, `components-loaded`, the last frame that changed, and the bytes fetched (Chrome's encoded lengths). Printed as a table and stored as `loads` in `summary.json`. |
| `--warm` | Before each measured load, load the bundle once in the same page, so the browser's OPFS asset cache holds it (and the analytic board's lowered slices): a board opened again. |
| `--perf` | One extra load per build: orbit for `--orbit-ms` (default 4000) with synthetic drags from the loaded camera. |
| `--size WxH`, `--scale s` | Viewport (default 1280x800) and device pixel ratio (default 1). |
| `--tolerance n` | A per-channel delta of up to n counts as equal (default 0, exact). |
| `--timeout s` | Settle timeout per view (default 240). |
| `--headed` | Show the Chrome window. |
| `--out dir` | Output directory (default `tests/browser/pixel-diff/out/<timestamp>`, gitignored). |

## Output

- `<board>/<build>-<view>-<load>.png`: each capture.
- `<board>/diff-*.png`: for every pair that differs, the reference dimmed with the differing
  pixels in red.
- `summary.json`: the builds (with commits), the bundles (with generator builds), every diff,
  the perf results and the failures.
- The exit code is 1 on any failure. Failures are:
  - a strict view over `--max-px`;
  - a page error;
  - a view that never settles.

Builds from V2a on draw the board with 4× multisampling (`renderer.js`, from the analytic spike), so a
mesh-path capture compared with a build before V2a differs at shape edges only. Read such a
diff by its visible share, not its pixel count.

## How a capture works

`probe.js` loads before the element. It wraps `requestAnimationFrame` so that after each frame
callback it draws the WebGPU canvas into a 2D canvas. This has to happen inside the frame,
because a WebGPU canvas reads back blank once the frame is presented. Frames the viewer didn't
render read back blank and are skipped.

A view is settled when both of these hold:
- no request has been in flight for 1 s;
- the last 3 rendered frames are identical. The viewer redraws once a second when idle.

## Frame-time numbers (`--perf`)

| Column | Meaning |
|---|---|
| `int p50 / p95` | rAF intervals during the orbit, in ms. |
| `cpu p95` | The viewer's own per-frame CPU time (`getStats().frameCpuP95Ms`). |
| `gpu p50 / p95` | Time from `GPUQueue.submit` to `onSubmittedWorkDone`, per submit. It includes queueing, so it is an upper bound on GPU work, not a timestamp query. |
| `tris`, `MB` | Triangles drawn and GPU memory, from `getStats()`. |

Compare frame times only between builds measured in the same run, on the same machine. Leave
nothing else rendering 3D while it runs.

## Unit tests

```sh
npm run test:harness
```

The PNG encoder and the diff are covered there. The browser half has no unit
tests. It was checked by planting a one-count copper colour change in the main
shader: `exploded` caught it (84,698 px) and the run failed (VT-00 record).
