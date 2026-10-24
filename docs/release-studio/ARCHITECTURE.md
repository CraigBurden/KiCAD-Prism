# Release Studio architecture

## Immutable boundaries

Release Studio separates these identities:

| Boundary | What it binds |
| --- | --- |
| Commit and configuration snapshot | Exact Git tree, synthesized or committed configuration, variant, tag, Document Name, date, and selected KiCad paths. |
| Input closure | Repository files, submodules, LFS bytes, library resolution, environment bindings, and verified toolchain resources. Missing or host-absolute library URIs are recorded as non-hermetic. Every board 3D model named through `${VAR}` or an absolute path is resolved once as KiCad resolves it (project text variables, then `KIPRJMOD` and the worker's environment; backslashes become slashes; `..` is normalized) and only then placed: inside the closure it is a repository input, outside it its bytes are hashed, only if it is a regular file of at most 256 MiB whose written and resolved names both end in a suffix KiCad's 3D plugins load. A model the build cannot read (any other host file, a device, FIFO or larger file, or a path written inside the closure that a symlink leads out of it), and a missing in-closure `.wrl`/`.wrz` that KiCad may swap for a STEP model, are recorded as non-hermetic. `${VAR}`, `$(VAR)` and a bare `$VAR` expand alike. A relative path that does not start with a variable resolves in the project directory, and an `:alias:path` form through one of KiCad 10's predefined path variables (`KICAD10_3DMODEL_DIR`, `KICAD10_SYMBOL_DIR`, `KICAD10_TEMPLATE_DIR`, `KICAD10_3RD_PARTY`, `KICAD_USER_TEMPLATE_DIR`); `kicad-embed://` models are part of the board. Wherever Prism cannot reproduce KiCad's resolution exactly (an unset or left-over variable, a relative path not in the project directory or that a variable produced, any other alias, a path that does not exist as written before `..` is normalized, a symlink loop), the model is unreadable and non-hermetic. A hashed host model is copied as it is hashed, and the materialized board names that copy, as it names the file a relative or `:alias:` form resolved to, so the tools read exactly the pinned bytes. Each model reference is kept with the candidate (`ws_release_model_inputs`); `self_contained` is set when the build is hermetic and reads no host model. |
| Candidate and build attempt | Technical build identity plus one queued/running/succeeded/failed/cancelled execution; failed and cancelled attempts are retained. |
| Dossier | Canonical technical members, manifest, evidence references, and technical scope fingerprints. |
| Forge Release | A GitHub or GitLab Release on the imported remote, tagged at the build commit, named with the tag, with the dossier zip attached. |

The build/candidate is authoritative. Browser fields do not supply build
identity after enqueue. Every attempt remains reachable. Publishing does not
rewrite the build; it creates a forge Release that points at the same commit.

## Identity before build

Tag, Document Name, date, and release notes are entered in Identity before the
pipeline starts. The tag is the drawing revision and the forge Release name.
Prism checks tag existence on the remote during Identity; synthesis bakes these
values into the configuration snapshot that document composition consumes.

## Configuration mapping

The normal path synthesizes the configuration mapping from per-release UI
inputs (`synthesize_configuration`) rather than loading committed Git YAML.
When board and schematic are present on the job payload, synthesis
replaces the committed-configuration lookup. Committed YAML under the
project's `.prism/release-studio/configurations/` remains a fallback when those
paths are omitted (see CONFIGURATION.md for where a subproject's live).

## Pipeline

The pipeline starts only after Identity and Manufacturing are complete. Prism
materializes the commit closure, then runs the pinned KiCad/Prism catalogue.
Cheap DRC/ERC, board facts, positions, and BOM work can overlap assembly
projections; Gerbers, drill, and schematic output
follow; document composition (including optional impedance pages and stackup
append), vendor generation, member canonicalization, and deterministic dossier
assembly complete the technical side.

Build evidence records step output and timings but does not enter the
technical manifest digest. Hermeticity is recorded; it does not gate download
or forge publish. A Designer/QA approval or a publish of a build with unpinned
3D models (unreadable, or a missing `.wrl` KiCad may substitute) must name every
one of them as acknowledged, and the acknowledgement is stored with the
decision or the publish record (`release_studio_model_inputs.py`).

## Data model

Technical tables retain configurations, candidates, closure entries, builds,
members/domains, evidence, projections, scope fingerprints, artifact pins,
review decisions, and publish records. Governance tables from the archived
signed-release work remain in the schema but are unused by the running API.

## Security and trust boundaries

The technical digest never includes UI identity, candidate/build IDs, or
timestamps. Paths and closure inputs are constrained to the materialized
commit or verified resources. Forge publish uses a workspace token with write
scope; the clone SSH key is not sufficient. The same token is used for
`list_releases` and `tag_exists`.

## Publish

`backend/app/services/release_studio_publish_service.py` owns approve →
package → forge → record (`ReleasePublisher`): build detail and approval
state, Designer/QA decisions, the new-tag check at enqueue, zipping the dossier
with the ready vendor packs, creating the Release through a forge adapter
(`forge_publish_service.forge_for` → `GitHubForge` / `GitLabForge`), and the
publish record. If the record cannot be written, or an asset upload fails, the
Release just created is removed, and so is its tag when that publish created it
(a tag that existed before, or one the forge could not confirm, stays). Both
publishing again and a new build with that tag then work. Forge calls block; the
routes run the publisher in a worker thread so a slow forge never stalls the
event loop. Configuration publishing (Settings → tracked branch) is
`release_studio_config_service.py`.
