---
name: prism-api-endpoint
description: Scaffold a new KiCAD Prism API endpoint with role-aware access, audit identity, and tests. Use when adding a route to backend/app/api/.
---

# Add an API endpoint

The access-control rules in the root `AGENTS.md` are not advisory. This skill
turns them into steps so they are not skipped.

## 1. Pick the router

Routers live in `backend/app/api/`. Add to the existing one for the domain
rather than creating a new module — `projects.py`, `catalog_admin.py`,
`comments.py`, `release_studio.py`, `design_compare.py`, `workspace.py`,
`folders.py`, `settings.py`.

Shared dependencies are in `backend/app/api/_helpers.py`.

## 2. Authorize with a role-aware lookup

**Never** fetch a project without checking the caller's role.
`backend/app/api/projects.py` documents why: a role-blind helper is one import
from an access-control bypass. Use the role-aware function; if you believe a
resource may be returned to someone who cannot otherwise see it, say why at the
call site.

Roles are defined in `backend/app/core/roles.py`, access logic in
`backend/app/services/access_service.py`.

## 3. Derive identity from the session

Audit fields come from the authenticated user, never from a request-supplied
name. Anything else lets a caller forge attribution.

## 4. Schema

Request and response models go in `backend/app/schemas/`. Keep them narrow —
an over-permissive model is how unvalidated fields reach a service.

## 5. Service, not router, holds the logic

Routers validate, authorize, and delegate. Business logic belongs in
`backend/app/services/`. A router that grows past request handling is the start
of the next god object.

## 6. Long-running work becomes a job

Do not block a request on `kicad-cli`, a clone, or a large parse. Register a
handler in `backend/app/services/job_handlers.py`, return a job id, and let the
browser poll. See the job section of the root `AGENTS.md`.

## 7. Errors

Never include exception detail in a response — database errors can carry
credentials (`backend/app/api/health.py`). Where a specific message is
deliberately actionable, do not flatten it into a generic 500; the pattern is
documented in `backend/app/api/projects.py`.

Fail closed on any auth or limiter outage.

## 8. Tests

Add to `backend/tests/`. Cover the unauthorized case explicitly — an endpoint
tested only with an authorized caller has not been tested for access control.

Finish by running the `prism-quality-gate` skill.
