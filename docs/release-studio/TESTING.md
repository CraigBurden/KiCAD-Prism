# Release Studio testing

Run tests from `KiCAD-Prism/backend` unless a command says otherwise. Focused
tests exercise the configuration, canonicalization, dossier, documents, API,
vendor, closure, forge publish, and UI contracts.

```sh
cd backend
python -m unittest tests.test_release_studio_config -v
python -m unittest tests.test_release_studio_canonicalization -v
python -m unittest tests.test_release_studio_closure -v
python -m unittest tests.test_release_studio_dossier -v
python -m unittest tests.test_release_studio_documents -v
python -m unittest tests.test_release_studio_api -v
python -m unittest tests.test_release_studio_vendors -v
python -m unittest tests.test_forge_publish_service -v
```

```sh
cd frontend
npm test -- --run src/components/release-studio/
```

Schema, retention, and persistence tests require a disposable PostgreSQL
database. Set `TEST_POSTGRES_URL` to that isolated database and leave
`PRISM_DATABASE_URL` unset; tests must never target the application database.

```sh
cd backend
TEST_POSTGRES_URL=postgresql://.../release_studio_test \
PRISM_DATABASE_URL= \
python -m unittest tests.test_release_studio_schema_migration tests.test_release_studio_retention -v
```

The live executor suite additionally proves the baked executor identity, KiCad
`10.0.4`, release fixtures, and generated canonicalization semantics. It is
strict: zero tests, a skip, failure, or error fails the run. CI runs that
image rebuild on PRs and pushes to `dev`/`main`, on a nightly schedule, and
on `workflow_dispatch` — not on every `feature/release-studio` commit.

```sh
cd backend
python -m tests.release_studio_live_runner
```

## Fixture provenance

`fixtures/release-studio/synthetic` is repository-authored. `usb-pd` is
vendored from USB-PD-Trigger-Board commit
`3ec8f9cc79c874c433551f96889fce49c4eaac94` under MIT; `cynthion` is vendored
from cynthion-hardware tag `r1.4.0`, commit
`13aa71c2fb0be3837cd2ec580ee5d2c25fc1c678`, under CERN-OHL-P-2.0. Their
licenses remain with the fixtures. Generated outputs are made in temporary
directories; fixture roots contain source and recorded CLI behaviour, not
handwritten manufacturing outputs.

The synthetic fixture has the explicit `default`, `dnp-led`, and
`assembly-reduced` variants. Its manifest's `entrypoints` mapping is the
authority for each fixture's project, board, schematic, and jobset paths.

## Manual acceptance matrix

| Area | Acceptance check |
| --- | --- |
| Revision and configure | Select a commit from the list; confirm the backend APIs receive only its full immutable SHA. Confirm `HEAD` and a matching listed short SHA normalize before lookup/build. |
| Build and history | Start a build, observe live steps, fail one build and cancel another, and confirm both retained attempts cannot be published. |
| Inspect | Preview document PDFs, inspect members/evidence/digests, and download dossier/evidence/member material. |
| Closure warnings | A host-absolute `fp-lib-table` URI warns and still completes the build. |
| Artifacts and vendor | Verify JLC readiness requires Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and `cpl.xlsx`. |
| Publish | With `GITHUB_TOKEN`/`GITLAB_TOKEN`, create a Release on the imported remote and confirm the zip is attached. A clone-only token shows a write-scope error. |
