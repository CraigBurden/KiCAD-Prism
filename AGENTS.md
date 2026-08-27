# AGENTS.md

Navigation and hard rules for agents working in KiCAD Prism. Deliberately
complementary: it does not restate anything documented elsewhere. Paths are
repo-root relative and CI-verified by `scripts/check_agent_docs.py`.

**Read these before acting, not after:**

- Service topology, storage domains, PostgreSQL schemas, trust boundaries —
  [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Read before changing any service
  boundary, job class, or persistence path.
- Setup, the four check suites, branch prefixes, dependency policy —
  [CONTRIBUTING.md](CONTRIBUTING.md). Read before your first command in a fresh
  checkout, and before adding any dependency.

Deeper maps live next to the code they describe. Read the one covering your
change:

| Working in | Read |
| --- | --- |
| Release Studio | `backend/app/release_studio/AGENTS.md` |
| Catalog services | `backend/app/services/AGENTS.md` |
| Design comparison | `frontend/src/components/design-comparison/AGENTS.md` |
| Library workspace | `frontend/src/components/workspace/AGENTS.md` |

## How work reaches a worker

Every long-running operation is a job. `backend/app/services/job_handlers.py`
holds the single dispatch table mapping job kind to handler function — start
there when tracing any async behavior. Jobs are claimed from PostgreSQL with
leases and fencing (`backend/app/services/job_service.py`,
`backend/app/services/job_runtime.py`) and executed by
`backend/app/prism_worker.py` or the catalog worker. The browser polls job
state; it is never pushed to.

The frontend has exactly two routes, both in `frontend/src/App.tsx`. The root
route mounts `frontend/src/components/workspace.tsx`; the project route mounts
`frontend/src/pages/ProjectDetailPage.tsx`, which lazy-loads every feature tab.
Any screen you are looking for is in one of those two trees.

## Feature traces

Files in execution order. Touching one hop usually means touching its tests in
the same commit.

**Import a project from Git**
`backend/app/api/projects.py` · `backend/app/api/folders.py` →
`backend/app/services/project_import_service.py` (`run_project_analyze_job_v3`
then `run_project_import_job_v3`) → `backend/app/services/git_service.py` ·
`backend/app/services/git_access_service.py` → worker →
`frontend/src/components/import-dialog.tsx` →
`frontend/src/components/workspace.tsx`

**Compare two commits**
`backend/app/api/design_compare.py` →
`backend/app/services/design_compare_service.py` (`run_design_compare_job_v3`)
→ `backend/app/services/design_compare_nodes.py` (parse) →
`backend/app/services/design_compare_semantics.py` (grouping) →
`backend/app/services/design_compare_artifacts.py` →
`frontend/src/components/history-viewer.tsx` →
`frontend/src/components/design-comparison/design-comparison-workspace.tsx`

**Build a release**
`backend/app/api/release_studio.py` →
`backend/app/services/release_studio_service.py` →
`backend/app/services/release_studio_build_service.py`
(`run_release_studio_build_job`) → `backend/app/release_studio/pipeline.py` →
`backend/app/release_studio/steps.py` · `backend/app/release_studio/jobset.py`
→ `backend/app/release_studio/documents/` →
`frontend/src/components/release-studio/ReleaseStudioPanel.tsx`

**Author and release a component**
`backend/app/api/catalog_admin.py` →
`backend/app/services/component_catalog_domain.py` →
`backend/app/services/component_catalog_service_postgres.py` →
`backend/app/services/catalog_worker_tasks.py` (catalog worker) →
`frontend/src/components/workspace/library-component-workspace.tsx` ·
`frontend/src/components/workspace/library-release-queue.tsx`

**Comment on a project or comparison**
`backend/app/api/comments.py` →
`backend/app/services/comments_store_service.py` ·
`backend/app/services/comments_url_service.py` →
`frontend/src/components/comment-panel.tsx` →
`frontend/src/components/visualizer.tsx` (overlay anchoring)

**Place a symbol from desktop KiCad**
`backend/app/api/remote_provider.py` · `backend/app/api/provider_oauth.py` →
`backend/app/services/provider_auth_service.py` →
`backend/app/services/component_catalog_domain.py` → `frontend/src/panel/`
(separate Vite build, `frontend/vite.config.panel.ts`)

## Hard rules

These are settled. Do not relitigate them in a PR.

### State hierarchy (frontend)

Source of truth, in order: **URL → server/query state → selection → local UI
state.** A value available from a higher tier is computed at the point of use.
It is never copied into `useState` and resynchronized with `useEffect`.

This is the most common defect in this codebase's history. Six commits exist
solely to undo it — `3e1761a`, `a132c2f`, `1ca704b`, `644a72d`, `4ba295d`,
`596d8c2` — and React Doctor still reports 60 prop-driven state adjustments.
Adding another is a regression, not a style preference.

**The one exception:** synchronizing with an imperative system React does not
own — the ECAD viewer custom element, a WebGPU canvas, the history API. Those
expose their own lifecycles (the viewer exposes `ready` as a Promise, not a
boolean) and an effect is the correct tool. Nothing else qualifies. Server data
is not an external system; it is query state.

An exception must carry a one-line reason, matching the
`react-doctor-disable-next-line <rule> - <reason>` convention already used at
`frontend/src/components/visualizer.tsx` line 339 and
`frontend/src/components/design-comparison/comparison-presentation-shell.tsx`
line 240. An unexplained effect that writes state reads as the defect and will
be removed.

### Access control

- Never add a project lookup that ignores the caller's role.
  `backend/app/api/projects.py` carries an explicit warning: a role-blind helper
  is one import away from an access-control bypass. Use the role-aware function.
- Derive audit identity from the authenticated session, never from a
  request-supplied name.
- Never fail open. A limiter, auth, or provider outage denies the request;
  `backend/app/services/rate_limit_service.py` documents why.
- Never put exception detail in an error response. Database errors can carry
  credentials (`backend/app/api/health.py`).
- Never pin Git host keys with `accept-new`
  (`backend/app/services/project_import_service.py`).

### Scope

One purpose per change. Do not fold cleanup, refactoring, or drive-by fixes into
a behavior change — `CONTRIBUTING.md` requires separate branches, and mixing
them makes rollback during alpha stabilization unsafe. If you notice unrelated
work, report it; do not do it.

## Known structural debt

Accurate as of this file's last update. Do not treat these as models to copy.

- `backend/app/services/component_catalog_domain.py` — 8,200 lines, one class,
  194 methods, spanning archive handling, subprocess invocation, XML parsing,
  CSV export, and hashing. Decomposition is planned along its `klc_*`,
  `preview_*`, `import_*`, and `export_*` method prefixes.
- `frontend/src/components/workspace/library-component-workspace.tsx` — 2,569
  lines, 44 `useState` calls. Prime target for the state hierarchy rule above.
- `frontend/src/components/` has 43 files loose at its top level while four
  features are properly foldered. New components go in a feature folder.
