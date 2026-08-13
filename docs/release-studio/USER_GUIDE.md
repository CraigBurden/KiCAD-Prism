# Release Studio user guide

Release Studio is opened from a project. Viewers can inspect build material;
users with the project's design authority can start builds and publish.

## Source

Release Studio opens on **Source**. The default revision is the tracked branch
tip; older commits are selectable from the revision list. The browser sends
only that commit's full 40-character SHA to the source and build APIs. `HEAD`
and a short SHA are accepted only when they match a listed commit, then
normalized to that full SHA. Arbitrary branch names are rejected.

Prism discovers board and schematic candidates from the imported KiCad
project at the selected commit (`GET .../source?commit_sha=`). Confirm or
adjust those paths, choose a variant, and select a KiCad BOM preset
(`kicad-cli sch export bom --preset`). Continuing from Source, or starting a
build, stores those picks on the project (`PUT .../source/defaults`). The next
release reuses them when the same files still exist at the selected commit;
otherwise Prism falls back to discovery. Identity and manufacturing are not
remembered.

Continue to **Identity** when board and schematic are set.

## Identity

Enter:

- **Tag** — printed as the drawing revision and used as the GitHub or GitLab
  Release name. Name it before the build.
- **Document Name** — printed in the cover title block as DOCUMENT.
- **Date** — user-entered; printed as DATE on the cover.
- **Release notes** — optional; the first line can appear in the revision
  history table.

There is no separate revision name and no PCB field editing on this screen.

Prism checks whether the tag already exists on the forge
(`GET .../tags/{tag}`). If it does, Identity blocks and the build cannot start.
If the forge API is unreachable, Identity allows progress; a clash fails at
Publish instead. Tags are never overwritten.

## Manufacturing

Set per-release manufacturing and assembly inputs. These are not committed YAML;
they are snapshotted onto the build when it starts.

- Manufacturing IPC dropdown
- Assembly IPC dropdown
- Solder mask colour dropdown (Other is free text)
- Silkscreen colour dropdown (Other is free text)
- Via treatment dropdown (Other is free text)
- Manufacturer packs (for example JLCPCB)
- Optional stackup PDF — appended to the fabrication PDF as-is
- Optional impedance CSV — download the blank template from
  `GET .../impedance-template.csv`

**Continue** on this stage enqueues the pipeline. It is enabled only when
Source, Identity, and Manufacturing are complete.

The candidate payload is posted to `POST .../candidates` with identity,
manufacturing, board, schematic, `bom_preset`, `impedance_csv`, and
`stackup_pdf_b64`.

## Build

Release Studio switches to the six-stage rail: Source, Identity,
Manufacturing, Build, Outputs, and Publish. While the worker runs, **Build**
shows the pipeline steps and streams live job stdout through the same
`/api/jobs/{id}/logs` tail used for 3D asset generation. Live logs are not kept
for finished runs.

**Cancel build** requests fenced cancellation; the attempt stays available with
an explicit cancelled status.

**History** lists build attempts. Selecting an entry opens that attempt's
stage rail. A newly completed job is selected by its persisted job identity.

Failed and cancelled attempts are retained. They cannot be published. Correct
the inputs or environment, then start a new build; a newer attempt never
rewrites an earlier one.

Library-table paths that point at the host filesystem, and missing `.pretty`
entries, show up as warnings on the build. They do not fail the run.

## Outputs

For a successful build, inspect:

- composed PDFs under **Documents** (cover, fabrication, assembly, testpoint,
  drill, schematic, BOM);
- canonical dossier members under **Members**;
- DRC/ERC and other build evidence under **Evidence**; and
- the dossier, build evidence, individual members, and enabled vendor packs
  from their download controls.

The fabrication PDF is Prism layer plots, then optional impedance table pages
when a CSV was uploaded, then the vendor stackup PDF appended unchanged. The
release BOM is exported from the selected KiCad preset as CSV and typeset as a
BOM PDF. JLCPCB keeps its own vendor BOM in the pack.

## Publish

**Publish** is confirm-only. Tag, Document Name, date, and notes cannot be
edited here. **Publish to GitHub** or **Publish to GitLab** zips the stored
dossier and creates a Release on the imported remote at this build's commit.
The Release name is the tag. On success, Release Studio shows the Release URL.

The workspace SSH key can clone; it cannot create a Release. Set:

- `GITHUB_TOKEN` with `contents:write` for GitHub remotes; or
- `GITLAB_TOKEN` with `api` scope for GitLab remotes.

The same tokens are needed to list prior Releases for cover history and to
check tag existence. A clone-only token returns a clear 403. Publishing is
implemented for GitHub and GitLab remotes only.
