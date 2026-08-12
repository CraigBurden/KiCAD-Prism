# Release Studio Stage 1 — Release Control

Stage 1 turns an exact KiCad/Git revision into a verified, approved, immutable
manufacturing release whose provenance can be audited offline.

## Module map

| Path | Chunk | Role |
| --- | --- | --- |
| `app/release_studio/jobset.py` | R1 | Jobset model, output closure, KiCad 10.0.4 step-type registry |
| `app/release_studio/closure.py` | R2b | Whole-tree input closure: submodules, LFS, modes, external libraries |
| `app/release_studio/canonical/` | R4 | Semantically-null canonicalizers + canonical JSON |
| `app/release_studio/projections.py` | R5 | Board stats, stackup, variant divergence |
| `app/release_studio/config/` | R6 | Configuration spec, strict substitution, technical/governance split |
| `app/release_studio/steps.py` | R7 | `kicad-cli` step catalogue and DRC/ERC evidence |
| `app/release_studio/dossier.py` | R10 | Members, domains, manifest, dossier, scope fingerprints |
| `app/release_studio/policy.py` | R12-R14 | Rule catalogue, policy resolution, evaluator |
| `app/release_studio/attestation.py` | R18/R18a | Attestation, Ed25519 signing, release archive |
| `app/release_studio/verify.py` | R18a | Standalone offline verifier (no Prism, DB, or network) |
| `app/services/release_studio_service.py` | R11/R15-R18 | Persistence, audit chain, waivers, approvals, records |
| `app/services/release_studio_build_service.py` | R11 | Build orchestration and the job handler |
| `app/api/release_studio.py` | R19 | HTTP surface |
| `frontend/src/components/release-studio/` | R20-R22 | The Release Studio panel |

## The two domains

The technical domain never reads the governance domain. `build_key` is

```
H(technical_config_digest, input_closure_digest, variant, toolchain_digest)
```

with no policy input, so re-evaluating an existing build under a new policy
runs zero KiCad steps and leaves `manifest_digest`, `dossier_digest`, and every
`technical_scope_fingerprint` unchanged. `assert_no_governance_leak` walks the
manifest and refuses approver, policy, candidate, build, job, and timestamp
fields outright.

An approval binds to the pair `(technical_scope_fingerprint[domain],
policy_binding_digest)` stored in two independent columns. That is what lets a
stale approval report *which half* went stale rather than an opaque failure.

## Released bytes are the canonical bytes

`dossier.tar.gz` holds the canonicalized bytes and those are the released
manufacturing files; `build-evidence.tar.gz` holds the raw pre-canonical bytes
for forensics. Offline verification simply hashes the files it possesses.

KiCad 10.0.4 stamps wall-clock time into more places than the plan's original
registry described. Every removal now names its emission site in the pinned
source, and `ReleaseStudioVolatileTimestampTests` asserts the property that
actually matters — no canonicalized member retains an ISO-8601 instant, and two
exports at different times canonicalize identically.

## Exit criteria status

| # | Criterion | Where it is proven |
| --- | --- | --- |
| 1 | Reproducibility | `test_release_studio_dossier.py::test_two_builds_at_different_times_are_semantically_identical` |
| 2 | Domain separation | `test_release_studio_governance.py::test_policy_bump_invalidates_approvals_but_no_technical_row_moves` |
| 3 | Carry-forward | `...::test_assembly_only_change_carries_bare_board_and_invalidates_assembly` |
| 4 | Offline authenticity | `test_release_studio_attestation.py::test_fabricated_archive_with_recomputed_digests_is_rejected`, `...::test_verifier_runs_standalone_with_no_prism_on_the_path` |
| 5 | Closure completeness | `test_release_studio_closure.py::test_full_tree_recursive_submodules_lfs_and_digest_are_deterministic` |
| 6 | Retention | `test_release_studio_retention.py` |
| 7 | Fencing | `test_release_studio_governance.py::test_stale_fence_cannot_complete_a_build` |
| 8 | Hermeticity | `test_release_studio_jobset.py`, `policy.build.hermetic` rule |
| 9 | Full governed cycle | `...::test_full_governed_cycle_ends_in_a_signed_verifiable_release` |
| 10 | Manual end-to-end | `docs/release-studio/MANUAL_TESTING.md` |

Criteria 1-9 run in CI. Criterion 10 is the manual pass, and the reproducibility
matrix across all three fixtures under live `kicad-cli` runs in `kicad-live`.

## Known limits

- The step catalogue is a fixed set rather than a jobset-driven plan. A project
  that ships a `.kicad_jobset` must have that file in the closure, but the
  release still builds from the catalogue. Hermeticity is classified on those
  catalogue types, not on unused jobset destinations.
- There is no persistent Pcbnew / IPC-API session; every tool is a cold
  subprocess. See `docs/release-studio/PIPELINE.md`.
- Project policy overlays in Git are parsed and validated (R6). Org policies in
  Postgres remain future work.
- The Documentation Engine is present: the dossier carries composed PDFs (cover,
  fabrication, assembly, testpoint, drill), not a raw `kicad-cli pcb export pdf`.
  Typography comes from the committed configuration, not from the UI template.
- Board STEP export, Cruncher BOM/PnP, live Stage-2 matrix, and detail/zone
  sheets are deferred. The Release Studio panel rewrite is separate work.
