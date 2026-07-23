# Design Comparison benchmark

`scripts/benchmark_design_compare.py` measures the two publication milestones
of a cold Design Comparison build:

- `initialReadyMs`: Schematic and BOM are usable.
- `totalReadyMs`: PCB and Stackup have joined the result.

The JSON report contains nested wall/CPU spans for every revision and stage,
cache timings, snapshot sizes, peak RSS, generator identity, and the complete
progress sequence. Use an isolated cache for cold runs; `--warm` immediately
repeats the staged revision load against the populated cache.

## Local kicad-monkey Docker run

Build and start the backend with the adjacent optimized checkout:

```sh
docker compose \
  -f docker-compose.yml \
  -f docker-compose.local-kicad-monkey.yml \
  build backend

docker compose \
  -f docker-compose.yml \
  -f docker-compose.local-kicad-monkey.yml \
  up -d --no-deps backend
```

Then benchmark a project mounted below `/app/projects`:

```sh
docker exec kicad-prism-backend \
  /app/venv/bin/python /app/scripts/benchmark_design_compare.py \
  /app/projects/type1/JTYU-OBC/OBC.kicad_pro \
  --base 234e065 \
  --compare aebbfeb \
  --initial-workers 2 \
  --pcb-workers 2 \
  --warm \
  --output /tmp/design-compare-benchmark.json
```

The defaults match the production scheduler. They can also be controlled by:

- `PRISM_DESIGN_COMPARE_MAX_INITIAL_WORKERS` (default `2`)
- `PRISM_DESIGN_COMPARE_MAX_PCB_WORKERS` (default `2`)
- `PRISM_DESIGN_COMPARE_MAX_REVISION_WORKERS` is the shared fallback when a
  stage-specific value is not set; use `1` for a low-memory operational mode.

Both values are bounded to the two requested revisions. PCB workers scan
native source geometry only; they do not retain concurrent parsed PCB ASTs.

## Reading a report

Compare `elapsedMs` with `cpuMs` for each long event. A large wall-time increase
without a comparable CPU-time increase indicates host/container starvation,
not a parser regression. Do not use runs that overlap Docker image builds,
indexing jobs, or other CPU-heavy work as release-gate evidence.

The primary cold-run gates for JTYU-OBC are:

- Schematic+BOM must publish before PCB processing begins.
- `totalReadyMs` should be at most 70,000 ms in an uncontended target runtime.
- A warm run must use `full-cache-hit`/`pcb-cache-reused` marks rather than
  executing semantic or geometry generation again.
- An unchanged `.kicad_pcb` must produce zero PCB physical changes even when
  schematic UUIDs or component identities changed.

## Native ARM64 reference

An uncontended native ARM64 Docker run on 2026-07-24, using the local
`kicad_monkey` 2026.7.17 working tree, produced:

- Schematic + BOM ready: `24,583 ms`
- PCB + Stackup ready: `33,415 ms`
- Immediate warm-cache run: `1,832 ms`
- Peak RSS: `875,290,624` bytes
- Changes: 1,297 schematic, 95 BOM, 0 PCB

The two schematic semantic passes overlapped at approximately 21 seconds each,
and the two PCB geometry scans overlapped at approximately 7.1 seconds each.
The full structured report is generated as
`/tmp/design-compare-staged-arm64-clean.json` by the command above.
