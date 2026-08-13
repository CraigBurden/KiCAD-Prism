# Release Studio architecture

## Immutable boundaries

Release Studio separates these identities:

| Boundary | What it binds |
| --- | --- |
| Commit and configuration snapshot | Exact Git tree, normalized committed YAML, variant, and selected inputs. |
| Input closure | Repository files, submodules, LFS bytes, library resolution, environment bindings, and verified toolchain resources. Missing or host-absolute library URIs are advisory. |
| Candidate and build attempt | Technical build identity plus one queued/running/succeeded/failed/cancelled execution; failed and cancelled attempts are retained. |
| Dossier | Canonical technical members, manifest, evidence references, and technical scope fingerprints. |
| Forge Release | A GitHub or GitLab Release on the imported remote, tagged at the build commit, with the dossier zip attached. |

The build/candidate is authoritative. Browser fields do not supply build
identity. Every attempt remains reachable. Publishing does not rewrite the
build; it creates a forge Release that points at the same commit.

## Pipeline

Prism materializes the commit closure, validates the required jobset, then
runs the pinned KiCad/Prism catalogue. Cheap DRC/ERC, board facts, positions,
and BOM work can overlap assembly projections; Gerbers, drill, and schematic
output follow; document composition, vendor generation, member
canonicalization, and deterministic dossier assembly complete the technical
side.

Build evidence records step output and timings but does not enter the
technical manifest digest. Hermeticity is recorded; it does not gate download
or forge publish.

## Data model

Technical tables retain configurations, candidates, closure entries, builds,
members/domains, evidence, projections, scope fingerprints, and artifact pins.
Governance tables from the archived signed-release work remain in the schema
but are unused by the running API.

## Security and trust boundaries

The technical digest never includes UI identity, candidate/build IDs, or
timestamps. Paths and closure inputs are constrained to the materialized
commit or verified resources. Forge publish uses a workspace token with write
scope; the clone SSH key is not sufficient.
