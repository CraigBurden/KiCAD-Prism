# Library Manager

Library Manager governs reusable KiCad components independently from project
repositories. PostgreSQL stores metadata, workflow, and audit records; persistent
project storage contains immutable asset objects, revisions, previews, validation
evidence, and exports.

## Roles

- `designer`: create, import, edit, and submit components, and click Released after QA has approved.
- `qa`: review, return, and approve components in QA review.
- `admin`: all catalog actions and exceptional administration.
- `viewer`: no catalog access.

Users currently have one role. See
[Authentication and access](AUTHENTICATION_AND_ACCESS.md).

## Component lifecycle

The supported stages are:

```text
open -> in_progress -> qa_review -> done -> released
```

Items can return from QA to authoring with a review note or move to `archived`
where allowed. Starting new work from a released component creates a new draft
revision instead of mutating the released revision.

Release requires:

- a place-ready current revision;
- required symbol and footprint assets;
- approval evidence for that exact revision;
- a different approver from the revision author;
- passing KLC evidence when the release gate is `block`.

The released revision remains stable while later drafts are edited.

## Create or import components

### Manual creation

Create the identity and metadata, attach the symbol and footprint, add optional
3D or SPICE assets, inspect previews, and move the draft into the review flow.

### Folder import

Configure server-side read-only roots:

```env
CATALOG_IMPORT_ROOTS=team=/mnt/team-library,vendor=/mnt/vendor-library
```

Use Import Center to discover candidates, review remediation findings, and
accept selected proposals into drafts. Import limits in `.env` protect the
server from unexpectedly large trees.

An import session you no longer need can be deleted from its row in the
session list once it has finished scanning. Deleting removes its open
candidates and staged files; components already accepted stay in the catalog.

### Project harvest

Components can be proposed from imported project data or a selected schematic or
PCB identity. Review every proposal before acceptance; project-local symbols and
footprints are not automatically approved library assets.

### What an import needs before acceptance

Folder and project imports follow the same rules, and the server applies them
when a proposal is accepted, including through the API:

- value, manufacturer, manufacturer part number, description and datasheet are
  present, and the datasheet is an `http://` or `https://` URL;
- one symbol and one footprint, either from the import or linked from an
  existing catalog asset (a link answers a `footprint_not_resolved` finding);
- no other blocking error findings.

A manufacturer part number held by a retired component cannot be imported
again. Folder discovery marks such parts as retired rather than new.

### Editing metadata

The single-component editor checks only that required fields are present, so
legacy values you did not touch never block a save. Bulk edit and metadata
batches also check value shape: numbers, HTTP(S) URLs, booleans and configured
enum options. Provisional parts never require a manufacturer part number;
supplying one in either editor promotes the part to an orderable identity.

### Existing packed symbol libraries

The scripts directory contains migration helpers for splitting packed KiCad
symbols and importing library assets. Use a backup, run against a sample first,
and perform the final acceptance through Import Center rather than writing
directly to catalog storage.

## Revisions and assets

A component revision records metadata and references immutable assets. Do not
manually edit files inside `.kicad-prism`; doing so can break hashes, audit
evidence, previews, and placement.

Use a new revision for any released-part change, including metadata that affects
selection or manufacturing.

## Live previews and representation selection

The component workspace can render symbol and footprint source assets directly.
Choose a representation to inspect its symbol/footprint pair, then select a
symbol pin or footprint pad to cross-probe the matching item. Pan and zoom
inside the preview. Stored SVG thumbnails and revision evidence remain separate
views; a live preview is not approval evidence by itself.

Downloads from a released revision follow the selected representation, including
non-default pairs. A stale edit reports a revision conflict rather than silently
overwriting newer work; reload the component before retrying.

## KLC validation

Enable:

```env
CATALOG_KLC_ENABLED=true
CATALOG_KLC_UTILS_PATH=/opt/kicad-library-utils
CATALOG_KLC_RELEASE_GATE=warn
```

Gate modes:

- `off`: reports do not affect release;
- `warn`: show findings but allow release;
- `block`: require current symbol and footprint checks to pass.

Prism stores normalized findings and durable report artifacts. Validation is
read-only; Prism does not run KLC auto-fix modes.

Choose `block` only after the imported library has been remediated enough that
the rule does not force routine administrator overrides.

## Release Queue

QA users should work from Release Queue, verify the exact revision and attached
evidence, record a review note where appropriate, and release only after the
item reaches `done`.

Two-person approval prevents a revision author from taking the item from QA
review to Approved. After QA has approved, the same designer may click Released.

## Placeability

A component is exposed to the Remote Symbol Provider only when it is:

- active;
- at the `released` stage;
- backed by the released revision;
- complete enough for placement.

Placeability is evaluated from the revision's default symbol-footprint
representation. A released revision has exactly one complete default. Other
complete representations can be previewed and selected by clients that
advertise representation support. Provisional source-IPN components remain
draft-only until a real manufacturer and MPN establish their catalog identity.

Unreleased drafts, archived components, and incomplete components are not part
of the released provider projection.

## KiCad DBL export

Prism can generate a KiCad database-library bundle from released place-ready
components. The export contains a generated SQLite database and KiCad DBL files.
That SQLite file is a delivery artifact; Prism itself continues to use
PostgreSQL.

DBL has no representation-selection protocol, so the export intentionally
contains only each released component's default representation. Use the Remote
Symbol Provider when users need to choose a non-default representation.

Generate through the catalog administration API or supported Library Manager
action, then distribute the complete export directory. Do not copy only the
database file because symbol and footprint trees are also required.

Symbols and footprints are a latest-released view: "Update symbols/footprints
from library" in KiCad moves a design to the newest released revision, as with
any KiCad library. 3D models are exported under
`3DModels/<first 16 hex of SHA-256>/<file name>` and footprints reference them
as `${PRISM_LIB_DIR}/3DModels/...`. Models of every released revision of a
library part are kept, so a board placed from an earlier release keeps the model
it was placed with; modules and assemblies are not library parts and their
models are never exported. The export response lists each stored model whose
file is missing or no longer matches its recorded hash once in
`missing_models`; those are left out of the bundle.
Replace the export directory as a unit.

Each export is built in a hidden sibling directory and renamed into place, so a
failed export leaves the previous bundle untouched. The export directory's parent
must therefore be writable, and the export directory itself must not be a mount
point. Exports to the same directory run one at a time (a PostgreSQL advisory lock
held for the whole export), and each one first removes any build directory an
interrupted export left behind. `sym-lib-table` and `fp-lib-table` list only the libraries in the bundle.

The DBL key (`Part Number Nocolon`) is the manufacturer part number, or the value
when there is none, with colons and whitespace replaced by `_`. When several
exported components share a key, the oldest component keeps it and each other
one gets `_` plus the first eight characters of its component id (the whole id
if that still collides). Keys do not depend on export order, and adding a newer
part with the same key never renames an existing one.

## Governance checklist

Define before production use:

1. naming and category rules;
2. mandatory metadata;
3. asset and preview requirements;
4. KLC gate mode;
5. author and independent approver responsibilities;
6. duplicate and obsolete-part handling;
7. release labels and evidence retention;
8. backup and restore ownership;
9. a process for emergency withdrawal or replacement.

Continue with [Remote Symbol Provider](REMOTE_SYMBOL_PROVIDER.md).
