---
name: prism-quality-gate
description: Run the KiCAD Prism check suites in dependency order and interpret failures. Use before claiming any change is complete, and before opening a PR against dev.
---

# Prism quality gate

Runs every check the `dev` gate runs. A passing subset is not a passing gate —
do not report a change as verified until this completes.

## Order matters

Dependencies first. A backend failure makes frontend results meaningless when
the change spans both.

### 1. Backend

```bash
backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'
```

If `backend/venv` is missing, run `python scripts/sync_dependencies.py` first.
PostgreSQL integration tests need `TEST_POSTGRES_URL` pointing at a **disposable**
database — never a production one. Tests requiring it skip silently when unset,
so an all-pass run without `TEST_POSTGRES_URL` has not exercised the Postgres
paths. Say so when reporting results.

### 2. Frontend

```bash
cd frontend && npm run lint && npm test && npm run build && npm run build:panel
```

`build:panel` is a separate Vite build for the Remote Symbol Provider panel
(`frontend/src/panel/`). It is easy to forget and breaks independently of the
main build.

### 3. Semantic viewer

Only when `kicad-prism-viewer/` changed:

```bash
cd kicad-prism-viewer && npm run test:gltf && npm run test:viewer && npm run build
```

### 4. Compose configuration

Only when a compose file, `.env.example`, or a deployment path changed:

```bash
docker compose --env-file .env.example -f docker-compose.yml config --quiet
docker compose --env-file .env.example -f docker-compose.yml -f docker-compose.proxy.yml config --quiet
```

### 5. Release contract

Only when release tooling or `deploy/release/` changed:

```bash
python3 -m unittest scripts.test_release_bundle
```

### 6. Agent documentation

Always, when any file moved or was renamed:

```bash
python3 scripts/check_agent_docs.py
```

## Interpreting failures

- **React Doctor warnings are not gate failures.** The gate checks the baseline
  in `frontend/react-doctor-baseline.json` (currently 0 errors / 0 warnings).
  Raising that ceiling needs a stated reason; lowering it is free.
- **A canonicalization test failure in Release Studio is a determinism break.**
  Do not update the expected bytes to match your output until you understand why
  they moved. See `backend/app/release_studio/AGENTS.md`.
- **Frontend test failures after a viewer change** may be a stale vendored
  build. Run the `prism-viewer-rebuild` skill before assuming a real regression.

## Reporting

State which suites ran, which were skipped and why, and quote actual failure
output. Never report "all tests pass" when a suite was skipped for a missing
environment variable.
