# Release Studio testing

Run tests from `KiCAD-Prism/backend` unless a command says otherwise. Focused
tests exercise the configuration, canonicalization, policy, dossier,
documents, API, vendor, and UI contracts; the aggregate project test command
remains the appropriate CI gate.

```sh
cd backend
python -m unittest tests.test_release_studio_config -v
python -m unittest tests.test_release_studio_canonicalization -v
python -m unittest tests.test_release_studio_policy -v
python -m unittest tests.test_release_studio_dossier -v
python -m unittest tests.test_release_studio_documents -v
python -m unittest tests.test_release_studio_api -v
python -m unittest tests.test_release_studio_vendors -v
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
| Revision and configure | Select a commit from the list; confirm the backend configuration/build APIs receive only its full immutable 40-character SHA. Confirm `HEAD` and an exactly matching listed short SHA immediately normalize to that SHA before lookup/build, while arbitrary branches and refs are rejected; choose a committed configuration/variant; confirm an exact normalized document is labeled/copyable only when available and otherwise the UI clearly labels its values as a summary/template. |
| Build and history | Start a build, observe live steps, reopen archived logs, fail one build and cancel another safely, and confirm both distinct terminal attempts retain diagnostics/logs, remain selectable, and cannot progress to evaluation, approval, or release. Confirm cancelled diagnostics/logs explicitly retain `cancelled` status. |
| Inspect | Preview document PDFs, inspect members/evidence/digests, and download dossier/evidence/member material. |
| Governance | Evaluate a build, show an unsupported outcome as blocking, create a build-bound waiver, test two-person/self-exception evidence, and confirm only original approver/admin can rescind. |
| Authority | Confirm only an admin can create or satisfy a required policy role under the current global-role model; a policy label is not an identity supplied by the UI. |
| Release | Confirm normal release rejects blockers, unsupported outcomes, and missing role/domain approval; confirm a reasoned admin override is attested. |
| Artifacts and vendor | Verify JLC readiness requires Gerbers, drill, `bom.csv`, `cpl.csv`, `bom.xlsx`, and `cpl.xlsx`; distinguish the derived upload ZIP from signed dossier members. |
| Verify/share | Download a release archive, verify with an independently trusted public key, create a web share, and revoke it. |
| Signing-key rotation | Confirm recorded key material cannot be changed for an existing key ID and a rotation uses a new key ID. |
| Audit/recovery | Verify the audit chain, restore a test backup with artifacts, and offline-verify a retained release after restore. |
