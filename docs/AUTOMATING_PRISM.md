# Automating Prism

Prism can be automated in these ways:

| Need | Use |
| --- | --- |
| Call Prism from any language, or from CI | the HTTP API at `/api/v1` |
| Python scripts and a terminal command | the `kicad-prism` package and its `prism` CLI |
| An AI assistant reading and commenting on designs | the MCP server at `/mcp` |
| Tell another system when something happens | outbound webhooks |
| Review every pull request in CI | the templates in [`examples/ci`](../examples/ci) |

The API, the CLI and MCP all go through the same API code, the same role checks and the same folder visibility as the web UI. None of them can do something the caller couldn't do in the browser. Sign-offs (release approval, resolving comments, catalog QA and admin changes) stay with people signed in to Prism. Tokens can't perform them.

The design is in [ADR: scripting and MCP](architecture/adr-scripting-and-mcp.md).

## Tokens

Scripts and the CLI use a **personal access token** (PAT). To create one, open **Settings → Personal access tokens**, choose the scopes and an expiry, and copy the token. It is shown once and starts with `prism_pat_`.

| Scope | Allows |
| --- | --- |
| `api:read` | every read the token's owner can make (always included) |
| `comments:write` | create, edit and reply to comments (not resolve) |
| `design:write` | project and design changes that aren't sign-offs |
| `catalog:write` | catalog edits |
| `api:write` | all of the write scopes above |

A token acts with its owner's **current** role. If the owner is demoted or removed, the token loses that access at once. Revoke tokens in the same Settings page.

MCP clients don't use PATs. They sign in with OAuth (see [AI assistants (MCP)](#ai-assistants-mcp)) and appear under **Settings → Connected MCP clients**.

## HTTP API

- Base path `/api/v1`. The unversioned `/api` paths still work until v6.
- The OpenAPI document is at `/api/v1/openapi.json`. Every operation has a stable `operationId` and a typed response.
- Authenticate with `Authorization: Bearer <token>`.
- Errors are JSON `{detail, code}`.
- **Retrying writes safely:** send `Idempotency-Key: <uuid>` on a `POST`, `PUT`, `PATCH` or `DELETE`. Repeating the request with the same key within 24 hours returns the first response, marked with the `Idempotent-Replayed: true` header, instead of doing the work twice.
- **Pinning a revision:** design search, component and net reads take `revision` (a branch or commit), and the BOM takes `commit`. The response names the commit it read, so later calls can pin it.
- **Long work** (comparisons, bundle builds, imports) returns a job id. Poll `GET /api/v1/jobs/{job_id}` until the job finishes.
- **Events:** `GET /api/v1/events?after=<cursor>` lists what happened, oldest first: syncs, bundles, jobs, comparisons, comment changes and releases. The live socket `/api/v1/events/live` pushes the same events. Events retention is `PRISM_EVENT_RETENTION_DAYS` ([Configuration](CONFIGURATION.md)).

## Python SDK and CLI

```bash
pip install ./sdk/python
```

```bash
export PRISM_URL=https://prism.example.com
```

```bash
export PRISM_TOKEN=prism_pat_...
```

```python
from prism import Client

prism = Client()  # PRISM_URL and PRISM_TOKEN from the environment
bom = prism.get_project_bom("my-project")  # pin with commit="<sha>"
for line in bom["lines"]:
    print(line["quantity"], line["references"], line["fields"].get("Value"))
```

```bash
prism bom my-project --csv > bom.csv
```

```bash
prism comment add my-project --component U3 "Check the decoupling on this regulator."
```

```bash
prism sync my-project --wait
```

The write commands are `prism comment add|reply`, `prism sync`, `prism release build` and `prism compare`. With `--wait`, a command follows its job to the end and exits 1 if the job failed. A text argument of `-` reads the text from standard input.

Every API operation is a method named after its `operationId`. The package has no dependencies beyond the standard library. It isn't on PyPI yet. The [SDK README](../sdk/python/README.md) covers every command, the helpers (`iter_events`, `wait_for_job`) and how the client is regenerated.

## AI assistants (MCP)

### Turn it on

The MCP server is off by default. An admin sets these and restarts the backend:

```
PRISM_MCP_ENABLED=true
PUBLIC_BASE_URL=https://prism.example.com
```

`PUBLIC_BASE_URL` must be the address clients use: OAuth tokens are bound to `<PUBLIC_BASE_URL>/mcp`. While the server is off, `/mcp` and its OAuth metadata answer 404. See [Configuration](CONFIGURATION.md).

### Connect a client

The server is `https://prism.example.com/mcp` (Streamable HTTP). Clients that support MCP OAuth find the sign-in page on their own: the first connection opens Prism in the browser, you approve the client, and it's connected.

Claude Code:

```bash
claude mcp add --transport http prism https://prism.example.com/mcp
```

Claude Desktop and claude.ai: add a custom connector with the same URL.

A client without OAuth support can send a personal access token instead, as `Authorization: Bearer prism_pat_...`.

### What an assistant can do

Read tools:

| Tool | Returns |
| --- | --- |
| `search_projects`, `get_project`, `list_revisions` | projects and their commits |
| `find_in_design`, `get_component`, `get_net` | components and nets at a revision, with fields, pins and connections |
| `get_bom` | the engineering BOM at a revision |
| `compare_revisions`, `get_changes`, `get_comparison_review` | a comparison between two revisions, as the review rows the Design Comparison workspace shows |
| `get_job` | a job's status |
| `list_comments` | a project's comments |
| `search_catalog`, `get_catalog_component` | the component catalog |
| `get_release_status` | Release Studio candidates |
| `render_view` | a PNG of a schematic sheet, the PCB, or a 3D view at a revision, with chosen components or nets highlighted (no highlights in 3D) |

Write tools:

| Tool | Does | Scope |
| --- | --- | --- |
| `add_comment` | comments on a component, net, schematic sheet or comparison change, placed by the server from the design, not from coordinates | `comments:write` |
| `reply_to_comment` | replies to a thread | `comments:write` |
| `sync_project` | fetches the project from its remote now; returns a job id | `design:write` |
| `start_release_build` | queues a Release Studio candidate build for one commit; returns a job id | `design:write` |
| `create_catalog_draft` | creates an unreviewed catalog component | `catalog:write` |
| `update_import_proposal` | saves draft edits in a catalog import session | `catalog:write` |

Comments an assistant writes carry an **Agent** badge, with the client's name in its tooltip.

Some steps are never a tool: approving or publishing a release, catalog QA, admin changes and resolving a comment. For those, `request_release_approval` and `resolve_comment` change nothing. They hand the step back as a link (an MCP URL request), and the client opens it for you to act on in Prism.

An assistant starts with read access only. The first time it tries a write, Prism asks your client for just that scope, and you approve it in the browser. A client using a personal access token gets an error naming the scope it lacks.

Every write tool takes an optional `idempotencyKey`. A client that retries a write with the same key gets the first result back instead of, say, a second comment.

Results name the revision they read, and cite a Prism link and a `prism://` resource URI for each component, net or BOM. The links open the viewer on exactly that element (see [Links to a view](#links-to-a-view)). Comment text, field values and file contents come back as data marked untrusted, and no tool acts on instructions found inside them.

### What admins control

Admins configure MCP under **Settings → MCP**:

- **Project scope:** all projects (each user still sees only what their role and folder visibility allow), or a listed set. Outside a listed set, a project looks to an assistant exactly like one that doesn't exist.
- **Tools:** switch off any tool. A disabled tool disappears from the assistant's tool list.
- **Audit:** every MCP call is recorded with the user, client, tool, project, revision and outcome. So is every write made through the HTTP API with any token, recorded by route. The page filters by client, token, project, tool, and read or write. Rows are kept for `PRISM_MCP_AUDIT_RETENTION_DAYS` (default 365).

Users see and revoke their own connected clients under **Settings → Connected MCP clients**, and admins see everyone's.

Designs an assistant reads are sent to that assistant's model provider. Before enabling MCP, decide which projects may leave Prism this way, and limit MCP to them.

### Ops diagnostics

On a deployed server, an admin's assistant can look into Prism's own health without shell access: why a job is stuck, which route is slow, whether the workers are alive. This is off by default. Turn it on with:

```
PRISM_MCP_OPS_ENABLED=true
```

It adds two scopes, `ops:read` and `ops:act` (which includes `ops:read`). Only admins can hold them. If anyone else's client asks for them, the consent page leaves them out and says so. A client connected before the flag was on asks for them the first time it calls an ops tool. Personal access tokens can carry them too. `api:write` never grants either one.

Read tools (`ops:read`):

| Tool | Returns |
| --- | --- |
| `get_job_timeline` | a job's events, its resource slots and locks, a redacted log tail (at most 200 lines) and the request that created it |
| `get_bundle_build_profile` | a design-bundle build's time and peak memory per KiCad step, and its cache hits |
| `get_route_latency` | p50, p95 and p99 latency and 4xx and 5xx rates per route over a window of up to 7 days |
| `list_recent_requests`, `trace_request` | recent slow, failed and write requests, and one request id followed across the jobs, events and audit rows it created |
| `get_slow_queries` | the slowest database statements from `pg_stat_statements`, or the reason they're unavailable |
| `get_pool_and_workers` | the database pool, each worker's heartbeat, resource slots in use and the job queue by kind |
| `get_cache_stats` | cache hit rates and the size of each cache table and directory |
| `get_event_and_webhook_health` | the event log's head and retention, each webhook's lag and recent delivery failures |
| `capture_profile` | a sampled CPU profile, up to 10 s, of the API process or a worker, as collapsed stacks for a flame graph (one at a time, at most 6 an hour) |

Actions (`ops:act`):

| Tool | Does |
| --- | --- |
| `cancel_job` | asks a job to cancel |
| `requeue_job` | queues a failed job again, or a running one whose worker has died (its lease expired); a running job with a live worker, or one someone asked to cancel, is refused |
| `rebuild_bundle` | drops one commit's design bundle and builds it again |
| `set_debug_logging` | raises Prism's own loggers (`app` and below) to DEBUG for 1 to 30 minutes; every process picks it up within 15 s and reverts at the deadline; `0` clears it |

There is no tool for SQL, shell commands or configuration changes. Results carry ids, timings, counts and sizes, never design content. Log lines, error messages, query text and URLs pass through a redactor that strips credentials and tokens. Every call is audited like any other MCP call.

Each request gets an id, returned in the `X-Request-Id` response header; a client may send its own (1–64 characters of letters, digits, `.`, `_` or `-`). Slow requests (over 1 s), failed ones and writes are logged, and kept 3 days. Route statistics are kept 7 days.

The same reads and actions are HTTP routes under `/api/v1/ops`, for scripts and the SDK.

## Webhooks

Admins register endpoints under **Settings → Webhooks**: an HTTPS URL, the event kinds to send, and all projects or a chosen few. Prism posts one JSON request per event, in order:

```json
{"id": 4182, "type": "comparison.done", "createdAt": "2026-10-26T12:00:00Z", "projectId": "my-project", "data": {}}
```

| Event | When |
| --- | --- |
| `revision.synced` | a project fetched new commits |
| `bundle.built`, `bundle.failed` | a revision's design data finished building |
| `job.progress`, `job.finished` | a job moved or ended |
| `comparison.done` | a design comparison finished |
| `comment.changed` | a comment or reply was added, edited or resolved |
| `release.candidate_built`, `release.approved` | a Release Studio candidate built, or a person approved it |

- **Signing:** deliveries follow [Standard Webhooks](https://www.standardwebhooks.com/). They carry `webhook-id`, `webhook-timestamp` and `webhook-signature` headers, signed with the endpoint's `whsec_…` secret. The secret is shown once, when the endpoint is created or its secret rotated. [`examples/webhooks/verify_prism_webhook.py`](../examples/webhooks/verify_prism_webhook.py) verifies a delivery with the standard library only.
- **Retries:** a failed delivery is retried after 30 seconds, then twice as long each time, up to an hour. After 24 hours of failures the endpoint is marked failing and stops until an admin enables it again. Events wait in order meanwhile, for as long as the event log keeps them (`PRISM_EVENT_RETENTION_DAYS`).
- **Targets:** endpoints must be HTTPS on a public address. `PRISM_WEBHOOK_ALLOW_PRIVATE=true` allows HTTP and private addresses for a local test receiver.
- **Secrets** are encrypted with `TRACKER_CREDENTIAL_ROOT_KEY`, so set that before adding an endpoint ([Configuration](CONFIGURATION.md)).

**Test** on an endpoint's row sends a `ping` event. Its latest deliveries are listed under the row.

## Links to a view

A project link can open the viewer showing exactly one view. These parameters go on `/project/<id>?section=visualizers`, alongside `tab` (`sch`, `pcb`, `3d`) and `commit`:

| Parameter | Opens with |
| --- | --- |
| `sel=R1,U3` | those components (references or element uuids) selected, the first one in view |
| `nets=GND,VBUS` | those nets highlighted |
| `page=/Power/` | that schematic sheet |
| `bbox=10,20,30,15` | that region in view: x, y, width, height in mm |
| `insets=1` | insets on |

In a list, each item is URL-encoded on its own before the items are joined with commas, so a name that contains a comma survives. Links in MCP results are built this way.

On a project page, `window.prism` gives scripts the same thing:

```js
window.prism.getState()                 // {section, tab, commit, sel, nets, ...}
window.prism.link({ tab: "pcb", nets: ["GND"] })
await window.prism.open({ sel: ["U3"] })
```

## CI templates

[`examples/ci`](../examples/ci) has a GitHub Actions workflow and a GitLab CI job for a KiCad repository whose project is registered in Prism. On each pull or merge request they do four things:

1. sync the project;
2. compare the base and head commits;
3. export the head's BOM;
4. keep `comparison.json` and `bom.csv` as artifacts.

They need the Prism URL, the project id, and a personal access token with `api:read` and `design:write`. Comments in each file explain the settings.
