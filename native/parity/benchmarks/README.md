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
