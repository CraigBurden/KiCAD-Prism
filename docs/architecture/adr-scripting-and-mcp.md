# ADR: Scriptable Prism and the MCP server

- **Status:** Proposed (2026-10-26). §2 records decisions the maintainer took on 2026-10-25 and 2026-10-26. §3 is proposed and becomes binding on acceptance. §9 lists what is still open.
- **Branch:** work happens on `feature/scripting-mcp`; every PR in this effort targets it, and it merges into `dev` once the v5.1 slice (§7) is complete.
- **Builds on:**
  - the caller policy table, `backend/app/core/policy.py`: one rule per action, naming roles, bearer scopes and provider refusals;
  - the error contract (`{detail, code}`) and guarded writes (`If-Match`, 412/428), `backend/app/core/errors.py` and `preconditions.py`;
  - jobs: `GET /api/jobs/{id}`, `/events?after=`, `/logs`, `/artifact`;
  - the design bundle ([`adr-native-design-bundle.md`](adr-native-design-bundle.md)), whose stated intent is that the MCP server reads designs through the bundle and `prism-kicad`;
  - the comment anchors and change feed ([`live-comments.md`](live-comments.md)).
- **Spec baseline:** Model Context Protocol revision 2026-07-28.

## 1. Context

Prism's theme for the next major (v6) is AI integration. Prism does not run a model; it gives the user's own agents (Claude, Cursor, Claude Code, a CI job) a safe, complete surface to work against. Two things stand in the way, both measured on `dev` at 16097ea0:

- **The API isn't a contract yet.**
  - 319 routes in 38 modules, of which 18 declare a `response_model`. OpenAPI is served, but a generated client or an MCP tool schema built from it would be mostly untyped.
  - No route has a stable `operation_id`, and there's no version prefix.
  - Meaning is computed in the frontend: the engineering BOM (`engineering-bom-table.tsx`) and comparison review grouping (`comparison-review-queue.ts`). A second client would compute them differently.
  - Most design data has no route. Only `projections/semantic-index.json` is served raw. `design.json`, placements, stackup, route metrics and the system interface are not reachable at all.
- **Scripts and agents have no way in.**
  - Bearer callers today:
    - service clients (admin-created, `client_credentials` at `/oauth/token`);
    - KiCad agent tokens (PKCE, loopback only, 30 days);
    - KiCad remote-provider tokens;
    - external JWT.
  - There are no user-owned tokens and no OAuth clients that a third-party MCP client can register as.
  - Scopes are just `api:read` and `api:write`, so a token that may comment may also approve a release (if its user may).
  - Audit records don't name the client or token: an agent's action reads as the user's own click.
  - Nothing announces events (new revision, bundle ready, comparison done), so CI and agents can't react.
  - Viewer state (selection, highlighted nets, insets, camera) isn't addressable, so an agent can't hand back a link to what it means. `services/trackers/deep_links.py` also builds `/projects/<id>`, which matches no route.

## 2. Decisions taken (2026-10-25)

| # | Decision |
| --- | --- |
| D1 | The MCP server runs **inside the backend at `/mcp`**, sharing auth, policy and services. No separate process. |
| D2 | The API is **versioned now**: every route is served under `/api/v1/...`. The unversioned paths stay as aliases for the browser and existing tokens until v6. The SDK, CLI and MCP use `/api/v1` only. |
| D3 | `api:write` is **split into area scopes**: `comments:write`, `design:write`, `catalog:write`, and the sensitive `release:approve`, `catalog:qa`, `admin`. `api:write` stays as an alias that implies all of them, so existing tokens keep working. |
| D4 | **MCP only, no in-app assistant.** Users bring their own clients and agents. Prism never calls a model. |
| D5 | Minor releases roughly monthly; not formalized. |
| D6 | **Only people resolve comments** (2026-10-26). An agent may reply to any comment it can read, but resolving or reopening a thread is a human action, whoever wrote it and whatever the agent was asked to do. |
| D7 | **Every MCP read is audited** (2026-10-26), with client, tool, project and revision; no sampling. |
| D8 | **The SDK is designed to be published** (2026-10-26): its own package, versioning and licence metadata from the start. Whether and where to publish is decided later. |
| D9 | **`render_view` ships in v5.1** (2026-10-26), not v5.2: PNG renders of a schematic region, PCB area or 3D view with highlights, for multimodal agents. |

## 3. Decisions proposed

### 3.1 Layering: one authority

```
services (projects, design bundle, compare, comments, catalog, release, jobs)
   │  policy.authorize(action, caller)       ← every caller, every path
   ├── typed HTTP API  /api/v1   ── web UI, Python SDK, `prism` CLI
   ├── tool registry             ── MCP server /mcp
   ├── event log                 ── webhooks (v5.2), MCP subscriptions
   └── deep links                ── /project/:id?…, prism:// URIs
```

- A tool calls the same service a route calls, under the same policy action. No tool reaches data the caller couldn't reach in the UI.
- Routes and tools are thin. Validation, meaning and side effects live in services.

### 3.2 Typed, versioned API

- **Mount.** One router tree is included twice: under `/api/v1` and, until v6, under `/api`. Only `/api/v1` appears in the published OpenAPI document. The browser keeps calling `/api` until the frontend moves over in one change.
- **Every v1 route declares** `response_model`, `summary`, and an `operation_id` of the form `<area>_<verb>[_<object>]`, for example `projects_list` or `comments_create_reply`. Operation ids are stable: renaming one is a breaking change.
- **Ratchet.** A CI check, like the module-size gate, records how many routes are untyped. The count may only go down. A route added without a `response_model` fails CI.
- **Target for v5.1:** every route a tool, the SDK or the CLI uses is typed, and at least 60% of all routes are.

### 3.3 Revision pinning

- Every design read takes `revision`: a full commit sha, a branch or a tag. The default is the project's default branch head.
- Every response states the resolved `commit` and, where a bundle exists, its `designKey`.
- A response for a full commit sha is immutable and is served with the pinned cache headers v5.0.2 added. Answers are reproducible, cacheable and citable.

### 3.4 Idempotent writes

- Every v1 write accepts an `Idempotency-Key` header; MCP write tools take it as an argument.
- The key is scoped to (caller, `operation_id`, key) and kept for 24 hours with the response status and body. A repeat returns the stored response and does nothing else. The same key with a different body answers 422 `idempotency-key-reused`.
- Guarded writes keep `If-Match`.

### 3.5 Scopes, actors and human-only actions

- **Scopes.** D3's area scopes go into `RULES` in `policy.py`; `IMPLIED_SCOPES` makes `api:write` imply them all, and each write scope implies `api:read`. One mapping per policy action:

  | Policy action | Scope |
  | --- | --- |
  | `read`, `catalog_browse`, `catalog_read` | `api:read` |
  | `comment` | `comments:write` |
  | `design` | `design:write` |
  | `catalog_write` | `catalog:write` |
  | `release` | `release:approve` |
  | `catalog_qa` | `catalog:qa` |
  | `admin`, `catalog_admin` | `admin` |

- **Human-only actions.** `release`, `catalog_qa`, `admin`, `catalog_admin` and resolving or reopening a comment (a new `comment_resolve` action, split from `comment`; D6) are refused to MCP callers in the policy table itself, whatever scopes the token holds. A tool that reaches one returns an input-required result in URL mode: a link to the Prism page where a person acts. Personal access tokens may hold the release, QA and admin scopes for scripts the user runs knowingly; MCP clients may not request them. No token resolves a comment: resolving needs a session.
- **Actor model.** Every write and audit record stores `user`, `auth_type`, `client_id`, `token_id` and an optional `agent_run_id` (passed by the client). Comments get `authorKind` (`person`, `agent`, `service`) and the client's name, so the UI can mark agent-authored comments.

### 3.6 Tokens and OAuth

- **Personal access tokens.**
  - Created by the user in Settings, with a name, scopes and an expiry (default 90 days, at most 1 year; admins can lower the maximum).
  - Shown once, stored hashed, with a recognisable prefix (`prism_pat_`) so secret scanners can find leaks.
  - Revocable. Settings lists each token's last use.
  - A token never holds more than its user's role allows; the role check still runs.
- **OAuth for MCP clients.**
  - `/mcp` is an OAuth protected resource, with RFC 9728 metadata pointing at Prism's authorization server: the existing one, extended.
  - Client registration uses Client ID Metadata Documents. Dynamic Client Registration is not offered.
  - The flow is authorization code with PKCE (S256), with `iss` in the authorization response (RFC 9207) and refresh tokens.
  - **Incremental consent:** a client starts with `api:read`. Its first write is answered with `WWW-Authenticate` naming the scope it needs, and the user consents to just that.
  - Settings lists connected clients, each revocable.
- **Every token carries an id** (`jti` for JWTs, the row id for PATs). That id is what the actor model records.

### 3.7 Tool registry and the MCP server

- **Registry.** A tool is declared beside its service as:
  - a name;
  - a Pydantic input model and output model;
  - the policy action it needs;
  - MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`).

  The registry is a plain module API, published early so the supply module can register its tools against it. Supply's `POST /api/supply/mcp` is replaced, not kept beside it.
- **Task-level tools, not one per route.** About 25 tools that match real workflows. Scripts use the SDK for everything else. The v5.1 read set:
  - `search_projects`, `get_project`, `list_revisions`;
  - `find_in_design`, `get_component`, `get_net`, `get_bom`;
  - `compare_revisions`, `get_changes`;
  - `list_comments`;
  - `search_catalog`, `get_catalog_component`;
  - `get_release_status`;
  - `render_view` (D9): a PNG of a schematic region, PCB area or 3D view at a revision, with given components or nets highlighted, rendered headless from the revision's bundle with the same viewer code the web UI runs.
- **Server.** Streamable HTTP, stateless. Cross-call state is always an explicit handle (job id, comparison id, commit sha), never a session.
- **Long work.** Comparisons and bundle builds run as Prism jobs, exposed through the tasks extension (`io.modelcontextprotocol/tasks`). The task handle is the job id.
- **Results.**
  - Every tool has an `outputSchema` from its output model, plus a compact text rendering.
  - Large payloads (a full BOM, netlist, comparison) come back as resource links, not inline text.
  - Lists have cursors and a deterministic order.
- **Errors.** Validation and policy failures are tool execution errors carrying the existing `{code, detail}`, so the model can act on them. They aren't protocol errors.
- **Untrusted content.** Comment bodies, field values, datasheet text and file contents are returned as data, marked with their source. No tool takes instructions from them: every write needs explicit arguments.
- **Out of scope:** Sampling (deprecated by the 2026-07-28 spec), and any server-initiated model call (D4).

### 3.8 Meaning moves server-side

The engineering BOM, comparison review grouping and queues, comment anchor resolution and net or component neighbourhoods move from the frontend into services, as part of typing the API. The UI becomes a client of them. Otherwise an agent and a person looking at the same revision disagree about what a BOM line or a review group is.

Design queries run in a **design-query service** over the revision's bundle projections and `design.json`, using `prism-kicad bundle extract` where that is cheaper. This keeps the design bundle ADR's intent inside D1.

### 3.9 Identity and addressability

- **Identity contract.** The contracts document which ids are stable across revisions: design key, `componentUid`, KIID path, change `semanticId`. A cross-revision test over the fixture corpus enforces them.
- **One URL grammar** for every element and view state: revision, tab, selection, highlighted nets, open insets, camera, comparison item. The UI, tools and tracker links all build URLs from one helper, which also fixes the plural `/projects/` bug in `deep_links.py`.
- **Resource URIs:** `prism://project/{id}/rev/{sha}/…` for components, nets, BOMs, netlists, stackups, sheets, comparisons and release dossiers.
- Every element in a tool result carries both `link` (HTTPS deep link) and `uri` (resource URI).

### 3.10 Event log

- An append-only event table records:
  - revision synced;
  - bundle built or failed;
  - comparison done;
  - comment changed;
  - release candidate built or approved.
- In v5.1 it backs MCP subscriptions and a polling route (`GET /api/v1/events?after=`), the pattern the comment change feed already uses.
- Signed outbound webhooks with retries read the same log in v5.2.

### 3.11 Governance

- **Off by default.** `PRISM_MCP_ENABLED` (default `false`), like Simulation Studio's flag: while unset, `/mcp` and its metadata answer 404.
- **Scoping.** Admins can limit MCP to chosen projects and tools.
- **Read audit** (D7). Every MCP read is logged with client, tool, project and revision, so admins can answer "which client read which design". Proprietary designs will flow to third-party model providers through users' own clients, and admins need control and evidence.

### 3.12 SDK and CLI

- A Python client generated from the `/api/v1` OpenAPI document, with a thin hand-written layer for auth (PAT or device flow), pagination and job waiting.
- A `prism` CLI on top, for example:
  - `prism projects list`;
  - `prism compare <base> <head> --wait`;
  - `prism bom <project> --revision <rev> --csv`;
  - `prism comment …`.
- Both live in this repo, in one package (`sdk/python`, distribution name `kicad-prism`, import name `prism`), versioned with the API. CI regenerates the client and fails on drift.
- Designed to publish (D8): Apache-2.0 metadata, semantic versions that follow the release tag, no imports from `backend/`, and its own tests. Until a publishing decision, it ships as a wheel in the release archive.

## 4. What this does not do

- No in-app assistant, no model calls, no Sampling (D4).
- No tool per route.
- No MCP writes in v5.1. Write tools come in v5.2, each behind its area scope, after the actor model and idempotency keys are in.
- No release approval, publishing, catalog QA or admin action through MCP, ever (§3.5).
- No comment resolved or reopened by any token or agent (D6).
- No change to session auth in the browser. Session callers carry no scopes, as today.

## 5. Consequences

- **Two prefixes until v6.** `/api` and `/api/v1` both route, which doubles the route table. OpenAPI publishes `/api/v1` only, and v6 removes the alias for bearer callers.
- **Typing touches every API module**, a large but mechanical change. The ratchet lets it land incrementally.
- **Frontend code moves to services** (§3.8), so the frontend will need fixture updates where it computed BOM and review groups itself.
- **Schema changes:** migrations for personal access tokens, OAuth clients and grants, idempotency keys, events, and the actor columns.
- **The existing scope check gets finer.** A token holding only `api:write` keeps working because of the alias. New tokens and clients request less.

## 6. Security notes

- The bearer path, not MCP, is the trust boundary: MCP adds no permission the policy table doesn't grant.
- `render_view` runs the viewer headless on the worker, never in the request process, under the same memory budget as other worker jobs.
- PATs and refresh tokens are stored hashed; access tokens are short-lived JWTs (proposed: 1 hour).
- `/mcp` validates `Origin` and the token's audience (the resource indicator) on every request. A token minted for another resource is refused.
- Rate limits per client and per token, configured by admins (v5.3), with defaults from v5.1.

## 7. Work packages for v5.1

Each package is one PR into `feature/scripting-mcp`, in this order. Packages on the same line can run in parallel.

| # | Package | Depends on |
| --- | --- | --- |
| MCP-00 | This ADR | — |
| MCP-01 | `/api/v1` mount, `operation_id` convention, untyped-route ratchet in CI | 00 |
| MCP-02 | Area scopes and human-only actions in `policy.py`; actor columns and `authorKind` | 00 |
| MCP-03 | Personal access tokens (model, routes, Settings UI) | 02 |
| MCP-04 | Idempotency keys and revision pinning on v1 | 01 |
| MCP-05 | Server-side BOM, review grouping and anchor resolution; the design-query service | 01 |
| MCP-06 | Typing pass over the routes MCP and the SDK use | 01, 05 |
| MCP-07 | Identity contract test; URL grammar helper; `deep_links.py` fix | 00 |
| MCP-08 | Event log and `GET /api/v1/events` | 01 |
| MCP-09 | OAuth for MCP clients (CIMD, RFC 9728, RFC 9207, refresh, incremental consent) | 02, 03 |
| MCP-10 | Tool registry and the read-only MCP server at `/mcp`, with tasks and resource links | 05, 06, 09 |
| MCP-11 | Governance switches and read audit | 10 |
| MCP-12 | Python SDK and `prism` CLI | 06 |
| MCP-13 | `render_view`: headless renders from the bundle, as a route and a tool (D9) | 05, 07, 10 |
| MCP-14 | Docs: "Automating Prism" (SDK, CLI, MCP client setup) | 10, 12 |

The branch merges into `dev` when MCP-01 to MCP-14 are in and the full suites pass on it. The automated upgrade and rollback check from the release plan is separate, not part of this branch.

## 8. Alternatives considered

- **A separate MCP process calling the HTTP API.** It would need its own auth bridge and would duplicate the policy checks. Rejected by D1.
- **Generate one tool per OpenAPI operation.** Cheap to build, but 319 tools swamp any model, and route boundaries don't match tasks. Rejected.
- **Keep unversioned paths as the contract.** No room to change shapes without breaking scripts. Rejected by D2.
- **Dynamic Client Registration for MCP clients.** Deprecated by the 2026-07-28 spec in favour of Client ID Metadata Documents.

## 9. Open questions

1. **One MCP endpoint per deployment, or per workspace?** A deployment is one workspace today (no workspace id anywhere in the schema), so one `/mcp` per deployment is proposed. Projects are limited by folder visibility and the admin allowlist (§3.11). Per-workspace endpoints only matter if Prism becomes multi-tenant, and would then mean one OAuth resource and audience per workspace.
2. **Publish the server in the MCP Registry?** The registry is a public catalog that clients search to find servers. Every Prism is self-hosted at its own URL, so an entry would describe how to connect, not where. Proposed: documentation only for v5.1; revisit once the server is stable.
