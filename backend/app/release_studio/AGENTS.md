# Release Studio

Turns a project revision into a reproducible, auditable release: fabrication
outputs, assembly data, generated documents, and a signed dossier. Read
`AGENTS.md` at the repository root first.

## The determinism contract

Release Studio's value is that two builds from the same closed inputs,
configuration, and pinned toolchain produce the same technical bytes and
digests. Almost every rule here follows from that. **Anything you add that
varies between equivalent runs will break a release diff, and it may appear only
as a spurious change in a customer's release comparison.**

- Nothing time-varying, host-varying, or run-varying may be hashed into a
  digest. `dossier.py` enumerates keys that must never appear anywhere in the
  manifest tree — build ids and wall clocks among them. Timing data is evidence,
  recorded but never hashed.
- Recorded `argv` must be host-path independent (`steps.py`). It feeds the
  domain digest, so an absolute path on your machine poisons the result.
- New configuration keys must be explicitly classified in `config/digests.py`.
  The sets are deliberately explicit; an unclassified key is a silent
  determinism hole.
- `canonical/` defines byte-level serialization. A behavior change can move
  released byte identities; require an explicit compatibility/versioning plan
  rather than silently updating expected output.

## Layout

| Path | Role |
| --- | --- |
| `pipeline.py` | Build waves (`run_build_waves`: checks, positions, BOM, assembly Cruncher, vendors, artwork, in that order) plus the phase skeleton and progress tracking. Phases: closure, checks, assembly, documents, package. |
| `steps.py` | Individual `kicad-cli` invocations. Each step is its own process. |
| `jobset.py` | KiCad jobset translation, pinned to the KiCad 10.0.4 executor. |
| `closure.py` · `closure_references.py` · `closure_models.py` | Resolves every input a build depends on. Outputs are never closure inputs. `closure_references.py` finds the path references in design files; `closure_models.py` resolves and hashes 3D models the way KiCad opens them. |
| `inputs.py` · `source.py` | Input discovery and revision sourcing. |
| `document_pipeline.py` | Gathers typed `DocumentInputs` and writes composed sheets as a member-producing step. |
| `documents/` | Document generation — `documents/acquisition.py` acquires views, `documents/engine.py` composes sheets, the rest render. |
| `canonical/` | Byte-canonical encoding and JSON. Frozen by default. |
| `config/` | Schema, loader, substitution, and digest classification. `config/loader.py` holds the one configuration-location rule: `<project>/.prism/release-studio/`, references relative to the project, returned as repository paths when read at a commit; no repository-root fallback for a subproject. |
| `vendors/` | Vendor-specific packaging (`vendors/jlcpcb.py`, `vendors/pack.py`, `vendors/registry.py`). |
| `dossier.py` | Final manifest and evidence assembly. |
| `projections.py` · `semantic.py` · `impedance.py` | Derived views over the build. |
| `ipc.py` | Worker process boundary. |

Every `kicad-cli` and `kicad-cruncher` run goes through the tools
`execute_build` hands down (`backend/app/services/kicad_tools.py`): discovery,
per-process isolation, timeout, tee and cancellation live there, not at the
call site. Tests replace them with a fake or with the replay adapter
(`backend/app/services/kicad_tool_replay.py`);
`backend/tests/test_release_studio_replay_build.py` runs a whole build that way.

Entry point is `backend/app/services/release_studio_build_service.py`
(`run_release_studio_build_job`, kind `RELEASE_BUILD`), registered by
`backend/app/services/job_handlers.py`. A build attempt's row lives in
`backend/app/services/release_build_attempts.py`: it succeeds inside the job's
completion transaction, and the kind's end hook ends it as the job ended when
the build process died first (cancel, crash, lost lease). Only a candidate's
newest attempt moves the candidate's status. `execute_build` reads as closure →
waves (`pipeline.run_build_waves`) → documents → assemble → record.

Around the build:
- `backend/app/services/release_studio_config_service.py`: the configuration
  registry, publishing a configuration to the tracked branch, and reads at a
  commit.
- `backend/app/services/release_studio_publish_service.py`: `ReleasePublisher`
  (approve → package → forge → record) and `BuildArchives` (digest-checked
  dossier/evidence reads, logs, vendor packs). Forges are adapters in
  `backend/app/services/forge_publish_service.py` (`forge_for`). This is not
  the trackers' forge seam (`backend/app/services/trackers/`): different
  credentials, different purpose. Tests drive it with
  `backend/tests/release_publish_fakes.py`.

## Traps

- **Unknown KiCad job types must never default to hermetic** (`jobset.py`). The
  typed registry is pinned to the KiCad 10.0.4 executor; classify a new type
  from the pinned source and its input behavior.
- **Steps do not overlap.** They used to; `steps.py` documents why they no
  longer do. Do not reintroduce concurrency across `kicad-cli` processes.
- **A missing view degrades one sheet, never the document set**
  (`documents/acquisition.py`). Failure handling here is deliberately partial —
  do not "fix" it into an all-or-nothing abort. Complete composition failure
  still fails the documents step (`document_pipeline.py`).
- **Consumers must not infer terminal state from the evidence index**
  (`backend/app/api/release_studio.py`). Ask the job, not the artifacts.

## Tests

`backend/tests/test_release_studio_documents.py`,
`backend/tests/test_release_studio_schema_migration.py`,
`backend/tests/test_release_studio_canonicalization.py`, and
`backend/tests/test_release_studio_closure.py` are load-bearing suites. The
canonicalization suite is the determinism guard; if it fails, do not adjust the
expectation to match your output until you understand why the bytes moved.
