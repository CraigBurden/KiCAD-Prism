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
| `closure.py` · `closure_references.py` · `closure_models.py` | Resolves every input a build depends on. Outputs are never closure inputs. `closure_references.py` finds the path references in design files; `closure_models.py` resolves and hashes 3D models the way KiCad opens them. With a ready bundle the closure reads the project projection's `documents` and `references` through `ProjectReferences`, so no KiCad text is parsed in Python. |
| `inputs.py` · `source.py` | Input discovery and revision sourcing. |
| `document_pipeline.py` | Gathers typed `DocumentInputs` and writes composed sheets as a member-producing step. |
| `documents/` | Document generation — `documents/acquisition.py` acquires views, `documents/engine.py` composes sheets, the rest render. |
| `canonical/` | Byte-canonical encoding and JSON. Frozen by default. |
| `config/` | Schema, loader, substitution, and digest classification. `config/loader.py` holds the one configuration-location rule: `<project>/.prism/release-studio/`, references relative to the project, returned as repository paths when read at a commit; no repository-root fallback for a subproject. |
| `vendors/` | Vendor-specific packaging (`vendors/jlcpcb.py`, `vendors/pack.py`, `vendors/registry.py`). With `PRISM_DESIGN_SOURCE_RELEASE_STUDIO=bundle` and a ready parse stage, `vendors/generate.py` runs `prism-kicad vendor run <id>` over the design bundle (`vendors/cli.py`); every other case keeps `kicad-cruncher`. The JLCPCB `--config` is converted from `jlcpcb.config.jsonc` and validated against `prism.vendor.jlcpcb.config.a0`. |
| `dossier.py` | Final manifest and evidence assembly. |
| `projections.py` · `semantic.py` · `impedance.py` | Derived views over the build. |
| `bundle_projections.py` | The five board projections (`stackup`, `population`, `testpoints`, `designators`, `variants`) rebuilt from design-bundle members when `PRISM_DESIGN_SOURCE_RELEASE_STUDIO=bundle`: pure functions of the member documents, with `board_projections_from_design` the one already-checked-bundle seam. Also the a0-compatible semantic view (`semantic_index_a0`, `semantic_scope_from_design`): the four a1 fields are dropped recursively so the scope fingerprint equals today's (C3b). |
| `bundle_design.py` | The one readiness answer for a bundle-mode build (`readiness`, `for_candidate`): stages `parse`, `board` and `models` must be ready or the job raises `DesignDataPending`/`DesignDataFailed` from the design-bundle errors module; it never falls back to the legacy parse. The same object names the board member (`refilled/<stem>.kicad_pcb`, or the saved board for `zone_fills: "saved"`), the bundle's source tree, the closure's `ProjectReferences`, and the generator provenance. |
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

In bundle mode `prepare_candidate` asks `bundle_design.readiness` before it
materializes a closure: a missing or pending bundle queues the `design_bundle`
job (deduplicated on the bundle key) and raises `DesignDataPending`, which the
job runner retries; a failed stage or member raises `DesignDataFailed`. There is
no legacy fallback on this path. The same `BundleDesign` is the build's one
answer for the board and schematic inputs, the closure's `ProjectReferences`,
and the generator provenance (the bundle manifest's `generator` record replaces the
`kicad_monkey`/`kicad_cruncher` versions in `toolchain_identity`).

Around the build:
- `backend/app/services/release_studio_config_service.py`: the configuration
  registry, publishing a configuration to the tracked branch, and reads at a
  commit.
- `backend/app/services/release_studio_publish_service.py`: `ReleasePublisher`
  (approve → package → forge → record) and `BuildArchives` (digest-checked
  dossier/evidence reads, logs, vendor packs).
- `backend/app/services/release_studio_model_inputs.py`: a candidate's 3D model
  rows, `self_contained`, and the acknowledgement approve and publish need for
  models the build did not pin. Forges are adapters in
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
- **A vendor pack's member paths are the contract.** The bundle and Cruncher
  paths write the same `manufacturing/vendors/<id>/{bom,cpl}.csv` and
  `raw/vendors/<id>/{bom,cpl}.xlsx`, so a dossier link does not move with the
  source switch. `prism-kicad`'s per-file sha256 is checked against the written
  bytes; a mismatch is a failed step, never a pack. Exit 2 `vendor-unknown` is
  a configuration error, exit 7 waits for `design bundle stage parse is not
  ready`, and every other non-zero uses the error document's message.

## Tests

`backend/tests/test_release_studio_documents.py`,
`backend/tests/test_release_studio_schema_migration.py`,
`backend/tests/test_release_studio_canonicalization.py`, and
`backend/tests/test_release_studio_closure.py` are load-bearing suites. The
canonicalization suite is the determinism guard; if it fails, do not adjust the
expectation to match your output until you understand why the bytes moved.
