# Release Studio upstream-document integration and finish plan

Last reconciled: 2026-08-12  
Working branch: `feature/release-studio`  
Starting HEAD: `ee22991`  
Target project: `data/projects/type1/JTYU-OBC` at commit
`4a6e97f20a965f1775cf212914ab3fa905fa1335`

This file is a resumable implementation handoff. The worktree already contains
substantial uncommitted Release Studio implementation. Preserve those changes;
do not reset, discard, or overwrite the tree wholesale.

## Resume status — execution credits exhausted

The implementation reached the final rebuild/acceptance boundary on
2026-08-12. Codex's approval service then rejected further Docker execution
because the account execution-credit limit was reached. Do not reinterpret
that as a repository failure or retry it through an indirect mechanism.

Completed in the worktree:

- `kicad-newstroke` is the normalized default while the two Geist presets
  remain explicit legacy choices.
- visible SVG/PDF technical text is emitted from Monkey NewStroke polylines;
  the PDF has a deterministic invisible Base14 text layer for search/copy;
- default drawing-sheet frame/title-block operations come from Monkey's public
  `load_default_drawing_sheet()` and `drawing_sheet_to_ops(...)` APIs;
- document renderer identity is `release-studio-documents/d7` and includes the
  installed Monkey stroke-data digest;
- dossier/evidence tar members receive the Git commit author epoch; the outer
  signed release receives the signed `released_at` epoch;
- timestamp, NewStroke, worksheet, authenticity, configuration, dossier, and
  projection tests passed in a temporary copy inside the older running image;
- the Docker venv now uses the pinned KiCad image's system Python instead of an
  unreliable uv-managed interpreter download;
- the local `.env` now sets `KICAD_BASE_PLATFORM=linux/amd64`, matching the
  pinned AMD64-only KiCad digest and Compose runtime. It had incorrectly been
  `linux/arm64`, which produced an ARM Node binary copied into an AMD64 stage;
- the old PDF serializer assertion was updated from embedded Type0/TTF to the
  NewStroke-vector plus deterministic Type1 search-layer contract.

The first rebuild proved that both upstream packages resolve and install at
`2026.8.11`. It then stopped at `npm ci` because of the local ARM/AMD64 stage
mismatch described above. The mismatch is corrected, but the approval service
blocked the retry before Docker started.

First commands for the resuming agent:

```sh
cd /Users/Swaroop/Personal-Projects/KiCAD-Platform/KiCAD-Prism
docker compose build backend prism-worker catalog-worker
docker compose up -d --force-recreate backend prism-worker catalog-worker
docker compose exec -T backend python -c \
  'import importlib.metadata as m; print(m.version("kicad-monkey"), m.version("kicad-cruncher"))'
```

The version command must print `2026.8.11 2026.8.11`. If the second build still
reports a Node architecture problem, inspect `.env` and Compose's resolved
configuration before changing the Dockerfile:

```sh
docker compose config | sed -n '1,90p'
```

Do not mount or copy a sibling Monkey/Cruncher checkout.

After rebuilding, recompute the `d7` document golden digests under the actual
2026.8.11 image and update only the expected constants in
`backend/tests/test_release_studio_documents.py`. The older 2026.6.13 runtime
produced these provisional values, which are diagnostic only and must not be
blindly accepted:

```text
assembly-bottom.pdf e1050bb851e9c598682666f0ac65eca7a4a32e58496294663f7f1a973b4dbea1
assembly-bottom.svg a10aaad56783f4dbfe4bfbbee015503e0e6598808ceb128ae75701b33d8822a8
assembly-top.pdf    4d87e6cf92dbe8ed8d08802dc78b921310401847902f90bd6e4bc6b3c8cb1b86
assembly-top.svg    027b8bc05172256daae8678e1d8f12a094ceb51f77d3fac3cb5e2ec65872cfa4
cover.pdf           b825ae468b5d8c7080cd757400b0fc8c47220b58cb0f93a78142dc31e51e058c
cover.svg           c3b24a0d84bc40ff16e1cc8d7ad7a070d6e6afa2e7b30f9f3243bd966d0581ba
drill.pdf           9394029b80de9c09c372ff8dad35e64bddc83aa06486885085052efbb572fc17
drill.svg           3d34952b6ce6041e7487348514c82147d78401a5b4a16aa4f519a197e48e574e
fabrication.pdf     c15c8fc1cc8cf3fadfbf2ec2f9eb92db8b26bdad89d52c3ac7d60e0911e23a83
fabrication.svg     779491b3842ec2ee746a8ce4daf585879a6778c2fafe17b357871d8d3b760f73
placed SVG fixture  c834f2ff7453a58218712a3e4789c10d9db415d373cf07832f99a7f2863a671d
```

In the older image, 125 focused tests yielded only three expected stale-test
failures (renderer version, renderer goldens, old PDF Type0 assertion) and one
skip. The PDF assertion is now fixed; the version/golden constants remain for
the rebuilt-image pass.

## Objective

Finish Release Studio so that KiCad-domain parsing and drawing behavior comes
from the published upstream toolchain wherever it exists, while Prism owns only
release-specific composition, deterministic packaging, approvals, signing, and
verification. Build and inspect a real dossier for JTYU-OBC.

## Authoritative upstream baseline

- `kicad-monkey==2026.8.11`
- `kicad-cruncher==2026.8.11`
- Both versions are already pinned in `backend/requirements.txt` and
  `kicad-prism-viewer/requirements-runtime.txt`.
- Cruncher is now packaged from
  `wavenumber-eng/kicad_monkey/packages/kicad_cruncher`; the standalone repo is
  archived.
- Assess and test the published PyPI wheels or tagged upstream source. Do not
  use adjacent local Monkey/Cruncher clones for acceptance.

Relevant public APIs and workflows:

- `kicad_monkey.load_default_drawing_sheet()`
- `kicad_monkey.drawing_sheet_to_ops(...)`
- `kicad_monkey.render_ir_to_svg(...)`
- `kicad_monkey.KiCadDesign`, `KiCadPcb`, targeted projections, and compiled
  schematic graph APIs
- `kicad-cruncher design` for review JSON/netlists/schematic and copper SVGs
- `kicad-cruncher pcb-svg` for assembly views, HLR, designators, drills, slots,
  and pin-1 overlays
- `kicad-cruncher bom`, `pnp`, and `jlc` for manufacturing tables
- `kicad-cli` remains canonical for Gerber, Excellon, canonical KiCad PDF, and
  normal board STEP exports

The 2026.8.11 Monkey wheel contains `kicad_stroke_font_data.json` and the
NewStroke renderer, but does not contain the repository's generated TTF/WOFF
assets. If searchable PDF needs an embedded NewStroke TTF, the clean upstream
follow-up is to package those existing upstream assets or expose a public font
measurement/vector-text API. Prism must not silently load a host font.

## Required implementation

### 1. Use KiCad's drawing-sheet model and NewStroke appearance

1. Add `kicad-newstroke` as the normalized default typography.
2. Drive visible technical text from Monkey's NewStroke data, not the Geist
   experiment or a host font. Keep output deterministic and fail closed when
   the pinned upstream data is unavailable.
3. Preserve searchable/copyable PDF text. A temporary invisible deterministic
   text layer is acceptable if visible glyphs are NewStroke vectors; document
   the upstream TTF packaging/API improvement that would remove that shim.
4. Replace the hand-built sheet frame/title-block geometry with an adapter over
   `load_default_drawing_sheet()` and `drawing_sheet_to_ops(...)`.
5. Convert public `Rect`, `PlotPoly`, and `Text` operations into Prism's common
   sheet model so SVG and PDF continue to share one layout description.
6. Map Release Studio values into KiCad title-block fields: title, revision,
   commit author date, document number, commit, variant, and configured fields.
7. Retain only release-specific content composition in Prism: cover/member
   tables, stackup and fabrication tables, notes, policy evidence, approval
   state, signing, and deterministic packaging.

Acceptance:

- Default configuration normalizes to `kicad-newstroke`.
- SVG visible text is NewStroke vector geometry and does not depend on a host
  font.
- PDF visibly matches the SVG and remains searchable.
- The frame/title block comes from Monkey's emitted worksheet operations.
- All configured fields remain visible and deterministic.

### 2. Adopt Cruncher artifact workflows where they replace Prism logic

1. Use Cruncher's published APIs/CLI for design review, PCB assembly SVG, BOM,
   and PnP artifacts where their contracts match released members.
2. Do not replace canonical manufacturing Gerber/Excellon/STEP generation with
   review-only Cruncher commands.
3. Prefer one authoritative artifact per purpose. Avoid producing divergent
   KiCad-CLI and Cruncher assembly SVGs under the same semantic name.
4. Record Monkey and Cruncher versions, executor image, renderer version, and
   relevant upstream resource digest in toolchain identity.
5. Surface any upstream fallback in persistent build warnings and the manifest.

Acceptance:

- No newly added hand parser duplicates a public upstream semantic API.
- Assembly/design/BOM/PnP provenance identifies Cruncher when Cruncher owns it.
- Failure to run the pinned upstream workflow is explicit; there is no quiet
  host-dependent fallback.

### 3. Remove the visible 1 January 1970 archive timestamp

The epoch currently comes from `write_deterministic_archive`, which assigns
`TarInfo.mtime = 0` and gzip `mtime=0`.

1. Extend the archive writer with an explicit deterministic `mtime` parameter.
2. Dossier and evidence archives use the Git commit author timestamp, obtained
   with `git show -s --format=%at <commit>`.
3. The outer signed release archive uses the signed attestation's
   `released_at` timestamp.
4. Generic canonicalization and tests that do not supply a meaningful revision
   may continue to use epoch zero as their neutral default.
5. Timestamp selection must not read wall-clock time inside technical builds.

Acceptance:

- JTYU dossier members display the August 11, 2026 commit timestamp.
- The signed outer release archive displays its signed release timestamp.
- Rebuilding the same commit produces byte-identical dossier/evidence archives.

### 4. Preserve the already implemented security and governance corrections

Do not regress the current uncommitted fixes:

- verification requires independently trusted Ed25519 PEM material and rejects
  an attacker archive that reuses a trusted key id with different key bytes;
- toolchain identity includes Monkey, Cruncher, and deterministic resources;
- glyph failures are isolated per configured field/sheet;
- retired policy versions remain valid only for already-bound historical
  candidates;
- policy diffs key rules by rule id and approvals by role;
- projection fallback provenance is visible.

Run their focused tests before accepting the feature.

### 5. Rebuild and test the published toolchain

Use normal `docker-compose.yml`, not `docker-compose.local-kicad-monkey.yml`, for
acceptance. The latter intentionally mounts a sibling checkout and is not valid
evidence for this integration.

Required gates:

1. Rebuild backend, worker, and catalog-worker images from the 2026.8.11 pins.
2. Inside the rebuilt image, record:
   `python -c 'import importlib.metadata as m; print(m.version("kicad-monkey"), m.version("kicad-cruncher"))'`.
3. Run all Release Studio backend tests with PostgreSQL enabled.
4. Run frontend Release Studio tests, typecheck, and production build.
5. Run `git diff --check` and compile changed Python modules.
6. Verify dossier and release archives with the standalone verifier using an
   independently supplied trusted public key.

### 6. Generate and inspect the JTYU-OBC dossier

Project root:
`data/projects/type1/JTYU-OBC`

Committed Release Studio configuration:
`.prism/release-studio/configurations/default.yaml`

The project checkout is dirty. Release Studio must build the requested Git
commit, not include working-tree-only files. Use commit
`4a6e97f20a965f1775cf212914ab3fa905fa1335` unless a newer committed revision is
created intentionally.

1. Ensure the project is registered in the local Prism database.
2. Sync its `default` Release Studio configuration.
3. Prepare a candidate and execute a build through the actual job/service path.
4. If policy approvals prevent creation of a signed release, create the minimum
   legitimate local policy and approval records through the normal APIs; do not
   bypass policy evaluation or forge database rows.
5. Generate the dossier, evidence archive, and, when approvals/signing are
   configured, the signed release archive.
6. Extract to a temporary directory and inspect:
   - manifest and scope fingerprints;
   - cover, fabrication, assembly top/bottom, and drill SVG/PDF;
   - BOM/PnP/Gerber/drill/STEP members;
   - archive timestamps;
   - build warnings and provenance.
7. Render PDFs to images and visually check page bounds, text, title blocks,
   tables, scale labels, assembly orientation, drill legend, clipping, and
   NewStroke appearance.
8. Leave the final generated artifacts in an explicit non-source output
   directory under `data/projects/.kicad-prism/` and report their absolute
   paths and digests.

## Completion audit

Do not declare completion from narrow unit tests. Record evidence for every
acceptance item above, including the real JTYU artifact. Any missing sheet,
fallback, epoch timestamp, untrusted-key verification path, or use of a local
Monkey/Cruncher checkout is incomplete.

## Current investigation notes

- The JTYU configuration has no explicit typography, so changing the normalized
  default will exercise NewStroke on the real run.
- Its current latest commit author time is `2026-08-11T18:15:09+05:30`.
- The existing 1970 value is not project data; it is deterministic archive
  metadata from `backend/app/release_studio/canonical/__init__.py`.
- The current worktree's container was previously built with 2026.6.13; a clean
  rebuild is mandatory before 2026.8.11 acceptance.
- The visible document compositor is still needed because neither Monkey nor
  Cruncher currently produces Prism's signed release dossier/PDF packet.
