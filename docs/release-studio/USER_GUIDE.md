# Release Studio user guide

Release Studio is opened from a project. Viewers can inspect release material;
users with the project's design authority can start builds and governance
actions permitted by their global role.

## Settings

Release Studio opens on **Settings**. Define or edit the configuration there,
then select **Save & publish**. Prism serializes this operation with Sync,
validates the referenced board, schematic, jobset, optional template and policy
in an isolated checkout, and publishes a configuration-only commit to the
current branch's tracked remote. The push is lease-protected, so a concurrent
remote update is never overwritten. Prism fast-forwards its mirror only after
the remote accepts the commit; failed publication leaves no local-only commit.
Unrelated staged, working-tree, or local commit content is never included.

Choose the saved commit from the revision list. The browser sends only that commit's full,
immutable 40-character SHA to the backend configuration and build APIs. For
convenience, `HEAD` and a short SHA are accepted only when each exactly matches
a commit currently listed, then are immediately normalized to that listed full
SHA before lookup or build. Arbitrary branch names and other refs are rejected.
The configuration, policy overlay, board, schematic, jobset, libraries, and
other input files are read from that exact revision; changing a field in the
browser cannot change release identity.

Choose one configuration and, when offered, a named variant. Settings also owns
the manufacturing and assembly IPC classes, solder-mask colour, via treatment,
document identity, vendor packs, and release typography. **Start build** is
enabled only for a published configuration at a listed immutable revision.

## Build

Select **Start build**. Release Studio switches to **Current**, which contains
only that job and its Source, Build, Outputs, Sign-off, and Released stages. The
job materializes the commit's closure,
runs the release pipeline, captures evidence and logs, canonicalizes released
members, and stores a build attempt. The Build stage keeps a live log console
open while the worker runs. **Cancel build** requests fenced cancellation; the
attempt remains available with an explicit cancelled status and archived
diagnostics.

**History** lists build attempts without automatically opening one. **Library**
lists signed releases separately. Selecting an entry in either view opens that
entry's stage rail and evidence; a newly completed job is selected by its own
persisted job identity, never by a previous selection or timestamp guess.

Failed and cancelled attempts are distinct terminal records and are retained.
Open either attempt to inspect its archived diagnostic evidence and logs. A
failed attempt identifies work that ended in an error; a cancelled attempt's
archived logs and diagnostics explicitly retain the `cancelled` status. Neither
can be inspected as a successful dossier, evaluated, approved, or released.
Correct the committed input or environment as appropriate, then start a new
build; a newer attempt never rewrites an earlier one.

## Inspect

For a successful build, inspect:

- composed PDFs under **Documents**;
- canonical dossier members and their released digests under **Members**;
- DRC/ERC and other build evidence under **Evidence**; and
- the dossier, build evidence, individual members, and enabled vendor packs
  from their download controls.

The member preview verifies the extracted member's digest before serving it.
Inspect the build you intend to approve: the run list intentionally keeps prior
attempts available even after a later build or release exists.

## Approve and release

Evaluate the selected build, resolve or waive applicable findings, and provide
the policy's required role/domain approvals. Policy labels describe required
approval categories, not arbitrary identities. Under the current global-role
model, only an **admin** may create or satisfy a required policy approval role;
see [Governance](GOVERNANCE.md).

Choose a release label, then sign and release. Document number and revision
are displayed read-only from the committed configuration and are derived by the
server at signing; they are not editable release-identity fields. Normal release
is refused for open blocking findings, unsupported rule outcomes, or missing
required approvals. An administrator may explicitly release over blockers only
with a reason; the signed attestation exposes that override to recipients.

## Verify, download, and share

The **Library** is separate from build attempts. From a release record you
can download its signed release archive, download an enabled vendor pack, ask
Prism to verify the archive, or create a revocable, optionally expiring web
share. Recipients should independently run the bundled verifier with a public
key obtained through a trusted channel, as described in
[Artifacts](ARTIFACTS.md#offline-verification).
