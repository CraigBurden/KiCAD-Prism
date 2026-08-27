# Library workspace

Two distinct concerns share this directory: **project workspace** (folders,
listing, project actions) and **component library** (catalog authoring, import,
release). Read `AGENTS.md` at the repository root first.

The split is by filename prefix, not by folder:

- `workspace-*`, `*-folder-dialog`, `*-project-dialog` — project workspace,
  mounted from `frontend/src/components/workspace.tsx`.
- `library-*` — component library, the frontend for the catalog services in
  `backend/app/services/AGENTS.md`.

## This directory is where the state rule matters most

`library-component-workspace.tsx` is 2,569 lines with **44 `useState` calls** —
the largest concentration of local state in the codebase, and the reason the
state hierarchy rule exists.

Before adding state here, check whether the value is already available from the
URL, the loaded component record, or the current selection. It usually is. React
Doctor reports 60 prop-driven state adjustments across the frontend and a
disproportionate share are in this directory.

The exception for imperative external systems (see root `AGENTS.md`) rarely
applies here. These are forms and grids over server data, not viewer bridges.
Server data is query state, not an external system.

## Modules

**Component authoring** — `library-component-workspace.tsx` (the monolith),
`library-component-quick-view.tsx`, `library-preview-inspector.tsx`,
`library-asset-link-picker.tsx`, `use-edit-history.ts`.

**Import** — `library-import-center.tsx`,
`library-import-remediation-dialog.tsx`, `library-import-remediation-grid.tsx`,
`library-folder-discovery-dialog.tsx`. Import produces proposals that a human
remediates before acceptance; the grid is the remediation surface.

**Catalog and release** — `library-catalog-workspace.tsx`,
`library-manager-workspace.tsx`, `library-bulk-edit-workspace.tsx`,
`library-release-queue.tsx`. Release transitions are governed on the backend —
the frontend requests a transition, it does not decide one.

**Project workspace** — `workspace-sidebar.tsx`, `workspace-list-view.tsx`,
`workspace-gallery-view.tsx`, `workspace-breadcrumbs.tsx`,
`workspace-project-toolbar.tsx`, `workspace-action-menus.tsx`,
`workspace-project-properties-sheet.tsx`, `workspace-loading-state.tsx`,
`workspace-types.ts`, and the four folder/project dialogs.

**Shared** — `async-search-picker.tsx` is the debounced remote-search control.
Its input buffer is genuinely local state; the resolved selection is not.

## Traps

- **Release status is authority-gated.** Do not derive what a user may do from
  the status alone; roles decide. See `frontend/src/lib/roles.ts`.
- **Catalog jobs are checkpointed and resumable.** A job that appears stalled
  may be mid-resume. Poll job state rather than inferring from partial results.
- **Bulk edit writes many records.** Confirm the failure mode of a partial batch
  before changing its submission path.
- `library-component-workspace.tsx` is slated for decomposition. Do not add to
  it if the work can live in a sibling module.
