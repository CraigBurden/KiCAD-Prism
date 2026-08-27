# Release Studio

Turns a project revision into a reproducible, auditable release: fabrication
outputs, assembly data, generated documents, and a signed dossier. Roughly
19,000 lines. Read `AGENTS.md` at the repository root first.

## The determinism contract

Release Studio's value is that two builds of the same revision produce the same
bytes. Almost every rule here follows from that. **Anything you add that varies
between runs will break a release diff, and it will not fail loudly — it shows
up as a spurious change in a customer's release comparison.**

- Nothing time-varying, host-varying, or run-varying may be hashed into a
  digest. `dossier.py` enumerates keys that must never appear anywhere in the
  manifest tree — build ids and wall clocks among them. Timing data is evidence,
  recorded but never hashed.
- Recorded `argv` must be host-path independent (`steps.py`). It feeds the
  domain digest, so an absolute path on your machine poisons the result.
- New configuration keys must be explicitly classified in `config/digests.py`.
  The sets are deliberately explicit; an unclassified key is a silent
  determinism hole.
- `canonical/` defines byte-level serialization. Change it and every previously
  published digest becomes unreproducible. Treat it as frozen unless the change
  is the entire point of the PR.

## Layout

| Path | Role |
| --- | --- |
| `pipeline.py` | Phase skeleton and progress tracking. Phases: closure, checks, assembly, documents, package. |
| `steps.py` | Individual `kicad-cli` invocations. Each step is its own process. |
| `jobset.py` | KiCad jobset translation, pinned to the KiCad 10.0.4 executor. |
| `closure.py` | Resolves every input a build depends on. Outputs are never closure inputs. |
| `inputs.py` · `source.py` | Input discovery and revision sourcing. |
| `documents/` | Document generation — `documents/engine.py` orchestrates, the rest render. |
| `canonical/` | Byte-canonical encoding and JSON. Frozen by default. |
| `config/` | Schema, loader, substitution, and digest classification. |
| `vendors/` | Vendor-specific packaging (`vendors/jlcpcb.py`, `vendors/pack.py`, `vendors/registry.py`). |
| `dossier.py` | Final manifest and evidence assembly. |
| `projections.py` · `semantic.py` · `impedance.py` | Derived views over the build. |
| `ipc.py` | Worker process boundary. |

Entry point is `backend/app/services/release_studio_build_service.py`
(`run_release_studio_build_job`), dispatched from
`backend/app/services/job_handlers.py`.

## Traps

- **The executor is pinned and must never become hermetic by default**
  (`jobset.py`). Changing this changes output bytes.
- **Steps do not overlap.** They used to; `steps.py` documents why they no
  longer do. Do not reintroduce concurrency across `kicad-cli` processes.
- **A missing view degrades one sheet, never the document set**
  (`documents/engine.py`). Failure handling here is deliberately partial — do
  not "fix" it into an all-or-nothing abort.
- **Consumers must not infer terminal state from the evidence index**
  (`backend/app/api/release_studio.py`). Ask the job, not the artifacts.

## Tests

`backend/tests/test_release_studio_documents.py`,
`backend/tests/test_release_studio_schema_migration.py`,
`backend/tests/test_release_studio_canonicalization.py`, and
`backend/tests/test_release_studio_closure.py` are the load-bearing suites —
together about 5,000 lines. The canonicalization suite is the determinism guard;
if it fails, do not adjust the expectation to match your output until you
understand why the bytes moved.
