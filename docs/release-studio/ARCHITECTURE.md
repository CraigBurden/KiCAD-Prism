# Release Studio architecture

## Immutable boundaries

Release Studio deliberately separates these identities:

| Boundary | What it binds |
| --- | --- |
| Commit and configuration snapshot | Exact Git tree, normalized committed YAML, variant, and selected inputs. |
| Input closure | Repository files, submodules, LFS bytes, library resolution, environment bindings, and verified toolchain resources. |
| Candidate and build attempt | Technical build identity plus one queued/running/succeeded/failed/cancelled execution attempt; failed and cancelled attempts are retained terminal records with diagnostics, not releaseable builds. |
| Dossier | Canonical technical members, manifest, evidence references, and technical scope fingerprints. |
| Evaluation and approval | Build-scoped policy result and approvals bound to policy and technical fingerprints. |
| Release record | A separately named project-library item with signed attestation and distribution state. |

The build/candidate is authoritative. Browser fields do not supply evaluation
or release identity, and a release is not a mutable candidate state. Every
attempt remains reachable; release records form a separate library that may
refer to a build without hiding its history.

## Pipeline

Prism materializes the whole commit closure, validates the required jobset,
then runs the pinned KiCad/Prism catalogue. Cheap DRC/ERC, board facts,
positions, and BOM work can overlap assembly projections; Gerbers, drill, and
schematic output follow; document composition, vendor generation, member
canonicalization, and deterministic dossier assembly complete the technical
side. Processes are cold `kicad-cli`/Cruncher subprocesses; concurrency caps
are memory fences, not a promise that a board can be loaded safely in a shared
process.

Build evidence records step output and timings but does not enter the technical
manifest digest merely because it has a wall-clock value. Policy evaluation can
therefore be repeated using persisted evidence and projections with zero KiCad
steps.

## Data model and invalidation

Technical tables retain configurations, candidates, closure entries, builds,
members/domains, evidence, projections, scope fingerprints, and artifact pins.
Governance tables retain policy versions, evaluations and rule outcomes,
findings/waivers, approvals and append-only invalidations, signing keys,
release records, web shares, and a project/configuration-scoped audit hash
chain.

Technical scope fingerprints are domain-specific (`bare_board`, `assembly`,
`documentation`, `evidence`). An approval binds both those fingerprints and a
policy-binding digest. A change can therefore invalidate an approval as
technical, policy, both, or withdrawn rather than obscuring the reason.

## Security and trust boundaries

The technical digest never includes approvers, policy bindings, UI identity,
candidate/build IDs, or timestamps. The attestation contains the human and
governance decision and is signed after release authorization. The server
derives actor identity from the authenticated session; it never trusts an
editable UI field for approval, waiver, evaluation, or release actor identity.

Policies are a typed server catalogue, not executable configuration. Paths and
closure inputs are constrained to the materialized commit or verified resources.
The database supplies useful immutability triggers and audit history but is not
the ultimate trust anchor for a privileged database owner. The independently
verifiable signed archive is the durable external integrity boundary.
