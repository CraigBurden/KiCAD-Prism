---
name: prism-quality-gate
description: Select, run, and report the KiCAD Prism checks required by a change, then compare coverage with the dev quality gate. Use before declaring work complete or opening a pull request.
---

# Verify a Prism change

`CONTRIBUTING.md` documents supported local commands;
`.github/workflows/dev-quality-gate.yml` is the authority for required CI. Run
focused tests while iterating, then the complete suites for every affected
area. Do not describe a scoped run as the full quality gate.

If dependencies are missing, run `python scripts/sync_dependencies.py` rather
than installing ad hoc versions.

## Agent guidance

When an `AGENTS.md`, `CLAUDE.md`, `SKILL.md`, or referenced path changed:

```bash
python3 scripts/check_agent_docs.py
```

## Backend

```bash
backend/venv/bin/python -m compileall -q backend/app
cd backend
uv run --no-project --python venv/bin/python --with-requirements ../requirements/test.txt \
  python -m pytest -n auto -rs
```

This is CI's command: pytest (from `requirements/test.txt`) runs the
`unittest` suite in parallel, about 6 minutes instead of 14 serially. CI splits
it over three runners with `--shard k/3`: whole modules, balanced by
`backend/tests/.test_durations.json`. When the CI shards drift apart, refresh
that file from a run's `backend-results-*` artifacts with
`python scripts/update_backend_test_durations.py <results.xml…>`. Locally
`uv` layers the test tools over the venv, so the venv still matches
`runtime.lock`.

While iterating, add `--testmon` to run only the tests affected by your Python
changes. Fixtures, migrations' SQL and environment changes are invisible to it,
so finish with a full run. Each xdist worker gets its own copy of the three
databases (`backend/tests/conftest.py`). `-rs` lists skips: the two PostgreSQL
integration modules must not appear there.

PostgreSQL integration tests require `TEST_POSTGRES_URL` pointing to a
disposable database distinct from the application database. They can skip when
it is absent, so record whether they actually ran.

## Frontend

```bash
cd frontend
npm run lint          # ESLint keeps a cache in node_modules/.cache/eslint
npm run scan:gate
npm test              # while iterating: npx vitest run --changed <base branch>
npm run build
npm run build:panel
```

`build:panel` is the separate Remote Symbol Provider build. React Doctor's
baseline is enforced by `scan:gate`; raw `npm run scan` is diagnostic only.

## Semantic viewer

When `kicad-prism-viewer/` or its shared runtime dependencies changed:

```bash
cd kicad-prism-viewer
npm run test:viewer
npm run test:harness
npm run build
```

The semantic viewer build synchronizes
`kicad-prism-viewer/dist/prism-semantic-viewer.js` into the served
`frontend/public/prism-semantic-viewer.js` and updates its digest cache key in
`frontend/index.html`. Include both tracked changes when the generated output
moves; CI rejects a build that leaves either file dirty.

The vendored ECAD viewer in `frontend/public/ecad-viewer.js` is a different
subsystem. Use `.agents/skills/prism-viewer-rebuild/SKILL.md` for it.

## Native parser and design bundle

When `native/` changed:

```bash
cd native
cargo fmt --all --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo run -p prism-kicad-codegen -- --check
cargo deny check licenses sources
scripts/rust_hygiene.sh    # size/complexity ratchet; no new violations
```

A change to a contract (`native/src/tsp/prism/`, `native/contracts/`) also runs
`node scripts/contracts/check-contract.mjs` (Node 24.22.0). A change to a bundle
member's output runs the parity checks from `native/parity/` (`python3 -m
unittest discover -s tests`, `python3 -m prism_parity selftest`, and
`node parity/validate.mjs parity/goldens` from `native/`); a deliberate output
change updates the member's golden in the same pull request. Rebuild the
analytic WASM (`npm run build:analytic-wasm` in `kicad-prism-viewer/`) when the
crates it compiles change. Rust is pinned to 1.98.0 by
`native/rust-toolchain.toml`.

CI runs these as `native-lint`, `native-workspace`, `native-platforms`,
`native-wasm32`, `native-hygiene` and `native-parity`. Locally, use
`native/scripts/rust_hygiene.sh`, not `native/scripts/ci_native_hygiene.sh` (which reinstalls
its tools).

## Deployment and release contracts

For Compose, deployment, installer, backup, or release-bundle changes, run the
matching commands in `CONTRIBUTING.md` and compare them with the
`deployment-config` job in `.github/workflows/dev-quality-gate.yml`; that CI job
checks more overlays than the common two-command local smoke test.

For dependency or runtime identity changes, reproduce the `dependency-identity`
job. For Release Studio executor changes, the containerized live-KiCad job is
the acceptance gate and may be left to CI if the required image is unavailable
locally.

## Which jobs a pull request runs

`scripts/ci_changes.py` picks the jobs from the changed paths: a job runs when
its own areas change, or a file its tests read by name from elsewhere. CI or
toolchain-pin changes run everything. When you add a test that reads a file
outside its area, refer to that file by name so the rule sees it, and run
`python3 -m unittest scripts.test_ci_changes`.

## Report coverage

Report each suite as passed, failed, or not run, with the reason. Mention missing
database, Docker, KiCad, or sibling-repository coverage explicitly. The PR is
merge-ready only when the required GitHub quality gate passes; local results do
not replace it.
