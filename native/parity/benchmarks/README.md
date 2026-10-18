# Benchmarks: today's Python producers vs the native bundle

`bench_python.py` times today's Python producers on the parity cases: wall time per call and peak RSS. It covers the production entry points (`prod:*`) and every capture module (`golden:<member>`). It is the **baseline** the native bundle is compared with after Wave 4. Run it before any C-step removes a Python path, so the baseline exists.

- Run it on a quiet machine: no builds or other heavy processes. The report records the load average at the start and at the end.
- Each (case, target) runs in a fresh interpreter. The first call is cold, and imports are timed apart; `--repeat` calls follow, with nothing cached between them.
- `rs-cynthion` is the stress case.

```sh
# inside the backend environment (Python 3.12, kicad_monkey of requirements/), Node 24 on PATH
python native/parity/benchmarks/bench_python.py --today . --prepared <dir with <case>/src> \
    --out native/parity/benchmarks/results/<yyyy-mm-dd>-<host>.json
```

Results go in `results/`, one file per run, named by date and host.

The full comparison after Wave 4 adds:
- the time for `prism-kicad bundle build` per design;
- the request latency of the endpoints that parsed on demand, before and after their C-step;
- the worker's peak RSS.

## Baseline: 2026-10-17, before the first C-step

`results/2026-10-17-ithelpdesk-macbook-pro-arm64.json` records:
- **Machine:** Apple silicon, 10 CPUs, Python 3.12.13, kicad_monkey 2026.9.7.
- **Run:** all 33 parity cases, `--repeat 3`, on sources prepared by `prism_parity` (KiCad 10.0.6 upgrade).
- **Load:** no builds or tests were running, but desktop apps and a VM were. The load average was 9.0 at the start and 6.0 at the end, so treat differences under about 10 % as noise.
- **Refusals:** `dv-malformed` is refused by the three production paths that load the design, as today does (`SexprTreeError`).

Best of 3 per call, summed over the cases each target ran on:

| Target | cases | total best (s) | slowest case, best (s) | max peak RSS (MiB) |
|---|---|---|---|---|
| `prod:km-load` | 32 | 4.19 | rs-cynthion 3.35 | 384 |
| `prod:semantic-index` | 32 | 4.98 | rs-cynthion 3.78 | 402 |
| `prod:variant-catalog` | 33 | 0.12 | rs-cynthion 0.02 | 78 |
| `prod:system-interface` | 32 | 4.47 | rs-cynthion 3.59 | 386 |
| `golden:semantic-index` | 33 | 5.17 | rs-cynthion 3.91 | 399 |
| `golden:system-interface` | 33 | 4.53 | rs-cynthion 3.64 | 383 |
| `golden:project` | 33 | 33.78 | rs-cynthion 14.97 | 353 |
| `golden:stackup` | 33 | 10.12 | rs-cynthion 8.52 | 356 |
| `golden:placements` | 33 | 8.75 | rs-cynthion 7.45 | 416 |
| `golden:occurrences` | 33 | 33.20 | rs-cynthion 24.87 | 496 |
| `golden:board-objects` | 33 | 6.68 | rs-cynthion 3.08 | 415 |
| `golden:route-metrics` | 33 | 4.39 | rs-cynthion 1.21 | 404 |

The `golden:*` rows are capture modules: W0 prototypes and adapters around today's code, with Node children for the Design Comparison members. Only `prod:*` are production paths. The full comparison after Wave 4 sets `prism-kicad bundle build --stage parse` (all members from one parse) against these numbers.

## Cold Design Comparison: 2026-10-18 (amendment C2r §5)

`cold_compare.py` times one comparison from nothing to every tab filled, fabrication included. Each path ran in its own throwaway container from the worker image (10 CPUs, 8 GB), with a Linux `prism-kicad` built in `rust:1.98.0-bookworm`. The input is EDA-04903 at two commits of a scratch repository: a 57 MB KiCad 8 board, with one footprint moved between the two. The worker image predates `jsonschema`, so the run stubs the backend's schema module; nothing it reads or stores is validated, which does not affect the timings.

| | first result | every tab | largest process |
|---|---|---|---|
| today's path | 28.1 s | 62.6 s | 1,703 MB |
| bundle path, before the speed-ups | 145.3 s | 209.3 s | 1,967 MB |
| bundle path, now | 50.9 s | 63.3 s | 2,691 MB |

What the bundle path does cold, and what changed:
- **KiCad upgrade.** Every file of a KiCad 8 design is upgraded first (cli-spec.md §9.4), which today's path never does. Each file is now upgraded on its own copy, eight at a time, and a file both revisions share is upgraded once. Before: 29.9 s per revision, one revision after the other (52.5 s + 55.2 s). Now: 18.8 s for both revisions together. The upgraded bytes are identical to the old one-at-a-time procedure on EDA-04903 (43 files) and cynthion's KiCad 7 commit (18 files).
- **`compare` from two source trees.** 32.1 s, 2.7 GB. It parses the two revisions one after the other. Parsing them at once took 23.5 s but 3.6 GB, close to its 4 GiB heap cap, so it was not kept.
- **Fabrication.** Each revision's Gerbers are now plotted in parallel, while `compare` runs (34.2 s each, alongside), followed by the image diff (12.4 s). Before, the plots ran one after the other once `compare` had returned. Plotting after `compare` instead gives the first result 8 s sooner but every tab 10 s later.

When both commits already have bundles, `compare` reads them instead (bundle mode): 2.9–3.5 s in the same container. That is the path a comparison takes once K2's warm bundles exist. Cold, the first result stays slower than today's, because of the upgrade and the two full parses.

### The same comparison on the upgraded design

To separate the upgrade from everything else, the same edit was repeated on a copy of EDA-04903 already saved by KiCad 10, so neither revision needs upgrading. Runs alternate between the paths and follow each other in the same container, so the machine's load is shared between them.

| | first result | every tab | largest process |
|---|---|---|---|
| today's path | 23.1 s, 25.0 s | 61.3 s, 60.6 s | 1.7 GB |
| bundle path (revisions in turn, Gerbers alongside `compare`) | 26.7 s, 32.0 s | 40.2 s, 42.9 s | 2.2–2.4 GB |
| bundle path, revisions read at once, Gerbers after `compare` | 28.5 s, 25.3 s | 62.5 s, 57.9 s | 3.7 GB |

Without the upgrade, the first result is within a few seconds of today's, and every tab arrives about 20 s sooner. Reading both revisions at once saves little here and costs 1.4 GB, so the kept order is the first bundle-path row.

### Source-tree `compare` without the JSON round trip

In source-tree mode, `compare` used to write each revision's semantic index and board objects out as JSON and parse them back. It now takes the typed documents straight from the parse. Outputs are byte-identical: the 18 recorded pairs, EDA-04903, and the generator pin.

| | `compare`, source-tree mode | peak memory |
|---|---|---|
| Mac, three alternated runs, before | 9.06–10.08 s | 1,988–2,233 MB |
| Mac, after | 8.23–8.71 s | 2,224–2,479 MB |
| container, upgraded EDA-04903, two alternated rounds, before | 30.6 s, 26.4 s | 1,889 MB, 1,919 MB |
| container, after | 31.4 s, 24.2 s | 2,021 MB, 2,177 MB |

On the Mac it is about 9% faster. In the container, where the Gerber plots run at the same time, the difference is within run-to-run noise. Either way it costs 130–260 MB of peak memory, because both revisions' documents are held until the comparison runs.
