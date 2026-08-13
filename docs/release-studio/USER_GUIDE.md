# Release Studio user guide

Release Studio is opened from a project. Viewers can inspect build material;
users with the project's design authority can start builds and publish.

## Configuration

Release Studio opens on the configuration form. Define or edit the board,
schematic, jobset, documents, vendors, and manufacturing fields, then select
**Save & publish**. Prism serializes this operation with Sync, validates the
referenced files in an isolated checkout, and publishes a configuration-only
commit to the current branch's tracked remote. Failed publication leaves no
local-only commit.

Choose the saved commit from the revision list. The browser sends only that
commit's full 40-character SHA to the configuration and build APIs. `HEAD` and
a short SHA are accepted only when they match a listed commit, then normalized
to that full SHA. Arbitrary branch names are rejected.

**Start build** is enabled only for a published configuration at a listed
immutable revision.

## Build

Select **Start build**. Release Studio switches to the current run: Source,
Build, Outputs, and Publish. The job materializes the commit, runs the release
pipeline, captures evidence and logs, canonicalizes members, and stores a
build attempt. **Cancel build** requests fenced cancellation; the attempt stays
available with an explicit cancelled status.

**History** lists build attempts. Selecting an entry opens that attempt's stage
rail. A newly completed job is selected by its persisted job identity.

Failed and cancelled attempts are retained. They cannot be published. Correct
the committed input or environment, then start a new build; a newer attempt
never rewrites an earlier one.

Library-table paths that point at the host filesystem, and missing `.pretty`
entries, show up as warnings on the build. They do not fail the run.

## Inspect

For a successful build, inspect:

- composed PDFs under **Documents**;
- canonical dossier members under **Members**;
- DRC/ERC and other build evidence under **Evidence**; and
- the dossier, build evidence, individual members, and enabled vendor packs
  from their download controls.

## Publish

**Continue to publish** opens the forge form. Enter a tag such as `v1.0.0`,
optionally a title and notes, then **Publish to GitHub** or **Publish to
GitLab**. Prism zips the stored dossier and creates a Release on the imported
remote at this build's commit, then attaches the zip.

The workspace SSH key can clone; it cannot create a Release. Set:

- `GITHUB_TOKEN` with `contents:write` for GitHub remotes; or
- `GITLAB_TOKEN` with `api` scope for GitLab remotes.

A clone-only token returns a clear 403. Publishing is implemented for GitHub
and GitLab remotes only.
